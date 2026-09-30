package com.ssr.hunger.utils;

import android.app.Activity;
import android.content.Context;
import android.os.Bundle;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import com.ssr.hunger.models.CartItem;
import com.ssr.hunger.models.MenuItem;
import com.google.firebase.analytics.FirebaseAnalytics;
import com.google.firebase.auth.FirebaseUser;
import java.util.List;

/**
 * AnalyticsHelper provides structured, comprehensive Google Analytics for Firebase tracking:
 * - Realtime Analytics streaming & DebugView support
 * - Standard e-Commerce food delivery funnel (view_item_list -> view_item -> add_to_cart -> begin_checkout -> purchase)
 * - User engagement & retention events (login, sign_up, search, favorite, wallet, support)
 * - User properties for segmentation (city, loyalty, order bracket)
 */
public class AnalyticsHelper {

    private static final String TAG = "AnalyticsHelper";
    private static volatile AnalyticsHelper instance;
    private final FirebaseAnalytics analytics;

    // Custom Event Names
    public static final String EVENT_WALLET_ADD_FUNDS = "wallet_add_funds";
    public static final String EVENT_WALLET_WITHDRAW_REQUEST = "wallet_withdraw_request";
    public static final String EVENT_SUPPORT_TICKET = "support_ticket_created";
    public static final String EVENT_DELIVERY_ADDRESS_SET = "delivery_address_set";
    public static final String EVENT_COUPON_APPLIED = "coupon_applied";
    public static final String EVENT_FAVORITE_TOGGLE = "favorite_toggle";
    public static final String EVENT_APP_UPGRADE = "app_upgrade";

    // Custom Parameter Names
    public static final String PARAM_RESTAURANT_ID = "restaurant_id";
    public static final String PARAM_RESTAURANT_NAME = "restaurant_name";
    public static final String PARAM_PAYMENT_METHOD = "payment_method";
    public static final String PARAM_RESULT_COUNT = "result_count";
    public static final String PARAM_COUPON_CODE = "coupon_code";
    public static final String PARAM_DISCOUNT_AMOUNT = "discount_amount";
    public static final String PARAM_IS_FAVORITE = "is_favorite";

    // User Property Keys
    public static final String PROP_USER_TYPE = "user_type";
    public static final String PROP_MEMBERSHIP_STATUS = "membership_status";
    public static final String PROP_CITY = "delivery_city";
    public static final String PROP_APP_VERSION = "app_version";

    private AnalyticsHelper(@NonNull Context context) {
        this.analytics = FirebaseAnalytics.getInstance(context.getApplicationContext());
        this.analytics.setAnalyticsCollectionEnabled(true);
    }

    public static AnalyticsHelper getInstance(@NonNull Context context) {
        if (instance == null) {
            synchronized (AnalyticsHelper.class) {
                if (instance == null) {
                    instance = new AnalyticsHelper(context);
                }
            }
        }
        return instance;
    }

    /**
     * Set user identity and persistent user properties for analytics.
     */
    public void setUser(@Nullable FirebaseUser user) {
        if (user != null) {
            analytics.setUserId(user.getUid());
            analytics.setUserProperty(PROP_USER_TYPE, "customer");
            if (user.getEmail() != null && user.getEmail().contains("@")) {
                analytics.setUserProperty("email_domain", user.getEmail().split("@")[1]);
            }
        } else {
            analytics.setUserId(null);
            analytics.setUserProperty(PROP_USER_TYPE, "guest");
        }
    }

    /**
     * Sets a custom user property.
     */
    public void setUserProperty(@NonNull String propertyName, @NonNull String value) {
        analytics.setUserProperty(propertyName, value);
    }

    /**
     * Logs screen view event for Realtime Analytics tracking.
     */
    public void logScreenView(@NonNull Activity activity, @NonNull String screenName) {
        try {
            Bundle bundle = new Bundle();
            bundle.putString(FirebaseAnalytics.Param.SCREEN_NAME, screenName);
            bundle.putString(FirebaseAnalytics.Param.SCREEN_CLASS, activity.getClass().getSimpleName());
            analytics.logEvent(FirebaseAnalytics.Event.SCREEN_VIEW, bundle);
            Log.d(TAG, "Screen viewed: " + screenName);
        } catch (Exception e) {
            Log.e(TAG, "Failed to log screen view", e);
        }
    }

