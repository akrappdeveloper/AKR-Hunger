package com.ssr.hunger.delivery.activities;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FirebaseFirestore;
import com.ssr.hunger.delivery.R;
import com.ssr.hunger.delivery.utils.Constants;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class NotificationsActivity extends AppCompatActivity {

    private FirebaseAuth auth;
    private FirebaseFirestore db;

    private RecyclerView rvNotifications;
    private View layoutEmpty;
    private NotificationAdapter adapter;
    private final List<Map<String, Object>> notifList = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_notifications);

        auth = FirebaseAuth.getInstance();
        db = FirebaseFirestore.getInstance();

        Toolbar toolbar = findViewById(R.id.toolbar_notifications);
        setSupportActionBar(toolbar);
        if (getSupportActionBar() != null) getSupportActionBar().setDisplayHomeAsUpEnabled(true);
        toolbar.setNavigationOnClickListener(v -> finish());

        rvNotifications = findViewById(R.id.rv_notifications_list);
        layoutEmpty = findViewById(R.id.layout_empty_notifications);

        rvNotifications.setLayoutManager(new LinearLayoutManager(this));
        adapter = new NotificationAdapter();
        rvNotifications.setAdapter(adapter);

        loadNotifications();
    }

    private void loadNotifications() {
        if (auth.getCurrentUser() == null) return;
        String uid = auth.getCurrentUser().getUid();

        db.collection(Constants.COLLECTION_NOTIFICATIONS)
                .whereEqualTo("userId", uid)
                .addSnapshotListener((snap, e) -> {
                    if (e != null || snap == null) return;

                    notifList.clear();
                    for (DocumentSnapshot doc : snap.getDocuments()) {
                        notifList.add(doc.getData());
                    }

                    if (notifList.isEmpty()) {
                        if (layoutEmpty != null) layoutEmpty.setVisibility(View.VISIBLE);
                        if (rvNotifications != null) rvNotifications.setVisibility(View.GONE);
                    } else {
                        if (layoutEmpty != null) layoutEmpty.setVisibility(View.GONE);
                        if (rvNotifications != null) rvNotifications.setVisibility(View.VISIBLE);
                        adapter.notifyDataSetChanged();
                    }
                });
    }

    private class NotificationAdapter extends RecyclerView.Adapter<NotificationAdapter.ViewHolder> {
        @NonNull
        @Override
        public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_driver_notification, parent, false);
            return new ViewHolder(view);
        }

        @Override
        public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
            Map<String, Object> data = notifList.get(position);
            holder.tvTitle.setText(data.containsKey("title") ? String.valueOf(data.get("title")) : "Hunger Delivery Alert");
            holder.tvMessage.setText(data.containsKey("body") ? String.valueOf(data.get("body")) : String.valueOf(data.get("message")));
            holder.tvTime.setText("Recent Alert");
        }

        @Override
        public int getItemCount() {
            return notifList.size();
        }

        class ViewHolder extends RecyclerView.ViewHolder {
            TextView tvTitle, tvMessage, tvTime;
            ViewHolder(View v) {
                super(v);
                tvTitle = v.findViewById(R.id.tv_notif_title);
                tvMessage = v.findViewById(R.id.tv_notif_message);
                tvTime = v.findViewById(R.id.tv_notif_time);
            }
        }
    }
}
