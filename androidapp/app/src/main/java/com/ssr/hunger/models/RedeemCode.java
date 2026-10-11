package com.ssr.hunger.models;

import java.io.Serializable;

/**
 * RedeemCode model representing gift vouchers, loyalty point codes, and promotional credits.
 * Loaded from Firebase Realtime Database (/redeem_codes).
 */
public class RedeemCode implements Serializable {
    private String id;
    private String code;
    private String type; // "points", "wallet", "discount", "delivery"
    private String benefitType;
    private double value;
    private String discountType; // "flat", "percentage"
    private double minOrderValue;
    private double maxDiscount;
    private String description;
    private int maxRedemptions;
    private int redemptionCount;
    private boolean isActive;
    private String expiresAt;

    // Required empty constructor for Firebase
    public RedeemCode() {
        this.isActive = true;
        this.type = "points";
        this.benefitType = "points";
        this.maxRedemptions = 1000;
    }

    public RedeemCode(String code, String type, double value, String description) {
        this.code = code;
        this.type = type;
        this.benefitType = type;
        this.value = value;
        this.description = description;
        this.isActive = true;
        this.maxRedemptions = 500;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getCode() { return code != null ? code : ""; }
    public void setCode(String code) { this.code = code; }

    public String getType() { return type != null ? type : (benefitType != null ? benefitType : "points"); }
    public void setType(String type) { this.type = type; }

    public String getBenefitType() { return benefitType != null ? benefitType : (type != null ? type : "points"); }
    public void setBenefitType(String benefitType) { this.benefitType = benefitType; }

    public double getValue() { return value; }
    public void setValue(double value) { this.value = value; }

    public String getDiscountType() { return discountType != null ? discountType : "flat"; }
    public void setDiscountType(String discountType) { this.discountType = discountType; }

    public double getMinOrderValue() { return minOrderValue; }
    public void setMinOrderValue(double minOrderValue) { this.minOrderValue = minOrderValue; }

    public double getMaxDiscount() { return maxDiscount; }
    public void setMaxDiscount(double maxDiscount) { this.maxDiscount = maxDiscount; }

    public String getDescription() { return description != null ? description : ""; }
    public void setDescription(String description) { this.description = description; }

    public int getMaxRedemptions() { return maxRedemptions; }
    public void setMaxRedemptions(int maxRedemptions) { this.maxRedemptions = maxRedemptions; }

    public int getRedemptionCount() { return redemptionCount; }
    public void setRedemptionCount(int redemptionCount) { this.redemptionCount = redemptionCount; }

    public boolean isActive() { return isActive; }
    public void setActive(boolean active) { isActive = active; }

    public String getExpiresAt() { return expiresAt; }
    public void setExpiresAt(String expiresAt) { this.expiresAt = expiresAt; }
}
