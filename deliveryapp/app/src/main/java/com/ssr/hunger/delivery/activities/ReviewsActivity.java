package com.ssr.hunger.delivery.activities;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FirebaseFirestore;
import com.ssr.hunger.delivery.R;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class ReviewsActivity extends AppCompatActivity {

    private FirebaseAuth auth;
    private FirebaseFirestore db;

    private TextView tvAverage, tvCount, tvFiveStar, tvEmptyReviews;
    private RecyclerView rvReviews;
    private ReviewAdapter adapter;
    private final List<Map<String, Object>> reviewsList = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_reviews);

        auth = FirebaseAuth.getInstance();
        db = FirebaseFirestore.getInstance();

        Toolbar toolbar = findViewById(R.id.toolbar_reviews);
        setSupportActionBar(toolbar);
        if (getSupportActionBar() != null) getSupportActionBar().setDisplayHomeAsUpEnabled(true);
        toolbar.setNavigationOnClickListener(v -> finish());

        tvAverage = findViewById(R.id.tv_reviews_average);
        tvCount = findViewById(R.id.tv_reviews_count);
        tvFiveStar = findViewById(R.id.tv_reviews_five_star);
        tvEmptyReviews = findViewById(R.id.tv_empty_reviews);

        rvReviews = findViewById(R.id.rv_reviews_list);
        rvReviews.setLayoutManager(new LinearLayoutManager(this));
        adapter = new ReviewAdapter();
        rvReviews.setAdapter(adapter);

        loadReviews();
    }

    private void loadReviews() {
        if (auth.getCurrentUser() == null) return;
        String uid = auth.getCurrentUser().getUid();

        db.collection("reviews")
                .whereEqualTo("targetId", uid)
                .whereEqualTo("type", "delivery")
                .get()
                .addOnSuccessListener(snaps -> {
                    reviewsList.clear();
                    double totalRating = 0;
                    int fiveStarCount = 0;

                    for (DocumentSnapshot doc : snaps.getDocuments()) {
                        Map<String, Object> data = doc.getData();
                        if (data != null) {
                            reviewsList.add(data);
                            double r = data.get("rating") instanceof Number ? ((Number) data.get("rating")).doubleValue() : 5.0;
                            totalRating += r;
                            if (r >= 5.0) fiveStarCount++;
                        }
                    }

                    if (reviewsList.isEmpty()) {
                        tvAverage.setText("5.0");
                        tvCount.setText("Based on 0 ratings");
                        tvFiveStar.setText("100% 5-star rating");
                        tvEmptyReviews.setVisibility(View.VISIBLE);
                        rvReviews.setVisibility(View.GONE);
                    } else {
                        double avg = totalRating / reviewsList.size();
                        tvAverage.setText(String.format("%.1f", avg));
                        tvCount.setText("Based on " + reviewsList.size() + " ratings");
                        int pct = (fiveStarCount * 100) / reviewsList.size();
                        tvFiveStar.setText(pct + "% 5-star positive feedback");
                        tvEmptyReviews.setVisibility(View.GONE);
                        rvReviews.setVisibility(View.VISIBLE);
                        adapter.notifyDataSetChanged();
                    }
                });
    }

    private class ReviewAdapter extends RecyclerView.Adapter<ReviewAdapter.ViewHolder> {
        @NonNull
        @Override
        public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_driver_review, parent, false);
            return new ViewHolder(view);
        }

        @Override
        public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
            Map<String, Object> data = reviewsList.get(position);
            holder.tvCustomer.setText(data.containsKey("customerName") ? String.valueOf(data.get("customerName")) : "Hunger Customer");
            double r = data.get("rating") instanceof Number ? ((Number) data.get("rating")).doubleValue() : 5.0;
            holder.tvRating.setText(String.format("%.1f ⭐", r));
            holder.tvDate.setText("Order Review");
            holder.tvComment.setText(data.containsKey("comment") ? String.valueOf(data.get("comment")) : "Great and prompt delivery service!");
        }

        @Override
        public int getItemCount() {
            return reviewsList.size();
        }

        class ViewHolder extends RecyclerView.ViewHolder {
            TextView tvCustomer, tvRating, tvDate, tvComment;
            ViewHolder(View v) {
                super(v);
                tvCustomer = v.findViewById(R.id.tv_review_customer);
                tvRating = v.findViewById(R.id.tv_review_rating_stars);
                tvDate = v.findViewById(R.id.tv_review_date);
                tvComment = v.findViewById(R.id.tv_review_comment);
            }
        }
    }
}
