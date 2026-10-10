package com.ssr.hunger.delivery.fragments;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageButton;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.google.android.material.materialswitch.MaterialSwitch;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FieldValue;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import com.google.firebase.firestore.SetOptions;
import com.ssr.hunger.delivery.R;
import com.ssr.hunger.delivery.activities.LiveTrackingRadarActivity;
import com.ssr.hunger.delivery.activities.NotificationsActivity;
import com.ssr.hunger.delivery.activities.OrderActiveDetailActivity;
import com.ssr.hunger.delivery.activities.WalletActivity;
import com.ssr.hunger.delivery.adapters.ActiveOrdersAdapter;
import com.ssr.hunger.delivery.adapters.AvailableOrdersAdapter;
import com.ssr.hunger.delivery.dialogs.EmergencySosDialog;
import com.ssr.hunger.delivery.dialogs.PincodeManagerDialog;
import com.ssr.hunger.delivery.models.DeliveryOrder;
import com.ssr.hunger.delivery.models.DeliveryPartner;
import com.ssr.hunger.delivery.services.DriverLocationService;
import com.ssr.hunger.delivery.utils.AnalyticsHelper;
import com.ssr.hunger.delivery.utils.Constants;
import com.ssr.hunger.delivery.utils.SoundHelper;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class DashboardOrdersFragment extends Fragment {

    private FirebaseAuth auth;
    private FirebaseFirestore db;

    private View statusIndicator;
    private TextView tvStatusTitle, tvStatusHint, tvGpsStatus;
    private TextView btnManagePincodes;
    private MaterialSwitch switchOnline;

    private ImageButton btnSos, btnWallet, btnNotifications;
    private View cardKycWarning;
    private View btnBookVkyc;

    private View layoutActiveSection;
    private TextView tvActiveCount;
    private RecyclerView rvActiveOrders;
    private ActiveOrdersAdapter activeOrdersAdapter;

    private TextView tvAvailableCount;
    private View layoutEmptyAvailable;
    private TextView tvEmptyAvailableMessage;
    private RecyclerView rvAvailableOrders;
    private AvailableOrdersAdapter availableOrdersAdapter;

    private SwipeRefreshLayout swipeRefresh;

    private DeliveryPartner partner;
    private boolean isOnline = false;
    private final Set<String> declinedOrderIds = new HashSet<>();
    private String lastTopOrderId = null;

    private ListenerRegistration partnerListener;
    private ListenerRegistration activeOrdersListener;
    private ListenerRegistration availableOrdersListener;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_dashboard_orders, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        auth = FirebaseAuth.getInstance();
        db = FirebaseFirestore.getInstance();

        initViews(view);
        setupAdapters();
        loadPartnerData();
    }

    private void initViews(View view) {
        statusIndicator = view.findViewById(R.id.view_status_indicator);
        tvStatusTitle = view.findViewById(R.id.tv_status_title);
        tvStatusHint = view.findViewById(R.id.tv_status_hint);
        tvGpsStatus = view.findViewById(R.id.tv_gps_status);
        btnManagePincodes = view.findViewById(R.id.btn_manage_pincodes);
        switchOnline = view.findViewById(R.id.switch_online);

        btnSos = view.findViewById(R.id.btn_header_sos);
        btnWallet = view.findViewById(R.id.btn_header_wallet);
        btnNotifications = view.findViewById(R.id.btn_header_notifications);
        cardKycWarning = view.findViewById(R.id.card_kyc_warning);
        btnBookVkyc = view.findViewById(R.id.btn_book_vkyc);

        layoutActiveSection = view.findViewById(R.id.layout_active_section);
        tvActiveCount = view.findViewById(R.id.tv_active_count);
        rvActiveOrders = view.findViewById(R.id.rv_active_orders);

        tvAvailableCount = view.findViewById(R.id.tv_available_count);
        layoutEmptyAvailable = view.findViewById(R.id.layout_empty_available);
        tvEmptyAvailableMessage = view.findViewById(R.id.tv_empty_available_message);
        rvAvailableOrders = view.findViewById(R.id.rv_available_orders);

        swipeRefresh = view.findViewById(R.id.swipe_refresh);

        switchOnline.setOnClickListener(v -> toggleOnlineStatus());
        btnManagePincodes.setOnClickListener(v -> openPincodeManager());
        tvGpsStatus.setOnClickListener(v -> startActivity(new Intent(getContext(), LiveTrackingRadarActivity.class)));

        btnBookVkyc.setOnClickListener(v -> {
            if (getContext() != null) {
                new com.ssr.hunger.delivery.dialogs.VkycSlotDialog(getContext()).show();
            }
        });

        btnSos.setOnClickListener(v -> {
            if (getContext() != null) new EmergencySosDialog(getContext()).show();
        });

        btnWallet.setOnClickListener(v -> {
            startActivity(new Intent(getContext(), WalletActivity.class));
        });

        btnNotifications.setOnClickListener(v -> {
            startActivity(new Intent(getContext(), NotificationsActivity.class));
        });

        swipeRefresh.setOnRefreshListener(() -> {
            loadPartnerData();
            swipeRefresh.setRefreshing(false);
        });
    }

    private void setupAdapters() {
        rvActiveOrders.setLayoutManager(new LinearLayoutManager(getContext()));
        activeOrdersAdapter = new ActiveOrdersAdapter(order -> {
            Intent intent = new Intent(getContext(), OrderActiveDetailActivity.class);
            intent.putExtra(Constants.EXTRA_ORDER_ID, order.getId());
            startActivity(intent);
        });
        rvActiveOrders.setAdapter(activeOrdersAdapter);

        rvAvailableOrders.setLayoutManager(new LinearLayoutManager(getContext()));
        availableOrdersAdapter = new AvailableOrdersAdapter(new AvailableOrdersAdapter.OnOrderActionListener() {
            @Override
            public void onAccept(DeliveryOrder order) {
                acceptOrder(order);
            }

            @Override
            public void onDecline(DeliveryOrder order) {
                declinedOrderIds.add(order.getId());
                if (getContext() != null) {
                    AnalyticsHelper.getInstance(getContext()).logOrderDeclined(order.getId());
                }
                restartAvailableOrdersListener();
            }
        });
        rvAvailableOrders.setAdapter(availableOrdersAdapter);
    }

    private void loadPartnerData() {
        if (auth.getCurrentUser() == null) return;
        String uid = auth.getCurrentUser().getUid();

        if (partnerListener != null) partnerListener.remove();

        partnerListener = db.collection(Constants.COLLECTION_DELIVERY_PERSONS)
                .document(uid)
                .addSnapshotListener((snapshot, error) -> {
                    if (error != null || snapshot == null || !snapshot.exists()) return;

                    partner = snapshot.toObject(DeliveryPartner.class);
                    if (partner == null) {
                        partner = new DeliveryPartner();
                        partner.setUid(uid);
                    }

                    isOnline = partner.isOnline();
                    updateStatusUI(isOnline);
                    
                    if (!partner.isVerified()) {
                        cardKycWarning.setVisibility(View.VISIBLE);
                    } else {
                        cardKycWarning.setVisibility(View.GONE);
                    }

                    listenActiveDeliveries();
                    if (isOnline) {
                        listenAvailableOrders();
                    } else {
                        stopAvailableOrdersListener();
                    }
                });
    }

    private void updateStatusUI(boolean online) {
        switchOnline.setChecked(online);
        if (online) {
            statusIndicator.setBackgroundTintList(android.content.res.ColorStateList.valueOf(getResources().getColor(R.color.veg_green)));
            tvStatusTitle.setText("ONLINE");
            tvStatusTitle.setTextColor(getResources().getColor(R.color.veg_green));
            tvStatusHint.setText("You are online and actively receiving order broadcast requests.");
            tvGpsStatus.setText("🛰️ GPS Broadcasting");
            tvEmptyAvailableMessage.setText("Standing by. New available orders will pop up automatically!");
        } else {
            statusIndicator.setBackgroundTintList(android.content.res.ColorStateList.valueOf(getResources().getColor(R.color.error)));
            tvStatusTitle.setText("OFFLINE");
            tvStatusTitle.setTextColor(getResources().getColor(R.color.text_primary));
            tvStatusHint.setText("Turn toggle ON to start receiving delivery requests near you.");
            tvGpsStatus.setText("🛰️ GPS Standby");
            tvEmptyAvailableMessage.setText("You are offline. Turn switch ON to start receiving order broadcasts.");
        }
    }

    private void toggleOnlineStatus() {
        if (auth.getCurrentUser() == null || partner == null) return;

        boolean targetOnline = !isOnline;

        // Check KYC verification
        if (targetOnline && !partner.isVerified()) {
            Toast.makeText(getContext(), "KYC Verification required before you can go online!", Toast.LENGTH_LONG).show();
            switchOnline.setChecked(false);
            return;
        }

        String uid = auth.getCurrentUser().getUid();
        Map<String, Object> updates = new HashMap<>();
        updates.put("isAvailable", targetOnline);
        updates.put("status", targetOnline ? "online" : "offline");
        updates.put("updatedAt", FieldValue.serverTimestamp());

        db.collection(Constants.COLLECTION_DELIVERY_PERSONS)
                .document(uid)
                .set(updates, SetOptions.merge())
                .addOnSuccessListener(v -> {
                    Context ctx = getContext();
                    if (ctx != null) {
                        AnalyticsHelper.getInstance(ctx).logDriverStatus(targetOnline);
                    }
                    if (targetOnline) {
                        if (ctx != null) DriverLocationService.startTracking(ctx, uid, null, false);
                        Toast.makeText(getContext(), "🟢 You are now ONLINE", Toast.LENGTH_SHORT).show();
                    } else {
                        if (ctx != null) DriverLocationService.stopTracking(ctx);
                        Toast.makeText(getContext(), "🔴 You are now OFFLINE", Toast.LENGTH_SHORT).show();
                    }
                })
                .addOnFailureListener(e -> {
                    Toast.makeText(getContext(), "Failed to update status", Toast.LENGTH_SHORT).show();
                    switchOnline.setChecked(isOnline);
                });
    }

    private void listenActiveDeliveries() {
        if (auth.getCurrentUser() == null) return;
        String uid = auth.getCurrentUser().getUid();

        if (activeOrdersListener != null) activeOrdersListener.remove();

        activeOrdersListener = db.collection(Constants.COLLECTION_ORDERS)
                .whereEqualTo("deliveryPersonId", uid)
                .whereIn("status", Arrays.asList(Constants.STATUS_OUT_FOR_DELIVERY, Constants.STATUS_READY, Constants.STATUS_CONFIRMED, Constants.STATUS_PREPARING))
                .addSnapshotListener((snapshot, error) -> {
                    if (error != null || snapshot == null) return;

                    List<DeliveryOrder> activeList = new ArrayList<>();
                    for (DocumentSnapshot doc : snapshot.getDocuments()) {
                        DeliveryOrder o = doc.toObject(DeliveryOrder.class);
                        if (o != null) {
                            o.setId(doc.getId());
                            activeList.add(o);
                        }
                    }

                    if (activeList.isEmpty()) {
                        layoutActiveSection.setVisibility(View.GONE);
                    } else {
                        layoutActiveSection.setVisibility(View.VISIBLE);
                        tvActiveCount.setText(activeList.size() + " active");
                        activeOrdersAdapter.setOrders(activeList);

                        DeliveryOrder topActive = activeList.get(0);
                        Context ctx = getContext();
                        if (ctx != null) {
                            DriverLocationService.updateActiveOrder(ctx, topActive.getId(), true);
                        }
                    }
                });
    }

    private void listenAvailableOrders() {
        if (availableOrdersListener != null) availableOrdersListener.remove();

        availableOrdersListener = db.collection(Constants.COLLECTION_ORDERS)
                .whereIn("status", Arrays.asList(Constants.STATUS_CONFIRMED, Constants.STATUS_PREPARING, Constants.STATUS_READY))
                .addSnapshotListener((snapshot, error) -> {
                    if (error != null || snapshot == null) return;

                    List<DeliveryOrder> availableList = new ArrayList<>();
                    for (DocumentSnapshot doc : snapshot.getDocuments()) {
                        DeliveryOrder o = doc.toObject(DeliveryOrder.class);
                        if (o != null) {
                            o.setId(doc.getId());

                            if (o.getDeliveryPersonId() != null && !o.getDeliveryPersonId().isEmpty()) continue;
                            if (declinedOrderIds.contains(o.getId())) continue;

                            if (o.getTargetDeliveryIds() != null && !o.getTargetDeliveryIds().isEmpty()) {
                                if (!o.getTargetDeliveryIds().contains(auth.getUid())) continue;
                            }

                            if (partner != null && partner.isPincodeFilterActive() && !partner.getServicePincodes().isEmpty()) {
                                boolean matches = false;
                                String custPin = o.getDeliveryAddressPincode();
                                String restPin = o.getRestaurantPincode();
                                for (String p : partner.getServicePincodes()) {
                                    if (p.equalsIgnoreCase(custPin) || p.equalsIgnoreCase(restPin)) {
                                        matches = true;
                                        break;
                                    }
                                }
                                if (!matches) continue;
                            }

                            availableList.add(o);
                        }
                    }

                    if (availableList.isEmpty()) {
                        layoutEmptyAvailable.setVisibility(View.VISIBLE);
                        rvAvailableOrders.setVisibility(View.GONE);
                        tvAvailableCount.setText("0 waiting");
                    } else {
                        layoutEmptyAvailable.setVisibility(View.GONE);
                        rvAvailableOrders.setVisibility(View.VISIBLE);
                        tvAvailableCount.setText(availableList.size() + " waiting");
                        availableOrdersAdapter.setOrders(availableList);

                        DeliveryOrder top = availableList.get(0);
                        if (!top.getId().equals(lastTopOrderId)) {
                            lastTopOrderId = top.getId();
                            if (getContext() != null) SoundHelper.playNewOrderAlert(getContext());
                        }
                    }
                });
    }

    private void stopAvailableOrdersListener() {
        if (availableOrdersListener != null) {
            availableOrdersListener.remove();
            availableOrdersListener = null;
        }
        rvAvailableOrders.setVisibility(View.GONE);
        layoutEmptyAvailable.setVisibility(View.VISIBLE);
        tvAvailableCount.setText("0 waiting");
    }

    private void restartAvailableOrdersListener() {
        if (isOnline) listenAvailableOrders();
    }

    private void acceptOrder(DeliveryOrder order) {
        if (auth.getCurrentUser() == null || partner == null) return;
        String uid = auth.getCurrentUser().getUid();

        Map<String, Object> updates = new HashMap<>();
        updates.put("deliveryPersonId", uid);
        updates.put("deliveryPersonName", partner.getName());
        updates.put("deliveryPersonPhone", partner.getPhone());
        updates.put("status", Constants.STATUS_OUT_FOR_DELIVERY);
        updates.put("deliveryStage", Constants.STAGE_TO_RESTAURANT);
        updates.put("acceptedAt", FieldValue.serverTimestamp());

        db.collection(Constants.COLLECTION_ORDERS)
                .document(order.getId())
                .update(updates)
                .addOnSuccessListener(v -> {
                    Context ctx = getContext();
                    if (ctx != null) {
                        AnalyticsHelper.getInstance(ctx).logOrderAccepted(order.getId(), order.getRestaurantName(), order.getEstimatedEarning());
                    }
                    Toast.makeText(getContext(), "🎉 Order Accepted! Proceed to restaurant for pickup", Toast.LENGTH_SHORT).show();
                    Intent intent = new Intent(getContext(), OrderActiveDetailActivity.class);
                    intent.putExtra(Constants.EXTRA_ORDER_ID, order.getId());
                    startActivity(intent);
                })
                .addOnFailureListener(e -> Toast.makeText(getContext(), "Failed to accept order: " + e.getMessage(), Toast.LENGTH_SHORT).show());
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
                            .addOnSuccessListener(v -> {
                                Toast.makeText(getContext(), "Service area updated", Toast.LENGTH_SHORT).show();
                                restartAvailableOrdersListener();
                            });
                }
        );
        dialog.show();
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        if (partnerListener != null) partnerListener.remove();
        if (activeOrdersListener != null) activeOrdersListener.remove();
        if (availableOrdersListener != null) availableOrdersListener.remove();
    }
}
