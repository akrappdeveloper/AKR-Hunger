package com.ssr.hunger.utils;

import android.content.Context;
import android.util.Log;
import androidx.annotation.NonNull;
import com.ssr.hunger.BuildConfig;
import com.ssr.hunger.R;
import com.google.firebase.remoteconfig.ConfigUpdate;
import com.google.firebase.remoteconfig.ConfigUpdateListener;
import com.google.firebase.remoteconfig.FirebaseRemoteConfig;
import com.google.firebase.remoteconfig.FirebaseRemoteConfigException;
import com.google.firebase.remoteconfig.FirebaseRemoteConfigSettings;

/**
 * RemoteConfigHelper manages dynamic app configuration, feature flags,
 * fee parameters, and real-time remote config updates via Firebase Remote Config.
 */
public class RemoteConfigHelper {

    private static final String TAG = "RemoteConfigHelper";
    private static volatile RemoteConfigHelper instance;
    private final FirebaseRemoteConfig remoteConfig;

    // Config Keys
    public static final String KEY_FREE_DELIVERY_THRESHOLD = "free_delivery_threshold";
    public static final String KEY_DELIVERY_FEE = "delivery_fee";
    public static final String KEY_TAX_RATE = "tax_rate";
    public static final String KEY_COD_ENABLED = "cod_enabled";
    public static final String KEY_ONLINE_PAYMENT_ENABLED = "online_payment_enabled";
    public static final String KEY_WALLET_ENABLED = "wallet_enabled";
    public static final String KEY_MAINTENANCE_MODE = "maintenance_mode";
    public static final String KEY_MIN_SUPPORTED_VERSION = "min_supported_version";
    public static final String KEY_PROMO_BANNER_TEXT = "promo_banner_text";

    private RemoteConfigHelper() {
        this.remoteConfig = FirebaseRemoteConfig.getInstance();
    }

    public static RemoteConfigHelper getInstance() {
        if (instance == null) {
            synchronized (RemoteConfigHelper.class) {
                if (instance == null) {
                    instance = new RemoteConfigHelper();
                }
            }
        }
        return instance;
    }

    /**
     * Initializes Remote Config with settings and local defaults.
     */
    public void init(@NonNull Context context) {
        try {
            long fetchInterval = BuildConfig.DEBUG ? 0 : 3600; // 0 seconds in debug, 1 hour in release

            FirebaseRemoteConfigSettings configSettings = new FirebaseRemoteConfigSettings.Builder()
                    .setMinimumFetchIntervalInSeconds(fetchInterval)
                    .build();

            remoteConfig.setConfigSettingsAsync(configSettings);
            remoteConfig.setDefaultsAsync(R.xml.remote_config_defaults);

            // Fetch and activate latest configuration
            remoteConfig.fetchAndActivate()
                    .addOnCompleteListener(task -> {
                        if (task.isSuccessful()) {
                            boolean updated = task.getResult();
                            Log.d(TAG, "Remote Config fetch succeeded. Updated: " + updated);
                            CrashlyticsHelper.getInstance().log("Remote Config fetched successfully (updated=" + updated + ")");
                        } else {
                            Log.w(TAG, "Remote Config fetch failed", task.getException());
                        }
                    });

            // Listen for Realtime Remote Config updates
            remoteConfig.addOnConfigUpdateListener(new ConfigUpdateListener() {
                @Override
                public void onUpdate(@NonNull ConfigUpdate configUpdate) {
                    Log.d(TAG, "Remote Config updated keys: " + configUpdate.getUpdatedKeys());
                    remoteConfig.activate().addOnCompleteListener(task -> {
                        Log.d(TAG, "Realtime config activated");
                        CrashlyticsHelper.getInstance().log("Realtime Remote Config update applied");
                    });
                }

                @Override
                public void onError(@NonNull FirebaseRemoteConfigException error) {
                    Log.w(TAG, "Realtime Remote Config update error", error);
                }
            });

        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize Remote Config", e);
            CrashlyticsHelper.getInstance().recordException("RemoteConfigHelper.init", e);
        }
    }

    public double getFreeDeliveryThreshold() {
        return remoteConfig.getDouble(KEY_FREE_DELIVERY_THRESHOLD);
    }

    public double getDeliveryFee() {
        return remoteConfig.getDouble(KEY_DELIVERY_FEE);
    }

    public double getTaxRate() {
        return remoteConfig.getDouble(KEY_TAX_RATE);
    }

    public boolean isCodEnabled() {
        return remoteConfig.getBoolean(KEY_COD_ENABLED);
    }

    public boolean isOnlinePaymentEnabled() {
        return remoteConfig.getBoolean(KEY_ONLINE_PAYMENT_ENABLED);
    }

    public boolean isWalletEnabled() {
        return remoteConfig.getBoolean(KEY_WALLET_ENABLED);
    }

    public boolean isMaintenanceMode() {
        return remoteConfig.getBoolean(KEY_MAINTENANCE_MODE);
    }

    public long getMinSupportedVersion() {
        return remoteConfig.getLong(KEY_MIN_SUPPORTED_VERSION);
    }

    public String getPromoBannerText() {
        return remoteConfig.getString(KEY_PROMO_BANNER_TEXT);
    }

    public boolean getBoolean(String key, boolean defaultValue) {
        try {
            return remoteConfig.getBoolean(key);
        } catch (Exception e) {
            return defaultValue;
        }
    }

    public double getDouble(String key, double defaultValue) {
        try {
            return remoteConfig.getDouble(key);
        } catch (Exception e) {
            return defaultValue;
        }
    }

    public String getString(String key, String defaultValue) {
        try {
            String value = remoteConfig.getString(key);
            return (value != null && !value.isEmpty()) ? value : defaultValue;
        } catch (Exception e) {
            return defaultValue;
        }
    }
}
