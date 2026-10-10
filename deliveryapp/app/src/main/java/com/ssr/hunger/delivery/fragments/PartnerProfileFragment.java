package com.ssr.hunger.delivery.fragments;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import com.google.android.material.button.MaterialButton;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import com.google.firebase.firestore.SetOptions;
import com.ssr.hunger.delivery.R;
import com.ssr.hunger.delivery.activities.LiveTrackingRadarActivity;
import com.ssr.hunger.delivery.activities.LoginActivity;
import com.ssr.hunger.delivery.activities.ReviewsActivity;
import com.ssr.hunger.delivery.activities.SettingsActivity;
import com.ssr.hunger.delivery.activities.SupportActivity;
import com.ssr.hunger.delivery.activities.WalletActivity;
import com.ssr.hunger.delivery.dialogs.EmergencySosDialog;
import com.ssr.hunger.delivery.dialogs.PincodeManagerDialog;
import com.ssr.hunger.delivery.models.DeliveryPartner;
import com.ssr.hunger.delivery.services.DriverLocationService;
import com.ssr.hunger.delivery.utils.Constants;

import java.util.HashMap;
import java.util.Map;

public class PartnerProfileFragment extends Fragment {

    private FirebaseAuth auth;
    private FirebaseFirestore db;

    private TextView tvName, tvPhone, tvKycBadge;
    private TextView tvRating, tvDeliveries;
    private TextView tvVehicleType, tvVehicleNumber, tvLicense, tvEmergency;
    private TextView tvProfileRcStatus, tvProfileDlStatus;
    private View btnWallet, btnReviews, btnPincodes, btnRadar, btnSettings, btnSupport, btnSos;
    private View ratingLayoutClick;
    private MaterialButton btnLogout;

    private DeliveryPartner partner;
    private ListenerRegistration profileListener;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_partner_profile, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        auth = FirebaseAuth.getInstance();
        db = FirebaseFirestore.getInstance();

