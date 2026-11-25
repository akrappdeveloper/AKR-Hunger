package com.ssr.hunger.delivery.fragments;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.chip.Chip;
import com.google.android.material.chip.ChipGroup;
import com.google.firebase.Timestamp;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import com.google.firebase.firestore.Query;
import com.google.firebase.firestore.SetOptions;
import com.ssr.hunger.delivery.R;
import com.ssr.hunger.delivery.dialogs.BankDetailsDialog;
import com.ssr.hunger.delivery.dialogs.DepositCodDialog;
import com.ssr.hunger.delivery.dialogs.WithdrawalDialog;
import com.ssr.hunger.delivery.models.DeliveryPartner;
import com.ssr.hunger.delivery.utils.Constants;
import com.ssr.hunger.delivery.utils.LocationUtils;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Premium Rider Wallet & COD Ledger Activity.
 * Reconciled with web delivery wallet accounting:
 * - 80% delivery earnings + 100% tips + incentives
 * - COD cash in hand vs limit tracking (80% / 100% warnings)
 * - Net settlement position (Available Earnings - Remaining COD)
 * - Period breakdown (Today, Week, Lifetime, Tips)
 * - Multi-tab filter (All Transactions, Withdrawal Requests, COD Orders)
 */
public class WalletFragment extends Fragment {

    private static final int TAB_TRANSACTIONS = 0;
    private static final int TAB_WITHDRAWALS = 1;
    private static final int TAB_COD_ORDERS = 2;

    private FirebaseAuth auth;
    private FirebaseFirestore db;

    // UI Views
    private TextView tvWalletBalance, tvNetSettlement, tvCodInHand;
    private ProgressBar progressCashLimit;
    private TextView tvCashLimitStatus, tvCashLimitWarningText;
    private View cardCashLimitWarning;
    private MaterialButton btnWithdraw, btnDepositCod;
    private TextView tvTodayEarnings, tvWeekEarnings, tvLifetimeEarnings, tvTipsEarnings;
    private TextView tvBankTitle, tvBankDesc;
    private View cardLinkedBank;
    private ChipGroup chipGroupTabs;
    private Chip chipTabTransactions, chipTabWithdrawals, chipTabCodOrders;
    private RecyclerView rvTransactions;
    private View cardEmptyTxContainer;
    private TextView tvEmptyTransactions;

    // Financial Reconciliation State
    private double availableEarnings = 0.0;
    private double totalLifetimeEarnings = 0.0;
    private double deliveryEarnings = 0.0;
    private double tips = 0.0;
    private double incentives = 0.0;
    private double cancellationComp = 0.0;
    private double withdrawnAmount = 0.0;

    private double totalCodCollected = 0.0;
    private double totalCodDeposited = 0.0;
    private double remainingCodPayable = 0.0;
    private double netSettlementBalance = 0.0;
    private double cashLimit = 3000.0;

    private double todayEarnings = 0.0;
    private double weekEarnings = 0.0;

    private double computedDeliveryEarnings = 0.0;
    private double computedTips = 0.0;
    private double computedCodCollected = 0.0;
    private double computedDepositsTotal = 0.0;

    private Map<String, Object> bankDetailsMap = null;
    private DocumentSnapshot latestPartnerSnap = null;

    // Ledger Data Lists
    private final List<LedgerItem> allTransactionsList = new ArrayList<>();
    private final List<LedgerItem> withdrawalsList = new ArrayList<>();
    private final List<LedgerItem> codOrdersList = new ArrayList<>();
    private final List<LedgerItem> currentDisplayList = new ArrayList<>();

    private int currentTab = TAB_TRANSACTIONS;
    private LedgerAdapter ledgerAdapter;

    // Firestore Listeners
    private ListenerRegistration partnerListener;
    private ListenerRegistration ordersListener;
    private ListenerRegistration withdrawalsListener;
    private ListenerRegistration subTransactionsListener;
    private ListenerRegistration globalTransactionsListener;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        View view = inflater.inflate(R.layout.fragment_wallet, container, false);

        auth = FirebaseAuth.getInstance();
        db = FirebaseFirestore.getInstance();

