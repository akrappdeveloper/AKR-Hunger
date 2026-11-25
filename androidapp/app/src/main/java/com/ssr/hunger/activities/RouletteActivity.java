package com.ssr.hunger.activities;

import android.os.Bundle;
import android.os.Handler;
import android.view.animation.Animation;
import android.view.animation.RotateAnimation;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.TextView;
import com.google.android.material.button.MaterialButton;
import com.ssr.hunger.R;
import java.util.Random;

public class RouletteActivity extends BaseActivity {

    private ImageButton btnBack;
    private ImageView imgWheel;
    private MaterialButton btnSpin;
    private TextView tvPrizeResult;
    private boolean isSpinning = false;
    private float lastDegree = 0;

    private static final String[] PRIZES = {
        "Flat 25% OFF (SPIN25)",
        "Free Dessert Surprise (SWEETFREE)",
        "₹60 Cashback (WALLET60)",
        "Free Delivery on Any Order (FREEDEL)",
        "Flat 50% OFF (TASTY50)",
        "Buy 1 Get 1 Meal (BOGOMEAL)"
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_roulette);

        btnBack = findViewById(R.id.btnBack);
        imgWheel = findViewById(R.id.imgWheel);
        btnSpin = findViewById(R.id.btnSpin);
        tvPrizeResult = findViewById(R.id.tvPrizeResult);

        btnBack.setOnClickListener(v -> finish());

        btnSpin.setOnClickListener(v -> spinWheel());
    }

    private void spinWheel() {
        if (isSpinning) return;
        isSpinning = true;
        tvPrizeResult.setText("Spinning the wheel...");

        Random random = new Random();
        int prizeIndex = random.nextInt(PRIZES.length);
        float sliceDegree = 360f / PRIZES.length;
        float targetDegree = (360f * 5) + (sliceDegree * prizeIndex) + (sliceDegree / 2f);

        RotateAnimation rotate = new RotateAnimation(
            lastDegree, targetDegree,
            Animation.RELATIVE_TO_SELF, 0.5f,
            Animation.RELATIVE_TO_SELF, 0.5f
        );
        rotate.setDuration(3500);
        rotate.setFillAfter(true);

        rotate.setAnimationListener(new Animation.AnimationListener() {
            @Override
            public void onAnimationStart(Animation animation) {}

            @Override
            public void onAnimationEnd(Animation animation) {
                isSpinning = false;
                lastDegree = targetDegree % 360f;
                String prize = PRIZES[prizeIndex];
                tvPrizeResult.setText("🎉 Congratulations!\nYou won: " + prize);
                showToast("You won: " + prize + "!");
            }

            @Override
            public void onAnimationRepeat(Animation animation) {}
        });

        imgWheel.startAnimation(rotate);
    }
}
