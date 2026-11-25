package com.ssr.hunger.delivery.fragments;

import android.content.Context;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.os.Bundle;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.chip.Chip;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import com.ssr.hunger.delivery.R;
import com.ssr.hunger.delivery.activities.OrderActiveDetailActivity;
import com.ssr.hunger.delivery.adapters.EarningHistoryAdapter;
import com.ssr.hunger.delivery.adapters.OrderHistoryAdapter;
import com.ssr.hunger.delivery.dialogs.OrderDetailDialog;
import com.ssr.hunger.delivery.models.DeliveryOrder;
import com.ssr.hunger.delivery.utils.Constants;
import com.ssr.hunger.delivery.utils.LocationUtils;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * OrderHistoryFragment with two distinct tabs:
 * Tab A: Order History (complete delivery lifecycle archive with filter chips)
 * Tab B: Earning History (earnings summary, tips, individual delivered order earning records)
 */
public class OrderHistoryFragment extends Fragment {

    private static final String TAG = "OrderHistoryFragment";

    private FirebaseAuth auth;
    private FirebaseFirestore db;

    // Tab buttons & Sections
    private MaterialButton btnTabOrders, btnTabEarnings;
    private LinearLayout layoutSectionOrders, layoutSectionEarnings;
    private boolean isEarningsTabSelected = false;

    // Section A: Order History views
    private RecyclerView rvHistoryOrders;
    private OrderHistoryAdapter ordersAdapter;
    private View layoutEmptyOrders;
    private TextView tvEmptyOrdersTitle, tvEmptyOrdersSub;
    private Chip chipAll, chipActive, chipDelivered, chipCancelled;
    private String currentOrderFilter = "all";

    // Section B: Earning History views
    private TextView tvSummaryTotalEarnings, tvSummaryDeliveriesCount, tvSummaryAvgEarning, tvSummaryTipsTotal;
    private View layoutEmptyEarnings;
    private RecyclerView rvHistoryEarnings;
    private EarningHistoryAdapter earningsAdapter;

    private SwipeRefreshLayout swipeRefresh;

    // Data structures (deduplicated by order id)
    private final List<DeliveryOrder> allOrdersList = new ArrayList<>();
    private final List<DeliveryOrder> deliveredOrdersList = new ArrayList<>();
    private final Map<String, DeliveryOrder> historyMap = new HashMap<>();

    // Realtime listeners
    private ListenerRegistration historyListener;
    private ListenerRegistration driverIdListener;
    private ListenerRegistration partnerIdListener;
    private FirebaseAuth.AuthStateListener authStateListener;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_order_history, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        auth = FirebaseAuth.getInstance();
        db = FirebaseFirestore.getInstance();

        initViews(view);
        setupTabs();
        loadHistory();

