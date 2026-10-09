package com.ssr.hunger.delivery.utils;

import android.content.Context;
import android.os.Bundle;
import android.util.Log;

import androidx.annotation.NonNull;

import com.google.firebase.analytics.FirebaseAnalytics;
import com.google.firebase.auth.FirebaseUser;

/**
 * AnalyticsHelper provides structured, comprehensive Google Analytics for Firebase tracking:
 * - Realtime Analytics streaming & DebugView support
 * - Delivery partner lifecycle events (went_online, went_offline, order_accepted, food_picked_up, order_delivered, order_declined)
 * - Earnings & wallet events (payout_requested, cod_deposit_initiated)
 * - User properties for partner segmentation (rating, vehicle_type, kyc_status)
 */
public class AnalyticsHelper {

    private static final String TAG = "DeliveryAnalyticsHelper";
    private static volatile AnalyticsHelper instance;
    private final FirebaseAnalytics analytics;

    // Custom Event Names
    public static final String EVENT_DRIVER_ONLINE = "driver_went_online";
    public static final String EVENT_DRIVER_OFFLINE = "driver_went_offline";
    public static final String EVENT_ORDER_ACCEPTED = "driver_order_accepted";
    public static final String EVENT_ORDER_DECLINED = "driver_order_declined";
    public static final String EVENT_FOOD_PICKED_UP = "driver_food_picked_up";
    public static final String EVENT_ORDER_DELIVERED = "driver_order_delivered";
    public static final String EVENT_ORDER_RETURNED = "driver_order_returned";
    public static final String EVENT_PAYOUT_REQUESTED = "driver_payout_requested";
    public static final String EVENT_PINCODE_UPDATED = "driver_pincode_updated";
    public static final String EVENT_SUPPORT_TICKET = "driver_support_ticket_created";
    public static final String EVENT_PROOF_UPLOADED = "driver_delivery_proof_uploaded";

    // Custom Parameter Names
    public static final String PARAM_ORDER_ID = "order_id";
    public static final String PARAM_RESTAURANT_NAME = "restaurant_name";
    public static final String PARAM_EARNINGS = "earnings_amount";
    public static final String PARAM_DISTANCE_KM = "distance_km";
    public static final String PARAM_PAYMENT_MODE = "payment_mode";
    public static final String PARAM_WITHDRAW_AMOUNT = "withdraw_amount";
    public static final String PARAM_PINCODES_COUNT = "pincodes_count";

    // User Property Keys
    public static final String PROP_VEHICLE_TYPE = "partner_vehicle_type";
    public static final String PROP_KYC_STATUS = "partner_kyc_status";
    public static final String PROP_FAIR_SCORE = "partner_fair_score";
    public static final String PROP_RATING = "partner_rating";

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

    public void setPartnerUser(@NonNull FirebaseUser user) {
        analytics.setUserId(user.getUid());
        analytics.setUserProperty("partner_email", user.getEmail());
    }

    public void setUserProperty(String key, String value) {
        analytics.setUserProperty(key, value);
    }

    public void logDriverStatus(boolean isOnline) {
        Bundle bundle = new Bundle();
        bundle.putBoolean("is_online", isOnline);
        bundle.putLong("timestamp", System.currentTimeMillis());
        analytics.logEvent(isOnline ? EVENT_DRIVER_ONLINE : EVENT_DRIVER_OFFLINE, bundle);
        Log.d(TAG, "Logged status event: " + (isOnline ? "ONLINE" : "OFFLINE"));
    }

    public void logOrderAccepted(String orderId, String restaurantName, double estimatedEarnings) {
        Bundle bundle = new Bundle();
        bundle.putString(PARAM_ORDER_ID, orderId);
        bundle.putString(PARAM_RESTAURANT_NAME, restaurantName);
        bundle.putDouble(PARAM_EARNINGS, estimatedEarnings);
        analytics.logEvent(EVENT_ORDER_ACCEPTED, bundle);
    }

    public void logOrderDeclined(String orderId) {
        Bundle bundle = new Bundle();
        bundle.putString(PARAM_ORDER_ID, orderId);
        analytics.logEvent(EVENT_ORDER_DECLINED, bundle);
    }

    public void logFoodPickedUp(String orderId) {
        Bundle bundle = new Bundle();
        bundle.putString(PARAM_ORDER_ID, orderId);
        analytics.logEvent(EVENT_FOOD_PICKED_UP, bundle);
    }

    public void logOrderDelivered(String orderId, double earnedAmount, String paymentMethod) {
        Bundle bundle = new Bundle();
        bundle.putString(PARAM_ORDER_ID, orderId);
        bundle.putDouble(PARAM_EARNINGS, earnedAmount);
        bundle.putString(PARAM_PAYMENT_MODE, paymentMethod);
        analytics.logEvent(EVENT_ORDER_DELIVERED, bundle);
    }

    public void logPayoutRequested(double amount, String method) {
        Bundle bundle = new Bundle();
        bundle.putDouble(PARAM_WITHDRAW_AMOUNT, amount);
        bundle.putString("method", method);
        analytics.logEvent(EVENT_PAYOUT_REQUESTED, bundle);
    }

    public void logSupportTicket(String category, String priority) {
        Bundle bundle = new Bundle();
        bundle.putString("category", category);
        bundle.putString("priority", priority);
        analytics.logEvent(EVENT_SUPPORT_TICKET, bundle);
    }
}
