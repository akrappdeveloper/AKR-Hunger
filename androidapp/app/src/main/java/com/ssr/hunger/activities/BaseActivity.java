package com.ssr.hunger.activities;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import com.ssr.hunger.R;
import com.ssr.hunger.utils.AnalyticsHelper;
import com.ssr.hunger.utils.CrashlyticsHelper;
import com.ssr.hunger.utils.PerformanceHelper;
import com.ssr.hunger.utils.PermissionManager;
import com.ssr.hunger.utils.RemoteConfigHelper;
import com.google.android.material.snackbar.Snackbar;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.perf.metrics.Trace;

/**
 * Base Activity that ALL activities in AKR Hunger extend.
 * Provides automatic integration with:
 * - Firebase Crashlytics (breadcrumbs, screen metadata, user context)
 * - Firebase Analytics (automatic screen_view events, eCommerce logging)
 * - Firebase Performance Monitoring (screen rendering traces)
 * - Firebase Remote Config (feature flags, fee configuration)
 * - Centralized PermissionManager (all permission types with custom dialogs)
 */
public abstract class BaseActivity extends AppCompatActivity {

    private static final String TAG = "BaseActivity";

    protected CrashlyticsHelper crashlyticsHelper;
    protected AnalyticsHelper analyticsHelper;
    protected PerformanceHelper performanceHelper;
    protected RemoteConfigHelper remoteConfigHelper;

    private Trace screenTrace;

    // ──────────────────────────────────────────────────────────────────
    // Lifecycle & Open Language Locale Attachment
    // ──────────────────────────────────────────────────────────────────

    @Override
    protected void attachBaseContext(android.content.Context newBase) {
        super.attachBaseContext(com.ssr.hunger.utils.LocaleHelper.onAttach(newBase));
    }

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

        updateSystemBarAppearance();
    }

    protected void updateSystemBarAppearance() {
        if (getWindow() == null) return;
        boolean isDark = com.ssr.hunger.utils.ThemeHelper.isDarkMode(this);
        androidx.core.view.WindowInsetsControllerCompat controller =
                androidx.core.view.WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (controller != null) {
            controller.setAppearanceLightStatusBars(!isDark);
            controller.setAppearanceLightNavigationBars(!isDark);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        String screenName = getScreenName();
        analyticsHelper.logScreenView(this, screenName);
        crashlyticsHelper.logScreenView(screenName);
        screenTrace = performanceHelper.startTrace("screen_" + screenName);
        if (screenTrace != null) {
            performanceHelper.putAttribute(screenTrace, "screen_name", screenName);
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (screenTrace != null) {
            performanceHelper.stopTrace(screenTrace);
            screenTrace = null;
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // Permission Result Delegation
    // ──────────────────────────────────────────────────────────────────

    @Override
    public void onRequestPermissionsResult(int requestCode,
                                            @NonNull String[] permissions,
                                            @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        boolean handled = PermissionManager.handleResult(
            this, requestCode, permissions, grantResults,
            this::onPermissionGranted,
            (isPermanent) -> onPermissionDenied(requestCode, isPermanent)
        );

        if (handled) {
            logBreadcrumb("Permission result handled: reqCode=" + requestCode);
        }
    }

    /**
     * Called when any permission is granted.
     * Override in subclasses to handle specific permission results.
     */
    protected void onPermissionGranted() {
        Log.d(TAG, "Permission granted");
    }

    /**
     * Called when any permission is denied.
     * @param requestCode The request code identifying which permission.
     * @param isPermanent True if the user selected "Don't ask again".
     */
    protected void onPermissionDenied(int requestCode, boolean isPermanent) {
        Log.d(TAG, "Permission denied: rc=" + requestCode + " permanent=" + isPermanent);
        if (isPermanent) {
            showSettingsSnackbar();
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // Permission Convenience Methods (delegates to PermissionManager)
    // ──────────────────────────────────────────────────────────────────

    /**
     * Request location permission with a beautiful dialog.
     */
    protected void requireLocation(@NonNull PermissionManager.Callback onGranted,
                                    @Nullable PermissionManager.DeniedCallback onDenied) {
        PermissionManager.requireLocation(this, onGranted, onDenied);
    }

    /**
     * Request camera permission with a beautiful dialog.
     */
    protected void requireCamera(@NonNull PermissionManager.Callback onGranted,
                                  @Nullable PermissionManager.DeniedCallback onDenied) {
        PermissionManager.requireCamera(this, onGranted, onDenied);
    }

    /**
     * Request storage/photos permission with a beautiful dialog.
     */
    protected void requireStorage(@NonNull PermissionManager.Callback onGranted,
                                   @Nullable PermissionManager.DeniedCallback onDenied) {
        PermissionManager.requireStorage(this, onGranted, onDenied);
    }

    /**
     * Request notification permission (Android 13+ only) with a beautiful dialog.
     */
    protected void requireNotifications(@NonNull PermissionManager.Callback onGranted,
                                         @Nullable PermissionManager.DeniedCallback onDenied) {
        PermissionManager.requireNotifications(this, onGranted, onDenied);
    }

    /**
     * Request microphone permission with a beautiful dialog.
     */
    protected void requireMicrophone(@NonNull PermissionManager.Callback onGranted,
                                      @Nullable PermissionManager.DeniedCallback onDenied) {
        PermissionManager.requireMicrophone(this, onGranted, onDenied);
    }

    /**
     * Request phone call permission with a beautiful dialog.
     */
    protected void requirePhone(@NonNull PermissionManager.Callback onGranted,
                                 @Nullable PermissionManager.DeniedCallback onDenied) {
        PermissionManager.requirePhone(this, onGranted, onDenied);
    }

    /**
     * Show a Snackbar directing the user to app settings (used on permanent denial).
     */
    protected void showSettingsSnackbar() {
        android.view.View root = getWindow().getDecorView().getRootView();
        Snackbar.make(root, "Permission required. Enable it in Settings.", Snackbar.LENGTH_LONG)
                .setAction("Settings", v -> PermissionManager.openAppSettings(this))
                .setActionTextColor(getColor(R.color.primary))
                .show();
    }

    protected void showToast(String message) {
        if (message != null && !isFinishing()) {
            android.widget.Toast.makeText(this, message, android.widget.Toast.LENGTH_SHORT).show();
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // Analytics & Crashlytics helpers
    // ──────────────────────────────────────────────────────────────────

    protected void logAnalyticsEvent(@NonNull String eventName, @Nullable Bundle params) {
        analyticsHelper.logEvent(eventName, params);
        crashlyticsHelper.log("Event logged: " + eventName);
    }

    protected void logBreadcrumb(@NonNull String message) {
        crashlyticsHelper.log(message);
    }

    protected void recordException(@NonNull String context, @NonNull Throwable throwable) {
        crashlyticsHelper.recordException(context, throwable);
    }

    @Nullable
    protected Trace startTrace(@NonNull String traceName) {
        return performanceHelper.startTrace(traceName);
    }

    protected void stopTrace(@Nullable Trace trace) {
        performanceHelper.stopTrace(trace);
    }

    protected String getScreenName() {
        return getClass().getSimpleName().replace("Activity", "");
    }
}
