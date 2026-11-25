package com.ssr.hunger.activities;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import com.google.android.material.card.MaterialCardView;
import com.ssr.hunger.R;
import com.ssr.hunger.models.CartItem;
import com.ssr.hunger.utils.CartManager;
import java.util.ArrayList;
import java.util.List;

public class SecretMenuActivity extends AppCompatActivity {

    private EditText etPasscode;
    private Button btnUnlock;
    private LinearLayout containerSecretDishes;
    private LinearLayout layoutPasscode;
    private boolean isUnlocked = false;

    private static class SecretDish {
        String id;
        String name;
        String restaurant;
        String desc;
        double price;
        String emoji;

        SecretDish(String id, String name, String restaurant, String desc, double price, String emoji) {
            this.id = id;
            this.name = name;
            this.restaurant = restaurant;
            this.desc = desc;
            this.price = price;
            this.emoji = emoji;
        }
    }

    private final List<SecretDish> dishes = new ArrayList<>();

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_secret_menu);

        initDishes();

        findViewById(R.id.btn_back).setOnClickListener(v -> finish());
        findViewById(R.id.btn_cart).setOnClickListener(v -> startActivity(new Intent(this, CartActivity.class)));

        etPasscode = findViewById(R.id.et_passcode);
        btnUnlock = findViewById(R.id.btn_unlock);
        containerSecretDishes = findViewById(R.id.container_secret_dishes);
        layoutPasscode = findViewById(R.id.layout_passcode);

        btnUnlock.setOnClickListener(v -> checkPasscode());

        renderDishes();
    }

    private void initDishes() {
        dishes.add(new SecretDish("sec_1", "Truffle Ghost Monster Burger", "Burger Laboratory", "Double smashed lamb patty, 18-month aged cheddar & summer black truffle aioli.", 380, "🍔"));
        dishes.add(new SecretDish("sec_2", "24K Saffron Crystal Dumplings", "Wok Dynasty Imperial", "Translucent crystal dim sums infused with Kashmiri saffron & gold leaf.", 420, "🥟"));
        dishes.add(new SecretDish("sec_3", "Midnight Handi Dum Biryani", "Royal Dawat Palace", "Sealed handi pot dum cooked at midnight over slow coals.", 490, "🍲"));
        dishes.add(new SecretDish("sec_4", "Belgian Chocolate Molten Volcano", "Dolce Vita Studio", "Flowing warm 70% dark fudge core with roasted hazelnut crumble.", 290, "🌋"));
        dishes.add(new SecretDish("sec_5", "Ghost Pepper Hot Honey Wings", "Flame & Charcoal House", "Glazed in fiery Bhut Jolokia glaze and raw wildflower honey.", 340, "🍗"));
    }

    private void checkPasscode() {
        String code = etPasscode.getText().toString().trim().toUpperCase();
        if ("MIDNIGHT".equals(code) || "HUNGERVIP".equals(code) || "CRAVE".equals(code) || "SECRET".equals(code)) {
            isUnlocked = true;
            layoutPasscode.setVisibility(View.GONE);
            Toast.makeText(this, "🗝️ Vault Unlocked! Chef experiments available.", Toast.LENGTH_SHORT).show();
            renderDishes();
        } else {
            Toast.makeText(this, "Invalid Passcode. Hint: Try 'MIDNIGHT'", Toast.LENGTH_SHORT).show();
        }
    }

    private void renderDishes() {
        containerSecretDishes.removeAllViews();

        for (int i = 0; i < dishes.size(); i++) {
            SecretDish dish = dishes.get(i);

            MaterialCardView card = new MaterialCardView(this);
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
            lp.bottomMargin = 24;
            card.setLayoutParams(lp);
            card.setRadius(32f);
            card.setCardElevation(2f);
            card.setStrokeColor(0xFF7E22CE);
            card.setStrokeWidth(2);
            card.setCardBackgroundColor(0xFF141026);

            LinearLayout rootLayout = new LinearLayout(this);
            rootLayout.setOrientation(LinearLayout.VERTICAL);
            rootLayout.setPadding(28, 28, 28, 28);

            // Row 1: Emoji + Name + Price
            LinearLayout row1 = new LinearLayout(this);
            row1.setOrientation(LinearLayout.HORIZONTAL);
            row1.setGravity(android.view.Gravity.CENTER_VERTICAL);

            TextView tvEmoji = new TextView(this);
            tvEmoji.setText(dish.emoji);
            tvEmoji.setTextSize(26f);

            LinearLayout titleCol = new LinearLayout(this);
            titleCol.setOrientation(LinearLayout.VERTICAL);
            titleCol.setLayoutParams(new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
            titleCol.setPadding(16, 0, 16, 0);

            TextView tvRest = new TextView(this);
            tvRest.setText(dish.restaurant);
            tvRest.setTextColor(0xFFC084FC);
            tvRest.setTextSize(11f);

            TextView tvName = new TextView(this);
            tvName.setText(dish.name);
            tvName.setTextColor(0xFFFFFFFF);
            tvName.setTextSize(15f);
            tvName.setTypeface(null, android.graphics.Typeface.BOLD);

            titleCol.addView(tvRest);
            titleCol.addView(tvName);

            TextView tvPrice = new TextView(this);
            tvPrice.setText("₹" + (int)dish.price);
            tvPrice.setTextColor(0xFFE9D5FF);
            tvPrice.setTextSize(16f);
            tvPrice.setTypeface(null, android.graphics.Typeface.BOLD);

            row1.addView(tvEmoji);
            row1.addView(titleCol);
            row1.addView(tvPrice);

            // Row 2: Desc
            TextView tvDesc = new TextView(this);
            tvDesc.setText(dish.desc);
            tvDesc.setTextColor(0xFF9CA3AF);
            tvDesc.setTextSize(12f);
            tvDesc.setPadding(0, 12, 0, 16);

            // Row 3: Action Button
            Button btnOrder = new Button(this);
            btnOrder.setText(isUnlocked ? "Order Secret (1-Tap)" : "🔒 Unlock Vault to Order");
            btnOrder.setTextSize(12f);
            btnOrder.setAllCaps(false);
            btnOrder.setBackgroundColor(isUnlocked ? 0xFF9333EA : 0xFF374151);
            btnOrder.setTextColor(0xFFFFFFFF);

            btnOrder.setOnClickListener(v -> {
                if (!isUnlocked) {
                    Toast.makeText(this, "Please enter passcode 'MIDNIGHT' to unlock!", Toast.LENGTH_SHORT).show();
                    etPasscode.requestFocus();
                    return;
                }
                CartManager.getInstance(this).addItem(
                        new CartItem(dish.id, "rest_vault", "🔒 " + dish.name, dish.price, 1, "", dish.restaurant)
                );
                Toast.makeText(this, dish.name + " added to cart! 🛒", Toast.LENGTH_SHORT).show();
            });

            rootLayout.addView(row1);
            rootLayout.addView(tvDesc);
            rootLayout.addView(btnOrder);

            card.addView(rootLayout);
            containerSecretDishes.addView(card);
        }
    }
}
