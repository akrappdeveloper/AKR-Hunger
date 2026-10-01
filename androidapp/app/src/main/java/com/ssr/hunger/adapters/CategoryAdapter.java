package com.ssr.hunger.adapters;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;
import com.ssr.hunger.R;
import com.ssr.hunger.models.Category;
import java.util.List;

public class CategoryAdapter extends RecyclerView.Adapter<CategoryAdapter.ViewHolder> {

    public interface OnCategoryClickListener {
        void onCategoryClick(Category category);
    }

    private final List<Category> categories;
    private final OnCategoryClickListener listener;
    private String selectedId = "all";

    public CategoryAdapter(List<Category> categories, OnCategoryClickListener listener) {
        this.categories = categories;
        this.listener = listener;
    }

    public void setSelected(String id) {
        this.selectedId = id;
        notifyDataSetChanged();
    }

    public void updateData(List<Category> newCategories) {
        this.categories.clear();
        if (newCategories != null) {
            this.categories.addAll(newCategories);
        }
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_category, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        Category category = categories.get(position);
        holder.tvIcon.setText(category.getIcon());
        holder.tvName.setText(category.getName());

        boolean isSelected = category.getId().equals(selectedId);
        holder.iconBg.setBackgroundResource(isSelected ?
                R.drawable.bg_category_chip_selected : R.drawable.bg_category_chip);
        holder.tvName.setTextColor(holder.itemView.getContext().getColor(
                isSelected ? R.color.primary : R.color.text_secondary));

        holder.itemView.setOnClickListener(v -> listener.onCategoryClick(category));
    }

    @Override
    public int getItemCount() {
        return categories.size();
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        TextView tvIcon, tvName;
        FrameLayout iconBg;

        ViewHolder(@NonNull View itemView) {
            super(itemView);
            tvIcon = itemView.findViewById(R.id.tv_category_icon);
            tvName = itemView.findViewById(R.id.tv_category_name);
            iconBg = itemView.findViewById(R.id.category_icon_bg);
        }
    }
}
