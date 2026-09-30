package com.ssr.hunger.fragments;

import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AlertDialog;
import androidx.fragment.app.Fragment;
import com.ssr.hunger.R;
import com.ssr.hunger.activities.EditProfileActivity;
import com.ssr.hunger.activities.LoginActivity;
import com.ssr.hunger.activities.NotificationsActivity;
import com.ssr.hunger.activities.SettingsActivity;
import com.ssr.hunger.activities.SupportActivity;
import com.ssr.hunger.activities.WalletActivity;
import com.ssr.hunger.utils.Constants;
import com.bumptech.glide.Glide;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.FirebaseFirestore;
import de.hdodenhof.circleimageview.CircleImageView;
import java.util.Locale;

/**
 * Profile Fragment - displays user info and navigation to sub-pages.
 * Mirrors the web app's profile page: edit profile, wallet, notifications, support, logout.
 */
public class ProfileFragment extends Fragment {

    private CircleImageView ivAvatar;
    private TextView tvName, tvEmail, tvPhone, tvWalletBalance;
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

        db = FirebaseFirestore.getInstance();

        loadProfile();
        setupClickListeners(view);

        return view;
    }

    private void loadProfile() {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) return;

        tvEmail.setText(user.getEmail());

        db.collection(Constants.COLLECTION_CUSTOMERS).document(user.getUid())
                .addSnapshotListener((doc, error) -> {
                    if (error != null || doc == null || !doc.exists()) return;
                    if (!isAdded()) return;

                    String name = doc.getString("name");
                    String phone = doc.getString("phone");
                    String avatar = doc.getString("avatar");
                    Double balance = doc.getDouble("walletBalance");

                    if (name != null) tvName.setText(name);
                    if (phone != null && !phone.isEmpty()) tvPhone.setText(phone);
                    if (balance != null) tvWalletBalance.setText(String.format(Locale.getDefault(), "₹%.2f", balance));

                    if (avatar != null && !avatar.isEmpty() && isAdded()) {
                        Glide.with(requireContext())
                                .load(avatar)
                                .placeholder(R.drawable.ic_profile)
                                .into(ivAvatar);
                    }
                });
    }

    private void setupClickListeners(View view) {
        view.findViewById(R.id.card_edit_profile).setOnClickListener(v ->
                startActivity(new Intent(getContext(), EditProfileActivity.class)));

        view.findViewById(R.id.card_wallet).setOnClickListener(v ->
                startActivity(new Intent(getContext(), WalletActivity.class)));

        View cardNotifications = view.findViewById(R.id.card_notifications);
        if (cardNotifications != null) {
            cardNotifications.setOnClickListener(v ->
                    startActivity(new Intent(getContext(), NotificationsActivity.class)));
        }

        view.findViewById(R.id.card_support).setOnClickListener(v ->
                startActivity(new Intent(getContext(), SupportActivity.class)));

        View cardSettings = view.findViewById(R.id.card_settings);
        if (cardSettings != null) {
            cardSettings.setOnClickListener(v ->
                    startActivity(new Intent(getContext(), SettingsActivity.class)));
        }

        view.findViewById(R.id.btn_logout).setOnClickListener(v -> {
            new com.google.android.material.dialog.MaterialAlertDialogBuilder(requireContext())
                    .setTitle("Logout")
                    .setMessage(R.string.logout_confirm)
                    .setPositiveButton(R.string.yes, (dialog, which) -> {
                        FirebaseAuth.getInstance().signOut();
                        startActivity(new Intent(getContext(), LoginActivity.class));
                        requireActivity().finish();
                    })
                    .setNegativeButton(R.string.no, null)
                    .show();
        });
    }

    @Override
    public void onResume() {
        super.onResume();
        loadProfile();
    }
}
