package com.ssr.hunger.delivery.fragments;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.google.android.material.chip.Chip;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import com.ssr.hunger.delivery.R;
import com.ssr.hunger.delivery.activities.OrderActiveDetailActivity;
import com.ssr.hunger.delivery.adapters.OrderHistoryAdapter;
import com.ssr.hunger.delivery.dialogs.OrderDetailDialog;
import com.ssr.hunger.delivery.models.DeliveryOrder;
import com.ssr.hunger.delivery.utils.Constants;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class OrderHistoryFragment extends Fragment {

    private static final String TAG = "OrderHistoryFragment";

    private FirebaseAuth auth;
    private FirebaseFirestore db;

    private RecyclerView rvHistory;
    private OrderHistoryAdapter adapter;
    private View layoutEmpty;
    private TextView tvEmptyTitle, tvEmptySub;
    private SwipeRefreshLayout swipeRefresh;

    private Chip chipAll, chipActive, chipDelivered, chipCancelled;
    private final List<DeliveryOrder> allHistory = new ArrayList<>();
    private String currentFilter = "all";
    private ListenerRegistration historyListener;

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
        loadHistory();
    }

    private void initViews(View view) {
        rvHistory = view.findViewById(R.id.rv_history_orders);
        layoutEmpty = view.findViewById(R.id.layout_empty_history);
        tvEmptyTitle = view.findViewById(R.id.tv_empty_history_title);
        tvEmptySub = view.findViewById(R.id.tv_empty_history_sub);
        swipeRefresh = view.findViewById(R.id.swipe_refresh_history);

        chipAll = view.findViewById(R.id.chip_filter_all);
        chipActive = view.findViewById(R.id.chip_filter_active);
        chipDelivered = view.findViewById(R.id.chip_filter_delivered);
        chipCancelled = view.findViewById(R.id.chip_filter_cancelled);

        rvHistory.setLayoutManager(new LinearLayoutManager(getContext()));
        adapter = new OrderHistoryAdapter(order -> {
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
        rvHistory.setAdapter(adapter);

        chipAll.setOnClickListener(v -> applyFilter("all"));
        if (chipActive != null) {
            chipActive.setOnClickListener(v -> applyFilter("active"));
        }
        chipDelivered.setOnClickListener(v -> applyFilter("delivered"));
        chipCancelled.setOnClickListener(v -> applyFilter("cancelled"));

        swipeRefresh.setOnRefreshListener(() -> {
            loadHistory();
            swipeRefresh.setRefreshing(false);
        });
    }

    private void loadHistory() {
        if (auth.getCurrentUser() == null) return;
        String uid = auth.getCurrentUser().getUid();

        if (historyListener != null) historyListener.remove();

        // Query all orders assigned to this delivery driver in real-time
        historyListener = db.collection(Constants.COLLECTION_ORDERS)
                .whereEqualTo("deliveryPersonId", uid)
                .addSnapshotListener((snapshots, error) -> {
                    if (error != null) {
                        Log.e(TAG, "Error fetching delivery order history: " + error.getMessage(), error);
                        Context ctx = getContext();
                        if (ctx != null) {
                            Toast.makeText(ctx, "Failed to load order history: " + error.getMessage(), Toast.LENGTH_SHORT).show();
                        }
                        return;
                    }

                    if (snapshots == null) return;

                    allHistory.clear();
                    for (DocumentSnapshot doc : snapshots.getDocuments()) {
                        DeliveryOrder o = doc.toObject(DeliveryOrder.class);
                        if (o != null) {
                            o.setId(doc.getId());
                            allHistory.add(o);
                        }
                    }

                    // Sort newest first by deliveredAt, acceptedAt, or createdAt
                    Collections.sort(allHistory, (a, b) -> {
                        long tA = a.getDeliveredAt() != null ? a.getDeliveredAt().getTime()
                                : (a.getAcceptedAt() != null ? a.getAcceptedAt().getTime()
                                : (a.getCreatedAt() != null ? a.getCreatedAt().getTime() : 0));
                        long tB = b.getDeliveredAt() != null ? b.getDeliveredAt().getTime()
                                : (b.getAcceptedAt() != null ? b.getAcceptedAt().getTime()
                                : (b.getCreatedAt() != null ? b.getCreatedAt().getTime() : 0));
                        return Long.compare(tB, tA);
                    });

                    // Update chip count labels dynamically
                    updateChipCounts();

                    applyFilter(currentFilter);
                });
    }

    private void updateChipCounts() {
        int total = allHistory.size();
        int activeCount = 0;
        int deliveredCount = 0;
        int cancelledCount = 0;

        for (DeliveryOrder o : allHistory) {
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

        chipAll.setText("All (" + total + ")");
        if (chipActive != null) {
            chipActive.setText("⚡ Active (" + activeCount + ")");
        }
        chipDelivered.setText("Delivered (" + deliveredCount + ")");
        chipCancelled.setText("Cancelled (" + cancelledCount + ")");
    }

    private void applyFilter(String filter) {
        this.currentFilter = filter;
        List<DeliveryOrder> filtered = new ArrayList<>();

        for (DeliveryOrder o : allHistory) {
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
            layoutEmpty.setVisibility(View.VISIBLE);
            rvHistory.setVisibility(View.GONE);

            if (tvEmptyTitle != null && tvEmptySub != null) {
                if ("active".equalsIgnoreCase(filter)) {
                    tvEmptyTitle.setText("No active deliveries");
                    tvEmptySub.setText("You don't have any ongoing accepted orders right now.");
                } else if ("delivered".equalsIgnoreCase(filter)) {
                    tvEmptyTitle.setText("No delivered orders yet");
                    tvEmptySub.setText("Completed orders will appear here automatically.");
                } else if ("cancelled".equalsIgnoreCase(filter)) {
                    tvEmptyTitle.setText("No cancelled orders");
                    tvEmptySub.setText("Returned or cancelled orders will be archived here.");
                } else {
                    tvEmptyTitle.setText("No delivery records found");
                    tvEmptySub.setText("Accepted, active, and completed orders will appear here automatically in real-time.");
                }
            }
        } else {
            layoutEmpty.setVisibility(View.GONE);
            rvHistory.setVisibility(View.VISIBLE);
            adapter.setOrders(filtered);
        }
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        if (historyListener != null) {
            historyListener.remove();
            historyListener = null;
        }
    }
}
