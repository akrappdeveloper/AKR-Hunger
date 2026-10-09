package com.ssr.hunger.services;

import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.ServerValue;
import com.ssr.hunger.models.ChatMessage;

import java.util.HashMap;
import java.util.Map;

public class ChatService {
    private static ChatService instance;
    private final FirebaseDatabase database;

    public static final String[] CUSTOMER_QUICK_REPLIES = {
            "Where is my order?",
            "Please check my order details.",
            "Please call me when you arrive.",
            "Deliver to security gate please.",
            "Please don't ring the doorbell.",
            "Thank you very much!"
    };

    private ChatService() {
        database = FirebaseDatabase.getInstance();
    }

    public static synchronized ChatService getInstance() {
        if (instance == null) {
            instance = new ChatService();
        }
        return instance;
    }

    public static String getDeterministicChatId(String orderId, String chatType) {
        if (orderId == null) orderId = "order";
        String cleanOrderId = orderId.replaceAll("[^a-zA-Z0-9_-]", "");
        return "chat_" + cleanOrderId + "_" + chatType;
    }

    public void sendMessage(String chatId, String orderId, String senderId, String senderRole,
                            String senderName, String text, String type, String mediaPath,
                            String replyToText, final MessageCallback callback) {
        if (chatId == null || text == null || text.trim().isEmpty()) {
            if (callback != null) callback.onError("Invalid message content");
            return;
        }

        DatabaseReference messagesRef = database.getReference("chats").child(chatId).child("messages");
        DatabaseReference newMsgRef = messagesRef.push();
        String messageId = newMsgRef.getKey();

        long now = System.currentTimeMillis();
        ChatMessage message = new ChatMessage(messageId, chatId, orderId, senderId, senderRole, senderName, type, text.trim(), now);
        if (mediaPath != null) message.setMediaPath(mediaPath);
        if (replyToText != null) message.setReplyToText(replyToText);

        newMsgRef.setValue(message)
                .addOnSuccessListener(aVoid -> {
                    // Update chat metadata
                    Map<String, Object> updates = new HashMap<>();
                    String preview = "IMAGE".equalsIgnoreCase(type) ? "📷 [Image]" : text.trim();
                    updates.put("chats/" + chatId + "/lastMessage", preview);
                    updates.put("chats/" + chatId + "/lastMessageAt", now);
                    updates.put("chats/" + chatId + "/lastMessageSenderId", senderId);
                    updates.put("chats/" + chatId + "/lastMessageSenderRole", senderRole);
                    updates.put("chats/" + chatId + "/updatedAt", now);

                    database.getReference().updateChildren(updates);

                    if (callback != null) callback.onSuccess(message);
                })
                .addOnFailureListener(e -> {
                    if (callback != null) callback.onError(e.getMessage());
                });
    }

    public void markChatAsRead(String chatId, String currentUserId) {
        if (chatId == null || currentUserId == null) return;

        Map<String, Object> updates = new HashMap<>();
        updates.put("userChats/" + currentUserId + "/" + chatId + "/unreadCount", 0);
        updates.put("chats/" + chatId + "/participants/" + currentUserId + "/lastReadAt", System.currentTimeMillis());

        database.getReference().updateChildren(updates);
    }

    public void setTypingStatus(String chatId, String userId, String userName, boolean isTyping) {
        if (chatId == null || userId == null) return;
        DatabaseReference ref = database.getReference("chatTyping").child(chatId).child(userId);
        if (isTyping) {
            Map<String, Object> data = new HashMap<>();
            data.put("isTyping", true);
            data.put("userName", userName);
            data.put("updatedAt", System.currentTimeMillis());
            ref.setValue(data);
            ref.onDisconnect().removeValue();
        } else {
            ref.removeValue();
        }
    }

    public void setPresence(String userId, boolean isOnline, String name, String role) {
        if (userId == null) return;
        DatabaseReference ref = database.getReference("chatPresence").child(userId);
        Map<String, Object> data = new HashMap<>();
        data.put("online", isOnline);
        data.put("lastSeen", System.currentTimeMillis());
        data.put("name", name);
        data.put("role", role);
        ref.setValue(data);

        if (isOnline) {
            Map<String, Object> disconnectData = new HashMap<>();
            disconnectData.put("online", false);
            disconnectData.put("lastSeen", ServerValue.TIMESTAMP);
            disconnectData.put("name", name);
            disconnectData.put("role", role);
            ref.onDisconnect().setValue(disconnectData);
        }
    }

    public interface MessageCallback {
        void onSuccess(ChatMessage message);
        void onError(String error);
    }
}
