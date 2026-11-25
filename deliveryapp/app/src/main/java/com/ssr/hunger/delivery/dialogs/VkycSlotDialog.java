package com.ssr.hunger.delivery.dialogs;

import android.app.DatePickerDialog;
import android.app.Dialog;
import android.content.Context;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Bundle;
import android.view.Gravity;
import android.view.ViewGroup;
import android.view.Window;
import android.widget.Button;
import android.widget.GridLayout;
import android.widget.Toast;

import androidx.annotation.NonNull;

import com.google.android.material.button.MaterialButton;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.FieldValue;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import com.ssr.hunger.delivery.R;
import com.ssr.hunger.delivery.utils.Constants;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

public class VkycSlotDialog extends Dialog {

    private MaterialButton btnSelectDate;
    private GridLayout gridTimeSlots;
    private MaterialButton btnConfirmBooking, btnJoinCall, btnCancel;

    private Calendar selectedDate;
    private String selectedTimeSlot = null;
    private ListenerRegistration autoDismissListener;

    private final String[] availableSlots = {
            "10:00 AM", "11:00 AM", "12:00 PM",
            "02:00 PM", "03:00 PM", "04:00 PM"
    };

    public VkycSlotDialog(@NonNull Context context) {
        super(context);
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        setContentView(R.layout.dialog_vkyc_slot);

        Window window = getWindow();
        if (window != null) {
            window.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            window.setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            window.setGravity(Gravity.CENTER);
        }

        btnSelectDate = findViewById(R.id.btn_select_date);
        gridTimeSlots = findViewById(R.id.grid_time_slots);
        btnConfirmBooking = findViewById(R.id.btn_confirm_booking);
        btnJoinCall = findViewById(R.id.btn_join_call);
        btnCancel = findViewById(R.id.btn_cancel);

        selectedDate = Calendar.getInstance(); // Auto fill today
        updateDateButtonText();

        btnSelectDate.setOnClickListener(v -> openDatePicker());
        btnCancel.setOnClickListener(v -> dismiss());

        btnConfirmBooking.setOnClickListener(v -> confirmBooking());
        
        btnJoinCall.setOnClickListener(v -> {
            try {
                android.content.Intent intent = new android.content.Intent(
                        getContext(), com.ssr.hunger.delivery.activities.VkycVideoCallActivity.class);
                intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            } catch (Exception e) {
                android.widget.Toast.makeText(getContext(),
                        "Unable to open Video KYC. Please try again.", android.widget.Toast.LENGTH_SHORT).show();
            }
            dismiss();
        });

        populateTimeSlots();
        setupAutoDismissListener();
    }

    private void setupAutoDismissListener() {
        String uid = FirebaseAuth.getInstance().getUid();
        if (uid == null) return;

        autoDismissListener = FirebaseFirestore.getInstance()
                .collection("kycVideoCalls")
                .document(uid)
                .addSnapshotListener((snapshot, error) -> {
                    if (error != null || snapshot == null || !snapshot.exists()) return;
                    String status = snapshot.getString("status");
                    Boolean vkycCompleted = snapshot.getBoolean("vkycCompleted");
                    if ("completed".equalsIgnoreCase(status) || Boolean.TRUE.equals(vkycCompleted)) {
                        if (isShowing()) dismiss();
                    }
                });
    }

    @Override
    protected void onStop() {
        super.onStop();
        if (autoDismissListener != null) {
            autoDismissListener.remove();
            autoDismissListener = null;
        }
    }

    private void updateDateButtonText() {
        SimpleDateFormat sdf = new SimpleDateFormat("EEE, MMM dd, yyyy", Locale.getDefault());
        btnSelectDate.setText(sdf.format(selectedDate.getTime()));
    }

    private void openDatePicker() {
        DatePickerDialog dialog = new DatePickerDialog(getContext(), (view, year, month, dayOfMonth) -> {
            selectedDate.set(Calendar.YEAR, year);
            selectedDate.set(Calendar.MONTH, month);
            selectedDate.set(Calendar.DAY_OF_MONTH, dayOfMonth);
            updateDateButtonText();
            
            // Reset selection when date changes
            selectedTimeSlot = null;
            btnConfirmBooking.setEnabled(false);
            populateTimeSlots();
            
        }, selectedDate.get(Calendar.YEAR), selectedDate.get(Calendar.MONTH), selectedDate.get(Calendar.DAY_OF_MONTH));
        
        dialog.getDatePicker().setMinDate(System.currentTimeMillis() - 1000);
        dialog.show();
    }

    private void populateTimeSlots() {
        gridTimeSlots.removeAllViews();
        for (String slot : availableSlots) {
            MaterialButton slotButton = new MaterialButton(getContext(), null, com.google.android.material.R.attr.materialButtonOutlinedStyle);
            slotButton.setText(slot);
            slotButton.setCornerRadius(16);
            
            GridLayout.LayoutParams params = new GridLayout.LayoutParams();
            params.width = 0;
            params.height = ViewGroup.LayoutParams.WRAP_CONTENT;
            params.columnSpec = GridLayout.spec(GridLayout.UNDEFINED, 1f);
            params.setMargins(8, 8, 8, 8);
            slotButton.setLayoutParams(params);

            if (slot.equals(selectedTimeSlot)) {
                slotButton.setBackgroundColor(getContext().getResources().getColor(R.color.primary_light));
                slotButton.setTextColor(getContext().getResources().getColor(R.color.white));
            } else {
                slotButton.setBackgroundColor(Color.TRANSPARENT);
                slotButton.setTextColor(getContext().getResources().getColor(R.color.text_primary));
            }

            slotButton.setOnClickListener(v -> {
                selectedTimeSlot = slot;
                btnConfirmBooking.setEnabled(true);
                populateTimeSlots(); // Refresh UI to show selected state
            });

            gridTimeSlots.addView(slotButton);
        }
    }

    private void confirmBooking() {
        if (selectedTimeSlot == null) return;
        
        btnConfirmBooking.setEnabled(false);
        btnConfirmBooking.setText("Booking...");
        
        String uid = FirebaseAuth.getInstance().getUid();
        if (uid == null) return;
        
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault());
        String dateStr = sdf.format(selectedDate.getTime());
        
        Map<String, Object> request = new HashMap<>();
        request.put("partnerId", uid);
        request.put("requestedDate", dateStr);
        request.put("requestedTimeSlot", selectedTimeSlot);
        request.put("status", "pending");
        request.put("createdAt", FieldValue.serverTimestamp());
        
        FirebaseFirestore.getInstance().collection("vkyc_requests").document(uid)
            .set(request)
            .addOnSuccessListener(aVoid -> {
                com.ssr.hunger.delivery.utils.ToastUtils.showToast(getContext(), "V-KYC Slot Booked successfully. Our admin will connect with you.", Toast.LENGTH_LONG);
                dismiss();
            })
            .addOnFailureListener(e -> {
                com.ssr.hunger.delivery.utils.ToastUtils.showToast(getContext(), "Failed to book slot: " + e.getMessage(), Toast.LENGTH_SHORT);
                btnConfirmBooking.setEnabled(true);
                btnConfirmBooking.setText("Confirm Booking");
            });
    }
}
