package com.ssr.hunger.activities;

import android.net.Uri;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AlertDialog;
import com.ssr.hunger.R;
import com.ssr.hunger.utils.CloudinaryHelper;
import com.ssr.hunger.utils.Constants;
import com.ssr.hunger.utils.PerformanceHelper;
import com.bumptech.glide.Glide;
import com.google.android.material.textfield.TextInputEditText;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.FieldValue;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.perf.metrics.Trace;
import de.hdodenhof.circleimageview.CircleImageView;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Edit Profile Activity - mirrors the web app's profile page.
 * Features: avatar upload via Cloudinary, name/phone editing, address management.
 * Extends BaseActivity for Realtime Analytics, Performance image upload tracing, and Crashlytics.
 */
public class EditProfileActivity extends BaseActivity {

    private TextInputEditText etName, etPhone, etStreet, etCity, etPincode;
    private CircleImageView ivAvatar;
    private LinearLayout addressContainer;
    private FirebaseFirestore db;
    private View progressAvatar;

    private final ActivityResultLauncher<String> imagePickerLauncher =
            registerForActivityResult(new ActivityResultContracts.GetContent(), uri -> {
                if (uri != null) {
                    uploadAvatar(uri);
                }
            });

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_edit_profile);

        db = FirebaseFirestore.getInstance();
        etName = findViewById(R.id.et_name);
        etPhone = findViewById(R.id.et_phone);
        etStreet = findViewById(R.id.et_street);
        etCity = findViewById(R.id.et_city);
        etPincode = findViewById(R.id.et_pincode);
        ivAvatar = findViewById(R.id.iv_edit_avatar);
        addressContainer = findViewById(R.id.address_container);
        progressAvatar = findViewById(R.id.progress_avatar);

        findViewById(R.id.btn_back).setOnClickListener(v -> finish());
        findViewById(R.id.btn_save).setOnClickListener(v -> saveProfile());

        // Avatar tap to upload
        if (ivAvatar != null) {
            ivAvatar.setOnClickListener(v -> imagePickerLauncher.launch("image/*"));
        }

        // Add address button
        View btnAddAddress = findViewById(R.id.btn_add_address);
        if (btnAddAddress != null) {
            btnAddAddress.setOnClickListener(v -> {
                Toast.makeText(this, "Use the location picker on the home screen to add addresses", Toast.LENGTH_SHORT).show();
            });
        }

        loadProfile();
    }

    private void loadProfile() {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) return;

        db.collection(Constants.COLLECTION_CUSTOMERS).document(user.getUid())
                .get()
                .addOnSuccessListener(doc -> {
                    if (!doc.exists()) return;
                    etName.setText(doc.getString("name"));
                    etPhone.setText(doc.getString("phone"));
                    etStreet.setText(doc.getString("street"));
                    etCity.setText(doc.getString("city"));
                    etPincode.setText(doc.getString("pincode"));

                    // Load avatar
                    String avatar = doc.getString("avatar");
                    if (avatar != null && !avatar.isEmpty() && ivAvatar != null) {
                        Glide.with(this).load(avatar).placeholder(R.drawable.ic_profile).into(ivAvatar);
                    }

                    // Load addresses
                    loadAddresses(doc);
                })
                .addOnFailureListener(e -> recordException("loadProfile_failed", e));
    }

    private void loadAddresses(com.google.firebase.firestore.DocumentSnapshot doc) {
        if (addressContainer == null) return;
        addressContainer.removeAllViews();

        List<Map<String, Object>> addresses = (List<Map<String, Object>>) doc.get("addresses");
        if (addresses == null || addresses.isEmpty()) {
            TextView empty = new TextView(this);
            empty.setText("No saved addresses. Add one from the home screen location picker.");
            empty.setTextColor(getColor(R.color.text_secondary));
            empty.setTextSize(13);
            addressContainer.addView(empty);
            return;
        }

        for (Map<String, Object> addrMap : addresses) {
            View card = LayoutInflater.from(this).inflate(R.layout.item_address_card, addressContainer, false);

            String type = (String) addrMap.get("type");
            String street = (String) addrMap.get("street");
            String city = (String) addrMap.get("city");
            String pincode = (String) addrMap.get("pincode");
            Boolean isDefault = (Boolean) addrMap.get("isDefault");

            TextView tvType = card.findViewById(R.id.tv_address_type);
            TextView tvAddress = card.findViewById(R.id.tv_address_text);
            View badge = card.findViewById(R.id.badge_default);

            String icon = "home".equals(type) ? "🏠" : "work".equals(type) ? "💼" : "📍";
            tvType.setText(icon + " " + (type != null ? type.toUpperCase() : "OTHER"));

            StringBuilder addr = new StringBuilder();
            if (street != null) addr.append(street);
            if (city != null) addr.append(", ").append(city);
            if (pincode != null) addr.append(" - ").append(pincode);
            tvAddress.setText(addr.toString());

            badge.setVisibility(Boolean.TRUE.equals(isDefault) ? View.VISIBLE : View.GONE);

            // Long press to delete
            card.setOnLongClickListener(v -> {
                new com.google.android.material.dialog.MaterialAlertDialogBuilder(this)
                        .setTitle("Delete Address")
                        .setMessage("Remove this address?")
                        .setPositiveButton("Delete", (d, w) -> deleteAddress(addrMap))
                        .setNegativeButton("Cancel", null)
                        .show();
                return true;
            });

            addressContainer.addView(card);
        }
    }

    private void deleteAddress(Map<String, Object> addrMap) {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) return;

        db.collection(Constants.COLLECTION_CUSTOMERS).document(user.getUid())
                .update("addresses", FieldValue.arrayRemove(addrMap))
                .addOnSuccessListener(aVoid -> {
                    logBreadcrumb("Deleted address");
                    Toast.makeText(this, "Address removed", Toast.LENGTH_SHORT).show();
                    loadProfile();
                })
                .addOnFailureListener(e -> recordException("deleteAddress_failed", e));
    }

    private void uploadAvatar(Uri imageUri) {
        if (progressAvatar != null) progressAvatar.setVisibility(View.VISIBLE);
        logBreadcrumb("Uploading avatar image to Cloudinary");

        Trace uploadTrace = startTrace(PerformanceHelper.TRACE_IMAGE_UPLOAD);

        CloudinaryHelper.uploadImage(this, imageUri, new CloudinaryHelper.UploadCallback() {
            @Override
            public void onSuccess(String imageUrl) {
                stopTrace(uploadTrace);
                runOnUiThread(() -> {
                    if (progressAvatar != null) progressAvatar.setVisibility(View.GONE);

                    FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
                    if (user != null) {
                        db.collection(Constants.COLLECTION_CUSTOMERS).document(user.getUid())
                                .update("avatar", imageUrl)
                                .addOnSuccessListener(aVoid -> {
                                    Glide.with(EditProfileActivity.this).load(imageUrl).into(ivAvatar);
                                    logBreadcrumb("Avatar updated successfully: " + imageUrl);
                                    Toast.makeText(EditProfileActivity.this, "Avatar updated! 📸", Toast.LENGTH_SHORT).show();
                                })
                                .addOnFailureListener(e -> recordException("updateAvatar_Firestore_failed", e));
                    }
                });
            }

            @Override
            public void onError(String error) {
                stopTrace(uploadTrace);
                recordException("uploadAvatar_Cloudinary_failed", new Exception(error));
                runOnUiThread(() -> {
                    if (progressAvatar != null) progressAvatar.setVisibility(View.GONE);
                    Toast.makeText(EditProfileActivity.this, "Upload failed: " + error, Toast.LENGTH_SHORT).show();
                });
            }
        });
    }

    private void saveProfile() {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) return;

        String name = etName.getText().toString().trim();
        if (TextUtils.isEmpty(name)) {
            Toast.makeText(this, "Name is required", Toast.LENGTH_SHORT).show();
            return;
        }

        Map<String, Object> updates = new HashMap<>();
        updates.put("name", name);
        updates.put("phone", etPhone.getText().toString().trim());
        updates.put("street", etStreet.getText().toString().trim());
        updates.put("city", etCity.getText().toString().trim());
        updates.put("pincode", etPincode.getText().toString().trim());

        db.collection(Constants.COLLECTION_CUSTOMERS).document(user.getUid())
                .update(updates)
                .addOnSuccessListener(aVoid -> {
                    logBreadcrumb("Profile details updated");
                    analyticsHelper.logSelectContent("profile_update", user.getUid(), name);
                    Toast.makeText(this, "Profile updated! ✅", Toast.LENGTH_SHORT).show();
                    finish();
                })
                .addOnFailureListener(e -> {
                    recordException("saveProfile_failed", e);
                    Toast.makeText(this, "Failed: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                });
    }

    @Override
    protected String getScreenName() {
        return "EditProfile";
    }
}
