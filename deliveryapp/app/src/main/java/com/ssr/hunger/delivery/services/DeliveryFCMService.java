package com.ssr.hunger.delivery.services;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.RingtoneManager;
import android.net.Uri;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import com.ssr.hunger.delivery.R;
import com.ssr.hunger.delivery.activities.LiveTrackingRadarActivity;
import com.ssr.hunger.delivery.activities.MainActivity;
import com.ssr.hunger.delivery.activities.OrderActiveDetailActivity;
import com.ssr.hunger.delivery.activities.VkycVideoCallActivity;
import com.ssr.hunger.delivery.utils.Constants;
import com.ssr.hunger.delivery.utils.SoundHelper;

import java.util.Map;

/**
 * Firebase Cloud Messaging Service for Delivery Partners.
 * Dispatches distinct high-priority notifications with specific sound channels,
 * actionable pending intents, and rich payload parsing:
 * - New Order Broadcast (with Accept / Decline actions)
 * - Payment / Wallet Credit (with View Balance action)
 * - Order Status Updates (Food Ready, Cancelled)
 * - Emergency SOS Alerts
 */
public class DeliveryFCMService extends FirebaseMessagingService {

    private static final String TAG = "DeliveryFCMService";

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        Log.d(TAG, "New FCM Token registered: " + token);
        FirebaseAuth auth = FirebaseAuth.getInstance();
        if (auth.getCurrentUser() != null) {
            FirebaseFirestore.getInstance()
                    .collection(Constants.COLLECTION_DELIVERY_PERSONS)
                    .document(auth.getCurrentUser().getUid())
                    .update("fcmToken", token)
                    .addOnFailureListener(e -> Log.e(TAG, "Failed to update FCM token", e));
        }
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        super.onMessageReceived(message);

        String title = "Hunger Delivery Alert";
        String body = "You have a new update.";
        String type = "general";
        String orderId = null;
        String amount = null;

        // 1. Read Notification payload
        if (message.getNotification() != null) {
            if (message.getNotification().getTitle() != null) {
                title = message.getNotification().getTitle();
            }
            if (message.getNotification().getBody() != null) {
                body = message.getNotification().getBody();
            }
        }

        // 2. Read Data payload
        Map<String, String> data = message.getData();
        if (data.containsKey("title")) title = data.get("title");
        if (data.containsKey("body")) body = data.get("body");
        if (data.containsKey("type")) type = data.get("type");
        if (data.containsKey("orderId")) orderId = data.get("orderId");
        String callId = null;
        String adminName = "Hunger Admin Desk";
        if (data.containsKey("callId")) callId = data.get("callId");
        if (data.containsKey("adminName")) adminName = data.get("adminName");

        int notificationId = (int) (System.currentTimeMillis() % 100000);

