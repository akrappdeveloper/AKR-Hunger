package com.ssr.hunger.activities;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.TextView;
import android.widget.Toast;
import com.ssr.hunger.R;
import com.ssr.hunger.utils.Constants;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;

/**
 * ReferralActivity - mirrors the web app's /customer/rewards referral section.
 * Shows unique referral code, referral stats, and share options.
 * Extends BaseActivity for Analytics, Crashlytics, and Performance monitoring.
 */
public class ReferralActivity extends BaseActivity {

    private FirebaseFirestore db;
    private FirebaseAuth auth;
    private ListenerRegistration profileListener;

    private TextView tvReferralCode, tvReferralCount, tvReferralEarned;
    private View btnCopyCode, btnShare;
    private String referralCode = "";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_referral);

        db = FirebaseFirestore.getInstance();
        auth = FirebaseAuth.getInstance();

        tvReferralCode = findViewById(R.id.tv_referral_code);
        tvReferralCount = findViewById(R.id.tv_referral_count);
        tvReferralEarned = findViewById(R.id.tv_referral_earned);
        btnCopyCode = findViewById(R.id.btn_copy_code);
        btnShare = findViewById(R.id.btn_share);

        if (findViewById(R.id.btn_back) != null)
            findViewById(R.id.btn_back).setOnClickListener(v -> finish());

        if (btnCopyCode != null) btnCopyCode.setOnClickListener(v -> copyCode());
        if (btnShare != null) btnShare.setOnClickListener(v -> shareCode());

        loadReferralData();
        logBreadcrumb("ReferralActivity: Opened");
    }

    private void loadReferralData() {
        String uid = auth.getCurrentUser() != null ? auth.getCurrentUser().getUid() : null;
        if (uid == null) return;

        profileListener = db.collection(Constants.COLLECTION_USERS).document(uid)
                .addSnapshotListener((doc, error) -> {
                    if (error != null) { recordException("ReferralActivity_listen", error); return; }
                    if (doc == null || !doc.exists()) return;

                    // Get or generate referral code
                    String code = doc.getString("referralCode");
                    if (code == null || code.isEmpty()) {
                        // Generate a code based on UID
                        code = "HUNGER" + uid.substring(0, Math.min(5, uid.length())).toUpperCase();
                        db.collection(Constants.COLLECTION_USERS).document(uid).update("referralCode", code);
                    }
                    referralCode = code;

                    Long referralCount = doc.getLong("referralCount");
                    Long referralEarned = doc.getLong("referralPointsEarned");

                    if (tvReferralCode != null) tvReferralCode.setText(code);
                    if (tvReferralCount != null) tvReferralCount.setText(String.valueOf(referralCount != null ? referralCount : 0));
                    if (tvReferralEarned != null) tvReferralEarned.setText((referralEarned != null ? referralEarned : 0) + " pts");
                });
    }

    private void copyCode() {
        if (referralCode.isEmpty()) return;
        android.content.ClipboardManager clipboard = (android.content.ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
        android.content.ClipData clip = android.content.ClipData.newPlainText("Referral Code", referralCode);
        clipboard.setPrimaryClip(clip);
        if (btnCopyCode instanceof com.google.android.material.button.MaterialButton) {
            com.google.android.material.button.MaterialButton mb = (com.google.android.material.button.MaterialButton) btnCopyCode;
            mb.setText("COPIED! ✓");
            mb.postDelayed(() -> mb.setText("Copy Code"), 1800);
        }
        Toast.makeText(this, "✅ Referral code copied: " + referralCode, Toast.LENGTH_SHORT).show();
        android.os.Bundle bCopied = new android.os.Bundle(); bCopied.putString("referral_code", referralCode); analyticsHelper.logEvent("referral_code_copied", bCopied);
        logBreadcrumb("Referral code copied: " + referralCode);
    }

    private void shareCode() {
        if (referralCode.isEmpty()) return;
        String message = "🍔 Hey! Try AKR Hunger for amazing food delivery! Use my referral code *" + referralCode +
                "* and get ₹50 off your first order! Download now: https://akrhunger.vercel.app";

        Intent shareIntent = new Intent(Intent.ACTION_SEND);
        shareIntent.setType("text/plain");
        shareIntent.putExtra(Intent.EXTRA_TEXT, message);
        startActivity(Intent.createChooser(shareIntent, "Share via"));

        android.os.Bundle bShared = new android.os.Bundle(); bShared.putString("referral_code", referralCode); analyticsHelper.logEvent("referral_code_shared", bShared);
        logBreadcrumb("Referral code shared: " + referralCode);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (profileListener != null) profileListener.remove();
    }

    @Override
    protected String getScreenName() { return "Referral"; }
}
