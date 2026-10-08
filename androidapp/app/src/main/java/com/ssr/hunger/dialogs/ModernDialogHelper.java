package com.ssr.hunger.dialogs;

import android.app.Activity;
import android.app.Dialog;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.view.animation.AccelerateDecelerateInterpolator;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.DrawableRes;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;

import com.ssr.hunger.R;
import com.ssr.hunger.utils.SettingsHelper;

import java.util.ArrayList;
import java.util.List;

/**
 * ModernDialogHelper — Professional 2050 design-system dialogs inspired by
 * clean minimalist macOS / iOS card aesthetics with multi-theme support.
 *
 * Implements:
 * 1. Danger / Destructive Confirmation (matching Red Trash Can dialog)
 * 2. Edit / Text Input (matching Blue Pencil dialog)
 * 3. Warning Alert (matching Yellow Exclamation dialog)
 * 4. Single-Choice Option Selector (Language, Payment, Spice, Format)
 * 5. Full Open-Language Selector
 * 6. Informational Scrollable Dialog (Terms, Privacy, Licenses)
 * 7. Modern Floating Banner Toasts (Status, Token alerts, Warnings)
 */
public class ModernDialogHelper {

    public interface OnInputListener {
        void onInputConfirmed(String text);
    }

    public interface OnChoiceSelectedListener {
        void onSelected(int index, String value);
    }

    public static class ChoiceOption {
        public final String title;
        public final String subtitle;
        public final String tag;

        public ChoiceOption(String title, @Nullable String subtitle, @Nullable String tag) {
            this.title = title;
            this.subtitle = subtitle;
            this.tag = tag;
        }

