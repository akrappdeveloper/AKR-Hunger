package com.ssr.hunger.activities;

import android.content.Intent;
import android.os.Bundle;
import android.view.animation.RotateAnimation;
import android.widget.Button;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.TextView;
import android.widget.Toast;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import com.ssr.hunger.R;
import com.ssr.hunger.models.CartItem;
import com.ssr.hunger.utils.CartManager;

public class MysteryBoxActivity extends AppCompatActivity {

    private TextView tvBoxEmoji, tvBoxTitle, tvBoxSubtitle;
    private RadioGroup rgTiers, rgDiet;
    private Button btnShake, btnOrderMystery;

    private int selectedPrice = 399;
    private String selectedTierName = "Silver Surprise Feast";
    private String selectedDiet = "Non-Veg";

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_mystery_box);

        findViewById(R.id.btn_back).setOnClickListener(v -> finish());
        findViewById(R.id.btn_cart).setOnClickListener(v -> startActivity(new Intent(this, CartActivity.class)));

        tvBoxEmoji = findViewById(R.id.tv_box_emoji);
        tvBoxTitle = findViewById(R.id.tv_box_title);
        tvBoxSubtitle = findViewById(R.id.tv_box_subtitle);
        rgTiers = findViewById(R.id.rg_tiers);
        rgDiet = findViewById(R.id.rg_diet);
        btnShake = findViewById(R.id.btn_shake);
        btnOrderMystery = findViewById(R.id.btn_order_mystery);

        setupTiers();
        setupDiet();
        setupShake();
        setupOrderButton();
    }

    private void setupTiers() {
        rgTiers.setOnCheckedChangeListener((group, checkedId) -> {
            if (checkedId == R.id.rb_bronze) {
                selectedPrice = 199;
                selectedTierName = "Bronze Wonder Box";
                tvBoxTitle.setText(selectedTierName);
                tvBoxSubtitle.setText("2 Chef Specialties (Guaranteed Worth ₹350+)");
            } else if (checkedId == R.id.rb_gold) {
                selectedPrice = 699;
                selectedTierName = "Gold Chef Royal Box";
                tvBoxTitle.setText(selectedTierName);
                tvBoxSubtitle.setText("5 Royal Dishes + Starters (Guaranteed Worth ₹1,150+)");
            } else {
                selectedPrice = 399;
                selectedTierName = "Silver Surprise Feast";
                tvBoxTitle.setText(selectedTierName);
                tvBoxSubtitle.setText("3 Chef Specialties (Guaranteed Worth ₹650+)");
            }
            btnOrderMystery.setText("Order Mystery Box • ₹" + selectedPrice);
        });
    }

    private void setupDiet() {
        rgDiet.setOnCheckedChangeListener((group, checkedId) -> {
            if (checkedId == R.id.rb_veg) {
                selectedDiet = "Pure Veg";
            } else if (checkedId == R.id.rb_sweet) {
                selectedDiet = "Sweet Tooth";
            } else {
                selectedDiet = "Non-Veg";
            }
        });
    }

    private void setupShake() {
        btnShake.setOnClickListener(v -> {
            RotateAnimation rotate = new RotateAnimation(
                    -15f, 15f,
                    RotateAnimation.RELATIVE_TO_SELF, 0.5f,
                    RotateAnimation.RELATIVE_TO_SELF, 0.5f
            );
            rotate.setDuration(120);
            rotate.setRepeatCount(4);
            rotate.setRepeatMode(RotateAnimation.REVERSE);
            tvBoxEmoji.startAnimation(rotate);

            Toast.makeText(this, "🎲 Mystery Box shaken! Chef surprise combination locked in.", Toast.LENGTH_SHORT).show();
        });
    }

    private void setupOrderButton() {
        btnOrderMystery.setOnClickListener(v -> {
            String itemId = "box_" + System.currentTimeMillis();
            String itemName = "🎁 " + selectedTierName + " (" + selectedDiet + ")";

            CartManager.getInstance(this).addItem(
                    new CartItem(itemId, "rest_mystery_hub", itemName, (double)selectedPrice, 1, "", "Hunger Mystery Hub")
            );

            Toast.makeText(this, "🎁 Mystery Box added to cart! Proceed to checkout.", Toast.LENGTH_LONG).show();
            startActivity(new Intent(this, CartActivity.class));
        });
    }
}
