package com.ssr.hunger.activities;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import com.ssr.hunger.R;
import com.ssr.hunger.adapters.GroupMemberAdapter;
import com.ssr.hunger.models.GroupOrder;
import com.ssr.hunger.models.GroupMember;
import com.ssr.hunger.utils.Constants;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.DocumentReference;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import com.google.firebase.firestore.Query;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * Hunger Group Order Activity
 * ============================
 * Create or join group orders with real-time sync.
 * Features:
 * - Create group with invite code
 * - Join via invite code
 * - Real-time member updates
 * - Split payment overview
 * - Host controls (lock order)
 */
public class GroupOrderActivity extends AppCompatActivity {

    // Views
    private LinearLayout homeLayout;
    private LinearLayout activeLayout;
    private LinearLayout joinLayout;
    private TextView tvGroupName;
    private TextView tvRestaurantName;
    private TextView tvInviteCode;
    private TextView tvGroupTotal;
    private TextView tvStatus;
    private Button btnLockOrder;
    private Button btnJoinSubmit;
    private Button btnShare;
    private Button btnCopyCode;
    private EditText etInviteCode;
    private RecyclerView rvMembers;
    private ProgressBar progressBar;

    // Data
    private FirebaseFirestore db;
    private FirebaseAuth auth;
    private FirebaseUser currentUser;
    private ListenerRegistration groupListener;
    private GroupOrder currentGroup;
    private GroupMemberAdapter memberAdapter;
    private List<GroupMember> memberList = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_group_order);

        db = FirebaseFirestore.getInstance();
        auth = FirebaseAuth.getInstance();
        currentUser = auth.getCurrentUser();

        if (currentUser == null) {
            Toast.makeText(this, "Please sign in to use Group Orders", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        initViews();
        showHomeScreen();
    }

    private void initViews() {
        homeLayout = findViewById(R.id.layout_home);
        activeLayout = findViewById(R.id.layout_active);
        joinLayout = findViewById(R.id.layout_join);
        tvGroupName = findViewById(R.id.tv_group_name);
        tvRestaurantName = findViewById(R.id.tv_restaurant_name);
        tvInviteCode = findViewById(R.id.tv_invite_code);
        tvGroupTotal = findViewById(R.id.tv_group_total);
        tvStatus = findViewById(R.id.tv_group_status);
        btnLockOrder = findViewById(R.id.btn_lock_order);
        btnJoinSubmit = findViewById(R.id.btn_join_submit);
        btnShare = findViewById(R.id.btn_share);
        btnCopyCode = findViewById(R.id.btn_copy_code);
        etInviteCode = findViewById(R.id.et_invite_code);
        rvMembers = findViewById(R.id.rv_members);
        progressBar = findViewById(R.id.progress_bar);

        // Setup RecyclerView
        memberAdapter = new GroupMemberAdapter(memberList, currentUser.getUid());
        rvMembers.setLayoutManager(new LinearLayoutManager(this));
        rvMembers.setAdapter(memberAdapter);

        // Home screen buttons
        Button btnCreate = findViewById(R.id.btn_create_group);
        Button btnJoinGroup = findViewById(R.id.btn_join_group);
        if (btnCreate != null) btnCreate.setOnClickListener(v -> showCreateFlow());
        if (btnJoinGroup != null) btnJoinGroup.setOnClickListener(v -> showJoinScreen());

        // Join screen
        if (btnJoinSubmit != null) btnJoinSubmit.setOnClickListener(v -> joinGroup());

        // Active screen controls
        if (btnLockOrder != null) btnLockOrder.setOnClickListener(v -> lockOrder());
        if (btnShare != null) btnShare.setOnClickListener(v -> shareInvite());
        if (btnCopyCode != null) btnCopyCode.setOnClickListener(v -> copyInviteCode());

        // Back button
        View btnBack = findViewById(R.id.btn_back);
        if (btnBack != null) btnBack.setOnClickListener(v -> onBackPressed());
    }

    private void showHomeScreen() {
        if (homeLayout != null) homeLayout.setVisibility(View.VISIBLE);
        if (activeLayout != null) activeLayout.setVisibility(View.GONE);
        if (joinLayout != null) joinLayout.setVisibility(View.GONE);
    }

    private void showJoinScreen() {
        if (homeLayout != null) homeLayout.setVisibility(View.GONE);
        if (joinLayout != null) joinLayout.setVisibility(View.VISIBLE);
    }

    private void showCreateFlow() {
        // In full app, user selects restaurant first. For now, use intent extras.
        String restaurantId = getIntent().getStringExtra("restaurantId");
        String restaurantName = getIntent().getStringExtra("restaurantName");

        if (restaurantId == null || restaurantId.isEmpty()) {
            Toast.makeText(this, "Please open Group Order from a restaurant page", Toast.LENGTH_SHORT).show();
            return;
        }

        createGroup(restaurantId, restaurantName != null ? restaurantName : "Restaurant");
    }

    private void createGroup(String restaurantId, String restaurantName) {
        setLoading(true);

        String inviteCode = generateInviteCode();
        String hostName = currentUser.getDisplayName() != null
                ? currentUser.getDisplayName() : "Host";

        Map<String, Object> memberData = new HashMap<>();
        memberData.put("userId", currentUser.getUid());
        memberData.put("name", hostName);
        memberData.put("isHost", true);
        memberData.put("joinedAt", com.google.firebase.Timestamp.now());
        memberData.put("subtotal", 0);
        memberData.put("paymentStatus", "pending");
        memberData.put("items", new ArrayList<>());

        List<Map<String, Object>> members = new ArrayList<>();
        members.add(memberData);

        Map<String, Object> groupData = new HashMap<>();
        groupData.put("hostId", currentUser.getUid());
        groupData.put("hostName", hostName);
        groupData.put("restaurantId", restaurantId);
        groupData.put("restaurantName", restaurantName);
        groupData.put("inviteCode", inviteCode);
        groupData.put("inviteLink", Constants.APP_BASE_URL + "/customer/group/" + inviteCode);
        groupData.put("status", "open");
        groupData.put("members", members);
        groupData.put("totalAmount", 0);
        groupData.put("createdAt", com.google.firebase.Timestamp.now());

        db.collection("groupOrders")
                .add(groupData)
                .addOnSuccessListener(ref -> {
                    setLoading(false);
                    subscribeToGroup(ref.getId());
                    showActiveGroupScreen(ref.getId(), inviteCode, restaurantName, hostName);
                })
                .addOnFailureListener(e -> {
                    setLoading(false);
                    Toast.makeText(this, "Failed to create group: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                });
    }

    private void joinGroup() {
        if (etInviteCode == null) return;
        String code = etInviteCode.getText().toString().trim().toUpperCase();
        if (code.length() != 6) {
            etInviteCode.setError("Enter 6-character invite code");
            return;
        }

        setLoading(true);
        db.collection("groupOrders")
                .whereEqualTo("inviteCode", code)
                .whereEqualTo("status", "open")
                .get()
                .addOnSuccessListener(querySnap -> {
                    if (querySnap.isEmpty()) {
                        setLoading(false);
                        Toast.makeText(this, "Invalid or expired invite code", Toast.LENGTH_SHORT).show();
                        return;
                    }

                    DocumentReference groupRef = querySnap.getDocuments().get(0).getReference();
                    String groupId = querySnap.getDocuments().get(0).getId();
                    Map<String, Object> groupData = querySnap.getDocuments().get(0).getData();
                    String restaurantName = groupData != null ? (String) groupData.get("restaurantName") : "";
                    String hostName = groupData != null ? (String) groupData.get("hostName") : "";

                    // Check if already a member
                    List<Map<String, Object>> existingMembers =
                            (List<Map<String, Object>>) (groupData != null ? groupData.get("members") : null);
                    if (existingMembers != null) {
                        for (Map<String, Object> m : existingMembers) {
                            if (currentUser.getUid().equals(m.get("userId"))) {
                                setLoading(false);
                                subscribeToGroup(groupId);
                                showActiveGroupScreen(groupId, code, restaurantName, hostName);
                                return;
                            }
                        }
                    }

                    String myName = currentUser.getDisplayName() != null
                            ? currentUser.getDisplayName() : "Member";

                    Map<String, Object> newMember = new HashMap<>();
                    newMember.put("userId", currentUser.getUid());
                    newMember.put("name", myName);
                    newMember.put("isHost", false);
                    newMember.put("joinedAt", com.google.firebase.Timestamp.now());
                    newMember.put("subtotal", 0);
                    newMember.put("paymentStatus", "pending");
                    newMember.put("items", new ArrayList<>());

                    if (existingMembers == null) existingMembers = new ArrayList<>();
                    existingMembers.add(newMember);

                    groupRef.update("members", existingMembers)
                            .addOnSuccessListener(aVoid -> {
                                setLoading(false);
                                subscribeToGroup(groupId);
                                showActiveGroupScreen(groupId, code, restaurantName, hostName);
                            })
                            .addOnFailureListener(e -> {
                                setLoading(false);
                                Toast.makeText(this, "Failed to join group", Toast.LENGTH_SHORT).show();
                            });
                })
                .addOnFailureListener(e -> {
                    setLoading(false);
                    Toast.makeText(this, "Error searching for group", Toast.LENGTH_SHORT).show();
                });
    }

    private void showActiveGroupScreen(String groupId, String inviteCode, String restaurantName, String hostName) {
        if (homeLayout != null) homeLayout.setVisibility(View.GONE);
        if (joinLayout != null) joinLayout.setVisibility(View.GONE);
        if (activeLayout != null) activeLayout.setVisibility(View.VISIBLE);

        if (tvRestaurantName != null) tvRestaurantName.setText(restaurantName);
        if (tvInviteCode != null) tvInviteCode.setText(inviteCode);
        if (tvGroupName != null) tvGroupName.setText(hostName + "'s Group");

        // Show/hide lock button based on host
        if (btnLockOrder != null) {
            boolean isHost = currentUser.getUid().equals(
                    currentGroup != null ? currentGroup.getHostId() : currentUser.getUid());
            btnLockOrder.setVisibility(isHost ? View.VISIBLE : View.GONE);
        }
    }

    private void subscribeToGroup(String groupId) {
        if (groupListener != null) groupListener.remove();

        groupListener = db.collection("groupOrders")
                .document(groupId)
                .addSnapshotListener((snap, e) -> {
                    if (e != null || snap == null || !snap.exists()) return;

                    // Update member list
                    runOnUiThread(() -> updateGroupDisplay(snap));
                });
    }

    private void updateGroupDisplay(com.google.firebase.firestore.DocumentSnapshot snap) {
        String status = snap.getString("status");
        double total = snap.getDouble("totalAmount") != null ? snap.getDouble("totalAmount") : 0;

        if (tvStatus != null) tvStatus.setText("Status: " + (status != null ? status.toUpperCase() : "OPEN"));
        if (tvGroupTotal != null) tvGroupTotal.setText("Group Total: ₹" + (int) total);

        // Show/hide lock button
        boolean isHost = currentUser.getUid().equals(snap.getString("hostId"));
        boolean isOpen = "open".equals(status);
        if (btnLockOrder != null) {
            btnLockOrder.setVisibility(isHost && isOpen ? View.VISIBLE : View.GONE);
        }

        // Update member adapter
        List<Map<String, Object>> rawMembers =
                (List<Map<String, Object>>) snap.get("members");

        memberList.clear();
        if (rawMembers != null) {
            for (Map<String, Object> m : rawMembers) {
                GroupMember member = new GroupMember();
                member.setUserId((String) m.get("userId"));
                member.setName((String) m.get("name"));
                member.setHost(Boolean.TRUE.equals(m.get("isHost")));
                Object subtotal = m.get("subtotal");
                member.setSubtotal(subtotal instanceof Number ? ((Number) subtotal).doubleValue() : 0);
                member.setPaymentStatus((String) m.getOrDefault("paymentStatus", "pending"));
                memberList.add(member);
            }
        }
        memberAdapter.notifyDataSetChanged();
    }

    private void lockOrder() {
        if (currentGroup == null) return;

        db.collection("groupOrders")
                .whereEqualTo("hostId", currentUser.getUid())
                .whereEqualTo("status", "open")
                .get()
                .addOnSuccessListener(snap -> {
                    if (!snap.isEmpty()) {
                        snap.getDocuments().get(0).getReference()
                                .update("status", "locked")
                                .addOnSuccessListener(v ->
                                        Toast.makeText(this, "✅ Group order locked!", Toast.LENGTH_SHORT).show());
                    }
                });
    }

    private void shareInvite() {
        if (tvInviteCode == null) return;
        String code = tvInviteCode.getText().toString();
        String link = Constants.APP_BASE_URL + "/customer/group/" + code;

        Intent shareIntent = new Intent(Intent.ACTION_SEND);
        shareIntent.setType("text/plain");
        shareIntent.putExtra(Intent.EXTRA_TEXT,
                "🍔 Join my Hunger group order!\nCode: " + code + "\nLink: " + link);
        startActivity(Intent.createChooser(shareIntent, "Share Group Invite"));
    }

    private void copyInviteCode() {
        if (tvInviteCode == null) return;
        ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
        ClipData clip = ClipData.newPlainText("Hunger Group Code", tvInviteCode.getText().toString());
        clipboard.setPrimaryClip(clip);
        Toast.makeText(this, "Invite code copied!", Toast.LENGTH_SHORT).show();
    }

    private String generateInviteCode() {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        StringBuilder code = new StringBuilder();
        Random rand = new Random();
        for (int i = 0; i < 6; i++) {
            code.append(chars.charAt(rand.nextInt(chars.length())));
        }
        return code.toString();
    }

    private void setLoading(boolean loading) {
        if (progressBar != null) {
            progressBar.setVisibility(loading ? View.VISIBLE : View.GONE);
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (groupListener != null) groupListener.remove();
    }

    /** Launch intent helper */
    public static Intent createIntent(Context context) {
        return new Intent(context, GroupOrderActivity.class);
    }

    public static Intent createIntentForRestaurant(Context context, String restaurantId, String restaurantName) {
        Intent intent = new Intent(context, GroupOrderActivity.class);
        intent.putExtra("restaurantId", restaurantId);
        intent.putExtra("restaurantName", restaurantName);
        return intent;
    }
}
