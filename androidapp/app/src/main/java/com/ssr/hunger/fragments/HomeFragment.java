package com.ssr.hunger.fragments;

import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.GridLayoutManager;
import androidx.recyclerview.widget.LinearLayoutManager;
import com.ssr.hunger.R;
import com.ssr.hunger.activities.CartActivity;
import com.ssr.hunger.activities.NotificationsActivity;
import com.ssr.hunger.activities.ProductDetailActivity;
import com.ssr.hunger.activities.RestaurantDetailActivity;
import com.ssr.hunger.activities.SearchActivity;
import com.ssr.hunger.adapters.CategoryAdapter;
import com.ssr.hunger.adapters.FeaturedRestaurantAdapter;
import com.ssr.hunger.adapters.MenuItemAdapter;
import com.ssr.hunger.models.CartItem;
import com.ssr.hunger.models.Category;
import com.ssr.hunger.models.MenuItem;
import com.ssr.hunger.models.Restaurant;
import com.ssr.hunger.utils.CartManager;
import com.ssr.hunger.utils.Constants;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import com.google.firebase.firestore.QuerySnapshot;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Home Fragment - mirrors the customer homepage from the web app.
 * Shows categories, hero banner, featured restaurants, and popular menu items.
 * Fetches from same Firestore collections: restaurants, menuItems.
 */
public class HomeFragment extends Fragment {

    private View rootView;
    private CategoryAdapter categoryAdapter;
    private FeaturedRestaurantAdapter restaurantAdapter;
    private MenuItemAdapter menuItemAdapter;

    private FirebaseFirestore db;
    private ListenerRegistration menuListener;

    private List<MenuItem> allMenuItems = new ArrayList<>();
    private List<Restaurant> allRestaurants = new ArrayList<>();
    private Map<String, String> restaurantNameMap = new HashMap<>();
    private String selectedCategory = "all";

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        rootView = inflater.inflate(R.layout.fragment_home, container, false);
        db = FirebaseFirestore.getInstance();

        setupCategories();
        setupRecyclerViews();
        setupClickListeners();
        loadData();
        updateLocationDisplay();

