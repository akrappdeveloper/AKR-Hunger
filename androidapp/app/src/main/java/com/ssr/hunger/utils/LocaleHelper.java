package com.ssr.hunger.utils;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.content.res.Resources;
import android.os.Build;
import android.os.LocaleList;

import java.util.Locale;

/**
 * Manages runtime app locale and open custom language switching.
 * Seamlessly integrates with BaseActivity.attachBaseContext and dynamic configuration updates.
 */
public class LocaleHelper {

    private static final String PREF_LANG = "app_locale_pref";
    public static final String KEY_LOCALE = "selected_locale";
    public static final String KEY_LOCALE_NAME = "selected_locale_name";

    public static Context onAttach(Context context) {
        String lang = getLanguageCode(context);
        return setLocale(context, lang);
    }

    public static Context setLocale(Context context, String languageCode) {
        if (languageCode == null || languageCode.isEmpty()) {
            languageCode = "en";
        }
        persist(context, languageCode);
        return updateResources(context, languageCode);
    }

    public static String getLanguageCode(Context context) {
        if (context == null) return "en";
        SharedPreferences prefs = context.getSharedPreferences(PREF_LANG, Context.MODE_PRIVATE);
        return prefs.getString(KEY_LOCALE, "en");
    }

    public static String getLanguageName(Context context) {
        if (context == null) return "English (India)";
        SharedPreferences prefs = context.getSharedPreferences(PREF_LANG, Context.MODE_PRIVATE);
        return prefs.getString(KEY_LOCALE_NAME, "English (India)");
    }

    public static void persist(Context context, String languageCode) {
        if (context == null) return;
        SharedPreferences prefs = context.getSharedPreferences(PREF_LANG, Context.MODE_PRIVATE);
        prefs.edit().putString(KEY_LOCALE, languageCode).apply();
    }

    public static void persistName(Context context, String languageName) {
        if (context == null) return;
        SharedPreferences prefs = context.getSharedPreferences(PREF_LANG, Context.MODE_PRIVATE);
        prefs.edit().putString(KEY_LOCALE_NAME, languageName).apply();
    }

    public static Context updateResources(Context context, String languageCode) {
        // Hinglish uses English system locale with transliterated strings
        String effectiveCode = "hinglish".equalsIgnoreCase(languageCode) ? "en" : languageCode;
        Locale locale = new Locale(effectiveCode);
        Locale.setDefault(locale);

        Resources resources = context.getResources();
        Configuration configuration = new Configuration(resources.getConfiguration());

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            configuration.setLocale(locale);
            LocaleList localeList = new LocaleList(locale);
            LocaleList.setDefault(localeList);
            configuration.setLocales(localeList);
            return context.createConfigurationContext(configuration);
        } else {
            configuration.locale = locale;
            resources.updateConfiguration(configuration, resources.getDisplayMetrics());
            return context;
        }
    }

    public static String getLanguageCodeFromName(String name) {
        if (name == null) return "en";
        if (name.contains("Hindi") || name.contains("हिंदी")) return "hi";
        if (name.contains("Hinglish") || name.contains("हिंग्लिश")) return "hinglish";
        if (name.contains("Bengali") || name.contains("বাংলা")) return "bn";
        if (name.contains("Marathi") || name.contains("मराठी")) return "mr";
        if (name.contains("Tamil") || name.contains("தமிழ்")) return "ta";
        if (name.contains("Telugu") || name.contains("తెలుగు")) return "te";
        if (name.contains("Gujarati") || name.contains("ગુજરાતી")) return "gu";
        if (name.contains("Kannada") || name.contains("ಕನ್ನಡ")) return "kn";
        if (name.contains("Punjabi") || name.contains("ਪੰਜਾਬੀ")) return "pa";
        return "en";
    }
}
