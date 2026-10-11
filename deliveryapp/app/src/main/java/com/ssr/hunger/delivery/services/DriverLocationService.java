package com.ssr.hunger.delivery.services;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.FieldValue;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.SetOptions;
import com.ssr.hunger.delivery.R;
import com.ssr.hunger.delivery.activities.MainActivity;
import com.ssr.hunger.delivery.utils.Constants;
import com.ssr.hunger.delivery.utils.GeohashHelper;

import java.util.HashMap;
import java.util.Map;

/**
 * Foreground service for Delivery Partner GPS Tracking.
 * Streamlines real-time coordinates to Firestore collection: driverLocations/{driverId}.
 */
public class DriverLocationService extends Service {

    private static final String TAG = "DriverLocationService";
    public static final String CHANNEL_ID = Constants.CHANNEL_GPS;
    public static final int NOTIFICATION_ID = 9002;

    public static final String EXTRA_DRIVER_ID = "driver_id";
    public static final String EXTRA_ORDER_ID = "order_id";
    public static final String EXTRA_IS_ACTIVE = "is_active";
    public static final String ACTION_STOP = "com.ssr.hunger.delivery.STOP_GPS";
    public static final String ACTION_UPDATE_ORDER = "com.ssr.hunger.delivery.UPDATE_ORDER";

    private static final long INTERVAL_FAST = 5_000L;    // >20 km/h
    private static final long INTERVAL_NORMAL = 10_000L;  // 2–20 km/h
    private static final long INTERVAL_SLOW = 20_000L;    // Moving slowly
    private static final long INTERVAL_STOPPED = 30_000L; // Stationary

    private FirebaseFirestore db;
    private FirebaseAuth auth;
    private FusedLocationProviderClient fusedLocationClient;
    private LocationCallback locationCallback;
    private LocationRequest currentLocationRequest;

    private String driverId = null;
    private String activeOrderId = null;
    private boolean isActiveDelivery = false;
    private long lastWriteMs = 0;
    private long currentInterval = INTERVAL_NORMAL;

