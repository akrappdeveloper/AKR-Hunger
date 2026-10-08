package com.ssr.hunger.utils;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.media.RingtoneManager;
import android.os.Build;
import android.util.Log;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.FieldValue;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.SetOptions;
import com.google.firebase.messaging.FirebaseMessaging;
import com.ssr.hunger.AKRHungerApp;
import com.ssr.hunger.R;
import com.ssr.hunger.activities.MainActivity;
import com.ssr.hunger.activities.NotificationsActivity;
import com.ssr.hunger.activities.OrderDetailActivity;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Centralized Notification and FCM helper.
 * Handles:
 * - Device FCM token synchronization with Firestore (`customers` & `users` collections)
 * - Persisting notifications in Firestore (`notifications` collection) so they appear in NotificationsActivity
 * - Showing high-priority local push notifications with deep links to OrderDetailActivity
 * - Runtime notification permission requests for Android 13+ (API 33+)
 */
public class NotificationHelper {

    private static final String TAG = "NotificationHelper";
    private static final String PREF_FCM_TOKEN = "cached_fcm_token";
    public static final int PERMISSION_REQUEST_NOTIFICATION = 1001;

    /**
     * Retrieves the current FCM token and syncs it with Firestore for the logged-in customer.
     */
    public static void syncFcmToken(Context context) {
        if (context == null) return;

        FirebaseMessaging.getInstance().getToken()
                .addOnSuccessListener(token -> {
                    if (token != null && !token.trim().isEmpty()) {
                        Log.d(TAG, "Retrieved FCM Token: " + token);
                        cacheFcmToken(context, token);

                        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
                        if (user != null) {
                            saveFcmTokenForUser(context, user.getUid(), token);
                        }
                    }
                })
                .addOnFailureListener(e -> Log.w(TAG, "Failed to retrieve FCM token: " + e.getMessage()));
    }

    /**
     * Saves the FCM token to SharedPreferences for local caching.
     */
    public static void cacheFcmToken(Context context, String token) {
        if (context == null || token == null) return;
        SharedPreferences prefs = context.getSharedPreferences(Constants.PREF_USER, Context.MODE_PRIVATE);
        prefs.edit().putString(PREF_FCM_TOKEN, token).apply();
    }

    /**
     * Gets the cached FCM token, if available.
     */
    public static String getCachedFcmToken(Context context) {
        if (context == null) return null;
        SharedPreferences prefs = context.getSharedPreferences(Constants.PREF_USER, Context.MODE_PRIVATE);
        return prefs.getString(PREF_FCM_TOKEN, null);
    }

    /**
     * Persists the FCM token to Firestore in both `customers/{uid}` and `users/{uid}` collections.
     */
    public static void saveFcmTokenForUser(Context context, String uid, String token) {
        if (uid == null || token == null || token.trim().isEmpty()) return;

        cacheFcmToken(context, token);

        Map<String, Object> update = new HashMap<>();
        update.put("fcmToken", token);
        update.put("fcmTokenUpdatedAt", FieldValue.serverTimestamp());
        update.put("platform", "android");

        FirebaseFirestore db = FirebaseFirestore.getInstance();

        // 1. Update customers collection (used by Android app)
        db.collection(Constants.COLLECTION_CUSTOMERS).document(uid)
                .set(update, SetOptions.merge())
                .addOnSuccessListener(aVoid -> Log.d(TAG, "FCM token saved to customers/" + uid))
                .addOnFailureListener(e -> Log.w(TAG, "Failed saving FCM token to customers: " + e.getMessage()));

        // 2. Update users collection (used by web app / backend API routes)
        db.collection("users").document(uid)
                .set(update, SetOptions.merge())
                .addOnSuccessListener(aVoid -> Log.d(TAG, "FCM token saved to users/" + uid))
                .addOnFailureListener(e -> Log.w(TAG, "Failed saving FCM token to users: " + e.getMessage()));
    }

