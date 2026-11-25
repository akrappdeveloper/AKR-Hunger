package com.ssr.hunger.activities;

import android.os.Bundle;
import android.widget.ImageButton;
import android.widget.TextView;
import com.ssr.hunger.R;

public class LeaderboardActivity extends BaseActivity {

    private ImageButton btnBack;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_leaderboard);

        btnBack = findViewById(R.id.btnBack);
        btnBack.setOnClickListener(v -> finish());
    }
}