    /**
     * Logs authentication: login.
     */
    public void logLogin(@NonNull String method) {
        Bundle bundle = new Bundle();
        bundle.putString(FirebaseAnalytics.Param.METHOD, method);
        analytics.logEvent(FirebaseAnalytics.Event.LOGIN, bundle);
        Log.d(TAG, "Analytics: login (" + method + ")");
    }

    /**
     * Logs authentication: sign up.
     */
    public void logSignUp(@NonNull String method) {
        Bundle bundle = new Bundle();
        bundle.putString(FirebaseAnalytics.Param.METHOD, method);
        analytics.logEvent(FirebaseAnalytics.Event.SIGN_UP, bundle);
        Log.d(TAG, "Analytics: sign_up (" + method + ")");
    }

    /**
     * Logs viewing category or list of food items.
     */
    public void logViewItemList(@NonNull String categoryName, int itemCount) {
        Bundle bundle = new Bundle();
        bundle.putString(FirebaseAnalytics.Param.ITEM_LIST_NAME, categoryName);
        bundle.putString(FirebaseAnalytics.Param.ITEM_LIST_ID, categoryName.toLowerCase().replace(" ", "_"));
        bundle.putLong(FirebaseAnalytics.Param.QUANTITY, itemCount);
        analytics.logEvent(FirebaseAnalytics.Event.VIEW_ITEM_LIST, bundle);
    }

    /**
     * Logs viewing a specific food item's detail page.
     */
    public void logViewItem(@NonNull MenuItem item) {
        Bundle itemBundle = new Bundle();
        itemBundle.putString(FirebaseAnalytics.Param.ITEM_ID, item.getId());
        itemBundle.putString(FirebaseAnalytics.Param.ITEM_NAME, item.getName());
        itemBundle.putString(FirebaseAnalytics.Param.ITEM_CATEGORY, item.getCategory() != null ? item.getCategory() : "Food");
        itemBundle.putDouble(FirebaseAnalytics.Param.PRICE, item.getPrice());
        itemBundle.putString(PARAM_RESTAURANT_NAME, item.getRestaurantName() != null ? item.getRestaurantName() : "");

        Bundle bundle = new Bundle();
        bundle.putString(FirebaseAnalytics.Param.CURRENCY, "INR");
        bundle.putDouble(FirebaseAnalytics.Param.VALUE, item.getPrice());
        bundle.putParcelableArray(FirebaseAnalytics.Param.ITEMS, new Bundle[]{itemBundle});
        analytics.logEvent(FirebaseAnalytics.Event.VIEW_ITEM, bundle);
    }

    /**
     * Logs adding an item to the shopping cart.
     */
    public void logAddToCart(@NonNull CartItem item) {
        Bundle itemBundle = new Bundle();
        itemBundle.putString(FirebaseAnalytics.Param.ITEM_ID, item.getMenuItemId());
        itemBundle.putString(FirebaseAnalytics.Param.ITEM_NAME, item.getName());
        itemBundle.putDouble(FirebaseAnalytics.Param.PRICE, item.getPrice());
        itemBundle.putLong(FirebaseAnalytics.Param.QUANTITY, item.getQuantity());
        itemBundle.putString(PARAM_RESTAURANT_NAME, item.getRestaurantName() != null ? item.getRestaurantName() : "");

        Bundle bundle = new Bundle();
        bundle.putString(FirebaseAnalytics.Param.CURRENCY, "INR");
        bundle.putDouble(FirebaseAnalytics.Param.VALUE, item.getTotalPrice());
        bundle.putParcelableArray(FirebaseAnalytics.Param.ITEMS, new Bundle[]{itemBundle});
        analytics.logEvent(FirebaseAnalytics.Event.ADD_TO_CART, bundle);
        Log.d(TAG, "Analytics: add_to_cart (" + item.getName() + " x" + item.getQuantity() + ")");
    }

