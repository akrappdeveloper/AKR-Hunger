package com.ssr.hunger.activities;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.TextView;
import android.widget.Toast;
import com.ssr.hunger.R;
import com.ssr.hunger.models.Order;
import com.ssr.hunger.models.OrderItem;
import com.ssr.hunger.utils.Constants;
import com.google.firebase.Timestamp;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Order Detail Activity - mirrors the web app's orders/[id] page.
 * Shows real-time order status, items, and delivery tracking.
 * Extends BaseActivity for Realtime Analytics, Status Breadcrumbs, and Crashlytics.
 */
public class OrderDetailActivity extends BaseActivity {

    private FirebaseFirestore db;
    private ListenerRegistration orderListener;
    private String orderId;
    private String lastStatus = "";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_order_detail);

        db = FirebaseFirestore.getInstance();
        orderId = getIntent().getStringExtra(Constants.EXTRA_ORDER_ID);
        if (orderId == null) {
            recordException("OrderDetail_null_id", new IllegalArgumentException("Order ID is null"));
            finish();
            return;
        }

        findViewById(R.id.btn_back).setOnClickListener(v -> finish());
        loadOrder();
    }

    private void loadOrder() {
        logBreadcrumb("Listening to order updates: " + orderId);
        orderListener = db.collection(Constants.COLLECTION_ORDERS).document(orderId)
                .addSnapshotListener((doc, error) -> {
                    if (error != null) {
                        recordException("orderListener_error", error);
                        return;
                    }
                    if (doc == null || !doc.exists()) return;

                    Order order = doc.toObject(Order.class);
                    if (order == null) return;
                    order.setId(doc.getId());
                    if (doc.getTimestamp("createdAt") != null) {
                        order.setCreatedAt(doc.getTimestamp("createdAt").toDate());
                    }

                    // Track status transitions
                    String newStatus = order.getStatus() != null ? order.getStatus() : "";
                    if (!newStatus.equals(lastStatus)) {
                        logBreadcrumb("Order #" + orderId.substring(0, Math.min(8, orderId.length())) + " status: " + newStatus);
                        if (!lastStatus.isEmpty() && order.getCustomerId() != null) {
                            com.ssr.hunger.utils.NotificationHelper.sendOrderNotification(
                                    OrderDetailActivity.this,
                                    order.getCustomerId(),
                                    orderId,
                                    order.getRestaurantName(),
                                    order.getTotal(),
                                    newStatus
                            );
                        }
                        lastStatus = newStatus;
                    }

                    populateUI(order);
                });
    }

    private void populateUI(Order order) {
        String shortId = order.getId().length() >= 8 ? order.getId().substring(0, 8).toUpperCase() : order.getId();
        ((TextView) findViewById(R.id.tv_order_id)).setText("Order #" + shortId);
        ((TextView) findViewById(R.id.tv_restaurant)).setText(order.getRestaurantName() != null ? order.getRestaurantName() : "Restaurant");
        TextView tvStatus = findViewById(R.id.tv_status);
        if (tvStatus != null) {
            tvStatus.setText(order.getStatusDisplay());
            String st = order.getStatus() != null ? order.getStatus().toLowerCase() : "";
            if ("delivered".equals(st)) {
                tvStatus.setTextColor(getResources().getColor(R.color.success, getTheme()));
            } else if ("cancelled".equals(st)) {
                tvStatus.setTextColor(getResources().getColor(R.color.error, getTheme()));
            } else {
                tvStatus.setTextColor(getResources().getColor(R.color.primary, getTheme()));
            }
        }

        ((TextView) findViewById(R.id.tv_total)).setText(String.format(Locale.getDefault(), "₹%.0f", order.getTotal()));
        ((TextView) findViewById(R.id.tv_payment)).setText(order.getPaymentMethod() != null ? order.getPaymentMethod().toUpperCase() : "COD");

        if (order.getCreatedAt() != null) {
            SimpleDateFormat sdf = new SimpleDateFormat("dd MMM yyyy, hh:mm a", Locale.getDefault());
            ((TextView) findViewById(R.id.tv_date)).setText(sdf.format(order.getCreatedAt()));
        }

        // Animate hero card entry once
        View cardHero = findViewById(R.id.card_order_hero);
        if (cardHero != null && cardHero.getTag() == null) {
            cardHero.setTag("animated");
            cardHero.setAlpha(0f);
            cardHero.setTranslationY(40f);
            cardHero.animate().alpha(1f).translationY(0f).setDuration(400).start();
        }

        // Track Live Order CTA
        View btnTrack = findViewById(R.id.btn_track_order);
        if (btnTrack != null) {
            String st = order.getStatus() != null ? order.getStatus().toLowerCase() : "";
            if ("delivered".equals(st) || "cancelled".equals(st)) {
                btnTrack.setVisibility(View.GONE);
                btnTrack.clearAnimation();
            } else {
                btnTrack.setVisibility(View.VISIBLE);
                try {
                    android.view.animation.Animation pulse = android.view.animation.AnimationUtils.loadAnimation(this, R.anim.pulse_subtle);
                    btnTrack.startAnimation(pulse);
                } catch (Exception ignored) {}
                btnTrack.setOnClickListener(v -> {
                    android.content.Intent intent = new android.content.Intent(this, OrderTrackingActivity.class);
                    intent.putExtra(OrderTrackingActivity.EXTRA_ORDER_ID, order.getId());
                    startActivity(intent);
                });
            }
        }

        // Support button
        View btnHelp = findViewById(R.id.btn_help);
        if (btnHelp != null) {
            btnHelp.setOnClickListener(v -> {
                android.content.Intent intent = new android.content.Intent(this, SupportActivity.class);
                intent.putExtra(Constants.EXTRA_ORDER_ID, order.getId());
                startActivity(intent);
            });
        }

        // Rate Order button
        View btnRate = findViewById(R.id.btn_rate_order);
        if (btnRate != null) {
            String st = order.getStatus() != null ? order.getStatus().toLowerCase() : "";
            if ("delivered".equals(st)) {
                btnRate.setVisibility(View.VISIBLE);
                btnRate.setOnClickListener(v -> {
                    android.content.Intent intent = new android.content.Intent(this, WriteReviewActivity.class);
                    intent.putExtra(WriteReviewActivity.EXTRA_ORDER_ID, order.getId());
                    intent.putExtra(WriteReviewActivity.EXTRA_RESTAURANT_ID, order.getRestaurantId());
                    intent.putExtra(WriteReviewActivity.EXTRA_RESTAURANT_NAME, order.getRestaurantName());
                    startActivity(intent);
                });
            } else {
                btnRate.setVisibility(View.GONE);
            }
        }

        // Cancel Order button — only shown in cancellable window
        View btnCancel = findViewById(R.id.btn_cancel_order);
        if (btnCancel != null) {
            String st = order.getStatus() != null ? order.getStatus().toLowerCase() : "";
            boolean nonCancellable = "preparing".equals(st) || "ready".equals(st)
                    || "out_for_delivery".equals(st) || "delivered".equals(st) || "cancelled".equals(st);

            // Check 5-minute window (UI hint only; backend enforces it)
            boolean windowOpen = false;
            Timestamp ts = null; // not from Order model directly, set by listener above
            if (order.getCreatedAt() != null) {
                long elapsed = System.currentTimeMillis() - order.getCreatedAt().getTime();
                windowOpen = elapsed < (5 * 60 * 1000L);
            }

            if (!nonCancellable && windowOpen) {
                btnCancel.setVisibility(View.VISIBLE);
                btnCancel.setOnClickListener(v -> {
                    Intent intent = new Intent(this, OrderCancellationActivity.class);
                    intent.putExtra(Constants.EXTRA_ORDER_ID, order.getId());
                    startActivityForResult(intent, 1001);
                });
            } else if ("preparing".equals(st)) {
                btnCancel.setVisibility(View.GONE);
                // Show an info text below
                View tvPreparing = findViewById(R.id.tv_preparing_message);
                if (tvPreparing != null) tvPreparing.setVisibility(View.VISIBLE);
            } else {
                btnCancel.setVisibility(View.GONE);
            }
        }

        // Delivery Verification OTP Card
        String otp = order.getDeliveryOtp();
        String st = order.getStatus() != null ? order.getStatus().toLowerCase() : "";
        if ((otp == null || otp.trim().isEmpty()) && !"delivered".equals(st) && !"cancelled".equals(st)) {
            String oid = order.getId() != null ? order.getId() : "";
            int code = Math.abs(oid.hashCode() % 9000) + 1000;
            otp = String.valueOf(code);
            order.setDeliveryOtp(otp);
            db.collection(Constants.COLLECTION_ORDERS).document(order.getId()).update("deliveryOtp", otp);
        }

        View cardOtp = findViewById(R.id.card_delivery_otp);
        TextView tvOtp = findViewById(R.id.tv_delivery_otp);
        View btnCopyOtp = findViewById(R.id.btn_copy_otp);

        if (cardOtp != null) {
            if ("delivered".equals(st) || "cancelled".equals(st)) {
                cardOtp.setVisibility(View.GONE);
            } else {
                cardOtp.setVisibility(View.VISIBLE);
                if (tvOtp != null) tvOtp.setText(otp != null ? otp : "----");
                if (btnCopyOtp != null && otp != null) {
                    final String finalOtp = otp;
                    btnCopyOtp.setOnClickListener(v -> {
                        android.content.ClipboardManager clipboard = (android.content.ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
                        android.content.ClipData clip = android.content.ClipData.newPlainText("Delivery OTP", finalOtp);
                        if (clipboard != null) clipboard.setPrimaryClip(clip);
                        Toast.makeText(OrderDetailActivity.this, "Delivery OTP copied: " + finalOtp, Toast.LENGTH_SHORT).show();
                    });
                }
            }
        }

        // Items
        StringBuilder itemsText = new StringBuilder();
        double baseSubtotal = 0.0;
        double sizeExtrasTotal = 0.0;
        double addOnsExtrasTotal = 0.0;
        if (order.getItems() != null) {
            for (OrderItem item : order.getItems()) {
                int qty = Math.max(1, item.getQuantity());
                baseSubtotal += item.getEffectiveBasePrice() * qty;
                sizeExtrasTotal += item.getSizeExtra() * qty;
                addOnsExtrasTotal += item.getAddOnsTotal() * qty;

                itemsText.append(qty).append("x ").append(item.getName())
                        .append(" - ₹").append(String.format(Locale.getDefault(), "%.2f", item.getPrice() * qty));
                String cust = item.getCustomizationSummary();
                if (cust != null && !cust.isEmpty()) {
                    itemsText.append("\n   ").append(cust);
                }
                itemsText.append("\n");
            }
        }
        ((TextView) findViewById(R.id.tv_items)).setText(itemsText.toString().trim());

        boolean hasPricedExtras = (sizeExtrasTotal + addOnsExtrasTotal) > 0;
        View rowBaseSub = findViewById(R.id.row_order_base_subtotal);
        TextView tvBaseSub = findViewById(R.id.tv_order_base_subtotal);
        View rowSizeExt = findViewById(R.id.row_order_size_extras);
        TextView tvSizeExt = findViewById(R.id.tv_order_size_extras);
        View rowAddOnsExt = findViewById(R.id.row_order_addons_extras);
        TextView tvAddOnsExt = findViewById(R.id.tv_order_addons_extras);

        if (rowBaseSub != null) rowBaseSub.setVisibility(hasPricedExtras ? View.VISIBLE : View.GONE);
        if (tvBaseSub != null && hasPricedExtras) tvBaseSub.setText(String.format(Locale.getDefault(), "₹%.2f", baseSubtotal));
        if (rowSizeExt != null) rowSizeExt.setVisibility(sizeExtrasTotal > 0 ? View.VISIBLE : View.GONE);
        if (tvSizeExt != null && sizeExtrasTotal > 0) tvSizeExt.setText(String.format(Locale.getDefault(), "+₹%.2f", sizeExtrasTotal));
        if (rowAddOnsExt != null) rowAddOnsExt.setVisibility(addOnsExtrasTotal > 0 ? View.VISIBLE : View.GONE);
        if (tvAddOnsExt != null && addOnsExtrasTotal > 0) tvAddOnsExt.setText(String.format(Locale.getDefault(), "+₹%.2f", addOnsExtrasTotal));

        // Full GST Bill Summary
        double subtotal = order.getSubtotal();
        double packaging = order.getPackagingCharges();
        double platform = order.getPlatformFee();
        double taxable = order.getTaxableValue() > 0 ? order.getTaxableValue() : subtotal;
        double cgst = order.getCgst() > 0 ? order.getCgst() : Math.round((order.getTaxes() / 2.0) * 100.0) / 100.0;
        double sgst = order.getSgst() > 0 ? order.getSgst() : Math.round((order.getTaxes() / 2.0) * 100.0) / 100.0;

        // Delivery Charge calculation: ₹40 standard single item/quantity, ₹60 for multi-quantity or multi-items
        double delivery = order.getDeliveryCharge();
        if (delivery <= 0) {
            int totalQty = 0;
            if (order.getItems() != null) {
                for (OrderItem item : order.getItems()) {
                    totalQty += item.getQuantity();
                }
            }
            delivery = totalQty > 1 ? 60.0 : 40.0;
            order.setDeliveryCharge(delivery);
        }

        double total = order.getTotal();
        // If total was recorded without deliveryCharge (e.g. total <= subtotal + taxes), ensure total includes delivery fee
        if (total <= (subtotal + cgst + sgst) && delivery > 0) {
            total = subtotal + packaging + platform + delivery + (cgst + sgst) - order.getDiscountAmount();
        }

        double amountPaid = order.getAmountPaid() > 0 ? order.getAmountPaid() : ("cod".equalsIgnoreCase(order.getPaymentMethod()) ? 0.0 : total);
        double balanceDue = order.getBalanceDue() > 0 ? order.getBalanceDue() : ("cod".equalsIgnoreCase(order.getPaymentMethod()) ? total : 0.0);

        ((TextView) findViewById(R.id.tv_subtotal)).setText(String.format(Locale.getDefault(), "₹%.2f", subtotal));
        TextView tvPackaging = findViewById(R.id.tv_packaging_charges);
        if (tvPackaging != null) tvPackaging.setText(String.format(Locale.getDefault(), "₹%.2f", packaging));
        ((TextView) findViewById(R.id.tv_delivery)).setText(String.format(Locale.getDefault(), "₹%.2f", delivery));
        TextView tvPlatform = findViewById(R.id.tv_platform_fee);
        if (tvPlatform != null) tvPlatform.setText(String.format(Locale.getDefault(), "₹%.2f", platform));
        TextView tvTaxable = findViewById(R.id.tv_taxable_value);
        if (tvTaxable != null) tvTaxable.setText(String.format(Locale.getDefault(), "₹%.2f", taxable));
        TextView tvCgst = findViewById(R.id.tv_cgst);
        if (tvCgst != null) tvCgst.setText(String.format(Locale.getDefault(), "₹%.2f", cgst));
        TextView tvSgst = findViewById(R.id.tv_sgst);
        if (tvSgst != null) tvSgst.setText(String.format(Locale.getDefault(), "₹%.2f", sgst));
        ((TextView) findViewById(R.id.tv_total)).setText(String.format(Locale.getDefault(), "₹%.2f", total));
        TextView tvPaid = findViewById(R.id.tv_amount_paid);
        if (tvPaid != null) tvPaid.setText(String.format(Locale.getDefault(), "₹%.2f", amountPaid));
        TextView tvDue = findViewById(R.id.tv_balance_due);
        if (tvDue != null) tvDue.setText(String.format(Locale.getDefault(), "₹%.2f", balanceDue));

        // Setup Restaurant Contact & Calling Card
        setupRestaurantCallCard(order);

        // Setup Delivery Partner / Valet Calling Card
        setupDeliveryPartnerCard(order);
    }

    private void setupRestaurantCallCard(Order order) {
        TextView tvName = findViewById(R.id.tv_detail_restaurant_name);
        TextView tvAddr = findViewById(R.id.tv_detail_restaurant_address);
        TextView tvPhone = findViewById(R.id.tv_detail_restaurant_phone);
        View btnCall = findViewById(R.id.btn_call_restaurant);

        final String restName = order.getRestaurantName() != null ? order.getRestaurantName() : "Restaurant";
        if (tvName != null) tvName.setText(restName);

        String existingPhone = order.getRestaurantPhone();
        String existingAddr = order.getRestaurantAddress();

        View btnChat = findViewById(R.id.btn_chat_restaurant);
        if (btnChat != null) {
            btnChat.setOnClickListener(v -> {
                Intent chatIntent = new Intent(this, ChatActivity.class);
                chatIntent.putExtra(ChatActivity.EXTRA_ORDER_ID, order.getId());
                chatIntent.putExtra(ChatActivity.EXTRA_COUNTERPART_ROLE, "restaurant");
                chatIntent.putExtra(ChatActivity.EXTRA_COUNTERPART_NAME, restName);
                chatIntent.putExtra(ChatActivity.EXTRA_PHONE, existingPhone);
                startActivity(chatIntent);
            });
        }

        if (existingPhone != null && !existingPhone.isEmpty()) {
            if (tvPhone != null) tvPhone.setText("📞 " + existingPhone);
            if (btnCall != null) {
                btnCall.setOnClickListener(v -> callPhoneNumber(existingPhone, restName));
            }
        }
        if (existingAddr != null && !existingAddr.isEmpty()) {
            if (tvAddr != null) tvAddr.setText(existingAddr);
        }

        // Fetch up-to-date phone and address from Firestore restaurants collection
        if (order.getRestaurantId() != null && !order.getRestaurantId().isEmpty()) {
            db.collection(Constants.COLLECTION_RESTAURANTS).document(order.getRestaurantId())
                    .get()
                    .addOnSuccessListener(snap -> {
                        if (snap == null || !snap.exists()) return;
                        String phone = snap.getString("phone");
                        String address = snap.getString("address");
                        if (address == null || address.isEmpty()) address = snap.getString("street");
                        if (address == null || address.isEmpty()) address = snap.getString("city");

                        final String finalPhone = (phone != null && !phone.isEmpty()) ? phone : existingPhone;
                        final String finalAddr = (address != null && !address.isEmpty()) ? address : existingAddr;

                        if (tvPhone != null && finalPhone != null && !finalPhone.isEmpty()) {
                            tvPhone.setText("📞 " + finalPhone);
                        }
                        if (tvAddr != null && finalAddr != null && !finalAddr.isEmpty()) {
                            tvAddr.setText(finalAddr);
                        }
                        if (btnCall != null && finalPhone != null && !finalPhone.isEmpty()) {
                            btnCall.setOnClickListener(v -> callPhoneNumber(finalPhone, restName));
                        }
                    });
        }
    }

    private void setupDeliveryPartnerCard(Order order) {
        TextView tvDriverName = findViewById(R.id.tv_delivery_person);
        TextView tvVehicle = findViewById(R.id.tv_detail_driver_vehicle);
        TextView tvPhone = findViewById(R.id.tv_detail_driver_phone);
        View btnCallDriver = findViewById(R.id.btn_call_driver);

        String driverName = order.getDeliveryPersonName();
        String driverPhone = order.getDeliveryPersonPhone();

        if (driverName != null && !driverName.trim().isEmpty()) {
            if (tvDriverName != null) tvDriverName.setText(driverName);
            if (driverPhone != null && !driverPhone.trim().isEmpty()) {
                if (tvPhone != null) {
                    tvPhone.setVisibility(View.VISIBLE);
                    tvPhone.setText("📞 " + driverPhone);
                }
                if (btnCallDriver != null) {
                    btnCallDriver.setVisibility(View.VISIBLE);
                    btnCallDriver.setOnClickListener(v -> callPhoneNumber(driverPhone, driverName));
                }

                View btnChatDriver = findViewById(R.id.btn_chat_driver);
                if (btnChatDriver != null) {
                    btnChatDriver.setVisibility(View.VISIBLE);
                    btnChatDriver.setOnClickListener(v -> {
                        Intent chatIntent = new Intent(this, ChatActivity.class);
                        chatIntent.putExtra(ChatActivity.EXTRA_ORDER_ID, order.getId());
                        chatIntent.putExtra(ChatActivity.EXTRA_COUNTERPART_ROLE, "delivery");
                        chatIntent.putExtra(ChatActivity.EXTRA_COUNTERPART_NAME, driverName);
                        chatIntent.putExtra(ChatActivity.EXTRA_PHONE, driverPhone);
                        startActivity(chatIntent);
                    });
                }
            } else {
                if (tvPhone != null) tvPhone.setVisibility(View.GONE);
                if (btnCallDriver != null) btnCallDriver.setVisibility(View.GONE);
            }
        } else {
            if (tvDriverName != null) tvDriverName.setText("Assigning nearest valet...");
            if (tvPhone != null) tvPhone.setVisibility(View.GONE);
            if (btnCallDriver != null) btnCallDriver.setVisibility(View.GONE);
        }
    }

    private void callPhoneNumber(String phone, String name) {
        if (phone == null || phone.trim().isEmpty()) {
            Toast.makeText(this, "Contact number not available for " + (name != null ? name : "partner"), Toast.LENGTH_SHORT).show();
            return;
        }
        final String cleanPhone = phone.trim();
        requirePhone(
                () -> startActivity(new Intent(Intent.ACTION_CALL, Uri.parse("tel:" + cleanPhone))),
                (isPermanent) -> startActivity(new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + cleanPhone)))
        );
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (orderListener != null) orderListener.remove();
    }

    @Override
    protected String getScreenName() {
        return "OrderDetail";
    }
}
