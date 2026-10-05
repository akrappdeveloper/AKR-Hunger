package com.ssr.hunger.activities;

import android.net.Uri;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.Nullable;
import androidx.core.content.FileProvider;

import com.bumptech.glide.Glide;
import com.google.android.material.bottomsheet.BottomSheetDialog;
import com.google.android.material.button.MaterialButton;
import com.google.android.material.dialog.MaterialAlertDialogBuilder;
import com.google.android.material.materialswitch.MaterialSwitch;
import com.google.android.material.textfield.TextInputEditText;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.FieldValue;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.perf.metrics.Trace;
import com.ssr.hunger.R;
import com.ssr.hunger.utils.CloudinaryHelper;
import com.ssr.hunger.utils.Constants;
import com.ssr.hunger.utils.PerformanceHelper;

import java.io.File;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import de.hdodenhof.circleimageview.CircleImageView;

/**
 * Edit Profile Activity.
 * Supports direct camera photo capture via FileProvider, gallery photo selection,
 * avatar removal, complete address CRUD with BottomSheet dialogs, and unsaved changes confirmation.
 */
public class EditProfileActivity extends BaseActivity {

    private TextInputEditText etName, etPhone, etStreet, etCity, etPincode;
    private CircleImageView ivAvatar;
    private LinearLayout addressContainer;
    private FirebaseFirestore db;
    private View progressAvatar;

    // Track original form values for unsaved changes check
    private String origName = "", origPhone = "", origStreet = "", origCity = "", origPincode = "";
    private String currentAvatarUrl = null;

    // Camera Image Uri holder
    private Uri cameraImageUri;

    // Camera launcher
    private final ActivityResultLauncher<Uri> takePictureLauncher =
            registerForActivityResult(new ActivityResultContracts.TakePicture(), success -> {
                if (success && cameraImageUri != null) {
                    logBreadcrumb("Photo snapped from camera successfully");
                    uploadAvatar(cameraImageUri);
                } else {
                    logBreadcrumb("Camera photo capture cancelled");
                }
            });

