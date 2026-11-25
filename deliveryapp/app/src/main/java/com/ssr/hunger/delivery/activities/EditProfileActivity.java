package com.ssr.hunger.delivery.activities;

import android.content.Intent;
import android.content.res.ColorStateList;
import android.net.Uri;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.core.content.ContextCompat;

import com.bumptech.glide.Glide;
import com.bumptech.glide.load.engine.DiskCacheStrategy;
import com.google.android.material.button.MaterialButton;
import com.google.android.material.card.MaterialCardView;
import com.google.android.material.chip.Chip;
import com.google.android.material.chip.ChipGroup;
import com.google.android.material.textfield.TextInputEditText;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.FieldValue;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.SetOptions;
import com.ssr.hunger.delivery.R;
import com.ssr.hunger.delivery.models.DeliveryPartner;
import com.ssr.hunger.delivery.utils.Constants;
import com.ssr.hunger.delivery.utils.DocumentUploadHelper;

import java.util.HashMap;
import java.util.Map;

import de.hdodenhof.circleimageview.CircleImageView;

/**
 * EditProfileActivity - Professional Profile, KYC and Document Management screen.
 * Allows Delivery Partners to:
 * - Update personal details (Name, Username, Phone, Email, Address, Emergency Contact)
 * - Update vehicle fleet info (Type, Number, DL number)
 * - Upload & manage KYC documents (DL, RC, Aadhaar, Insurance, Avatar Photo)
 * - Save directly to Firestore and maintain instant live sync with PartnerProfileFragment.
 */
public class EditProfileActivity extends AppCompatActivity {

    private FirebaseAuth auth;
    private FirebaseFirestore db;
    private String currentUid;

    // Avatar
    private CircleImageView ivAvatar;
    private FrameLayout layoutAvatarClick;
    private ProgressBar progressAvatar;
    private TextView tvAvatarStatus;
    private String uploadedAvatarUrl = null;

    // Personal Info Inputs
    private TextInputEditText etName, etUsername, etPhone, etEmergency, etEmail;
    private TextInputEditText etAddress, etCity, etPincode;

    // Vehicle Fleet Inputs
    private ChipGroup chipGroupVehicle;
    private Chip chipBike, chipScooter, chipEv, chipCar;
    private TextInputEditText etVehicleNumber, etLicenseNumber;

    // KYC & Documents
    private TextInputEditText etAadhaarNumber;

    // DL Document
    private LinearLayout layoutDlContainer;
    private ImageView ivDlStatusIcon;
    private TextView tvDlFilename, tvDlStatus;
    private MaterialButton btnPickDl;
    private String uploadedDlUrl = null;

    // RC Document
    private LinearLayout layoutRcContainer;
    private ImageView ivRcStatusIcon;
    private TextView tvRcFilename, tvRcStatus;
    private MaterialButton btnPickRc;
    private String uploadedRcUrl = null;

    // Aadhaar Document
    private LinearLayout layoutAadhaarContainer;
    private ImageView ivAadhaarStatusIcon;
    private TextView tvAadhaarFilename, tvAadhaarStatus;
    private MaterialButton btnPickAadhaar;
    private String uploadedAadhaarUrl = null;

    // Insurance Document
    private LinearLayout layoutInsuranceContainer;
    private ImageView ivInsuranceStatusIcon;
    private TextView tvInsuranceFilename, tvInsuranceStatus;
    private MaterialButton btnPickInsurance;
    private String uploadedInsuranceUrl = null;

    // Error & Progress
    private MaterialCardView cardError, cardProgress;
    private TextView tvError, tvProgressStatus;
    private ProgressBar progressEditBar;
    private MaterialButton btnSave;

    // Activity Result Launchers
    private final ActivityResultLauncher<String> avatarPickerLauncher =
            registerForActivityResult(new ActivityResultContracts.GetContent(), uri -> {
                if (uri != null) uploadAvatarFile(uri);
            });

    private final ActivityResultLauncher<String> dlPickerLauncher =
            registerForActivityResult(new ActivityResultContracts.GetContent(), uri -> {
                if (uri != null) uploadDocumentFile(uri, "driving_license");
            });

