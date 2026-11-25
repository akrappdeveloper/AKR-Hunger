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
import com.ssr.hunger.utils.NotificationHelper;
import com.ssr.hunger.utils.PerformanceHelper;
import com.ssr.hunger.models.Address;
import com.ssr.hunger.dialogs.DeliveryLocationDialog;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.Query;
import com.google.firebase.Timestamp;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.perf.metrics.Trace;
import com.google.firebase.firestore.FieldValue;
import com.google.firebase.firestore.WriteBatch;
import com.google.firebase.firestore.DocumentReference;
import com.google.android.material.dialog.MaterialAlertDialogBuilder;
import com.ssr.hunger.dialogs.ModernDialogHelper;
import com.razorpay.Checkout;
import com.razorpay.PaymentResultListener;
import org.json.JSONObject;
import android.location.Geocoder;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationServices;
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
public class CartActivity extends BaseActivity implements CartManager.CartChangeListener, PaymentResultListener {

    private RecyclerView rvCartItems;
    private View emptyCart, cartContent;
    private TextView tvSubtotal, tvBaseSubtotal, tvSizeExtras, tvAddOnsExtras, tvPackagingCharges, tvDeliveryFee, tvPlatformFee, tvTaxableValue, tvCgst, tvSgst, tvTotal, tvAmountPaid, tvBalanceDue;
    private View rowBaseSubtotal, rowSizeExtras, rowAddOnsExtras;
    private EditText etSpecialInstructions, etCoupon;
    private CartItemAdapter adapter;
    private CartManager cartManager;
    private FirebaseFirestore db;
    private String paymentMethod = "cod";
    private String cachedCustomerPhone = "";
    private static final int REQ_BIOMETRIC_CHECKOUT = 5001;
    private boolean isBiometricUnlockedForSession = false;

    // Delivery Address Views
    private View cardDeliveryAddress, layoutSelectedAddress, layoutNoAddress;
    private TextView tvCartAddressEmoji, tvCartAddressType, tvCartAddressTitle, tvCartAddressFull;
    private View btnChangeAddress;

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
        checkAndLoadDeliveryAddress();
        loadCustomerPhone();
        updateUI();

        // Log begin checkout if cart has items
        if (!cartManager.isEmpty()) {
            double subtotal = cartManager.getSubtotal();
            int totalQty = 0;
            for (CartItem ci : cartManager.getItems()) {
                totalQty += ci.getQuantity();
            }
            double fee = totalQty > 1 ? 60.0 : 40.0;
            double taxRate = 0.05; // 5% GST (2.5% CGST + 2.5% SGST)
            double total = subtotal + fee + (subtotal * taxRate);
            analyticsHelper.logBeginCheckout(cartManager.getTotalItemCount(), total, paymentMethod);
        }

        // If delivery address has no pincode, try to auto-detect via GPS
        tryAutoFillPincodeFromGps();

