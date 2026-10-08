package com.ssr.hunger.models;

import java.util.List;

/**
 * GroupMember model for Android app.
 */
public class GroupMember {

    private String userId;
    private String name;
    private String avatar;
    private boolean isHost;
    private Object joinedAt;
    private List<Object> items;
    private double subtotal;
    private String paymentStatus; // "pending" | "paid" | "split"
    private double paymentAmount;
    private String paymentId;

    public GroupMember() {}

    // Getters & Setters
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getAvatar() { return avatar; }
    public void setAvatar(String avatar) { this.avatar = avatar; }

    public boolean isHost() { return isHost; }
    public void setHost(boolean host) { isHost = host; }

    public Object getJoinedAt() { return joinedAt; }
    public void setJoinedAt(Object joinedAt) { this.joinedAt = joinedAt; }

    public List<Object> getItems() { return items; }
    public void setItems(List<Object> items) { this.items = items; }

    public double getSubtotal() { return subtotal; }
    public void setSubtotal(double subtotal) { this.subtotal = subtotal; }

    public String getPaymentStatus() { return paymentStatus; }
    public void setPaymentStatus(String paymentStatus) { this.paymentStatus = paymentStatus; }

    public double getPaymentAmount() { return paymentAmount; }
    public void setPaymentAmount(double paymentAmount) { this.paymentAmount = paymentAmount; }

    public String getPaymentId() { return paymentId; }
    public void setPaymentId(String paymentId) { this.paymentId = paymentId; }

    public boolean hasPaid() {
        return "paid".equals(paymentStatus);
    }

    public char getInitial() {
        return name != null && !name.isEmpty() ? Character.toUpperCase(name.charAt(0)) : '?';
    }
}
