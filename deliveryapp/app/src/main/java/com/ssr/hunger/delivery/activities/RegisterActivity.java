package com.ssr.hunger.delivery.activities;

import android.content.Intent;
import android.content.res.ColorStateList;
import android.net.Uri;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.View;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.card.MaterialCardView;
import com.google.android.material.chip.Chip;
import com.google.android.material.chip.ChipGroup;
import com.google.android.material.textfield.TextInputEditText;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.FieldValue;
import com.google.firebase.firestore.FirebaseFirestore;
import com.ssr.hunger.delivery.R;
import com.ssr.hunger.delivery.utils.Constants;
import com.ssr.hunger.delivery.utils.DocumentUploadHelper;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

/**
 * RegisterActivity matching web /delivery/register features:
 * - Full Partner registration
 * - Vehicle selector (bike, scooter, car, truck)
 * - Required document uploads (RC & Driving License) to Firebase/Cloud
 * - Password matching & verification validation
 * - Saves profile to Firestore 'deliveryPersons' collection with status 'pending'
 */
public class RegisterActivity extends AppCompatActivity {

    private FirebaseAuth auth;
    private FirebaseFirestore db;

    // Form Inputs
    private TextInputEditText etName, etEmail, etPhone, etPassword, etConfirmPassword;
    private TextInputEditText etVehicleNumber, etPincode, etEmergency;
    private ChipGroup chipGroupVehicle;

    // Document Pickers
    private LinearLayout layoutRcContainer, layoutLicenseContainer;
    private TextView tvRcFilename, tvRcStatus, tvLicenseFilename, tvLicenseStatus;
    private ImageView ivRcStatusIcon, ivLicenseStatusIcon;
    private MaterialButton btnPickRc, btnPickLicense;
    private Uri rcDocumentUri = null;
    private Uri licenseDocumentUri = null;

    // Error & Progress
    private MaterialCardView cardError, cardProgress;
    private TextView tvError, tvProgressStatus;
    private ProgressBar progressBar;
    private MaterialButton btnSubmit;
    private TextView tvGoToLogin;

    // Activity Result Launchers for Document Picking
    private final ActivityResultLauncher<String> rcPickerLauncher =
            registerForActivityResult(new ActivityResultContracts.GetContent(), uri -> {
                if (uri != null) {
                    rcDocumentUri = uri;
                    String fileName = DocumentUploadHelper.getFileName(this, uri);
                    tvRcFilename.setText(fileName);
                    tvRcStatus.setText("File selected • Ready to upload");
                    tvRcStatus.setTextColor(ContextCompat.getColor(this, R.color.success));
                    ivRcStatusIcon.setImageResource(R.drawable.ic_check_circle_filled);
                    ivRcStatusIcon.setImageTintList(ColorStateList.valueOf(ContextCompat.getColor(this, R.color.success)));
                    layoutRcContainer.setBackgroundResource(R.drawable.bg_doc_card_selected);
                    clearError();
                }
            });

