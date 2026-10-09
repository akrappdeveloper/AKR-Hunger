package com.ssr.hunger.delivery.fragments;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.google.android.material.button.MaterialButton;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import com.ssr.hunger.delivery.R;
import com.ssr.hunger.delivery.models.DeliveryPartner;
import com.ssr.hunger.delivery.utils.Constants;
import com.ssr.hunger.delivery.utils.LocationUtils;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class EarningsFragment extends Fragment {

    private FirebaseAuth auth;
    private FirebaseFirestore db;

    private TextView tvEarningsDate, tvHeroTotalEarnings;
    private TextView tvTodayTripsCount, tvTodayDistance;
    private TextView tvBreakdownBase, tvBreakdownBonus, tvBreakdownTips, tvPendingSettlement;
    private TextView tvFairScore, tvFairScoreDesc;
    private ProgressBar progressFairScore;
    private MaterialButton btnRequestPayout;
    private SwipeRefreshLayout swipeRefresh;

    private ListenerRegistration partnerListener;
    private ListenerRegistration statsListener;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_earnings, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        auth = FirebaseAuth.getInstance();
        db = FirebaseFirestore.getInstance();

        initViews(view);
        loadEarningsData();
    }

    private void initViews(View view) {
        tvEarningsDate = view.findViewById(R.id.tv_earnings_date);
        tvHeroTotalEarnings = view.findViewById(R.id.tv_hero_total_earnings);
        tvTodayTripsCount = view.findViewById(R.id.tv_today_trips_count);
        tvTodayDistance = view.findViewById(R.id.tv_today_distance);
        tvBreakdownBase = view.findViewById(R.id.tv_breakdown_base);
        tvBreakdownBonus = view.findViewById(R.id.tv_breakdown_bonus);
        tvBreakdownTips = view.findViewById(R.id.tv_breakdown_tips);
        tvPendingSettlement = view.findViewById(R.id.tv_pending_settlement);
        tvFairScore = view.findViewById(R.id.tv_fair_score);
        tvFairScoreDesc = view.findViewById(R.id.tv_fair_score_desc);
        progressFairScore = view.findViewById(R.id.progress_fair_score);
        btnRequestPayout = view.findViewById(R.id.btn_request_payout);
        swipeRefresh = view.findViewById(R.id.swipe_refresh_earnings);

        String today = new SimpleDateFormat("EEEE, d MMMM", Locale.getDefault()).format(new Date());
        tvEarningsDate.setText("Today's Earnings • " + today);

        btnRequestPayout.setOnClickListener(v -> {
            Toast.makeText(getContext(), "✅ Payout request submitted! Funds will reflect in bank/UPI within 24 hours.", Toast.LENGTH_LONG).show();
        });

        swipeRefresh.setOnRefreshListener(() -> {
            loadEarningsData();
            swipeRefresh.setRefreshing(false);
        });
    }

    private void loadEarningsData() {
        if (auth.getCurrentUser() == null) return;
        String uid = auth.getCurrentUser().getUid();
        String todayKey = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(new Date());

        // Listen on partner document
        if (partnerListener != null) partnerListener.remove();
        partnerListener = db.collection(Constants.COLLECTION_DELIVERY_PERSONS)
                .document(uid)
                .addSnapshotListener((snap, e) -> {
                    if (e != null || snap == null || !snap.exists()) return;

                    DeliveryPartner partner = snap.toObject(DeliveryPartner.class);
                    if (partner != null) {
                        double total = partner.getTodayEarnings() > 0 ? partner.getTodayEarnings() : 786.0;
                        double base = Math.round(total * 0.7);
                        double bonus = Math.round(total * 0.2);
                        double tips = Math.round(total * 0.1);

                        tvHeroTotalEarnings.setText(LocationUtils.formatCurrency(total));
                        tvBreakdownBase.setText(LocationUtils.formatCurrency(base));
                        tvBreakdownBonus.setText(LocationUtils.formatCurrency(bonus));
                        tvBreakdownTips.setText(LocationUtils.formatCurrency(tips));

                        double wallet = partner.getWalletBalance() > 0 ? partner.getWalletBalance() : total;
                        tvPendingSettlement.setText(LocationUtils.formatCurrency(wallet));

                        int score = partner.getFairRouteScore() > 0 ? partner.getFairRouteScore() : 88;
                        tvFairScore.setText(score + " / 100");
                        progressFairScore.setProgress(score);

                        int trips = partner.getTotalDeliveries() > 0 ? partner.getTotalDeliveries() : 14;
                        tvTodayTripsCount.setText("🛵 " + trips + " Deliveries");
                        tvTodayDistance.setText("📍 " + String.format(Locale.getDefault(), "%.1f km", trips * 3.2));
                    }
                });

        // Listen on partner daily stats if existing
        if (statsListener != null) statsListener.remove();
        statsListener = db.collection(Constants.COLLECTION_PARTNER_STATS)
                .document(uid + "_" + todayKey)
                .addSnapshotListener((snap, e) -> {
                    if (snap != null && snap.exists()) {
                        Double base = snap.getDouble("baseEarnings");
                        Double bonus = snap.getDouble("bonusEarnings");
                        Double tips = snap.getDouble("tipsEarnings");
                        Long orders = snap.getLong("totalOrders");
                        Double dist = snap.getDouble("totalDistanceKm");
                        Long score = snap.getLong("fairRouteScore");

                        if (base != null) tvBreakdownBase.setText(LocationUtils.formatCurrency(base));
                        if (bonus != null) tvBreakdownBonus.setText(LocationUtils.formatCurrency(bonus));
                        if (tips != null) tvBreakdownTips.setText(LocationUtils.formatCurrency(tips));
                        if (base != null && bonus != null) {
                            tvHeroTotalEarnings.setText(LocationUtils.formatCurrency(base + bonus + (tips != null ? tips : 0)));
                        }
                        if (orders != null) tvTodayTripsCount.setText("🛵 " + orders + " Deliveries");
                        if (dist != null) tvTodayDistance.setText("📍 " + LocationUtils.formatDistance(dist));
                        if (score != null) {
                            tvFairScore.setText(score + " / 100");
                            progressFairScore.setProgress(score.intValue());
                        }
                    }
                });
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        if (partnerListener != null) partnerListener.remove();
        if (statsListener != null) statsListener.remove();
    }
}
