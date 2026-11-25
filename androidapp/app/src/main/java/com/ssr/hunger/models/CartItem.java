package com.ssr.hunger.models;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

public class CartItem {
    private String id;
    private String menuItemId;
    private String restaurantId;
    private String name;
    private double price;
    private double basePrice;
    private int quantity;
    private String image;
    private String restaurantName;
    private String category;
    private String spiceLevel;
    private MenuItem.CustomizationOption selectedSize;
    private List<MenuItem.CustomizationOption> selectedAddOns;
    private String specialInstructions;

    public CartItem() {}

    public CartItem(String menuItemId, String restaurantId, String name,
                    double price, int quantity, String image, String restaurantName) {
        this.id = menuItemId + "_" + System.currentTimeMillis();
        this.menuItemId = menuItemId;
        this.restaurantId = restaurantId;
        this.name = name;
        this.price = price;
        this.quantity = quantity;
        this.image = image;
        this.restaurantName = restaurantName;
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getMenuItemId() { return menuItemId; }
    public void setMenuItemId(String menuItemId) { this.menuItemId = menuItemId; }

    public String getRestaurantId() { return restaurantId; }
    public void setRestaurantId(String restaurantId) { this.restaurantId = restaurantId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public double getPrice() { return price; }
    public void setPrice(double price) { this.price = price; }

    public double getBasePrice() { return basePrice; }
    public void setBasePrice(double basePrice) { this.basePrice = basePrice; }

    public int getQuantity() { return quantity; }
    public void setQuantity(int quantity) { this.quantity = quantity; }

    public String getImage() { return image; }
    public void setImage(String image) { this.image = image; }

    public String getRestaurantName() { return restaurantName; }
    public void setRestaurantName(String restaurantName) { this.restaurantName = restaurantName; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getSpiceLevel() { return spiceLevel; }
    public void setSpiceLevel(String spiceLevel) { this.spiceLevel = spiceLevel; }

    public MenuItem.CustomizationOption getSelectedSize() { return selectedSize; }
    public void setSelectedSize(MenuItem.CustomizationOption selectedSize) { this.selectedSize = selectedSize; }

    public List<MenuItem.CustomizationOption> getSelectedAddOns() { return selectedAddOns; }
    public void setSelectedAddOns(List<MenuItem.CustomizationOption> selectedAddOns) { this.selectedAddOns = selectedAddOns; }

    public String getSpecialInstructions() { return specialInstructions; }
    public void setSpecialInstructions(String specialInstructions) { this.specialInstructions = specialInstructions; }

    public double getSizeExtra() {
        return selectedSize != null ? selectedSize.getPrice() : 0.0;
    }

    public double getAddOnsTotal() {
        if (selectedAddOns == null) return 0.0;
        double sum = 0.0;
        for (MenuItem.CustomizationOption opt : selectedAddOns) {
            if (opt != null) sum += opt.getPrice();
        }
        return sum;
    }

    public double getEffectiveBasePrice() {
        if (basePrice > 0) return basePrice;
        double extras = getSizeExtra() + getAddOnsTotal();
        return extras > 0 ? Math.max(0.0, price - extras) : price;
    }

    public boolean hasCustomizations() {
        return (spiceLevel != null && !spiceLevel.trim().isEmpty())
                || (selectedSize != null && selectedSize.getName() != null)
                || (selectedAddOns != null && !selectedAddOns.isEmpty())
                || (specialInstructions != null && !specialInstructions.trim().isEmpty());
    }

    public String getCustomizationSummary() {
        List<String> parts = new ArrayList<>();
        double extras = getSizeExtra() + getAddOnsTotal();
        if (extras > 0) {
            parts.add(String.format(Locale.getDefault(), "Base: ₹%.0f", getEffectiveBasePrice()));
        }
        if (spiceLevel != null && !spiceLevel.trim().isEmpty()) {
            parts.add("🌶️ Spice: " + spiceLevel.trim());
        }
        if (selectedSize != null && selectedSize.getName() != null) {
            String sizePrice = selectedSize.getPrice() > 0
                    ? String.format(Locale.getDefault(), " (+₹%.0f)", selectedSize.getPrice())
                    : " (Standard)";
            parts.add("📏 Size: " + selectedSize.getName() + sizePrice);
        }
        if (selectedAddOns != null && !selectedAddOns.isEmpty()) {
            List<String> addonLabels = new ArrayList<>();
            for (MenuItem.CustomizationOption a : selectedAddOns) {
                if (a != null && a.getName() != null) {
                    addonLabels.add(a.getPrice() > 0
                            ? String.format(Locale.getDefault(), "+ %s (+₹%.0f)", a.getName(), a.getPrice())
                            : "+ " + a.getName() + " (Free)");
                }
            }
            if (!addonLabels.isEmpty()) {
                parts.add(String.join(", ", addonLabels));
            }
        }
        if (specialInstructions != null && !specialInstructions.trim().isEmpty()) {
            parts.add("📝 Note: " + specialInstructions.trim());
        }
        return String.join("\n", parts);
    }

    public String getCustomizationSignature() {
        String spice = spiceLevel != null ? spiceLevel.trim() : "";
        String size = (selectedSize != null && selectedSize.getName() != null)
                ? selectedSize.getName() + ":" + selectedSize.getPrice()
                : "";
        List<String> addonKeys = new ArrayList<>();
        if (selectedAddOns != null) {
            for (MenuItem.CustomizationOption a : selectedAddOns) {
                if (a != null && a.getName() != null) {
                    addonKeys.add(a.getName() + ":" + a.getPrice());
                }
            }
            Collections.sort(addonKeys);
        }
        String note = specialInstructions != null ? specialInstructions.trim() : "";
        return menuItemId + "|" + spice + "|" + size + "|" + String.join(",", addonKeys) + "|" + note;
    }

    public double getTotalPrice() {
        return price * quantity;
    }
}
