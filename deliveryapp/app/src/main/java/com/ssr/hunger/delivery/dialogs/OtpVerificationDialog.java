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

public class OtpVerificationDialog extends Dialog {

    public interface OnOtpVerifiedListener {
        void onVerified(String otp);
    }

    private final String expectedOtp;
    private final boolean isReturnMode;
    private final OnOtpVerifiedListener listener;

    public OtpVerificationDialog(@NonNull Context context, String expectedOtp, boolean isReturnMode, OnOtpVerifiedListener listener) {
        super(context);
        this.expectedOtp = expectedOtp;
        this.isReturnMode = isReturnMode;
        this.listener = listener;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        setContentView(R.layout.dialog_otp_verification);

        if (getWindow() != null) {
            getWindow().setBackgroundDrawableResource(android.R.color.transparent);
        }

        TextView tvTitle = findViewById(R.id.tv_otp_title);
        TextView tvSubtitle = findViewById(R.id.tv_otp_subtitle);
        EditText etOtp = findViewById(R.id.et_otp_input);
        MaterialButton btnCancel = findViewById(R.id.btn_cancel_otp);
        MaterialButton btnConfirm = findViewById(R.id.btn_confirm_otp);

        if (isReturnMode) {
            tvTitle.setText("Verify Restaurant Return OTP");
            tvSubtitle.setText("Ask restaurant staff for the return OTP to confirm food handover.");
        }

        btnCancel.setOnClickListener(v -> dismiss());

        btnConfirm.setOnClickListener(v -> {
            String entered = etOtp.getText().toString().trim();
            if (entered.length() != 4) {
                Toast.makeText(getContext(), "Please enter a valid 4-digit OTP", Toast.LENGTH_SHORT).show();
                return;
            }

            if (expectedOtp != null && !expectedOtp.isEmpty() && !expectedOtp.equals(entered)) {
                Toast.makeText(getContext(), "Incorrect OTP! Please check with " + (isReturnMode ? "restaurant" : "customer"), Toast.LENGTH_LONG).show();
                return;
            }

            dismiss();
            if (listener != null) listener.onVerified(entered);
        });
    }
}
