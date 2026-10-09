package com.ssr.hunger.delivery.utils;

/**
 * Constants for the Delivery Partner Android App.
 * Aligns with Firebase Firestore collections and web schemas.
 */
public class Constants {
    // Firestore Collections
    public static final String COLLECTION_DELIVERY_PERSONS = "deliveryPersons";
    public static final String COLLECTION_ORDERS = "orders";
    public static final String COLLECTION_RESTAURANTS = "restaurants";
    public static final String COLLECTION_DRIVER_LOCATIONS = "driverLocations";
    public static final String COLLECTION_PARTNER_STATS = "partnerStats";
    public static final String COLLECTION_WALLET_TRANSACTIONS = "walletTransactions";
    public static final String COLLECTION_SUPPORT_TICKETS = "supportTickets";
    public static final String COLLECTION_NOTIFICATIONS = "notifications";

    // Order Statuses
    public static final String STATUS_PENDING = "pending";
    public static final String STATUS_CONFIRMED = "confirmed";
    public static final String STATUS_PREPARING = "preparing";
    public static final String STATUS_READY = "ready";
    public static final String STATUS_OUT_FOR_DELIVERY = "out_for_delivery";
    public static final String STATUS_DELIVERED = "delivered";
    public static final String STATUS_CANCELLED = "cancelled";

    // Delivery Stages for Active Flow
    public static final String STAGE_TO_RESTAURANT = "to_restaurant";
    public static final String STAGE_AT_RESTAURANT = "at_restaurant";
    public static final String STAGE_PICKED_UP = "picked_up";
    public static final String STAGE_TO_CUSTOMER = "to_customer";
    public static final String STAGE_ARRIVED = "arrived";
    public static final String STAGE_DELIVERED_DONE = "delivered";

    // Notification Channel IDs
    public static final String CHANNEL_ORDERS = "hunger_delivery_orders";
    public static final String CHANNEL_PAYMENTS = "hunger_delivery_payments";
    public static final String CHANNEL_STATUS = "hunger_delivery_status";
    public static final String CHANNEL_EMERGENCY = "hunger_delivery_emergency";
    public static final String CHANNEL_GPS = "hunger_driver_gps";
    public static final String CHANNEL_GENERAL = "hunger_delivery_general";

    // Intent Extras
    public static final String EXTRA_ORDER_ID = "extra_order_id";
    public static final String EXTRA_DEST_LAT = "extra_dest_lat";
    public static final String EXTRA_DEST_LNG = "extra_dest_lng";
    public static final String EXTRA_DEST_NAME = "extra_dest_name";
    public static final String EXTRA_DEST_ADDRESS = "extra_dest_address";
    public static final String EXTRA_STAGE = "extra_stage";

    // Shared Preferences
    public static final String PREFS_NAME = "hunger_delivery_prefs";
    public static final String PREF_IS_ONLINE = "pref_is_online";
    public static final String PREF_PINCODES = "pref_service_pincodes";
    public static final String PREF_FILTER_PINCODES = "pref_filter_pincodes";

    // Default Commission / Delivery Pay
    public static final double DEFAULT_BASE_PAY = 40.0;
    public static final double PER_KM_PAY = 12.0;
}
