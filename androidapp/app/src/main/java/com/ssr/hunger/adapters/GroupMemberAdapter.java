package com.ssr.hunger.adapters;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;
import com.ssr.hunger.R;
import com.ssr.hunger.models.GroupMember;
import java.util.List;

/**
 * RecyclerView adapter for displaying group order members.
 * Shows: name, initials avatar, subtotal, payment status.
 */
public class GroupMemberAdapter extends RecyclerView.Adapter<GroupMemberAdapter.ViewHolder> {

    private final List<GroupMember> members;
    private final String currentUserId;

    public GroupMemberAdapter(List<GroupMember> members, String currentUserId) {
        this.members = members;
        this.currentUserId = currentUserId;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_group_member, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        GroupMember member = members.get(position);

        // Avatar initial
        if (holder.tvInitial != null) {
            holder.tvInitial.setText(String.valueOf(member.getInitial()));
        }

        // Name with host badge
        if (holder.tvName != null) {
            String displayName = member.getName();
            if (member.isHost()) displayName += " 👑";
            if (member.getUserId() != null && member.getUserId().equals(currentUserId)) {
                displayName += " (You)";
            }
            holder.tvName.setText(displayName);
        }

        // Items count
        if (holder.tvItemCount != null) {
            int count = member.getItems() != null ? member.getItems().size() : 0;
            holder.tvItemCount.setText(count + " item" + (count != 1 ? "s" : ""));
        }

        // Subtotal
        if (holder.tvSubtotal != null) {
            holder.tvSubtotal.setText("₹" + (int) member.getSubtotal());
        }

        // Payment status
        if (holder.tvPaymentStatus != null) {
            String status = member.getPaymentStatus();
            if ("paid".equals(status)) {
                holder.tvPaymentStatus.setText("✓ PAID");
                holder.tvPaymentStatus.setTextColor(
                        holder.itemView.getContext().getColor(android.R.color.holo_green_dark));
            } else {
                holder.tvPaymentStatus.setText("PENDING");
                holder.tvPaymentStatus.setTextColor(
                        holder.itemView.getContext().getColor(android.R.color.holo_orange_dark));
            }
        }
    }

    @Override
    public int getItemCount() {
        return members != null ? members.size() : 0;
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        TextView tvInitial;
        TextView tvName;
        TextView tvItemCount;
        TextView tvSubtotal;
        TextView tvPaymentStatus;

        ViewHolder(View view) {
            super(view);
            tvInitial = view.findViewById(R.id.tv_member_initial);
            tvName = view.findViewById(R.id.tv_member_name);
            tvItemCount = view.findViewById(R.id.tv_member_item_count);
            tvSubtotal = view.findViewById(R.id.tv_member_subtotal);
            tvPaymentStatus = view.findViewById(R.id.tv_member_payment_status);
        }
    }
}
