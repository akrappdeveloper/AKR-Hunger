package com.ssr.hunger.activities;

import android.os.Bundle;
import android.widget.ImageButton;
import android.widget.TextView;
import com.google.android.material.card.MaterialCardView;
import com.google.android.material.slider.Slider;
import com.ssr.hunger.R;

public class DietPlannerActivity extends BaseActivity {

    private ImageButton btnBack;
    private TextView tvTargetCalories;
    private Slider sliderCalories;
    private TextView tvWeightLoss, tvMuscleGain, tvMaintenance, tvHealthy;
    private MaterialCardView cardWeightLoss, cardMuscleGain, cardMaintenance, cardHealthy;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_diet_planner);

        btnBack = findViewById(R.id.btnBack);
        tvTargetCalories = findViewById(R.id.tvTargetCalories);
        sliderCalories = findViewById(R.id.sliderCalories);

        cardWeightLoss = findViewById(R.id.cardWeightLoss);
        cardMuscleGain = findViewById(R.id.cardMuscleGain);
        cardMaintenance = findViewById(R.id.cardMaintenance);
        cardHealthy = findViewById(R.id.cardHealthy);

        btnBack.setOnClickListener(v -> finish());

        sliderCalories.addOnChangeListener((slider, value, fromUser) -> {
            tvTargetCalories.setText(String.format("%d kcal / day", (int) value));
        });

        cardWeightLoss.setOnClickListener(v -> {
            sliderCalories.setValue(1500f);
            showToast("Weight Loss plan selected: 1500 kcal");
        });

        cardMuscleGain.setOnClickListener(v -> {
            sliderCalories.setValue(2500f);
            showToast("Muscle Gain plan selected: 2500 kcal");
        });

        cardMaintenance.setOnClickListener(v -> {
            sliderCalories.setValue(2000f);
            showToast("Maintenance plan selected: 2000 kcal");
        });

        cardHealthy.setOnClickListener(v -> {
            sliderCalories.setValue(1800f);
            showToast("Healthy Eating plan selected: 1800 kcal");
        });
    }
}
