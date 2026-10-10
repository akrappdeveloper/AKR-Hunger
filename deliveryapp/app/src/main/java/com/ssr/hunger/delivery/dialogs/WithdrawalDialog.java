package com.ssr.hunger.delivery.dialogs;

import android.app.Dialog;
import android.content.Context;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.View;
import android.view.Window;
import android.widget.EditText;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.textfield.TextInputLayout;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.FieldValue;
import com.google.firebase.firestore.FirebaseFirestore;
import com.ssr.hunger.delivery.R;
import com.ssr.hunger.delivery.utils.AnalyticsHelper;
import com.ssr.hunger.delivery.utils.Constants;
import com.ssr.hunger.delivery.utils.LocationUtils;

import java.util.HashMap;
import java.util.Map;

public class WithdrawalDialog extends Dialog {

    private final double availableBalance;
    private EditText etAmount, etUpiId;
    private RadioGroup rgMethod;
    private TextInputLayout tilUpi;

    public WithdrawalDialog(@NonNull Context context, double availableBalance) {
        super(context);
        this.availableBalance = availableBalance;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        setContentView(R.layout.dialog_withdrawal);

        if (getWindow() != null) {
            getWindow().setBackgroundDrawableResource(android.R.color.transparent);
        }

        TextView tvBalance = findViewById(R.id.tv_dialog_available_balance);
        tvBalance.setText("Available to withdraw: " + LocationUtils.formatCurrency(availableBalance));

        etAmount = findViewById(R.id.et_withdraw_amount);
        etUpiId = findViewById(R.id.et_upi_id);
        rgMethod = findViewById(R.id.rg_withdraw_method);
        tilUpi = findViewById(R.id.til_upi);

        MaterialButton btnCancel = findViewById(R.id.btn_cancel_withdraw);
        MaterialButton btnConfirm = findViewById(R.id.btn_confirm_withdraw);

        rgMethod.setOnCheckedChangeListener((group, checkedId) -> {
            if (checkedId == R.id.rb_upi) {
                tilUpi.setVisibility(View.VISIBLE);
            } else {
                tilUpi.setVisibility(View.GONE);
            }
        });

        btnCancel.setOnClickListener(v -> dismiss());
        btnConfirm.setOnClickListener(v -> submitWithdrawal());
    }

    private void submitWithdrawal() {
        String amountStr = etAmount.getText().toString().trim();
        if (TextUtils.isEmpty(amountStr)) {
            etAmount.setError("Enter amount");
            return;
        }

        double amount;
        try {
            amount = Double.parseDouble(amountStr);
        } catch (NumberFormatException e) {
            etAmount.setError("Invalid amount");
            return;
        }

        if (amount < 100) {
            etAmount.setError("Minimum withdrawal is ₹100");
            return;
        }

        if (amount > availableBalance) {
            etAmount.setError("Amount exceeds available balance");
            return;
        }

        boolean isUpi = rgMethod.getCheckedRadioButtonId() == R.id.rb_upi;
        String upi = etUpiId.getText().toString().trim();
        if (isUpi && TextUtils.isEmpty(upi)) {
            etUpiId.setError("Enter UPI ID");
            return;
        }

        FirebaseAuth auth = FirebaseAuth.getInstance();
        if (auth.getCurrentUser() == null) return;
        String uid = auth.getCurrentUser().getUid();

        FirebaseFirestore db = FirebaseFirestore.getInstance();

        // 1. Write to top-level 'withdrawals' collection (matching web app)
        Map<String, Object> withdrawalReq = new HashMap<>();
        withdrawalReq.put("riderId", uid);
        withdrawalReq.put("amount", amount);
        withdrawalReq.put("paymentMethod", isUpi ? "upi" : "bank");
        withdrawalReq.put("destinationReference", isUpi ? upi : "Linked Bank Account");
        withdrawalReq.put("status", "pending");
        withdrawalReq.put("requestedAt", FieldValue.serverTimestamp());
        db.collection("withdrawals").add(withdrawalReq);

        // 2. Write to walletTransactions subcollection & global collection
        Map<String, Object> req = new HashMap<>();
        req.put("driverId", uid);
        req.put("riderId", uid);
        req.put("amount", amount);
        req.put("method", isUpi ? "upi" : "bank");
        req.put("upiId", isUpi ? upi : "");
        req.put("status", "pending");
        req.put("createdAt", FieldValue.serverTimestamp());
        req.put("type", "withdrawal");
        req.put("description", "Payout Withdrawal Request (" + (isUpi ? upi : "Bank") + ")");

        db.collection(Constants.COLLECTION_DELIVERY_PERSONS)
                .document(uid)
                .collection("walletTransactions")
                .add(req);

        db.collection(Constants.COLLECTION_WALLET_TRANSACTIONS)
                .add(req)
                .addOnSuccessListener(docRef -> {
                    // 3. Deduct from wallet balance and available earnings
                    Map<String, Object> balanceUpdates = new HashMap<>();
                    balanceUpdates.put("walletBalance", FieldValue.increment(-amount));
                    balanceUpdates.put("availableEarnings", FieldValue.increment(-amount));
                    balanceUpdates.put("withdrawnAmount", FieldValue.increment(amount));

                    db.collection(Constants.COLLECTION_DELIVERY_PERSONS)
                            .document(uid)
                            .update(balanceUpdates);

                    AnalyticsHelper.getInstance(getContext()).logPayoutRequested(amount, isUpi ? "upi" : "bank");
                    Toast.makeText(getContext(), "🎉 Withdrawal request for " + LocationUtils.formatCurrency(amount) + " submitted!", Toast.LENGTH_LONG).show();
                    dismiss();
                })
                .addOnFailureListener(e -> Toast.makeText(getContext(), "Failed: " + e.getMessage(), Toast.LENGTH_SHORT).show());
    }
}
