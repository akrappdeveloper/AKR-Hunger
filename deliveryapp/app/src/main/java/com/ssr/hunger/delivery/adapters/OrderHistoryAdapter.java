package com.ssr.hunger.delivery.adapters;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.RecyclerView;

import com.ssr.hunger.delivery.R;
import com.ssr.hunger.delivery.models.DeliveryOrder;
import com.ssr.hunger.delivery.utils.Constants;
import com.ssr.hunger.delivery.utils.LocationUtils;

import java.util.ArrayList;
import java.util.List;

public class OrderHistoryAdapter extends RecyclerView.Adapter<OrderHistoryAdapter.ViewHolder> {

    public interface OnOrderClickListener {
        void onOrderClick(DeliveryOrder order);
    }

    private List<DeliveryOrder> orders = new ArrayList<>();
    private final OnOrderClickListener listener;

    public OrderHistoryAdapter() {
        this.listener = null;
    }

    public OrderHistoryAdapter(OnOrderClickListener listener) {
        this.listener = listener;
    }

    public void setOrders(List<DeliveryOrder> newOrders) {
        this.orders = newOrders != null ? newOrders : new ArrayList<>();
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_order_history, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        DeliveryOrder order = orders.get(position);

        holder.tvOrderId.setText(order.getFormattedOrderId());
        holder.tvDate.setText(LocationUtils.formatDateTime(order.getDeliveredAt() != null ? order.getDeliveredAt() : order.getCreatedAt()));
        holder.tvRestaurant.setText(order.getRestaurantName());
        holder.tvAddress.setText("Delivered to: " + order.getFullDeliveryAddress());
        holder.tvEarning.setText("+" + LocationUtils.formatCurrency(order.getEstimatedEarning()));

        if (Constants.STATUS_DELIVERED.equalsIgnoreCase(order.getStatus())) {
            holder.tvStatus.setText("Delivered");
            holder.tvStatus.setTextColor(ContextCompat.getColor(holder.itemView.getContext(), R.color.veg_green));
            holder.tvStatus.setBackgroundResource(R.drawable.bg_pill_emerald_soft);
        } else if (Constants.STATUS_CANCELLED.equalsIgnoreCase(order.getStatus())) {
            holder.tvStatus.setText("Cancelled");
            holder.tvStatus.setTextColor(ContextCompat.getColor(holder.itemView.getContext(), R.color.error));
            holder.tvStatus.setBackgroundResource(R.drawable.bg_pill_error_soft);
        } else {
            holder.tvStatus.setText(order.getStatus());
        }

        String paymentInfo = "cod".equalsIgnoreCase(order.getPaymentMethod()) ? "Cash Collected" : "Online";
        holder.tvPayment.setText(paymentInfo);

        holder.itemView.setOnClickListener(v -> {
            if (listener != null) {
                listener.onOrderClick(order);
            }
        });
    }

    @Override
    public int getItemCount() {
        return orders.size();
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        TextView tvOrderId, tvDate, tvRestaurant, tvAddress, tvEarning, tvStatus, tvPayment;

        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            tvOrderId = itemView.findViewById(R.id.tv_history_order_id);
            tvDate = itemView.findViewById(R.id.tv_history_date);
            tvRestaurant = itemView.findViewById(R.id.tv_history_restaurant);
            tvAddress = itemView.findViewById(R.id.tv_history_customer_address);
            tvEarning = itemView.findViewById(R.id.tv_history_earning);
            tvStatus = itemView.findViewById(R.id.tv_history_status);
            tvPayment = itemView.findViewById(R.id.tv_history_payment);
        }
    }
}
