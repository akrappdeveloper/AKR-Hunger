package com.ssr.hunger.services;

import android.util.Log;
import androidx.annotation.NonNull;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import com.ssr.hunger.utils.NotificationHelper;
import java.util.Map;

/**
 * Firebase Cloud Messaging service for push notifications.
 * Handles incoming FCM messages for real-time order updates, confirmations, promotions, and status changes.
 * Automatically mirrors incoming notifications into the `notifications` collection so they show in NotificationsActivity.
 */
public class FCMService extends FirebaseMessagingService {

    private static final String TAG = "FCMService";

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);

        String title = "Hunger 🍽️";
        String body = "You have a new update";
        String orderId = null;
        String type = "order";

        if (remoteMessage.getNotification() != null) {
            if (remoteMessage.getNotification().getTitle() != null) {
                title = remoteMessage.getNotification().getTitle();
            }
            if (remoteMessage.getNotification().getBody() != null) {
                body = remoteMessage.getNotification().getBody();
            }
        }

        if (remoteMessage.getData().size() > 0) {
            Map<String, String> data = remoteMessage.getData();
            if (data.containsKey("title") && data.get("title") != null) {
                title = data.get("title");
            }
            if (data.containsKey("body") && data.get("body") != null) {
                body = data.get("body");
            } else if (data.containsKey("message") && data.get("message") != null) {
                body = data.get("message");
            }
            if (data.containsKey("orderId")) {
                orderId = data.get("orderId");
            }
            if (data.containsKey("type")) {
                type = data.get("type");
            }
        }

        Log.d(TAG, "FCM Message received: title=" + title + " orderId=" + orderId + " type=" + type);

        // 1. Show rich heads-up system notification with deep link to OrderDetailActivity
        NotificationHelper.showLocalNotification(this, title, body, orderId, type);

        // 2. Persist in Firestore `notifications` collection so it also appears in NotificationsActivity
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user != null) {
            NotificationHelper.saveNotificationToFirestore(user.getUid(), title, body, orderId, type);
        }
    }

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        Log.d(TAG, "New FCM Token generated: " + token);
        NotificationHelper.cacheFcmToken(this, token);

        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user != null) {
            NotificationHelper.saveFcmTokenForUser(this, user.getUid(), token);
        }
    }
}
