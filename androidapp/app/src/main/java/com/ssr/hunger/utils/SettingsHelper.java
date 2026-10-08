package com.ssr.hunger.utils;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;

import org.json.JSONObject;

/**
 * Centralized Settings Helper for AKR Hunger.
 * Stores, retrieves, and enforces all user preferences across activities.
 */
public class SettingsHelper {

    public static final String PREF_SETTINGS = "user_settings_prefs";

    // Appearance
    public static final String KEY_THEME_MODE = "theme_mode";
    public static final String KEY_REDUCE_ANIMATIONS = "pref_reduce_animations";

    // Dining & Food Preferences
    public static final String KEY_FOOD_VEG_ONLY = "pref_veg_only";
    public static final String KEY_ECO_CUTLERY = "pref_eco_cutlery";
    public static final String KEY_AUTO_COUPON = "pref_auto_coupon";
    public static final String KEY_DELIVERY_PRESET = "pref_delivery_preset";
    public static final String KEY_SPICE_LEVEL = "pref_spice_level";
    public static final String KEY_COOKING_INSTRUCTION = "pref_cooking_instruction";

    // Order Automation
    public static final String KEY_AUTO_POINTS = "pref_auto_points";
    public static final String KEY_QUICK_REORDER = "pref_quick_reorder";
    public static final String KEY_VOICE_ANNOUNCEMENTS = "pref_voice_announcements";
    public static final String KEY_HAPTIC_FEEDBACK = "pref_haptic_feedback";
    public static final String KEY_DEFAULT_PAYMENT = "pref_default_payment";

    // Notifications
    public static final String KEY_NOTIF_ORDERS = "notif_orders";
    public static final String KEY_NOTIF_PROMOTIONS = "notif_promotions";
    public static final String KEY_NOTIF_WHATSAPP = "pref_whatsapp_updates";
    public static final String KEY_NOTIF_SOUND = "notif_sound";
    public static final String KEY_EMAIL_RECEIPTS = "notif_email_receipts";

    // Security & Diagnostics
    public static final String KEY_BIOMETRIC_LOCK = "pref_biometric_lock";
    public static final String KEY_DATA_SAVER = "pref_data_saver";
    public static final String KEY_ANALYTICS_OPT_IN = "pref_analytics_opt_in";

    // Regional
    public static final String KEY_APP_LANGUAGE = "pref_app_language";
    public static final String KEY_CURRENCY = "pref_currency";
    public static final String KEY_CURRENCY_SYMBOL = "pref_currency_symbol";

    public static SharedPreferences getPrefs(Context context) {
        return context.getSharedPreferences(PREF_SETTINGS, Context.MODE_PRIVATE);
    }

    // ── Getters ──────────────────────────────────────────────────────────

    public static boolean isVegOnly(Context context) {
        return getPrefs(context).getBoolean(KEY_FOOD_VEG_ONLY, false);
    }

    public static boolean isEcoCutlery(Context context) {
        return getPrefs(context).getBoolean(KEY_ECO_CUTLERY, true);
    }

    public static boolean isAutoCouponEnabled(Context context) {
        return getPrefs(context).getBoolean(KEY_AUTO_COUPON, true);
    }

    public static String getDeliveryPreset(Context context) {
        return getPrefs(context).getString(KEY_DELIVERY_PRESET, "Leave at the door / Ring bell");
    }

    public static String getSpiceLevel(Context context) {
        return getPrefs(context).getString(KEY_SPICE_LEVEL, "Medium Balanced 🔥");
    }

    public static String getCookingInstruction(Context context) {
        return getPrefs(context).getString(KEY_COOKING_INSTRUCTION, "Standard (Kitchen defaults)");
    }

    public static boolean isAutoRedeemPoints(Context context) {
        return getPrefs(context).getBoolean(KEY_AUTO_POINTS, true);
    }

    public static boolean isQuickReorderEnabled(Context context) {
        return getPrefs(context).getBoolean(KEY_QUICK_REORDER, true);
    }

    public static boolean isVoiceAnnouncementsEnabled(Context context) {
        return getPrefs(context).getBoolean(KEY_VOICE_ANNOUNCEMENTS, false);
    }

    public static boolean isHapticFeedbackEnabled(Context context) {
        return getPrefs(context).getBoolean(KEY_HAPTIC_FEEDBACK, true);
    }

    public static String getDefaultPayment(Context context) {
        return getPrefs(context).getString(KEY_DEFAULT_PAYMENT, "UPI / Google Pay / PhonePe");
    }

    public static boolean isOrderNotifEnabled(Context context) {
        return getPrefs(context).getBoolean(KEY_NOTIF_ORDERS, true);
    }

    public static boolean isPromoNotifEnabled(Context context) {
        return getPrefs(context).getBoolean(KEY_NOTIF_PROMOTIONS, true);
    }

