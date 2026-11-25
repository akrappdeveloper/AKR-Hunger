package com.ssr.hunger.delivery.adapters;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.ssr.hunger.delivery.R;
import com.ssr.hunger.delivery.models.DeliveryOrder;
import com.ssr.hunger.delivery.utils.LocationUtils;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

public class EarningHistoryAdapter extends RecyclerView.Adapter<EarningHistoryAdapter.ViewHolder> {

    public interface OnEarningClickListener {
        void onEarningClick(DeliveryOrder order);
    }

    private List<DeliveryOrder> orders = new ArrayList<>();
    private final OnEarningClickListener listener;

    public EarningHistoryAdapter(OnEarningClickListener listener) {
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
                .inflate(R.layout.item_earning_history, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        DeliveryOrder order = orders.get(position);

        holder.tvOrderId.setText(order.getFormattedOrderId());

        Date date = order.getDeliveredAt() != null ? order.getDeliveredAt()
                : (order.getAcceptedAt() != null ? order.getAcceptedAt() : order.getCreatedAt());
        holder.tvDate.setText(LocationUtils.formatDateTime(date));

        double earning = order.getEstimatedEarning();
        holder.tvAmount.setText("+" + LocationUtils.formatCurrency(earning));

        double tip = order.getTipAmount();
        if (tip > 0) {
            holder.tvTipBadge.setVisibility(View.VISIBLE);
            holder.tvTipBadge.setText("incl. " + LocationUtils.formatCurrency(tip) + " tip");
        } else {
            holder.tvTipBadge.setVisibility(View.GONE);
        }

        holder.tvRestaurant.setText(order.getRestaurantName());
        holder.tvItems.setText(order.getItemsSummary());

        holder.tvStatusBadge.setText("CREDITED TO WALLET");

        boolean isCod = "cod".equalsIgnoreCase(order.getPaymentMethod());
        holder.tvPaymentType.setText(isCod ? "COD Handover" : "Paid Online");

        holder.itemView.setOnClickListener(v -> {
            if (listener != null) {
                listener.onEarningClick(order);
            }
        });
    }

    @Override
    public int getItemCount() {
        return orders.size();
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        TextView tvOrderId, tvDate, tvAmount, tvTipBadge, tvRestaurant, tvItems, tvStatusBadge, tvPaymentType;

        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            tvOrderId = itemView.findViewById(R.id.tv_earning_order_id);
            tvDate = itemView.findViewById(R.id.tv_earning_date);
            tvAmount = itemView.findViewById(R.id.tv_earning_amount);
            tvTipBadge = itemView.findViewById(R.id.tv_earning_tip_badge);
            tvRestaurant = itemView.findViewById(R.id.tv_earning_restaurant);
            tvItems = itemView.findViewById(R.id.tv_earning_items);
            tvStatusBadge = itemView.findViewById(R.id.tv_earning_status_badge);
            tvPaymentType = itemView.findViewById(R.id.tv_earning_payment_type);
        }
    }
}
