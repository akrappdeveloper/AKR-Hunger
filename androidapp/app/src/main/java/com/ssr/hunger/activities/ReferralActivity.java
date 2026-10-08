package com.ssr.hunger.activities;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.TextView;
import android.widget.Toast;

import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.button.MaterialButton;
import com.google.firebase.Timestamp;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import com.google.firebase.firestore.Query;
import com.ssr.hunger.R;
import com.ssr.hunger.adapters.ReferredFriendsAdapter;
import com.ssr.hunger.models.ReferralItem;
import com.ssr.hunger.utils.Constants;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * ReferralActivity - Full-featured Referral & Earn system with
 * automatic unique code creation, platform share links (https://shunger.vercel.app/customer/referral/CODE),
 * and live real-time referral tracking showing accounts created using the user's link and rewards credited.
 */
public class ReferralActivity extends BaseActivity {

    private static final String PLATFORM_REFERRAL_BASE_URL = "https://shungher.vercel.app/customer/referral/";

    private FirebaseFirestore db;
    private FirebaseAuth auth;
    private ListenerRegistration profileListener;
    private ListenerRegistration referralsListener;

    private TextView tvReferralCode, tvReferralLink, tvReferralCount, tvReferralEarned, tvTrackingCountBadge;
    private View btnCopyCode, btnShare, btnCopyLink, layoutLinkBox;
    private RecyclerView rvReferredFriends;
    private View layoutEmptyReferrals;

    private ReferredFriendsAdapter friendsAdapter;
    private final List<ReferralItem> referredFriendsList = new ArrayList<>();
    private String referralCode = "";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_referral);

        db = FirebaseFirestore.getInstance();
        auth = FirebaseAuth.getInstance();

        initViews();
        setupRecyclerView();
        setupClickListeners();
        loadReferralData();
        listenToReferredFriends();

        logBreadcrumb("ReferralActivity: Opened");
    }

    private void initViews() {
        tvReferralCode = findViewById(R.id.tv_referral_code);
        tvReferralLink = findViewById(R.id.tv_referral_link);
        tvReferralCount = findViewById(R.id.tv_referral_count);
        tvReferralEarned = findViewById(R.id.tv_referral_earned);
        tvTrackingCountBadge = findViewById(R.id.tv_tracking_count_badge);
        btnCopyCode = findViewById(R.id.btn_copy_code);
        btnShare = findViewById(R.id.btn_share);
        btnCopyLink = findViewById(R.id.btn_copy_link);
        layoutLinkBox = findViewById(R.id.layout_link_box);
        rvReferredFriends = findViewById(R.id.rv_referred_friends);
        layoutEmptyReferrals = findViewById(R.id.layout_empty_referrals);

        if (findViewById(R.id.btn_back) != null) {
            findViewById(R.id.btn_back).setOnClickListener(v -> finish());
        }
    }

    private void setupRecyclerView() {
        friendsAdapter = new ReferredFriendsAdapter(referredFriendsList);
        rvReferredFriends.setLayoutManager(new LinearLayoutManager(this));
        rvReferredFriends.setAdapter(friendsAdapter);
    }

    private void setupClickListeners() {
        if (btnCopyCode != null) btnCopyCode.setOnClickListener(v -> copyReferralLinkOrCode(true));
        if (btnCopyLink != null) btnCopyLink.setOnClickListener(v -> copyReferralLinkOrCode(false));
        if (layoutLinkBox != null) layoutLinkBox.setOnClickListener(v -> copyReferralLinkOrCode(false));
        if (btnShare != null) btnShare.setOnClickListener(v -> shareReferralInvite());
    }

    /**
     * Loads the customer's referral code or automatically generates a unique code if missing.
     */
    private void loadReferralData() {
        String uid = auth.getCurrentUser() != null ? auth.getCurrentUser().getUid() : null;
        if (uid == null) return;

        profileListener = db.collection(Constants.COLLECTION_USERS).document(uid)
                .addSnapshotListener((doc, error) -> {
                    if (error != null) {
                        recordException("ReferralActivity_profile_listen", error);
                        return;
                    }
                    if (doc == null || !doc.exists()) return;

                    String code = doc.getString("referralCode");
                    if (code == null || code.trim().isEmpty()) {
                        code = generateUniqueReferralCode(uid);
                        saveReferralCodeToFirestore(uid, code);
                    }
                    referralCode = code;

                    String link = PLATFORM_REFERRAL_BASE_URL + referralCode;
                    if (tvReferralCode != null) tvReferralCode.setText(referralCode);
                    if (tvReferralLink != null) tvReferralLink.setText(link);

                    Double earnings = doc.getDouble("referralEarnings");
                    if (earnings == null) {
                        Long pts = doc.getLong("referralPointsEarned");
                        earnings = pts != null ? pts.doubleValue() : 0.0;
                    }
                    if (tvReferralEarned != null) {
                        tvReferralEarned.setText("₹" + String.format(java.util.Locale.getDefault(), "%.0f", earnings));
                    }
                });
    }

    /**
     * Real-time live tracking of all users who created an account with this user's referral code.
     */
    private void listenToReferredFriends() {
        String uid = auth.getCurrentUser() != null ? auth.getCurrentUser().getUid() : null;
        if (uid == null) return;

        referralsListener = db.collection("referrals")
                .whereEqualTo("referrerId", uid)
                .orderBy("createdAt", Query.Direction.DESCENDING)
                .addSnapshotListener((snap, error) -> {
                    if (error != null) {
                        recordException("ReferralActivity_referrals_listen", error);
                        return;
                    }

                    referredFriendsList.clear();
                    double totalEarned = 0.0;

                    if (snap != null && !snap.isEmpty()) {
                        for (com.google.firebase.firestore.DocumentSnapshot doc : snap.getDocuments()) {
                            ReferralItem item = ReferralItem.fromSnapshot(doc);
                            if (item != null) {
                                referredFriendsList.add(item);
                                totalEarned += item.getRewardAmount();
                            }
                        }
                    }

                    friendsAdapter.updateData(new ArrayList<>(referredFriendsList));

                    int count = referredFriendsList.size();
                    if (tvReferralCount != null) {
                        tvReferralCount.setText(String.valueOf(count));
                    }
                    if (tvTrackingCountBadge != null) {
                        tvTrackingCountBadge.setText(count + (count == 1 ? " Friend Joined" : " Friends Joined"));
                    }
                    if (tvReferralEarned != null && totalEarned > 0) {
                        tvReferralEarned.setText("₹" + String.format(java.util.Locale.getDefault(), "%.0f", totalEarned));
                    }

                    if (count > 0) {
                        rvReferredFriends.setVisibility(View.VISIBLE);
                        layoutEmptyReferrals.setVisibility(View.GONE);
                    } else {
                        rvReferredFriends.setVisibility(View.GONE);
                        layoutEmptyReferrals.setVisibility(View.VISIBLE);
                    }
                });
    }

    /**
     * Generates a clean, professional referral code e.g. "HUNGER" + 5 chars (e.g. HUNGERUSBAR)
     */
    private String generateUniqueReferralCode(String uid) {
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        SecureRandom rnd = new SecureRandom();
        StringBuilder sb = new StringBuilder("HUNGER");
        for (int i = 0; i < 5; i++) {
            sb.append(chars.charAt(rnd.nextInt(chars.length())));
        }
        return sb.toString();
    }

    /**
     * Persists the newly created referral code in both the customer profile and global index
     */
    private void saveReferralCodeToFirestore(String uid, String code) {
        Map<String, Object> update = new HashMap<>();
        update.put("referralCode", code);
        db.collection(Constants.COLLECTION_USERS).document(uid).update(update);

        // Also record in global referralCodes collection for fast verification
        Map<String, Object> indexData = new HashMap<>();
        indexData.put("code", code);
        indexData.put("ownerId", uid);
        indexData.put("createdAt", Timestamp.now());
        if (auth.getCurrentUser() != null && auth.getCurrentUser().getDisplayName() != null) {
            indexData.put("ownerName", auth.getCurrentUser().getDisplayName());
        }
        db.collection("referralCodes").document(code).set(indexData);
    }

    private void copyReferralLinkOrCode(boolean isCodeOnly) {
        if (referralCode.isEmpty()) return;

        String textToCopy = isCodeOnly ? (PLATFORM_REFERRAL_BASE_URL + referralCode) : (PLATFORM_REFERRAL_BASE_URL + referralCode);
        ClipboardManager clipboard = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
        ClipData clip = ClipData.newPlainText("Hunger Referral Link", textToCopy);
        clipboard.setPrimaryClip(clip);

        if (btnCopyCode instanceof MaterialButton) {
            MaterialButton mb = (MaterialButton) btnCopyCode;
            mb.setText("LINK COPIED! ✓");
            mb.postDelayed(() -> mb.setText("Copy Link"), 1800);
        }
        Toast.makeText(this, "✅ Referral link copied! Share with friends", Toast.LENGTH_SHORT).show();

        Bundle bCopied = new Bundle();
        bCopied.putString("referral_code", referralCode);
        analyticsHelper.logEvent("referral_link_copied", bCopied);
        logBreadcrumb("Referral link copied: " + textToCopy);
    }

    private void shareReferralInvite() {
        if (referralCode.isEmpty()) return;

        String shareLink = PLATFORM_REFERRAL_BASE_URL + referralCode;
        String message = "🍔 Hey! Order delicious food from your favorite local restaurants on AKR Hunger!\n\n" +
                "🎁 Use my invite code *" + referralCode + "* or tap the link below to get ₹50 FREE in your wallet + ₹100 OFF on your first order:\n" +
                shareLink + "\n\n" +
                "⚡ Superfast 30-min doorstep delivery & live GPS tracking!";

        Intent shareIntent = new Intent(Intent.ACTION_SEND);
        shareIntent.setType("text/plain");
        shareIntent.putExtra(Intent.EXTRA_TEXT, message);
        startActivity(Intent.createChooser(shareIntent, "Share Referral Link via"));

        Bundle bShared = new Bundle();
        bShared.putString("referral_code", referralCode);
        analyticsHelper.logEvent("referral_invite_shared", bShared);
        logBreadcrumb("Referral invite shared: " + referralCode);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (profileListener != null) profileListener.remove();
        if (referralsListener != null) referralsListener.remove();
    }

    @Override
    protected String getScreenName() {
        return "Referral_Live_Tracking";
    }
}
