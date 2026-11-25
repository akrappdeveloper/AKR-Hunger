package com.ssr.hunger.delivery.utils;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.widget.Toast;

import com.ssr.hunger.delivery.AKRDeliveryApp;

/**
 * Safe Toast Utility that avoids NullPointerException when Context or Fragment is null/detached,
 * ensures execution on UI thread, and uses application context.
 */
public class ToastUtils {

    public static void showToast(Context context, String message) {
        showToast(context, message, Toast.LENGTH_SHORT);
    }

    public static void showToast(Context context, String message, int length) {
        if (message == null) return;
        Context target = context;
        if (target == null) {
            target = AKRDeliveryApp.getAppContext();
        }
        if (target == null) return;

        final Context finalCtx = target.getApplicationContext() != null ? target.getApplicationContext() : target;
        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                Toast.makeText(finalCtx, message, length).show();
            } catch (Exception ignored) {
            }
        });
    }

    public static void showToast(String message) {
        showToast(null, message, Toast.LENGTH_SHORT);
    }

    public static void showToast(String message, int length) {
        showToast(null, message, length);
    }
}
