package com.ssr.hunger.activities;

import android.content.Context;
import android.os.Bundle;
import android.os.CountDownTimer;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.TextView;
import android.widget.Toast;

import com.google.android.material.textfield.TextInputEditText;
import com.google.firebase.Timestamp;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.DocumentReference;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.FieldValue;
import com.ssr.hunger.R;
import com.ssr.hunger.utils.Constants;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Order Cancellation Activity — Android counterpart of the web app's cancel flow.
 *
 * Features:
 * - Server-side validated 5-minute cancellation window (shown as countdown)
 * - Reason selection (required)
 * - Calls the secure backend /api/orders/cancel
 * - Shows refund method and status to the customer
 * - Locks UI if window expired or order is being prepared
 */
public class OrderCancellationActivity extends BaseActivity {

    private static final long CANCELLATION_WINDOW_MS = 5 * 60 * 1000L;

    private static final String[] REASONS = {
        "Ordered by mistake",
        "Changed my mind",
        "Wrong address entered",
        "Ordered wrong item",
        "Delivery taking too long",
        "Found a better option",
        "Other"
    };

    private FirebaseFirestore db;
    private String orderId;
    private Date orderCreatedAt;
    private String orderStatus;
    private double orderTotal;
    private String paymentMethod;
    private String paymentStatus;
    private String customerId;

    private CountDownTimer countdownTimer;
    private boolean windowExpired = false;

