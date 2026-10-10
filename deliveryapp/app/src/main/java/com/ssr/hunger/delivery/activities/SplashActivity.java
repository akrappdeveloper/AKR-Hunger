package com.ssr.hunger.delivery.activities;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

import androidx.appcompat.app.AppCompatActivity;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.FirebaseFirestore;
import com.ssr.hunger.delivery.R;
import com.ssr.hunger.delivery.utils.Constants;

public class SplashActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_splash);

        new Handler(Looper.getMainLooper()).postDelayed(this::checkAuthAndRoute, 1200);
    }

    private void checkAuthAndRoute() {
        FirebaseAuth auth = FirebaseAuth.getInstance();
        if (auth.getCurrentUser() != null) {
            String uid = auth.getCurrentUser().getUid();
            FirebaseFirestore.getInstance()
                    .collection(Constants.COLLECTION_DELIVERY_PERSONS)
                    .document(uid)
                    .get()
                    .addOnSuccessListener(snap -> {
                        if (snap.exists()) {
                            String verificationStatus = snap.getString("verificationStatus");
                            String kycStatus = snap.getString("kycStatus");
                            Boolean isVerified = snap.getBoolean("isVerified");
                            String status = verificationStatus != null ? verificationStatus : (kycStatus != null ? kycStatus : "pending");

                            if ("pending".equalsIgnoreCase(status) && (isVerified == null || !isVerified)) {
                                auth.signOut();
                                startActivity(new Intent(SplashActivity.this, LoginActivity.class));
                            } else if ("rejected".equalsIgnoreCase(status)) {
                                auth.signOut();
                                startActivity(new Intent(SplashActivity.this, LoginActivity.class));
                            } else {
                                startActivity(new Intent(SplashActivity.this, MainActivity.class));
                            }
                        } else {
                            // Document does not exist in deliveryPersons
                            auth.signOut();
                            startActivity(new Intent(SplashActivity.this, LoginActivity.class));
                        }
                        finish();
                    })
                    .addOnFailureListener(e -> {
                        startActivity(new Intent(SplashActivity.this, MainActivity.class));
                        finish();
                    });
        } else {
            startActivity(new Intent(SplashActivity.this, LoginActivity.class));
            finish();
        }
    }
}
