package com.ssr.hunger.fragments;

import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import android.widget.Toast;
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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Home Fragment - mirrors the customer homepage from the web app.
 * Shows location bar, categories, hero banner, featured restaurants,
 * and ALL menu items in Popular Near You with comprehensive product details.
 */
public class HomeFragment extends Fragment {

    private View rootView;
    private CategoryAdapter categoryAdapter;
    private FeaturedRestaurantAdapter restaurantAdapter;
    private MenuItemAdapter menuItemAdapter;

    private FirebaseFirestore db;
    private ListenerRegistration menuListener;
    private ListenerRegistration restaurantListener;

    private final List<MenuItem> allMenuItems = new ArrayList<>();
    private final List<Restaurant> allRestaurants = new ArrayList<>();
    private final Map<String, String> restaurantNameMap = new HashMap<>();
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
            com.ssr.hunger.models.Address addr = CartManager.getInstance(getContext()).getDeliveryAddress();
            if (addr != null && ((addr.getCity() != null && !addr.getCity().isEmpty()) || (addr.getStreet() != null && !addr.getStreet().isEmpty()))) {
                StringBuilder label = new StringBuilder();
                if (addr.getLandmark() != null && !addr.getLandmark().isEmpty()) {
                    label.append(addr.getLandmark()).append(", ");
                } else if (addr.getStreet() != null && !addr.getStreet().isEmpty()) {
                    label.append(addr.getStreet()).append(", ");
                }
                if (addr.getCity() != null && !addr.getCity().isEmpty()) {
                    label.append(addr.getCity());
                }
                if (addr.getPincode() != null && !addr.getPincode().isEmpty()) {
                    label.append(" - ").append(addr.getPincode());
                }
                tvLocation.setText(label.toString());
            } else {
                // Try to load saved address from Firestore
                com.google.firebase.auth.FirebaseUser user = com.google.firebase.auth.FirebaseAuth.getInstance().getCurrentUser();
                if (user != null) {
                    db.collection(Constants.COLLECTION_CUSTOMERS).document(user.getUid()).get()
                            .addOnSuccessListener(snap -> {
                                if (snap != null && snap.exists() && isAdded()) {
                                    Map<String, Object> currentAddr = (Map<String, Object>) snap.get("currentAddress");
                                    if (currentAddr != null) {
                                        com.ssr.hunger.models.Address a = new com.ssr.hunger.models.Address();
                                        a.setCity((String) currentAddr.get("city"));
                                        a.setStreet((String) currentAddr.get("street"));
                                        a.setLandmark((String) currentAddr.get("landmark"));
                                        a.setState((String) currentAddr.get("state"));
                                        a.setPincode((String) currentAddr.get("pincode"));
                                        if (getContext() != null) {
                                            CartManager.getInstance(getContext()).setDeliveryAddress(a);
                                            updateLocationDisplay();
                                        }
                                    }
                                }
                            });
                }
                tvLocation.setText("Select Delivery Location");
            }
        }

        // Live filter restaurants & menu dishes based on selected location/pincode
        if (!allRestaurants.isEmpty()) {
            filterRestaurants();
            filterItems();
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

        // Menu items - grid (2 columns or 3 on tablets)
        menuItemAdapter = new MenuItemAdapter(new ArrayList<>(),
                item -> {
                    Intent intent = new Intent(getContext(), ProductDetailActivity.class);
                    intent.putExtra(Constants.EXTRA_PRODUCT_ID, item.getId());
                    intent.putExtra(Constants.EXTRA_RESTAURANT_ID, item.getRestaurantId());
                    startActivity(intent);
                },
                item -> {
                    // Check if restaurant is operating right now
                    Restaurant parentRest = null;
                    if (item.getRestaurantId() != null) {
                        for (Restaurant r : allRestaurants) {
                            if (item.getRestaurantId().equals(r.getId())) {
                                parentRest = r;
                                break;
                            }
                        }
                    }
                    if (parentRest != null && !parentRest.isOperatingNow()) {
                        Toast.makeText(getContext(),
                                "🔴 " + (parentRest.getName() != null ? parentRest.getName() : "Restaurant") + " is currently closed. Click dish to view & add to wishlist ❤️",
                                Toast.LENGTH_LONG).show();
                        return;
                    }

                    // Quick add to cart
                    CartManager.getInstance(requireContext()).addItem(
                            new CartItem(item.getId(), item.getRestaurantId(), item.getName(),
                                    item.getPrice(), 1, item.getImage(),
                                    item.getRestaurantName() != null ? item.getRestaurantName() : "AKR Hunger")
                    );
                    Toast.makeText(getContext(), item.getName() + " added to cart! 🛒", Toast.LENGTH_SHORT).show();
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

        View btnHomeVoiceSearch = rootView.findViewById(R.id.btn_home_voice_search);
        if (btnHomeVoiceSearch != null) {
            btnHomeVoiceSearch.setOnClickListener(v -> {
                Intent voiceIntent = new Intent(getContext(), SearchActivity.class);
                voiceIntent.putExtra(Constants.EXTRA_START_VOICE_SEARCH, true);
                startActivity(voiceIntent);
            });
        }

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

        // Location picker
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
        loadRestaurants();

        // 2. Listen to menu items immediately
        listenToMenuItems();
    }

    private void loadRestaurants() {
        if (restaurantListener != null) {
            restaurantListener.remove();
        }
        restaurantListener = db.collection(Constants.COLLECTION_RESTAURANTS)
                .addSnapshotListener((querySnapshot, error) -> {
                    if (error != null || querySnapshot == null) return;
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
                    filterRestaurants();

                    // Update restaurant names on loaded menu items if needed
                    boolean updated = false;
                    for (MenuItem item : allMenuItems) {
                        String rName = restaurantNameMap.get(item.getRestaurantId());
                        if (rName != null && !rName.equals(item.getRestaurantName())) {
                            item.setRestaurantName(rName);
                            updated = true;
                        }
                    }
                    if (updated) {
                        filterItems();
                    }

                    // If menu items was empty, also try subcollections of restaurants
                    if (allMenuItems.isEmpty()) {
                        fetchFromRestaurantSubcollections();
                    }
                });
    }

    private void filterRestaurants() {
        if (restaurantAdapter == null) return;

        com.ssr.hunger.models.Address addr = null;
        if (getContext() != null) {
            addr = CartManager.getInstance(getContext()).getDeliveryAddress();
        }

        String userPincode = null;
        double customerLat = 0, customerLon = 0;
        boolean hasCoordinates = false;

        if (addr != null) {
            if (addr.getPincode() != null && !addr.getPincode().trim().isEmpty()) {
                userPincode = addr.getPincode().trim();
            }
            if (com.ssr.hunger.utils.GeohashHelper.isValidCoordinate(addr.getLatitude(), addr.getLongitude())) {
                customerLat = addr.getLatitude();
                customerLon = addr.getLongitude();
                hasCoordinates = true;
            }
        }

        List<Restaurant> deliverable = new ArrayList<>();
        List<Restaurant> others = new ArrayList<>();

        // Geospatial filtering: straight-line distance pre-filter
        final double maxDistMeters = 15000; // 15km straight-line covers ~10km road

        for (Restaurant r : allRestaurants) {
            if (hasCoordinates && r.getLatitude() != 0 && r.getLongitude() != 0) {
                double dist = com.ssr.hunger.utils.GeohashHelper.haversineDistance(
                        customerLat, customerLon, r.getLatitude(), r.getLongitude());
                if (dist <= maxDistMeters) {
                    deliverable.add(r);
                } else {
                    others.add(r);
                }
            } else if (r.isServingPincode(userPincode)) {
                // Fallback to pincode matching
                deliverable.add(r);
            } else {
                others.add(r);
            }
        }

        // Sort deliverable by distance (closest first) when coordinates available
        if (hasCoordinates) {
            final double lat = customerLat;
            final double lon = customerLon;
            deliverable.sort((a, b) -> {
                double distA = (a.getLatitude() != 0 && a.getLongitude() != 0)
                        ? com.ssr.hunger.utils.GeohashHelper.haversineDistance(lat, lon, a.getLatitude(), a.getLongitude())
                        : Double.MAX_VALUE;
                double distB = (b.getLatitude() != 0 && b.getLongitude() != 0)
                        ? com.ssr.hunger.utils.GeohashHelper.haversineDistance(lat, lon, b.getLatitude(), b.getLongitude())
                        : Double.MAX_VALUE;
                return Double.compare(distA, distB);
            });
        }

        List<Restaurant> toShow = !deliverable.isEmpty() ? deliverable : allRestaurants;
        restaurantAdapter.updateData(toShow.subList(0, Math.min(8, toShow.size())));
    }

    private void listenToMenuItems() {
        menuListener = db.collection(Constants.COLLECTION_MENU_ITEMS)
                .addSnapshotListener((querySnapshot, error) -> {
                    if (error != null) {
                        fetchFromRestaurantSubcollections();
                        return;
                    }

                    if (querySnapshot == null || querySnapshot.isEmpty()) {
                        fetchFromRestaurantSubcollections();
                        return;
                    }

                    Map<String, MenuItem> itemsMap = new LinkedHashMap<>();
                    for (DocumentSnapshot doc : querySnapshot.getDocuments()) {
                        MenuItem item = MenuItem.fromSnapshot(doc);
                        if (item != null) {
                            String restName = restaurantNameMap.get(item.getRestaurantId());
                            if (restName != null && !restName.isEmpty()) {
                                item.setRestaurantName(restName);
                            } else if (item.getRestaurantName() == null || item.getRestaurantName().isEmpty()) {
                                item.setRestaurantName("AKR Hunger");
                            }
                            itemsMap.put(item.getId(), item);
                        }
                    }

                    if (itemsMap.isEmpty()) {
                        fetchFromRestaurantSubcollections();
                    } else {
                        allMenuItems.clear();
                        allMenuItems.addAll(itemsMap.values());
                        if (rootView != null) {
                            rootView.findViewById(R.id.shimmer_layout).setVisibility(View.GONE);
                        }
                        filterItems();
                    }
                });
    }

    /**
     * Fallback to query restaurant subcollections 'restaurants/{id}/menuItems'
     * in case menu items were created under restaurant documents.
     */
    private void fetchFromRestaurantSubcollections() {
        if (allRestaurants.isEmpty()) {
            db.collection(Constants.COLLECTION_RESTAURANTS).get().addOnSuccessListener(snap -> {
                for (DocumentSnapshot d : snap.getDocuments()) {
                    restaurantNameMap.put(d.getId(), d.getString("name"));
                    fetchSubcollectionForRestaurant(d.getId(), d.getString("name"));
                }
            }).addOnFailureListener(e -> {
                if (rootView != null) rootView.findViewById(R.id.shimmer_layout).setVisibility(View.GONE);
            });
        } else {
            for (Restaurant r : allRestaurants) {
                fetchSubcollectionForRestaurant(r.getId(), r.getName());
            }
        }
    }

    private void fetchSubcollectionForRestaurant(String rId, String rName) {
        db.collection(Constants.COLLECTION_RESTAURANTS).document(rId)
                .collection(Constants.COLLECTION_MENU_ITEMS)
                .get()
                .addOnSuccessListener(subSnap -> {
                    boolean added = false;
                    for (DocumentSnapshot doc : subSnap.getDocuments()) {
                        MenuItem item = MenuItem.fromSnapshot(doc);
                        if (item != null) {
                            item.setRestaurantId(rId);
                            item.setRestaurantName(rName != null ? rName : "Restaurant");

                            boolean exists = false;
                            for (MenuItem existing : allMenuItems) {
                                if (existing.getId().equals(item.getId())) {
                                    exists = true;
                                    break;
                                }
                            }
                            if (!exists) {
                                allMenuItems.add(item);
                                added = true;
                            }
                        }
                    }

                    if (rootView != null) {
                        rootView.findViewById(R.id.shimmer_layout).setVisibility(View.GONE);
                    }
                    if (added) {
                        filterItems();
                    }
                })
                .addOnFailureListener(e -> {
                    if (rootView != null) {
                        rootView.findViewById(R.id.shimmer_layout).setVisibility(View.GONE);
                    }
                });
    }

    private void filterItems() {
        List<MenuItem> filtered = new ArrayList<>();
        String userPincode = null;
        if (getContext() != null) {
            com.ssr.hunger.models.Address addr = CartManager.getInstance(getContext()).getDeliveryAddress();
            if (addr != null && addr.getPincode() != null && !addr.getPincode().trim().isEmpty()) {
                userPincode = addr.getPincode().trim();
            }
        }

        Map<String, Boolean> restServingMap = new HashMap<>();
        for (Restaurant r : allRestaurants) {
            restServingMap.put(r.getId(), r.isServingPincode(userPincode));
        }

        for (MenuItem item : allMenuItems) {
            if (!item.isVisibleToCustomers()) continue;

            // Check if item's restaurant serves user's delivery pincode (matching customer web panel)
            if (userPincode != null && !userPincode.isEmpty()) {
                Boolean serves = restServingMap.get(item.getRestaurantId());
                if (serves != null && !serves) {
                    continue; // Skip dish if outside service area
                }
            }

            if ("all".equals(selectedCategory)) {
                filtered.add(item);
            } else {
                String cat = item.getCategory() != null ? item.getCategory().toLowerCase() : "";
                String name = item.getName() != null ? item.getName().toLowerCase() : "";
                String desc = item.getDescription() != null ? item.getDescription().toLowerCase() : "";
                String filter = selectedCategory.toLowerCase();

                if (cat.contains(filter) || name.contains(filter) || desc.contains(filter) ||
                        (filter.equals("pizza") && (cat.contains("pizza") || name.contains("pizza") || desc.contains("pizza"))) ||
                        (filter.equals("burger") && (cat.contains("burger") || name.contains("burger"))) ||
                        (filter.equals("biryani") && (cat.contains("biryani") || name.contains("biryani") || cat.contains("rice"))) ||
                        (filter.equals("chinese") && (cat.contains("chinese") || cat.contains("noodle") || name.contains("manchurian") || name.contains("fried rice"))) ||
                        (filter.equals("dessert") && (cat.contains("dessert") || cat.contains("sweet") || cat.contains("ice cream") || name.contains("cake") || name.contains("pastry"))) ||
                        (filter.equals("drinks") && (cat.contains("drinks") || cat.contains("beverage") || name.contains("juice") || name.contains("shake") || name.contains("mojito"))) ||
                        (filter.equals("healthy") && (cat.contains("healthy") || cat.contains("salad") || name.contains("salad") || name.contains("soup")))) {
                    filtered.add(item);
                }
            }
        }

        // If strict pincode filtering removed everything, fallback to all so screen is never blank
        if (filtered.isEmpty() && "all".equals(selectedCategory) && !allMenuItems.isEmpty()) {
            filtered.addAll(allMenuItems);
        }

        menuItemAdapter.updateData(filtered);

        // Show/hide empty state
        View emptyState = rootView.findViewById(R.id.empty_state);
        if (emptyState != null) {
            emptyState.setVisibility(filtered.isEmpty() ? View.VISIBLE : View.GONE);
        }

        // Update section title to Popular Near You
        TextView titleView = rootView.findViewById(R.id.tv_items_title);
        if (titleView != null) {
            if (!"all".equals(selectedCategory)) {
                titleView.setText(selectedCategory + " Items");
            } else if (userPincode != null && !userPincode.isEmpty()) {
                titleView.setText("🔥 Serving in PIN " + userPincode);
            } else {
                titleView.setText("🔥 Popular Near You");
            }
        }
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        if (menuListener != null) {
            menuListener.remove();
        }
        if (restaurantListener != null) {
            restaurantListener.remove();
        }
    }
}