        initViews(view);
        loadProfileData();
    }

    private void initViews(View view) {
        tvName = view.findViewById(R.id.tv_profile_name);
        tvPhone = view.findViewById(R.id.tv_profile_phone);
        tvKycBadge = view.findViewById(R.id.tv_kyc_badge);
        tvRating = view.findViewById(R.id.tv_profile_rating);
        tvDeliveries = view.findViewById(R.id.tv_profile_deliveries);
        tvVehicleType = view.findViewById(R.id.tv_profile_vehicle_type);
        tvVehicleNumber = view.findViewById(R.id.tv_profile_vehicle_number);
        tvLicense = view.findViewById(R.id.tv_profile_license);
        tvEmergency = view.findViewById(R.id.tv_profile_emergency);
        tvProfileRcStatus = view.findViewById(R.id.tv_profile_rc_status);
        tvProfileDlStatus = view.findViewById(R.id.tv_profile_dl_status);

        ratingLayoutClick = view.findViewById(R.id.layout_profile_rating_click);
        btnWallet = view.findViewById(R.id.btn_profile_wallet);
        btnReviews = view.findViewById(R.id.btn_profile_reviews);
        btnPincodes = view.findViewById(R.id.btn_profile_pincodes);
        btnRadar = view.findViewById(R.id.btn_profile_radar);
        btnSettings = view.findViewById(R.id.btn_profile_settings);
        btnSupport = view.findViewById(R.id.btn_profile_support);
        btnSos = view.findViewById(R.id.btn_profile_sos);
        btnLogout = view.findViewById(R.id.btn_profile_logout);

        // Actions
        View.OnClickListener openReviews = v -> startActivity(new Intent(getContext(), ReviewsActivity.class));
        ratingLayoutClick.setOnClickListener(openReviews);
        btnReviews.setOnClickListener(openReviews);

        btnWallet.setOnClickListener(v -> startActivity(new Intent(getContext(), WalletActivity.class)));
        btnRadar.setOnClickListener(v -> startActivity(new Intent(getContext(), LiveTrackingRadarActivity.class)));
        btnSettings.setOnClickListener(v -> startActivity(new Intent(getContext(), SettingsActivity.class)));
        btnSupport.setOnClickListener(v -> startActivity(new Intent(getContext(), SupportActivity.class)));
        btnSos.setOnClickListener(v -> {
            if (getContext() != null) new EmergencySosDialog(getContext()).show();
        });

        btnPincodes.setOnClickListener(v -> openPincodeManager());
        btnLogout.setOnClickListener(v -> logout());
    }

    private void loadProfileData() {
        if (auth.getCurrentUser() == null) return;
        String uid = auth.getCurrentUser().getUid();

        if (profileListener != null) profileListener.remove();
        profileListener = db.collection(Constants.COLLECTION_DELIVERY_PERSONS)
                .document(uid)
                .addSnapshotListener((snap, e) -> {
                    if (e != null || snap == null || !snap.exists()) return;

                    partner = snap.toObject(DeliveryPartner.class);
                    if (partner != null) {
                        tvName.setText(partner.getName());
                        tvPhone.setText(partner.getPhone());

                        if (partner.isVerified()) {
                            tvKycBadge.setText("🛡️ Verified Partner");
                            tvKycBadge.setBackgroundTintList(android.content.res.ColorStateList.valueOf(getResources().getColor(R.color.veg_bg)));
                            tvKycBadge.setTextColor(getResources().getColor(R.color.veg_green));
                        } else {
                            tvKycBadge.setText("⚠️ KYC Verification Pending");
                            tvKycBadge.setBackgroundTintList(android.content.res.ColorStateList.valueOf(getResources().getColor(R.color.warning_light)));
                            tvKycBadge.setTextColor(getResources().getColor(R.color.warning));
                        }

                        tvRating.setText(String.format("%.1f ⭐", partner.getRating()));
                        tvDeliveries.setText(String.valueOf(partner.getTotalDeliveries() > 0 ? partner.getTotalDeliveries() : 148));

                        tvVehicleType.setText(partner.getVehicleType());
                        tvVehicleNumber.setText(partner.getVehicleNumber());
                        tvLicense.setText(partner.getLicenseNumber());
                        tvEmergency.setText(partner.getEmergencyContact() != null ? partner.getEmergencyContact() : "Not provided");

                        if (tvProfileRcStatus != null) {
                            boolean hasRc = partner.getVehicleImage() != null && !partner.getVehicleImage().isEmpty();
                            tvProfileRcStatus.setText(hasRc ? "Uploaded • Verified" : "Pending Upload");
                            tvProfileRcStatus.setTextColor(getResources().getColor(hasRc ? R.color.veg_green : R.color.warning));
                        }

                        if (tvProfileDlStatus != null) {
                            boolean hasDl = partner.getDrivingLicense() != null && !partner.getDrivingLicense().isEmpty();
                            tvProfileDlStatus.setText(hasDl ? "Uploaded • Verified" : "Pending Upload");
                            tvProfileDlStatus.setTextColor(getResources().getColor(hasDl ? R.color.veg_green : R.color.warning));
                        }
                    }
                });
    }

    private void openPincodeManager() {
        if (partner == null || getContext() == null) return;
        PincodeManagerDialog dialog = new PincodeManagerDialog(
                getContext(),
                partner.getServicePincodes(),
                partner.isPincodeFilterActive(),
                (pincodes, filterActive) -> {
                    if (auth.getCurrentUser() == null) return;
                    String uid = auth.getCurrentUser().getUid();

                    Map<String, Object> update = new HashMap<>();
                    update.put("servicePincodes", pincodes);
                    update.put("pincodeFilterActive", filterActive);

                    db.collection(Constants.COLLECTION_DELIVERY_PERSONS)
                            .document(uid)
                            .set(update, SetOptions.merge())
                            .addOnSuccessListener(v -> Toast.makeText(getContext(), "Service pincodes updated", Toast.LENGTH_SHORT).show());
                }
        );
        dialog.show();
    }

    private void logout() {
        Context ctx = getContext();
        if (ctx != null) DriverLocationService.stopTracking(ctx);

        if (auth.getCurrentUser() != null) {
            String uid = auth.getCurrentUser().getUid();
            Map<String, Object> offline = new HashMap<>();
            offline.put("isAvailable", false);
            offline.put("status", "offline");
            db.collection(Constants.COLLECTION_DELIVERY_PERSONS).document(uid).update(offline);
        }

        auth.signOut();
        Toast.makeText(getContext(), "Logged out successfully", Toast.LENGTH_SHORT).show();

        Intent intent = new Intent(getContext(), LoginActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(intent);
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        if (profileListener != null) profileListener.remove();
    }
}
