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
import com.ssr.hunger.delivery.activities.OrderActiveDetailActivity;
import com.ssr.hunger.delivery.models.DeliveryOrder;
import com.ssr.hunger.delivery.utils.Constants;
import com.ssr.hunger.delivery.utils.LocationUtils;

import java.util.ArrayList;
import java.util.List;

public class ActiveOrdersAdapter extends RecyclerView.Adapter<ActiveOrdersAdapter.ViewHolder> {

    public interface OnActiveOrderClickListener {
        void onManageOrder(DeliveryOrder order);
        void onFocusMapRoute(DeliveryOrder order);
        void onCallOrder(DeliveryOrder order);
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
        holder.tvRestaurantAddress.setText(order.getRestaurantName());
        holder.tvDeliveryAddress.setText(order.getCustomerName());
        holder.tvEarnings.setText(LocationUtils.formatCurrency(order.getEstimatedEarning()));

        String paymentMode = "cod".equalsIgnoreCase(order.getPaymentMethod())
                ? "Collect Cash: " + LocationUtils.formatCurrency(order.getTotal())
                : "Paid Online";
        holder.tvPaymentBadge.setText(paymentMode);

        boolean isHeadingToCustomer = Constants.STAGE_PICKED_UP.equalsIgnoreCase(order.getDeliveryStage())
                || Constants.STAGE_TO_CUSTOMER.equalsIgnoreCase(order.getDeliveryStage())
                || Constants.STAGE_ARRIVED.equalsIgnoreCase(order.getDeliveryStage());

        // Stage formatting
        String stageText = "Pickup Food";
        if (Constants.STAGE_TO_RESTAURANT.equalsIgnoreCase(order.getDeliveryStage())) {
            stageText = "On Way to Restaurant";
        } else if (Constants.STAGE_AT_RESTAURANT.equalsIgnoreCase(order.getDeliveryStage())) {
            stageText = "At Restaurant";
        } else if (isHeadingToCustomer) {
            stageText = "On Way to Customer";
        } else if (Constants.STAGE_ARRIVED.equalsIgnoreCase(order.getDeliveryStage())) {
            stageText = "Arrived at Drop";
        }
        holder.tvStageBadge.setText(stageText);

        // Update Call button label based on active delivery stage
        if (holder.btnCallOrder != null) {
            holder.btnCallOrder.setText(isHeadingToCustomer ? "📞 Customer" : "📞 Restaurant");
        }

        // 1. Open Google Maps Turn-by-Turn Navigation
        holder.btnOpenGoogleMaps.setOnClickListener(v -> {
            double destLat = isHeadingToCustomer ? order.getDeliveryLatitude() : order.getRestaurantLatitude();
            double destLng = isHeadingToCustomer ? order.getDeliveryLongitude() : order.getRestaurantLongitude();

            try {
                Uri gmmIntentUri = Uri.parse("google.navigation:q=" + destLat + "," + destLng + "&mode=d");
                Intent mapIntent = new Intent(Intent.ACTION_VIEW, gmmIntentUri);
                mapIntent.setPackage("com.google.android.apps.maps");
                if (mapIntent.resolveActivity(context.getPackageManager()) != null) {
                    context.startActivity(mapIntent);
                } else {
                    Uri webUri = Uri.parse("https://www.google.com/maps/dir/?api=1&destination=" + destLat + "," + destLng);
                    context.startActivity(new Intent(Intent.ACTION_VIEW, webUri));
                }
            } catch (Exception e) {
                Uri webUri = Uri.parse("https://www.google.com/maps/dir/?api=1&destination=" + destLat + "," + destLng);
                context.startActivity(new Intent(Intent.ACTION_VIEW, webUri));
            }
        });

        // 2. Focus & Show Complete Route on Dashboard Map
        holder.btnNavigateMap.setOnClickListener(v -> {
            if (listener != null) {
                listener.onFocusMapRoute(order);
            }
        });

        // 3. Quick Call Contact (Restaurant or Customer)
        if (holder.btnCallOrder != null) {
            holder.btnCallOrder.setOnClickListener(v -> {
                if (listener != null) {
                    listener.onCallOrder(order);
                } else {
                    String phone = isHeadingToCustomer ? order.getCustomerPhone() : order.getRestaurantPhone();
                    if (phone != null && !phone.trim().isEmpty()) {
                        Intent callIntent = new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + phone));
                        context.startActivity(callIntent);
                    } else {
                        Toast.makeText(context, "Phone number not available", Toast.LENGTH_SHORT).show();
                    }
                }
            });
        }

        // 4. Manage Order Workflow
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
        TextView tvOrderId, tvStageBadge, tvRestaurantAddress;
        TextView tvDeliveryAddress, tvEarnings, tvPaymentBadge;
        MaterialButton btnOpenGoogleMaps, btnNavigateMap, btnCallOrder, btnManageOrder;

        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            tvOrderId = itemView.findViewById(R.id.tv_active_order_id);
            tvStageBadge = itemView.findViewById(R.id.tv_active_stage_badge);
            tvRestaurantAddress = itemView.findViewById(R.id.tv_active_restaurant_address);
            tvDeliveryAddress = itemView.findViewById(R.id.tv_active_delivery_address);
            tvEarnings = itemView.findViewById(R.id.tv_active_earnings);
            tvPaymentBadge = itemView.findViewById(R.id.tv_active_payment_badge);
            btnOpenGoogleMaps = itemView.findViewById(R.id.btn_open_google_maps);
            btnNavigateMap = itemView.findViewById(R.id.btn_navigate_map);
            btnCallOrder = itemView.findViewById(R.id.btn_call_order);
            btnManageOrder = itemView.findViewById(R.id.btn_manage_order);
        }
    }
}
