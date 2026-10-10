package com.ssr.hunger.delivery.activities;

import android.content.Intent;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.MenuItem;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.fragment.app.Fragment;

import com.google.android.material.badge.BadgeDrawable;
import com.google.android.material.bottomnavigation.BottomNavigationView;
import com.google.android.material.card.MaterialCardView;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import com.ssr.hunger.delivery.R;
import com.ssr.hunger.delivery.dialogs.PermissionRationaleDialog;
import com.ssr.hunger.delivery.fragments.DashboardOrdersFragment;
import com.ssr.hunger.delivery.fragments.EarningsFragment;
import com.ssr.hunger.delivery.fragments.OrderHistoryFragment;
import com.ssr.hunger.delivery.fragments.PartnerProfileFragment;
import com.ssr.hunger.delivery.utils.Constants;
import com.ssr.hunger.delivery.utils.PermissionManager;

import java.util.Arrays;

public class MainActivity extends AppCompatActivity {

    private static final String STATE_CURRENT_TAB = "state_current_tab";
    private static final String TAG_HOME = "tag_nav_home";
    private static final String TAG_ORDERS = "tag_nav_orders";
    private static final String TAG_EARNINGS = "tag_nav_earnings";
    private static final String TAG_PROFILE = "tag_nav_profile";

    private BottomNavigationView bottomNav;
    private MaterialCardView cardBottomNav;
    private FrameLayout fragmentContainer;

    private int currentTabId = R.id.nav_home;
    private ListenerRegistration activeOrdersBadgeListener;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        bottomNav = findViewById(R.id.bottom_navigation);
        cardBottomNav = findViewById(R.id.card_bottom_nav);
        fragmentContainer = findViewById(R.id.fragment_container);

        setupWindowInsets();

        if (savedInstanceState != null) {
            currentTabId = savedInstanceState.getInt(STATE_CURRENT_TAB, R.id.nav_home);
        } else {
            currentTabId = R.id.nav_home;
            loadFragment(new DashboardOrdersFragment(), TAG_HOME);
        }

        setupBottomNavigation();

