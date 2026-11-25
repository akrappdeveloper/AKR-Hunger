package com.ssr.hunger.models;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class OrderItem {
    private String menuItemId;
    private String name;
    private double price;
    private double basePrice;
    private int quantity;
    private String image;
    private String spiceLevel;
    private MenuItem.CustomizationOption selectedSize;
    private List<MenuItem.CustomizationOption> selectedAddOns;
    private String specialInstructions;

    public OrderItem() {}

    public OrderItem(String menuItemId, String name, double price, int quantity, String image) {
        this.menuItemId = menuItemId;
        this.name = name;
        this.price = price;
        this.quantity = quantity;
        this.image = image;
    }

    public String getMenuItemId() { return menuItemId; }
    public void setMenuItemId(String menuItemId) { this.menuItemId = menuItemId; }

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
            for (MenuItem.CustomizationOption a : selectedAddOns) {
                if (a != null && a.getName() != null) {
                    parts.add(a.getPrice() > 0
                            ? String.format(Locale.getDefault(), "+ %s (+₹%.0f)", a.getName(), a.getPrice())
                            : "+ " + a.getName() + " (Free)");
                }
            }
        }
        if (specialInstructions != null && !specialInstructions.trim().isEmpty()) {
            parts.add("📝 Note: " + specialInstructions.trim());
        }
        return String.join(" • ", parts);
    }
}
