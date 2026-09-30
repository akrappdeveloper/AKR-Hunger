package com.ssr.hunger.activities;

import android.os.Bundle;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import com.ssr.hunger.utils.AnalyticsHelper;
import com.ssr.hunger.utils.CrashlyticsHelper;
import com.ssr.hunger.utils.PerformanceHelper;
import com.ssr.hunger.utils.RemoteConfigHelper;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.perf.metrics.Trace;

/**
 * Base Activity that ALL activities in the app extend.
 * Provides automatic, seamless integration with:
 * - Firebase Crashlytics (breadcrumbs, screen metadata, user context)
 * - Firebase Realtime Analytics (automatic screen_view events, eCommerce logging)
 * - Firebase Performance Monitoring (screen rendering traces, custom metrics)
 * - Firebase Remote Config (feature flags, fee configuration)
 */
public abstract class BaseActivity extends AppCompatActivity {

    private static final String TAG = "BaseActivity";

    protected CrashlyticsHelper crashlyticsHelper;
    protected AnalyticsHelper analyticsHelper;
    protected PerformanceHelper performanceHelper;
    protected RemoteConfigHelper remoteConfigHelper;

    private Trace screenTrace;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Initialize monitoring singletons
        crashlyticsHelper = CrashlyticsHelper.getInstance();
        analyticsHelper = AnalyticsHelper.getInstance(this);
        performanceHelper = PerformanceHelper.getInstance();
        remoteConfigHelper = RemoteConfigHelper.getInstance();

        // Update user identification if authenticated
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user != null) {
            crashlyticsHelper.setUser(user);
            analyticsHelper.setUser(user);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        String screenName = getScreenName();

        // 1. Firebase Realtime Analytics - screen_view event
        analyticsHelper.logScreenView(this, screenName);

        // 2. Firebase Crashlytics - breadcrumb & custom key
        crashlyticsHelper.logScreenView(screenName);

        // 3. Firebase Performance Monitoring - screen rendering trace
        screenTrace = performanceHelper.startTrace("screen_" + screenName);
        if (screenTrace != null) {
            performanceHelper.putAttribute(screenTrace, "screen_name", screenName);
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        // Stop performance screen trace
        if (screenTrace != null) {
            performanceHelper.stopTrace(screenTrace);
            screenTrace = null;
        }
    }

    /**
     * Log custom analytics event.
     */
    protected void logAnalyticsEvent(@NonNull String eventName, @Nullable Bundle params) {
        analyticsHelper.logEvent(eventName, params);
        crashlyticsHelper.log("Event logged: " + eventName);
    }

    /**
     * Log a Crashlytics breadcrumb.
     */
    protected void logBreadcrumb(@NonNull String message) {
        crashlyticsHelper.log(message);
    }

    /**
     * Record non-fatal exception with context message.
     */
    protected void recordException(@NonNull String context, @NonNull Throwable throwable) {
        crashlyticsHelper.recordException(context, throwable);
    }

    /**
     * Helper to start a performance trace.
     */
    @Nullable
    protected Trace startTrace(@NonNull String traceName) {
        return performanceHelper.startTrace(traceName);
    }

    /**
     * Helper to stop a performance trace.
     */
    protected void stopTrace(@Nullable Trace trace) {
        performanceHelper.stopTrace(trace);
    }

    /**
     * Provides the screen name for analytics and performance tracking.
     * Can be overridden by subclasses for custom names.
     */
    protected String getScreenName() {
        return getClass().getSimpleName().replace("Activity", "");
    }
}
