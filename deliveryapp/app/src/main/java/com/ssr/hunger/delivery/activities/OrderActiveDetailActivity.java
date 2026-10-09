package com.ssr.hunger.delivery.activities;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;

import com.google.android.material.button.MaterialButton;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.FieldValue;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import com.ssr.hunger.delivery.R;
import com.ssr.hunger.delivery.dialogs.OtpVerificationDialog;
import com.ssr.hunger.delivery.dialogs.ProofOfDeliveryDialog;
import com.ssr.hunger.delivery.models.DeliveryOrder;
import com.ssr.hunger.delivery.models.OrderItem;
import com.ssr.hunger.delivery.services.DriverLocationService;
import com.ssr.hunger.delivery.utils.AnalyticsHelper;
import com.ssr.hunger.delivery.utils.Constants;
import com.ssr.hunger.delivery.utils.LocationUtils;

import java.util.HashMap;
import java.util.Map;

public class OrderActiveDetailActivity extends AppCompatActivity {

    private FirebaseAuth auth;
    private FirebaseFirestore db;
    private String orderId;

    private TextView tvOrderId, tvStage, tvEarning, tvPaymentInfo;
    private TextView tvRestaurantName, tvRestaurantAddress;
    private TextView tvCustomerName, tvCustomerAddress, tvInstructions;
    private TextView tvItemsList;

    private MaterialButton btnCallPickup, btnChatPickup, btnNavigatePickup;
    private MaterialButton btnCallDrop, btnChatDrop, btnNavigateDrop;
    private MaterialButton btnActionPickup, btnActionProof, btnActionDeliver, btnActionReturn;

