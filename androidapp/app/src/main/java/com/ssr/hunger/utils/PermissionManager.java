package com.ssr.hunger.utils;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.annotation.DrawableRes;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.google.android.material.bottomsheet.BottomSheetDialog;
import com.google.android.material.button.MaterialButton;
import com.ssr.hunger.R;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Centralized Permission Manager for AKR Hunger.
 * Handles ALL Android permission types with beautiful custom dialogs.
 *
 * Supported permission types:
 *  - LOCATION (fine + coarse)
 *  - CAMERA
 *  - STORAGE (images/media, adapts to SDK version)
 *  - NOTIFICATIONS (Android 13+)
 *  - PHONE (call phone)
 *  - MICROPHONE (voice search)
 *  - CONTACTS
 *  - BIOMETRIC (system-level, no runtime request needed)
 *
 * Usage:
 *  PermissionManager.with(activity)
 *      .type(PermissionManager.Type.LOCATION)
 *      .onGranted(() -> doSomething())
 *      .onDenied(() -> handleDenied())
 *      .show();
 */
public class PermissionManager {

    // ──────────────────────────────────────────────────────────────────
    // Permission Types
    // ──────────────────────────────────────────────────────────────────
    public enum Type {
        LOCATION,
        CAMERA,
        STORAGE,
        NOTIFICATIONS,
        PHONE,
        MICROPHONE,
        CONTACTS,
        LOCATION_BACKGROUND
    }

    // ──────────────────────────────────────────────────────────────────
    // Request Codes
    // ──────────────────────────────────────────────────────────────────
    public static final int RC_LOCATION     = 1001;
    public static final int RC_CAMERA       = 1002;
    public static final int RC_STORAGE      = 1003;
    public static final int RC_NOTIFICATION = 1004;
    public static final int RC_PHONE        = 1005;
    public static final int RC_MICROPHONE   = 1006;
    public static final int RC_CONTACTS     = 1007;
    public static final int RC_BG_LOCATION  = 1008;

    // ──────────────────────────────────────────────────────────────────
    // Static permission → requestCode map
    // ──────────────────────────────────────────────────────────────────
    private static final Map<Type, Integer> REQUEST_CODES = new HashMap<Type, Integer>() {{
        put(Type.LOCATION,            RC_LOCATION);
        put(Type.CAMERA,              RC_CAMERA);
        put(Type.STORAGE,             RC_STORAGE);
        put(Type.NOTIFICATIONS,       RC_NOTIFICATION);
        put(Type.PHONE,               RC_PHONE);
        put(Type.MICROPHONE,          RC_MICROPHONE);
        put(Type.CONTACTS,            RC_CONTACTS);
        put(Type.LOCATION_BACKGROUND, RC_BG_LOCATION);
    }};

    // ──────────────────────────────────────────────────────────────────
    // Callbacks
    // ──────────────────────────────────────────────────────────────────
    public interface Callback {
        void onGranted();
    }

    public interface DeniedCallback {
        void onDenied(boolean isPermanent);
    }

    // ──────────────────────────────────────────────────────────────────
    // Builder
    // ──────────────────────────────────────────────────────────────────
    private final Activity activity;
    private Type permType;
    private Callback grantedCallback;
    private DeniedCallback deniedCallback;

    private PermissionManager(Activity activity) {
        this.activity = activity;
    }

    public static PermissionManager with(@NonNull Activity activity) {
        return new PermissionManager(activity);
    }

    public PermissionManager type(Type type) {
        this.permType = type;
        return this;
    }

    public PermissionManager onGranted(Callback callback) {
        this.grantedCallback = callback;
        return this;
    }

    public PermissionManager onDenied(DeniedCallback callback) {
        this.deniedCallback = callback;
        return this;
    }

