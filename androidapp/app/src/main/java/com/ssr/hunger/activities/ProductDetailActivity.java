package com.ssr.hunger.activities;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.RadioGroup;
import android.widget.TextView;
import android.widget.Toast;
import com.google.android.material.textfield.TextInputEditText;
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
 * portion size selector, spice level preference, special cooking instructions,
 * quantity stepper, Add to Cart button, and direct Buy Now instant checkout.
 */
public class ProductDetailActivity extends BaseActivity {

    private FirebaseFirestore db;
    private MenuItem menuItem;
    private String productId;
    private String passedRestaurantId;
    private int quantity = 1;
    private boolean isFavorite = false;

    // Customization state matching web app
    private String selectedPortion = "Regular";
    private double portionExtraPrice = 0.0;
    private String selectedSpice = "Medium";
    private TextInputEditText etCookingInstructions;

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
        etCookingInstructions = findViewById(R.id.et_cooking_instructions);

        tvName.setText(menuItem.getName());
        tvPrice.setText(String.format(Locale.getDefault(), "₹%.0f", menuItem.getPrice()));
        tvDescription.setText(menuItem.getDescription() != null && !menuItem.getDescription().isEmpty() ?
                menuItem.getDescription() : "Freshly prepared and made with authentic, delicious ingredients.");
        tvRestaurant.setText(menuItem.getRestaurantName() != null ? menuItem.getRestaurantName() : "AKR Hunger");

