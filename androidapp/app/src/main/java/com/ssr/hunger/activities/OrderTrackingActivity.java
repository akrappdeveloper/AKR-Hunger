package com.ssr.hunger.activities;

import android.Manifest;
import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.ObjectAnimator;
import android.animation.ValueAnimator;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.LayoutInflater;
import android.view.View;
import android.view.animation.AccelerateDecelerateInterpolator;
import android.view.animation.OvershootInterpolator;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.cardview.widget.CardView;
import androidx.core.app.ActivityCompat;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import com.ssr.hunger.R;
import com.ssr.hunger.services.DriverLocationService;
import com.ssr.hunger.utils.Constants;
import com.ssr.hunger.utils.PermissionManager;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * OrderTrackingActivity — Real-time order tracking for CUSTOMERS.
 *
 * Listens to live driver GPS from Firebase driverLocations/{driverId}.
 * If opened in driver mode (EXTRA_IS_DRIVER=true), starts DriverLocationService
 * to publish this device's GPS position to Firebase.
 *
 * Two-phase tracking:
 *   Phase 1: Driver → Restaurant (TO_PICKUP stage)
 *   Phase 2: Driver → Customer (TO_CUSTOMER / out_for_delivery stage)
 */
public class OrderTrackingActivity extends BaseActivity {

    public static final String EXTRA_ORDER_ID = "order_id";
    /** Set to true if this device IS the delivery partner */
    public static final String EXTRA_IS_DRIVER = "is_driver";
    private static final int LOCATION_PERMISSION_CODE = 4001;

    // Firebase
    private FirebaseFirestore db;
    private ListenerRegistration orderListener;
    private ListenerRegistration driverLocationListener;
    private String orderId;
    private String lastStatus = "";
    private String driverUid = null;
    private boolean isDriverMode = false;

    // UI refs
    private TextView tvEta, tvOrderStatus, tvRestaurantName, tvOrderId;
    private TextView tvDriverName, tvDriverPhone, tvDriverVehicle;
    private TextView tvDeliveryAddress, tvGpsCoords;
    private LinearLayout stepContainer;
    private ProgressBar progressTrack;
    private CardView cardDriverPartner;
    private View btnCallDriver, btnBack, btnHelp;
    private View gpsLiveBadge;

    // Step keys matching Firestore status values
    private static final String[] STEPS      = {"pending","confirmed","preparing","ready","out_for_delivery","delivered"};
    private static final String[] STEP_EMOJIS = {"\uD83D\uDCE6","\u2705","\uD83D\uDC68\u200D\uD83C\uDF73","\uD83C\uDF71","\uD83D\uDEF5","\uD83C\uDF89"};
    private static final String[] STEP_LABELS = {
        "Order Placed", "Confirmed", "Kitchen Preparing", "Food Ready", "Out for Delivery", "Delivered!"
    };
    private static final int[] STEP_COLORS = {
        0xFFFF9800, 0xFF2196F3, 0xFFFF9800, 0xFF9C27B0, 0xFFFF5722, 0xFF4CAF50
    };

