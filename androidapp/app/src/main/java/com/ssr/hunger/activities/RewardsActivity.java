package com.ssr.hunger.activities;

import android.animation.ObjectAnimator;
import android.animation.ValueAnimator;
import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.animation.AccelerateDecelerateInterpolator;
import android.view.animation.OvershootInterpolator;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;

import com.google.android.material.button.MaterialButton;
import com.ssr.hunger.dialogs.ModernDialogHelper;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.database.DataSnapshot;
import com.google.firebase.database.DatabaseError;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.ValueEventListener;
import com.google.firebase.firestore.FieldValue;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import com.google.firebase.firestore.Query;
import com.ssr.hunger.R;
import com.ssr.hunger.utils.Constants;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * RewardsActivity - VIP Loyalty Club & Points Management.
 * Supports redeeming voucher codes via Firebase Realtime Database.
 */
public class RewardsActivity extends BaseActivity {

    private static final String RTDB_URL = "https://akr-hunger-default-rtdb.firebaseio.com";

    private FirebaseFirestore db;
    private FirebaseAuth auth;
    private DatabaseReference rtdbRef;
    private ListenerRegistration profileListener;
    private ListenerRegistration activityListener;

    private TextView tvPoints, tvTierName, tvTierEmoji, tvNextTierInfo, tvRedeemStatus;
    private ProgressBar progressTier;
    private LinearLayout activityContainer;
    private LinearLayout rewardsContainer;
    private EditText etRedeemCode;
    private MaterialButton btnSubmitRedeem;

    private int currentPointsBalance = 0;

    private static final int[][] TIERS = {
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
        try {
            rtdbRef = FirebaseDatabase.getInstance(RTDB_URL).getReference();
        } catch (Exception e) {
            recordException("Rewards_RTDB_Init", e);
        }

        initViews();
        populateRewardsCatalog();
        listenToProfile();
        listenToActivity();

        logBreadcrumb("RewardsActivity: Opened");
    }

    private void initViews() {
        tvPoints = findViewById(R.id.tv_points_balance);
        tvTierName = findViewById(R.id.tv_tier_name);
        tvTierEmoji = findViewById(R.id.tv_tier_emoji);
        tvNextTierInfo = findViewById(R.id.tv_next_tier);
        progressTier = findViewById(R.id.progress_tier);
        activityContainer = findViewById(R.id.activity_container);
        rewardsContainer = findViewById(R.id.rewards_container);
        etRedeemCode = findViewById(R.id.et_redeem_code);
        btnSubmitRedeem = findViewById(R.id.btn_submit_redeem);
        tvRedeemStatus = findViewById(R.id.tv_redeem_status);

        View btnBack = findViewById(R.id.btn_back);
        if (btnBack != null) btnBack.setOnClickListener(v -> finish());

        View btnRefer = findViewById(R.id.btn_refer);
        if (btnRefer != null) btnRefer.setOnClickListener(v -> openReferral());

        View btnRedeem = findViewById(R.id.btn_redeem);
        if (btnRedeem != null) {
            btnRedeem.setOnClickListener(v -> {
                startActivity(new Intent(RewardsActivity.this, DealsActivity.class));
            });
        }

        if (btnSubmitRedeem != null) {
            btnSubmitRedeem.setOnClickListener(v -> handleRedeemCode());
        }
    }

    /**
     * Handle user redeeming voucher code from Firebase Realtime Database
     */
    private void handleRedeemCode() {
        if (etRedeemCode == null) return;
        String rawCode = etRedeemCode.getText().toString().trim();
        if (rawCode.isEmpty()) {
            Toast.makeText(this, "Please enter a valid redeem code", Toast.LENGTH_SHORT).show();
            return;
        }

        final String code = rawCode.toUpperCase(Locale.getDefault());
        String uid = auth.getCurrentUser() != null ? auth.getCurrentUser().getUid() : null;
        if (uid == null) {
            Toast.makeText(this, "Please sign in to redeem codes", Toast.LENGTH_SHORT).show();
            return;
        }

        btnSubmitRedeem.setEnabled(false);
        btnSubmitRedeem.setText("Verifying...");

        // 1. Check in Firebase Realtime Database /redeem_codes
        if (rtdbRef != null) {
            rtdbRef.child("redeem_codes").addListenerForSingleValueEvent(new ValueEventListener() {
                @Override
                public void onDataChange(@NonNull DataSnapshot snapshot) {
                    boolean found = false;
                    for (DataSnapshot child : snapshot.getChildren()) {
                        String rCode = child.child("code").getValue(String.class);
                        if (code.equalsIgnoreCase(rCode)) {
                            found = true;
                            processRedemption(child, uid, code);
                            break;
                        }
                    }

                    if (!found) {
                        // Fallback check Firestore /redeemCodes
                        checkFirestoreRedeemCode(uid, code);
                    }
                }

                @Override
                public void onCancelled(@NonNull DatabaseError error) {
                    btnSubmitRedeem.setEnabled(true);
                    btnSubmitRedeem.setText("Redeem");
                    Toast.makeText(RewardsActivity.this, "Network error. Please try again.", Toast.LENGTH_SHORT).show();
                }
            });
        } else {
            checkFirestoreRedeemCode(uid, code);
        }
    }

