package com.ssr.hunger.activities;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.Editable;
import android.text.TextUtils;
import android.text.TextWatcher;
import android.view.View;
import android.widget.EditText;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.button.MaterialButton;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.database.DataSnapshot;
import com.google.firebase.database.DatabaseError;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.ValueEventListener;
import com.ssr.hunger.R;
import com.ssr.hunger.adapters.ChatMessagesAdapter;
import com.ssr.hunger.models.ChatMessage;
import com.ssr.hunger.services.ChatService;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class ChatActivity extends BaseActivity {

    public static final String EXTRA_CHAT_ID = "extra_chat_id";
    public static final String EXTRA_ORDER_ID = "extra_order_id";
    public static final String EXTRA_ORDER_NUMBER = "extra_order_number";
    public static final String EXTRA_COUNTERPART_NAME = "extra_counterpart_name";
    public static final String EXTRA_COUNTERPART_ROLE = "extra_counterpart_role";
    public static final String EXTRA_PHONE = "extra_phone";

    private String chatId;
    private String orderId;
    private String orderNumber;
    private String counterpartName;
    private String counterpartRole;
    private String counterpartPhone;

    private String currentUserId;
    private String currentUserName;

    private RecyclerView rvMessages;
    private ChatMessagesAdapter adapter;
    private final List<ChatMessage> messageList = new ArrayList<>();

    private EditText etInput;
    private MaterialButton btnSend;
    private TextView tvTypingIndicator;
    private LinearLayout layoutQuickReplies;

    private DatabaseReference messagesRef;
    private DatabaseReference typingRef;
    private ValueEventListener messagesListener;
    private ValueEventListener typingListener;

    private final Handler typingHandler = new Handler(Looper.getMainLooper());
    private Runnable stopTypingRunnable;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_chat);

        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user != null) {
            currentUserId = user.getUid();
            currentUserName = user.getDisplayName() != null ? user.getDisplayName() : "Customer";
        } else {
            currentUserId = "guest_user";
            currentUserName = "Customer";
        }

        readIntentExtras();
        initViews();
        setupRecyclerView();
        setupQuickReplies();
        setupTyping();
        setupListeners();

        ChatService.getInstance().setPresence(currentUserId, true, currentUserName, "customer");
    }

    private void readIntentExtras() {
        Intent intent = getIntent();
        orderId = intent.getStringExtra(EXTRA_ORDER_ID);
        orderNumber = intent.getStringExtra(EXTRA_ORDER_NUMBER);
        counterpartName = intent.getStringExtra(EXTRA_COUNTERPART_NAME);
        counterpartRole = intent.getStringExtra(EXTRA_COUNTERPART_ROLE);
        counterpartPhone = intent.getStringExtra(EXTRA_PHONE);
        chatId = intent.getStringExtra(EXTRA_CHAT_ID);

        if (chatId == null && orderId != null) {
            String roleType = "delivery".equalsIgnoreCase(counterpartRole) ? "customer_delivery" : "customer_restaurant";
            chatId = ChatService.getDeterministicChatId(orderId, roleType);
        }
    }

    private void initViews() {
        TextView tvName = findViewById(R.id.tv_counterpart_name);
        TextView tvOrderBadge = findViewById(R.id.tv_order_badge);
        ImageButton btnBack = findViewById(R.id.btn_back);
        ImageButton btnCall = findViewById(R.id.btn_call);

        etInput = findViewById(R.id.et_message_input);
        btnSend = findViewById(R.id.btn_send_message);
        tvTypingIndicator = findViewById(R.id.tv_typing_indicator);
        layoutQuickReplies = findViewById(R.id.layout_quick_replies);
        rvMessages = findViewById(R.id.rv_chat_messages);

        if (tvName != null) tvName.setText(counterpartName != null ? counterpartName : "Hunger Chat");
        if (tvOrderBadge != null) {
            if (orderNumber != null) {
                tvOrderBadge.setText(orderNumber);
                tvOrderBadge.setVisibility(View.VISIBLE);
            } else if (orderId != null) {
                tvOrderBadge.setText("#" + (orderId.length() > 6 ? orderId.substring(orderId.length() - 6) : orderId));
                tvOrderBadge.setVisibility(View.VISIBLE);
            } else {
                tvOrderBadge.setVisibility(View.GONE);
            }
        }

        btnBack.setOnClickListener(v -> finish());

        if (!TextUtils.isEmpty(counterpartPhone)) {
            btnCall.setVisibility(View.VISIBLE);
            btnCall.setOnClickListener(v -> {
                Intent callIntent = new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + counterpartPhone));
                startActivity(callIntent);
            });
        }

        btnSend.setOnClickListener(v -> sendMessage(etInput.getText().toString().trim(), "TEXT"));
    }

    private void setupRecyclerView() {
        LinearLayoutManager layoutManager = new LinearLayoutManager(this);
        layoutManager.setStackFromEnd(true);
        rvMessages.setLayoutManager(layoutManager);
        adapter = new ChatMessagesAdapter(this, messageList, currentUserId);
        rvMessages.setAdapter(adapter);
    }

    private void setupQuickReplies() {
        if (layoutQuickReplies == null) return;
        layoutQuickReplies.removeAllViews();

        for (String reply : ChatService.CUSTOMER_QUICK_REPLIES) {
            TextView chip = new TextView(this);
            chip.setText(reply);
            chip.setTextSize(11f);
            chip.setTextColor(getColor(R.color.text_secondary));
            chip.setBackgroundResource(R.drawable.bg_chip_filter_unselected);
            chip.setPadding(28, 14, 28, 14);

            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
            );
            lp.setMargins(0, 0, 16, 0);
            chip.setLayoutParams(lp);

            chip.setOnClickListener(v -> sendMessage(reply, "QUICK_REPLY"));
            layoutQuickReplies.addView(chip);
        }
    }

    private void setupTyping() {
        stopTypingRunnable = () -> ChatService.getInstance().setTypingStatus(chatId, currentUserId, currentUserName, false);

        etInput.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {}

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                if (chatId == null) return;
                typingHandler.removeCallbacks(stopTypingRunnable);
                if (s.length() > 0) {
                    ChatService.getInstance().setTypingStatus(chatId, currentUserId, currentUserName, true);
                    typingHandler.postDelayed(stopTypingRunnable, 2500);
                } else {
                    ChatService.getInstance().setTypingStatus(chatId, currentUserId, currentUserName, false);
                }
            }

            @Override
            public void afterTextChanged(Editable s) {}
        });
    }

    private void setupListeners() {
        if (chatId == null) return;

        messagesRef = FirebaseDatabase.getInstance().getReference("chats").child(chatId).child("messages");
        messagesListener = new ValueEventListener() {
            @Override
            public void onDataChange(@NonNull DataSnapshot snapshot) {
                messageList.clear();
                if (snapshot.exists()) {
                    for (DataSnapshot child : snapshot.getChildren()) {
                        ChatMessage msg = child.getValue(ChatMessage.class);
                        if (msg != null) {
                            messageList.add(msg);
                        }
                    }
                    Collections.sort(messageList, (m1, m2) -> Long.compare(m1.getCreatedAt(), m2.getCreatedAt()));
                }
                adapter.notifyDataSetChanged();
                if (!messageList.isEmpty()) {
                    rvMessages.smoothScrollToPosition(messageList.size() - 1);
                }
                ChatService.getInstance().markChatAsRead(chatId, currentUserId);
            }

            @Override
            public void onCancelled(@NonNull DatabaseError error) {}
        };
        messagesRef.addValueEventListener(messagesListener);

        // Typing listener
        typingRef = FirebaseDatabase.getInstance().getReference("chatTyping").child(chatId);
        typingListener = new ValueEventListener() {
            @Override
            public void onDataChange(@NonNull DataSnapshot snapshot) {
                boolean someoneTyping = false;
                String typingName = "";
                if (snapshot.exists()) {
                    for (DataSnapshot child : snapshot.getChildren()) {
                        if (!currentUserId.equals(child.getKey())) {
                            Boolean isTyping = child.child("isTyping").getValue(Boolean.class);
                            if (Boolean.TRUE.equals(isTyping)) {
                                someoneTyping = true;
                                typingName = child.child("userName").getValue(String.class);
                                break;
                            }
                        }
                    }
                }
                if (someoneTyping) {
                    tvTypingIndicator.setText((typingName != null ? typingName : "Partner") + " is typing...");
                    tvTypingIndicator.setVisibility(View.VISIBLE);
                } else {
                    tvTypingIndicator.setVisibility(View.GONE);
                }
            }

            @Override
            public void onCancelled(@NonNull DatabaseError error) {}
        };
        typingRef.addValueEventListener(typingListener);
    }

    private void sendMessage(String text, String type) {
        if (TextUtils.isEmpty(text) || chatId == null) return;

        etInput.setText("");
        ChatService.getInstance().setTypingStatus(chatId, currentUserId, currentUserName, false);

        ChatService.getInstance().sendMessage(
                chatId,
                orderId,
                currentUserId,
                "customer",
                currentUserName,
                text,
                type,
                null,
                null,
                new ChatService.MessageCallback() {
                    @Override
                    public void onSuccess(ChatMessage message) {}

                    @Override
                    public void onError(String error) {
                        Toast.makeText(ChatActivity.this, "Failed to send message: " + error, Toast.LENGTH_SHORT).show();
                    }
                }
        );
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (chatId != null && currentUserId != null) {
            ChatService.getInstance().setTypingStatus(chatId, currentUserId, currentUserName, false);
            ChatService.getInstance().setPresence(currentUserId, false, currentUserName, "customer");
        }
        if (messagesRef != null && messagesListener != null) {
            messagesRef.removeEventListener(messagesListener);
        }
        if (typingRef != null && typingListener != null) {
            typingRef.removeEventListener(typingListener);
        }
    }
}