        checkAndRequestPermissions();
        handleIncomingOrderIntent(getIntent());
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
        outState.putInt(STATE_CURRENT_TAB, currentTabId);
    }

    @Override
    protected void onResume() {
        super.onResume();
        syncNavigationSelection();
        startActiveOrdersBadgeListener();
    }

    @Override
    protected void onPause() {
        super.onPause();
        stopActiveOrdersBadgeListener();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        stopActiveOrdersBadgeListener();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingOrderIntent(intent);
    }

    /**
     * Handles 5 tabs with duplicate launch prevention and state preservation:
     * 1. Home -> DashboardOrdersFragment
     * 2. Orders -> OrderHistoryFragment
     * 3. Earnings -> EarningsFragment
     * 4. Wallet -> WalletActivity (singleTop & reorder-to-front)
     * 5. Profile -> PartnerProfileFragment
     */
    private void setupBottomNavigation() {
        bottomNav.setOnItemSelectedListener(item -> {
            int id = item.getItemId();

            if (id == R.id.nav_wallet) {
                // Launch dedicated WalletActivity without duplicating activities or desyncing tabs
                Intent walletIntent = new Intent(MainActivity.this, WalletActivity.class);
                walletIntent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
                startActivity(walletIntent);
                return false;
            }

            if (id == currentTabId) {
                // Tab already displayed, avoid reload flicker or duplicate state
                return true;
            }

            if (id == R.id.nav_home) {
                currentTabId = R.id.nav_home;
                loadFragment(new DashboardOrdersFragment(), TAG_HOME);
                return true;
            } else if (id == R.id.nav_orders) {
                currentTabId = R.id.nav_orders;
                loadFragment(new OrderHistoryFragment(), TAG_ORDERS);
                return true;
            } else if (id == R.id.nav_earnings) {
                currentTabId = R.id.nav_earnings;
                loadFragment(new EarningsFragment(), TAG_EARNINGS);
                return true;
            } else if (id == R.id.nav_profile) {
                currentTabId = R.id.nav_profile;
                loadFragment(new PartnerProfileFragment(), TAG_PROFILE);
                return true;
            }

            return false;
        });

        syncNavigationSelection();
    }

    /**
     * Ensures active tab highlights match the current screen when returning from external Activities.
     */
    private void syncNavigationSelection() {
        if (bottomNav != null) {
            MenuItem item = bottomNav.getMenu().findItem(currentTabId);
            if (item != null && !item.isChecked()) {
                item.setChecked(true);
            }
        }
    }

    /**
     * Edge-to-edge window insets handling for modern Android system bars and gestures.
     * Keeps the floating card comfortably above system bars and clears list scroll padding.
     */
    private void setupWindowInsets() {
        View root = findViewById(R.id.main_root);
        if (root == null) return;

        ViewCompat.setOnApplyWindowInsetsListener(root, (v, windowInsets) -> {
            Insets systemBars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars());

            int baseBottomMargin = (int) TypedValue.applyDimension(
                    TypedValue.COMPLEX_UNIT_DIP, 12, getResources().getDisplayMetrics());
            int totalBottomMargin = baseBottomMargin + systemBars.bottom;

            if (cardBottomNav != null) {
                ViewGroup.MarginLayoutParams lp = (ViewGroup.MarginLayoutParams) cardBottomNav.getLayoutParams();
                if (lp != null && lp.bottomMargin != totalBottomMargin) {
                    lp.bottomMargin = totalBottomMargin;
                    cardBottomNav.setLayoutParams(lp);
                }
            }

            if (fragmentContainer != null) {
                int navHeight = (int) TypedValue.applyDimension(
                        TypedValue.COMPLEX_UNIT_DIP, 64, getResources().getDisplayMetrics());
                int totalContentPadding = navHeight + totalBottomMargin + baseBottomMargin;
                fragmentContainer.setPadding(0, 0, 0, totalContentPadding);
            }

            return windowInsets;
        });
    }

    /**
     * Real-time Firestore listener for live orders assigned to this delivery partner.
     * Displays a clean badge on the Orders tab when active deliveries are in progress.
     */
    private void startActiveOrdersBadgeListener() {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) {
            clearOrdersBadge();
            return;
        }

        if (activeOrdersBadgeListener != null) {
            return;
        }

        String uid = user.getUid();
        activeOrdersBadgeListener = FirebaseFirestore.getInstance()
                .collection(Constants.COLLECTION_ORDERS)
                .whereEqualTo("deliveryPersonId", uid)
                .whereIn("status", Arrays.asList(
                        Constants.STATUS_OUT_FOR_DELIVERY,
                        Constants.STATUS_READY,
                        Constants.STATUS_CONFIRMED,
                        Constants.STATUS_PREPARING
                ))
                .addSnapshotListener((snapshot, error) -> {
                    if (error != null || snapshot == null) {
                        return;
                    }
                    int activeCount = snapshot.size();
                    updateOrdersBadge(activeCount);
                });
    }

    private void updateOrdersBadge(int count) {
        if (bottomNav == null) return;
        if (count > 0) {
            BadgeDrawable badge = bottomNav.getOrCreateBadge(R.id.nav_orders);
            badge.setVisible(true);
            badge.setNumber(count);
            badge.setBackgroundColor(ContextCompat.getColor(this, R.color.primary));
            badge.setBadgeTextColor(ContextCompat.getColor(this, R.color.on_primary));
        } else {
            clearOrdersBadge();
        }
    }

    private void clearOrdersBadge() {
        if (bottomNav == null) return;
        BadgeDrawable badge = bottomNav.getBadge(R.id.nav_orders);
        if (badge != null) {
            badge.setVisible(false);
            badge.clearNumber();
        }
    }

    private void stopActiveOrdersBadgeListener() {
        if (activeOrdersBadgeListener != null) {
            activeOrdersBadgeListener.remove();
            activeOrdersBadgeListener = null;
        }
    }

    private void handleIncomingOrderIntent(Intent intent) {
        if (intent != null && intent.hasExtra(Constants.EXTRA_ORDER_ID)) {
            String orderId = intent.getStringExtra(Constants.EXTRA_ORDER_ID);
            if (orderId != null && !orderId.isEmpty()) {
                Intent activeDetail = new Intent(this, OrderActiveDetailActivity.class);
                activeDetail.putExtra(Constants.EXTRA_ORDER_ID, orderId);
                startActivity(activeDetail);
            }
        }
    }

    private void loadFragment(Fragment fragment, String tag) {
        getSupportFragmentManager()
                .beginTransaction()
                .replace(R.id.fragment_container, fragment, tag)
                .commit();
    }

    private void checkAndRequestPermissions() {
        if (!PermissionManager.hasAllEssentialPermissions(this)) {
            PermissionRationaleDialog dialog = new PermissionRationaleDialog(this, () -> {
                // Callback when user clicks grant
            });
            dialog.show();
        }
    }
}
