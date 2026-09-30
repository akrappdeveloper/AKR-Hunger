package com.ssr.hunger.activities;

import android.content.Intent;
import android.os.Bundle;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;
import androidx.recyclerview.widget.GridLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import com.ssr.hunger.R;
import com.ssr.hunger.adapters.MenuItemAdapter;
import com.ssr.hunger.models.CartItem;
import com.ssr.hunger.models.MenuItem;
import com.ssr.hunger.models.Restaurant;
import com.ssr.hunger.utils.CartManager;
import com.ssr.hunger.utils.Constants;
import com.ssr.hunger.utils.PerformanceHelper;
import com.bumptech.glide.Glide;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.perf.metrics.Trace;
import java.util.ArrayList;
import java.util.List;

/**
 * Restaurant Detail Activity - mirrors the web app's restaurant/[id] page.
 * Shows restaurant info, menu items, and allows adding to cart.
 * Extends BaseActivity for Realtime Analytics, Performance profiling, and Crashlytics.
 */
public class RestaurantDetailActivity extends BaseActivity {

    private FirebaseFirestore db;
    private MenuItemAdapter menuAdapter;
    private String restaurantId;
    private String restaurantName = "Restaurant";
    private Trace menuLoadTrace;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_restaurant_detail);

        db = FirebaseFirestore.getInstance();
        restaurantId = getIntent().getStringExtra(Constants.EXTRA_RESTAURANT_ID);
        if (restaurantId == null) {
            recordException("RestaurantDetailActivity_null_id", new IllegalArgumentException("Restaurant ID is null"));
            finish();
            return;
        }

        findViewById(R.id.btn_back).setOnClickListener(v -> finish());
        setupMenu();

        menuLoadTrace = startTrace(PerformanceHelper.TRACE_RESTAURANT_MENU_LOAD);
        if (menuLoadTrace != null) {
            performanceHelper.putAttribute(menuLoadTrace, "restaurant_id", restaurantId);
        }

        loadRestaurant();
    }

    private void setupMenu() {
        RecyclerView rvMenu = findViewById(R.id.rv_menu);
        menuAdapter = new MenuItemAdapter(new ArrayList<>(),
                item -> {
                    analyticsHelper.logSelectContent("menu_item", item.getId(), item.getName());
                    logBreadcrumb("Selected item: " + item.getName());
                    Intent intent = new Intent(this, ProductDetailActivity.class);
                    intent.putExtra(Constants.EXTRA_PRODUCT_ID, item.getId());
                    startActivity(intent);
                },
                item -> {
                    CartItem cartItem = new CartItem(item.getId(), item.getRestaurantId(), item.getName(),
                            item.getPrice(), 1, item.getImage(),
                            item.getRestaurantName() != null ? item.getRestaurantName() : restaurantName);
                    CartManager.getInstance(this).addItem(cartItem);

                    // Firebase Analytics - add to cart
                    analyticsHelper.logAddToCart(cartItem);
                    logBreadcrumb("Added to cart from restaurant view: " + item.getName());

                    Toast.makeText(this, item.getName() + " added to cart", Toast.LENGTH_SHORT).show();
                }
        );
        rvMenu.setLayoutManager(new GridLayoutManager(this, 2));
        rvMenu.setAdapter(menuAdapter);
    }

    private void loadRestaurant() {
        logBreadcrumb("Loading restaurant: " + restaurantId);
        db.collection(Constants.COLLECTION_RESTAURANTS).document(restaurantId)
                .get()
                .addOnSuccessListener(doc -> {
                    Restaurant restaurant = doc.toObject(Restaurant.class);
                    if (restaurant == null) {
                        stopTrace(menuLoadTrace);
                        finish();
                        return;
                    }
                    restaurant.setId(doc.getId());
                    restaurantName = restaurant.getName();
                    crashlyticsHelper.setCustomKey("viewing_restaurant", restaurantName);
                    analyticsHelper.logSelectContent("restaurant", restaurantId, restaurantName);

                    populateHeader(restaurant);
                    loadMenuItems(restaurant.getName());
                })
                .addOnFailureListener(e -> {
                    stopTrace(menuLoadTrace);
                    recordException("loadRestaurant_failed", e);
                });
    }

    private void populateHeader(Restaurant restaurant) {
        ((TextView) findViewById(R.id.tv_restaurant_name)).setText(restaurant.getName());
        ((TextView) findViewById(R.id.tv_restaurant_cuisine)).setText(restaurant.getCuisineString());
        ((TextView) findViewById(R.id.tv_restaurant_rating)).setText(restaurant.getDisplayRating());

        if (restaurant.getDescription() != null) {
            ((TextView) findViewById(R.id.tv_restaurant_desc)).setText(restaurant.getDescription());
        }

        ImageView ivImage = findViewById(R.id.iv_restaurant_image);
        if (restaurant.getImage() != null) {
            Glide.with(this).load(restaurant.getImage()).into(ivImage);
        }
    }

    private void loadMenuItems(String rName) {
        db.collection(Constants.COLLECTION_MENU_ITEMS)
                .whereEqualTo("restaurantId", restaurantId)
                .get()
                .addOnSuccessListener(querySnapshot -> {
                    List<MenuItem> items = new ArrayList<>();
                    for (DocumentSnapshot doc : querySnapshot.getDocuments()) {
                        MenuItem item = doc.toObject(MenuItem.class);
                        if (item != null) {
                            item.setId(doc.getId());
                            item.setRestaurantName(rName);
                            if (item.isVisibleToCustomers()) {
                                items.add(item);
                            }
                        }
                    }
                    menuAdapter.updateData(items);

                    if (menuLoadTrace != null) {
                        performanceHelper.putMetric(menuLoadTrace, "item_count", items.size());
                        stopTrace(menuLoadTrace);
                    }

                    analyticsHelper.logViewItemList(rName + " Menu", items.size());
                    logBreadcrumb("Loaded " + items.size() + " menu items for " + rName);
                })
                .addOnFailureListener(e -> {
                    stopTrace(menuLoadTrace);
                    recordException("loadMenuItems_failed", e);
                });
    }

    @Override
    protected String getScreenName() {
        return "RestaurantDetail_" + (restaurantName != null ? restaurantName : restaurantId);
    }
}
