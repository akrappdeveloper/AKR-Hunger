package com.ssr.hunger.services;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
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
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.SetOptions;
import com.ssr.hunger.R;
import com.ssr.hunger.activities.OrderTrackingActivity;
import com.ssr.hunger.utils.Constants;

import java.util.HashMap;
import java.util.Map;

/**
 * DriverLocationService — Foreground GPS service for delivery partners.
 *
 * Publishes real GPS coordinates to Firestore at:
 *   driverLocations/{driverId}
 *
 * Data structure:
 * {
 *   driverId:     String,
 *   latitude:     double,
 *   longitude:    double,
 *   accuracy:     float (meters),
 *   speed:        float (km/h),
 *   heading:      float (degrees from North),
 *   altitude:     double (meters, optional),
 *   isOnline:     boolean,
 *   activeOrderId: String | null,
 *   updatedAt:    ServerTimestamp,
 *   ipAddress:    String (for audit)
 * }
 *
 * Uses ADAPTIVE tracking:
 *   - Moving fast (>20 km/h):  5s intervals
 *   - Moving slow (2-20 km/h): 10s intervals
 *   - Slow / near-stopped:     20s intervals
 *   - Stopped:                 30s intervals
 */
public class DriverLocationService extends Service {

    private static final String TAG = "DriverLocationService";
    public static final String CHANNEL_ID = "hunger_driver_gps";
    public static final int NOTIFICATION_ID = 9001;

    // Intent extras
    public static final String EXTRA_DRIVER_ID   = "driver_id";
    public static final String EXTRA_ORDER_ID    = "order_id";
    public static final String EXTRA_IS_ACTIVE   = "is_active";  // true = active delivery, false = idle
    public static final String ACTION_STOP       = "com.ssr.hunger.STOP_LOCATION_SERVICE";
    public static final String ACTION_UPDATE_ORDER = "com.ssr.hunger.UPDATE_ORDER";

    // Adaptive interval constants (milliseconds)
    private static final long INTERVAL_FAST    = 5_000L;   // >20 km/h
    private static final long INTERVAL_NORMAL  = 10_000L;  // 2–20 km/h
    private static final long INTERVAL_SLOW    = 20_000L;  // <2 km/h, moving
    private static final long INTERVAL_STOPPED = 30_000L;  // not moving

    // Min displacement to trigger update (meters)
    private static final float MIN_DISPLACEMENT_METERS = 5f;

    // Firebase
    private FirebaseFirestore db;
    private FirebaseAuth auth;

    // GPS
    private FusedLocationProviderClient fusedLocationClient;
    private LocationCallback locationCallback;
    private LocationRequest currentLocationRequest;

    // State
    private String driverId  = null;
    private String orderId   = null;
    private boolean isActive = false;
    private Location lastLocation = null;
    private long lastFirestoreWriteMs = 0;

    // Handler for adaptive interval updates
    private final Handler handler = new Handler(Looper.getMainLooper());

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    @Override
    public void onCreate() {
        super.onCreate();
        db   = FirebaseFirestore.getInstance();
        auth = FirebaseAuth.getInstance();
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);
        createNotificationChannel();
        Log.d(TAG, "DriverLocationService created");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;

        String action = intent.getAction();

        // Handle stop action
        if (ACTION_STOP.equals(action)) {
            Log.d(TAG, "Stop action received — stopping service");
            stopSelf();
            return START_NOT_STICKY;
        }

        // Handle order update (change active orderId mid-delivery)
        if (ACTION_UPDATE_ORDER.equals(action)) {
            orderId  = intent.getStringExtra(EXTRA_ORDER_ID);
            isActive = intent.getBooleanExtra(EXTRA_IS_ACTIVE, false);
            Log.d(TAG, "Order updated: " + orderId + ", active=" + isActive);
            updateAdaptiveInterval(lastLocation);
            return START_STICKY;
        }

        // Normal start
        driverId = intent.getStringExtra(EXTRA_DRIVER_ID);
        orderId  = intent.getStringExtra(EXTRA_ORDER_ID);
        isActive = intent.getBooleanExtra(EXTRA_IS_ACTIVE, false);

