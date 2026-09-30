package com.ssr.hunger.activities;

import android.os.Bundle;
import android.text.TextUtils;
import android.view.View;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.RadioGroup;
import android.widget.TextView;
import android.widget.Toast;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import com.ssr.hunger.R;
import com.ssr.hunger.adapters.CartItemAdapter;
import com.ssr.hunger.models.CartItem;
import com.ssr.hunger.utils.CartManager;
import com.ssr.hunger.utils.Constants;
import com.ssr.hunger.utils.PerformanceHelper;
import com.google.firebase.Timestamp;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.perf.metrics.Trace;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Cart & Checkout Activity - mirrors the web app's cart page.
 * Extends BaseActivity for:
 * - Firebase Analytics (begin_checkout, purchase, remove_from_cart)
 * - Firebase Performance (checkout_process trace profiling)
 * - Firebase Crashlytics (order breadcrumbs, non-fatal exception tracking)
 * - Firebase Remote Config (dynamic delivery fee threshold and tax rate)
 */
public class CartActivity extends BaseActivity implements CartManager.CartChangeListener {

    private RecyclerView rvCartItems;
    private View emptyCart, cartContent;
    private TextView tvSubtotal, tvDeliveryFee, tvTaxes, tvTotal;
    private EditText etSpecialInstructions, etCoupon;
    private CartItemAdapter adapter;
    private CartManager cartManager;
    private FirebaseFirestore db;
    private String paymentMethod = "cod";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_cart);

        db = FirebaseFirestore.getInstance();
        cartManager = CartManager.getInstance(this);
        cartManager.addListener(this);

        initViews();
        setupRecyclerView();
        setupClickListeners();
        updateUI();

        // Log begin checkout if cart has items
        if (!cartManager.isEmpty()) {
            double subtotal = cartManager.getSubtotal();
            double threshold = remoteConfigHelper != null ? remoteConfigHelper.getFreeDeliveryThreshold() : 199.0;
            double fee = subtotal >= threshold ? 0 : (remoteConfigHelper != null ? remoteConfigHelper.getDeliveryFee() : 30.0);
            double taxRate = remoteConfigHelper != null ? remoteConfigHelper.getTaxRate() : Constants.TAX_RATE;
            double total = subtotal + fee + (subtotal * taxRate);
            analyticsHelper.logBeginCheckout(cartManager.getTotalItemCount(), total, paymentMethod);
        }
    }

    private void initViews() {
        rvCartItems = findViewById(R.id.rv_cart_items);
        emptyCart = findViewById(R.id.empty_cart);
        cartContent = findViewById(R.id.cart_content);
        tvSubtotal = findViewById(R.id.tv_subtotal);
        tvDeliveryFee = findViewById(R.id.tv_delivery_fee);
        tvTaxes = findViewById(R.id.tv_taxes);
        tvTotal = findViewById(R.id.tv_total);
        etSpecialInstructions = findViewById(R.id.et_special_instructions);
        etCoupon = findViewById(R.id.et_coupon);
    }

    private void setupRecyclerView() {
        adapter = new CartItemAdapter(cartManager.getItems(),
                // Remove item
                menuItemId -> {
                    CartItem removed = findCartItem(menuItemId);
                    if (removed != null) {
                        analyticsHelper.logRemoveFromCart(removed.getMenuItemId(), removed.getName(), removed.getPrice(), removed.getQuantity());
                        logBreadcrumb("Removed from cart: " + removed.getName());
                    }
                    cartManager.removeItem(menuItemId);
                    updateUI();
                },
                // Update quantity
                (menuItemId, quantity) -> {
                    cartManager.updateQuantity(menuItemId, quantity);
                    updateUI();
                }
        );
        rvCartItems.setLayoutManager(new LinearLayoutManager(this));
        rvCartItems.setAdapter(adapter);
    }

    private CartItem findCartItem(String menuItemId) {
        for (CartItem item : cartManager.getItems()) {
            if (item.getMenuItemId().equals(menuItemId)) return item;
        }
        return null;
    }

    private void setupClickListeners() {
        // Back button
        findViewById(R.id.btn_back).setOnClickListener(v -> finish());

        // Place order
        findViewById(R.id.btn_place_order).setOnClickListener(v -> placeOrder());

        // Payment method radio group
        RadioGroup rgPayment = findViewById(R.id.rg_payment);
        if (rgPayment != null) {
            rgPayment.setOnCheckedChangeListener((group, checkedId) -> {
                if (checkedId == R.id.rb_cod) paymentMethod = "cod";
                else if (checkedId == R.id.rb_online) paymentMethod = "online";
                else if (checkedId == R.id.rb_wallet) paymentMethod = "wallet";
                crashlyticsHelper.setCustomKey("selected_payment_method", paymentMethod);
                logBreadcrumb("Payment method changed to: " + paymentMethod);
            });
        }

        // Apply coupon code if entered
        View btnApplyCoupon = findViewById(R.id.btn_apply_coupon);
        if (btnApplyCoupon != null && etCoupon != null) {
            btnApplyCoupon.setOnClickListener(v -> {
                String coupon = etCoupon.getText().toString().trim().toUpperCase();
                if (!TextUtils.isEmpty(coupon)) {
                    boolean isValid = "HUNGER50".equals(coupon) || "WELCOME10".equals(coupon);
                    double discount = isValid ? 50.0 : 0.0;
                    analyticsHelper.logCouponApplied(coupon, isValid, discount);
                    logBreadcrumb("Coupon applied: " + coupon + " (valid=" + isValid + ")");
                    Toast.makeText(this, isValid ? "Coupon " + coupon + " applied! 🎉" : "Invalid coupon code", Toast.LENGTH_SHORT).show();
                }
            });
        }

        // Browse menu button in empty state
        View btnBrowse = findViewById(R.id.btn_browse_menu);
        if (btnBrowse != null) {
            btnBrowse.setOnClickListener(v -> finish());
        }
    }

    private void updateUI() {
        List<CartItem> items = cartManager.getItems();
        adapter.updateData(items);

        if (items.isEmpty()) {
            emptyCart.setVisibility(View.VISIBLE);
            cartContent.setVisibility(View.GONE);
            crashlyticsHelper.updateCartContext(0, 0, null);
        } else {
            emptyCart.setVisibility(View.GONE);
            cartContent.setVisibility(View.VISIBLE);

            double subtotal = cartManager.getSubtotal();
            // Use Firebase Remote Config threshold and fee
            double threshold = remoteConfigHelper != null ? remoteConfigHelper.getFreeDeliveryThreshold() : 199.0;
            double feeConfig = remoteConfigHelper != null ? remoteConfigHelper.getDeliveryFee() : 30.0;
            double taxRateConfig = remoteConfigHelper != null ? remoteConfigHelper.getTaxRate() : Constants.TAX_RATE;

            double deliveryFee = subtotal >= threshold ? 0 : feeConfig;
            double taxes = subtotal * taxRateConfig;
            double total = subtotal + deliveryFee + taxes;

            tvSubtotal.setText(String.format(Locale.getDefault(), "₹%.0f", subtotal));
            tvDeliveryFee.setText(deliveryFee == 0 ? "FREE" : String.format(Locale.getDefault(), "₹%.0f", deliveryFee));
            tvTaxes.setText(String.format(Locale.getDefault(), "₹%.0f", taxes));
            tvTotal.setText(String.format(Locale.getDefault(), "₹%.0f", total));

            crashlyticsHelper.updateCartContext(cartManager.getTotalItemCount(), subtotal, cartManager.getRestaurantId());
        }
    }

    private void placeOrder() {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) {
            Toast.makeText(this, "Please login first", Toast.LENGTH_SHORT).show();
            return;
        }

        List<CartItem> items = cartManager.getItems();
        if (items.isEmpty()) return;

        // Firebase Performance - Profile the checkout order submission
        Trace checkoutTrace = startTrace(PerformanceHelper.TRACE_CHECKOUT_PROCESS);

        double subtotal = cartManager.getSubtotal();
        double threshold = remoteConfigHelper != null ? remoteConfigHelper.getFreeDeliveryThreshold() : 199.0;
        double feeConfig = remoteConfigHelper != null ? remoteConfigHelper.getDeliveryFee() : 30.0;
        double taxRateConfig = remoteConfigHelper != null ? remoteConfigHelper.getTaxRate() : Constants.TAX_RATE;

        double deliveryFee = subtotal >= threshold ? 0 : feeConfig;
        double taxes = subtotal * taxRateConfig;
        double total = subtotal + deliveryFee + taxes;
        String restaurantName = items.get(0).getRestaurantName();

        if (checkoutTrace != null) {
            performanceHelper.putMetric(checkoutTrace, "item_count", items.size());
            performanceHelper.putMetric(checkoutTrace, "order_total", (long) total);
            performanceHelper.putAttribute(checkoutTrace, "payment_method", paymentMethod);
        }

        logBreadcrumb("Placing order: total=₹" + total + " method=" + paymentMethod + " items=" + items.size());

        // Build order items list
        List<Map<String, Object>> orderItems = new ArrayList<>();
        for (CartItem cartItem : items) {
            Map<String, Object> oi = new HashMap<>();
            oi.put("menuItemId", cartItem.getMenuItemId());
            oi.put("name", cartItem.getName());
            oi.put("price", cartItem.getPrice());
            oi.put("quantity", cartItem.getQuantity());
            oi.put("image", cartItem.getImage());
            orderItems.add(oi);
        }

        // Build order document
        Map<String, Object> orderData = new HashMap<>();
        orderData.put("customerId", user.getUid());
        orderData.put("restaurantId", cartManager.getRestaurantId());
        orderData.put("restaurantName", restaurantName != null ? restaurantName : "Restaurant");
        orderData.put("items", orderItems);
        orderData.put("status", "pending");
        orderData.put("paymentMethod", paymentMethod);
        orderData.put("paymentStatus", "cod".equals(paymentMethod) ? "pending" : "pending");
        orderData.put("subtotal", subtotal);
        orderData.put("deliveryCharge", deliveryFee);
        orderData.put("taxes", taxes);
        orderData.put("total", total);
        orderData.put("specialInstructions", etSpecialInstructions.getText().toString().trim());
        orderData.put("customerName", user.getDisplayName() != null ? user.getDisplayName() : "Customer");
        orderData.put("customerPhone", "");
        orderData.put("createdAt", Timestamp.now());

        // Disable button to prevent double-tap
        findViewById(R.id.btn_place_order).setEnabled(false);

        db.collection(Constants.COLLECTION_ORDERS)
                .add(orderData)
                .addOnSuccessListener(docRef -> {
                    stopTrace(checkoutTrace);

                    // Firebase Analytics - Log eCommerce Purchase event
                    analyticsHelper.logPurchase(
                            docRef.getId(),
                            items,
                            subtotal,
                            deliveryFee,
                            taxes,
                            total,
                            paymentMethod,
                            restaurantName
                    );

                    logBreadcrumb("Order confirmed successfully in Firestore: " + docRef.getId());
                    cartManager.clearCart();
                    Toast.makeText(this, "Order placed successfully! 🎉", Toast.LENGTH_LONG).show();
                    finish();
                })
                .addOnFailureListener(e -> {
                    stopTrace(checkoutTrace);
                    recordException("placeOrder_Firestore_Error", e);
                    Toast.makeText(this, "Failed to place order: " + e.getMessage(), Toast.LENGTH_LONG).show();
                    findViewById(R.id.btn_place_order).setEnabled(true);
                });
    }

    @Override
    public void onCartChanged(List<CartItem> items, int totalCount, double subtotal) {
        runOnUiThread(this::updateUI);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        cartManager.removeListener(this);
    }

    @Override
    protected String getScreenName() {
        return "Cart_Checkout";
    }
}
