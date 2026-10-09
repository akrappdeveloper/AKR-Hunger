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
import com.ssr.hunger.delivery.R;

import java.util.ArrayList;
import java.util.List;

public class PincodeManagerDialog extends Dialog {

    public interface OnPincodesUpdatedListener {
        void onUpdated(List<String> pincodes, boolean filterActive);
    }

    private final List<String> currentPincodes;
    private final boolean initialFilterActive;
    private final OnPincodesUpdatedListener listener;
    private ChipGroup chipGroup;
    private MaterialSwitch switchFilter;

    public PincodeManagerDialog(@NonNull Context context, List<String> pincodes, boolean filterActive, OnPincodesUpdatedListener listener) {
        super(context);
        this.currentPincodes = new ArrayList<>(pincodes != null ? pincodes : new ArrayList<>());
        this.initialFilterActive = filterActive;
        this.listener = listener;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        setContentView(R.layout.dialog_pincode_manager);

        if (getWindow() != null) {
            getWindow().setBackgroundDrawableResource(android.R.color.transparent);
        }

        switchFilter = findViewById(R.id.switch_pincode_filter);
        switchFilter.setChecked(initialFilterActive);

        EditText etPincode = findViewById(R.id.et_pincode_input);
        MaterialButton btnAdd = findViewById(R.id.btn_add_pincode);
        chipGroup = findViewById(R.id.chip_group_pincodes);
        MaterialButton btnClose = findViewById(R.id.btn_close_pincodes);

        refreshChips();

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

            currentPincodes.add(code);
            etPincode.setText("");
            switchFilter.setChecked(true);
            refreshChips();
        });

        btnClose.setOnClickListener(v -> {
            dismiss();
            if (listener != null) {
                listener.onUpdated(currentPincodes, switchFilter.isChecked());
            }
        });
    }

    private void refreshChips() {
        if (chipGroup == null) return;
        chipGroup.removeAllViews();

        for (String pin : currentPincodes) {
            Chip chip = new Chip(getContext());
            chip.setText(pin);
            chip.setCloseIconVisible(true);
            chip.setOnCloseIconClickListener(v -> {
                currentPincodes.remove(pin);
                refreshChips();
            });
            chipGroup.addView(chip);
        }
    }
}
