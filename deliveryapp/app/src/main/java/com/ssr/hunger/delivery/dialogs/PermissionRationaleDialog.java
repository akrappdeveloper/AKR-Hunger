package com.ssr.hunger.delivery.dialogs;

import android.app.Activity;
import android.app.Dialog;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;

import androidx.annotation.NonNull;

import com.google.android.material.button.MaterialButton;
import com.ssr.hunger.delivery.R;
import com.ssr.hunger.delivery.utils.PermissionManager;

/**
 * Modern permission rationale dialog presenting clear explanations
 * of why GPS location, notifications, camera, and phone permissions are required.
 */
public class PermissionRationaleDialog extends Dialog {

    public interface OnPermissionGrantedCallback {
        void onProceed();
    }

    private final Activity activity;
    private final OnPermissionGrantedCallback callback;

    public PermissionRationaleDialog(@NonNull Activity activity, OnPermissionGrantedCallback callback) {
        super(activity);
        this.activity = activity;
        this.callback = callback;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        setContentView(R.layout.dialog_permission_rationale);

        if (getWindow() != null) {
            getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            getWindow().setLayout(
                    (int) (activity.getResources().getDisplayMetrics().widthPixels * 0.92),
                    WindowManager.LayoutParams.WRAP_CONTENT
            );
        }

        MaterialButton btnGrant = findViewById(R.id.btn_grant_permissions);
        MaterialButton btnSettings = findViewById(R.id.btn_open_settings);

        btnGrant.setOnClickListener(v -> {
            dismiss();
            PermissionManager.requestAllMissingPermissions(activity, PermissionManager.PERMISSION_REQUEST_ALL);
            if (callback != null) callback.onProceed();
        });

        btnSettings.setOnClickListener(v -> {
            dismiss();
            PermissionManager.openAppSettings(activity);
        });
    }
}
