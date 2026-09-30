package com.ssr.hunger.fragments;

import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import com.ssr.hunger.R;
import com.ssr.hunger.activities.OrderDetailActivity;
import com.ssr.hunger.adapters.OrderAdapter;
import com.ssr.hunger.models.Order;
import com.ssr.hunger.utils.CartManager;
import com.ssr.hunger.utils.Constants;
import com.ssr.hunger.models.CartItem;
import com.ssr.hunger.models.OrderItem;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import com.google.firebase.firestore.Query;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

/**
 * Orders Fragment - real-time order list from Firestore.
 * Shows order history with status, reorder, and rating capabilities.
 */
public class OrdersFragment extends Fragment {

    private RecyclerView rvOrders;
    private View emptyOrders;
    private View progressOrders;
    private OrderAdapter orderAdapter;
    private FirebaseFirestore db;
    private ListenerRegistration ordersListener;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        View view = inflater.inflate(R.layout.fragment_orders, container, false);

        rvOrders = view.findViewById(R.id.rv_orders);
        emptyOrders = view.findViewById(R.id.empty_orders);
        progressOrders = view.findViewById(R.id.progress_orders);

        db = FirebaseFirestore.getInstance();

        orderAdapter = new OrderAdapter(new ArrayList<>(),
                // View order detail
                order -> {
                    Intent intent = new Intent(getContext(), OrderDetailActivity.class);
                    intent.putExtra(Constants.EXTRA_ORDER_ID, order.getId());
                    startActivity(intent);
                },
                // Reorder
                order -> {
                    if (order.getItems() != null) {
                        CartManager cart = CartManager.getInstance(requireContext());
                        for (OrderItem item : order.getItems()) {
                            cart.addItem(new CartItem(
                                    item.getMenuItemId(),
                                    order.getRestaurantId(),
                                    item.getName(),
                                    item.getPrice(),
                                    item.getQuantity(),
                                    item.getImage(),
                                    order.getRestaurantName() != null ? order.getRestaurantName() : ""
                            ));
                        }
                        Toast.makeText(getContext(), "Items added to cart!", Toast.LENGTH_SHORT).show();
                    }
                }
        );

        rvOrders.setLayoutManager(new LinearLayoutManager(getContext()));
        rvOrders.setAdapter(orderAdapter);

        loadOrders();

        return view;
    }

    private void loadOrders() {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) return;

        progressOrders.setVisibility(View.VISIBLE);

        ordersListener = db.collection(Constants.COLLECTION_ORDERS)
                .whereEqualTo("customerId", user.getUid())
                .addSnapshotListener((querySnapshot, error) -> {
                    progressOrders.setVisibility(View.GONE);

                    if (error != null || querySnapshot == null) return;

                    List<Order> orders = new ArrayList<>();
                    for (DocumentSnapshot doc : querySnapshot.getDocuments()) {
                        Order order = doc.toObject(Order.class);
                        if (order != null) {
                            order.setId(doc.getId());
                            // Handle Firestore timestamp
                            if (doc.getTimestamp("createdAt") != null) {
                                order.setCreatedAt(doc.getTimestamp("createdAt").toDate());
                            }
                            orders.add(order);
                        }
                    }

                    // Sort by date descending
                    orders.sort((a, b) -> {
                        Date da = a.getCreatedAt() != null ? a.getCreatedAt() : new Date(0);
                        Date db2 = b.getCreatedAt() != null ? b.getCreatedAt() : new Date(0);
                        return db2.compareTo(da);
                    });

                    orderAdapter.updateData(orders);

                    if (orders.isEmpty()) {
                        emptyOrders.setVisibility(View.VISIBLE);
                        rvOrders.setVisibility(View.GONE);
                    } else {
                        emptyOrders.setVisibility(View.GONE);
                        rvOrders.setVisibility(View.VISIBLE);
                    }
                });
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        if (ordersListener != null) ordersListener.remove();
    }
}
