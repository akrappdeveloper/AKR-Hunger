package com.ssr.hunger.activities;

import android.content.Intent;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.View;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import androidx.recyclerview.widget.GridLayoutManager;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import com.ssr.hunger.R;
import com.ssr.hunger.adapters.CategoryAdapter;
import com.ssr.hunger.adapters.MenuItemAdapter;
import com.ssr.hunger.models.CartItem;
import com.ssr.hunger.models.Category;
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
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Restaurant Detail Activity - mirrors the web app's restaurant/[id] page.
 * Shows restaurant info, in-menu search, veg/non-veg filter pills,
 * category tabs, menu items grid, and floating View Cart bottom bar.
 */
public class RestaurantDetailActivity extends BaseActivity {

    private FirebaseFirestore db;
    private MenuItemAdapter menuAdapter;
    private CategoryAdapter categoryAdapter;
    private String restaurantId;
    private String restaurantName = "Restaurant";
    private Trace menuLoadTrace;

    private final List<MenuItem> allMenuItems = new ArrayList<>();
    private String currentCategory = "all";
    private String currentVegFilter = "all"; // "all", "veg", "non-veg"
    private String searchQuery = "";

    private EditText etSearch;
    private ImageView btnClearSearch;
    private TextView btnFilterAll, btnFilterVeg, btnFilterNonVeg;
    private TextView tvMenuCount, tvMenuSectionTitle;
    private View layoutEmptyMenu;
    private View barViewCart;
    private TextView tvCartCount, tvCartTotal;
    private ProgressBar pbLoading;

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

        initViews();
        setupMenu();
        setupFilters();

        menuLoadTrace = startTrace(PerformanceHelper.TRACE_RESTAURANT_MENU_LOAD);
        if (menuLoadTrace != null) {
            performanceHelper.putAttribute(menuLoadTrace, "restaurant_id", restaurantId);
        }

