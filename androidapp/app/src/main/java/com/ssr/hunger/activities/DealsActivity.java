package com.ssr.hunger.activities;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import com.ssr.hunger.R;
import com.ssr.hunger.utils.Constants;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import com.google.firebase.firestore.Query;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * DealsActivity - mirrors the web app's /customer/deals page.
 * Displays all active deals, promotions, and coupon codes.
 * Extends BaseActivity for Analytics, Crashlytics, and Performance monitoring.
 */
public class DealsActivity extends BaseActivity {

    private FirebaseFirestore db;
    private ListenerRegistration dealsListener;
    private LinearLayout dealsContainer;
    private TextView tvEmpty;

    // Static deals (always shown)
    private final String[][] STATIC_DEALS = {
            {"NEWUSER50", "50% OFF on First Order", "New user exclusive! Get flat 50% off up to ₹100.", "🎉"},
            {"FREEWEEKEND", "Free Delivery Weekend", "Free delivery Sat & Sun. No minimum!", "🛵"},
            {"FLAT100", "₹100 Off on ₹499+", "Flat ₹100 off on orders above ₹499.", "💸"},
            {"BIRYANI20", "20% Off — Biryani Bonanza", "20% off on all biryani orders today!", "🍲"},
            {"LATENIGHT15", "Late Night Special 15% Off", "15% off on orders placed 10PM–2AM.", "🌙"},
    };

    private List<String[]> allDeals = new ArrayList<>();
    private String activeFilter = "all";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_deals);

        db = FirebaseFirestore.getInstance();
        dealsContainer = findViewById(R.id.deals_container);
        tvEmpty = findViewById(R.id.tv_empty);

        if (findViewById(R.id.btn_back) != null)
            findViewById(R.id.btn_back).setOnClickListener(v -> finish());

        setupFilterChips();
        loadAllDeals();
        listenToDynamicDeals();

        logBreadcrumb("DealsActivity: Opened");
    }

    private void setupFilterChips() {
        setupChip(R.id.chip_all, "all");
        setupChip(R.id.chip_flat, "flat");
        setupChip(R.id.chip_delivery, "delivery");
        setupChip(R.id.chip_biryani, "biryani");
    }

    private void setupChip(int resId, String filterKey) {
        View chip = findViewById(resId);
        if (chip == null) return;
        chip.setOnClickListener(v -> {
            activeFilter = filterKey;
            highlightChips(resId);
            renderFilteredDeals();
        });
    }

    private void highlightChips(int selectedId) {
        int[] chipIds = {R.id.chip_all, R.id.chip_flat, R.id.chip_delivery, R.id.chip_biryani};
        for (int id : chipIds) {
            TextView tv = findViewById(id);
            if (tv != null) {
                boolean isSelected = (id == selectedId);
                tv.setAlpha(isSelected ? 1.0f : 0.7f);
                tv.setTextSize(isSelected ? 13 : 12);
            }
        }
    }

    private void loadAllDeals() {
        allDeals.clear();
        for (String[] deal : STATIC_DEALS) {
            allDeals.add(deal);
        }
        renderFilteredDeals();
    }

    private void renderFilteredDeals() {
        if (dealsContainer == null) return;
        dealsContainer.removeAllViews();

        int renderedCount = 0;
        for (String[] deal : allDeals) {
            String code = deal[0];
            String title = deal[1];
            String desc = deal[2];
            String emoji = deal[3];

            boolean match = "all".equals(activeFilter)
                    || ("flat".equals(activeFilter) && (code.contains("100") || title.toLowerCase().contains("flat") || title.toLowerCase().contains("off")))
                    || ("delivery".equals(activeFilter) && (code.toLowerCase().contains("delivery") || title.toLowerCase().contains("free delivery")))
                    || ("biryani".equals(activeFilter) && (code.toLowerCase().contains("biryani") || title.toLowerCase().contains("biryani")));

            if (match) {
                addDealCard(code, title, desc, emoji);
                renderedCount++;
            }
        }

        View cardEmpty = findViewById(R.id.card_deals_empty);
        if (cardEmpty != null) {
            cardEmpty.setVisibility(renderedCount == 0 ? View.VISIBLE : View.GONE);
        }
    }

    private void listenToDynamicDeals() {
        dealsListener = db.collection("promotions")
                .whereEqualTo("isActive", true)
                .limit(20)
                .addSnapshotListener((snap, error) -> {
                    if (error != null) { recordException("DealsActivity_listen", error); return; }
                    if (snap == null) return;
                    for (com.google.firebase.firestore.DocumentSnapshot doc : snap.getDocuments()) {
                        String code = doc.getString("code");
                        String title = doc.getString("title");
                        String desc = doc.getString("description");
                        String emoji = doc.getString("emoji");
                        if (code != null && title != null) {
                            String[] deal = new String[]{code, title, desc != null ? desc : "", emoji != null ? emoji : "🎫"};
                            boolean exists = false;
                            for (String[] d : allDeals) {
                                if (d[0].equalsIgnoreCase(code)) { exists = true; break; }
                            }
                            if (!exists) allDeals.add(deal);
                        }
                    }
                    renderFilteredDeals();
                });
    }

    private void addDealCard(String code, String title, String description, String emoji) {
        if (dealsContainer == null) return;
        View card = LayoutInflater.from(this).inflate(R.layout.item_deal_card, dealsContainer, false);
        if (card == null) return;

        TextView tvEmoji = card.findViewById(R.id.tv_deal_emoji);
        TextView tvTitle = card.findViewById(R.id.tv_deal_title);
        TextView tvDesc = card.findViewById(R.id.tv_deal_desc);
        TextView tvCode = card.findViewById(R.id.tv_deal_code);
        com.google.android.material.button.MaterialButton btnCopy = card.findViewById(R.id.btn_copy_code);

        if (tvEmoji != null) tvEmoji.setText(emoji);
        if (tvTitle != null) tvTitle.setText(title);
        if (tvDesc != null) tvDesc.setText(description);
        if (tvCode != null) tvCode.setText(code);

        if (btnCopy != null) {
            btnCopy.setOnClickListener(v -> {
                android.content.ClipboardManager clipboard = (android.content.ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
                android.content.ClipData clip = android.content.ClipData.newPlainText("Promo Code", code);
                clipboard.setPrimaryClip(clip);
                btnCopy.setText("COPIED! ✓");
                btnCopy.postDelayed(() -> btnCopy.setText("Copy Code"), 1800);
                Toast.makeText(this, "✅ Code \"" + code + "\" copied!", Toast.LENGTH_SHORT).show();
                android.os.Bundle b = new android.os.Bundle(); b.putString("promo_code", code); analyticsHelper.logEvent("deal_code_copied", b);
                logBreadcrumb("Deal code copied: " + code);
            });
        }

        if (tvEmpty != null) tvEmpty.setVisibility(View.GONE);
        dealsContainer.addView(card);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (dealsListener != null) dealsListener.remove();
    }

    @Override
    protected String getScreenName() { return "Deals"; }
}
