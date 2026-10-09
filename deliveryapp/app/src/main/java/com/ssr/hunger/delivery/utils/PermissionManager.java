package com.ssr.hunger.delivery.utils;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import java.util.ArrayList;
import java.util.List;

/**
 * Utility helper for managing runtime Android permissions:
 * - Location (Coarse & Fine)
 * - Push Notifications (Android 13+ TIRAMISU)
 * - Camera (Proof of delivery & Bag KYC)
 * - Storage / Photos (Android 13+ READ_MEDIA_IMAGES or legacy storage)
 * - Phone Calling (Direct call to customer / restaurant)
 */
public class PermissionManager {

    public static final int PERMISSION_REQUEST_ALL = 2001;

    public static boolean hasLocationPermission(Context context) {
        return ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
    }

    public static boolean hasNotificationPermission(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
                    == PackageManager.PERMISSION_GRANTED;
        }
        return true;
    }

    public static boolean hasCameraPermission(Context context) {
        return ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA)
                == PackageManager.PERMISSION_GRANTED;
    }

    public static boolean hasPhonePermission(Context context) {
        return ContextCompat.checkSelfPermission(context, Manifest.permission.CALL_PHONE)
                == PackageManager.PERMISSION_GRANTED;
    }

    public static boolean hasAllEssentialPermissions(Context context) {
        return hasLocationPermission(context)
                && hasNotificationPermission(context);
    }

    public static String[] getMissingPermissions(Context context) {
        List<String> missing = new ArrayList<>();

        if (!hasLocationPermission(context)) {
            missing.add(Manifest.permission.ACCESS_FINE_LOCATION);
            missing.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (!hasNotificationPermission(context)) {
                missing.add(Manifest.permission.POST_NOTIFICATIONS);
            }
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_MEDIA_IMAGES)
                    != PackageManager.PERMISSION_GRANTED) {
                missing.add(Manifest.permission.READ_MEDIA_IMAGES);
            }
        } else {
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_EXTERNAL_STORAGE)
                    != PackageManager.PERMISSION_GRANTED) {
                missing.add(Manifest.permission.READ_EXTERNAL_STORAGE);
            }
        }

        if (!hasCameraPermission(context)) {
            missing.add(Manifest.permission.CAMERA);
        }

        if (!hasPhonePermission(context)) {
            missing.add(Manifest.permission.CALL_PHONE);
        }

        return missing.toArray(new String[0]);
    }

    public static void requestAllMissingPermissions(Activity activity, int requestCode) {
        String[] missing = getMissingPermissions(activity);
        if (missing.length > 0) {
            ActivityCompat.requestPermissions(activity, missing, requestCode);
        }
    }

    public static void openAppSettings(Context context) {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        Uri uri = Uri.fromParts("package", context.getPackageName(), null);
        intent.setData(uri);
        context.startActivity(intent);
    }
}
