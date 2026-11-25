package com.ssr.hunger.activities;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.VideoView;

import com.bumptech.glide.Glide;
import com.google.android.material.button.MaterialButton;
import com.google.firebase.Timestamp;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FirebaseFirestore;
import com.ssr.hunger.R;
import com.ssr.hunger.utils.Constants;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Full-screen Stories & Menu Dish Videos viewer.
 * Automatically loads both active restaurant stories/reels and menu item showcase videos,
 * fitting 9:16, 16:9, and 1:1 videos proportionately in fullscreen without cropping.
 */
public class StoriesActivity extends BaseActivity {

    private FrameLayout storyRoot;
    private VideoView videoView;
    private WebView webView;
    private ImageView imageView;
    private ProgressBar bufferProgress;
    private TextView tvRestaurantName;
    private TextView tvStoryTag;
    private TextView tvStoryTitle;
    private TextView tvStoryDescription;
    private ImageButton btnClose;
    private ImageButton btnFullscreenToggle;
    private MaterialButton btnOrderDish;
    private MaterialButton btnViewKitchen;
    private LinearLayout progressContainer;

    private final List<Map<String, Object>> stories = new ArrayList<>();
    private int currentIndex = 0;
    private long activeDurationMs = 6000;
    private boolean isPaused = false;
    private boolean isImmersive = true;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private Runnable progressTickRunnable;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_stories);

        storyRoot = findViewById(R.id.storyRoot);
        videoView = findViewById(R.id.videoView);
        webView = findViewById(R.id.webView);
        imageView = findViewById(R.id.imageView);
        bufferProgress = findViewById(R.id.storyBufferProgress);
        tvRestaurantName = findViewById(R.id.tvRestaurantName);
        tvStoryTag = findViewById(R.id.tvStoryTag);
        tvStoryTitle = findViewById(R.id.tvStoryTitle);
        tvStoryDescription = findViewById(R.id.tvStoryDescription);
        btnClose = findViewById(R.id.btnClose);
        btnFullscreenToggle = findViewById(R.id.btnFullscreenToggle);
        btnOrderDish = findViewById(R.id.btnOrderDish);
        btnViewKitchen = findViewById(R.id.btnViewKitchen);
        progressContainer = findViewById(R.id.progressContainer);

        applyFullscreenMode(true);

        btnClose.setOnClickListener(v -> finish());
        btnFullscreenToggle.setOnClickListener(v -> applyFullscreenMode(!isImmersive));

        // Tap zones
        findViewById(R.id.tapLeft).setOnClickListener(v -> showPrevious());
        findViewById(R.id.tapRight).setOnClickListener(v -> showNext());
        findViewById(R.id.tapCenter).setOnClickListener(v -> togglePlayPause());

        String restaurantId = getIntent().getStringExtra("restaurantId");
        loadAllVideos(restaurantId);
    }

    private void applyFullscreenMode(boolean immersive) {
        this.isImmersive = immersive;
        View decor = getWindow().getDecorView();
        if (immersive) {
            getWindow().setFlags(
                    WindowManager.LayoutParams.FLAG_FULLSCREEN,
                    WindowManager.LayoutParams.FLAG_FULLSCREEN
            );
            decor.setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            );
            btnFullscreenToggle.setImageResource(R.drawable.ic_fullscreen_exit);
        } else {
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
            decor.setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
            btnFullscreenToggle.setImageResource(R.drawable.ic_fullscreen);
        }
    }

    private long extractCreatedSeconds(Map<String, Object> map) {
        Object ts = map.get("createdAt");
        if (ts == null) ts = map.get("updatedAt");
        if (ts instanceof Timestamp) {
            return ((Timestamp) ts).getSeconds();
        }
        if (ts instanceof Number) {
            return ((Number) ts).longValue();
        }
        return 0L;
    }

    private void loadAllVideos(String filterRestaurantId) {
        FirebaseFirestore db = FirebaseFirestore.getInstance();
        bufferProgress.setVisibility(View.VISIBLE);

        // Fetch restaurants + active videos + menuItems without composite index dependencies
        db.collection(Constants.COLLECTION_RESTAURANTS).get().addOnCompleteListener(restTask -> {
            final Map<String, Map<String, String>> restLookup = new HashMap<>();
            if (restTask.isSuccessful() && restTask.getResult() != null) {
                for (DocumentSnapshot rd : restTask.getResult().getDocuments()) {
                    Map<String, String> info = new HashMap<>();
                    String rName = rd.getString("name");
                    if (rName == null || rName.isEmpty()) rName = rd.getString("restaurantName");
                    info.put("name", rName != null ? rName : "Restaurant Partner");
                    restLookup.put(rd.getId(), info);
                }
            }

            db.collection("videos").whereEqualTo("isActive", true).limit(60).get().addOnCompleteListener(vidTask -> {
                db.collection(Constants.COLLECTION_MENU_ITEMS).limit(300).get().addOnCompleteListener(menuTask -> {
                    stories.clear();
                    Set<String> seenVideoUrls = new HashSet<>();

                    if (vidTask.isSuccessful() && vidTask.getResult() != null) {
                        for (DocumentSnapshot doc : vidTask.getResult().getDocuments()) {
                            Map<String, Object> data = doc.getData();
                            if (data == null) continue;
                            String rId = asString(data.get("restaurantId"));
                            if (rId == null || rId.isEmpty()) continue;
                            if (filterRestaurantId != null && !filterRestaurantId.isEmpty() && !filterRestaurantId.equals(rId)) {
                                continue;
                            }
                            data.put("id", doc.getId());
                            if (data.get("restaurantName") == null && restLookup.containsKey(rId)) {
                                data.put("restaurantName", restLookup.get(rId).get("name"));
                            }
                            String vUrl = asString(data.get("videoUrl"));
                            if (vUrl != null && !vUrl.isEmpty()) {
                                seenVideoUrls.add(rId + "::" + vUrl.trim());
                            }
                            stories.add(data);
                        }
                    }

                    if (menuTask.isSuccessful() && menuTask.getResult() != null) {
                        for (DocumentSnapshot md : menuTask.getResult().getDocuments()) {
                            Map<String, Object> itemData = md.getData();
                            if (itemData == null) continue;
                            String rId = asString(itemData.get("restaurantId"));
                            if (rId == null || rId.isEmpty()) continue;
                            if (filterRestaurantId != null && !filterRestaurantId.isEmpty() && !filterRestaurantId.equals(rId)) {
                                continue;
                            }

                            Boolean avail = md.getBoolean("available");
                            if (avail == null) avail = md.getBoolean("isAvailable");
                            if (avail != null && !avail) continue;
                            Boolean del = md.getBoolean("deleted");
                            if (del != null && del) continue;
                            String approval = md.getString("approvalStatus");
                            if (approval != null && !approval.isEmpty() && !"approved".equalsIgnoreCase(approval)) {
                                continue;
                            }

                            List<String> urls = new ArrayList<>();
                            Object rawVideos = itemData.get("videos");
                            if (rawVideos instanceof List<?>) {
                                for (Object vo : (List<?>) rawVideos) {
                                    if (vo != null) {
                                        String vs = String.valueOf(vo).trim();
                                        if (!vs.isEmpty() && !urls.contains(vs)) urls.add(vs);
                                    }
                                }
                            }
                            String primaryVideo = asString(itemData.get("videoUrl"));
                            if (primaryVideo == null || primaryVideo.isEmpty()) {
                                primaryVideo = asString(itemData.get("video"));
                            }
                            if (primaryVideo != null && !primaryVideo.trim().isEmpty() && !urls.contains(primaryVideo.trim())) {
                                urls.add(primaryVideo.trim());
                            }

                            String restName = restLookup.containsKey(rId) ? restLookup.get(rId).get("name") : "Restaurant Partner";
                            String dishName = asString(itemData.get("name"));
                            String dishDesc = asString(itemData.get("description"));
                            String thumb = asString(itemData.get("image"));
                            Object priceObj = itemData.get("price");

                            for (int i = 0; i < urls.size(); i++) {
                                String u = urls.get(i);
                                String key = rId + "::" + u;
                                if (seenVideoUrls.contains(key)) continue;
                                seenVideoUrls.add(key);

                                Map<String, Object> merged = new HashMap<>();
                                merged.put("id", "menu_" + md.getId() + "_" + i);
                                merged.put("menuItemId", md.getId());
                                merged.put("restaurantId", rId);
                                merged.put("restaurantName", restName);
                                merged.put("title", dishName != null ? dishName : "Dish Video");
                                merged.put("description", dishDesc != null ? dishDesc : "");
                                merged.put("videoUrl", u);
                                merged.put("thumbnailUrl", thumb);
                                merged.put("type", "menu_video");
                                if (priceObj != null) merged.put("price", priceObj);
                                merged.put("createdAt", itemData.get("updatedAt") != null ? itemData.get("updatedAt") : itemData.get("createdAt"));
                                stories.add(merged);
                            }
                        }
                    }

                    Collections.sort(stories, (a, b) -> Long.compare(extractCreatedSeconds(b), extractCreatedSeconds(a)));

                    bufferProgress.setVisibility(View.GONE);
                    if (!stories.isEmpty()) {
                        setupProgressBars();
                        showStory(0);
                    } else {
                        showToast("No stories or menu videos available");
                        finish();
                    }
                });
            });
        });
    }

    private String asString(Object o) {
        return o != null ? String.valueOf(o) : null;
    }

    private void setupProgressBars() {
        progressContainer.removeAllViews();
        for (int i = 0; i < stories.size(); i++) {
            ProgressBar pb = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, 6);
            params.weight = 1;
            params.setMargins(3, 0, 3, 0);
            pb.setLayoutParams(params);
            pb.setMax(100);
            pb.setProgress(0);
            progressContainer.addView(pb);
        }
    }

    private void fitVideoAspect(int videoW, int videoH) {
        if (videoW <= 0 || videoH <= 0 || storyRoot == null) return;
        storyRoot.post(() -> {
            int containerW = storyRoot.getWidth();
            int containerH = storyRoot.getHeight();
            if (containerW <= 0 || containerH <= 0) return;

            float videoRatio = (float) videoW / (float) videoH;
            float containerRatio = (float) containerW / (float) containerH;

            int targetW;
            int targetH;
            if (videoRatio > containerRatio) {
                targetW = containerW;
                targetH = Math.round(containerW / videoRatio);
            } else {
                targetH = containerH;
                targetW = Math.round(containerH * videoRatio);
            }

            FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(targetW, targetH);
            lp.gravity = Gravity.CENTER;
            videoView.setLayoutParams(lp);
        });
    }

    private String getEmbedUrl(String rawUrl) {
        if (rawUrl == null) return null;
        try {
            Uri u = Uri.parse(rawUrl);
            String host = u.getHost() != null ? u.getHost().toLowerCase() : "";
            String path = u.getPath() != null ? u.getPath() : "";
            if (host.contains("youtube.com")) {
                if (path.startsWith("/shorts/")) {
                    String[] parts = path.replace("/shorts/", "").split("/");
                    if (parts.length > 0 && !parts[0].isEmpty()) {
                        return "https://www.youtube.com/embed/" + parts[0] + "?autoplay=1&rel=0";
                    }
                }
                String v = u.getQueryParameter("v");
                if (v != null && !v.isEmpty()) {
                    return "https://www.youtube.com/embed/" + v + "?autoplay=1&rel=0";
                }
                if (path.startsWith("/embed/")) return rawUrl;
            } else if ("youtu.be".equals(host)) {
                String id = path.replace("/", "").trim();
                if (!id.isEmpty()) {
                    return "https://www.youtube.com/embed/" + id + "?autoplay=1&rel=0";
                }
            } else if (host.contains("vimeo.com")) {
                String id = path.replace("/", "").trim();
                if (!id.isEmpty()) {
                    return "https://player.vimeo.com/video/" + id + "?autoplay=1";
                }
            }
        } catch (Exception ignored) {}
        return null;
    }

    private void showStory(int index) {
        if (index < 0 || index >= stories.size()) {
            finish();
            return;
        }

        handler.removeCallbacksAndMessages(null);
        isPaused = false;
        currentIndex = index;
        Map<String, Object> story = stories.get(index);

        for (int i = 0; i < progressContainer.getChildCount(); i++) {
            ProgressBar pb = (ProgressBar) progressContainer.getChildAt(i);
            pb.setProgress(i < index ? 100 : 0);
        }

        String title = asString(story.get("title"));
        String desc = asString(story.get("description"));
        String restaurantName = asString(story.get("restaurantName"));
        String restaurantId = asString(story.get("restaurantId"));
        String menuItemId = asString(story.get("menuItemId"));
        String videoUrl = asString(story.get("videoUrl"));
        String imageUrl = asString(story.get("thumbnailUrl"));
        if (imageUrl == null) imageUrl = asString(story.get("imageUrl"));

        tvStoryTitle.setText(title != null ? title : "");
        tvRestaurantName.setText(restaurantName != null ? restaurantName : "Restaurant Partner");

        boolean isMenu = "menu_video".equals(story.get("type")) || (menuItemId != null && !menuItemId.isEmpty());
        String priceLabel = "";
        Object priceObj = story.get("price");
        if (priceObj instanceof Number) {
            priceLabel = String.format(Locale.getDefault(), " • ₹%.0f", ((Number) priceObj).doubleValue());
        }
        tvStoryTag.setText((isMenu ? "Dish Video" : "Kitchen Reel") + priceLabel);
        tvStoryTag.setVisibility(View.VISIBLE);

        if (desc != null && !desc.trim().isEmpty()) {
            tvStoryDescription.setText(desc.trim());
            tvStoryDescription.setVisibility(View.VISIBLE);
        } else {
            tvStoryDescription.setVisibility(View.GONE);
        }

        if (menuItemId != null && !menuItemId.isEmpty()) {
            btnOrderDish.setVisibility(View.VISIBLE);
            btnOrderDish.setOnClickListener(v -> {
                Intent i = new Intent(this, ProductDetailActivity.class);
                i.putExtra(Constants.EXTRA_PRODUCT_ID, menuItemId);
                if (restaurantId != null) i.putExtra(Constants.EXTRA_RESTAURANT_ID, restaurantId);
                startActivity(i);
            });
        } else {
            btnOrderDish.setVisibility(View.GONE);
        }

        if (restaurantId != null && !restaurantId.isEmpty()) {
            btnViewKitchen.setVisibility(View.VISIBLE);
            btnViewKitchen.setOnClickListener(v -> {
                Intent i = new Intent(this, RestaurantDetailActivity.class);
                i.putExtra(Constants.EXTRA_RESTAURANT_ID, restaurantId);
                startActivity(i);
            });
        } else {
            btnViewKitchen.setVisibility(View.GONE);
        }

        videoView.stopPlayback();

        if (videoUrl != null && !videoUrl.isEmpty()) {
            String embedUrl = getEmbedUrl(videoUrl);
            if (embedUrl != null) {
                imageView.setVisibility(View.GONE);
                videoView.setVisibility(View.GONE);
                bufferProgress.setVisibility(View.GONE);
                webView.setVisibility(View.VISIBLE);
                WebSettings settings = webView.getSettings();
                settings.setJavaScriptEnabled(true);
                settings.setDomStorageEnabled(true);
                settings.setMediaPlaybackRequiresUserGesture(false);
                webView.setWebChromeClient(new WebChromeClient());
                webView.setWebViewClient(new WebViewClient());
                webView.loadUrl(embedUrl);
                activeDurationMs = 15000;
                startProgressLoop(index);
            } else {
                webView.setVisibility(View.GONE);
                imageView.setVisibility(View.GONE);
                videoView.setVisibility(View.VISIBLE);
                bufferProgress.setVisibility(View.VISIBLE);

                FrameLayout.LayoutParams resetLp = new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                );
                resetLp.gravity = Gravity.CENTER;
                videoView.setLayoutParams(resetLp);

                videoView.setVideoURI(Uri.parse(videoUrl));
                videoView.setOnPreparedListener(mp -> {
                    bufferProgress.setVisibility(View.GONE);
                    fitVideoAspect(mp.getVideoWidth(), mp.getVideoHeight());
                    int dur = mp.getDuration();
                    activeDurationMs = dur > 1000 ? dur : 15000;
                    videoView.start();
                    startProgressLoop(index);
                });
                videoView.setOnCompletionListener(mp -> showNext());
                videoView.setOnErrorListener((mp, what, extra) -> {
                    bufferProgress.setVisibility(View.GONE);
                    showToast("Unable to play this video");
                    showNext();
                    return true;
                });
            }
        } else if (imageUrl != null && !imageUrl.isEmpty()) {
            webView.setVisibility(View.GONE);
            videoView.setVisibility(View.GONE);
            bufferProgress.setVisibility(View.GONE);
            imageView.setVisibility(View.VISIBLE);
            Glide.with(this).load(imageUrl).into(imageView);
            activeDurationMs = 5000;
            startProgressLoop(index);
        } else {
            webView.setVisibility(View.GONE);
            videoView.setVisibility(View.GONE);
            bufferProgress.setVisibility(View.GONE);
            imageView.setVisibility(View.VISIBLE);
            imageView.setImageResource(android.R.color.darker_gray);
            activeDurationMs = 5000;
            startProgressLoop(index);
        }
    }

    private void startProgressLoop(int index) {
        if (index >= progressContainer.getChildCount()) return;
        ProgressBar pb = (ProgressBar) progressContainer.getChildAt(index);
        final long startMs = System.currentTimeMillis();
        final boolean isDirectVideo = videoView.getVisibility() == View.VISIBLE;

        progressTickRunnable = new Runnable() {
            @Override
            public void run() {
                if (currentIndex != index || isFinishing() || isDestroyed()) return;
                if (!isPaused) {
                    if (isDirectVideo && videoView.getDuration() > 0) {
                        int pct = Math.min(100, Math.round((videoView.getCurrentPosition() * 100f) / videoView.getDuration()));
                        pb.setProgress(pct);
                    } else {
                        long elapsed = System.currentTimeMillis() - startMs;
                        int pct = Math.min(100, Math.round((elapsed * 100f) / Math.max(1000L, activeDurationMs)));
                        pb.setProgress(pct);
                        if (pct >= 100 && !isDirectVideo) {
                            showNext();
                            return;
                        }
                    }
                }
                handler.postDelayed(this, 80);
            }
        };
        handler.post(progressTickRunnable);
    }

    private void togglePlayPause() {
        isPaused = !isPaused;
        if (videoView.getVisibility() == View.VISIBLE) {
            if (isPaused && videoView.isPlaying()) {
                videoView.pause();
            } else if (!isPaused) {
                videoView.start();
            }
        }
    }

    private void showNext() {
        handler.removeCallbacksAndMessages(null);
        showStory(currentIndex + 1);
    }

    private void showPrevious() {
        handler.removeCallbacksAndMessages(null);
        showStory(currentIndex - 1);
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (videoView != null && videoView.isPlaying()) {
            videoView.pause();
        }
        if (webView != null) {
            webView.onPause();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
        }
        applyFullscreenMode(isImmersive);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        handler.removeCallbacksAndMessages(null);
        if (videoView != null) {
            videoView.stopPlayback();
        }
        if (webView != null) {
            webView.destroy();
        }
    }
}
