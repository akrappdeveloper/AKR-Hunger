package com.ssr.hunger.models;

import java.util.Date;

/**
 * Model representing customer notifications with rich metadata and relative timestamps.
 */
public class NotificationItem {
    private String id;
    private String userId;
    private String title;
    private String message;
    private String type; // order, payment, wallet, promo, system
    private String subType;
    private String orderId;
    private String actionUrl;
    private boolean read;
    private Date createdAt;

    public NotificationItem() {}

    public NotificationItem(String id, String userId, String title, String message, String type, String orderId, boolean read, Date createdAt) {
        this.id = id;
        this.userId = userId;
        this.title = title;
        this.message = message;
        this.type = type;
        this.orderId = orderId;
        this.read = read;
        this.createdAt = createdAt;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getSubType() { return subType; }
    public void setSubType(String subType) { this.subType = subType; }

    public String getOrderId() { return orderId; }
    public void setOrderId(String orderId) { this.orderId = orderId; }

    public String getActionUrl() { return actionUrl; }
    public void setActionUrl(String actionUrl) { this.actionUrl = actionUrl; }

    public boolean isRead() { return read; }
    public void setRead(boolean read) { this.read = read; }

    public Date getCreatedAt() { return createdAt; }
    public void setCreatedAt(Date createdAt) { this.createdAt = createdAt; }

    public String getRelativeTime() {
        if (createdAt == null) return "Recent";
        long diff = System.currentTimeMillis() - createdAt.getTime();
        if (diff < 0) diff = 0;
        long seconds = diff / 1000;
        long minutes = seconds / 60;
        long hours = minutes / 60;
        long days = hours / 24;

        if (minutes < 1) {
            return "Just now";
        } else if (minutes < 60) {
            return minutes + "m ago";
        } else if (hours < 24) {
            return hours + "h ago";
        } else if (days < 7) {
            return days + "d ago";
        } else {
            java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("dd MMM", java.util.Locale.getDefault());
            return sdf.format(createdAt);
        }
    }

    public String getIconEmoji() {
        if (title != null) {
            String lower = title.toLowerCase();
            if (lower.contains("delivered")) return "🍽️";
            if (lower.contains("out for delivery") || lower.contains("on the way")) return "🛵";
            if (lower.contains("cancelled")) return "❌";
            if (lower.contains("confirmed") || lower.contains("preparing")) return "👨‍🍳";
            if (lower.contains("ready") || lower.contains("pickup")) return "📦";
        }
        if (subType != null) {
            String lower = subType.toLowerCase();
            if (lower.contains("delivered")) return "🍽️";
            if (lower.contains("delivery")) return "🛵";
            if (lower.contains("cancel")) return "❌";
            if (lower.contains("confirm")) return "👨‍🍳";
            if (lower.contains("ready")) return "📦";
        }
        if (type == null) return "🔔";
        switch (type.toLowerCase()) {
            case "order":
                return "🛍️";
            case "wallet":
            case "payment":
                return "💰";
            case "promo":
                return "🏷️";
            default:
                return "🔔";
        }
    }
}