    private void processRedemption(DataSnapshot childSnapshot, String uid, String code) {
        Boolean isActive = childSnapshot.child("isActive").getValue(Boolean.class);
        if (isActive != null && !isActive) {
            resetRedeemButton();
            showRedeemFailure("This redeem code has expired or is inactive.");
            return;
        }

        // Check expiration
        String expiresAt = childSnapshot.child("expiresAt").getValue(String.class);
        if (expiresAt != null && !expiresAt.isEmpty()) {
            try {
                SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault());
                Date expDate = sdf.parse(expiresAt);
                if (expDate != null && new Date().after(expDate)) {
                    resetRedeemButton();
                    showRedeemFailure("This redeem code has expired.");
                    return;
                }
            } catch (Exception ignored) {}
        }

        // Check maxRedemptions
        Integer maxRedemptions = childSnapshot.child("maxRedemptions").getValue(Integer.class);
        Integer currentCount = childSnapshot.child("redemptionCount").getValue(Integer.class);
        int count = currentCount != null ? currentCount : 0;
        if (maxRedemptions != null && maxRedemptions > 0 && count >= maxRedemptions) {
            resetRedeemButton();
            showRedeemFailure("This code has reached its maximum redemption limit.");
            return;
        }

        Double val = childSnapshot.child("value").getValue(Double.class);
        final double rewardVal = val != null ? val : 100.0;
        String type = childSnapshot.child("type").getValue(String.class);
        final String benefitType = type != null ? type : "points";
        String desc = childSnapshot.child("description").getValue(String.class);

