package com.ssr.hunger.adapters;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.ssr.hunger.R;

import java.util.List;

/**
 * Adapter for PIN code locality selection.
 * When a PIN code matches multiple localities/post offices,
 * this adapter displays them for the customer to select the correct one.
 */
public class LocalityAdapter extends RecyclerView.Adapter<LocalityAdapter.ViewHolder> {

    public interface OnLocalitySelectedListener {
        void onLocalitySelected(String locality, String district, String state);
    }

    private List<String[]> localities; // Each: [locality, district, state]
    private final OnLocalitySelectedListener listener;
    private int selectedPosition = -1;

    public LocalityAdapter(List<String[]> localities, OnLocalitySelectedListener listener) {
        this.localities = localities;
        this.listener = listener;
    }

    public void updateData(List<String[]> newData) {
        this.localities = newData;
        this.selectedPosition = -1;
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_locality_option, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        String[] loc = localities.get(position);
        String locality = loc[0];
        String district = loc.length > 1 ? loc[1] : "";
        String state = loc.length > 2 ? loc[2] : "";

        holder.tvLocality.setText(locality);
        holder.tvDistrict.setText(district + (state.isEmpty() ? "" : ", " + state));

        boolean isSelected = position == selectedPosition;
        holder.itemView.setSelected(isSelected);
        holder.tvLocality.setAlpha(isSelected ? 1.0f : 0.85f);

        // Selection indicator
        if (holder.viewIndicator != null) {
            holder.viewIndicator.setVisibility(isSelected ? View.VISIBLE : View.INVISIBLE);
        }

        holder.itemView.setOnClickListener(v -> {
            int prevSelected = selectedPosition;
            selectedPosition = holder.getAdapterPosition();
            if (prevSelected != -1) notifyItemChanged(prevSelected);
            notifyItemChanged(selectedPosition);
            listener.onLocalitySelected(locality, district, state);
        });
    }

    @Override
    public int getItemCount() {
        return localities != null ? localities.size() : 0;
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        TextView tvLocality, tvDistrict;
        View viewIndicator;

        ViewHolder(@NonNull View itemView) {
            super(itemView);
            tvLocality = itemView.findViewById(R.id.tv_locality_name);
            tvDistrict = itemView.findViewById(R.id.tv_locality_district);
            viewIndicator = itemView.findViewById(R.id.view_selected_indicator);
        }
    }
}
