package com.ssr.hunger.activities;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.ProgressBar;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import androidx.cardview.widget.CardView;
import com.ssr.hunger.R;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;
import java.util.Map;

/**
 * Hunger Delivery Partner Fairness Dashboard
 * ===========================================
 * Shows earnings, orders, distance, bonuses, rating,
 * Fair Route Score, and earnings per km/hour.
 * UI intentionally simple for quick rider interaction.
 */
public class DeliveryPartnerDashboardActivity extends AppCompatActivity {

    private FirebaseFirestore db;
    private FirebaseAuth auth;
    private ListenerRegistration earningsListener;

    // Earnings overview
    private TextView tvTotalEarnings;
    private TextView tvBaseEarnings;
    private TextView tvBonusEarnings;
    private TextView tvPendingSettlement;

    // Stats
    private TextView tvTotalOrders;
    private TextView tvDistance;
    private TextView tvRating;
    private TextView tvAvgOrder;

    // Efficiency
    private TextView tvEarningsPerKm;
    private TextView tvEarningsPerHour;

    // Fair Route Score
    private TextView tvFairScore;
    private ProgressBar progressFairScore;
    private TextView tvFairScoreLabel;

    // Time breakdown
    private TextView tvActiveTime;
    private TextView tvWaitingTime;

    // Bonus card
    private CardView cardBonus;
    private TextView tvBonusMessage;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_delivery_dashboard);

        db = FirebaseFirestore.getInstance();
        auth = FirebaseAuth.getInstance();

        initViews();
        setupBackButton();
        showGreeting();
        loadTodayStats();
    }

    private void initViews() {
        tvTotalEarnings = findViewById(R.id.tv_total_earnings);
        tvBaseEarnings = findViewById(R.id.tv_base_earnings);
        tvBonusEarnings = findViewById(R.id.tv_bonus_earnings);
        tvPendingSettlement = findViewById(R.id.tv_pending_settlement);
        tvTotalOrders = findViewById(R.id.tv_total_orders);
        tvDistance = findViewById(R.id.tv_distance);
        tvRating = findViewById(R.id.tv_rating);
        tvAvgOrder = findViewById(R.id.tv_avg_order);
        tvEarningsPerKm = findViewById(R.id.tv_earnings_per_km);
        tvEarningsPerHour = findViewById(R.id.tv_earnings_per_hour);
        tvFairScore = findViewById(R.id.tv_fair_score);
        progressFairScore = findViewById(R.id.progress_fair_score);
        tvFairScoreLabel = findViewById(R.id.tv_fair_score_label);
        tvActiveTime = findViewById(R.id.tv_active_time);
        tvWaitingTime = findViewById(R.id.tv_waiting_time);
        cardBonus = findViewById(R.id.card_bonus);
        tvBonusMessage = findViewById(R.id.tv_bonus_message);
    }

    private void setupBackButton() {
        View btnBack = findViewById(R.id.btn_back);
        if (btnBack != null) btnBack.setOnClickListener(v -> finish());
    }

    private void showGreeting() {
        TextView tvGreeting = findViewById(R.id.tv_greeting);
        if (tvGreeting != null) {
            int hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY);
            String greeting;
            if (hour < 12) greeting = "Good morning, Partner! 👋";
            else if (hour < 17) greeting = "Good afternoon, Partner! 👋";
            else greeting = "Good evening, Partner! 👋";
            tvGreeting.setText(greeting);
        }

        TextView tvDate = findViewById(R.id.tv_date);
        if (tvDate != null) {
            String date = new SimpleDateFormat("EEEE, d MMMM", Locale.getDefault()).format(new Date());
            tvDate.setText(date);
        }
    }

    private void loadTodayStats() {
        if (auth.getCurrentUser() == null) return;
        String uid = auth.getCurrentUser().getUid();
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(new Date());

        earningsListener = db.collection("partnerStats")
                .document(uid + "_" + today)
                .addSnapshotListener((snap, e) -> {
                    if (e != null) return;

                    if (snap != null && snap.exists()) {
                        Map<String, Object> data = snap.getData();
                        if (data != null) {
                            runOnUiThread(() -> bindStats(data));
                        }
                    } else {
                        // Show demo data if no real data
                        runOnUiThread(this::showDemoData);
                    }
                });
    }

    private void bindStats(Map<String, Object> data) {
        double baseEarnings = getDouble(data, "baseEarnings", 0);
        double bonusEarnings = getDouble(data, "bonusEarnings", 0);
        double totalEarnings = baseEarnings + bonusEarnings;
        double pendingSettlement = getDouble(data, "pendingSettlement", 0);
        int totalOrders = getInt(data, "totalOrders", 0);
        double distanceKm = getDouble(data, "totalDistanceKm", 0);
        double avgRating = getDouble(data, "averageRating", 5.0);
        double avgOrderValue = getDouble(data, "avgOrderValue", 0);
        double earningsPerKm = getDouble(data, "earningsPerKm", 0);
        double earningsPerHour = getDouble(data, "earningsPerHour", 0);
        int fairRouteScore = getInt(data, "fairRouteScore", 75);
        int totalTimeMin = getInt(data, "totalTimeMinutes", 0);
        int waitingTimeMin = getInt(data, "waitingTimeMinutes", 0);

        updateUI(totalEarnings, baseEarnings, bonusEarnings, pendingSettlement,
                totalOrders, distanceKm, avgRating, avgOrderValue,
                earningsPerKm, earningsPerHour, fairRouteScore,
                totalTimeMin, waitingTimeMin);
    }

    private void showDemoData() {
        updateUI(786, 666, 120, 120,
                18, 64, 4.9, 43.67,
                12.28, 124, 87,
                380, 45);
    }

    private void updateUI(double total, double base, double bonus, double pending,
                          int orders, double distance, double rating, double avgOrder,
                          double perKm, double perHour, int fairScore,
                          int totalTime, int waitingTime) {
        setText(tvTotalEarnings, "₹" + (int) total);
        setText(tvBaseEarnings, "Base: ₹" + (int) base);
        setText(tvBonusEarnings, "+₹" + (int) bonus + " bonus");
        setText(tvPendingSettlement, "₹" + (int) pending);
        setText(tvTotalOrders, String.valueOf(orders));
        setText(tvDistance, distance + " km");
        setText(tvRating, String.format(Locale.getDefault(), "%.1f ⭐", rating));
        setText(tvAvgOrder, "₹" + (int) avgOrder);
        setText(tvEarningsPerKm, String.format(Locale.getDefault(), "₹%.1f/km", perKm));
        setText(tvEarningsPerHour, "₹" + (int) perHour + "/hr");

        // Fair Route Score
        setText(tvFairScore, String.valueOf(fairScore));
        if (progressFairScore != null) {
            progressFairScore.setMax(100);
            progressFairScore.setProgress(fairScore);
        }
        if (tvFairScoreLabel != null) {
            if (fairScore >= 80) tvFairScoreLabel.setText("✅ Excellent routes");
            else if (fairScore >= 60) tvFairScoreLabel.setText("⚠️ Average efficiency");
            else tvFairScoreLabel.setText("❗ Routes need review");
        }

        // Time breakdown
        setText(tvActiveTime, (totalTime - waitingTime) + " min active");
        setText(tvWaitingTime, waitingTime + " min waiting");

        // Bonus card
        if (cardBonus != null && bonus > 0) {
            cardBonus.setVisibility(View.VISIBLE);
            setText(tvBonusMessage, "🎉 ₹" + (int) bonus + " bonus earned! Completed " + orders + " orders today.");
        }
    }

    private void setText(TextView tv, String text) {
        if (tv != null) tv.setText(text);
    }

    private double getDouble(Map<String, Object> data, String key, double def) {
        Object val = data.get(key);
        return val instanceof Number ? ((Number) val).doubleValue() : def;
    }

    private int getInt(Map<String, Object> data, String key, int def) {
        Object val = data.get(key);
        return val instanceof Number ? ((Number) val).intValue() : def;
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (earningsListener != null) earningsListener.remove();
    }

    public static Intent createIntent(Context context) {
        return new Intent(context, DeliveryPartnerDashboardActivity.class);
    }
}
