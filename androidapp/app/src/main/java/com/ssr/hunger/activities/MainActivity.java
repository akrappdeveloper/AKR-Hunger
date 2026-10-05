package com.ssr.hunger.activities;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import androidx.fragment.app.Fragment;
import com.ssr.hunger.R;
import com.ssr.hunger.databinding.ActivityMainBinding;
import com.ssr.hunger.dialogs.DeliveryLocationDialog;
import com.ssr.hunger.fragments.FavoritesFragment;
import com.ssr.hunger.fragments.HomeFragment;
import com.ssr.hunger.fragments.OrdersFragment;
import com.ssr.hunger.fragments.ProfileFragment;
import com.ssr.hunger.fragments.SearchFragment;
import com.ssr.hunger.models.Address;
import com.ssr.hunger.utils.CartManager;
import com.ssr.hunger.views.ActiveOrderTracker;
import com.google.firebase.auth.FirebaseAuth;

/**
 * Main activity hosting the bottom navigation with 5 tabs.
 * Extends BaseActivity for automatic screen tracking, Crashlytics breadcrumbs,
 * and performance monitoring.
 */
public class MainActivity extends BaseActivity implements CartManager.CartChangeListener {

    private ActivityMainBinding binding;
    private CartManager cartManager;
    private ActiveOrderTracker orderTracker;
    private Address currentDeliveryAddress;
    private String currentTabName = "Home";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityMainBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        // Check auth
        if (FirebaseAuth.getInstance().getCurrentUser() == null) {
            logBreadcrumb("MainActivity: User not logged in, redirecting to LoginActivity");
            startActivity(new Intent(this, LoginActivity.class));
            finish();
            return;
        }

        cartManager = CartManager.getInstance(this);
        cartManager.addListener(this);

        setupBottomNavigation();
        setupCartFab();

        // Active Order Tracker (matches web's ActiveOrderFloatingTracker)
        orderTracker = findViewById(R.id.active_order_tracker);

        // Load Home Fragment initially
        if (savedInstanceState == null) {
            loadFragment(new HomeFragment(), "Home");
        }

        updateCartBadge();

        // Notification Permission (Android 13+) & FCM Token Sync with Firestore
        com.ssr.hunger.utils.NotificationHelper.requestNotificationPermission(this);
        com.ssr.hunger.utils.NotificationHelper.syncFcmToken(this);
    }

    private void setupBottomNavigation() {
        binding.bottomNavigation.setOnItemSelectedListener(item -> {
            Fragment fragment = null;
            String tabName = "Home";
            int itemId = item.getItemId();

            if (itemId == R.id.nav_home) {
                fragment = new HomeFragment();
                tabName = "Home";
            } else if (itemId == R.id.nav_search) {
                fragment = new SearchFragment();
                tabName = "Search";
            } else if (itemId == R.id.nav_orders) {
                fragment = new OrdersFragment();
                tabName = "Orders";
            } else if (itemId == R.id.nav_favorites) {
                fragment = new FavoritesFragment();
                tabName = "Favorites";
            } else if (itemId == R.id.nav_profile) {
                fragment = new ProfileFragment();
                tabName = "Profile";
            }

            if (fragment != null) {
                currentTabName = tabName;
                animateTabSelection(itemId);
                loadFragment(fragment, tabName);
                return true;
            }
            return false;
        });
    }

    private void animateTabSelection(int itemId) {
        View tabView = binding.bottomNavigation.findViewById(itemId);
        if (tabView != null) {
            tabView.animate()
                    .scaleX(1.15f)
                    .scaleY(1.15f)
                    .setDuration(120)
                    .withEndAction(() -> tabView.animate().scaleX(1.0f).scaleY(1.0f).setDuration(120).start())
                    .start();
        }
    }

    private void setupCartFab() {
        binding.fabCart.setOnClickListener(v -> {
            logBreadcrumb("MainActivity: FAB clicked, opening CartActivity");
            startActivity(new Intent(this, CartActivity.class));
        });
    }

    /**
     * Opens the Delivery Location Dialog (mirrors web's DeliveryLocationDialog)
     * Called from HomeFragment's location button
     */
    public void showLocationDialog() {
        DeliveryLocationDialog dialog = new DeliveryLocationDialog();
        dialog.setOnAddressSelectedListener(address -> {
            currentDeliveryAddress = address;
            cartManager.setDeliveryAddress(address);
            if (address != null && address.getCity() != null) {
                analyticsHelper.logDeliveryAddressSelected(address.getCity(),
                        address.getType() != null ? address.getType() : "home");
                logBreadcrumb("Delivery address set to: " + address.getCity());
            }
            Fragment currentFragment = getSupportFragmentManager().findFragmentById(R.id.fragment_container);
            if (currentFragment instanceof com.ssr.hunger.fragments.HomeFragment) {
                ((com.ssr.hunger.fragments.HomeFragment) currentFragment).updateLocationDisplay();
            }
            android.widget.Toast.makeText(this,
                    "📍 Delivering to " + (address != null ? address.getCity() : ""), android.widget.Toast.LENGTH_SHORT).show();
        });
        dialog.show(getSupportFragmentManager(), "delivery_location");
    }

    public Address getCurrentDeliveryAddress() {
        return currentDeliveryAddress;
    }

    private void loadFragment(Fragment fragment, String tabName) {
        logBreadcrumb("MainActivity tab switched to: " + tabName);
        analyticsHelper.logScreenView(this, "Tab_" + tabName);
        crashlyticsHelper.setCustomKey("current_main_tab", tabName);

        getSupportFragmentManager()
                .beginTransaction()
                .setCustomAnimations(R.anim.fade_in, R.anim.fade_out)
                .replace(R.id.fragment_container, fragment)
                .commit();
    }

    private void updateCartBadge() {
        int count = cartManager.getTotalItemCount();
        crashlyticsHelper.updateCartContext(count, cartManager.getSubtotal(), cartManager.getRestaurantId());

        if (count > 0) {
            binding.fabCart.setVisibility(View.VISIBLE);
            binding.cartBadge.setVisibility(View.VISIBLE);
            binding.cartBadge.setText(String.valueOf(count));
        } else {
            binding.fabCart.setVisibility(View.GONE);
            binding.cartBadge.setVisibility(View.GONE);
        }
    }

    @Override
    public void onCartChanged(java.util.List<com.ssr.hunger.models.CartItem> items, int totalCount, double subtotal) {
        runOnUiThread(this::updateCartBadge);
    }

    @Override
    protected void onResume() {
        super.onResume();
        updateCartBadge();
        if (orderTracker != null) {
            orderTracker.startListening();
        }
    }


    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (cartManager != null) {
            cartManager.removeListener(this);
        }
        if (orderTracker != null) {
            orderTracker.stopListening();
        }
    }

    @Override
    protected String getScreenName() {
        return "Main_" + currentTabName;
    }
}