        // 3. Handle by notification type
        if ("new_order".equalsIgnoreCase(type) || "order".equalsIgnoreCase(type)) {
            SoundHelper.playNewOrderAlert(this);
            showNewOrderNotification(notificationId, title, body, orderId);
        } else if ("vkyc_call".equalsIgnoreCase(type) || "vkyc".equalsIgnoreCase(type)) {
            SoundHelper.playEmergencyAlert(this);
            showVkycCallNotification(notificationId, title, body, callId, adminName);
        } else if ("vkyc_completed".equalsIgnoreCase(type) || "kyc_approved".equalsIgnoreCase(type)) {
            SoundHelper.playPaymentAlert(this);
            showVkycCompletedNotification(notificationId, title, body);
        } else if ("payment".equalsIgnoreCase(type) || "wallet".equalsIgnoreCase(type) || "payout".equalsIgnoreCase(type)) {
            SoundHelper.playPaymentAlert(this);
            showPaymentNotification(notificationId, title, body, amount);
        } else if ("emergency".equalsIgnoreCase(type) || "sos".equalsIgnoreCase(type)) {
            SoundHelper.playEmergencyAlert(this);
            showEmergencyNotification(notificationId, title, body);
        } else if ("status_update".equalsIgnoreCase(type) || "status".equalsIgnoreCase(type)) {
            SoundHelper.playStatusAlert(this);
            showStatusNotification(notificationId, title, body, orderId);
        } else {
            SoundHelper.playStatusAlert(this);
            showGeneralNotification(notificationId, title, body);
        }
    }

    private void showNewOrderNotification(int id, String title, String body, String orderId) {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        // Intent to accept or view dashboard
        Intent mainIntent = new Intent(this, MainActivity.class);
        mainIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (orderId != null) mainIntent.putExtra(Constants.EXTRA_ORDER_ID, orderId);

        PendingIntent pIntent = PendingIntent.getActivity(
                this, id, mainIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Uri defaultSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, Constants.CHANNEL_ORDERS)
                .setSmallIcon(R.drawable.ic_scooter_fast)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setAutoCancel(true)
                .setSound(defaultSound)
                .setVibrate(new long[]{0, 500, 200, 500, 200, 500})
                .setContentIntent(pIntent)
                .addAction(R.drawable.ic_check_circle, "View & Accept", pIntent);

        manager.notify(id, builder.build());
    }

    private void showPaymentNotification(int id, String title, String body, String amount) {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        Intent walletIntent = new Intent(this, MainActivity.class);
        walletIntent.putExtra("navigate_to", "wallet");
        walletIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);

        PendingIntent pIntent = PendingIntent.getActivity(
                this, id, walletIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, Constants.CHANNEL_PAYMENTS)
                .setSmallIcon(R.drawable.ic_wallet)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setVibrate(new long[]{0, 200, 100, 300})
                .setContentIntent(pIntent)
                .addAction(R.drawable.ic_wallet, "Open Wallet", pIntent);

        manager.notify(id, builder.build());
    }

    private void showStatusNotification(int id, String title, String body, String orderId) {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        Intent intent;
        if (orderId != null && !orderId.isEmpty()) {
            intent = new Intent(this, OrderActiveDetailActivity.class);
            intent.putExtra(Constants.EXTRA_ORDER_ID, orderId);
        } else {
            intent = new Intent(this, MainActivity.class);
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);

        PendingIntent pIntent = PendingIntent.getActivity(
                this, id, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, Constants.CHANNEL_STATUS)
                .setSmallIcon(R.drawable.ic_receipt_long)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setAutoCancel(true)
                .setContentIntent(pIntent);

        manager.notify(id, builder.build());
    }

    private void showEmergencyNotification(int id, String title, String body) {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        Intent intent = new Intent(this, LiveTrackingRadarActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);

        PendingIntent pIntent = PendingIntent.getActivity(
                this, id, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, Constants.CHANNEL_EMERGENCY)
                .setSmallIcon(R.drawable.ic_dialog_warning_outline)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setAutoCancel(true)
                .setVibrate(new long[]{0, 1000, 500, 1000})
                .setContentIntent(pIntent)
                .addAction(R.drawable.ic_map, "Open Radar", pIntent);

        manager.notify(id, builder.build());
    }

    private void showGeneralNotification(int id, String title, String body) {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);

        PendingIntent pIntent = PendingIntent.getActivity(
                this, id, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, Constants.CHANNEL_GENERAL)
                .setSmallIcon(R.drawable.ic_scooter_fast)
                .setContentTitle(title)
                .setContentText(body)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setContentIntent(pIntent);

        manager.notify(id, builder.build());
    }

    private void showVkycCallNotification(int id, String title, String body, String callId, String adminName) {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        Intent callIntent = new Intent(this, VkycVideoCallActivity.class);
        callIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        if (callId != null) callIntent.putExtra("callId", callId);
        if (adminName != null) callIntent.putExtra("adminName", adminName);

        PendingIntent pIntent = PendingIntent.getActivity(
                this, id, callIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Uri ringtoneSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        if (ringtoneSound == null) {
            ringtoneSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, Constants.CHANNEL_ORDERS)
                .setSmallIcon(R.drawable.ic_video)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setAutoCancel(true)
                .setSound(ringtoneSound)
                .setVibrate(new long[]{0, 800, 300, 800, 300, 800})
                .setFullScreenIntent(pIntent, true)
                .setContentIntent(pIntent)
                .addAction(R.drawable.ic_video, "Connect Live V-KYC", pIntent);

        manager.notify(id, builder.build());
    }

    private void showVkycCompletedNotification(int id, String title, String body) {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        Intent mainIntent = new Intent(this, MainActivity.class);
        mainIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);

        PendingIntent pIntent = PendingIntent.getActivity(
                this, id, mainIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, Constants.CHANNEL_STATUS)
                .setSmallIcon(R.drawable.ic_check_circle)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pIntent);

        manager.notify(id, builder.build());
    }
}
