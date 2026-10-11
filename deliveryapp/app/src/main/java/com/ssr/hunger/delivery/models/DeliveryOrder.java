package com.ssr.hunger.delivery.models;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;

public class DeliveryOrder implements Serializable {
    private String id;
    private String customerId;
    private String customerName;
    private String customerPhone;
    private String restaurantId;
    private String restaurantName;
    private String restaurantPhone;
    private String restaurantAddress;
    private double restaurantLatitude;
    private double restaurantLongitude;
    private String restaurantPincode;

    private String deliveryAddressStreet;
    private String deliveryAddressCity;
    private String deliveryAddressPincode;
    private double deliveryLatitude;
    private double deliveryLongitude;

    private List<OrderItem> items;
    private String status;
    private String deliveryStage;
    private String deliveryPersonId;
    private String deliveryPersonName;
    private String deliveryPersonPhone;

    private double deliveryCharge;
    private double tipAmount;
    private double subtotal;
    private double total;

    private String paymentMethod;
    private String paymentStatus;
    private String deliveryOtp;
    private String returnOtp;
    private String returnStatus;
    private Date createdAt;
    private Date acceptedAt;
    private Date deliveredAt;
    private String specialInstructions;
    private List<String> targetDeliveryIds;

    public DeliveryOrder() {
        this.items = new ArrayList<>();
        this.targetDeliveryIds = new ArrayList<>();
        this.deliveryCharge = 40.0;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getCustomerId() { return customerId; }
    public void setCustomerId(String customerId) { this.customerId = customerId; }

    public String getCustomerName() { return customerName != null ? customerName : "Customer"; }
    public void setCustomerName(String customerName) { this.customerName = customerName; }

    public String getCustomerPhone() { return customerPhone != null ? customerPhone : ""; }
    public void setCustomerPhone(String customerPhone) { this.customerPhone = customerPhone; }

    public String getRestaurantId() { return restaurantId; }
    public void setRestaurantId(String restaurantId) { this.restaurantId = restaurantId; }

    public String getRestaurantName() { return restaurantName != null ? restaurantName : "Restaurant"; }
    public void setRestaurantName(String restaurantName) { this.restaurantName = restaurantName; }

    public String getRestaurantPhone() { return restaurantPhone != null ? restaurantPhone : ""; }
    public void setRestaurantPhone(String restaurantPhone) { this.restaurantPhone = restaurantPhone; }

    public String getRestaurantAddress() {
        return restaurantAddress != null && !restaurantAddress.isEmpty() ? restaurantAddress : "Restaurant Address";
    }
    public void setRestaurantAddress(String restaurantAddress) { this.restaurantAddress = restaurantAddress; }

    public double getRestaurantLatitude() { return restaurantLatitude; }
    public void setRestaurantLatitude(double restaurantLatitude) { this.restaurantLatitude = restaurantLatitude; }

    public double getRestaurantLongitude() { return restaurantLongitude; }
    public void setRestaurantLongitude(double restaurantLongitude) { this.restaurantLongitude = restaurantLongitude; }

    public String getRestaurantPincode() { return restaurantPincode != null ? restaurantPincode : ""; }
    public void setRestaurantPincode(String restaurantPincode) { this.restaurantPincode = restaurantPincode; }

    public String getDeliveryAddressStreet() {
        return deliveryAddressStreet != null ? deliveryAddressStreet : "Customer Address";
    }
    public void setDeliveryAddressStreet(String deliveryAddressStreet) { this.deliveryAddressStreet = deliveryAddressStreet; }

    public String getDeliveryAddressCity() { return deliveryAddressCity != null ? deliveryAddressCity : ""; }
    public void setDeliveryAddressCity(String deliveryAddressCity) { this.deliveryAddressCity = deliveryAddressCity; }

    public String getDeliveryAddressPincode() { return deliveryAddressPincode != null ? deliveryAddressPincode : ""; }
    public void setDeliveryAddressPincode(String deliveryAddressPincode) { this.deliveryAddressPincode = deliveryAddressPincode; }

    public String getFullDeliveryAddress() {
        StringBuilder sb = new StringBuilder();
        if (deliveryAddressStreet != null && !deliveryAddressStreet.isEmpty()) sb.append(deliveryAddressStreet);
        if (deliveryAddressCity != null && !deliveryAddressCity.isEmpty()) {
            if (sb.length() > 0) sb.append(", ");
            sb.append(deliveryAddressCity);
        }
        if (deliveryAddressPincode != null && !deliveryAddressPincode.isEmpty()) {
            if (sb.length() > 0) sb.append(" - ");
            sb.append(deliveryAddressPincode);
        }
        return sb.length() > 0 ? sb.toString() : "Customer Address";
    }

    public double getDeliveryLatitude() { return deliveryLatitude; }
    public void setDeliveryLatitude(double deliveryLatitude) { this.deliveryLatitude = deliveryLatitude; }

    public double getDeliveryLongitude() { return deliveryLongitude; }
    public void setDeliveryLongitude(double deliveryLongitude) { this.deliveryLongitude = deliveryLongitude; }

    public List<OrderItem> getItems() { return items != null ? items : new ArrayList<>(); }
    public void setItems(List<OrderItem> items) { this.items = items; }

    public String getStatus() { return status != null ? status : "confirmed"; }
    public void setStatus(String status) { this.status = status; }

    public String getDeliveryStage() {
        return deliveryStage != null ? deliveryStage : "to_restaurant";
    }
    public void setDeliveryStage(String deliveryStage) { this.deliveryStage = deliveryStage; }

    public String getDeliveryPersonId() { return deliveryPersonId; }
    public void setDeliveryPersonId(String deliveryPersonId) { this.deliveryPersonId = deliveryPersonId; }

    public String getDeliveryPersonName() { return deliveryPersonName; }
    public void setDeliveryPersonName(String deliveryPersonName) { this.deliveryPersonName = deliveryPersonName; }

    public String getDeliveryPersonPhone() { return deliveryPersonPhone; }
    public void setDeliveryPersonPhone(String deliveryPersonPhone) { this.deliveryPersonPhone = deliveryPersonPhone; }

    public double getDeliveryCharge() { return deliveryCharge > 0 ? deliveryCharge : 40.0; }
    public void setDeliveryCharge(double deliveryCharge) { this.deliveryCharge = deliveryCharge; }

    public double getTipAmount() { return tipAmount; }
    public void setTipAmount(double tipAmount) { this.tipAmount = tipAmount; }

    public double getEstimatedEarning() {
        return getDeliveryCharge() + getTipAmount();
    }

    public double getSubtotal() { return subtotal; }
    public void setSubtotal(double subtotal) { this.subtotal = subtotal; }

    public double getTotal() { return total; }
    public void setTotal(double total) { this.total = total; }
    public double getTotalAmount() { return total > 0 ? total : subtotal; }

    public Date getDeliveredAt() { return deliveredAt != null ? deliveredAt : createdAt; }
    public void setDeliveredAt(Date deliveredAt) { this.deliveredAt = deliveredAt; }

    public Date getAcceptedAt() { return acceptedAt != null ? acceptedAt : createdAt; }
    public void setAcceptedAt(Date acceptedAt) { this.acceptedAt = acceptedAt; }

    public String getPaymentMethod() { return paymentMethod != null ? paymentMethod : "online"; }
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }

