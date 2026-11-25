package com.ssr.hunger.activities;

import android.net.Uri;
import android.os.Bundle;
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
import android.widget.MediaController;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.VideoView;

import com.ssr.hunger.R;

import java.util.ArrayList;
import java.util.List;

public class VideoPlayerActivity extends BaseActivity {

    private FrameLayout rootContainer;
    private VideoView videoView;
    private WebView webView;
    private ProgressBar progressBar;
    private TextView titleText;
    private TextView tvVideoCount;
    private ImageButton closeBtn;
    private ImageButton btnPrev;
    private ImageButton btnNext;

    private final List<String> videoUrls = new ArrayList<>();
    private int currentIndex = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_video_player);

        enableImmersiveFullscreen();

        rootContainer = findViewById(R.id.rootVideoContainer);
        videoView = findViewById(R.id.videoView);
        webView = findViewById(R.id.webView);
        progressBar = findViewById(R.id.progressBar);
        titleText = findViewById(R.id.tvTitle);
        tvVideoCount = findViewById(R.id.tvVideoCount);
        closeBtn = findViewById(R.id.btnClose);
        btnPrev = findViewById(R.id.btnPrevVideo);
        btnNext = findViewById(R.id.btnNextVideo);

        ArrayList<String> extraList = getIntent().getStringArrayListExtra("videoUrls");
        if (extraList != null) {
            for (String u : extraList) {
                if (u != null && !u.trim().isEmpty()) {
                    videoUrls.add(u.trim());
                }
            }
        }
        String singleUrl = getIntent().getStringExtra("videoUrl");
        if (videoUrls.isEmpty() && singleUrl != null && !singleUrl.trim().isEmpty()) {
            videoUrls.add(singleUrl.trim());
        }
        currentIndex = Math.max(0, Math.min(getIntent().getIntExtra("position", 0), Math.max(0, videoUrls.size() - 1)));

        String title = getIntent().getStringExtra("title");
        if (title != null) {
            titleText.setText(title);
        }

        closeBtn.setOnClickListener(v -> finish());
        btnPrev.setOnClickListener(v -> {
            if (videoUrls.size() > 1) {
                currentIndex = (currentIndex - 1 + videoUrls.size()) % videoUrls.size();
                playVideoAt(currentIndex);
            }
        });
        btnNext.setOnClickListener(v -> {
            if (videoUrls.size() > 1) {
                currentIndex = (currentIndex + 1) % videoUrls.size();
                playVideoAt(currentIndex);
            }
        });

        if (videoUrls.size() > 1) {
            btnPrev.setVisibility(View.VISIBLE);
            btnNext.setVisibility(View.VISIBLE);
            tvVideoCount.setVisibility(View.VISIBLE);
        }

        if (!videoUrls.isEmpty()) {
            playVideoAt(currentIndex);
        } else {
            showToast("No video available");
            finish();
        }
    }

    private void enableImmersiveFullscreen() {
        getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN
        );
        View decor = getWindow().getDecorView();
        decor.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        );
    }

    private String getEmbedUrl(String rawUrl) {
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

    private void fitVideoAspect(int videoW, int videoH) {
        if (videoW <= 0 || videoH <= 0 || rootContainer == null) return;
        rootContainer.post(() -> {
            int containerW = rootContainer.getWidth();
            int containerH = rootContainer.getHeight();
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

    private void playVideoAt(int idx) {
        if (idx < 0 || idx >= videoUrls.size()) return;
        String url = videoUrls.get(idx);

        if (videoUrls.size() > 1) {
            tvVideoCount.setText((idx + 1) + "/" + videoUrls.size());
        }

        videoView.stopPlayback();
        String embedUrl = getEmbedUrl(url);

        if (embedUrl != null) {
            videoView.setVisibility(View.GONE);
            progressBar.setVisibility(View.GONE);
            webView.setVisibility(View.VISIBLE);
            WebSettings settings = webView.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setMediaPlaybackRequiresUserGesture(false);
            webView.setWebChromeClient(new WebChromeClient());
            webView.setWebViewClient(new WebViewClient());
            webView.loadUrl(embedUrl);
            return;
        }

        webView.setVisibility(View.GONE);
        videoView.setVisibility(View.VISIBLE);
        progressBar.setVisibility(View.VISIBLE);

        // Reset params before prepare so measurement fits cleanly
        FrameLayout.LayoutParams resetLp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        );
        resetLp.gravity = Gravity.CENTER;
        videoView.setLayoutParams(resetLp);

        Uri uri = Uri.parse(url);
        videoView.setVideoURI(uri);

        MediaController mediaController = new MediaController(this);
        mediaController.setAnchorView(videoView);
        videoView.setMediaController(mediaController);

        videoView.setOnPreparedListener(mp -> {
            progressBar.setVisibility(View.GONE);
            fitVideoAspect(mp.getVideoWidth(), mp.getVideoHeight());
            videoView.start();
        });

        videoView.setOnCompletionListener(mp -> {
            if (videoUrls.size() > 1 && idx + 1 < videoUrls.size()) {
                currentIndex = idx + 1;
                playVideoAt(currentIndex);
            }
        });

        videoView.setOnErrorListener((mp, what, extra) -> {
            progressBar.setVisibility(View.GONE);
            showToast("Failed to play video");
            return true;
        });
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
        enableImmersiveFullscreen();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (videoView != null) {
            videoView.stopPlayback();
        }
        if (webView != null) {
            webView.destroy();
        }
    }
}
