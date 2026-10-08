package com.ssr.hunger.activities;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import com.ssr.hunger.R;
import com.google.android.material.tabs.TabLayout;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Hunger Meal Subscription Activity
 * ===================================
 * Browse meal plans, subscribe, manage active subscriptions.
 * Pause / Skip day / Holiday pause / Cancel.
 * Shows remaining meals and meal history.
 */
public class SubscriptionActivity extends AppCompatActivity {

    private FirebaseFirestore db;
    private FirebaseAuth auth;
    private ListenerRegistration subscriptionListener;

    // Views
    private TabLayout tabLayout;
    private RecyclerView rvPlans;
    private RecyclerView rvMySubscriptions;
    private View noSubsLayout;
    private ProgressBar progressBar;

    // Active subscription controls
    private View activeSubCard;
    private TextView tvPlanTitle;
    private TextView tvMealsRemaining;
    private TextView tvNextMeal;
    private ProgressBar progressMeals;
    private Button btnPause;
    private Button btnSkipDay;
    private Button btnCancel;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_subscription);

        db = FirebaseFirestore.getInstance();
        auth = FirebaseAuth.getInstance();

        initViews();
        setupTabs();
        loadPlans();
        loadMySubscriptions();
    }

    private void initViews() {
        tabLayout = findViewById(R.id.tab_layout);
        rvPlans = findViewById(R.id.rv_plans);
        rvMySubscriptions = findViewById(R.id.rv_my_subscriptions);
        noSubsLayout = findViewById(R.id.layout_no_subscriptions);
        progressBar = findViewById(R.id.progress_bar);
        activeSubCard = findViewById(R.id.card_active_subscription);
        tvPlanTitle = findViewById(R.id.tv_plan_title);
        tvMealsRemaining = findViewById(R.id.tv_meals_remaining);
        tvNextMeal = findViewById(R.id.tv_next_meal);
        progressMeals = findViewById(R.id.progress_meals);
        btnPause = findViewById(R.id.btn_pause);
        btnSkipDay = findViewById(R.id.btn_skip_day);
        btnCancel = findViewById(R.id.btn_cancel);

        if (rvPlans != null) rvPlans.setLayoutManager(new LinearLayoutManager(this));
        if (rvMySubscriptions != null) rvMySubscriptions.setLayoutManager(new LinearLayoutManager(this));

        View btnBack = findViewById(R.id.btn_back);
        if (btnBack != null) btnBack.setOnClickListener(v -> finish());

        // Browse plans button (from empty state)
        Button btnBrowsePlans = findViewById(R.id.btn_browse_plans);
        if (btnBrowsePlans != null) btnBrowsePlans.setOnClickListener(v -> {
            if (tabLayout != null) tabLayout.selectTab(tabLayout.getTabAt(0));
        });

        setupSubscriptionControls();
    }

    private void setupTabs() {
        if (tabLayout == null) return;
        tabLayout.addTab(tabLayout.newTab().setText("Browse Plans"));
        tabLayout.addTab(tabLayout.newTab().setText("My Subscriptions"));

        tabLayout.addOnTabSelectedListener(new TabLayout.OnTabSelectedListener() {
            @Override public void onTabSelected(TabLayout.Tab tab) {
                switchTab(tab.getPosition());
            }
            @Override public void onTabUnselected(TabLayout.Tab tab) {}
            @Override public void onTabReselected(TabLayout.Tab tab) {}
        });
    }

    private void switchTab(int position) {
        if (rvPlans != null) rvPlans.setVisibility(position == 0 ? View.VISIBLE : View.GONE);
        if (rvMySubscriptions != null) rvMySubscriptions.setVisibility(position == 1 ? View.VISIBLE : View.GONE);
        if (activeSubCard != null) activeSubCard.setVisibility(position == 1 ? View.VISIBLE : View.GONE);
    }

    private void loadPlans() {
        // Mock plans list for now
        // In production: db.collection("mealPlans").whereEqualTo("isActive", true)
        List<Map<String, Object>> plans = getMockPlans();
        // TODO: Bind to adapter
        if (progressBar != null) progressBar.setVisibility(View.GONE);
    }

    private void loadMySubscriptions() {
        if (auth.getCurrentUser() == null) return;

        String uid = auth.getCurrentUser().getUid();
        subscriptionListener = db.collection("subscriptions")
                .whereEqualTo("customerId", uid)
                .whereEqualTo("status", "active")
                .addSnapshotListener((snap, e) -> {
                    if (e != null || snap == null) return;

                    runOnUiThread(() -> {
                        if (snap.isEmpty()) {
                            showNoSubscriptions();
                        } else {
                            // Show first active subscription
                            Map<String, Object> sub = snap.getDocuments().get(0).getData();
                            if (sub != null) showActiveSubscription(sub);
                        }
                    });
                });
    }

    private void showNoSubscriptions() {
        if (activeSubCard != null) activeSubCard.setVisibility(View.GONE);
        if (noSubsLayout != null) noSubsLayout.setVisibility(View.VISIBLE);
    }

    private void showActiveSubscription(Map<String, Object> sub) {
        if (activeSubCard != null) activeSubCard.setVisibility(View.VISIBLE);
        if (noSubsLayout != null) noSubsLayout.setVisibility(View.GONE);

        String planTitle = (String) sub.getOrDefault("planTitle", "Meal Plan");
        long mealsTaken = sub.get("mealsTaken") instanceof Number
                ? ((Number) sub.get("mealsTaken")).longValue() : 0;
        long totalMeals = sub.get("totalMeals") instanceof Number
                ? ((Number) sub.get("totalMeals")).longValue() : 22;
        long mealsRemaining = totalMeals - mealsTaken;

        if (tvPlanTitle != null) tvPlanTitle.setText(planTitle);
        if (tvMealsRemaining != null) tvMealsRemaining.setText(mealsRemaining + " meals left");
        if (progressMeals != null) {
            progressMeals.setMax((int) totalMeals);
            progressMeals.setProgress((int) mealsTaken);
        }
        if (tvNextMeal != null) tvNextMeal.setText("Next: Tomorrow, Lunch");
    }

    private void setupSubscriptionControls() {
        if (btnPause != null) btnPause.setOnClickListener(v -> pauseSubscription());
        if (btnSkipDay != null) btnSkipDay.setOnClickListener(v -> skipDay());
        if (btnCancel != null) btnCancel.setOnClickListener(v -> cancelSubscription());
    }

    private void pauseSubscription() {
        Toast.makeText(this, "Subscription paused. Resume anytime!", Toast.LENGTH_SHORT).show();
        // TODO: Update Firestore subscription status to "paused"
    }

    private void skipDay() {
        Toast.makeText(this, "Tomorrow's meal skipped ✓", Toast.LENGTH_SHORT).show();
        // TODO: Add today's date to skippedDates array in Firestore
    }

    private void cancelSubscription() {
        // TODO: Confirm dialog, then update status to "cancelled"
        Toast.makeText(this, "Subscription will be cancelled at end of billing period", Toast.LENGTH_LONG).show();
    }

    private List<Map<String, Object>> getMockPlans() {
        List<Map<String, Object>> plans = new ArrayList<>();

        java.util.HashMap<String, Object> plan1 = new java.util.HashMap<>();
        plan1.put("title", "Student Lunch Plan");
        plan1.put("description", "Healthy weekday lunches for students");
        plan1.put("pricePerMonth", 1499);
        plan1.put("mealsPerDay", 1);
        plan1.put("daysPerWeek", 5);
        plan1.put("totalMealsPerMonth", 22);
        plan1.put("planType", "lunch");
        plan1.put("restaurantName", "Campus Kitchen");
        plans.add(plan1);

        java.util.HashMap<String, Object> plan2 = new java.util.HashMap<>();
        plan2.put("title", "Lunch + Dinner Plan");
        plan2.put("description", "Two meals a day, 5 days a week");
        plan2.put("pricePerMonth", 2999);
        plan2.put("mealsPerDay", 2);
        plan2.put("daysPerWeek", 5);
        plan2.put("totalMealsPerMonth", 44);
        plan2.put("planType", "lunch_dinner");
        plan2.put("restaurantName", "Home Bites");
        plans.add(plan2);

        java.util.HashMap<String, Object> plan3 = new java.util.HashMap<>();
        plan3.put("title", "Office Meal Plan");
        plan3.put("description", "Weekday lunches with healthy options");
        plan3.put("pricePerMonth", 3999);
        plan3.put("mealsPerDay", 1);
        plan3.put("daysPerWeek", 5);
        plan3.put("totalMealsPerMonth", 22);
        plan3.put("planType", "office");
        plan3.put("restaurantName", "Office Eats");
        plans.add(plan3);

        return plans;
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (subscriptionListener != null) subscriptionListener.remove();
    }

    public static Intent createIntent(Context context) {
        return new Intent(context, SubscriptionActivity.class);
    }
}