    public String getPaymentStatus() { return paymentStatus != null ? paymentStatus : "completed"; }
    public void setPaymentStatus(String paymentStatus) { this.paymentStatus = paymentStatus; }

    public String getDeliveryOtp() { return deliveryOtp != null ? deliveryOtp : ""; }
    public void setDeliveryOtp(String deliveryOtp) { this.deliveryOtp = deliveryOtp; }

    public String getReturnOtp() { return returnOtp != null ? returnOtp : ""; }
    public void setReturnOtp(String returnOtp) { this.returnOtp = returnOtp; }

    public String getReturnStatus() { return returnStatus; }
    public void setReturnStatus(String returnStatus) { this.returnStatus = returnStatus; }

    public Date getCreatedAt() { return createdAt; }
    public void setCreatedAt(Date createdAt) { this.createdAt = createdAt; }

    public String getSpecialInstructions() { return specialInstructions; }
    public void setSpecialInstructions(String specialInstructions) { this.specialInstructions = specialInstructions; }

    public List<String> getTargetDeliveryIds() { return targetDeliveryIds; }
    public void setTargetDeliveryIds(List<String> targetDeliveryIds) { this.targetDeliveryIds = targetDeliveryIds; }

    public String getFormattedOrderId() {
        if (id == null) return "#ORD";
        if (id.length() > 6) return "#" + id.substring(id.length() - 6).toUpperCase();
        return "#" + id.toUpperCase();
    }
}
