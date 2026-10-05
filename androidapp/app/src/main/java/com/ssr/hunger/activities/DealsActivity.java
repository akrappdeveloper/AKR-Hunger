package com.ssr.hunger.activities;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.google.firebase.database.DataSnapshot;
import com.google.firebase.database.DatabaseError;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.ValueEventListener;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import com.google.android.material.button.MaterialButton;
import com.ssr.hunger.R;
import com.ssr.hunger.models.Deal;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * DealsActivity - Displays all active food deals, coupon codes, and festive offers.
 * Fully integrated with Firebase Realtime Database for live instant syncing.
 */
public class DealsActivity extends BaseActivity {

    private static final String RTDB_URL = "https://akr-hunger-default-rtdb.firebaseio.com";
    private DatabaseReference dealsRtdbRef;
    private ValueEventListener rtdbListener;
    private ListenerRegistration firestoreListener;

    private LinearLayout dealsContainer;
    private View cardEmpty;
    private TextView tvEmpty;
    private ProgressBar progressLoading;
    private SwipeRefreshLayout swipeRefresh;
    private EditText etSearch;
    private ImageView ivClearSearch;
    private TextView tvBannerInfo;

    // Curated fallback deals (shown if RTDB is empty)
    private final String[][] STATIC_DEALS = {
            {"WELCOME50", "50% OFF on First Order", "New user welcome feast! Get flat 50% off up to ₹120.", "🎉", "percentage", "50", "199", "all"},
            {"FREEDEL", "Free Delivery Special", "Zero delivery charges on all orders today. No minimum!", "🛵", "free_delivery", "0", "0", "delivery"},
            {"FLAT100", "Flat ₹100 Off on ₹499+", "Flat ₹100 discount on hearty family orders across top spots.", "💸", "flat", "100", "499", "flat"},
            {"BIRYANI25", "25% Off Biryani Bonanza", "25% off up to ₹150 on authentic dum biryanis and kebabs.", "🍲", "percentage", "25", "299", "biryani"},
            {"MIDNIGHT20", "Late Night Special 20% Off", "20% off on midnight cravings placed between 10PM & 3AM.", "🌙", "percentage", "20", "249", "latenight"},
            {"WEEKEND30", "Super Weekend Party 30% Off", "Weekend special treat! Save 30% on group feasts.", "🍕", "percentage", "30", "399", "all"}
    };

