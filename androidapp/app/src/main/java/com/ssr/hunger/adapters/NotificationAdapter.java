package com.ssr.hunger.adapters;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;
import com.ssr.hunger.R;
import com.ssr.hunger.models.NotificationItem;
import java.util.List;

/**
 * Adapter for rendering iOS-style modern notification cards.
 */
public class NotificationAdapter extends RecyclerView.Adapter<NotificationAdapter.ViewHolder> {

    public interface OnNotificationClickListener {
        void onNotificationClick(NotificationItem item);
    }

    private final List<NotificationItem> items;
    private final OnNotificationClickListener listener;

    public NotificationAdapter(List<NotificationItem> items, OnNotificationClickListener listener) {
        this.items = items;
        this.listener = listener;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_notification_card, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        NotificationItem item = items.get(position);

        holder.tvIcon.setText(item.getIconEmoji());
        holder.tvTitle.setText(item.getTitle() != null ? item.getTitle() : "Notification");
        holder.tvBody.setText(item.getMessage() != null ? item.getMessage() : "");
        holder.tvTime.setText(item.getRelativeTime());

        // Unread indicator dot
        holder.viewUnreadDot.setVisibility(item.isRead() ? View.GONE : View.VISIBLE);

        // Order tracking action chip
        if (item.getOrderId() != null && !item.getOrderId().trim().isEmpty()) {
            holder.layoutOrderAction.setVisibility(View.VISIBLE);
        } else {
            holder.layoutOrderAction.setVisibility(View.GONE);
        }

        holder.itemView.setOnClickListener(v -> {
            if (listener != null) {
                listener.onNotificationClick(item);
            }
        });
    }

    @Override
    public int getItemCount() {
        return items.size();
    }

    public static class ViewHolder extends RecyclerView.ViewHolder {
        final FrameLayout layoutIconBg;
        final TextView tvIcon;
        final TextView tvTitle;
        final TextView tvBody;
        final TextView tvTime;
        final LinearLayout layoutOrderAction;
        final View viewUnreadDot;

        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            layoutIconBg = itemView.findViewById(R.id.layout_icon_bg);
            tvIcon = itemView.findViewById(R.id.tv_notification_icon);
            tvTitle = itemView.findViewById(R.id.tv_notification_title);
            tvBody = itemView.findViewById(R.id.tv_notification_body);
            tvTime = itemView.findViewById(R.id.tv_notification_time);
            layoutOrderAction = itemView.findViewById(R.id.layout_order_action);
            viewUnreadDot = itemView.findViewById(R.id.view_unread_dot);
        }
    }
}
