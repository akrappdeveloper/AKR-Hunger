package com.ssr.hunger.utils;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.os.Build;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import com.ssr.hunger.BuildConfig;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.crashlytics.CustomKeysAndValues;
import com.google.firebase.crashlytics.FirebaseCrashlytics;
import java.util.Map;

/**
 * CrashlyticsHelper provides a centralized, robust API for:
 * - Crash Reporting & Symbolication
 * - Breadcrumb logging for user journey tracking
 * - Release Monitoring (custom keys for build, release channel, device info)
 * - Non-fatal exception reporting with context
 * - User identification across crash reports
 */
public class CrashlyticsHelper {

    private static final String TAG = "CrashlyticsHelper";
    private static volatile CrashlyticsHelper instance;
    private final FirebaseCrashlytics crashlytics;

    private CrashlyticsHelper() {
        this.crashlytics = FirebaseCrashlytics.getInstance();
    }

    public static CrashlyticsHelper getInstance() {
        if (instance == null) {
            synchronized (CrashlyticsHelper.class) {
                if (instance == null) {
                    instance = new CrashlyticsHelper();
                }
            }
        }
        return instance;
    }

    /**
     * Initializes Crashlytics with release & device metadata for Release Monitoring.
     */
    public void init(@NonNull Context context) {
        try {
            // Enable data collection
            crashlytics.setCrashlyticsCollectionEnabled(true);

            // Record initial build & environment metadata (Release Monitoring)
            CustomKeysAndValues.Builder keysBuilder = new CustomKeysAndValues.Builder()
                    .putString("build_type", BuildConfig.BUILD_TYPE)
                    .putInt("version_code", BuildConfig.VERSION_CODE)
                    .putString("version_name", BuildConfig.VERSION_NAME)
                    .putString("app_name", "Hunger")
                    .putString("device_manufacturer", Build.MANUFACTURER)
                    .putString("device_model", Build.MODEL)
                    .putInt("android_sdk_version", Build.VERSION.SDK_INT)
                    .putString("release_channel", BuildConfig.DEBUG ? "debug_internal" : "production_release");

            crashlytics.setCustomKeys(keysBuilder.build());

            // Network state breadcrumb
            updateNetworkState(context);

            log("Crashlytics initialized successfully for Hunger v" + BuildConfig.VERSION_NAME + " (" + BuildConfig.BUILD_TYPE + ")");
        } catch (Exception e) {
            Log.e(TAG, "Error initializing CrashlyticsHelper", e);
        }
    }

    /**
     * Associates authenticated user details with Crashlytics reports.
     */
    public void setUser(@Nullable FirebaseUser user) {
        if (user != null) {
            crashlytics.setUserId(user.getUid());
            crashlytics.setCustomKey("user_email", user.getEmail() != null ? user.getEmail() : "anonymous");
            crashlytics.setCustomKey("user_phone", user.getPhoneNumber() != null ? user.getPhoneNumber() : "none");
            crashlytics.setCustomKey("is_authenticated", true);
            log("User identified: " + user.getUid());
        } else {
            clearUser();
        }
    }

    /**
     * Clears user details on logout.
     */
    public void clearUser() {
        crashlytics.setUserId("");
        crashlytics.setCustomKey("user_email", "logged_out");
        crashlytics.setCustomKey("is_authenticated", false);
        log("User logged out");
    }

    /**
     * Logs a breadcrumb trail message. These appear in the Crashlytics console
     * leading up to a crash or non-fatal exception.
     */
    public void log(@NonNull String message) {
        Log.d(TAG, message);
        crashlytics.log(message);
    }

    /**
     * Logs user navigation between screens.
     */
    public void logScreenView(@NonNull String screenName) {
        crashlytics.setCustomKey("current_screen", screenName);
        log("Screen View: " + screenName);
    }

    /**
     * Logs user action breadcrumb.
     */
    public void logAction(@NonNull String action, @NonNull String details) {
        log("Action: " + action + " | Details: " + details);
    }

    /**
     * Sets a custom string key for filtering in Crashlytics console.
     */
    public void setCustomKey(@NonNull String key, @NonNull String value) {
        crashlytics.setCustomKey(key, value);
    }

    /**
     * Sets a custom int key.
     */
    public void setCustomKey(@NonNull String key, int value) {
        crashlytics.setCustomKey(key, value);
    }

    /**
     * Sets a custom boolean key.
     */
    public void setCustomKey(@NonNull String key, boolean value) {
        crashlytics.setCustomKey(key, value);
    }

    /**
     * Sets a custom double key.
     */
    public void setCustomKey(@NonNull String key, double value) {
        crashlytics.setCustomKey(key, value);
    }

    /**
     * Updates cart state metadata for contextual crash diagnosis.
     */
    public void updateCartContext(int itemCount, double subtotal, @Nullable String restaurantId) {
        crashlytics.setCustomKey("cart_item_count", itemCount);
        crashlytics.setCustomKey("cart_subtotal", subtotal);
        if (restaurantId != null) {
            crashlytics.setCustomKey("cart_restaurant_id", restaurantId);
        }
    }

    /**
     * Updates network state.
     */
    public void updateNetworkState(Context context) {
        try {
            ConnectivityManager cm = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                android.net.Network network = cm.getActiveNetwork();
                NetworkCapabilities caps = cm.getNetworkCapabilities(network);
                boolean isConnected = caps != null && (caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
                        caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR));
                boolean isWifi = caps != null && caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI);
                crashlytics.setCustomKey("network_connected", isConnected);
                crashlytics.setCustomKey("network_type", isWifi ? "WIFI" : (isConnected ? "CELLULAR" : "OFFLINE"));
            }
        } catch (Exception ignored) {
        }
    }

    /**
     * Records a non-fatal exception with an explanatory log message.
     */
    public void recordException(@NonNull String contextMessage, @NonNull Throwable throwable) {
        Log.e(TAG, contextMessage, throwable);
        log("Non-fatal [" + contextMessage + "]: " + throwable.getMessage());
        crashlytics.recordException(throwable);
    }

    /**
     * Records a non-fatal exception directly.
     */
    public void recordException(@NonNull Throwable throwable) {
        recordException(throwable.getClass().getSimpleName(), throwable);
    }

    /**
     * Records a non-fatal exception with custom key-value attributes for triage.
     */
    public void recordExceptionWithAttributes(@NonNull Throwable throwable, @NonNull Map<String, String> attributes) {
        CustomKeysAndValues.Builder builder = new CustomKeysAndValues.Builder();
        for (Map.Entry<String, String> entry : attributes.entrySet()) {
            builder.putString(entry.getKey(), entry.getValue());
        }
        crashlytics.setCustomKeys(builder.build());
        crashlytics.recordException(throwable);
    }

    /**
     * Simulates a test crash to verify Crashlytics setup in the Firebase Console.
     * WARNING: Only call this during testing!
     */
    public void simulateCrashForTesting() {
        log("Crashlytics test crash triggered intentionally!");
        throw new RuntimeException("Firebase Crashlytics Test Crash - Hunger App Verification");
    }
}
