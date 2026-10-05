package com.ssr.hunger.activities;

import android.content.Intent;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.core.content.ContextCompat;

import com.google.android.material.card.MaterialCardView;
import com.google.android.material.chip.Chip;
import com.google.android.material.chip.ChipGroup;
import com.google.firebase.Timestamp;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import com.google.firebase.firestore.Query;
import com.ssr.hunger.R;
import com.ssr.hunger.utils.Constants;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Support Activity - mirrors the web app's support center with real-time ticket tracking,
 * category selection, and Firestore-backed support ticket submissions.
 */
public class SupportActivity extends BaseActivity {

    private ChipGroup chipGroupCategory;
    private View tvMyTicketsHeader;
    private LinearLayout layoutMyTickets;
    private ListenerRegistration ticketsListener;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_support);

        chipGroupCategory = findViewById(R.id.chip_group_category);
        tvMyTicketsHeader = findViewById(R.id.tv_my_tickets_header);
        layoutMyTickets = findViewById(R.id.layout_my_tickets);

        findViewById(R.id.btn_back).setOnClickListener(v -> finish());
        findViewById(R.id.btn_submit).setOnClickListener(v -> submitTicket());

        // Direct Contact Channels
        View cardWhatsapp = findViewById(R.id.card_whatsapp);
        if (cardWhatsapp != null) {
            cardWhatsapp.setOnClickListener(v -> openWhatsAppSupport());
        }

        View cardCallHelpline = findViewById(R.id.card_call_helpline);
        if (cardCallHelpline != null) {
            cardCallHelpline.setOnClickListener(v -> openPhoneHelpline());
        }

        View cardEmailDesk = findViewById(R.id.card_email_desk);
        if (cardEmailDesk != null) {
            cardEmailDesk.setOnClickListener(v -> openEmailSupport());
        }

        setupRealtimeTicketListener();
    }

    private void setupRealtimeTicketListener() {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) return;

        // Query tickets where userId == user.uid without requiring composite index
        ticketsListener = FirebaseFirestore.getInstance()
                .collection(Constants.COLLECTION_SUPPORT_TICKETS)
                .whereEqualTo("userId", user.getUid())
                .limit(25)
                .addSnapshotListener((querySnapshot, e) -> {
                    if (e != null || querySnapshot == null) {
                        return;
                    }

                    renderMyTickets(querySnapshot.getDocuments());
                });
    }

    private void renderMyTickets(List<DocumentSnapshot> ticketDocs) {
        if (layoutMyTickets == null || tvMyTicketsHeader == null) return;

        layoutMyTickets.removeAllViews();

        if (ticketDocs.isEmpty()) {
            tvMyTicketsHeader.setVisibility(View.GONE);
            layoutMyTickets.setVisibility(View.GONE);
            return;
        }

        // Sort in memory by createdAt descending
        List<DocumentSnapshot> sortedDocs = new ArrayList<>(ticketDocs);
        Collections.sort(sortedDocs, (d1, d2) -> {
            Timestamp t1 = d1.getTimestamp("createdAt");
            Timestamp t2 = d2.getTimestamp("createdAt");
            long time1 = t1 != null ? t1.toDate().getTime() : 0;
            long time2 = t2 != null ? t2.toDate().getTime() : 0;
            return Long.compare(time2, time1);
        });

        tvMyTicketsHeader.setVisibility(View.VISIBLE);
        layoutMyTickets.setVisibility(View.VISIBLE);

        SimpleDateFormat sdf = new SimpleDateFormat("dd MMM, hh:mm a", Locale.getDefault());

        for (DocumentSnapshot doc : sortedDocs) {
            String subject = doc.getString("subject");
            String description = doc.getString("description");
            if (description == null) description = doc.getString("message");
            String status = doc.getString("status");
            if (status == null) status = "open";
            String category = doc.getString("category");
            if (category == null) category = "General";
            Timestamp createdAt = doc.getTimestamp("createdAt");

            MaterialCardView card = new MaterialCardView(this);
            LinearLayout.LayoutParams cardLp = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
            );
            cardLp.setMargins(0, 0, 0, 24);
            card.setLayoutParams(cardLp);
            card.setRadius(36f);
            card.setCardElevation(2f);
            card.setStrokeWidth(2);
            card.setStrokeColor(ContextCompat.getColor(this, R.color.card_border));
            card.setCardBackgroundColor(ContextCompat.getColor(this, R.color.surface));

            LinearLayout contentLayout = new LinearLayout(this);
            contentLayout.setOrientation(LinearLayout.VERTICAL);
            contentLayout.setPadding(32, 28, 32, 28);

            // Top Row: Category + Status Badge
            LinearLayout topRow = new LinearLayout(this);
            topRow.setOrientation(LinearLayout.HORIZONTAL);
            topRow.setGravity(Gravity.CENTER_VERTICAL);

            TextView tvCategory = new TextView(this);
            tvCategory.setText(category.toUpperCase());
            tvCategory.setTextSize(10f);
            tvCategory.setTypeface(Typeface.DEFAULT_BOLD);
            tvCategory.setTextColor(ContextCompat.getColor(this, R.color.text_hint));
            LinearLayout.LayoutParams catLp = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
            tvCategory.setLayoutParams(catLp);
            topRow.addView(tvCategory);

            TextView tvStatus = new TextView(this);
            tvStatus.setText(status.toUpperCase());
            tvStatus.setTextSize(10f);
            tvStatus.setTypeface(Typeface.DEFAULT_BOLD);
            tvStatus.setPadding(16, 6, 16, 6);

            if ("resolved".equalsIgnoreCase(status)) {
                tvStatus.setTextColor(Color.parseColor("#10B981"));
                tvStatus.setBackgroundResource(R.drawable.bg_status_delivered);
            } else if ("in-progress".equalsIgnoreCase(status)) {
                tvStatus.setTextColor(Color.parseColor("#3B82F6"));
                tvStatus.setBackgroundResource(R.drawable.bg_status_ontheway);
            } else {
                tvStatus.setTextColor(Color.parseColor("#F59E0B"));
                tvStatus.setBackgroundResource(R.drawable.bg_status_preparing);
            }
            topRow.addView(tvStatus);
            contentLayout.addView(topRow);

            // Subject
            TextView tvSubj = new TextView(this);
            tvSubj.setText(subject != null ? subject : "Support Ticket");
            tvSubj.setTextSize(14f);
            tvSubj.setTypeface(Typeface.DEFAULT_BOLD);
            tvSubj.setTextColor(ContextCompat.getColor(this, R.color.text_primary));
            tvSubj.setPadding(0, 12, 0, 4);
            contentLayout.addView(tvSubj);

            // Description
            if (!TextUtils.isEmpty(description)) {
                TextView tvDesc = new TextView(this);
                tvDesc.setText(description);
                tvDesc.setTextSize(12f);
                tvDesc.setMaxLines(2);
                tvDesc.setEllipsize(TextUtils.TruncateAt.END);
                tvDesc.setTextColor(ContextCompat.getColor(this, R.color.text_secondary));
                contentLayout.addView(tvDesc);
            }

            // Timestamp footer
            if (createdAt != null) {
                TextView tvDate = new TextView(this);
                tvDate.setText("Created " + sdf.format(createdAt.toDate()));
                tvDate.setTextSize(10f);
                tvDate.setTextColor(ContextCompat.getColor(this, R.color.text_hint));
                tvDate.setPadding(0, 12, 0, 0);
                contentLayout.addView(tvDate);
            }

            card.addView(contentLayout);
            layoutMyTickets.addView(card);
        }
    }

    private void submitTicket() {
        EditText etSubject = findViewById(R.id.et_subject);
        EditText etMessage = findViewById(R.id.et_message);

        String subject = etSubject.getText().toString().trim();
        String message = etMessage.getText().toString().trim();

        if (TextUtils.isEmpty(subject) || TextUtils.isEmpty(message)) {
            Toast.makeText(this, "Please fill in both subject and description", Toast.LENGTH_SHORT).show();
            return;
        }

        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) {
            Toast.makeText(this, "Please log in to submit a ticket", Toast.LENGTH_SHORT).show();
            return;
        }

        // Determine category from selected chip
        String category = "order";
        if (chipGroupCategory != null) {
            int checkedId = chipGroupCategory.getCheckedChipId();
            if (checkedId == R.id.chip_cat_refund) {
                category = "refund";
            } else if (checkedId == R.id.chip_cat_delivery) {
                category = "delivery";
            } else if (checkedId == R.id.chip_cat_food) {
                category = "food_quality";
            } else if (checkedId == R.id.chip_cat_other) {
                category = "other";
            }
        }

        logBreadcrumb("Submitting support ticket: " + subject + " [" + category + "]");

        Map<String, Object> ticket = new HashMap<>();
        ticket.put("userId", user.getUid());
        ticket.put("customerId", user.getUid());
        ticket.put("userType", "customer");
        ticket.put("userName", user.getDisplayName() != null ? user.getDisplayName() : "Customer");
        ticket.put("userEmail", user.getEmail() != null ? user.getEmail() : "");
        ticket.put("subject", subject);
        ticket.put("description", message);
        ticket.put("message", message);
        ticket.put("category", category);
        ticket.put("priority", "medium");
        ticket.put("status", "open");
        ticket.put("createdAt", Timestamp.now());
        ticket.put("updatedAt", Timestamp.now());

        List<Map<String, Object>> replies = new ArrayList<>();
        Map<String, Object> initialReply = new HashMap<>();
        initialReply.put("id", "reply-" + System.currentTimeMillis());
        initialReply.put("sender", "customer");
        initialReply.put("senderName", user.getDisplayName() != null ? user.getDisplayName() : "Customer");
        initialReply.put("text", message);
        initialReply.put("timestamp", new java.util.Date().toString());
        replies.add(initialReply);
        ticket.put("replies", replies);

        FirebaseFirestore.getInstance()
                .collection(Constants.COLLECTION_SUPPORT_TICKETS)
                .add(ticket)
                .addOnSuccessListener(ref -> {
                    // Firebase Analytics - support ticket created
                    analyticsHelper.logSupportTicketCreated(subject);
                    logBreadcrumb("Support ticket created: " + ref.getId());

                    Toast.makeText(this, "🎉 Support ticket submitted! Our team will respond shortly.", Toast.LENGTH_LONG).show();
                    etSubject.setText("");
                    etMessage.setText("");
                })
                .addOnFailureListener(e -> {
                    recordException("submitTicket_failed", e);
                    Toast.makeText(this, "Failed: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                });
    }

    private void openWhatsAppSupport() {
        try {
            logBreadcrumb("Opening WhatsApp Support (+91 6393752013)");
            String url = "https://wa.me/916393752013?text=" + Uri.encode("Hello Hunger Support, I need help with my order");
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            startActivity(intent);
        } catch (Exception e) {
            Toast.makeText(this, "Unable to open WhatsApp: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    private void openPhoneHelpline() {
        try {
            logBreadcrumb("Dialing Helpline (+91 6393752013)");
            Intent intent = new Intent(Intent.ACTION_DIAL, Uri.parse("tel:+916393752013"));
            startActivity(intent);
        } catch (Exception e) {
            Toast.makeText(this, "Unable to open phone dialer: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    private void openEmailSupport() {
        try {
            logBreadcrumb("Composing Email to hunger@gmail.com");
            Intent intent = new Intent(Intent.ACTION_SENDTO);
            intent.setData(Uri.parse("mailto:hunger@gmail.com"));
            intent.putExtra(Intent.EXTRA_SUBJECT, "Hunger Customer Support Inquiry");
            startActivity(Intent.createChooser(intent, "Send Email Support"));
        } catch (Exception e) {
            Toast.makeText(this, "Unable to open email client: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (ticketsListener != null) {
            ticketsListener.remove();
        }
    }

    @Override
    protected String getScreenName() {
        return "CustomerSupport";
    }
}
