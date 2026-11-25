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
        java.util.Date displayDate = order.getDeliveredAt() != null ? order.getDeliveredAt()
                : (order.getAcceptedAt() != null ? order.getAcceptedAt() : order.getCreatedAt());
        holder.tvDate.setText(LocationUtils.formatDateTime(displayDate));
        holder.tvRestaurant.setText(order.getRestaurantName());

        if (holder.tvCustomerName != null) {
            String cName = order.getCustomerName();
            holder.tvCustomerName.setText(cName != null && !cName.isEmpty() ? cName : "Customer");
        }

        boolean isDelivered = Constants.STATUS_DELIVERED.equalsIgnoreCase(order.getStatus());
        holder.tvAddress.setText((isDelivered ? "Delivered to: " : "Drop: ") + order.getFullDeliveryAddress());
        holder.tvEarning.setText("+" + LocationUtils.formatCurrency(order.getEstimatedEarning()));

        if (holder.tvItems != null) {
            holder.tvItems.setText(order.getItemsSummary());
        }

        if (holder.tvTimestamps != null) {
            StringBuilder ts = new StringBuilder();
            if (order.getPickedUpAt() != null) {
                ts.append("🛵 Picked: ").append(LocationUtils.formatTime(order.getPickedUpAt()));
            }
            if (order.getDeliveredAt() != null) {
                if (ts.length() > 0) ts.append(" • ");
                ts.append("Delivered: ").append(LocationUtils.formatTime(order.getDeliveredAt()));
            }
            if (ts.length() > 0) {
                holder.tvTimestamps.setVisibility(View.VISIBLE);
                holder.tvTimestamps.setText(ts.toString());
            } else {
                holder.tvTimestamps.setVisibility(View.GONE);
            }
        }

        String status = order.getStatus();
        if (Constants.STATUS_DELIVERED.equalsIgnoreCase(status)) {
            holder.tvStatus.setText("✅ Delivered");
            holder.tvStatus.setTextColor(ContextCompat.getColor(holder.itemView.getContext(), R.color.veg_green));
            holder.tvStatus.setBackgroundResource(R.drawable.bg_pill_emerald_soft);
        } else if (Constants.STATUS_CANCELLED.equalsIgnoreCase(status) || "returned".equalsIgnoreCase(status)) {
            holder.tvStatus.setText("❌ " + (status != null ? status.substring(0, 1).toUpperCase() + status.substring(1) : "Cancelled"));
            holder.tvStatus.setTextColor(ContextCompat.getColor(holder.itemView.getContext(), R.color.error));
            holder.tvStatus.setBackgroundResource(R.drawable.bg_pill_error_soft);
        } else if (Constants.STATUS_OUT_FOR_DELIVERY.equalsIgnoreCase(status)) {
            holder.tvStatus.setText("⚡ On the Way");
            holder.tvStatus.setTextColor(ContextCompat.getColor(holder.itemView.getContext(), R.color.warning));
            holder.tvStatus.setBackgroundResource(R.drawable.bg_pill_amber_soft);
        } else if (Constants.STATUS_READY.equalsIgnoreCase(status)
                || Constants.STATUS_PREPARING.equalsIgnoreCase(status)
                || Constants.STATUS_CONFIRMED.equalsIgnoreCase(status)) {
            holder.tvStatus.setText("📦 Accepted (" + (status != null ? status : "") + ")");
            holder.tvStatus.setTextColor(ContextCompat.getColor(holder.itemView.getContext(), R.color.primary));
            holder.tvStatus.setBackgroundResource(R.drawable.bg_pill_primary);
        } else {
            holder.tvStatus.setText(status != null ? status : "Order");
            holder.tvStatus.setTextColor(ContextCompat.getColor(holder.itemView.getContext(), R.color.text_secondary));
            holder.tvStatus.setBackgroundResource(R.drawable.bg_pill_soft);
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
        TextView tvOrderId, tvDate, tvRestaurant, tvCustomerName, tvAddress, tvItems, tvTimestamps, tvEarning, tvStatus, tvPayment;

        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            tvOrderId = itemView.findViewById(R.id.tv_history_order_id);
            tvDate = itemView.findViewById(R.id.tv_history_date);
            tvRestaurant = itemView.findViewById(R.id.tv_history_restaurant);
            tvCustomerName = itemView.findViewById(R.id.tv_history_customer_name);
            tvAddress = itemView.findViewById(R.id.tv_history_customer_address);
            tvItems = itemView.findViewById(R.id.tv_history_items);
            tvTimestamps = itemView.findViewById(R.id.tv_history_timestamps);
            tvEarning = itemView.findViewById(R.id.tv_history_earning);
            tvStatus = itemView.findViewById(R.id.tv_history_status);
            tvPayment = itemView.findViewById(R.id.tv_history_payment);
        }
    }
}