    /**
     * Logs removing an item from the cart.
     */
    public void logRemoveFromCart(@NonNull String itemId, @NonNull String itemName, double price, int quantity) {
        Bundle itemBundle = new Bundle();
        itemBundle.putString(FirebaseAnalytics.Param.ITEM_ID, itemId);
        itemBundle.putString(FirebaseAnalytics.Param.ITEM_NAME, itemName);
        itemBundle.putDouble(FirebaseAnalytics.Param.PRICE, price);
        itemBundle.putLong(FirebaseAnalytics.Param.QUANTITY, quantity);

        Bundle bundle = new Bundle();
        bundle.putString(FirebaseAnalytics.Param.CURRENCY, "INR");
        bundle.putDouble(FirebaseAnalytics.Param.VALUE, price * quantity);
        bundle.putParcelableArray(FirebaseAnalytics.Param.ITEMS, new Bundle[]{itemBundle});
        analytics.logEvent(FirebaseAnalytics.Event.REMOVE_FROM_CART, bundle);
    }

    /**
     * Logs when user opens checkout / cart with items.
     */
    public void logBeginCheckout(int itemCount, double totalAmount, @NonNull String paymentMethod) {
        Bundle bundle = new Bundle();
        bundle.putString(FirebaseAnalytics.Param.CURRENCY, "INR");
        bundle.putDouble(FirebaseAnalytics.Param.VALUE, totalAmount);
        bundle.putLong(FirebaseAnalytics.Param.QUANTITY, itemCount);
        bundle.putString(PARAM_PAYMENT_METHOD, paymentMethod);
        analytics.logEvent(FirebaseAnalytics.Event.BEGIN_CHECKOUT, bundle);
        Log.d(TAG, "Analytics: begin_checkout (₹" + totalAmount + ", " + paymentMethod + ")");
    }

    /**
     * Logs successful order purchase (e-Commerce purchase).
     */
    public void logPurchase(@NonNull String orderId,
                            @NonNull List<CartItem> items,
                            double subtotal,
                            double deliveryCharge,
                            double taxes,
                            double totalAmount,
                            @NonNull String paymentMethod,
                            @Nullable String restaurantName) {
        Bundle[] itemsArray = new Bundle[items.size()];
        for (int i = 0; i < items.size(); i++) {
            CartItem ci = items.get(i);
            Bundle b = new Bundle();
            b.putString(FirebaseAnalytics.Param.ITEM_ID, ci.getMenuItemId());
            b.putString(FirebaseAnalytics.Param.ITEM_NAME, ci.getName());
            b.putDouble(FirebaseAnalytics.Param.PRICE, ci.getPrice());
            b.putLong(FirebaseAnalytics.Param.QUANTITY, ci.getQuantity());
            itemsArray[i] = b;
        }

        Bundle bundle = new Bundle();
        bundle.putString(FirebaseAnalytics.Param.TRANSACTION_ID, orderId);
        bundle.putString(FirebaseAnalytics.Param.CURRENCY, "INR");
        bundle.putDouble(FirebaseAnalytics.Param.VALUE, totalAmount);
        bundle.putDouble(FirebaseAnalytics.Param.SHIPPING, deliveryCharge);
        bundle.putDouble(FirebaseAnalytics.Param.TAX, taxes);
        bundle.putString(PARAM_PAYMENT_METHOD, paymentMethod);
        if (restaurantName != null) {
            bundle.putString(PARAM_RESTAURANT_NAME, restaurantName);
        }
        bundle.putParcelableArray(FirebaseAnalytics.Param.ITEMS, itemsArray);

        analytics.logEvent(FirebaseAnalytics.Event.PURCHASE, bundle);
        Log.d(TAG, "Analytics: purchase completed! Order #" + orderId + " total=₹" + totalAmount);
    }

    /**
     * Logs search query and matching result count.
     */
    public void logSearch(@NonNull String query, int resultCount) {
        Bundle bundle = new Bundle();
        bundle.putString(FirebaseAnalytics.Param.SEARCH_TERM, query);
        bundle.putLong(PARAM_RESULT_COUNT, resultCount);
        analytics.logEvent(FirebaseAnalytics.Event.SEARCH, bundle);
    }

