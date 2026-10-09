package com.ssr.hunger.delivery.adapters;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageButton;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.button.MaterialButton;
import com.ssr.hunger.delivery.R;
import com.ssr.hunger.delivery.activities.LiveTrackingRadarActivity;
import com.ssr.hunger.delivery.activities.OrderActiveDetailActivity;
import com.ssr.hunger.delivery.models.DeliveryOrder;
import com.ssr.hunger.delivery.utils.Constants;
import com.ssr.hunger.delivery.utils.LocationUtils;

import java.util.ArrayList;
import java.util.List;

public class ActiveOrdersAdapter extends RecyclerView.Adapter<ActiveOrdersAdapter.ViewHolder> {

    public interface OnActiveOrderClickListener {
        void onManageOrder(DeliveryOrder order);
    }

    private List<DeliveryOrder> orders = new ArrayList<>();
    private final OnActiveOrderClickListener listener;

    public ActiveOrdersAdapter(OnActiveOrderClickListener listener) {
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
                .inflate(R.layout.item_active_order, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        Context context = holder.itemView.getContext();
        DeliveryOrder order = orders.get(position);

        holder.tvOrderId.setText(order.getFormattedOrderId());
        holder.tvRestaurantName.setText(order.getRestaurantName());
        holder.tvRestaurantAddress.setText(order.getRestaurantAddress());
        holder.tvCustomerName.setText(order.getCustomerName());
        holder.tvDeliveryAddress.setText(order.getFullDeliveryAddress());
        holder.tvEarnings.setText("Earning: " + LocationUtils.formatCurrency(order.getEstimatedEarning()));

        String paymentMode = "cod".equalsIgnoreCase(order.getPaymentMethod())
                ? "Collect Cash: " + LocationUtils.formatCurrency(order.getTotal())
                : "Paid Online";
        holder.tvPaymentBadge.setText(paymentMode);

        // Stage formatting
        String stageText = "Pickup Food";
        if (Constants.STAGE_TO_RESTAURANT.equalsIgnoreCase(order.getDeliveryStage())) {
            stageText = "On Way to Restaurant";
        } else if (Constants.STAGE_AT_RESTAURANT.equalsIgnoreCase(order.getDeliveryStage())) {
            stageText = "At Restaurant";
        } else if (Constants.STAGE_PICKED_UP.equalsIgnoreCase(order.getDeliveryStage())
                || Constants.STAGE_TO_CUSTOMER.equalsIgnoreCase(order.getDeliveryStage())) {
            stageText = "On Way to Customer";
        } else if (Constants.STAGE_ARRIVED.equalsIgnoreCase(order.getDeliveryStage())) {
            stageText = "Arrived at Drop";
        }
        holder.tvStageBadge.setText(stageText);

        // Phone call restaurant
        holder.btnCallRestaurant.setOnClickListener(v -> {
            String phone = order.getRestaurantPhone();
            if (phone != null && !phone.isEmpty()) {
                Intent callIntent = new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + phone));
                context.startActivity(callIntent);
            } else {
                Toast.makeText(context, "Restaurant phone not available", Toast.LENGTH_SHORT).show();
            }
        });

        // Phone call customer
        holder.btnCallCustomer.setOnClickListener(v -> {
            String phone = order.getCustomerPhone();
            if (phone != null && !phone.isEmpty()) {
                Intent callIntent = new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + phone));
                context.startActivity(callIntent);
            } else {
                Toast.makeText(context, "Customer phone not available", Toast.LENGTH_SHORT).show();
            }
        });

        // Open in-app Live Tracking Radar with real-time moving bike map
        holder.btnNavigateMap.setOnClickListener(v -> {
            boolean isHeadingToCustomer = Constants.STAGE_PICKED_UP.equalsIgnoreCase(order.getDeliveryStage())
                    || Constants.STAGE_TO_CUSTOMER.equalsIgnoreCase(order.getDeliveryStage())
                    || Constants.STAGE_ARRIVED.equalsIgnoreCase(order.getDeliveryStage());

            double destLat = isHeadingToCustomer ? order.getDeliveryLatitude() : order.getRestaurantLatitude();
            double destLng = isHeadingToCustomer ? order.getDeliveryLongitude() : order.getRestaurantLongitude();
            String destAddr = isHeadingToCustomer ? order.getFullDeliveryAddress() : order.getRestaurantAddress();
            String destName = isHeadingToCustomer ? order.getCustomerName() : order.getRestaurantName();

            Intent radarIntent = new Intent(context, LiveTrackingRadarActivity.class);
            radarIntent.putExtra(Constants.EXTRA_ORDER_ID, order.getId());
            radarIntent.putExtra(Constants.EXTRA_DEST_LAT, destLat);
            radarIntent.putExtra(Constants.EXTRA_DEST_LNG, destLng);
            radarIntent.putExtra(Constants.EXTRA_DEST_NAME, destName);
            radarIntent.putExtra(Constants.EXTRA_DEST_ADDRESS, destAddr);
            context.startActivity(radarIntent);
        });

        // Manage / Open Order Workflow
        holder.btnManageOrder.setOnClickListener(v -> {
            if (listener != null) {
                listener.onManageOrder(order);
            } else {
                Intent intent = new Intent(context, OrderActiveDetailActivity.class);
                intent.putExtra(Constants.EXTRA_ORDER_ID, order.getId());
                context.startActivity(intent);
            }
        });
    }

    @Override
    public int getItemCount() {
        return orders.size();
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        TextView tvOrderId, tvStageBadge, tvRestaurantName, tvRestaurantAddress;
        TextView tvCustomerName, tvDeliveryAddress, tvEarnings, tvPaymentBadge;
        ImageButton btnCallRestaurant, btnCallCustomer;
        MaterialButton btnNavigateMap, btnManageOrder;

        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            tvOrderId = itemView.findViewById(R.id.tv_active_order_id);
            tvStageBadge = itemView.findViewById(R.id.tv_active_stage_badge);
            tvRestaurantName = itemView.findViewById(R.id.tv_active_restaurant_name);
            tvRestaurantAddress = itemView.findViewById(R.id.tv_active_restaurant_address);
            tvCustomerName = itemView.findViewById(R.id.tv_active_customer_name);
            tvDeliveryAddress = itemView.findViewById(R.id.tv_active_delivery_address);
            tvEarnings = itemView.findViewById(R.id.tv_active_earnings);
            tvPaymentBadge = itemView.findViewById(R.id.tv_active_payment_badge);
            btnCallRestaurant = itemView.findViewById(R.id.btn_call_restaurant);
            btnCallCustomer = itemView.findViewById(R.id.btn_call_customer);
            btnNavigateMap = itemView.findViewById(R.id.btn_navigate_map);
            btnManageOrder = itemView.findViewById(R.id.btn_manage_order);
        }
    }
}
