package com.ssr.hunger;

import android.app.Application;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.util.Log;
import com.ssr.hunger.utils.AnalyticsHelper;
import com.ssr.hunger.utils.CrashlyticsHelper;
import com.ssr.hunger.utils.PerformanceHelper;
import com.ssr.hunger.utils.ReleaseMonitoringHelper;
import com.ssr.hunger.utils.RemoteConfigHelper;
import com.google.firebase.FirebaseApp;
import com.google.firebase.inappmessaging.FirebaseInAppMessaging;
import com.google.firebase.messaging.FirebaseMessaging;

/**
 * Application class - initializes all Firebase and Observability services on app start.
 * 
 * Services initialized:
 * - Firebase Core
 * - Firebase Crashlytics (Crash Reporting, Non-fatal Exceptions, Breadcrumbs)
 * - Firebase Release Monitoring (Build Metadata, Update Detection, Session Counters)
 * - Firebase Realtime Analytics (Realtime Events, e-Commerce Food Funnel, DebugView)
 * - Firebase Performance Monitoring (Network, Cold Start, Screen Rendering Traces)
 * - Firebase Remote Config (Dynamic Flags, Delivery Fees, Live Updates)
 * - Firebase In-App Messaging (Engagement Campaigns)
 * - Firebase Cloud Messaging (FCM)
 * - Notification Channels (Android O+)
 */
public class AKRHungerApp extends Application {

    private static final String TAG = "HungerApp";

    // Notification Channel IDs
    public static final String CHANNEL_ORDERS = "hunger_orders";
    public static final String CHANNEL_PROMOTIONS = "hunger_promotions";
    public static final String CHANNEL_GENERAL = "hunger_general";

    @Override
    public void onCreate() {
        super.onCreate();

        // 1. Initialize Firebase Core
        FirebaseApp.initializeApp(this);
        Log.d(TAG, "Firebase Core initialized");

        // 2. Firebase Crashlytics & Release Monitoring
        CrashlyticsHelper crashlytics = CrashlyticsHelper.getInstance();
        crashlytics.init(this);

        // 3. Release Monitoring (Update tracking, install timestamps, session counts)
        ReleaseMonitoringHelper releaseMonitoring = ReleaseMonitoringHelper.getInstance(this);
        releaseMonitoring.checkAndTrackRelease();

        // 4. Firebase Realtime Analytics
        AnalyticsHelper analytics = AnalyticsHelper.getInstance(this);

        // 5. Firebase Performance Monitoring
        PerformanceHelper performance = PerformanceHelper.getInstance();
        performance.init();

        // 6. Firebase Remote Config
        RemoteConfigHelper remoteConfig = RemoteConfigHelper.getInstance();
        remoteConfig.init(this);

        // 7. Firebase In-App Messaging
        try {
            FirebaseInAppMessaging.getInstance().setMessagesSuppressed(false);
            Log.d(TAG, "In-App Messaging enabled");
        } catch (Exception e) {
            Log.w(TAG, "In-App Messaging init error", e);
        }

        // 8. Global Uncaught Exception Handler
        setupGlobalExceptionHandler(crashlytics);

        // 9. Firebase Cloud Messaging - Subscribe to topics
        FirebaseMessaging.getInstance().subscribeToTopic("all_customers")
                .addOnCompleteListener(task -> {
                    if (task.isSuccessful()) {
                        Log.d(TAG, "Subscribed to 'all_customers' topic");
                    }
                });

        FirebaseMessaging.getInstance().subscribeToTopic("promotions")
                .addOnCompleteListener(task -> {
                    if (task.isSuccessful()) {
                        Log.d(TAG, "Subscribed to 'promotions' topic");
                    }
                });

        // Get and log FCM token
        FirebaseMessaging.getInstance().getToken()
                .addOnCompleteListener(task -> {
                    if (task.isSuccessful()) {
                        String token = task.getResult();
                        Log.d(TAG, "FCM Token: " + token);
                        analytics.setUserProperty("fcm_token_available", "true");
                        crashlytics.setCustomKey("has_fcm_token", true);
                    }
                });

        // 10. Create Notification Channels (Android O+)
        createNotificationChannels();
    }

    /**
     * Sets a global exception handler to record uncaught fatal errors before app process death.
     */
    private void setupGlobalExceptionHandler(CrashlyticsHelper crashlytics) {
        final Thread.UncaughtExceptionHandler defaultHandler = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            try {
                crashlytics.log("FATAL EXCEPTION on thread '" + thread.getName() + "': " + throwable.getMessage());
                crashlytics.recordException("FATAL_UNCAUGHT", throwable);
            } catch (Exception ignored) {
            }
            if (defaultHandler != null) {
                defaultHandler.uncaughtException(thread, throwable);
            }
        });
    }

    /**
     * Creates notification channels for different types of notifications.
     * Required for Android O (API 26) and above.
     */
    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager == null) return;

            // Order Updates Channel (High priority)
            NotificationChannel ordersChannel = new NotificationChannel(
                    CHANNEL_ORDERS,
                    "Order Updates",
                    NotificationManager.IMPORTANCE_HIGH
            );
            ordersChannel.setDescription("Real-time order status updates, delivery tracking");
            ordersChannel.enableVibration(true);
            ordersChannel.setShowBadge(true);
            manager.createNotificationChannel(ordersChannel);

            // Promotions Channel (Default priority)
            NotificationChannel promosChannel = new NotificationChannel(
                    CHANNEL_PROMOTIONS,
                    "Offers & Promotions",
                    NotificationManager.IMPORTANCE_DEFAULT
            );
            promosChannel.setDescription("Special deals, discounts, and promotional offers");
            promosChannel.setShowBadge(true);
            manager.createNotificationChannel(promosChannel);

            // General Channel (Low priority)
            NotificationChannel generalChannel = new NotificationChannel(
                    CHANNEL_GENERAL,
                    "General Notifications",
                    NotificationManager.IMPORTANCE_DEFAULT
            );
            generalChannel.setDescription("Account updates, tips, and app news");
            manager.createNotificationChannel(generalChannel);

            Log.d(TAG, "Notification channels created");
        }
    }
}
