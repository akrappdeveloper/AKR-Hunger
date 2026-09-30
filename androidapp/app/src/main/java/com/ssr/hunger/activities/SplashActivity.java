package com.ssr.hunger.activities;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.animation.DecelerateInterpolator;
import com.ssr.hunger.R;
import com.ssr.hunger.utils.PerformanceHelper;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.perf.metrics.Trace;

/**
 * Splash screen that checks authentication state and routes accordingly.
 * Tracks app cold start latency using Firebase Performance.
 */
public class SplashActivity extends BaseActivity {

    private Trace startupTrace;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_splash);

        startupTrace = startTrace(PerformanceHelper.TRACE_APP_STARTUP);
        logBreadcrumb("SplashActivity: checking auth status");

        // Subtle entrance animation for brand logo and tagline
        View logo = findViewById(R.id.splash_logo);
        View subtitle = findViewById(R.id.splash_subtitle);
        if (logo != null) {
            logo.setAlpha(0f);
            logo.setScaleX(0.85f);
            logo.setScaleY(0.85f);
            logo.animate()
                    .alpha(1f)
                    .scaleX(1f)
                    .scaleY(1f)
                    .setDuration(700)
                    .setInterpolator(new android.view.animation.DecelerateInterpolator())
                    .start();
        }
        if (subtitle != null) {
            subtitle.setAlpha(0f);
            subtitle.setTranslationY(20f);
            subtitle.animate()
                    .alpha(1f)
                    .translationY(0f)
                    .setStartDelay(200)
                    .setDuration(600)
                    .setInterpolator(new android.view.animation.DecelerateInterpolator())
                    .start();
        }

        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            FirebaseUser currentUser = FirebaseAuth.getInstance().getCurrentUser();
            Intent intent;
            if (currentUser != null) {
                logBreadcrumb("Splash: User already authenticated (" + currentUser.getUid() + ")");
                intent = new Intent(SplashActivity.this, MainActivity.class);
            } else {
                logBreadcrumb("Splash: No authenticated user, routing to LoginActivity");
                intent = new Intent(SplashActivity.this, LoginActivity.class);
            }

            stopTrace(startupTrace);
            startActivity(intent);
            overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out);
            finish();
        }, 1500);
    }

    @Override
    protected String getScreenName() {
        return "Splash";
    }
}
