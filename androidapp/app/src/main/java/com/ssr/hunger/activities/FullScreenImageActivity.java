package com.ssr.hunger.activities;

import android.os.Bundle;
import android.view.View;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.viewpager2.widget.ViewPager2;
import com.bumptech.glide.Glide;
import com.ssr.hunger.R;
import com.ssr.hunger.adapters.ProductImageAdapter;
import java.util.ArrayList;
import java.util.List;

/**
 * Full-screen image viewer launched when the user taps on the product image carousel.
 * Mirrors the Lightbox overlay in the web ProductClient.tsx ImageCarousel component.
 */
public class FullScreenImageActivity extends BaseActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_fullscreen_image);

        List<String> images = getIntent().getStringArrayListExtra("images");
        int startPosition = getIntent().getIntExtra("position", 0);

        if (images == null || images.isEmpty()) {
            finish();
            return;
        }

        ViewPager2 vpImages = findViewById(R.id.vp_fullscreen_images);
        TextView tvCounter = findViewById(R.id.tv_fullscreen_counter);
        LinearLayout llDots = findViewById(R.id.ll_fullscreen_dots);
        ImageView btnClose = findViewById(R.id.btn_fullscreen_close);

        if (btnClose != null) {
            btnClose.setOnClickListener(v -> finish());
        }

        // Setup adapter
        ProductImageAdapter adapter = new ProductImageAdapter(this, images);
        vpImages.setAdapter(adapter);
        vpImages.setCurrentItem(startPosition, false);

        // Counter
        tvCounter.setText((startPosition + 1) + " / " + images.size());

        // Build dots
        if (llDots != null) {
            for (int i = 0; i < images.size(); i++) {
                View dot = new View(this);
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                        i == startPosition ? dpToPx(20) : dpToPx(8), dpToPx(8));
                lp.setMargins(dpToPx(3), 0, dpToPx(3), 0);
                dot.setLayoutParams(lp);
                dot.setBackgroundResource(i == startPosition ? R.drawable.dot_active : R.drawable.dot_inactive);
                llDots.addView(dot);
            }
        }

        vpImages.registerOnPageChangeCallback(new ViewPager2.OnPageChangeCallback() {
            @Override
            public void onPageSelected(int position) {
                tvCounter.setText((position + 1) + " / " + images.size());
                updateDots(llDots, position);
            }
        });
    }

    private void updateDots(LinearLayout llDots, int selectedPos) {
        if (llDots == null) return;
        for (int i = 0; i < llDots.getChildCount(); i++) {
            View dot = llDots.getChildAt(i);
            LinearLayout.LayoutParams lp = (LinearLayout.LayoutParams) dot.getLayoutParams();
            if (i == selectedPos) {
                lp.width = dpToPx(20);
                dot.setBackgroundResource(R.drawable.dot_active);
            } else {
                lp.width = dpToPx(8);
                dot.setBackgroundResource(R.drawable.dot_inactive);
            }
            dot.setLayoutParams(lp);
        }
    }

    private int dpToPx(int dp) {
        return Math.round(dp * getResources().getDisplayMetrics().density);
    }

    @Override
    protected String getScreenName() {
        return "FullScreenImage";
    }
}