        // Check if user already used this code
        db.collection(Constants.COLLECTION_USERS).document(uid)
                .collection("pointActivities")
                .whereEqualTo("redeemedCode", code)
                .limit(1)
                .get()
                .addOnSuccessListener(checkSnap -> {
                    if (checkSnap != null && !checkSnap.isEmpty()) {
                        resetRedeemButton();
                        showRedeemFailure("You have already redeemed this code!");
                        return;
                    }

                    // Increment redemption count
                    childSnapshot.getRef().child("redemptionCount").setValue(count + 1);

                    // Credit reward
                    if ("wallet".equalsIgnoreCase(benefitType)) {
                        creditUserWallet(uid, rewardVal, code, desc != null ? desc : "Redeemed Code " + code);
                    } else {
                        creditUserPoints(uid, (int) rewardVal, code, desc != null ? desc : "Redeemed Code " + code);
                    }
                })
                .addOnFailureListener(e -> {
                    childSnapshot.getRef().child("redemptionCount").setValue(count + 1);
                    if ("wallet".equalsIgnoreCase(benefitType)) {
                        creditUserWallet(uid, rewardVal, code, desc != null ? desc : "Redeemed Code " + code);
                    } else {
                        creditUserPoints(uid, (int) rewardVal, code, desc != null ? desc : "Redeemed Code " + code);
                    }
                });
    }

    private void checkFirestoreRedeemCode(String uid, String code) {
        db.collection("redeemCodes")
                .whereEqualTo("code", code)
                .limit(1)
                .get()
                .addOnSuccessListener(snap -> {
                    if (snap != null && !snap.isEmpty()) {
                        com.google.firebase.firestore.DocumentSnapshot doc = snap.getDocuments().get(0);
                        Boolean isActive = doc.getBoolean("isActive");
                        if (isActive != null && !isActive) {
                            resetRedeemButton();
                            showRedeemFailure("This redeem code is inactive.");
                            return;
                        }
                        Long val = doc.getLong("value");
                        int points = val != null ? val.intValue() : 100;
                        String desc = doc.getString("description");
                        String type = doc.getString("type");

                        // Update Firestore count
                        doc.getReference().update("redemptionCount", FieldValue.increment(1));

                        if ("wallet".equalsIgnoreCase(type)) {
                            creditUserWallet(uid, points, code, desc != null ? desc : "Redeemed Code " + code);
                        } else {
                            creditUserPoints(uid, points, code, desc != null ? desc : "Redeemed Code " + code);
                        }
                    } else {
                        resetRedeemButton();
                        showRedeemFailure("Invalid redeem code. Please check and try again.");
                    }
                })
                .addOnFailureListener(e -> {
                    resetRedeemButton();
                    showRedeemFailure("Failed to verify code. Please try again.");
                });
    }

    private void creditUserPoints(String uid, int pointsToAdd, String code, String description) {
        db.collection(Constants.COLLECTION_USERS).document(uid)
                .update("rewardPoints", FieldValue.increment(pointsToAdd))
                .addOnSuccessListener(aVoid -> {
                    Map<String, Object> act = new HashMap<>();
                    act.put("description", "Redeemed Code: " + code);
                    act.put("points", pointsToAdd);
                    act.put("type", "earned");
                    act.put("redeemedCode", code);
                    act.put("createdAt", FieldValue.serverTimestamp());

                    db.collection(Constants.COLLECTION_USERS).document(uid)
                            .collection("pointActivities")
                            .add(act);

                    resetRedeemButton();
                    if (etRedeemCode != null) etRedeemCode.setText("");

                    showRedeemSuccess(pointsToAdd, code, "+" + pointsToAdd + " Reward Points");
                })
                .addOnFailureListener(e -> {
                    resetRedeemButton();
                    showRedeemFailure("Failed to credit points. Please try again.");
                });
    }

    private void creditUserWallet(String uid, double amountToAdd, String code, String description) {
        db.collection(Constants.COLLECTION_USERS).document(uid)
                .update("walletBalance", FieldValue.increment(amountToAdd))
                .addOnSuccessListener(aVoid -> {
                    Map<String, Object> act = new HashMap<>();
                    act.put("description", "Wallet Gift: " + code);
                    act.put("amount", amountToAdd);
                    act.put("points", (int) amountToAdd);
                    act.put("type", "earned");
                    act.put("redeemedCode", code);
                    act.put("createdAt", FieldValue.serverTimestamp());

                    db.collection(Constants.COLLECTION_USERS).document(uid)
                            .collection("pointActivities")
                            .add(act);

                    resetRedeemButton();
                    if (etRedeemCode != null) etRedeemCode.setText("");

                    showRedeemSuccess((int) amountToAdd, code, "₹" + (int) amountToAdd + " Wallet Cash");
                })
                .addOnFailureListener(e -> {
                    resetRedeemButton();
                    showRedeemFailure("Failed to credit wallet. Please try again.");
                });
    }

    private void resetRedeemButton() {
        if (btnSubmitRedeem != null) {
            btnSubmitRedeem.setEnabled(true);
            btnSubmitRedeem.setText("Redeem");
        }
    }

    private void showRedeemSuccess(int points, String code, String benefitText) {
        ModernDialogHelper.showInfoDialog(
                this,
                "Voucher Redeemed! 🎉",
                String.format(Locale.getDefault(),
                        "Awesome! Voucher code \"%s\" was applied successfully.\n\n%s has been credited directly to your Hunger account!",
                        code, benefitText)
        );
    }

    private void showRedeemFailure(String message) {
        Toast.makeText(this, "⚠️ " + message, Toast.LENGTH_LONG).show();
    }

    private void listenToProfile() {
        String uid = auth.getCurrentUser() != null ? auth.getCurrentUser().getUid() : null;
        if (uid == null) return;

        profileListener = db.collection(Constants.COLLECTION_USERS).document(uid)
                .addSnapshotListener((doc, error) -> {
                    if (error != null) { recordException("RewardsActivity_profile", error); return; }
                    if (doc == null || !doc.exists()) return;

                    Long points = doc.getLong("rewardPoints");
                    currentPointsBalance = points != null ? points.intValue() : 0;

                    animatePointsCount(currentPointsBalance);
                    updateTierUI(currentPointsBalance);
                });
    }

    /** Count-up animation for points display */
    private void animatePointsCount(int target) {
        ValueAnimator animator = ValueAnimator.ofInt(0, target);
        animator.setDuration(1000);
        animator.setInterpolator(new AccelerateDecelerateInterpolator());
        animator.addUpdateListener(anim -> {
            if (tvPoints != null)
                tvPoints.setText(String.valueOf(anim.getAnimatedValue()));
        });
        animator.start();

        if (tvPoints != null) {
            ObjectAnimator bounce = ObjectAnimator.ofFloat(tvPoints, "scaleX", 0.85f, 1.1f, 1f);
            bounce.setDuration(700);
            bounce.setInterpolator(new OvershootInterpolator());
            bounce.start();
            ObjectAnimator bounceY = ObjectAnimator.ofFloat(tvPoints, "scaleY", 0.85f, 1.1f, 1f);
            bounceY.setDuration(700);
            bounceY.setInterpolator(new OvershootInterpolator());
            bounceY.start();
        }
    }

    private void updateTierUI(int totalPoints) {
        int tierIndex = 0;
        for (int i = TIERS.length - 1; i >= 0; i--) {
            if (totalPoints >= TIERS[i][0]) { tierIndex = i; break; }
        }

        if (tvTierName != null) tvTierName.setText(TIER_NAMES[tierIndex] + " Member");
        if (tvTierEmoji != null) tvTierEmoji.setText(TIER_EMOJIS[tierIndex]);

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

            if (progressTier != null) {
                ObjectAnimator anim = ObjectAnimator.ofInt(progressTier, "progress", 0, clampedProgress);
                anim.setDuration(800);
                anim.setInterpolator(new AccelerateDecelerateInterpolator());
                anim.start();
            }
            if (tvNextTierInfo != null) {
                tvNextTierInfo.setText((nextMin - totalPoints) + " pts to " + TIER_NAMES[tierIndex + 1]);
            }
        } else {
            if (progressTier != null) {
                ObjectAnimator.ofInt(progressTier, "progress", 0, 100).setDuration(500).start();
            }
            if (tvNextTierInfo != null) {
                tvNextTierInfo.setText("🏆 Platinum Top Tier!");
            }
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
                    if (activityContainer == null) return;
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

        if (tvDesc != null) tvDesc.setText(description != null ? description : "Points Activity");
        if (tvDate != null && ts != null) {
            SimpleDateFormat sdf = new SimpleDateFormat("dd MMM yyyy", Locale.getDefault());
            tvDate.setText(sdf.format(ts.toDate()));
        }

        if (tvPoints != null && points != null) {
            boolean isNegative = "redeemed".equals(type) || "expired".equals(type);
            tvPoints.setText((isNegative ? "-" : "+") + points + " pts");
            tvPoints.setTextColor(getResources().getColor(isNegative ? R.color.error : R.color.success, getTheme()));
        }

        row.setAlpha(0f);
        row.setTranslationX(-40f);
        int delay = activityContainer.getChildCount() * 50;
        row.animate().alpha(1f).translationX(0f).setDuration(250).setStartDelay(delay)
                .setInterpolator(new AccelerateDecelerateInterpolator()).start();

        activityContainer.addView(row);
    }

    private void addEmptyActivityState() {
        TextView tv = new TextView(this);
        tv.setText("✨ No points activity yet. Place orders or enter a redeem code to earn reward points!");
        tv.setTextAlignment(View.TEXT_ALIGNMENT_CENTER);
        tv.setTextColor(getResources().getColor(R.color.text_secondary, getTheme()));
        tv.setTextSize(12);
        tv.setPadding(0, 36, 0, 36);
        activityContainer.addView(tv);
    }

    private void populateRewardsCatalog() {
        if (rewardsContainer == null) return;
        rewardsContainer.removeAllViews();

        String[][] rewards = {
                {"₹50 Off Next Order", "150 pts", "🎫"},
                {"100% Free Delivery", "200 pts", "🛵"},
                {"₹100 Off on ₹499+", "300 pts", "💰"},
                {"Free Chef Dessert", "450 pts", "🍰"},
                {"20% Off Weekend Feast", "600 pts", "🎉"},
                {"1 Mo Hunger Plus VIP", "900 pts", "👑"},
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

            card.setOnClickListener(v -> {
                int requiredPts = Integer.parseInt(r[1].replaceAll("[^0-9]", ""));
                if (currentPointsBalance >= requiredPts) {
                    ModernDialogHelper.showWarningDialog(
                            this,
                            "Claim " + r[0],
                            "Would you like to redeem " + requiredPts + " points for this voucher?",
                            "Redeem",
                            () -> {
                                String uid = auth.getCurrentUser() != null ? auth.getCurrentUser().getUid() : null;
                                if (uid != null) {
                                    db.collection(Constants.COLLECTION_USERS).document(uid)
                                            .update("rewardPoints", FieldValue.increment(-requiredPts));
                                    Map<String, Object> act = new HashMap<>();
                                    act.put("description", "Claimed: " + r[0]);
                                    act.put("points", requiredPts);
                                    act.put("type", "redeemed");
                                    act.put("createdAt", FieldValue.serverTimestamp());
                                    db.collection(Constants.COLLECTION_USERS).document(uid)
                                            .collection("pointActivities").add(act);
                                    Toast.makeText(this, "🎉 Voucher claimed! Applied to your next order.", Toast.LENGTH_SHORT).show();
                                }
                            }
                    );
                } else {
                    Toast.makeText(this, "Need " + (requiredPts - currentPointsBalance) + " more points to claim this perk!", Toast.LENGTH_SHORT).show();
                }
            });

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