    public static boolean isWhatsappNotifEnabled(Context context) {
        return getPrefs(context).getBoolean(KEY_NOTIF_WHATSAPP, true);
    }

    public static boolean isSoundNotifEnabled(Context context) {
        return getPrefs(context).getBoolean(KEY_NOTIF_SOUND, true);
    }

    public static boolean isEmailReceiptsEnabled(Context context) {
        return getPrefs(context).getBoolean(KEY_EMAIL_RECEIPTS, true);
    }

    public static boolean isBiometricLockEnabled(Context context) {
        return getPrefs(context).getBoolean(KEY_BIOMETRIC_LOCK, false);
    }

    public static boolean isDataSaverEnabled(Context context) {
        return getPrefs(context).getBoolean(KEY_DATA_SAVER, false);
    }

    public static boolean isAnalyticsOptIn(Context context) {
        return getPrefs(context).getBoolean(KEY_ANALYTICS_OPT_IN, true);
    }

    public static boolean isReduceAnimations(Context context) {
        return getPrefs(context).getBoolean(KEY_REDUCE_ANIMATIONS, false);
    }

    public static String getAppLanguage(Context context) {
        return getPrefs(context).getString(KEY_APP_LANGUAGE, "English (India)");
    }

    public static String getCurrency(Context context) {
        return getPrefs(context).getString(KEY_CURRENCY, "Indian Rupee (₹ INR)");
    }

    public static String getCurrencySymbol(Context context) {
        return getPrefs(context).getString(KEY_CURRENCY_SYMBOL, "₹");
    }

    // ── Haptic Vibrations ────────────────────────────────────────────────

    public static void triggerHapticClick(Context context) {
        if (context == null || !isHapticFeedbackEnabled(context)) return;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager vm = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                if (vm != null) {
                    Vibrator v = vm.getDefaultVibrator();
                    v.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_CLICK));
                }
            } else {
                Vibrator v = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
                if (v != null && v.hasVibrator()) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        v.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_CLICK));
                    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        v.vibrate(VibrationEffect.createOneShot(25, VibrationEffect.DEFAULT_AMPLITUDE));
                    } else {
                        v.vibrate(25);
                    }
                }
            }
        } catch (Exception ignored) {
        }
    }

    // ── Reset ────────────────────────────────────────────────────────────

    public static void resetAll(Context context) {
        getPrefs(context).edit().clear().apply();
    }

    // ── JSON Export ──────────────────────────────────────────────────────

    public static JSONObject exportAsJson(Context context) {
        JSONObject json = new JSONObject();
        try {
            SharedPreferences p = getPrefs(context);
            json.put("vegOnly", p.getBoolean(KEY_FOOD_VEG_ONLY, false));
            json.put("ecoCutlery", p.getBoolean(KEY_ECO_CUTLERY, true));
            json.put("autoCoupon", p.getBoolean(KEY_AUTO_COUPON, true));
            json.put("deliveryPreset", p.getString(KEY_DELIVERY_PRESET, "Leave at the door / Ring bell"));
            json.put("spiceLevel", p.getString(KEY_SPICE_LEVEL, "Medium Balanced 🔥"));
            json.put("cookingInstruction", p.getString(KEY_COOKING_INSTRUCTION, "Standard"));
            json.put("autoPoints", p.getBoolean(KEY_AUTO_POINTS, true));
            json.put("quickReorder", p.getBoolean(KEY_QUICK_REORDER, true));
            json.put("voiceAnnouncements", p.getBoolean(KEY_VOICE_ANNOUNCEMENTS, false));
            json.put("hapticFeedback", p.getBoolean(KEY_HAPTIC_FEEDBACK, true));
            json.put("defaultPayment", p.getString(KEY_DEFAULT_PAYMENT, "UPI / Google Pay / PhonePe"));
            json.put("notifyOrders", p.getBoolean(KEY_NOTIF_ORDERS, true));
            json.put("notifyPromotions", p.getBoolean(KEY_NOTIF_PROMOTIONS, true));
            json.put("notifyWhatsapp", p.getBoolean(KEY_NOTIF_WHATSAPP, true));
            json.put("notifySound", p.getBoolean(KEY_NOTIF_SOUND, true));
            json.put("emailReceipts", p.getBoolean(KEY_EMAIL_RECEIPTS, true));
            json.put("biometricLock", p.getBoolean(KEY_BIOMETRIC_LOCK, false));
            json.put("dataSaver", p.getBoolean(KEY_DATA_SAVER, false));
            json.put("analyticsOptIn", p.getBoolean(KEY_ANALYTICS_OPT_IN, true));
            json.put("language", p.getString(KEY_APP_LANGUAGE, "English (India)"));
            json.put("currency", p.getString(KEY_CURRENCY, "Indian Rupee (₹ INR)"));
        } catch (Exception ignored) {
        }
        return json;
    }
}
