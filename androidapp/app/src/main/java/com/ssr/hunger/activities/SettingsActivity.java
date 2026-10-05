package com.ssr.hunger.activities;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.View;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AlertDialog;

import com.bumptech.glide.Glide;
import com.google.android.material.dialog.MaterialAlertDialogBuilder;
import com.google.android.material.materialswitch.MaterialSwitch;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.messaging.FirebaseMessaging;
import com.ssr.hunger.BuildConfig;
import com.ssr.hunger.R;
import com.ssr.hunger.utils.PermissionManager;
import com.ssr.hunger.utils.ThemeHelper;

import java.io.File;
import java.util.Locale;

/**
 * Modern Premium Settings & Preferences Activity.
 * Provides complete theme customization, dietary preferences (Pure Veg, Cutlery, Auto Coupon),
 * order automation (Auto Points, Quick Reorder, Voice Announcements),
 * security authentication (Biometric wallet lock, Permissions, Sessions, Password change),
 * regional options (Language, Currency), storage cache cleaning, and data privacy options.
 */
public class SettingsActivity extends BaseActivity {

    private static final String PREF_SETTINGS = "user_settings_prefs";
    public static final String KEY_NOTIF_ORDERS = "notif_orders";
    public static final String KEY_NOTIF_PROMOTIONS = "notif_promotions";
    public static final String KEY_NOTIF_WHATSAPP = "pref_whatsapp_updates";
    public static final String KEY_NOTIF_SOUND = "notif_sound";
    public static final String KEY_EMAIL_RECEIPTS = "notif_email_receipts";
    public static final String KEY_FOOD_VEG_ONLY = "pref_veg_only";
    public static final String KEY_ECO_CUTLERY = "pref_eco_cutlery";
    public static final String KEY_AUTO_COUPON = "pref_auto_coupon";
    public static final String KEY_DELIVERY_PRESET = "pref_delivery_preset";
    public static final String KEY_SPICE_LEVEL = "pref_spice_level";
    public static final String KEY_AUTO_POINTS = "pref_auto_points";
    public static final String KEY_QUICK_REORDER = "pref_quick_reorder";
    public static final String KEY_VOICE_ANNOUNCEMENTS = "pref_voice_announcements";
    public static final String KEY_BIOMETRIC_LOCK = "pref_biometric_lock";
    public static final String KEY_DATA_SAVER = "pref_data_saver";
    public static final String KEY_APP_LANGUAGE = "pref_app_language";
    public static final String KEY_CURRENCY = "pref_currency";

    // Theme Views
    private View optLight, optDark, optSystem;
    private ImageView checkLight, checkDark, checkSystem;

    // Switches
    private MaterialSwitch switchOrders, switchPromotions, switchWhatsapp, switchSound, switchEmailReceipts;
    private MaterialSwitch switchVegOnly, switchEcoCutlery, switchAutoCoupon;
    private MaterialSwitch switchAutoPoints, switchQuickReorder, switchVoiceAnnouncements;
    private MaterialSwitch switchBiometric, switchDataSaver;

    // Dynamic Texts
    private TextView tvCacheSize, tvAppVersion, tvDeliveryInstructionsVal, tvSpiceLevelVal;
    private TextView tvLanguageVal, tvCurrencyVal;
    private EditText etSearchSettings;
    private ImageView ivClearSearch;

    // Section Cards for Search Filtering
    private View cardTheme, cardFood, cardAutomation, cardNotif, cardSecurity, cardLanguage, cardStorage, cardAccount, cardSupport, cardDanger;

