package com.ssr.hunger.delivery.activities;

import android.content.SharedPreferences;
import android.os.Bundle;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.materialswitch.MaterialSwitch;
import com.google.android.material.textfield.TextInputEditText;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.SetOptions;
import com.ssr.hunger.delivery.R;
import com.ssr.hunger.delivery.dialogs.BankDetailsDialog;
import com.ssr.hunger.delivery.models.DeliveryPartner;
import com.ssr.hunger.delivery.utils.Constants;

import java.util.HashMap;
import java.util.Map;

public class SettingsActivity extends AppCompatActivity {

    private FirebaseAuth auth;
    private FirebaseFirestore db;

    private TextInputEditText etName, etPhone, etVehicle, etVehicleNumber;
    private MaterialSwitch switchSound, switchVibrate;
    private MaterialButton btnSave;
    private Map<String, Object> bankDetailsMap = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_settings);

        auth = FirebaseAuth.getInstance();
        db = FirebaseFirestore.getInstance();

        Toolbar toolbar = findViewById(R.id.toolbar_settings);
        setSupportActionBar(toolbar);
        if (getSupportActionBar() != null) getSupportActionBar().setDisplayHomeAsUpEnabled(true);
        toolbar.setNavigationOnClickListener(v -> finish());

        etName = findViewById(R.id.et_settings_name);
        etPhone = findViewById(R.id.et_settings_phone);
        etVehicle = findViewById(R.id.et_settings_vehicle);
        etVehicleNumber = findViewById(R.id.et_settings_vehicle_number);

        switchSound = findViewById(R.id.switch_sound_alerts);
        switchVibrate = findViewById(R.id.switch_vibrate);

        btnSave = findViewById(R.id.btn_save_settings);

        findViewById(R.id.card_settings_bank).setOnClickListener(v -> {
            BankDetailsDialog dialog = new BankDetailsDialog(this, bankDetailsMap);
            dialog.show();
        });

        loadSettings();

        btnSave.setOnClickListener(v -> saveSettings());
    }

    private void loadSettings() {
        if (auth.getCurrentUser() == null) return;
        String uid = auth.getCurrentUser().getUid();

        db.collection(Constants.COLLECTION_DELIVERY_PERSONS)
                .document(uid)
                .get()
                .addOnSuccessListener(snap -> {
                    if (snap.exists()) {
                        DeliveryPartner partner = snap.toObject(DeliveryPartner.class);
                        if (partner != null) {
                            etName.setText(partner.getName());
                            etPhone.setText(partner.getPhone());
                            etVehicle.setText(partner.getVehicleType());
                            etVehicleNumber.setText(partner.getVehicleNumber());
                        }
                        bankDetailsMap = (Map<String, Object>) snap.get("bankDetails");
                    }
                });

        SharedPreferences prefs = getSharedPreferences(Constants.PREFS_NAME, MODE_PRIVATE);
        switchSound.setChecked(prefs.getBoolean("pref_sound", true));
        switchVibrate.setChecked(prefs.getBoolean("pref_vibrate", true));
    }

    private void saveSettings() {
        if (auth.getCurrentUser() == null) return;
        String uid = auth.getCurrentUser().getUid();

        String name = etName.getText() != null ? etName.getText().toString().trim() : "";
        String phone = etPhone.getText() != null ? etPhone.getText().toString().trim() : "";
        String vehicle = etVehicle.getText() != null ? etVehicle.getText().toString().trim() : "";
        String vehicleNo = etVehicleNumber.getText() != null ? etVehicleNumber.getText().toString().trim() : "";

        Map<String, Object> update = new HashMap<>();
        update.put("name", name);
        update.put("phone", phone);
        update.put("vehicleType", vehicle);
        update.put("vehicleNumber", vehicleNo);

        db.collection(Constants.COLLECTION_DELIVERY_PERSONS)
                .document(uid)
                .set(update, SetOptions.merge())
                .addOnSuccessListener(v -> {
                    SharedPreferences.Editor editor = getSharedPreferences(Constants.PREFS_NAME, MODE_PRIVATE).edit();
                    editor.putBoolean("pref_sound", switchSound.isChecked());
                    editor.putBoolean("pref_vibrate", switchVibrate.isChecked());
                    editor.apply();

                    Toast.makeText(this, "Settings updated successfully!", Toast.LENGTH_SHORT).show();
                    finish();
                })
                .addOnFailureListener(e -> Toast.makeText(this, "Failed: " + e.getMessage(), Toast.LENGTH_SHORT).show());
    }
}
