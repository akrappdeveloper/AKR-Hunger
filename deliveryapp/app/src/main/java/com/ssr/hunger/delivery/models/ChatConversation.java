package com.ssr.hunger.delivery.models;

import com.google.firebase.database.IgnoreExtraProperties;

@IgnoreExtraProperties
public class ChatConversation {
    private String chatId;
    private String orderId;
    private String orderNumber;
    private String chatType;
    private String status;
    private long createdAt;
    private long updatedAt;
    private String lastMessage;
    private long lastMessageAt;
    private String lastMessageSenderId;
    private String lastMessageSenderRole;
    private String restaurantName;
    private String customerName;
    private String deliveryName;

    public ChatConversation() {
        // Default constructor for Firebase RTDB
    }

    public String getChatId() { return chatId; }
    public void setChatId(String chatId) { this.chatId = chatId; }

    public String getOrderId() { return orderId; }
    public void setOrderId(String orderId) { this.orderId = orderId; }

    public String getOrderNumber() { return orderNumber; }
    public void setOrderNumber(String orderNumber) { this.orderNumber = orderNumber; }

    public String getChatType() { return chatType; }
    public void setChatType(String chatType) { this.chatType = chatType; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public long getCreatedAt() { return createdAt; }
    public void setCreatedAt(long createdAt) { this.createdAt = createdAt; }

    public long getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(long updatedAt) { this.updatedAt = updatedAt; }

    public String getLastMessage() { return lastMessage; }
    public void setLastMessage(String lastMessage) { this.lastMessage = lastMessage; }

    public long getLastMessageAt() { return lastMessageAt; }
    public void setLastMessageAt(long lastMessageAt) { this.lastMessageAt = lastMessageAt; }

    public String getLastMessageSenderId() { return lastMessageSenderId; }
    public void setLastMessageSenderId(String lastMessageSenderId) { this.lastMessageSenderId = lastMessageSenderId; }

    public String getLastMessageSenderRole() { return lastMessageSenderRole; }
    public void setLastMessageSenderRole(String lastMessageSenderRole) { this.lastMessageSenderRole = lastMessageSenderRole; }

    public String getRestaurantName() { return restaurantName; }
    public void setRestaurantName(String restaurantName) { this.restaurantName = restaurantName; }

    public String getCustomerName() { return customerName; }
    public void setCustomerName(String customerName) { this.customerName = customerName; }

    public String getDeliveryName() { return deliveryName; }
    public void setDeliveryName(String deliveryName) { this.deliveryName = deliveryName; }
}