        if (driverId == null || driverId.isEmpty()) {
            // Fallback: use Firebase Auth UID
            if (auth.getCurrentUser() != null) {
                driverId = auth.getCurrentUser().getUid();
            } else {
                Log.e(TAG, "No driver ID provided and no auth user — stopping");
                stopSelf();
                return START_NOT_STICKY;
            }
        }

        Log.d(TAG, "Starting GPS service for driver=" + driverId + " order=" + orderId + " active=" + isActive);

        // Start as foreground service with persistent notification
        startForeground(NOTIFICATION_ID, buildNotification());

        // Start GPS tracking
        startLocationUpdates();

        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        stopLocationUpdates();
        markDriverOffline();
        handler.removeCallbacksAndMessages(null);
        Log.d(TAG, "DriverLocationService destroyed");
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null; // Not a bound service
    }

    // ─── GPS Tracking ─────────────────────────────────────────────────────────

    private void startLocationUpdates() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            Log.e(TAG, "Location permission not granted — cannot start GPS");
            stopSelf();
            return;
        }

        buildLocationRequest(isActive ? INTERVAL_FAST : INTERVAL_SLOW);

        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult result) {
                if (result == null) return;
                Location location = result.getLastLocation();
                if (location == null) return;

                // Filter out inaccurate fixes (>50m uncertainty in active mode)
                if (isActive && location.hasAccuracy() && location.getAccuracy() > 50f) {
                    Log.w(TAG, "Low accuracy GPS fix (" + location.getAccuracy() + "m) — skipping");
                    return;
                }

                // Adaptive interval based on speed
                float speedKmh = location.hasSpeed() ? location.getSpeed() * 3.6f : 0f;
                updateAdaptiveInterval(location);

                // Publish to Firestore
                publishLocationToFirestore(location, speedKmh);

                lastLocation = location;
            }
        };

        fusedLocationClient.requestLocationUpdates(
            currentLocationRequest,
            locationCallback,
            Looper.getMainLooper()
        );

        Log.d(TAG, "Location updates started");
    }

    private void buildLocationRequest(long intervalMs) {
        currentLocationRequest = new LocationRequest.Builder(
            isActive ? Priority.PRIORITY_HIGH_ACCURACY : Priority.PRIORITY_BALANCED_POWER_ACCURACY,
            intervalMs
        )
            .setMinUpdateIntervalMillis(intervalMs / 2)
            .setMinUpdateDistanceMeters(MIN_DISPLACEMENT_METERS)
            .setWaitForAccurateLocation(false)
            .build();
    }

    private void updateAdaptiveInterval(Location location) {
        if (!isActive) {
            rebuildRequestIfChanged(INTERVAL_SLOW);
            return;
        }
        if (location == null) {
            rebuildRequestIfChanged(INTERVAL_NORMAL);
            return;
        }

        float speedKmh = location.hasSpeed() ? location.getSpeed() * 3.6f : 0f;
        long interval;

        if (speedKmh > 20f) {
            interval = INTERVAL_FAST;
        } else if (speedKmh > 2f) {
            interval = INTERVAL_NORMAL;
        } else if (speedKmh > 0.5f) {
            interval = INTERVAL_SLOW;
        } else {
            interval = INTERVAL_STOPPED;
        }

        rebuildRequestIfChanged(interval);
    }

    private long lastInterval = -1;
    private void rebuildRequestIfChanged(long interval) {
        if (interval == lastInterval) return;
        lastInterval = interval;

        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) return;

        fusedLocationClient.removeLocationUpdates(locationCallback);
        buildLocationRequest(interval);
        fusedLocationClient.requestLocationUpdates(
            currentLocationRequest, locationCallback, Looper.getMainLooper()
        );
        Log.d(TAG, "Adaptive interval updated: " + interval + "ms");
    }

    private void stopLocationUpdates() {
        if (fusedLocationClient != null && locationCallback != null) {
            fusedLocationClient.removeLocationUpdates(locationCallback);
            locationCallback = null;
            Log.d(TAG, "Location updates stopped");
        }
    }

    // ─── Firestore Publishing ─────────────────────────────────────────────────

    private void publishLocationToFirestore(Location location, float speedKmh) {
        if (driverId == null || driverId.isEmpty()) return;

        // Debounce: don't write more often than 3 seconds
        long now = System.currentTimeMillis();
        if (now - lastFirestoreWriteMs < 3_000L) return;
        lastFirestoreWriteMs = now;

        Map<String, Object> data = new HashMap<>();
        data.put("driverId",      driverId);
        data.put("latitude",      location.getLatitude());
        data.put("longitude",     location.getLongitude());
        data.put("accuracy",      location.hasAccuracy() ? (double) location.getAccuracy() : 0.0);
        data.put("speed",         (double) speedKmh);
        data.put("heading",       location.hasBearing() ? (double) location.getBearing() : 0.0);
        data.put("altitude",      location.hasAltitude() ? location.getAltitude() : 0.0);
        data.put("isOnline",      true);
        data.put("activeOrderId", orderId);
        data.put("updatedAt",     com.google.firebase.firestore.FieldValue.serverTimestamp());

        db.collection(Constants.COLLECTION_DRIVER_LOCATIONS)
            .document(driverId)
            .set(data, SetOptions.merge())
            .addOnSuccessListener(v -> Log.d(TAG, "GPS published: " + location.getLatitude() + "," + location.getLongitude()))
            .addOnFailureListener(e -> Log.e(TAG, "Failed to publish GPS: " + e.getMessage()));
    }

    private void markDriverOffline() {
        if (driverId == null || driverId.isEmpty()) return;

        Map<String, Object> data = new HashMap<>();
        data.put("isOnline",   false);
        data.put("updatedAt",  com.google.firebase.firestore.FieldValue.serverTimestamp());
        data.put("activeOrderId", null);

        db.collection(Constants.COLLECTION_DRIVER_LOCATIONS)
            .document(driverId)
            .set(data, SetOptions.merge())
            .addOnSuccessListener(v -> Log.d(TAG, "Driver marked offline"))
            .addOnFailureListener(e -> Log.e(TAG, "Failed to mark offline: " + e.getMessage()));
    }

    // ─── Notification ─────────────────────────────────────────────────────────

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "AKR Hunger Driver GPS",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Real-time GPS tracking for active deliveries");
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

        Intent openIntent = new Intent(this, OrderTrackingActivity.class);
        if (orderId != null) openIntent.putExtra(OrderTrackingActivity.EXTRA_ORDER_ID, orderId);
        PendingIntent openPending = PendingIntent.getActivity(
            this, 1, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("🛵 AKR Hunger — Active Delivery")
            .setContentText(isActive
                ? "GPS tracking active • Live route broadcasting"
                : "Standing by for delivery assignment")
            .setSmallIcon(R.drawable.ic_notification)
            .setContentIntent(openPending)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop GPS", stopPending)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build();
    }

    // ─── Public static helper to start/stop this service ─────────────────────

    /**
     * Call this from OrderTrackingActivity or DeliveryDashboard to start GPS publishing.
     */
    public static void startTracking(android.content.Context context,
                                     String driverId,
                                     String orderId,
                                     boolean isActiveDelivery) {
        Intent intent = new Intent(context, DriverLocationService.class);
        intent.putExtra(EXTRA_DRIVER_ID, driverId);
        intent.putExtra(EXTRA_ORDER_ID, orderId);
        intent.putExtra(EXTRA_IS_ACTIVE, isActiveDelivery);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    /**
     * Call this when order is delivered or cancelled.
     */
    public static void stopTracking(android.content.Context context) {
        Intent intent = new Intent(context, DriverLocationService.class);
        intent.setAction(ACTION_STOP);
        context.startService(intent);
    }

    /**
     * Call this when driver picks up food (switches from TO_RESTAURANT to TO_CUSTOMER).
     * Updates the active order ID so Firestore data stays current.
     */
    public static void updateActiveOrder(android.content.Context context,
                                         String newOrderId,
                                         boolean isActiveDelivery) {
        Intent intent = new Intent(context, DriverLocationService.class);
        intent.setAction(ACTION_UPDATE_ORDER);
        intent.putExtra(EXTRA_ORDER_ID, newOrderId);
        intent.putExtra(EXTRA_IS_ACTIVE, isActiveDelivery);
        context.startService(intent);
    }
}
