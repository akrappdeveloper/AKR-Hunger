package com.ssr.hunger.adapters;

import android.graphics.drawable.GradientDrawable;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.RecyclerView;
import com.ssr.hunger.R;
import com.ssr.hunger.models.MenuItem;
import com.bumptech.glide.Glide;
import com.bumptech.glide.load.resource.bitmap.CenterCrop;
import java.util.List;
import java.util.Locale;

public class MenuItemAdapter extends RecyclerView.Adapter<MenuItemAdapter.ViewHolder> {

    public interface OnItemClickListener {
        void onItemClick(MenuItem item);
    }

    public interface OnQuickAddListener {
        void onQuickAdd(MenuItem item);
    }

    private List<MenuItem> items;
    private final OnItemClickListener clickListener;
    private final OnQuickAddListener addListener;

    public MenuItemAdapter(List<MenuItem> items, OnItemClickListener clickListener, OnQuickAddListener addListener) {
        this.items = items;
        this.clickListener = clickListener;
        this.addListener = addListener;
    }

    public void updateData(List<MenuItem> newData) {
        this.items = newData;
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_menu_card, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        MenuItem item = items.get(position);

        holder.tvName.setText(item.getName());
        holder.tvRestaurant.setText(item.getRestaurantName());
        holder.tvDescription.setText(item.getDescription() != null ? item.getDescription() : "Freshly prepared and packed with delicious flavours.");
        holder.tvPrice.setText(String.format(Locale.getDefault(), "₹%.0f", item.getPrice()));

        // Prep time
        int prepTime = item.getPreparationTime() > 0 ? item.getPreparationTime() : 25;
        holder.tvPrepTime.setText(prepTime + "m");

        // Rating
        if (item.getAverageRating() > 0) {
            holder.tvRating.setText(String.format(Locale.getDefault(), "%.1f", item.getAverageRating()));
        } else {
            holder.tvRating.setText("New");
        }

        // Veg/Non-Veg indicator
        int dotColor = item.isVegetarian() ? R.color.veg_green : R.color.non_veg_red;
        GradientDrawable dotDrawable = new GradientDrawable();
        dotDrawable.setShape(GradientDrawable.OVAL);
        dotDrawable.setColor(ContextCompat.getColor(holder.itemView.getContext(), dotColor));
        holder.vegDot.setBackground(dotDrawable);

        // Veg indicator border
        GradientDrawable borderDrawable = new GradientDrawable();
        borderDrawable.setShape(GradientDrawable.RECTANGLE);
        borderDrawable.setCornerRadius(4);
        borderDrawable.setStroke(3, ContextCompat.getColor(holder.itemView.getContext(), dotColor));
        borderDrawable.setColor(ContextCompat.getColor(holder.itemView.getContext(), R.color.surface));
        holder.vegIndicator.setBackground(borderDrawable);

        // Best Seller badge
        holder.tvBestSeller.setVisibility(item.isBestSeller() ? View.VISIBLE : View.GONE);

        // Load image
        if (item.getImage() != null && !item.getImage().isEmpty()) {
            Glide.with(holder.itemView.getContext())
                    .load(item.getImage())
                    .transform(new CenterCrop())
                    .placeholder(R.drawable.bg_card_rounded)
                    .into(holder.ivImage);
        }

        // Click listeners
        holder.itemView.setOnClickListener(v -> clickListener.onItemClick(item));
        holder.btnQuickAdd.setOnClickListener(v -> addListener.onQuickAdd(item));
    }

    @Override
    public int getItemCount() {
        return items.size();
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        ImageView ivImage;
        View btnQuickAdd;
        TextView tvName, tvRestaurant, tvDescription, tvPrice, tvPrepTime, tvRating, tvBestSeller;
        View vegDot;
        View vegIndicator;

        ViewHolder(@NonNull View itemView) {
            super(itemView);
            ivImage = itemView.findViewById(R.id.iv_item_image);
            btnQuickAdd = itemView.findViewById(R.id.btn_quick_add);
            tvName = itemView.findViewById(R.id.tv_item_name);
            tvRestaurant = itemView.findViewById(R.id.tv_restaurant_name);
            tvDescription = itemView.findViewById(R.id.tv_description);
            tvPrice = itemView.findViewById(R.id.tv_price);
            tvPrepTime = itemView.findViewById(R.id.tv_prep_time);
            tvRating = itemView.findViewById(R.id.tv_rating);
            tvBestSeller = itemView.findViewById(R.id.tv_best_seller);
            vegDot = itemView.findViewById(R.id.veg_dot);
            vegIndicator = itemView.findViewById(R.id.veg_indicator);
        }
    }
}