    // Views
    private TextView tvTimer, tvWindowStatus, tvRefundInfo, tvOrderId;
    private RadioGroup radioGroupReasons;
    private TextInputEditText etCustomReason;
    private Button btnConfirmCancel, btnBack;
    private LinearLayout layoutCustomReason, layoutExpired;

    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_order_cancellation);

        db = FirebaseFirestore.getInstance();
        orderId = getIntent().getStringExtra(Constants.EXTRA_ORDER_ID);
        if (orderId == null) { finish(); return; }

        initViews();
        loadOrder();
    }

    private void initViews() {
        tvTimer         = findViewById(R.id.tv_cancellation_timer);
        tvWindowStatus  = findViewById(R.id.tv_window_status);
        tvRefundInfo    = findViewById(R.id.tv_refund_info);
        tvOrderId       = findViewById(R.id.tv_order_id);
        radioGroupReasons = findViewById(R.id.radio_group_reasons);
        etCustomReason  = findViewById(R.id.et_custom_reason);
        btnConfirmCancel = findViewById(R.id.btn_confirm_cancel);
        btnBack         = findViewById(R.id.btn_back);
        layoutCustomReason = findViewById(R.id.layout_custom_reason);
        layoutExpired   = findViewById(R.id.layout_expired);

        btnBack.setOnClickListener(v -> finish());

        // Build reason radio buttons dynamically
        for (String reason : REASONS) {
            RadioButton rb = new RadioButton(this);
            rb.setText(reason);
            rb.setTextSize(15f);
            rb.setPadding(12, 12, 12, 12);
            radioGroupReasons.addView(rb);
        }

        radioGroupReasons.setOnCheckedChangeListener((group, checkedId) -> {
            RadioButton selected = group.findViewById(checkedId);
            if (selected != null && "Other".equals(selected.getText().toString())) {
                layoutCustomReason.setVisibility(View.VISIBLE);
            } else {
                layoutCustomReason.setVisibility(View.GONE);
            }
        });

        btnConfirmCancel.setOnClickListener(v -> handleCancelOrder());
    }

    private void loadOrder() {
        db.collection(Constants.COLLECTION_ORDERS).document(orderId)
            .get()
            .addOnSuccessListener(doc -> {
                if (!doc.exists()) { finish(); return; }

                orderStatus   = doc.getString("status");
                orderTotal    = doc.getDouble("total") != null ? doc.getDouble("total") : 0;
                paymentMethod = doc.getString("paymentMethod");
                paymentStatus = doc.getString("paymentStatus");
                customerId    = doc.getString("customerId");

                Timestamp ts = doc.getTimestamp("createdAt");
                orderCreatedAt = ts != null ? ts.toDate() : new Date();

                runOnUiThread(() -> populateUI());
            })
            .addOnFailureListener(e -> {
                Toast.makeText(this, "Failed to load order", Toast.LENGTH_SHORT).show();
                finish();
            });
    }

    private void populateUI() {
        tvOrderId.setText("Order #" + orderId.substring(0, Math.min(8, orderId.length())).toUpperCase());

        // Check non-cancellable statuses
        String[] lockedStatuses = {"preparing", "ready", "out_for_delivery", "delivered", "cancelled"};
        for (String s : lockedStatuses) {
            if (s.equals(orderStatus)) {
                showExpiredState(
                    "preparing".equals(orderStatus)
                        ? "Your order is already being prepared. Please contact Hunger Support."
                        : "This order cannot be cancelled."
                );
                return;
            }
        }

        // Start the server-time based countdown
        long elapsed = System.currentTimeMillis() - orderCreatedAt.getTime();
        long remaining = CANCELLATION_WINDOW_MS - elapsed;

        if (remaining <= 0) {
            windowExpired = true;
            showExpiredState("Cancellation window expired. Please contact support.");
            return;
        }

        // Show refund info
        if (("online".equals(paymentMethod) || "wallet".equals(paymentMethod)) && "completed".equals(paymentStatus)) {
            String refundMsg = "wallet".equals(paymentMethod)
                ? String.format("₹%.0f will be instantly credited to your Hunger Wallet.", orderTotal)
                : String.format("₹%.0f refund will be initiated to your original payment method (2-7 days).", orderTotal);
            tvRefundInfo.setText(refundMsg);
            tvRefundInfo.setVisibility(View.VISIBLE);
        }

        startCountdown(remaining);
    }

    private void startCountdown(long remainingMs) {
        countdownTimer = new CountDownTimer(remainingMs, 1000) {
            @Override
            public void onTick(long millisUntilFinished) {
                long mins = millisUntilFinished / 60000;
                long secs = (millisUntilFinished % 60000) / 1000;
                String timerText = String.format("%d:%02d", mins, secs);
                runOnUiThread(() -> {
                    tvTimer.setText(timerText);
                    tvWindowStatus.setText("Free cancellation expires in " + timerText);
                    if (millisUntilFinished < 60000) {
                        tvTimer.setTextColor(getColor(android.R.color.holo_red_dark));
                    }
                });
            }

            @Override
            public void onFinish() {
                windowExpired = true;
                runOnUiThread(() -> showExpiredState("Cancellation window expired."));
            }
        }.start();
    }

    private void showExpiredState(String message) {
        if (layoutExpired != null) {
            layoutExpired.setVisibility(View.VISIBLE);
        }
        tvWindowStatus.setText(message);
        tvTimer.setText("00:00");
        btnConfirmCancel.setEnabled(false);
        btnConfirmCancel.setAlpha(0.5f);
        radioGroupReasons.setEnabled(false);
        for (int i = 0; i < radioGroupReasons.getChildCount(); i++) {
            radioGroupReasons.getChildAt(i).setEnabled(false);
        }
    }

    private void handleCancelOrder() {
        if (windowExpired) {
            Toast.makeText(this, "Cancellation window has expired", Toast.LENGTH_SHORT).show();
            return;
        }

        // Get selected reason
        int selectedId = radioGroupReasons.getCheckedRadioButtonId();
        if (selectedId == -1) {
            Toast.makeText(this, "Please select a cancellation reason", Toast.LENGTH_SHORT).show();
            return;
        }

        RadioButton selected = radioGroupReasons.findViewById(selectedId);
        String reason = selected.getText().toString();

        if ("Other".equals(reason)) {
            String customText = etCustomReason.getText() != null ? etCustomReason.getText().toString().trim() : "";
            if (customText.isEmpty()) {
                etCustomReason.setError("Please describe your reason");
                return;
            }
            reason = customText;
        }

        // Verify user owns this order
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) { Toast.makeText(this, "Not authenticated", Toast.LENGTH_SHORT).show(); return; }
        if (!user.getUid().equals(customerId)) {
            Toast.makeText(this, "Unauthorized", Toast.LENGTH_SHORT).show();
            return;
        }

        btnConfirmCancel.setEnabled(false);
        btnConfirmCancel.setText("Cancelling...");

        final String finalReason = reason;
        final String uid = user.getUid();

        executor.execute(() -> {
            try {
                // Call the secure backend cancel API
                URL url = new URL(Constants.API_BASE_URL + "/api/orders/cancel");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setDoOutput(true);

                // Get Firebase ID token for auth
                user.getIdToken(false).addOnSuccessListener(tokenResult -> {
                    conn.setRequestProperty("Authorization", "Bearer " + tokenResult.getToken());
                    try {
                        JSONObject body = new JSONObject();
                        body.put("orderId", orderId);
                        body.put("userId", uid);
                        body.put("reason", finalReason);

                        OutputStream os = conn.getOutputStream();
                        os.write(body.toString().getBytes(StandardCharsets.UTF_8));
                        os.close();

                        int responseCode = conn.getResponseCode();
                        JSONObject response = new JSONObject(
                            new String(conn.getInputStream().readAllBytes(), StandardCharsets.UTF_8)
                        );

                        runOnUiThread(() -> {
                            if (responseCode == 200 && response.optBoolean("success")) {
                                // Show success message
                                String refundStatus = response.optJSONObject("refund") != null
                                    ? response.optJSONObject("refund").optString("status", "") : "";
                                String successMsg = "Order cancelled successfully!";
                                if ("COMPLETED".equals(refundStatus)) {
                                    successMsg += "\n₹" + String.format("%.0f", orderTotal) + " credited to your Wallet instantly!";
                                } else if ("INITIATED".equals(refundStatus)) {
                                    successMsg += "\nRefund initiated. Will reflect in 2-7 days.";
                                }
                                Toast.makeText(OrderCancellationActivity.this, successMsg, Toast.LENGTH_LONG).show();
                                setResult(RESULT_OK);
                                finish();
                            } else {
                                String error = response.optString("error", "Cancellation failed");
                                Toast.makeText(OrderCancellationActivity.this, error, Toast.LENGTH_LONG).show();
                                btnConfirmCancel.setEnabled(true);
                                btnConfirmCancel.setText("Confirm Cancellation");
                            }
                        });
                    } catch (Exception e) {
                        runOnUiThread(() -> {
                            Toast.makeText(OrderCancellationActivity.this, "Error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                            btnConfirmCancel.setEnabled(true);
                            btnConfirmCancel.setText("Confirm Cancellation");
                        });
                        recordException("cancel_api_error", e);
                    }
                });

            } catch (Exception e) {
                runOnUiThread(() -> {
                    Toast.makeText(this, "Network error. Try again.", Toast.LENGTH_SHORT).show();
                    btnConfirmCancel.setEnabled(true);
                    btnConfirmCancel.setText("Confirm Cancellation");
                });
                recordException("cancel_network_error", e);
            }
        });
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (countdownTimer != null) countdownTimer.cancel();
        executor.shutdown();
    }
}
