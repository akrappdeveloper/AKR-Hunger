package com.ssr.hunger.utils;

import android.content.Context;
import android.content.SharedPreferences;
import com.ssr.hunger.models.CartItem;
import com.google.gson.Gson;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Singleton cart manager - persists cart to SharedPreferences.
 * Mirrors the web app's CartContext functionality.
 */
public class CartManager {
    private static CartManager instance;
    private static final String PREF_NAME = "akr_cart";
    private static final String KEY_CART_ITEMS = "cart_items";
    private static final String KEY_RESTAURANT_ID = "restaurant_id";

    private List<CartItem> items;
    private String restaurantId;
    private SharedPreferences prefs;
    private Gson gson;
    private List<CartChangeListener> listeners = new ArrayList<>();

    public interface CartChangeListener {
        void onCartChanged(List<CartItem> items, int totalCount, double subtotal);
    }

    private CartManager(Context context) {
        prefs = context.getApplicationContext().getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        gson = new Gson();
        loadCart();
    }

    public static synchronized CartManager getInstance(Context context) {
        if (instance == null) {
            instance = new CartManager(context);
        }
        return instance;
    }

    public void addListener(CartChangeListener listener) {
        if (!listeners.contains(listener)) {
            listeners.add(listener);
        }
    }

    public void removeListener(CartChangeListener listener) {
        listeners.remove(listener);
    }

    private void notifyListeners() {
        for (CartChangeListener l : listeners) {
            l.onCartChanged(items, getTotalItemCount(), getSubtotal());
        }
    }

    public void addItem(CartItem item) {
        // Check if from different restaurant
        if (restaurantId != null && !restaurantId.isEmpty()
                && !restaurantId.equals(item.getRestaurantId()) && !items.isEmpty()) {
            // Clear cart for new restaurant
            items.clear();
        }
        restaurantId = item.getRestaurantId();

        // Check if item with identical customizations already exists
        boolean found = false;
        String incomingSig = item.getCustomizationSignature();
        for (CartItem existing : items) {
            if (existing.getCustomizationSignature().equals(incomingSig)) {
                existing.setQuantity(existing.getQuantity() + item.getQuantity());
                found = true;
                break;
            }
        }
        if (!found) {
            items.add(item);
        }
        saveCart();
        notifyListeners();
    }

    public void removeItem(String itemKey) {
        items.removeIf(item ->
                (item.getId() != null && item.getId().equals(itemKey))
                        || (item.getMenuItemId() != null && item.getMenuItemId().equals(itemKey)));
        if (items.isEmpty()) {
            restaurantId = null;
        }
        saveCart();
        notifyListeners();
    }

    public void updateQuantity(String itemKey, int quantity) {
        for (CartItem item : items) {
            boolean matches = (item.getId() != null && item.getId().equals(itemKey))
                    || (item.getMenuItemId() != null && item.getMenuItemId().equals(itemKey));
            if (matches) {
                if (quantity <= 0) {
                    removeItem(itemKey);
                    return;
                }
                item.setQuantity(quantity);
                break;
            }
        }
        saveCart();
        notifyListeners();
    }

    public void clearCart() {
        items.clear();
        restaurantId = null;
        saveCart();
        notifyListeners();
    }

    public List<CartItem> getItems() {
        return new ArrayList<>(items);
    }

    public String getRestaurantId() {
        return restaurantId;
    }

    public int getTotalItemCount() {
        int count = 0;
        for (CartItem item : items) {
            count += item.getQuantity();
        }
        return count;
    }

    public double getSubtotal() {
        double total = 0;
        for (CartItem item : items) {
            total += item.getTotalPrice();
        }
        return total;
    }

    public boolean isEmpty() {
        return items.isEmpty();
    }

    private void saveCart() {
        String json = gson.toJson(items);
        prefs.edit()
                .putString(KEY_CART_ITEMS, json)
                .putString(KEY_RESTAURANT_ID, restaurantId)
                .apply();
    }

    private void loadCart() {
        try {
            String json = prefs.getString(KEY_CART_ITEMS, "[]");
            CartItem[] itemArray = gson.fromJson(json, CartItem[].class);
            if (itemArray != null) {
                items = new ArrayList<>(Arrays.asList(itemArray));
            } else {
                items = new ArrayList<>();
            }
        } catch (Exception e) {
            items = new ArrayList<>();
        }
        restaurantId = prefs.getString(KEY_RESTAURANT_ID, null);
    }

    // Delivery address management (mirrors web's CartContext.deliveryAddress)
    private com.ssr.hunger.models.Address deliveryAddress;

    public void setDeliveryAddress(com.ssr.hunger.models.Address address) {
        this.deliveryAddress = address;
        if (address != null) {
            prefs.edit().putString("delivery_address", gson.toJson(address)).apply();
        }
    }

    public com.ssr.hunger.models.Address getDeliveryAddress() {
        if (deliveryAddress == null) {
            String json = prefs.getString("delivery_address", null);
            if (json != null) {
                try {
                    deliveryAddress = gson.fromJson(json, com.ssr.hunger.models.Address.class);
                } catch (Exception e) {
                    deliveryAddress = null;
                }
            }
        }
        return deliveryAddress;
    }
}

