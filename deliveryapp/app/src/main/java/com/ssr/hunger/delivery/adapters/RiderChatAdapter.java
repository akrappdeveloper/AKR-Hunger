package com.ssr.hunger.delivery.adapters;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.ssr.hunger.delivery.R;
import com.ssr.hunger.delivery.models.ChatMessage;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class RiderChatAdapter extends RecyclerView.Adapter<RiderChatAdapter.RiderViewHolder> {

    private final Context context;
    private final List<ChatMessage> messageList;
    private final String currentUserId;
    private final SimpleDateFormat timeFormat = new SimpleDateFormat("hh:mm a", Locale.getDefault());

    public RiderChatAdapter(Context context, List<ChatMessage> messageList, String currentUserId) {
        this.context = context;
        this.messageList = messageList;
        this.currentUserId = currentUserId;
    }

    @NonNull
    @Override
    public RiderViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(context).inflate(R.layout.item_rider_chat_message, parent, false);
        return new RiderViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull RiderViewHolder holder, int position) {
        ChatMessage message = messageList.get(position);
        boolean isMe = currentUserId != null && currentUserId.equals(message.getSenderId());
        boolean isSystem = "SYSTEM".equalsIgnoreCase(message.getType()) || "ORDER_UPDATE".equalsIgnoreCase(message.getType());

        String timeStr = timeFormat.format(new Date(message.getCreatedAt()));

        if (isSystem) {
            holder.layoutSystem.setVisibility(View.VISIBLE);
            holder.layoutReceived.setVisibility(View.GONE);
            holder.layoutSent.setVisibility(View.GONE);
            holder.tvSystemText.setText(message.getText());
        } else if (isMe) {
            holder.layoutSystem.setVisibility(View.GONE);
            holder.layoutReceived.setVisibility(View.GONE);
            holder.layoutSent.setVisibility(View.VISIBLE);

            holder.tvSentText.setText(message.getText());
            holder.tvSentTime.setText(timeStr);
            holder.tvSentStatus.setText("✓✓");
        } else {
            holder.layoutSystem.setVisibility(View.GONE);
            holder.layoutReceived.setVisibility(View.VISIBLE);
            holder.layoutSent.setVisibility(View.GONE);

            holder.tvReceivedSender.setText(message.getSenderName() != null ? message.getSenderName() : "Counterpart");
            holder.tvReceivedText.setText(message.getText());
            holder.tvReceivedTime.setText(timeStr);
        }
    }

    @Override
    public int getItemCount() {
        return messageList != null ? messageList.size() : 0;
    }

    static class RiderViewHolder extends RecyclerView.ViewHolder {
        View layoutSystem, layoutReceived, layoutSent;
        TextView tvSystemText, tvReceivedSender, tvReceivedText, tvReceivedTime;
        TextView tvSentText, tvSentTime, tvSentStatus;

        public RiderViewHolder(@NonNull View itemView) {
            super(itemView);
            layoutSystem = itemView.findViewById(R.id.layout_system_message);
            tvSystemText = itemView.findViewById(R.id.tv_system_text);

            layoutReceived = itemView.findViewById(R.id.layout_received);
            tvReceivedSender = itemView.findViewById(R.id.tv_received_sender);
            tvReceivedText = itemView.findViewById(R.id.tv_received_text);
            tvReceivedTime = itemView.findViewById(R.id.tv_received_time);

            layoutSent = itemView.findViewById(R.id.layout_sent);
            tvSentText = itemView.findViewById(R.id.tv_sent_text);
            tvSentTime = itemView.findViewById(R.id.tv_sent_time);
            tvSentStatus = itemView.findViewById(R.id.tv_sent_status);
        }
    }
}