    // Gallery launcher
    private final ActivityResultLauncher<String> imagePickerLauncher =
            registerForActivityResult(new ActivityResultContracts.GetContent(), uri -> {
                if (uri != null) {
                    logBreadcrumb("Photo selected from gallery");
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

        findViewById(R.id.btn_back).setOnClickListener(v -> onBackPressed());
        findViewById(R.id.btn_save).setOnClickListener(v -> saveProfile());

        // Avatar tap — choose from Photo Library or Camera
        if (ivAvatar != null) {
            ivAvatar.setOnClickListener(v -> showPhotoSourceDialog());
        }

        // Change photo button
        View btnChangePhoto = findViewById(R.id.btn_change_photo);
        if (btnChangePhoto != null) {
            btnChangePhoto.setOnClickListener(v -> showPhotoSourceDialog());
        }

        // Dedicated Photo Library button
        View btnPickGallery = findViewById(R.id.btn_pick_gallery);
        if (btnPickGallery != null) {
            btnPickGallery.setOnClickListener(v -> openPhotoLibraryWithPermission());
        }

        // Dedicated Camera button
        View btnTakePhoto = findViewById(R.id.btn_take_photo);
        if (btnTakePhoto != null) {
            btnTakePhoto.setOnClickListener(v -> openCameraWithPermission());
        }

        // Add address button
        View btnAddAddress = findViewById(R.id.btn_add_address);
        if (btnAddAddress != null) {
            btnAddAddress.setOnClickListener(v -> showAddressDialog(null));
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

                    origName = doc.getString("name") != null ? doc.getString("name") : "";
                    origPhone = doc.getString("phone") != null ? doc.getString("phone") : "";
                    origStreet = doc.getString("street") != null ? doc.getString("street") : "";
                    origCity = doc.getString("city") != null ? doc.getString("city") : "";
                    origPincode = doc.getString("pincode") != null ? doc.getString("pincode") : "";

                    etName.setText(origName);
                    etPhone.setText(origPhone);
                    etStreet.setText(origStreet);
                    etCity.setText(origCity);
                    etPincode.setText(origPincode);

                    // Load avatar
                    currentAvatarUrl = doc.getString("avatar");
                    if (currentAvatarUrl != null && !currentAvatarUrl.isEmpty() && ivAvatar != null) {
                        Glide.with(this).load(currentAvatarUrl).placeholder(R.drawable.ic_profile).into(ivAvatar);
                    }

                    // Load addresses
                    loadAddresses(doc);
                })
                .addOnFailureListener(e -> recordException("loadProfile_failed", e));
    }

    @SuppressWarnings("unchecked")
    private void loadAddresses(com.google.firebase.firestore.DocumentSnapshot doc) {
        if (addressContainer == null) return;
        addressContainer.removeAllViews();

        List<Map<String, Object>> addresses = (List<Map<String, Object>>) doc.get("addresses");
        if (addresses == null || addresses.isEmpty()) {
            TextView empty = new TextView(this);
            empty.setText("No saved addresses yet. Tap '+ Add New' to save your delivery destinations.");
            empty.setTextColor(getColor(R.color.text_secondary));
            empty.setTextSize(13);
            empty.setPadding(8, 12, 8, 12);
            addressContainer.addView(empty);
            return;
        }

        for (Map<String, Object> addrMap : addresses) {
            View card = LayoutInflater.from(this).inflate(R.layout.item_address_card, addressContainer, false);

            String type = (String) addrMap.get("type");
            String label = (String) addrMap.get("label");
            String street = (String) addrMap.get("street");
            if (street == null) street = (String) addrMap.get("addressLine1");
            String city = (String) addrMap.get("city");
            String pincode = (String) addrMap.get("pincode");
            Boolean isDefault = (Boolean) addrMap.get("isDefault");

            TextView tvTypeEmoji = card.findViewById(R.id.tv_type_emoji);
            TextView tvLabel = card.findViewById(R.id.tv_addr_label);
            TextView tvLine = card.findViewById(R.id.tv_addr_line);
            TextView tvCity = card.findViewById(R.id.tv_addr_city);
            View badgeDefault = card.findViewById(R.id.badge_default);

            MaterialButton btnSetDefault = card.findViewById(R.id.btn_set_default);
            MaterialButton btnEdit = card.findViewById(R.id.btn_edit);
            MaterialButton btnDelete = card.findViewById(R.id.btn_delete);

            String icon = "home".equalsIgnoreCase(type) ? "🏠" : "work".equalsIgnoreCase(type) ? "💼" : "📍";
            if (tvTypeEmoji != null) tvTypeEmoji.setText(icon);

            String displayTitle = !TextUtils.isEmpty(label) ? label : (type != null ? type.toUpperCase() : "ADDRESS");
            if (tvLabel != null) tvLabel.setText(displayTitle);

            if (tvLine != null) tvLine.setText(street != null ? street : "");

            StringBuilder cityStatePin = new StringBuilder();
            if (city != null) cityStatePin.append(city);
            if (pincode != null) cityStatePin.append(city != null ? " - " : "").append(pincode);
            if (tvCity != null) tvCity.setText(cityStatePin.toString());

            boolean defaultActive = Boolean.TRUE.equals(isDefault);
            if (badgeDefault != null) badgeDefault.setVisibility(defaultActive ? View.VISIBLE : View.GONE);
            if (btnSetDefault != null) btnSetDefault.setVisibility(defaultActive ? View.GONE : View.VISIBLE);

            // Edit address button
            if (btnEdit != null) {
                btnEdit.setOnClickListener(v -> showAddressDialog(addrMap));
            }
            card.setOnClickListener(v -> showAddressDialog(addrMap));

            // Set as default button
            if (btnSetDefault != null) {
                btnSetDefault.setOnClickListener(v -> setAddressAsDefault(addrMap));
            }

            // Delete button
            if (btnDelete != null) {
                btnDelete.setOnClickListener(v -> confirmDeleteAddress(addrMap));
            }

            // Long press to delete
            card.setOnLongClickListener(v -> {
                confirmDeleteAddress(addrMap);
                return true;
            });

            addressContainer.addView(card);
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // Address Dialog & Firestore Management
    // ──────────────────────────────────────────────────────────────────

    private void showAddressDialog(@Nullable Map<String, Object> existing) {
        BottomSheetDialog dialog = new BottomSheetDialog(this, R.style.ThemeOverlay_AKR_BottomSheetDialog_Rounded);
        View view = LayoutInflater.from(this).inflate(R.layout.dialog_add_address, null);
        dialog.setContentView(view);
        if (dialog.getWindow() != null) {
            dialog.getWindow().setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        }

        TextView tvTitle = view.findViewById(R.id.tv_dialog_addr_title);
        RadioGroup rgType = view.findViewById(R.id.rg_addr_type);
        RadioButton rbHome = view.findViewById(R.id.rb_home);
        RadioButton rbWork = view.findViewById(R.id.rb_work);
        RadioButton rbOther = view.findViewById(R.id.rb_other);

        EditText etLabel = view.findViewById(R.id.et_addr_label);
        EditText etLine1 = view.findViewById(R.id.et_addr_line1);
        EditText etLine2 = view.findViewById(R.id.et_addr_line2);
        EditText etLandmark = view.findViewById(R.id.et_addr_landmark);
        EditText etCity = view.findViewById(R.id.et_addr_city);
        EditText etState = view.findViewById(R.id.et_addr_state);
        EditText etPincode = view.findViewById(R.id.et_addr_pincode);
        MaterialSwitch switchDefault = view.findViewById(R.id.switch_addr_default);

        if (existing != null) {
            if (tvTitle != null) tvTitle.setText("Edit Delivery Address");
            String type = (String) existing.get("type");
            if ("home".equalsIgnoreCase(type) && rbHome != null) rbHome.setChecked(true);
            else if ("work".equalsIgnoreCase(type) && rbWork != null) rbWork.setChecked(true);
            else if (rbOther != null) rbOther.setChecked(true);

            if (existing.get("label") != null && etLabel != null) etLabel.setText(String.valueOf(existing.get("label")));
            String st = existing.get("street") != null ? String.valueOf(existing.get("street")) :
                    (existing.get("addressLine1") != null ? String.valueOf(existing.get("addressLine1")) : "");
            if (etLine1 != null) etLine1.setText(st);
            if (existing.get("addressLine2") != null && etLine2 != null) etLine2.setText(String.valueOf(existing.get("addressLine2")));
            if (existing.get("landmark") != null && etLandmark != null) etLandmark.setText(String.valueOf(existing.get("landmark")));
            if (existing.get("city") != null && etCity != null) etCity.setText(String.valueOf(existing.get("city")));
            if (existing.get("state") != null && etState != null) etState.setText(String.valueOf(existing.get("state")));
            if (existing.get("pincode") != null && etPincode != null) etPincode.setText(String.valueOf(existing.get("pincode")));
            if (switchDefault != null) switchDefault.setChecked(Boolean.TRUE.equals(existing.get("isDefault")));
        } else {
            if (tvTitle != null) tvTitle.setText("Add Delivery Address");
            if (this.etCity.getText() != null && etCity != null && etCity.getText().toString().isEmpty()) {
                etCity.setText(this.etCity.getText().toString().trim());
            }
            if (this.etPincode.getText() != null && etPincode != null && etPincode.getText().toString().isEmpty()) {
                etPincode.setText(this.etPincode.getText().toString().trim());
            }
        }

        View btnClose = view.findViewById(R.id.btn_dialog_close);
        if (btnClose != null) btnClose.setOnClickListener(v -> dialog.dismiss());
        view.findViewById(R.id.btn_dialog_cancel).setOnClickListener(v -> dialog.dismiss());
        view.findViewById(R.id.btn_dialog_save).setOnClickListener(v -> {
            String line1 = etLine1 != null ? etLine1.getText().toString().trim() : "";
            String city = etCity != null ? etCity.getText().toString().trim() : "";
            String pincode = etPincode != null ? etPincode.getText().toString().trim() : "";

            if (TextUtils.isEmpty(line1)) {
                if (etLine1 != null) { etLine1.setError("Street / Flat is required"); etLine1.requestFocus(); }
                return;
            }
            if (TextUtils.isEmpty(city)) {
                if (etCity != null) { etCity.setError("City is required"); etCity.requestFocus(); }
                return;
            }
            if (TextUtils.isEmpty(pincode)) {
                if (etPincode != null) { etPincode.setError("Pincode is required"); etPincode.requestFocus(); }
                return;
            }

            String selectedType = "home";
            if (rbWork != null && rbWork.isChecked()) selectedType = "work";
            else if (rbOther != null && rbOther.isChecked()) selectedType = "other";

            String label = etLabel != null ? etLabel.getText().toString().trim() : "";
            if (TextUtils.isEmpty(label)) {
                label = selectedType.substring(0, 1).toUpperCase() + selectedType.substring(1);
            }

            boolean isDefault = switchDefault != null && switchDefault.isChecked();

            saveAddressToFirestore(existing, selectedType, label, line1,
                    etLine2 != null ? etLine2.getText().toString().trim() : "",
                    etLandmark != null ? etLandmark.getText().toString().trim() : "",
                    city,
                    etState != null ? etState.getText().toString().trim() : "",
                    pincode,
                    isDefault);

            dialog.dismiss();
        });

        dialog.show();
    }

    @SuppressWarnings("unchecked")
    private void saveAddressToFirestore(@Nullable Map<String, Object> existing,
                                        String type, String label, String street,
                                        String street2, String landmark, String city,
                                        String state, String pincode, boolean isDefault) {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) return;

        db.collection(Constants.COLLECTION_CUSTOMERS).document(user.getUid())
                .get()
                .addOnSuccessListener(doc -> {
                    List<Map<String, Object>> list = (List<Map<String, Object>>) doc.get("addresses");
                    if (list == null) list = new ArrayList<>();
                    else list = new ArrayList<>(list);

                    Map<String, Object> targetMap = null;
                    if (existing != null) {
                        for (Map<String, Object> item : list) {
                            if (isSameAddress(item, existing)) {
                                targetMap = item;
                                break;
                            }
                        }
                    }

                    if (targetMap == null) {
                        targetMap = new HashMap<>();
                        targetMap.put("id", UUID.randomUUID().toString());
                        list.add(targetMap);
                    }

                    targetMap.put("type", type);
                    targetMap.put("label", label);
                    targetMap.put("street", street);
                    targetMap.put("addressLine1", street);
                    targetMap.put("addressLine2", street2);
                    targetMap.put("landmark", landmark);
                    targetMap.put("city", city);
                    targetMap.put("state", state);
                    targetMap.put("pincode", pincode);

                    if (isDefault) {
                        for (Map<String, Object> item : list) {
                            item.put("isDefault", item == targetMap);
                        }
                        targetMap.put("isDefault", true);
                    } else {
                        targetMap.put("isDefault", false);
                    }

                    Map<String, Object> updates = new HashMap<>();
                    updates.put("addresses", list);
                    if (isDefault) {
                        updates.put("street", street);
                        updates.put("city", city);
                        updates.put("pincode", pincode);
                    }

                    db.collection(Constants.COLLECTION_CUSTOMERS).document(user.getUid())
                            .update(updates)
                            .addOnSuccessListener(aVoid -> {
                                Toast.makeText(this, "Address saved successfully! 📍", Toast.LENGTH_SHORT).show();
                                logBreadcrumb("Address updated in customer profile");
                                loadProfile();
                            })
                            .addOnFailureListener(e -> recordException("saveAddress_failed", e));
                })
                .addOnFailureListener(e -> recordException("fetchAddresses_failed", e));
    }

    @SuppressWarnings("unchecked")
    private void setAddressAsDefault(Map<String, Object> selectedMap) {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) return;

        db.collection(Constants.COLLECTION_CUSTOMERS).document(user.getUid())
                .get()
                .addOnSuccessListener(doc -> {
                    List<Map<String, Object>> list = (List<Map<String, Object>>) doc.get("addresses");
                    if (list == null) return;
                    list = new ArrayList<>(list);

                    String newStreet = null, newCity = null, newPincode = null;

                    for (Map<String, Object> item : list) {
                        boolean match = isSameAddress(item, selectedMap);
                        item.put("isDefault", match);
                        if (match) {
                            newStreet = (String) item.get("street");
                            newCity = (String) item.get("city");
                            newPincode = (String) item.get("pincode");
                        }
                    }

                    Map<String, Object> updates = new HashMap<>();
                    updates.put("addresses", list);
                    if (newStreet != null) updates.put("street", newStreet);
                    if (newCity != null) updates.put("city", newCity);
                    if (newPincode != null) updates.put("pincode", newPincode);

                    db.collection(Constants.COLLECTION_CUSTOMERS).document(user.getUid())
                            .update(updates)
                            .addOnSuccessListener(aVoid -> {
                                Toast.makeText(this, "Set as default delivery address! ⭐", Toast.LENGTH_SHORT).show();
                                loadProfile();
                            })
                            .addOnFailureListener(e -> recordException("setDefaultAddress_failed", e));
                });
    }

    private void confirmDeleteAddress(Map<String, Object> addrMap) {
        String street = (String) addrMap.get("street");
        String label = (String) addrMap.get("label");
        String name = !TextUtils.isEmpty(label) ? label : (street != null ? street : "this address");

        new MaterialAlertDialogBuilder(this)
                .setTitle("Delete Address")
                .setMessage("Remove \"" + name + "\" from your saved addresses?")
                .setPositiveButton("Delete", (d, w) -> deleteAddress(addrMap))
                .setNegativeButton("Cancel", null)
                .show();
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

    private boolean isSameAddress(Map<String, Object> a, Map<String, Object> b) {
        if (a == null || b == null) return false;
        Object idA = a.get("id");
        Object idB = b.get("id");
        if (idA != null && idB != null) return idA.equals(idB);

        // Fallback to match street and pincode
        Object stA = a.get("street");
        Object stB = b.get("street");
        Object pinA = a.get("pincode");
        Object pinB = b.get("pincode");
        return (stA != null && stA.equals(stB)) && (pinA != null && pinA.equals(pinB));
    }

    // ──────────────────────────────────────────────────────────────────
    // Profile Photo Management (Camera + Photo Library + Remove)
    // ──────────────────────────────────────────────────────────────────

    private void showPhotoSourceDialog() {
        BottomSheetDialog dialog = new BottomSheetDialog(this, R.style.ThemeOverlay_AKR_BottomSheetDialog_Rounded);
        View sheet = LayoutInflater.from(this).inflate(R.layout.dialog_photo_source, null);
        dialog.setContentView(sheet);

        sheet.findViewById(R.id.option_take_photo).setOnClickListener(v -> {
            dialog.dismiss();
            openCameraWithPermission();
        });

        sheet.findViewById(R.id.option_pick_gallery).setOnClickListener(v -> {
            dialog.dismiss();
            openPhotoLibraryWithPermission();
        });

        View removeOpt = sheet.findViewById(R.id.option_remove_photo);
        View removeDiv = sheet.findViewById(R.id.divider_remove);

        boolean hasAvatar = currentAvatarUrl != null && !currentAvatarUrl.isEmpty();
        if (removeOpt != null) removeOpt.setVisibility(hasAvatar ? View.VISIBLE : View.GONE);
        if (removeDiv != null) removeDiv.setVisibility(hasAvatar ? View.VISIBLE : View.GONE);

        if (removeOpt != null) {
            removeOpt.setOnClickListener(v -> {
                dialog.dismiss();
                confirmRemoveAvatar();
            });
        }

        sheet.findViewById(R.id.btn_cancel_photo_dialog).setOnClickListener(v -> dialog.dismiss());
        dialog.show();
    }

    private void openPhotoLibraryWithPermission() {
        requireStorage(
            () -> imagePickerLauncher.launch("image/*"),
            (isPermanent) -> {
                if (isPermanent) showSettingsSnackbar();
            }
        );
    }

    private void openCameraWithPermission() {
        requireCamera(
            this::launchCameraCapture,
            (isPermanent) -> {
                if (isPermanent) showSettingsSnackbar();
            }
        );
    }

    private void launchCameraCapture() {
        try {
            File photoFile = new File(getCacheDir(), "avatar_" + System.currentTimeMillis() + ".jpg");
            cameraImageUri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", photoFile);
            takePictureLauncher.launch(cameraImageUri);
        } catch (Exception e) {
            recordException("launchCamera_failed", e);
            Toast.makeText(this, "Failed to start camera: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    private void confirmRemoveAvatar() {
        new MaterialAlertDialogBuilder(this)
                .setTitle("Remove Profile Photo")
                .setMessage("Are you sure you want to remove your profile photo and reset to default?")
                .setPositiveButton("Remove", (d, w) -> removeAvatar())
                .setNegativeButton("Cancel", null)
                .show();
    }

    private void removeAvatar() {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) return;

        if (progressAvatar != null) progressAvatar.setVisibility(View.VISIBLE);

        Map<String, Object> update = new HashMap<>();
        update.put("avatar", FieldValue.delete());

        db.collection(Constants.COLLECTION_CUSTOMERS).document(user.getUid())
                .update(update)
                .addOnSuccessListener(aVoid -> {
                    if (progressAvatar != null) progressAvatar.setVisibility(View.GONE);
                    currentAvatarUrl = null;
                    if (ivAvatar != null) ivAvatar.setImageResource(R.drawable.ic_profile);
                    Toast.makeText(this, "Profile photo removed", Toast.LENGTH_SHORT).show();
                })
                .addOnFailureListener(e -> {
                    if (progressAvatar != null) progressAvatar.setVisibility(View.GONE);
                    recordException("removeAvatar_failed", e);
                    Toast.makeText(this, "Failed to remove photo", Toast.LENGTH_SHORT).show();
                });
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
                                    currentAvatarUrl = imageUrl;
                                    if (ivAvatar != null) {
                                        Glide.with(EditProfileActivity.this).load(imageUrl).into(ivAvatar);
                                    }
                                    logBreadcrumb("Avatar updated successfully: " + imageUrl);
                                    Toast.makeText(EditProfileActivity.this, "Profile photo updated! 📸", Toast.LENGTH_SHORT).show();
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

    // ──────────────────────────────────────────────────────────────────
    // Save Profile & Unsaved Changes Check
    // ──────────────────────────────────────────────────────────────────

    private void saveProfile() {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) return;

        String name = etName.getText() != null ? etName.getText().toString().trim() : "";
        if (TextUtils.isEmpty(name)) {
            etName.setError("Full name is required");
            etName.requestFocus();
            return;
        }

        Map<String, Object> updates = new HashMap<>();
        updates.put("name", name);
        updates.put("phone", etPhone.getText() != null ? etPhone.getText().toString().trim() : "");
        updates.put("street", etStreet.getText() != null ? etStreet.getText().toString().trim() : "");
        updates.put("city", etCity.getText() != null ? etCity.getText().toString().trim() : "");
        updates.put("pincode", etPincode.getText() != null ? etPincode.getText().toString().trim() : "");

        db.collection(Constants.COLLECTION_CUSTOMERS).document(user.getUid())
                .update(updates)
                .addOnSuccessListener(aVoid -> {
                    origName = name;
                    origPhone = etPhone.getText() != null ? etPhone.getText().toString().trim() : "";
                    origStreet = etStreet.getText() != null ? etStreet.getText().toString().trim() : "";
                    origCity = etCity.getText() != null ? etCity.getText().toString().trim() : "";
                    origPincode = etPincode.getText() != null ? etPincode.getText().toString().trim() : "";

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

    private boolean hasUnsavedChanges() {
        String currentName = etName.getText() != null ? etName.getText().toString().trim() : "";
        String currentPhone = etPhone.getText() != null ? etPhone.getText().toString().trim() : "";
        String currentStreet = etStreet.getText() != null ? etStreet.getText().toString().trim() : "";
        String currentCity = etCity.getText() != null ? etCity.getText().toString().trim() : "";
        String currentPincode = etPincode.getText() != null ? etPincode.getText().toString().trim() : "";

        return !currentName.equals(origName)
                || !currentPhone.equals(origPhone)
                || !currentStreet.equals(origStreet)
                || !currentCity.equals(origCity)
                || !currentPincode.equals(origPincode);
    }

    @Override
    public void onBackPressed() {
        if (hasUnsavedChanges()) {
            new MaterialAlertDialogBuilder(this)
                    .setTitle("Discard Changes?")
                    .setMessage("You have unsaved changes in your profile. Are you sure you want to discard them?")
                    .setPositiveButton("Discard", (dialog, which) -> super.onBackPressed())
                    .setNegativeButton("Keep Editing", null)
                    .show();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected String getScreenName() {
        return "EditProfile";
    }
}
