package com.ssr.hunger.activities;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.RadioGroup;
import android.widget.TextView;
import android.widget.Toast;
import androidx.viewpager2.widget.ViewPager2;
import com.google.android.material.textfield.TextInputEditText;
import com.ssr.hunger.R;
import com.ssr.hunger.adapters.ProductImageAdapter;
import com.ssr.hunger.models.CartItem;
import com.ssr.hunger.models.MenuItem;
import com.ssr.hunger.utils.CartManager;
import com.ssr.hunger.utils.Constants;
import com.bumptech.glide.Glide;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.FieldValue;
import com.google.firebase.firestore.FirebaseFirestore;
import java.util.ArrayList;
import java.util.List;
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
    private boolean isRestaurantOpen = true;

    // Image carousel
    private ViewPager2 vpProductImages;
    private LinearLayout llImageDots;
    private TextView tvImageCounter;
    private ProductImageAdapter imageAdapter;
    private final Handler autoSlideHandler = new Handler(Looper.getMainLooper());
    private Runnable autoSlideRunnable;
    private int currentImagePage = 0;

    // Customization state matching web app (all optional)
    private String selectedPortion = null;
    private double portionExtraPrice = 0.0;
    private String selectedSpice = null;
    private final List<MenuItem.CustomizationOption> selectedAddOns = new ArrayList<>();
    private int lastCheckedPortionId = -1;
    private int lastCheckedSpiceId = -1;
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
        if (rId != null && !rId.isEmpty()) {
            listenToRestaurantOperatingStatus(rId);
        }

        populateUI();
        analyticsHelper.logViewItem(menuItem);
        logBreadcrumb("Product loaded: " + menuItem.getName() + " (₹" + menuItem.getPrice() + ")");
        updateFavoriteIcon();
        checkFavoriteStatus();
    }

    private void listenToRestaurantOperatingStatus(String rId) {
        db.collection(Constants.COLLECTION_RESTAURANTS).document(rId)
                .addSnapshotListener((rDoc, error) -> {
                    if (error != null || rDoc == null || !rDoc.exists()) return;
                    com.ssr.hunger.models.Restaurant rest = rDoc.toObject(com.ssr.hunger.models.Restaurant.class);
                    if (rest != null) {
                        if (menuItem != null && (menuItem.getRestaurantName() == null || menuItem.getRestaurantName().isEmpty())) {
                            menuItem.setRestaurantName(rest.getName());
                            TextView tvRestaurant = findViewById(R.id.tv_product_restaurant);
                            if (tvRestaurant != null) {
                                tvRestaurant.setText(rest.getName());
                            }
                        }

                        isRestaurantOpen = rest.isOperatingNow();
                        updateOperatingStatusUI(isRestaurantOpen, rest.getName());
                    }
                });
    }

    private void updateOperatingStatusUI(boolean isOpen, String rName) {
        TextView btnAdd = findViewById(R.id.btn_add_to_cart);
        View btnBuyNow = findViewById(R.id.btn_buy_now);
        TextView tvSpiceSummary = findViewById(R.id.tv_bottom_spice_summary);

        if (!isOpen) {
            if (btnAdd != null) {
                btnAdd.setText("Closed");
                btnAdd.setAlpha(0.6f);
            }
            if (btnBuyNow != null) {
                btnBuyNow.setVisibility(View.GONE);
            }
            if (tvSpiceSummary != null) {
                tvSpiceSummary.setText("🔴 Restaurant is currently closed (Wishlist only)");
            }
        } else {
            if (btnAdd != null) {
                btnAdd.setText("Add to Cart");
                btnAdd.setAlpha(1.0f);
            }
            if (btnBuyNow != null) {
                btnBuyNow.setVisibility(View.VISIBLE);
            }
            updateSpiceSummaryDisplay();
        }
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

        // Load images carousel
        List<String> images = new ArrayList<>();
        if (menuItem.getImages() != null && !menuItem.getImages().isEmpty()) {
            images.addAll(menuItem.getImages());
        } else if (menuItem.getImage() != null && !menuItem.getImage().isEmpty()) {
            images.add(menuItem.getImage());
        }
        setupImageCarousel(images);

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

        // Optional Portion/Size Selector (tap again to deselect)
        RadioGroup rgPortion = findViewById(R.id.rg_portion);
        if (rgPortion != null) {
            rgPortion.clearCheck();
            View.OnClickListener portionToggle = v -> {
                int id = v.getId();
                if (lastCheckedPortionId == id) {
                    rgPortion.clearCheck();
                    lastCheckedPortionId = -1;
                    selectedPortion = null;
                    portionExtraPrice = 0.0;
                } else {
                    lastCheckedPortionId = id;
                    if (id == R.id.rb_portion_medium) {
                        selectedPortion = "Medium";
                        portionExtraPrice = 40.0;
                    } else if (id == R.id.rb_portion_large) {
                        selectedPortion = "Large";
                        portionExtraPrice = 80.0;
                    } else {
                        selectedPortion = "Regular";
                        portionExtraPrice = 0.0;
                    }
                }
                updatePriceDisplays();
                updateSpiceSummaryDisplay();
            };
            findViewById(R.id.rb_portion_regular).setOnClickListener(portionToggle);
            findViewById(R.id.rb_portion_medium).setOnClickListener(portionToggle);
            findViewById(R.id.rb_portion_large).setOnClickListener(portionToggle);
        }

        // Optional Spice Level Selector (tap again to deselect)
        RadioGroup rgSpice = findViewById(R.id.rg_spice);
        if (rgSpice != null) {
            rgSpice.clearCheck();
            View.OnClickListener spiceToggle = v -> {
                int id = v.getId();
                if (lastCheckedSpiceId == id) {
                    rgSpice.clearCheck();
                    lastCheckedSpiceId = -1;
                    selectedSpice = null;
                } else {
                    lastCheckedSpiceId = id;
                    if (id == R.id.rb_spice_mild) {
                        selectedSpice = "Mild";
                    } else if (id == R.id.rb_spice_hot) {
                        selectedSpice = "Hot";
                    } else if (id == R.id.rb_spice_extra) {
                        selectedSpice = "Extra Hot";
                    } else {
                        selectedSpice = "Medium";
                    }
                }
                updateSpiceSummaryDisplay();
            };
            findViewById(R.id.rb_spice_mild).setOnClickListener(spiceToggle);
            findViewById(R.id.rb_spice_medium).setOnClickListener(spiceToggle);
            findViewById(R.id.rb_spice_hot).setOnClickListener(spiceToggle);
            findViewById(R.id.rb_spice_extra).setOnClickListener(spiceToggle);
        }

        // Optional Add-ons & Extras Selector
        setupAddOnsSection();

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

    /** Sets up the ViewPager2 image carousel with dots and auto-slide. */
    private void setupImageCarousel(List<String> images) {
        vpProductImages = findViewById(R.id.vp_product_images);
        llImageDots = findViewById(R.id.ll_image_dots);
        tvImageCounter = findViewById(R.id.tv_image_counter);
        ImageView ivFallback = findViewById(R.id.iv_product_image);

        if (images.isEmpty()) {
            // Nothing to show
            return;
        }

        if (images.size() == 1) {
            // Single image — use the simple ImageView for efficiency
            if (ivFallback != null) {
                ivFallback.setVisibility(View.VISIBLE);
                if (vpProductImages != null) vpProductImages.setVisibility(View.GONE);
                Glide.with(this).load(images.get(0)).placeholder(R.drawable.bg_card_rounded).centerCrop().into(ivFallback);
            }
            return;
        }

        // Multiple images — use ViewPager2
        if (vpProductImages == null) return;
        if (ivFallback != null) ivFallback.setVisibility(View.GONE);
        vpProductImages.setVisibility(View.VISIBLE);

        imageAdapter = new ProductImageAdapter(this, images);
        vpProductImages.setAdapter(imageAdapter);

        // Dots indicator
        if (llImageDots != null) {
            llImageDots.removeAllViews();
            for (int i = 0; i < images.size(); i++) {
                View dot = new View(this);
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                        i == 0 ? dpToPx(20) : dpToPx(8), dpToPx(8));
                lp.setMargins(dpToPx(3), 0, dpToPx(3), 0);
                dot.setLayoutParams(lp);
                dot.setBackgroundResource(i == 0 ? R.drawable.dot_active : R.drawable.dot_inactive);
                llImageDots.addView(dot);
            }
        }

        // Counter badge
        if (tvImageCounter != null) {
            tvImageCounter.setVisibility(images.size() > 1 ? View.VISIBLE : View.GONE);
            tvImageCounter.setText("1/" + images.size());
        }

        // Page change listener — sync dots + counter
        vpProductImages.registerOnPageChangeCallback(new ViewPager2.OnPageChangeCallback() {
            @Override
            public void onPageSelected(int position) {
                currentImagePage = position;
                updateDots(position, images.size());
                if (tvImageCounter != null) {
                    tvImageCounter.setText((position + 1) + "/" + images.size());
                }
            }
        });

        // Full-screen preview on tap
        imageAdapter.setOnImageClickListener((position, url) -> {
            // Basic full-screen intent using the built-in image viewer
            // (can be replaced with a custom ZoomableImageActivity)
            Intent previewIntent = new Intent(this, FullScreenImageActivity.class);
            previewIntent.putStringArrayListExtra("images", new ArrayList<>(images));
            previewIntent.putExtra("position", position);
            startActivity(previewIntent);
        });

        // Auto-slide every 4 seconds
        autoSlideRunnable = () -> {
            if (!isFinishing() && !isDestroyed() && vpProductImages != null) {
                int next = (currentImagePage + 1) % images.size();
                vpProductImages.setCurrentItem(next, true);
                autoSlideHandler.postDelayed(autoSlideRunnable, 4000);
            }
        };
        autoSlideHandler.postDelayed(autoSlideRunnable, 4000);
    }

    private void updateDots(int selectedPos, int total) {
        if (llImageDots == null) return;
        for (int i = 0; i < llImageDots.getChildCount(); i++) {
            View dot = llImageDots.getChildAt(i);
            LinearLayout.LayoutParams lp = (LinearLayout.LayoutParams) dot.getLayoutParams();
            if (i == selectedPos) {
                lp.width = dpToPx(20);
                dot.setBackgroundResource(R.drawable.dot_active);
            } else {
                lp.width = dpToPx(8);
                dot.setBackgroundResource(R.drawable.dot_inactive);
            }
            dot.setLayoutParams(lp);
        }
    }

    private int dpToPx(int dp) {
        float density = getResources().getDisplayMetrics().density;
        return Math.round(dp * density);
    }

    private void setupAddOnsSection() {
        LinearLayout container = findViewById(R.id.ll_addons_container);
        if (container == null) return;
        container.removeAllViews();
        selectedAddOns.clear();

        List<MenuItem.CustomizationOption> options = new ArrayList<>();
        if (menuItem != null && menuItem.getAddOns() != null && !menuItem.getAddOns().isEmpty()) {
            options.addAll(menuItem.getAddOns());
        } else {
            options.add(new MenuItem.CustomizationOption("extra-cheese", "Extra Melted Cheese Slice", 25, ""));
            options.add(new MenuItem.CustomizationOption("peri-peri-fries", "Crispy Peri-Peri Fries", 49, ""));
            options.add(new MenuItem.CustomizationOption("onion-rings", "Crispy Fried Onion Rings", 35, ""));
            options.add(new MenuItem.CustomizationOption("jalapeno-dip", "Spicy Jalapeño Mayo Dip", 20, ""));
            options.add(new MenuItem.CustomizationOption("double-patty", "Extra Patty Upgrade", 59, ""));
            options.add(new MenuItem.CustomizationOption("beverage", "Chilled Soft Drink Can (330ml)", 39, ""));
        }

        for (MenuItem.CustomizationOption opt : options) {
            android.widget.CheckBox cb = new android.widget.CheckBox(this);
            String priceLabel = opt.getPrice() > 0
                    ? String.format(Locale.getDefault(), " (+₹%.0f)", opt.getPrice())
                    : " (Free)";
            cb.setText(opt.getName() + priceLabel);
            cb.setTextSize(13f);
            cb.setTextColor(getColor(R.color.text_primary));
            cb.setPadding(dpToPx(8), dpToPx(8), dpToPx(8), dpToPx(8));
            cb.setOnCheckedChangeListener((buttonView, isChecked) -> {
                if (isChecked) {
                    if (!selectedAddOns.contains(opt)) selectedAddOns.add(opt);
                } else {
                    selectedAddOns.remove(opt);
                }
                updatePriceDisplays();
                updateSpiceSummaryDisplay();
            });
            container.addView(cb);
        }
    }

    private double getSelectedAddOnsTotal() {
        double sum = 0.0;
        for (MenuItem.CustomizationOption opt : selectedAddOns) {
            if (opt != null) sum += opt.getPrice();
        }
        return sum;
    }

    private void updatePriceDisplays() {
        if (menuItem == null) return;
        double currentUnitPrice = menuItem.getPrice() + portionExtraPrice + getSelectedAddOnsTotal();
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
            List<String> parts = new ArrayList<>();
            if (selectedSpice != null) parts.add("🌶️ " + selectedSpice);
            if (selectedPortion != null) {
                parts.add(portionExtraPrice > 0
                        ? String.format(Locale.getDefault(), "%s (+₹%.0f)", selectedPortion, portionExtraPrice)
                        : selectedPortion);
            }
            if (!selectedAddOns.isEmpty()) {
                parts.add(String.format(Locale.getDefault(), "+%d Extras (+₹%.0f)", selectedAddOns.size(), getSelectedAddOnsTotal()));
            }
            tvSpiceSummary.setText(parts.isEmpty() ? "Standard Serving (Optional Extras)" : android.text.TextUtils.join(" • ", parts));
        }
    }

    private void performAddToCart(boolean isBuyNow) {
        if (menuItem == null) return;

        if (!isRestaurantOpen) {
            Toast.makeText(this, "🔴 Restaurant is currently closed! Ordering is paused, but you can add this item to your wishlist ❤️", Toast.LENGTH_LONG).show();
            return;
        }

        double basePrice = menuItem.getPrice();
        double addOnsTotal = getSelectedAddOnsTotal();
        double currentUnitPrice = basePrice + portionExtraPrice + addOnsTotal;

        CartItem cartItem = new CartItem(
                menuItem.getId(),
                menuItem.getRestaurantId(),
                menuItem.getName(),
                currentUnitPrice,
                quantity,
                menuItem.getImage(),
                menuItem.getRestaurantName() != null ? menuItem.getRestaurantName() : "AKR Hunger"
        );
        cartItem.setCategory(menuItem.getCategory());
        if (portionExtraPrice > 0 || !selectedAddOns.isEmpty()) {
            cartItem.setBasePrice(basePrice);
        }
        if (selectedSpice != null) {
            cartItem.setSpiceLevel(selectedSpice);
        }
        if (selectedPortion != null) {
            cartItem.setSelectedSize(new MenuItem.CustomizationOption(
                    selectedPortion.toLowerCase(Locale.ROOT),
                    selectedPortion,
                    portionExtraPrice,
                    ""
            ));
        }
        if (!selectedAddOns.isEmpty()) {
            cartItem.setSelectedAddOns(new ArrayList<>(selectedAddOns));
        }
        if (etCookingInstructions != null && etCookingInstructions.getText() != null) {
            String note = etCookingInstructions.getText().toString().trim();
            if (!note.isEmpty()) {
                cartItem.setSpecialInstructions(note);
            }
        }

        CartManager.getInstance(this).addItem(cartItem);
        analyticsHelper.logAddToCart(cartItem);
        logBreadcrumb("Added to cart: " + menuItem.getName() + " qty=" + quantity + " buyNow=" + isBuyNow);

        if (isBuyNow) {
            // Direct instant checkout navigation like website!
            Intent checkoutIntent = new Intent(this, CartActivity.class);
            startActivity(checkoutIntent);
        } else {
            Toast.makeText(this, String.format("Added %dx %s to cart! 🛒", quantity, menuItem.getName()), Toast.LENGTH_SHORT).show();
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
    protected void onDestroy() {
        super.onDestroy();
        // Stop auto-slide to prevent memory leaks
        autoSlideHandler.removeCallbacksAndMessages(null);
    }

    @Override
    protected String getScreenName() {
        return "ProductDetail_" + (menuItem != null ? menuItem.getName() : productId);
    }
}
