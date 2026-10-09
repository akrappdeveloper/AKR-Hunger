package com.ssr.hunger.adapters;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;
import com.ssr.hunger.R;
import com.ssr.hunger.models.MenuItem;
import java.util.List;
import java.util.Locale;

public class SuggestionAdapter extends RecyclerView.Adapter<SuggestionAdapter.ViewHolder> {

    public interface OnSuggestionClickListener {
        void onSuggestionClick(MenuItem item);
        void onSuggestionFill(String query);
    }

    private List<MenuItem> items;
    private final OnSuggestionClickListener listener;

    public SuggestionAdapter(List<MenuItem> items, OnSuggestionClickListener listener) {
        this.items = items;
        this.listener = listener;
    }

    public void updateData(List<MenuItem> newItems) {
        this.items = newItems;
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_search_suggestion, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        MenuItem item = items.get(position);
        holder.tvName.setText(item.getName());

        String rest = item.getRestaurantName() != null ? item.getRestaurantName() : "AKR Hunger";
        String cat = item.getCategory() != null ? item.getCategory() : "Dishes";
        holder.tvDesc.setText(rest + " • " + cat);

        holder.tvPrice.setText(String.format(Locale.getDefault(), "₹%.0f", item.getPrice()));

        holder.itemView.setOnClickListener(v -> {
            if (listener != null) listener.onSuggestionClick(item);
        });

        holder.btnFill.setOnClickListener(v -> {
            if (listener != null) listener.onSuggestionFill(item.getName());
        });
    }

    @Override
    public int getItemCount() {
        return items != null ? items.size() : 0;
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        TextView tvName, tvDesc, tvPrice;
        View btnFill;

        ViewHolder(@NonNull View itemView) {
            super(itemView);
            tvName = itemView.findViewById(R.id.tv_suggestion_name);
            tvDesc = itemView.findViewById(R.id.tv_suggestion_desc);
            tvPrice = itemView.findViewById(R.id.tv_suggestion_price);
            btnFill = itemView.findViewById(R.id.btn_fill_query);
        }
    }
}
