package com.ssr.hunger.activities;

import android.os.Bundle;
import android.text.TextUtils;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.RadioGroup;
import android.widget.TextView;
import android.widget.Toast;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import com.google.android.material.bottomsheet.BottomSheetDialog;
import com.google.android.material.dialog.MaterialAlertDialogBuilder;
import com.google.android.material.floatingactionbutton.FloatingActionButton;
import com.google.android.material.materialswitch.MaterialSwitch;
import com.ssr.hunger.R;
import com.ssr.hunger.dialogs.ModernDialogHelper;
import com.ssr.hunger.models.Address;
import com.ssr.hunger.utils.Constants;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import com.google.firebase.firestore.Query;
import com.google.firebase.Timestamp;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * AddressesActivity - mirrors the web app's /customer/addresses page.
 * Full CRUD for managing saved delivery addresses.
 * Extends BaseActivity for Analytics, Crashlytics, and Performance monitoring.
 */
public class AddressesActivity extends BaseActivity {

    private FirebaseFirestore db;
    private FirebaseAuth auth;
    private ListenerRegistration addressListener;
    private LinearLayout addressesContainer;
    private List<Map<String, Object>> addressList = new ArrayList<>();
    private List<String> addressIds = new ArrayList<>();
    private TextView tvEmpty;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_addresses);

        db = FirebaseFirestore.getInstance();
        auth = FirebaseAuth.getInstance();

        addressesContainer = findViewById(R.id.addresses_container);
        tvEmpty = findViewById(R.id.tv_empty);
        View cardEmptyState = findViewById(R.id.card_empty_state);
        View btnHeaderAdd = findViewById(R.id.btn_header_add);
        View btnEmptyAdd = findViewById(R.id.btn_empty_add);

        findViewById(R.id.btn_back).setOnClickListener(v -> finish());
        findViewById(R.id.fab_add_address).setOnClickListener(v -> showAddEditDialog(null, null));
        if (btnHeaderAdd != null) btnHeaderAdd.setOnClickListener(v -> showAddEditDialog(null, null));
        if (btnEmptyAdd != null) btnEmptyAdd.setOnClickListener(v -> showAddEditDialog(null, null));

        listenToAddresses();
        logBreadcrumb("AddressesActivity: Opened");
    }

    private void listenToAddresses() {
        String uid = auth.getCurrentUser() != null ? auth.getCurrentUser().getUid() : null;
        if (uid == null) { finish(); return; }

        addressListener = db.collection(Constants.COLLECTION_USERS)
                .document(uid)
                .collection("addresses")
                .orderBy("isDefault", Query.Direction.DESCENDING)
                .addSnapshotListener((snap, error) -> {
                    if (error != null) {
                        recordException("AddressesActivity_listen", error);
                        return;
                    }
                    addressList.clear();
                    addressIds.clear();
                    if (snap != null) {
                        for (com.google.firebase.firestore.DocumentSnapshot doc : snap.getDocuments()) {
                            addressList.add(doc.getData());
                            addressIds.add(doc.getId());
                        }
                    }
                    renderAddresses();
                });
    }

    private void renderAddresses() {
        addressesContainer.removeAllViews();
        View cardEmptyState = findViewById(R.id.card_empty_state);
        if (addressList.isEmpty()) {
            if (cardEmptyState != null) cardEmptyState.setVisibility(View.VISIBLE);
            if (tvEmpty != null) tvEmpty.setVisibility(View.VISIBLE);
            addressesContainer.setVisibility(View.GONE);
            return;
        }
        if (cardEmptyState != null) cardEmptyState.setVisibility(View.GONE);
        if (tvEmpty != null) tvEmpty.setVisibility(View.GONE);
        addressesContainer.setVisibility(View.VISIBLE);

        for (int i = 0; i < addressList.size(); i++) {
            Map<String, Object> addr = addressList.get(i);
            String addrId = addressIds.get(i);
            View card = LayoutInflater.from(this).inflate(R.layout.item_address_card, addressesContainer, false);

            String type = addr.get("type") != null ? addr.get("type").toString() : "other";
            String label = addr.get("label") != null ? addr.get("label").toString() : type;
            String line1 = addr.get("addressLine1") != null ? addr.get("addressLine1").toString() : "";
            String city = addr.get("city") != null ? addr.get("city").toString() : "";
            String state = addr.get("state") != null ? addr.get("state").toString() : "";
            String pincode = addr.get("pincode") != null ? addr.get("pincode").toString() : "";
            Boolean isDefault = addr.get("isDefault") instanceof Boolean && (Boolean) addr.get("isDefault");

            ((TextView) card.findViewById(R.id.tv_addr_label)).setText(label);
            ((TextView) card.findViewById(R.id.tv_addr_line)).setText(line1);
            ((TextView) card.findViewById(R.id.tv_addr_city)).setText(city + ", " + state + " - " + pincode);

            TextView tvTypeEmoji = card.findViewById(R.id.tv_type_emoji);
            if (tvTypeEmoji != null) {
                if ("home".equalsIgnoreCase(type)) tvTypeEmoji.setText("🏠");
                else if ("work".equalsIgnoreCase(type)) tvTypeEmoji.setText("💼");
                else tvTypeEmoji.setText("📍");
            }

            View badgeDefault = card.findViewById(R.id.badge_default);
            if (badgeDefault != null) badgeDefault.setVisibility(isDefault ? View.VISIBLE : View.GONE);

            // Highlight default card with primary stroke
            if (card instanceof com.google.android.material.card.MaterialCardView) {
                com.google.android.material.card.MaterialCardView mCard = (com.google.android.material.card.MaterialCardView) card;
                if (isDefault) {
                    mCard.setStrokeColor(getResources().getColor(R.color.primary, getTheme()));
                    mCard.setStrokeWidth((int) (1.5f * getResources().getDisplayMetrics().density));
                }
            }

            card.findViewById(R.id.btn_edit).setOnClickListener(v -> showAddEditDialog(addr, addrId));
            card.findViewById(R.id.btn_delete).setOnClickListener(v -> confirmDelete(addrId, label));
            if (!isDefault) {
                card.findViewById(R.id.btn_set_default).setOnClickListener(v -> setAsDefault(addrId));
            } else {
                View btnDefault = card.findViewById(R.id.btn_set_default);
                if (btnDefault != null) btnDefault.setVisibility(View.GONE);
            }

            addressesContainer.addView(card);
        }
    }

    private void showAddEditDialog(Map<String, Object> existing, String addrId) {
        BottomSheetDialog dialog = new BottomSheetDialog(this, R.style.ThemeOverlay_AKR_BottomSheetDialog_Rounded);
        View dialogView = LayoutInflater.from(this).inflate(R.layout.dialog_add_address, null);
        dialog.setContentView(dialogView);
        if (dialog.getWindow() != null) {
            dialog.getWindow().setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        }

        TextView tvTitle = dialogView.findViewById(R.id.tv_dialog_addr_title);
        EditText etLabel = dialogView.findViewById(R.id.et_addr_label);
        EditText etLine1 = dialogView.findViewById(R.id.et_addr_line1);
        EditText etLine2 = dialogView.findViewById(R.id.et_addr_line2);
        EditText etLandmark = dialogView.findViewById(R.id.et_addr_landmark);
        EditText etCity = dialogView.findViewById(R.id.et_addr_city);
        EditText etState = dialogView.findViewById(R.id.et_addr_state);
        EditText etPincode = dialogView.findViewById(R.id.et_addr_pincode);
        RadioGroup rgType = dialogView.findViewById(R.id.rg_addr_type);
        MaterialSwitch switchDefault = dialogView.findViewById(R.id.switch_addr_default);

        // Pre-fill if editing
        if (existing != null) {
            if (tvTitle != null) tvTitle.setText("Edit Address");
            if (etLabel != null && existing.get("label") != null) etLabel.setText(existing.get("label").toString());
            if (etLine1 != null && existing.get("addressLine1") != null) etLine1.setText(existing.get("addressLine1").toString());
            if (etLine2 != null && existing.get("addressLine2") != null) etLine2.setText(existing.get("addressLine2").toString());
            if (etLandmark != null && existing.get("landmark") != null) etLandmark.setText(existing.get("landmark").toString());
            if (etCity != null && existing.get("city") != null) etCity.setText(existing.get("city").toString());
            if (etState != null && existing.get("state") != null) etState.setText(existing.get("state").toString());
            if (etPincode != null && existing.get("pincode") != null) etPincode.setText(existing.get("pincode").toString());
            if (switchDefault != null) switchDefault.setChecked(Boolean.TRUE.equals(existing.get("isDefault")));

            String type = (String) existing.get("type");
            if (rgType != null && type != null) {
                if ("home".equalsIgnoreCase(type)) rgType.check(R.id.rb_home);
                else if ("work".equalsIgnoreCase(type)) rgType.check(R.id.rb_work);
                else rgType.check(R.id.rb_other);
            }
        } else {
            if (tvTitle != null) tvTitle.setText("Add New Address");
        }

        View btnClose = dialogView.findViewById(R.id.btn_dialog_close);
        if (btnClose != null) btnClose.setOnClickListener(v -> dialog.dismiss());
        dialogView.findViewById(R.id.btn_dialog_cancel).setOnClickListener(v -> dialog.dismiss());
        dialogView.findViewById(R.id.btn_dialog_save).setOnClickListener(v -> {
            String line1Val = etLine1 != null ? etLine1.getText().toString().trim() : "";
            String cityVal = etCity != null ? etCity.getText().toString().trim() : "";
            String stateVal = etState != null ? etState.getText().toString().trim() : "";
            String pincodeVal = etPincode != null ? etPincode.getText().toString().trim() : "";

            if (TextUtils.isEmpty(line1Val)) {
                if (etLine1 != null) { etLine1.setError("House / Flat No is required"); etLine1.requestFocus(); }
                return;
            }
            if (TextUtils.isEmpty(cityVal)) {
                if (etCity != null) { etCity.setError("City is required"); etCity.requestFocus(); }
                return;
            }
            if (TextUtils.isEmpty(pincodeVal)) {
                if (etPincode != null) { etPincode.setError("Pincode is required"); etPincode.requestFocus(); }
                return;
            }

            String type = "other";
            if (rgType != null) {
                int checkedId = rgType.getCheckedRadioButtonId();
                if (checkedId == R.id.rb_home) type = "home";
                else if (checkedId == R.id.rb_work) type = "work";
            }

            boolean isDefault = switchDefault != null ? switchDefault.isChecked() :
                    (existing != null && Boolean.TRUE.equals(existing.get("isDefault")));

            Map<String, Object> data = new HashMap<>();
            data.put("label", etLabel != null && !TextUtils.isEmpty(etLabel.getText()) ? etLabel.getText().toString().trim() : type);
            data.put("type", type);
            data.put("addressLine1", line1Val);
            data.put("addressLine2", etLine2 != null ? etLine2.getText().toString().trim() : "");
            data.put("landmark", etLandmark != null ? etLandmark.getText().toString().trim() : "");
            data.put("city", cityVal);
            data.put("state", stateVal);
            data.put("pincode", pincodeVal);
            data.put("isDefault", isDefault);
            data.put("updatedAt", Timestamp.now());

            String uid = auth.getCurrentUser().getUid();
            if (addrId != null) {
                db.collection(Constants.COLLECTION_USERS).document(uid)
                        .collection("addresses").document(addrId)
                        .update(data)
                        .addOnSuccessListener(a -> {
                            Toast.makeText(this, "✅ Address updated", Toast.LENGTH_SHORT).show();
                            logBreadcrumb("Address updated: " + addrId);
                            dialog.dismiss();
                        })
                        .addOnFailureListener(e -> { recordException("Address_update_fail", e); Toast.makeText(this, "Failed to update", Toast.LENGTH_SHORT).show(); });
            } else {
                data.put("createdAt", Timestamp.now());
                db.collection(Constants.COLLECTION_USERS).document(uid)
                        .collection("addresses")
                        .add(data)
                        .addOnSuccessListener(ref -> {
                            Toast.makeText(this, "📍 Address added!", Toast.LENGTH_SHORT).show();
                            logBreadcrumb("New address added");
                            dialog.dismiss();
                        })
                        .addOnFailureListener(e -> { recordException("Address_add_fail", e); Toast.makeText(this, "Failed to add address", Toast.LENGTH_SHORT).show(); });
            }
        });

        dialog.show();
    }

    private void confirmDelete(String addrId, String label) {
        ModernDialogHelper.showDangerDialog(
                this,
                "Remove Address",
                "Are you sure you want to remove \"" + label + "\" from your saved addresses?",
                "Remove",
                () -> {
                    String uid = auth.getCurrentUser().getUid();
                    db.collection(Constants.COLLECTION_USERS).document(uid)
                            .collection("addresses").document(addrId)
                            .delete()
                            .addOnSuccessListener(a -> {
                                Toast.makeText(this, "Address removed", Toast.LENGTH_SHORT).show();
                                logBreadcrumb("Address deleted: " + addrId);
                            })
                            .addOnFailureListener(e -> recordException("Address_delete_fail", e));
                }
        );
    }

    private void setAsDefault(String newDefaultId) {
        String uid = auth.getCurrentUser().getUid();
        // Unset all existing defaults
        for (int i = 0; i < addressIds.size(); i++) {
            Map<String, Object> update = new HashMap<>();
            update.put("isDefault", addressIds.get(i).equals(newDefaultId));
            db.collection(Constants.COLLECTION_USERS).document(uid)
                    .collection("addresses").document(addressIds.get(i))
                    .update(update);
        }
        Toast.makeText(this, "⭐ Default address updated", Toast.LENGTH_SHORT).show();
        logBreadcrumb("Default address set: " + newDefaultId);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (addressListener != null) addressListener.remove();
    }

    @Override
    protected String getScreenName() { return "Addresses"; }
}
