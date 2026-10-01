package com.ssr.hunger.activities;

import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
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
 * Shows full item details, image, price, prep time, veg indicator,
 * quantity stepper, add to cart, and favorite toggle.
 */
public class ProductDetailActivity extends BaseActivity {

    private FirebaseFirestore db;
    private MenuItem menuItem;
    private String productId;
    private String passedRestaurantId;
    private int quantity = 1;
    private boolean isFavorite = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_product_detail);

        db = FirebaseFirestore.getInstance();
        productId = getIntent().getStringExtra(Constants.EXTRA_PRODUCT_ID);
        passedRestaurantId = getIntent().getStringExtra(Constants.EXTRA_RESTAURANT_ID);

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

        // 1. Try Root collection first
        db.collection(Constants.COLLECTION_MENU_ITEMS).document(productId)
                .get()
                .addOnSuccessListener(doc -> {
                    if (doc.exists()) {
                        MenuItem item = MenuItem.fromSnapshot(doc);
                        if (item != null) {
                            handleProductLoaded(item);
                            return;
                        }
                    }
                    // If not found in root, try restaurant subcollection
                    trySubcollectionFallback();
                })
                .addOnFailureListener(e -> trySubcollectionFallback());
    }

    private void trySubcollectionFallback() {
        if (passedRestaurantId != null && !passedRestaurantId.isEmpty()) {
            db.collection(Constants.COLLECTION_RESTAURANTS).document(passedRestaurantId)
                    .collection(Constants.COLLECTION_MENU_ITEMS).document(productId)
                    .get()
                    .addOnSuccessListener(doc -> {
                        if (doc.exists()) {
                            MenuItem item = MenuItem.fromSnapshot(doc);
                            if (item != null) {
                                handleProductLoaded(item);
                                return;
                            }
                        }
                        Toast.makeText(this, "Product details not found", Toast.LENGTH_SHORT).show();
                        finish();
                    })
                    .addOnFailureListener(e -> {
                        Toast.makeText(this, "Product details not found", Toast.LENGTH_SHORT).show();
                        finish();
                    });
        } else {
            Toast.makeText(this, "Product details not found", Toast.LENGTH_SHORT).show();
            finish();
        }
    }

    private void handleProductLoaded(MenuItem item) {
        this.menuItem = item;

        String rId = item.getRestaurantId() != null ? item.getRestaurantId() : passedRestaurantId;
        if (item.getRestaurantName() == null || item.getRestaurantName().isEmpty() || "Unknown Restaurant".equalsIgnoreCase(item.getRestaurantName())) {
            if (rId != null && !rId.isEmpty()) {
                db.collection(Constants.COLLECTION_RESTAURANTS).document(rId)
                        .get()
                        .addOnSuccessListener(rDoc -> {
                            if (rDoc.exists()) {
                                menuItem.setRestaurantName(rDoc.getString("name"));
                                TextView tvRestaurant = findViewById(R.id.tv_product_restaurant);
                                if (tvRestaurant != null && menuItem.getRestaurantName() != null) {
                                    tvRestaurant.setText(menuItem.getRestaurantName());
                                }
                            }
                        });
            }
        }

        populateUI();
        analyticsHelper.logViewItem(menuItem);
        logBreadcrumb("Product loaded: " + menuItem.getName() + " (₹" + menuItem.getPrice() + ")");
        updateFavoriteIcon();
        checkFavoriteStatus();
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
        tvDescription.setText(menuItem.getDescription() != null && !menuItem.getDescription().isEmpty() ?
                menuItem.getDescription() : "Freshly prepared and made with authentic, delicious ingredients.");
        tvRestaurant.setText(menuItem.getRestaurantName() != null ? menuItem.getRestaurantName() : "AKR Hunger");

        int prepTime = menuItem.getPreparationTime() > 0 ? menuItem.getPreparationTime() : 25;
        tvPrepTime.setText(prepTime + " min");

        if (menuItem.getAverageRating() > 0) {
            int reviews = menuItem.getTotalReviews() > 0 ? menuItem.getTotalReviews() : 12;
            tvRating.setText(String.format(Locale.getDefault(), "%.1f (%d)", menuItem.getAverageRating(), reviews));
        } else {
            tvRating.setText("4.5 (15)");
        }

        // Veg / Non-Veg dot
        View vegDot = findViewById(R.id.veg_dot);
        if (vegDot != null) {
            vegDot.setBackgroundColor(getColor(menuItem.isVegetarian() ? R.color.veg_green : R.color.non_veg_red));
        }

        // Load image
        if (menuItem.getImage() != null && !menuItem.getImage().isEmpty()) {
            Glide.with(this).load(menuItem.getImage()).placeholder(R.drawable.bg_card_rounded).into(ivImage);
        }

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
                    menuItem.getRestaurantName() != null ? menuItem.getRestaurantName() : "AKR Hunger"
            );
            CartManager.getInstance(this).addItem(cartItem);

            analyticsHelper.logAddToCart(cartItem);
            logBreadcrumb("Added to cart: " + menuItem.getName() + " qty=" + quantity);

            Toast.makeText(this, "Added " + quantity + "x " + menuItem.getName() + " to cart! 🛒", Toast.LENGTH_SHORT).show();
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
                    if (isFinishing() || isDestroyed()) return;
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
        if (uid == null) {
            Toast.makeText(this, "Please sign in to save favorites", Toast.LENGTH_SHORT).show();
            return;
        }

        isFavorite = !isFavorite;
        updateFavoriteIcon();

        if (menuItem != null) {
            analyticsHelper.logFavoriteToggle(productId, menuItem.getName(), isFavorite);
            logBreadcrumb("Toggled favorite for " + menuItem.getName() + " -> " + isFavorite);
        }

        if (isFavorite) {
            db.collection(Constants.COLLECTION_CUSTOMERS).document(uid)
                    .update("favorites", FieldValue.arrayUnion(productId));
            Toast.makeText(this, "Added to favorites ❤️", Toast.LENGTH_SHORT).show();
        } else {
            db.collection(Constants.COLLECTION_CUSTOMERS).document(uid)
                    .update("favorites", FieldValue.arrayRemove(productId));
            Toast.makeText(this, "Removed from favorites", Toast.LENGTH_SHORT).show();
        }
    }

    private void updateFavoriteIcon() {
        ImageView ivFav = findViewById(R.id.iv_favorite);
        if (ivFav == null) {
            View view = findViewById(R.id.btn_favorite);
            if (view instanceof ImageView) {
                ivFav = (ImageView) view;
            } else if (view instanceof ViewGroup) {
                ViewGroup vg = (ViewGroup) view;
                for (int i = 0; i < vg.getChildCount(); i++) {
                    if (vg.getChildAt(i) instanceof ImageView) {
                        ivFav = (ImageView) vg.getChildAt(i);
                        break;
                    }
                }
            }
        }
        if (ivFav != null) {
            ivFav.setImageResource(isFavorite ? R.drawable.ic_nav_favorites_filled : R.drawable.ic_nav_favorites_outline);
            ivFav.setColorFilter(getColor(isFavorite ? R.color.error : R.color.text_hint));
        }
    }

    @Override
    protected String getScreenName() {
        return "ProductDetail_" + (menuItem != null ? menuItem.getName() : productId);
    }
}
