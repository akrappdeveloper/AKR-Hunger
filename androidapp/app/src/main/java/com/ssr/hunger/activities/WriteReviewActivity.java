package com.ssr.hunger.activities;

import android.os.Bundle;
import android.text.TextUtils;
import android.view.View;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.RatingBar;
import android.widget.TextView;
import android.widget.Toast;
import androidx.recyclerview.widget.GridLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import com.google.android.material.chip.Chip;
import com.google.android.material.chip.ChipGroup;
import com.ssr.hunger.R;
import com.ssr.hunger.utils.Constants;
import com.google.firebase.Timestamp;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.FieldValue;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * WriteReviewActivity - mirrors the web app's /customer/reviews page.
 * Allows customers to rate food & delivery, add tags, and submit reviews.
 * Awards +20 reward points on successful submission.
 * Extends BaseActivity for Analytics, Crashlytics, and Performance monitoring.
 */
public class WriteReviewActivity extends BaseActivity {

    public static final String EXTRA_ORDER_ID = "order_id";
    public static final String EXTRA_RESTAURANT_ID = "restaurant_id";
    public static final String EXTRA_RESTAURANT_NAME = "restaurant_name";

    private FirebaseFirestore db;
    private FirebaseAuth auth;

    private String orderId, restaurantId, restaurantName;
    private RatingBar ratingBarFood, ratingBarDelivery;
    private EditText etComment;
    private TextView tvRestaurantName, tvCharCount;
    private View btnSubmit;
    private ChipGroup tagsContainer;

