package com.ssr.hunger.fragments;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextUtils;
import android.text.TextWatcher;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.GridLayoutManager;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.chip.Chip;
import com.google.android.material.chip.ChipGroup;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FirebaseFirestore;
import com.ssr.hunger.R;
import com.ssr.hunger.activities.ProductDetailActivity;
import com.ssr.hunger.adapters.CategoryAdapter;
import com.ssr.hunger.adapters.MenuItemAdapter;
import com.ssr.hunger.dialogs.VoiceSearchDialog;
import com.ssr.hunger.models.CartItem;
import com.ssr.hunger.models.Category;
import com.ssr.hunger.models.MenuItem;
import com.ssr.hunger.utils.CartManager;
import com.ssr.hunger.utils.Constants;

import java.util.ArrayList;
import java.util.List;

/**
 * Search Fragment - mirrors the web app's search page with
 * trending tags, explore cuisines, explore all menu items, voice search,
 * and instant responsive search across menu items.
 */
public class SearchFragment extends Fragment {

    private EditText etSearch;
    private ImageView btnClear;
    private View btnVoiceSearch;
    private View trendingSection, cuisinesSection, allMenuSection, resultsSection;
    private View layoutSearchEmpty;
    private TextView tvEmptyMessage;
    private View btnClearSearchEmpty;
    private ChipGroup chipGroupTrending;
    private RecyclerView rvCuisines, rvExploreMenu, rvResults;
    private TextView tvResultsCount, tvAllMenuCount;

    private CategoryAdapter cuisineAdapter;
    private MenuItemAdapter exploreMenuAdapter;
    private MenuItemAdapter resultsAdapter;
    private FirebaseFirestore db;

    private final List<MenuItem> allMenuItems = new ArrayList<>();
    private VoiceSearchDialog voiceSearchDialog;

    private final String[] TRENDING_TAGS = {
            "🍗 Dum Biryani", "🍕 Cheese Pizza", "🍔 Truffle Burger", "🍛 Butter Chicken",
            "🥟 Crispy Dimsum", "🍜 Hakka Noodles", "🍫 Sizzling Brownie",
            "🌯 Paneer Roll", "🥞 Masala Dosa", "🥤 Cold Brew"
    };

    private final ActivityResultLauncher<String> audioPermissionLauncher =
            registerForActivityResult(new ActivityResultContracts.RequestPermission(), isGranted -> {
                if (isGranted) {
                    openVoiceSearch();
                } else {
                    if (isAdded()) {
                        Toast.makeText(requireContext(), "Microphone permission is required for voice search", Toast.LENGTH_SHORT).show();
                    }
                }
            });

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        View view = inflater.inflate(R.layout.fragment_search, container, false);

        etSearch = view.findViewById(R.id.et_search);
        btnClear = view.findViewById(R.id.btn_clear);
        btnVoiceSearch = view.findViewById(R.id.btn_voice_search);
        trendingSection = view.findViewById(R.id.trending_section);
        cuisinesSection = view.findViewById(R.id.cuisines_section);
        allMenuSection = view.findViewById(R.id.all_menu_section);
        resultsSection = view.findViewById(R.id.results_section);
        layoutSearchEmpty = view.findViewById(R.id.layout_search_empty);
        tvEmptyMessage = view.findViewById(R.id.tv_empty_message);
        btnClearSearchEmpty = view.findViewById(R.id.btn_clear_search_empty);
        chipGroupTrending = view.findViewById(R.id.chip_group_trending);
        rvCuisines = view.findViewById(R.id.rv_cuisines);
        rvExploreMenu = view.findViewById(R.id.rv_explore_menu);
        rvResults = view.findViewById(R.id.rv_results);
        tvResultsCount = view.findViewById(R.id.tv_results_count);
        tvAllMenuCount = view.findViewById(R.id.tv_all_menu_count);

        db = FirebaseFirestore.getInstance();

        setupTrendingTags();
        setupCuisines();
        setupExploreMenu();
        setupSearchResults();
        setupSearchInput();
        setupVoiceSearch();
        loadAllMenuItems();