        loadRestaurant();
    }

    @Override
    protected void onResume() {
        super.onResume();
        updateBottomCartBar();
    }

    private void initViews() {
        findViewById(R.id.btn_back).setOnClickListener(v -> finish());
        etSearch = findViewById(R.id.et_restaurant_search);
        btnClearSearch = findViewById(R.id.btn_clear_search);
        btnFilterAll = findViewById(R.id.btn_filter_all);
        btnFilterVeg = findViewById(R.id.btn_filter_veg);
        btnFilterNonVeg = findViewById(R.id.btn_filter_nonveg);
        tvMenuCount = findViewById(R.id.tv_menu_count);
        tvMenuSectionTitle = findViewById(R.id.tv_menu_section_title);
        layoutEmptyMenu = findViewById(R.id.layout_empty_menu);
        barViewCart = findViewById(R.id.bar_view_cart);
        tvCartCount = findViewById(R.id.tv_cart_bar_count);
        tvCartTotal = findViewById(R.id.tv_cart_bar_total);
        pbLoading = findViewById(R.id.pb_menu_loading);

        if (barViewCart != null) {
            barViewCart.setOnClickListener(v -> {
                startActivity(new Intent(this, CartActivity.class));
            });
        }
    }

    private void setupMenu() {
        RecyclerView rvMenu = findViewById(R.id.rv_menu);
        menuAdapter = new MenuItemAdapter(new ArrayList<>(),
                item -> {
                    analyticsHelper.logSelectContent("menu_item", item.getId(), item.getName());
                    logBreadcrumb("Selected item: " + item.getName());
                    Intent intent = new Intent(this, ProductDetailActivity.class);
                    intent.putExtra(Constants.EXTRA_PRODUCT_ID, item.getId());
                    intent.putExtra(Constants.EXTRA_RESTAURANT_ID, restaurantId);
                    startActivity(intent);
                },
                item -> {
                    CartItem cartItem = new CartItem(item.getId(), item.getRestaurantId(), item.getName(),
                            item.getPrice(), 1, item.getImage(),
                            item.getRestaurantName() != null ? item.getRestaurantName() : restaurantName);
                    CartManager.getInstance(this).addItem(cartItem);

                    analyticsHelper.logAddToCart(cartItem);
                    logBreadcrumb("Added to cart from restaurant view: " + item.getName());

                    Toast.makeText(this, item.getName() + " added to cart! 🛒", Toast.LENGTH_SHORT).show();
                    updateBottomCartBar();
                }
        );
        rvMenu.setLayoutManager(new GridLayoutManager(this, 2));
        rvMenu.setAdapter(menuAdapter);

        // Setup horizontal categories
        RecyclerView rvCats = findViewById(R.id.rv_restaurant_categories);
        categoryAdapter = new CategoryAdapter(new ArrayList<>(), cat -> {
            currentCategory = "All".equalsIgnoreCase(cat.getName()) ? "all" : cat.getName();
            categoryAdapter.setSelected(cat.getId());
            filterAndDisplayItems();
        });
        rvCats.setLayoutManager(new LinearLayoutManager(this, LinearLayoutManager.HORIZONTAL, false));
        rvCats.setAdapter(categoryAdapter);
    }

    private void setupFilters() {
        // Search filter listener
        if (etSearch != null) {
            etSearch.addTextChangedListener(new TextWatcher() {
                @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
                @Override public void onTextChanged(CharSequence s, int start, int before, int count) {
                    searchQuery = s.toString().trim().toLowerCase();
                    if (btnClearSearch != null) {
                        btnClearSearch.setVisibility(searchQuery.isEmpty() ? View.GONE : View.VISIBLE);
                    }
                    filterAndDisplayItems();
                }
                @Override public void afterTextChanged(Editable s) {}
            });

            if (btnClearSearch != null) {
                btnClearSearch.setOnClickListener(v -> etSearch.setText(""));
            }
        }

        // Veg / Non-Veg toggle filters
        btnFilterAll.setOnClickListener(v -> updateVegFilter("all"));
        btnFilterVeg.setOnClickListener(v -> updateVegFilter("veg"));
        btnFilterNonVeg.setOnClickListener(v -> updateVegFilter("non-veg"));
    }

    private void updateVegFilter(String filter) {
        currentVegFilter = filter;

        btnFilterAll.setBackgroundResource("all".equals(filter) ? R.drawable.bg_pill_primary : R.drawable.bg_pill_soft);
        btnFilterAll.setTextColor(getColor("all".equals(filter) ? R.color.on_primary : R.color.text_primary));

        btnFilterVeg.setBackgroundResource("veg".equals(filter) ? R.drawable.bg_pill_primary : R.drawable.bg_pill_soft);
        btnFilterVeg.setTextColor(getColor("veg".equals(filter) ? R.color.on_primary : R.color.veg_green));

        btnFilterNonVeg.setBackgroundResource("non-veg".equals(filter) ? R.drawable.bg_pill_primary : R.drawable.bg_pill_soft);
        btnFilterNonVeg.setTextColor(getColor("non-veg".equals(filter) ? R.color.on_primary : R.color.non_veg_red));

        filterAndDisplayItems();
    }

    private void updateBottomCartBar() {
        if (barViewCart == null) return;

        CartManager cm = CartManager.getInstance(this);
        int totalItems = cm.getTotalItemCount();
        double subtotal = cm.getSubtotal();

        if (totalItems > 0) {
            barViewCart.setVisibility(View.VISIBLE);
            tvCartCount.setText(totalItems + (totalItems == 1 ? " ITEM IN CART" : " ITEMS IN CART"));
            tvCartTotal.setText(String.format(Locale.getDefault(), "₹%.0f", subtotal));
        } else {
            barViewCart.setVisibility(View.GONE);
        }
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
        if (restaurant.getImage() != null && !restaurant.getImage().isEmpty()) {
            Glide.with(this).load(restaurant.getImage()).into(ivImage);
        }
    }

    /**
     * Loads menu items for this restaurant by querying root 'menuItems' collection
     * AND fallback to subcollection 'restaurants/{id}/menuItems' if needed.
     */
    private void loadMenuItems(String rName) {
        if (pbLoading != null) pbLoading.setVisibility(View.VISIBLE);

        Map<String, MenuItem> itemsMap = new LinkedHashMap<>();

        // 1. Fetch from Root collection
        db.collection(Constants.COLLECTION_MENU_ITEMS)
                .whereEqualTo("restaurantId", restaurantId)
                .get()
                .addOnSuccessListener(querySnapshot -> {
                    for (DocumentSnapshot doc : querySnapshot.getDocuments()) {
                        MenuItem item = MenuItem.fromSnapshot(doc);
                        if (item != null) {
                            item.setRestaurantName(rName);
                            if (item.isVisibleToCustomers()) {
                                itemsMap.put(item.getId(), item);
                            }
                        }
                    }

                    // 2. Also check subcollection to be 100% comprehensive
                    fetchSubcollectionItems(rName, itemsMap);
                })
                .addOnFailureListener(e -> {
                    // Try subcollection on error
                    fetchSubcollectionItems(rName, itemsMap);
                });
    }

    private void fetchSubcollectionItems(String rName, Map<String, MenuItem> itemsMap) {
        db.collection(Constants.COLLECTION_RESTAURANTS).document(restaurantId)
                .collection(Constants.COLLECTION_MENU_ITEMS)
                .get()
                .addOnSuccessListener(subSnap -> {
                    if (pbLoading != null) pbLoading.setVisibility(View.GONE);

                    for (DocumentSnapshot doc : subSnap.getDocuments()) {
                        MenuItem item = MenuItem.fromSnapshot(doc);
                        if (item != null) {
                            item.setRestaurantId(restaurantId);
                            item.setRestaurantName(rName);
                            if (item.isVisibleToCustomers() && !itemsMap.containsKey(item.getId())) {
                                itemsMap.put(item.getId(), item);
                            }
                        }
                    }

                    // If items are still empty, allow all items without strict visibility filtering
                    if (itemsMap.isEmpty()) {
                        for (DocumentSnapshot doc : subSnap.getDocuments()) {
                            MenuItem item = MenuItem.fromSnapshot(doc);
                            if (item != null) {
                                item.setRestaurantId(restaurantId);
                                item.setRestaurantName(rName);
                                itemsMap.put(item.getId(), item);
                            }
                        }
                    }

                    allMenuItems.clear();
                    allMenuItems.addAll(itemsMap.values());

                    setupCategoryChips();
                    filterAndDisplayItems();

                    if (menuLoadTrace != null) {
                        performanceHelper.putMetric(menuLoadTrace, "item_count", allMenuItems.size());
                        stopTrace(menuLoadTrace);
                    }
                })
                .addOnFailureListener(e -> {
                    if (pbLoading != null) pbLoading.setVisibility(View.GONE);

                    allMenuItems.clear();
                    allMenuItems.addAll(itemsMap.values());

                    setupCategoryChips();
                    filterAndDisplayItems();

                    if (menuLoadTrace != null) {
                        stopTrace(menuLoadTrace);
                    }
                });
    }

    private void setupCategoryChips() {
        Set<String> uniqueCategories = new HashSet<>();
        for (MenuItem item : allMenuItems) {
            if (item.getCategory() != null && !item.getCategory().isEmpty()) {
                uniqueCategories.add(item.getCategory());
            }
        }

        List<Category> categories = new ArrayList<>();
        categories.add(new Category("all", "All", "🍽️", R.color.primary));
        int idCount = 1;
        for (String cat : uniqueCategories) {
            categories.add(new Category(String.valueOf(idCount++), cat, "🍲", R.color.primary));
        }

        categoryAdapter.updateData(categories);
        categoryAdapter.setSelected("all");
    }

    private void filterAndDisplayItems() {
        List<MenuItem> filtered = new ArrayList<>();

        for (MenuItem item : allMenuItems) {
            // Veg / Non-Veg filter
            if ("veg".equals(currentVegFilter) && !item.isVegetarian()) {
                continue;
            }
            if ("non-veg".equals(currentVegFilter) && item.isVegetarian()) {
                continue;
            }

            // Category filter
            if (!"all".equals(currentCategory)) {
                String cat = item.getCategory() != null ? item.getCategory().toLowerCase() : "";
                if (!cat.equalsIgnoreCase(currentCategory)) {
                    continue;
                }
            }

            // Search query filter
            if (!searchQuery.isEmpty()) {
                String name = item.getName() != null ? item.getName().toLowerCase() : "";
                String desc = item.getDescription() != null ? item.getDescription().toLowerCase() : "";
                String cat = item.getCategory() != null ? item.getCategory().toLowerCase() : "";
                if (!name.contains(searchQuery) && !desc.contains(searchQuery) && !cat.contains(searchQuery)) {
                    continue;
                }
            }

            filtered.add(item);
        }

        menuAdapter.updateData(filtered);

        if (tvMenuCount != null) {
            tvMenuCount.setText(filtered.size() + (filtered.size() == 1 ? " dish" : " dishes"));
        }

        if (tvMenuSectionTitle != null) {
            if (!"all".equals(currentCategory)) {
                tvMenuSectionTitle.setText(currentCategory);
            } else if (!searchQuery.isEmpty()) {
                tvMenuSectionTitle.setText("Search Results");
            } else {
                tvMenuSectionTitle.setText(R.string.menu);
            }
        }

        if (layoutEmptyMenu != null) {
            layoutEmptyMenu.setVisibility(filtered.isEmpty() ? View.VISIBLE : View.GONE);
        }
    }
}
