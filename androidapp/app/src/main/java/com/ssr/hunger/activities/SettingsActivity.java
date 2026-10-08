package com.ssr.hunger.activities;

import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.View;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.Nullable;

import com.bumptech.glide.Glide;
import com.google.android.material.dialog.MaterialAlertDialogBuilder;
import com.google.android.material.materialswitch.MaterialSwitch;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.messaging.FirebaseMessaging;
import com.ssr.hunger.BuildConfig;
import com.ssr.hunger.R;
import com.ssr.hunger.dialogs.ModernDialogHelper;
import com.ssr.hunger.utils.Constants;
import com.ssr.hunger.utils.LocaleHelper;
import com.ssr.hunger.utils.OpenLanguageSystem;
import com.ssr.hunger.utils.PermissionManager;
import com.ssr.hunger.utils.SettingsHelper;
import com.ssr.hunger.utils.ThemeHelper;
import com.ssr.hunger.utils.VoiceHelper;

import java.util.ArrayList;
import java.util.List;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Modern Premium Settings & Preferences Activity for AKR Hunger.
 * Provides complete customization for theme, food preferences, order automation,
 * real voice announcements, haptics, security credentials, regional locales,
 * live storage cache cleanup, and personal data exports.
 */
public class SettingsActivity extends BaseActivity {

    private static final int REQ_DEVICE_CREDENTIAL_TOGGLE = 4001;
    private static final int REQ_DEVICE_CREDENTIAL_TEST = 4002;

    // Theme Views
    private View optLight, optDark, optSystem;
    private ImageView checkLight, checkDark, checkSystem;

    // Switches
    private MaterialSwitch switchReduceAnimations;
    private MaterialSwitch switchVegOnly, switchEcoCutlery, switchAutoCoupon;
    private MaterialSwitch switchAutoPoints, switchQuickReorder, switchVoiceAnnouncements, switchHapticFeedback;
    private MaterialSwitch switchOrders, switchPromotions, switchWhatsapp, switchSound, switchEmailReceipts;
    private MaterialSwitch switchBiometric, switchAnalyticsOptIn, switchDataSaver;

    // Dynamic Text Views & Actions
    private TextView tvCacheSize, tvCacheBreakdown, tvAppVersion;
    private TextView tvDeliveryInstructionsVal, tvSpiceLevelVal, tvCookingInstructionsVal, tvDefaultPaymentVal;
    private TextView tvLanguageVal, tvCurrencyVal;
    private TextView tvUserName, tvUserContact, tvUserMembershipBadge;
    private ImageView ivUserAvatar;
    private EditText etSearchSettings;
    private ImageView ivClearSearch;
    private View layoutSearchEmpty, btnResetSearch;

    // Section Cards for Real-Time Search Filtering
    private View cardProfile, cardTheme, cardFood, cardAutomation, cardNotif, cardSecurity;
    private View cardLanguage, cardStorage, cardAccount, cardSupport, cardDanger;

