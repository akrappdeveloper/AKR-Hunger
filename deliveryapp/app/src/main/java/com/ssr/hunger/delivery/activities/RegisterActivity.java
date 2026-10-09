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
import com.google.android.material.textfield.TextInputEditText;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.FieldValue;
import com.google.firebase.firestore.FirebaseFirestore;
import com.ssr.hunger.delivery.R;
import com.ssr.hunger.delivery.utils.Constants;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

public class RegisterActivity extends AppCompatActivity {

    private FirebaseAuth auth;
    private FirebaseFirestore db;

    private TextInputEditText etName, etPhone, etEmail, etPassword;
    private TextInputEditText etVehicleType, etVehicleNumber, etLicense, etEmergency, etPincode;
    private MaterialButton btnSubmit;
    private TextView tvGoToLogin;
    private ProgressBar progressBar;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_register);

        auth = FirebaseAuth.getInstance();
        db = FirebaseFirestore.getInstance();

        etName = findViewById(R.id.et_reg_name);
        etPhone = findViewById(R.id.et_reg_phone);
        etEmail = findViewById(R.id.et_reg_email);
        etPassword = findViewById(R.id.et_reg_password);
        etVehicleType = findViewById(R.id.et_reg_vehicle_type);
        etVehicleNumber = findViewById(R.id.et_reg_vehicle_number);
        etLicense = findViewById(R.id.et_reg_license);
        etEmergency = findViewById(R.id.et_reg_emergency);
        etPincode = findViewById(R.id.et_reg_pincode);

        btnSubmit = findViewById(R.id.btn_reg_submit);
        tvGoToLogin = findViewById(R.id.tv_go_to_login);
        progressBar = findViewById(R.id.progress_reg);

        btnSubmit.setOnClickListener(v -> attemptRegister());
        tvGoToLogin.setOnClickListener(v -> finish());
    }

    private void attemptRegister() {
        String name = etName.getText() != null ? etName.getText().toString().trim() : "";
        String phone = etPhone.getText() != null ? etPhone.getText().toString().trim() : "";
        String email = etEmail.getText() != null ? etEmail.getText().toString().trim() : "";
        String password = etPassword.getText() != null ? etPassword.getText().toString().trim() : "";
        String vehicleType = etVehicleType.getText() != null ? etVehicleType.getText().toString().trim() : "Motorcycle";
        String vehicleNumber = etVehicleNumber.getText() != null ? etVehicleNumber.getText().toString().trim() : "";
        String license = etLicense.getText() != null ? etLicense.getText().toString().trim() : "";
        String emergency = etEmergency.getText() != null ? etEmergency.getText().toString().trim() : "";
        String pincode = etPincode.getText() != null ? etPincode.getText().toString().trim() : "";

        if (TextUtils.isEmpty(name)) { etName.setError("Name required"); return; }
        if (TextUtils.isEmpty(phone) || phone.length() < 10) { etPhone.setError("10-digit phone required"); return; }
        if (TextUtils.isEmpty(email)) { etEmail.setError("Email required"); return; }
        if (TextUtils.isEmpty(password) || password.length() < 6) { etPassword.setError("Minimum 6 characters"); return; }

        setLoading(true);

        auth.createUserWithEmailAndPassword(email, password)
                .addOnSuccessListener(authResult -> {
                    String uid = authResult.getUser().getUid();

                    Map<String, Object> data = new HashMap<>();
                    data.put("uid", uid);
                    data.put("name", name);
                    data.put("phone", phone);
                    data.put("email", email);
                    data.put("vehicleType", vehicleType);
                    data.put("vehicleNumber", vehicleNumber);
                    data.put("licenseNumber", license);
                    data.put("emergencyContact", emergency);
                    data.put("servicePincodes", TextUtils.isEmpty(pincode) ? Collections.emptyList() : Collections.singletonList(pincode));
                    data.put("pincodeFilterActive", !TextUtils.isEmpty(pincode));
                    data.put("kycStatus", "approved"); // Default to approved for seamless driver testing
                    data.put("isVerified", true);
                    data.put("isAvailable", false);
                    data.put("status", "offline");
                    data.put("rating", 5.0);
                    data.put("fairRouteScore", 88);
                    data.put("todayEarnings", 0.0);
                    data.put("totalEarnings", 0.0);
                    data.put("walletBalance", 0.0);
                    data.put("totalDeliveries", 0);
                    data.put("createdAt", FieldValue.serverTimestamp());

                    db.collection(Constants.COLLECTION_DELIVERY_PERSONS)
                            .document(uid)
                            .set(data)
                            .addOnSuccessListener(v -> {
                                setLoading(false);
                                Toast.makeText(RegisterActivity.this, "Welcome to Hunger Delivery Fleet!", Toast.LENGTH_SHORT).show();
                                Intent intent = new Intent(RegisterActivity.this, MainActivity.class);
                                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                                startActivity(intent);
                                finish();
                            })
                            .addOnFailureListener(e -> {
                                setLoading(false);
                                Toast.makeText(RegisterActivity.this, "Failed to save profile: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                            });
                })
                .addOnFailureListener(e -> {
                    setLoading(false);
                    Toast.makeText(RegisterActivity.this, "Registration failed: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                });
    }

    private void setLoading(boolean loading) {
        progressBar.setVisibility(loading ? View.VISIBLE : View.GONE);
        btnSubmit.setEnabled(!loading);
    }
}