        return view;
    }

    /**
     * Optimized Trending Searches with rich emoji tags and responsive click handlers
     */
    private void setupTrendingTags() {
        if (chipGroupTrending == null) return;
        chipGroupTrending.removeAllViews();

        for (String tag : TRENDING_TAGS) {
            Chip chip = new Chip(requireContext());
            chip.setText(tag);
            chip.setCheckable(false);
            chip.setClickable(true);
            chip.setChipBackgroundColorResource(R.color.surface_variant);
            chip.setTextColor(ContextCompat.getColor(requireContext(), R.color.text_primary));
            chip.setTextSize(13f);
            chip.setChipCornerRadius(24f);
            chip.setChipStrokeWidth(2f);
            chip.setChipStrokeColorResource(R.color.card_border);
            chip.setOnClickListener(v -> {
                int spaceIdx = tag.indexOf(' ');
                String cleanTag = spaceIdx != -1 ? tag.substring(spaceIdx + 1).trim() : tag;
                etSearch.setText(cleanTag);
                etSearch.setSelection(cleanTag.length());
                performSearch(cleanTag);
            });
            chipGroupTrending.addView(chip);
        }
    }

    /**
     * Setup Explore Cuisines category chips
     */
    private void setupCuisines() {
        if (rvCuisines == null) return;

        List<Category> cuisines = new ArrayList<>();
        cuisines.add(new Category("all", "All", "🍽️", R.color.primary));
        for (String[] cat : Constants.FOOD_CATEGORIES) {
            cuisines.add(new Category(cat[0], cat[1], cat[2], R.color.primary));
        }

        cuisineAdapter = new CategoryAdapter(cuisines, category -> {
            if ("all".equalsIgnoreCase(category.getId()) || "All".equalsIgnoreCase(category.getName())) {
                cuisineAdapter.setSelected("all");
                etSearch.setText("");
                resetSearchSections();
            } else {
                cuisineAdapter.setSelected(category.getId());
                etSearch.setText(category.getName());
                etSearch.setSelection(category.getName().length());
                performSearch(category.getName());
            }
        });

        rvCuisines.setLayoutManager(new LinearLayoutManager(getContext(), LinearLayoutManager.HORIZONTAL, false));
        rvCuisines.setAdapter(cuisineAdapter);
    }

    /**
     * Setup Explore All Menu adapter & grid layout
     */
    private void setupExploreMenu() {
        if (rvExploreMenu == null) return;

        exploreMenuAdapter = new MenuItemAdapter(new ArrayList<>(),
                item -> {
                    Intent intent = new Intent(getContext(), ProductDetailActivity.class);
                    intent.putExtra(Constants.EXTRA_PRODUCT_ID, item.getId());
                    startActivity(intent);
                },
                item -> {
                    CartManager.getInstance(requireContext()).addItem(
                            new CartItem(item.getId(), item.getRestaurantId(), item.getName(),
                                    item.getPrice(), 1, item.getImage(),
                                    item.getRestaurantName() != null ? item.getRestaurantName() : "")
                    );
                    Toast.makeText(getContext(), item.getName() + " added to cart 🛒", Toast.LENGTH_SHORT).show();
                }
        );

        int spanCount = getResources().getConfiguration().screenWidthDp >= 600 ? 3 : 2;
        rvExploreMenu.setLayoutManager(new GridLayoutManager(getContext(), spanCount));
        rvExploreMenu.setAdapter(exploreMenuAdapter);
    }

    /**
     * Setup Search Results adapter & grid layout
     */
    private void setupSearchResults() {
        if (rvResults == null) return;

        resultsAdapter = new MenuItemAdapter(new ArrayList<>(),
                item -> {
                    Intent intent = new Intent(getContext(), ProductDetailActivity.class);
                    intent.putExtra(Constants.EXTRA_PRODUCT_ID, item.getId());
                    startActivity(intent);
                },
                item -> {
                    CartManager.getInstance(requireContext()).addItem(
                            new CartItem(item.getId(), item.getRestaurantId(), item.getName(),
                                    item.getPrice(), 1, item.getImage(),
                                    item.getRestaurantName() != null ? item.getRestaurantName() : "")
                    );
                    Toast.makeText(getContext(), item.getName() + " added to cart 🛒", Toast.LENGTH_SHORT).show();
                }
        );

        int spanCount = getResources().getConfiguration().screenWidthDp >= 600 ? 3 : 2;
        rvResults.setLayoutManager(new GridLayoutManager(getContext(), spanCount));
        rvResults.setAdapter(resultsAdapter);
    }

    /**
     * Load all menu items from Firestore to populate Explore All Menu and power instant search
     */
    private void loadAllMenuItems() {
        db.collection(Constants.COLLECTION_MENU_ITEMS).get()
                .addOnSuccessListener(querySnapshot -> {
                    if (!isAdded()) return;

                    allMenuItems.clear();
                    for (DocumentSnapshot doc : querySnapshot.getDocuments()) {
                        MenuItem item = MenuItem.fromSnapshot(doc);
                        if (item != null) {
                            allMenuItems.add(item);
                        }
                    }

                    if (tvAllMenuCount != null) {
                        tvAllMenuCount.setText(allMenuItems.size() + " items");
                    }
                    if (exploreMenuAdapter != null) {
                        exploreMenuAdapter.updateData(new ArrayList<>(allMenuItems));
                    }
                })
                .addOnFailureListener(e -> {
                    if (tvAllMenuCount != null) {
                        tvAllMenuCount.setText("All Items");
                    }
                });
    }

    /**
     * Real-time live search with instant filtering and clear handling
     */
    private void setupSearchInput() {
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
                if (btnClear != null) {
                    btnClear.setVisibility(s.length() > 0 ? View.VISIBLE : View.GONE);
                }
                String query = s.toString().trim();
                if (query.isEmpty()) {
                    resetSearchSections();
                } else {
                    performSearch(query);
                }
            }

            @Override
            public void afterTextChanged(Editable s) {
            }
        });

        if (btnClear != null) {
            btnClear.setOnClickListener(v -> {
                etSearch.setText("");
                resetSearchSections();
            });
        }

        if (btnClearSearchEmpty != null) {
            btnClearSearchEmpty.setOnClickListener(v -> {
                etSearch.setText("");
                resetSearchSections();
            });
        }
    }

    private void setupVoiceSearch() {
        if (btnVoiceSearch != null) {
            btnVoiceSearch.setOnClickListener(v -> {
                if (ContextCompat.checkSelfPermission(requireContext(), Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                    openVoiceSearch();
                } else {
                    audioPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO);
                }
            });
        }
    }

    private void openVoiceSearch() {
        if (!isAdded() || getActivity() == null) return;

        if (voiceSearchDialog != null && voiceSearchDialog.isShowing()) {
            voiceSearchDialog.dismiss();
        }

        voiceSearchDialog = new VoiceSearchDialog(requireActivity(), recognizedQuery -> {
            if (!TextUtils.isEmpty(recognizedQuery)) {
                etSearch.setText(recognizedQuery);
                etSearch.setSelection(recognizedQuery.length());
                performSearch(recognizedQuery);
            }
        });

        voiceSearchDialog.show();
    }

    private void resetSearchSections() {
        if (trendingSection != null) trendingSection.setVisibility(View.VISIBLE);
        if (cuisinesSection != null) cuisinesSection.setVisibility(View.VISIBLE);
        if (allMenuSection != null) allMenuSection.setVisibility(View.VISIBLE);
        if (resultsSection != null) resultsSection.setVisibility(View.GONE);
        if (cuisineAdapter != null) cuisineAdapter.setSelected("all");
    }

    /**
     * Executes responsive live search across cached menu items or fetches fresh if cache is empty
     */
    private void performSearch(String term) {
        if (TextUtils.isEmpty(term)) {
            resetSearchSections();
            return;
        }

        if (trendingSection != null) trendingSection.setVisibility(View.GONE);
        if (cuisinesSection != null) cuisinesSection.setVisibility(View.GONE);
        if (allMenuSection != null) allMenuSection.setVisibility(View.GONE);
        if (resultsSection != null) resultsSection.setVisibility(View.VISIBLE);

        if (allMenuItems.isEmpty()) {
            db.collection(Constants.COLLECTION_MENU_ITEMS).get()
                    .addOnSuccessListener(querySnapshot -> {
                        if (!isAdded()) return;
                        allMenuItems.clear();
                        for (DocumentSnapshot doc : querySnapshot.getDocuments()) {
                            MenuItem item = MenuItem.fromSnapshot(doc);
                            if (item != null) allMenuItems.add(item);
                        }
                        filterAndDisplayResults(term);
                    });
        } else {
            filterAndDisplayResults(term);
        }
    }

    private void filterAndDisplayResults(String term) {
        String lowerTerm = term.toLowerCase().trim();
        List<MenuItem> matching = new ArrayList<>();

        for (MenuItem item : allMenuItems) {
            String name = item.getName() != null ? item.getName().toLowerCase() : "";
            String desc = item.getDescription() != null ? item.getDescription().toLowerCase() : "";
            String cat = item.getCategory() != null ? item.getCategory().toLowerCase() : "";
            String restName = item.getRestaurantName() != null ? item.getRestaurantName().toLowerCase() : "";

            if (name.contains(lowerTerm) || desc.contains(lowerTerm) || cat.contains(lowerTerm) || restName.contains(lowerTerm)) {
                matching.add(item);
            }
        }

        if (matching.isEmpty()) {
            if (tvResultsCount != null) tvResultsCount.setText("0 results found");
            if (rvResults != null) rvResults.setVisibility(View.GONE);
            if (layoutSearchEmpty != null) layoutSearchEmpty.setVisibility(View.VISIBLE);
            if (tvEmptyMessage != null) {
                tvEmptyMessage.setText("No dishes found matching \"" + term + "\". Try another search!");
            }
        } else {
            if (tvResultsCount != null) {
                tvResultsCount.setText(matching.size() + (matching.size() == 1 ? " result" : " results") + " found for \"" + term + "\"");
            }
            if (rvResults != null) rvResults.setVisibility(View.VISIBLE);
            if (layoutSearchEmpty != null) layoutSearchEmpty.setVisibility(View.GONE);
            if (resultsAdapter != null) {
                resultsAdapter.updateData(matching);
            }
        }
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        if (voiceSearchDialog != null && voiceSearchDialog.isShowing()) {
            voiceSearchDialog.dismiss();
        }
    }
}