        initViews(view);
        setupListeners();
        return view;
    }

    private void initViews(View view) {

        tvWalletBalance = view.findViewById(R.id.tv_wallet_balance);
        tvNetSettlement = view.findViewById(R.id.tv_net_settlement);
        tvCodInHand = view.findViewById(R.id.tv_cod_in_hand);
        progressCashLimit = view.findViewById(R.id.progress_cash_limit);
        tvCashLimitStatus = view.findViewById(R.id.tv_cash_limit_status);
        cardCashLimitWarning = view.findViewById(R.id.card_cash_limit_warning);
        tvCashLimitWarningText = view.findViewById(R.id.tv_cash_limit_warning_text);

        btnWithdraw = view.findViewById(R.id.btn_wallet_withdraw);
        btnDepositCod = view.findViewById(R.id.btn_deposit_cod);

        tvTodayEarnings = view.findViewById(R.id.tv_today_earnings);
        tvWeekEarnings = view.findViewById(R.id.tv_week_earnings);
        tvLifetimeEarnings = view.findViewById(R.id.tv_lifetime_earnings);
        tvTipsEarnings = view.findViewById(R.id.tv_tips_earnings);

        cardLinkedBank = view.findViewById(R.id.card_linked_bank);
        tvBankTitle = view.findViewById(R.id.tv_bank_summary_title);
        tvBankDesc = view.findViewById(R.id.tv_bank_summary_desc);

        chipGroupTabs = view.findViewById(R.id.chip_group_wallet_tabs);
        chipTabTransactions = view.findViewById(R.id.chip_tab_transactions);
        chipTabWithdrawals = view.findViewById(R.id.chip_tab_withdrawals);
        chipTabCodOrders = view.findViewById(R.id.chip_tab_cod_orders);

        rvTransactions = view.findViewById(R.id.rv_wallet_transactions);
        cardEmptyTxContainer = view.findViewById(R.id.card_empty_tx_container);
        tvEmptyTransactions = view.findViewById(R.id.tv_empty_transactions);

        rvTransactions.setLayoutManager(new LinearLayoutManager(requireContext()));
        ledgerAdapter = new LedgerAdapter();
        rvTransactions.setAdapter(ledgerAdapter);

        // Withdrawal Action
        btnWithdraw.setOnClickListener(v -> {
            WithdrawalDialog dialog = new WithdrawalDialog(requireActivity(), availableEarnings);
            dialog.show();
        });

        // Deposit COD Action
        btnDepositCod.setOnClickListener(v -> {
            DepositCodDialog dialog = new DepositCodDialog(requireActivity(), remainingCodPayable, amount -> recalculateAndRefreshUI());
            dialog.show();
        });

        // Linked Bank Account
        cardLinkedBank.setOnClickListener(v -> {
            BankDetailsDialog dialog = new BankDetailsDialog(requireActivity(), bankDetailsMap);
            dialog.show();
        });

        // Segmented Tabs Selection
        chipGroupTabs.setOnCheckedChangeListener((group, checkedId) -> {
            if (checkedId == R.id.chip_tab_withdrawals) {
                currentTab = TAB_WITHDRAWALS;
            } else if (checkedId == R.id.chip_tab_cod_orders) {
                currentTab = TAB_COD_ORDERS;
            } else {
                currentTab = TAB_TRANSACTIONS;
            }
            updateDisplayList();
        });
    }

    private void setupListeners() {
        if (auth.getCurrentUser() == null) return;
        String uid = auth.getCurrentUser().getUid();

        // 1. Live subscribe to deliveryPersons/{uid}
        partnerListener = db.collection(Constants.COLLECTION_DELIVERY_PERSONS)
                .document(uid)
                .addSnapshotListener((snap, e) -> {
                    if (e != null || snap == null || !snap.exists()) return;
                    latestPartnerSnap = snap;
                    recalculateAndRefreshUI();
                });

        // 2. Live subscribe to delivered orders for this rider
        ordersListener = db.collection(Constants.COLLECTION_ORDERS)
                .whereEqualTo("deliveryPersonId", uid)
                .whereEqualTo("status", "delivered")
                .addSnapshotListener((snap, e) -> {
                    if (e != null || snap == null) return;

                    double codSum = 0.0;
                    double delivSum = 0.0;
                    double tipsSum = 0.0;
                    double todaySum = 0.0;
                    double weekSum = 0.0;

                    Calendar cal = Calendar.getInstance();
                    cal.set(Calendar.HOUR_OF_DAY, 0);
                    cal.set(Calendar.MINUTE, 0);
                    cal.set(Calendar.SECOND, 0);
                    cal.set(Calendar.MILLISECOND, 0);
                    long startOfToday = cal.getTimeInMillis();

                    cal.set(Calendar.DAY_OF_WEEK, cal.getFirstDayOfWeek());
                    long startOfWeek = cal.getTimeInMillis();

                    codOrdersList.clear();

                    for (DocumentSnapshot doc : snap.getDocuments()) {
                        String paymentMethod = doc.getString("paymentMethod");
                        boolean isCod = "cod".equalsIgnoreCase(paymentMethod);
                        double orderTotal = getDoubleSafe(doc, "total");

                        // 80% delivery earnings
                        Double dbEarnings = doc.getDouble("deliveryEarnings");
                        double orderEarning;
                        if (dbEarnings != null && dbEarnings > 0) {
                            orderEarning = dbEarnings;
                        } else {
                            double rawFee = getDoubleSafe(doc, "deliveryCharge");
                            if (rawFee <= 0) rawFee = getDoubleSafe(doc, "deliveryFee");
                            if (rawFee <= 0) rawFee = 40.0;
                            orderEarning = Math.round(rawFee * 0.8);
                        }

                        double orderTip = getDoubleSafe(doc, "tip");
                        if (orderTip <= 0) orderTip = getDoubleSafe(doc, "tipAmount");

                        double fullEarn = orderEarning + orderTip;
                        delivSum += orderEarning;
                        tipsSum += orderTip;

                        Date orderDate = parseTimestamp(doc.get("deliveredAt"));
                        if (orderDate == null) orderDate = parseTimestamp(doc.get("createdAt"));
                        long orderTime = orderDate != null ? orderDate.getTime() : 0;

                        if (orderTime >= startOfToday) todaySum += fullEarn;
                        if (orderTime >= startOfWeek) weekSum += fullEarn;

                        if (isCod) {
                            codSum += orderTotal;
                            LedgerItem codItem = new LedgerItem();
                            codItem.id = doc.getId();
                            codItem.type = "cod_order";
                            codItem.title = "COD Order #" + (doc.getId().length() > 6 ? doc.getId().substring(0, 6).toUpperCase(Locale.ROOT) : doc.getId());
                            codItem.description = "Customer Cash: " + LocationUtils.formatCurrency(orderTotal) + " • Your Share: " + LocationUtils.formatCurrency(fullEarn);
                            codItem.amount = orderTotal;
                            codItem.isPositive = false;
                            codItem.status = "DELIVERED";
                            codItem.date = orderDate != null ? orderDate : new Date();
                            codItem.dateStr = LocationUtils.formatDateTime(codItem.date);
                            codOrdersList.add(codItem);
                        }
                    }

                    computedCodCollected = codSum;
                    computedDeliveryEarnings = delivSum;
                    computedTips = tipsSum;
                    todayEarnings = todaySum;
                    weekEarnings = weekSum;

                    Collections.sort(codOrdersList, (a, b) -> b.date.compareTo(a.date));
                    recalculateAndRefreshUI();
                });

        // 3. Live subscribe to withdrawals collection for this rider
        withdrawalsListener = db.collection("withdrawals")
                .whereEqualTo("riderId", uid)
                .addSnapshotListener((snap, e) -> {
                    if (e != null || snap == null) return;

                    withdrawalsList.clear();
                    for (DocumentSnapshot doc : snap.getDocuments()) {
                        LedgerItem item = new LedgerItem();
                        item.id = doc.getId();
                        item.type = "withdrawal";
                        item.title = "Payout Withdrawal";
                        String dest = doc.getString("destinationReference");
                        if (dest == null || dest.isEmpty()) dest = doc.getString("paymentMethod");
                        item.description = dest != null ? "To: " + dest : "Linked Account";
                        item.amount = getDoubleSafe(doc, "amount");
                        item.isPositive = false;
                        item.status = doc.getString("status") != null ? doc.getString("status") : "pending";
                        item.date = parseTimestamp(doc.get("requestedAt"));
                        item.dateStr = LocationUtils.formatDateTime(item.date);
                        withdrawalsList.add(item);
                    }

                    Collections.sort(withdrawalsList, (a, b) -> b.date.compareTo(a.date));
                    recalculateAndRefreshUI();
                });

        // 4. Live subscribe to subcollection deliveryPersons/{uid}/walletTransactions
        subTransactionsListener = db.collection(Constants.COLLECTION_DELIVERY_PERSONS)
                .document(uid)
                .collection("walletTransactions")
                .orderBy("createdAt", Query.Direction.DESCENDING)
                .addSnapshotListener((snap, e) -> {
                    if (e != null || snap == null) return;
                    processTransactions(snap.getDocuments());
                });

        // Fallback global walletTransactions query
        globalTransactionsListener = db.collection(Constants.COLLECTION_WALLET_TRANSACTIONS)
                .whereEqualTo("driverId", uid)
                .addSnapshotListener((snap, e) -> {
                    if (e != null || snap == null || !allTransactionsList.isEmpty()) return;
                    processTransactions(snap.getDocuments());
                });
    }

    private void processTransactions(List<DocumentSnapshot> docs) {
        allTransactionsList.clear();
        double depositsSum = 0.0;

        for (DocumentSnapshot doc : docs) {
            String type = doc.getString("type");
            double amount = getDoubleSafe(doc, "amount");
            if ("deposit".equalsIgnoreCase(type) || "payment".equalsIgnoreCase(type)
                    || "cod_deposit".equalsIgnoreCase(type) || "cod_settlement".equalsIgnoreCase(type)
                    || "COD_SETTLEMENT".equalsIgnoreCase(type)) {
                depositsSum += amount;
            }

            LedgerItem item = new LedgerItem();
            item.id = doc.getId();
            item.type = type != null ? type : "transaction";
            item.amount = amount;

            if ("withdrawal".equalsIgnoreCase(type)) {
                item.title = "Payout Withdrawal";
                item.description = doc.getString("description") != null ? doc.getString("description") : "Withdrawal request";
                item.isPositive = false;
            } else if ("cod_deposit".equalsIgnoreCase(type) || "deposit".equalsIgnoreCase(type) || "cod_settlement".equalsIgnoreCase(type)) {
                String tracking = doc.getString("trackingId");
                if (tracking == null || tracking.isEmpty()) tracking = doc.getString("reference");
                String rzpId = doc.getString("razorpayPaymentId");
                item.title = "COD Settlement Deposit";
                StringBuilder desc = new StringBuilder();
                if (rzpId != null && !rzpId.isEmpty()) {
                    desc.append("Razorpay: ").append(rzpId);
                } else {
                    desc.append("Platform Settle");
                }
                if (tracking != null && !tracking.isEmpty()) {
                    desc.append(" • Ref: ").append(tracking);
                }
                item.description = desc.toString();
                item.isPositive = false;
            } else {
                item.title = "Delivery Payout";
                item.description = doc.getString("description") != null ? doc.getString("description") : "Order delivery earning";
                item.isPositive = true;
            }

            item.status = doc.getString("status") != null ? doc.getString("status") : "completed";
            item.date = parseTimestamp(doc.get("createdAt"));
            item.dateStr = LocationUtils.formatDateTime(item.date);
            allTransactionsList.add(item);
        }

        computedDepositsTotal = depositsSum;
        Collections.sort(allTransactionsList, (a, b) -> b.date.compareTo(a.date));
        recalculateAndRefreshUI();
    }

    /**
     * Unified accounting reconciliation matching web application logic.
     */
    private void recalculateAndRefreshUI() {
        if (latestPartnerSnap != null && latestPartnerSnap.exists()) {
            double partnerDelivEarnings = getDoubleSafe(latestPartnerSnap, "deliveryEarnings");
            double partnerTips = getDoubleSafe(latestPartnerSnap, "tips");
            incentives = getDoubleSafe(latestPartnerSnap, "incentives");
            cancellationComp = getDoubleSafe(latestPartnerSnap, "cancellationCompensation");
            withdrawnAmount = getDoubleSafe(latestPartnerSnap, "withdrawnAmount");

            deliveryEarnings = Math.max(partnerDelivEarnings, computedDeliveryEarnings);
            tips = Math.max(partnerTips, computedTips);
            totalLifetimeEarnings = deliveryEarnings + tips + incentives + cancellationComp;

            double partnerAvailable = getDoubleSafe(latestPartnerSnap, "availableEarnings");
            availableEarnings = Math.max(partnerAvailable, Math.max(0.0, totalLifetimeEarnings - withdrawnAmount));

            double partnerCodCollected = getDoubleSafe(latestPartnerSnap, "codCollected");
            double partnerCodDeposited = getDoubleSafe(latestPartnerSnap, "codDeposited");

            totalCodCollected = Math.max(partnerCodCollected, computedCodCollected);
            totalCodDeposited = Math.max(partnerCodDeposited, computedDepositsTotal);
            remainingCodPayable = Math.max(0.0, totalCodCollected - totalCodDeposited);

            netSettlementBalance = availableEarnings - remainingCodPayable;

            Double customCodLimit = latestPartnerSnap.getDouble("codLimit");
            if (customCodLimit == null || customCodLimit <= 0) {
                customCodLimit = latestPartnerSnap.getDouble("cashLimit");
            }
            cashLimit = (customCodLimit != null && customCodLimit > 0) ? customCodLimit : 3000.0;

            // Bank details
            Object bankObj = latestPartnerSnap.get("bankDetails");
            if (bankObj instanceof Map) {
                bankDetailsMap = (Map<String, Object>) bankObj;
            }
        }

        // Render Hero Balance & Net Settlement
        tvWalletBalance.setText(LocationUtils.formatCurrency(availableEarnings));
        if (netSettlementBalance < 0) {
            tvNetSettlement.setText("Net: -" + LocationUtils.formatCurrency(Math.abs(netSettlementBalance)));
            if (getContext() != null) tvNetSettlement.setTextColor(ContextCompat.getColor(getContext(), R.color.warning_light));
        } else {
            tvNetSettlement.setText("Net: +" + LocationUtils.formatCurrency(netSettlementBalance));
            if (getContext() != null) tvNetSettlement.setTextColor(ContextCompat.getColor(getContext(), R.color.white));
        }

        // Render COD In Hand & Cash Limit Meter
        tvCodInHand.setText(LocationUtils.formatCurrency(remainingCodPayable));
        int limitProgress = cashLimit > 0 ? (int) Math.min(100, Math.round((remainingCodPayable / cashLimit) * 100)) : 0;
        progressCashLimit.setProgress(limitProgress);
        tvCashLimitStatus.setText("Cash Limit: " + LocationUtils.formatCurrency(cashLimit) + " (" + limitProgress + "% utilized)");

        if (limitProgress >= 100) {
            cardCashLimitWarning.setVisibility(View.VISIBLE);
            tvCashLimitWarningText.setText("🔴 COD LIMIT FULL: " + LocationUtils.formatCurrency(remainingCodPayable) + " reached. COD orders paused! Deposit cash to resume.");
        } else if (limitProgress >= 80) {
            cardCashLimitWarning.setVisibility(View.VISIBLE);
            tvCashLimitWarningText.setText("⚠️ Approaching COD Limit (" + limitProgress + "% used). Deposit cash soon to prevent order pauses.");
        } else {
            cardCashLimitWarning.setVisibility(View.GONE);
        }

        // Render Earnings Breakdown Grid
        tvTodayEarnings.setText(LocationUtils.formatCurrency(todayEarnings));
        tvWeekEarnings.setText(LocationUtils.formatCurrency(weekEarnings));
        tvLifetimeEarnings.setText(LocationUtils.formatCurrency(totalLifetimeEarnings));
        tvTipsEarnings.setText(LocationUtils.formatCurrency(tips));

        // Render Bank Details Card
        if (bankDetailsMap != null && !bankDetailsMap.isEmpty()) {
            String bName = String.valueOf(bankDetailsMap.get("bankName"));
            String acc = String.valueOf(bankDetailsMap.get("accountNumber"));
            String masked = acc.length() > 4 ? "•••• " + acc.substring(acc.length() - 4) : acc;
            tvBankTitle.setText(bName != null && !bName.equals("null") ? bName : "Bank Account Linked");
            tvBankDesc.setText("A/C: " + masked + " • IFSC: " + bankDetailsMap.get("ifscCode"));
        } else {
            tvBankTitle.setText("Link Bank Account");
            tvBankDesc.setText("Tap to add bank account for instant payouts");
        }

        // Auto-sync availableEarnings to Firestore if behind
        syncEarningsIfNecessary();

        // Update active tab display
        updateDisplayList();
    }

    private void syncEarningsIfNecessary() {
        if (auth.getCurrentUser() == null || latestPartnerSnap == null) return;
        String uid = auth.getCurrentUser().getUid();

        Double dbAvailable = latestPartnerSnap.getDouble("availableEarnings");
        if (availableEarnings > 0 && (dbAvailable == null || dbAvailable < availableEarnings)) {
            Map<String, Object> update = new HashMap<>();
            update.put("availableEarnings", availableEarnings);
            update.put("totalEarnings", Math.max(getDoubleSafe(latestPartnerSnap, "totalEarnings"), totalLifetimeEarnings));
            update.put("deliveryEarnings", Math.max(getDoubleSafe(latestPartnerSnap, "deliveryEarnings"), deliveryEarnings));
            update.put("tips", Math.max(getDoubleSafe(latestPartnerSnap, "tips"), tips));
            db.collection(Constants.COLLECTION_DELIVERY_PERSONS).document(uid).set(update, SetOptions.merge());
        }
    }

    private void updateDisplayList() {
        currentDisplayList.clear();
        String emptyMessage = "No transactions recorded yet.";

        if (currentTab == TAB_WITHDRAWALS) {
            currentDisplayList.addAll(withdrawalsList);
            emptyMessage = "No withdrawal requests found.";
            chipTabWithdrawals.setText("Withdrawals (" + withdrawalsList.size() + ")");
        } else if (currentTab == TAB_COD_ORDERS) {
            currentDisplayList.addAll(codOrdersList);
            emptyMessage = "No delivered COD orders found.";
            chipTabCodOrders.setText("COD Orders (" + codOrdersList.size() + ")");
        } else {
            currentDisplayList.addAll(allTransactionsList);
            emptyMessage = "No ledger transactions recorded yet.";
            chipTabTransactions.setText("All Transactions (" + allTransactionsList.size() + ")");
        }

        if (currentDisplayList.isEmpty()) {
            cardEmptyTxContainer.setVisibility(View.VISIBLE);
            tvEmptyTransactions.setVisibility(View.VISIBLE);
            tvEmptyTransactions.setText(emptyMessage);
            rvTransactions.setVisibility(View.GONE);
        } else {
            cardEmptyTxContainer.setVisibility(View.GONE);
            tvEmptyTransactions.setVisibility(View.GONE);
            rvTransactions.setVisibility(View.VISIBLE);
            ledgerAdapter.notifyDataSetChanged();
        }
    }

    private double getDoubleSafe(DocumentSnapshot doc, String field) {
        if (doc == null || !doc.contains(field)) return 0.0;
        Object val = doc.get(field);
        if (val instanceof Number) return ((Number) val).doubleValue();
        return 0.0;
    }

    private Date parseTimestamp(Object obj) {
        if (obj instanceof Timestamp) {
            return ((Timestamp) obj).toDate();
        } else if (obj instanceof Date) {
            return (Date) obj;
        } else if (obj instanceof Long) {
            return new Date((Long) obj);
        } else if (obj instanceof Double) {
            return new Date(((Double) obj).longValue());
        } else if (obj instanceof Map) {
            Map<?, ?> m = (Map<?, ?>) obj;
            if (m.get("seconds") instanceof Number) {
                long secs = ((Number) m.get("seconds")).longValue();
                return new Date(secs * 1000);
            }
        }
        return new Date();
    }

    // Ledger Item Data Model
    private static class LedgerItem {
        String id;
        String type;
        String title;
        String description;
        double amount;
        boolean isPositive;
        String status;
        Date date = new Date();
        String dateStr;
    }

    // Modern RecyclerView Adapter
    private class LedgerAdapter extends RecyclerView.Adapter<LedgerAdapter.ViewHolder> {
        @NonNull
        @Override
        public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_wallet_transaction, parent, false);
            return new ViewHolder(view);
        }

        @Override
        public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
            LedgerItem item = currentDisplayList.get(position);
            holder.tvTitle.setText(item.title);
            holder.tvDesc.setText(item.description);
            holder.tvDate.setText(item.dateStr);

            if (item.isPositive) {
                holder.tvAmount.setText("+" + LocationUtils.formatCurrency(item.amount));
                if (getContext() != null) {
                    holder.tvAmount.setTextColor(ContextCompat.getColor(getContext(), R.color.veg_green));
                    holder.ivIcon.setColorFilter(ContextCompat.getColor(getContext(), R.color.veg_green));
                }
                holder.ivIcon.setImageResource(R.drawable.ic_arrow_down_left);
            } else {
                holder.tvAmount.setText("-" + LocationUtils.formatCurrency(item.amount));
                if (getContext() != null) {
                    holder.tvAmount.setTextColor(ContextCompat.getColor(getContext(), R.color.error));
                    holder.ivIcon.setColorFilter(ContextCompat.getColor(getContext(), R.color.error));
                }
                holder.ivIcon.setImageResource(R.drawable.ic_arrow_up_right);
            }

            // Status Pill
            String st = item.status != null ? item.status.toUpperCase(Locale.ROOT) : "COMPLETED";
            holder.tvStatus.setText(st);
            if ("PENDING".equals(st)) {
                holder.tvStatus.setBackgroundResource(R.drawable.bg_pill_amber_soft);
                if (getContext() != null) holder.tvStatus.setTextColor(ContextCompat.getColor(getContext(), R.color.warning));
            } else if ("REJECTED".equals(st) || "FAILED".equals(st)) {
                holder.tvStatus.setBackgroundResource(R.drawable.bg_pill_error_soft);
                if (getContext() != null) holder.tvStatus.setTextColor(ContextCompat.getColor(getContext(), R.color.error));
            } else {
                holder.tvStatus.setBackgroundResource(R.drawable.bg_pill_emerald_soft);
                if (getContext() != null) holder.tvStatus.setTextColor(ContextCompat.getColor(getContext(), R.color.veg_green));
            }
        }

        @Override
        public int getItemCount() {
            return currentDisplayList.size();
        }

        class ViewHolder extends RecyclerView.ViewHolder {
            ImageView ivIcon;
            TextView tvTitle, tvDesc, tvDate, tvAmount, tvStatus;

            ViewHolder(View v) {
                super(v);
                ivIcon = v.findViewById(R.id.iv_tx_icon);
                tvTitle = v.findViewById(R.id.tv_tx_title);
                tvDesc = v.findViewById(R.id.tv_tx_desc);
                tvDate = v.findViewById(R.id.tv_tx_date);
                tvAmount = v.findViewById(R.id.tv_tx_amount);
                tvStatus = v.findViewById(R.id.tv_tx_status);
            }
        }
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        if (partnerListener != null) partnerListener.remove();
        if (ordersListener != null) ordersListener.remove();
        if (withdrawalsListener != null) withdrawalsListener.remove();
        if (subTransactionsListener != null) subTransactionsListener.remove();
        if (globalTransactionsListener != null) globalTransactionsListener.remove();
    }
}
