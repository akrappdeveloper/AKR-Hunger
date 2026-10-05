package com.ssr.hunger.activities;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.animation.DecelerateInterpolator;
import com.ssr.hunger.R;
import com.ssr.hunger.utils.PerformanceHelper;
import com.ssr.hunger.utils.PermissionManager;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.perf.metrics.Trace;

/**
 * Splash screen — checks auth state, requests essential permissions, then routes.
 * Tracks app cold start latency using Firebase Performance.
 */
public class SplashActivity extends BaseActivity {

    private Trace startupTrace;
    private static final int SPLASH_DELAY = 1800; // ms

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_splash);

        startupTrace = startTrace(PerformanceHelper.TRACE_APP_STARTUP);
        logBreadcrumb("SplashActivity: checking auth status");

        // Animate logo and tagline
        animateSplashContent();

        // After brief delay, check auth & request initial permissions
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            checkAuthAndProceed();
        }, SPLASH_DELAY);
    }

    private void animateSplashContent() {
        // Logo card entrance
        View logo = findViewById(R.id.iv_logo);
        View appName = findViewById(R.id.tv_app_name);
        View tagline = findViewById(R.id.tv_tagline);

        if (logo != null) {
            logo.setAlpha(0f);
            logo.setScaleX(0.75f);
            logo.setScaleY(0.75f);
            logo.animate()
                    .alpha(1f).scaleX(1f).scaleY(1f)
                    .setDuration(700)
                    .setInterpolator(new DecelerateInterpolator(2f))
                    .start();
        }
        if (appName != null) {
            appName.setAlpha(0f);
            appName.setTranslationY(24f);
            appName.animate()
                    .alpha(1f).translationY(0f)
                    .setStartDelay(300).setDuration(600)
                    .setInterpolator(new DecelerateInterpolator())
                    .start();
        }
        if (tagline != null) {
            tagline.setAlpha(0f);
            tagline.setTranslationY(16f);
            tagline.animate()
                    .alpha(1f).translationY(0f)
                    .setStartDelay(500).setDuration(600)
                    .setInterpolator(new DecelerateInterpolator())
                    .start();
        }
    }

    private void checkAuthAndProceed() {
        FirebaseUser currentUser = FirebaseAuth.getInstance().getCurrentUser();
        if (currentUser != null) {
            logBreadcrumb("Splash: Authenticated user (" + currentUser.getUid() + ")");
            // Request notification permission silently on first launch (Android 13+)
            PermissionManager.requireNotifications(
                    this,
                    () -> navigateTo(MainActivity.class),
                    (isPermanent) -> navigateTo(MainActivity.class) // Always proceed
            );
        } else {
            logBreadcrumb("Splash: No user, routing to Login");
            navigateTo(LoginActivity.class);
        }
    }

    private void navigateTo(Class<?> target) {
        stopTrace(startupTrace);
        Intent intent = new Intent(this, target);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(intent);
        overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out);
        finish();
    }

    @Override
    protected String getScreenName() { return "Splash"; }
}