    // Stored deals mapped by code
    private final Map<String, Deal> dealsMap = new HashMap<>();
    private final List<Deal> displayList = new ArrayList<>();
    private String activeFilter = "all";
    private String searchQuery = "";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_deals);

        initViews();
        setupFilterChips();
        setupSearch();
        setupSwipeRefresh();

        // 1. Preload curated static deals first for zero perceived latency
        loadStaticDeals();

        // 2. Connect to Firebase Realtime Database for live dynamic deals
        connectFirebaseRealtimeDatabase();

        // 3. Fallback/Sync with Firestore promotions collection
        listenFirestorePromotions();

        logBreadcrumb("DealsActivity: Opened and connected to Firebase Realtime Database");
    }

    private void initViews() {
        dealsContainer = findViewById(R.id.deals_container);
        cardEmpty = findViewById(R.id.card_deals_empty);
        tvEmpty = findViewById(R.id.tv_empty);
        progressLoading = findViewById(R.id.progress_deals_loading);
        swipeRefresh = findViewById(R.id.swipe_refresh_deals);
        etSearch = findViewById(R.id.et_search_deals);
        ivClearSearch = findViewById(R.id.iv_clear_search);
        tvBannerInfo = findViewById(R.id.tv_deals_banner_info);

        View btnBack = findViewById(R.id.btn_back);
        if (btnBack != null) {
            btnBack.setOnClickListener(v -> finish());
        }

        View btnReset = findViewById(R.id.btn_reset_filters);
        if (btnReset != null) {
            btnReset.setOnClickListener(v -> {
                activeFilter = "all";
                searchQuery = "";
                if (etSearch != null) etSearch.setText("");
                highlightChip(R.id.chip_all);
                renderDeals();
            });
        }
    }

    private void setupSwipeRefresh() {
        if (swipeRefresh == null) return;
        swipeRefresh.setColorSchemeResources(R.color.primary, R.color.amber_dark);
        swipeRefresh.setOnRefreshListener(() -> {
            if (dealsRtdbRef != null) {
                dealsRtdbRef.addListenerForSingleValueEvent(new ValueEventListener() {
                    @Override
                    public void onDataChange(@NonNull DataSnapshot snapshot) {
                        parseRtdbSnapshot(snapshot);
                        swipeRefresh.setRefreshing(false);
                        Toast.makeText(DealsActivity.this, "Deals refreshed live! ✨", Toast.LENGTH_SHORT).show();
                    }

                    @Override
                    public void onCancelled(@NonNull DatabaseError error) {
                        swipeRefresh.setRefreshing(false);
                    }
                });
            } else {
                swipeRefresh.setRefreshing(false);
            }
        });
    }

    private void setupSearch() {
        if (etSearch == null) return;

        etSearch.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {}

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                searchQuery = s != null ? s.toString().trim().toLowerCase(Locale.getDefault()) : "";
                if (ivClearSearch != null) {
                    ivClearSearch.setVisibility(searchQuery.isEmpty() ? View.GONE : View.VISIBLE);
                }
                renderDeals();
            }

            @Override
            public void afterTextChanged(Editable s) {}
        });

        if (ivClearSearch != null) {
            ivClearSearch.setOnClickListener(v -> {
                etSearch.setText("");
            });
        }
    }

    private void setupFilterChips() {
        setupChip(R.id.chip_all, "all");
        setupChip(R.id.chip_percentage, "percentage");
        setupChip(R.id.chip_flat, "flat");
        setupChip(R.id.chip_delivery, "delivery");
        setupChip(R.id.chip_biryani, "biryani");
        setupChip(R.id.chip_latenight, "latenight");
    }

    private void setupChip(int resId, String filterKey) {
        View chip = findViewById(resId);
        if (chip == null) return;
        chip.setOnClickListener(v -> {
            activeFilter = filterKey;
            highlightChip(resId);
            renderDeals();
        });
    }

    private void highlightChip(int selectedId) {
        int[] chipIds = {
                R.id.chip_all,
                R.id.chip_percentage,
                R.id.chip_flat,
                R.id.chip_delivery,
                R.id.chip_biryani,
                R.id.chip_latenight
        };

        for (int id : chipIds) {
            TextView tv = findViewById(id);
            if (tv != null) {
                boolean isSelected = (id == selectedId);
                tv.setBackgroundResource(isSelected ? R.drawable.bg_chip_deal_active : R.drawable.bg_chip_deal_inactive);
                tv.setTextColor(getResources().getColor(isSelected ? R.color.text_primary : R.color.white, getTheme()));
                tv.setTextSize(isSelected ? 12.5f : 12f);
            }
        }
    }

    private void loadStaticDeals() {
        for (String[] d : STATIC_DEALS) {
            Deal deal = new Deal(d[0], d[1], d[2], d[3], d[4], Double.parseDouble(d[5]), Double.parseDouble(d[6]), d[7]);
            dealsMap.put(deal.getCode().toUpperCase(Locale.getDefault()), deal);
        }
        renderDeals();
    }

    /**
     * Connect to Firebase Realtime Database at /deals
     */
    private void connectFirebaseRealtimeDatabase() {
        try {
            if (progressLoading != null) progressLoading.setVisibility(View.VISIBLE);

            FirebaseDatabase rtdb = FirebaseDatabase.getInstance(RTDB_URL);
            dealsRtdbRef = rtdb.getReference("deals");

            rtdbListener = new ValueEventListener() {
                @Override
                public void onDataChange(@NonNull DataSnapshot snapshot) {
                    if (progressLoading != null) progressLoading.setVisibility(View.GONE);
                    parseRtdbSnapshot(snapshot);
                }

                @Override
                public void onCancelled(@NonNull DatabaseError error) {
                    if (progressLoading != null) progressLoading.setVisibility(View.GONE);
                    recordException("Deals_RTDB_Cancelled", error.toException());
                }
            };

            dealsRtdbRef.addValueEventListener(rtdbListener);
        } catch (Exception e) {
            if (progressLoading != null) progressLoading.setVisibility(View.GONE);
            recordException("Deals_RTDB_Connect_Error", e);
        }
    }

    /**
     * Fully synchronized Realtime Database parser.
     * When admin edits, deletes, or adds deals in admin panel, this immediately updates in real time.
     */
    private void parseRtdbSnapshot(DataSnapshot snapshot) {
        if (snapshot == null || !snapshot.exists() || !snapshot.hasChildren()) {
            if (dealsMap.isEmpty()) {
                loadStaticDeals();
            } else {
                renderDeals();
            }
            return;
        }

        Map<String, Deal> rtdbMap = new HashMap<>();

        for (DataSnapshot child : snapshot.getChildren()) {
            try {
                Deal deal = child.getValue(Deal.class);
                if (deal == null) {
                    deal = new Deal();
                }
                deal.setId(child.getKey());

                String code = child.child("code").getValue(String.class);
                String title = child.child("title").getValue(String.class);
                String desc = child.child("description").getValue(String.class);
                String emoji = child.child("emoji").getValue(String.class);
                String discountType = child.child("discountType").getValue(String.class);
                String category = child.child("category").getValue(String.class);
                Boolean isActive = child.child("isActive").getValue(Boolean.class);
                Double val = child.child("discountValue").getValue(Double.class);
                Double minO = child.child("minOrder").getValue(Double.class);
                Double maxD = child.child("maxDiscount").getValue(Double.class);

                if (code != null) deal.setCode(code);
                if (title != null) deal.setTitle(title);
                if (desc != null) deal.setDescription(desc);
                if (emoji != null) deal.setEmoji(emoji);
                if (discountType != null) deal.setDiscountType(discountType);
                if (category != null) deal.setCategory(category);
                if (isActive != null) deal.setActive(isActive);
                if (val != null) deal.setDiscountValue(val);
                if (minO != null) deal.setMinOrder(minO);
                if (maxD != null) deal.setMaxDiscount(maxD);

                if (deal.getCode() != null && !deal.getCode().isEmpty()) {
                    rtdbMap.put(deal.getCode().toUpperCase(Locale.getDefault()), deal);
                }
            } catch (Exception ex) {
                recordException("Deals_RTDB_Child_Parse", ex);
            }
        }

        if (!rtdbMap.isEmpty()) {
            dealsMap.clear();
            dealsMap.putAll(rtdbMap);
        }

        renderDeals();
    }

    /**
     * Fallback sync from Firestore promotions
     */
    private void listenFirestorePromotions() {
        try {
            FirebaseFirestore db = FirebaseFirestore.getInstance();
            firestoreListener = db.collection("promotions")
                    .whereEqualTo("isActive", true)
                    .limit(25)
                    .addSnapshotListener((snap, error) -> {
                        if (error != null || snap == null) return;

                        for (com.google.firebase.firestore.DocumentSnapshot doc : snap.getDocuments()) {
                            String code = doc.getString("code");
                            String title = doc.getString("title");
                            String desc = doc.getString("description");
                            String emoji = doc.getString("emoji");
                            String type = doc.getString("type");
                            Double val = doc.getDouble("value");
                            Double minOrder = doc.getDouble("minOrderAmount");

                            if (code != null && title != null) {
                                String upperCode = code.toUpperCase(Locale.getDefault());
                                if (!dealsMap.containsKey(upperCode)) {
                                    Deal d = new Deal();
                                    d.setId(doc.getId());
                                    d.setCode(upperCode);
                                    d.setTitle(title);
                                    d.setDescription(desc != null ? desc : "");
                                    d.setEmoji(emoji != null ? emoji : "🎫");
                                    d.setDiscountType(type != null ? type : "percentage");
                                    d.setDiscountValue(val != null ? val : 0);
                                    d.setMinOrder(minOrder != null ? minOrder : 0);
                                    d.setActive(true);
                                    dealsMap.put(upperCode, d);
                                }
                            }
                        }
                        renderDeals();
                    });
        } catch (Exception e) {
            recordException("Deals_Firestore_Error", e);
        }
    }

    /**
     * Filter & re-render all deal cards on screen
     */
    private void renderDeals() {
        if (dealsContainer == null) return;
        dealsContainer.removeAllViews();
        displayList.clear();

        for (Deal deal : dealsMap.values()) {
            if (!deal.isActive()) continue;

            // Search query matching
            if (!searchQuery.isEmpty()) {
                boolean matchCode = deal.getCode().toLowerCase(Locale.getDefault()).contains(searchQuery);
                boolean matchTitle = deal.getTitle().toLowerCase(Locale.getDefault()).contains(searchQuery);
                boolean matchDesc = deal.getDescription().toLowerCase(Locale.getDefault()).contains(searchQuery);
                boolean matchCategory = deal.getCategory().toLowerCase(Locale.getDefault()).contains(searchQuery);
                if (!matchCode && !matchTitle && !matchDesc && !matchCategory) {
                    continue;
                }
            }

            // Category filter matching
            if (!"all".equals(activeFilter)) {
                String dType = deal.getDiscountType().toLowerCase(Locale.getDefault());
                String dCat = deal.getCategory().toLowerCase(Locale.getDefault());
                String dTitle = deal.getTitle().toLowerCase(Locale.getDefault());
                String dCode = deal.getCode().toLowerCase(Locale.getDefault());

                if ("percentage".equals(activeFilter)) {
                    if (!"percentage".equals(dType) && !dTitle.contains("%") && !dCode.contains("%")) {
                        continue;
                    }
                } else if ("flat".equals(activeFilter)) {
                    if (!"flat".equals(dType) && !"fixed".equals(dType) && !dTitle.contains("flat") && !dTitle.contains("₹") && !dCode.contains("100")) {
                        continue;
                    }
                } else if ("delivery".equals(activeFilter)) {
                    if (!"free_delivery".equals(dType) && !dCat.contains("delivery") && !dTitle.contains("delivery") && !dCode.contains("del")) {
                        continue;
                    }
                } else if ("biryani".equals(activeFilter)) {
                    if (!dCat.contains("biryani") && !dTitle.contains("biryani") && !dCode.contains("biryani")) {
                        continue;
                    }
                } else if ("latenight".equals(activeFilter)) {
                    if (!dCat.contains("latenight") && !dTitle.contains("night") && !dCode.contains("midnight")) {
                        continue;
                    }
                }
            }

            displayList.add(deal);
        }

        // Update empty state
        if (cardEmpty != null) {
            cardEmpty.setVisibility(displayList.isEmpty() ? View.VISIBLE : View.GONE);
        }

        if (tvBannerInfo != null) {
            tvBannerInfo.setText(String.format(Locale.getDefault(),
                    "🔥 %d active deals synced live via Firebase Database. Apply at checkout!", displayList.size()));
        }

        // Render cards
        for (Deal deal : displayList) {
            addDealCard(deal);
        }
    }

    private void addDealCard(Deal deal) {
        View card = LayoutInflater.from(this).inflate(R.layout.item_deal_card, dealsContainer, false);
        if (card == null) return;

        TextView tvEmoji = card.findViewById(R.id.tv_deal_emoji);
        TextView tvTitle = card.findViewById(R.id.tv_deal_title);
        TextView tvBadge = card.findViewById(R.id.tv_deal_badge);
        TextView tvDesc = card.findViewById(R.id.tv_deal_desc);
        TextView tvMinOrder = card.findViewById(R.id.tv_deal_min_order);
        TextView tvCategory = card.findViewById(R.id.tv_deal_category);
        TextView tvCode = card.findViewById(R.id.tv_deal_code);
        MaterialButton btnCopy = card.findViewById(R.id.btn_copy_code);

        if (tvEmoji != null) tvEmoji.setText(deal.getEmoji());
        if (tvTitle != null) tvTitle.setText(deal.getTitle());
        if (tvBadge != null) tvBadge.setText(deal.getDiscountBadgeText());
        if (tvDesc != null) tvDesc.setText(deal.getDescription());
        if (tvCode != null) tvCode.setText(deal.getCode());

        if (tvMinOrder != null) {
            if (deal.getMinOrder() > 0) {
                tvMinOrder.setText(String.format(Locale.getDefault(), "Min order ₹%.0f", deal.getMinOrder()));
                tvMinOrder.setVisibility(View.VISIBLE);
            } else {
                tvMinOrder.setText("No min order");
                tvMinOrder.setVisibility(View.VISIBLE);
            }
        }

        if (tvCategory != null) {
            String cat = deal.getCategory();
            if (cat != null && !cat.isEmpty() && !"all".equalsIgnoreCase(cat)) {
                tvCategory.setText(cat.substring(0, 1).toUpperCase(Locale.getDefault()) + cat.substring(1));
                tvCategory.setVisibility(View.VISIBLE);
            } else {
                tvCategory.setVisibility(View.GONE);
            }
        }

        if (btnCopy != null) {
            final String code = deal.getCode();
            btnCopy.setOnClickListener(v -> {
                ClipboardManager clipboard = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
                ClipData clip = ClipData.newPlainText("Promo Code", code);
                clipboard.setPrimaryClip(clip);

                btnCopy.setText("COPIED! ✓");
                btnCopy.postDelayed(() -> btnCopy.setText("Copy Code"), 1800);

                Toast.makeText(this, "🎉 Coupon \"" + code + "\" copied! Paste during checkout.", Toast.LENGTH_SHORT).show();

                Bundle b = new Bundle();
                b.putString("promo_code", code);
                analyticsHelper.logEvent("deal_code_copied", b);
                logBreadcrumb("Deal code copied: " + code);
            });
        }

        dealsContainer.addView(card);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (dealsRtdbRef != null && rtdbListener != null) {
            dealsRtdbRef.removeEventListener(rtdbListener);
        }
        if (firestoreListener != null) {
            firestoreListener.remove();
        }
    }

    @Override
    protected String getScreenName() { return "Deals"; }
}
