package com.ssr.hunger.fragments;

import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import com.ssr.hunger.R;
import com.ssr.hunger.activities.ProductDetailActivity;
import com.ssr.hunger.adapters.MenuItemAdapter;
import com.ssr.hunger.models.CartItem;
import com.ssr.hunger.models.MenuItem;
import com.ssr.hunger.utils.CartManager;
import com.ssr.hunger.utils.Constants;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FirebaseFirestore;
import java.util.ArrayList;
import java.util.List;

/**
 * Favorites Fragment - displays saved favorite menu items and restaurants.
 * Reads from customer's favorites array in Firestore.
 */
public class FavoritesFragment extends Fragment {

    private RecyclerView rvFavorites;
    private View emptyFavorites;
    private MenuItemAdapter adapter;
    private FirebaseFirestore db;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        View view = inflater.inflate(R.layout.fragment_favorites, container, false);

        rvFavorites = view.findViewById(R.id.rv_favorites);
        emptyFavorites = view.findViewById(R.id.empty_favorites);
        db = FirebaseFirestore.getInstance();

        adapter = new MenuItemAdapter(new ArrayList<>(),
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
                    android.widget.Toast.makeText(getContext(), item.getName() + " added to cart", android.widget.Toast.LENGTH_SHORT).show();
                }
        );

        rvFavorites.setLayoutManager(new LinearLayoutManager(getContext()));
        rvFavorites.setAdapter(adapter);

        loadFavorites();

        return view;
    }

    private void loadFavorites() {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) return;

        db.collection(Constants.COLLECTION_CUSTOMERS).document(user.getUid())
                .get()
                .addOnSuccessListener(doc -> {
                    if (!doc.exists()) return;

                    List<String> favoriteIds = (List<String>) doc.get("favorites");
                    if (favoriteIds == null || favoriteIds.isEmpty()) {
                        showEmpty();
                        return;
                    }

                    // Fetch each favorite menu item
                    List<MenuItem> favorites = new ArrayList<>();
                    final int[] remaining = {favoriteIds.size()};

                    for (String itemId : favoriteIds) {
                        db.collection(Constants.COLLECTION_MENU_ITEMS).document(itemId)
                                .get()
                                .addOnSuccessListener(itemDoc -> {
                                    if (itemDoc.exists()) {
                                        MenuItem item = itemDoc.toObject(MenuItem.class);
                                        if (item != null) {
                                            item.setId(itemDoc.getId());
                                            favorites.add(item);
                                        }
                                    }
                                    remaining[0]--;
                                    if (remaining[0] <= 0) {
                                        if (favorites.isEmpty()) {
                                            showEmpty();
                                        } else {
                                            rvFavorites.setVisibility(View.VISIBLE);
                                            emptyFavorites.setVisibility(View.GONE);
                                            adapter.updateData(favorites);
                                        }
                                    }
                                })
                                .addOnFailureListener(e -> {
                                    remaining[0]--;
                                    if (remaining[0] <= 0 && favorites.isEmpty()) {
                                        showEmpty();
                                    }
                                });
                    }
                });
    }

    private void showEmpty() {
        emptyFavorites.setVisibility(View.VISIBLE);
        rvFavorites.setVisibility(View.GONE);
    }
}
