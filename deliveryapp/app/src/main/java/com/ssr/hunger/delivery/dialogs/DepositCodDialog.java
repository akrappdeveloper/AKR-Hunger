package com.ssr.hunger.delivery.dialogs;

import android.app.Activity;
import android.app.Dialog;
import android.content.Context;
import android.os.Bundle;
import android.text.TextUtils;
import android.util.DisplayMetrics;
import android.view.ViewGroup;
import android.view.Window;
import android.widget.EditText;
import android.widget.RadioGroup;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;

import com.google.android.material.button.MaterialButton;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.FieldValue;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.SetOptions;
import com.razorpay.Checkout;
import com.razorpay.PaymentData;
import com.ssr.hunger.delivery.R;
import com.ssr.hunger.delivery.activities.MainActivity;
import com.ssr.hunger.delivery.utils.Constants;
import com.ssr.hunger.delivery.utils.LocationUtils;

import org.json.JSONObject;

import java.util.HashMap;
import java.util.Map;

public class DepositCodDialog extends Dialog {

    public interface OnCodDepositedListener {
        void onDeposited(double amount);
    }

    private final double remainingCodDue;
    private final OnCodDepositedListener listener;

    private EditText etAmount;
    private RadioGroup rgMethod;

    public DepositCodDialog(@NonNull Context context, double remainingCodDue, OnCodDepositedListener listener) {
        super(context);
        this.remainingCodDue = remainingCodDue;
        this.listener = listener;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        setContentView(R.layout.dialog_deposit_cod);

        if (getWindow() != null) {
            getWindow().setBackgroundDrawableResource(android.R.color.transparent);
            DisplayMetrics metrics = getContext().getResources().getDisplayMetrics();
            int targetWidth = (int) (metrics.widthPixels * 0.94f);
            if (targetWidth > 1250) targetWidth = 1250;
            getWindow().setLayout(targetWidth, ViewGroup.LayoutParams.WRAP_CONTENT);
        }

        TextView tvDue = findViewById(R.id.tv_deposit_cod_due);
        tvDue.setText(LocationUtils.formatCurrency(remainingCodDue));

        etAmount = findViewById(R.id.et_deposit_amount);
        rgMethod = findViewById(R.id.rg_deposit_method);

        if (remainingCodDue > 0) {
            etAmount.setText(String.valueOf((int) Math.round(remainingCodDue)));
        }

        MaterialButton btnChipFull = findViewById(R.id.btn_chip_full);
        MaterialButton btnChip500 = findViewById(R.id.btn_chip_500);
        MaterialButton btnChip1000 = findViewById(R.id.btn_chip_1000);

        btnChipFull.setOnClickListener(v -> etAmount.setText(String.valueOf((int) Math.round(remainingCodDue))));
        btnChip500.setOnClickListener(v -> etAmount.setText("500"));
        btnChip1000.setOnClickListener(v -> etAmount.setText("1000"));

        MaterialButton btnCancel = findViewById(R.id.btn_cancel_deposit);
        MaterialButton btnConfirm = findViewById(R.id.btn_confirm_deposit);

        btnCancel.setOnClickListener(v -> dismiss());
        btnConfirm.setOnClickListener(v -> initiateSecureDeposit());
    }

    private void initiateSecureDeposit() {
        String str = etAmount.getText().toString().trim();
        if (TextUtils.isEmpty(str)) {
            etAmount.setError("Enter deposit amount");
            return;
        }

        double amount;
        try {
            amount = Double.parseDouble(str);
        } catch (NumberFormatException e) {
            etAmount.setError("Invalid amount format");
            return;
        }

        if (amount <= 0) {
            etAmount.setError("Amount must be greater than ₹0");
            return;
        }

        FirebaseAuth auth = FirebaseAuth.getInstance();
        FirebaseUser user = auth.getCurrentUser();
        if (user == null) {
            com.ssr.hunger.delivery.utils.ToastUtils.showToast(getContext(), "Session expired. Please log in again.", Toast.LENGTH_SHORT);
            return;
        }
        String uid = user.getUid();

        Activity activity = null;
        if (getContext() instanceof Activity) {
            activity = (Activity) getContext();
        } else if (getOwnerActivity() != null) {
            activity = getOwnerActivity();
        }

        if (activity == null) {
            com.ssr.hunger.delivery.utils.ToastUtils.showToast(getContext(), "Unable to initialize payment window", Toast.LENGTH_SHORT);
            return;
        }

        boolean isUpi = rgMethod.getCheckedRadioButtonId() == R.id.rb_deposit_upi;
        String method = isUpi ? "Razorpay UPI" : "Razorpay NetBanking / Card";
        String trackingRef = "COD-TXN-" + System.currentTimeMillis() + "-" + (int) (1000 + Math.random() * 9000);

        final Activity hostActivity = activity;
        final double finalAmount = amount;

        // Register callback with MainActivity for secure Razorpay response
        if (activity instanceof MainActivity) {
            ((MainActivity) activity).setRazorpayPaymentCallback(new MainActivity.OnRazorpayPaymentCallback() {
                @Override
                public void onPaymentSuccess(String razorpayPaymentId, PaymentData paymentData) {
                    recordVerifiedDeposit(hostActivity, uid, finalAmount, razorpayPaymentId, paymentData, trackingRef, method);
                }

                @Override
                public void onPaymentError(int code, String response, PaymentData paymentData) {
                    recordFailedDeposit(hostActivity, uid, finalAmount, code, response, trackingRef);
                }
            });
        }

        // Launch Razorpay Checkout
        try {
            Checkout checkout = new Checkout();
            checkout.setKeyID(Constants.RAZORPAY_KEY_ID);

            JSONObject options = new JSONObject();
            options.put("name", "AKR Hunger Delivery");
            options.put("description", "COD Cash Settlement • Ref: " + trackingRef);
            options.put("currency", "INR");
            options.put("amount", Math.round(amount * 100)); // paise

            JSONObject prefill = new JSONObject();
            if (user.getEmail() != null) prefill.put("email", user.getEmail());
            if (user.getPhoneNumber() != null) prefill.put("contact", user.getPhoneNumber());
            options.put("prefill", prefill);

            JSONObject theme = new JSONObject();
            theme.put("color", "#FF6B00");
            options.put("theme", theme);

            dismiss();
            checkout.open(activity, options);
        } catch (Exception e) {
            com.ssr.hunger.delivery.utils.ToastUtils.showToast(getContext(), "Razorpay error: " + e.getMessage(), Toast.LENGTH_LONG);
        }
    }