    @Override
    public void onCreate() {
        super.onCreate();
        db = FirebaseFirestore.getInstance();
        auth = FirebaseAuth.getInstance();
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;

        String action = intent.getAction();
        if (ACTION_STOP.equals(action)) {
            stopSelf();
            return START_NOT_STICKY;
        }

        if (ACTION_UPDATE_ORDER.equals(action)) {
            activeOrderId = intent.getStringExtra(EXTRA_ORDER_ID);
            isActiveDelivery = intent.getBooleanExtra(EXTRA_IS_ACTIVE, false);
            updateNotification();
            return START_STICKY;
        }

        driverId = intent.getStringExtra(EXTRA_DRIVER_ID);
        activeOrderId = intent.getStringExtra(EXTRA_ORDER_ID);
        isActiveDelivery = intent.getBooleanExtra(EXTRA_IS_ACTIVE, false);

        if (driverId == null || driverId.isEmpty()) {
            if (auth.getCurrentUser() != null) {
                driverId = auth.getCurrentUser().getUid();
            } else {
                stopSelf();
                return START_NOT_STICKY;
            }
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, buildNotification(), android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            } else {
                startForeground(NOTIFICATION_ID, buildNotification());
            }
        } catch (Exception e) {
            Log.e(TAG, "Error starting foreground service: " + e.getMessage(), e);
        }
        startLocationUpdates();

        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        stopLocationUpdates();
        markDriverOffline();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void startLocationUpdates() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            stopSelf();
            return;
        }

        buildLocationRequest(isActiveDelivery ? INTERVAL_FAST : INTERVAL_NORMAL);

        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult result) {
                if (result == null) return;
                Location loc = result.getLastLocation();
                if (loc == null) return;

                float speedKmh = loc.hasSpeed() ? loc.getSpeed() * 3.6f : 0f;
                adjustInterval(loc);
                publishLocation(loc, speedKmh);
            }
        };

        fusedLocationClient.requestLocationUpdates(
                currentLocationRequest,
                locationCallback,
                Looper.getMainLooper()
        );
    }

    private void buildLocationRequest(long intervalMs) {
        currentInterval = intervalMs;
        currentLocationRequest = new LocationRequest.Builder(
                isActiveDelivery ? Priority.PRIORITY_HIGH_ACCURACY : Priority.PRIORITY_BALANCED_POWER_ACCURACY,
                intervalMs
        )
                .setMinUpdateIntervalMillis(intervalMs / 2)
                .setMinUpdateDistanceMeters(5f)
                .build();
    }

    private void adjustInterval(Location loc) {
        if (!isActiveDelivery) {
            rebuildIfDifferent(INTERVAL_SLOW);
            return;
        }
        float speedKmh = loc.hasSpeed() ? loc.getSpeed() * 3.6f : 0f;
        long target;
        if (speedKmh > 20f) target = INTERVAL_FAST;
        else if (speedKmh > 2f) target = INTERVAL_NORMAL;
        else if (speedKmh > 0.5f) target = INTERVAL_SLOW;
        else target = INTERVAL_STOPPED;

        rebuildIfDifferent(target);
    }

    private void rebuildIfDifferent(long interval) {
        if (interval == currentInterval) return;
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) return;

        fusedLocationClient.removeLocationUpdates(locationCallback);
        buildLocationRequest(interval);
        fusedLocationClient.requestLocationUpdates(
                currentLocationRequest, locationCallback, Looper.getMainLooper()
        );
    }

    private void stopLocationUpdates() {
        if (fusedLocationClient != null && locationCallback != null) {
            fusedLocationClient.removeLocationUpdates(locationCallback);
            locationCallback = null;
        }
    }

    private void publishLocation(Location loc, float speedKmh) {
        if (driverId == null) return;
        long now = System.currentTimeMillis();
        if (now - lastWriteMs < 3000L) return; // Debounce 3s
        lastWriteMs = now;

        double lat = loc.getLatitude();
        double lon = loc.getLongitude();
        if (!GeohashHelper.isValidCoordinate(lat, lon)) {
            Log.w(TAG, "Rejected invalid GPS coordinates: lat=" + lat + ", lon=" + lon);
            return;
        }

        double accuracy = loc.hasAccuracy() ? (double) loc.getAccuracy() : 0.0;
        // Reject implausibly inaccurate fixes (> 200m)
        if (accuracy > 200.0) {
            Log.w(TAG, "Rejected inaccurate GPS fix: accuracy=" + accuracy + "m");
            return;
        }

        Map<String, Object> data = new HashMap<>();
        data.put("driverId", driverId);
        data.put("partnerId", driverId);
        data.put("latitude", lat);
        data.put("longitude", lon);
        data.put("geohash", GeohashHelper.encode(lat, lon, 7));
        data.put("accuracy", accuracy);
        data.put("locationAccuracyMeters", accuracy);
        data.put("speed", (double) speedKmh);
        data.put("heading", loc.hasBearing() ? (double) loc.getBearing() : 0.0);
        data.put("altitude", loc.hasAltitude() ? loc.getAltitude() : 0.0);
        data.put("isOnline", true);
        data.put("availabilityStatus", (activeOrderId != null && !activeOrderId.isEmpty()) ? "busy" : "available");
        data.put("activeOrderId", activeOrderId);
        data.put("lastLocationUpdateAt", FieldValue.serverTimestamp());
        data.put("updatedAt", FieldValue.serverTimestamp());

        db.collection(Constants.COLLECTION_DRIVER_LOCATIONS)
                .document(driverId)
                .set(data, SetOptions.merge())
                .addOnFailureListener(e -> Log.e(TAG, "Failed to update GPS: " + e.getMessage()));
    }

    private void markDriverOffline() {
        if (driverId == null) return;
        Map<String, Object> data = new HashMap<>();
        data.put("isOnline", false);
        data.put("availabilityStatus", "offline");
        data.put("activeOrderId", null);
        data.put("updatedAt", FieldValue.serverTimestamp());

        db.collection(Constants.COLLECTION_DRIVER_LOCATIONS)
                .document(driverId)
                .set(data, SetOptions.merge());
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Delivery GPS Live Tracking",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Broadcasting live rider location for active deliveries");
            channel.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }

    private Notification buildNotification() {
        Intent stopIntent = new Intent(this, DriverLocationService.class);
        stopIntent.setAction(ACTION_STOP);
        PendingIntent stopPending = PendingIntent.getService(
                this, 0, stopIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent openIntent = new Intent(this, MainActivity.class);
        PendingIntent openPending = PendingIntent.getActivity(
                this, 1, openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        String title = isActiveDelivery ? "🛵 Active Delivery in Progress" : "🟢 Hunger Partner: ONLINE";
        String content = isActiveDelivery
                ? "Live GPS tracking enabled for current customer"
                : "Standing by for new order assignments nearby";

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(content)
                .setSmallIcon(R.drawable.ic_scooter_fast)
                .setContentIntent(openPending)
                .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Go Offline", stopPending)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
    }

    private void updateNotification() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(NOTIFICATION_ID, buildNotification());
        }
    }

    // Static Helpers
    public static void startTracking(Context context, String driverId, String orderId, boolean isActive) {
        if (context == null) return;
        try {
            Intent intent = new Intent(context, DriverLocationService.class);
            intent.putExtra(EXTRA_DRIVER_ID, driverId);
            intent.putExtra(EXTRA_ORDER_ID, orderId);
            intent.putExtra(EXTRA_IS_ACTIVE, isActive);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to start tracking service: " + e.getMessage());
        }
    }

    public static void stopTracking(Context context) {
        if (context == null) return;
        try {
            Intent intent = new Intent(context, DriverLocationService.class);
            intent.setAction(ACTION_STOP);
            context.startService(intent);
        } catch (Exception e) {
            Log.e(TAG, "Failed to stop tracking service: " + e.getMessage());
        }
    }

    public static void updateActiveOrder(Context context, String orderId, boolean isActive) {
        if (context == null) return;
        try {
            Intent intent = new Intent(context, DriverLocationService.class);
            intent.setAction(ACTION_UPDATE_ORDER);
            intent.putExtra(EXTRA_ORDER_ID, orderId);
            intent.putExtra(EXTRA_IS_ACTIVE, isActive);
            context.startService(intent);
        } catch (Exception e) {
            Log.e(TAG, "Failed to update active order: " + e.getMessage());
        }
    }
}
