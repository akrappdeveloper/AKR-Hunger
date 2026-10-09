package com.ssr.hunger.delivery.dialogs;

import android.app.Dialog;
import android.content.Context;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.Window;
import android.widget.EditText;
import android.widget.Toast;

import androidx.annotation.NonNull;

import com.google.android.material.button.MaterialButton;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.SetOptions;
import com.ssr.hunger.delivery.R;
import com.ssr.hunger.delivery.utils.Constants;

import java.util.HashMap;
import java.util.Map;

public class BankDetailsDialog extends Dialog {

    private EditText etBankName, etAccountHolder, etAccountNumber, etIfscCode;
    private final Map<String, Object> existingBankData;

    public BankDetailsDialog(@NonNull Context context, Map<String, Object> existing) {
        super(context);
        this.existingBankData = existing != null ? existing : new HashMap<>();
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        setContentView(R.layout.dialog_bank_details);

        if (getWindow() != null) {
            getWindow().setBackgroundDrawableResource(android.R.color.transparent);
        }

        etBankName = findViewById(R.id.et_bank_name);
        etAccountHolder = findViewById(R.id.et_account_holder);
        etAccountNumber = findViewById(R.id.et_account_number);
        etIfscCode = findViewById(R.id.et_ifsc_code);

        MaterialButton btnCancel = findViewById(R.id.btn_cancel_bank);
        MaterialButton btnSave = findViewById(R.id.btn_save_bank);

        if (existingBankData.containsKey("bankName")) etBankName.setText(String.valueOf(existingBankData.get("bankName")));
        if (existingBankData.containsKey("holderName")) etAccountHolder.setText(String.valueOf(existingBankData.get("holderName")));
        if (existingBankData.containsKey("accountNumber")) etAccountNumber.setText(String.valueOf(existingBankData.get("accountNumber")));
        if (existingBankData.containsKey("ifscCode")) etIfscCode.setText(String.valueOf(existingBankData.get("ifscCode")));

        btnCancel.setOnClickListener(v -> dismiss());
        btnSave.setOnClickListener(v -> saveBankDetails());
    }

    private void saveBankDetails() {
        String bank = etBankName.getText().toString().trim();
        String holder = etAccountHolder.getText().toString().trim();
        String account = etAccountNumber.getText().toString().trim();
        String ifsc = etIfscCode.getText().toString().trim();

        if (TextUtils.isEmpty(bank)) { etBankName.setError("Bank name required"); return; }
        if (TextUtils.isEmpty(holder)) { etAccountHolder.setError("Holder name required"); return; }
        if (TextUtils.isEmpty(account)) { etAccountNumber.setError("Account number required"); return; }
        if (TextUtils.isEmpty(ifsc) || ifsc.length() < 10) { etIfscCode.setError("Valid IFSC required"); return; }

        FirebaseAuth auth = FirebaseAuth.getInstance();
        if (auth.getCurrentUser() == null) return;
        String uid = auth.getCurrentUser().getUid();

        Map<String, Object> bankDetails = new HashMap<>();
        bankDetails.put("bankName", bank);
        bankDetails.put("holderName", holder);
        bankDetails.put("accountNumber", account);
        bankDetails.put("ifscCode", ifsc);

        Map<String, Object> update = new HashMap<>();
        update.put("bankDetails", bankDetails);

        FirebaseFirestore.getInstance()
                .collection(Constants.COLLECTION_DELIVERY_PERSONS)
                .document(uid)
                .set(update, SetOptions.merge())
                .addOnSuccessListener(v -> {
                    Toast.makeText(getContext(), "✅ Bank details saved successfully!", Toast.LENGTH_SHORT).show();
                    dismiss();
                })
                .addOnFailureListener(e -> Toast.makeText(getContext(), "Failed: " + e.getMessage(), Toast.LENGTH_SHORT).show());
    }
}
