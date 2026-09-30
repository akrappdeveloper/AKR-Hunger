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
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.chip.Chip;
import com.google.android.material.chip.ChipGroup;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FirebaseFirestore;
import com.ssr.hunger.R;
import com.ssr.hunger.activities.ProductDetailActivity;
import com.ssr.hunger.adapters.MenuItemAdapter;
import com.ssr.hunger.dialogs.VoiceSearchDialog;
import com.ssr.hunger.models.CartItem;
import com.ssr.hunger.models.MenuItem;
import com.ssr.hunger.utils.CartManager;
import com.ssr.hunger.utils.Constants;

import java.util.ArrayList;
import java.util.List;

/**
 * Search Fragment - mirrors the web app's search page with
 * trending tags, popular cuisines, voice search, and full-text search across menu items.
 */
public class SearchFragment extends Fragment {

    private EditText etSearch;
    private ImageView btnClear;
    private View btnVoiceSearch;
    private View trendingSection, cuisinesSection, resultsSection;
    private ChipGroup chipGroupTrending;
    private RecyclerView rvResults;
    private TextView tvResultsCount;
    private MenuItemAdapter resultsAdapter;
    private FirebaseFirestore db;

    private VoiceSearchDialog voiceSearchDialog;

    private final String[] TRENDING_TAGS = {
            "Dum Biryani", "Woodfired Pizza", "Truffle Burger", "Butter Chicken",
            "Cold Brew", "Crispy Dimsum", "Hakka Noodles", "Sizzling Brownie"
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
        resultsSection = view.findViewById(R.id.results_section);
        chipGroupTrending = view.findViewById(R.id.chip_group_trending);
        rvResults = view.findViewById(R.id.rv_results);
        tvResultsCount = view.findViewById(R.id.tv_results_count);

        db = FirebaseFirestore.getInstance();

        setupTrendingTags();
        setupSearchResults();
        setupSearchInput();
        setupVoiceSearch();

        return view;
    }

    private void setupTrendingTags() {
        for (String tag : TRENDING_TAGS) {
            Chip chip = new Chip(requireContext());
            chip.setText(tag);
            chip.setCheckable(false);
            chip.setClickable(true);
            chip.setOnClickListener(v -> {
                etSearch.setText(tag);
                etSearch.setSelection(tag.length());
                performSearch(tag);
            });
            chipGroupTrending.addView(chip);
        }
    }

    private void setupSearchResults() {
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
                    Toast.makeText(getContext(), item.getName() + " added to cart", Toast.LENGTH_SHORT).show();
                }
        );

        int spanCount = getResources().getConfiguration().screenWidthDp >= 600 ? 3 : 2;
        rvResults.setLayoutManager(new GridLayoutManager(getContext(), spanCount));
        rvResults.setAdapter(resultsAdapter);
    }

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
                if (s.length() == 0) {
                    resetSearchSections();
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
        if (resultsSection != null) resultsSection.setVisibility(View.GONE);
    }

    private void performSearch(String term) {
        if (TextUtils.isEmpty(term)) return;

        if (trendingSection != null) trendingSection.setVisibility(View.GONE);
        if (cuisinesSection != null) cuisinesSection.setVisibility(View.GONE);
        if (resultsSection != null) resultsSection.setVisibility(View.VISIBLE);

        db.collection(Constants.COLLECTION_MENU_ITEMS).get()
                .addOnSuccessListener(querySnapshot -> {
                    if (!isAdded()) return;

                    List<MenuItem> results = new ArrayList<>();
                    String lowerTerm = term.toLowerCase();

                    for (DocumentSnapshot doc : querySnapshot.getDocuments()) {
                        MenuItem item = doc.toObject(MenuItem.class);
                        if (item != null) {
                            item.setId(doc.getId());
                            String name = item.getName() != null ? item.getName().toLowerCase() : "";
                            String desc = item.getDescription() != null ? item.getDescription().toLowerCase() : "";
                            String cat = item.getCategory() != null ? item.getCategory().toLowerCase() : "";

                            if (name.contains(lowerTerm) || desc.contains(lowerTerm) || cat.contains(lowerTerm)) {
                                results.add(item);
                            }
                        }
                    }

                    if (tvResultsCount != null) {
                        tvResultsCount.setText(results.size() + " results found");
                    }
                    if (resultsAdapter != null) {
                        resultsAdapter.updateData(results);
                    }
                });
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        if (voiceSearchDialog != null && voiceSearchDialog.isShowing()) {
            voiceSearchDialog.dismiss();
        }
    }
}
