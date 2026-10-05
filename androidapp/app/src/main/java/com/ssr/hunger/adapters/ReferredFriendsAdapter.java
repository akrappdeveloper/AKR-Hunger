package com.ssr.hunger.adapters;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;
import com.ssr.hunger.R;
import com.ssr.hunger.models.ReferralItem;
import java.text.SimpleDateFormat;
import java.util.List;
import java.util.Locale;

public class ReferredFriendsAdapter extends RecyclerView.Adapter<ReferredFriendsAdapter.ViewHolder> {

    private List<ReferralItem> items;
    private final SimpleDateFormat dateFormat = new SimpleDateFormat("dd MMM yyyy, hh:mm a", Locale.getDefault());

    public ReferredFriendsAdapter(List<ReferralItem> items) {
        this.items = items;
    }

    public void updateData(List<ReferralItem> newItems) {
        this.items = newItems;
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_referred_friend, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        ReferralItem item = items.get(position);

        String name = item.getReferredUserName();
        holder.tvFriendName.setText(name);

        if (name != null && !name.isEmpty()) {
            holder.tvAvatarInitial.setText(name.substring(0, 1).toUpperCase());
        } else {
            holder.tvAvatarInitial.setText("👤");
        }

        if (item.getCreatedAt() != null) {
            holder.tvFriendDate.setText("Joined " + dateFormat.format(item.getCreatedAt()));
        } else {
            holder.tvFriendDate.setText("Joined recently");
        }

        holder.tvRewardBadge.setText(String.format(Locale.getDefault(), "+₹%.0f", item.getRewardAmount()));
        holder.tvStatusPill.setText(item.getStatus().toUpperCase());
    }

    @Override
    public int getItemCount() {
        return items != null ? items.size() : 0;
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        TextView tvAvatarInitial, tvFriendName, tvFriendDate, tvRewardBadge, tvStatusPill;

        ViewHolder(@NonNull View itemView) {
            super(itemView);
            tvAvatarInitial = itemView.findViewById(R.id.tv_avatar_initial);
            tvFriendName = itemView.findViewById(R.id.tv_friend_name);
            tvFriendDate = itemView.findViewById(R.id.tv_friend_date);
            tvRewardBadge = itemView.findViewById(R.id.tv_reward_badge);
            tvStatusPill = itemView.findViewById(R.id.tv_status_pill);
        }
    }
}
