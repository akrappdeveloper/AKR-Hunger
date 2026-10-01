package com.ssr.hunger.activities;

import android.os.Bundle;
import android.widget.TextView;
import com.ssr.hunger.R;
import com.ssr.hunger.models.Order;
import com.ssr.hunger.models.OrderItem;
import com.ssr.hunger.utils.Constants;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import java.text.SimpleDateFormat;
import java.util.Locale;

/**
 * Order Detail Activity - mirrors the web app's orders/[id] page.
 * Shows real-time order status, items, and delivery tracking.
 * Extends BaseActivity for Realtime Analytics, Status Breadcrumbs, and Crashlytics.
 */
public class OrderDetailActivity extends BaseActivity {

    private FirebaseFirestore db;
    private ListenerRegistration orderListener;
    private String orderId;
    private String lastStatus = "";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_order_detail);

        db = FirebaseFirestore.getInstance();
        orderId = getIntent().getStringExtra(Constants.EXTRA_ORDER_ID);
        if (orderId == null) {
            recordException("OrderDetail_null_id", new IllegalArgumentException("Order ID is null"));
            finish();
            return;
        }

        findViewById(R.id.btn_back).setOnClickListener(v -> finish());
        loadOrder();
    }

    private void loadOrder() {
        logBreadcrumb("Listening to order updates: " + orderId);
        orderListener = db.collection(Constants.COLLECTION_ORDERS).document(orderId)
                .addSnapshotListener((doc, error) -> {
                    if (error != null) {
                        recordException("orderListener_error", error);
                        return;
                    }
                    if (doc == null || !doc.exists()) return;

                    Order order = doc.toObject(Order.class);
                    if (order == null) return;
                    order.setId(doc.getId());
                    if (doc.getTimestamp("createdAt") != null) {
                        order.setCreatedAt(doc.getTimestamp("createdAt").toDate());
                    }

                    // Track status transitions
                    String newStatus = order.getStatus() != null ? order.getStatus() : "";
                    if (!newStatus.equals(lastStatus)) {
                        logBreadcrumb("Order #" + orderId.substring(0, Math.min(8, orderId.length())) + " status: " + newStatus);
                        if (!lastStatus.isEmpty() && order.getCustomerId() != null) {
                            com.ssr.hunger.utils.NotificationHelper.sendOrderNotification(
                                    OrderDetailActivity.this,
                                    order.getCustomerId(),
                                    orderId,
                                    order.getRestaurantName(),
                                    order.getTotal(),
                                    newStatus
                            );
                        }
                        lastStatus = newStatus;
                    }

                    populateUI(order);
                });
    }

    private void populateUI(Order order) {
        String shortId = order.getId().length() >= 8 ? order.getId().substring(0, 8).toUpperCase() : order.getId();
        ((TextView) findViewById(R.id.tv_order_id)).setText("Order #" + shortId);
        ((TextView) findViewById(R.id.tv_restaurant)).setText(order.getRestaurantName() != null ? order.getRestaurantName() : "Restaurant");
        ((TextView) findViewById(R.id.tv_status)).setText(order.getStatusDisplay());
        ((TextView) findViewById(R.id.tv_total)).setText(String.format(Locale.getDefault(), "₹%.0f", order.getTotal()));
        ((TextView) findViewById(R.id.tv_payment)).setText(order.getPaymentMethod() != null ? order.getPaymentMethod().toUpperCase() : "COD");

        if (order.getCreatedAt() != null) {
            SimpleDateFormat sdf = new SimpleDateFormat("dd MMM yyyy, hh:mm a", Locale.getDefault());
            ((TextView) findViewById(R.id.tv_date)).setText(sdf.format(order.getCreatedAt()));
        }

        // Items
        StringBuilder itemsText = new StringBuilder();
        if (order.getItems() != null) {
            for (OrderItem item : order.getItems()) {
                itemsText.append(item.getQuantity()).append("x ").append(item.getName())
                        .append(" - ₹").append(String.format(Locale.getDefault(), "%.0f", item.getPrice() * item.getQuantity())).append("\n");
            }
        }
        ((TextView) findViewById(R.id.tv_items)).setText(itemsText.toString().trim());

        // Summary
        ((TextView) findViewById(R.id.tv_subtotal)).setText(String.format(Locale.getDefault(), "₹%.0f", order.getSubtotal()));
        ((TextView) findViewById(R.id.tv_delivery)).setText(String.format(Locale.getDefault(), "₹%.0f", order.getDeliveryCharge()));
        ((TextView) findViewById(R.id.tv_tax)).setText(String.format(Locale.getDefault(), "₹%.0f", order.getTaxes()));

        // Delivery person info
        if (order.getDeliveryPersonName() != null) {
            ((TextView) findViewById(R.id.tv_delivery_person)).setText("Driver: " + order.getDeliveryPersonName());
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (orderListener != null) orderListener.remove();
    }

    @Override
    protected String getScreenName() {
        return "OrderDetail";
    }
}
