package com.ssr.hunger.adapters;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;
import com.ssr.hunger.R;
import com.ssr.hunger.models.CartItem;
import com.bumptech.glide.Glide;
import java.util.List;
import java.util.Locale;

public class CartItemAdapter extends RecyclerView.Adapter<CartItemAdapter.ViewHolder> {

    public interface OnRemoveListener { void onRemove(String menuItemId); }
    public interface OnQuantityChangeListener { void onQuantityChange(String menuItemId, int newQuantity); }

    private List<CartItem> items;
    private final OnRemoveListener removeListener;
    private final OnQuantityChangeListener quantityListener;

    public CartItemAdapter(List<CartItem> items, OnRemoveListener removeListener, OnQuantityChangeListener quantityListener) {
        this.items = items;
        this.removeListener = removeListener;
        this.quantityListener = quantityListener;
    }

    public void updateData(List<CartItem> newItems) {
        this.items = newItems;
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_cart, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        CartItem item = items.get(position);

        holder.tvName.setText(item.getName());
        holder.tvPrice.setText(String.format(Locale.getDefault(), "₹%.0f", item.getPrice()));
        holder.tvQuantity.setText(String.valueOf(item.getQuantity()));
        holder.tvTotalPrice.setText(String.format(Locale.getDefault(), "₹%.0f", item.getTotalPrice()));

        Glide.with(holder.itemView.getContext())
                .load(item.getImage())
                .placeholder(R.drawable.bg_card_rounded)
                .into(holder.ivImage);

        holder.btnMinus.setOnClickListener(v -> {
            if (item.getQuantity() > 1) {
                quantityListener.onQuantityChange(item.getMenuItemId(), item.getQuantity() - 1);
            } else {
                removeListener.onRemove(item.getMenuItemId());
            }
        });

        holder.btnPlus.setOnClickListener(v ->
                quantityListener.onQuantityChange(item.getMenuItemId(), item.getQuantity() + 1));

        holder.btnRemove.setOnClickListener(v -> removeListener.onRemove(item.getMenuItemId()));
    }

    @Override
    public int getItemCount() { return items.size(); }

    static class ViewHolder extends RecyclerView.ViewHolder {
        ImageView ivImage;
        TextView tvName, tvPrice, tvQuantity, tvTotalPrice;
        View btnMinus, btnPlus, btnRemove;

        ViewHolder(@NonNull View itemView) {
            super(itemView);
            ivImage = itemView.findViewById(R.id.iv_cart_item_image);
            tvName = itemView.findViewById(R.id.tv_cart_item_name);
            tvPrice = itemView.findViewById(R.id.tv_cart_item_price);
            tvQuantity = itemView.findViewById(R.id.tv_cart_item_quantity);
            tvTotalPrice = itemView.findViewById(R.id.tv_cart_item_total);
            btnMinus = itemView.findViewById(R.id.btn_minus);
            btnPlus = itemView.findViewById(R.id.btn_plus);
            btnRemove = itemView.findViewById(R.id.btn_remove);
        }
    }
}
