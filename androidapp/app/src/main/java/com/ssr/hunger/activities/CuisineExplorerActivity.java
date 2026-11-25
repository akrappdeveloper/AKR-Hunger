package com.ssr.hunger.activities;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.ImageButton;
import android.widget.ProgressBar;
import android.widget.TextView;
import androidx.recyclerview.widget.GridLayoutManager;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.QueryDocumentSnapshot;
import com.ssr.hunger.R;
import com.ssr.hunger.adapters.FeaturedRestaurantAdapter;
import com.ssr.hunger.models.Restaurant;
import java.util.ArrayList;
import java.util.List;

public class CuisineExplorerActivity extends BaseActivity {

    private ImageButton btnBack;
    private TextView tvTitle;
    private RecyclerView rvRestaurants;
    private ProgressBar progressBar;
    private View layoutEmpty;
    private FirebaseFirestore db;
    private List<Restaurant> restaurantList = new ArrayList<>();
    private FeaturedRestaurantAdapter restaurantAdapter;
    private String selectedCuisine = "All";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_cuisine_explorer);

        db = FirebaseFirestore.getInstance();
        btnBack = findViewById(R.id.btnBack);
        tvTitle = findViewById(R.id.tvTitle);
        rvRestaurants = findViewById(R.id.rvRestaurants);
        progressBar = findViewById(R.id.progressBar);
        layoutEmpty = findViewById(R.id.layoutEmpty);

        selectedCuisine = getIntent().getStringExtra("cuisine");
        if (selectedCuisine == null || selectedCuisine.isEmpty()) {
            selectedCuisine = "Cuisine Explorer";
        }
        tvTitle.setText(selectedCuisine);

        btnBack.setOnClickListener(v -> finish());

        rvRestaurants.setLayoutManager(new LinearLayoutManager(this));
        restaurantAdapter = new FeaturedRestaurantAdapter(restaurantList, restaurant -> {
            Intent intent = new Intent(this, RestaurantDetailActivity.class);
            intent.putExtra("restaurantId", restaurant.getId());
            startActivity(intent);
        });
        rvRestaurants.setAdapter(restaurantAdapter);

        loadRestaurants();
    }

    private void loadRestaurants() {
        progressBar.setVisibility(View.VISIBLE);
        db.collection("restaurants")
                .whereEqualTo("isActive", true)
                .limit(40)
                .get()
                .addOnSuccessListener(queryDocumentSnapshots -> {
                    progressBar.setVisibility(View.GONE);
                    restaurantList.clear();
                    for (QueryDocumentSnapshot doc : queryDocumentSnapshots) {
                        Restaurant r = doc.toObject(Restaurant.class);
                        r.setId(doc.getId());
                        if ("Cuisine Explorer".equals(selectedCuisine) || "All".equalsIgnoreCase(selectedCuisine)) {
                            restaurantList.add(r);
                        } else {
                            if (r.getCuisineType() != null) {
                                for (String c : r.getCuisineType()) {
                                    if (c.toLowerCase().contains(selectedCuisine.toLowerCase())) {
                                        restaurantList.add(r);
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    restaurantAdapter.notifyDataSetChanged();
                    layoutEmpty.setVisibility(restaurantList.isEmpty() ? View.VISIBLE : View.GONE);
                })
                .addOnFailureListener(e -> {
                    progressBar.setVisibility(View.GONE);
                    showToast("Failed to load restaurants: " + e.getMessage());
                });
    }
}