        // Clickable restaurant header to view store profile
        View rowRestaurant = findViewById(R.id.row_restaurant_header);
        if (rowRestaurant != null) {
            rowRestaurant.setOnClickListener(v -> {
                String rId = menuItem.getRestaurantId() != null ? menuItem.getRestaurantId() : passedRestaurantId;
                if (rId != null && !rId.isEmpty()) {
                    Intent rIntent = new Intent(this, RestaurantDetailActivity.class);
                    rIntent.putExtra(Constants.EXTRA_RESTAURANT_ID, rId);
                    startActivity(rIntent);
                }
            });
        }

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
                updatePriceDisplays();
            }
        });

        findViewById(R.id.btn_plus).setOnClickListener(v -> {
            quantity++;
            tvQuantity.setText(String.valueOf(quantity));
            updatePriceDisplays();
        });

        // Portion Selector
        RadioGroup rgPortion = findViewById(R.id.rg_portion);
        if (rgPortion != null) {
            rgPortion.setOnCheckedChangeListener((group, checkedId) -> {
                if (checkedId == R.id.rb_portion_medium) {
                    selectedPortion = "Medium";
                    portionExtraPrice = 40.0;
                } else if (checkedId == R.id.rb_portion_large) {
                    selectedPortion = "Large";
                    portionExtraPrice = 80.0;
                } else {
                    selectedPortion = "Regular";
                    portionExtraPrice = 0.0;
                }
                updatePriceDisplays();
            });
        }

        // Spice Level Selector
        RadioGroup rgSpice = findViewById(R.id.rg_spice);
        if (rgSpice != null) {
            rgSpice.setOnCheckedChangeListener((group, checkedId) -> {
                if (checkedId == R.id.rb_spice_mild) {
                    selectedSpice = "Mild";
                } else if (checkedId == R.id.rb_spice_hot) {
                    selectedSpice = "Hot";
                } else if (checkedId == R.id.rb_spice_extra) {
                    selectedSpice = "Extra Spicy";
                } else {
                    selectedSpice = "Medium";
                }
                updateSpiceSummaryDisplay();
            });
        }

        // Add to Cart button
        findViewById(R.id.btn_add_to_cart).setOnClickListener(v -> performAddToCart(false));

        // Buy Now direct checkout button (Mirroring Web App)
        View btnBuyNow = findViewById(R.id.btn_buy_now);
        if (btnBuyNow != null) {
            btnBuyNow.setOnClickListener(v -> performAddToCart(true));
        }

        // Share Dish button
        View btnShare = findViewById(R.id.btn_share);
        if (btnShare != null) {
            btnShare.setOnClickListener(v -> shareProduct());
        }

        // Favorite toggle
        findViewById(R.id.btn_favorite).setOnClickListener(v -> toggleFavorite());

        updatePriceDisplays();
        updateSpiceSummaryDisplay();
    }

    private void updatePriceDisplays() {
        if (menuItem == null) return;
        double currentUnitPrice = menuItem.getPrice() + portionExtraPrice;
        double totalPrice = currentUnitPrice * quantity;

        // Header Base Price
        TextView tvPrice = findViewById(R.id.tv_product_price);
        if (tvPrice != null) {
            tvPrice.setText(String.format(Locale.getDefault(), "₹%.0f", currentUnitPrice));
        }

        // Bottom Bar Total Price
        TextView tvBottomTotal = findViewById(R.id.tv_bottom_total_price);
        if (tvBottomTotal != null) {
            tvBottomTotal.setText(String.format(Locale.getDefault(), "₹%.0f", totalPrice));
        }

        // Add to cart button label
        TextView btnAdd = findViewById(R.id.btn_add_to_cart);
        if (btnAdd != null) {
            btnAdd.setText("Add to Cart");
        }
    }

    private void updateSpiceSummaryDisplay() {
        TextView tvSpiceSummary = findViewById(R.id.tv_bottom_spice_summary);
        if (tvSpiceSummary != null) {
            String portionText = "Regular".equals(selectedPortion) ? "" : " • " + selectedPortion;
            tvSpiceSummary.setText(String.format("%s Spice%s", selectedSpice, portionText));
        }
    }

    private void performAddToCart(boolean isBuyNow) {
        if (menuItem == null) return;

        double currentUnitPrice = menuItem.getPrice() + portionExtraPrice;

        // Assemble special instructions matching Web App ProductClient.tsx lines 326-343
        StringBuilder instructions = new StringBuilder();
        instructions.append("Spice Preference: ").append(selectedSpice);
        if (!"Regular".equals(selectedPortion)) {
            instructions.append(" | Portion: ").append(selectedPortion)
                    .append(portionExtraPrice > 0 ? String.format(Locale.getDefault(), " (+₹%.0f)", portionExtraPrice) : "");
        }
        if (etCookingInstructions != null && etCookingInstructions.getText() != null) {
            String note = etCookingInstructions.getText().toString().trim();
            if (!note.isEmpty()) {
                instructions.append(" | Note: ").append(note);
            }
        }

        String itemName = !"Regular".equals(selectedPortion)
                ? String.format("%s (%s)", menuItem.getName(), selectedPortion)
                : menuItem.getName();

        CartItem cartItem = new CartItem(
                menuItem.getId(),
                menuItem.getRestaurantId(),
                itemName,
                currentUnitPrice,
                quantity,
                menuItem.getImage(),
                menuItem.getRestaurantName() != null ? menuItem.getRestaurantName() : "AKR Hunger"
        );
        cartItem.setCategory(menuItem.getCategory());
        cartItem.setSpecialInstructions(instructions.toString());

        CartManager.getInstance(this).addItem(cartItem);
        analyticsHelper.logAddToCart(cartItem);
        logBreadcrumb("Added to cart: " + itemName + " qty=" + quantity + " buyNow=" + isBuyNow);

        if (isBuyNow) {
            // Direct instant checkout navigation like website!
            Intent checkoutIntent = new Intent(this, CartActivity.class);
            startActivity(checkoutIntent);
        } else {
            Toast.makeText(this, String.format("Added %dx %s to cart! 🛒", quantity, itemName), Toast.LENGTH_SHORT).show();
        }
    }

    private void shareProduct() {
        if (menuItem == null) return;
        try {
            Intent shareIntent = new Intent(Intent.ACTION_SEND);
            shareIntent.setType("text/plain");
            String shareMessage = String.format("Check out %s on Hunger Food Delivery! Only ₹%.0f\nFast 30-min doorstep delivery.",
                    menuItem.getName(), menuItem.getPrice());
            shareIntent.putExtra(Intent.EXTRA_SUBJECT, menuItem.getName());
            shareIntent.putExtra(Intent.EXTRA_TEXT, shareMessage);
            startActivity(Intent.createChooser(shareIntent, "Share dish via"));
        } catch (Exception e) {
            recordException("shareProduct_error", e);
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
