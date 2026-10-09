package com.ssr.hunger.models;

import com.google.firebase.database.IgnoreExtraProperties;

@IgnoreExtraProperties
public class ChatMessage {
    private String messageId;
    private String chatId;
    private String orderId;
    private String senderId;
    private String senderRole; // "customer", "restaurant", "delivery", "admin", "system"
    private String senderName;
    private String senderImage;
    private String type; // "TEXT", "IMAGE", "ORDER_UPDATE", "LOCATION", "SYSTEM", "QUICK_REPLY"
    private String text;
    private String mediaPath;
    private long createdAt;
    private String status; // "SENDING", "SENT", "DELIVERED", "READ", "FAILED"
    private String replyToMessageId;
    private String replyToText;
    private String replyToSenderName;

    public ChatMessage() {
        // Default constructor required for Firebase Realtime Database
    }

    public ChatMessage(String messageId, String chatId, String orderId, String senderId,
                       String senderRole, String senderName, String type, String text, long createdAt) {
        this.messageId = messageId;
        this.chatId = chatId;
        this.orderId = orderId;
        this.senderId = senderId;
        this.senderRole = senderRole;
        this.senderName = senderName;
        this.type = type;
        this.text = text;
        this.createdAt = createdAt;
        this.status = "SENT";
    }

    public String getMessageId() { return messageId; }
    public void setMessageId(String messageId) { this.messageId = messageId; }

    public String getChatId() { return chatId; }
    public void setChatId(String chatId) { this.chatId = chatId; }

    public String getOrderId() { return orderId; }
    public void setOrderId(String orderId) { this.orderId = orderId; }

    public String getSenderId() { return senderId; }
    public void setSenderId(String senderId) { this.senderId = senderId; }

    public String getSenderRole() { return senderRole; }
    public void setSenderRole(String senderRole) { this.senderRole = senderRole; }

    public String getSenderName() { return senderName; }
    public void setSenderName(String senderName) { this.senderName = senderName; }

    public String getSenderImage() { return senderImage; }
    public void setSenderImage(String senderImage) { this.senderImage = senderImage; }

    public String getType() { return type != null ? type : "TEXT"; }
    public void setType(String type) { this.type = type; }

    public String getText() { return text != null ? text : ""; }
    public void setText(String text) { this.text = text; }

    public String getMediaPath() { return mediaPath; }
    public void setMediaPath(String mediaPath) { this.mediaPath = mediaPath; }

    public long getCreatedAt() { return createdAt; }
    public void setCreatedAt(long createdAt) { this.createdAt = createdAt; }

    public String getStatus() { return status != null ? status : "SENT"; }
    public void setStatus(String status) { this.status = status; }

    public String getReplyToMessageId() { return replyToMessageId; }
    public void setReplyToMessageId(String replyToMessageId) { this.replyToMessageId = replyToMessageId; }

    public String getReplyToText() { return replyToText; }
    public void setReplyToText(String replyToText) { this.replyToText = replyToText; }

    public String getReplyToSenderName() { return replyToSenderName; }
    public void setReplyToSenderName(String replyToSenderName) { this.replyToSenderName = replyToSenderName; }
}
