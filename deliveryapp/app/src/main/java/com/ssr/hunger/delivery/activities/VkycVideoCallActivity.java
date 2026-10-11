package com.ssr.hunger.delivery.activities;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;
import android.widget.ImageButton;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.FieldValue;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import com.ssr.hunger.delivery.R;
import com.ssr.hunger.delivery.utils.Constants;

import java.util.HashMap;
import java.util.Map;

public class VkycVideoCallActivity extends AppCompatActivity {

    private static final int PERMISSION_REQ_CODE = 101;

    private boolean isMuted = false;
    private boolean isVideoOff = false;

    private ImageButton btnMute, btnEndCall, btnVideo;
    private TextView tvAdminName;

    private ListenerRegistration callListener;
    private ListenerRegistration partnerListener;
    private String currentUid;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Make activity full screen
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN);
        // Keep screen on during call
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        setContentView(R.layout.activity_vkyc_video_call);

        initViews();
        checkPermissions();
        setupFirebaseCallSync();
    }

    private void initViews() {
        btnMute = findViewById(R.id.btn_mute);
        btnEndCall = findViewById(R.id.btn_end_call);
        btnVideo = findViewById(R.id.btn_video);
        tvAdminName = findViewById(R.id.tv_admin_name);

        String customAdminName = getIntent().getStringExtra("adminName");
        if (customAdminName != null && !customAdminName.isEmpty()) {
            tvAdminName.setText(customAdminName + " (Connecting...)");
        } else {
            tvAdminName.setText("Hunger Admin Desk (Connecting...)");
        }

        btnMute.setOnClickListener(v -> toggleMute());
        btnVideo.setOnClickListener(v -> toggleVideo());
        btnEndCall.setOnClickListener(v -> endCall());
    }

    private void setupFirebaseCallSync() {
        FirebaseAuth auth = FirebaseAuth.getInstance();
        if (auth.getCurrentUser() == null) return;
        currentUid = auth.getCurrentUser().getUid();

        FirebaseFirestore db = FirebaseFirestore.getInstance();

        // Mark caller status as connected in Firestore
        Map<String, Object> update = new HashMap<>();
        update.put("status", "connected");
        update.put("riderConnected", true);
        update.put("updatedAt", FieldValue.serverTimestamp());

        db.collection("kycVideoCalls").document(currentUid)
                .update(update)
                .addOnSuccessListener(aVoid -> {
                    tvAdminName.setText("Hunger Admin Desk (Connected Live)");
                })
                .addOnFailureListener(e -> {
                    // Non-fatal, status may be updated by admin
                    tvAdminName.setText("Hunger Admin Desk (Connected Live)");
                });

        // Listen for live call completion or termination from Admin
        callListener = db.collection("kycVideoCalls").document(currentUid)
                .addSnapshotListener((snapshot, error) -> {
                    if (error != null || snapshot == null || !snapshot.exists()) return;

                    String status = snapshot.getString("status");
                    Boolean vkycCompleted = snapshot.getBoolean("vkycCompleted");

                    if ("completed".equalsIgnoreCase(status) || Boolean.TRUE.equals(vkycCompleted)) {
                        Toast.makeText(this, "🎉 V-KYC Approved & Completed Successfully!", Toast.LENGTH_LONG).show();
                        finish();
                        return;
                    }

                    if ("ended".equalsIgnoreCase(status) || "cancelled".equalsIgnoreCase(status)) {
                        Toast.makeText(this, "Call Ended by Admin Desk", Toast.LENGTH_SHORT).show();
                        finish();
                        return;
                    }

                    if ("connected".equalsIgnoreCase(status)) {
                        tvAdminName.setText("Hunger Admin Desk (Connected Live)");
                    }
                });

        // Secondary check: If partner's profile KYC is approved, finish automatically
        partnerListener = db.collection(Constants.COLLECTION_DELIVERY_PERSONS).document(currentUid)
                .addSnapshotListener((snapshot, error) -> {
                    if (error != null || snapshot == null || !snapshot.exists()) return;
                    String kycStatus = snapshot.getString("kycStatus");
                    String verificationStatus = snapshot.getString("verificationStatus");
                    if ("approved".equalsIgnoreCase(kycStatus) || "approved".equalsIgnoreCase(verificationStatus)) {
                        Toast.makeText(this, "🎉 V-KYC Verified & Profile Approved!", Toast.LENGTH_SHORT).show();
                        finish();
                    }
                });
    }

    private void checkPermissions() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            
            ActivityCompat.requestPermissions(this,
                    new String[]{Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO},
                    PERMISSION_REQ_CODE);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQ_CODE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                Toast.makeText(this, "Camera & Mic permissions granted", Toast.LENGTH_SHORT).show();
            } else {
                Toast.makeText(this, "Permissions are required for V-KYC", Toast.LENGTH_LONG).show();
                finish();
            }
        }
    }

    private void toggleMute() {
        isMuted = !isMuted;
        if (isMuted) {
            btnMute.setBackgroundTintList(android.content.res.ColorStateList.valueOf(getResources().getColor(R.color.error)));
            Toast.makeText(this, "Microphone muted", Toast.LENGTH_SHORT).show();
        } else {
            btnMute.setBackgroundTintList(android.content.res.ColorStateList.valueOf(0x40FFFFFF));
            Toast.makeText(this, "Microphone enabled", Toast.LENGTH_SHORT).show();
        }
    }

    private void toggleVideo() {
        isVideoOff = !isVideoOff;
        if (isVideoOff) {
            btnVideo.setBackgroundTintList(android.content.res.ColorStateList.valueOf(getResources().getColor(R.color.error)));
            Toast.makeText(this, "Camera paused", Toast.LENGTH_SHORT).show();
        } else {
            btnVideo.setBackgroundTintList(android.content.res.ColorStateList.valueOf(0x40FFFFFF));
            Toast.makeText(this, "Camera resumed", Toast.LENGTH_SHORT).show();
        }
    }

    private void endCall() {
        if (currentUid != null) {
            FirebaseFirestore.getInstance().collection("kycVideoCalls").document(currentUid)
                    .update("status", "ended")
                    .addOnCompleteListener(task -> finish());
        } else {
            finish();
        }
        Toast.makeText(this, "Call Ended", Toast.LENGTH_SHORT).show();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (callListener != null) {
            callListener.remove();
            callListener = null;
        }
        if (partnerListener != null) {
            partnerListener.remove();
            partnerListener = null;
        }
    }
}
