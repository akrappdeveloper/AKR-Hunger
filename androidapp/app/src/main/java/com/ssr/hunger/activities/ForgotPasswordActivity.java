package com.ssr.hunger.activities;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.os.CountDownTimer;
import android.text.TextUtils;
import android.util.Patterns;
import android.view.View;
import android.widget.Toast;

import androidx.annotation.Nullable;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthInvalidUserException;
import com.ssr.hunger.R;
import com.ssr.hunger.databinding.ActivityForgotPasswordBinding;

/**
 * ForgotPasswordActivity
 * Premium, theme-aware password recovery activity for AKR Hunger.
 * Allows users to request a secure password reset email.
 * Marks a pending reset flag in SharedPreferences ("akr_auth_security") so that
 * when this user subsequently signs in on LoginActivity with their new password,
 * the new password automatically updates their existing customer profile in Firestore ONE TIME.
 */
public class ForgotPasswordActivity extends BaseActivity {

    public static final String PREF_AUTH_SECURITY = "akr_auth_security";
    public static final String KEY_PENDING_RESET_EMAIL = "pending_reset_email";
    public static final String KEY_PENDING_RESET_TIMESTAMP = "pending_reset_timestamp";

    private ActivityForgotPasswordBinding binding;
    private FirebaseAuth auth;
    private CountDownTimer resendTimer;
    private String sentEmail = "";

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityForgotPasswordBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        auth = FirebaseAuth.getInstance();

        setupUI();
        prefillEmailIfAvailable();
    }

    private void setupUI() {
        // Back Navigation
        binding.btnBack.setOnClickListener(v -> finish());
        binding.tvBackToLogin.setOnClickListener(v -> finish());

        // Send Reset Link
        binding.btnSendReset.setOnClickListener(v -> handleSendPasswordReset());

        // Open Mail App
        binding.btnOpenMail.setOnClickListener(v -> openMailApp());

        // Proceed to Login
        binding.btnProceedToLogin.setOnClickListener(v -> proceedToLogin());

        // Resend Link
        binding.tvResendLink.setOnClickListener(v -> {
            if (!TextUtils.isEmpty(sentEmail)) {
                handleResendEmail(sentEmail);
            }
        });
    }

    private void prefillEmailIfAvailable() {
        Intent intent = getIntent();
        if (intent != null && intent.hasExtra("email")) {
            String email = intent.getStringExtra("email");
            if (!TextUtils.isEmpty(email)) {
                binding.etEmail.setText(email.trim());
            }
        }
    }

    private void handleSendPasswordReset() {
        String email = binding.etEmail.getText() != null ? binding.etEmail.getText().toString().trim() : "";

        if (TextUtils.isEmpty(email)) {
            showError("Please enter your registered email address");
            binding.tilEmail.setError("Email required");
            return;
        }

        if (!Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
            showError("Please enter a valid email address (e.g., name@gmail.com)");
            binding.tilEmail.setError("Invalid email format");
            return;
        }

        binding.tilEmail.setError(null);
        hideError();
        setLoading(true);

        logBreadcrumb("Dispatching password reset email for: " + email);

        auth.sendPasswordResetEmail(email)
                .addOnSuccessListener(aVoid -> {
                    setLoading(false);
                    sentEmail = email;

                    // Save pending reset flag so LoginActivity knows to sync the new password one time
                    SharedPreferences authPrefs = getSharedPreferences(PREF_AUTH_SECURITY, Context.MODE_PRIVATE);
                    authPrefs.edit()
                            .putString(KEY_PENDING_RESET_EMAIL, email.toLowerCase())
                            .putLong(KEY_PENDING_RESET_TIMESTAMP, System.currentTimeMillis())
                            .apply();

                    logBreadcrumb("Password reset email dispatched successfully to: " + email);
                    if (analyticsHelper != null) {
                        Bundle b = new Bundle();
                        b.putString("email_domain", email.contains("@") ? email.split("@")[1] : "unknown");
                        analyticsHelper.logEvent("forgot_password_email_sent", b);
                    }

                    showSuccessState(email);
                    Toast.makeText(this, "✅ Password reset link sent to your email!", Toast.LENGTH_SHORT).show();
                })
                .addOnFailureListener(e -> {
                    setLoading(false);
                    recordException("sendPasswordReset_failed", e);
                    if (e instanceof FirebaseAuthInvalidUserException) {
                        showError("No account found with this email address. Please check spelling or create an account.");
                    } else {
                        showError(e.getMessage() != null ? e.getMessage() : "Unable to send reset email. Please try again later.");
                    }
                });
    }

    private void handleResendEmail(String email) {
        logBreadcrumb("Resending password reset email to: " + email);
        Toast.makeText(this, "Resending reset link...", Toast.LENGTH_SHORT).show();

        auth.sendPasswordResetEmail(email)
                .addOnSuccessListener(aVoid -> {
                    Toast.makeText(this, "✅ Reset link resent to " + email, Toast.LENGTH_SHORT).show();
                    startResendCountdown();
                })
                .addOnFailureListener(e -> {
                    Toast.makeText(this, "Failed to resend: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                });
    }

    private void showSuccessState(String email) {
        binding.layoutInputSection.setVisibility(View.GONE);
        binding.layoutSuccessSection.setVisibility(View.VISIBLE);
        binding.tvSentEmailBadge.setText(email);
        startResendCountdown();
    }

    private void startResendCountdown() {
        if (resendTimer != null) {
            resendTimer.cancel();
        }

        binding.tvResendLink.setEnabled(false);
        binding.tvResendLink.setTextColor(getResources().getColor(R.color.text_secondary));

        resendTimer = new CountDownTimer(60000, 1000) {
            @Override
            public void onTick(long millisUntilFinished) {
                long seconds = millisUntilFinished / 1000;
                binding.tvResendLink.setText("Resend link in " + seconds + "s");
            }

            @Override
            public void onFinish() {
                binding.tvResendLink.setText("Didn't receive email? Resend Link");
                binding.tvResendLink.setEnabled(true);
                binding.tvResendLink.setTextColor(getResources().getColor(R.color.primary));
            }
        }.start();
    }

    private void openMailApp() {
        try {
            Intent intent = new Intent(Intent.ACTION_MAIN);
            intent.addCategory(Intent.CATEGORY_APP_EMAIL);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (Exception e) {
            Toast.makeText(this, "Please open your email application to view the link", Toast.LENGTH_SHORT).show();
        }
    }

    private void proceedToLogin() {
        Intent intent = new Intent(this, LoginActivity.class);
        if (!TextUtils.isEmpty(sentEmail)) {
            intent.putExtra("email", sentEmail);
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(intent);
        finish();
    }

    private void setLoading(boolean loading) {
        binding.progressBar.setVisibility(loading ? View.VISIBLE : View.GONE);
        binding.btnSendReset.setEnabled(!loading);
        binding.etEmail.setEnabled(!loading);
    }

    private void showError(String message) {
        binding.tvError.setText(message);
        binding.tvError.setVisibility(View.VISIBLE);
    }

    private void hideError() {
        binding.tvError.setVisibility(View.GONE);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (resendTimer != null) {
            resendTimer.cancel();
        }
    }

    @Override
    protected String getScreenName() {
        return "ForgotPassword";
    }
}
