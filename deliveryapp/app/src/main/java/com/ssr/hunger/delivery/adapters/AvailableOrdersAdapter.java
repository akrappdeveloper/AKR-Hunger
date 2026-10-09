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

        holder.tvOrderId.setText(order.getFormattedOrderId());
        holder.tvEarnings.setText(LocationUtils.formatCurrency(order.getEstimatedEarning()) + " Earn");
        holder.tvRestaurantName.setText(order.getRestaurantName());
        holder.tvRestaurantAddress.setText(order.getRestaurantAddress());
        holder.tvCustomerName.setText("Drop: " + order.getCustomerName());
        holder.tvDeliveryAddress.setText(order.getFullDeliveryAddress());

        // Calculate distance if coordinates available
        double distanceKm = LocationUtils.calculateDistanceKm(
                order.getRestaurantLatitude(), order.getRestaurantLongitude(),
                order.getDeliveryLatitude(), order.getDeliveryLongitude()
        );
        holder.tvDistance.setText("📍 " + LocationUtils.formatDistance(distanceKm) + " trip");

        int itemCount = order.getItems() != null ? order.getItems().size() : 0;
        holder.tvItemsCount.setText(itemCount + " item" + (itemCount == 1 ? "" : "s"));

        String paymentMode = "cod".equalsIgnoreCase(order.getPaymentMethod()) ? "Cash On Delivery (COD)" : "Paid Online";
        holder.tvPaymentMode.setText(paymentMode);

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
        TextView tvOrderId, tvEarnings, tvRestaurantName, tvRestaurantAddress;
        TextView tvCustomerName, tvDeliveryAddress, tvDistance, tvItemsCount, tvPaymentMode;
        MaterialButton btnDecline, btnAccept;

        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            tvOrderId = itemView.findViewById(R.id.tv_order_id);
            tvEarnings = itemView.findViewById(R.id.tv_earnings_estimate);
            tvRestaurantName = itemView.findViewById(R.id.tv_restaurant_name);
            tvRestaurantAddress = itemView.findViewById(R.id.tv_restaurant_address);
            tvCustomerName = itemView.findViewById(R.id.tv_customer_name);
            tvDeliveryAddress = itemView.findViewById(R.id.tv_delivery_address);
            tvDistance = itemView.findViewById(R.id.tv_distance);
            tvItemsCount = itemView.findViewById(R.id.tv_items_count);
            tvPaymentMode = itemView.findViewById(R.id.tv_payment_mode);
            btnDecline = itemView.findViewById(R.id.btn_decline);
            btnAccept = itemView.findViewById(R.id.btn_accept);
        }
    }
}
