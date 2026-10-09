package com.ssr.hunger.delivery.utils;

import android.content.Context;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;

import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.crashlytics.CustomKeysAndValues;
import com.google.firebase.crashlytics.FirebaseCrashlytics;
import com.ssr.hunger.delivery.BuildConfig;

/**
 * CrashlyticsHelper provides a centralized API for:
 * - Crash Reporting & Symbolication
 * - Breadcrumb logging for rider journey tracking
 * - Release Monitoring (custom keys for build, release channel, device info)
 * - Non-fatal exception reporting with context
 * - Partner identification across crash reports
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

    public void init(@NonNull Context context) {
        try {
            crashlytics.setCrashlyticsCollectionEnabled(true);

            CustomKeysAndValues.Builder keysBuilder = new CustomKeysAndValues.Builder()
                    .putString("build_type", BuildConfig.BUILD_TYPE)
                    .putInt("version_code", BuildConfig.VERSION_CODE)
                    .putString("version_name", BuildConfig.VERSION_NAME)
                    .putString("app_name", "Hunger Delivery")
                    .putString("device_manufacturer", Build.MANUFACTURER)
                    .putString("device_model", Build.MODEL)
                    .putInt("android_sdk", Build.VERSION.SDK_INT);

            crashlytics.setCustomKeys(keysBuilder.build());
            Log.d(TAG, "Crashlytics initialized for Hunger Delivery");
        } catch (Exception e) {
            Log.e(TAG, "Error initializing Crashlytics", e);
        }
    }

    public void setPartnerUser(@NonNull FirebaseUser user) {
        crashlytics.setUserId(user.getUid());
        crashlytics.setCustomKey("user_email", user.getEmail() != null ? user.getEmail() : "no-email");
    }

    public void setCustomKey(String key, String value) {
        crashlytics.setCustomKey(key, value != null ? value : "null");
    }

    public void setCustomKey(String key, boolean value) {
        crashlytics.setCustomKey(key, value);
    }

    public void setCustomKey(String key, int value) {
        crashlytics.setCustomKey(key, value);
    }

    public void log(String message) {
        crashlytics.log(message);
        Log.d(TAG, "Breadcrumb: " + message);
    }

    public void recordException(String contextTag, Throwable throwable) {
        crashlytics.log("Non-fatal in [" + contextTag + "]: " + throwable.getMessage());
        crashlytics.recordException(throwable);
        Log.e(TAG, "Recorded exception [" + contextTag + "]", throwable);
    }
}
