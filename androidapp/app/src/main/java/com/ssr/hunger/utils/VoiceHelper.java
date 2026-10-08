package com.ssr.hunger.utils;

import android.content.Context;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.util.Log;
import android.widget.Toast;

import java.util.Locale;

/**
 * Text-to-Speech Helper for live spoken order announcements.
 * Announces order updates like "Order Confirmed", "Kitchen Preparing Food", "Rider Out For Delivery".
 */
public class VoiceHelper {

    private static final String TAG = "VoiceHelper";
    private static VoiceHelper instance;
    private TextToSpeech tts;
    private boolean isReady = false;
    private Context appContext;

    private VoiceHelper(Context context) {
        this.appContext = context.getApplicationContext();
        initTts();
    }

    public static synchronized VoiceHelper getInstance(Context context) {
        if (instance == null) {
            instance = new VoiceHelper(context);
        }
        return instance;
    }

    private void initTts() {
        tts = new TextToSpeech(appContext, status -> {
            if (status == TextToSpeech.SUCCESS) {
                int res = tts.setLanguage(Locale.getDefault());
                if (res == TextToSpeech.LANG_MISSING_DATA || res == TextToSpeech.LANG_NOT_SUPPORTED) {
                    tts.setLanguage(Locale.US);
                }
                tts.setPitch(1.05f);
                tts.setSpeechRate(0.95f);
                isReady = true;
                Log.d(TAG, "TextToSpeech initialized successfully");
            } else {
                Log.w(TAG, "Failed to initialize TextToSpeech: status=" + status);
            }
        });
    }

    /**
     * Speaks the given message if voice announcements are enabled in settings.
     */
    public void speakOrderUpdate(String message) {
        if (!SettingsHelper.isVoiceAnnouncementsEnabled(appContext)) return;
        speakImmediate(message);
    }

    /**
     * Speaks immediately (used for testing or critical announcements).
     */
    public void speakImmediate(String message) {
        if (message == null || message.trim().isEmpty()) return;

        if (!isReady || tts == null) {
            initTts();
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                if (tts != null && isReady) {
                    doSpeak(message);
                }
            }, 800);
            return;
        }

        doSpeak(message);
    }

    private void doSpeak(String message) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                tts.speak(message, TextToSpeech.QUEUE_FLUSH, null, "ORDER_TTS_" + System.currentTimeMillis());
            } else {
                tts.speak(message, TextToSpeech.QUEUE_FLUSH, null);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error speaking: " + e.getMessage());
        }
    }

    /**
     * Test voice announcement directly from SettingsActivity.
     */
    public void testAnnouncement(Context context) {
        String testMessage = "Hunger Live Update: Order #4829 from Biryani By Kilo is freshly packed and rider Rahul is 2 minutes away!";
        Toast.makeText(context, "🎙️ Playing voice announcement preview...", Toast.LENGTH_SHORT).show();
        speakImmediate(testMessage);
    }

    public void release() {
        if (tts != null) {
            try {
                tts.stop();
                tts.shutdown();
            } catch (Exception ignored) {
            }
            tts = null;
            isReady = false;
        }
    }
}
