package com.ssr.hunger.activities;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.TextView;
import android.widget.Toast;
import com.ssr.hunger.R;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;

/**
 * MembershipActivity - mirrors the web app's /customer/membership page.
 * Shows current membership status, plan features, and subscribe options.
 * Extends BaseActivity for Analytics, Crashlytics, and Performance monitoring.
 */
public class MembershipActivity extends BaseActivity implements com.razorpay.PaymentResultListener {

    private FirebaseFirestore db;
    private FirebaseAuth auth;
    private ListenerRegistration membershipListener;
    private TextView tvCurrentPlan, tvPlanStatus, tvExpiry;
    private double selectedPlanAmount = 99;
    private String selectedPlanId = "basic";
    private String selectedPlanName = "Hunger Plus";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_membership);

        db = FirebaseFirestore.getInstance();
        auth = FirebaseAuth.getInstance();

        tvCurrentPlan = findViewById(R.id.tv_current_plan);
        tvPlanStatus = findViewById(R.id.tv_plan_status);
        tvExpiry = findViewById(R.id.tv_expiry);

        // Back button
        if (findViewById(R.id.btn_back) != null)
            findViewById(R.id.btn_back).setOnClickListener(v -> finish());

        // Plan selection cards
        setupPlanCard(R.id.card_plus, "basic", "Hunger Plus", 99);
        setupPlanCard(R.id.card_premium, "premium", "Hunger Premium", 199);
        setupPlanCard(R.id.card_vip, "vip", "Hunger VIP", 499);

        // Pre-select most popular plan
        selectedPlanId = "premium";
        selectedPlanName = "Hunger Premium";
        selectedPlanAmount = 199;
        highlightSelectedPlan(R.id.card_premium);

        // Subscribe button
        if (findViewById(R.id.btn_subscribe) != null)
            findViewById(R.id.btn_subscribe).setOnClickListener(v -> initiatePayment());

        listenToMembership();
        logBreadcrumb("MembershipActivity: Opened");
    }

    private void setupPlanCard(int cardId, String planId, String planName, double amount) {
        View card = findViewById(cardId);
        if (card == null) return;
        card.setOnClickListener(v -> {
            selectedPlanId = planId;
            selectedPlanName = planName;
            selectedPlanAmount = amount;
            highlightSelectedPlan(cardId);
            logBreadcrumb("Plan selected: " + planName);
        });
    }

    private void highlightSelectedPlan(int selectedCardId) {
        int[] cardIds = {R.id.card_plus, R.id.card_premium, R.id.card_vip};
        int primaryColor = getResources().getColor(R.color.primary, getTheme());
        int borderColor = getResources().getColor(R.color.card_border, getTheme());

        for (int id : cardIds) {
            View card = findViewById(id);
            if (card instanceof com.google.android.material.card.MaterialCardView) {
                com.google.android.material.card.MaterialCardView mCard = (com.google.android.material.card.MaterialCardView) card;
                boolean isSelected = (id == selectedCardId);
                mCard.setStrokeColor(isSelected ? primaryColor : borderColor);
                mCard.setStrokeWidth((int) ((isSelected ? 2f : 1f) * getResources().getDisplayMetrics().density));
                mCard.setCardElevation((isSelected ? 4f : 1f) * getResources().getDisplayMetrics().density);
                mCard.setAlpha(isSelected ? 1.0f : 0.8f);
            }
        }

        com.google.android.material.button.MaterialButton btnSub = findViewById(R.id.btn_subscribe);
        if (btnSub != null) {
            btnSub.setText("✨ Subscribe to " + selectedPlanName + " — ₹" + (int) selectedPlanAmount + "/mo");
        }
    }

    private void listenToMembership() {
        String uid = auth.getCurrentUser() != null ? auth.getCurrentUser().getUid() : null;
        if (uid == null) return;

        membershipListener = db.collection(com.ssr.hunger.utils.Constants.COLLECTION_USERS).document(uid)
                .addSnapshotListener((doc, error) -> {
                    if (error != null) { recordException("MembershipActivity_listen", error); return; }
                    if (doc == null || !doc.exists()) return;

                    java.util.Map<String, Object> membership = (java.util.Map<String, Object>) doc.get("membership");
                    if (membership != null && "active".equals(membership.get("status"))) {
                        String planName = membership.get("planName") != null ? membership.get("planName").toString() : "Unknown";
                        if (tvCurrentPlan != null) tvCurrentPlan.setText("Current Plan: " + planName);
                        if (tvPlanStatus != null) tvPlanStatus.setText("✅ Active");

                        com.google.firebase.Timestamp expiry = doc.getTimestamp("membership.expiresAt");
                        if (expiry != null && tvExpiry != null) {
                            java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("dd MMM yyyy", java.util.Locale.getDefault());
                            tvExpiry.setText("Expires: " + sdf.format(expiry.toDate()));
                        }
                    } else {
                        if (tvCurrentPlan != null) tvCurrentPlan.setText("No Active Membership");
                        if (tvPlanStatus != null) tvPlanStatus.setText("❌ Not Subscribed");
                        if (tvExpiry != null) tvExpiry.setText("Subscribe to unlock exclusive perks!");
                    }
                });
    }

    private void initiatePayment() {
        String uid = auth.getCurrentUser() != null ? auth.getCurrentUser().getUid() : null;
        if (uid == null) {
            Toast.makeText(this, "Please log in first", Toast.LENGTH_SHORT).show();
            return;
        }
        logBreadcrumb("MembershipActivity: Payment initiated for " + selectedPlanName);
        analyticsHelper.logEvent("membership_subscribe_attempt",
                createBundle("plan_id", selectedPlanId, "amount", selectedPlanAmount));

        try {
            com.razorpay.Checkout checkout = new com.razorpay.Checkout();
            checkout.setKeyID("rzp_live_RbvSxxE0Qca3fp");
            checkout.setImage(R.mipmap.ic_launcher);

            org.json.JSONObject options = new org.json.JSONObject();
            options.put("name", "AKR Hunger");
            options.put("description", selectedPlanName + " — Monthly Subscription");
            options.put("currency", "INR");
            options.put("amount", (int) (selectedPlanAmount * 100));
            options.put("theme.color", "#F97316");

            checkout.open(this, options);
        } catch (Exception e) {
            recordException("MembershipActivity_payment_error", e);
            Toast.makeText(this, "Payment initialization failed", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    public void onPaymentSuccess(String razorpayPaymentId) {
        logBreadcrumb("Membership payment success: " + razorpayPaymentId + " plan: " + selectedPlanId);
        analyticsHelper.logEvent("membership_subscribed",
                createBundle("plan_id", selectedPlanId, "payment_id", razorpayPaymentId));

        // Update Firestore
        String uid = auth.getCurrentUser() != null ? auth.getCurrentUser().getUid() : null;
        if (uid == null) return;

        java.util.Map<String, Object> membership = new java.util.HashMap<>();
        membership.put("planId", selectedPlanId);
        membership.put("planName", selectedPlanName);
        membership.put("status", "active");
        membership.put("paymentId", razorpayPaymentId);
        membership.put("startedAt", com.google.firebase.Timestamp.now());

        // Expiry = 30 days from now
        java.util.Calendar cal = java.util.Calendar.getInstance();
        cal.add(java.util.Calendar.DAY_OF_MONTH, 30);
        membership.put("expiresAt", new com.google.firebase.Timestamp(cal.getTime()));

        db.collection(com.ssr.hunger.utils.Constants.COLLECTION_USERS).document(uid)
                .update("membership", membership)
                .addOnSuccessListener(a -> Toast.makeText(this,
                        "🎉 Welcome to " + selectedPlanName + "! Enjoy your perks!", Toast.LENGTH_LONG).show())
                .addOnFailureListener(e -> recordException("MembershipActivity_save_fail", e));
    }

    @Override
    public void onPaymentError(int code, String response) {
        recordException("MembershipActivity_payment_failed",
                new Exception("Payment failed code=" + code + " resp=" + response));
        Toast.makeText(this, "Payment failed. Please try again.", Toast.LENGTH_SHORT).show();
    }


    private android.os.Bundle createBundle(String k1, String v1, String k2, double v2) {
        android.os.Bundle b = new android.os.Bundle();
        b.putString(k1, v1);
        b.putDouble(k2, v2);
        return b;
    }
    private android.os.Bundle createBundle(String k1, String v1, String k2, String v2) {
        android.os.Bundle b = new android.os.Bundle();
        b.putString(k1, v1);
        b.putString(k2, v2);
        return b;
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (membershipListener != null) membershipListener.remove();
    }

    @Override
    protected String getScreenName() { return "Membership"; }
}
