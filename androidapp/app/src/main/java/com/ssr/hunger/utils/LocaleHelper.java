package com.ssr.hunger.utils;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.content.res.Resources;
import android.os.Build;
import android.os.LocaleList;

import java.util.Locale;

/**
 * Manages runtime app locale and language switching.
 */
public class LocaleHelper {

    private static final String PREF_LANG = "app_locale_pref";
    private static final String KEY_LOCALE = "selected_locale";

    public static Context setLocale(Context context, String languageCode) {
        persist(context, languageCode);
        return updateResources(context, languageCode);
    }

    public static String getLanguageCode(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_LANG, Context.MODE_PRIVATE);
        return prefs.getString(KEY_LOCALE, "en");
    }

    private static void persist(Context context, String languageCode) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_LANG, Context.MODE_PRIVATE);
        prefs.edit().putString(KEY_LOCALE, languageCode).apply();
    }

    public static Context updateResources(Context context, String languageCode) {
        Locale locale = new Locale(languageCode);
        Locale.setDefault(locale);

        Resources resources = context.getResources();
        Configuration configuration = resources.getConfiguration();

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
        if (name.contains("Bengali") || name.contains("বাংলা")) return "bn";
        if (name.contains("Marathi") || name.contains("मराठी")) return "mr";
        if (name.contains("Tamil") || name.contains("தமிழ்")) return "ta";
        if (name.contains("Telugu") || name.contains("తెలుగు")) return "te";
        if (name.contains("Gujarati") || name.contains("ગુજરાતી")) return "gu";
        return "en";
    }
}
