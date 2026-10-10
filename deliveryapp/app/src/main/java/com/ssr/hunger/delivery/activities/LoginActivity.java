package com.ssr.hunger.delivery.activities;

import android.content.Intent;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.View;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.card.MaterialCardView;
import com.google.android.material.textfield.TextInputEditText;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FirebaseFirestore;
import com.ssr.hunger.delivery.R;
import com.ssr.hunger.delivery.utils.Constants;

public class LoginActivity extends AppCompatActivity {

    private FirebaseAuth auth;
    private FirebaseFirestore db;

    private TextInputEditText etEmail, etPassword;
    private MaterialButton btnLogin;
    private TextView tvGoToRegister;
    private ProgressBar progressBar;
    private MaterialCardView cardError;
    private TextView tvError;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_login);

        auth = FirebaseAuth.getInstance();
        db = FirebaseFirestore.getInstance();

        etEmail = findViewById(R.id.et_login_email);
        etPassword = findViewById(R.id.et_login_password);
        btnLogin = findViewById(R.id.btn_login_submit);
        tvGoToRegister = findViewById(R.id.tv_go_to_register);
        progressBar = findViewById(R.id.progress_login);
        cardError = findViewById(R.id.card_login_error);
        tvError = findViewById(R.id.tv_login_error);

        btnLogin.setOnClickListener(v -> attemptLogin());
        tvGoToRegister.setOnClickListener(v -> {
            startActivity(new Intent(LoginActivity.this, RegisterActivity.class));
        });
    }

    private void attemptLogin() {
        clearError();

        String email = etEmail.getText() != null ? etEmail.getText().toString().trim() : "";
        String password = etPassword.getText() != null ? etPassword.getText().toString().trim() : "";

        if (TextUtils.isEmpty(email)) {
            showError("Email Address is required");
            etEmail.requestFocus();
            return;
        }

        if (TextUtils.isEmpty(password)) {
            showError("Password is required");
            etPassword.requestFocus();
            return;
        }

        setLoading(true);

        auth.signInWithEmailAndPassword(email, password)
                .addOnSuccessListener(authResult -> {
                    String uid = authResult.getUser().getUid();

                    // Check if delivery partner profile exists in 'deliveryPersons'
                    db.collection(Constants.COLLECTION_DELIVERY_PERSONS)
                            .document(uid)
                            .get()
                            .addOnSuccessListener(snap -> {
                                setLoading(false);
                                if (!snap.exists()) {
                                    auth.signOut();
                                    showError("Access Denied: This account is not registered as a Delivery Partner.");
                                    return;
                                }

                                checkPartnerStatusAndProceed(snap);
                            })
                            .addOnFailureListener(e -> {
                                setLoading(false);
                                showError("Database error: " + e.getMessage());
                            });
                })
                .addOnFailureListener(e -> {
                    setLoading(false);
                    String msg = e.getMessage() != null ? e.getMessage() : "Login failed";
                    if (msg.contains("invalid-credential") || msg.contains("user-not-found") || msg.contains("wrong-password")) {
                        msg = "Invalid email or password.";
                    }
                    showError(msg);
                });
    }

    private void checkPartnerStatusAndProceed(DocumentSnapshot snap) {
        String verificationStatus = snap.getString("verificationStatus");
        String kycStatus = snap.getString("kycStatus");
        Boolean isVerified = snap.getBoolean("isVerified");

        String status = verificationStatus != null ? verificationStatus : (kycStatus != null ? kycStatus : "pending");

        if ("pending".equalsIgnoreCase(status) && (isVerified == null || !isVerified)) {
            auth.signOut();
            showError("Your application is currently under review. Please wait for Admin approval.");
            return;
        }

        if ("rejected".equalsIgnoreCase(status)) {
            auth.signOut();
            String reason = snap.getString("rejectionReason");
            String err = "Your partner application was rejected.";
            if (!TextUtils.isEmpty(reason)) {
                err += " Reason: " + reason;
            }
            showError(err);
            return;
        }

        // Approved partner - allow into the app!
        Toast.makeText(LoginActivity.this, "Welcome back, Partner!", Toast.LENGTH_SHORT).show();
        Intent intent = new Intent(LoginActivity.this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(intent);
        finish();
    }

    private void showError(String message) {
        if (cardError != null && tvError != null) {
            cardError.setVisibility(View.VISIBLE);
            tvError.setText(message);
        } else {
            Toast.makeText(this, message, Toast.LENGTH_LONG).show();
        }
    }

    private void clearError() {
        if (cardError != null) {
            cardError.setVisibility(View.GONE);
        }
    }

    private void setLoading(boolean loading) {
        progressBar.setVisibility(loading ? View.VISIBLE : View.GONE);
        btnLogin.setEnabled(!loading);
    }
}
