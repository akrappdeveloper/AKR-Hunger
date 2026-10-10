package com.ssr.hunger.delivery.fragments;

import android.content.Context;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

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
import com.ssr.hunger.delivery.adapters.OrderHistoryAdapter;
import com.ssr.hunger.delivery.dialogs.OrderDetailDialog;
import com.ssr.hunger.delivery.models.DeliveryOrder;
import com.ssr.hunger.delivery.utils.Constants;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

public class OrderHistoryFragment extends Fragment {

    private FirebaseAuth auth;
    private FirebaseFirestore db;

    private RecyclerView rvHistory;
    private OrderHistoryAdapter adapter;
    private View layoutEmpty;
    private SwipeRefreshLayout swipeRefresh;

    private Chip chipAll, chipDelivered, chipCancelled;
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
        swipeRefresh = view.findViewById(R.id.swipe_refresh_history);

        chipAll = view.findViewById(R.id.chip_filter_all);
        chipDelivered = view.findViewById(R.id.chip_filter_delivered);
        chipCancelled = view.findViewById(R.id.chip_filter_cancelled);

        rvHistory.setLayoutManager(new LinearLayoutManager(getContext()));
        adapter = new OrderHistoryAdapter(order -> {
            Context ctx = getContext();
            if (ctx != null) {
                new OrderDetailDialog(ctx, order).show();
            }
        });
        rvHistory.setAdapter(adapter);

        chipAll.setOnClickListener(v -> applyFilter("all"));
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

        historyListener = db.collection(Constants.COLLECTION_ORDERS)
                .whereEqualTo("deliveryPersonId", uid)
                .whereIn("status", Arrays.asList(Constants.STATUS_DELIVERED, Constants.STATUS_CANCELLED))
                .addSnapshotListener((snapshots, error) -> {
                    if (error != null || snapshots == null) return;

                    allHistory.clear();
                    for (DocumentSnapshot doc : snapshots.getDocuments()) {
                        DeliveryOrder o = doc.toObject(DeliveryOrder.class);
                        if (o != null) {
                            o.setId(doc.getId());
                            allHistory.add(o);
                        }
                    }

                    // Sort newest first by deliveredAt or createdAt
                    Collections.sort(allHistory, (a, b) -> {
                        long tA = a.getDeliveredAt() != null ? a.getDeliveredAt().getTime() : (a.getCreatedAt() != null ? a.getCreatedAt().getTime() : 0);
                        long tB = b.getDeliveredAt() != null ? b.getDeliveredAt().getTime() : (b.getCreatedAt() != null ? b.getCreatedAt().getTime() : 0);
                        return Long.compare(tB, tA);
                    });

                    applyFilter(currentFilter);
                });
    }

    private void applyFilter(String filter) {
        this.currentFilter = filter;
        List<DeliveryOrder> filtered = new ArrayList<>();

        for (DeliveryOrder o : allHistory) {
            if ("all".equalsIgnoreCase(filter)) {
                filtered.add(o);
            } else if ("delivered".equalsIgnoreCase(filter) && Constants.STATUS_DELIVERED.equalsIgnoreCase(o.getStatus())) {
                filtered.add(o);
            } else if ("cancelled".equalsIgnoreCase(filter) && Constants.STATUS_CANCELLED.equalsIgnoreCase(o.getStatus())) {
                filtered.add(o);
            }
        }

        if (filtered.isEmpty()) {
            layoutEmpty.setVisibility(View.VISIBLE);
            rvHistory.setVisibility(View.GONE);
        } else {
            layoutEmpty.setVisibility(View.GONE);
            rvHistory.setVisibility(View.VISIBLE);
            adapter.setOrders(filtered);
        }
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        if (historyListener != null) historyListener.remove();
    }
}