    private final String[] QUICK_TAGS = {
            "😋 Delicious", "🔥 Hot & Fresh", "📦 Well Packaged",
            "⚡ Fast Delivery", "💰 Great Value", "🍽️ Large Portions",
            "✨ Exceeded Expectations", "👍 Will Order Again"
    };
    private final List<String> selectedTags = new ArrayList<>();
    private boolean isSubmitting = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_write_review);

        db = FirebaseFirestore.getInstance();
        auth = FirebaseAuth.getInstance();

        orderId = getIntent().getStringExtra(EXTRA_ORDER_ID);
        restaurantId = getIntent().getStringExtra(EXTRA_RESTAURANT_ID);
        restaurantName = getIntent().getStringExtra(EXTRA_RESTAURANT_NAME);

        initViews();
        buildTagsUI();

        logBreadcrumb("WriteReviewActivity: Order " + orderId + " at " + restaurantName);
    }

    private void initViews() {
        ratingBarFood = findViewById(R.id.rating_food);
        ratingBarDelivery = findViewById(R.id.rating_delivery);
        etComment = findViewById(R.id.et_review_comment);
        tvRestaurantName = findViewById(R.id.tv_review_restaurant);
        tvCharCount = findViewById(R.id.tv_char_count);
        btnSubmit = findViewById(R.id.btn_submit_review);
        tagsContainer = findViewById(R.id.tags_container);
        TextView tvFoodHint = findViewById(R.id.tv_food_rating_hint);
        TextView tvDeliveryHint = findViewById(R.id.tv_delivery_rating_hint);

        if (tvRestaurantName != null && restaurantName != null)
            tvRestaurantName.setText(restaurantName);

        if (ratingBarFood != null && tvFoodHint != null) {
            ratingBarFood.setOnRatingBarChangeListener((ratingBar, rating, fromUser) -> {
                int r = Math.round(rating);
                switch (r) {
                    case 5: tvFoodHint.setText("⭐⭐⭐⭐⭐ Outstanding! Truly loved it! 😍"); break;
                    case 4: tvFoodHint.setText("⭐⭐⭐⭐ Delicious & very good! 😊"); break;
                    case 3: tvFoodHint.setText("⭐⭐⭐ Good, met expectations 🙂"); break;
                    case 2: tvFoodHint.setText("⭐⭐ Below average, needs improvement 😕"); break;
                    case 1: tvFoodHint.setText("⭐ Disappointing experience 😞"); break;
                    default: tvFoodHint.setText("Tap stars to rate taste, freshness & temperature"); break;
                }
            });
        }

        if (ratingBarDelivery != null && tvDeliveryHint != null) {
            ratingBarDelivery.setOnRatingBarChangeListener((ratingBar, rating, fromUser) -> {
                int r = Math.round(rating);
                switch (r) {
                    case 5: tvDeliveryHint.setText("🚀 Lightning fast & neatly packed! 🛵"); break;
                    case 4: tvDeliveryHint.setText("👍 On time & good condition"); break;
                    case 3: tvDeliveryHint.setText("⏱️ Average delivery speed"); break;
                    case 2: tvDeliveryHint.setText("⚠️ Took longer than expected"); break;
                    case 1: tvDeliveryHint.setText("❌ Very late or poor handling"); break;
                    default: tvDeliveryHint.setText("Speed of delivery and condition of packaging"); break;
                }
            });
        }

        if (etComment != null && tvCharCount != null) {
            etComment.addTextChangedListener(new android.text.TextWatcher() {
                @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
                @Override public void onTextChanged(CharSequence s, int start, int before, int count) {
                    tvCharCount.setText(s.length() + "/500 characters" + (s.length() < 10 ? " (min 10)" : ""));
                }
                @Override public void afterTextChanged(android.text.Editable s) {}
            });
        }

        if (btnSubmit != null) btnSubmit.setOnClickListener(v -> submitReview());
        if (findViewById(R.id.btn_back) != null) findViewById(R.id.btn_back).setOnClickListener(v -> finish());
    }

    private void buildTagsUI() {
        if (tagsContainer == null) return;
        tagsContainer.removeAllViews();

        for (String tag : QUICK_TAGS) {
            Chip chip = new Chip(this);
            chip.setText(tag);
            chip.setCheckable(true);
            chip.setCheckedIconVisible(true);
            chip.setChipCornerRadius(getResources().getDisplayMetrics().density * 18);
            chip.setOnCheckedChangeListener((v, checked) -> {
                if (checked) {
                    if (!selectedTags.contains(tag)) selectedTags.add(tag);
                } else {
                    selectedTags.remove(tag);
                }
            });
            tagsContainer.addView(chip);
        }
    }

    private void submitReview() {
        if (isSubmitting) return;

        float foodRating = ratingBarFood != null ? ratingBarFood.getRating() : 0;
        float deliveryRating = ratingBarDelivery != null ? ratingBarDelivery.getRating() : 0;
        String comment = etComment != null ? etComment.getText().toString().trim() : "";

        if (foodRating == 0) { Toast.makeText(this, "Please rate the food ⭐", Toast.LENGTH_SHORT).show(); return; }
        if (comment.length() < 10) { Toast.makeText(this, "Please write at least 10 characters", Toast.LENGTH_SHORT).show(); return; }

        String uid = auth.getCurrentUser() != null ? auth.getCurrentUser().getUid() : null;
        if (uid == null) { Toast.makeText(this, "Please log in", Toast.LENGTH_SHORT).show(); return; }

        isSubmitting = true;
        if (btnSubmit != null) btnSubmit.setEnabled(false);

        Map<String, Object> review = new HashMap<>();
        review.put("customerId", uid);
        review.put("orderId", orderId);
        review.put("restaurantId", restaurantId);
        review.put("restaurantName", restaurantName);
        review.put("rating", (double) foodRating);
        review.put("deliveryRating", (double) deliveryRating);
        review.put("comment", comment);
        review.put("tags", selectedTags);
        review.put("createdAt", Timestamp.now());

        db.collection("reviews").add(review)
                .addOnSuccessListener(ref -> {
                    // Award +20 reward points
                    db.collection(Constants.COLLECTION_USERS).document(uid)
                            .update("rewardPoints", FieldValue.increment(20));

                    // Log point activity
                    Map<String, Object> activity = new HashMap<>();
                    activity.put("type", "earned");
                    activity.put("points", 20);
                    activity.put("description", "Review for " + restaurantName);
                    activity.put("createdAt", Timestamp.now());
                    db.collection(Constants.COLLECTION_USERS).document(uid)
                            .collection("pointActivities").add(activity);

                    // Analytics
                    android.os.Bundle bReview = new android.os.Bundle(); bReview.putString("restaurant_id", restaurantId); bReview.putFloat("food_rating", foodRating); bReview.putInt("tag_count", selectedTags.size()); analyticsHelper.logEvent("review_submitted", bReview);
                    logBreadcrumb("Review submitted for order " + orderId);

                    Toast.makeText(this, "🎉 Review submitted! +20 reward points earned!", Toast.LENGTH_LONG).show();
                    finish();
                })
                .addOnFailureListener(e -> {
                    recordException("WriteReview_submit_fail", e);
                    Toast.makeText(this, "Failed to submit review. Please try again.", Toast.LENGTH_SHORT).show();
                    isSubmitting = false;
                    if (btnSubmit != null) btnSubmit.setEnabled(true);
                });
    }

    @Override
    protected String getScreenName() { return "WriteReview"; }
}
