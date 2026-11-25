package com.ssr.hunger.activities;

import android.os.Bundle;
import android.widget.ImageButton;
import android.widget.TextView;
import com.google.android.material.button.MaterialButton;
import com.google.android.material.card.MaterialCardView;
import com.ssr.hunger.R;

public class MoodFoodActivity extends BaseActivity {

    private ImageButton btnBack;
    private TextView tvMoodTitle, tvMoodDescription;
    private MaterialCardView cardRainy, cardStressed, cardLateNight, cardWorkout;
    private MaterialButton btnAddMoodCombo;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_mood_food);

        btnBack = findViewById(R.id.btnBack);
        tvMoodTitle = findViewById(R.id.tvMoodTitle);
        tvMoodDescription = findViewById(R.id.tvMoodDescription);

        cardRainy = findViewById(R.id.cardRainy);
        cardStressed = findViewById(R.id.cardStressed);
        cardLateNight = findViewById(R.id.cardLateNight);
        cardWorkout = findViewById(R.id.cardWorkout);
        btnAddMoodCombo = findViewById(R.id.btnAddMoodCombo);

        btnBack.setOnClickListener(v -> finish());

        cardRainy.setOnClickListener(v -> {
            tvMoodTitle.setText("🌧️ Rainy Day Comfort Combo");
            tvMoodDescription.setText("Adrak Masala Chai, Crispy Onion Pakoras & Hot Sweet Corn Soup");
            showToast("Selected: Rainy Day Comfort");
        });

        cardStressed.setOnClickListener(v -> {
            tvMoodTitle.setText("🧘 Stress Buster Combo");
            tvMoodDescription.setText("Creamy Truffle Mac & Cheese, Dal Makhani Naan & Warm Chocolate Brownie");
            showToast("Selected: Stress Buster");
        });

        cardLateNight.setOnClickListener(v -> {
            tvMoodTitle.setText("🌙 Midnight Crunch Combo");
            tvMoodDescription.setText("Double Smash Cheese Burger, Peri-Peri Crinkle Fries & Personal Pizza");
            showToast("Selected: Midnight Crunch");
        });

        cardWorkout.setOnClickListener(v -> {
            tvMoodTitle.setText("🏋️ Post-Workout Fuel Combo");
            tvMoodDescription.setText("Herb Grilled Chicken Quinoa Bowl, High-Protein Paneer & Peanut Butter Shake");
            showToast("Selected: Post-Workout Fuel");
        });

        btnAddMoodCombo.setOnClickListener(v -> {
            showToast("Added " + tvMoodTitle.getText() + " to your cart! 🛒");
        });
    }
}
