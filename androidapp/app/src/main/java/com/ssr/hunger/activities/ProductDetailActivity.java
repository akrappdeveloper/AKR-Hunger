package com.ssr.hunger.activities;

import android.os.Bundle;
import android.view.View;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;
import com.ssr.hunger.R;
import com.ssr.hunger.models.CartItem;
import com.ssr.hunger.models.MenuItem;
import com.ssr.hunger.utils.CartManager;
import com.ssr.hunger.utils.Constants;
import com.bumptech.glide.Glide;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.FieldValue;
import com.google.firebase.firestore.FirebaseFirestore;
import java.util.Locale;

/**
 * Product Detail Activity - mirrors the web app's product/[id] page.
 * Shows full item details, images, add to cart, favorite toggle.
 * Extends BaseActivity for Realtime Analytics, Crashlytics breadcrumbs, and Performance.
 */
public class ProductDetailActivity extends BaseActivity {

    private FirebaseFirestore db;
    private MenuItem menuItem;
    private String productId;
    private int quantity = 1;
    private boolean isFavorite = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_product_detail);

        db = FirebaseFirestore.getInstance();
        productId = getIntent().getStringExtra(Constants.EXTRA_PRODUCT_ID);

        if (productId == null) {
            recordException("ProductDetail_null_id", new IllegalArgumentException("Product ID is null"));
            finish();
            return;
        }

        findViewById(R.id.btn_back).setOnClickListener(v -> finish());
        loadProduct();
    }

    private void loadProduct() {
        logBreadcrumb("Loading product details: " + productId);
        db.collection(Constants.COLLECTION_MENU_ITEMS).document(productId)
                .get()
                .addOnSuccessListener(doc -> {
                    if (!doc.exists()) { finish(); return; }

                    menuItem = doc.toObject(MenuItem.class);
                    if (menuItem == null) { finish(); return; }
                    menuItem.setId(doc.getId());

                    // Get restaurant name
                    db.collection(Constants.COLLECTION_RESTAURANTS).document(menuItem.getRestaurantId())
                            .get()
                            .addOnSuccessListener(rDoc -> {
                                if (rDoc.exists()) {
                                    menuItem.setRestaurantName(rDoc.getString("name"));
                                }
                                populateUI();

                                // Firebase Analytics - view_item event
                                analyticsHelper.logViewItem(menuItem);
                                logBreadcrumb("Product loaded: " + menuItem.getName() + " (₹" + menuItem.getPrice() + ")");
                            })
                            .addOnFailureListener(e -> {
                                populateUI();
                                analyticsHelper.logViewItem(menuItem);
                            });

                    checkFavoriteStatus();
                })
                .addOnFailureListener(e -> {
                    recordException("loadProduct_failed", e);
                });
    }

    private void populateUI() {
        ImageView ivImage = findViewById(R.id.iv_product_image);
        TextView tvName = findViewById(R.id.tv_product_name);
        TextView tvPrice = findViewById(R.id.tv_product_price);
        TextView tvDescription = findViewById(R.id.tv_product_description);
        TextView tvRestaurant = findViewById(R.id.tv_product_restaurant);
        TextView tvPrepTime = findViewById(R.id.tv_prep_time);
        TextView tvRating = findViewById(R.id.tv_rating);
        TextView tvQuantity = findViewById(R.id.tv_quantity);

        tvName.setText(menuItem.getName());
        tvPrice.setText(String.format(Locale.getDefault(), "₹%.0f", menuItem.getPrice()));
        tvDescription.setText(menuItem.getDescription() != null ? menuItem.getDescription() : "A delicious dish prepared fresh for you.");
        tvRestaurant.setText(menuItem.getRestaurantName() != null ? menuItem.getRestaurantName() : "Restaurant");

        int prepTime = menuItem.getPreparationTime() > 0 ? menuItem.getPreparationTime() : 25;
        tvPrepTime.setText(prepTime + " min");

        if (menuItem.getAverageRating() > 0) {
            tvRating.setText(String.format(Locale.getDefault(), "%.1f (%d)", menuItem.getAverageRating(), menuItem.getTotalReviews()));
        } else {
            tvRating.setText("New");
        }

        // Veg indicator
        View vegDot = findViewById(R.id.veg_dot);
        if (vegDot != null) {
            vegDot.setBackgroundColor(getColor(menuItem.isVegetarian() ? R.color.veg_green : R.color.non_veg_red));
        }

        // Load image
        Glide.with(this).load(menuItem.getImage()).into(ivImage);

        // Quantity controls
        tvQuantity.setText(String.valueOf(quantity));

        findViewById(R.id.btn_minus).setOnClickListener(v -> {
            if (quantity > 1) {
                quantity--;
                tvQuantity.setText(String.valueOf(quantity));
                updateAddButtonPrice();
            }
        });

        findViewById(R.id.btn_plus).setOnClickListener(v -> {
            quantity++;
            tvQuantity.setText(String.valueOf(quantity));
            updateAddButtonPrice();
        });

        // Add to cart
        findViewById(R.id.btn_add_to_cart).setOnClickListener(v -> {
            CartItem cartItem = new CartItem(
                    menuItem.getId(), menuItem.getRestaurantId(), menuItem.getName(),
                    menuItem.getPrice(), quantity, menuItem.getImage(),
                    menuItem.getRestaurantName() != null ? menuItem.getRestaurantName() : ""
            );
            CartManager.getInstance(this).addItem(cartItem);

            // Firebase Analytics - add_to_cart
            analyticsHelper.logAddToCart(cartItem);
            logBreadcrumb("Added to cart: " + menuItem.getName() + " qty=" + quantity);

            Toast.makeText(this, "Added to cart!", Toast.LENGTH_SHORT).show();
        });

        // Favorite toggle
        findViewById(R.id.btn_favorite).setOnClickListener(v -> toggleFavorite());

        updateAddButtonPrice();
    }

    private void updateAddButtonPrice() {
        TextView btnAdd = findViewById(R.id.btn_add_to_cart);
        if (menuItem != null) {
            btnAdd.setText(String.format(Locale.getDefault(), "Add to Cart • ₹%.0f", menuItem.getPrice() * quantity));
        }
    }

    private void checkFavoriteStatus() {
        String uid = FirebaseAuth.getInstance().getCurrentUser() != null ?
                FirebaseAuth.getInstance().getCurrentUser().getUid() : null;
        if (uid == null) return;

        db.collection(Constants.COLLECTION_CUSTOMERS).document(uid)
                .get()
                .addOnSuccessListener(doc -> {
                    if (doc.exists()) {
                        java.util.List<String> favorites = (java.util.List<String>) doc.get("favorites");
                        isFavorite = favorites != null && favorites.contains(productId);
                        updateFavoriteIcon();
                    }
                });
    }

    private void toggleFavorite() {
        String uid = FirebaseAuth.getInstance().getCurrentUser() != null ?
                FirebaseAuth.getInstance().getCurrentUser().getUid() : null;
        if (uid == null) return;

        isFavorite = !isFavorite;
        updateFavoriteIcon();

        // Firebase Analytics - favorite event
        if (menuItem != null) {
            analyticsHelper.logFavoriteToggle(productId, menuItem.getName(), isFavorite);
            logBreadcrumb("Toggled favorite for " + menuItem.getName() + " -> " + isFavorite);
        }

        if (isFavorite) {
            db.collection(Constants.COLLECTION_CUSTOMERS).document(uid)
                    .update("favorites", FieldValue.arrayUnion(productId));
        } else {
            db.collection(Constants.COLLECTION_CUSTOMERS).document(uid)
                    .update("favorites", FieldValue.arrayRemove(productId));
        }
    }

    private void updateFavoriteIcon() {
        ImageView btnFav = findViewById(R.id.btn_favorite);
        if (btnFav != null) {
            btnFav.setImageResource(R.drawable.ic_favorite);
            btnFav.setColorFilter(getColor(isFavorite ? R.color.error : R.color.text_hint));
        }
    }

    @Override
    protected String getScreenName() {
        return "ProductDetail_" + (menuItem != null ? menuItem.getName() : productId);
    }
}
