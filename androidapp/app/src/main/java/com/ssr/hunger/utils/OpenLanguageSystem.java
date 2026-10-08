package com.ssr.hunger.utils;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import com.ssr.hunger.dialogs.ModernDialogHelper;

import java.util.ArrayList;
import java.util.List;

/**
 * OpenLanguageSystem — Custom Open Language Architecture for Hunger.
 * Allows effortless addition of new regional and international languages,
 * provides rich native display metadata (scripts, native names, country flags),
 * and seamlessly handles live application and activity recreation.
 */
public class OpenLanguageSystem {

    public static class LanguageItem {
        public final String code;
        public final String englishName;
        public final String nativeName;
        public final String scriptBadge;
        public final String flagEmoji;
        public final String displayName;
        public final String nativeScript;
        public final String badge;

        public LanguageItem(String code, String englishName, String nativeName, String scriptBadge, String flagEmoji) {
            this.code = code;
            this.englishName = englishName;
            this.nativeName = nativeName;
            this.scriptBadge = scriptBadge;
            this.flagEmoji = flagEmoji;
            this.displayName = englishName + " (" + nativeName + ")";
            this.nativeScript = nativeName + " • " + scriptBadge;
            this.badge = scriptBadge;
        }

        public String getFullDisplayName() {
            return flagEmoji + "  " + englishName + " (" + nativeName + ")";
        }

        public String getSubtitle() {
            return nativeName + " • " + scriptBadge;
        }
    }

    private static final List<LanguageItem> SUPPORTED_LANGUAGES = new ArrayList<>();

    static {
        SUPPORTED_LANGUAGES.add(new LanguageItem("en", "English", "India", "Default", "🇮🇳"));
        SUPPORTED_LANGUAGES.add(new LanguageItem("hi", "Hindi", "हिंदी", "Devanagari", "🇮🇳"));
        SUPPORTED_LANGUAGES.add(new LanguageItem("hinglish", "Hinglish", "हिंग्लिश", "Conversational", "🇮🇳"));
        SUPPORTED_LANGUAGES.add(new LanguageItem("bn", "Bengali", "বাংলা", "Eastern Nagari", "🇮🇳"));
        SUPPORTED_LANGUAGES.add(new LanguageItem("mr", "Marathi", "मराठी", "Devanagari", "🇮🇳"));
        SUPPORTED_LANGUAGES.add(new LanguageItem("gu", "Gujarati", "ગુજરાતી", "Gujarati Lipi", "🇮🇳"));
        SUPPORTED_LANGUAGES.add(new LanguageItem("ta", "Tamil", "தமிழ்", "Tamil Lipi", "🇮🇳"));
        SUPPORTED_LANGUAGES.add(new LanguageItem("te", "Telugu", "తెలుగు", "Telugu Lipi", "🇮🇳"));
        SUPPORTED_LANGUAGES.add(new LanguageItem("kn", "Kannada", "ಕನ್ನಡ", "Kannada Lipi", "🇮🇳"));
        SUPPORTED_LANGUAGES.add(new LanguageItem("pa", "Punjabi", "ਪੰਜਾਬੀ", "Gurmukhi", "🇮🇳"));
    }

    public static List<LanguageItem> getSupportedLanguages() {
        return new ArrayList<>(SUPPORTED_LANGUAGES);
    }

    public static LanguageItem getLanguageByCode(String code) {
        if (code == null) return SUPPORTED_LANGUAGES.get(0);
        for (LanguageItem item : SUPPORTED_LANGUAGES) {
            if (item.code.equalsIgnoreCase(code)) {
                return item;
            }
        }
        return SUPPORTED_LANGUAGES.get(0);
    }

    public static LanguageItem getCurrentLanguage(Context context) {
        String code = LocaleHelper.getLanguageCode(context);
        return getLanguageByCode(code);
    }

    public static int getSelectedIndex(Context context) {
        String code = LocaleHelper.getLanguageCode(context);
        for (int i = 0; i < SUPPORTED_LANGUAGES.size(); i++) {
            if (SUPPORTED_LANGUAGES.get(i).code.equalsIgnoreCase(code)) {
                return i;
            }
        }
        return 0;
    }

    public static List<ModernDialogHelper.ChoiceOption> getChoiceOptions() {
        List<ModernDialogHelper.ChoiceOption> options = new ArrayList<>();
        for (LanguageItem item : SUPPORTED_LANGUAGES) {
            options.add(new ModernDialogHelper.ChoiceOption(
                    item.getFullDisplayName(),
                    item.getSubtitle(),
                    item.code
            ));
        }
        return options;
    }

    /**
     * Applies new language to app, updates resources, saves preferences,
     * and restarts the given Activity with a smooth transition.
     */
    public static void applyLanguage(Activity activity, LanguageItem chosenLanguage) {
        if (activity == null || chosenLanguage == null) return;

        // Persist code and full display name
        LocaleHelper.persist(activity, chosenLanguage.code);
        LocaleHelper.persistName(activity, chosenLanguage.getFullDisplayName());
        LocaleHelper.setLocale(activity, chosenLanguage.code);

        // Also update SettingsHelper pref
        SharedPreferences prefs = SettingsHelper.getPrefs(activity);
        prefs.edit().putString(SettingsHelper.KEY_APP_LANGUAGE, chosenLanguage.getFullDisplayName()).apply();

        // Show banner confirmation
        ModernDialogHelper.showBannerToast(
                activity,
                false,
                "Language Updated 🌐",
                "App language switched to " + chosenLanguage.englishName + " (" + chosenLanguage.nativeName + ")"
        );

        // Recreate activity smoothly
        Intent intent = activity.getIntent();
        activity.overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out);
        activity.finish();
        activity.overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out);
        activity.startActivity(intent);
    }

    public static void applyLanguage(Activity activity, String code, String displayName) {
        LanguageItem item = getLanguageByCode(code);
        if (item != null) {
            applyLanguage(activity, item);
        } else {
            LocaleHelper.persist(activity, code);
            if (displayName != null) {
                LocaleHelper.persistName(activity, displayName);
            }
            LocaleHelper.setLocale(activity, code);
            if (activity != null) activity.recreate();
        }
    }
}
