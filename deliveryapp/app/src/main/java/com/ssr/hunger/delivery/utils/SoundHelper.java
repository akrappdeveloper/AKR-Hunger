package com.ssr.hunger.delivery.utils;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.util.Log;

/**
 * Sound & Haptic Helper for distinct delivery events:
 * - New Order Incoming Alert (Urgent loud beep & rapid pulse)
 * - Payment / Cash Credited (Upbeat chime & double tap)
 * - Status Updates (Soft ping)
 * - Emergency / SOS Siren (Loud high siren)
 */
public class SoundHelper {

    private static final String TAG = "SoundHelper";

    private static Vibrator getVibrator(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager vm = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            return vm != null ? vm.getDefaultVibrator() : null;
        } else {
            return (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
        }
    }

    /**
     * Urgent alert for incoming order broadcast
     */
    public static void playNewOrderAlert(Context context) {
        try {
            // Loud high dual-tone dispatch chime
            ToneGenerator toneGen = new ToneGenerator(AudioManager.STREAM_ALARM, 100);
            toneGen.startTone(ToneGenerator.TONE_CDMA_ALERT_NETWORK_LITE, 500);

            Vibrator vibrator = getVibrator(context);
            if (vibrator != null && vibrator.hasVibrator()) {
                long[] pattern = new long[]{0, 300, 150, 300, 150, 400};
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1));
                } else {
                    vibrator.vibrate(pattern, -1);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error playing new order alert", e);
        }
    }

    /**
     * Pleasant cash / payout credited sound
     */
    public static void playPaymentAlert(Context context) {
        try {
            ToneGenerator toneGen = new ToneGenerator(AudioManager.STREAM_NOTIFICATION, 95);
            // Melodic confirmation beep
            toneGen.startTone(ToneGenerator.TONE_PROP_BEEP2, 350);

            Vibrator vibrator = getVibrator(context);
            if (vibrator != null && vibrator.hasVibrator()) {
                long[] pattern = new long[]{0, 120, 80, 200};
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1));
                } else {
                    vibrator.vibrate(pattern, -1);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error playing payment alert", e);
        }
    }

    /**
     * Soft ping for general status updates (food ready, assigned, etc.)
     */
    public static void playStatusAlert(Context context) {
        try {
            ToneGenerator toneGen = new ToneGenerator(AudioManager.STREAM_NOTIFICATION, 85);
            toneGen.startTone(ToneGenerator.TONE_PROP_PROMPT, 200);

            Vibrator vibrator = getVibrator(context);
            if (vibrator != null && vibrator.hasVibrator()) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createOneShot(150, VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    vibrator.vibrate(150);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error playing status alert", e);
        }
    }

    /**
     * Loud continuous siren for Emergency / SOS
     */
    public static void playEmergencyAlert(Context context) {
        try {
            ToneGenerator toneGen = new ToneGenerator(AudioManager.STREAM_ALARM, 100);
            toneGen.startTone(ToneGenerator.TONE_CDMA_EMERGENCY_RINGBACK, 1000);

            Vibrator vibrator = getVibrator(context);
            if (vibrator != null && vibrator.hasVibrator()) {
                long[] pattern = new long[]{0, 800, 300, 800};
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1));
                } else {
                    vibrator.vibrate(pattern, -1);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error playing emergency alert", e);
        }
    }
}
