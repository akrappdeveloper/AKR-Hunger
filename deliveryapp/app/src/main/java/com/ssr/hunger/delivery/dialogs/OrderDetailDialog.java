package com.ssr.hunger.delivery.dialogs;

import android.app.Dialog;
import android.content.Context;
import android.os.Bundle;
import android.view.Window;
import android.widget.TextView;

import androidx.annotation.NonNull;

import com.google.android.material.button.MaterialButton;
import com.ssr.hunger.delivery.R;
import com.ssr.hunger.delivery.models.DeliveryOrder;
import com.ssr.hunger.delivery.utils.Constants;
import com.ssr.hunger.delivery.utils.LocationUtils;

public class OrderDetailDialog extends Dialog {

    private final DeliveryOrder order;

    public OrderDetailDialog(@NonNull Context context, DeliveryOrder order) {
        super(context);
        this.order = order;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        setContentView(R.layout.dialog_order_detail);

        if (getWindow() != null) {
            getWindow().setBackgroundDrawableResource(android.R.color.transparent);
        }

        if (order == null) {
            dismiss();
            return;
        }

        TextView tvOrderId = findViewById(R.id.tv_detail_order_id);
        TextView tvOrderDate = findViewById(R.id.tv_detail_order_date);
        TextView tvStatusBadge = findViewById(R.id.tv_detail_status_badge);

        TextView tvRestaurantName = findViewById(R.id.tv_detail_restaurant_name);
        TextView tvRestaurantAddress = findViewById(R.id.tv_detail_restaurant_address);

        TextView tvCustomerName = findViewById(R.id.tv_detail_customer_name);
        TextView tvCustomerAddress = findViewById(R.id.tv_detail_customer_address);

        TextView tvEarning = findViewById(R.id.tv_detail_earning_amount);
        TextView tvTip = findViewById(R.id.tv_detail_tip_amount);
        TextView tvPayment = findViewById(R.id.tv_detail_payment_method);

        MaterialButton btnClose = findViewById(R.id.btn_close_order_detail);

        tvOrderId.setText(order.getFormattedOrderId());
        tvOrderDate.setText(LocationUtils.formatDateTime(order.getDeliveredAt() != null ? order.getDeliveredAt() : order.getCreatedAt()));

        String status = order.getStatus() != null ? order.getStatus().toUpperCase() : "DELIVERED";
        tvStatusBadge.setText(status);

        if (Constants.STATUS_CANCELLED.equalsIgnoreCase(status)) {
            tvStatusBadge.setBackgroundResource(R.drawable.bg_pill_error_soft);
            tvStatusBadge.setTextColor(getContext().getResources().getColor(R.color.error));
        } else {
            tvStatusBadge.setBackgroundResource(R.drawable.bg_pill_emerald_soft);
            tvStatusBadge.setTextColor(getContext().getResources().getColor(R.color.veg_green));
        }

        tvRestaurantName.setText(order.getRestaurantName());
        tvRestaurantAddress.setText(order.getRestaurantAddress());

        tvCustomerName.setText("Drop: " + order.getCustomerName());
        tvCustomerAddress.setText(order.getFullDeliveryAddress());

        tvEarning.setText("+" + LocationUtils.formatCurrency(order.getEstimatedEarning()));
        tvTip.setText("+" + LocationUtils.formatCurrency(order.getTipAmount()));

        boolean isCod = "cod".equalsIgnoreCase(order.getPaymentMethod());
        tvPayment.setText(isCod ? "Cash on Delivery (₹" + (int) Math.round(order.getTotalAmount()) + ")" : "Online Paid");

        btnClose.setOnClickListener(v -> dismiss());
    }
}