        authStateListener = firebaseAuth -> {
            if (firebaseAuth.getCurrentUser() != null && historyMap.isEmpty()) {
                loadHistory();
            }
        };
        auth.addAuthStateListener(authStateListener);
    }

    private void initViews(View view) {
        btnTabOrders = view.findViewById(R.id.btn_tab_orders);
        btnTabEarnings = view.findViewById(R.id.btn_tab_earnings);
        layoutSectionOrders = view.findViewById(R.id.layout_section_orders);
        layoutSectionEarnings = view.findViewById(R.id.layout_section_earnings);

        // Section A Views
        rvHistoryOrders = view.findViewById(R.id.rv_history_orders);
        layoutEmptyOrders = view.findViewById(R.id.layout_empty_history);
        tvEmptyOrdersTitle = view.findViewById(R.id.tv_empty_history_title);
        tvEmptyOrdersSub = view.findViewById(R.id.tv_empty_history_sub);

        chipAll = view.findViewById(R.id.chip_filter_all);
        chipActive = view.findViewById(R.id.chip_filter_active);
        chipDelivered = view.findViewById(R.id.chip_filter_delivered);
        chipCancelled = view.findViewById(R.id.chip_filter_cancelled);

        rvHistoryOrders.setLayoutManager(new LinearLayoutManager(getContext()));
        ordersAdapter = new OrderHistoryAdapter(order -> {
            Context ctx = getContext();
            if (ctx == null) return;

            String status = order.getStatus();
            boolean isActive = Constants.STATUS_OUT_FOR_DELIVERY.equalsIgnoreCase(status)
                    || Constants.STATUS_CONFIRMED.equalsIgnoreCase(status)
                    || Constants.STATUS_PREPARING.equalsIgnoreCase(status)
                    || Constants.STATUS_READY.equalsIgnoreCase(status);

            if (isActive) {
                Intent intent = new Intent(ctx, OrderActiveDetailActivity.class);
                intent.putExtra(Constants.EXTRA_ORDER_ID, order.getId());
                startActivity(intent);
            } else {
                new OrderDetailDialog(ctx, order).show();
            }
        });
        rvHistoryOrders.setAdapter(ordersAdapter);

        chipAll.setOnClickListener(v -> applyOrderFilter("all"));
        if (chipActive != null) chipActive.setOnClickListener(v -> applyOrderFilter("active"));
        chipDelivered.setOnClickListener(v -> applyOrderFilter("delivered"));
        chipCancelled.setOnClickListener(v -> applyOrderFilter("cancelled"));

        // Section B Views
        tvSummaryTotalEarnings = view.findViewById(R.id.tv_summary_total_earnings);
        tvSummaryDeliveriesCount = view.findViewById(R.id.tv_summary_deliveries_count);
        tvSummaryAvgEarning = view.findViewById(R.id.tv_summary_avg_earning);
        tvSummaryTipsTotal = view.findViewById(R.id.tv_summary_tips_total);
        layoutEmptyEarnings = view.findViewById(R.id.layout_empty_earnings);
        rvHistoryEarnings = view.findViewById(R.id.rv_history_earnings);

        rvHistoryEarnings.setLayoutManager(new LinearLayoutManager(getContext()));
        earningsAdapter = new EarningHistoryAdapter(order -> {
            Context ctx = getContext();
            if (ctx != null) {
                new OrderDetailDialog(ctx, order).show();
            }
        });
        rvHistoryEarnings.setAdapter(earningsAdapter);

        // SwipeRefresh
        swipeRefresh = view.findViewById(R.id.swipe_refresh_history);
        swipeRefresh.setOnRefreshListener(() -> {
            loadHistory();
            swipeRefresh.setRefreshing(false);
        });
    }

    private void setupTabs() {
        btnTabOrders.setOnClickListener(v -> selectTab(false));
        btnTabEarnings.setOnClickListener(v -> selectTab(true));
        selectTab(false);
    }

    private void selectTab(boolean showEarnings) {
        isEarningsTabSelected = showEarnings;
        Context ctx = getContext();
        if (ctx == null) return;

        int activeBgColor = ContextCompat.getColor(ctx, R.color.primary);
        int inactiveTextColor = ContextCompat.getColor(ctx, R.color.text_secondary);
        int whiteColor = ContextCompat.getColor(ctx, R.color.white);

        if (!showEarnings) {
            // Tab A Selected: Orders
            layoutSectionOrders.setVisibility(View.VISIBLE);
            layoutSectionEarnings.setVisibility(View.GONE);

            btnTabOrders.setBackgroundTintList(ColorStateList.valueOf(activeBgColor));
            btnTabOrders.setTextColor(whiteColor);

            btnTabEarnings.setBackgroundTintList(ColorStateList.valueOf(android.graphics.Color.TRANSPARENT));
            btnTabEarnings.setTextColor(inactiveTextColor);
        } else {
            // Tab B Selected: Earnings
            layoutSectionOrders.setVisibility(View.GONE);
            layoutSectionEarnings.setVisibility(View.VISIBLE);

            btnTabEarnings.setBackgroundTintList(ColorStateList.valueOf(activeBgColor));
            btnTabEarnings.setTextColor(whiteColor);

            btnTabOrders.setBackgroundTintList(ColorStateList.valueOf(android.graphics.Color.TRANSPARENT));
            btnTabOrders.setTextColor(inactiveTextColor);
        }
    }

    private void loadHistory() {
        if (auth.getCurrentUser() == null) return;
        String uid = auth.getCurrentUser().getUid();

        if (historyListener != null) historyListener.remove();
        if (driverIdListener != null) driverIdListener.remove();
        if (partnerIdListener != null) partnerIdListener.remove();

        // 1. Query orders where deliveryPersonId == uid
        historyListener = db.collection(Constants.COLLECTION_ORDERS)
                .whereEqualTo("deliveryPersonId", uid)
                .addSnapshotListener((snapshots, error) -> {
                    if (error != null) {
                        Log.e(TAG, "Error fetching orders (deliveryPersonId): " + error.getMessage(), error);
                        return;
                    }
                    if (snapshots != null) {
                        for (DocumentSnapshot doc : snapshots.getDocuments()) {
                            DeliveryOrder o = DeliveryOrder.parseSnapshot(doc);
                            if (o != null) historyMap.put(o.getId(), o);
                        }
                        rebuildHistoryAndEarnings();
                    }
                });

        // 2. Query orders where driverId == uid
        driverIdListener = db.collection(Constants.COLLECTION_ORDERS)
                .whereEqualTo("driverId", uid)
                .addSnapshotListener((snapshots, error) -> {
                    if (error == null && snapshots != null) {
                        for (DocumentSnapshot doc : snapshots.getDocuments()) {
                            DeliveryOrder o = DeliveryOrder.parseSnapshot(doc);
                            if (o != null) historyMap.put(o.getId(), o);
                        }
                        rebuildHistoryAndEarnings();
                    }
                });

        // 3. Query orders where deliveryPartnerId == uid
        partnerIdListener = db.collection(Constants.COLLECTION_ORDERS)
                .whereEqualTo("deliveryPartnerId", uid)
                .addSnapshotListener((snapshots, error) -> {
                    if (error == null && snapshots != null) {
                        for (DocumentSnapshot doc : snapshots.getDocuments()) {
                            DeliveryOrder o = DeliveryOrder.parseSnapshot(doc);
                            if (o != null) historyMap.put(o.getId(), o);
                        }
                        rebuildHistoryAndEarnings();
                    }
                });
    }

    private synchronized void rebuildHistoryAndEarnings() {
        allOrdersList.clear();
        deliveredOrdersList.clear();

        allOrdersList.addAll(historyMap.values());

        // Sort orders newest first
        Collections.sort(allOrdersList, (a, b) -> {
            long tA = a.getDeliveredAt() != null ? a.getDeliveredAt().getTime()
                    : (a.getAcceptedAt() != null ? a.getAcceptedAt().getTime()
                    : (a.getCreatedAt() != null ? a.getCreatedAt().getTime() : 0));
            long tB = b.getDeliveredAt() != null ? b.getDeliveredAt().getTime()
                    : (b.getAcceptedAt() != null ? b.getAcceptedAt().getTime()
                    : (b.getCreatedAt() != null ? b.getCreatedAt().getTime() : 0));
            return Long.compare(tB, tA);
        });

        // Compute delivered orders for Earning History and calculate exact sums
        double totalEarnings = 0.0;
        double totalTips = 0.0;

        for (DeliveryOrder o : allOrdersList) {
            if (Constants.STATUS_DELIVERED.equalsIgnoreCase(o.getStatus())) {
                deliveredOrdersList.add(o);
                totalEarnings += o.getEstimatedEarning();
                totalTips += o.getTipAmount();
            }
        }

        int deliveredCount = deliveredOrdersList.size();
        double avgEarning = deliveredCount > 0 ? (totalEarnings / deliveredCount) : 0.0;

        // Update Section B Summary Header
        if (tvSummaryTotalEarnings != null) {
            tvSummaryTotalEarnings.setText(LocationUtils.formatCurrency(totalEarnings));
        }
        if (tvSummaryDeliveriesCount != null) {
            tvSummaryDeliveriesCount.setText(deliveredCount + " trips");
        }
        if (tvSummaryAvgEarning != null) {
            tvSummaryAvgEarning.setText(LocationUtils.formatCurrency(avgEarning));
        }
        if (tvSummaryTipsTotal != null) {
            tvSummaryTipsTotal.setText(LocationUtils.formatCurrency(totalTips));
        }

        // Update Section B Earning List
        if (deliveredOrdersList.isEmpty()) {
            if (layoutEmptyEarnings != null) layoutEmptyEarnings.setVisibility(View.VISIBLE);
            if (rvHistoryEarnings != null) rvHistoryEarnings.setVisibility(View.GONE);
        } else {
            if (layoutEmptyEarnings != null) layoutEmptyEarnings.setVisibility(View.GONE);
            if (rvHistoryEarnings != null) {
                rvHistoryEarnings.setVisibility(View.VISIBLE);
                earningsAdapter.setOrders(deliveredOrdersList);
            }
        }

        // Update Section A Order List & Filter Counts
        updateChipCounts();
        applyOrderFilter(currentOrderFilter);
    }

    private void updateChipCounts() {
        int total = allOrdersList.size();
        int activeCount = 0;
        int deliveredCount = 0;
        int cancelledCount = 0;

        for (DeliveryOrder o : allOrdersList) {
            String s = o.getStatus();
            if (Constants.STATUS_DELIVERED.equalsIgnoreCase(s)) {
                deliveredCount++;
            } else if (Constants.STATUS_CANCELLED.equalsIgnoreCase(s) || "returned".equalsIgnoreCase(s)) {
                cancelledCount++;
            } else if (Constants.STATUS_OUT_FOR_DELIVERY.equalsIgnoreCase(s)
                    || Constants.STATUS_CONFIRMED.equalsIgnoreCase(s)
                    || Constants.STATUS_PREPARING.equalsIgnoreCase(s)
                    || Constants.STATUS_READY.equalsIgnoreCase(s)) {
                activeCount++;
            }
        }

        if (chipAll != null) chipAll.setText("All (" + total + ")");
        if (chipActive != null) chipActive.setText("⚡ Active (" + activeCount + ")");
        if (chipDelivered != null) chipDelivered.setText("Delivered (" + deliveredCount + ")");
        if (chipCancelled != null) chipCancelled.setText("Cancelled (" + cancelledCount + ")");

        // Update Tab labels with count
        if (btnTabOrders != null) {
            btnTabOrders.setText("📦 Orders (" + total + ")");
        }
        if (btnTabEarnings != null) {
            btnTabEarnings.setText("💰 Earnings (" + deliveredCount + ")");
        }
    }

    private void applyOrderFilter(String filter) {
        this.currentOrderFilter = filter;
        List<DeliveryOrder> filtered = new ArrayList<>();

        for (DeliveryOrder o : allOrdersList) {
            String status = o.getStatus();
            if ("all".equalsIgnoreCase(filter)) {
                filtered.add(o);
            } else if ("active".equalsIgnoreCase(filter)) {
                if (Constants.STATUS_OUT_FOR_DELIVERY.equalsIgnoreCase(status)
                        || Constants.STATUS_CONFIRMED.equalsIgnoreCase(status)
                        || Constants.STATUS_PREPARING.equalsIgnoreCase(status)
                        || Constants.STATUS_READY.equalsIgnoreCase(status)) {
                    filtered.add(o);
                }
            } else if ("delivered".equalsIgnoreCase(filter) && Constants.STATUS_DELIVERED.equalsIgnoreCase(status)) {
                filtered.add(o);
            } else if ("cancelled".equalsIgnoreCase(filter) && (Constants.STATUS_CANCELLED.equalsIgnoreCase(status) || "returned".equalsIgnoreCase(status))) {
                filtered.add(o);
            }
        }

        if (filtered.isEmpty()) {
            if (layoutEmptyOrders != null) layoutEmptyOrders.setVisibility(View.VISIBLE);
            if (rvHistoryOrders != null) rvHistoryOrders.setVisibility(View.GONE);

            if (tvEmptyOrdersTitle != null && tvEmptyOrdersSub != null) {
                if ("active".equalsIgnoreCase(filter)) {
                    tvEmptyOrdersTitle.setText("No active deliveries");
                    tvEmptyOrdersSub.setText("You don't have any ongoing accepted orders right now.");
                } else if ("delivered".equalsIgnoreCase(filter)) {
                    tvEmptyOrdersTitle.setText("No delivered orders yet");
                    tvEmptyOrdersSub.setText("Completed orders will appear here automatically.");
                } else if ("cancelled".equalsIgnoreCase(filter)) {
                    tvEmptyOrdersTitle.setText("No cancelled orders");
                    tvEmptyOrdersSub.setText("Returned or cancelled orders will be archived here.");
                } else {
                    tvEmptyOrdersTitle.setText("No delivery records found");
                    tvEmptyOrdersSub.setText("Accepted, active, and completed orders will appear here automatically.");
                }
            }
        } else {
            if (layoutEmptyOrders != null) layoutEmptyOrders.setVisibility(View.GONE);
            if (rvHistoryOrders != null) {
                rvHistoryOrders.setVisibility(View.VISIBLE);
                ordersAdapter.setOrders(filtered);
            }
        }
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        if (historyListener != null) {
            historyListener.remove();
            historyListener = null;
        }
        if (driverIdListener != null) {
            driverIdListener.remove();
            driverIdListener = null;
        }
        if (partnerIdListener != null) {
            partnerIdListener.remove();
            partnerIdListener = null;
        }
        if (authStateListener != null && auth != null) {
            auth.removeAuthStateListener(authStateListener);
            authStateListener = null;
        }
    }
}