    /** Entry point — checks if already granted, shows dialog if not. */
    public void check() {
        if (isGranted(activity, permType)) {
            if (grantedCallback != null) grantedCallback.onGranted();
        } else {
            showPermissionDialog();
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // Check helpers (static, for use anywhere)
    // ──────────────────────────────────────────────────────────────────

    public static boolean isGranted(@NonNull Context ctx, @NonNull Type type) {
        if (type == Type.STORAGE) {
            if (Build.VERSION.SDK_INT >= 34) {
                boolean full = ContextCompat.checkSelfPermission(ctx, Manifest.permission.READ_MEDIA_IMAGES) == PackageManager.PERMISSION_GRANTED;
                boolean partial = ContextCompat.checkSelfPermission(ctx, Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED) == PackageManager.PERMISSION_GRANTED;
                return full || partial;
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                return ContextCompat.checkSelfPermission(ctx, Manifest.permission.READ_MEDIA_IMAGES) == PackageManager.PERMISSION_GRANTED;
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                return ContextCompat.checkSelfPermission(ctx, Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;
            }
            return true;
        }
        for (String perm : getPermissionsForType(type)) {
            if (ContextCompat.checkSelfPermission(ctx, perm) != PackageManager.PERMISSION_GRANTED) {
                return false;
            }
        }
        return true;
    }

    public static boolean isLocationGranted(@NonNull Context ctx) {
        return isGranted(ctx, Type.LOCATION);
    }

    public static boolean isCameraGranted(@NonNull Context ctx) {
        return isGranted(ctx, Type.CAMERA);
    }

    public static boolean isStorageGranted(@NonNull Context ctx) {
        return isGranted(ctx, Type.STORAGE);
    }

    public static boolean isNotificationGranted(@NonNull Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return isGranted(ctx, Type.NOTIFICATIONS);
        }
        return true; // Below Android 13, notifications are always allowed
    }

    public static boolean isMicrophoneGranted(@NonNull Context ctx) {
        return isGranted(ctx, Type.MICROPHONE);
    }

    public static boolean isPhoneGranted(@NonNull Context ctx) {
        return isGranted(ctx, Type.PHONE);
    }

    // ──────────────────────────────────────────────────────────────────
    // Permission → String[] mapping
    // ──────────────────────────────────────────────────────────────────

    @NonNull
    public static String[] getPermissionsForType(@NonNull Type type) {
        switch (type) {
            case LOCATION:
                return new String[]{
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                };
            case LOCATION_BACKGROUND:
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    return new String[]{Manifest.permission.ACCESS_BACKGROUND_LOCATION};
                }
                return new String[]{Manifest.permission.ACCESS_FINE_LOCATION};
            case CAMERA:
                return new String[]{Manifest.permission.CAMERA};
            case STORAGE:
                if (Build.VERSION.SDK_INT >= 34) {
                    return new String[]{
                        Manifest.permission.READ_MEDIA_IMAGES,
                        Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED
                    };
                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    return new String[]{
                        Manifest.permission.READ_MEDIA_IMAGES
                    };
                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    return new String[]{
                        Manifest.permission.READ_EXTERNAL_STORAGE
                    };
                }
                return new String[]{};
            case NOTIFICATIONS:
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    return new String[]{Manifest.permission.POST_NOTIFICATIONS};
                }
                return new String[]{};
            case PHONE:
                return new String[]{Manifest.permission.CALL_PHONE};
            case MICROPHONE:
                return new String[]{Manifest.permission.RECORD_AUDIO};
            case CONTACTS:
                return new String[]{Manifest.permission.READ_CONTACTS};
            default:
                return new String[]{};
        }
    }

    public static int getRequestCode(@NonNull Type type) {
        Integer rc = REQUEST_CODES.get(type);
        return rc != null ? rc : 9999;
    }

    // ──────────────────────────────────────────────────────────────────
    // Direct request (skip dialog) — used from PermissionResultHandler
    // ──────────────────────────────────────────────────────────────────