    /**
     * Creates an order confirmation notification:
     * 1. Saves it to Firestore `notifications` collection so it displays in NotificationsActivity.
     * 2. Fires a high-priority system status bar notification with deep link to OrderDetailActivity.
     */
    public static void sendOrderNotification(
            Context context,
            String userId,
            String orderId,
            String restaurantName,
            double total,
            String status
    ) {
        if (userId == null || orderId == null) return;

        String shortId = orderId.length() >= 6 ? orderId.substring(orderId.length() - 6).toUpperCase() : orderId.toUpperCase();
        String rName = (restaurantName != null && !restaurantName.trim().isEmpty()) ? restaurantName : "Restaurant";

        String title;
        String message;

        if ("confirmed".equalsIgnoreCase(status) || "pending".equalsIgnoreCase(status)) {
            title = "Order Confirmed! 🎉";
            message = String.format(Locale.getDefault(), "Your order from %s for ₹%.0f has been placed successfully! Order #%s", rName, total, shortId);
        } else if ("preparing".equalsIgnoreCase(status)) {
            title = "Kitchen is Preparing Food 🍳";
            message = String.format(Locale.getDefault(), "%s is preparing your delicious meal for Order #%s.", rName, shortId);
        } else if ("ready".equalsIgnoreCase(status)) {
            title = "Order Ready for Pickup 📦";
            message = String.format(Locale.getDefault(), "Order #%s from %s is freshly packed and ready for delivery partner pickup.", shortId, rName);
        } else if ("out_for_delivery".equalsIgnoreCase(status)) {
            title = "Out for Delivery! 🛵";
            message = String.format(Locale.getDefault(), "Your order #%s from %s is on the way with your delivery partner!", shortId, rName);
        } else if ("delivered".equalsIgnoreCase(status)) {
            title = "Order Delivered! 🍽️";
            message = String.format(Locale.getDefault(), "Order #%s from %s was delivered. Enjoy your meal!", shortId, rName);
        } else if ("cancelled".equalsIgnoreCase(status)) {
            title = "Order Cancelled ❌";
            message = String.format(Locale.getDefault(), "Your order #%s has been cancelled.", shortId);
        } else {
            title = "Order Update 🍽️";
            message = String.format(Locale.getDefault(), "Your order #%s status is now: %s.", shortId, status);
        }

        // 1. Persist notification in Firestore collection `notifications`
        Map<String, Object> notifData = new HashMap<>();
        notifData.put("userId", userId);
        notifData.put("userType", "customer");
        notifData.put("type", "order");
        notifData.put("subType", "order-" + status.toLowerCase());
        notifData.put("title", title);
        notifData.put("message", message);
        notifData.put("orderId", orderId);
        notifData.put("read", false);
        notifData.put("isRead", false);
        notifData.put("deleted", false);
        notifData.put("actionUrl", "/customer/orders/" + orderId);
        notifData.put("createdAt", FieldValue.serverTimestamp());

        Map<String, Object> metadata = new HashMap<>();
        metadata.put("orderId", orderId);
        metadata.put("restaurantName", rName);
        metadata.put("total", total);
        metadata.put("status", status);
        notifData.put("metadata", metadata);

        FirebaseFirestore.getInstance()
                .collection(Constants.COLLECTION_NOTIFICATIONS)
                .add(notifData)
                .addOnSuccessListener(doc -> Log.d(TAG, "Order notification created in Firestore: " + doc.getId()))
                .addOnFailureListener(e -> Log.e(TAG, "Failed creating notification in Firestore: " + e.getMessage()));

        // 2. Display high priority local system notification
        if (context != null) {
            showLocalNotification(context, title, message, orderId, "order");
            if (SettingsHelper.isVoiceAnnouncementsEnabled(context)) {
                VoiceHelper.getInstance(context).speakOrderUpdate(message);
            }
        }
    }

