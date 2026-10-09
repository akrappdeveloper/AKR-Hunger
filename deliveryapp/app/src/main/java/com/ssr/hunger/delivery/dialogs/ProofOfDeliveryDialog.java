package com.ssr.hunger.delivery.dialogs;

import android.app.Dialog;
import android.content.Context;
import android.os.Bundle;
import android.view.Window;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;

import com.google.android.material.button.MaterialButton;
import com.ssr.hunger.delivery.R;

public class ProofOfDeliveryDialog extends Dialog {

    public interface OnProofConfirmedListener {
        void onConfirmed(String note);
    }

    private final OnProofConfirmedListener listener;

    public ProofOfDeliveryDialog(@NonNull Context context, OnProofConfirmedListener listener) {
        super(context);
        this.listener = listener;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        setContentView(R.layout.dialog_proof_of_delivery);

        if (getWindow() != null) {
            getWindow().setBackgroundDrawableResource(android.R.color.transparent);
        }

        EditText etNote = findViewById(R.id.et_proof_note);
        TextView tvLabel = findViewById(R.id.tv_photo_label);
        MaterialButton btnCancel = findViewById(R.id.btn_cancel_proof);
        MaterialButton btnConfirm = findViewById(R.id.btn_confirm_proof);

        findViewById(R.id.card_take_photo).setOnClickListener(v -> {
            tvLabel.setText("✅ Photo captured (doorstep proof)");
            Toast.makeText(getContext(), "Photo attached successfully", Toast.LENGTH_SHORT).show();
        });

        btnCancel.setOnClickListener(v -> {
            dismiss();
            if (listener != null) listener.onConfirmed("Direct handover");
        });

        btnConfirm.setOnClickListener(v -> {
            String note = etNote.getText().toString().trim();
            if (note.isEmpty()) note = "Package handed over safely";
            dismiss();
            if (listener != null) listener.onConfirmed(note);
        });
    }
}
