package com.ssr.hunger.adapters;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;
import com.ssr.hunger.R;
import com.ssr.hunger.models.Restaurant;
import com.bumptech.glide.Glide;
import com.bumptech.glide.load.resource.bitmap.CenterCrop;
import com.bumptech.glide.load.resource.bitmap.RoundedCorners;
import java.util.List;

public class FeaturedRestaurantAdapter extends RecyclerView.Adapter<FeaturedRestaurantAdapter.ViewHolder> {

    public interface OnRestaurantClickListener {
        void onRestaurantClick(Restaurant restaurant);
    }

    private List<Restaurant> restaurants;
    private final OnRestaurantClickListener listener;

    public FeaturedRestaurantAdapter(List<Restaurant> restaurants, OnRestaurantClickListener listener) {
        this.restaurants = restaurants;
        this.listener = listener;
    }

    public void updateData(List<Restaurant> newData) {
        this.restaurants = newData;
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_featured_restaurant, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        Restaurant restaurant = restaurants.get(position);

        holder.tvName.setText(restaurant.getName());
        holder.tvRating.setText(restaurant.getDisplayRating());
        holder.tvCuisine.setText(restaurant.getCuisineString());

        // Load image with Glide
        if (restaurant.getImage() != null && !restaurant.getImage().isEmpty()) {
            Glide.with(holder.itemView.getContext())
                    .load(restaurant.getImage())
                    .transform(new CenterCrop())
                    .placeholder(R.drawable.bg_card_rounded)
                    .into(holder.ivImage);
        }

        holder.itemView.setOnClickListener(v -> listener.onRestaurantClick(restaurant));
    }

    @Override
    public int getItemCount() {
        return restaurants.size();
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        ImageView ivImage;
        TextView tvName, tvRating, tvCuisine;

        ViewHolder(@NonNull View itemView) {
            super(itemView);
            ivImage = itemView.findViewById(R.id.iv_restaurant_image);
            tvName = itemView.findViewById(R.id.tv_restaurant_name);
            tvRating = itemView.findViewById(R.id.tv_restaurant_rating);
            tvCuisine = itemView.findViewById(R.id.tv_restaurant_cuisine);
        }
    }
}
