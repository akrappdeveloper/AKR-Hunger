package com.ssr.hunger.delivery.adapters;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.button.MaterialButton;
import com.ssr.hunger.delivery.R;
import com.ssr.hunger.delivery.models.DeliveryOrder;
import com.ssr.hunger.delivery.utils.LocationUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

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
        Context context = holder.itemView.getContext();
        DeliveryOrder order = orders.get(position);

        // Order ID
        holder.tvOrderId.setText(order.getFormattedOrderId());

        // Earning Badge
        if (holder.tvEarningAmount != null) {
            holder.tvEarningAmount.setText(LocationUtils.formatCurrency(order.getEstimatedEarning()));
        }

        // Restaurant & Customer Names
        holder.tvRestaurantName.setText(order.getRestaurantName());
        holder.tvCustomerName.setText(order.getCustomerName());

        // Restaurant Address
        if (holder.tvRestaurantAddress != null) {
            String restAddr = order.getRestaurantAddress();
            if (restAddr == null || restAddr.isEmpty()) restAddr = order.getRestaurantName();
            holder.tvRestaurantAddress.setText(restAddr);
        }

        // Delivery Address
        if (holder.tvDeliveryAddress != null) {
            String delivAddr = order.getFullDeliveryAddress();
            if (delivAddr == null || delivAddr.isEmpty()) {
                delivAddr = order.getDeliveryLocality() != null && !order.getDeliveryLocality().isEmpty()
                        ? order.getDeliveryLocality()
                        : order.getDeliveryAddressPincode();
            }
            holder.tvDeliveryAddress.setText(delivAddr);
        }

        // Distance
        if (holder.tvDistance != null) {
            if (order.getRestaurantLatitude() != 0 && order.getDeliveryLatitude() != 0) {
                double distKm = LocationUtils.calculateDistanceKm(
                        order.getRestaurantLatitude(), order.getRestaurantLongitude(),
                        order.getDeliveryLatitude(), order.getDeliveryLongitude()
                );
                holder.tvDistance.setText(distKm > 0 ? LocationUtils.formatDistance(distKm) : "N/A");
            } else {
                holder.tvDistance.setText("N/A");
            }
        }

        // Payment Method
        if (holder.tvPaymentMethod != null) {
            boolean isCod = "cod".equalsIgnoreCase(order.getPaymentMethod());
            holder.tvPaymentMethod.setText(isCod ? "COD" : "Online");
            holder.tvPaymentMethod.setTextColor(context.getResources().getColor(
                    isCod ? android.R.color.holo_orange_dark : android.R.color.holo_green_dark));
        }

        // Order Total
        if (holder.tvOrderTotal != null) {
            holder.tvOrderTotal.setText(LocationUtils.formatCurrency(order.getTotal() > 0 ? order.getTotal() : order.getSubtotal()));
        }

        // --- Accept Button ---
        holder.btnAccept.setOnClickListener(v -> {
            if (listener != null) listener.onAccept(order);
        });

        // --- Decline Button ---
        holder.btnDecline.setOnClickListener(v -> {
            if (listener != null) listener.onDecline(order);
        });

        // --- Map Button: Open Restaurant in Google Maps ---
        if (holder.btnMapRestaurant != null) {
            holder.btnMapRestaurant.setOnClickListener(v -> {
                openRestaurantInGoogleMaps(context, order);
            });
        }

        // --- Call Restaurant Button ---
        if (holder.btnCallRestaurant != null) {
            holder.btnCallRestaurant.setOnClickListener(v -> {
                callRestaurant(context, order);
            });
        }
    }

    /**
     * Opens restaurant location in Google Maps.
     * Falls back to web URL if Google Maps app is not installed.
     */
    private void openRestaurantInGoogleMaps(Context context, DeliveryOrder order) {
        try {
            Uri gmmIntentUri;
            if (order.getRestaurantLatitude() != 0.0 && order.getRestaurantLongitude() != 0.0) {
                // Open maps with coordinates + restaurant name label
                String label = Uri.encode(order.getRestaurantName() != null ? order.getRestaurantName() : "Restaurant");
                gmmIntentUri = Uri.parse(String.format(Locale.US,
                        "geo:%.6f,%.6f?q=%.6f,%.6f(%s)",
                        order.getRestaurantLatitude(), order.getRestaurantLongitude(),
                        order.getRestaurantLatitude(), order.getRestaurantLongitude(),
                        label));
            } else {
                // Fallback: search by restaurant name/address
                String query = Uri.encode(order.getRestaurantAddress() != null && !order.getRestaurantAddress().isEmpty()
                        ? order.getRestaurantAddress() : order.getRestaurantName());
                gmmIntentUri = Uri.parse("geo:0,0?q=" + query);
            }

            Intent mapIntent = new Intent(Intent.ACTION_VIEW, gmmIntentUri);
            mapIntent.setPackage("com.google.android.apps.maps");
            if (mapIntent.resolveActivity(context.getPackageManager()) != null) {
                context.startActivity(mapIntent);
            } else {
                // Fallback to browser
                String webQuery = order.getRestaurantLatitude() != 0.0
                        ? String.format(Locale.US, "https://www.google.com/maps/search/?api=1&query=%.6f,%.6f",
                            order.getRestaurantLatitude(), order.getRestaurantLongitude())
                        : "https://www.google.com/maps/search/?api=1&query=" + Uri.encode(order.getRestaurantName());
                context.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(webQuery)));
            }
        } catch (Exception e) {
            Toast.makeText(context, "Unable to open Maps: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    /**
     * Initiates a phone call to the restaurant.
     */
    private void callRestaurant(Context context, DeliveryOrder order) {
        String phone = order.getRestaurantPhone();
        if (phone != null && !phone.trim().isEmpty()) {
            try {
                Intent callIntent = new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + phone.trim()));
                context.startActivity(callIntent);
            } catch (Exception e) {
                Toast.makeText(context, "Unable to make call: " + e.getMessage(), Toast.LENGTH_SHORT).show();
            }
        } else {
            Toast.makeText(context, "Restaurant phone not available", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    public int getItemCount() {
        return orders.size();
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        TextView tvOrderId, tvRestaurantName, tvCustomerName;
        TextView tvEarningAmount, tvRestaurantAddress, tvDeliveryAddress;
        TextView tvDistance, tvPaymentMethod, tvOrderTotal;
        MaterialButton btnDecline, btnAccept, btnMapRestaurant, btnCallRestaurant;

        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            tvOrderId = itemView.findViewById(R.id.tv_order_id);
            tvRestaurantName = itemView.findViewById(R.id.tv_restaurant_name);
            tvCustomerName = itemView.findViewById(R.id.tv_customer_name);
            tvEarningAmount = itemView.findViewById(R.id.tv_earning_amount);
            tvRestaurantAddress = itemView.findViewById(R.id.tv_restaurant_address);
            tvDeliveryAddress = itemView.findViewById(R.id.tv_delivery_address);
            tvDistance = itemView.findViewById(R.id.tv_distance);
            tvPaymentMethod = itemView.findViewById(R.id.tv_payment_method);
            tvOrderTotal = itemView.findViewById(R.id.tv_order_total);
            btnDecline = itemView.findViewById(R.id.btn_decline);
            btnAccept = itemView.findViewById(R.id.btn_accept);
            btnMapRestaurant = itemView.findViewById(R.id.btn_map_restaurant);
            btnCallRestaurant = itemView.findViewById(R.id.btn_call_restaurant);
        }
    }
}
