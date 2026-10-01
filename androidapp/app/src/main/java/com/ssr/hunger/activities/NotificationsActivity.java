package com.ssr.hunger.activities;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.ProgressBar;
import android.widget.TextView;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import com.ssr.hunger.R;
import com.ssr.hunger.adapters.NotificationAdapter;
import com.ssr.hunger.models.NotificationItem;
import com.ssr.hunger.utils.Constants;
import java.util.ArrayList;
import java.util.List;

/**
 * Modern Premium Minimalist Notifications Activity.
 * Fetches notifications with in-memory resilient sorting (no Firestore index requirement).
 * Supports deep navigation to Order Detail, pull-to-refresh, and mark-as-read.
 */
public class NotificationsActivity extends BaseActivity {

    private RecyclerView rvNotifications;
    private View emptyState;
    private ProgressBar loadingIndicator;
    private SwipeRefreshLayout swipeRefresh;
    private TextView tvUnreadBadge;
    private TextView btnMarkAllRead;

    private NotificationAdapter adapter;
    private final List<NotificationItem> notificationList = new ArrayList<>();
    private FirebaseFirestore db;
    private ListenerRegistration notifListener;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_notifications);

        db = FirebaseFirestore.getInstance();

        initViews();
        setupRecyclerView();
        setupListeners();
        loadNotifications();
    }

    private void initViews() {
        rvNotifications = findViewById(R.id.rv_notifications);
        emptyState = findViewById(R.id.empty_state);
        loadingIndicator = findViewById(R.id.loading_indicator);
        swipeRefresh = findViewById(R.id.swipe_refresh);
        tvUnreadBadge = findViewById(R.id.tv_unread_badge);
        btnMarkAllRead = findViewById(R.id.btn_mark_all_read);

        swipeRefresh.setColorSchemeResources(R.color.primary);
    }

    private void setupRecyclerView() {
        rvNotifications.setLayoutManager(new LinearLayoutManager(this));
        adapter = new NotificationAdapter(notificationList, item -> {
            markAsRead(item);
            if (item.getOrderId() != null && !item.getOrderId().trim().isEmpty()) {
                Intent intent = new Intent(NotificationsActivity.this, OrderDetailActivity.class);
                intent.putExtra(Constants.EXTRA_ORDER_ID, item.getOrderId());
                startActivity(intent);
            }
        });
        rvNotifications.setAdapter(adapter);
    }

    private void setupListeners() {
        findViewById(R.id.btn_back).setOnClickListener(v -> finish());

        View btnBrowseFood = findViewById(R.id.btn_browse_food);
        if (btnBrowseFood != null) {
            btnBrowseFood.setOnClickListener(v -> finish());
        }

        swipeRefresh.setOnRefreshListener(this::loadNotifications);

        if (btnMarkAllRead != null) {
            btnMarkAllRead.setOnClickListener(v -> markAllAsRead());
        }
    }

    private void loadNotifications() {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) {
            loadingIndicator.setVisibility(View.GONE);
            swipeRefresh.setRefreshing(false);
            showEmptyState(true);
            return;
        }

        logBreadcrumb("Loading notifications for user: " + user.getUid());

        if (notifListener != null) {
            notifListener.remove();
        }

        // Realtime query: filter by userId without composite orderBy to prevent indexing crashes
        notifListener = db.collection(Constants.COLLECTION_NOTIFICATIONS)
                .whereEqualTo("userId", user.getUid())
                .limit(60)
                .addSnapshotListener((querySnapshot, error) -> {
                    loadingIndicator.setVisibility(View.GONE);
                    swipeRefresh.setRefreshing(false);

                    if (error != null) {
                        recordException("loadNotifications_realtime_failed", error);
                        if (notificationList.isEmpty()) {
                            showEmptyState(true);
                        }
                        return;
                    }

                    if (querySnapshot == null) {
                        if (notificationList.isEmpty()) showEmptyState(true);
                        return;
                    }

                    notificationList.clear();
                    int unreadCount = 0;

                    for (DocumentSnapshot doc : querySnapshot.getDocuments()) {
                        String title = doc.getString("title");
                        if (title == null || title.trim().isEmpty()) continue;

                        String message = doc.getString("message");
                        if (message == null) {
                            message = doc.getString("body");
                        }
                        if (message == null) message = "";

                        String type = doc.getString("type");
                        String orderId = doc.getString("orderId");
                        Boolean readObj = doc.getBoolean("read");
                        if (readObj == null) {
                            readObj = doc.getBoolean("isRead");
                        }
                        boolean isRead = readObj != null && readObj;

                        NotificationItem item = new NotificationItem(
                                doc.getId(),
                                user.getUid(),
                                title,
                                message,
                                type != null ? type : "system",
                                orderId,
                                isRead,
                                doc.getTimestamp("createdAt") != null ? doc.getTimestamp("createdAt").toDate() : null
                        );

                        if (!isRead) {
                            unreadCount++;
                        }

                        notificationList.add(item);
                    }

                    // Sort descending by creation date in memory
                    notificationList.sort((a, b) -> {
                        if (a.getCreatedAt() == null && b.getCreatedAt() == null) return 0;
                        if (a.getCreatedAt() == null) return 1;
                        if (b.getCreatedAt() == null) return -1;
                        return b.getCreatedAt().compareTo(a.getCreatedAt());
                    });

                    updateUnreadUI(unreadCount);

                    if (notificationList.isEmpty()) {
                        showEmptyState(true);
                    } else {
                        showEmptyState(false);
                        adapter.notifyDataSetChanged();
                    }
                });
    }

    private void updateUnreadUI(int count) {
        if (tvUnreadBadge != null) {
            if (count > 0) {
                tvUnreadBadge.setText(count + " new");
                tvUnreadBadge.setVisibility(View.VISIBLE);
            } else {
                tvUnreadBadge.setVisibility(View.GONE);
            }
        }
        if (btnMarkAllRead != null) {
            btnMarkAllRead.setVisibility(count > 0 ? View.VISIBLE : View.GONE);
        }
    }

    private void showEmptyState(boolean show) {
        if (emptyState != null) {
            emptyState.setVisibility(show ? View.VISIBLE : View.GONE);
        }
        if (rvNotifications != null) {
            rvNotifications.setVisibility(show ? View.GONE : View.VISIBLE);
        }
    }

    private void markAsRead(NotificationItem item) {
        if (item.isRead()) return;
        item.setRead(true);
        adapter.notifyDataSetChanged();

        db.collection(Constants.COLLECTION_NOTIFICATIONS)
                .document(item.getId())
                .update("read", true, "isRead", true)
                .addOnFailureListener(e -> recordException("markAsRead_failed", e));

        long unread = notificationList.stream().filter(n -> !n.isRead()).count();
        updateUnreadUI((int) unread);
    }

    private void markAllAsRead() {
        for (NotificationItem item : notificationList) {
            if (!item.isRead()) {
                item.setRead(true);
                db.collection(Constants.COLLECTION_NOTIFICATIONS)
                        .document(item.getId())
                        .update("read", true, "isRead", true);
            }
        }
        adapter.notifyDataSetChanged();
        updateUnreadUI(0);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (notifListener != null) {
            notifListener.remove();
            notifListener = null;
        }
    }

    @Override
    protected String getScreenName() {
        return "Notifications";
    }
}
