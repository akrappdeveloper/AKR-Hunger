package com.ssr.hunger.dialogs;

import android.animation.ValueAnimator;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.util.TypedValue;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.animation.AccelerateDecelerateInterpolator;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;

import com.google.android.material.bottomsheet.BottomSheetBehavior;
import com.google.android.material.bottomsheet.BottomSheetDialog;
import com.ssr.hunger.R;

import java.util.ArrayList;
import java.util.Locale;

/**
 * VoiceSearchDialog - Premium iOS-style interactive voice recognition bottom sheet.
 * Features:
 * - Real-time SpeechRecognizer listening with automatic search input trigger
 * - Concentric animated sound wave ripples reactive to mic decibels (RMS dB)
 * - Live partial speech-to-text transcript preview
 * - Equalizer sound wave bars animation
 * - Quick tap suggestion chips
 */
public class VoiceSearchDialog extends BottomSheetDialog {

    public interface OnVoiceSearchResultListener {
        void onVoiceSearchResult(String query);
    }

    private final Activity activity;
    private final OnVoiceSearchResultListener resultListener;

    private SpeechRecognizer speechRecognizer;
    private Intent recognizerIntent;

    private View waveRing1, waveRing2, waveRing3;
    private FrameLayout btnVoiceMic;
    private ImageView ivMicIcon;
    private TextView tvVoiceStatus;
    private TextView tvSpeechText;
    private LinearLayout layoutWaveBars;
    private View bar1, bar2, bar3, bar4, bar5;

    private ValueAnimator breathingAnimator;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private boolean isListening = false;
    private boolean hasResultReturned = false;

    public VoiceSearchDialog(@NonNull Activity activity, @NonNull OnVoiceSearchResultListener listener) {
        super(activity, R.style.ThemeOverlay_AKR_BottomSheetDialog);
        this.activity = activity;
        this.resultListener = listener;
        initView();
    }

    private void initView() {
        View view = LayoutInflater.from(getContext()).inflate(R.layout.dialog_voice_search, null);
        setContentView(view);

        // Make bottom sheet expand fully without collapsing
        BottomSheetBehavior<View> behavior = BottomSheetBehavior.from((View) view.getParent());
        behavior.setState(BottomSheetBehavior.STATE_EXPANDED);
        behavior.setSkipCollapsed(true);

        waveRing1 = view.findViewById(R.id.wave_ring_1);
        waveRing2 = view.findViewById(R.id.wave_ring_2);
        waveRing3 = view.findViewById(R.id.wave_ring_3);
        btnVoiceMic = view.findViewById(R.id.btn_voice_mic);
        ivMicIcon = view.findViewById(R.id.iv_mic_icon);
        tvVoiceStatus = view.findViewById(R.id.tv_voice_status);
        tvSpeechText = view.findViewById(R.id.tv_speech_text);
        layoutWaveBars = view.findViewById(R.id.layout_wave_bars);

        bar1 = view.findViewById(R.id.bar_1);
        bar2 = view.findViewById(R.id.bar_2);
        bar3 = view.findViewById(R.id.bar_3);
        bar4 = view.findViewById(R.id.bar_4);
        bar5 = view.findViewById(R.id.bar_5);

        view.findViewById(R.id.btn_close_voice).setOnClickListener(v -> dismiss());

        // Suggestion chips listeners
        setupSuggestionChip(view.findViewById(R.id.chip_suggestion_1), "Chicken Biryani");
        setupSuggestionChip(view.findViewById(R.id.chip_suggestion_2), "Cheese Pizza");
        setupSuggestionChip(view.findViewById(R.id.chip_suggestion_3), "Truffle Burger");
        setupSuggestionChip(view.findViewById(R.id.chip_suggestion_4), "Cold Dessert");

        // Mic Button Click
        btnVoiceMic.setOnClickListener(v -> {
            if (isListening) {
                stopListening(false);
                tvVoiceStatus.setText("Paused. Tap mic to speak");
                tvVoiceStatus.setTextColor(ContextCompat.getColor(getContext(), R.color.text_secondary));
            } else {
                startListening();
            }
        });

        setOnDismissListener(dialog -> cleanup());

        initSpeechRecognizer();
    }

    private void setupSuggestionChip(View chip, String query) {
        if (chip != null) {
            chip.setOnClickListener(v -> {
                hasResultReturned = true;
                stopListening(true);
                tvSpeechText.setText("\"" + query + "\"");
                tvVoiceStatus.setText("✓ Selected");
                mainHandler.postDelayed(() -> {
                    dismiss();
                    if (resultListener != null) {
                        resultListener.onVoiceSearchResult(query);
                    }
                }, 250);
            });
        }
    }

