package com.ssr.hunger.activities;

import android.os.Bundle;
import android.os.Handler;
import android.view.View;
import android.view.WindowManager;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.VideoView;

import com.bumptech.glide.Glide;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.Query;
import com.ssr.hunger.R;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class StoriesActivity extends BaseActivity {

    private VideoView videoView;
    private ImageView imageView;
    private ProgressBar storyProgressBar;
    private TextView tvRestaurantName;
    private TextView tvStoryTitle;
    private ImageButton btnClose;
    private LinearLayout progressContainer;

    private List<Map<String, Object>> stories = new ArrayList<>();
    private int currentIndex = 0;
    private Handler autoAdvanceHandler = new Handler();
    private static final long STORY_DURATION = 5000; // 5 seconds per story

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_stories);

        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
            WindowManager.LayoutParams.FLAG_FULLSCREEN
        );

        videoView = findViewById(R.id.videoView);
        imageView = findViewById(R.id.imageView);
        storyProgressBar = findViewById(R.id.storyProgress);
        tvRestaurantName = findViewById(R.id.tvRestaurantName);
        tvStoryTitle = findViewById(R.id.tvStoryTitle);
        btnClose = findViewById(R.id.btnClose);
        progressContainer = findViewById(R.id.progressContainer);

        btnClose.setOnClickListener(v -> finish());

        // Tap zones
        findViewById(R.id.tapLeft).setOnClickListener(v -> showPrevious());
        findViewById(R.id.tapRight).setOnClickListener(v -> showNext());

        String restaurantId = getIntent().getStringExtra("restaurantId");
        loadStories(restaurantId);
    }

    private void loadStories(String restaurantId) {
        FirebaseFirestore db = FirebaseFirestore.getInstance();
        Query query;

        if (restaurantId != null) {
            query = db.collection("videos")
                .whereEqualTo("restaurantId", restaurantId)
                .whereEqualTo("isActive", true)
                .orderBy("createdAt", Query.Direction.DESCENDING)
                .limit(20);
        } else {
            query = db.collection("videos")
                .whereEqualTo("isActive", true)
                .orderBy("createdAt", Query.Direction.DESCENDING)
                .limit(20);
        }

        query.get().addOnSuccessListener(querySnapshot -> {
            stories.clear();
            for (com.google.firebase.firestore.DocumentSnapshot doc : querySnapshot.getDocuments()) {
                Map<String, Object> story = doc.getData();
                if (story != null) {
                    story.put("id", doc.getId());
                    stories.add(story);
                }
            }
            if (!stories.isEmpty()) {
                setupProgressBars();
                showStory(0);
            } else {
                showToast("No stories available");
                finish();
            }
        }).addOnFailureListener(e -> {
            showToast("Failed to load stories");
            finish();
        });
    }

    private void setupProgressBars() {
        progressContainer.removeAllViews();
        for (int i = 0; i < stories.size(); i++) {
            ProgressBar pb = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, 4);
            params.weight = 1;
            params.setMargins(2, 0, 2, 0);
            pb.setLayoutParams(params);
            pb.setMax(100);
            pb.setProgress(0);
            progressContainer.addView(pb);
        }
    }

    private void showStory(int index) {
        if (index < 0 || index >= stories.size()) {
            finish();
            return;
        }

        currentIndex = index;
        Map<String, Object> story = stories.get(index);

        // Update progress bars
        for (int i = 0; i < progressContainer.getChildCount(); i++) {
            ProgressBar pb = (ProgressBar) progressContainer.getChildAt(i);
            pb.setProgress(i < index ? 100 : 0);
        }

        String title = (String) story.get("title");
        String restaurantName = (String) story.get("restaurantName");
        String videoUrl = (String) story.get("videoUrl");
        String imageUrl = (String) story.get("thumbnailUrl");
        if (imageUrl == null) imageUrl = (String) story.get("imageUrl");

        tvStoryTitle.setText(title != null ? title : "");
        tvRestaurantName.setText(restaurantName != null ? restaurantName : "Restaurant");

        if (videoUrl != null && !videoUrl.isEmpty()) {
            imageView.setVisibility(View.GONE);
            videoView.setVisibility(View.VISIBLE);
            videoView.setVideoPath(videoUrl);
            videoView.start();
            videoView.setOnCompletionListener(mp -> showNext());
        } else if (imageUrl != null && !imageUrl.isEmpty()) {
            videoView.setVisibility(View.GONE);
            imageView.setVisibility(View.VISIBLE);
            Glide.with(this).load(imageUrl).into(imageView);
            scheduleAutoAdvance();
        } else {
            videoView.setVisibility(View.GONE);
            imageView.setVisibility(View.VISIBLE);
            imageView.setImageResource(android.R.color.darker_gray);
            scheduleAutoAdvance();
        }

        // Animate progress bar
        animateProgress(index);
    }

    private void animateProgress(int index) {
        if (index < progressContainer.getChildCount()) {
            ProgressBar pb = (ProgressBar) progressContainer.getChildAt(index);
            pb.setProgress(0);
            // Simple animation over story duration
            Handler h = new Handler();
            final int[] progress = {0};
            Runnable runnable = new Runnable() {
                @Override
                public void run() {
                    if (progress[0] <= 100 && currentIndex == index) {
                        pb.setProgress(progress[0]);
                        progress[0] += 2;
                        h.postDelayed(this, STORY_DURATION / 50);
                    }
                }
            };
            h.post(runnable);
        }
    }

    private void scheduleAutoAdvance() {
        autoAdvanceHandler.removeCallbacksAndMessages(null);
        autoAdvanceHandler.postDelayed(this::showNext, STORY_DURATION);
    }

    private void showNext() {
        autoAdvanceHandler.removeCallbacksAndMessages(null);
        showStory(currentIndex + 1);
    }

    private void showPrevious() {
        autoAdvanceHandler.removeCallbacksAndMessages(null);
        showStory(currentIndex - 1);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        autoAdvanceHandler.removeCallbacksAndMessages(null);
    }
}