        return rootView;
    }

    @Override
    public void onResume() {
        super.onResume();
        updateLocationDisplay();
        updateNotificationBadge();
    }

    private void updateNotificationBadge() {
        if (rootView == null) return;
        View badge = rootView.findViewById(R.id.home_unread_badge);
        if (badge == null) return;

        com.google.firebase.auth.FirebaseUser user = com.google.firebase.auth.FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) {
            badge.setVisibility(View.GONE);
            return;
        }

        db.collection(Constants.COLLECTION_NOTIFICATIONS)
                .whereEqualTo("userId", user.getUid())
                .limit(20)
                .get()
                .addOnSuccessListener(snap -> {
                    boolean hasUnread = false;
                    for (DocumentSnapshot doc : snap.getDocuments()) {
                        Boolean readObj = doc.getBoolean("read");
                        if (readObj == null) readObj = doc.getBoolean("isRead");
                        if (readObj == null || !readObj) {
                            hasUnread = true;
                            break;
                        }
                    }
                    if (isAdded()) {
                        badge.setVisibility(hasUnread ? View.VISIBLE : View.GONE);
                    }
                })
                .addOnFailureListener(e -> {
                    if (isAdded()) badge.setVisibility(View.GONE);
                });
    }

    public void updateLocationDisplay() {
        if (rootView == null || getContext() == null) return;
        TextView tvLocation = rootView.findViewById(R.id.tv_location);
        if (tvLocation != null) {
            com.ssr.hunger.models.Address addr = com.ssr.hunger.utils.CartManager.getInstance(getContext()).getDeliveryAddress();
            if (addr != null && addr.getCity() != null && !addr.getCity().isEmpty()) {
                String label = addr.getCity();
                if (addr.getState() != null && !addr.getState().isEmpty() && !label.contains(addr.getState())) {
                    label += ", " + addr.getState();
                }
                tvLocation.setText(label);
            } else {
                tvLocation.setText("Select Location");
            }
        }
    }

    private void setupCategories() {
        List<Category> categories = new ArrayList<>();
        categories.add(new Category("all", "All", "🍽️", R.color.primary));
        for (String[] cat : Constants.FOOD_CATEGORIES) {
            categories.add(new Category(cat[0], cat[1], cat[2], R.color.primary));
        }

        categoryAdapter = new CategoryAdapter(categories, category -> {
            selectedCategory = category.getName().equals("All") ? "all" : category.getName();
            categoryAdapter.setSelected(category.getId());
            filterItems();
        });
    }

    private void setupRecyclerViews() {
        // Categories - horizontal
        rootView.findViewById(R.id.rv_categories).setVisibility(View.VISIBLE);
        ((androidx.recyclerview.widget.RecyclerView) rootView.findViewById(R.id.rv_categories))
                .setLayoutManager(new LinearLayoutManager(getContext(), LinearLayoutManager.HORIZONTAL, false));
        ((androidx.recyclerview.widget.RecyclerView) rootView.findViewById(R.id.rv_categories))
                .setAdapter(categoryAdapter);

        // Featured restaurants - horizontal
        restaurantAdapter = new FeaturedRestaurantAdapter(new ArrayList<>(), restaurant -> {
            Intent intent = new Intent(getContext(), RestaurantDetailActivity.class);
            intent.putExtra(Constants.EXTRA_RESTAURANT_ID, restaurant.getId());
            startActivity(intent);
        });
        ((androidx.recyclerview.widget.RecyclerView) rootView.findViewById(R.id.rv_featured_restaurants))
                .setLayoutManager(new LinearLayoutManager(getContext(), LinearLayoutManager.HORIZONTAL, false));
        ((androidx.recyclerview.widget.RecyclerView) rootView.findViewById(R.id.rv_featured_restaurants))
                .setAdapter(restaurantAdapter);

        // Menu items - grid (2 columns)
        menuItemAdapter = new MenuItemAdapter(new ArrayList<>(),
                item -> {
                    Intent intent = new Intent(getContext(), ProductDetailActivity.class);
                    intent.putExtra(Constants.EXTRA_PRODUCT_ID, item.getId());
                    startActivity(intent);
                },
                item -> {
                    // Quick add to cart
                    CartManager.getInstance(requireContext()).addItem(
                            new CartItem(item.getId(), item.getRestaurantId(), item.getName(),
                                    item.getPrice(), 1, item.getImage(),
                                    item.getRestaurantName() != null ? item.getRestaurantName() : "")
                    );
                    android.widget.Toast.makeText(getContext(), item.getName() + " added to cart", android.widget.Toast.LENGTH_SHORT).show();
                }
        );

        int spanCount = getResources().getConfiguration().screenWidthDp >= 600 ? 3 : 2;
        ((androidx.recyclerview.widget.RecyclerView) rootView.findViewById(R.id.rv_menu_items))
                .setLayoutManager(new GridLayoutManager(getContext(), spanCount));
        ((androidx.recyclerview.widget.RecyclerView) rootView.findViewById(R.id.rv_menu_items))
                .setAdapter(menuItemAdapter);
    }

    private void setupClickListeners() {
        // Search bar click -> open search activity
        rootView.findViewById(R.id.search_bar).setOnClickListener(v -> {
            startActivity(new Intent(getContext(), SearchActivity.class));
        });

        // Cart button
        rootView.findViewById(R.id.btn_cart).setOnClickListener(v -> {
            startActivity(new Intent(getContext(), CartActivity.class));
        });

        // Notifications button
        View btnNotifications = rootView.findViewById(R.id.btn_notifications);
        if (btnNotifications != null) {
            btnNotifications.setOnClickListener(v -> {
                startActivity(new Intent(getContext(), NotificationsActivity.class));
            });
        }

        // Location picker (mirrors web's CustomerNavbar location button)
        View locationContainer = rootView.findViewById(R.id.location_container);
        if (locationContainer != null) {
            locationContainer.setOnClickListener(v -> {
                if (getActivity() instanceof com.ssr.hunger.activities.MainActivity) {
                    ((com.ssr.hunger.activities.MainActivity) getActivity()).showLocationDialog();
                }
            });
        }

        // Clear filters
        View clearFilters = rootView.findViewById(R.id.btn_clear_filters);
        if (clearFilters != null) {
            clearFilters.setOnClickListener(v -> {
                selectedCategory = "all";
                categoryAdapter.setSelected("all");
                filterItems();
            });
        }
    }

    private void loadData() {
        // Show shimmer
        rootView.findViewById(R.id.shimmer_layout).setVisibility(View.VISIBLE);

        // 1. Load restaurants
        db.collection(Constants.COLLECTION_RESTAURANTS).get()
                .addOnSuccessListener(querySnapshot -> {
                    allRestaurants.clear();
                    restaurantNameMap.clear();
                    for (DocumentSnapshot doc : querySnapshot.getDocuments()) {
                        Restaurant r = doc.toObject(Restaurant.class);
                        if (r != null) {
                            r.setId(doc.getId());
                            allRestaurants.add(r);
                            restaurantNameMap.put(doc.getId(), r.getName());
                        }
                    }
                    restaurantAdapter.updateData(allRestaurants.subList(0, Math.min(5, allRestaurants.size())));

                    // 2. Listen to menu items
                    listenToMenuItems();
                })
                .addOnFailureListener(e -> {
                    rootView.findViewById(R.id.shimmer_layout).setVisibility(View.GONE);
                });
    }

    private void listenToMenuItems() {
        menuListener = db.collection(Constants.COLLECTION_MENU_ITEMS)
                .addSnapshotListener((querySnapshot, error) -> {
                    if (error != null || querySnapshot == null) return;

                    allMenuItems.clear();
                    for (DocumentSnapshot doc : querySnapshot.getDocuments()) {
                        MenuItem item = doc.toObject(MenuItem.class);
                        if (item != null) {
                            item.setId(doc.getId());
                            String restName = restaurantNameMap.get(item.getRestaurantId());
                            item.setRestaurantName(restName != null ? restName : "Unknown Restaurant");
                            allMenuItems.add(item);
                        }
                    }

                    rootView.findViewById(R.id.shimmer_layout).setVisibility(View.GONE);
                    filterItems();
                });
    }

    private void filterItems() {
        List<MenuItem> filtered = new ArrayList<>();
        for (MenuItem item : allMenuItems) {
            if (!item.isVisibleToCustomers()) continue;

            if ("all".equals(selectedCategory)) {
                filtered.add(item);
            } else {
                String cat = item.getCategory() != null ? item.getCategory().toLowerCase() : "";
                String name = item.getName() != null ? item.getName().toLowerCase() : "";
                String filter = selectedCategory.toLowerCase();

                if (cat.contains(filter) || name.contains(filter)) {
                    filtered.add(item);
                }
            }
        }

        menuItemAdapter.updateData(filtered);

        // Show/hide empty state
        View emptyState = rootView.findViewById(R.id.empty_state);
        if (emptyState != null) {
            emptyState.setVisibility(filtered.isEmpty() ? View.VISIBLE : View.GONE);
        }

        // Update section title
        android.widget.TextView titleView = rootView.findViewById(R.id.tv_items_title);
        if (titleView != null) {
            if (!"all".equals(selectedCategory)) {
                titleView.setText(selectedCategory + " Items");
            } else {
                titleView.setText(R.string.popular_near);
            }
        }
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        if (menuListener != null) {
            menuListener.remove();
        }
    }
}