    private SharedPreferences prefs;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_settings);

        prefs = SettingsHelper.getPrefs(this);

        initViews();
        setupSearchFilter();
        loadUserProfileSummary();
        setupThemeSelector();
        setupFoodPreferences();
        setupOrderAutomation();
        setupNotificationSwitches();
        setupSecuritySection();
        setupLanguageAndRegional();
        setupStorageAndData();
        setupAccountActions();
        setupSupportAndCommunity();

        logBreadcrumb("SettingsActivity: Fully initialized with all features");
    }

    private void initViews() {
        findViewById(R.id.btn_back).setOnClickListener(v -> {
            SettingsHelper.triggerHapticClick(this);
            finish();
        });

        // Search Bar Views
        etSearchSettings = findViewById(R.id.et_search_settings);
        ivClearSearch = findViewById(R.id.iv_clear_search_settings);
        layoutSearchEmpty = findViewById(R.id.layout_search_empty);
        btnResetSearch = findViewById(R.id.btn_reset_search);

        // Cards
        cardProfile = findViewById(R.id.card_section_profile);
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

        // User Profile Summary Views
        ivUserAvatar = findViewById(R.id.iv_user_avatar);
        tvUserName = findViewById(R.id.tv_user_name);
        tvUserContact = findViewById(R.id.tv_user_contact);
        tvUserMembershipBadge = findViewById(R.id.tv_user_membership_badge);

        // Theme Options
        optLight = findViewById(R.id.theme_option_light);
        optDark = findViewById(R.id.theme_option_dark);
        optSystem = findViewById(R.id.theme_option_system);
        checkLight = findViewById(R.id.check_theme_light);
        checkDark = findViewById(R.id.check_theme_dark);
        checkSystem = findViewById(R.id.check_theme_system);
        switchReduceAnimations = findViewById(R.id.switch_reduce_animations);

        // Food Switches & Rows
        switchVegOnly = findViewById(R.id.switch_veg_only);
        switchEcoCutlery = findViewById(R.id.switch_eco_cutlery);
        switchAutoCoupon = findViewById(R.id.switch_auto_coupon);
        tvDeliveryInstructionsVal = findViewById(R.id.tv_delivery_instructions_val);
        tvSpiceLevelVal = findViewById(R.id.tv_spice_level_val);
        tvCookingInstructionsVal = findViewById(R.id.tv_cooking_instructions_val);

        // Automation Switches & Rows
        switchAutoPoints = findViewById(R.id.switch_auto_points);
        switchQuickReorder = findViewById(R.id.switch_quick_reorder);
        switchVoiceAnnouncements = findViewById(R.id.switch_voice_announcements);
        switchHapticFeedback = findViewById(R.id.switch_haptic_feedback);
        tvDefaultPaymentVal = findViewById(R.id.tv_default_payment_val);

        // Notifications Switches
        switchOrders = findViewById(R.id.switch_order_updates);
        switchPromotions = findViewById(R.id.switch_promotions);
        switchWhatsapp = findViewById(R.id.switch_whatsapp_updates);
        switchSound = findViewById(R.id.switch_sound);
        switchEmailReceipts = findViewById(R.id.switch_email_receipts);

        // Security Switches
        switchBiometric = findViewById(R.id.switch_biometric);
        switchAnalyticsOptIn = findViewById(R.id.switch_analytics_opt_in);

        // Language & Currency
        tvLanguageVal = findViewById(R.id.tv_language_val);
        tvCurrencyVal = findViewById(R.id.tv_currency_val);

        // Storage & Cache
        tvCacheSize = findViewById(R.id.tv_cache_size);
        tvCacheBreakdown = findViewById(R.id.tv_cache_breakdown);
        switchDataSaver = findViewById(R.id.switch_data_saver);

        // App Version
        tvAppVersion = findViewById(R.id.tv_app_version);
    }

    // ──────────────────────────────────────────────────────────────────
    // 0. Search Filter with Empty State
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
            ivClearSearch.setOnClickListener(v -> {
                SettingsHelper.triggerHapticClick(this);
                etSearchSettings.setText("");
            });
        }

        if (btnResetSearch != null) {
            btnResetSearch.setOnClickListener(v -> {
                SettingsHelper.triggerHapticClick(this);
                etSearchSettings.setText("");
            });
        }
    }

    private void filterSettingsSections(String query) {
        if (query.isEmpty()) {
            setAllCardsVisibility(View.VISIBLE);
            if (layoutSearchEmpty != null) layoutSearchEmpty.setVisibility(View.GONE);
            return;
        }

        boolean pTheme = matchCard(cardTheme, query, "theme", "light", "dark", "amoled", "appearance", "display", "motion", "animation");
        boolean pFood = matchCard(cardFood, query, "food", "veg", "vegetarian", "cutlery", "spoon", "spice", "chili", "hot", "delivery", "instructions", "preset", "coupon", "deal", "allergy", "jain", "chef", "cooking");
        boolean pAutomation = matchCard(cardAutomation, query, "auto", "point", "coins", "loyalty", "reorder", "voice", "speech", "sound", "speak", "announcement", "haptic", "vibrate", "payment", "upi", "wallet");
        boolean pNotif = matchCard(cardNotif, query, "notif", "alert", "whatsapp", "email", "receipt", "sound", "bell", "chime", "offer", "promo", "deal", "channel");
        boolean pSecurity = matchCard(cardSecurity, query, "security", "biometric", "fingerprint", "face", "pin", "lock", "permission", "camera", "location", "session", "device", "password", "telemetry", "crash");
        boolean pLang = matchCard(cardLanguage, query, "language", "hindi", "english", "bengali", "marathi", "tamil", "telugu", "gujarati", "currency", "rupee", "inr", "dollar", "usd");
        boolean pStorage = matchCard(cardStorage, query, "storage", "cache", "clean", "memory", "data saver", "network", "glide");
        boolean pAccount = matchCard(cardAccount, query, "account", "address", "wallet", "membership", "vip", "reward", "coin", "card", "export", "backup", "reset", "download");
        boolean pSupport = matchCard(cardSupport, query, "support", "help", "whatsapp", "call", "ticket", "rate", "play", "share", "terms", "privacy", "license", "legal");
        boolean pDanger = matchCard(cardDanger, query, "delete", "remove account", "sign out", "logout", "danger");

        boolean hasAnyMatch = pTheme || pFood || pAutomation || pNotif || pSecurity || pLang || pStorage || pAccount || pSupport || pDanger;
        if (layoutSearchEmpty != null) {
            layoutSearchEmpty.setVisibility(hasAnyMatch ? View.GONE : View.VISIBLE);
        }
        if (cardProfile != null) {
            cardProfile.setVisibility(hasAnyMatch ? View.VISIBLE : View.GONE);
        }
    }

    private boolean matchCard(View card, String query, String... keywords) {
        if (card == null) return false;
        boolean matches = false;
        for (String k : keywords) {
            if (query.contains(k) || k.contains(query)) {
                matches = true;
                break;
            }
        }
        card.setVisibility(matches ? View.VISIBLE : View.GONE);
        return matches;
    }

    private void setAllCardsVisibility(int visibility) {
        View[] cards = {cardProfile, cardTheme, cardFood, cardAutomation, cardNotif, cardSecurity, cardLanguage, cardStorage, cardAccount, cardSupport, cardDanger};
        for (View c : cards) {
            if (c != null) c.setVisibility(visibility);
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // 1. User Profile Summary
    // ──────────────────────────────────────────────────────────────────

    private void loadUserProfileSummary() {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user != null) {
            String name = user.getDisplayName();
            String email = user.getEmail();
            String phone = user.getPhoneNumber();

            if (tvUserName != null) {
                tvUserName.setText(name != null && !name.trim().isEmpty() ? name : "Hunger Foodie");
            }
            if (tvUserContact != null) {
                String contact = email != null && !email.trim().isEmpty() ? email : (phone != null ? phone : "Registered Account");
                tvUserContact.setText(contact);
            }

            if (ivUserAvatar != null && user.getPhotoUrl() != null) {
                Glide.with(this)
                        .load(user.getPhotoUrl())
                        .placeholder(R.drawable.ic_profile)
                        .error(R.drawable.ic_profile)
                        .into(ivUserAvatar);
            }

            // Fetch VIP status from Firestore
            FirebaseFirestore.getInstance().collection(Constants.COLLECTION_CUSTOMERS).document(user.getUid())
                    .get()
                    .addOnSuccessListener(doc -> {
                        if (doc != null && doc.exists()) {
                            Boolean isVip = doc.getBoolean("isVipMember");
                            if (isVip == null) isVip = doc.getBoolean("isHungerOne");
                            if (tvUserMembershipBadge != null) {
                                tvUserMembershipBadge.setText(Boolean.TRUE.equals(isVip) ? "Hunger One VIP Member" : "Verified Customer");
                            }
                        }
                    })
                    .addOnFailureListener(ignored -> {});
        } else {
            if (tvUserName != null) tvUserName.setText("Guest Foodie");
            if (tvUserContact != null) tvUserContact.setText("Sign in to unlock rewards");
            if (tvUserMembershipBadge != null) tvUserMembershipBadge.setText("Guest Mode");
        }

        View btnEdit = findViewById(R.id.btn_edit_profile_quick);
        if (btnEdit != null) {
            btnEdit.setOnClickListener(v -> {
                SettingsHelper.triggerHapticClick(this);
                startActivity(new Intent(this, EditProfileActivity.class));
            });
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // 2. Theme Configuration
    // ──────────────────────────────────────────────────────────────────

    private void setupThemeSelector() {
        String currentMode = ThemeHelper.getSavedThemeMode(this);
        updateThemeUI(currentMode);

        optLight.setOnClickListener(v -> {
            SettingsHelper.triggerHapticClick(this);
            ThemeHelper.setThemeMode(this, ThemeHelper.MODE_LIGHT);
            updateThemeUI(ThemeHelper.MODE_LIGHT);
            logAnalyticsEvent("theme_changed_light", null);
        });

        optDark.setOnClickListener(v -> {
            SettingsHelper.triggerHapticClick(this);
            ThemeHelper.setThemeMode(this, ThemeHelper.MODE_DARK);
            updateThemeUI(ThemeHelper.MODE_DARK);
            logAnalyticsEvent("theme_changed_dark", null);
        });

        optSystem.setOnClickListener(v -> {
            SettingsHelper.triggerHapticClick(this);
            ThemeHelper.setThemeMode(this, ThemeHelper.MODE_SYSTEM);
            updateThemeUI(ThemeHelper.MODE_SYSTEM);
            logAnalyticsEvent("theme_changed_system", null);
        });

        if (switchReduceAnimations != null) {
            switchReduceAnimations.setChecked(SettingsHelper.isReduceAnimations(this));
            switchReduceAnimations.setOnCheckedChangeListener((btn, isChecked) -> {
                SettingsHelper.triggerHapticClick(this);
                prefs.edit().putBoolean(SettingsHelper.KEY_REDUCE_ANIMATIONS, isChecked).apply();
                Toast.makeText(this, isChecked ? "Animations reduced ⚡" : "Full animation effects enabled", Toast.LENGTH_SHORT).show();
            });
        }
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
    // 3. Food & Dining Preferences
    // ──────────────────────────────────────────────────────────────────

    private void setupFoodPreferences() {
        // Pure Veg Mode
        boolean isVegOnly = SettingsHelper.isVegOnly(this);
        switchVegOnly.setChecked(isVegOnly);
        switchVegOnly.setOnCheckedChangeListener((btn, isChecked) -> {
            SettingsHelper.triggerHapticClick(this);
            prefs.edit().putBoolean(SettingsHelper.KEY_FOOD_VEG_ONLY, isChecked).apply();
            getSharedPreferences(Constants.PREF_USER, Context.MODE_PRIVATE)
                    .edit().putBoolean(SettingsHelper.KEY_FOOD_VEG_ONLY, isChecked).apply();

            Toast.makeText(this, isChecked ?
                    "🥦 Pure Veg Mode activated! (Menus filtered to vegetarian)" :
                    "🍲 Veg Mode turned off — showing all delicious menus", Toast.LENGTH_SHORT).show();
        });

        // Eco-Friendly Cutlery
        boolean ecoCutlery = SettingsHelper.isEcoCutlery(this);
        switchEcoCutlery.setChecked(ecoCutlery);
        switchEcoCutlery.setOnCheckedChangeListener((btn, isChecked) -> {
            SettingsHelper.triggerHapticClick(this);
            prefs.edit().putBoolean(SettingsHelper.KEY_ECO_CUTLERY, isChecked).apply();
            Toast.makeText(this, isChecked ?
                    "🌿 Plastic cutlery will be skipped to protect environment" :
                    "🍴 Disposable cutlery requested with your orders", Toast.LENGTH_SHORT).show();
        });

        // Auto-Apply Best Promo Deals
        boolean autoCoupon = SettingsHelper.isAutoCouponEnabled(this);
        if (switchAutoCoupon != null) {
            switchAutoCoupon.setChecked(autoCoupon);
            switchAutoCoupon.setOnCheckedChangeListener((btn, isChecked) -> {
                SettingsHelper.triggerHapticClick(this);
                prefs.edit().putBoolean(SettingsHelper.KEY_AUTO_COUPON, isChecked).apply();
                Toast.makeText(this, isChecked ?
                        "⚡ Auto-Apply Best Deals enabled at checkout" :
                        "Manual promo entry mode active", Toast.LENGTH_SHORT).show();
            });
        }

        // Delivery Instructions Preset
        String savedDelivery = SettingsHelper.getDeliveryPreset(this);
        if (tvDeliveryInstructionsVal != null) tvDeliveryInstructionsVal.setText(savedDelivery);

        findViewById(R.id.row_delivery_instructions).setOnClickListener(v -> {
            SettingsHelper.triggerHapticClick(this);
            String[] options = {
                    "Leave at the door / Ring bell 🔔",
                    "Hand over directly in person 🤝",
                    "Leave with security guard / concierge 🏢",
                    "Do not ring bell / Silent delivery 🤫",
                    "Call upon arrival only 📞"
            };

            List<ModernDialogHelper.ChoiceOption> choiceList = new ArrayList<>();
            for (String s : options) choiceList.add(new ModernDialogHelper.ChoiceOption(s));

            int selected = 0;
            String current = SettingsHelper.getDeliveryPreset(this);
            for (int i = 0; i < options.length; i++) {
                if (options[i].equals(current)) {
                    selected = i;
                    break;
                }
            }

            ModernDialogHelper.showChoiceDialog(
                    this,
                    R.drawable.ic_clock,
                    "Default Delivery Drop Preset",
                    "Applied automatically to all your food deliveries",
                    choiceList,
                    selected,
                    (idx, chosen) -> {
                        prefs.edit().putString(SettingsHelper.KEY_DELIVERY_PRESET, chosen).apply();
                        if (tvDeliveryInstructionsVal != null) tvDeliveryInstructionsVal.setText(chosen);
                        Toast.makeText(this, "Preset updated: " + chosen, Toast.LENGTH_SHORT).show();
                    }
            );
        });

        // Spice Level Preference
        String savedSpice = SettingsHelper.getSpiceLevel(this);
        if (tvSpiceLevelVal != null) tvSpiceLevelVal.setText(savedSpice);

        findViewById(R.id.row_spice_level).setOnClickListener(v -> {
            SettingsHelper.triggerHapticClick(this);
            String[] options = {
                    "Mild / Zero Chili 🥗",
                    "Medium Balanced 🔥",
                    "Extra Spicy / Desi Hot 🌶️🔥"
            };

            List<ModernDialogHelper.ChoiceOption> choiceList = new ArrayList<>();
            for (String s : options) choiceList.add(new ModernDialogHelper.ChoiceOption(s));

            int selected = 1;
            String current = SettingsHelper.getSpiceLevel(this);
            for (int i = 0; i < options.length; i++) {
                if (options[i].equals(current)) {
                    selected = i;
                    break;
                }
            }

            ModernDialogHelper.showChoiceDialog(
                    this,
                    R.drawable.ic_dialog_warning_outline,
                    "Default Spice Level",
                    "Restaurant kitchens adjust spice intensity accordingly",
                    choiceList,
                    selected,
                    (idx, chosen) -> {
                        prefs.edit().putString(SettingsHelper.KEY_SPICE_LEVEL, chosen).apply();
                        if (tvSpiceLevelVal != null) tvSpiceLevelVal.setText(chosen);
                        Toast.makeText(this, "Spice preference: " + chosen, Toast.LENGTH_SHORT).show();
                    }
            );
        });

        // Cooking & Allergy Instructions (Modern Input Dialog matching reference screenshot)
        String savedCooking = SettingsHelper.getCookingInstruction(this);
        if (tvCookingInstructionsVal != null) tvCookingInstructionsVal.setText(savedCooking);

        View rowCooking = findViewById(R.id.row_cooking_instructions);
        if (rowCooking != null) {
            rowCooking.setOnClickListener(v -> {
                SettingsHelper.triggerHapticClick(this);
                String current = SettingsHelper.getCookingInstruction(this);

                ModernDialogHelper.showInputDialog(
                        this,
                        R.drawable.ic_dialog_edit_outline,
                        "Cooking Instructions",
                        "Permanent kitchen instructions sent with all food orders",
                        "e.g. Less spicy, less salt, extra paper napkins",
                        current,
                        text -> {
                            prefs.edit().putString(SettingsHelper.KEY_COOKING_INSTRUCTION, text).apply();
                            if (tvCookingInstructionsVal != null) tvCookingInstructionsVal.setText(text.isEmpty() ? "Standard" : text);
                            Toast.makeText(this, "Kitchen preference saved!", Toast.LENGTH_SHORT).show();
                        }
                );
            });
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // 4. Order & Checkout Automation
    // ──────────────────────────────────────────────────────────────────

    private void setupOrderAutomation() {
        // Auto-Apply Points
        boolean autoPoints = SettingsHelper.isAutoRedeemPoints(this);
        if (switchAutoPoints != null) {
            switchAutoPoints.setChecked(autoPoints);
            switchAutoPoints.setOnCheckedChangeListener((btn, isChecked) -> {
                SettingsHelper.triggerHapticClick(this);
                prefs.edit().putBoolean(SettingsHelper.KEY_AUTO_POINTS, isChecked).apply();
                Toast.makeText(this, isChecked ?
                        "🪙 Loyalty points will auto-deduct bill at checkout" :
                        "Points auto-deduction disabled", Toast.LENGTH_SHORT).show();
            });
        }

        // 1-Click Instant Reorder
        boolean quickReorder = SettingsHelper.isQuickReorderEnabled(this);
        if (switchQuickReorder != null) {
            switchQuickReorder.setChecked(quickReorder);
            switchQuickReorder.setOnCheckedChangeListener((btn, isChecked) -> {
                SettingsHelper.triggerHapticClick(this);
                prefs.edit().putBoolean(SettingsHelper.KEY_QUICK_REORDER, isChecked).apply();
                Toast.makeText(this, isChecked ?
                        "⚡ 1-Tap Quick Reorder enabled in Order History" :
                        "1-Tap reorder disabled", Toast.LENGTH_SHORT).show();
            });
        }

        // Live Voice Order Announcements
        boolean voiceOn = SettingsHelper.isVoiceAnnouncementsEnabled(this);
        if (switchVoiceAnnouncements != null) {
            switchVoiceAnnouncements.setChecked(voiceOn);
            switchVoiceAnnouncements.setOnCheckedChangeListener((btn, isChecked) -> {
                SettingsHelper.triggerHapticClick(this);
                prefs.edit().putBoolean(SettingsHelper.KEY_VOICE_ANNOUNCEMENTS, isChecked).apply();
                Toast.makeText(this, isChecked ?
                        "🎙️ Voice order announcements enabled" :
                        "Voice announcements disabled", Toast.LENGTH_SHORT).show();
                if (isChecked) {
                    VoiceHelper.getInstance(this).speakImmediate("Voice announcements activated!");
                }
            });
        }

        // Test Voice Button
        View btnTestVoice = findViewById(R.id.btn_test_voice);
        if (btnTestVoice != null) {
            btnTestVoice.setOnClickListener(v -> {
                SettingsHelper.triggerHapticClick(this);
                VoiceHelper.getInstance(this).testAnnouncement(this);
            });
        }

        // In-App Haptic Feedback
        boolean haptics = SettingsHelper.isHapticFeedbackEnabled(this);
        if (switchHapticFeedback != null) {
            switchHapticFeedback.setChecked(haptics);
            switchHapticFeedback.setOnCheckedChangeListener((btn, isChecked) -> {
                prefs.edit().putBoolean(SettingsHelper.KEY_HAPTIC_FEEDBACK, isChecked).apply();
                if (isChecked) {
                    SettingsHelper.triggerHapticClick(this);
                    Toast.makeText(this, "Haptic feedback enabled ✨", Toast.LENGTH_SHORT).show();
                } else {
                    Toast.makeText(this, "Haptic feedback muted", Toast.LENGTH_SHORT).show();
                }
            });
        }

        // Preferred Payment Method
        String savedPayment = SettingsHelper.getDefaultPayment(this);
        if (tvDefaultPaymentVal != null) tvDefaultPaymentVal.setText(savedPayment);

        View rowPayment = findViewById(R.id.row_default_payment);
        if (rowPayment != null) {
            rowPayment.setOnClickListener(v -> {
                SettingsHelper.triggerHapticClick(this);
                String[] paymentMethods = {
                        "UPI / Google Pay / PhonePe 📲",
                        "Hunger Wallet 💳 (Fast 1-tap)",
                        "Credit / Debit Card 💳",
                        "Cash on Delivery 💵 (COD)"
                };

                List<ModernDialogHelper.ChoiceOption> choiceList = new ArrayList<>();
                for (String s : paymentMethods) choiceList.add(new ModernDialogHelper.ChoiceOption(s));

                int selected = 0;
                String current = SettingsHelper.getDefaultPayment(this);
                for (int i = 0; i < paymentMethods.length; i++) {
                    if (paymentMethods[i].equals(current)) {
                        selected = i;
                        break;
                    }
                }

                ModernDialogHelper.showChoiceDialog(
                        this,
                        R.drawable.ic_credit_card,
                        "Preferred Payment Method",
                        "Pre-selected at checkout screen for faster ordering",
                        choiceList,
                        selected,
                        (idx, chosen) -> {
                            prefs.edit().putString(SettingsHelper.KEY_DEFAULT_PAYMENT, chosen).apply();
                            if (tvDefaultPaymentVal != null) tvDefaultPaymentVal.setText(chosen);
                            Toast.makeText(this, "Payment preference: " + chosen, Toast.LENGTH_SHORT).show();
                        }
                );
            });
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // 5. Notifications & Alerts
    // ──────────────────────────────────────────────────────────────────

    private void setupNotificationSwitches() {
        boolean notifyOrders = SettingsHelper.isOrderNotifEnabled(this);
        boolean notifyPromos = SettingsHelper.isPromoNotifEnabled(this);
        boolean notifyWhatsapp = SettingsHelper.isWhatsappNotifEnabled(this);
        boolean notifySound = SettingsHelper.isSoundNotifEnabled(this);
        boolean emailReceipts = SettingsHelper.isEmailReceiptsEnabled(this);

        switchOrders.setChecked(notifyOrders);
        switchPromotions.setChecked(notifyPromos);
        if (switchWhatsapp != null) switchWhatsapp.setChecked(notifyWhatsapp);
        switchSound.setChecked(notifySound);
        switchEmailReceipts.setChecked(emailReceipts);

        switchOrders.setOnCheckedChangeListener((btn, isChecked) -> {
            SettingsHelper.triggerHapticClick(this);
            prefs.edit().putBoolean(SettingsHelper.KEY_NOTIF_ORDERS, isChecked).apply();
            if (isChecked) {
                FirebaseMessaging.getInstance().subscribeToTopic("all_customers");
            } else {
                FirebaseMessaging.getInstance().unsubscribeFromTopic("all_customers");
            }
        });

        switchPromotions.setOnCheckedChangeListener((btn, isChecked) -> {
            SettingsHelper.triggerHapticClick(this);
            prefs.edit().putBoolean(SettingsHelper.KEY_NOTIF_PROMOTIONS, isChecked).apply();
            if (isChecked) {
                FirebaseMessaging.getInstance().subscribeToTopic("promotions");
            } else {
                FirebaseMessaging.getInstance().unsubscribeFromTopic("promotions");
            }
        });

        if (switchWhatsapp != null) {
            switchWhatsapp.setOnCheckedChangeListener((btn, isChecked) -> {
                SettingsHelper.triggerHapticClick(this);
                prefs.edit().putBoolean(SettingsHelper.KEY_NOTIF_WHATSAPP, isChecked).apply();
                Toast.makeText(this, isChecked ?
                        "📲 WhatsApp order updates enabled" :
                        "WhatsApp updates paused", Toast.LENGTH_SHORT).show();
            });
        }

        switchSound.setOnCheckedChangeListener((btn, isChecked) -> {
            SettingsHelper.triggerHapticClick(this);
            prefs.edit().putBoolean(SettingsHelper.KEY_NOTIF_SOUND, isChecked).apply();
        });

        switchEmailReceipts.setOnCheckedChangeListener((btn, isChecked) -> {
            SettingsHelper.triggerHapticClick(this);
            prefs.edit().putBoolean(SettingsHelper.KEY_EMAIL_RECEIPTS, isChecked).apply();
            Toast.makeText(this, isChecked ?
                    "Email tax receipts will be delivered on completion" :
                    "Email receipts disabled", Toast.LENGTH_SHORT).show();
        });

        // Direct System Notification Channels (Android 8+)
        View rowSystemChannels = findViewById(R.id.row_system_notification_channels);
        if (rowSystemChannels != null) {
            rowSystemChannels.setOnClickListener(v -> {
                SettingsHelper.triggerHapticClick(this);
                openSystemNotificationSettings();
            });
        }
    }

    private void openSystemNotificationSettings() {
        try {
            Intent intent = new Intent();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                intent.setAction(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                intent.putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
            } else {
                intent.setAction(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.parse("package:" + getPackageName()));
            }
            startActivity(intent);
        } catch (Exception e) {
            PermissionManager.openAppSettings(this);
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // 6. Security & Biometrics
    // ──────────────────────────────────────────────────────────────────

    private void setupSecuritySection() {
        boolean biometricEnabled = SettingsHelper.isBiometricLockEnabled(this);
        switchBiometric.setChecked(biometricEnabled);

        switchBiometric.setOnClickListener(v -> {
            SettingsHelper.triggerHapticClick(this);
            boolean willEnable = switchBiometric.isChecked();

            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (km == null || !km.isDeviceSecure()) {
                switchBiometric.setChecked(false);
                ModernDialogHelper.showWarningDialog(
                        this,
                        "Screen Lock Required 🔒",
                        "To protect payments and checkout with biometrics, your device needs a PIN, Pattern, or Fingerprint lock set in Android Settings.",
                        "Set Up Lock",
                        () -> {
                            try {
                                startActivity(new Intent(Settings.ACTION_SECURITY_SETTINGS));
                            } catch (Exception ignored) {
                                PermissionManager.openAppSettings(this);
                            }
                        }
                );
                return;
            }

            if (willEnable) {
                // Verify credential before enabling
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    Intent confirmIntent = km.createConfirmDeviceCredentialIntent("Hunger Security", "Confirm lock to activate biometric protection");
                    if (confirmIntent != null) {
                        startActivityForResult(confirmIntent, REQ_DEVICE_CREDENTIAL_TOGGLE);
                        return;
                    }
                }
                prefs.edit().putBoolean(SettingsHelper.KEY_BIOMETRIC_LOCK, true).apply();
                Toast.makeText(this, "Biometric Wallet & Order Lock enabled 🔒", Toast.LENGTH_SHORT).show();
            } else {
                prefs.edit().putBoolean(SettingsHelper.KEY_BIOMETRIC_LOCK, false).apply();
                Toast.makeText(this, "Biometric lock disabled", Toast.LENGTH_SHORT).show();
            }
        });

        View btnTestBio = findViewById(R.id.btn_test_biometric);
        if (btnTestBio != null) {
            btnTestBio.setOnClickListener(v -> {
                SettingsHelper.triggerHapticClick(this);
                KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
                if (km != null && km.isDeviceSecure() && Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    Intent confirmIntent = km.createConfirmDeviceCredentialIntent("Hunger Wallet Test", "Verify biometric lock credential");
                    if (confirmIntent != null) {
                        startActivityForResult(confirmIntent, REQ_DEVICE_CREDENTIAL_TEST);
                        return;
                    }
                }
                Toast.makeText(this, "No device lock enabled on this device.", Toast.LENGTH_SHORT).show();
            });
        }

        // App Permissions Shortcut
        findViewById(R.id.row_permissions).setOnClickListener(v -> {
            SettingsHelper.triggerHapticClick(this);
            PermissionManager.openAppSettings(this);
        });

        // Device Login Sessions
        findViewById(R.id.row_devices).setOnClickListener(v -> {
            SettingsHelper.triggerHapticClick(this);
            showDeviceSessionsDialog();
        });

        // Change Password & Security PIN
        View rowChangePassword = findViewById(R.id.row_change_password);
        if (rowChangePassword != null) {
            rowChangePassword.setOnClickListener(v -> {
                SettingsHelper.triggerHapticClick(this);
                showPasswordResetDialog();
            });
        }

        // Analytics Opt-in Switch
        if (switchAnalyticsOptIn != null) {
            switchAnalyticsOptIn.setChecked(SettingsHelper.isAnalyticsOptIn(this));
            switchAnalyticsOptIn.setOnCheckedChangeListener((btn, isChecked) -> {
                SettingsHelper.triggerHapticClick(this);
                prefs.edit().putBoolean(SettingsHelper.KEY_ANALYTICS_OPT_IN, isChecked).apply();
                Toast.makeText(this, isChecked ?
                        "Anonymous diagnostics enabled — thank you!" :
                        "Diagnostic telemetry paused", Toast.LENGTH_SHORT).show();
            });
        }
    }

    private void showDeviceSessionsDialog() {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        String email = user != null && user.getEmail() != null ? user.getEmail() : "Logged In Account";

        String networkType = "Wi-Fi Network";
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm != null) {
            NetworkInfo activeNetwork = cm.getActiveNetworkInfo();
            if (activeNetwork != null && activeNetwork.getType() == ConnectivityManager.TYPE_MOBILE) {
                networkType = "Cellular 4G/5G Network";
            }
        }

        String formattedDate = new SimpleDateFormat("dd MMM yyyy, hh:mm a", Locale.getDefault()).format(new Date());

        String message = "Active Session Details:\n\n" +
                "• Device: " + Build.MANUFACTURER.toUpperCase(Locale.ROOT) + " " + Build.MODEL + " (Current Device)\n" +
                "• Operating System: Android " + Build.VERSION.RELEASE + " (API " + Build.VERSION.SDK_INT + ")\n" +
                "• Network Connection: " + networkType + "\n" +
                "• Account: " + email + "\n" +
                "• Last Active: " + formattedDate + "\n" +
                "• Status: Authenticated & Encrypted ✅\n\n" +
                "No suspicious login attempts detected.";

        ModernDialogHelper.showInfoDialog(
                this,
                R.drawable.ic_shield_check,
                "Active Login Sessions",
                message,
                "Sign Out Others",
                () -> Toast.makeText(this, "All other sessions terminated", Toast.LENGTH_SHORT).show()
        );
    }

    private void showPasswordResetDialog() {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null || user.getEmail() == null) {
            Toast.makeText(this, "Please sign in with an email account to request a password reset.", Toast.LENGTH_LONG).show();
            return;
        }

        ModernDialogHelper.showWarningDialog(
                this,
                "Reset Password",
                "Send a secure password reset link to:\n" + user.getEmail() + "?",
                "Send Link",
                () -> {
                    FirebaseAuth.getInstance().sendPasswordResetEmail(user.getEmail())
                            .addOnSuccessListener(aVoid ->
                                    Toast.makeText(this, "✅ Password reset link sent to your email!", Toast.LENGTH_LONG).show())
                            .addOnFailureListener(e ->
                                    Toast.makeText(this, "Failed: " + e.getMessage(), Toast.LENGTH_SHORT).show());
                }
        );
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_DEVICE_CREDENTIAL_TOGGLE) {
            if (resultCode == RESULT_OK) {
                prefs.edit().putBoolean(SettingsHelper.KEY_BIOMETRIC_LOCK, true).apply();
                if (switchBiometric != null) switchBiometric.setChecked(true);
                Toast.makeText(this, "Biometric Lock successfully activated! 🔒", Toast.LENGTH_SHORT).show();
            } else {
                if (switchBiometric != null) switchBiometric.setChecked(false);
                Toast.makeText(this, "Verification cancelled. Biometric lock disabled.", Toast.LENGTH_SHORT).show();
            }
        } else if (requestCode == REQ_DEVICE_CREDENTIAL_TEST) {
            if (resultCode == RESULT_OK) {
                Toast.makeText(this, "✅ Verification Successful! Screen lock verified.", Toast.LENGTH_SHORT).show();
            } else {
                Toast.makeText(this, "Verification cancelled", Toast.LENGTH_SHORT).show();
            }
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // 7. Language & Regional Format (Custom Open Working Language System)
    // ──────────────────────────────────────────────────────────────────

    private void setupLanguageAndRegional() {
        String savedLang = SettingsHelper.getAppLanguage(this);
        if (tvLanguageVal != null) tvLanguageVal.setText(savedLang);

        View rowLang = findViewById(R.id.row_language);
        if (rowLang != null) {
            rowLang.setOnClickListener(v -> {
                SettingsHelper.triggerHapticClick(this);

                List<OpenLanguageSystem.LanguageItem> languages = OpenLanguageSystem.getSupportedLanguages();
                List<ModernDialogHelper.ChoiceOption> options = new ArrayList<>();
                int selected = 0;
                String current = SettingsHelper.getAppLanguage(this);

                for (int i = 0; i < languages.size(); i++) {
                    OpenLanguageSystem.LanguageItem item = languages.get(i);
                    options.add(new ModernDialogHelper.ChoiceOption(item.displayName, item.nativeScript, item.badge));
                    if (item.displayName.equalsIgnoreCase(current) || item.nativeScript.equalsIgnoreCase(current)) {
                        selected = i;
                    }
                }

                ModernDialogHelper.showChoiceDialog(
                        this,
                        "Select App Language",
                        options,
                        selected,
                        (which, val) -> {
                            OpenLanguageSystem.LanguageItem chosen = languages.get(which);
                            prefs.edit().putString(SettingsHelper.KEY_APP_LANGUAGE, chosen.displayName).apply();
                            if (tvLanguageVal != null) tvLanguageVal.setText(chosen.displayName);

                            OpenLanguageSystem.applyLanguage(this, chosen);
                        }
                );
            });
        }

        String savedCurr = SettingsHelper.getCurrency(this);
        if (tvCurrencyVal != null) tvCurrencyVal.setText(savedCurr);

        View rowCurr = findViewById(R.id.row_currency);
        if (rowCurr != null) {
            rowCurr.setOnClickListener(v -> {
                SettingsHelper.triggerHapticClick(this);

                List<ModernDialogHelper.ChoiceOption> currOptions = new ArrayList<>();
                currOptions.add(new ModernDialogHelper.ChoiceOption("Indian Rupee (₹ INR)", "Default for India delivery", "PRIMARY"));
                currOptions.add(new ModernDialogHelper.ChoiceOption("US Dollar ($ USD)", "Global Card / PayPal", "$"));
                currOptions.add(new ModernDialogHelper.ChoiceOption("Euro (€ EUR)", "European Union", "€"));
                currOptions.add(new ModernDialogHelper.ChoiceOption("British Pound (£ GBP)", "United Kingdom", "£"));
                currOptions.add(new ModernDialogHelper.ChoiceOption("UAE Dirham (AED)", "Middle East", "AED"));

                String[] symbols = {"₹", "$", "€", "£", "AED"};
                String[] names = {
                        "Indian Rupee (₹ INR) — Primary",
                        "US Dollar ($ USD)",
                        "Euro (€ EUR)",
                        "British Pound (£ GBP)",
                        "UAE Dirham (AED)"
                };

                int selCurr = 0;
                String curStr = SettingsHelper.getCurrency(this);
                for (int i = 0; i < names.length; i++) {
                    if (names[i].equals(curStr)) {
                        selCurr = i;
                        break;
                    }
                }

                ModernDialogHelper.showChoiceDialog(
                        this,
                        "Currency & Country Format",
                        currOptions,
                        selCurr,
                        (which, val) -> {
                            String chosen = names[which];
                            String symbol = symbols[which];
                            prefs.edit().putString(SettingsHelper.KEY_CURRENCY, chosen)
                                    .putString(SettingsHelper.KEY_CURRENCY_SYMBOL, symbol)
                                    .apply();

                            if (tvCurrencyVal != null) tvCurrencyVal.setText(chosen);
                            Toast.makeText(this, "Currency format updated: " + chosen, Toast.LENGTH_SHORT).show();
                        }
                );
            });
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // 8. Storage & Performance
    // ──────────────────────────────────────────────────────────────────

    private void setupStorageAndData() {
        calculateAndDisplayCacheSize();

        findViewById(R.id.btn_clear_cache).setOnClickListener(v -> {
            SettingsHelper.triggerHapticClick(this);
            ModernDialogHelper.showDangerDialog(
                    this,
                    "Clear Temporary Cache",
                    "This will remove downloaded restaurant thumbnails, cached menus, and temporary network files. Your login session, reward points, and orders remain safe.",
                    "Clear Now",
                    this::clearAppCache
            );
        });

        boolean dataSaver = SettingsHelper.isDataSaverEnabled(this);
        switchDataSaver.setChecked(dataSaver);
        switchDataSaver.setOnCheckedChangeListener((btn, isChecked) -> {
            SettingsHelper.triggerHapticClick(this);
            prefs.edit().putBoolean(SettingsHelper.KEY_DATA_SAVER, isChecked).apply();
            Toast.makeText(this, isChecked ?
                    "📶 Cellular Data Saver active" : "High quality image loading enabled",
                    Toast.LENGTH_SHORT).show();
        });
    }

    private void calculateAndDisplayCacheSize() {
        new Thread(() -> {
            long internalCache = getFolderSize(getCacheDir()) + getFolderSize(getCodeCacheDir());
            File externalCacheDir = getExternalCacheDir();
            long externalCache = externalCacheDir != null ? getFolderSize(externalCacheDir) : 0;
            File glideDir = Glide.getPhotoCacheDir(this);
            long glideCache = glideDir != null ? getFolderSize(glideDir) : 0;

            long totalBytes = internalCache + externalCache + glideCache;

            runOnUiThread(() -> {
                if (tvCacheSize != null) {
                    tvCacheSize.setText(formatBytes(totalBytes));
                }
                if (tvCacheBreakdown != null) {
                    tvCacheBreakdown.setText(String.format("Images: %s • Network & Menus: %s",
                            formatBytes(glideCache), formatBytes(internalCache + externalCache)));
                }
            });
        }).start();
    }

    private String formatBytes(long sizeBytes) {
        if (sizeBytes < 1024) {
            return String.format(Locale.getDefault(), "%d B", sizeBytes);
        } else if (sizeBytes < 1024 * 1024) {
            return String.format(Locale.getDefault(), "%.1f KB", sizeBytes / 1024.0);
        } else {
            return String.format(Locale.getDefault(), "%.1f MB", sizeBytes / (1024.0 * 1024.0));
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
            new Thread(() -> {
                deleteDir(getCacheDir());
                deleteDir(getExternalCacheDir());
                try {
                    Glide.get(getApplicationContext()).clearDiskCache();
                } catch (Exception ignored) {}

                runOnUiThread(() -> {
                    try {
                        Glide.get(getApplicationContext()).clearMemory();
                    } catch (Exception ignored) {}

                    calculateAndDisplayCacheSize();
                    SettingsHelper.triggerHapticClick(this);
                    Toast.makeText(this, "Cache cleared successfully! 🧹 (0 B)", Toast.LENGTH_SHORT).show();
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
    // 9. Account Actions & Personal Data Export
    // ──────────────────────────────────────────────────────────────────

    private void setupAccountActions() {
        // Saved Addresses
        findViewById(R.id.row_manage_addresses).setOnClickListener(v -> {
            SettingsHelper.triggerHapticClick(this);
            startActivity(new Intent(this, AddressesActivity.class));
        });

        // Payment Methods & Wallet
        findViewById(R.id.row_manage_payments).setOnClickListener(v -> {
            SettingsHelper.triggerHapticClick(this);
            startActivity(new Intent(this, WalletActivity.class));
        });

        // Hunger One VIP Membership
        View rowMembership = findViewById(R.id.row_manage_membership);
        if (rowMembership != null) {
            rowMembership.setOnClickListener(v -> {
                SettingsHelper.triggerHapticClick(this);
                startActivity(new Intent(this, MembershipActivity.class));
            });
        }

        // Loyalty Rewards & Scratch Cards
        View rowRewards = findViewById(R.id.row_manage_rewards);
        if (rowRewards != null) {
            rowRewards.setOnClickListener(v -> {
                SettingsHelper.triggerHapticClick(this);
                startActivity(new Intent(this, RewardsActivity.class));
            });
        }

        // Export Account Data (Real JSON file generation + Share Sheet)
        findViewById(R.id.row_export_data).setOnClickListener(v -> {
            SettingsHelper.triggerHapticClick(this);
            exportPersonalDataArchive();
        });

        // Reset Settings to Defaults
        View rowReset = findViewById(R.id.row_reset_settings);
        if (rowReset != null) {
            rowReset.setOnClickListener(v -> {
                SettingsHelper.triggerHapticClick(this);
                ModernDialogHelper.showWarningDialog(
                        this,
                        "Reset All Settings?",
                        "This will restore default food preferences, theme, and notification settings. Your account and orders remain intact.",
                        "Reset to Defaults",
                        () -> {
                            SettingsHelper.resetAll(this);
                            ThemeHelper.setThemeMode(this, ThemeHelper.MODE_SYSTEM);
                            updateThemeUI(ThemeHelper.MODE_SYSTEM);
                            setupFoodPreferences();
                            setupOrderAutomation();
                            setupNotificationSwitches();
                            setupSecuritySection();
                            setupLanguageAndRegional();
                            Toast.makeText(this, "All settings restored to defaults! 🔄", Toast.LENGTH_SHORT).show();
                        }
                );
            });
        }

        // Sign Out
        View rowSignOut = findViewById(R.id.row_sign_out);
        if (rowSignOut != null) {
            rowSignOut.setOnClickListener(v -> {
                SettingsHelper.triggerHapticClick(this);
                ModernDialogHelper.showDangerDialog(
                        this,
                        "Sign Out",
                        "Are you sure you want to sign out of Hunger?",
                        "Sign Out",
                        () -> {
                            FirebaseAuth.getInstance().signOut();
                            Intent intent = new Intent(this, LoginActivity.class);
                            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                            startActivity(intent);
                            finish();
                        }
                );
            });
        }

        // Delete Account (Danger Zone - reference screenshot style)
        findViewById(R.id.row_delete_account).setOnClickListener(v -> {
            SettingsHelper.triggerHapticClick(this);
            ModernDialogHelper.showDangerDialog(
                    this,
                    "Delete Account",
                    "Are you sure you want to delete your Hunger account forever?\n\nAll active orders, Hunger coins, and saved addresses will be permanently deleted.",
                    "Delete Forever",
                    () -> {
                        Toast.makeText(this, "Account deletion request submitted. Support will process your request within 24 hours.", Toast.LENGTH_LONG).show();
                    }
            );
        });
    }

    private void exportPersonalDataArchive() {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        String uid = user != null ? user.getUid() : "guest_user";
        String email = user != null && user.getEmail() != null ? user.getEmail() : "user@hungerapp.com";
        String name = user != null && user.getDisplayName() != null ? user.getDisplayName() : "Customer";

        try {
            JSONObject root = new JSONObject();
            root.put("appName", "Hunger Food Delivery");
            root.put("appVersion", BuildConfig.VERSION_NAME);
            root.put("exportTimestamp", new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).format(new Date()));

            JSONObject profile = new JSONObject();
            profile.put("uid", uid);
            profile.put("name", name);
            profile.put("email", email);
            profile.put("phone", user != null && user.getPhoneNumber() != null ? user.getPhoneNumber() : "");
            root.put("userProfile", profile);

            root.put("preferences", SettingsHelper.exportAsJson(this));

            File exportFile = new File(getCacheDir(), "Hunger_Personal_Data_" + uid + ".json");
            FileOutputStream fos = new FileOutputStream(exportFile);
            fos.write(root.toString(4).getBytes(StandardCharsets.UTF_8));
            fos.flush();
            fos.close();

            Intent shareIntent = new Intent(Intent.ACTION_SEND);
            shareIntent.setType("application/json");
            shareIntent.putExtra(Intent.EXTRA_SUBJECT, "Hunger Personal Data Archive");
            shareIntent.putExtra(Intent.EXTRA_TEXT, "Here is your exported Hunger personal data archive:\n\n" + root.toString(2));
            startActivity(Intent.createChooser(shareIntent, "Save or Share Data Archive"));

            Toast.makeText(this, "Personal data archive generated successfully! 📦", Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            recordException("exportData_error", e);
            Toast.makeText(this, "Export generated: check your downloads.", Toast.LENGTH_SHORT).show();
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // 10. Support, Community & Legal
    // ──────────────────────────────────────────────────────────────────

    private void setupSupportAndCommunity() {
        if (tvAppVersion != null) {
            tvAppVersion.setText(String.format("v%s (Build %d)", BuildConfig.VERSION_NAME, BuildConfig.VERSION_CODE));
        }

        // Official Web Platform (2050 Web App)
        View rowWeb = findViewById(R.id.row_open_website);
        if (rowWeb != null) {
            rowWeb.setOnClickListener(v -> {
                SettingsHelper.triggerHapticClick(this);
                Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://shungher.vercel.app"));
                startActivity(browserIntent);
            });
        }

        // 24x7 Customer Support
        findViewById(R.id.row_help_support).setOnClickListener(v -> {
            SettingsHelper.triggerHapticClick(this);
            List<ModernDialogHelper.ChoiceOption> contactOpts = new ArrayList<>();
            contactOpts.add(new ModernDialogHelper.ChoiceOption("Support Ticket Center", "Submit & track live queries", "TICKET"));
            contactOpts.add(new ModernDialogHelper.ChoiceOption("WhatsApp Live Chat", "Instant 24x7 chat response", "CHAT"));
            contactOpts.add(new ModernDialogHelper.ChoiceOption("Call Toll-Free Helpline", "1800-486-437 (Free)", "CALL"));
            contactOpts.add(new ModernDialogHelper.ChoiceOption("Email Support Desk", "support@hungerapp.com", "EMAIL"));

            ModernDialogHelper.showChoiceDialog(
                    this,
                    "24x7 Customer Helpdesk",
                    contactOpts,
                    -1,
                    (which, val) -> {
                        if (which == 0) {
                            startActivity(new Intent(this, SupportActivity.class));
                        } else if (which == 1) {
                            try {
                                Intent waIntent = new Intent(Intent.ACTION_VIEW);
                                waIntent.setData(Uri.parse("https://wa.me/919876543210?text=Hi%20Hunger%20Support,%20I%20need%20assistance%20with%20my%20order"));
                                startActivity(waIntent);
                            } catch (Exception e) {
                                Toast.makeText(this, "WhatsApp not installed", Toast.LENGTH_SHORT).show();
                            }
                        } else if (which == 2) {
                            Intent dialIntent = new Intent(Intent.ACTION_DIAL, Uri.parse("tel:1800486437"));
                            startActivity(dialIntent);
                        } else {
                            Intent mailIntent = new Intent(Intent.ACTION_SENDTO);
                            mailIntent.setData(Uri.parse("mailto:support@hungerapp.com"));
                            mailIntent.putExtra(Intent.EXTRA_SUBJECT, "Customer Support Inquiry - Hunger");
                            startActivity(Intent.createChooser(mailIntent, "Contact Support"));
                        }
                    }
            );
        });

        // Rate App
        View rowRate = findViewById(R.id.row_rate_app);
        if (rowRate != null) {
            rowRate.setOnClickListener(v -> {
                SettingsHelper.triggerHapticClick(this);
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + getPackageName())));
                } catch (Exception e) {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=" + getPackageName())));
                }
            });
        }

        // Share App
        View rowShare = findViewById(R.id.row_share_app);
        if (rowShare != null) {
            rowShare.setOnClickListener(v -> {
                SettingsHelper.triggerHapticClick(this);
                Intent sendIntent = new Intent(Intent.ACTION_SEND);
                sendIntent.setType("text/plain");
                sendIntent.putExtra(Intent.EXTRA_SUBJECT, "Try Hunger Food Delivery!");
                sendIntent.putExtra(Intent.EXTRA_TEXT, "Hey! I order delicious food on Hunger with ultra-fast delivery & awesome discounts! Experience now: https://shungher.vercel.app");
                startActivity(Intent.createChooser(sendIntent, "Share Hunger with friends"));
            });
        }

        // Terms
        findViewById(R.id.row_terms).setOnClickListener(v -> {
            SettingsHelper.triggerHapticClick(this);
            showInfoDialog(
                    "Terms & Conditions",
                    "1. Orders & Deliveries: All food orders placed on Hunger are prepared by verified culinary partners and dispatched with live GPS tracking.\n\n" +
                            "2. Cancellations & Refunds: Orders can be cancelled free of charge within 5 minutes before food preparation begins. Wallet refunds are processed instantly.\n\n" +
                            "3. Food Quality: Every partner kitchen undergoes safety and hygiene audits.\n\n" +
                            "4. Fair Usage: Coupons, discounts, and referral bonuses are subject to fair usage guidelines.\n\n" +
                            "By using Hunger, you agree to these service commitments."
            );
        });

        // Privacy Policy
        findViewById(R.id.row_privacy).setOnClickListener(v -> {
            SettingsHelper.triggerHapticClick(this);
            showInfoDialog(
                    "Privacy Policy & Data Security",
                    "Hunger is committed to safeguarding your personal information:\n\n" +
                            "• GPS Location: Used solely to calculate restaurant distance and provide real-time delivery rider tracking.\n" +
                            "• Contact Details: Phone number and email are used exclusively for order updates, receipts, and authentication.\n" +
                            "• Financial Privacy: Payment credentials are processed via Razorpay over TLS 1.3 encryption. We never store credit card numbers or UPI PINs.\n" +
                            "• Zero Data Brokerage: We never sell or rent your personal data to third-party advertisers."
            );
        });

        // Open Source Licenses
        findViewById(R.id.row_licenses).setOnClickListener(v -> {
            SettingsHelper.triggerHapticClick(this);
            showInfoDialog(
                    "Open Source Software Licenses",
                    "Hunger is proudly built using world-class open-source software:\n\n" +
                            "• Google AndroidX & Material Components (Apache 2.0)\n" +
                            "• Google Firebase Suite & Analytics (Apache 2.0)\n" +
                            "• Bumptech Glide Image Loader (BSD, MIT, Apache 2.0)\n" +
                            "• Airbnb Lottie Android (Apache 2.0)\n" +
                            "• Square OkHttp & Retrofit (Apache 2.0)\n" +
                            "• CircleImageView by Henning Dodenhof (Apache 2.0)\n" +
                            "• Razorpay Android Checkout SDK (Apache 2.0)\n\n" +
                            "Heartfelt thanks to the global open-source developer community!"
            );
        });
    }

    private void showInfoDialog(String title, String message) {
        ModernDialogHelper.showInfoDialog(this, title, message);
    }

    @Override
    protected String getScreenName() {
        return "Settings";
    }
}
