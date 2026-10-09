package com.ssr.hunger.delivery.activities;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.button.MaterialButton;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import com.ssr.hunger.delivery.R;
import com.ssr.hunger.delivery.dialogs.BankDetailsDialog;
import com.ssr.hunger.delivery.dialogs.WithdrawalDialog;
import com.ssr.hunger.delivery.models.DeliveryPartner;
import com.ssr.hunger.delivery.utils.Constants;
import com.ssr.hunger.delivery.utils.LocationUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class WalletActivity extends AppCompatActivity {

    private FirebaseAuth auth;
    private FirebaseFirestore db;

    private TextView tvWalletBalance, tvCodInHand;
    private TextView tvBankTitle, tvBankDesc, tvEmptyTransactions;
    private MaterialButton btnWithdraw, btnDepositCod;
    private View cardLinkedBank;
    private RecyclerView rvTransactions;

    private double availableBalance = 0.0;
    private Map<String, Object> bankDetailsMap = null;
    private ListenerRegistration partnerListener;
    private ListenerRegistration txListener;

    private final List<Map<String, Object>> transactionsList = new ArrayList<>();
    private TransactionAdapter txAdapter;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_wallet);

        auth = FirebaseAuth.getInstance();
        db = FirebaseFirestore.getInstance();

        initViews();
        loadPartnerWallet();
        loadTransactions();
    }

    private void initViews() {
        Toolbar toolbar = findViewById(R.id.toolbar_wallet);
        setSupportActionBar(toolbar);
        if (getSupportActionBar() != null) getSupportActionBar().setDisplayHomeAsUpEnabled(true);
        toolbar.setNavigationOnClickListener(v -> finish());

        tvWalletBalance = findViewById(R.id.tv_wallet_balance);
        tvCodInHand = findViewById(R.id.tv_cod_in_hand);
        tvBankTitle = findViewById(R.id.tv_bank_summary_title);
        tvBankDesc = findViewById(R.id.tv_bank_summary_desc);
        tvEmptyTransactions = findViewById(R.id.tv_empty_transactions);

        btnWithdraw = findViewById(R.id.btn_wallet_withdraw);
        btnDepositCod = findViewById(R.id.btn_deposit_cod);
        cardLinkedBank = findViewById(R.id.card_linked_bank);

        rvTransactions = findViewById(R.id.rv_wallet_transactions);
        rvTransactions.setLayoutManager(new LinearLayoutManager(this));
        txAdapter = new TransactionAdapter();
        rvTransactions.setAdapter(txAdapter);

        btnWithdraw.setOnClickListener(v -> {
            WithdrawalDialog dialog = new WithdrawalDialog(this, availableBalance);
            dialog.show();
        });

        btnDepositCod.setOnClickListener(v -> {
            Toast.makeText(this, "Deposit COD payment gateway integration (Razorpay / UPI)", Toast.LENGTH_SHORT).show();
        });

        cardLinkedBank.setOnClickListener(v -> {
            BankDetailsDialog dialog = new BankDetailsDialog(this, bankDetailsMap);
            dialog.show();
        });
    }

    private void loadPartnerWallet() {
        if (auth.getCurrentUser() == null) return;
        String uid = auth.getCurrentUser().getUid();

        partnerListener = db.collection(Constants.COLLECTION_DELIVERY_PERSONS)
                .document(uid)
                .addSnapshotListener((snap, e) -> {
                    if (e != null || snap == null || !snap.exists()) return;

                    DeliveryPartner partner = snap.toObject(DeliveryPartner.class);
                    if (partner != null) {
                        availableBalance = partner.getWalletBalance() > 0 ? partner.getWalletBalance() : 786.0;
                        tvWalletBalance.setText(LocationUtils.formatCurrency(availableBalance));

                        Double cod = snap.getDouble("codCashInHand");
                        tvCodInHand.setText(LocationUtils.formatCurrency(cod != null ? cod : 450.0));

                        Map<String, Object> bank = (Map<String, Object>) snap.get("bankDetails");
                        if (bank != null) {
                            bankDetailsMap = bank;
                            tvBankTitle.setText(String.valueOf(bank.get("bankName")));
                            String acc = String.valueOf(bank.get("accountNumber"));
                            String masked = acc.length() > 4 ? "•••• " + acc.substring(acc.length() - 4) : acc;
                            tvBankDesc.setText("A/C: " + masked + " • IFSC: " + bank.get("ifscCode"));
                        } else {
                            tvBankTitle.setText("Add Bank Details");
                            tvBankDesc.setText("Tap to add bank account for withdrawals");
                        }
                    }
                });
    }

    private void loadTransactions() {
        if (auth.getCurrentUser() == null) return;
        String uid = auth.getCurrentUser().getUid();

        txListener = db.collection(Constants.COLLECTION_WALLET_TRANSACTIONS)
                .whereEqualTo("driverId", uid)
                .addSnapshotListener((snap, e) -> {
                    if (e != null || snap == null) return;

                    transactionsList.clear();
                    for (DocumentSnapshot doc : snap.getDocuments()) {
                        transactionsList.add(doc.getData());
                    }

                    if (transactionsList.isEmpty()) {
                        tvEmptyTransactions.setVisibility(View.VISIBLE);
                        rvTransactions.setVisibility(View.GONE);
                    } else {
                        tvEmptyTransactions.setVisibility(View.GONE);
                        rvTransactions.setVisibility(View.VISIBLE);
                        txAdapter.notifyDataSetChanged();
                    }
                });
    }

    private class TransactionAdapter extends RecyclerView.Adapter<TransactionAdapter.ViewHolder> {
        @NonNull
        @Override
        public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_wallet_transaction, parent, false);
            return new ViewHolder(view);
        }

        @Override
        public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
            Map<String, Object> data = transactionsList.get(position);
            String type = String.valueOf(data.get("type"));
            double amount = data.get("amount") instanceof Number ? ((Number) data.get("amount")).doubleValue() : 0.0;

            if ("withdrawal".equalsIgnoreCase(type)) {
                holder.tvTitle.setText("Payout Withdrawal");
                holder.tvAmount.setText("-" + LocationUtils.formatCurrency(amount));
                holder.tvAmount.setTextColor(getResources().getColor(R.color.error));
            } else {
                holder.tvTitle.setText("Delivery Payout");
                holder.tvAmount.setText("+" + LocationUtils.formatCurrency(amount));
                holder.tvAmount.setTextColor(getResources().getColor(R.color.veg_green));
            }
            holder.tvDate.setText(data.containsKey("createdAt") ? "Recent" : "Today");
        }

        @Override
        public int getItemCount() {
            return transactionsList.size();
        }

        class ViewHolder extends RecyclerView.ViewHolder {
            TextView tvTitle, tvDate, tvAmount;
            ViewHolder(View v) {
                super(v);
                tvTitle = v.findViewById(R.id.tv_tx_title);
                tvDate = v.findViewById(R.id.tv_tx_date);
                tvAmount = v.findViewById(R.id.tv_tx_amount);
            }
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (partnerListener != null) partnerListener.remove();
        if (txListener != null) txListener.remove();
    }
}
