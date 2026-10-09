package com.ssr.hunger.delivery.activities;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.card.MaterialCardView;
import com.google.android.material.tabs.TabLayout;
import com.google.android.material.textfield.TextInputEditText;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FieldValue;
import com.google.firebase.firestore.FirebaseFirestore;
import com.ssr.hunger.delivery.R;
import com.ssr.hunger.delivery.utils.AnalyticsHelper;
import com.ssr.hunger.delivery.utils.Constants;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class SupportActivity extends AppCompatActivity {

    private FirebaseAuth auth;
    private FirebaseFirestore db;

    private TabLayout tabLayout;
    private View tabNewTicket, tabMyTickets, tabFaq;

    private TextInputEditText etCategory, etSubject, etDesc;
    private MaterialButton btnSubmit, btnHotline;

    private RecyclerView rvTickets;
    private TextView tvEmptyTickets;
    private TicketAdapter ticketAdapter;
    private final List<Map<String, Object>> ticketsList = new ArrayList<>();

    private LinearLayout llFaqContainer;

    private final String[][] FAQ_DATA = {
            {"How do I go online and start receiving orders?", "Go to Dashboard and toggle the 'Go Online' switch at the top. Make sure your KYC is approved before going online."},
            {"Why am I not receiving orders?", "Ensure: (1) KYC is verified, (2) You are marked Online, (3) Wallet balance is not heavily negative, (4) You are within a service pincode zone."},
            {"How do I withdraw my earnings?", "Go to Wallet → Withdraw Funds. Minimum withdrawal is ₹100. Make sure your bank details or UPI ID are entered."},
            {"What happens if I reject an order?", "Your acceptance rate drops slightly. Maintain above 80% acceptance for peak hour incentives and bonuses."},
            {"How is my rating calculated?", "Your rating is the average of all customer ratings received. Deliver quickly, keep food upright and be courteous to maintain 5 stars."},
            {"Food delivery cancelled midway?", "Use the 'Return Food to Restaurant' button on the active order screen. Verify the return OTP at the kitchen to complete return safely."}
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_support);

        auth = FirebaseAuth.getInstance();
        db = FirebaseFirestore.getInstance();

        Toolbar toolbar = findViewById(R.id.toolbar_support);
        setSupportActionBar(toolbar);
        if (getSupportActionBar() != null) getSupportActionBar().setDisplayHomeAsUpEnabled(true);
        toolbar.setNavigationOnClickListener(v -> finish());

        tabLayout = findViewById(R.id.tab_layout_support);
        tabNewTicket = findViewById(R.id.layout_tab_new_ticket);
        tabMyTickets = findViewById(R.id.layout_tab_my_tickets);
        tabFaq = findViewById(R.id.layout_tab_faq);

        etCategory = findViewById(R.id.et_ticket_category);
        etSubject = findViewById(R.id.et_ticket_subject);
        etDesc = findViewById(R.id.et_ticket_desc);
        btnSubmit = findViewById(R.id.btn_submit_ticket);
        btnHotline = findViewById(R.id.btn_call_support_hotline);

        rvTickets = findViewById(R.id.rv_support_tickets);
        tvEmptyTickets = findViewById(R.id.tv_empty_tickets);
        llFaqContainer = findViewById(R.id.ll_faq_container);

        rvTickets.setLayoutManager(new LinearLayoutManager(this));
        ticketAdapter = new TicketAdapter();
        rvTickets.setAdapter(ticketAdapter);

        setupTabs();
        setupFaqs();
        loadTickets();

        btnSubmit.setOnClickListener(v -> submitTicket());
        btnHotline.setOnClickListener(v -> {
            Intent callIntent = new Intent(Intent.ACTION_DIAL, Uri.parse("tel:18001234567"));
            startActivity(callIntent);
        });
    }

    private void setupTabs() {
        tabLayout.addOnTabSelectedListener(new TabLayout.OnTabSelectedListener() {
            @Override
            public void onTabSelected(TabLayout.Tab tab) {
                int pos = tab.getPosition();
                tabNewTicket.setVisibility(pos == 0 ? View.VISIBLE : View.GONE);
                tabMyTickets.setVisibility(pos == 1 ? View.VISIBLE : View.GONE);
                tabFaq.setVisibility(pos == 2 ? View.VISIBLE : View.GONE);
            }
            @Override public void onTabUnselected(TabLayout.Tab tab) {}
            @Override public void onTabReselected(TabLayout.Tab tab) {}
        });
    }

    private void setupFaqs() {
        for (String[] faq : FAQ_DATA) {
            MaterialCardView card = new MaterialCardView(this);
            card.setRadius(24f);
            card.setCardElevation(2f);
            card.setStrokeWidth(2);
            card.setStrokeColor(getResources().getColor(R.color.card_border));
            card.setCardBackgroundColor(getResources().getColor(R.color.surface));

            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
            lp.setMargins(0, 0, 0, 24);
            card.setLayoutParams(lp);

            LinearLayout ll = new LinearLayout(this);
            ll.setOrientation(LinearLayout.VERTICAL);
            ll.setPadding(36, 36, 36, 36);

            TextView q = new TextView(this);
            q.setText("Q. " + faq[0]);
            q.setTextSize(15f);
            q.setTypeface(null, android.graphics.Typeface.BOLD);
            q.setTextColor(getResources().getColor(R.color.text_primary));

            TextView a = new TextView(this);
            a.setText(faq[1]);
            a.setTextSize(13f);
            a.setPadding(0, 12, 0, 0);
            a.setTextColor(getResources().getColor(R.color.text_secondary));

            ll.addView(q);
            ll.addView(a);
            card.addView(ll);
            llFaqContainer.addView(card);
        }
    }

    private void submitTicket() {
        String cat = etCategory.getText() != null ? etCategory.getText().toString().trim() : "Order Issue";
        String subj = etSubject.getText() != null ? etSubject.getText().toString().trim() : "";
        String desc = etDesc.getText() != null ? etDesc.getText().toString().trim() : "";

        if (TextUtils.isEmpty(subj)) { etSubject.setError("Subject required"); return; }
        if (TextUtils.isEmpty(desc)) { etDesc.setError("Description required"); return; }

        if (auth.getCurrentUser() == null) return;
        String uid = auth.getCurrentUser().getUid();

        Map<String, Object> ticket = new HashMap<>();
        ticket.put("driverId", uid);
        ticket.put("userType", "delivery");
        ticket.put("category", cat);
        ticket.put("subject", subj);
        ticket.put("description", desc);
        ticket.put("status", "open");
        ticket.put("priority", "medium");
        ticket.put("createdAt", FieldValue.serverTimestamp());

        db.collection(Constants.COLLECTION_SUPPORT_TICKETS)
                .add(ticket)
                .addOnSuccessListener(ref -> {
                    AnalyticsHelper.getInstance(this).logSupportTicket(cat, "medium");
                    Toast.makeText(this, "✅ Support ticket submitted successfully!", Toast.LENGTH_SHORT).show();
                    etSubject.setText("");
                    etDesc.setText("");
                    tabLayout.getTabAt(1).select();
                })
                .addOnFailureListener(e -> Toast.makeText(this, "Failed: " + e.getMessage(), Toast.LENGTH_SHORT).show());
    }

    private void loadTickets() {
        if (auth.getCurrentUser() == null) return;
        String uid = auth.getCurrentUser().getUid();

        db.collection(Constants.COLLECTION_SUPPORT_TICKETS)
                .whereEqualTo("driverId", uid)
                .addSnapshotListener((snap, e) -> {
                    if (e != null || snap == null) return;

                    ticketsList.clear();
                    for (DocumentSnapshot doc : snap.getDocuments()) {
                        ticketsList.add(doc.getData());
                    }

                    if (ticketsList.isEmpty()) {
                        tvEmptyTickets.setVisibility(View.VISIBLE);
                        rvTickets.setVisibility(View.GONE);
                    } else {
                        tvEmptyTickets.setVisibility(View.GONE);
                        rvTickets.setVisibility(View.VISIBLE);
                        ticketAdapter.notifyDataSetChanged();
                    }
                });
    }

    private class TicketAdapter extends RecyclerView.Adapter<TicketAdapter.ViewHolder> {
        @NonNull
        @Override
        public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_support_ticket, parent, false);
            return new ViewHolder(view);
        }

        @Override
        public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
            Map<String, Object> data = ticketsList.get(position);
            holder.tvSubject.setText(String.valueOf(data.get("subject")));
            holder.tvDesc.setText(String.valueOf(data.get("description")));
            String cat = String.valueOf(data.get("category"));
            holder.tvCategoryDate.setText(cat + " • Active");

            String status = data.containsKey("status") ? String.valueOf(data.get("status")) : "open";
            holder.tvStatus.setText(status.toUpperCase());
            if ("resolved".equalsIgnoreCase(status)) {
                holder.tvStatus.setTextColor(getResources().getColor(R.color.veg_green));
                holder.tvStatus.setBackgroundTintList(android.content.res.ColorStateList.valueOf(getResources().getColor(R.color.veg_bg)));
            }
        }

        @Override
        public int getItemCount() {
            return ticketsList.size();
        }

        class ViewHolder extends RecyclerView.ViewHolder {
            TextView tvSubject, tvStatus, tvCategoryDate, tvDesc;
            ViewHolder(View v) {
                super(v);
                tvSubject = v.findViewById(R.id.tv_ticket_subject);
                tvStatus = v.findViewById(R.id.tv_ticket_status);
                tvCategoryDate = v.findViewById(R.id.tv_ticket_category_date);
                tvDesc = v.findViewById(R.id.tv_ticket_desc);
            }
        }
    }
}
