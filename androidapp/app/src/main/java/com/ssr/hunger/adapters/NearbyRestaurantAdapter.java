package com.ssr.hunger.adapters;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.bumptech.glide.Glide;
import com.bumptech.glide.load.resource.bitmap.CenterCrop;
import com.bumptech.glide.load.resource.bitmap.RoundedCorners;
import com.ssr.hunger.R;
import com.ssr.hunger.models.Restaurant;
import com.ssr.hunger.utils.GeohashHelper;

import java.util.List;

/**
 * Enhanced restaurant adapter that displays road distance, ETA, and
 * delivery fee alongside restaurant details. Used for geospatial
 * discovery results.
 */
public class NearbyRestaurantAdapter extends RecyclerView.Adapter<NearbyRestaurantAdapter.ViewHolder> {

    public interface OnRestaurantClickListener {
        void onRestaurantClick(Restaurant restaurant);
    }

    /**
     * Wraps a Restaurant with its eligibility data from the server.
     */
    public static class RestaurantWithDistance {
        public final Restaurant restaurant;
        public final double roadDistanceMeters;
        public final int estimatedDeliveryMinutes;
        public final double deliveryFee;
        public final boolean eligible;
        public final String reasonCode;

        public RestaurantWithDistance(Restaurant restaurant, double roadDistanceMeters,
                                     int estimatedDeliveryMinutes, double deliveryFee,
                                     boolean eligible, String reasonCode) {
            this.restaurant = restaurant;
            this.roadDistanceMeters = roadDistanceMeters;
            this.estimatedDeliveryMinutes = estimatedDeliveryMinutes;
            this.deliveryFee = deliveryFee;
            this.eligible = eligible;
            this.reasonCode = reasonCode;
        }
    }

    private List<RestaurantWithDistance> restaurants;
    private final OnRestaurantClickListener listener;

    public NearbyRestaurantAdapter(List<RestaurantWithDistance> restaurants,
                                   OnRestaurantClickListener listener) {
        this.restaurants = restaurants;
        this.listener = listener;
    }

    public void updateData(List<RestaurantWithDistance> newData) {
        this.restaurants = newData;
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_nearby_restaurant, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        RestaurantWithDistance entry = restaurants.get(position);
        Restaurant restaurant = entry.restaurant;

        // Name and cuisine
        holder.tvName.setText(restaurant.getName());
        holder.tvCuisine.setText(restaurant.getCuisineString());
        holder.tvRating.setText(restaurant.getDisplayRating());

        // Road distance
        holder.tvDistance.setText(GeohashHelper.formatDistance(entry.roadDistanceMeters));

        // ETA
        if (entry.estimatedDeliveryMinutes > 0) {
            holder.tvEta.setVisibility(View.VISIBLE);
            holder.tvEta.setText(entry.estimatedDeliveryMinutes + " min");
        } else {
            holder.tvEta.setVisibility(View.GONE);
        }

        // Delivery fee
        if (entry.deliveryFee > 0) {
            holder.tvDeliveryFee.setText("₹" + (int) entry.deliveryFee);
        } else {
            holder.tvDeliveryFee.setText("FREE");
        }

        // Operating status
        boolean isOpen = restaurant.isOperatingNow();
        if (holder.tvClosedBadge != null) {
            holder.tvClosedBadge.setVisibility(isOpen ? View.GONE : View.VISIBLE);
        }

        // Eligibility badge
        if (!entry.eligible && holder.tvUnavailableBadge != null) {
            holder.tvUnavailableBadge.setVisibility(View.VISIBLE);
            holder.tvUnavailableBadge.setText(getReasonText(entry.reasonCode));
            holder.itemView.setAlpha(0.6f);
        } else {
            if (holder.tvUnavailableBadge != null) {
                holder.tvUnavailableBadge.setVisibility(View.GONE);
            }
            holder.itemView.setAlpha(1.0f);
        }

        // Load image
        if (restaurant.getImage() != null && !restaurant.getImage().isEmpty()) {
            Glide.with(holder.itemView.getContext())
                    .load(restaurant.getImage())
                    .transform(new CenterCrop(), new RoundedCorners(16))
                    .placeholder(R.drawable.bg_card_rounded)
                    .into(holder.ivImage);
        }

        holder.itemView.setOnClickListener(v -> {
            if (entry.eligible) {
                listener.onRestaurantClick(restaurant);
            }
        });
    }

    @Override
    public int getItemCount() {
        return restaurants != null ? restaurants.size() : 0;
    }

    private String getReasonText(String reasonCode) {
        if (reasonCode == null) return "Unavailable";
        switch (reasonCode) {
            case "OUTSIDE_DELIVERY_RADIUS": return "Too far";
            case "RESTAURANT_CLOSED": return "Closed";
            case "NOT_ACCEPTING_ORDERS": return "Not accepting";
            case "NO_VALID_ROUTE": return "No route";
            case "RESTAURANT_NOT_APPROVED": return "Coming soon";
            default: return "Unavailable";
        }
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        ImageView ivImage;
        TextView tvName, tvRating, tvCuisine, tvDistance, tvEta, tvDeliveryFee;
        TextView tvClosedBadge, tvUnavailableBadge;

        ViewHolder(@NonNull View itemView) {
            super(itemView);
            ivImage = itemView.findViewById(R.id.iv_restaurant_image);
            tvName = itemView.findViewById(R.id.tv_restaurant_name);
            tvRating = itemView.findViewById(R.id.tv_restaurant_rating);
            tvCuisine = itemView.findViewById(R.id.tv_restaurant_cuisine);
            tvDistance = itemView.findViewById(R.id.tv_road_distance);
            tvEta = itemView.findViewById(R.id.tv_delivery_eta);
            tvDeliveryFee = itemView.findViewById(R.id.tv_delivery_fee);
            tvClosedBadge = itemView.findViewById(R.id.tv_closed_badge);
            tvUnavailableBadge = itemView.findViewById(R.id.tv_unavailable_badge);
        }
    }
}
