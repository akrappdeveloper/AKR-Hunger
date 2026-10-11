package com.ssr.hunger.delivery.dialogs;

import android.app.Dialog;
import android.content.Context;
import android.os.Bundle;
import android.view.Window;
import android.widget.EditText;
import android.widget.Toast;

import androidx.annotation.NonNull;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.chip.Chip;
import com.google.android.material.chip.ChipGroup;
import com.google.android.material.materialswitch.MaterialSwitch;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import com.google.firebase.firestore.SetOptions;
import com.ssr.hunger.delivery.R;
import com.ssr.hunger.delivery.utils.Constants;
import com.ssr.hunger.delivery.models.DeliveryPartner;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class PincodeManagerDialog extends Dialog {

    private FirebaseAuth auth;
    private FirebaseFirestore db;
    private ListenerRegistration dbListener;

    private List<String> currentPincodes = new ArrayList<>();
    private boolean filterActive = false;

    private ChipGroup chipGroup;
    private MaterialSwitch switchFilter;

    public PincodeManagerDialog(@NonNull Context context) {
        super(context);
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        setContentView(R.layout.dialog_pincode_manager);

        if (getWindow() != null) {
            getWindow().setBackgroundDrawableResource(android.R.color.transparent);
            int width = (int)(getContext().getResources().getDisplayMetrics().widthPixels * 0.95);
            getWindow().setLayout(width, android.view.ViewGroup.LayoutParams.WRAP_CONTENT);
        }

        auth = FirebaseAuth.getInstance();
        db = FirebaseFirestore.getInstance();

        switchFilter = findViewById(R.id.switch_pincode_filter);
        EditText etPincode = findViewById(R.id.et_pincode_input);
        MaterialButton btnAdd = findViewById(R.id.btn_add_pincode);
        chipGroup = findViewById(R.id.chip_group_pincodes);
        MaterialButton btnClose = findViewById(R.id.btn_close_pincodes);

        switchFilter.setOnCheckedChangeListener((buttonView, isChecked) -> {
            if (isChecked != filterActive) {
                updateFirebase(currentPincodes, isChecked);
            }
        });

        btnAdd.setOnClickListener(v -> {
            String code = etPincode.getText().toString().trim();
            if (code.length() != 6) {
                Toast.makeText(getContext(), "Enter a valid 6-digit pincode", Toast.LENGTH_SHORT).show();
                return;
            }
            if (currentPincodes.contains(code)) {
                Toast.makeText(getContext(), "Pincode already added", Toast.LENGTH_SHORT).show();
                return;
            }
            if (currentPincodes.size() >= 10) {
                Toast.makeText(getContext(), "Maximum 10 pincodes allowed", Toast.LENGTH_SHORT).show();
                return;
            }

            List<String> updated = new ArrayList<>(currentPincodes);
            updated.add(code);
            etPincode.setText("");
            updateFirebase(updated, true);
        });

        btnClose.setOnClickListener(v -> dismiss());

        loadRealtimeData();
    }

    private void loadRealtimeData() {
        if (auth.getCurrentUser() == null) return;
        String uid = auth.getCurrentUser().getUid();

        dbListener = db.collection(Constants.COLLECTION_DELIVERY_PERSONS)
                .document(uid)
                .addSnapshotListener((snapshot, error) -> {
                    if (error != null || snapshot == null || !snapshot.exists()) return;
                    
                    DeliveryPartner partner = snapshot.toObject(DeliveryPartner.class);
                    if (partner != null) {
                        currentPincodes = partner.getServicePincodes();
                        if (currentPincodes == null) currentPincodes = new ArrayList<>();
                        
                        filterActive = partner.isPincodeFilterActive();
                        
                        switchFilter.setOnCheckedChangeListener(null);
                        switchFilter.setChecked(filterActive);
                        switchFilter.setOnCheckedChangeListener((buttonView, isChecked) -> {
                            if (isChecked != filterActive) {
                                updateFirebase(currentPincodes, isChecked);
                            }
                        });

                        refreshChips();
                    }
                });
    }

    private void updateFirebase(List<String> newPincodes, boolean newFilterActive) {
        if (auth.getCurrentUser() == null) return;
        String uid = auth.getCurrentUser().getUid();

        Map<String, Object> update = new HashMap<>();
        update.put("servicePincodes", newPincodes);
        update.put("pincodeFilterActive", newFilterActive);

        db.collection(Constants.COLLECTION_DELIVERY_PERSONS)
                .document(uid)
                .set(update, SetOptions.merge());
    }

    private void refreshChips() {
        if (chipGroup == null) return;
        chipGroup.removeAllViews();

        for (String pin : currentPincodes) {
            Chip chip = new Chip(getContext());
            chip.setText(pin);
            chip.setCloseIconVisible(true);
            chip.setOnCloseIconClickListener(v -> {
                List<String> updated = new ArrayList<>(currentPincodes);
                updated.remove(pin);
                updateFirebase(updated, filterActive);
            });
            chipGroup.addView(chip);
        }
    }

    @Override
    public void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        if (dbListener != null) {
            dbListener.remove();
        }
    }
}
