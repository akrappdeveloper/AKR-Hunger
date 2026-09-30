package com.ssr.hunger.activities;

import android.content.Intent;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.inputmethod.EditorInfo;
import android.widget.EditText;
import android.widget.Toast;
import androidx.recyclerview.widget.GridLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import com.ssr.hunger.R;
import com.ssr.hunger.adapters.MenuItemAdapter;
import com.ssr.hunger.models.CartItem;
import com.ssr.hunger.models.MenuItem;
import com.ssr.hunger.utils.CartManager;
import com.ssr.hunger.utils.Constants;
import com.ssr.hunger.utils.PerformanceHelper;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.perf.metrics.Trace;
import java.util.ArrayList;
import java.util.List;

/**
 * Search Activity - standalone search screen launched from the home search bar.
 * Extends BaseActivity for Realtime Analytics, Search Performance profiling, and Crashlytics.
 */
public class SearchActivity extends BaseActivity {

    private EditText etSearch;
    private RecyclerView rvResults;
    private MenuItemAdapter adapter;
    private FirebaseFirestore db;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_search);

        db = FirebaseFirestore.getInstance();
        etSearch = findViewById(R.id.et_search);
        rvResults = findViewById(R.id.rv_results);

        findViewById(R.id.btn_back).setOnClickListener(v -> finish());

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

        etSearch.requestFocus();
        etSearch.setOnEditorActionListener((v, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_SEARCH) {
                performSearch(etSearch.getText().toString().trim());
                return true;
            }
            return false;
        });
    }

    private void performSearch(String query) {
        if (TextUtils.isEmpty(query)) return;

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
                        MenuItem item = doc.toObject(MenuItem.class);
                        if (item != null) {
                            item.setId(doc.getId());
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

                    adapter.updateData(results);
                })
                .addOnFailureListener(e -> {
                    stopTrace(searchTrace);
                    recordException("search_execution_failed", e);
                });
    }

    @Override
    protected String getScreenName() {
        return "Search";
    }
}
