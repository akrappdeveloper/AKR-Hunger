package com.ssr.hunger.activities;

import android.content.Intent;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
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
import com.google.firebase.firestore.FieldValue;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import com.google.firebase.firestore.Query;
import com.google.firebase.perf.metrics.Trace;
import com.razorpay.Checkout;
import com.razorpay.PaymentResultListener;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Wallet Activity - complete 1-to-1 feature parity with customer web panel wallet page.
 * Features:
 * 1. Real-time live wallet balance sync.
 * 2. Add funds with presets (+₹100, +₹200, +₹500, +₹1000, +₹2000) via Razorpay (UPI, Card, Netbanking).
 * 3. Withdraw funds with choice of Transfer Method: UPI ID or Linked Bank Account (Account No, IFSC, Holder Name).
 * 4. Linked Bank Account & UPI ID management saved to customer profile.
 * 5. VIP Membership Card / Issued Card status (Active Card with details, Pending status, or Request Card).
 * 6. Transaction history with filter chips (All, Credits, Debits, Refunds, Referrals) and detailed status badges.
 * 7. Quick spending overview metrics (Total Spent, Top Up Funds).
 */
public class WalletActivity extends BaseActivity implements PaymentResultListener {

    private TextView tvBalance;
    private TextView tvTotalSpent;
    private TextView tvStatAddFunds;
    private TextView tvTxCount;
    private LinearLayout transactionsContainer;
    private LinearLayout llEmptyTx;
    private ProgressBar pbTxLoading;

    // Membership Card Views
    private View cardVipMembership;
    private View cardMembershipPending;
    private View cardNoMembership;
    private TextView tvVipBalance;
    private TextView tvVipCardNumber;
    private TextView tvVipHolderName;
    private TextView tvVipValidThru;

    // Bank & UPI Section Views
    private TextView tvBankAvatar;
    private TextView tvBankName;
    private TextView tvBankAccount;
    private TextView tvBankVerifiedBadge;
    private TextView tvUpiId;
    private View rowUpiDisplay;

    // Filter Chips
    private TextView chipFilterAll;
    private TextView chipFilterCredits;
    private TextView chipFilterDebits;
    private TextView chipFilterRefunds;
    private TextView chipFilterReferrals;

    private FirebaseFirestore db;
    private ListenerRegistration balanceListener;
    private ListenerRegistration profileListener;
    private ListenerRegistration txSubListener;
    private ListenerRegistration txRootListener;
    private ListenerRegistration issuedCardListener;

    private double currentWalletBalance = 0.0;
    private double pendingAddAmount = 0.0;
    private String currentFilter = "all";

