package com.ssr.hunger.activities;

import android.os.Bundle;
import android.text.TextUtils;
import android.widget.EditText;
import android.widget.Toast;
import com.ssr.hunger.R;
import com.ssr.hunger.utils.Constants;
import com.google.firebase.Timestamp;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.FirebaseFirestore;
import java.util.HashMap;
import java.util.Map;

/**
 * Support Activity - mirrors the web app's support page with FAQ and ticket submission.
 * Extends BaseActivity for Realtime Analytics, Crashlytics breadcrumbs, and Performance.
 */
public class SupportActivity extends BaseActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_support);

        findViewById(R.id.btn_back).setOnClickListener(v -> finish());
        findViewById(R.id.btn_submit).setOnClickListener(v -> submitTicket());
    }

    private void submitTicket() {
        EditText etSubject = findViewById(R.id.et_subject);
        EditText etMessage = findViewById(R.id.et_message);

        String subject = etSubject.getText().toString().trim();
        String message = etMessage.getText().toString().trim();

        if (TextUtils.isEmpty(subject) || TextUtils.isEmpty(message)) {
            Toast.makeText(this, "Please fill in all fields", Toast.LENGTH_SHORT).show();
            return;
        }

        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) return;

        logBreadcrumb("Submitting support ticket: " + subject);

        Map<String, Object> ticket = new HashMap<>();
        ticket.put("customerId", user.getUid());
        ticket.put("subject", subject);
        ticket.put("message", message);
        ticket.put("status", "open");
        ticket.put("customerEmail", user.getEmail());
        ticket.put("createdAt", Timestamp.now());

        FirebaseFirestore.getInstance()
                .collection(Constants.COLLECTION_SUPPORT_TICKETS)
                .add(ticket)
                .addOnSuccessListener(ref -> {
                    // Firebase Analytics - support ticket created
                    analyticsHelper.logSupportTicketCreated(subject);
                    logBreadcrumb("Support ticket created: " + ref.getId());

                    Toast.makeText(this, "Support ticket submitted! 🎉", Toast.LENGTH_LONG).show();
                    etSubject.setText("");
                    etMessage.setText("");
                })
                .addOnFailureListener(e -> {
                    recordException("submitTicket_failed", e);
                    Toast.makeText(this, "Failed: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                });
    }

    @Override
    protected String getScreenName() {
        return "CustomerSupport";
    }
}
