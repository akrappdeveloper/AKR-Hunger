package com.ssr.hunger.activities;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextUtils;
import android.text.TextWatcher;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.GridLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.chip.Chip;
import com.google.android.material.chip.ChipGroup;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.perf.metrics.Trace;
import com.ssr.hunger.R;
import com.ssr.hunger.adapters.MenuItemAdapter;
import com.ssr.hunger.dialogs.VoiceSearchDialog;
import com.ssr.hunger.models.CartItem;
import com.ssr.hunger.models.MenuItem;
import com.ssr.hunger.utils.CartManager;
import com.ssr.hunger.utils.Constants;
import com.ssr.hunger.utils.PerformanceHelper;

import java.util.ArrayList;
import java.util.List;

/**
 * Search Activity - standalone search screen launched from the home search bar.
 * Features full voice search with automatic transcription, decibel-reactive animations,
 * suggestions, and real-time Firestore query execution.
 */
public class SearchActivity extends BaseActivity {

    private EditText etSearch;
    private ImageView btnClear;
    private View btnVoiceSearch;
    private View cardVoiceBanner;
    private View layoutSuggestionsContainer;
    private View layoutEmptyResults;
    private ChipGroup chipGroupTrending;
    private RecyclerView rvResults;
    private MenuItemAdapter adapter;
    private FirebaseFirestore db;

    private VoiceSearchDialog voiceSearchDialog;

    private final String[] POPULAR_TRENDING_ITEMS = {
            "🍗 Chicken Biryani", "🍕 Cheese Pizza", "🍔 Truffle Burger",
            "🍛 Paneer Butter Masala", "🍜 Hakka Noodles", "🍨 Cold Dessert",
            "🥗 Healthy Bowl", "🥤 Cold Brew Coffee"
    };

