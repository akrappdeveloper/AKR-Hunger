package com.ssr.hunger.models;

import java.util.List;

/**
 * GroupOrder model for Android app.
 * Mirrors the GroupOrder TypeScript type.
 */
public class GroupOrder {

    private String id;
    private String hostId;
    private String hostName;
    private String restaurantId;
    private String restaurantName;
    private String inviteCode;
    private String inviteLink;
    private String status; // "open" | "locked" | "placed" | "cancelled"
    private List<GroupMember> members;
    private double totalAmount;
    private Object deadline;
    private Object createdAt;
    private Object updatedAt;
    private String combinedOrderId;

    public GroupOrder() {}

    // Getters & Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getHostId() { return hostId; }
    public void setHostId(String hostId) { this.hostId = hostId; }

    public String getHostName() { return hostName; }
    public void setHostName(String hostName) { this.hostName = hostName; }

    public String getRestaurantId() { return restaurantId; }
    public void setRestaurantId(String restaurantId) { this.restaurantId = restaurantId; }

    public String getRestaurantName() { return restaurantName; }
    public void setRestaurantName(String restaurantName) { this.restaurantName = restaurantName; }

    public String getInviteCode() { return inviteCode; }
    public void setInviteCode(String inviteCode) { this.inviteCode = inviteCode; }

    public String getInviteLink() { return inviteLink; }
    public void setInviteLink(String inviteLink) { this.inviteLink = inviteLink; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public List<GroupMember> getMembers() { return members; }
    public void setMembers(List<GroupMember> members) { this.members = members; }

    public double getTotalAmount() { return totalAmount; }
    public void setTotalAmount(double totalAmount) { this.totalAmount = totalAmount; }

    public Object getDeadline() { return deadline; }
    public void setDeadline(Object deadline) { this.deadline = deadline; }

    public Object getCreatedAt() { return createdAt; }
    public void setCreatedAt(Object createdAt) { this.createdAt = createdAt; }

    public Object getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Object updatedAt) { this.updatedAt = updatedAt; }

    public String getCombinedOrderId() { return combinedOrderId; }
    public void setCombinedOrderId(String combinedOrderId) { this.combinedOrderId = combinedOrderId; }

    public boolean isHost(String userId) {
        return userId != null && userId.equals(hostId);
    }

    public boolean isOpen() {
        return "open".equals(status);
    }

    public boolean isLocked() {
        return "locked".equals(status);
    }
}