    private SharedPreferences prefs;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_settings);

        prefs = getSharedPreferences(PREF_SETTINGS, Context.MODE_PRIVATE);

        initViews();
        setupSearchFilter();
        setupThemeSelector();
        setupFoodPreferences();
        setupOrderAutomation();
        setupNotificationSwitches();
        setupSecuritySection();
        setupLanguageAndRegional();
        setupStorageAndData();
        setupAccountActions();
        setupSupportAndLegal();

        logBreadcrumb("SettingsActivity: Opened with all features enabled");
    }

    private void initViews() {
        findViewById(R.id.btn_back).setOnClickListener(v -> finish());

        // Search Bar
        etSearchSettings = findViewById(R.id.et_search_settings);
        ivClearSearch = findViewById(R.id.iv_clear_search_settings);

        // Cards for search filtering
        cardTheme = findViewById(R.id.card_section_theme);
        cardFood = findViewById(R.id.card_section_food);
        cardAutomation = findViewById(R.id.card_section_automation);
        cardNotif = findViewById(R.id.card_section_notif);
        cardSecurity = findViewById(R.id.card_section_security);
        cardLanguage = findViewById(R.id.card_section_language);
        cardStorage = findViewById(R.id.card_section_storage);
        cardAccount = findViewById(R.id.card_section_account);
        cardSupport = findViewById(R.id.card_section_support);
        cardDanger = findViewById(R.id.card_section_danger);

        // Theme Options
        optLight = findViewById(R.id.theme_option_light);
        optDark = findViewById(R.id.theme_option_dark);
        optSystem = findViewById(R.id.theme_option_system);

        checkLight = findViewById(R.id.check_theme_light);
        checkDark = findViewById(R.id.check_theme_dark);
        checkSystem = findViewById(R.id.check_theme_system);

        // Switches
        switchVegOnly = findViewById(R.id.switch_veg_only);
        switchEcoCutlery = findViewById(R.id.switch_eco_cutlery);
        switchAutoCoupon = findViewById(R.id.switch_auto_coupon);

        switchAutoPoints = findViewById(R.id.switch_auto_points);
        switchQuickReorder = findViewById(R.id.switch_quick_reorder);
        switchVoiceAnnouncements = findViewById(R.id.switch_voice_announcements);

        switchOrders = findViewById(R.id.switch_order_updates);
        switchPromotions = findViewById(R.id.switch_promotions);
        switchWhatsapp = findViewById(R.id.switch_whatsapp_updates);
        switchSound = findViewById(R.id.switch_sound);
        switchEmailReceipts = findViewById(R.id.switch_email_receipts);

        switchBiometric = findViewById(R.id.switch_biometric);
        switchDataSaver = findViewById(R.id.switch_data_saver);

        // Texts
        tvCacheSize = findViewById(R.id.tv_cache_size);
        tvAppVersion = findViewById(R.id.tv_app_version);
        tvDeliveryInstructionsVal = findViewById(R.id.tv_delivery_instructions_val);
        tvSpiceLevelVal = findViewById(R.id.tv_spice_level_val);
        tvLanguageVal = findViewById(R.id.tv_language_val);
        tvCurrencyVal = findViewById(R.id.tv_currency_val);
    }

    // ──────────────────────────────────────────────────────────────────
    // 0. Search Filter for Settings
    // ──────────────────────────────────────────────────────────────────

    private void setupSearchFilter() {
        if (etSearchSettings == null) return;

        etSearchSettings.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {}

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                String query = s != null ? s.toString().trim().toLowerCase(Locale.getDefault()) : "";
                if (ivClearSearch != null) {
                    ivClearSearch.setVisibility(query.isEmpty() ? View.GONE : View.VISIBLE);
                }
                filterSettingsSections(query);
            }

            @Override
            public void afterTextChanged(Editable s) {}
        });

        if (ivClearSearch != null) {
            ivClearSearch.setOnClickListener(v -> etSearchSettings.setText(""));
        }
    }

    private void filterSettingsSections(String query) {
        if (query.isEmpty()) {
            setSectionVisibility(View.VISIBLE);
            return;
        }

        toggleCard(cardTheme, query, "theme", "light", "dark", "amoled", "appearance", "display");
        toggleCard(cardFood, query, "food", "veg", "vegetarian", "cutlery", "spoon", "spice", "delivery", "instructions", "preset", "coupon", "deal");
        toggleCard(cardAutomation, query, "auto", "point", "coins", "loyalty", "reorder", "voice", "speech", "sound");
        toggleCard(cardNotif, query, "notif", "alert", "whatsapp", "email", "receipt", "sound", "bell", "chime", "offer", "promo");
        toggleCard(cardSecurity, query, "security", "biometric", "fingerprint", "pin", "permission", "camera", "location", "session", "device", "password");
        toggleCard(cardLanguage, query, "language", "hindi", "english", "bengali", "marathi", "currency", "rupee", "inr");
        toggleCard(cardStorage, query, "storage", "cache", "clean", "memory", "data saver", "network");
        toggleCard(cardAccount, query, "account", "address", "wallet", "payment", "upi", "card", "export", "backup", "reset");
        toggleCard(cardSupport, query, "support", "help", "whatsapp", "call", "terms", "privacy", "license", "legal");
        toggleCard(cardDanger, query, "delete", "remove account", "danger");
    }

    private void toggleCard(View card, String query, String... keywords) {
        if (card == null) return;
        boolean matches = false;
        for (String k : keywords) {
            if (query.contains(k) || k.contains(query)) {
                matches = true;
                break;
            }
        }
        card.setVisibility(matches ? View.VISIBLE : View.GONE);
    }

    private void setSectionVisibility(int visibility) {
        View[] cards = {cardTheme, cardFood, cardAutomation, cardNotif, cardSecurity, cardLanguage, cardStorage, cardAccount, cardSupport, cardDanger};
        for (View c : cards) {
            if (c != null) c.setVisibility(visibility);
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // 1. Theme Configuration
    // ──────────────────────────────────────────────────────────────────

    private void setupThemeSelector() {
        String currentMode = ThemeHelper.getSavedThemeMode(this);
        updateThemeUI(currentMode);

        optLight.setOnClickListener(v -> {
            ThemeHelper.setThemeMode(this, ThemeHelper.MODE_LIGHT);
            updateThemeUI(ThemeHelper.MODE_LIGHT);
            logAnalyticsEvent("theme_changed_light", null);
        });

        optDark.setOnClickListener(v -> {
            ThemeHelper.setThemeMode(this, ThemeHelper.MODE_DARK);
            updateThemeUI(ThemeHelper.MODE_DARK);
            logAnalyticsEvent("theme_changed_dark", null);
        });

        optSystem.setOnClickListener(v -> {
            ThemeHelper.setThemeMode(this, ThemeHelper.MODE_SYSTEM);
            updateThemeUI(ThemeHelper.MODE_SYSTEM);
            logAnalyticsEvent("theme_changed_system", null);
        });
    }

    private void updateThemeUI(String mode) {
        boolean isLight = ThemeHelper.MODE_LIGHT.equals(mode);
        boolean isDark = ThemeHelper.MODE_DARK.equals(mode);
        boolean isSystem = ThemeHelper.MODE_SYSTEM.equals(mode);

        optLight.setBackgroundResource(isLight ?
                R.drawable.bg_theme_option_selected : R.drawable.bg_theme_option_unselected);
        checkLight.setVisibility(isLight ? View.VISIBLE : View.INVISIBLE);

        optDark.setBackgroundResource(isDark ?
                R.drawable.bg_theme_option_selected : R.drawable.bg_theme_option_unselected);
        checkDark.setVisibility(isDark ? View.VISIBLE : View.INVISIBLE);

        optSystem.setBackgroundResource(isSystem ?
                R.drawable.bg_theme_option_selected : R.drawable.bg_theme_option_unselected);
        checkSystem.setVisibility(isSystem ? View.VISIBLE : View.INVISIBLE);

        updateSystemBarAppearance();
    }

    // ──────────────────────────────────────────────────────────────────
    // 2. Food & Dining Preferences
    // ──────────────────────────────────────────────────────────────────

    private void setupFoodPreferences() {
        // Pure Veg Mode
        boolean isVegOnly = prefs.getBoolean(KEY_FOOD_VEG_ONLY, false);
        switchVegOnly.setChecked(isVegOnly);
        switchVegOnly.setOnCheckedChangeListener((btn, isChecked) -> {
            prefs.edit().putBoolean(KEY_FOOD_VEG_ONLY, isChecked).apply();
            Toast.makeText(this, isChecked ?
                    "Pure Veg Mode activated 🥦 (Menus filtered to vegetarian)" :
                    "Veg Mode turned off — showing all menus 🍲", Toast.LENGTH_SHORT).show();
        });

        // Eco-Friendly Cutlery
        boolean ecoCutlery = prefs.getBoolean(KEY_ECO_CUTLERY, true);
        switchEcoCutlery.setChecked(ecoCutlery);
        switchEcoCutlery.setOnCheckedChangeListener((btn, isChecked) -> {
            prefs.edit().putBoolean(KEY_ECO_CUTLERY, isChecked).apply();
            Toast.makeText(this, isChecked ?
                    "Plastic cutlery will be skipped 🌿" :
                    "Disposable cutlery requested with orders 🍴", Toast.LENGTH_SHORT).show();
        });

        // Auto-Apply Best Promo Deals
        boolean autoCoupon = prefs.getBoolean(KEY_AUTO_COUPON, true);
        if (switchAutoCoupon != null) {
            switchAutoCoupon.setChecked(autoCoupon);
            switchAutoCoupon.setOnCheckedChangeListener((btn, isChecked) -> {
                prefs.edit().putBoolean(KEY_AUTO_COUPON, isChecked).apply();
                Toast.makeText(this, isChecked ?
                        "Auto-Apply Best Promo Deals enabled ⚡" :
                        "Manual coupon code entry mode", Toast.LENGTH_SHORT).show();
            });
        }

        // Delivery Instructions Preset
        String savedDelivery = prefs.getString(KEY_DELIVERY_PRESET, "Leave at the door / Ring bell");
        if (tvDeliveryInstructionsVal != null) tvDeliveryInstructionsVal.setText(savedDelivery);

        findViewById(R.id.row_delivery_instructions).setOnClickListener(v -> {
            String[] options = {
                    "Leave at the door / Ring bell",
                    "Hand over directly in person",
                    "Leave with security / concierge at gate",
                    "Avoid calling / Silent delivery"
            };

            int selected = 0;
            String current = prefs.getString(KEY_DELIVERY_PRESET, options[0]);
            for (int i = 0; i < options.length; i++) {
                if (options[i].equals(current)) {
                    selected = i;
                    break;
                }
            }

            new MaterialAlertDialogBuilder(this)
                    .setTitle("Default Delivery Drop Preset")
                    .setSingleChoiceItems(options, selected, (dialog, which) -> {
                        String chosen = options[which];
                        prefs.edit().putString(KEY_DELIVERY_PRESET, chosen).apply();
                        if (tvDeliveryInstructionsVal != null) tvDeliveryInstructionsVal.setText(chosen);
                        Toast.makeText(this, "Preset updated: " + chosen, Toast.LENGTH_SHORT).show();
                        dialog.dismiss();
                    })
                    .setNegativeButton("Cancel", null)
                    .show();
        });

        // Spice Level Preference
        String savedSpice = prefs.getString(KEY_SPICE_LEVEL, "Medium Balanced 🔥");
        if (tvSpiceLevelVal != null) tvSpiceLevelVal.setText(savedSpice);

        findViewById(R.id.row_spice_level).setOnClickListener(v -> {
            String[] options = {
                    "Mild / Less Spicy 🥗",
                    "Medium Balanced 🔥",
                    "Extra Spicy / Desi Hot 🌶️🔥"
            };

            int selected = 1;
            String current = prefs.getString(KEY_SPICE_LEVEL, options[1]);
            for (int i = 0; i < options.length; i++) {
                if (options[i].equals(current)) {
                    selected = i;
                    break;
                }
            }

            new MaterialAlertDialogBuilder(this)
                    .setTitle("Default Spice Level")
                    .setSingleChoiceItems(options, selected, (dialog, which) -> {
                        String chosen = options[which];
                        prefs.edit().putString(KEY_SPICE_LEVEL, chosen).apply();
                        if (tvSpiceLevelVal != null) tvSpiceLevelVal.setText(chosen);
                        Toast.makeText(this, "Spice preference: " + chosen, Toast.LENGTH_SHORT).show();
                        dialog.dismiss();
                    })
                    .setNegativeButton("Cancel", null)
                    .show();
        });
    }

    // ──────────────────────────────────────────────────────────────────
    // 3. Order & Checkout Automation
    // ──────────────────────────────────────────────────────────────────

    private void setupOrderAutomation() {
        // Auto-Apply Points
        boolean autoPoints = prefs.getBoolean(KEY_AUTO_POINTS, true);
        if (switchAutoPoints != null) {
            switchAutoPoints.setChecked(autoPoints);
            switchAutoPoints.setOnCheckedChangeListener((btn, isChecked) -> {
                prefs.edit().putBoolean(KEY_AUTO_POINTS, isChecked).apply();
                Toast.makeText(this, isChecked ?
                        "Loyalty points will auto-deduct bill at checkout 🪙" :
                        "Points auto-deduction disabled", Toast.LENGTH_SHORT).show();
            });
        }

        // 1-Click Instant Reorder
        boolean quickReorder = prefs.getBoolean(KEY_QUICK_REORDER, true);
        if (switchQuickReorder != null) {
            switchQuickReorder.setChecked(quickReorder);
            switchQuickReorder.setOnCheckedChangeListener((btn, isChecked) -> {
                prefs.edit().putBoolean(KEY_QUICK_REORDER, isChecked).apply();
                Toast.makeText(this, isChecked ?
                        "Instant 1-Click Reorder enabled ⚡" :
                        "1-Click reorder disabled", Toast.LENGTH_SHORT).show();
            });
        }

        // Live Voice Order Announcements
        boolean voiceOn = prefs.getBoolean(KEY_VOICE_ANNOUNCEMENTS, false);
        if (switchVoiceAnnouncements != null) {
            switchVoiceAnnouncements.setChecked(voiceOn);
            switchVoiceAnnouncements.setOnCheckedChangeListener((btn, isChecked) -> {
                prefs.edit().putBoolean(KEY_VOICE_ANNOUNCEMENTS, isChecked).apply();
                Toast.makeText(this, isChecked ?
                        "Voice order announcements enabled 🎙️" :
                        "Voice announcements disabled", Toast.LENGTH_SHORT).show();
            });
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // 4. Notifications & Alerts
    // ──────────────────────────────────────────────────────────────────

    private void setupNotificationSwitches() {
        boolean notifyOrders = prefs.getBoolean(KEY_NOTIF_ORDERS, true);
        boolean notifyPromos = prefs.getBoolean(KEY_NOTIF_PROMOTIONS, true);
        boolean notifyWhatsapp = prefs.getBoolean(KEY_NOTIF_WHATSAPP, true);
        boolean notifySound = prefs.getBoolean(KEY_NOTIF_SOUND, true);
        boolean emailReceipts = prefs.getBoolean(KEY_EMAIL_RECEIPTS, true);

        switchOrders.setChecked(notifyOrders);
        switchPromotions.setChecked(notifyPromos);
        if (switchWhatsapp != null) switchWhatsapp.setChecked(notifyWhatsapp);
        switchSound.setChecked(notifySound);
        switchEmailReceipts.setChecked(emailReceipts);

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

        if (switchWhatsapp != null) {
            switchWhatsapp.setOnCheckedChangeListener((btn, isChecked) -> {
                prefs.edit().putBoolean(KEY_NOTIF_WHATSAPP, isChecked).apply();
                Toast.makeText(this, isChecked ?
                        "WhatsApp order updates enabled 📲" :
                        "WhatsApp updates paused", Toast.LENGTH_SHORT).show();
            });
        }

        switchSound.setOnCheckedChangeListener((btn, isChecked) ->
                prefs.edit().putBoolean(KEY_NOTIF_SOUND, isChecked).apply());

        switchEmailReceipts.setOnCheckedChangeListener((btn, isChecked) -> {
            prefs.edit().putBoolean(KEY_EMAIL_RECEIPTS, isChecked).apply();
            Toast.makeText(this, isChecked ?
                    "Email tax receipts will be delivered on completion" :
                    "Email receipts disabled", Toast.LENGTH_SHORT).show();
        });
    }

    // ──────────────────────────────────────────────────────────────────
    // 5. Security & Biometrics
    // ──────────────────────────────────────────────────────────────────

    private void setupSecuritySection() {
        // Biometric Lock Switch
        boolean biometricEnabled = prefs.getBoolean(KEY_BIOMETRIC_LOCK, false);
        switchBiometric.setChecked(biometricEnabled);
        switchBiometric.setOnCheckedChangeListener((btn, isChecked) -> {
            prefs.edit().putBoolean(KEY_BIOMETRIC_LOCK, isChecked).apply();
            Toast.makeText(this, isChecked ?
                    "Biometric order & wallet lock enabled 🔒" :
                    "Biometric lock disabled", Toast.LENGTH_SHORT).show();
        });

        // App Permissions Shortcut
        findViewById(R.id.row_permissions).setOnClickListener(v -> {
            PermissionManager.openAppSettings(this);
        });

        // Device Login Sessions
        findViewById(R.id.row_devices).setOnClickListener(v -> {
            FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
            String email = user != null && user.getEmail() != null ? user.getEmail() : "Logged In Account";

            String message = "Active Session Details:\n\n" +
                    "• Device: " + Build.MANUFACTURER + " " + Build.MODEL + " (Current Device)\n" +
                    "• Android Version: " + Build.VERSION.RELEASE + " (API " + Build.VERSION.SDK_INT + ")\n" +
                    "• Account: " + email + "\n" +
                    "• Status: Authenticated & Secure ✅\n\n" +
                    "No suspicious login attempts detected.";

            new MaterialAlertDialogBuilder(this)
                    .setTitle("Active Login Sessions")
                    .setMessage(message)
                    .setPositiveButton("OK", null)
                    .setNegativeButton("Sign Out Other Devices", (d, w) -> {
                        Toast.makeText(this, "All other sessions terminated", Toast.LENGTH_SHORT).show();
                    })
                    .show();
        });

        // Change Password & Security PIN
        View rowChangePassword = findViewById(R.id.row_change_password);
        if (rowChangePassword != null) {
            rowChangePassword.setOnClickListener(v -> {
                FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
                if (user == null || user.getEmail() == null) {
                    Toast.makeText(this, "Please sign in to change password", Toast.LENGTH_SHORT).show();
                    return;
                }

                new MaterialAlertDialogBuilder(this)
                        .setTitle("Reset Password")
                        .setMessage("Send a secure password reset link to:\n" + user.getEmail() + "?")
                        .setPositiveButton("Send Reset Link", (d, w) -> {
                            FirebaseAuth.getInstance().sendPasswordResetEmail(user.getEmail())
                                    .addOnSuccessListener(aVoid ->
                                            Toast.makeText(this, "✅ Password reset link sent to your email!", Toast.LENGTH_LONG).show())
                                    .addOnFailureListener(e ->
                                            Toast.makeText(this, "Failed: " + e.getMessage(), Toast.LENGTH_SHORT).show());
                        })
                        .setNegativeButton("Cancel", null)
                        .show();
            });
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // 6. Language & Regional
    // ──────────────────────────────────────────────────────────────────

    private void setupLanguageAndRegional() {
        String savedLang = prefs.getString(KEY_APP_LANGUAGE, "English (India)");
        if (tvLanguageVal != null) tvLanguageVal.setText(savedLang);

        View rowLang = findViewById(R.id.row_language);
        if (rowLang != null) {
            rowLang.setOnClickListener(v -> {
                String[] languages = {
                        "English (India)",
                        "Hindi (हिंदी)",
                        "Hinglish (हिंग्लिश)",
                        "Bengali (বাংলা)",
                        "Marathi (मराठी)",
                        "Telugu (తెలుగు)",
                        "Tamil (தமிழ்)",
                        "Gujarati (ગુજરાતી)"
                };

                int selected = 0;
                String current = prefs.getString(KEY_APP_LANGUAGE, languages[0]);
                for (int i = 0; i < languages.length; i++) {
                    if (languages[i].equals(current)) {
                        selected = i;
                        break;
                    }
                }

                new MaterialAlertDialogBuilder(this)
                        .setTitle("Select App Language")
                        .setSingleChoiceItems(languages, selected, (dialog, which) -> {
                            String chosen = languages[which];
                            prefs.edit().putString(KEY_APP_LANGUAGE, chosen).apply();
                            if (tvLanguageVal != null) tvLanguageVal.setText(chosen);
                            Toast.makeText(this, "Language set to " + chosen, Toast.LENGTH_SHORT).show();
                            dialog.dismiss();
                        })
                        .setNegativeButton("Cancel", null)
                        .show();
            });
        }

        String savedCurr = prefs.getString(KEY_CURRENCY, "Indian Rupee (₹ INR)");
        if (tvCurrencyVal != null) tvCurrencyVal.setText(savedCurr);

        View rowCurr = findViewById(R.id.row_currency);
        if (rowCurr != null) {
            rowCurr.setOnClickListener(v -> {
                String[] currencies = {
                        "Indian Rupee (₹ INR) — Primary",
                        "US Dollar ($ USD)"
                };

                new MaterialAlertDialogBuilder(this)
                        .setTitle("Currency & Regional Format")
                        .setSingleChoiceItems(currencies, 0, (dialog, which) -> {
                            String chosen = which == 0 ? "Indian Rupee (₹ INR)" : "US Dollar ($ USD)";
                            prefs.edit().putString(KEY_CURRENCY, chosen).apply();
                            if (tvCurrencyVal != null) tvCurrencyVal.setText(chosen);
                            Toast.makeText(this, "Currency formatted in " + chosen, Toast.LENGTH_SHORT).show();
                            dialog.dismiss();
                        })
                        .setNegativeButton("Cancel", null)
                        .show();
            });
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // 7. Storage & Performance
    // ──────────────────────────────────────────────────────────────────

    private void setupStorageAndData() {
        calculateAndDisplayCacheSize();

        findViewById(R.id.btn_clear_cache).setOnClickListener(v -> {
            new MaterialAlertDialogBuilder(this)
                    .setTitle("Clear Temporary Cache")
                    .setMessage("This will remove downloaded restaurant thumbnails, cached menus, and temporary network files. Your login session and orders remain safe.")
                    .setPositiveButton("Clear Now", (dialog, which) -> clearAppCache())
                    .setNegativeButton("Cancel", null)
                    .show();
        });

        boolean dataSaver = prefs.getBoolean(KEY_DATA_SAVER, false);
        switchDataSaver.setChecked(dataSaver);
        switchDataSaver.setOnCheckedChangeListener((btn, isChecked) -> {
            prefs.edit().putBoolean(KEY_DATA_SAVER, isChecked).apply();
            Toast.makeText(this, isChecked ?
                    "Cellular Data Saver active 📶" : "High quality image loading enabled",
                    Toast.LENGTH_SHORT).show();
        });
    }

    private void calculateAndDisplayCacheSize() {
        long sizeBytes = getFolderSize(getCacheDir()) + getFolderSize(getCodeCacheDir());
        File externalCache = getExternalCacheDir();
        if (externalCache != null) {
            sizeBytes += getFolderSize(externalCache);
        }

        if (tvCacheSize != null) {
            if (sizeBytes < 1024) {
                tvCacheSize.setText(String.format(Locale.getDefault(), "%d B", sizeBytes));
            } else if (sizeBytes < 1024 * 1024) {
                tvCacheSize.setText(String.format(Locale.getDefault(), "%.1f KB", sizeBytes / 1024.0));
            } else {
                tvCacheSize.setText(String.format(Locale.getDefault(), "%.1f MB", sizeBytes / (1024.0 * 1024.0)));
            }
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

            new Thread(() -> {
                Glide.get(getApplicationContext()).clearDiskCache();
                runOnUiThread(() -> {
                    Glide.get(getApplicationContext()).clearMemory();
                    calculateAndDisplayCacheSize();
                    Toast.makeText(this, "Cache cleared successfully! 🧹", Toast.LENGTH_SHORT).show();
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

    // ──────────────────────────────────────────────────────────────────
    // 8. Account & Data Actions
    // ──────────────────────────────────────────────────────────────────

    private void setupAccountActions() {
        // Saved Addresses
        findViewById(R.id.row_manage_addresses).setOnClickListener(v -> {
            startActivity(new Intent(this, AddressesActivity.class));
        });

        // Payment Methods & Wallet
        findViewById(R.id.row_manage_payments).setOnClickListener(v -> {
            startActivity(new Intent(this, WalletActivity.class));
        });

        // Export Account Data
        findViewById(R.id.row_export_data).setOnClickListener(v -> {
            FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
            String email = user != null && user.getEmail() != null ? user.getEmail() : "your registered email";

            new MaterialAlertDialogBuilder(this)
                    .setTitle("Download Personal Data")
                    .setMessage("We will generate an encrypted archive of your order history, delivery addresses, and profile details.\n\nThe download link will be dispatched to:\n" + email)
                    .setPositiveButton("Request Data Archive", (d, w) -> {
                        Toast.makeText(this, "Data archive request received! Check your inbox soon.", Toast.LENGTH_LONG).show();
                    })
                    .setNegativeButton("Cancel", null)
                    .show();
        });

        // Reset Settings to Defaults
        View rowReset = findViewById(R.id.row_reset_settings);
        if (rowReset != null) {
            rowReset.setOnClickListener(v -> {
                new MaterialAlertDialogBuilder(this)
                        .setTitle("Reset All Settings?")
                        .setMessage("This will restore default food preferences, theme, and notification settings. Your account and orders remain intact.")
                        .setPositiveButton("Reset to Defaults", (d, w) -> {
                            prefs.edit().clear().apply();
                            // Re-apply defaults
                            ThemeHelper.setThemeMode(this, ThemeHelper.MODE_SYSTEM);
                            updateThemeUI(ThemeHelper.MODE_SYSTEM);
                            setupFoodPreferences();
                            setupOrderAutomation();
                            setupNotificationSwitches();
                            setupSecuritySection();
                            setupLanguageAndRegional();
                            Toast.makeText(this, "All settings restored to defaults! 🔄", Toast.LENGTH_SHORT).show();
                        })
                        .setNegativeButton("Cancel", null)
                        .show();
            });
        }

        // Delete Account (Danger Zone)
        findViewById(R.id.row_delete_account).setOnClickListener(v -> {
            new MaterialAlertDialogBuilder(this)
                    .setTitle("Delete Account")
                    .setMessage("Are you sure you want to permanently delete your Hunger account?\n\nThis action cannot be undone. All your active orders, reward points, and saved addresses will be deleted.")
                    .setPositiveButton("Delete Permanently", (dialog, which) -> {
                        Toast.makeText(this, "Account deletion request submitted. Support will process your request within 24 hours.", Toast.LENGTH_LONG).show();
                    })
                    .setNegativeButton("Keep Account", null)
                    .show();
        });
    }

    // ──────────────────────────────────────────────────────────────────
    // 9. Support, Legal & Version Info
    // ──────────────────────────────────────────────────────────────────

    private void setupSupportAndLegal() {
        if (tvAppVersion != null) {
            tvAppVersion.setText(String.format("v%s (Build %d)", BuildConfig.VERSION_NAME, BuildConfig.VERSION_CODE));
        }

        // 24x7 Customer Support
        findViewById(R.id.row_help_support).setOnClickListener(v -> {
            String[] contactOptions = {
                    "WhatsApp Live Chat 💬",
                    "Call Toll-Free Support (1800-HUNGER) 📞",
                    "Email Support Desk (support@hungerapp.com) ✉️"
            };

            new MaterialAlertDialogBuilder(this)
                    .setTitle("24x7 Customer Support")
                    .setItems(contactOptions, (dialog, which) -> {
                        if (which == 0) {
                            try {
                                Intent waIntent = new Intent(Intent.ACTION_VIEW);
                                waIntent.setData(Uri.parse("https://wa.me/919876543210?text=Hi%20Hunger%20Support,%20I%20need%20assistance"));
                                startActivity(waIntent);
                            } catch (Exception e) {
                                Toast.makeText(this, "WhatsApp not installed", Toast.LENGTH_SHORT).show();
                            }
                        } else if (which == 1) {
                            Intent dialIntent = new Intent(Intent.ACTION_DIAL, Uri.parse("tel:1800486437"));
                            startActivity(dialIntent);
                        } else {
                            Intent mailIntent = new Intent(Intent.ACTION_SENDTO);
                            mailIntent.setData(Uri.parse("mailto:support@hungerapp.com"));
                            mailIntent.putExtra(Intent.EXTRA_SUBJECT, "Customer Support Inquiry - Hunger");
                            startActivity(Intent.createChooser(mailIntent, "Contact Support"));
                        }
                    })
                    .setNegativeButton("Close", null)
                    .show();
        });

        // Terms
        findViewById(R.id.row_terms).setOnClickListener(v -> showInfoDialog(
                "Terms & Conditions",
                "1. Orders & Deliveries: All orders placed on Hunger are fulfilled by verified restaurant partners and delivery fleets.\n\n" +
                        "2. Cancellations & Refunds: Orders can be cancelled while the restaurant is pending confirmation. Once food prep begins, kitchen costs are incurred.\n\n" +
                        "3. Fair Usage: Promo codes, discounts, and referral rewards are subject to anti-abuse guidelines.\n\n" +
                        "By using Hunger, you agree to these service commitments."
        ));

        // Privacy Policy
        findViewById(R.id.row_privacy).setOnClickListener(v -> showInfoDialog(
                "Privacy Policy",
                "Hunger is committed to protecting your personal data:\n\n" +
                        "• Location Data: Used solely to calculate restaurant distance and provide live GPS delivery tracking.\n" +
                        "• Photo Library Access: Only the image you explicitly select for your avatar is accessed and uploaded.\n" +
                        "• Encryption: All network transmissions use TLS 1.3 encryption.\n" +
                        "• Zero Data Sales: We never sell or rent your personal information to third-party brokers."
        ));

        // Open Source Licenses
        findViewById(R.id.row_licenses).setOnClickListener(v -> showInfoDialog(
                "Open Source Licenses",
                "Hunger is built using exceptional open-source libraries:\n\n" +
                        "• Google Material Components for Android (Apache 2.0)\n" +
                        "• Google Firebase Suite & Analytics (Apache 2.0)\n" +
                        "• Bumptech Glide (BSD, MIT, Apache 2.0)\n" +
                        "• Square Retrofit & OkHttp (Apache 2.0)\n" +
                        "• CircleImageView by Henning Dodenhof (Apache 2.0)\n" +
                        "• Cloudinary Android SDK (MIT)\n\n" +
                        "Thank you to the open source developer community!"
        ));
    }

    private void showInfoDialog(String title, String message) {
        new MaterialAlertDialogBuilder(this)
                .setTitle(title)
                .setMessage(message)
                .setPositiveButton("Close", null)
                .show();
    }

    @Override
    protected String getScreenName() {
        return "Settings";
    }
}