    /**
     * Saves an incoming notification into Firestore `notifications` collection if needed.
     */
    public static void saveNotificationToFirestore(
            String userId,
            String title,
            String message,
            String orderId,
            String type
    ) {
        if (userId == null || title == null) return;

        Map<String, Object> notifData = new HashMap<>();
        notifData.put("userId", userId);
        notifData.put("userType", "customer");
        notifData.put("type", type != null ? type : "order");
        notifData.put("title", title);
        notifData.put("message", message != null ? message : "");
        notifData.put("orderId", orderId != null ? orderId : "");
        notifData.put("read", false);
        notifData.put("isRead", false);
        notifData.put("deleted", false);
        notifData.put("createdAt", FieldValue.serverTimestamp());

        FirebaseFirestore.getInstance()
                .collection(Constants.COLLECTION_NOTIFICATIONS)
                .add(notifData)
                .addOnSuccessListener(doc -> Log.d(TAG, "Notification saved from FCM payload: " + doc.getId()))
                .addOnFailureListener(e -> Log.w(TAG, "Failed saving FCM notification to Firestore: " + e.getMessage()));
    }

    /**
     * Displays a system notification with appropriate channel, sound, vibration, and deep-link intent.
     */
    public static void showLocalNotification(
            Context context,
            String title,
            String body,
            String orderId,
            String type
    ) {
        if (context == null) return;

        boolean isOrder = "order".equalsIgnoreCase(type);
        boolean isPromo = "promo".equalsIgnoreCase(type) || "promotions".equalsIgnoreCase(type);
        if (isOrder && !SettingsHelper.isOrderNotifEnabled(context)) {
            Log.d(TAG, "Order notification suppressed per user settings");
            return;
        }
        if (isPromo && !SettingsHelper.isPromoNotifEnabled(context)) {
            Log.d(TAG, "Promo notification suppressed per user settings");
            return;
        }

        // Choose appropriate channel
        String channelId = AKRHungerApp.CHANNEL_ORDERS;
        if (isPromo) {
            channelId = AKRHungerApp.CHANNEL_PROMOTIONS;
        } else if ("system".equalsIgnoreCase(type) || "general".equalsIgnoreCase(type)) {
            channelId = AKRHungerApp.CHANNEL_GENERAL;
        }

        // Ensure channel exists (especially if invoked from FCMService background worker)
        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager == null) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = notificationManager.getNotificationChannel(channelId);
            if (channel == null) {
                channel = new NotificationChannel(
                        channelId,
                        "Order Updates",
                        NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("Real-time order status updates and delivery tracking");
                channel.enableVibration(true);
                channel.setShowBadge(true);
                notificationManager.createNotificationChannel(channel);
            }
        }

        // Deep link Intent
        Intent intent;
        if (orderId != null && !orderId.trim().isEmpty()) {
            intent = new Intent(context, OrderDetailActivity.class);
            intent.putExtra(Constants.EXTRA_ORDER_ID, orderId.trim());
        } else if ("notifications".equalsIgnoreCase(type)) {
            intent = new Intent(context, NotificationsActivity.class);
        } else {
            intent = new Intent(context, MainActivity.class);
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        int pendingIntentFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pendingIntentFlags |= PendingIntent.FLAG_IMMUTABLE;
        }

        int uniqueRequestCode = (orderId != null ? orderId.hashCode() : (int) System.currentTimeMillis());
        PendingIntent pendingIntent = PendingIntent.getActivity(context, uniqueRequestCode, intent, pendingIntentFlags);

        boolean soundEnabled = SettingsHelper.isSoundNotifEnabled(context);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_EVENT)
                .setContentIntent(pendingIntent);

        if (soundEnabled) {
            builder.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION));
        } else {
            builder.setSilent(true);
        }

        int notificationId = (orderId != null && !orderId.isEmpty()) ?
                Math.abs(orderId.hashCode()) : (int) (System.currentTimeMillis() % Integer.MAX_VALUE);

        try {
            notificationManager.notify(notificationId, builder.build());
        } catch (SecurityException se) {
            Log.w(TAG, "Notification permission missing: " + se.getMessage());
        }
    }

    /**
     * Checks and requests runtime notification permission on Android 13+ (API 33+).
     */
    public static void requestNotificationPermission(Activity activity) {
        if (activity == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(activity, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                        activity,
                        new String[]{Manifest.permission.POST_NOTIFICATIONS},
                        PERMISSION_REQUEST_NOTIFICATION
                );
            }
        }
    }
}
