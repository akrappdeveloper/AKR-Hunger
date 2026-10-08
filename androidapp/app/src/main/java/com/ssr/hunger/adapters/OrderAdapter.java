package com.ssr.hunger.adapters;

import android.graphics.drawable.GradientDrawable;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.RecyclerView;
import com.ssr.hunger.R;
import com.ssr.hunger.models.Order;
import com.ssr.hunger.models.OrderItem;
import com.bumptech.glide.Glide;
import java.text.SimpleDateFormat;
import java.util.List;
import java.util.Locale;

public class OrderAdapter extends RecyclerView.Adapter<OrderAdapter.ViewHolder> {

    public interface OnOrderClickListener {
        void onOrderClick(Order order);
    }

    public interface OnReorderListener {
        void onReorder(Order order);
    }

    private List<Order> orders;
    private final OnOrderClickListener clickListener;
    private final OnReorderListener reorderListener;

    public OrderAdapter(List<Order> orders, OnOrderClickListener clickListener, OnReorderListener reorderListener) {
        this.orders = orders;
        this.clickListener = clickListener;
        this.reorderListener = reorderListener;
    }

    public void updateData(List<Order> newOrders) {
        this.orders = newOrders;
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_order, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        Order order = orders.get(position);

        holder.tvRestaurant.setText(order.getRestaurantName() != null ? order.getRestaurantName() : "Restaurant");
        holder.tvTotal.setText(String.format(Locale.getDefault(), "₹%.0f", order.getTotal()));
        holder.tvStatus.setText(order.getStatusDisplay());

        // Date
        if (order.getCreatedAt() != null) {
            SimpleDateFormat sdf = new SimpleDateFormat("dd MMM, hh:mm a", Locale.getDefault());
            holder.tvDate.setText(sdf.format(order.getCreatedAt()));
        }

        // Items summary
        if (order.getItems() != null && !order.getItems().isEmpty()) {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < Math.min(3, order.getItems().size()); i++) {
                OrderItem item = order.getItems().get(i);
                if (i > 0) sb.append(", ");
                sb.append(item.getQuantity()).append("x ").append(item.getName());
            }
            if (order.getItems().size() > 3) {
                sb.append(" +").append(order.getItems().size() - 3).append(" more");
            }
            holder.tvItems.setText(sb.toString());

            // Load first item image
            Glide.with(holder.itemView.getContext())
                    .load(order.getItems().get(0).getImage())
                    .placeholder(R.drawable.bg_card_rounded)
                    .into(holder.ivImage);
        }

        // Status color
        int statusColor = getStatusColor(order.getStatus(), holder);
        GradientDrawable statusBg = new GradientDrawable();
        statusBg.setCornerRadius(24);
        statusBg.setColor(statusColor & 0x26FFFFFF); // 15% opacity
        statusBg.setStroke(2, statusColor & 0x33FFFFFF);
        holder.tvStatus.setBackground(statusBg);
        holder.tvStatus.setTextColor(statusColor);

        // Reorder button visibility (respects user settings preference)
        boolean showReorder = com.ssr.hunger.utils.SettingsHelper.isQuickReorderEnabled(holder.itemView.getContext())
                && ("delivered".equals(order.getStatus()) || "cancelled".equals(order.getStatus()));
        holder.btnReorder.setVisibility(showReorder ? View.VISIBLE : View.GONE);

        // Click listeners
        holder.itemView.setOnClickListener(v -> clickListener.onOrderClick(order));
        holder.btnReorder.setOnClickListener(v -> reorderListener.onReorder(order));
    }

    private int getStatusColor(String status, ViewHolder holder) {
        if (status == null) return ContextCompat.getColor(holder.itemView.getContext(), R.color.text_hint);
        switch (status) {
            case "delivered": return ContextCompat.getColor(holder.itemView.getContext(), R.color.success);
            case "out_for_delivery": return ContextCompat.getColor(holder.itemView.getContext(), R.color.info);
            case "preparing": return ContextCompat.getColor(holder.itemView.getContext(), R.color.warning);
            case "confirmed": return ContextCompat.getColor(holder.itemView.getContext(), R.color.cat_drinks);
            case "cancelled": return ContextCompat.getColor(holder.itemView.getContext(), R.color.error);
            default: return ContextCompat.getColor(holder.itemView.getContext(), R.color.text_hint);
        }
    }

    @Override
    public int getItemCount() {
        return orders.size();
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        ImageView ivImage;
        TextView tvRestaurant, tvItems, tvTotal, tvStatus, tvDate;
        View btnReorder;

        ViewHolder(@NonNull View itemView) {
            super(itemView);
            ivImage = itemView.findViewById(R.id.iv_order_image);
            tvRestaurant = itemView.findViewById(R.id.tv_order_restaurant);
            tvItems = itemView.findViewById(R.id.tv_order_items);
            tvTotal = itemView.findViewById(R.id.tv_order_total);
            tvStatus = itemView.findViewById(R.id.tv_order_status);
            tvDate = itemView.findViewById(R.id.tv_order_date);
            btnReorder = itemView.findViewById(R.id.btn_reorder);
        }
    }
}