    private void initSpeechRecognizer() {
        if (!SpeechRecognizer.isRecognitionAvailable(activity)) {
            Toast.makeText(activity, "Voice recognition not supported on this device", Toast.LENGTH_SHORT).show();
            return;
        }

        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(activity);

        recognizerIntent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        recognizerIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        recognizerIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault().toString());
        recognizerIntent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        recognizerIntent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
        recognizerIntent.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, activity.getPackageName());

        speechRecognizer.setRecognitionListener(new RecognitionListener() {
            @Override
            public void onReadyForSpeech(Bundle params) {
                isListening = true;
                tvVoiceStatus.setText("● Listening... Speak now");
                tvVoiceStatus.setTextColor(ContextCompat.getColor(getContext(), R.color.primary));
                startBreathingAnimation();
            }

            @Override
            public void onBeginningOfSpeech() {
                tvVoiceStatus.setText("● Hearing your voice...");
            }

            @Override
            public void onRmsChanged(float rmsdB) {
                // Reactive sound wave expansion based on microphone decibels
                animateSoundWaveRms(rmsdB);
            }

            @Override
            public void onBufferReceived(byte[] buffer) {
            }

            @Override
            public void onEndOfSpeech() {
                isListening = false;
                tvVoiceStatus.setText("Processing speech...");
                tvVoiceStatus.setTextColor(ContextCompat.getColor(getContext(), R.color.secondary_dark));
                stopBreathingAnimation();
            }

            @Override
            public void onError(int error) {
                isListening = false;
                stopBreathingAnimation();
                resetWaveBars();

                String errorMessage;
                switch (error) {
                    case SpeechRecognizer.ERROR_NO_MATCH:
                    case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                        errorMessage = "Didn't catch that. Tap mic to try again";
                        break;
                    case SpeechRecognizer.ERROR_NETWORK:
                    case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
                        errorMessage = "Network issue. Please check connection";
                        break;
                    case SpeechRecognizer.ERROR_AUDIO:
                        errorMessage = "Audio recording error. Try again";
                        break;
                    case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                        errorMessage = "Microphone permission is required";
                        break;
                    default:
                        errorMessage = "Tap mic to try speaking again";
                        break;
                }

                tvVoiceStatus.setText(errorMessage);
                tvVoiceStatus.setTextColor(ContextCompat.getColor(getContext(), R.color.error));
            }

            @Override
            public void onResults(Bundle results) {
                if (hasResultReturned) return;

                ArrayList<String> matches = results != null
                        ? results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        : null;

                if (matches != null && !matches.isEmpty()) {
                    String recognizedQuery = matches.get(0).trim();
                    onSpeechCapturedSuccessfully(recognizedQuery);
                } else {
                    tvVoiceStatus.setText("Couldn't hear clearly. Tap mic to retry");
                    tvVoiceStatus.setTextColor(ContextCompat.getColor(getContext(), R.color.error));
                }
            }

            @Override
            public void onPartialResults(Bundle partialResults) {
                ArrayList<String> matches = partialResults != null
                        ? partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        : null;

                if (matches != null && !matches.isEmpty()) {
                    String partialText = matches.get(0);
                    tvSpeechText.setText(partialText);
                    tvSpeechText.setTextColor(ContextCompat.getColor(getContext(), R.color.text_primary));
                }
            }

            @Override
            public void onEvent(int eventType, Bundle params) {
            }
        });
    }

    private void onSpeechCapturedSuccessfully(String query) {
        hasResultReturned = true;
        isListening = false;
        stopBreathingAnimation();

        tvSpeechText.setText("\"" + query + "\"");
        tvSpeechText.setTextColor(ContextCompat.getColor(getContext(), R.color.text_primary));
        tvVoiceStatus.setText("✓ Found dish!");
        tvVoiceStatus.setTextColor(ContextCompat.getColor(getContext(), R.color.success));

        // Bounce mic button on success
        btnVoiceMic.animate()
                .scaleX(1.15f)
                .scaleY(1.15f)
                .setDuration(160)
                .withEndAction(() -> btnVoiceMic.animate().scaleX(1.0f).scaleY(1.0f).setDuration(160).start())
                .start();

        // Delay 400ms so user clearly perceives the captured query before auto-search
        mainHandler.postDelayed(() -> {
            if (isShowing()) {
                dismiss();
            }
            if (resultListener != null) {
                resultListener.onVoiceSearchResult(query);
            }
        }, 400);
    }

    public void startListening() {
        if (speechRecognizer == null) {
            initSpeechRecognizer();
        }

        hasResultReturned = false;
        isListening = true;
        tvVoiceStatus.setText("● Connecting microphone...");
        tvVoiceStatus.setTextColor(ContextCompat.getColor(getContext(), R.color.primary));
        tvSpeechText.setText("Say dish, restaurant or cuisine…");

        try {
            speechRecognizer.startListening(recognizerIntent);
        } catch (Exception e) {
            tvVoiceStatus.setText("Could not start microphone: " + e.getMessage());
            tvVoiceStatus.setTextColor(ContextCompat.getColor(getContext(), R.color.error));
        }
    }

    public void stopListening(boolean cancel) {
        isListening = false;
        stopBreathingAnimation();
        resetWaveBars();
        if (speechRecognizer != null) {
            try {
                if (cancel) {
                    speechRecognizer.cancel();
                } else {
                    speechRecognizer.stopListening();
                }
            } catch (Exception ignored) {
            }
        }
    }

    private void startBreathingAnimation() {
        if (breathingAnimator != null && breathingAnimator.isRunning()) return;

        breathingAnimator = ValueAnimator.ofFloat(1.0f, 1.15f);
        breathingAnimator.setDuration(900);
        breathingAnimator.setRepeatMode(ValueAnimator.REVERSE);
        breathingAnimator.setRepeatCount(ValueAnimator.INFINITE);
        breathingAnimator.setInterpolator(new AccelerateDecelerateInterpolator());
        breathingAnimator.addUpdateListener(animation -> {
            float val = (float) animation.getAnimatedValue();
            if (waveRing1 != null) {
                waveRing1.setScaleX(val);
                waveRing1.setScaleY(val);
            }
            if (waveRing2 != null) {
                float val2 = 1.0f + (val - 1.0f) * 0.75f;
                waveRing2.setScaleX(val2);
                waveRing2.setScaleY(val2);
            }
            if (waveRing3 != null) {
                float val3 = 1.0f + (val - 1.0f) * 0.5f;
                waveRing3.setScaleX(val3);
                waveRing3.setScaleY(val3);
            }
        });
        breathingAnimator.start();
    }

    private void stopBreathingAnimation() {
        if (breathingAnimator != null) {
            breathingAnimator.cancel();
            breathingAnimator = null;
        }
        if (waveRing1 != null) {
            waveRing1.animate().scaleX(1.0f).scaleY(1.0f).setDuration(200).start();
        }
        if (waveRing2 != null) {
            waveRing2.animate().scaleX(1.0f).scaleY(1.0f).setDuration(200).start();
        }
        if (waveRing3 != null) {
            waveRing3.animate().scaleX(1.0f).scaleY(1.0f).setDuration(200).start();
        }
    }

    private void animateSoundWaveRms(float rmsdB) {
        float factor = Math.max(0f, rmsdB); // normalized 0 to ~10
        float scale1 = 1.0f + Math.min(0.55f, (factor / 9.0f) * 0.45f);
        float scale2 = 1.0f + Math.min(0.40f, (factor / 9.0f) * 0.35f);
        float scale3 = 1.0f + Math.min(0.30f, (factor / 9.0f) * 0.25f);

        if (waveRing1 != null) {
            waveRing1.setScaleX(scale1);
            waveRing1.setScaleY(scale1);
        }
        if (waveRing2 != null) {
            waveRing2.setScaleX(scale2);
            waveRing2.setScaleY(scale2);
        }
        if (waveRing3 != null) {
            waveRing3.setScaleX(scale3);
            waveRing3.setScaleY(scale3);
        }

        // Animate visualizer bars height
        setBarHeight(bar1, 8 + (int) (factor * 1.5f));
        setBarHeight(bar2, 12 + (int) (factor * 2.2f));
        setBarHeight(bar3, 18 + (int) (factor * 3.0f));
        setBarHeight(bar4, 14 + (int) (factor * 2.0f));
        setBarHeight(bar5, 9 + (int) (factor * 1.6f));
    }

    private void setBarHeight(View bar, int dp) {
        if (bar != null) {
            int px = (int) TypedValue.applyDimension(
                    TypedValue.COMPLEX_UNIT_DIP,
                    Math.min(32, Math.max(6, dp)),
                    getContext().getResources().getDisplayMetrics()
            );
            ViewGroup.LayoutParams lp = bar.getLayoutParams();
            if (lp != null && lp.height != px) {
                lp.height = px;
                bar.setLayoutParams(lp);
            }
        }
    }

    private void resetWaveBars() {
        setBarHeight(bar1, 8);
        setBarHeight(bar2, 14);
        setBarHeight(bar3, 22);
        setBarHeight(bar4, 16);
        setBarHeight(bar5, 10);
    }

    @Override
    public void show() {
        super.show();
        startListening();
    }

    private void cleanup() {
        stopListening(true);
        if (speechRecognizer != null) {
            try {
                speechRecognizer.destroy();
            } catch (Exception ignored) {
            }
            speechRecognizer = null;
        }
    }
}