    // ETA
    private Handler etaHandler;
    private Runnable etaRunnable;
    private long orderPlacedMs = 0;
    private int estimatedMins = 35;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_order_tracking);

        db = FirebaseFirestore.getInstance();
        orderId = getIntent().getStringExtra(EXTRA_ORDER_ID);
        isDriverMode = getIntent().getBooleanExtra(EXTRA_IS_DRIVER, false);

        if (orderId == null) {
            recordException("OrderTracking_null_id", new IllegalArgumentException("null orderId"));
            finish();
            return;
        }

        bindViews();
        startMapAnimation();
        listenToOrder();

        // If this is a delivery partner's device, start GPS service (with location permission)
        if (isDriverMode) {
            requireLocation(
                () -> {
                    String uid = com.google.firebase.auth.FirebaseAuth.getInstance().getCurrentUser() != null
                        ? com.google.firebase.auth.FirebaseAuth.getInstance().getCurrentUser().getUid()
                        : null;
                    if (uid != null) {
                        DriverLocationService.startTracking(this, uid, orderId, true);
                    }
                },
                (isPermanent) -> {
                    if (isPermanent) showSettingsSnackbar();
                }
            );
        }

        logBreadcrumb("OrderTrackingActivity: " + orderId + " driverMode=" + isDriverMode);

        if (btnBack != null) btnBack.setOnClickListener(v -> onBackPressed());
        if (btnHelp != null) btnHelp.setOnClickListener(v ->
            startActivity(new Intent(this, SupportActivity.class)));
    }

    // ─── Bind Views ───────────────────────────────────────────────────────────

    private void bindViews() {
        tvEta              = findViewById(R.id.tv_eta);
        tvOrderStatus      = findViewById(R.id.tv_order_status);
        tvRestaurantName   = findViewById(R.id.tv_restaurant_name);
        tvOrderId          = findViewById(R.id.tv_order_id);
        tvDriverName       = findViewById(R.id.tv_driver_name);
        tvDriverPhone      = findViewById(R.id.tv_driver_phone);
        tvDriverVehicle    = findViewById(R.id.tv_driver_vehicle);
        tvDeliveryAddress  = findViewById(R.id.tv_delivery_address);
        tvGpsCoords        = (TextView) findViewById(R.id.tv_gps_coords);
        stepContainer      = findViewById(R.id.step_container);
        progressTrack      = findViewById(R.id.progress_tier);
        cardDriverPartner  = findViewById(R.id.card_delivery_partner);
        btnCallDriver      = findViewById(R.id.btn_call_driver);
        btnBack            = findViewById(R.id.btn_back);
        btnHelp            = findViewById(R.id.btn_help);
        gpsLiveBadge       = (View) findViewById(R.id.gps_live_badge);
    }

    // ─── Animated Map Placeholder ─────────────────────────────────────────────

    private void startMapAnimation() {
        // Animate the ETA text to pulse gently
        if (tvEta != null) {
            ObjectAnimator scaleX = ObjectAnimator.ofFloat(tvEta, "scaleX", 1f, 1.05f, 1f);
            ObjectAnimator scaleY = ObjectAnimator.ofFloat(tvEta, "scaleY", 1f, 1.05f, 1f);
            scaleX.setDuration(1800);
            scaleY.setDuration(1800);
            scaleX.setRepeatCount(ValueAnimator.INFINITE);
            scaleY.setRepeatCount(ValueAnimator.INFINITE);
            scaleX.start();
            scaleY.start();
        }

        // Floating bobbing animation on rider avatar
        View riderAvatar = findViewById(R.id.frame_rider_avatar);
        if (riderAvatar != null) {
            ObjectAnimator bobY = ObjectAnimator.ofFloat(riderAvatar, "translationY", 0f, -8f, 0f);
            bobY.setDuration(1500);
            bobY.setRepeatCount(ValueAnimator.INFINITE);
            bobY.setInterpolator(new AccelerateDecelerateInterpolator());
            bobY.start();
        }

        // Radar wave pulse on concentric rings
        animateRadarRing(findViewById(R.id.view_radar_ring_inner), 0);
        animateRadarRing(findViewById(R.id.view_radar_ring_mid), 400);
        animateRadarRing(findViewById(R.id.view_radar_ring_outer), 800);

        // Slide up entry for the main cards
        View cardEta = findViewById(R.id.card_eta);
        if (cardEta != null) {
            cardEta.setAlpha(0f);
            cardEta.setTranslationY(60f);
            cardEta.animate()
                    .alpha(1f)
                    .translationY(0f)
                    .setDuration(450)
                    .setInterpolator(new AccelerateDecelerateInterpolator())
                    .start();
        }
    }

    private void animateRadarRing(View ring, long startDelay) {
        if (ring == null) return;
        ObjectAnimator scaleX = ObjectAnimator.ofFloat(ring, "scaleX", 1.0f, 1.25f, 1.0f);
        ObjectAnimator scaleY = ObjectAnimator.ofFloat(ring, "scaleY", 1.0f, 1.25f, 1.0f);
        ObjectAnimator alpha = ObjectAnimator.ofFloat(ring, "alpha", ring.getAlpha(), ring.getAlpha() * 1.8f, ring.getAlpha());

        scaleX.setDuration(2400);
        scaleY.setDuration(2400);
        alpha.setDuration(2400);

        scaleX.setStartDelay(startDelay);
        scaleY.setStartDelay(startDelay);
        alpha.setStartDelay(startDelay);

        scaleX.setRepeatCount(ValueAnimator.INFINITE);
        scaleY.setRepeatCount(ValueAnimator.INFINITE);
        alpha.setRepeatCount(ValueAnimator.INFINITE);

        scaleX.start();
        scaleY.start();
        alpha.start();
    }

    // ─── Firestore: Listen to Order ────────────────────────────────────────────

    private void listenToOrder() {
        orderListener = db.collection("orders").document(orderId)
            .addSnapshotListener((snap, error) -> {
                if (error != null || snap == null || !snap.exists()) return;

                String status = snap.getString("status");
                String restaurantName = snap.getString("restaurantName");
                String restaurantAddress = snap.getString("restaurantAddress");
                String deliveryPersonId = snap.getString("deliveryPersonId");
                String deliveryPersonName = snap.getString("deliveryPersonName");
                String deliveryPersonPhone = snap.getString("deliveryPersonPhone");
                String vehicleNumber = snap.getString("vehicleNumber");
                Double total = snap.getDouble("total");

                // Delivery address
                Object addrObj = snap.get("deliveryAddress");
                String addrStr = "";
                if (addrObj instanceof Map) {
                    Map<?, ?> addr = (Map<?, ?>) addrObj;
                    Object street = addr.get("street");
                    Object city = addr.get("city");
                    Object pincode = addr.get("pincode");
                    addrStr = String.format("%s, %s %s",
                        street != null ? street.toString() : "",
                        city != null ? city.toString() : "",
                        pincode != null ? pincode.toString() : "").trim();
                } else if (addrObj instanceof String) {
                    addrStr = (String) addrObj;
                }

                // Order placed time → ETA
                Object createdAtObj = snap.get("createdAt");
                if (createdAtObj instanceof com.google.firebase.Timestamp) {
                    orderPlacedMs = ((com.google.firebase.Timestamp) createdAtObj).toDate().getTime();
                    Object estObj = snap.get("estimatedDeliveryMinutes");
                    if (estObj instanceof Long) estimatedMins = ((Long) estObj).intValue();
                    startEtaCountdown();
                }

                // Store driver uid for location tracking
                if (deliveryPersonId != null && !deliveryPersonId.equals(driverUid)) {
                    driverUid = deliveryPersonId;
                    listenToDriverLocation(driverUid);
                }

                updateUI(status, restaurantName, restaurantAddress,
                    deliveryPersonName, deliveryPersonPhone, vehicleNumber,
                    addrStr, total);

                // Handle Delivery Verification OTP
                String otp = snap.getString("deliveryOtp");
                if ((otp == null || otp.trim().isEmpty()) && !"delivered".equals(status) && !"cancelled".equals(status)) {
                    int code = Math.abs(orderId.hashCode() % 9000) + 1000;
                    otp = String.valueOf(code);
                    db.collection(Constants.COLLECTION_ORDERS).document(orderId).update("deliveryOtp", otp);
                }

                View cardOtp = findViewById(R.id.card_tracking_otp);
                TextView tvOtp = findViewById(R.id.tv_tracking_otp);
                View btnCopyOtp = findViewById(R.id.btn_copy_tracking_otp);

                if (cardOtp != null) {
                    if ("delivered".equals(status) || "cancelled".equals(status)) {
                        cardOtp.setVisibility(View.GONE);
                    } else {
                        cardOtp.setVisibility(View.VISIBLE);
                        if (tvOtp != null) tvOtp.setText(otp != null ? otp : "----");
                        if (btnCopyOtp != null && otp != null) {
                            final String finalOtp = otp;
                            btnCopyOtp.setOnClickListener(v -> {
                                android.content.ClipboardManager clipboard = (android.content.ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
                                android.content.ClipData clip = android.content.ClipData.newPlainText("Delivery OTP", finalOtp);
                                if (clipboard != null) clipboard.setPrimaryClip(clip);
                                Toast.makeText(OrderTrackingActivity.this, "Delivery OTP copied: " + finalOtp, Toast.LENGTH_SHORT).show();
                            });
                        }
                    }
                }

                // Handle delivery stage sub-status
                Object deliveryObj = snap.get("delivery");
                if (deliveryObj instanceof Map) {
                    String stage = (String)((Map<?,?>)deliveryObj).get("stage");
                    updateDeliveryStageHint(stage);
                }

                // Status-change celebration
                if (status != null && !status.equals(lastStatus)) {
                    animateStatusChange();
                    if ("delivered".equals(status)) showDeliveredCelebration();
                    lastStatus = status;
                }
            });
    }

    // ─── Driver Location: Real-time GPS from Firebase ─────────────────────────
    // The delivery partner's device runs DriverLocationService which publishes to
    // driverLocations/{driverId}. We listen here and update the UI.

    private void listenToDriverLocation(String driverId) {
        if (driverLocationListener != null) driverLocationListener.remove();
        driverLocationListener = db.collection(Constants.COLLECTION_DRIVER_LOCATIONS)
            .document(driverId)
            .addSnapshotListener((snap, error) -> {
                if (snap == null || !snap.exists()) return;
                Double lat = snap.getDouble("latitude");
                Double lng = snap.getDouble("longitude");
                Double speed = snap.getDouble("speed");
                Double accuracy = snap.getDouble("accuracy");
                Double heading = snap.getDouble("heading");

                if (lat != null && lng != null && tvGpsCoords != null) {
                    runOnUiThread(() -> {
                        // Format: phase-aware label + coordinates
                        String speedStr = speed != null ? String.format(Locale.getDefault(), " | %.0f km/h", speed) : "";
                        String accStr  = accuracy != null ? String.format(Locale.getDefault(), " ±%.0fm", accuracy) : "";
                        tvGpsCoords.setText(String.format(Locale.getDefault(),
                            "📍 %.5f, %.5f%s%s", lat, lng, speedStr, accStr));
                        tvGpsCoords.setVisibility(View.VISIBLE);
                        if (gpsLiveBadge != null) gpsLiveBadge.setVisibility(View.VISIBLE);
                    });
                }
            });
    }

    // ─── Update UI ─────────────────────────────────────────────────────────────

    private void updateUI(String status, String restaurant, String restaurantAddr,
                          String driverName, String driverPhone, String vehicleNum,
                          String deliveryAddr, Double total) {
        runOnUiThread(() -> {
            if (tvRestaurantName != null && restaurant != null) tvRestaurantName.setText(restaurant);
            if (tvOrderId != null) tvOrderId.setText("#" + orderId.substring(Math.max(0, orderId.length() - 8)).toUpperCase());
            if (tvDeliveryAddress != null && !deliveryAddr.isEmpty()) tvDeliveryAddress.setText(deliveryAddr);
            if (tvOrderStatus != null && status != null) tvOrderStatus.setText(getStatusEmoji(status) + " " + getStatusLabel(status));

            // Driver card
            boolean hasDriver = driverName != null && !driverName.isEmpty();
            if (cardDriverPartner != null) cardDriverPartner.setVisibility(hasDriver ? View.VISIBLE : View.GONE);
            if (hasDriver) {
                if (tvDriverName != null) tvDriverName.setText(driverName);
                if (tvDriverPhone != null) tvDriverPhone.setText(driverPhone != null ? driverPhone : "");
                if (tvDriverVehicle != null && vehicleNum != null) tvDriverVehicle.setText(vehicleNum);
                final String phone = driverPhone;
                if (btnCallDriver != null) {
                    btnCallDriver.setVisibility(phone != null && !phone.isEmpty() ? View.VISIBLE : View.GONE);
                    btnCallDriver.setOnClickListener(v ->
                        requirePhone(
                            () -> startActivity(new Intent(Intent.ACTION_CALL, Uri.parse("tel:" + phone))),
                            (isPermanent) -> {
                                // Fallback: open dialer without CALL_PHONE permission
                                startActivity(new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + phone)));
                            }
                        )
                    );
                }
            }

            // Build step track
            buildStepTracker(status);
        });
    }

    private String getStatusLabel(String status) {
        if (status == null) return "Loading...";
        switch (status) {
            case "pending":          return "Order Placed";
            case "confirmed":        return "Order Confirmed";
            case "preparing":        return "Kitchen Preparing";
            case "ready":            return "Food Ready";
            case "out_for_delivery": return "Out for Delivery";
            case "delivered":        return "Delivered!";
            case "cancelled":        return "Cancelled";
            default:                 return status;
        }
    }

    private String getStatusEmoji(String status) {
        if (status == null) return "📦";
        switch (status) {
            case "pending":          return "📦";
            case "confirmed":        return "✅";
            case "preparing":        return "👨‍🍳";
            case "ready":            return "🍱";
            case "out_for_delivery": return "🛵";
            case "delivered":        return "🎉";
            case "cancelled":        return "❌";
            default:                 return "📦";
        }
    }

    private void updateDeliveryStageHint(String stage) {
        if (stage == null || tvOrderStatus == null) return;
        String hint = null;
        switch (stage) {
            case "TO_PICKUP":       hint = "🏍️ Driver heading to restaurant"; break;
            case "ARRIVED_PICKUP":  hint = "🍱 Driver collecting your food"; break;
            case "TO_CUSTOMER":     hint = "🚀 Driver on the way to you"; break;
            case "ARRIVED_CUSTOMER":hint = "📍 Driver at your door!"; break;
        }
        if (hint != null) {
            final String finalHint = hint;
            runOnUiThread(() -> tvOrderStatus.setText(finalHint));
        }
    }

    // ─── Vertical Step Tracker ─────────────────────────────────────────────────

    private void buildStepTracker(String currentStatus) {
        if (stepContainer == null) return;
        stepContainer.removeAllViews();

        int currentIdx = indexOfStatus(currentStatus);

        for (int i = 0; i < STEPS.length; i++) {
            boolean done = i < currentIdx;
            boolean active = i == currentIdx;
            boolean upcoming = i > currentIdx;

            View row = LayoutInflater.from(this).inflate(R.layout.item_tracking_step, stepContainer, false);
            if (row == null) {
                // fallback: create programmatically
                row = makeStepRowProgrammatic(i, done, active);
            } else {
                TextView tvEmoji  = row.findViewById(R.id.tv_step_emoji);
                TextView tvLabel  = row.findViewById(R.id.tv_step_label);
                View     vLine    = row.findViewById(R.id.v_step_line);
                View     vDot     = row.findViewById(R.id.v_step_dot);

                if (tvEmoji != null) tvEmoji.setText(STEP_EMOJIS[i]);
                if (tvLabel != null) {
                    tvLabel.setText(STEP_LABELS[i]);
                    tvLabel.setTextColor(done ? 0xFF4CAF50 : active ? STEP_COLORS[i] : 0xFF757575);
                    tvLabel.setAlpha(upcoming ? 0.4f : 1f);
                }
                if (vDot != null) {
                    vDot.setBackgroundColor(done ? 0xFF4CAF50 : active ? STEP_COLORS[i] : 0xFFE0E0E0);
                    if (active) startPulseOnView(vDot);
                }
                if (vLine != null && i == STEPS.length - 1) vLine.setVisibility(View.INVISIBLE);
            }

            stepContainer.addView(row);

            // Animate each row in with slide+fade
            final View finalRow = row;
            finalRow.setAlpha(0f);
            finalRow.setTranslationX(-40f);
            finalRow.animate()
                .alpha(1f).translationX(0f)
                .setDuration(300)
                .setStartDelay(i * 80L)
                .setInterpolator(new AccelerateDecelerateInterpolator())
                .start();
        }

        // Update progress bar
        if (progressTrack != null) {
            int pct = currentIdx * 100 / Math.max(1, STEPS.length - 1);
            ObjectAnimator.ofInt(progressTrack, "progress", progressTrack.getProgress(), pct)
                .setDuration(800)
                .start();
        }
    }

    private int indexOfStatus(String status) {
        if (status == null) return 0;
        for (int i = 0; i < STEPS.length; i++) {
            if (STEPS[i].equals(status)) return i;
        }
        return 0;
    }

    private View makeStepRowProgrammatic(int idx, boolean done, boolean active) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setPadding(0, 8, 0, 8);

        TextView dot = new TextView(this);
        dot.setText(done ? "✓" : STEP_EMOJIS[idx]);
        dot.setTextSize(16);
        dot.setPadding(8, 4, 16, 4);
        if (active) startPulseOnView(dot);
        row.addView(dot);

        TextView label = new TextView(this);
        label.setText(STEP_LABELS[idx]);
        label.setTextColor(done ? 0xFF4CAF50 : active ? STEP_COLORS[idx] : 0xFF757575);
        label.setTextSize(14);
        label.setAlpha(active || done ? 1f : 0.4f);
        row.addView(label);

        return row;
    }

    // ─── ETA Countdown ────────────────────────────────────────────────────────

    private void startEtaCountdown() {
        if (etaHandler != null && etaRunnable != null) etaHandler.removeCallbacks(etaRunnable);
        etaHandler = new Handler(Looper.getMainLooper());
        etaRunnable = new Runnable() {
            @Override
            public void run() {
                if (tvEta == null) return;
                long etaMs = orderPlacedMs + TimeUnit.MINUTES.toMillis(estimatedMins);
                long remainMs = Math.max(0, etaMs - System.currentTimeMillis());
                long mins = TimeUnit.MILLISECONDS.toMinutes(remainMs);
                long secs = TimeUnit.MILLISECONDS.toSeconds(remainMs) % 60;
                if (remainMs == 0) {
                    tvEta.setText("Arriving now! 🎉");
                } else {
                    tvEta.setText(String.format(Locale.getDefault(), "%dm %02ds", mins, secs));
                }
                etaHandler.postDelayed(this, 1000);
            }
        };
        etaHandler.post(etaRunnable);
    }

    // ─── Status Change Animation ───────────────────────────────────────────────

    private void animateStatusChange() {
        if (tvOrderStatus == null) return;
        ObjectAnimator shakeX = ObjectAnimator.ofFloat(tvOrderStatus, "translationX",
            0f, -12f, 12f, -8f, 8f, -4f, 4f, 0f);
        shakeX.setDuration(500);
        shakeX.start();

        // Scale pop
        ObjectAnimator scaleX = ObjectAnimator.ofFloat(tvOrderStatus, "scaleX", 1f, 1.2f, 1f);
        ObjectAnimator scaleY = ObjectAnimator.ofFloat(tvOrderStatus, "scaleY", 1f, 1.2f, 1f);
        scaleX.setDuration(400).setInterpolator(new OvershootInterpolator());
        scaleY.setDuration(400).setInterpolator(new OvershootInterpolator());
        scaleX.start();
        scaleY.start();

        // Flash background
        ValueAnimator flash = ValueAnimator.ofArgb(0x22FF9800, 0x00FF9800);
        flash.setDuration(600);
        flash.addUpdateListener(anim -> {
            if (tvOrderStatus != null) tvOrderStatus.setBackgroundColor((int) anim.getAnimatedValue());
        });
        flash.start();
    }

    private void showDeliveredCelebration() {
        if (tvEta == null) return;
        tvEta.setText("Delivered! 🎉");
        // Bounce the ETA card
        ObjectAnimator bounce = ObjectAnimator.ofFloat(tvEta, "translationY", 0f, -30f, 0f);
        bounce.setDuration(600);
        bounce.setInterpolator(new OvershootInterpolator(2f));
        bounce.start();
        Toast.makeText(this, "🎉 Your order has been delivered! Enjoy your meal!", Toast.LENGTH_LONG).show();
    }

    private void startPulseOnView(View v) {
        ObjectAnimator scale = ObjectAnimator.ofFloat(v, "scaleX", 1f, 1.25f, 1f);
        scale.setRepeatCount(ObjectAnimator.INFINITE);
        scale.setDuration(900);
        scale.start();
        ObjectAnimator scaleY = ObjectAnimator.ofFloat(v, "scaleY", 1f, 1.25f, 1f);
        scaleY.setRepeatCount(ObjectAnimator.INFINITE);
        scaleY.setDuration(900);
        scaleY.start();
    }

    // ─── Lifecycle ─────────────────────────────────────────────────────────────

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (orderListener != null) orderListener.remove();
        if (driverLocationListener != null) driverLocationListener.remove();
        if (etaHandler != null && etaRunnable != null)
            etaHandler.removeCallbacks(etaRunnable);

        // Stop GPS service if we started it (driver mode)
        if (isDriverMode) {
            DriverLocationService.stopTracking(this);
        }
    }
}
