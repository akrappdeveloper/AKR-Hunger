package com.ssr.hunger.activities;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.View;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AlertDialog;
import com.bumptech.glide.Glide;
import com.google.android.material.materialswitch.MaterialSwitch;
import com.google.firebase.messaging.FirebaseMessaging;
import com.ssr.hunger.BuildConfig;
import com.ssr.hunger.R;
import com.ssr.hunger.utils.ThemeHelper;
import java.io.File;
import java.util.Locale;

/**
 * Modern Premium Minimalist Settings Activity.
 * Supports dynamic theme switching (Light / Dark / System Default),
 * notification preferences, cache management, and application info.
 */
public class SettingsActivity extends BaseActivity {

    private static final String PREF_SETTINGS = "user_settings_prefs";
    private static final String KEY_NOTIF_ORDERS = "notif_orders";
    private static final String KEY_NOTIF_PROMOTIONS = "notif_promotions";
    private static final String KEY_NOTIF_SOUND = "notif_sound";

    private View optLight, optDark, optSystem;
    private ImageView checkLight, checkDark, checkSystem;
    private MaterialSwitch switchOrders, switchPromotions, switchSound;
    private TextView tvCacheSize, tvAppVersion;
    private SharedPreferences prefs;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_settings);

        prefs = getSharedPreferences(PREF_SETTINGS, Context.MODE_PRIVATE);

        initViews();
        setupThemeSelector();
        setupNotificationSwitches();
        setupCacheSection();
        setupLegalAndVersion();
    }

    private void initViews() {
        findViewById(R.id.btn_back).setOnClickListener(v -> finish());

        optLight = findViewById(R.id.theme_option_light);
        optDark = findViewById(R.id.theme_option_dark);
        optSystem = findViewById(R.id.theme_option_system);

        checkLight = findViewById(R.id.check_theme_light);
        checkDark = findViewById(R.id.check_theme_dark);
        checkSystem = findViewById(R.id.check_theme_system);

        switchOrders = findViewById(R.id.switch_order_updates);
        switchPromotions = findViewById(R.id.switch_promotions);
        switchSound = findViewById(R.id.switch_sound);

        tvCacheSize = findViewById(R.id.tv_cache_size);
        tvAppVersion = findViewById(R.id.tv_app_version);
    }

    private void setupThemeSelector() {
        String currentMode = ThemeHelper.getSavedThemeMode(this);
        updateThemeUI(currentMode);

        optLight.setOnClickListener(v -> {
            ThemeHelper.setThemeMode(this, ThemeHelper.MODE_LIGHT);
            updateThemeUI(ThemeHelper.MODE_LIGHT);
            logAnalyticsEvent("theme_changed", null);
        });

        optDark.setOnClickListener(v -> {
            ThemeHelper.setThemeMode(this, ThemeHelper.MODE_DARK);
            updateThemeUI(ThemeHelper.MODE_DARK);
            logAnalyticsEvent("theme_changed", null);
        });

        optSystem.setOnClickListener(v -> {
            ThemeHelper.setThemeMode(this, ThemeHelper.MODE_SYSTEM);
            updateThemeUI(ThemeHelper.MODE_SYSTEM);
            logAnalyticsEvent("theme_changed", null);
        });
    }

    private void updateThemeUI(String mode) {
        optLight.setBackgroundResource(ThemeHelper.MODE_LIGHT.equals(mode) ?
                R.drawable.bg_theme_option_selected : R.drawable.bg_theme_option_unselected);
        checkLight.setVisibility(ThemeHelper.MODE_LIGHT.equals(mode) ? View.VISIBLE : View.INVISIBLE);

        optDark.setBackgroundResource(ThemeHelper.MODE_DARK.equals(mode) ?
                R.drawable.bg_theme_option_selected : R.drawable.bg_theme_option_unselected);
        checkDark.setVisibility(ThemeHelper.MODE_DARK.equals(mode) ? View.VISIBLE : View.INVISIBLE);

        optSystem.setBackgroundResource(ThemeHelper.MODE_SYSTEM.equals(mode) ?
                R.drawable.bg_theme_option_selected : R.drawable.bg_theme_option_unselected);
        checkSystem.setVisibility(ThemeHelper.MODE_SYSTEM.equals(mode) ? View.VISIBLE : View.INVISIBLE);

        updateSystemBarAppearance();
    }

    private void setupNotificationSwitches() {
        boolean notifyOrders = prefs.getBoolean(KEY_NOTIF_ORDERS, true);
        boolean notifyPromos = prefs.getBoolean(KEY_NOTIF_PROMOTIONS, true);
        boolean notifySound = prefs.getBoolean(KEY_NOTIF_SOUND, true);

        switchOrders.setChecked(notifyOrders);
        switchPromotions.setChecked(notifyPromos);
        switchSound.setChecked(notifySound);

        switchOrders.setOnCheckedChangeListener((btn, isChecked) -> {
            prefs.edit().putBoolean(KEY_NOTIF_ORDERS, isChecked).apply();
            if (isChecked) {
                FirebaseMessaging.getInstance().subscribeToTopic("all_customers");
            } else {
                FirebaseMessaging.getInstance().unsubscribeFromTopic("all_customers");
            }
        });

        switchPromotions.setOnCheckedChangeListener((btn, isChecked) -> {
            prefs.edit().putBoolean(KEY_NOTIF_PROMOTIONS, isChecked).apply();
            if (isChecked) {
                FirebaseMessaging.getInstance().subscribeToTopic("promotions");
            } else {
                FirebaseMessaging.getInstance().unsubscribeFromTopic("promotions");
            }
        });

        switchSound.setOnCheckedChangeListener((btn, isChecked) ->
                prefs.edit().putBoolean(KEY_NOTIF_SOUND, isChecked).apply());
    }

    private void setupCacheSection() {
        calculateAndDisplayCacheSize();

        findViewById(R.id.btn_clear_cache).setOnClickListener(v -> {
            new com.google.android.material.dialog.MaterialAlertDialogBuilder(this)
                    .setTitle("Clear App Cache")
                    .setMessage("Are you sure you want to clear temporary image and network cache?")
                    .setPositiveButton("Clear", (dialog, which) -> clearAppCache())
                    .setNegativeButton("Cancel", null)
                    .show();
        });
    }

    private void calculateAndDisplayCacheSize() {
        long sizeBytes = getFolderSize(getCacheDir()) + getFolderSize(getCodeCacheDir());
        File externalCache = getExternalCacheDir();
        if (externalCache != null) {
            sizeBytes += getFolderSize(externalCache);
        }

        if (sizeBytes < 1024) {
            tvCacheSize.setText(String.format(Locale.getDefault(), "%d B", sizeBytes));
        } else if (sizeBytes < 1024 * 1024) {
            tvCacheSize.setText(String.format(Locale.getDefault(), "%.1f KB", sizeBytes / 1024.0));
        } else {
            tvCacheSize.setText(String.format(Locale.getDefault(), "%.1f MB", sizeBytes / (1024.0 * 1024.0)));
        }
    }

    private long getFolderSize(File file) {
        if (file == null || !file.exists()) return 0;
        if (!file.isDirectory()) return file.length();
        long size = 0;
        File[] files = file.listFiles();
        if (files != null) {
            for (File child : files) {
                size += getFolderSize(child);
            }
        }
        return size;
    }

    private void clearAppCache() {
        try {
            deleteDir(getCacheDir());
            deleteDir(getExternalCacheDir());

            // Clear Glide memory and disk cache
            new Thread(() -> {
                Glide.get(getApplicationContext()).clearDiskCache();
                runOnUiThread(() -> {
                    Glide.get(getApplicationContext()).clearMemory();
                    calculateAndDisplayCacheSize();
                    Toast.makeText(this, "Cache cleared successfully", Toast.LENGTH_SHORT).show();
                });
            }).start();
        } catch (Exception e) {
            recordException("clearCache_error", e);
            Toast.makeText(this, "Failed to clear cache", Toast.LENGTH_SHORT).show();
        }
    }

    private boolean deleteDir(File dir) {
        if (dir != null && dir.isDirectory()) {
            String[] children = dir.list();
            if (children != null) {
                for (String child : children) {
                    boolean success = deleteDir(new File(dir, child));
                    if (!success) return false;
                }
            }
            return dir.delete();
        } else if (dir != null && dir.isFile()) {
            return dir.delete();
        }
        return false;
    }

    private void setupLegalAndVersion() {
        tvAppVersion.setText(String.format("v%s (Build %d)", BuildConfig.VERSION_NAME, BuildConfig.VERSION_CODE));

        findViewById(R.id.row_terms).setOnClickListener(v -> showInfoDialog(
                "Terms & Conditions",
                "By using Hunger, you agree to our service terms regarding orders, payments, refunds, and delivery commitments. All orders are processed in real-time."
        ));

        findViewById(R.id.row_privacy).setOnClickListener(v -> showInfoDialog(
                "Privacy Policy",
                "Hunger respects your privacy. We securely store your delivery address, phone number, and order history strictly for providing food delivery services. We never sell your personal data."
        ));
    }

    private void showInfoDialog(String title, String message) {
        new com.google.android.material.dialog.MaterialAlertDialogBuilder(this)
                .setTitle(title)
                .setMessage(message)
                .setPositiveButton("OK", null)
                .show();
    }

    @Override
    protected String getScreenName() {
        return "Settings";
    }
}
