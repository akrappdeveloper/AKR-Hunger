package com.ssr.hunger.utils;

/**
 * Constants used throughout the app.
 * Mirrors the web app's configuration values.
 */
public class Constants {
    // Firebase Collection Names
    public static final String COLLECTION_CUSTOMERS = "customers";
    public static final String COLLECTION_RESTAURANTS = "restaurants";
    public static final String COLLECTION_MENU_ITEMS = "menuItems";
    public static final String COLLECTION_ORDERS = "orders";
    public static final String COLLECTION_REVIEWS = "reviews";
    public static final String COLLECTION_PROMOTIONS = "promotions";
    public static final String COLLECTION_SUPPORT_TICKETS = "supportTickets";
    public static final String COLLECTION_NOTIFICATIONS = "notifications";
    public static final String COLLECTION_WALLET_TRANSACTIONS = "walletTransactions";

    // Razorpay
    public static final String RAZORPAY_KEY_ID = "rzp_live_RbvSxxE0Qca3fp";

    // Intent Extras
    public static final String EXTRA_RESTAURANT_ID = "restaurant_id";
    public static final String EXTRA_PRODUCT_ID = "product_id";
    public static final String EXTRA_ORDER_ID = "order_id";

    // Tax Rate
    public static final double TAX_RATE = 0.05; // 5%

    // Shared Preferences
    public static final String PREF_USER = "user_prefs";
    public static final String PREF_RECENT_SEARCHES = "recent_searches";

    // Categories
    public static final String[][] FOOD_CATEGORIES = {
            {"1", "Pizza", "🍕"},
            {"2", "Burger", "🍔"},
            {"3", "Biryani", "🍲"},
            {"4", "Chinese", "🍜"},
            {"5", "Dessert", "🍰"},
            {"6", "Healthy", "🥗"},
            {"7", "Drinks", "🥤"},
            {"8", "Kebabs", "🍢"},
            {"9", "Sushi", "🍣"},
            {"10", "Rolls", "🌯"},
            {"11", "South Indian", "🥞"},
            {"12", "Chai & Cafe", "☕"},
            {"13", "Bakery", "🥐"},
            {"14", "Shakes", "🧋"},
            {"15", "Street Food", "🥘"}
    };

    // FAQ
    public static final String[][] FAQ_ITEMS = {
            {"Where is my order and how do I track it?",
                    "Go to the 'Orders' tab to view live tracking, kitchen preparation progress, and rider GPS location."},
            {"How do I cancel an order?",
                    "You can cancel free of charge within 5 minutes of placing it from the order details page before preparation starts."},
            {"When will I get my refund?",
                    "Refunds to AKR Wallet are instant! Refunds to bank cards or UPI take 5-7 business days via Razorpay."},
            {"Food quality or missing item issue?",
                    "We apologize for the inconvenience! Submit a support ticket with order details for immediate resolution."},
            {"How do loyalty reward points work?",
                    "You earn loyalty reward points on every order placed on AKR Hunger. Points can be redeemed for instant discounts during checkout."}
    };
}