        public ChoiceOption(String title) {
            this(title, null, null);
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // 1. Danger Confirmation Dialog (Matches Red Trash dialog in screenshot)
    // ──────────────────────────────────────────────────────────────────

    public static Dialog showDangerDialog(@NonNull Activity activity,
                                          @Nullable String title,
                                          @Nullable String message,
                                          @Nullable String actionText,
                                          @Nullable Runnable onActionConfirmed) {
        if (activity.isFinishing() || activity.isDestroyed()) return null;

        Dialog dialog = createBaseDialog(activity, R.layout.dialog_modern_danger);

        ImageView ivIcon = dialog.findViewById(R.id.iv_dialog_icon);
        TextView tvTitle = dialog.findViewById(R.id.tv_dialog_title);
        TextView tvMessage = dialog.findViewById(R.id.tv_dialog_message);
        View btnCancel = dialog.findViewById(R.id.btn_dialog_cancel);
        TextView btnAction = dialog.findViewById(R.id.btn_dialog_action);

        if (ivIcon != null) {
            ivIcon.setImageResource(R.drawable.ic_dialog_trash_outline);
        }
        if (tvTitle != null && title != null) {
            tvTitle.setText(title);
        }
        if (tvMessage != null && message != null) {
            tvMessage.setText(message);
        }
        if (btnAction != null && actionText != null) {
            btnAction.setText(actionText);
        }

        if (btnCancel != null) {
            btnCancel.setOnClickListener(v -> {
                SettingsHelper.triggerHapticClick(activity);
                dialog.dismiss();
            });
        }

        if (btnAction != null) {
            btnAction.setOnClickListener(v -> {
                SettingsHelper.triggerHapticClick(activity);
                dialog.dismiss();
                if (onActionConfirmed != null) {
                    onActionConfirmed.run();
                }
            });
        }

        dialog.show();
        animateDialogEntry(dialog);
        return dialog;
    }

    // ──────────────────────────────────────────────────────────────────
    // 2. Edit / Input Dialog (Matches Blue Pencil dialog in screenshot)
    // ──────────────────────────────────────────────────────────────────

    public static Dialog showInputDialog(@NonNull Activity activity,
                                         @DrawableRes int iconRes,
                                         @Nullable String title,
                                         @Nullable String subtitle,
                                         @Nullable String hint,
                                         @Nullable String initialValue,
                                         @Nullable OnInputListener onInputConfirmed) {
        if (activity.isFinishing() || activity.isDestroyed()) return null;

        Dialog dialog = createBaseDialog(activity, R.layout.dialog_modern_input);

        ImageView ivIcon = dialog.findViewById(R.id.iv_dialog_icon);
        TextView tvTitle = dialog.findViewById(R.id.tv_dialog_title);
        TextView tvSubtitle = dialog.findViewById(R.id.tv_dialog_message);
        EditText etInput = dialog.findViewById(R.id.et_dialog_input);
        View btnCancel = dialog.findViewById(R.id.btn_dialog_cancel);
        TextView btnSave = dialog.findViewById(R.id.btn_dialog_action);

        if (ivIcon != null && iconRes != 0) {
            ivIcon.setImageResource(iconRes);
        }
        if (tvTitle != null && title != null) {
            tvTitle.setText(title);
        }
        if (tvSubtitle != null) {
            if (!TextUtils.isEmpty(subtitle)) {
                tvSubtitle.setVisibility(View.VISIBLE);
                tvSubtitle.setText(subtitle);
            } else {
                tvSubtitle.setVisibility(View.GONE);
            }
        }
        if (etInput != null) {
            if (hint != null) etInput.setHint(hint);
            if (initialValue != null) {
                etInput.setText(initialValue);
                etInput.setSelection(initialValue.length());
            }
            etInput.requestFocus();
        }

        if (btnCancel != null) {
            btnCancel.setOnClickListener(v -> {
                SettingsHelper.triggerHapticClick(activity);
                dialog.dismiss();
            });
        }

        if (btnSave != null) {
            btnSave.setOnClickListener(v -> {
                SettingsHelper.triggerHapticClick(activity);
                String result = etInput != null && etInput.getText() != null
                        ? etInput.getText().toString().trim()
                        : "";
                dialog.dismiss();
                if (onInputConfirmed != null) {
                    onInputConfirmed.onInputConfirmed(result);
                }
            });
        }

        dialog.show();
        animateDialogEntry(dialog);
        return dialog;
    }

    // ──────────────────────────────────────────────────────────────────
    // 3. Warning Dialog (Matches Amber Warning dialog in screenshot)
    // ──────────────────────────────────────────────────────────────────

    public static Dialog showWarningDialog(@NonNull Activity activity,
                                           @Nullable String title,
                                           @Nullable String message,
                                           @Nullable String confirmText,
                                           @Nullable Runnable onConfirmed) {
        if (activity.isFinishing() || activity.isDestroyed()) return null;

        Dialog dialog = createBaseDialog(activity, R.layout.dialog_modern_warning);

        ImageView ivIcon = dialog.findViewById(R.id.iv_dialog_icon);
        TextView tvTitle = dialog.findViewById(R.id.tv_dialog_title);
        TextView tvMessage = dialog.findViewById(R.id.tv_dialog_message);
        View btnCancel = dialog.findViewById(R.id.btn_dialog_cancel);
        TextView btnAction = dialog.findViewById(R.id.btn_dialog_action);

        if (ivIcon != null) {
            ivIcon.setImageResource(R.drawable.ic_dialog_warning_outline);
        }
        if (tvTitle != null && title != null) {
            tvTitle.setText(title);
        }
        if (tvMessage != null && message != null) {
            tvMessage.setText(message);
        }
        if (btnAction != null && confirmText != null) {
            btnAction.setText(confirmText);
        }

        if (btnCancel != null) {
            btnCancel.setOnClickListener(v -> {
                SettingsHelper.triggerHapticClick(activity);
                dialog.dismiss();
            });
        }

        if (btnAction != null) {
            btnAction.setOnClickListener(v -> {
                SettingsHelper.triggerHapticClick(activity);
                dialog.dismiss();
                if (onConfirmed != null) {
                    onConfirmed.run();
                }
            });
        }

        dialog.show();
        animateDialogEntry(dialog);
        return dialog;
    }

    // ──────────────────────────────────────────────────────────────────
    // 4. Single Choice Selector Dialog (Language, Payment, Spice, Format)
    // ──────────────────────────────────────────────────────────────────

    public static Dialog showChoiceDialog(@NonNull Activity activity,
                                          @Nullable String title,
                                          @NonNull List<ChoiceOption> options,
                                          int selectedIndex,
                                          @Nullable OnChoiceSelectedListener onSelected) {
        return showChoiceDialog(activity, R.drawable.ic_dialog_globe_outline, title, null, options, selectedIndex, onSelected);
    }

    public static Dialog showChoiceDialog(@NonNull Activity activity,
                                          @DrawableRes int iconRes,
                                          @Nullable String title,
                                          @Nullable String subtitle,
                                          @NonNull List<ChoiceOption> options,
                                          int selectedIndex,
                                          @Nullable OnChoiceSelectedListener onSelected) {
        if (activity.isFinishing() || activity.isDestroyed()) return null;

        Dialog dialog = createBaseDialog(activity, R.layout.dialog_modern_choice);

        ImageView ivIcon = dialog.findViewById(R.id.iv_dialog_icon);
        TextView tvTitle = dialog.findViewById(R.id.tv_dialog_title);
        TextView tvSubtitle = dialog.findViewById(R.id.tv_dialog_message);
        LinearLayout layoutItems = dialog.findViewById(R.id.layout_choice_items);
        View btnCancel = dialog.findViewById(R.id.btn_dialog_cancel);
        TextView btnSave = dialog.findViewById(R.id.btn_dialog_action);

        if (ivIcon != null && iconRes != 0) {
            ivIcon.setImageResource(iconRes);
        }
        if (tvTitle != null && title != null) {
            tvTitle.setText(title);
        }
        if (tvSubtitle != null) {
            if (!TextUtils.isEmpty(subtitle)) {
                tvSubtitle.setVisibility(View.VISIBLE);
                tvSubtitle.setText(subtitle);
            } else {
                tvSubtitle.setVisibility(View.GONE);
            }
        }

        final int[] currentSelection = {Math.max(0, Math.min(selectedIndex, options.size() - 1))};
        final List<ImageView> checkViews = new ArrayList<>();
        final List<View> rowRoots = new ArrayList<>();

        if (layoutItems != null) {
            layoutItems.removeAllViews();
            LayoutInflater inflater = LayoutInflater.from(activity);

            for (int i = 0; i < options.size(); i++) {
                final int idx = i;
                ChoiceOption opt = options.get(i);
                View row = inflater.inflate(R.layout.item_dialog_choice, layoutItems, false);

                TextView tvOptTitle = row.findViewById(R.id.tv_choice_title);
                TextView tvOptSubtitle = row.findViewById(R.id.tv_choice_subtitle);
                ImageView ivCheck = row.findViewById(R.id.iv_choice_check);

                if (tvOptTitle != null) tvOptTitle.setText(opt.title);
                if (tvOptSubtitle != null) {
                    if (!TextUtils.isEmpty(opt.subtitle)) {
                        tvOptSubtitle.setVisibility(View.VISIBLE);
                        tvOptSubtitle.setText(opt.subtitle);
                    } else {
                        tvOptSubtitle.setVisibility(View.GONE);
                    }
                }

                checkViews.add(ivCheck);
                rowRoots.add(row);

                boolean isSelected = (idx == currentSelection[0]);
                updateChoiceRowVisual(activity, row, ivCheck, isSelected);

                row.setOnClickListener(v -> {
                    SettingsHelper.triggerHapticClick(activity);
                    currentSelection[0] = idx;
                    for (int k = 0; k < checkViews.size(); k++) {
                        updateChoiceRowVisual(activity, rowRoots.get(k), checkViews.get(k), k == idx);
                    }
                });

                layoutItems.addView(row);
            }
        }

        if (btnCancel != null) {
            btnCancel.setOnClickListener(v -> {
                SettingsHelper.triggerHapticClick(activity);
                dialog.dismiss();
            });
        }

        if (btnSave != null) {
            btnSave.setOnClickListener(v -> {
                SettingsHelper.triggerHapticClick(activity);
                dialog.dismiss();
                if (onSelected != null && currentSelection[0] >= 0 && currentSelection[0] < options.size()) {
                    onSelected.onSelected(currentSelection[0], options.get(currentSelection[0]).title);
                }
            });
        }

        dialog.show();
        animateDialogEntry(dialog);
        return dialog;
    }

    private static void updateChoiceRowVisual(Activity activity, View row, ImageView ivCheck, boolean isSelected) {
        if (ivCheck != null) {
            if (isSelected) {
                ivCheck.setVisibility(View.VISIBLE);
                ivCheck.setImageResource(R.drawable.ic_check_circle_filled);
                ivCheck.setColorFilter(ContextCompat.getColor(activity, R.color.primary));
            } else {
                ivCheck.setVisibility(View.GONE);
            }
        }
        if (row != null) {
            row.setAlpha(isSelected ? 1.0f : 0.85f);
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // 5. Informational Scrollable Dialog (Terms, Privacy, Licenses, Sessions)
    // ──────────────────────────────────────────────────────────────────

    public static Dialog showInfoDialog(@NonNull Activity activity,
                                        @Nullable String title,
                                        @Nullable String message) {
        return showInfoDialog(activity, R.drawable.ic_dialog_check_outline, title, message, null, null);
    }

    public static Dialog showInfoDialog(@NonNull Activity activity,
                                        @DrawableRes int iconRes,
                                        @Nullable String title,
                                        @Nullable String message) {
        return showInfoDialog(activity, iconRes, title, message, null, null);
    }

    public static Dialog showInfoDialog(@NonNull Activity activity,
                                        @DrawableRes int iconRes,
                                        @Nullable String title,
                                        @Nullable String message,
                                        @Nullable String secondaryText,
                                        @Nullable Runnable onSecondaryAction) {
        if (activity.isFinishing() || activity.isDestroyed()) return null;

        Dialog dialog = createBaseDialog(activity, R.layout.dialog_modern_info);

        ImageView ivIcon = dialog.findViewById(R.id.iv_dialog_icon);
        TextView tvTitle = dialog.findViewById(R.id.tv_dialog_title);
        TextView tvMessage = dialog.findViewById(R.id.tv_dialog_message);
        TextView btnSecondary = dialog.findViewById(R.id.btn_dialog_secondary);
        TextView btnAction = dialog.findViewById(R.id.btn_dialog_action);

        if (ivIcon != null && iconRes != 0) {
            ivIcon.setImageResource(iconRes);
        }
        if (tvTitle != null && title != null) {
            tvTitle.setText(title);
        }
        if (tvMessage != null && message != null) {
            tvMessage.setText(message);
        }

        if (btnSecondary != null) {
            if (!TextUtils.isEmpty(secondaryText)) {
                btnSecondary.setVisibility(View.VISIBLE);
                btnSecondary.setText(secondaryText);
                btnSecondary.setOnClickListener(v -> {
                    SettingsHelper.triggerHapticClick(activity);
                    dialog.dismiss();
                    if (onSecondaryAction != null) {
                        onSecondaryAction.run();
                    }
                });
            } else {
                btnSecondary.setVisibility(View.GONE);
            }
        }

        if (btnAction != null) {
            btnAction.setOnClickListener(v -> {
                SettingsHelper.triggerHapticClick(activity);
                dialog.dismiss();
            });
        }

        dialog.show();
        animateDialogEntry(dialog);
        return dialog;
    }

    // ──────────────────────────────────────────────────────────────────
    // 6. Floating Modern Banner Toast (Top of screen, matching screenshot)
    // ──────────────────────────────────────────────────────────────────

    public static void showBannerToast(@NonNull Activity activity,
                                       boolean isError,
                                       @NonNull String title,
                                       @NonNull String message) {
        if (activity.isFinishing() || activity.isDestroyed()) return;

        activity.runOnUiThread(() -> {
            ViewGroup decorView = (ViewGroup) activity.getWindow().getDecorView();
            View banner = LayoutInflater.from(activity).inflate(R.layout.layout_banner_toast, decorView, false);

            LinearLayout root = banner.findViewById(R.id.banner_toast_root);
            ImageView ivIcon = banner.findViewById(R.id.iv_banner_icon);
            TextView tvTitle = banner.findViewById(R.id.tv_banner_title);
            TextView tvMsg = banner.findViewById(R.id.tv_banner_message);
            View btnClose = banner.findViewById(R.id.btn_banner_close);

            if (isError) {
                if (root != null) root.setBackgroundResource(R.drawable.bg_banner_toast_error);
                if (ivIcon != null) {
                    ivIcon.setImageResource(R.drawable.ic_dialog_trash_outline);
                    ivIcon.setColorFilter(Color.parseColor("#DC2626"));
                }
            } else {
                if (root != null) root.setBackgroundResource(R.drawable.bg_banner_toast_warning);
                if (ivIcon != null) {
                    ivIcon.setImageResource(R.drawable.ic_dialog_warning_outline);
                    ivIcon.setColorFilter(Color.parseColor("#F59E0B"));
                }
            }

            if (tvTitle != null) tvTitle.setText(title);
            if (tvMsg != null) tvMsg.setText(message);

            FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
            );
            lp.gravity = Gravity.TOP;
            lp.topMargin = (int) (activity.getResources().getDisplayMetrics().density * 52);
            lp.leftMargin = (int) (activity.getResources().getDisplayMetrics().density * 16);
            lp.rightMargin = (int) (activity.getResources().getDisplayMetrics().density * 16);
            banner.setLayoutParams(lp);

            decorView.addView(banner);

            banner.setAlpha(0f);
            banner.setTranslationY(-60f);
            banner.animate()
                    .alpha(1f)
                    .translationY(0f)
                    .setDuration(350)
                    .setInterpolator(new AccelerateDecelerateInterpolator())
                    .start();

            Runnable dismissTask = () -> {
                if (banner.getParent() != null) {
                    banner.animate()
                            .alpha(0f)
                            .translationY(-60f)
                            .setDuration(300)
                            .withEndAction(() -> decorView.removeView(banner))
                            .start();
                }
            };

            Handler handler = new Handler(Looper.getMainLooper());
            handler.postDelayed(dismissTask, 4000);

            if (btnClose != null) {
                btnClose.setOnClickListener(v -> {
                    handler.removeCallbacks(dismissTask);
                    dismissTask.run();
                });
            }
        });
    }

    // ──────────────────────────────────────────────────────────────────
    // Internal Dialog Construction Helpers
    // ──────────────────────────────────────────────────────────────────

    private static Dialog createBaseDialog(Activity activity, int layoutRes) {
        Dialog dialog = new Dialog(activity);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
        dialog.setContentView(layoutRes);

        Window window = dialog.getWindow();
        if (window != null) {
            window.setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            WindowManager.LayoutParams lp = new WindowManager.LayoutParams();
            lp.copyFrom(window.getAttributes());
            int screenWidth = activity.getResources().getDisplayMetrics().widthPixels;
            lp.width = (int) (screenWidth * 0.90f); // 90% screen width
            lp.height = WindowManager.LayoutParams.WRAP_CONTENT;
            lp.gravity = Gravity.CENTER;
            lp.dimAmount = 0.55f;
            window.setAttributes(lp);
        }
        dialog.setCanceledOnTouchOutside(true);
        return dialog;
    }

    private static void animateDialogEntry(Dialog dialog) {
        Window window = dialog.getWindow();
        if (window != null && window.getDecorView() != null) {
            View decor = window.getDecorView();
            decor.setScaleX(0.92f);
            decor.setScaleY(0.92f);
            decor.setAlpha(0.0f);
            decor.animate()
                    .scaleX(1.0f)
                    .scaleY(1.0f)
                    .alpha(1.0f)
                    .setDuration(240)
                    .setInterpolator(new AccelerateDecelerateInterpolator())
                    .start();
        }
    }
}
