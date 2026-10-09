package com.ssr.hunger.delivery.utils;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;

import com.ssr.hunger.delivery.BuildConfig;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * ReleaseMonitoringHelper tracks release stability, rollout health, version migrations,
 * and crash-free session indicators for Firebase Release Monitoring.
 */
public class ReleaseMonitoringHelper {

    private static final String TAG = "ReleaseMonitoring";
    private static final String PREF_NAME = "hunger_delivery_release_monitoring";
    private static final String KEY_LAST_VERSION_CODE = "last_version_code";
    private static final String KEY_FIRST_INSTALL_TIME = "first_install_time";
    private static final String KEY_TOTAL_SESSIONS = "total_sessions_count";

    private static volatile ReleaseMonitoringHelper instance;
    private final SharedPreferences prefs;
    private final Context context;

    private ReleaseMonitoringHelper(@NonNull Context context) {
        this.context = context.getApplicationContext();
        this.prefs = this.context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
    }

    public static ReleaseMonitoringHelper getInstance(@NonNull Context context) {
        if (instance == null) {
            synchronized (ReleaseMonitoringHelper.class) {
                if (instance == null) {
                    instance = new ReleaseMonitoringHelper(context);
                }
            }
        }
        return instance;
    }

    public void checkAndTrackRelease() {
        try {
            int currentVersionCode = BuildConfig.VERSION_CODE;
            String currentVersionName = BuildConfig.VERSION_NAME;
            int lastVersionCode = prefs.getInt(KEY_LAST_VERSION_CODE, -1);

            int sessionCount = prefs.getInt(KEY_TOTAL_SESSIONS, 0) + 1;
            prefs.edit().putInt(KEY_TOTAL_SESSIONS, sessionCount).apply();

            CrashlyticsHelper crashlytics = CrashlyticsHelper.getInstance();
            crashlytics.setCustomKey("session_count", sessionCount);

            if (!prefs.contains(KEY_FIRST_INSTALL_TIME)) {
                String firstInstall = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).format(new Date());
                prefs.edit().putString(KEY_FIRST_INSTALL_TIME, firstInstall).apply();
                crashlytics.setCustomKey("first_installed_at", firstInstall);
                Log.d(TAG, "First install recorded: " + firstInstall);
            }

            if (lastVersionCode == -1) {
                // Clean new install
                prefs.edit().putInt(KEY_LAST_VERSION_CODE, currentVersionCode).apply();
                crashlytics.setCustomKey("release_status", "fresh_install");
            } else if (lastVersionCode < currentVersionCode) {
                // App upgraded
                prefs.edit().putInt(KEY_LAST_VERSION_CODE, currentVersionCode).apply();
                crashlytics.setCustomKey("release_status", "upgraded_from_" + lastVersionCode);
                crashlytics.log("App upgraded from versionCode " + lastVersionCode + " to " + currentVersionCode);
            } else {
                crashlytics.setCustomKey("release_status", "current");
            }

            Log.d(TAG, "Release Monitoring initialized: v" + currentVersionName + " (" + currentVersionCode + "), session: " + sessionCount);
        } catch (Exception e) {
            Log.e(TAG, "Error in ReleaseMonitoring", e);
        }
    }
}