    private final ActivityResultLauncher<String> audioPermissionLauncher =
            registerForActivityResult(new ActivityResultContracts.RequestPermission(), isGranted -> {
                if (isGranted) {
                    openVoiceSearchDialog();
                } else {
                    Toast.makeText(this, "Microphone permission is required for Voice Search", Toast.LENGTH_SHORT).show();
                }
            });

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_search);

        db = FirebaseFirestore.getInstance();
        etSearch = findViewById(R.id.et_search);
        btnClear = findViewById(R.id.btn_clear);
        btnVoiceSearch = findViewById(R.id.btn_voice_search);
        cardVoiceBanner = findViewById(R.id.card_voice_banner);
        layoutSuggestionsContainer = findViewById(R.id.layout_suggestions_container);
        layoutEmptyResults = findViewById(R.id.layout_empty_results);
        chipGroupTrending = findViewById(R.id.chip_group_search_trending);
        rvResults = findViewById(R.id.rv_results);

        findViewById(R.id.btn_back).setOnClickListener(v -> finish());

        setupRecyclerView();
        setupSearchInput();
        setupTrendingChips();
        setupVoiceSearchListeners();

        // Check if opened with explicit voice search intent
        if (getIntent() != null && getIntent().getBooleanExtra(Constants.EXTRA_START_VOICE_SEARCH, false)) {
            checkPermissionAndLaunchVoice();
        }
    }

    private void setupRecyclerView() {
        adapter = new MenuItemAdapter(new ArrayList<>(),
                item -> {
                    analyticsHelper.logSelectContent("search_result_item", item.getId(), item.getName());
                    Intent intent = new Intent(this, ProductDetailActivity.class);
                    intent.putExtra(Constants.EXTRA_PRODUCT_ID, item.getId());
                    startActivity(intent);
                },
                item -> {
                    CartItem cartItem = new CartItem(item.getId(), item.getRestaurantId(), item.getName(),
                            item.getPrice(), 1, item.getImage(),
                            item.getRestaurantName() != null ? item.getRestaurantName() : "");
                    CartManager.getInstance(this).addItem(cartItem);

                    analyticsHelper.logAddToCart(cartItem);
                    logBreadcrumb("Added to cart from search: " + item.getName());
                    Toast.makeText(this, item.getName() + " added to cart", Toast.LENGTH_SHORT).show();
                }
        );

        int spanCount = getResources().getConfiguration().screenWidthDp >= 600 ? 3 : 2;
        rvResults.setLayoutManager(new GridLayoutManager(this, spanCount));
        rvResults.setAdapter(adapter);
    }

    private void setupSearchInput() {
        etSearch.requestFocus();

        etSearch.setOnEditorActionListener((v, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_SEARCH) {
                String query = etSearch.getText().toString().trim();
                if (!TextUtils.isEmpty(query)) {
                    performSearch(query);
                }
                return true;
            }
            return false;
        });

        etSearch.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {
            }

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                if (s.length() > 0) {
                    btnClear.setVisibility(View.VISIBLE);
                } else {
                    btnClear.setVisibility(View.GONE);
                    showSuggestionsView();
                }
            }

            @Override
            public void afterTextChanged(Editable s) {
            }
        });

        btnClear.setOnClickListener(v -> {
            etSearch.setText("");
            showSuggestionsView();
        });
    }

    private void setupTrendingChips() {
        if (chipGroupTrending == null) return;
        chipGroupTrending.removeAllViews();

        for (String item : POPULAR_TRENDING_ITEMS) {
            Chip chip = new Chip(this);
            chip.setText(item);
            chip.setCheckable(false);
            chip.setClickable(true);
            chip.setChipBackgroundColorResource(R.color.surface_variant);
            chip.setTextColor(ContextCompat.getColor(this, R.color.text_primary));
            chip.setOnClickListener(v -> {
                // Strip emoji prefix for search cleanliness
                int spaceIndex = item.indexOf(' ');
                String cleanedQuery = spaceIndex != -1 ? item.substring(spaceIndex + 1).trim() : item;
                applyAndExecuteSearch(cleanedQuery);
            });
            chipGroupTrending.addView(chip);
        }
    }

    private void setupVoiceSearchListeners() {
        if (btnVoiceSearch != null) {
            btnVoiceSearch.setOnClickListener(v -> checkPermissionAndLaunchVoice());
        }

        if (cardVoiceBanner != null) {
            cardVoiceBanner.setOnClickListener(v -> checkPermissionAndLaunchVoice());
        }
    }

    private void checkPermissionAndLaunchVoice() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            openVoiceSearchDialog();
        } else {
            audioPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO);
        }
    }

    private void openVoiceSearchDialog() {
        if (isFinishing() || isDestroyed()) return;

        if (voiceSearchDialog != null && voiceSearchDialog.isShowing()) {
            voiceSearchDialog.dismiss();
        }

        voiceSearchDialog = new VoiceSearchDialog(this, recognizedQuery -> {
            if (!TextUtils.isEmpty(recognizedQuery)) {
                // Automatically write transcription into search box and execute search
                applyAndExecuteSearch(recognizedQuery);
            }
        });

        voiceSearchDialog.show();
    }

    /**
     * Writes query automatically into the search box and triggers search
     */
    private void applyAndExecuteSearch(String query) {
        etSearch.setText(query);
        etSearch.setSelection(query.length());
        performSearch(query);
    }

    private void showSuggestionsView() {
        if (layoutSuggestionsContainer != null) layoutSuggestionsContainer.setVisibility(View.VISIBLE);
        if (rvResults != null) rvResults.setVisibility(View.GONE);
        if (layoutEmptyResults != null) layoutEmptyResults.setVisibility(View.GONE);
    }

    private void performSearch(String query) {
        if (TextUtils.isEmpty(query)) {
            showSuggestionsView();
            return;
        }

        if (layoutSuggestionsContainer != null) layoutSuggestionsContainer.setVisibility(View.GONE);

        // Firebase Performance - Profile search latency
        Trace searchTrace = startTrace(PerformanceHelper.TRACE_SEARCH_EXECUTION);
        if (searchTrace != null) {
            performanceHelper.putAttribute(searchTrace, "search_term", query);
        }

        logBreadcrumb("Executing search query: " + query);

        db.collection(Constants.COLLECTION_MENU_ITEMS).get()
                .addOnSuccessListener(querySnapshot -> {
                    List<MenuItem> results = new ArrayList<>();
                    String lowerQuery = query.toLowerCase();

                    for (DocumentSnapshot doc : querySnapshot.getDocuments()) {
                        MenuItem item = MenuItem.fromSnapshot(doc);
                        if (item != null) {
                            String name = item.getName() != null ? item.getName().toLowerCase() : "";
                            String desc = item.getDescription() != null ? item.getDescription().toLowerCase() : "";
                            String cat = item.getCategory() != null ? item.getCategory().toLowerCase() : "";

                            if (name.contains(lowerQuery) || desc.contains(lowerQuery) || cat.contains(lowerQuery)) {
                                results.add(item);
                            }
                        }
                    }

                    if (searchTrace != null) {
                        performanceHelper.putMetric(searchTrace, "result_count", results.size());
                        stopTrace(searchTrace);
                    }

                    // Firebase Analytics - log search event with count
                    analyticsHelper.logSearch(query, results.size());
                    logBreadcrumb("Search query '" + query + "' returned " + results.size() + " items");

                    if (results.isEmpty()) {
                        if (rvResults != null) rvResults.setVisibility(View.GONE);
                        if (layoutEmptyResults != null) layoutEmptyResults.setVisibility(View.VISIBLE);
                    } else {
                        if (rvResults != null) rvResults.setVisibility(View.VISIBLE);
                        if (layoutEmptyResults != null) layoutEmptyResults.setVisibility(View.GONE);
                        adapter.updateData(results);
                    }
                })
                .addOnFailureListener(e -> {
                    stopTrace(searchTrace);
                    recordException("search_execution_failed", e);
                    Toast.makeText(this, "Failed to load dishes. Please check internet.", Toast.LENGTH_SHORT).show();
                });
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (voiceSearchDialog != null && voiceSearchDialog.isShowing()) {
            voiceSearchDialog.dismiss();
        }
    }

    @Override
    protected String getScreenName() {
        return "Search";
    }
}