        // Apply defaults from user settings
        applyUserSettingsDefaults();
    }

    private void applyUserSettingsDefaults() {
        if (etSpecialInstructions != null && TextUtils.isEmpty(etSpecialInstructions.getText())) {
            StringBuilder sb = new StringBuilder();
            String deliveryPreset = com.ssr.hunger.utils.SettingsHelper.getDeliveryPreset(this);
            if (!TextUtils.isEmpty(deliveryPreset)) {
                sb.append(deliveryPreset);
            }
            String cookingInstruction = com.ssr.hunger.utils.SettingsHelper.getCookingInstruction(this);
            if (!TextUtils.isEmpty(cookingInstruction) && !cookingInstruction.contains("Standard")) {
                if (sb.length() > 0) sb.append(" • ");
                sb.append(cookingInstruction);
            }
            if (com.ssr.hunger.utils.SettingsHelper.isEcoCutlery(this)) {
                if (sb.length() > 0) sb.append(" • ");
                sb.append("Skip plastic cutlery 🌿");
            }
            etSpecialInstructions.setText(sb.toString());
        }

        if (com.ssr.hunger.utils.SettingsHelper.isAutoCouponEnabled(this) && etCoupon != null && TextUtils.isEmpty(etCoupon.getText())) {
            etCoupon.setText("HUNGER50");
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        checkAndLoadDeliveryAddress();
        loadCustomerPhone();
    }

    private String resolveValidPhone(String... candidates) {
        if (candidates == null) return "";
        for (String candidate : candidates) {
            if (TextUtils.isEmpty(candidate)) continue;
            String digits = candidate.replaceAll("\\D", "");
            if (digits.length() >= 10) {
                return candidate.trim();
            }
        }
        return "";
    }

    private void loadCustomerPhone() {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) return;
        String authPhone = resolveValidPhone(user.getPhoneNumber());
        if (!TextUtils.isEmpty(authPhone)) {
            cachedCustomerPhone = authPhone;
        }
        db.collection(Constants.COLLECTION_CUSTOMERS).document(user.getUid()).get()
                .addOnSuccessListener(doc -> {
                    if (doc != null && doc.exists()) {
                        String dbPhone = resolveValidPhone(doc.getString("phone"));
                        if (!TextUtils.isEmpty(dbPhone)) {
                            cachedCustomerPhone = dbPhone;
                        }
                    }
                });
    }

    private void promptForPhoneAndPlaceOrder(Address deliveryAddress) {
        android.widget.EditText input = new android.widget.EditText(this);
        input.setInputType(android.text.InputType.TYPE_CLASS_PHONE);
        input.setHint("Enter 10-digit mobile number");
        int pad = (int) (20 * getResources().getDisplayMetrics().density);
        android.widget.FrameLayout container = new android.widget.FrameLayout(this);
        container.setPadding(pad, pad / 2, pad, 0);
        container.addView(input);

        new MaterialAlertDialogBuilder(this)
                .setTitle("📱 Phone Number Required")
                .setMessage("Contact phone number is mandatory to place your order.")
                .setView(container)
                .setPositiveButton("Save & Continue", (dialog, which) -> {
                    String rawDigits = input.getText() != null ? input.getText().toString().replaceAll("\\D", "") : "";
                    if (rawDigits.length() < 10) {
                        Toast.makeText(this, "⚠️ Please enter a valid 10-digit mobile number.", Toast.LENGTH_LONG).show();
                        return;
                    }
                    String last10 = rawDigits.substring(rawDigits.length() - 10);
                    String formatted = "+91 " + last10.substring(0, 5) + " " + last10.substring(5);
                    cachedCustomerPhone = formatted;
                    FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
                    if (user != null) {
                        Map<String, Object> updates = new HashMap<>();
                        updates.put("phone", formatted);
                        db.collection(Constants.COLLECTION_CUSTOMERS).document(user.getUid())
                                .set(updates, com.google.firebase.firestore.SetOptions.merge());
                    }
                    continuePlaceOrderAfterPhoneCheck(deliveryAddress);
                })
                .setNegativeButton("Cancel", null)
                .show();
    }

    private void initViews() {
        rvCartItems = findViewById(R.id.rv_cart_items);
        emptyCart = findViewById(R.id.empty_cart);
        cartContent = findViewById(R.id.cart_content);
        tvSubtotal = findViewById(R.id.tv_subtotal);
        rowBaseSubtotal = findViewById(R.id.row_base_subtotal);
        rowSizeExtras = findViewById(R.id.row_size_extras);
        rowAddOnsExtras = findViewById(R.id.row_addons_extras);
        tvBaseSubtotal = findViewById(R.id.tv_base_subtotal);
        tvSizeExtras = findViewById(R.id.tv_size_extras);
        tvAddOnsExtras = findViewById(R.id.tv_addons_extras);
        tvPackagingCharges = findViewById(R.id.tv_packaging_charges);
        tvDeliveryFee = findViewById(R.id.tv_delivery_fee);
        tvPlatformFee = findViewById(R.id.tv_platform_fee);
        tvTaxableValue = findViewById(R.id.tv_taxable_value);
        tvCgst = findViewById(R.id.tv_cgst);
        tvSgst = findViewById(R.id.tv_sgst);
        tvTotal = findViewById(R.id.tv_total);
        tvAmountPaid = findViewById(R.id.tv_amount_paid);
        tvBalanceDue = findViewById(R.id.tv_balance_due);
        etSpecialInstructions = findViewById(R.id.et_special_instructions);
        etCoupon = findViewById(R.id.et_coupon);

        // Address views
        cardDeliveryAddress = findViewById(R.id.card_delivery_address);
        layoutSelectedAddress = findViewById(R.id.layout_selected_address);
        layoutNoAddress = findViewById(R.id.layout_no_address);
        tvCartAddressEmoji = findViewById(R.id.tv_cart_address_emoji);
        tvCartAddressType = findViewById(R.id.tv_cart_address_type);
        tvCartAddressTitle = findViewById(R.id.tv_cart_address_title);
        tvCartAddressFull = findViewById(R.id.tv_cart_address_full);
        btnChangeAddress = findViewById(R.id.btn_change_address);
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

    private CartItem findCartItem(String itemKey) {
        for (CartItem item : cartManager.getItems()) {
            if ((item.getId() != null && item.getId().equals(itemKey))
                    || (item.getMenuItemId() != null && item.getMenuItemId().equals(itemKey))) {
                return item;
            }
        }
        return null;
    }

    private void setupClickListeners() {
        // Back button
        findViewById(R.id.btn_back).setOnClickListener(v -> finish());

        // Delivery address click listeners
        if (cardDeliveryAddress != null) cardDeliveryAddress.setOnClickListener(v -> openAddressSelector());
        if (btnChangeAddress != null) btnChangeAddress.setOnClickListener(v -> openAddressSelector());
        if (layoutNoAddress != null) layoutNoAddress.setOnClickListener(v -> openAddressSelector());

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
            double baseSubtotal = 0.0;
            double sizeExtrasTotal = 0.0;
            double addOnsExtrasTotal = 0.0;
            int totalQty = 0;
            for (CartItem ci : items) {
                int qty = ci.getQuantity();
                totalQty += qty;
                baseSubtotal += ci.getEffectiveBasePrice() * qty;
                sizeExtrasTotal += ci.getSizeExtra() * qty;
                addOnsExtrasTotal += ci.getAddOnsTotal() * qty;
            }
            boolean hasExtras = (sizeExtrasTotal + addOnsExtrasTotal) > 0;
            if (rowBaseSubtotal != null) rowBaseSubtotal.setVisibility(hasExtras ? View.VISIBLE : View.GONE);
            if (tvBaseSubtotal != null && hasExtras) tvBaseSubtotal.setText(String.format(Locale.getDefault(), "₹%.2f", baseSubtotal));
            if (rowSizeExtras != null) rowSizeExtras.setVisibility(sizeExtrasTotal > 0 ? View.VISIBLE : View.GONE);
            if (tvSizeExtras != null && sizeExtrasTotal > 0) tvSizeExtras.setText(String.format(Locale.getDefault(), "+₹%.2f", sizeExtrasTotal));
            if (rowAddOnsExtras != null) rowAddOnsExtras.setVisibility(addOnsExtrasTotal > 0 ? View.VISIBLE : View.GONE);
            if (tvAddOnsExtras != null && addOnsExtrasTotal > 0) tvAddOnsExtras.setText(String.format(Locale.getDefault(), "+₹%.2f", addOnsExtrasTotal));
            double deliveryFee = totalQty > 1 ? 60.0 : 40.0;
            double packagingCharges = 0.0;
            double platformFee = 0.0;
            double taxableValue = subtotal;
            double cgst = Math.round(taxableValue * 0.025 * 100.0) / 100.0;
            double sgst = Math.round(taxableValue * 0.025 * 100.0) / 100.0;
            double taxes = cgst + sgst;
            double total = subtotal + packagingCharges + deliveryFee + platformFee + taxes;
            double amountPaid = "cod".equals(paymentMethod) ? 0.0 : total;
            double balanceDue = "cod".equals(paymentMethod) ? total : 0.0;

            tvSubtotal.setText(String.format(Locale.getDefault(), "₹%.2f", subtotal));
            if (tvPackagingCharges != null) tvPackagingCharges.setText(String.format(Locale.getDefault(), "₹%.2f", packagingCharges));
            tvDeliveryFee.setText(String.format(Locale.getDefault(), "₹%.2f", deliveryFee));
            if (tvPlatformFee != null) tvPlatformFee.setText(String.format(Locale.getDefault(), "₹%.2f", platformFee));
            if (tvTaxableValue != null) tvTaxableValue.setText(String.format(Locale.getDefault(), "₹%.2f", taxableValue));
            if (tvCgst != null) tvCgst.setText(String.format(Locale.getDefault(), "₹%.2f", cgst));
            if (tvSgst != null) tvSgst.setText(String.format(Locale.getDefault(), "₹%.2f", sgst));
            tvTotal.setText(String.format(Locale.getDefault(), "₹%.2f", total));
            if (tvAmountPaid != null) tvAmountPaid.setText(String.format(Locale.getDefault(), "₹%.2f", amountPaid));
            if (tvBalanceDue != null) tvBalanceDue.setText(String.format(Locale.getDefault(), "₹%.2f", balanceDue));

            crashlyticsHelper.updateCartContext(cartManager.getTotalItemCount(), subtotal, cartManager.getRestaurantId());
        }
    }

    private void openAddressSelector() {
        DeliveryLocationDialog dialog = new DeliveryLocationDialog();
        dialog.setOnAddressSelectedListener(address -> {
            if (address != null) {
                cartManager.setDeliveryAddress(address);
                updateAddressUI();
                Toast.makeText(this, "📍 Delivery address selected", Toast.LENGTH_SHORT).show();
            }
        });
        dialog.show(getSupportFragmentManager(), "delivery_address_dialog");
    }

    private void checkAndLoadDeliveryAddress() {
        Address current = cartManager.getDeliveryAddress();
        if (current != null && !TextUtils.isEmpty(current.getStreet())) {
            updateAddressUI();
            return;
        }

        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user != null) {
            db.collection(Constants.COLLECTION_USERS)
                    .document(user.getUid())
                    .collection("addresses")
                    .orderBy("isDefault", Query.Direction.DESCENDING)
                    .limit(1)
                    .get()
                    .addOnSuccessListener(snap -> {
                        if (snap != null && !snap.isEmpty()) {
                            DocumentSnapshot doc = snap.getDocuments().get(0);
                            Address addr = new Address();
                            addr.setId(doc.getId());
                            String line1 = doc.getString("addressLine1");
                            if (line1 == null) line1 = doc.getString("street");
                            addr.setStreet(line1);
                            addr.setCity(doc.getString("city"));
                            addr.setState(doc.getString("state"));
                            addr.setPincode(doc.getString("pincode"));
                            addr.setLandmark(doc.getString("landmark"));
                            addr.setType(doc.getString("type"));
                            Boolean def = doc.getBoolean("isDefault");
                            if (def != null) addr.setDefault(def);
                            cartManager.setDeliveryAddress(addr);
                        }
                        updateAddressUI();
                    })
                    .addOnFailureListener(e -> updateAddressUI());
        } else {
            updateAddressUI();
        }
    }

    private void updateAddressUI() {
        Address addr = cartManager.getDeliveryAddress();
        boolean hasAddr = addr != null && (!TextUtils.isEmpty(addr.getStreet()) || !TextUtils.isEmpty(addr.getCity()));

        if (layoutSelectedAddress != null) {
            layoutSelectedAddress.setVisibility(hasAddr ? View.VISIBLE : View.GONE);
        }
        if (layoutNoAddress != null) {
            layoutNoAddress.setVisibility(hasAddr ? View.GONE : View.VISIBLE);
        }
        if (btnChangeAddress instanceof com.google.android.material.button.MaterialButton) {
            ((com.google.android.material.button.MaterialButton) btnChangeAddress).setText(hasAddr ? "Change" : "Select");
        } else if (btnChangeAddress instanceof TextView) {
            ((TextView) btnChangeAddress).setText(hasAddr ? "Change" : "Select");
        }

        if (hasAddr) {
            String type = addr.getType() != null ? addr.getType() : "home";
            if (tvCartAddressEmoji != null) {
                if ("home".equalsIgnoreCase(type)) tvCartAddressEmoji.setText("🏠");
                else if ("work".equalsIgnoreCase(type)) tvCartAddressEmoji.setText("💼");
                else tvCartAddressEmoji.setText("📍");
            }
            if (tvCartAddressType != null) {
                tvCartAddressType.setText(type.toUpperCase());
            }
            if (tvCartAddressTitle != null) {
                tvCartAddressTitle.setText(addr.getCity() != null ? addr.getCity() : type.toUpperCase());
            }
            if (tvCartAddressFull != null) {
                StringBuilder sb = new StringBuilder();
                if (!TextUtils.isEmpty(addr.getStreet())) sb.append(addr.getStreet());
                if (!TextUtils.isEmpty(addr.getLandmark())) sb.append(", near ").append(addr.getLandmark());
                if (!TextUtils.isEmpty(addr.getCity())) sb.append(", ").append(addr.getCity());
                if (!TextUtils.isEmpty(addr.getState())) sb.append(", ").append(addr.getState());
                if (!TextUtils.isEmpty(addr.getPincode())) sb.append(" - ").append(addr.getPincode());
                tvCartAddressFull.setText(sb.toString());
            }
        } else {
            if (tvCartAddressEmoji != null) tvCartAddressEmoji.setText("📍");
        }
    }

    // Online Payment (Razorpay) Pending State
    private Map<String, Object> pendingOrderData;
    private String pendingOrderId;
    private double pendingOrderTotal;
    private List<CartItem> pendingOrderItems;
    private double pendingSubtotal;
    private double pendingDeliveryFee;
    private double pendingTaxes;
    private String pendingRestaurantName;
    private Trace pendingCheckoutTrace;

    private void placeOrder() {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) {
            Toast.makeText(this, "Please login first", Toast.LENGTH_SHORT).show();
            return;
        }

        List<CartItem> items = cartManager.getItems();
        if (items.isEmpty()) return;

        // Biometric / Screen Lock verification if enabled in Settings
        if (com.ssr.hunger.utils.SettingsHelper.isBiometricLockEnabled(this) && !isBiometricUnlockedForSession) {
            android.app.KeyguardManager km = (android.app.KeyguardManager) getSystemService(android.content.Context.KEYGUARD_SERVICE);
            if (km != null && km.isDeviceSecure() && android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
                android.content.Intent confirmIntent = km.createConfirmDeviceCredentialIntent("AKR Hunger Checkout 🔒", "Confirm screen lock to authorize food order");
                if (confirmIntent != null) {
                    startActivityForResult(confirmIntent, REQ_BIOMETRIC_CHECKOUT);
                    return;
                }
            }
        }

        // Strict Delivery Address Validation: Order CANNOT be placed without delivery address!
        Address deliveryAddress = cartManager.getDeliveryAddress();
        if (deliveryAddress == null || (TextUtils.isEmpty(deliveryAddress.getStreet()) && TextUtils.isEmpty(deliveryAddress.getCity()))) {
            Toast.makeText(this, "⚠️ Delivery address is required! Please select or add an address.", Toast.LENGTH_LONG).show();
            openAddressSelector();
            return;
        }

        // Strict Phone Number Validation: Order CANNOT be placed without a 10-digit phone number!
        String verifiedPhone = resolveValidPhone(cachedCustomerPhone, user.getPhoneNumber());
        if (TextUtils.isEmpty(verifiedPhone)) {
            findViewById(R.id.btn_place_order).setEnabled(false);
            db.collection(Constants.COLLECTION_CUSTOMERS).document(user.getUid()).get()
                    .addOnSuccessListener(custDoc -> runOnUiThread(() -> {
                        findViewById(R.id.btn_place_order).setEnabled(true);
                        String dbPhone = custDoc != null && custDoc.exists() ? resolveValidPhone(custDoc.getString("phone")) : "";
                        if (!TextUtils.isEmpty(dbPhone)) {
                            cachedCustomerPhone = dbPhone;
                            continuePlaceOrderAfterPhoneCheck(deliveryAddress);
                        } else {
                            Toast.makeText(this, "⚠️ Phone number is required! Please add your mobile number.", Toast.LENGTH_LONG).show();
                            promptForPhoneAndPlaceOrder(deliveryAddress);
                        }
                    }))
                    .addOnFailureListener(e -> runOnUiThread(() -> {
                        findViewById(R.id.btn_place_order).setEnabled(true);
                        Toast.makeText(this, "⚠️ Phone number is required! Please add your mobile number.", Toast.LENGTH_LONG).show();
                        promptForPhoneAndPlaceOrder(deliveryAddress);
                    }));
            return;
        }

        continuePlaceOrderAfterPhoneCheck(deliveryAddress);
    } // end placeOrder()

    private void continuePlaceOrderAfterPhoneCheck(Address deliveryAddress) {

        // GPS Pincode Validation: Check if restaurant delivers to this pincode
        String deliveryPincode = deliveryAddress.getPincode();
        String restaurantId = cartManager.getRestaurantId();
        if (!TextUtils.isEmpty(restaurantId)) {
            // Block order until restaurant operating check and pincode check complete
            findViewById(R.id.btn_place_order).setEnabled(false);
            final String finalDeliveryPincode = deliveryPincode != null ? deliveryPincode.trim() : "";
            db.collection(Constants.COLLECTION_RESTAURANTS).document(restaurantId).get()
                    .addOnSuccessListener(restaurantDoc -> {
                        if (restaurantDoc != null && restaurantDoc.exists()) {
                            com.ssr.hunger.models.Restaurant rest = restaurantDoc.toObject(com.ssr.hunger.models.Restaurant.class);
                            if (rest != null && !rest.isOperatingNow()) {
                                runOnUiThread(() -> {
                                    findViewById(R.id.btn_place_order).setEnabled(true);
                                    ModernDialogHelper.showWarningDialog(
                                            CartActivity.this,
                                            "Restaurant Closed",
                                            "Sorry, "
                                                    + (rest.getName() != null ? rest.getName() : "this restaurant")
                                                    + " is currently closed and not accepting orders right now. Please try again during opening hours.",
                                            "OK",
                                            null
                                    );
                                });
                                return;
                            }
                        }

                        // Check delivery pincode serviceability
                        List<String> servicePincodes = null;
                        if (restaurantDoc != null && restaurantDoc.exists()) {
                            Object spObj = restaurantDoc.get("servicePincodes");
                            if (spObj instanceof List) {
                                servicePincodes = new ArrayList<>();
                                for (Object p : (List<?>) spObj) {
                                    if (p != null) servicePincodes.add(p.toString().trim());
                                }
                            }
                        }

                        // === GEOSPATIAL DISTANCE CHECK ===
                        // When both restaurant and customer have valid coordinates,
                        // check straight-line distance as a pre-filter (road distance = ~1.4x straight-line)
                        boolean geoCheckPassed = true;
                        double straightLineKm = 0;
                        if (restaurantDoc != null && restaurantDoc.exists()) {
                            Double rLat = restaurantDoc.getDouble("latitude");
                            Double rLon = restaurantDoc.getDouble("longitude");
                            double cLat = deliveryAddress.getLatitude();
                            double cLon = deliveryAddress.getLongitude();

                            if (rLat != null && rLon != null && rLat != 0 && rLon != 0
                                    && com.ssr.hunger.utils.GeohashHelper.isValidCoordinate(cLat, cLon)) {
                                double distMeters = com.ssr.hunger.utils.GeohashHelper.haversineDistance(
                                        rLat, rLon, cLat, cLon);
                                straightLineKm = distMeters / 1000.0;

                                // 15km straight-line ≈ 20km road distance — block if clearly out of range
                                double maxStraightLineKm = 15.0;
                                if (straightLineKm > maxStraightLineKm) {
                                    geoCheckPassed = false;
                                    String rName = restaurantDoc.getString("name");
                                    final double finalDistKm = straightLineKm;
                                    runOnUiThread(() -> {
                                        findViewById(R.id.btn_place_order).setEnabled(true);
                                        ModernDialogHelper.showWarningDialog(
                                                CartActivity.this,
                                                "Too Far for Delivery",
                                                "📍 " + (rName != null ? rName : "This restaurant")
                                                        + " is approximately " + String.format("%.1f", finalDistKm)
                                                        + " km away from your delivery location."
                                                        + "\n\nMaximum delivery range is ~10 km by road."
                                                        + "\n\nPlease select a closer restaurant or change your delivery address.",
                                                "Change Address",
                                                () -> openAddressSelector()
                                        );
                                    });
                                }
                            }
                        }

                        if (!geoCheckPassed) return;
                        // === END GEOSPATIAL CHECK ===

                        // If restaurant has no pincode list or pincode is empty, allow order
                        if (servicePincodes == null || servicePincodes.isEmpty() || TextUtils.isEmpty(finalDeliveryPincode)) {
                            findViewById(R.id.btn_place_order).setEnabled(true);
                            proceedToPlaceOrder(deliveryAddress);
                            return;
                        }
                        // Check if delivery pincode is in service area
                        boolean canDeliver = false;
                        for (String sp : servicePincodes) {
                            if (sp.equalsIgnoreCase(finalDeliveryPincode)) {
                                canDeliver = true;
                                break;
                            }
                        }
                        if (!canDeliver) {
                            // BLOCK ORDER: Restaurant doesn't deliver to this pincode
                            String restaurantName2 = restaurantDoc.getString("name");
                            String pincodeList = String.join(", ", servicePincodes);
                            runOnUiThread(() -> {
                                findViewById(R.id.btn_place_order).setEnabled(true);
                                ModernDialogHelper.showWarningDialog(
                                        CartActivity.this,
                                        "Delivery Not Available",
                                        "Sorry, "
                                                + (restaurantName2 != null ? restaurantName2 : "this restaurant")
                                                + " does not deliver to PIN code "
                                                + finalDeliveryPincode
                                                + ".\n\nThey currently serve: "
                                                + pincodeList
                                                + "\n\nPlease select a different delivery address or choose another restaurant.",
                                        "Change Address",
                                        () -> openAddressSelector()
                                );
                            });
                        } else {
                            runOnUiThread(() -> {
                                findViewById(R.id.btn_place_order).setEnabled(true);
                                proceedToPlaceOrder(deliveryAddress);
                            });
                        }
                    })
                    .addOnFailureListener(e -> {
                        // On failure, allow order to proceed (don't block on network issues)
                        logBreadcrumb("restaurant check failed, proceeding: " + e.getMessage());
                        runOnUiThread(() -> {
                            findViewById(R.id.btn_place_order).setEnabled(true);
                            proceedToPlaceOrder(deliveryAddress);
                        });
                    });
            return; // Wait for the async check above
        }

        // No pincode restriction or pincode unavailable, proceed directly
        proceedToPlaceOrder(deliveryAddress);
    } // end continuePlaceOrderAfterPhoneCheck()

    /**
     * Reverse-geocode GPS coords to get pincode and auto-fill it in the delivery address
     * if the address is already selected but has no pincode.
     */
    @android.annotation.SuppressLint("MissingPermission")
    private void tryAutoFillPincodeFromGps() {
        // Only run if permission is already granted
        if (checkSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION)
                != android.content.pm.PackageManager.PERMISSION_GRANTED
                && checkSelfPermission(android.Manifest.permission.ACCESS_COARSE_LOCATION)
                != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            return;
        }
        FusedLocationProviderClient fusedLocation = LocationServices.getFusedLocationProviderClient(this);
        fusedLocation.getLastLocation().addOnSuccessListener(location -> {
            if (location == null) return;
            Address current = cartManager.getDeliveryAddress();
            // Only auto-fill pincode if address exists but has no pincode
            if (current != null && TextUtils.isEmpty(current.getPincode())) {
                try {
                    Geocoder geocoder = new Geocoder(this, Locale.getDefault());
                    List<android.location.Address> addresses = geocoder.getFromLocation(
                            location.getLatitude(), location.getLongitude(), 1);
                    if (addresses != null && !addresses.isEmpty()) {
                        android.location.Address geoAddr = addresses.get(0);
                        String postalCode = geoAddr.getPostalCode();
                        if (!TextUtils.isEmpty(postalCode)) {
                            current.setPincode(postalCode);
                            if (TextUtils.isEmpty(current.getCity()) && geoAddr.getLocality() != null) {
                                current.setCity(geoAddr.getLocality());
                            }
                            if (TextUtils.isEmpty(current.getState()) && geoAddr.getAdminArea() != null) {
                                current.setState(geoAddr.getAdminArea());
                            }
                            current.setLatitude(location.getLatitude());
                            current.setLongitude(location.getLongitude());
                            cartManager.setDeliveryAddress(current);
                            runOnUiThread(() -> {
                                updateAddressUI();
                                logBreadcrumb("GPS auto-filled pincode: " + postalCode);
                            });
                        }
                    }
                } catch (Exception e) {
                    logBreadcrumb("GPS geocoder failed: " + e.getMessage());
                }
            }
        });
    }

    /**
     * The actual order submission logic, called after pincode validation passes.
     * Extracted from placeOrder() to allow async pincode check flow.
     */
    private void proceedToPlaceOrder(Address deliveryAddress) {
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
        int totalQty = 0;
        for (CartItem ci : items) {
            totalQty += ci.getQuantity();
        }
        double deliveryFee = totalQty > 1 ? 60.0 : 40.0;
        double packagingCharges = 0.0;
        double platformFee = 0.0;
        double taxableValue = subtotal;
        double cgst = Math.round(taxableValue * 0.025 * 100.0) / 100.0;
        double sgst = Math.round(taxableValue * 0.025 * 100.0) / 100.0;
        double taxes = cgst + sgst;
        double total = subtotal + packagingCharges + deliveryFee + platformFee + taxes;
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
            if (cartItem.getSizeExtra() + cartItem.getAddOnsTotal() > 0) {
                oi.put("basePrice", cartItem.getEffectiveBasePrice());
            }
            oi.put("quantity", cartItem.getQuantity());
            oi.put("image", cartItem.getImage());
            if (cartItem.getSpiceLevel() != null && !cartItem.getSpiceLevel().trim().isEmpty()) {
                oi.put("spiceLevel", cartItem.getSpiceLevel().trim());
            }
            if (cartItem.getSelectedSize() != null && cartItem.getSelectedSize().getName() != null) {
                Map<String, Object> sizeMap = new HashMap<>();
                if (cartItem.getSelectedSize().getId() != null) {
                    sizeMap.put("id", cartItem.getSelectedSize().getId());
                }
                sizeMap.put("name", cartItem.getSelectedSize().getName());
                sizeMap.put("price", cartItem.getSelectedSize().getPrice());
                oi.put("selectedSize", sizeMap);
            }
            if (cartItem.getSelectedAddOns() != null && !cartItem.getSelectedAddOns().isEmpty()) {
                List<Map<String, Object>> addOnMaps = new ArrayList<>();
                for (com.ssr.hunger.models.MenuItem.CustomizationOption opt : cartItem.getSelectedAddOns()) {
                    if (opt != null && opt.getName() != null) {
                        Map<String, Object> am = new HashMap<>();
                        if (opt.getId() != null) am.put("id", opt.getId());
                        am.put("name", opt.getName());
                        am.put("price", opt.getPrice());
                        addOnMaps.add(am);
                    }
                }
                if (!addOnMaps.isEmpty()) {
                    oi.put("selectedAddOns", addOnMaps);
                }
            }
            if (cartItem.getSpecialInstructions() != null && !cartItem.getSpecialInstructions().trim().isEmpty()) {
                oi.put("specialInstructions", cartItem.getSpecialInstructions().trim());
            }
            orderItems.add(oi);
        }

        // Generate real and professional Order ID (8 uppercase letters + 4 digits, e.g. KRIIEFDI4829)
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        java.util.Random rnd = new java.util.Random();
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 8; i++) {
            sb.append(chars.charAt(rnd.nextInt(chars.length())));
        }
        sb.append(1000 + rnd.nextInt(9000));
        final String orderId = sb.toString();
        final String deliveryOtp = String.valueOf(1000 + rnd.nextInt(9000));

        // Format delivery address map for cross-platform compatibility
        Map<String, Object> addrMap = new HashMap<>();
        addrMap.put("id", deliveryAddress.getId() != null ? deliveryAddress.getId() : "");
        addrMap.put("street", deliveryAddress.getStreet() != null ? deliveryAddress.getStreet() : "");
        addrMap.put("city", deliveryAddress.getCity() != null ? deliveryAddress.getCity() : "");
        addrMap.put("state", deliveryAddress.getState() != null ? deliveryAddress.getState() : "");
        addrMap.put("pincode", deliveryAddress.getPincode() != null ? deliveryAddress.getPincode() : "");
        addrMap.put("landmark", deliveryAddress.getLandmark() != null ? deliveryAddress.getLandmark() : "");
        addrMap.put("type", deliveryAddress.getType() != null ? deliveryAddress.getType() : "home");
        addrMap.put("latitude", deliveryAddress.getLatitude());
        addrMap.put("longitude", deliveryAddress.getLongitude());
        addrMap.put("locality", deliveryAddress.getLocality() != null ? deliveryAddress.getLocality() : "");
        addrMap.put("district", deliveryAddress.getDistrict() != null ? deliveryAddress.getDistrict() : "");
        addrMap.put("addressLabel", deliveryAddress.getAddressLabel() != null ? deliveryAddress.getAddressLabel() : "");
        String custGeohash = deliveryAddress.getGeohash() != null && !deliveryAddress.getGeohash().isEmpty() ? deliveryAddress.getGeohash() :
                (deliveryAddress.getLatitude() != 0 ? com.ssr.hunger.utils.GeohashHelper.encode(deliveryAddress.getLatitude(), deliveryAddress.getLongitude(), 7) : "");
        addrMap.put("geohash", custGeohash);

        String customerPhone = resolveValidPhone(cachedCustomerPhone, user.getPhoneNumber());

        // Build base order document
        Map<String, Object> orderData = new HashMap<>();
        orderData.put("id", orderId);
        orderData.put("orderId", orderId);
        orderData.put("orderNumber", orderId);
        orderData.put("customerId", user.getUid());
        orderData.put("restaurantId", cartManager.getRestaurantId());
        orderData.put("restaurantName", restaurantName != null ? restaurantName : "Restaurant");
        orderData.put("items", orderItems);
        orderData.put("deliveryAddress", addrMap);
        orderData.put("deliveryAddressStreet", deliveryAddress.getStreet() != null ? deliveryAddress.getStreet() : "");
        orderData.put("deliveryAddressCity", deliveryAddress.getCity() != null ? deliveryAddress.getCity() : "");
        orderData.put("deliveryAddressPincode", deliveryAddress.getPincode() != null ? deliveryAddress.getPincode() : "");
        orderData.put("deliveryLatitude", deliveryAddress.getLatitude());
        orderData.put("deliveryLongitude", deliveryAddress.getLongitude());
        orderData.put("customerLat", deliveryAddress.getLatitude());
        orderData.put("customerLon", deliveryAddress.getLongitude());
        orderData.put("customerGeohash", custGeohash);
        orderData.put("deliveryLocality", deliveryAddress.getLocality() != null ? deliveryAddress.getLocality() : "");
        orderData.put("serviceMode", "standard");
        orderData.put("status", "pending");
        orderData.put("paymentMethod", paymentMethod);
        orderData.put("subtotal", subtotal);
        orderData.put("packagingCharges", packagingCharges);
        orderData.put("deliveryCharge", deliveryFee);
        orderData.put("deliveryFee", deliveryFee);
        orderData.put("platformFee", platformFee);
        orderData.put("taxableValue", taxableValue);
        orderData.put("cgst", cgst);
        orderData.put("sgst", sgst);
        orderData.put("taxes", taxes);
        orderData.put("total", total);
        orderData.put("deliveryOtp", deliveryOtp);
        orderData.put("specialInstructions", etSpecialInstructions != null ? etSpecialInstructions.getText().toString().trim() : "");
        orderData.put("customerName", user.getDisplayName() != null ? user.getDisplayName() : "Customer");
        orderData.put("customerPhone", customerPhone);
        orderData.put("createdAt", Timestamp.now());

        // 1. STRICT WALLET PAYMENT VERIFICATION
        if ("wallet".equals(paymentMethod)) {
            findViewById(R.id.btn_place_order).setEnabled(false);
            db.collection(Constants.COLLECTION_CUSTOMERS).document(user.getUid()).get()
                    .addOnSuccessListener(custDoc -> {
                        double currentBalance = 0.0;
                        if (custDoc != null && custDoc.exists()) {
                            Double b = custDoc.getDouble("walletBalance");
                            if (b != null) currentBalance = b;
                        }

                        // STRICT CHECK: Wallet balance MUST be >= total
                        if (currentBalance < total) {
                            if (checkoutTrace != null) stopTrace(checkoutTrace);
                            findViewById(R.id.btn_place_order).setEnabled(true);

                            final double available = currentBalance;
                            new MaterialAlertDialogBuilder(this)
                                    .setTitle("⚠️ Insufficient Wallet Balance")
                                    .setMessage(String.format(Locale.getDefault(),
                                            "Your Hunger Wallet balance is ₹%.2f, but the order amount is ₹%.2f.\n\nWithout sufficient balance, order cannot be placed via Wallet. Only Cash on Delivery (COD) supports placing order without advance payment.",
                                            available, total))
                                    .setPositiveButton("Pay via COD", (dialog, which) -> {
                                        paymentMethod = "cod";
                                        RadioGroup rg = findViewById(R.id.rg_payment);
                                        if (rg != null) rg.check(R.id.rb_cod);
                                        placeOrder();
                                    })
                                    .setNeutralButton("Pay Online (UPI/Cards)", (dialog, which) -> {
                                        paymentMethod = "online";
                                        RadioGroup rg = findViewById(R.id.rg_payment);
                                        if (rg != null) rg.check(R.id.rb_online);
                                        placeOrder();
                                    })
                                    .setNegativeButton("Cancel", null)
                                    .show();
                            return;
                        }

                        // Sufficient balance! Atomically deduct money and confirm order
                        orderData.put("paymentStatus", "completed");
                        orderData.put("amountPaid", total);
                        orderData.put("balanceDue", 0.0);

                        // Record debit wallet transaction metadata
                        Map<String, Object> tx = new HashMap<>();
                        tx.put("customerId", user.getUid());
                        tx.put("userId", user.getUid());
                        tx.put("type", "debit");
                        tx.put("amount", total);
                        tx.put("status", "completed");
                        tx.put("description", "Food Order #" + orderId + " at " + (restaurantName != null ? restaurantName : "Restaurant"));
                        tx.put("orderId", orderId);
                        tx.put("referenceId", orderId);
                        tx.put("createdAt", Timestamp.now());

                        DocumentReference orderRef = db.collection(Constants.COLLECTION_ORDERS).document(orderId);
                        DocumentReference custRef = db.collection(Constants.COLLECTION_CUSTOMERS).document(user.getUid());

                        // Atomic batch: order creation + customer wallet balance decrement
                        WriteBatch batch = db.batch();
                        batch.set(orderRef, orderData);
                        batch.update(custRef, "walletBalance", FieldValue.increment(-total));

                        batch.commit()
                                .addOnSuccessListener(aVoid -> {
                                    // Log wallet transaction to customer subcollection & root ledger non-blockingly
                                    custRef.collection(Constants.COLLECTION_WALLET_TRANSACTIONS).add(tx)
                                            .addOnFailureListener(txErr -> logBreadcrumb("Customer wallet subcollection log skipped: " + txErr.getMessage()));
                                    db.collection(Constants.COLLECTION_WALLET_TRANSACTIONS).add(tx)
                                            .addOnFailureListener(rootErr -> logBreadcrumb("Root wallet ledger mirror skipped: " + rootErr.getMessage()));

                                    onOrderPlacedSuccessfully(orderId, items, subtotal, deliveryFee, taxes, total, "wallet", restaurantName, checkoutTrace, user);
                                })
                                .addOnFailureListener(e -> {
                                    logBreadcrumb("Wallet batch commit failed: " + e.getMessage() + ". Attempting sequential fallback.");
                                    // Robust sequential fallback: deduct wallet then place order
                                    custRef.update("walletBalance", FieldValue.increment(-total))
                                            .addOnSuccessListener(aVoid2 -> {
                                                orderRef.set(orderData)
                                                        .addOnSuccessListener(aVoid3 -> {
                                                            custRef.collection(Constants.COLLECTION_WALLET_TRANSACTIONS).add(tx)
                                                                    .addOnFailureListener(ignored -> {});
                                                            db.collection(Constants.COLLECTION_WALLET_TRANSACTIONS).add(tx)
                                                                    .addOnFailureListener(ignored -> {});
                                                            onOrderPlacedSuccessfully(orderId, items, subtotal, deliveryFee, taxes, total, "wallet", restaurantName, checkoutTrace, user);
                                                        })
                                                        .addOnFailureListener(orderErr -> {
                                                            // Roll back deducted wallet balance if order creation failed
                                                            custRef.update("walletBalance", FieldValue.increment(total));
                                                            if (checkoutTrace != null) stopTrace(checkoutTrace);
                                                            recordException("wallet_order_fallback_order_failed", orderErr);
                                                            findViewById(R.id.btn_place_order).setEnabled(true);
                                                            Toast.makeText(this, "Failed to place order: " + orderErr.getMessage(), Toast.LENGTH_LONG).show();
                                                        });
                                            })
                                            .addOnFailureListener(deductErr -> {
                                                if (checkoutTrace != null) stopTrace(checkoutTrace);
                                                recordException("wallet_order_batch_failed", deductErr);
                                                findViewById(R.id.btn_place_order).setEnabled(true);
                                                Toast.makeText(this, "Failed to deduct wallet: " + deductErr.getMessage(), Toast.LENGTH_LONG).show();
                                            });
                                });
                    })
                    .addOnFailureListener(e -> {
                        if (checkoutTrace != null) stopTrace(checkoutTrace);
                        findViewById(R.id.btn_place_order).setEnabled(true);
                        Toast.makeText(this, "Could not check wallet balance: " + e.getMessage(), Toast.LENGTH_LONG).show();
                    });
            return;
        }

        // 2. ONLINE PAYMENT GATEWAY (RAZORPAY)
        if ("online".equals(paymentMethod)) {
            pendingOrderData = orderData;
            pendingOrderId = orderId;
            pendingOrderTotal = total;
            pendingOrderItems = items;
            pendingSubtotal = subtotal;
            pendingDeliveryFee = deliveryFee;
            pendingTaxes = taxes;
            pendingRestaurantName = restaurantName;
            pendingCheckoutTrace = checkoutTrace;

            findViewById(R.id.btn_place_order).setEnabled(false);

            try {
                Checkout checkout = new Checkout();
                checkout.setKeyID(Constants.RAZORPAY_KEY_ID);

                JSONObject options = new JSONObject();
                options.put("name", "Hunger Delivery");
                options.put("description", "Order #" + orderId + " at " + (restaurantName != null ? restaurantName : "Restaurant"));
                options.put("currency", "INR");
                options.put("amount", Math.round(total * 100)); // amount in paise

                JSONObject prefill = new JSONObject();
                if (user.getEmail() != null) prefill.put("email", user.getEmail());
                if (customerPhone != null && !customerPhone.isEmpty()) prefill.put("contact", customerPhone);
                options.put("prefill", prefill);

                checkout.open(this, options);
            } catch (Exception e) {
                if (checkoutTrace != null) stopTrace(checkoutTrace);
                recordException("Razorpay_Checkout_Launch_Error", e);
                findViewById(R.id.btn_place_order).setEnabled(true);
                Toast.makeText(this, "Could not launch payment gateway: " + e.getMessage(), Toast.LENGTH_SHORT).show();
            }
            return;
        }

        // 3. CASH ON DELIVERY (COD) - ONLY METHOD ALLOWED WITHOUT ADVANCE PAYMENT
        orderData.put("paymentStatus", "pending");
        orderData.put("amountPaid", 0.0);
        orderData.put("balanceDue", total);

        findViewById(R.id.btn_place_order).setEnabled(false);
        db.collection(Constants.COLLECTION_ORDERS)
                .document(orderId)
                .set(orderData)
                .addOnSuccessListener(aVoid -> onOrderPlacedSuccessfully(orderId, items, subtotal, deliveryFee, taxes, total, "cod", restaurantName, checkoutTrace, user))
                .addOnFailureListener(e -> {
                    if (checkoutTrace != null) stopTrace(checkoutTrace);
                    recordException("placeOrder_Firestore_Error", e);
                    Toast.makeText(this, "Failed to place order: " + e.getMessage(), Toast.LENGTH_LONG).show();
                    findViewById(R.id.btn_place_order).setEnabled(true);
                });
    } // end proceedToPlaceOrder

    @Override
    public void onPaymentSuccess(String razorpayPaymentId) {
        logBreadcrumb("Razorpay payment successful: " + razorpayPaymentId + " for order #" + pendingOrderId);
        if (pendingOrderData != null && pendingOrderId != null) {
            pendingOrderData.put("paymentStatus", "completed");
            pendingOrderData.put("razorpayPaymentId", razorpayPaymentId);
            pendingOrderData.put("amountPaid", pendingOrderTotal);
            pendingOrderData.put("balanceDue", 0.0);

            FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
            db.collection(Constants.COLLECTION_ORDERS)
                    .document(pendingOrderId)
                    .set(pendingOrderData)
                    .addOnSuccessListener(aVoid -> onOrderPlacedSuccessfully(
                            pendingOrderId,
                            pendingOrderItems,
                            pendingSubtotal,
                            pendingDeliveryFee,
                            pendingTaxes,
                            pendingOrderTotal,
                            "online",
                            pendingRestaurantName,
                            pendingCheckoutTrace,
                            user
                    ))
                    .addOnFailureListener(e -> {
                        if (pendingCheckoutTrace != null) stopTrace(pendingCheckoutTrace);
                        recordException("online_order_confirm_failed", e);
                        findViewById(R.id.btn_place_order).setEnabled(true);
                        Toast.makeText(this, "Payment successful but order creation failed: " + e.getMessage(), Toast.LENGTH_LONG).show();
                    });
        }
    }

    @Override
    public void onPaymentError(int code, String response) {
        if (pendingCheckoutTrace != null) stopTrace(pendingCheckoutTrace);
        logBreadcrumb("Razorpay payment failed: " + response);
        findViewById(R.id.btn_place_order).setEnabled(true);
        Toast.makeText(this, "Payment cancelled or failed. Order was not placed.", Toast.LENGTH_LONG).show();
    }

    private void onOrderPlacedSuccessfully(String orderId, List<CartItem> items, double subtotal,
                                           double deliveryFee, double taxes, double total,
                                           String method, String restaurantName, Trace trace,
                                           FirebaseUser user) {
        if (trace != null) stopTrace(trace);

        analyticsHelper.logPurchase(
                orderId,
                items,
                subtotal,
                deliveryFee,
                taxes,
                total,
                method,
                restaurantName
        );

        logBreadcrumb("Order confirmed successfully in Firestore: " + orderId);

        if (user != null) {
            NotificationHelper.sendOrderNotification(
                    CartActivity.this,
                    user.getUid(),
                    orderId,
                    restaurantName != null ? restaurantName : "Restaurant",
                    total,
                    "confirmed"
            );
        }

        cartManager.clearCart();
        isBiometricUnlockedForSession = false;
        Toast.makeText(this, "Order #" + orderId + " placed successfully! 🎉", Toast.LENGTH_LONG).show();

        android.content.Intent intent = new android.content.Intent(CartActivity.this, OrderDetailActivity.class);
        intent.putExtra(Constants.EXTRA_ORDER_ID, orderId);
        startActivity(intent);
        finish();
    }

    @Override
    public void onCartChanged(List<CartItem> items, int totalCount, double subtotal) {
        runOnUiThread(this::updateUI);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, android.content.Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_BIOMETRIC_CHECKOUT) {
            if (resultCode == RESULT_OK) {
                isBiometricUnlockedForSession = true;
                placeOrder();
            } else {
                Toast.makeText(this, "Order placement cancelled. Biometric verification required.", Toast.LENGTH_SHORT).show();
            }
        }
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
