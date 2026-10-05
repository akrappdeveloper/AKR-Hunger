package com.ssr.hunger.models;

import java.io.Serializable;
import java.util.List;

/**
 * Deal model representing a promo offer or coupon code.
 * Works seamlessly with Firebase Realtime Database and Firestore.
 */
public class Deal implements Serializable {
    private String id;
    private String code;
    private String title;
    private String description;
    private String emoji;
    private String discountType; // "percentage", "flat", "fixed", "free_delivery"
    private double discountValue;
    private double minOrder;
    private double maxDiscount;
    private String category;
    private boolean isActive;
    private String validUntil;
    private List<String> applicableRestaurants;

    // Required empty constructor for Firebase
    public Deal() {
        this.isActive = true;
        this.emoji = "🎫";
        this.discountType = "percentage";
        this.category = "all";
    }

    public Deal(String code, String title, String description, String emoji, String discountType, double discountValue, double minOrder, String category) {
        this.code = code;
        this.title = title;
        this.description = description;
        this.emoji = emoji;
        this.discountType = discountType;
        this.discountValue = discountValue;
        this.minOrder = minOrder;
        this.category = category;
        this.isActive = true;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getCode() { return code != null ? code : ""; }
    public void setCode(String code) { this.code = code; }

    public String getTitle() { return title != null ? title : ""; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description != null ? description : ""; }
    public void setDescription(String description) { this.description = description; }

    public String getEmoji() { return emoji != null && !emoji.isEmpty() ? emoji : "🎫"; }
    public void setEmoji(String emoji) { this.emoji = emoji; }

    public String getDiscountType() { return discountType != null ? discountType : "percentage"; }
    public void setDiscountType(String discountType) { this.discountType = discountType; }

    public double getDiscountValue() { return discountValue; }
    public void setDiscountValue(double discountValue) { this.discountValue = discountValue; }

    public double getMinOrder() { return minOrder; }
    public void setMinOrder(double minOrder) { this.minOrder = minOrder; }

    public double getMaxDiscount() { return maxDiscount; }
    public void setMaxDiscount(double maxDiscount) { this.maxDiscount = maxDiscount; }

    public String getCategory() { return category != null ? category : "all"; }
    public void setCategory(String category) { this.category = category; }

    public boolean isActive() { return isActive; }
    public void setActive(boolean active) { isActive = active; }

    public String getValidUntil() { return validUntil; }
    public void setValidUntil(String validUntil) { this.validUntil = validUntil; }

    public List<String> getApplicableRestaurants() { return applicableRestaurants; }
    public void setApplicableRestaurants(List<String> applicableRestaurants) { this.applicableRestaurants = applicableRestaurants; }

    public String getDiscountBadgeText() {
        if ("free_delivery".equalsIgnoreCase(discountType)) {
            return "FREE DELIVERY";
        } else if ("flat".equalsIgnoreCase(discountType) || "fixed".equalsIgnoreCase(discountType)) {
            return "FLAT ₹" + (int) discountValue + " OFF";
        } else {
            return (int) discountValue + "% OFF";
        }
    }
}
