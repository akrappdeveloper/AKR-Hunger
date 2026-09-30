package com.ssr.hunger.models;

import java.util.Date;
import java.util.List;
import java.util.Map;

public class Order {
    private String id;
    private String customerId;
    private String restaurantId;
    private List<OrderItem> items;
    private String status; // pending, confirmed, preparing, ready, out_for_delivery, delivered, cancelled
    private String paymentMethod; // cod, online, wallet
    private String paymentStatus; // pending, completed, failed
    private String razorpayOrderId;
    private String razorpayPaymentId;
    private double subtotal;
    private double deliveryCharge;
    private double taxes;
    private double total;
    private String specialInstructions;
    private String deliveryPersonId;
    private int estimatedDeliveryTime;
    private Date createdAt;
    private String customerName;
    private String customerPhone;
    private String restaurantName;
    private String promotionId;
    private double discountAmount;
    private boolean hasReview;
    private String deliveryPersonName;
    private String deliveryPersonPhone;
    private String deliveryOtp;

    // Delivery address fields
    private String deliveryAddressStreet;
    private String deliveryAddressCity;
    private String deliveryAddressPincode;

    public Order() {}

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getCustomerId() { return customerId; }
    public void setCustomerId(String customerId) { this.customerId = customerId; }

    public String getRestaurantId() { return restaurantId; }
    public void setRestaurantId(String restaurantId) { this.restaurantId = restaurantId; }

    public List<OrderItem> getItems() { return items; }
    public void setItems(List<OrderItem> items) { this.items = items; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getPaymentMethod() { return paymentMethod; }
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }

    public String getPaymentStatus() { return paymentStatus; }
    public void setPaymentStatus(String paymentStatus) { this.paymentStatus = paymentStatus; }

    public String getRazorpayOrderId() { return razorpayOrderId; }
    public void setRazorpayOrderId(String razorpayOrderId) { this.razorpayOrderId = razorpayOrderId; }

    public String getRazorpayPaymentId() { return razorpayPaymentId; }
    public void setRazorpayPaymentId(String razorpayPaymentId) { this.razorpayPaymentId = razorpayPaymentId; }

    public double getSubtotal() { return subtotal; }
    public void setSubtotal(double subtotal) { this.subtotal = subtotal; }

    public double getDeliveryCharge() { return deliveryCharge; }
    public void setDeliveryCharge(double deliveryCharge) { this.deliveryCharge = deliveryCharge; }

    public double getTaxes() { return taxes; }
    public void setTaxes(double taxes) { this.taxes = taxes; }

    public double getTotal() { return total; }
    public void setTotal(double total) { this.total = total; }

    public String getSpecialInstructions() { return specialInstructions; }
    public void setSpecialInstructions(String specialInstructions) { this.specialInstructions = specialInstructions; }

    public String getDeliveryPersonId() { return deliveryPersonId; }
    public void setDeliveryPersonId(String deliveryPersonId) { this.deliveryPersonId = deliveryPersonId; }

    public int getEstimatedDeliveryTime() { return estimatedDeliveryTime; }
    public void setEstimatedDeliveryTime(int estimatedDeliveryTime) { this.estimatedDeliveryTime = estimatedDeliveryTime; }

    public Date getCreatedAt() { return createdAt; }
    public void setCreatedAt(Date createdAt) { this.createdAt = createdAt; }

    public String getCustomerName() { return customerName; }
    public void setCustomerName(String customerName) { this.customerName = customerName; }

    public String getCustomerPhone() { return customerPhone; }
    public void setCustomerPhone(String customerPhone) { this.customerPhone = customerPhone; }

    public String getRestaurantName() { return restaurantName; }
    public void setRestaurantName(String restaurantName) { this.restaurantName = restaurantName; }

    public String getPromotionId() { return promotionId; }
    public void setPromotionId(String promotionId) { this.promotionId = promotionId; }

    public double getDiscountAmount() { return discountAmount; }
    public void setDiscountAmount(double discountAmount) { this.discountAmount = discountAmount; }

    public boolean isHasReview() { return hasReview; }
    public void setHasReview(boolean hasReview) { this.hasReview = hasReview; }

    public String getDeliveryPersonName() { return deliveryPersonName; }
    public void setDeliveryPersonName(String deliveryPersonName) { this.deliveryPersonName = deliveryPersonName; }

    public String getDeliveryPersonPhone() { return deliveryPersonPhone; }
    public void setDeliveryPersonPhone(String deliveryPersonPhone) { this.deliveryPersonPhone = deliveryPersonPhone; }

    public String getDeliveryOtp() { return deliveryOtp; }
    public void setDeliveryOtp(String deliveryOtp) { this.deliveryOtp = deliveryOtp; }

    public String getDeliveryAddressStreet() { return deliveryAddressStreet; }
    public void setDeliveryAddressStreet(String s) { this.deliveryAddressStreet = s; }

    public String getDeliveryAddressCity() { return deliveryAddressCity; }
    public void setDeliveryAddressCity(String s) { this.deliveryAddressCity = s; }

    public String getDeliveryAddressPincode() { return deliveryAddressPincode; }
    public void setDeliveryAddressPincode(String s) { this.deliveryAddressPincode = s; }

    public String getStatusDisplay() {
        if (status == null) return "Pending";
        switch (status) {
            case "pending": return "Order Placed";
            case "confirmed": return "Confirmed";
            case "preparing": return "Preparing";
            case "ready": return "Ready";
            case "out_for_delivery": return "On the Way";
            case "delivered": return "Delivered";
            case "cancelled": return "Cancelled";
            default: return status;
        }
    }
}
