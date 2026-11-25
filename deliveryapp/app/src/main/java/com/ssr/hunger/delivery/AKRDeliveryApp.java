package com.ssr.hunger.delivery;

import android.app.Activity;
import android.app.Application;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.fragment.app.FragmentActivity;
import androidx.fragment.app.FragmentManager;

import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;
import com.ssr.hunger.delivery.utils.AnalyticsHelper;
import com.ssr.hunger.delivery.utils.Constants;
import com.ssr.hunger.delivery.utils.CrashlyticsHelper;
import com.ssr.hunger.delivery.utils.PerformanceHelper;
import com.ssr.hunger.delivery.utils.ReleaseMonitoringHelper;

/**
 * Application class for Hunger Delivery Partner App.
 * Initializes all Firebase Observability & Core services:
 * - Firebase Core
 * - Firebase Crashlytics
 * - Firebase Release Monitoring
 * - Firebase Realtime Analytics
 * - Firebase Performance Monitoring
 * - Firebase Cloud Messaging
 * - Notification Channels
 */
public class AKRDeliveryApp extends Application {

    private static final String TAG = "AKRDeliveryApp";
    private static AKRDeliveryApp instance;

    public static AKRDeliveryApp getInstance() {
        return instance;
    }

    public static android.content.Context getAppContext() {
        return instance != null ? instance.getApplicationContext() : null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;

        // 1. Initialize Firebase Core
        FirebaseApp.initializeApp(this);
        Log.d(TAG, "Firebase initialized in Delivery App");

        // 2. Firebase Crashlytics & Release Monitoring
        CrashlyticsHelper crashlytics = CrashlyticsHelper.getInstance();
        crashlytics.init(this);

        // 3. Release Monitoring
        ReleaseMonitoringHelper releaseMonitoring = ReleaseMonitoringHelper.getInstance(this);
        releaseMonitoring.checkAndTrackRelease();

        // 4. Firebase Realtime Analytics
        AnalyticsHelper analytics = AnalyticsHelper.getInstance(this);

        // 5. Firebase Performance Monitoring
        PerformanceHelper performance = PerformanceHelper.getInstance();
        performance.init();

        // 6. Global Uncaught Exception Handler
        setupGlobalExceptionHandler(crashlytics);

        // 6.5. Automatic Screen Tracking for all Activities, Fragments, and Dialogs
        setupGlobalLifecycleTracking(crashlytics);

        // 7. Setup Notification Channels
        createNotificationChannels();

        // 8. Subscribe to FCM Delivery Partner Broadcast Topic
        FirebaseMessaging.getInstance().subscribeToTopic("delivery_partners")
                .addOnCompleteListener(task -> {
                    if (task.isSuccessful()) {
                        Log.d(TAG, "Subscribed to 'delivery_partners' topic");
                    }
                });
    }

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

    private void setupGlobalLifecycleTracking(CrashlyticsHelper crashlytics) {
        registerActivityLifecycleCallbacks(new ActivityLifecycleCallbacks() {
            @Override
            public void onActivityCreated(@NonNull Activity activity, @Nullable Bundle savedInstanceState) {
                crashlytics.log("Activity Created: " + activity.getClass().getSimpleName());
                if (activity instanceof FragmentActivity) {
                    ((FragmentActivity) activity).getSupportFragmentManager()
                            .registerFragmentLifecycleCallbacks(new FragmentManager.FragmentLifecycleCallbacks() {
                                @Override
                                public void onFragmentCreated(@NonNull FragmentManager fm, @NonNull Fragment f, @Nullable Bundle savedInstanceState) {
                                    crashlytics.log("Fragment/Dialog Created: " + f.getClass().getSimpleName());
                                }

                                @Override
                                public void onFragmentResumed(@NonNull FragmentManager fm, @NonNull Fragment f) {
                                    crashlytics.log("Fragment/Dialog Resumed: " + f.getClass().getSimpleName());
                                }
                            }, true);
                }
            }

            @Override
            public void onActivityStarted(@NonNull Activity activity) {}

            @Override
            public void onActivityResumed(@NonNull Activity activity) {
                crashlytics.log("Activity Resumed: " + activity.getClass().getSimpleName());
                crashlytics.setCustomKey("current_screen", activity.getClass().getSimpleName());
            }

            @Override
            public void onActivityPaused(@NonNull Activity activity) {}

            @Override
            public void onActivityStopped(@NonNull Activity activity) {}

            @Override
            public void onActivitySaveInstanceState(@NonNull Activity activity, @NonNull Bundle outState) {}

            @Override
            public void onActivityDestroyed(@NonNull Activity activity) {
                crashlytics.log("Activity Destroyed: " + activity.getClass().getSimpleName());
            }
        });
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager == null) return;

