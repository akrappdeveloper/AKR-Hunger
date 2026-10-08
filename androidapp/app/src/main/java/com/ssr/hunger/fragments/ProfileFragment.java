package com.ssr.hunger.fragments;

import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import com.ssr.hunger.R;
import com.ssr.hunger.activities.AddressesActivity;
import com.ssr.hunger.activities.DealsActivity;
import com.ssr.hunger.activities.EditProfileActivity;
import com.ssr.hunger.activities.LoginActivity;
import com.ssr.hunger.activities.MembershipActivity;
import com.ssr.hunger.activities.NotificationsActivity;
import com.ssr.hunger.activities.ReferralActivity;
import com.ssr.hunger.activities.RewardsActivity;
import com.ssr.hunger.activities.SettingsActivity;
import com.ssr.hunger.activities.SupportActivity;
import com.ssr.hunger.activities.WalletActivity;
import com.ssr.hunger.activities.StudentModeActivity;
import com.ssr.hunger.activities.SubscriptionActivity;
import com.ssr.hunger.activities.GroupOrderActivity;
import com.ssr.hunger.activities.DeliveryPartnerDashboardActivity;
import com.ssr.hunger.utils.Constants;
import com.bumptech.glide.Glide;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.FirebaseFirestore;
import de.hdodenhof.circleimageview.CircleImageView;
import java.util.Locale;

/**
 * Profile Fragment - displays user info and navigation to all sub-pages.
 * Mirrors the web app's profile page: edit profile, wallet, notifications,
 * addresses, rewards, membership, deals, referral, support, logout.
 */
public class ProfileFragment extends Fragment {

    private CircleImageView ivAvatar;
    private TextView tvName, tvEmail, tvPhone, tvWalletBalance, tvRewardPoints;
    private FirebaseFirestore db;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        View view = inflater.inflate(R.layout.fragment_profile, container, false);

        ivAvatar = view.findViewById(R.id.iv_avatar);
        tvName = view.findViewById(R.id.tv_user_name);
        tvEmail = view.findViewById(R.id.tv_user_email);
        tvPhone = view.findViewById(R.id.tv_user_phone);
        tvWalletBalance = view.findViewById(R.id.tv_wallet_balance);
        tvRewardPoints = view.findViewById(R.id.tv_reward_points);

        db = FirebaseFirestore.getInstance();

        loadProfile();
        setupClickListeners(view);

        return view;
    }

    private void loadProfile() {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) return;

        if (tvEmail != null) tvEmail.setText(user.getEmail());

        db.collection(Constants.COLLECTION_CUSTOMERS).document(user.getUid())
                .addSnapshotListener((doc, error) -> {
                    if (error != null || doc == null || !doc.exists()) return;
                    if (!isAdded()) return;

                    String name = doc.getString("name");
                    String phone = doc.getString("phone");
                    String avatar = doc.getString("avatar");
                    Double balance = doc.getDouble("walletBalance");
                    Long points = doc.getLong("rewardPoints");

                    if (name != null && tvName != null) tvName.setText(name);
                    if (phone != null && !phone.isEmpty() && tvPhone != null) tvPhone.setText(phone);
                    if (balance != null && tvWalletBalance != null)
                        tvWalletBalance.setText(String.format(Locale.getDefault(), "₹%.2f", balance));
                    if (tvRewardPoints != null && points != null) tvRewardPoints.setText(points + " pts");

                    if (avatar != null && !avatar.isEmpty() && isAdded() && ivAvatar != null) {
                        Glide.with(requireContext())
                                .load(avatar)
                                .placeholder(R.drawable.ic_profile)
                                .into(ivAvatar);
                    }
                });
    }

    private void nav(Class<?> activityClass) {
        startActivity(new Intent(getContext(), activityClass));
    }

    private void setupClickListeners(View view) {
        // --- Existing ---
        safeClick(view, R.id.card_edit_profile, () -> nav(EditProfileActivity.class));
        safeClick(view, R.id.card_wallet, () -> nav(WalletActivity.class));
        safeClick(view, R.id.card_notifications, () -> nav(NotificationsActivity.class));
        safeClick(view, R.id.card_support, () -> nav(SupportActivity.class));
        safeClick(view, R.id.card_settings, () -> nav(SettingsActivity.class));

        // --- New Customer Activities ---
        safeClick(view, R.id.card_addresses, () -> nav(AddressesActivity.class));
        safeClick(view, R.id.card_rewards, () -> nav(RewardsActivity.class));
        safeClick(view, R.id.card_membership, () -> nav(MembershipActivity.class));
        safeClick(view, R.id.card_referral, () -> nav(ReferralActivity.class));

        // --- Next-Gen Hunger Features ---
        safeClick(view, R.id.card_student_mode, () -> nav(StudentModeActivity.class));
        safeClick(view, R.id.card_subscriptions, () -> nav(SubscriptionActivity.class));
        safeClick(view, R.id.card_group_order, () -> nav(GroupOrderActivity.class));
        safeClick(view, R.id.card_delivery_dashboard, () -> nav(DeliveryPartnerDashboardActivity.class));

        safeClick(view, R.id.btn_logout, () ->
                new com.google.android.material.dialog.MaterialAlertDialogBuilder(requireContext())
                        .setTitle("Logout")
                        .setMessage(R.string.logout_confirm)
                        .setPositiveButton(R.string.yes, (d, w) -> {
                            FirebaseAuth.getInstance().signOut();
                            nav(LoginActivity.class);
                            requireActivity().finish();
                        })
                        .setNegativeButton(R.string.no, null)
                        .show()
        );
    }

    /** Helper: sets click listener only if view with id exists */
    private void safeClick(View root, int viewId, Runnable action) {
        View v = root.findViewById(viewId);
        if (v != null) v.setOnClickListener(x -> action.run());
    }

    @Override
    public void onResume() {
        super.onResume();
        loadProfile();
    }
}
