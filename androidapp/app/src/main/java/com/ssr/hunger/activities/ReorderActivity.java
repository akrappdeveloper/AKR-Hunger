package com.ssr.hunger.activities;

import android.os.Bundle;
import android.view.View;
import android.widget.ImageButton;
import android.widget.ProgressBar;
import android.widget.TextView;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.Query;
import com.google.firebase.firestore.QueryDocumentSnapshot;
import com.ssr.hunger.R;
import com.ssr.hunger.adapters.OrderAdapter;
import com.ssr.hunger.models.Order;
import java.util.ArrayList;
import java.util.List;

public class ReorderActivity extends BaseActivity {

    private ImageButton btnBack;
    private RecyclerView rvOrders;
    private ProgressBar progressBar;
    private View layoutEmpty;
    private FirebaseFirestore db;
    private OrderAdapter orderAdapter;
    private List<Order> pastOrders = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_reorder);

        db = FirebaseFirestore.getInstance();
        btnBack = findViewById(R.id.btnBack);
        rvOrders = findViewById(R.id.rvOrders);
        progressBar = findViewById(R.id.progressBar);
        layoutEmpty = findViewById(R.id.layoutEmpty);

        btnBack.setOnClickListener(v -> finish());

        rvOrders.setLayoutManager(new LinearLayoutManager(this));
        orderAdapter = new OrderAdapter(pastOrders, 
            order -> {
                android.content.Intent intent = new android.content.Intent(this, OrderDetailActivity.class);
                intent.putExtra("orderId", order.getId());
                startActivity(intent);
            },
            order -> {
                showToast("Added items from " + (order.getRestaurantName() != null ? order.getRestaurantName() : "past order") + " to cart!");
            }
        );
        rvOrders.setAdapter(orderAdapter);

        loadPastDeliveredOrders();
    }

    private void loadPastDeliveredOrders() {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) {
            showToast("Please log in to view your orders");
            finish();
            return;
        }

        progressBar.setVisibility(View.VISIBLE);
        db.collection("orders")
                .whereEqualTo("customerId", user.getUid())
                .whereEqualTo("status", "delivered")
                .orderBy("createdAt", Query.Direction.DESCENDING)
                .limit(20)
                .get()
                .addOnSuccessListener(queryDocumentSnapshots -> {
                    progressBar.setVisibility(View.GONE);
                    pastOrders.clear();
                    for (QueryDocumentSnapshot doc : queryDocumentSnapshots) {
                        Order o = doc.toObject(Order.class);
                        o.setId(doc.getId());
                        pastOrders.add(o);
                    }
                    orderAdapter.notifyDataSetChanged();
                    layoutEmpty.setVisibility(pastOrders.isEmpty() ? View.VISIBLE : View.GONE);
                })
                .addOnFailureListener(e -> {
                    progressBar.setVisibility(View.GONE);
                    showToast("Failed to load past orders: " + e.getMessage());
                });
    }
}
