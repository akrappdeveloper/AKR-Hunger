package com.ssr.hunger.views;

import android.content.Context;
import android.content.Intent;
import android.util.AttributeSet;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import com.ssr.hunger.R;
import com.ssr.hunger.activities.OrderDetailActivity;
import com.ssr.hunger.models.Order;
import com.ssr.hunger.utils.Constants;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import java.util.ArrayList;
import java.util.List;

/**
 * Active Order Floating Tracker - mirrors the web app's ActiveOrderFloatingTracker.tsx
 * Shows a floating bar at the bottom when an order is in progress.
 * Auto-hides when there's no active order.
 */
public class ActiveOrderTracker extends FrameLayout {

    private ListenerRegistration listener;
    private Order activeOrder;
    private View trackerView;

    public ActiveOrderTracker(@NonNull Context context) {
        super(context);
        init();
    }

    public ActiveOrderTracker(@NonNull Context context, @Nullable AttributeSet attrs) {
        super(context, attrs);
        init();
    }

    private void init() {
        trackerView = LayoutInflater.from(getContext()).inflate(R.layout.view_active_order_tracker, this, true);
        setVisibility(View.GONE);
        setOnClickListener(v -> openOrderDetail());
        startListening();
    }

    public void startListening() {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) return;

        listener = FirebaseFirestore.getInstance()
                .collection(Constants.COLLECTION_ORDERS)
                .whereEqualTo("customerId", user.getUid())
                .addSnapshotListener((snapshot, error) -> {
                    if (error != null || snapshot == null) return;

                    List<String> activeStatuses = new ArrayList<>();
                    activeStatuses.add("pending");
                    activeStatuses.add("confirmed");
                    activeStatuses.add("preparing");
                    activeStatuses.add("ready");
                    activeStatuses.add("out_for_delivery");

                    Order foundActive = null;
                    long latestTimestamp = 0;

                    for (DocumentSnapshot doc : snapshot.getDocuments()) {
                        String status = doc.getString("status");
                        if (status != null && activeStatuses.contains(status)) {
                            long ts = 0;
                            if (doc.getTimestamp("createdAt") != null) {
                                ts = doc.getTimestamp("createdAt").getSeconds();
                            }
                            if (ts > latestTimestamp) {
                                latestTimestamp = ts;
                                Order o = doc.toObject(Order.class);
                                if (o != null) {
                                    o.setId(doc.getId());
                                    foundActive = o;
                                }
                            }
                        }
                    }

                    activeOrder = foundActive;
                    post(() -> updateUI());
                });
    }

    private void updateUI() {
        if (activeOrder == null) {
            setVisibility(View.GONE);
            return;
        }

        setVisibility(View.VISIBLE);
        TextView tvStatus = trackerView.findViewById(R.id.tv_tracker_status);
        TextView tvRestaurant = trackerView.findViewById(R.id.tv_tracker_restaurant);
        TextView tvEta = trackerView.findViewById(R.id.tv_tracker_eta);

        String status = activeOrder.getStatus();
        String title;
        String eta;

        switch (status != null ? status : "") {
            case "pending":
            case "confirmed":
                title = "🛒 Order Confirmed";
                eta = "~30-40 min";
                break;
            case "preparing":
                title = "👨‍🍳 Preparing Your Meal";
                eta = "~20-30 min";
                break;
            case "ready":
                title = "📦 Ready for Pickup";
                eta = "~10-15 min";
                break;
            case "out_for_delivery":
                title = "🛵 On the Way!";
                eta = "~5-10 min";
                break;
            default:
                title = "📋 Order In Progress";
                eta = "—";
        }

        tvStatus.setText(title);
        tvRestaurant.setText(activeOrder.getRestaurantName() != null ? activeOrder.getRestaurantName() : "");
        tvEta.setText(eta);
    }

    private void openOrderDetail() {
        if (activeOrder != null) {
            Intent intent = new Intent(getContext(), OrderDetailActivity.class);
            intent.putExtra(Constants.EXTRA_ORDER_ID, activeOrder.getId());
            getContext().startActivity(intent);
        }
    }

    public void stopListening() {
        if (listener != null) {
            listener.remove();
        }
    }
}