    private void recordVerifiedDeposit(Activity activity, String uid, double amount, String razorpayPaymentId,
                                       PaymentData paymentData, String trackingRef, String method) {
        FirebaseFirestore db = FirebaseFirestore.getInstance();

        Map<String, Object> tx = new HashMap<>();
        tx.put("driverId", uid);
        tx.put("riderId", uid);
        tx.put("amount", amount);
        tx.put("type", "cod_deposit");
        tx.put("status", "completed");
        tx.put("paymentMethod", method);
        tx.put("reference", trackingRef);
        tx.put("trackingId", trackingRef);
        tx.put("razorpayPaymentId", razorpayPaymentId);
        if (paymentData != null) {
            if (paymentData.getOrderId() != null) tx.put("razorpayOrderId", paymentData.getOrderId());
            if (paymentData.getSignature() != null) tx.put("razorpaySignature", paymentData.getSignature());
        }
        tx.put("description", "COD Cash Settlement Verified (Razorpay ID: " + razorpayPaymentId + " • Track: " + trackingRef + ")");
        tx.put("createdAt", FieldValue.serverTimestamp());
        tx.put("updatedAt", FieldValue.serverTimestamp());

        // 1. Add to subcollection deliveryPersons/{uid}/walletTransactions
        db.collection(Constants.COLLECTION_DELIVERY_PERSONS)
                .document(uid)
                .collection("walletTransactions")
                .add(tx);

        // 2. Add to global walletTransactions collection
        db.collection(Constants.COLLECTION_WALLET_TRANSACTIONS).add(tx);

        // 3. Update codDeposited and codCashInHand on deliveryPersons/{uid}
        Map<String, Object> updates = new HashMap<>();
        updates.put("codDeposited", FieldValue.increment(amount));
        updates.put("codCashInHand", FieldValue.increment(-amount));

        db.collection(Constants.COLLECTION_DELIVERY_PERSONS)
                .document(uid)
                .set(updates, SetOptions.merge())
                .addOnSuccessListener(v -> {
                    Toast.makeText(activity, "🎉 Payment Verified!\nTracking ID: " + trackingRef + "\nSettled: " + LocationUtils.formatCurrency(amount), Toast.LENGTH_LONG).show();
                    if (listener != null) listener.onDeposited(amount);
                })
                .addOnFailureListener(e -> Toast.makeText(activity, "Balance sync delayed: " + e.getMessage(), Toast.LENGTH_SHORT).show());
    }

    private void recordFailedDeposit(Activity activity, String uid, double amount, int errorCode, String reason, String trackingRef) {
        FirebaseFirestore db = FirebaseFirestore.getInstance();

        Map<String, Object> failLog = new HashMap<>();
        failLog.put("driverId", uid);
        failLog.put("riderId", uid);
        failLog.put("amount", amount);
        failLog.put("type", "cod_deposit_failed");
        failLog.put("status", "failed");
        failLog.put("errorCode", errorCode);
        failLog.put("errorMessage", reason);
        failLog.put("trackingId", trackingRef);
        failLog.put("description", "Failed COD Settlement Attempt • Track: " + trackingRef);
        failLog.put("createdAt", FieldValue.serverTimestamp());

        db.collection(Constants.COLLECTION_DELIVERY_PERSONS)
                .document(uid)
                .collection("walletTransactions")
                .add(failLog);

        Toast.makeText(activity, "⚠️ Deposit not completed (" + reason + "). No cash was deducted from your COD limit.", Toast.LENGTH_LONG).show();
    }
}
