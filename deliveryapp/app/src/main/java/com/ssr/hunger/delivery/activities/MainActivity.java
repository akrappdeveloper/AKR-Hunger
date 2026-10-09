package com.ssr.hunger.delivery.activities;

import android.content.Intent;
import android.os.Bundle;

import androidx.appcompat.app.AppCompatActivity;
import androidx.fragment.app.Fragment;

import com.google.android.material.bottomnavigation.BottomNavigationView;
import com.ssr.hunger.delivery.R;
import com.ssr.hunger.delivery.dialogs.PermissionRationaleDialog;
import com.ssr.hunger.delivery.fragments.DashboardOrdersFragment;
import com.ssr.hunger.delivery.fragments.EarningsFragment;
import com.ssr.hunger.delivery.fragments.OrderHistoryFragment;
import com.ssr.hunger.delivery.fragments.PartnerProfileFragment;
import com.ssr.hunger.delivery.utils.Constants;
import com.ssr.hunger.delivery.utils.PermissionManager;

public class MainActivity extends AppCompatActivity {

    private BottomNavigationView bottomNav;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        bottomNav = findViewById(R.id.bottom_navigation);

        if (savedInstanceState == null) {
            loadFragment(new DashboardOrdersFragment());
        }

        bottomNav.setOnItemSelectedListener(item -> {
            int id = item.getItemId();
            if (id == R.id.nav_orders) {
                loadFragment(new DashboardOrdersFragment());
                return true;
            } else if (id == R.id.nav_earnings) {
                loadFragment(new EarningsFragment());
                return true;
            } else if (id == R.id.nav_history) {
                loadFragment(new OrderHistoryFragment());
                return true;
            } else if (id == R.id.nav_profile) {
                loadFragment(new PartnerProfileFragment());
                return true;
            }
            return false;
        });

        checkAndRequestPermissions();
        handleIncomingOrderIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingOrderIntent(intent);
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

    private void loadFragment(Fragment fragment) {
        getSupportFragmentManager()
                .beginTransaction()
                .replace(R.id.fragment_container, fragment)
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
