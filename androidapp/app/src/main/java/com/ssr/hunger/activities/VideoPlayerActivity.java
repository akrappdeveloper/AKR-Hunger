package com.ssr.hunger.activities;

import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.widget.ImageButton;
import android.widget.MediaController;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.VideoView;

import com.ssr.hunger.R;

public class VideoPlayerActivity extends BaseActivity {

    private VideoView videoView;
    private ProgressBar progressBar;
    private TextView titleText;
    private ImageButton closeBtn;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_video_player);

        // Full screen
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
            WindowManager.LayoutParams.FLAG_FULLSCREEN
        );

        videoView = findViewById(R.id.videoView);
        progressBar = findViewById(R.id.progressBar);
        titleText = findViewById(R.id.tvTitle);
        closeBtn = findViewById(R.id.btnClose);

        String videoUrl = getIntent().getStringExtra("videoUrl");
        String title = getIntent().getStringExtra("title");

        if (title != null) {
            titleText.setText(title);
        }

        closeBtn.setOnClickListener(v -> finish());

        if (videoUrl != null && !videoUrl.isEmpty()) {
            progressBar.setVisibility(View.VISIBLE);
            Uri uri = Uri.parse(videoUrl);
            videoView.setVideoURI(uri);

            MediaController mediaController = new MediaController(this);
            mediaController.setAnchorView(videoView);
            videoView.setMediaController(mediaController);

            videoView.setOnPreparedListener(mp -> {
                progressBar.setVisibility(View.GONE);
                videoView.start();
            });

            videoView.setOnCompletionListener(mp -> {
                // Video completed
            });

            videoView.setOnErrorListener((mp, what, extra) -> {
                progressBar.setVisibility(View.GONE);
                showToast("Failed to play video");
                return true;
            });
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (videoView != null && videoView.isPlaying()) {
            videoView.pause();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (videoView != null) {
            videoView.stopPlayback();
        }
    }
}
