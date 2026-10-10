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

import com.ssr.hunger.delivery.R;

public class VkycVideoCallActivity extends AppCompatActivity {

    private static final int PERMISSION_REQ_CODE = 101;

    private boolean isMuted = false;
    private boolean isVideoOff = false;

    private ImageButton btnMute, btnEndCall, btnVideo;
    private TextView tvAdminName;

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
    }

    private void initViews() {
        btnMute = findViewById(R.id.btn_mute);
        btnEndCall = findViewById(R.id.btn_end_call);
        btnVideo = findViewById(R.id.btn_video);
        tvAdminName = findViewById(R.id.tv_admin_name);

        btnMute.setOnClickListener(v -> toggleMute());
        btnVideo.setOnClickListener(v -> toggleVideo());
        btnEndCall.setOnClickListener(v -> endCall());

        // Simulate connecting to WebRTC signaling server
        tvAdminName.postDelayed(() -> {
            tvAdminName.setText("Hunger Admin (Connected)");
            Toast.makeText(this, "WebRTC P2P Connection Established", Toast.LENGTH_SHORT).show();
        }, 3000);
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
            btnMute.setBackgroundTintList(android.content.res.ColorStateList.valueOf(0x40FFFFFF)); // #40FFFFFF
            Toast.makeText(this, "Microphone enabled", Toast.LENGTH_SHORT).show();
        }
    }

    private void toggleVideo() {
        isVideoOff = !isVideoOff;
        if (isVideoOff) {
            btnVideo.setBackgroundTintList(android.content.res.ColorStateList.valueOf(getResources().getColor(R.color.error)));
            Toast.makeText(this, "Camera paused", Toast.LENGTH_SHORT).show();
        } else {
            btnVideo.setBackgroundTintList(android.content.res.ColorStateList.valueOf(0x40FFFFFF)); // #40FFFFFF
            Toast.makeText(this, "Camera resumed", Toast.LENGTH_SHORT).show();
        }
    }

    private void endCall() {
        Toast.makeText(this, "Call Ended", Toast.LENGTH_SHORT).show();
        finish();
    }
}
