package com.ssr.hunger.activities;

import android.os.Bundle;
import android.text.TextUtils;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AlertDialog;
import com.google.android.material.bottomsheet.BottomSheetDialog;
import com.ssr.hunger.R;
import com.ssr.hunger.utils.Constants;
import com.ssr.hunger.utils.PerformanceHelper;
import com.google.firebase.Timestamp;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import com.google.firebase.firestore.Query;
import com.google.firebase.perf.metrics.Trace;
import com.razorpay.Checkout;
import com.razorpay.PaymentResultListener;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Wallet Activity - mirrors the web app's wallet page.
 * Features: real-time balance, add funds via Razorpay, withdrawal request, and transaction history.
 * Extends BaseActivity for Realtime Analytics, Performance profiling, and Crashlytics.
 */
public class WalletActivity extends BaseActivity implements PaymentResultListener {

    private TextView tvBalance;
    private LinearLayout transactionsContainer;
    private FirebaseFirestore db;
    private ListenerRegistration balanceListener;
    private ListenerRegistration txListener;
    private double pendingAddAmount = 0;
    private double currentWalletBalance = 0;
    private Trace walletTrace;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_wallet);

        db = FirebaseFirestore.getInstance();
        tvBalance = findViewById(R.id.tv_balance);
        transactionsContainer = findViewById(R.id.transactions_container);

        findViewById(R.id.btn_back).setOnClickListener(v -> finish());

        // Add Funds button
        View btnAdd = findViewById(R.id.btn_add_funds);
        if (btnAdd != null) {
            btnAdd.setOnClickListener(v -> showAddFundsDialog());
        }

        // Withdraw button
        View btnWithdraw = findViewById(R.id.btn_withdraw);
        if (btnWithdraw != null) {
            btnWithdraw.setOnClickListener(v -> showWithdrawDialog());
        }

        listenToBalance();
        loadTransactions();
    }

    private void listenToBalance() {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) return;

        balanceListener = db.collection(Constants.COLLECTION_CUSTOMERS).document(user.getUid())
                .addSnapshotListener((doc, error) -> {
                    if (error != null) {
                        recordException("listenToBalance_failed", error);
                        return;
                    }
                    if (doc == null || !doc.exists()) return;
                    Double balance = doc.getDouble("walletBalance");
                    currentWalletBalance = balance != null ? balance : 0.0;
                    tvBalance.setText(String.format(Locale.getDefault(), "₹%.2f", currentWalletBalance));
                    crashlyticsHelper.setCustomKey("wallet_balance", currentWalletBalance);
                });
    }

    private void loadTransactions() {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) return;

        txListener = db.collection(Constants.COLLECTION_WALLET_TRANSACTIONS)
                .whereEqualTo("customerId", user.getUid())
                .orderBy("createdAt", Query.Direction.DESCENDING)
                .limit(20)
                .addSnapshotListener((snapshot, error) -> {
                    if (error != null) {
                        recordException("loadTransactions_failed", error);
                        return;
                    }
                    if (snapshot == null || transactionsContainer == null) return;

                    transactionsContainer.removeAllViews();

                    if (snapshot.isEmpty()) {
                        TextView empty = new TextView(this);
                        empty.setText("📋 No transactions yet");
                        empty.setTextColor(getColor(R.color.text_secondary));
                        empty.setTextSize(14);
                        empty.setPadding(0, 32, 0, 0);
                        transactionsContainer.addView(empty);
                        return;
                    }

                    for (DocumentSnapshot doc : snapshot.getDocuments()) {
                        addTransactionItem(doc);
                    }
                });
    }

    private void addTransactionItem(DocumentSnapshot doc) {
        View item = LayoutInflater.from(this).inflate(R.layout.item_transaction, transactionsContainer, false);

        String type = doc.getString("type");
        Double amount = doc.getDouble("amount");
        String desc = doc.getString("description");

        TextView tvType = item.findViewById(R.id.tv_tx_type);
        TextView tvAmount = item.findViewById(R.id.tv_tx_amount);
        TextView tvDesc = item.findViewById(R.id.tv_tx_desc);
        TextView tvDate = item.findViewById(R.id.tv_tx_date);

        boolean isCredit = "credit".equals(type) || "refund".equals(type) || "add_funds".equals(type);
        String icon = isCredit ? "💰" : "💸";
        tvType.setText(icon + " " + (type != null ? type.replace("_", " ").toUpperCase() : "TRANSACTION"));
        tvAmount.setText((isCredit ? "+" : "-") + String.format(Locale.getDefault(), "₹%.0f", amount != null ? amount : 0));
        tvAmount.setTextColor(getColor(isCredit ? R.color.success : R.color.error));
        tvDesc.setText(desc != null ? desc : "");

        if (doc.getTimestamp("createdAt") != null) {
            SimpleDateFormat sdf = new SimpleDateFormat("dd MMM, hh:mm a", Locale.getDefault());
            tvDate.setText(sdf.format(doc.getTimestamp("createdAt").toDate()));
        }

        transactionsContainer.addView(item);
    }

    private void showAddFundsDialog() {
        BottomSheetDialog dialog = new BottomSheetDialog(this);
        View sheetView = LayoutInflater.from(this).inflate(R.layout.dialog_add_funds, null);
        dialog.setContentView(sheetView);

        EditText etAmount = sheetView.findViewById(R.id.et_dialog_amount);
        sheetView.findViewById(R.id.chip_100).setOnClickListener(v -> etAmount.setText("100"));
        sheetView.findViewById(R.id.chip_200).setOnClickListener(v -> etAmount.setText("200"));
        sheetView.findViewById(R.id.chip_500).setOnClickListener(v -> etAmount.setText("500"));
        sheetView.findViewById(R.id.chip_1000).setOnClickListener(v -> etAmount.setText("1000"));

        sheetView.findViewById(R.id.btn_dialog_cancel).setOnClickListener(v -> dialog.dismiss());
        sheetView.findViewById(R.id.btn_dialog_proceed).setOnClickListener(v -> {
            String amountStr = etAmount.getText().toString().trim();
            if (TextUtils.isEmpty(amountStr)) {
                Toast.makeText(this, "Please enter an amount", Toast.LENGTH_SHORT).show();
                return;
            }

            try {
                double amount = Double.parseDouble(amountStr);
                if (amount <= 0) {
                    Toast.makeText(this, "Please enter a valid amount greater than 0", Toast.LENGTH_SHORT).show();
                    return;
                }
                pendingAddAmount = amount;
                dialog.dismiss();
                startRazorpayPayment(amount);
            } catch (NumberFormatException e) {
                Toast.makeText(this, "Please enter a valid amount", Toast.LENGTH_SHORT).show();
            }
        });

        dialog.show();
    }

    private void startRazorpayPayment(double amount) {
        try {
            walletTrace = startTrace(PerformanceHelper.TRACE_WALLET_ADD_FUNDS);
            logBreadcrumb("Initiating Razorpay payment for ₹" + amount);

            Checkout checkout = new Checkout();
            checkout.setKeyID(Constants.RAZORPAY_KEY_ID);

            JSONObject options = new JSONObject();
            options.put("name", "AKR Hunger Wallet");
            options.put("description", String.format(Locale.getDefault(), "Add ₹%.2f to wallet", amount));
            options.put("amount", Math.round(amount * 100)); // Amount in paise
            options.put("currency", "INR");
            FirebaseUser u = FirebaseAuth.getInstance().getCurrentUser();
            if (u != null && u.getEmail() != null) {
                options.put("prefill.email", u.getEmail());
            }

            checkout.open(this, options);
        } catch (Exception e) {
            stopTrace(walletTrace);
            recordException("Razorpay_Checkout_Error", e);
            Toast.makeText(this, "Payment error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    public void onPaymentSuccess(String razorpayPaymentId) {
        stopTrace(walletTrace);
        logBreadcrumb("Razorpay payment succeeded: " + razorpayPaymentId + " amount=₹" + pendingAddAmount);

        // Firebase Analytics - wallet add funds
        analyticsHelper.logWalletAddFunds(pendingAddAmount, razorpayPaymentId);

        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) return;

        // Add balance to Firestore
        db.collection(Constants.COLLECTION_CUSTOMERS).document(user.getUid())
                .update("walletBalance", com.google.firebase.firestore.FieldValue.increment(pendingAddAmount));

        // Record transaction
        Map<String, Object> tx = new HashMap<>();
        tx.put("customerId", user.getUid());
        tx.put("type", "add_funds");
        tx.put("amount", pendingAddAmount);
        tx.put("description", "Added via Razorpay");
        tx.put("razorpayPaymentId", razorpayPaymentId);
        tx.put("createdAt", Timestamp.now());
        db.collection(Constants.COLLECTION_WALLET_TRANSACTIONS).add(tx);

        Toast.makeText(this, "₹" + (int) pendingAddAmount + " added to wallet! 🎉", Toast.LENGTH_LONG).show();
    }

    @Override
    public void onPaymentError(int code, String response) {
        stopTrace(walletTrace);
        logBreadcrumb("Razorpay payment failed: code=" + code + " resp=" + response);
        recordException("Razorpay_Payment_Failed", new Exception("Code " + code + ": " + response));
        Toast.makeText(this, "Payment failed", Toast.LENGTH_SHORT).show();
    }

    private void showWithdrawDialog() {
        BottomSheetDialog dialog = new BottomSheetDialog(this);
        View sheetView = LayoutInflater.from(this).inflate(R.layout.dialog_withdraw, null);
        dialog.setContentView(sheetView);

        TextView tvAvail = sheetView.findViewById(R.id.tv_dialog_avail_bal);
        tvAvail.setText(String.format(Locale.getDefault(), "₹%.2f", currentWalletBalance));

        EditText etAmount = sheetView.findViewById(R.id.et_withdraw_amount);
        sheetView.findViewById(R.id.btn_withdraw_all).setOnClickListener(v ->
                etAmount.setText(String.format(Locale.getDefault(), "%.2f", currentWalletBalance)));

        sheetView.findViewById(R.id.btn_withdraw_cancel).setOnClickListener(v -> dialog.dismiss());
        sheetView.findViewById(R.id.btn_confirm_withdraw).setOnClickListener(v -> {
            String amountStr = etAmount.getText().toString().trim();
            if (TextUtils.isEmpty(amountStr)) {
                Toast.makeText(this, "Please enter withdrawal amount", Toast.LENGTH_SHORT).show();
                return;
            }

            try {
                double amount = Double.parseDouble(amountStr);
                if (amount <= 0) {
                    Toast.makeText(this, "Please enter a valid amount greater than 0", Toast.LENGTH_SHORT).show();
                    return;
                }
                if (amount > currentWalletBalance) {
                    Toast.makeText(this, "Amount exceeds current wallet balance", Toast.LENGTH_SHORT).show();
                    return;
                }

                FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
                if (user == null) return;

                analyticsHelper.logWalletWithdrawRequest(amount);
                logBreadcrumb("Submitted withdrawal request for ₹" + amount);

                Map<String, Object> tx = new HashMap<>();
                tx.put("customerId", user.getUid());
                tx.put("type", "withdrawal_request");
                tx.put("amount", amount);
                tx.put("status", "pending");
                tx.put("description", "Withdrawal request");
                tx.put("createdAt", Timestamp.now());
                db.collection(Constants.COLLECTION_WALLET_TRANSACTIONS).add(tx)
                        .addOnSuccessListener(ref -> {
                            dialog.dismiss();
                            Toast.makeText(this, "Withdrawal request submitted! 📤", Toast.LENGTH_LONG).show();
                        })
                        .addOnFailureListener(e -> recordException("withdrawal_request_failed", e));
            } catch (NumberFormatException e) {
                Toast.makeText(this, "Please enter a valid amount", Toast.LENGTH_SHORT).show();
            }
        });

        dialog.show();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (balanceListener != null) balanceListener.remove();
        if (txListener != null) txListener.remove();
    }

    @Override
    protected String getScreenName() {
        return "Wallet";
    }
}