    private final List<DocumentSnapshot> allTransactions = new ArrayList<>();
    private final Map<String, Object> currentBankDetails = new HashMap<>();
    private String currentUpiId = "";
    private String membershipStatus = "";
    private Trace walletTrace;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_wallet);

        db = FirebaseFirestore.getInstance();
        initViews();
        setupListeners();

        listenToCustomerProfile();
        listenToIssuedCard();
        loadTransactions();
    }

    private void initViews() {
        tvBalance = findViewById(R.id.tv_balance);
        tvTotalSpent = findViewById(R.id.tv_total_spent);
        tvStatAddFunds = findViewById(R.id.tv_stat_add_funds);
        tvTxCount = findViewById(R.id.tv_tx_count);
        transactionsContainer = findViewById(R.id.transactions_container);
        llEmptyTx = findViewById(R.id.ll_empty_tx);
        pbTxLoading = findViewById(R.id.pb_tx_loading);

        // Membership Card
        cardVipMembership = findViewById(R.id.card_vip_membership);
        cardMembershipPending = findViewById(R.id.card_membership_pending);
        cardNoMembership = findViewById(R.id.card_no_membership);
        tvVipBalance = findViewById(R.id.tv_vip_balance);
        tvVipCardNumber = findViewById(R.id.tv_vip_card_number);
        tvVipHolderName = findViewById(R.id.tv_vip_holder_name);
        tvVipValidThru = findViewById(R.id.tv_vip_valid_thru);

        // Bank Views
        tvBankAvatar = findViewById(R.id.tv_bank_avatar);
        tvBankName = findViewById(R.id.tv_bank_name);
        tvBankAccount = findViewById(R.id.tv_bank_account);
        tvBankVerifiedBadge = findViewById(R.id.tv_bank_verified_badge);
        tvUpiId = findViewById(R.id.tv_upi_id);
        rowUpiDisplay = findViewById(R.id.row_upi_display);

        // Filter Chips
        chipFilterAll = findViewById(R.id.chip_filter_all);
        chipFilterCredits = findViewById(R.id.chip_filter_credits);
        chipFilterDebits = findViewById(R.id.chip_filter_debits);
        chipFilterRefunds = findViewById(R.id.chip_filter_refunds);
        chipFilterReferrals = findViewById(R.id.chip_filter_referrals);
    }

    private void setupListeners() {
        findViewById(R.id.btn_back).setOnClickListener(v -> finish());

        // Support Shortcut
        View btnHelp = findViewById(R.id.btn_wallet_help);
        if (btnHelp != null) {
            btnHelp.setOnClickListener(v -> {
                Intent supportIntent = new Intent(this, SupportActivity.class);
                supportIntent.putExtra("initial_category", "Billing & Wallet");
                startActivity(supportIntent);
            });
        }

        // Add Funds Button
        View btnAdd = findViewById(R.id.btn_add_funds);
        if (btnAdd != null) {
            btnAdd.setOnClickListener(v -> showAddFundsDialog());
        }

        // Top Up Card Shortcut
        View cardStatTopup = findViewById(R.id.card_stat_topup);
        if (cardStatTopup != null) {
            cardStatTopup.setOnClickListener(v -> showAddFundsDialog());
        }

        // Withdraw Button
        View btnWithdraw = findViewById(R.id.btn_withdraw);
        if (btnWithdraw != null) {
            btnWithdraw.setOnClickListener(v -> showWithdrawDialog());
        }

        // Manage Bank Button
        View btnEditBank = findViewById(R.id.btn_edit_bank);
        if (btnEditBank != null) {
            btnEditBank.setOnClickListener(v -> showBankDetailsDialog());
        }

        // Request Membership Card Button
        View btnReqMembership = findViewById(R.id.btn_request_membership);
        if (btnReqMembership != null) {
            btnReqMembership.setOnClickListener(v -> showRequestMembershipDialog());
        }

        // Filter Chip Listeners
        chipFilterAll.setOnClickListener(v -> selectFilter("all"));
        chipFilterCredits.setOnClickListener(v -> selectFilter("credits"));
        chipFilterDebits.setOnClickListener(v -> selectFilter("debits"));
        chipFilterRefunds.setOnClickListener(v -> selectFilter("refunds"));
        chipFilterReferrals.setOnClickListener(v -> selectFilter("referrals"));
    }

    private void selectFilter(String filter) {
        this.currentFilter = filter;

        // Reset all chips
        resetChip(chipFilterAll);
        resetChip(chipFilterCredits);
        resetChip(chipFilterDebits);
        resetChip(chipFilterRefunds);
        resetChip(chipFilterReferrals);

        // Highlight selected chip
        TextView selectedView = chipFilterAll;
        if ("credits".equals(filter)) selectedView = chipFilterCredits;
        else if ("debits".equals(filter)) selectedView = chipFilterDebits;
        else if ("refunds".equals(filter)) selectedView = chipFilterRefunds;
        else if ("referrals".equals(filter)) selectedView = chipFilterReferrals;

        selectedView.setBackgroundResource(R.drawable.bg_chip_filter_selected);
        selectedView.setTextColor(getColor(android.R.color.white));

        renderTransactions();
    }

    private void resetChip(TextView chip) {
        chip.setBackgroundResource(R.drawable.bg_chip_filter_unselected);
        chip.setTextColor(getColor(R.color.text_primary));
    }

    /**
     * Listens to customer profile document for balance, bank details, and membership status.
     */
    private void listenToCustomerProfile() {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) return;

        profileListener = db.collection(Constants.COLLECTION_CUSTOMERS).document(user.getUid())
                .addSnapshotListener((doc, error) -> {
                    if (error != null) {
                        recordException("listenToCustomerProfile_failed", error);
                        return;
                    }
                    if (doc == null || !doc.exists()) return;

                    // 1. Live Balance
                    Double balance = doc.getDouble("walletBalance");
                    currentWalletBalance = balance != null ? balance : 0.0;
                    tvBalance.setText(String.format(Locale.getDefault(), "₹%.2f", currentWalletBalance));
                    if (tvVipBalance != null) {
                        tvVipBalance.setText(String.format(Locale.getDefault(), "₹%.0f", currentWalletBalance));
                    }
                    crashlyticsHelper.setCustomKey("wallet_balance", currentWalletBalance);

                    // 2. Bank Details
                    currentBankDetails.clear();
                    Object bDetailsObj = doc.get("bankDetails");
                    if (bDetailsObj instanceof Map) {
                        Map<?, ?> bMap = (Map<?, ?>) bDetailsObj;
                        for (Map.Entry<?, ?> entry : bMap.entrySet()) {
                            if (entry.getKey() != null && entry.getValue() != null) {
                                currentBankDetails.put(entry.getKey().toString(), entry.getValue());
                            }
                        }
                    }

                    // 3. UPI ID
                    currentUpiId = doc.getString("upiId");
                    if (currentUpiId == null) currentUpiId = "";

                    // Update Bank UI
                    updateBankDisplayUI();

                    // 4. Membership Status
                    membershipStatus = doc.getString("membershipStatus");
                    if (membershipStatus == null) membershipStatus = "";
                    updateMembershipUI();
                });
    }

    private void updateBankDisplayUI() {
        String bankName = (String) currentBankDetails.get("bankName");
        String accNum = (String) currentBankDetails.get("accountNumber");
        String holder = (String) currentBankDetails.get("accountHolderName");
        String ifsc = (String) currentBankDetails.get("ifscCode");

        if (!TextUtils.isEmpty(accNum) && !TextUtils.isEmpty(bankName)) {
            tvBankName.setText(bankName);
            String masked = accNum.length() > 4 ? "•••• " + accNum.substring(accNum.length() - 4) : accNum;
            tvBankAccount.setText(masked + " (" + (holder != null ? holder : "") + ")");
            tvBankVerifiedBadge.setVisibility(View.VISIBLE);

            if (bankName.length() >= 2) {
                tvBankAvatar.setText(bankName.substring(0, 2).toUpperCase());
            } else {
                tvBankAvatar.setText("BK");
            }
        } else {
            tvBankName.setText("No Bank Linked");
            tvBankAccount.setText("Tap Manage to link Bank Account");
            tvBankVerifiedBadge.setVisibility(View.GONE);
            tvBankAvatar.setText("BK");
        }

        // UPI Display
        if (!TextUtils.isEmpty(currentUpiId)) {
            rowUpiDisplay.setVisibility(View.VISIBLE);
            tvUpiId.setText(currentUpiId);
        } else {
            rowUpiDisplay.setVisibility(View.GONE);
        }
    }

    /**
     * Checks if user has an issued VIP membership card.
     */
    private void listenToIssuedCard() {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) return;

        issuedCardListener = db.collection("issuedCards")
                .whereEqualTo("customerId", user.getUid())
                .limit(1)
                .addSnapshotListener((snap, error) -> {
                    if (snap != null && !snap.isEmpty()) {
                        DocumentSnapshot cardDoc = snap.getDocuments().get(0);
                        String cardNum = cardDoc.getString("cardNumber");
                        String holder = cardDoc.getString("cardHolderName");
                        Timestamp exp = cardDoc.getTimestamp("expiryDate");

                        if (cardNum != null && cardNum.length() >= 4) {
                            String last4 = cardNum.substring(cardNum.length() - 4);
                            tvVipCardNumber.setText("•••• •••• •••• " + last4);
                        } else {
                            tvVipCardNumber.setText("4532 •••• •••• 8912");
                        }

                        if (holder != null) {
                            tvVipHolderName.setText(holder);
                        } else {
                            tvVipHolderName.setText(user.getDisplayName() != null ? user.getDisplayName() : "VIP Member");
                        }

                        if (exp != null) {
                            SimpleDateFormat sdf = new SimpleDateFormat("MM/yy", Locale.getDefault());
                            tvVipValidThru.setText(sdf.format(exp.toDate()));
                        } else {
                            tvVipValidThru.setText("12/28");
                        }

                        cardVipMembership.setVisibility(View.VISIBLE);
                        cardMembershipPending.setVisibility(View.GONE);
                        cardNoMembership.setVisibility(View.GONE);
                    } else {
                        updateMembershipUI();
                    }
                });
    }

    private void updateMembershipUI() {
        // If issued card is visible, don't override
        if (cardVipMembership.getVisibility() == View.VISIBLE) return;

        if ("pending".equalsIgnoreCase(membershipStatus)) {
            cardMembershipPending.setVisibility(View.VISIBLE);
            cardNoMembership.setVisibility(View.GONE);
        } else {
            cardMembershipPending.setVisibility(View.GONE);
            cardNoMembership.setVisibility(View.VISIBLE);
        }
    }

    /**
     * Loads transactions from customers/{uid}/walletTransactions with fallback to root collection.
     */
    private void loadTransactions() {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) return;

        pbTxLoading.setVisibility(View.VISIBLE);

        // Listen to subcollection customers/{uid}/walletTransactions first
        txSubListener = db.collection(Constants.COLLECTION_CUSTOMERS).document(user.getUid())
                .collection(Constants.COLLECTION_WALLET_TRANSACTIONS)
                .orderBy("createdAt", Query.Direction.DESCENDING)
                .limit(50)
                .addSnapshotListener((subSnap, subErr) -> {
                    if (subSnap != null && !subSnap.isEmpty()) {
                        pbTxLoading.setVisibility(View.GONE);
                        allTransactions.clear();
                        allTransactions.addAll(subSnap.getDocuments());
                        calculateMetrics();
                        renderTransactions();
                    } else {
                        // Fallback to query root walletTransactions
                        loadRootTransactionsFallback(user.getUid());
                    }
                });
    }

    private void loadRootTransactionsFallback(String uid) {
        if (txRootListener != null) txRootListener.remove();

        txRootListener = db.collection(Constants.COLLECTION_WALLET_TRANSACTIONS)
                .whereEqualTo("customerId", uid)
                .orderBy("createdAt", Query.Direction.DESCENDING)
                .limit(50)
                .addSnapshotListener((rootSnap, rootErr) -> {
                    pbTxLoading.setVisibility(View.GONE);
                    if (rootSnap != null) {
                        allTransactions.clear();
                        allTransactions.addAll(rootSnap.getDocuments());
                        calculateMetrics();
                        renderTransactions();
                    }
                });
    }

    private void calculateMetrics() {
        double totalSpent = 0.0;
        for (DocumentSnapshot doc : allTransactions) {
            String type = doc.getString("type");
            Double amt = doc.getDouble("amount");
            if (amt == null) continue;

            if ("payment".equalsIgnoreCase(type) || "withdrawal".equalsIgnoreCase(type)
                    || "withdrawal_request".equalsIgnoreCase(type) || "order_payment".equalsIgnoreCase(type)
                    || "debit".equalsIgnoreCase(type)) {
                totalSpent += amt;
            }
        }
        tvTotalSpent.setText(String.format(Locale.getDefault(), "₹%.0f", totalSpent));
        tvTxCount.setText(allTransactions.size() + " items");
    }

    private void renderTransactions() {
        transactionsContainer.removeAllViews();

        List<DocumentSnapshot> filteredList = new ArrayList<>();
        for (DocumentSnapshot doc : allTransactions) {
            String type = doc.getString("type");
            String desc = doc.getString("description");
            if (type == null) type = "";
            if (desc == null) desc = "";

            type = type.toLowerCase(Locale.ROOT);
            desc = desc.toLowerCase(Locale.ROOT);

            boolean isCredit = type.contains("deposit") || type.contains("credit") || type.contains("refund")
                    || type.contains("bonus") || type.contains("add_funds") || type.contains("referral");
            boolean isDebit = type.contains("payment") || type.contains("withdrawal") || type.contains("debit");
            boolean isRefund = type.contains("refund") || desc.contains("refund");
            boolean isReferral = type.contains("referral") || desc.contains("referral") || desc.contains("invite");

            if ("credits".equals(currentFilter) && !isCredit) continue;
            if ("debits".equals(currentFilter) && !isDebit) continue;
            if ("refunds".equals(currentFilter) && !isRefund) continue;
            if ("referrals".equals(currentFilter) && !isReferral) continue;

            filteredList.add(doc);
        }

        if (filteredList.isEmpty()) {
            llEmptyTx.setVisibility(View.VISIBLE);
        } else {
            llEmptyTx.setVisibility(View.GONE);
            for (DocumentSnapshot doc : filteredList) {
                addTransactionItemView(doc);
            }
        }
    }

    private void addTransactionItemView(DocumentSnapshot doc) {
        View item = LayoutInflater.from(this).inflate(R.layout.item_transaction, transactionsContainer, false);

        String type = doc.getString("type");
        Double amount = doc.getDouble("amount");
        String desc = doc.getString("description");
        String status = doc.getString("status");
        String refId = doc.getString("referenceId");
        if (refId == null) refId = doc.getString("razorpayPaymentId");

        FrameLayout flIconContainer = item.findViewById(R.id.fl_tx_icon_container);
        ImageView ivIcon = item.findViewById(R.id.iv_tx_icon);
        TextView tvDesc = item.findViewById(R.id.tv_tx_desc);
        TextView tvDate = item.findViewById(R.id.tv_tx_date);
        TextView tvType = item.findViewById(R.id.tv_tx_type);
        TextView tvRef = item.findViewById(R.id.tv_tx_ref);
        TextView tvAmount = item.findViewById(R.id.tv_tx_amount);
        TextView tvStatus = item.findViewById(R.id.tv_tx_status);

        String typeLower = type != null ? type.toLowerCase(Locale.ROOT) : "";
        String descLower = desc != null ? desc.toLowerCase(Locale.ROOT) : "";

        boolean isCredit = typeLower.contains("deposit") || typeLower.contains("credit") || typeLower.contains("refund")
                || typeLower.contains("bonus") || typeLower.contains("add_funds") || typeLower.contains("referral");
        boolean isRefund = typeLower.contains("refund") || descLower.contains("refund");
        boolean isReferral = typeLower.contains("referral") || descLower.contains("referral");

        // Styling based on type
        if (isRefund) {
            flIconContainer.setBackgroundResource(R.drawable.bg_icon_circle_blue);
            ivIcon.setImageResource(R.drawable.ic_shield_check);
            ivIcon.setColorFilter(getColor(R.color.info));
        } else if (isReferral) {
            flIconContainer.setBackgroundResource(R.drawable.bg_icon_circle_soft);
            ivIcon.setImageResource(R.drawable.ic_discount_coupon);
            ivIcon.setColorFilter(getColor(R.color.primary));
        } else if (isCredit) {
            flIconContainer.setBackgroundResource(R.drawable.bg_icon_circle_green);
            ivIcon.setImageResource(R.drawable.ic_arrow_down_left);
            ivIcon.setColorFilter(getColor(R.color.success));
        } else {
            flIconContainer.setBackgroundResource(R.drawable.bg_icon_circle_red);
            ivIcon.setImageResource(R.drawable.ic_arrow_up_right);
            ivIcon.setColorFilter(getColor(R.color.error));
        }

        tvDesc.setText(desc != null && !desc.isEmpty() ? desc : (isCredit ? "Wallet Credit" : "Wallet Debit"));
        tvType.setText(type != null ? type.replace("_", " ").toUpperCase(Locale.ROOT) : "TRANSACTION");

        if (refId != null && !refId.isEmpty()) {
            tvRef.setVisibility(View.VISIBLE);
            tvRef.setText("#" + (refId.length() > 10 ? refId.substring(0, 10) + "..." : refId));
        } else {
            tvRef.setVisibility(View.GONE);
        }

        // Timestamp
        Timestamp ts = doc.getTimestamp("createdAt");
        if (ts != null) {
            SimpleDateFormat sdf = new SimpleDateFormat("dd MMM, hh:mm a", Locale.getDefault());
            tvDate.setText(sdf.format(ts.toDate()));
        } else {
            tvDate.setText("Recently");
        }

        // Amount
        double val = amount != null ? amount : 0.0;
        tvAmount.setText((isCredit ? "+" : "-") + String.format(Locale.getDefault(), "₹%.0f", val));
        tvAmount.setTextColor(getColor(isCredit ? R.color.success : R.color.text_primary));

        // Status Badge
        if ("completed".equalsIgnoreCase(status) || status == null) {
            tvStatus.setText("Completed");
            tvStatus.setTextColor(getColor(R.color.success));
            tvStatus.setBackgroundResource(R.drawable.bg_pill_soft);
        } else if ("pending".equalsIgnoreCase(status)) {
            tvStatus.setText("Pending");
            tvStatus.setTextColor(getColor(R.color.warning));
            tvStatus.setBackgroundResource(R.drawable.bg_pill_amber_soft);
        } else {
            tvStatus.setText("Failed");
            tvStatus.setTextColor(getColor(R.color.error));
            tvStatus.setBackgroundResource(R.drawable.bg_error_subtle);
        }

        transactionsContainer.addView(item);
    }

    /**
     * Add Funds BottomSheet with presets +₹100, +₹200, +₹500, +₹1000, +₹2000 and custom input.
     */
    private void showAddFundsDialog() {
        BottomSheetDialog dialog = new BottomSheetDialog(this, R.style.Widget_AKR_BottomSheet);
        View sheetView = LayoutInflater.from(this).inflate(R.layout.dialog_add_funds, null);
        dialog.setContentView(sheetView);

        EditText etAmount = sheetView.findViewById(R.id.et_dialog_amount);
        sheetView.findViewById(R.id.chip_100).setOnClickListener(v -> etAmount.setText("100"));
        sheetView.findViewById(R.id.chip_200).setOnClickListener(v -> etAmount.setText("200"));
        sheetView.findViewById(R.id.chip_500).setOnClickListener(v -> etAmount.setText("500"));
        sheetView.findViewById(R.id.chip_1000).setOnClickListener(v -> etAmount.setText("1000"));
        View chip2000 = sheetView.findViewById(R.id.chip_2000);
        if (chip2000 != null) chip2000.setOnClickListener(v -> etAmount.setText("2000"));

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
            options.put("name", "AKR Hunger");
            options.put("description", String.format(Locale.getDefault(), "Wallet Top-Up: ₹%.2f", amount));
            options.put("amount", Math.round(amount * 100)); // Amount in paise
            options.put("currency", "INR");

            FirebaseUser u = FirebaseAuth.getInstance().getCurrentUser();
            if (u != null) {
                JSONObject prefill = new JSONObject();
                if (u.getEmail() != null) prefill.put("email", u.getEmail());
                if (u.getPhoneNumber() != null) prefill.put("contact", u.getPhoneNumber());
                options.put("prefill", prefill);
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

        analyticsHelper.logWalletAddFunds(pendingAddAmount, razorpayPaymentId);

        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) return;

        double added = pendingAddAmount;

        // 1. Atomically increment walletBalance in customers/{uid}
        db.collection(Constants.COLLECTION_CUSTOMERS).document(user.getUid())
                .update("walletBalance", FieldValue.increment(added));

        // 2. Add transaction to subcollection customers/{uid}/walletTransactions
        Map<String, Object> tx = new HashMap<>();
        tx.put("customerId", user.getUid());
        tx.put("userId", user.getUid());
        tx.put("type", "deposit");
        tx.put("status", "completed");
        tx.put("amount", added);
        tx.put("description", "Wallet Top-Up via Razorpay");
        tx.put("referenceId", razorpayPaymentId);
        tx.put("razorpayPaymentId", razorpayPaymentId);
        tx.put("createdAt", Timestamp.now());

        db.collection(Constants.COLLECTION_CUSTOMERS).document(user.getUid())
                .collection(Constants.COLLECTION_WALLET_TRANSACTIONS).add(tx);

        // 3. Mirror in root walletTransactions ledger
        db.collection(Constants.COLLECTION_WALLET_TRANSACTIONS).add(tx);

        // 4. Send customer notification
        Map<String, Object> notif = new HashMap<>();
        notif.put("userId", user.getUid());
        notif.put("userType", "customer");
        notif.put("type", "wallet");
        notif.put("subType", "wallet-credit");
        notif.put("title", "Wallet Top-up Successful 💰");
        notif.put("message", String.format(Locale.getDefault(), "₹%.2f was successfully added to your AKR Wallet!", added));
        notif.put("read", false);
        notif.put("isRead", false);
        notif.put("createdAt", Timestamp.now());
        db.collection(Constants.COLLECTION_NOTIFICATIONS).add(notif);

        Toast.makeText(this, "🎉 ₹" + (int) added + " added to your wallet!", Toast.LENGTH_LONG).show();
    }

    @Override
    public void onPaymentError(int code, String response) {
        stopTrace(walletTrace);
        logBreadcrumb("Razorpay payment failed: code=" + code + " resp=" + response);
        recordException("Razorpay_Payment_Failed", new Exception("Code " + code + ": " + response));
        Toast.makeText(this, "Payment was cancelled or failed", Toast.LENGTH_SHORT).show();
    }

    /**
     * Withdraw Dialog supporting both UPI Transfer and Bank Account Transfer.
     */
    private void showWithdrawDialog() {
        BottomSheetDialog dialog = new BottomSheetDialog(this, R.style.Widget_AKR_BottomSheet);
        View sheetView = LayoutInflater.from(this).inflate(R.layout.dialog_withdraw, null);
        dialog.setContentView(sheetView);

        TextView tvAvail = sheetView.findViewById(R.id.tv_dialog_avail_bal);
        tvAvail.setText(String.format(Locale.getDefault(), "₹%.2f", currentWalletBalance));

        EditText etAmount = sheetView.findViewById(R.id.et_withdraw_amount);
        sheetView.findViewById(R.id.btn_withdraw_all).setOnClickListener(v ->
                etAmount.setText(String.format(Locale.getDefault(), "%.0f", currentWalletBalance)));

        // Tabs
        TextView tabBank = sheetView.findViewById(R.id.tab_payout_bank);
        TextView tabUpi = sheetView.findViewById(R.id.tab_payout_upi);
        View formBank = sheetView.findViewById(R.id.ll_withdraw_bank_form);
        View formUpi = sheetView.findViewById(R.id.ll_withdraw_upi_form);

        final boolean[] isUpiSelected = {false};

        tabBank.setOnClickListener(v -> {
            isUpiSelected[0] = false;
            tabBank.setBackgroundResource(R.drawable.bg_pill_white);
            tabBank.setTextColor(getColor(R.color.text_primary));
            tabUpi.setBackground(null);
            tabUpi.setTextColor(getColor(R.color.text_secondary));
            formBank.setVisibility(View.VISIBLE);
            formUpi.setVisibility(View.GONE);
        });

        tabUpi.setOnClickListener(v -> {
            isUpiSelected[0] = true;
            tabUpi.setBackgroundResource(R.drawable.bg_pill_white);
            tabUpi.setTextColor(getColor(R.color.text_primary));
            tabBank.setBackground(null);
            tabBank.setTextColor(getColor(R.color.text_secondary));
            formUpi.setVisibility(View.VISIBLE);
            formBank.setVisibility(View.GONE);
        });

        // Prefill form inputs from saved profile
        EditText etWBankName = sheetView.findViewById(R.id.et_w_bank_name);
        EditText etWHolder = sheetView.findViewById(R.id.et_w_account_holder);
        EditText etWAccNum = sheetView.findViewById(R.id.et_w_account_number);
        EditText etWIfsc = sheetView.findViewById(R.id.et_w_ifsc_code);
        EditText etWUpi = sheetView.findViewById(R.id.et_w_upi_id);

        if (currentBankDetails.containsKey("bankName")) etWBankName.setText((String) currentBankDetails.get("bankName"));
        if (currentBankDetails.containsKey("accountHolderName")) etWHolder.setText((String) currentBankDetails.get("accountHolderName"));
        if (currentBankDetails.containsKey("accountNumber")) etWAccNum.setText((String) currentBankDetails.get("accountNumber"));
        if (currentBankDetails.containsKey("ifscCode")) etWIfsc.setText((String) currentBankDetails.get("ifscCode"));
        if (!TextUtils.isEmpty(currentUpiId)) etWUpi.setText(currentUpiId);

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
                    Toast.makeText(this, "Amount exceeds available balance (₹" + currentWalletBalance + ")", Toast.LENGTH_SHORT).show();
                    return;
                }

                FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
                if (user == null) return;

                if (isUpiSelected[0]) {
                    // UPI Transfer validation
                    String upi = etWUpi.getText().toString().trim();
                    if (TextUtils.isEmpty(upi) || !upi.contains("@") || upi.length() < 4) {
                        Toast.makeText(this, "Please enter a valid UPI ID (e.g. name@upi)", Toast.LENGTH_SHORT).show();
                        return;
                    }
                    submitWithdrawal(dialog, user, amount, "upi", null, upi);
                } else {
                    // Bank Transfer validation
                    String bName = etWBankName.getText().toString().trim();
                    String holder = etWHolder.getText().toString().trim();
                    String acc = etWAccNum.getText().toString().trim();
                    String ifsc = etWIfsc.getText().toString().trim();

                    if (TextUtils.isEmpty(bName) || TextUtils.isEmpty(holder) || TextUtils.isEmpty(acc) || TextUtils.isEmpty(ifsc)) {
                        Toast.makeText(this, "Please fill in all bank details", Toast.LENGTH_SHORT).show();
                        return;
                    }

                    Map<String, Object> bankMap = new HashMap<>();
                    bankMap.put("bankName", bName);
                    bankMap.put("accountHolderName", holder);
                    bankMap.put("accountNumber", acc);
                    bankMap.put("ifscCode", ifsc);

                    submitWithdrawal(dialog, user, amount, "bank", bankMap, "");
                }

            } catch (NumberFormatException e) {
                Toast.makeText(this, "Please enter a valid number", Toast.LENGTH_SHORT).show();
            }
        });

        dialog.show();
    }

    private void submitWithdrawal(BottomSheetDialog dialog, FirebaseUser user, double amount,
                                  String method, Map<String, Object> bankDetails, String upiId) {
        logBreadcrumb("Submitting withdrawal request of ₹" + amount + " via " + method);
        analyticsHelper.logWalletWithdrawRequest(amount);

        // 1. Deduct balance from customers/{uid}
        db.collection(Constants.COLLECTION_CUSTOMERS).document(user.getUid())
                .update("walletBalance", FieldValue.increment(-amount));

        // 2. Create withdrawal request in customerWithdrawals collection
        Map<String, Object> withdrawReq = new HashMap<>();
        withdrawReq.put("customerId", user.getUid());
        withdrawReq.put("customerName", user.getDisplayName() != null ? user.getDisplayName() : "Customer");
        withdrawReq.put("customerEmail", user.getEmail() != null ? user.getEmail() : "");
        withdrawReq.put("amount", amount);
        withdrawReq.put("status", "pending");
        withdrawReq.put("method", method);
        withdrawReq.put("createdAt", Timestamp.now());
        if ("bank".equals(method)) {
            withdrawReq.put("bankDetails", bankDetails);
        } else {
            withdrawReq.put("upiId", upiId);
        }

        db.collection("customerWithdrawals").add(withdrawReq);

        // 3. Record transaction in ledger
        String desc = "Withdrawal to " + ("upi".equals(method) ? "UPI (" + upiId + ")"
                : bankDetails.get("bankName") + " (••" + ((String) bankDetails.get("accountNumber")).substring(Math.max(0, ((String) bankDetails.get("accountNumber")).length() - 4)) + ")");

        Map<String, Object> tx = new HashMap<>();
        tx.put("customerId", user.getUid());
        tx.put("userId", user.getUid());
        tx.put("type", "withdrawal");
        tx.put("status", "pending");
        tx.put("amount", amount);
        tx.put("description", desc);
        tx.put("method", method);
        tx.put("createdAt", Timestamp.now());

        db.collection(Constants.COLLECTION_CUSTOMERS).document(user.getUid())
                .collection(Constants.COLLECTION_WALLET_TRANSACTIONS).add(tx);
        db.collection(Constants.COLLECTION_WALLET_TRANSACTIONS).add(tx);

        dialog.dismiss();
        Toast.makeText(this, "📤 Withdrawal request for ₹" + (int) amount + " submitted!", Toast.LENGTH_LONG).show();
    }

    /**
     * Dialog to link and update Bank and UPI details in the customer's profile.
     */
    private void showBankDetailsDialog() {
        BottomSheetDialog dialog = new BottomSheetDialog(this, R.style.Widget_AKR_BottomSheet);
        View sheetView = LayoutInflater.from(this).inflate(R.layout.dialog_bank_details, null);
        dialog.setContentView(sheetView);

        EditText etBankName = sheetView.findViewById(R.id.et_bank_name);
        EditText etHolder = sheetView.findViewById(R.id.et_account_holder);
        EditText etAccNum = sheetView.findViewById(R.id.et_account_number);
        EditText etIfsc = sheetView.findViewById(R.id.et_ifsc_code);
        EditText etUpi = sheetView.findViewById(R.id.et_upi_id);

        if (currentBankDetails.containsKey("bankName")) etBankName.setText((String) currentBankDetails.get("bankName"));
        if (currentBankDetails.containsKey("accountHolderName")) etHolder.setText((String) currentBankDetails.get("accountHolderName"));
        if (currentBankDetails.containsKey("accountNumber")) etAccNum.setText((String) currentBankDetails.get("accountNumber"));
        if (currentBankDetails.containsKey("ifscCode")) etIfsc.setText((String) currentBankDetails.get("ifscCode"));
        if (!TextUtils.isEmpty(currentUpiId)) etUpi.setText(currentUpiId);

        sheetView.findViewById(R.id.btn_cancel_bank).setOnClickListener(v -> dialog.dismiss());
        sheetView.findViewById(R.id.btn_save_bank).setOnClickListener(v -> {
            String bName = etBankName.getText().toString().trim();
            String holder = etHolder.getText().toString().trim();
            String acc = etAccNum.getText().toString().trim();
            String ifsc = etIfsc.getText().toString().trim();
            String upi = etUpi.getText().toString().trim();

            if (TextUtils.isEmpty(bName) || TextUtils.isEmpty(holder) || TextUtils.isEmpty(acc) || TextUtils.isEmpty(ifsc)) {
                Toast.makeText(this, "Please fill in all bank account details", Toast.LENGTH_SHORT).show();
                return;
            }

            FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
            if (user == null) return;

            Map<String, Object> bankMap = new HashMap<>();
            bankMap.put("bankName", bName);
            bankMap.put("accountHolderName", holder);
            bankMap.put("accountNumber", acc);
            bankMap.put("ifscCode", ifsc.toUpperCase(Locale.ROOT));

            Map<String, Object> updates = new HashMap<>();
            updates.put("bankDetails", bankMap);
            if (!TextUtils.isEmpty(upi)) {
                updates.put("upiId", upi);
            }
            updates.put("updatedAt", Timestamp.now());

            db.collection(Constants.COLLECTION_CUSTOMERS).document(user.getUid())
                    .update(updates)
                    .addOnSuccessListener(aVoid -> {
                        dialog.dismiss();
                        Toast.makeText(this, "✅ Bank & UPI details saved successfully!", Toast.LENGTH_SHORT).show();
                    })
                    .addOnFailureListener(e -> {
                        recordException("save_bank_details_failed", e);
                        Toast.makeText(this, "Failed to save: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                    });
        });

        dialog.show();
    }

    /**
     * Dialog to request a VIP Membership Card.
     */
    private void showRequestMembershipDialog() {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) return;

        // Check if bank details are added first
        if (!currentBankDetails.containsKey("accountNumber")) {
            Toast.makeText(this, "Please link your bank details first before requesting membership", Toast.LENGTH_LONG).show();
            showBankDetailsDialog();
            return;
        }

        BottomSheetDialog dialog = new BottomSheetDialog(this, R.style.Widget_AKR_BottomSheet);
        View sheetView = LayoutInflater.from(this).inflate(R.layout.dialog_request_membership, null);
        dialog.setContentView(sheetView);

        TextView tvName = sheetView.findViewById(R.id.tv_req_customer_name);
        TextView tvEmail = sheetView.findViewById(R.id.tv_req_customer_email);
        EditText etPhone = sheetView.findViewById(R.id.et_membership_phone);

        tvName.setText(user.getDisplayName() != null ? user.getDisplayName() : "Customer");
        tvEmail.setText(user.getEmail() != null ? user.getEmail() : "N/A");
        if (user.getPhoneNumber() != null) {
            etPhone.setText(user.getPhoneNumber());
        }

        sheetView.findViewById(R.id.btn_cancel_membership).setOnClickListener(v -> dialog.dismiss());
        sheetView.findViewById(R.id.btn_submit_membership).setOnClickListener(v -> {
            String phone = etPhone.getText().toString().trim();
            if (TextUtils.isEmpty(phone) || phone.length() < 10) {
                Toast.makeText(this, "Please enter a valid 10-digit contact number", Toast.LENGTH_SHORT).show();
                return;
            }

            Map<String, Object> req = new HashMap<>();
            req.put("customerId", user.getUid());
            req.put("customerName", user.getDisplayName() != null ? user.getDisplayName() : "Customer");
            req.put("customerEmail", user.getEmail() != null ? user.getEmail() : "");
            req.put("contactNumber", phone);
            req.put("status", "pending");
            req.put("bankDetails", currentBankDetails);
            req.put("createdAt", Timestamp.now());

            db.collection("membershipRequests").add(req);
            db.collection(Constants.COLLECTION_CUSTOMERS).document(user.getUid())
                    .update("membershipStatus", "pending");

            dialog.dismiss();
            Toast.makeText(this, "🎉 VIP Membership request submitted successfully!", Toast.LENGTH_LONG).show();
        });

        dialog.show();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (balanceListener != null) balanceListener.remove();
        if (profileListener != null) profileListener.remove();
        if (txSubListener != null) txSubListener.remove();
        if (txRootListener != null) txRootListener.remove();
        if (issuedCardListener != null) issuedCardListener.remove();
    }

    @Override
    protected String getScreenName() {
        return "Wallet";
    }
}
