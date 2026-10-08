package com.ssr.hunger.activities;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import com.ssr.hunger.R;
import com.google.android.material.chip.Chip;
import com.google.android.material.chip.ChipGroup;
import java.util.Arrays;
import java.util.List;

/**
 * Hunger Student Mode Activity
 * =============================
 * Shows budget meal categories, weekly offers,
 * student-only deals, hostel delivery, and subscription CTAs.
 * 🎓 No AI required.
 */
public class StudentModeActivity extends AppCompatActivity {

    private static final List<String[]> WEEKLY_OFFERS = Arrays.asList(
        new String[]{"Mon", "20% off on all veg meals", "🌱"},
        new String[]{"Tue", "Buy 2 get 1 free drinks", "🥤"},
        new String[]{"Wed", "Free delivery on ₹99+ orders", "🛵"},
        new String[]{"Thu", "₹30 off on biryani", "🍲"},
        new String[]{"Fri", "Late night 25% off (10PM–2AM)", "🌙"},
        new String[]{"Sat", "Group order bonus 50 points", "👥"},
        new String[]{"Sun", "Brunch special ₹99 combos", "☕"}
    );

    private static final String[][] BUDGET_CATEGORIES = {
        {"₹99", "Lite Bites", "🥗", "Snacks & light meals"},
        {"₹149", "Campus Meal", "🍛", "Full meals for students"},
        {"₹199", "Power Meal", "💪", "High-protein, filling meals"},
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_student_mode);

        setupBackButton();
        setupBudgetCategories();
        setupWeeklyOffers();
        setupFeatures();
        setupSubscriptionCTA();
    }

    private void setupBackButton() {
        View btnBack = findViewById(R.id.btn_back);
        if (btnBack != null) btnBack.setOnClickListener(v -> finish());
    }

    private void setupBudgetCategories() {
        // ₹99 Category
        View card99 = findViewById(R.id.card_99);
        if (card99 != null) {
            card99.setOnClickListener(v -> navigateToCategory("99"));
        }

        // ₹149 Category
        View card149 = findViewById(R.id.card_149);
        if (card149 != null) {
            card149.setOnClickListener(v -> navigateToCategory("149"));
        }

        // ₹199 Category
        View card199 = findViewById(R.id.card_199);
        if (card199 != null) {
            card199.setOnClickListener(v -> navigateToCategory("199"));
        }
    }

    private void navigateToCategory(String priceCategory) {
        // Navigate to search with budget filter
        Intent intent = new Intent(this, SearchActivity.class);
        intent.putExtra("budget", Integer.parseInt(priceCategory));
        intent.putExtra("isStudentMode", true);
        startActivity(intent);
    }

    private void setupWeeklyOffers() {
        // Show today's offer
        int dayOfWeek = java.util.Calendar.getInstance().get(java.util.Calendar.DAY_OF_WEEK);
        int dayIndex = dayOfWeek - 2; // 0=Mon, 6=Sun
        if (dayIndex < 0) dayIndex = 6;
        if (dayIndex < WEEKLY_OFFERS.size()) {
            String[] today = WEEKLY_OFFERS.get(dayIndex);
            TextView tvTodayOffer = findViewById(R.id.tv_today_offer);
            if (tvTodayOffer != null) {
                tvTodayOffer.setText(today[2] + " " + today[1]);
            }
        }

        // Setup day chips
        ChipGroup chipGroup = findViewById(R.id.chip_group_days);
        if (chipGroup != null) {
            chipGroup.removeAllViews();
            for (int i = 0; i < WEEKLY_OFFERS.size(); i++) {
                String[] offer = WEEKLY_OFFERS.get(i);
                Chip chip = new Chip(this);
                chip.setText(offer[0]);
                chip.setCheckable(true);
                final int index = i;
                chip.setOnCheckedChangeListener((btn, checked) -> {
                    if (checked) showOfferForDay(index);
                });
                chipGroup.addView(chip);
            }
        }
    }

    private void showOfferForDay(int index) {
        if (index < 0 || index >= WEEKLY_OFFERS.size()) return;
        String[] offer = WEEKLY_OFFERS.get(index);
        TextView tvSelectedOffer = findViewById(R.id.tv_selected_offer);
        if (tvSelectedOffer != null) {
            tvSelectedOffer.setText(offer[2] + " " + offer[1]);
            tvSelectedOffer.setVisibility(View.VISIBLE);
        }
    }

    private void setupFeatures() {
        // Group Order button
        Button btnGroupOrder = findViewById(R.id.btn_group_order);
        if (btnGroupOrder != null) {
            btnGroupOrder.setOnClickListener(v -> {
                startActivity(new Intent(this, GroupOrderActivity.class));
            });
        }

        // Wallet button
        Button btnWallet = findViewById(R.id.btn_student_wallet);
        if (btnWallet != null) {
            btnWallet.setOnClickListener(v -> {
                startActivity(new Intent(this, WalletActivity.class));
            });
        }

        // Late night toggle info
        View lateNightCard = findViewById(R.id.card_late_night);
        if (lateNightCard != null) {
            lateNightCard.setOnClickListener(v -> {
                Toast.makeText(this, "🌙 Late night delivery active! Open 10PM–2AM", Toast.LENGTH_LONG).show();
            });
        }
    }

    private void setupSubscriptionCTA() {
        Button btnSubscriptions = findViewById(R.id.btn_subscriptions);
        if (btnSubscriptions != null) {
            btnSubscriptions.setOnClickListener(v -> {
                startActivity(new Intent(this, SubscriptionActivity.class));
            });
        }

        Button btnVerify = findViewById(R.id.btn_verify_student);
        if (btnVerify != null) {
            btnVerify.setOnClickListener(v -> {
                Toast.makeText(this,
                        "Student verification is optional. Upload college ID for extra 10% off!",
                        Toast.LENGTH_LONG).show();
                // TODO: Open verification flow
            });
        }
    }

    public static Intent createIntent(Context context) {
        return new Intent(context, StudentModeActivity.class);
    }
}
