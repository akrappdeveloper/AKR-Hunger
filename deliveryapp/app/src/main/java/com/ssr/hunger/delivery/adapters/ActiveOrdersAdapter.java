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
import java.util.Locale;

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

        // ── PICKUP SECTION: show before pickup, hide after ──
        if (holder.layoutPickupSection != null) {
            if (!isHeadingToCustomer) {
                holder.layoutPickupSection.setVisibility(View.VISIBLE);
                // Fill restaurant address detail
                if (holder.tvPickupRestaurantAddress != null) {
                    String addr = order.getRestaurantAddress();
                    if (addr == null || addr.isEmpty()) addr = order.getRestaurantName();
                    holder.tvPickupRestaurantAddress.setText(addr);
                }
                // Navigate to Restaurant button → Google Maps
                if (holder.btnPickupRestaurantMap != null) {
                    holder.btnPickupRestaurantMap.setOnClickListener(v ->
                            openLocationInGoogleMaps(context,
                                    order.getRestaurantLatitude(), order.getRestaurantLongitude(),
                                    order.getRestaurantName(), order.getRestaurantAddress()));
                }
            } else {
                holder.layoutPickupSection.setVisibility(View.GONE);
            }
        }

        // ── CUSTOMER SECTION: show after pickup ──
        if (holder.layoutCustomerSection != null) {
            if (isHeadingToCustomer) {
                holder.layoutCustomerSection.setVisibility(View.VISIBLE);
                // Customer Name
                if (holder.tvCustomerDetailName != null) {
                    holder.tvCustomerDetailName.setText(order.getCustomerName());
                }
                // Customer Phone
                if (holder.tvCustomerDetailPhone != null) {
                    String phone = order.getCustomerPhone();
                    holder.tvCustomerDetailPhone.setText(
                            phone != null && !phone.isEmpty() ? phone : "Phone not available");
                }
                // Customer Address
                if (holder.tvCustomerDetailAddress != null) {
                    holder.tvCustomerDetailAddress.setText(order.getFullDeliveryAddress());
                }
                // Quick Call Customer
                if (holder.btnCallCustomerQuick != null) {
                    holder.btnCallCustomerQuick.setOnClickListener(v -> {
                        String phone = order.getCustomerPhone();
                        if (phone != null && !phone.trim().isEmpty()) {
                            context.startActivity(new Intent(Intent.ACTION_DIAL,
                                    Uri.parse("tel:" + phone.trim())));
                        } else {
                            Toast.makeText(context, "Customer phone not available", Toast.LENGTH_SHORT).show();
                        }
                    });
                }
                // Navigate to Customer in Google Maps
                if (holder.btnCustomerMap != null) {
                    holder.btnCustomerMap.setOnClickListener(v ->
                            openLocationInGoogleMaps(context,
                                    order.getDeliveryLatitude(), order.getDeliveryLongitude(),
                                    order.getCustomerName(), order.getFullDeliveryAddress()));
                }
            } else {
                holder.layoutCustomerSection.setVisibility(View.GONE);
            }
        }

        // 1. Open Google Maps Turn-by-Turn Navigation (bottom row button)
        holder.btnOpenGoogleMaps.setOnClickListener(v -> {
            double destLat = isHeadingToCustomer ? order.getDeliveryLatitude() : order.getRestaurantLatitude();
            double destLng = isHeadingToCustomer ? order.getDeliveryLongitude() : order.getRestaurantLongitude();
            openNavigationInGoogleMaps(context, destLat, destLng);
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

    /**
     * Opens a specific location in Google Maps (pin view, not navigation).
     */
    private void openLocationInGoogleMaps(Context context, double lat, double lng, String label, String address) {
        try {
            Uri gmmIntentUri;
            if (lat != 0.0 && lng != 0.0) {
                String encodedLabel = Uri.encode(label != null ? label : "Location");
                gmmIntentUri = Uri.parse(String.format(Locale.US,
                        "geo:%.6f,%.6f?q=%.6f,%.6f(%s)", lat, lng, lat, lng, encodedLabel));
            } else {
                String query = Uri.encode(address != null && !address.isEmpty() ? address : label);
                gmmIntentUri = Uri.parse("geo:0,0?q=" + query);
            }
            Intent mapIntent = new Intent(Intent.ACTION_VIEW, gmmIntentUri);
            mapIntent.setPackage("com.google.android.apps.maps");
            if (mapIntent.resolveActivity(context.getPackageManager()) != null) {
                context.startActivity(mapIntent);
            } else {
                String webUrl = lat != 0.0
                        ? String.format(Locale.US, "https://www.google.com/maps/search/?api=1&query=%.6f,%.6f", lat, lng)
                        : "https://www.google.com/maps/search/?api=1&query=" + Uri.encode(label != null ? label : "");
                context.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(webUrl)));
            }
        } catch (Exception e) {
            Toast.makeText(context, "Unable to open Maps", Toast.LENGTH_SHORT).show();
        }
    }

    /**
     * Opens Google Maps turn-by-turn navigation to a destination.
     */
    private void openNavigationInGoogleMaps(Context context, double destLat, double destLng) {
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
    }

    @Override
    public int getItemCount() {
        return orders.size();
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        TextView tvOrderId, tvStageBadge, tvRestaurantAddress;
        TextView tvDeliveryAddress, tvEarnings, tvPaymentBadge;
        MaterialButton btnOpenGoogleMaps, btnNavigateMap, btnCallOrder, btnManageOrder;

        // Pickup section views
        View layoutPickupSection;
        TextView tvPickupRestaurantAddress;
        MaterialButton btnPickupRestaurantMap;

        // Customer section views
        View layoutCustomerSection;
        TextView tvCustomerDetailName, tvCustomerDetailPhone, tvCustomerDetailAddress;
        MaterialButton btnCallCustomerQuick, btnCustomerMap;

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

            // Pickup section
            layoutPickupSection = itemView.findViewById(R.id.layout_pickup_section);
            tvPickupRestaurantAddress = itemView.findViewById(R.id.tv_pickup_restaurant_address);
            btnPickupRestaurantMap = itemView.findViewById(R.id.btn_pickup_restaurant_map);

            // Customer section
            layoutCustomerSection = itemView.findViewById(R.id.layout_customer_section);
            tvCustomerDetailName = itemView.findViewById(R.id.tv_customer_detail_name);
            tvCustomerDetailPhone = itemView.findViewById(R.id.tv_customer_detail_phone);
            tvCustomerDetailAddress = itemView.findViewById(R.id.tv_customer_detail_address);
            btnCallCustomerQuick = itemView.findViewById(R.id.btn_call_customer_quick);
            btnCustomerMap = itemView.findViewById(R.id.btn_customer_map);
        }
    }
}