            // 1. Orders Channel - High Priority Alert
            NotificationChannel ordersChannel = new NotificationChannel(
                    Constants.CHANNEL_ORDERS,
                    "New Order Broadcasts",
                    NotificationManager.IMPORTANCE_HIGH
            );
            ordersChannel.setDescription("Urgent alerts when a new delivery request is nearby");
            ordersChannel.enableVibration(true);
            ordersChannel.setVibrationPattern(new long[]{0, 500, 200, 500, 200, 500});
            ordersChannel.enableLights(true);
            ordersChannel.setShowBadge(true);
            manager.createNotificationChannel(ordersChannel);

            // 2. Payments & Wallet Channel
            NotificationChannel paymentsChannel = new NotificationChannel(
                    Constants.CHANNEL_PAYMENTS,
                    "Earnings & Payouts",
                    NotificationManager.IMPORTANCE_HIGH
            );
            paymentsChannel.setDescription("Alerts for completed delivery payouts, tips, and bank withdrawals");
            paymentsChannel.enableVibration(true);
            paymentsChannel.setVibrationPattern(new long[]{0, 200, 100, 300});
            paymentsChannel.enableLights(true);
            paymentsChannel.setShowBadge(true);
            manager.createNotificationChannel(paymentsChannel);

            // 3. Status Updates Channel
            NotificationChannel statusChannel = new NotificationChannel(
                    Constants.CHANNEL_STATUS,
                    "Order Status Updates",
                    NotificationManager.IMPORTANCE_DEFAULT
            );
            statusChannel.setDescription("Kitchen food ready updates, customer notes, and cancellations");
            statusChannel.enableVibration(true);
            manager.createNotificationChannel(statusChannel);

            // 4. Emergency SOS Channel
            NotificationChannel emergencyChannel = new NotificationChannel(
                    Constants.CHANNEL_EMERGENCY,
                    "Emergency & SOS Alerts",
                    NotificationManager.IMPORTANCE_HIGH
            );
            emergencyChannel.setDescription("Critical rider safety, accident, and emergency broadcasts");
            emergencyChannel.enableVibration(true);
            emergencyChannel.setVibrationPattern(new long[]{0, 1000, 500, 1000});
            emergencyChannel.enableLights(true);
            manager.createNotificationChannel(emergencyChannel);

            // 5. GPS Foreground Tracking Channel
            NotificationChannel gpsChannel = new NotificationChannel(
                    Constants.CHANNEL_GPS,
                    "Rider GPS Live Location",
                    NotificationManager.IMPORTANCE_LOW
            );
            gpsChannel.setDescription("Real-time GPS telemetry broadcasting for live customer tracking");
            gpsChannel.setShowBadge(false);
            manager.createNotificationChannel(gpsChannel);

            // 6. General Channel
            NotificationChannel generalChannel = new NotificationChannel(
                    Constants.CHANNEL_GENERAL,
                    "General Partner Announcements",
                    NotificationManager.IMPORTANCE_DEFAULT
            );
            manager.createNotificationChannel(generalChannel);
        }
    }
}