    private final ActivityResultLauncher<String> rcPickerLauncher =
            registerForActivityResult(new ActivityResultContracts.GetContent(), uri -> {
                if (uri != null) uploadDocumentFile(uri, "rc");
            });

    private final ActivityResultLauncher<String> aadhaarPickerLauncher =
            registerForActivityResult(new ActivityResultContracts.GetContent(), uri -> {
                if (uri != null) uploadDocumentFile(uri, "aadhaar");
            });

    private final ActivityResultLauncher<String> insurancePickerLauncher =
            registerForActivityResult(new ActivityResultContracts.GetContent(), uri -> {
                if (uri != null) uploadDocumentFile(uri, "insurance");
            });

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_edit_profile);

        auth = FirebaseAuth.getInstance();
        db = FirebaseFirestore.getInstance();

        if (auth.getCurrentUser() != null) {
            currentUid = auth.getCurrentUser().getUid();
        } else {
            Toast.makeText(this, "Session expired, please login again", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        initToolbar();
        initViews();
        setupListeners();
        loadPartnerData();
    }

    private void initToolbar() {
        Toolbar toolbar = findViewById(R.id.toolbar_edit_profile);
        setSupportActionBar(toolbar);
        if (getSupportActionBar() != null) {
            getSupportActionBar().setDisplayHomeAsUpEnabled(true);
            getSupportActionBar().setDisplayShowHomeEnabled(true);
        }
        toolbar.setNavigationOnClickListener(v -> finish());
    }

    private void initViews() {
        // Avatar
        ivAvatar = findViewById(R.id.iv_edit_avatar);
        layoutAvatarClick = findViewById(R.id.layout_avatar_click);
        progressAvatar = findViewById(R.id.progress_avatar_upload);
        tvAvatarStatus = findViewById(R.id.tv_avatar_status);

        // Personal
        etName = findViewById(R.id.et_edit_name);
        etUsername = findViewById(R.id.et_edit_username);
        etPhone = findViewById(R.id.et_edit_phone);
        etEmergency = findViewById(R.id.et_edit_emergency);
        etEmail = findViewById(R.id.et_edit_email);
        etAddress = findViewById(R.id.et_edit_address);
        etCity = findViewById(R.id.et_edit_city);
        etPincode = findViewById(R.id.et_edit_pincode);

        // Vehicle
        chipGroupVehicle = findViewById(R.id.chip_group_edit_vehicle);
        chipBike = findViewById(R.id.chip_edit_bike);
        chipScooter = findViewById(R.id.chip_edit_scooter);
        chipEv = findViewById(R.id.chip_edit_ev);
        chipCar = findViewById(R.id.chip_edit_car);
        etVehicleNumber = findViewById(R.id.et_edit_vehicle_number);
        etLicenseNumber = findViewById(R.id.et_edit_license_number);

        // KYC & Docs
        etAadhaarNumber = findViewById(R.id.et_edit_aadhaar_number);

        layoutDlContainer = findViewById(R.id.layout_edit_dl_container);
        ivDlStatusIcon = findViewById(R.id.iv_edit_dl_status_icon);
        tvDlFilename = findViewById(R.id.tv_edit_dl_filename);
        tvDlStatus = findViewById(R.id.tv_edit_dl_status);
        btnPickDl = findViewById(R.id.btn_edit_pick_dl);

        layoutRcContainer = findViewById(R.id.layout_edit_rc_container);
        ivRcStatusIcon = findViewById(R.id.iv_edit_rc_status_icon);
        tvRcFilename = findViewById(R.id.tv_edit_rc_filename);
        tvRcStatus = findViewById(R.id.tv_edit_rc_status);
        btnPickRc = findViewById(R.id.btn_edit_pick_rc);

        layoutAadhaarContainer = findViewById(R.id.layout_edit_aadhaar_container);
        ivAadhaarStatusIcon = findViewById(R.id.iv_edit_aadhaar_status_icon);
        tvAadhaarFilename = findViewById(R.id.tv_edit_aadhaar_filename);
        tvAadhaarStatus = findViewById(R.id.tv_edit_aadhaar_status);
        btnPickAadhaar = findViewById(R.id.btn_edit_pick_aadhaar);

        layoutInsuranceContainer = findViewById(R.id.layout_edit_insurance_container);
        ivInsuranceStatusIcon = findViewById(R.id.iv_edit_insurance_status_icon);
        tvInsuranceFilename = findViewById(R.id.tv_edit_insurance_filename);
        tvInsuranceStatus = findViewById(R.id.tv_edit_insurance_status);
        btnPickInsurance = findViewById(R.id.btn_edit_pick_insurance);

        // Status & Save
        cardError = findViewById(R.id.card_edit_error);
        tvError = findViewById(R.id.tv_edit_error);
        cardProgress = findViewById(R.id.card_edit_progress);
        tvProgressStatus = findViewById(R.id.tv_edit_progress_status);
        progressEditBar = findViewById(R.id.progress_edit_bar);
        btnSave = findViewById(R.id.btn_save_edit_profile);
    }

    private void setupListeners() {
        // Avatar picker
        layoutAvatarClick.setOnClickListener(v -> avatarPickerLauncher.launch("image/*"));
        findViewById(R.id.tv_avatar_tap_hint).setOnClickListener(v -> avatarPickerLauncher.launch("image/*"));

        // Document pickers
        btnPickDl.setOnClickListener(v -> dlPickerLauncher.launch("*/*"));
        layoutDlContainer.setOnClickListener(v -> dlPickerLauncher.launch("*/*"));

        btnPickRc.setOnClickListener(v -> rcPickerLauncher.launch("*/*"));
        layoutRcContainer.setOnClickListener(v -> rcPickerLauncher.launch("*/*"));

        btnPickAadhaar.setOnClickListener(v -> aadhaarPickerLauncher.launch("*/*"));
        layoutAadhaarContainer.setOnClickListener(v -> aadhaarPickerLauncher.launch("*/*"));

        btnPickInsurance.setOnClickListener(v -> insurancePickerLauncher.launch("*/*"));
        layoutInsuranceContainer.setOnClickListener(v -> insurancePickerLauncher.launch("*/*"));

        // Save
        btnSave.setOnClickListener(v -> saveProfileChanges());
    }

    private void loadPartnerData() {
        showProgress("Loading profile data...");
        db.collection(Constants.COLLECTION_DELIVERY_PERSONS)
                .document(currentUid)
                .get()
                .addOnSuccessListener(snap -> {
                    hideProgress();
                    if (!snap.exists()) return;

                    DeliveryPartner partner = snap.toObject(DeliveryPartner.class);
                    if (partner != null) {
                        populateForm(partner);
                    }
                })
                .addOnFailureListener(e -> {
                    hideProgress();
                    showError("Failed to load profile: " + e.getMessage());
                });
    }

    private void populateForm(@NonNull DeliveryPartner partner) {
        etName.setText(partner.getName());
        etUsername.setText(partner.getUsername());
        etPhone.setText(partner.getPhone());
        etEmergency.setText(partner.getEmergencyContact());
        etEmail.setText(partner.getEmail());
        etAddress.setText(partner.getAddress());
        etCity.setText(partner.getCity());
        etPincode.setText(partner.getPincode());

        etVehicleNumber.setText(partner.getVehicleNumber());
        etLicenseNumber.setText(partner.getLicenseNumber());
        etAadhaarNumber.setText(partner.getAadhaarNumber());

        // Vehicle category
        String vType = partner.getVehicleType();
        if (vType != null) {
            String lower = vType.toLowerCase();
            if (lower.contains("scooter")) chipScooter.setChecked(true);
            else if (lower.contains("electric") || lower.contains("ev")) chipEv.setChecked(true);
            else if (lower.contains("car") || lower.contains("van") || lower.contains("truck")) chipCar.setChecked(true);
            else chipBike.setChecked(true);
        }

        // Avatar
        uploadedAvatarUrl = partner.getProfileImage();
        if (uploadedAvatarUrl != null && !uploadedAvatarUrl.isEmpty()) {
            Glide.with(this)
                    .load(uploadedAvatarUrl)
                    .placeholder(R.drawable.ic_profile)
                    .error(R.drawable.ic_profile)
                    .diskCacheStrategy(DiskCacheStrategy.ALL)
                    .into(ivAvatar);
            tvAvatarStatus.setText("Profile photo verified");
            tvAvatarStatus.setTextColor(ContextCompat.getColor(this, R.color.success));
        }

        // Documents
        uploadedDlUrl = partner.getDrivingLicense();
        if (uploadedDlUrl != null && !uploadedDlUrl.isEmpty()) {
            markDocVerified(tvDlFilename, tvDlStatus, ivDlStatusIcon, layoutDlContainer, btnPickDl, "Driving License • Verified");
        }

        uploadedRcUrl = partner.getVehicleImage();
        if (uploadedRcUrl != null && !uploadedRcUrl.isEmpty()) {
            markDocVerified(tvRcFilename, tvRcStatus, ivRcStatusIcon, layoutRcContainer, btnPickRc, "RC Document • Verified");
        }

        uploadedAadhaarUrl = partner.getAadhaarDocument();
        if (uploadedAadhaarUrl != null && !uploadedAadhaarUrl.isEmpty()) {
            markDocVerified(tvAadhaarFilename, tvAadhaarStatus, ivAadhaarStatusIcon, layoutAadhaarContainer, btnPickAadhaar, "Aadhaar Document • Verified");
        }

        uploadedInsuranceUrl = partner.getInsuranceDocument();
        if (uploadedInsuranceUrl != null && !uploadedInsuranceUrl.isEmpty()) {
            markDocVerified(tvInsuranceFilename, tvInsuranceStatus, ivInsuranceStatusIcon, layoutInsuranceContainer, btnPickInsurance, "Insurance Policy • Uploaded");
        }
    }

    private void markDocVerified(TextView tvName, TextView tvStatus, ImageView ivIcon, LinearLayout container, MaterialButton btn, String label) {
        tvName.setText(label);
        tvStatus.setText("File uploaded & secure");
        tvStatus.setTextColor(ContextCompat.getColor(this, R.color.success));
        ivIcon.setImageResource(R.drawable.ic_check_circle_filled);
        ivIcon.setImageTintList(ColorStateList.valueOf(ContextCompat.getColor(this, R.color.success)));
        container.setBackgroundResource(R.drawable.bg_doc_card_selected);
        btn.setText("Replace");
    }

    private void uploadAvatarFile(@NonNull Uri uri) {
        progressAvatar.setVisibility(View.VISIBLE);
        tvAvatarStatus.setText("Uploading new profile photo...");
        tvAvatarStatus.setTextColor(ContextCompat.getColor(this, R.color.primary));

        // Preview immediately
        Glide.with(this).load(uri).into(ivAvatar);

        DocumentUploadHelper.uploadDocument(this, uri, currentUid, "avatar", new DocumentUploadHelper.UploadCallback() {
            @Override
            public void onProgress(int percent, String stageMessage) {
                runOnUiThread(() -> tvAvatarStatus.setText(stageMessage));
            }

            @Override
            public void onSuccess(@NonNull String downloadUrl) {
                runOnUiThread(() -> {
                    progressAvatar.setVisibility(View.GONE);
                    uploadedAvatarUrl = downloadUrl;
                    tvAvatarStatus.setText("Photo uploaded successfully!");
                    tvAvatarStatus.setTextColor(ContextCompat.getColor(EditProfileActivity.this, R.color.success));

                    // Quick persist to Firestore
                    Map<String, Object> update = new HashMap<>();
                    update.put("profileImage", downloadUrl);
                    db.collection(Constants.COLLECTION_DELIVERY_PERSONS)
                            .document(currentUid)
                            .set(update, SetOptions.merge());
                });
            }

            @Override
            public void onFailure(@NonNull Exception error) {
                runOnUiThread(() -> {
                    progressAvatar.setVisibility(View.GONE);
                    tvAvatarStatus.setText("Upload failed: " + error.getMessage());
                    tvAvatarStatus.setTextColor(ContextCompat.getColor(EditProfileActivity.this, R.color.error));
                    showError("Avatar upload failed: " + error.getMessage());
                });
            }
        });
    }

    private void uploadDocumentFile(@NonNull Uri uri, @NonNull String docType) {
        String fileName = DocumentUploadHelper.getFileName(this, uri);
        showProgress("Uploading " + docType + "...");

        DocumentUploadHelper.uploadDocument(this, uri, currentUid, docType, new DocumentUploadHelper.UploadCallback() {
            @Override
            public void onProgress(int percent, String stageMessage) {
                runOnUiThread(() -> showProgress(stageMessage));
            }

            @Override
            public void onSuccess(@NonNull String downloadUrl) {
                runOnUiThread(() -> {
                    hideProgress();
                    clearError();
                    Map<String, Object> update = new HashMap<>();

                    switch (docType) {
                        case "driving_license":
                            uploadedDlUrl = downloadUrl;
                            update.put("drivingLicense", downloadUrl);
                            markDocVerified(tvDlFilename, tvDlStatus, ivDlStatusIcon, layoutDlContainer, btnPickDl, fileName);
                            break;
                        case "rc":
                            uploadedRcUrl = downloadUrl;
                            update.put("vehicleImage", downloadUrl);
                            update.put("rcDocument", downloadUrl);
                            markDocVerified(tvRcFilename, tvRcStatus, ivRcStatusIcon, layoutRcContainer, btnPickRc, fileName);
                            break;
                        case "aadhaar":
                            uploadedAadhaarUrl = downloadUrl;
                            update.put("aadhaarDocument", downloadUrl);
                            markDocVerified(tvAadhaarFilename, tvAadhaarStatus, ivAadhaarStatusIcon, layoutAadhaarContainer, btnPickAadhaar, fileName);
                            break;
                        case "insurance":
                            uploadedInsuranceUrl = downloadUrl;
                            update.put("insuranceDocument", downloadUrl);
                            markDocVerified(tvInsuranceFilename, tvInsuranceStatus, ivInsuranceStatusIcon, layoutInsuranceContainer, btnPickInsurance, fileName);
                            break;
                    }

                    db.collection(Constants.COLLECTION_DELIVERY_PERSONS)
                            .document(currentUid)
                            .set(update, SetOptions.merge());

                    Toast.makeText(EditProfileActivity.this, "Document uploaded successfully!", Toast.LENGTH_SHORT).show();
                });
            }

            @Override
            public void onFailure(@NonNull Exception error) {
                runOnUiThread(() -> {
                    hideProgress();
                    showError("Failed to upload " + docType + ": " + error.getMessage());
                });
            }
        });
    }

    private String getSelectedVehicleCategory() {
        int checkedId = chipGroupVehicle.getCheckedChipId();
        if (checkedId == R.id.chip_edit_scooter) return "Scooter";
        if (checkedId == R.id.chip_edit_ev) return "Electric EV";
        if (checkedId == R.id.chip_edit_car) return "Car / Van";
        return "Motorcycle";
    }

    private void saveProfileChanges() {
        clearError();

        String name = etName.getText() != null ? etName.getText().toString().trim() : "";
        String username = etUsername.getText() != null ? etUsername.getText().toString().trim() : "";
        String phone = etPhone.getText() != null ? etPhone.getText().toString().trim() : "";
        String emergency = etEmergency.getText() != null ? etEmergency.getText().toString().trim() : "";
        String email = etEmail.getText() != null ? etEmail.getText().toString().trim() : "";
        String address = etAddress.getText() != null ? etAddress.getText().toString().trim() : "";
        String city = etCity.getText() != null ? etCity.getText().toString().trim() : "";
        String pincode = etPincode.getText() != null ? etPincode.getText().toString().trim() : "";

        String vehicleType = getSelectedVehicleCategory();
        String vehicleNumber = etVehicleNumber.getText() != null ? etVehicleNumber.getText().toString().trim() : "";
        String licenseNumber = etLicenseNumber.getText() != null ? etLicenseNumber.getText().toString().trim() : "";
        String aadhaarNumber = etAadhaarNumber.getText() != null ? etAadhaarNumber.getText().toString().trim() : "";

        // Validations
        if (TextUtils.isEmpty(name)) {
            showError("Full Name cannot be empty");
            etName.requestFocus();
            return;
        }

        if (TextUtils.isEmpty(phone) || phone.length() < 10) {
            showError("Please enter a valid 10-digit mobile number");
            etPhone.requestFocus();
            return;
        }

        if (TextUtils.isEmpty(address)) {
            showError("Operating / Home address is required");
            etAddress.requestFocus();
            return;
        }

        if (TextUtils.isEmpty(pincode) || pincode.length() < 6) {
            showError("Please enter a valid 6-digit postal pincode");
            etPincode.requestFocus();
            return;
        }

        if (TextUtils.isEmpty(vehicleNumber)) {
            showError("Vehicle registration plate number is required");
            etVehicleNumber.requestFocus();
            return;
        }

        if (TextUtils.isEmpty(licenseNumber)) {
            showError("Driving license number is required");
            etLicenseNumber.requestFocus();
            return;
        }

        showProgress("Saving profile & updating verification status...");

        Map<String, Object> updates = new HashMap<>();
        updates.put("name", name);
        updates.put("username", username);
        updates.put("phone", phone);
        updates.put("emergencyContact", emergency);
        updates.put("email", email);
        updates.put("address", address);
        updates.put("city", city);
        updates.put("pincode", pincode);
        updates.put("vehicleType", vehicleType);
        updates.put("vehicle", vehicleType.toLowerCase());
        updates.put("vehicleNumber", vehicleNumber.toUpperCase());
        updates.put("licenseNumber", licenseNumber.toUpperCase());
        updates.put("aadhaarNumber", aadhaarNumber);
        updates.put("updatedAt", FieldValue.serverTimestamp());

        if (uploadedAvatarUrl != null) updates.put("profileImage", uploadedAvatarUrl);
        if (uploadedDlUrl != null) updates.put("drivingLicense", uploadedDlUrl);
        if (uploadedRcUrl != null) {
            updates.put("vehicleImage", uploadedRcUrl);
            updates.put("rcDocument", uploadedRcUrl);
        }
        if (uploadedAadhaarUrl != null) updates.put("aadhaarDocument", uploadedAadhaarUrl);
        if (uploadedInsuranceUrl != null) updates.put("insuranceDocument", uploadedInsuranceUrl);

        // Check if both DL & RC are present to update kycStatus
        boolean hasDl = uploadedDlUrl != null && !uploadedDlUrl.isEmpty();
        boolean hasRc = uploadedRcUrl != null && !uploadedRcUrl.isEmpty();
        if (hasDl && hasRc) {
            updates.put("kycStatus", "approved");
            updates.put("verificationStatus", "approved");
            updates.put("isVerified", true);
        }

        db.collection(Constants.COLLECTION_DELIVERY_PERSONS)
                .document(currentUid)
                .set(updates, SetOptions.merge())
                .addOnSuccessListener(v -> {
                    hideProgress();
                    Toast.makeText(this, "Profile & KYC updated successfully! 🚀", Toast.LENGTH_SHORT).show();
                    setResult(RESULT_OK);
                    finish();
                })
                .addOnFailureListener(e -> {
                    hideProgress();
                    showError("Failed to save profile: " + e.getMessage());
                });
    }

    private void showError(String message) {
        tvError.setText(message);
        cardError.setVisibility(View.VISIBLE);
    }

    private void clearError() {
        cardError.setVisibility(View.GONE);
    }

    private void showProgress(String message) {
        tvProgressStatus.setText(message);
        cardProgress.setVisibility(View.VISIBLE);
        btnSave.setEnabled(false);
    }

    private void hideProgress() {
        cardProgress.setVisibility(View.GONE);
        btnSave.setEnabled(true);
    }
}
