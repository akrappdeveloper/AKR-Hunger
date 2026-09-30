package com.ssr.hunger.utils;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;
import androidx.annotation.NonNull;
import com.ssr.hunger.BuildConfig;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * ReleaseMonitoringHelper tracks release stability, rollout health, version migrations,
 * and crash-free session indicators for Firebase Release Monitoring.
 */
public class ReleaseMonitoringHelper {

    private static final String TAG = "ReleaseMonitoring";
    private static final String PREF_NAME = "akr_release_monitoring";
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

    /**
     * Initializes release monitoring, inspects app update status,
     * updates Crashlytics release metadata, and logs upgrade events.
     */
    public void checkAndTrackRelease() {
        try {
            int currentVersionCode = BuildConfig.VERSION_CODE;
            String currentVersionName = BuildConfig.VERSION_NAME;
            int lastVersionCode = prefs.getInt(KEY_LAST_VERSION_CODE, -1);

            // Increment session counter
            int sessionCount = prefs.getInt(KEY_TOTAL_SESSIONS, 0) + 1;
            prefs.edit().putInt(KEY_TOTAL_SESSIONS, sessionCount).apply();

            CrashlyticsHelper crashlytics = CrashlyticsHelper.getInstance();
            AnalyticsHelper analytics = AnalyticsHelper.getInstance(context);

            // Set release monitoring keys in Crashlytics
            crashlytics.setCustomKey("app_version_name", currentVersionName);
            crashlytics.setCustomKey("app_version_code", currentVersionCode);
            crashlytics.setCustomKey("release_channel", BuildConfig.DEBUG ? "debug" : "production");
            crashlytics.setCustomKey("total_sessions", sessionCount);

            // Check installation / update timestamps
            PackageManager pm = context.getPackageManager();
            PackageInfo pInfo = pm.getPackageInfo(context.getPackageName(), 0);
            long firstInstallTime = pInfo.firstInstallTime;
            long lastUpdateTime = pInfo.lastUpdateTime;

            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US);
            crashlytics.setCustomKey("first_installed_at", sdf.format(new Date(firstInstallTime)));
            crashlytics.setCustomKey("last_updated_at", sdf.format(new Date(lastUpdateTime)));

            if (lastVersionCode == -1) {
                // First install
                Log.i(TAG, "Fresh install detected: v" + currentVersionName + " (code: " + currentVersionCode + ")");
                prefs.edit()
                        .putInt(KEY_LAST_VERSION_CODE, currentVersionCode)
                        .putLong(KEY_FIRST_INSTALL_TIME, System.currentTimeMillis())
                        .apply();
                crashlytics.log("Release Monitoring: Fresh install v" + currentVersionName);
                analytics.setUserProperty("first_version", currentVersionName);
            } else if (lastVersionCode < currentVersionCode) {
                // App upgraded!
                Log.i(TAG, "App upgrade detected: from code " + lastVersionCode + " to " + currentVersionCode);
                crashlytics.log("Release Monitoring: App upgraded from code " + lastVersionCode + " to " + currentVersionCode);
                analytics.logAppUpgrade(lastVersionCode, currentVersionCode, currentVersionName);
                prefs.edit().putInt(KEY_LAST_VERSION_CODE, currentVersionCode).apply();
            } else {
                // Existing version session
                Log.d(TAG, "Session #" + sessionCount + " for release v" + currentVersionName);
            }

        } catch (Exception e) {
            Log.e(TAG, "Error in release monitoring check", e);
        }
    }

    public int getSessionCount() {
        return prefs.getInt(KEY_TOTAL_SESSIONS, 1);
    }
}
