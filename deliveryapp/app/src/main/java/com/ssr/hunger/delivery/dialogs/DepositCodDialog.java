package com.ssr.hunger.delivery.dialogs;

import android.app.Dialog;
import android.content.Context;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.Window;
import android.widget.EditText;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;

import com.google.android.material.button.MaterialButton;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.FieldValue;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.SetOptions;
import com.ssr.hunger.delivery.R;
import com.ssr.hunger.delivery.utils.Constants;
import com.ssr.hunger.delivery.utils.LocationUtils;

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
        btnConfirm.setOnClickListener(v -> submitDeposit());
    }

    private void submitDeposit() {
        String str = etAmount.getText().toString().trim();
        if (TextUtils.isEmpty(str)) {
            etAmount.setError("Enter amount");
            return;
        }

        double amount;
        try {
            amount = Double.parseDouble(str);
        } catch (NumberFormatException e) {
            etAmount.setError("Invalid amount");
            return;
        }

        if (amount <= 0) {
            etAmount.setError("Amount must be greater than ₹0");
            return;
        }

        FirebaseAuth auth = FirebaseAuth.getInstance();
        if (auth.getCurrentUser() == null) return;
        String uid = auth.getCurrentUser().getUid();

        boolean isUpi = rgMethod.getCheckedRadioButtonId() == R.id.rb_deposit_upi;
        String method = isUpi ? "UPI Gateway" : "Net Banking";
        String refId = "COD-" + System.currentTimeMillis();

        Map<String, Object> tx = new HashMap<>();
        tx.put("driverId", uid);
        tx.put("riderId", uid);
        tx.put("amount", amount);
        tx.put("type", "cod_deposit");
        tx.put("paymentMethod", method);
        tx.put("reference", refId);
        tx.put("description", "COD Cash Settlement Deposit (" + method + ")");
        tx.put("status", "completed");
        tx.put("createdAt", FieldValue.serverTimestamp());

        FirebaseFirestore db = FirebaseFirestore.getInstance();

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
                    Toast.makeText(getContext(), "🎉 Deposited " + LocationUtils.formatCurrency(amount) + " successfully! COD settled.", Toast.LENGTH_LONG).show();
                    dismiss();
                    if (listener != null) listener.onDeposited(amount);
                })
                .addOnFailureListener(e -> Toast.makeText(getContext(), "Failed: " + e.getMessage(), Toast.LENGTH_SHORT).show());
    }
}