    public static void requestPermission(@NonNull Activity activity, @NonNull Type type) {
        String[] perms = getPermissionsForType(type);
        if (perms.length > 0) {
            ActivityCompat.requestPermissions(activity, perms, getRequestCode(type));
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // Result Handler — call from Activity.onRequestPermissionsResult
    // ──────────────────────────────────────────────────────────────────

    public static boolean handleResult(
            @NonNull Activity activity,
            int requestCode,
            @NonNull String[] permissions,
            @NonNull int[] grantResults,
            @Nullable Callback onGranted,
            @Nullable DeniedCallback onDenied
    ) {
        // Match which type this request belongs to
        Type matchedType = null;
        for (Map.Entry<Type, Integer> entry : REQUEST_CODES.entrySet()) {
            if (entry.getValue() == requestCode) {
                matchedType = entry.getKey();
                break;
            }
        }
        if (matchedType == null) return false;

        boolean allGranted = grantResults.length > 0;
        if (matchedType == Type.STORAGE && Build.VERSION.SDK_INT >= 34) {
            boolean anyGranted = false;
            for (int result : grantResults) {
                if (result == PackageManager.PERMISSION_GRANTED) {
                    anyGranted = true;
                    break;
                }
            }
            allGranted = anyGranted;
        } else {
            for (int result : grantResults) {
                if (result != PackageManager.PERMISSION_GRANTED) {
                    allGranted = false;
                    break;
                }
            }
        }

        if (allGranted) {
            if (onGranted != null) onGranted.onGranted();
        } else {
            boolean isPermanent = false;
            for (String perm : permissions) {
                if (!ActivityCompat.shouldShowRequestPermissionRationale(activity, perm)) {
                    isPermanent = true;
                    break;
                }
            }
            if (onDenied != null) onDenied.onDenied(isPermanent);
        }
        return true;
    }

    // ──────────────────────────────────────────────────────────────────
    // Open app settings (when permanently denied)
    // ──────────────────────────────────────────────────────────────────

    public static void openAppSettings(@NonNull Context context) {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        intent.setData(Uri.fromParts("package", context.getPackageName(), null));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(intent);
    }

    // ──────────────────────────────────────────────────────────────────
    // Beautiful Permission Dialog (Bottom Sheet)
    // ──────────────────────────────────────────────────────────────────

    private void showPermissionDialog() {
        if (activity == null || activity.isFinishing() || activity.isDestroyed()) return;

        PermissionConfig config = getConfigForType(permType);
        boolean isPermanentlyDenied = isPermanentlyDenied(activity, permType);

        BottomSheetDialog dialog = new BottomSheetDialog(activity, R.style.ThemeOverlay_AKR_BottomSheetDialog_Rounded);

        View view = LayoutInflater.from(activity).inflate(R.layout.dialog_permission, null);
        dialog.setContentView(view);

        // Icon
        ImageView ivIcon = view.findViewById(R.id.iv_permission_icon);
        if (ivIcon != null && config.iconRes != 0) {
            ivIcon.setImageResource(config.iconRes);
        }

        // Title
        TextView tvTitle = view.findViewById(R.id.tv_permission_title);
        if (tvTitle != null) tvTitle.setText(config.title);

        // Subtitle
        TextView tvSubtitle = view.findViewById(R.id.tv_permission_subtitle);
        if (tvSubtitle != null) tvSubtitle.setText(config.description);

        // Features
        LinearLayout llFeatures = view.findViewById(R.id.ll_permission_features);
        if (llFeatures != null && config.features != null) {
            for (String feature : config.features) {
                View row = LayoutInflater.from(activity).inflate(R.layout.item_permission_feature, llFeatures, false);
                TextView tv = row.findViewById(R.id.tv_feature_text);
                if (tv != null) tv.setText(feature);
                llFeatures.addView(row);
            }
        }

        // Settings hint
        View llSettingsHint = view.findViewById(R.id.ll_settings_hint);
        if (llSettingsHint != null && isPermanentlyDenied) {
            llSettingsHint.setVisibility(View.VISIBLE);
        }

        // Allow button
        MaterialButton btnAllow = view.findViewById(R.id.btn_permission_allow);
        if (btnAllow != null) {
            btnAllow.setText(isPermanentlyDenied ? "Open Settings" : config.allowText);
            btnAllow.setOnClickListener(v -> {
                dialog.dismiss();
                if (isPermanentlyDenied) {
                    openAppSettings(activity);
                } else {
                    requestPermission(activity, permType);
                }
            });
        }

        // Deny button
        MaterialButton btnDeny = view.findViewById(R.id.btn_permission_deny);
        if (btnDeny != null) {
            btnDeny.setOnClickListener(v -> {
                dialog.dismiss();
                if (deniedCallback != null) deniedCallback.onDenied(isPermanentlyDenied);
            });
        }

        dialog.show();
    }

    // ──────────────────────────────────────────────────────────────────
    // Config per Permission Type
    // ──────────────────────────────────────────────────────────────────

    private static class PermissionConfig {
        @DrawableRes int iconRes;
        String title;
        String description;
        String allowText;
        List<String> features;

        PermissionConfig(int iconRes, String title, String description, String allowText, String... features) {
            this.iconRes = iconRes;
            this.title = title;
            this.description = description;
            this.allowText = allowText;
            this.features = new ArrayList<>(Arrays.asList(features));
        }
    }

    @NonNull
    private PermissionConfig getConfigForType(@NonNull Type type) {
        switch (type) {
            case LOCATION:
                return new PermissionConfig(
                    R.drawable.ic_location,
                    "Enable Location Access",
                    "We need your location to show nearby restaurants, calculate accurate delivery times, and ensure your food arrives at the right address.",
                    "Allow Location",
                    "Find restaurants near you",
                    "Accurate delivery ETA",
                    "Correct delivery address auto-fill",
                    "Real-time order tracking on map"
                );
            case LOCATION_BACKGROUND:
                return new PermissionConfig(
                    R.drawable.ic_location,
                    "Allow Background Location",
                    "Background location is needed so delivery partners can track your order even when the app is minimized.",
                    "Allow Always",
                    "Live driver tracking on map",
                    "ETA updates while app is in background",
                    "Delivery arrival notifications"
                );
            case CAMERA:
                return new PermissionConfig(
                    R.drawable.ic_camera,
                    "Camera Access",
                    "We need camera access to let you upload a profile photo, capture food review photos, and scan QR codes for quick payments.",
                    "Allow Camera",
                    "Upload profile photo",
                    "Share food review photos",
                    "Scan QR codes for payment"
                );
            case STORAGE:
                return new PermissionConfig(
                    R.drawable.ic_image,
                    "Photo Library Access",
                    "Allow access to your photos so you can set a profile picture and attach images to your food reviews.",
                    "Allow Photos",
                    "Set a profile photo from gallery",
                    "Attach food review images",
                    "Save receipts and order screenshots"
                );
            case NOTIFICATIONS:
                return new PermissionConfig(
                    R.drawable.ic_bell,
                    "Enable Notifications",
                    "Get real-time updates on your order status — when it's confirmed, being prepared, picked up, and delivered. Never miss a delivery!",
                    "Enable Notifications",
                    "Order confirmed & preparation updates",
                    "Driver pickup & delivery alerts",
                    "Exclusive deals and promotions",
                    "Wallet & payment confirmations"
                );
            case PHONE:
                return new PermissionConfig(
                    R.drawable.ic_phone,
                    "Phone Call Access",
                    "This permission lets you call your delivery driver directly from the app when your order is on the way.",
                    "Allow Phone",
                    "Call delivery driver directly",
                    "Quick contact for delivery issues",
                    "One-tap driver communication"
                );
            case MICROPHONE:
                return new PermissionConfig(
                    R.drawable.ic_microphone,
                    "Microphone for Voice Search",
                    "Use your voice to search for restaurants and dishes hands-free. Just tap the mic and speak — it's that easy.",
                    "Allow Microphone",
                    "Voice search for restaurants",
                    "Hands-free food search",
                    "Fast & accurate voice recognition"
                );
            case CONTACTS:
                return new PermissionConfig(
                    R.drawable.ic_profile,
                    "Access Contacts",
                    "Invite friends to AKR Hunger and share referral codes easily from your contacts.",
                    "Allow Contacts",
                    "Invite friends via contacts",
                    "Share referral codes easily",
                    "Auto-fill delivery contact details"
                );
            default:
                return new PermissionConfig(
                    R.drawable.ic_shield_check,
                    "Permission Required",
                    "This feature requires a permission to work properly. Please allow it to continue.",
                    "Allow",
                    "Feature access required"
                );
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // Permanently Denied check
    // ──────────────────────────────────────────────────────────────────

    private boolean isPermanentlyDenied(@NonNull Activity activity, @NonNull Type type) {
        String[] perms = getPermissionsForType(type);
        for (String perm : perms) {
            if (ContextCompat.checkSelfPermission(activity, perm) != PackageManager.PERMISSION_GRANTED
                    && !ActivityCompat.shouldShowRequestPermissionRationale(activity, perm)) {
                // Never asked before or permanently denied
                // We use SharedPrefs to track "asked before"
                String key = "perm_asked_" + perm;
                boolean askedBefore = activity.getSharedPreferences("akr_perms", Context.MODE_PRIVATE)
                        .getBoolean(key, false);
                if (askedBefore) return true;
                // Mark as asked
                activity.getSharedPreferences("akr_perms", Context.MODE_PRIVATE)
                        .edit().putBoolean(key, true).apply();
            }
        }
        return false;
    }

    // ──────────────────────────────────────────────────────────────────
    // Convenience static show methods
    // ──────────────────────────────────────────────────────────────────

    /** One-liner: show location permission if not granted, then call callback. */
    public static void requireLocation(@NonNull Activity activity,
                                        @NonNull Callback onGranted,
                                        @Nullable DeniedCallback onDenied) {
        PermissionManager.with(activity)
                .type(Type.LOCATION)
                .onGranted(onGranted)
                .onDenied(onDenied)
                .check();
    }

    public static void requireCamera(@NonNull Activity activity,
                                      @NonNull Callback onGranted,
                                      @Nullable DeniedCallback onDenied) {
        PermissionManager.with(activity)
                .type(Type.CAMERA)
                .onGranted(onGranted)
                .onDenied(onDenied)
                .check();
    }

    public static void requireStorage(@NonNull Activity activity,
                                       @NonNull Callback onGranted,
                                       @Nullable DeniedCallback onDenied) {
        PermissionManager.with(activity)
                .type(Type.STORAGE)
                .onGranted(onGranted)
                .onDenied(onDenied)
                .check();
    }

    public static void requireNotifications(@NonNull Activity activity,
                                             @NonNull Callback onGranted,
                                             @Nullable DeniedCallback onDenied) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            // Already granted below Android 13
            onGranted.onGranted();
            return;
        }
        PermissionManager.with(activity)
                .type(Type.NOTIFICATIONS)
                .onGranted(onGranted)
                .onDenied(onDenied)
                .check();
    }

    public static void requireMicrophone(@NonNull Activity activity,
                                          @NonNull Callback onGranted,
                                          @Nullable DeniedCallback onDenied) {
        PermissionManager.with(activity)
                .type(Type.MICROPHONE)
                .onGranted(onGranted)
                .onDenied(onDenied)
                .check();
    }

    public static void requirePhone(@NonNull Activity activity,
                                     @NonNull Callback onGranted,
                                     @Nullable DeniedCallback onDenied) {
        PermissionManager.with(activity)
                .type(Type.PHONE)
                .onGranted(onGranted)
                .onDenied(onDenied)
                .check();
    }
}
