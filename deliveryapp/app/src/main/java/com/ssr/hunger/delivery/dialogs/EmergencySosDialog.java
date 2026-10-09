package com.ssr.hunger.delivery.dialogs;

import android.app.Dialog;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.Window;

import androidx.annotation.NonNull;

import com.google.android.material.button.MaterialButton;
import com.ssr.hunger.delivery.R;

public class EmergencySosDialog extends Dialog {

    public EmergencySosDialog(@NonNull Context context) {
        super(context);
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        setContentView(R.layout.dialog_emergency_sos);

        if (getWindow() != null) {
            getWindow().setBackgroundDrawableResource(android.R.color.transparent);
        }

        MaterialButton btnPolice = findViewById(R.id.btn_sos_police);
        MaterialButton btnAmbulance = findViewById(R.id.btn_sos_ambulance);
        MaterialButton btnHelpline = findViewById(R.id.btn_sos_helpline);
        MaterialButton btnClose = findViewById(R.id.btn_close_sos);

        btnPolice.setOnClickListener(v -> dial("112"));
        btnAmbulance.setOnClickListener(v -> dial("108"));
        btnHelpline.setOnClickListener(v -> dial("18001234567"));
        btnClose.setOnClickListener(v -> dismiss());
    }

    private void dial(String number) {
        Intent intent = new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + number));
        getContext().startActivity(intent);
        dismiss();
    }
}