    private final ActivityResultLauncher<String> licensePickerLauncher =
            registerForActivityResult(new ActivityResultContracts.GetContent(), uri -> {
                if (uri != null) {
                    licenseDocumentUri = uri;
                    String fileName = DocumentUploadHelper.getFileName(this, uri);
                    tvLicenseFilename.setText(fileName);
                    tvLicenseStatus.setText("File selected • Ready to upload");
                    tvLicenseStatus.setTextColor(ContextCompat.getColor(this, R.color.success));
                    ivLicenseStatusIcon.setImageResource(R.drawable.ic_check_circle_filled);
                    ivLicenseStatusIcon.setImageTintList(ColorStateList.valueOf(ContextCompat.getColor(this, R.color.success)));
                    layoutLicenseContainer.setBackgroundResource(R.drawable.bg_doc_card_selected);
                    clearError();
                }
            });

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_register);

        auth = FirebaseAuth.getInstance();
        db = FirebaseFirestore.getInstance();

        initViews();
        setupListeners();
    }

    private void initViews() {
        etName = findViewById(R.id.et_reg_name);
        etEmail = findViewById(R.id.et_reg_email);
        etPhone = findViewById(R.id.et_reg_phone);
        etPassword = findViewById(R.id.et_reg_password);
        etConfirmPassword = findViewById(R.id.et_reg_confirm_password);

        chipGroupVehicle = findViewById(R.id.chip_group_vehicle);
        etVehicleNumber = findViewById(R.id.et_reg_vehicle_number);

        layoutRcContainer = findViewById(R.id.layout_rc_container);
        layoutLicenseContainer = findViewById(R.id.layout_license_container);
        tvRcFilename = findViewById(R.id.tv_rc_filename);
        tvRcStatus = findViewById(R.id.tv_rc_status);
        ivRcStatusIcon = findViewById(R.id.iv_rc_status_icon);
        btnPickRc = findViewById(R.id.btn_pick_rc);

        tvLicenseFilename = findViewById(R.id.tv_license_filename);
        tvLicenseStatus = findViewById(R.id.tv_license_status);
        ivLicenseStatusIcon = findViewById(R.id.iv_license_status_icon);
        btnPickLicense = findViewById(R.id.btn_pick_license);

        etPincode = findViewById(R.id.et_reg_pincode);
        etEmergency = findViewById(R.id.et_reg_emergency);

        cardError = findViewById(R.id.card_reg_error);
        tvError = findViewById(R.id.tv_reg_error);

        cardProgress = findViewById(R.id.card_reg_progress);
        progressBar = findViewById(R.id.progress_reg_bar);
        tvProgressStatus = findViewById(R.id.tv_reg_progress_status);

        btnSubmit = findViewById(R.id.btn_reg_submit);
        tvGoToLogin = findViewById(R.id.tv_go_to_login);
    }

    private void setupListeners() {
        btnPickRc.setOnClickListener(v -> rcPickerLauncher.launch("*/*"));
        layoutRcContainer.setOnClickListener(v -> rcPickerLauncher.launch("*/*"));

        btnPickLicense.setOnClickListener(v -> licensePickerLauncher.launch("*/*"));
        layoutLicenseContainer.setOnClickListener(v -> licensePickerLauncher.launch("*/*"));

        btnSubmit.setOnClickListener(v -> attemptRegister());
        tvGoToLogin.setOnClickListener(v -> finish());
    }

    private String getSelectedVehicleType() {
        int checkedId = chipGroupVehicle.getCheckedChipId();
        if (checkedId == R.id.chip_vehicle_scooter) {
            return "scooter";
        } else if (checkedId == R.id.chip_vehicle_car) {
            return "car";
        } else if (checkedId == R.id.chip_vehicle_truck) {
            return "truck";
        }
        return "bike";
    }

    private void attemptRegister() {
        clearError();

        String name = etName.getText() != null ? etName.getText().toString().trim() : "";
        String email = etEmail.getText() != null ? etEmail.getText().toString().trim() : "";
        String phone = etPhone.getText() != null ? etPhone.getText().toString().trim() : "";
        String vehicleNumber = etVehicleNumber.getText() != null ? etVehicleNumber.getText().toString().trim() : "";
        String password = etPassword.getText() != null ? etPassword.getText().toString().trim() : "";
        String confirmPassword = etConfirmPassword.getText() != null ? etConfirmPassword.getText().toString().trim() : "";
        String vehicle = getSelectedVehicleType();
        String pincode = etPincode.getText() != null ? etPincode.getText().toString().trim() : "";
        String emergency = etEmergency.getText() != null ? etEmergency.getText().toString().trim() : "";

        // Form Validations matching web app
        if (TextUtils.isEmpty(name)) {
            showError("Full Name is required");
            etName.requestFocus();
            return;
        }

        if (TextUtils.isEmpty(email)) {
            showError("Email Address is required");
            etEmail.requestFocus();
            return;
        }

        if (TextUtils.isEmpty(phone) || phone.length() < 10) {
            showError("Please enter a valid 10-digit phone number");
            etPhone.requestFocus();
            return;
        }

        if (TextUtils.isEmpty(vehicleNumber)) {
            showError("Vehicle registration number is required");
            etVehicleNumber.requestFocus();
            return;
        }

        if (rcDocumentUri == null || licenseDocumentUri == null) {
            showError("Please upload documents for Vehicle RC and Driving License");
            return;
        }

        if (TextUtils.isEmpty(password) || password.length() < 6) {
            showError("Password should be at least 6 characters");
            etPassword.requestFocus();
            return;
        }

        if (!password.equals(confirmPassword)) {
            showError("Passwords do not match");
            etConfirmPassword.requestFocus();
            return;
        }

        // 1. Create Firebase Auth User FIRST
        setLoading(true, 15, "Creating Partner Account...");

        auth.createUserWithEmailAndPassword(email, password)
                .addOnSuccessListener(authResult -> {
                    String uid = authResult.getUser().getUid();

                    // 2. Upload RC Document
                    setLoading(true, 35, "Uploading RC Document...");
                    DocumentUploadHelper.uploadDocument(
                            RegisterActivity.this,
                            rcDocumentUri,
                            uid,
                            "rc_document",
                            new DocumentUploadHelper.UploadCallback() {
                                @Override
                                public void onProgress(int percent, String stageMessage) {
                                    runOnUiThread(() -> setLoading(true, 35 + (percent / 3), stageMessage));
                                }

                                @Override
                                public void onSuccess(String rcDownloadUrl) {
                                    // 3. Upload Driving License
                                    runOnUiThread(() -> setLoading(true, 65, "Uploading Driving License..."));
                                    DocumentUploadHelper.uploadDocument(
                                            RegisterActivity.this,
                                            licenseDocumentUri,
                                            uid,
                                            "driving_license",
                                            new DocumentUploadHelper.UploadCallback() {
                                                @Override
                                                public void onProgress(int percent, String stageMessage) {
                                                    runOnUiThread(() -> setLoading(true, 65 + (percent / 4), stageMessage));
                                                }

                                                @Override
                                                public void onSuccess(String licenseDownloadUrl) {
                                                    // 4. Save Partner Profile to Firestore
                                                    runOnUiThread(() -> setLoading(true, 90, "Saving Partner Profile..."));
                                                    savePartnerProfile(uid, name, email, phone, vehicle, vehicleNumber,
                                                            rcDownloadUrl, licenseDownloadUrl, password, pincode, emergency);
                                                }

                                                @Override
                                                public void onFailure(Exception error) {
                                                    runOnUiThread(() -> {
                                                        setLoading(false, 0, "");
                                                        showError("Failed to upload Driving License: " + error.getMessage());
                                                    });
                                                }
                                            }
                                    );
                                }

                                @Override
                                public void onFailure(Exception error) {
                                    runOnUiThread(() -> {
                                        setLoading(false, 0, "");
                                        showError("Failed to upload RC Document: " + error.getMessage());
                                    });
                                }
                            }
                    );
                })
                .addOnFailureListener(e -> {
                    setLoading(false, 0, "");
                    String msg = e.getMessage() != null ? e.getMessage() : "Registration failed";
                    if (msg.contains("email-already-in-use")) {
                        msg = "This email is already registered (possibly as Customer or Restaurant).";
                    }
                    showError(msg);
                });
    }

    private void savePartnerProfile(
            String uid,
            String name,
            String email,
            String phone,
            String vehicle,
            String vehicleNumber,
            String rcUrl,
            String licenseUrl,
            String password,
            String pincode,
            String emergency
    ) {
        Map<String, Object> data = new HashMap<>();
        data.put("uid", uid);
        data.put("id", uid);
        data.put("name", name);
        data.put("email", email);
        data.put("phone", phone);
        data.put("vehicle", vehicle);
        data.put("vehicleType", vehicle);
        data.put("vehicleNumber", vehicleNumber);
        data.put("vehicleImage", rcUrl);
        data.put("drivingLicense", licenseUrl);
        data.put("rcDocument", rcUrl);
        data.put("verificationStatus", "pending"); // Matches web status
        data.put("kycStatus", "pending");
        data.put("isVerified", false);
        data.put("isAvailable", false);
        data.put("status", "offline");
        data.put("rating", 5.0);
        data.put("password", password);
        data.put("servicePincodes", TextUtils.isEmpty(pincode) ? Collections.emptyList() : Collections.singletonList(pincode));
        data.put("pincodeFilterActive", false);
        data.put("emergencyContact", emergency);
        data.put("todayEarnings", 0.0);
        data.put("totalEarnings", 0.0);
        data.put("walletBalance", 0.0);
        data.put("availableEarnings", 0.0);
        data.put("totalDeliveries", 0);
        data.put("fairRouteScore", 85);
        data.put("createdAt", FieldValue.serverTimestamp());

        db.collection(Constants.COLLECTION_DELIVERY_PERSONS)
                .document(uid)
                .set(data)
                .addOnSuccessListener(v -> {
                    setLoading(false, 100, "Done!");
                    // Strict security rule: Driver must wait for Admin verification before login
                    auth.signOut();
                    showSuccessDialog();
                })
                .addOnFailureListener(e -> {
                    setLoading(false, 0, "");
                    showError("Failed to save profile: " + e.getMessage());
                });
    }

    private void showSuccessDialog() {
        new AlertDialog.Builder(this)
                .setTitle("Application Submitted!")
                .setMessage("Your partner application has been submitted successfully.\n\nOur team is reviewing your RC and Driving License documents. Once approved by the Admin, you will be able to log in and start delivering.")
                .setIcon(R.drawable.ic_check_circle_filled)
                .setCancelable(false)
                .setPositiveButton("Go to Sign In", (dialog, which) -> {
                    Toast.makeText(this, "Application under review. Please wait for Admin approval.", Toast.LENGTH_LONG).show();
                    finish();
                })
                .show();
    }

    private void showError(String message) {
        cardError.setVisibility(View.VISIBLE);
        tvError.setText(message);
    }

    private void clearError() {
        cardError.setVisibility(View.GONE);
    }

    private void setLoading(boolean loading, int progress, String message) {
        cardProgress.setVisibility(loading ? View.VISIBLE : View.GONE);
        progressBar.setProgress(progress);
        tvProgressStatus.setText(message);
        btnSubmit.setEnabled(!loading);
    }
}