    private DeliveryOrder order;
    private ListenerRegistration orderListener;
    private String deliveryProofNote = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_order_active_detail);

        auth = FirebaseAuth.getInstance();
        db = FirebaseFirestore.getInstance();

        orderId = getIntent().getStringExtra(Constants.EXTRA_ORDER_ID);
        if (orderId == null) {
            Toast.makeText(this, "Order ID missing", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        initViews();
        listenToOrder();
    }

    private void initViews() {
        Toolbar toolbar = findViewById(R.id.toolbar_active_detail);
        setSupportActionBar(toolbar);
        if (getSupportActionBar() != null) {
            getSupportActionBar().setDisplayHomeAsUpEnabled(true);
        }
        toolbar.setNavigationOnClickListener(v -> finish());

        tvOrderId = findViewById(R.id.tv_detail_order_id);
        tvStage = findViewById(R.id.tv_detail_stage);
        tvEarning = findViewById(R.id.tv_detail_earning);
        tvPaymentInfo = findViewById(R.id.tv_detail_payment_info);

        tvRestaurantName = findViewById(R.id.tv_detail_restaurant_name);
        tvRestaurantAddress = findViewById(R.id.tv_detail_restaurant_address);
        btnCallPickup = findViewById(R.id.btn_call_pickup);
        btnChatPickup = findViewById(R.id.btn_chat_pickup);
        btnNavigatePickup = findViewById(R.id.btn_navigate_pickup);

        tvCustomerName = findViewById(R.id.tv_detail_customer_name);
        tvCustomerAddress = findViewById(R.id.tv_detail_customer_address);
        tvInstructions = findViewById(R.id.tv_detail_instructions);
        btnCallDrop = findViewById(R.id.btn_call_drop);
        btnChatDrop = findViewById(R.id.btn_chat_drop);
        btnNavigateDrop = findViewById(R.id.btn_navigate_drop);

        tvItemsList = findViewById(R.id.tv_detail_items_list);

        btnActionPickup = findViewById(R.id.btn_action_pickup);
        btnActionProof = findViewById(R.id.btn_action_proof);
        btnActionDeliver = findViewById(R.id.btn_action_deliver);
        btnActionReturn = findViewById(R.id.btn_action_return);

        btnCallPickup.setOnClickListener(v -> callPhone(order != null ? order.getRestaurantPhone() : null));
        btnChatPickup.setOnClickListener(v -> {
            Intent intent = new Intent(this, RiderChatActivity.class);
            intent.putExtra(RiderChatActivity.EXTRA_ORDER_ID, orderId);
            if (order != null) {
                intent.putExtra(RiderChatActivity.EXTRA_ORDER_NUMBER, order.getFormattedOrderId());
                intent.putExtra(RiderChatActivity.EXTRA_COUNTERPART_NAME, order.getRestaurantName());
                intent.putExtra(RiderChatActivity.EXTRA_PHONE, order.getRestaurantPhone());
            }
            intent.putExtra(RiderChatActivity.EXTRA_COUNTERPART_ROLE, "restaurant");
            startActivity(intent);
        });
        btnNavigatePickup.setOnClickListener(v -> navigateTo(
                order != null ? order.getRestaurantLatitude() : 0,
                order != null ? order.getRestaurantLongitude() : 0,
                order != null ? order.getRestaurantName() : "Restaurant Pickup",
                order != null ? order.getRestaurantAddress() : null
        ));

        btnCallDrop.setOnClickListener(v -> callPhone(order != null ? order.getCustomerPhone() : null));
        btnChatDrop.setOnClickListener(v -> {
            Intent intent = new Intent(this, RiderChatActivity.class);
            intent.putExtra(RiderChatActivity.EXTRA_ORDER_ID, orderId);
            if (order != null) {
                intent.putExtra(RiderChatActivity.EXTRA_ORDER_NUMBER, order.getFormattedOrderId());
                intent.putExtra(RiderChatActivity.EXTRA_COUNTERPART_NAME, order.getCustomerName());
                intent.putExtra(RiderChatActivity.EXTRA_PHONE, order.getCustomerPhone());
            }
            intent.putExtra(RiderChatActivity.EXTRA_COUNTERPART_ROLE, "customer");
            startActivity(intent);
        });
        btnNavigateDrop.setOnClickListener(v -> navigateTo(
                order != null ? order.getDeliveryLatitude() : 0,
                order != null ? order.getDeliveryLongitude() : 0,
                order != null ? order.getCustomerName() : "Customer Drop",
                order != null ? order.getFullDeliveryAddress() : null
        ));

        btnActionPickup.setOnClickListener(v -> confirmPickup());

        btnActionProof.setOnClickListener(v -> {
            ProofOfDeliveryDialog dialog = new ProofOfDeliveryDialog(this, note -> {
                deliveryProofNote = note;
                btnActionProof.setText("✅ Proof Attached (" + note + ")");
                Toast.makeText(this, "Proof recorded", Toast.LENGTH_SHORT).show();
            });
            dialog.show();
        });

        btnActionDeliver.setOnClickListener(v -> showDeliveryOtpDialog());
        btnActionReturn.setOnClickListener(v -> showReturnOtpDialog());
    }

    private void listenToOrder() {
        orderListener = db.collection(Constants.COLLECTION_ORDERS)
                .document(orderId)
                .addSnapshotListener((snap, e) -> {
                    if (e != null || snap == null || !snap.exists()) return;

                    order = snap.toObject(DeliveryOrder.class);
                    if (order == null) return;
                    order.setId(snap.getId());

                    bindOrderData(order);
                });
    }

    private void bindOrderData(DeliveryOrder order) {
        tvOrderId.setText(order.getFormattedOrderId());
        tvEarning.setText("Earn: " + LocationUtils.formatCurrency(order.getEstimatedEarning()));

        String paymentInfo = "cod".equalsIgnoreCase(order.getPaymentMethod())
                ? "Collect Cash: " + LocationUtils.formatCurrency(order.getTotal())
                : "Paid Online";
        tvPaymentInfo.setText(paymentInfo);

        tvRestaurantName.setText(order.getRestaurantName());
        tvRestaurantAddress.setText(order.getRestaurantAddress());

        tvCustomerName.setText(order.getCustomerName());
        tvCustomerAddress.setText(order.getFullDeliveryAddress());

        if (order.getSpecialInstructions() != null && !order.getSpecialInstructions().isEmpty()) {
            tvInstructions.setVisibility(View.VISIBLE);
            tvInstructions.setText("Note: " + order.getSpecialInstructions());
        } else {
            tvInstructions.setVisibility(View.GONE);
        }

        // Build item text
        if (order.getItems() != null && !order.getItems().isEmpty()) {
            StringBuilder sb = new StringBuilder();
            for (OrderItem it : order.getItems()) {
                sb.append("• ").append(it.getQuantity()).append("x ").append(it.getName()).append("\n");
            }
            tvItemsList.setText(sb.toString().trim());
        } else {
            tvItemsList.setText("• Food Package");
        }

        // Configure stage actions
        String stage = order.getDeliveryStage();
        String status = order.getStatus();

        if (Constants.STATUS_CANCELLED.equalsIgnoreCase(status)) {
            tvStage.setText("Order Cancelled");
            tvStage.setTextColor(getResources().getColor(R.color.error));
            btnActionPickup.setVisibility(View.GONE);
            btnActionProof.setVisibility(View.GONE);
            btnActionDeliver.setVisibility(View.GONE);
            btnActionReturn.setVisibility(View.VISIBLE);
            return;
        }

        if (Constants.STATUS_DELIVERED.equalsIgnoreCase(status)) {
            tvStage.setText("Delivered Successfully");
            tvStage.setTextColor(getResources().getColor(R.color.veg_green));
            btnActionPickup.setVisibility(View.GONE);
            btnActionProof.setVisibility(View.GONE);
            btnActionDeliver.setVisibility(View.GONE);
            btnActionReturn.setVisibility(View.GONE);
            return;
        }

        if (Constants.STAGE_PICKED_UP.equalsIgnoreCase(stage)
                || Constants.STAGE_TO_CUSTOMER.equalsIgnoreCase(stage)
                || Constants.STAGE_ARRIVED.equalsIgnoreCase(stage)) {
            tvStage.setText("Delivering to Customer");
            btnActionPickup.setVisibility(View.GONE);
            btnActionProof.setVisibility(View.VISIBLE);
            btnActionDeliver.setVisibility(View.VISIBLE);
            btnActionReturn.setVisibility(View.GONE);
        } else {
            tvStage.setText("Pickup from Restaurant");
            btnActionPickup.setVisibility(View.VISIBLE);
            btnActionProof.setVisibility(View.GONE);
            btnActionDeliver.setVisibility(View.GONE);
            btnActionReturn.setVisibility(View.GONE);
        }
    }

    private void confirmPickup() {
        Map<String, Object> updates = new HashMap<>();
        updates.put("deliveryStage", Constants.STAGE_TO_CUSTOMER);
        updates.put("pickedUpAt", FieldValue.serverTimestamp());

        db.collection(Constants.COLLECTION_ORDERS)
                .document(orderId)
                .update(updates)
                .addOnSuccessListener(v -> {
                    AnalyticsHelper.getInstance(this).logFoodPickedUp(orderId);
                    Toast.makeText(this, "✅ Food picked up! Head over to customer drop location.", Toast.LENGTH_SHORT).show();
                    DriverLocationService.updateActiveOrder(this, orderId, true);
                })
                .addOnFailureListener(e -> Toast.makeText(this, "Failed: " + e.getMessage(), Toast.LENGTH_SHORT).show());
    }

    private void showDeliveryOtpDialog() {
        if (order == null) return;
        String expectedOtp = order.getDeliveryOtp();

        OtpVerificationDialog dialog = new OtpVerificationDialog(this, expectedOtp, false, otp -> {
            completeDelivery();
        });
        dialog.show();
    }

    private void completeDelivery() {
        if (auth.getCurrentUser() == null || order == null) return;
        String uid = auth.getCurrentUser().getUid();

        Map<String, Object> orderUpdates = new HashMap<>();
        orderUpdates.put("status", Constants.STATUS_DELIVERED);
        orderUpdates.put("deliveryStage", Constants.STAGE_DELIVERED_DONE);
        orderUpdates.put("deliveredAt", FieldValue.serverTimestamp());
        if (deliveryProofNote != null) {
            orderUpdates.put("proofNote", deliveryProofNote);
        }

        db.collection(Constants.COLLECTION_ORDERS)
                .document(orderId)
                .update(orderUpdates)
                .addOnSuccessListener(v -> {
                    double earned = order.getEstimatedEarning();
                    Map<String, Object> driverUpdates = new HashMap<>();
                    driverUpdates.put("todayEarnings", FieldValue.increment(earned));
                    driverUpdates.put("totalEarnings", FieldValue.increment(earned));
                    driverUpdates.put("walletBalance", FieldValue.increment(earned));
                    driverUpdates.put("totalDeliveries", FieldValue.increment(1));

                    // If COD order, record COD cash in hand
                    if ("cod".equalsIgnoreCase(order.getPaymentMethod())) {
                        driverUpdates.put("codCashInHand", FieldValue.increment(order.getTotal()));
                    }

                    db.collection(Constants.COLLECTION_DELIVERY_PERSONS)
                            .document(uid)
                            .update(driverUpdates);

                    // Record transaction
                    Map<String, Object> tx = new HashMap<>();
                    tx.put("driverId", uid);
                    tx.put("orderId", orderId);
                    tx.put("amount", earned);
                    tx.put("type", "earning");
                    tx.put("createdAt", FieldValue.serverTimestamp());
                    db.collection(Constants.COLLECTION_WALLET_TRANSACTIONS).add(tx);

                    AnalyticsHelper.getInstance(this).logOrderDelivered(orderId, earned, order.getPaymentMethod());

                    Toast.makeText(this, "🎉 Order Delivered! Earning +" + LocationUtils.formatCurrency(earned) + " credited.", Toast.LENGTH_LONG).show();

                    DriverLocationService.updateActiveOrder(this, null, false);
                    finish();
                })
                .addOnFailureListener(e -> Toast.makeText(this, "Failed to complete delivery: " + e.getMessage(), Toast.LENGTH_SHORT).show());
    }

    private void showReturnOtpDialog() {
        if (order == null) return;
        String expectedOtp = order.getReturnOtp();

        OtpVerificationDialog dialog = new OtpVerificationDialog(this, expectedOtp, true, otp -> {
            Map<String, Object> updates = new HashMap<>();
            updates.put("returnStatus", "returned");
            updates.put("returnedAt", FieldValue.serverTimestamp());

            db.collection(Constants.COLLECTION_ORDERS)
                    .document(orderId)
                    .update(updates)
                    .addOnSuccessListener(v -> {
                        Toast.makeText(this, "Food returned to restaurant successfully.", Toast.LENGTH_SHORT).show();
                        DriverLocationService.updateActiveOrder(this, null, false);
                        finish();
                    });
        });
        dialog.show();
    }

    private void callPhone(String phone) {
        if (phone != null && !phone.isEmpty()) {
            Intent callIntent = new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + phone));
            startActivity(callIntent);
        } else {
            Toast.makeText(this, "Phone number not available", Toast.LENGTH_SHORT).show();
        }
    }

    private void navigateTo(double lat, double lng, String targetName, String address) {
        Intent radarIntent = new Intent(this, LiveTrackingRadarActivity.class);
        radarIntent.putExtra(Constants.EXTRA_ORDER_ID, orderId);
        radarIntent.putExtra(Constants.EXTRA_DEST_LAT, lat);
        radarIntent.putExtra(Constants.EXTRA_DEST_LNG, lng);
        radarIntent.putExtra(Constants.EXTRA_DEST_NAME, targetName);
        radarIntent.putExtra(Constants.EXTRA_DEST_ADDRESS, address);
        startActivity(radarIntent);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (orderListener != null) orderListener.remove();
    }
}