    /**
     * Logs content selection (e.g. restaurant selected, banner clicked).
     */
    public void logSelectContent(@NonNull String contentType, @NonNull String itemId, @Nullable String itemName) {
        Bundle bundle = new Bundle();
        bundle.putString(FirebaseAnalytics.Param.CONTENT_TYPE, contentType);
        bundle.putString(FirebaseAnalytics.Param.ITEM_ID, itemId);
        if (itemName != null) {
            bundle.putString(FirebaseAnalytics.Param.ITEM_NAME, itemName);
        }
        analytics.logEvent(FirebaseAnalytics.Event.SELECT_CONTENT, bundle);
    }

    /**
     * Logs wallet recharge via Razorpay.
     */
    public void logWalletAddFunds(double amount, @NonNull String paymentId) {
        Bundle bundle = new Bundle();
        bundle.putString(FirebaseAnalytics.Param.CURRENCY, "INR");
        bundle.putDouble(FirebaseAnalytics.Param.VALUE, amount);
        bundle.putString(FirebaseAnalytics.Param.TRANSACTION_ID, paymentId);
        analytics.logEvent(EVENT_WALLET_ADD_FUNDS, bundle);
    }

    /**
     * Logs wallet withdrawal request.
     */
    public void logWalletWithdrawRequest(double amount) {
        Bundle bundle = new Bundle();
        bundle.putString(FirebaseAnalytics.Param.CURRENCY, "INR");
        bundle.putDouble(FirebaseAnalytics.Param.VALUE, amount);
        analytics.logEvent(EVENT_WALLET_WITHDRAW_REQUEST, bundle);
    }

    /**
     * Logs support ticket submission.
     */
    public void logSupportTicketCreated(@NonNull String subject) {
        Bundle bundle = new Bundle();
        bundle.putString("ticket_subject", subject);
        analytics.logEvent(EVENT_SUPPORT_TICKET, bundle);
    }

    /**
     * Logs delivery address selection.
     */
    public void logDeliveryAddressSelected(@NonNull String city, @NonNull String addressType) {
        Bundle bundle = new Bundle();
        bundle.putString("city", city);
        bundle.putString("type", addressType);
        analytics.logEvent(EVENT_DELIVERY_ADDRESS_SET, bundle);
        analytics.setUserProperty(PROP_CITY, city);
    }

    /**
     * Logs coupon code attempt.
     */
    public void logCouponApplied(@NonNull String couponCode, boolean valid, double discount) {
        Bundle bundle = new Bundle();
        bundle.putString(PARAM_COUPON_CODE, couponCode);
        bundle.putBoolean("valid", valid);
        bundle.putDouble(PARAM_DISCOUNT_AMOUNT, discount);
        analytics.logEvent(EVENT_COUPON_APPLIED, bundle);
    }

    /**
     * Logs favorite food item toggle.
     */
    public void logFavoriteToggle(@NonNull String itemId, @NonNull String itemName, boolean isFavorite) {
        Bundle bundle = new Bundle();
        bundle.putString(FirebaseAnalytics.Param.ITEM_ID, itemId);
        bundle.putString(FirebaseAnalytics.Param.ITEM_NAME, itemName);
        bundle.putBoolean(PARAM_IS_FAVORITE, isFavorite);
        analytics.logEvent(EVENT_FAVORITE_TOGGLE, bundle);
    }

    /**
     * Logs app upgrade detection (Release Monitoring).
     */
    public void logAppUpgrade(int oldVersionCode, int newVersionCode, @NonNull String newVersionName) {
        Bundle bundle = new Bundle();
        bundle.putInt("previous_version_code", oldVersionCode);
        bundle.putInt("current_version_code", newVersionCode);
        bundle.putString("current_version_name", newVersionName);
        analytics.logEvent(EVENT_APP_UPGRADE, bundle);
        analytics.setUserProperty(PROP_APP_VERSION, newVersionName);
    }

    /**
     * Generic event logging with bundle.
     */
    public void logEvent(@NonNull String eventName, @Nullable Bundle params) {
        analytics.logEvent(eventName, params);
    }
}
