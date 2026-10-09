package com.ssr.hunger.delivery.services;

import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.ServerValue;
import com.ssr.hunger.delivery.models.ChatMessage;

import java.util.HashMap;
import java.util.Map;

public class RiderChatService {
    private static RiderChatService instance;
    private final FirebaseDatabase database;

    public static final String[] RIDER_QUICK_REPLIES = {
            "I have arrived at the restaurant.",
            "Is the food packed and ready for pickup?",
            "Picked up! Heading to your address now 🛵",
            "I am arriving in 2 minutes.",
            "I have arrived at your building/gate.",
            "Please confirm your exact house/flat number.",
            "Traffic delay, reaching safely soon.",
            "Delivered with care. Enjoy your meal!"
    };

    private RiderChatService() {
        database = FirebaseDatabase.getInstance();
    }

    public static synchronized RiderChatService getInstance() {
        if (instance == null) {
            instance = new RiderChatService();
        }
        return instance;
    }

    public static String getDeterministicChatId(String orderId, String chatType) {
        if (orderId == null) orderId = "order";
        String cleanOrderId = orderId.replaceAll("[^a-zA-Z0-9_-]", "");
        return "chat_" + cleanOrderId + "_" + chatType;
    }

    public void sendMessage(String chatId, String orderId, String senderId,
                            String senderName, String text, String type,
                            final MessageCallback callback) {
        if (chatId == null || text == null || text.trim().isEmpty()) {
            if (callback != null) callback.onError("Invalid message text");
            return;
        }

        DatabaseReference messagesRef = database.getReference("chats").child(chatId).child("messages");
        DatabaseReference newMsgRef = messagesRef.push();
        String messageId = newMsgRef.getKey();

        long now = System.currentTimeMillis();
        ChatMessage message = new ChatMessage(messageId, chatId, orderId, senderId, "delivery", senderName, type, text.trim(), now);

        newMsgRef.setValue(message)
                .addOnSuccessListener(aVoid -> {
                    Map<String, Object> updates = new HashMap<>();
                    updates.put("chats/" + chatId + "/lastMessage", text.trim());
                    updates.put("chats/" + chatId + "/lastMessageAt", now);
                    updates.put("chats/" + chatId + "/lastMessageSenderId", senderId);
                    updates.put("chats/" + chatId + "/lastMessageSenderRole", "delivery");
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

    public void setPresence(String userId, boolean isOnline, String name) {
        if (userId == null) return;
        DatabaseReference ref = database.getReference("chatPresence").child(userId);
        Map<String, Object> data = new HashMap<>();
        data.put("online", isOnline);
        data.put("lastSeen", System.currentTimeMillis());
        data.put("name", name);
        data.put("role", "delivery");
        ref.setValue(data);

        if (isOnline) {
            Map<String, Object> disconnectData = new HashMap<>();
            disconnectData.put("online", false);
            disconnectData.put("lastSeen", ServerValue.TIMESTAMP);
            disconnectData.put("name", name);
            disconnectData.put("role", "delivery");
            ref.onDisconnect().setValue(disconnectData);
        }
    }

    public interface MessageCallback {
        void onSuccess(ChatMessage message);
        void onError(String error);
    }
}
