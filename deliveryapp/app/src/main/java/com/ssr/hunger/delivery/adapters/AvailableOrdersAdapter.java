package com.ssr.hunger.delivery.adapters;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.button.MaterialButton;
import com.ssr.hunger.delivery.R;
import com.ssr.hunger.delivery.models.DeliveryOrder;
import com.ssr.hunger.delivery.utils.LocationUtils;

import java.util.ArrayList;
import java.util.List;

public class AvailableOrdersAdapter extends RecyclerView.Adapter<AvailableOrdersAdapter.ViewHolder> {

    public interface OnOrderActionListener {
        void onAccept(DeliveryOrder order);
        void onDecline(DeliveryOrder order);
    }

    private List<DeliveryOrder> orders = new ArrayList<>();
    private final OnOrderActionListener listener;

    public AvailableOrdersAdapter(OnOrderActionListener listener) {
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
                .inflate(R.layout.item_available_order, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        DeliveryOrder order = orders.get(position);
        String metaText = order.getFormattedOrderId();
        if (order.getDeliveryLocality() != null && !order.getDeliveryLocality().isEmpty()) {
            metaText += " • 📍 " + order.getDeliveryLocality();
        } else if (order.getDeliveryAddressPincode() != null && !order.getDeliveryAddressPincode().isEmpty()) {
            metaText += " • PIN " + order.getDeliveryAddressPincode();
        }
        if (order.getRestaurantLatitude() != 0 && order.getDeliveryLatitude() != 0) {
            double distKm = LocationUtils.calculateDistanceKm(
                    order.getRestaurantLatitude(), order.getRestaurantLongitude(),
                    order.getDeliveryLatitude(), order.getDeliveryLongitude()
            );
            if (distKm > 0) {
                metaText += " • " + LocationUtils.formatDistance(distKm);
            }
        }
        holder.tvOrderId.setText(metaText);
        holder.tvEarnings.setText(LocationUtils.formatCurrency(order.getEstimatedEarning()));
        holder.tvRestaurantName.setText(order.getRestaurantName());
        holder.tvCustomerName.setText(order.getCustomerName());

        holder.btnAccept.setOnClickListener(v -> {
            if (listener != null) listener.onAccept(order);
        });

        holder.btnDecline.setOnClickListener(v -> {
            if (listener != null) listener.onDecline(order);
        });
    }

    @Override
    public int getItemCount() {
        return orders.size();
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        TextView tvOrderId, tvEarnings, tvRestaurantName;
        TextView tvCustomerName;
        MaterialButton btnDecline, btnAccept;

        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            tvOrderId = itemView.findViewById(R.id.tv_order_id);
            tvEarnings = itemView.findViewById(R.id.tv_earnings_estimate);
            tvRestaurantName = itemView.findViewById(R.id.tv_restaurant_name);
            tvCustomerName = itemView.findViewById(R.id.tv_customer_name);
            btnDecline = itemView.findViewById(R.id.btn_decline);
            btnAccept = itemView.findViewById(R.id.btn_accept);
        }
    }
}
