package com.ssr.hunger.activities;

import android.animation.ObjectAnimator;
import android.animation.ValueAnimator;
import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.animation.AccelerateDecelerateInterpolator;
import android.view.animation.OvershootInterpolator;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import com.ssr.hunger.R;
import com.ssr.hunger.utils.Constants;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import com.google.firebase.firestore.Query;
import java.util.Locale;
import java.util.Map;

/**
 * RewardsActivity - mirrors the web app's /customer/rewards page.
 * Shows points balance, tier status, rewards catalog, and earn history.
 * Extends BaseActivity for Analytics, Crashlytics, and Performance monitoring.
 */
public class RewardsActivity extends BaseActivity {

    private FirebaseFirestore db;
    private FirebaseAuth auth;
    private ListenerRegistration profileListener;
    private ListenerRegistration activityListener;

    private TextView tvPoints, tvTierName, tvTierEmoji, tvNextTierInfo;
    private ProgressBar progressTier;
    private LinearLayout activityContainer;
    private LinearLayout rewardsContainer;

    private static final int[][] TIERS = {
            // {minPoints, maxPoints} — keep as int[][] for simplicity
            {0, 499},
            {500, 1499},
            {1500, 3999},
            {4000, Integer.MAX_VALUE}
    };
    private static final String[] TIER_NAMES = {"Bronze", "Silver", "Gold", "Platinum"};
    private static final String[] TIER_EMOJIS = {"🥉", "🥈", "🥇", "💎"};

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_rewards);

        db = FirebaseFirestore.getInstance();
        auth = FirebaseAuth.getInstance();

        tvPoints = findViewById(R.id.tv_points_balance);
        tvTierName = findViewById(R.id.tv_tier_name);
        tvTierEmoji = findViewById(R.id.tv_tier_emoji);
        tvNextTierInfo = findViewById(R.id.tv_next_tier);
        progressTier = findViewById(R.id.progress_tier);
        activityContainer = findViewById(R.id.activity_container);
        rewardsContainer = findViewById(R.id.rewards_container);

        findViewById(R.id.btn_back).setOnClickListener(v -> finish());
        findViewById(R.id.btn_refer).setOnClickListener(v -> openReferral());
        findViewById(R.id.btn_redeem).setOnClickListener(v -> Toast.makeText(this, "Redeem coming soon!", Toast.LENGTH_SHORT).show());

        populateRewardsCatalog();
        listenToProfile();
        listenToActivity();

        logBreadcrumb("RewardsActivity: Opened");
    }

    private void listenToProfile() {
        String uid = auth.getCurrentUser() != null ? auth.getCurrentUser().getUid() : null;
        if (uid == null) return;

        profileListener = db.collection(Constants.COLLECTION_USERS).document(uid)
                .addSnapshotListener((doc, error) -> {
                    if (error != null) { recordException("RewardsActivity_profile", error); return; }
                    if (doc == null || !doc.exists()) return;

                    Long points = doc.getLong("rewardPoints");
                    int totalPoints = points != null ? points.intValue() : 0;

                    // Animated count-up for points number
                    animatePointsCount(totalPoints);
                    updateTierUI(totalPoints);
                });
    }

    /** Count-up animation for the points balance display */
    private void animatePointsCount(int target) {
        ValueAnimator animator = ValueAnimator.ofInt(0, target);
        animator.setDuration(1200);
        animator.setInterpolator(new AccelerateDecelerateInterpolator());
        animator.addUpdateListener(anim -> {
            if (tvPoints != null)
                tvPoints.setText(String.valueOf(anim.getAnimatedValue()));
        });
        animator.start();
        // Bounce the points display
        if (tvPoints != null) {
            ObjectAnimator bounce = ObjectAnimator.ofFloat(tvPoints, "scaleX", 0.8f, 1.15f, 1f);
            bounce.setDuration(800);
            bounce.setInterpolator(new OvershootInterpolator());
            bounce.start();
            ObjectAnimator bounceY = ObjectAnimator.ofFloat(tvPoints, "scaleY", 0.8f, 1.15f, 1f);
            bounceY.setDuration(800);
            bounceY.setInterpolator(new OvershootInterpolator());
            bounceY.start();
        }
    }

    private void updateTierUI(int totalPoints) {
        int tierIndex = 0;
        for (int i = TIERS.length - 1; i >= 0; i--) {
            if (totalPoints >= TIERS[i][0]) { tierIndex = i; break; }
        }

        tvTierName.setText(TIER_NAMES[tierIndex] + " Member");
        tvTierEmoji.setText(TIER_EMOJIS[tierIndex]);

        // Animate tier emoji with a spin
        if (tvTierEmoji != null) {
            ObjectAnimator spin = ObjectAnimator.ofFloat(tvTierEmoji, "rotationY", 0f, 360f);
            spin.setDuration(600);
            spin.start();
        }

        if (tierIndex < TIERS.length - 1) {
            int nextMin = TIERS[tierIndex + 1][0];
            int currMin = TIERS[tierIndex][0];
            int progress = (int) (((float) (totalPoints - currMin) / (nextMin - currMin)) * 100);
            int clampedProgress = Math.min(100, Math.max(0, progress));
            // Animate progress bar
            if (progressTier != null) {
                ObjectAnimator anim = ObjectAnimator.ofInt(progressTier, "progress", 0, clampedProgress);
                anim.setDuration(900);
                anim.setInterpolator(new AccelerateDecelerateInterpolator());
                anim.start();
            }
            tvNextTierInfo.setText((nextMin - totalPoints) + " pts to " + TIER_NAMES[tierIndex + 1]);
        } else {
            if (progressTier != null) {
                ObjectAnimator.ofInt(progressTier, "progress", 0, 100).setDuration(600).start();
            }
            tvNextTierInfo.setText("🏆 Maximum Tier Reached!");
        }
    }

    private void listenToActivity() {
        String uid = auth.getCurrentUser() != null ? auth.getCurrentUser().getUid() : null;
        if (uid == null) return;

        activityListener = db.collection(Constants.COLLECTION_USERS).document(uid)
                .collection("pointActivities")
                .orderBy("createdAt", Query.Direction.DESCENDING)
                .limit(15)
                .addSnapshotListener((snap, error) -> {
                    if (error != null) return;
                    activityContainer.removeAllViews();
                    if (snap == null || snap.isEmpty()) {
                        addEmptyActivityState();
                        return;
                    }
                    for (com.google.firebase.firestore.DocumentSnapshot doc : snap.getDocuments()) {
                        addActivityRow(
                                doc.getString("description"),
                                doc.getLong("points"),
                                doc.getString("type"),
                                doc.getTimestamp("createdAt")
                        );
                    }
                });
    }

    private void addActivityRow(String description, Long points, String type, com.google.firebase.Timestamp ts) {
        View row = LayoutInflater.from(this).inflate(R.layout.item_points_activity, activityContainer, false);
        if (row == null) return;

        TextView tvDesc = row.findViewById(R.id.tv_activity_desc);
        TextView tvPoints = row.findViewById(R.id.tv_activity_points);
        TextView tvDate = row.findViewById(R.id.tv_activity_date);

        if (tvDesc != null) tvDesc.setText(description != null ? description : "Activity");
        if (tvDate != null && ts != null) {
            java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("dd MMM yyyy", java.util.Locale.getDefault());
            tvDate.setText(sdf.format(ts.toDate()));
        }

        if (tvPoints != null && points != null) {
            boolean isNegative = "redeemed".equals(type) || "expired".equals(type);
            tvPoints.setText((isNegative ? "-" : "+") + points + " pts");
            tvPoints.setTextColor(getResources().getColor(isNegative ? R.color.error : R.color.success, getTheme()));
        }

        // Slide-in animation for each row
        row.setAlpha(0f);
        row.setTranslationX(-60f);
        int delay = activityContainer.getChildCount() * 60;
        row.animate().alpha(1f).translationX(0f).setDuration(300).setStartDelay(delay)
            .setInterpolator(new AccelerateDecelerateInterpolator()).start();

        activityContainer.addView(row);
    }

    private void addEmptyActivityState() {
        TextView tv = new TextView(this);
        tv.setText("📋 No point activity yet. Start ordering to earn points!");
        tv.setTextAlignment(View.TEXT_ALIGNMENT_CENTER);
        tv.setPadding(0, 48, 0, 48);
        activityContainer.addView(tv);
    }

    private void populateRewardsCatalog() {
        if (rewardsContainer == null) return;
        String[][] rewards = {
                {"₹50 Off", "200 pts", "🎫"},
                {"Free Delivery", "150 pts", "🛵"},
                {"₹100 Off on ₹500+", "350 pts", "💰"},
                {"Free Dessert", "500 pts", "🍰"},
                {"20% Off Weekend", "600 pts", "🎉"},
                {"Premium 1 Month", "1000 pts", "👑"},
        };
        for (String[] r : rewards) {
            View card = LayoutInflater.from(this).inflate(R.layout.item_reward_catalog, rewardsContainer, false);
            if (card == null) continue;
            TextView tvName = card.findViewById(R.id.tv_reward_name);
            TextView tvPts = card.findViewById(R.id.tv_reward_points);
            TextView tvEmoji = card.findViewById(R.id.tv_reward_emoji);
            if (tvName != null) tvName.setText(r[0]);
            if (tvPts != null) tvPts.setText(r[1]);
            if (tvEmoji != null) tvEmoji.setText(r[2]);
            card.setOnClickListener(v -> Toast.makeText(this, "Redeeming rewards coming soon!", Toast.LENGTH_SHORT).show());
            rewardsContainer.addView(card);
        }
    }

    private void openReferral() {
        startActivity(new Intent(this, ReferralActivity.class));
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (profileListener != null) profileListener.remove();
        if (activityListener != null) activityListener.remove();
    }

    @Override
    protected String getScreenName() { return "Rewards"; }
}
