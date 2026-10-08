'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useDeliveryAuth } from '@/context/DeliveryAuthContext';
import { Card } from '@/components/ui/card';
import { Loader } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { db } from '@/lib/firebase';
import {
  collection, query, where, onSnapshot, orderBy,
  doc, updateDoc, increment, serverTimestamp, addDoc
} from 'firebase/firestore';
import {
  IndianRupee, Wallet, CreditCard, AlertTriangle,
  CheckCircle2, Clock, ArrowRight, History, Sparkles,
  ShieldCheck, ArrowDownLeft, ArrowUpRight, Heart,
  Gift, Bike, Banknote, RefreshCw, Zap, Receipt,
  ChevronRight, HelpCircle, Check, AlertCircle, ShoppingBag,
  ArrowDownToLine, Send, Building2, Smartphone
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { loadRazorpayScript } from '@/lib/razorpay';
import { formatOrderId, Order, WithdrawalRequest } from '@/lib/types';

export default function DeliveryWalletPage() {
  const router = useRouter();
  const { user, deliveryPartner: authPartner, loading: authLoading } = useDeliveryAuth();

  // Real-time partner profile doc from Firestore
  const [partnerDoc, setPartnerDoc] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [deliveredOrders, setDeliveredOrders] = useState<Order[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'pending_cod' | 'paid_cod' | 'withdrawals' | 'history'>('pending_cod');

  // Razorpay Payment Tracking State
  const [paymentTrack, setPaymentTrack] = useState<{
    status: 'idle' | 'initiating' | 'verifying' | 'success' | 'failed';
    paymentId?: string;
    amount?: number;
    error?: string;
  }>({ status: 'idle' });

  // Withdrawal Modal State
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [withdrawMethod, setWithdrawMethod] = useState<'upi' | 'bank'>('upi');
  const [upiId, setUpiId] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/delivery/login');
    }
  }, [user, authLoading, router]);

  // 1. Live subscribe to deliveryPersons/{uid}
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'deliveryPersons', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setPartnerDoc(docSnap.data());
      }
    });
    return () => unsub();
  }, [user]);

  // 2. Live subscribe to walletTransactions subcollection
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'deliveryPersons', user.uid, 'walletTransactions'),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const txs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setTransactions(txs);
        setLoading(false);
      },
      (err) => {
        console.warn('[Wallet] Transactions subscription note:', err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  // 3. Live subscribe to withdrawals collection for this rider
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'withdrawals'),
      where('riderId', '==', user.uid)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as WithdrawalRequest));
        list.sort((a: any, b: any) => {
          const tA = a.requestedAt?.seconds || 0;
          const tB = b.requestedAt?.seconds || 0;
          return tB - tA;
        });
        setWithdrawals(list);
      },
      (err) => {
        console.warn('[Wallet] Withdrawals subscription note:', err.message);
      }
    );

    return () => unsub();
  }, [user]);

  // 4. Live subscribe to delivered orders for this driver to compute exact COD vs Prepaid breakdown & time periods
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'orders'),
      where('deliveryPersonId', '==', user.uid),
      where('status', '==', 'delivered')
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const ords = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Order));
        // Sort descending by delivery or creation time
        ords.sort((a, b) => {
          const tA = a.deliveredAt?.seconds || a.createdAt?.seconds || 0;
          const tB = b.deliveredAt?.seconds || b.createdAt?.seconds || 0;
          return tB - tA;
        });
        setDeliveredOrders(ords);
      },
      (err) => {
        console.warn('[Wallet] Orders subscription note:', err.message);
      }
    );

    return () => unsub();
  }, [user]);

  // ─── ACCOUNTING DATA RECONCILIATION ─────────────────────────────────────────
  const partner = partnerDoc || authPartner || {};

  // Compute stats and time frames from orders
  const {
    codOrders,
    onlineOrders,
    computedCodCollected,
    computedDeliveryEarnings,
    computedTips,
    todayEarnings,
    weekEarnings,
    monthEarnings,
  } = useMemo(() => {
    let codTotal = 0;
    let delivEarnings = 0;
    let tipsTotal = 0;
    let todayTotal = 0;
    let weekTotal = 0;
    let monthTotal = 0;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const codList: Order[] = [];
    const onlineList: Order[] = [];

    deliveredOrders.forEach((o) => {
      const isCod = o.paymentMethod === 'cod';
      const orderTotal = Number(o.total || 0);
      const itemsCount = o.items?.reduce((s, it) => s + (it.quantity || 1), 0) || 1;
      const rawFee = Number(o.deliveryCharge || (o as any).deliveryFee || (itemsCount > 1 ? 60 : 40));
      // 80% of delivery fee strictly
      const orderEarning = Number(o.deliveryEarnings || o.earnings || Math.round(rawFee * 0.8));
      const orderTip = Number(o.tip || (o as any).tipAmount || 0);
      const fullEarn = orderEarning + orderTip;

      delivEarnings += orderEarning;
      tipsTotal += orderTip;

      const orderTime = o.deliveredAt?.seconds
        ? o.deliveredAt.seconds * 1000
        : (o.createdAt?.seconds ? o.createdAt.seconds * 1000 : 0);

      if (orderTime >= startOfToday) todayTotal += fullEarn;
      if (orderTime >= startOfWeek) weekTotal += fullEarn;
      if (orderTime >= startOfMonth) monthTotal += fullEarn;

      if (isCod) {
        codTotal += orderTotal;
        codList.push(o);
      } else {
        onlineList.push(o);
      }
    });

    return {
      codOrders: codList,
      onlineOrders: onlineList,
      computedCodCollected: codTotal,
      computedDeliveryEarnings: delivEarnings,
      computedTips: tipsTotal,
      todayEarnings: todayTotal,
      weekEarnings: weekTotal,
      monthEarnings: monthTotal,
    };
  }, [deliveredOrders]);

  // Compute sum of deposit transactions paid by rider to platform
  const { computedDepositsTotal, paidDepositsList } = useMemo(() => {
    let total = 0;
    const deposits: any[] = [];
    transactions.forEach((tx) => {
      if (tx.type === 'deposit' || tx.type === 'payment' || tx.type === 'cod_deposit' || tx.type === 'cod_settlement' || tx.type === 'COD_SETTLEMENT') {
        const amt = Number(tx.amount || 0);
        total += amt;
        deposits.push(tx);
      }
    });
    return { computedDepositsTotal: total, paidDepositsList: deposits };
  }, [transactions]);

  // 1. 🟢 Total Available Earnings (Actual Withdrawable Earnings)
  const deliveryEarnings = Math.max(Number(partner.deliveryEarnings || 0), computedDeliveryEarnings);
  const tips = Math.max(Number(partner.tips || 0), computedTips); // 100% to rider, 0% commission
  const incentives = Number(partner.incentives || 0);
  const cancellationComp = Number(partner.cancellationCompensation || 0);
  const totalLifetimeEarnings = deliveryEarnings + tips + incentives + cancellationComp;

  // Already withdrawn amount
  const withdrawnAmount = Number(partner.withdrawnAmount || 0);

  // Available Withdrawable Balance: reconciled against lifetime minus withdrawn
  const availableEarnings = Math.max(
    Number(partner.availableEarnings || 0),
    totalLifetimeEarnings - withdrawnAmount
  );

  // Auto-sync availableEarnings to Firestore deliveryPersons/{uid} if document is uninitialized or behind
  useEffect(() => {
    if (!user || !partnerDoc) return;
    const dbAvailable = Number(partnerDoc.availableEarnings ?? 0);
    const expectedAvailable = Math.max(0, totalLifetimeEarnings - withdrawnAmount);

    if (expectedAvailable > 0 && dbAvailable < expectedAvailable) {
      updateDoc(doc(db, 'deliveryPersons', user.uid), {
        availableEarnings: expectedAvailable,
        totalEarnings: Math.max(Number(partnerDoc.totalEarnings || 0), totalLifetimeEarnings),
        deliveryEarnings: Math.max(Number(partnerDoc.deliveryEarnings || 0), deliveryEarnings),
        tips: Math.max(Number(partnerDoc.tips || 0), tips),
        updatedAt: serverTimestamp(),
      }).catch(err => console.warn('[Wallet] Syncing available earnings note:', err));
    }
  }, [user, partnerDoc, totalLifetimeEarnings, withdrawnAmount, deliveryEarnings, tips]);

  // Pending Earnings (Section 18)
  const pendingEarnings = Number(partner.pendingEarnings || 0);

  // 2. 🔴 COD Cash / Platform Payable (Customer cash collected)
  const totalCodCollected = Math.max(Number(partner.codCollected || 0), computedCodCollected);
  const totalCodDeposited = Math.max(Number(partner.codDeposited || 0), computedDepositsTotal);
  const remainingCodPayable = Math.max(0, totalCodCollected - totalCodDeposited);

  // 3. 🟡 Settlement Balance / Current Balance = Available Earnings - Remaining COD
  const netSettlementBalance = availableEarnings - remainingCodPayable;

  // 4. Cash Limit Meter (Section 6, 7, 8, 9, 33)
  const cashLimit = Number(partner.codLimit || partner.cashLimit || 3000);
  const cashLimitRatio = cashLimit > 0 ? (remainingCodPayable / cashLimit) : 0;
  const is80Percent = cashLimitRatio >= 0.8 && cashLimitRatio < 0.9;
  const is90Percent = cashLimitRatio >= 0.9 && cashLimitRatio < 1.0;
  const is100Percent = remainingCodPayable >= cashLimit || partner.codBlocked === true;

  // Initialize custom payment input with full net debt or remaining COD if needed
  useEffect(() => {
    if (!customAmount) {
      if (netSettlementBalance < 0) {
        setCustomAmount(Math.abs(netSettlementBalance).toFixed(0));
      } else if (remainingCodPayable > 0) {
        setCustomAmount(remainingCodPayable.toFixed(0));
      }
    }
  }, [netSettlementBalance, remainingCodPayable]);

  const parsedPayAmount = parseFloat(customAmount) || 0;
  const projectedRemainingCod = Math.max(0, remainingCodPayable - parsedPayAmount);
  const projectedNetBalance = availableEarnings - projectedRemainingCod;

  // ─── COD SETTLEMENT VIA BACKEND SERVICE ─────────────────────────────────────
  const executeDepositSettlement = async (amountToPay: number, paymentMethod: string, paymentId: string) => {
    if (!user) return;
    try {
      const res = await fetch('/api/delivery/wallet/settle-cod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          riderId: user.uid,
          amount: amountToPay,
          paymentMethod,
          reference: paymentId,
          autoVerify: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to settle COD');
      }

      toast.success(`🎉 Deposited ₹${amountToPay.toLocaleString('en-IN')}! Remaining COD: ₹${Math.max(0, remainingCodPayable - amountToPay).toLocaleString('en-IN')}`);
      setCustomAmount('');
    } catch (err: any) {
      console.error('[Wallet] Error executing deposit:', err);
      toast.error('Failed to record deposit: ' + (err.message || 'Error'));
    }
  };

  // Pay exclusively via Razorpay Gateway with Live Tracking & Ledger Verification
  const handleRazorpayPayment = async () => {
    if (!user) return;
    const amountToPay = parsedPayAmount;
    if (isNaN(amountToPay) || amountToPay <= 0) {
      toast.error('Please enter a valid amount (minimum ₹1)');
      return;
    }

    setPaying(true);
    setPaymentTrack({ status: 'initiating', amount: amountToPay });

    try {
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        throw new Error('Razorpay SDK failed to load. Please check your internet connection.');
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_YourKeyHere',
        amount: Math.round(amountToPay * 100),
        currency: 'INR',
        name: 'Hunger Rider COD Settlement',
        description: `COD Cash Settle ₹${amountToPay} - ${partner?.name || 'Rider'}`,
        image: '/hunger.png',
        handler: async function (response: any) {
          const rzpPaymentId = response.razorpay_payment_id || `RZP-${Date.now()}`;
          setPaymentTrack({
            status: 'verifying',
            amount: amountToPay,
            paymentId: rzpPaymentId,
          });

          try {
            await executeDepositSettlement(
              amountToPay,
              'Razorpay Secure Gateway',
              rzpPaymentId
            );
            setPaymentTrack({
              status: 'success',
              amount: amountToPay,
              paymentId: rzpPaymentId,
            });
            toast.success(`🎉 Payment of ₹${amountToPay.toLocaleString('en-IN')} verified via Razorpay!`);
          } catch (verErr: any) {
            setPaymentTrack({
              status: 'failed',
              error: verErr.message || 'Settlement recording failed',
            });
          } finally {
            setPaying(false);
          }
        },
        prefill: {
          name: partner?.name || 'Delivery Partner',
          email: partner?.email || '',
          contact: partner?.phone || '',
        },
        theme: {
          color: '#f97316',
        },
        modal: {
          ondismiss: () => {
            setPaying(false);
            setPaymentTrack(prev => prev.status === 'initiating' ? { status: 'idle' } : prev);
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (resp: any) {
        const errMsg = resp.error?.description || 'Razorpay payment was declined';
        setPaymentTrack({
          status: 'failed',
          error: errMsg,
        });
        toast.error(`Payment failed: ${errMsg}`);
        setPaying(false);
      });
      rzp.open();
    } catch (err: any) {
      console.error('[Wallet] Payment error:', err);
      toast.error(err.message || 'Payment initiation failed');
      setPaymentTrack({ status: 'failed', error: err.message });
      setPaying(false);
    }
  };

  // ─── WITHDRAWAL SUBMISSION ──────────────────────────────────────────────────
  const handleConfirmWithdrawal = async () => {
    if (!user) return;
    const numAmount = parseFloat(withdrawAmount);

    if (isNaN(numAmount) || numAmount < 100) {
      toast.error('Minimum withdrawal amount is ₹100');
      return;
    }
    if (numAmount > 5000) {
      toast.error('Maximum daily withdrawal limit is ₹5,000');
      return;
    }
    if (numAmount > availableEarnings) {
      toast.error(`Amount exceeds Total Available Earnings (₹${availableEarnings})`);
      return;
    }

    let destinationRef = '';
    if (withdrawMethod === 'upi') {
      if (!upiId || !upiId.includes('@')) {
        toast.error('Please enter a valid UPI ID (e.g. name@bank)');
        return;
      }
      destinationRef = upiId.trim();
    } else {
      if (!accountNumber || accountNumber.length < 8) {
        toast.error('Please enter a valid bank account number');
        return;
      }
      if (!ifscCode || ifscCode.length < 4) {
        toast.error('Please enter a valid IFSC code');
        return;
      }
      destinationRef = `${bankName || 'Bank'}: A/C ${accountNumber} (IFSC: ${ifscCode.toUpperCase()})`;
    }

    setWithdrawing(true);
    try {
      const res = await fetch('/api/delivery/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          riderId: user.uid,
          amount: numAmount,
          paymentMethod: withdrawMethod,
          destinationReference: destinationRef,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit withdrawal');
      }

      toast.success(`💸 Withdrawal of ₹${numAmount} requested successfully! Status: PENDING`);
      setWithdrawModalOpen(false);
      setWithdrawAmount('');
      setActiveTab('withdrawals');
    } catch (err: any) {
      console.error('[Withdrawal Error]:', err);
      toast.error(err.message || 'Withdrawal failed');
    } finally {
      setWithdrawing(false);
    }
  };

  if (authLoading || (user && loading)) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-white gap-3">
        <Loader />
        <p className="text-gray-400 text-sm animate-pulse">Loading Rider Wallet & COD Ledger...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-5xl mx-auto pb-32 md:pb-12 text-white">
      {/* ─── HEADER ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-black uppercase tracking-widest text-orange-400 bg-orange-500/10 px-2.5 py-0.5 rounded-full border border-orange-500/20">
              Hunger Delivery Partner
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            Rider <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-500">Wallet</span>
          </h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">
            Complete financial ledger: 80% delivery earnings, 100% tips, COD limit tracking & instant withdrawals.
          </p>
        </div>

        {/* Status Pill */}
        <div>
          {is100Percent ? (
            <Badge className="bg-red-500/20 text-red-400 border border-red-500/40 px-3.5 py-2 text-xs font-bold animate-pulse flex items-center gap-1.5 rounded-xl">
              <AlertTriangle className="w-4 h-4" />
              🔴 COD Limit Full (New COD Orders Blocked)
            </Badge>
          ) : is90Percent ? (
            <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 rounded-xl">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              🔶 COD Limit Almost Full (90% Used)
            </Badge>
          ) : is80Percent ? (
            <Badge className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 rounded-xl">
              <AlertCircle className="w-4 h-4 text-yellow-400" />
              🟡 COD Limit 80% Used (Please Settle Soon)
            </Badge>
          ) : (
            <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 rounded-xl">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              🟢 COD Limit Available
            </Badge>
          )}
        </div>
      </div>

      {/* ─── COD LIMIT 80%/90%/100% WARNING BANNER ────────────────────────── */}
      {is100Percent ? (
        <div className="p-4 sm:p-5 rounded-3xl bg-red-500/15 border-2 border-red-500/40 backdrop-blur-xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
              <AlertTriangle className="w-6 h-6 text-red-400 animate-bounce" />
            </div>
            <div>
              <h3 className="font-black text-white text-base flex items-center gap-2">
                🔴 COD LIMIT FULL
              </h3>
              <p className="text-gray-300 text-xs mt-0.5">
                Your COD cash limit (₹{cashLimit}) has been reached. Please settle your outstanding COD cash to receive COD orders again.
                <span className="text-emerald-400 font-bold ml-1">Prepaid orders remain active!</span>
              </p>
            </div>
          </div>
          <Button
            onClick={() => {
              const el = document.getElementById('deposit-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="w-full sm:w-auto h-11 px-5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs gap-2 shrink-0 shadow-lg shadow-red-900/40"
          >
            <Banknote className="w-4 h-4" /> Settle COD Now
          </Button>
        </div>
      ) : is90Percent ? (
        <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
          <span><strong>🔶 COD Limit Almost Full:</strong> ₹{remainingCodPayable} / ₹{cashLimit} (90% capacity). Please settle COD cash soon to avoid order assignment pauses.</span>
        </div>
      ) : is80Percent ? (
        <div className="p-4 rounded-2xl bg-yellow-500/15 border border-yellow-500/40 text-yellow-200 text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0" />
          <span><strong>🟡 COD Limit 80% Used:</strong> ₹{remainingCodPayable} / ₹{cashLimit}. Please settle COD cash soon.</span>
        </div>
      ) : null}

      {/* ─── CASH LIMIT METER (Section 6, 7, 8, 9) ────────────────────────── */}
      <Card className="bg-white/5 border border-white/10 rounded-3xl p-5 backdrop-blur-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-300">COD Cash in Hand Limit</p>
              <p className="text-[11px] text-gray-500">Customer cash collected for Hunger. Must be settled periodically.</p>
            </div>
          </div>
          <div className="text-right flex items-center gap-2 self-end sm:self-auto">
            <span className="font-mono font-black text-lg text-white">
              ₹{remainingCodPayable.toLocaleString('en-IN')}
            </span>
            <span className="text-gray-500 text-xs">/ ₹{cashLimit.toLocaleString('en-IN')}</span>
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
              is100Percent
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : is90Percent
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : is80Percent
                ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            }`}>
              {is100Percent ? '🔴 Limit Full' : is90Percent ? '🔶 90% Full' : is80Percent ? '🟡 80% Used' : '🟢 Available'}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              is100Percent
                ? 'bg-gradient-to-r from-red-600 to-rose-500'
                : is90Percent
                ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                : is80Percent
                ? 'bg-gradient-to-r from-yellow-400 to-amber-500'
                : 'bg-gradient-to-r from-emerald-500 to-teal-400'
            }`}
            style={{ width: `${Math.min(100, (remainingCodPayable / cashLimit) * 100)}%` }}
          />
        </div>

        <p className="text-[11px] text-gray-400 flex items-center justify-between">
          <span>Configured COD threshold: ₹{cashLimit.toLocaleString('en-IN')} max cash buffer.</span>
          <span className="text-gray-500">Capacity used: {Math.round((remainingCodPayable / cashLimit) * 100)}%</span>
        </p>
      </Card>

      {/* ─── 3 PRIMARY BALANCES (THE CORE FINANCIAL ENGINE) ────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* 1. 🟢 TOTAL AVAILABLE EARNINGS + WITHDRAW BUTTON */}
        <Card className="bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/30 rounded-3xl p-6 backdrop-blur-xl relative overflow-hidden shadow-xl shadow-emerald-950/20 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
                <IndianRupee className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/25">
                🟢 Available for Withdrawal
              </span>
            </div>

            <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Total Available Earnings</p>
            <h2 className="text-4xl font-black font-mono text-emerald-400 tracking-tight mt-1">
              ₹{availableEarnings.toLocaleString('en-IN')}
            </h2>

            <p className="text-[11px] text-gray-400 mt-2 mb-4">
              Money you have earned and can withdraw immediately. Never combined with COD debt.
            </p>

            {/* WITHDRAW BUTTON (Section 22) */}
            <Button
              onClick={() => {
                setWithdrawAmount(availableEarnings > 0 ? Math.min(5000, availableEarnings).toString() : '100');
                setWithdrawModalOpen(true);
              }}
              className="w-full h-12 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-black font-black text-sm rounded-2xl shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 mb-4"
            >
              <ArrowDownToLine className="w-5 h-5 text-black" />
              💸 WITHDRAW EARNINGS
            </Button>

            {/* Breakdown Items */}
            <div className="space-y-2 pt-3 border-t border-white/10 text-xs">
              <div className="flex justify-between items-center text-gray-300">
                <span className="flex items-center gap-1.5">
                  <Bike className="w-3.5 h-3.5 text-blue-400" />
                  Delivery Charge Share (80%)
                </span>
                <span className="font-mono font-bold text-white">₹{deliveryEarnings.toLocaleString('en-IN')}</span>
              </div>

              <div className="flex justify-between items-center text-emerald-300 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                <span className="flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
                  Customer Tips (100% to You)
                </span>
                <span className="font-mono font-bold text-emerald-400">₹{tips.toLocaleString('en-IN')}</span>
              </div>

              <div className="flex justify-between items-center text-gray-300">
                <span className="flex items-center gap-1.5">
                  <Gift className="w-3.5 h-3.5 text-purple-400" />
                  Incentives & Bonus
                </span>
                <span className="font-mono font-bold text-white">₹{incentives.toLocaleString('en-IN')}</span>
              </div>

              {cancellationComp > 0 && (
                <div className="flex justify-between items-center text-gray-300">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                    Cancellation Comp
                  </span>
                  <span className="font-mono font-bold text-white">₹{cancellationComp.toLocaleString('en-IN')}</span>
                </div>
              )}

              {withdrawnAmount > 0 && (
                <div className="flex justify-between items-center text-gray-400 pt-1 border-t border-white/5">
                  <span>Already Withdrawn:</span>
                  <span className="font-mono font-semibold text-gray-300">₹{withdrawnAmount.toLocaleString('en-IN')}</span>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* 2. 🔴 COD CASH / PLATFORM PAYABLE */}
        <Card className="bg-gradient-to-br from-orange-500/10 via-red-500/5 to-transparent border border-orange-500/30 rounded-3xl p-6 backdrop-blur-xl relative overflow-hidden shadow-xl shadow-orange-950/20">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-500/20 text-orange-400 rounded-2xl border border-orange-500/30">
              <Banknote className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-orange-400 bg-orange-500/10 px-2.5 py-1 rounded-xl border border-orange-500/25">
              🔴 COD Outstanding
            </span>
          </div>

          <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">COD Cash Outstanding</p>
          <h2 className="text-4xl font-black font-mono text-orange-400 tracking-tight mt-1">
            ₹{remainingCodPayable.toLocaleString('en-IN')}
          </h2>

          <p className="text-[11px] text-gray-400 mt-2 mb-4">
            Customer cash collected for Hunger. Belongs to the platform, not rider income.
          </p>

          <Button
            onClick={() => {
              const el = document.getElementById('deposit-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            variant="outline"
            className="w-full h-12 border-orange-500/40 text-orange-300 hover:bg-orange-500/10 font-bold rounded-2xl mb-4 text-xs"
          >
            ⚡ SETTLE COD CASH
          </Button>

          {/* Breakdown Items */}
          <div className="space-y-2 pt-3 border-t border-white/10 text-xs">
            <div className="flex justify-between items-center text-gray-300">
              <span className="flex items-center gap-1.5">
                <ArrowDownLeft className="w-3.5 h-3.5 text-orange-400" />
                Total Cash Collected
              </span>
              <span className="font-mono font-bold text-white">₹{totalCodCollected.toLocaleString('en-IN')}</span>
            </div>

            <div className="flex justify-between items-center text-gray-300">
              <span className="flex items-center gap-1.5">
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                Verified Settlements
              </span>
              <span className="font-mono font-bold text-emerald-400">-₹{totalCodDeposited.toLocaleString('en-IN')}</span>
            </div>

            <div className="flex justify-between items-center text-orange-300 bg-orange-500/10 px-2 py-1 rounded-lg border border-orange-500/20">
              <span>Remaining COD Debt</span>
              <span className="font-mono font-bold text-orange-400">₹{remainingCodPayable.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </Card>

        {/* 3. 🟡 CURRENT SETTLEMENT BALANCE */}
        <Card className={`rounded-3xl p-6 backdrop-blur-xl relative overflow-hidden shadow-xl border ${
          netSettlementBalance < 0
            ? 'bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-transparent border-amber-500/40 shadow-amber-950/20'
            : 'bg-gradient-to-br from-emerald-500/15 via-blue-500/10 to-transparent border-emerald-500/40 shadow-emerald-950/20'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className={`p-3 rounded-2xl border ${
              netSettlementBalance < 0
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
            }`}>
              <Wallet className="w-6 h-6" />
            </div>
            <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-xl border ${
              netSettlementBalance < 0
                ? 'text-amber-300 bg-amber-500/15 border-amber-500/30'
                : 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30'
            }`}>
              {netSettlementBalance < 0 ? '🟡 Net Due to Hunger' : '🟢 Net Surplus'}
            </span>
          </div>

          <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">
            Current Settlement Balance
          </p>
          <h2 className={`text-4xl font-black font-mono tracking-tight mt-1 ${
            netSettlementBalance < 0 ? 'text-amber-400' : 'text-emerald-400'
          }`}>
            {netSettlementBalance < 0
              ? `-₹${Math.abs(netSettlementBalance).toLocaleString('en-IN')}`
              : netSettlementBalance === 0
              ? '₹0.00'
              : `+₹${netSettlementBalance.toLocaleString('en-IN')}`}
          </h2>

          <p className="text-[11px] text-gray-400 mt-2 mb-4">
            Available Earnings (₹{availableEarnings}) − Remaining COD (₹{remainingCodPayable})
          </p>

          {/* Pending Earnings badge (Section 18) */}
          {pendingEarnings > 0 && (
            <div className="mb-3 p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs flex justify-between items-center">
              <span>Pending Earnings (in review):</span>
              <span className="font-mono font-bold">₹{pendingEarnings}</span>
            </div>
          )}

          <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-300 space-y-1.5">
            <div className="flex justify-between">
              <span>Withdrawable Earnings:</span>
              <span className="font-mono text-emerald-400 font-bold">+₹{availableEarnings}</span>
            </div>
            <div className="flex justify-between">
              <span>COD Cash Held:</span>
              <span className="font-mono text-orange-400 font-bold">-₹{remainingCodPayable}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-white/10 font-bold">
              <span>Net Position:</span>
              <span className={`font-mono ${netSettlementBalance < 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {netSettlementBalance < 0 ? `-₹${Math.abs(netSettlementBalance)}` : `+₹${netSettlementBalance}`}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* ─── TIME-RANGE EARNINGS (Section 32) ─────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md">
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Today's Earnings</p>
          <p className="text-2xl font-black font-mono text-white mt-1">₹{todayEarnings.toLocaleString('en-IN')}</p>
          <p className="text-[11px] text-gray-500 mt-1">From deliveries completed today</p>
        </Card>

        <Card className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md">
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">This Week</p>
          <p className="text-2xl font-black font-mono text-white mt-1">₹{weekEarnings.toLocaleString('en-IN')}</p>
          <p className="text-[11px] text-gray-500 mt-1">Total cycle earnings this week</p>
        </Card>

        <Card className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md">
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">This Month</p>
          <p className="text-2xl font-black font-mono text-white mt-1">₹{monthEarnings.toLocaleString('en-IN')}</p>
          <p className="text-[11px] text-gray-500 mt-1">Gross month-to-date payouts</p>
        </Card>
      </div>

      {/* ─── INTERACTIVE DEPOSIT & SETTLEMENT FORM ─────────────────────────── */}
      <Card id="deposit-section" className="bg-gradient-to-r from-orange-950/30 via-black to-amber-950/30 border border-orange-500/30 rounded-3xl p-6 sm:p-7 backdrop-blur-2xl shadow-2xl space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-orange-400" />
              Settle COD Cash & Restore Full Order Eligibility
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Enter any amount to deposit. Verified settlements immediately reduce COD outstanding and automatically unblock COD orders.
            </p>
          </div>

          {remainingCodPayable > 0 && (
            <Badge className="bg-orange-500/20 text-orange-300 border border-orange-500/40 text-xs px-3 py-1 rounded-xl shrink-0">
              COD Outstanding: ₹{remainingCodPayable.toLocaleString('en-IN')}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          {/* Amount Input & Presets */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-gray-300 block">
              Enter Amount to Settle (₹):
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xl">₹</span>
              <Input
                type="number"
                min="1"
                placeholder={remainingCodPayable > 0 ? remainingCodPayable.toString() : '500'}
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="pl-9 bg-black/60 border-white/20 h-13 rounded-2xl text-white font-mono font-bold text-xl focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              />
            </div>

            {/* Quick Settle Presets */}
            <div className="flex flex-wrap gap-2 pt-1">
              {netSettlementBalance < 0 && (
                <button
                  type="button"
                  onClick={() => setCustomAmount(Math.abs(netSettlementBalance).toFixed(0))}
                  className="text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 transition-colors"
                >
                  Settle Net Due (₹{Math.abs(netSettlementBalance).toFixed(0)})
                </button>
              )}
              {remainingCodPayable > 0 && (
                <button
                  type="button"
                  onClick={() => setCustomAmount(remainingCodPayable.toFixed(0))}
                  className="text-xs font-bold px-3 py-1.5 rounded-xl bg-orange-500/20 text-orange-300 hover:bg-orange-500/30 border border-orange-500/40 transition-colors"
                >
                  Full COD (₹{remainingCodPayable.toFixed(0)})
                </button>
              )}
              {[100, 200, 500, 1000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setCustomAmount(amt.toString())}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-colors ${
                    customAmount === amt.toString()
                      ? 'bg-white/20 text-white border-white/40'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 border-white/10'
                  }`}
                >
                  ₹{amt}
                </button>
              ))}
            </div>
          </div>

          {/* Settle Live Calculation Box */}
          <div className="bg-black/50 border border-white/15 rounded-2xl p-4 space-y-2.5 text-xs">
            <p className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">Settlement Impact</p>
            <div className="flex justify-between items-center text-gray-400">
              <span>Current COD Outstanding:</span>
              <span className="font-mono font-bold text-orange-400">₹{remainingCodPayable}</span>
            </div>
            <div className="flex justify-between items-center text-gray-400">
              <span>Amount You Are Settle/Depositing:</span>
              <span className="font-mono font-bold text-emerald-400">+₹{parsedPayAmount.toFixed(0)}</span>
            </div>
            <div className="flex justify-between items-center text-gray-400">
              <span>Remaining COD After Settle:</span>
              <span className="font-mono font-bold text-white">₹{projectedRemainingCod.toFixed(0)}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-white/10 font-bold text-sm">
              <span className="text-white">New Settlement Balance:</span>
              <span className={`font-mono ${projectedNetBalance < 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {projectedNetBalance < 0 ? `-₹${Math.abs(projectedNetBalance).toFixed(0)}` : `+₹${projectedNetBalance.toFixed(0)}`}
              </span>
            </div>
          </div>
        </div>

        {/* ─── RAZORPAY LIVE PAYMENT TRACKING & STATUS SYSTEM ──────────────── */}
        {paymentTrack.status !== 'idle' && (
          <div className={`p-4 rounded-2xl border text-xs space-y-2 transition-all ${
            paymentTrack.status === 'verifying'
              ? 'bg-blue-500/15 border-blue-500/30 text-blue-200'
              : paymentTrack.status === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200'
              : paymentTrack.status === 'failed'
              ? 'bg-red-500/15 border-red-500/30 text-red-200'
              : 'bg-orange-500/15 border-orange-500/30 text-orange-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {paymentTrack.status === 'verifying' || paymentTrack.status === 'initiating' ? (
                  <Loader />
                ) : paymentTrack.status === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-400" />
                )}
                <span className="font-bold text-sm">
                  {paymentTrack.status === 'initiating' && 'Razorpay Gateway Opening...'}
                  {paymentTrack.status === 'verifying' && 'Verifying Payment & Updating Ledger...'}
                  {paymentTrack.status === 'success' && 'Razorpay Settlement Verified & Recorded!'}
                  {paymentTrack.status === 'failed' && 'Razorpay Transaction Failed'}
                </span>
              </div>

              {paymentTrack.paymentId && (
                <Badge className="bg-black/40 border-white/20 text-[10px] font-mono text-gray-300">
                  Ref: {paymentTrack.paymentId}
                </Badge>
              )}
            </div>

            {paymentTrack.status === 'success' && (
              <p className="text-[11px] text-emerald-300">
                ₹{paymentTrack.amount?.toLocaleString('en-IN')} successfully settled via Razorpay. Your COD Cash Outstanding has been updated.
              </p>
            )}

            {paymentTrack.status === 'failed' && (
              <p className="text-[11px] text-red-300">
                {paymentTrack.error || 'Payment could not be completed. Please try again.'}
              </p>
            )}
          </div>
        )}

        {/* Exclusive Razorpay Settlement Action Button */}
        <div className="pt-2">
          <Button
            onClick={handleRazorpayPayment}
            disabled={paying || parsedPayAmount <= 0}
            className="w-full bg-gradient-to-r from-orange-600 via-orange-500 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-black h-14 rounded-2xl shadow-xl shadow-orange-950/40 text-base transition-all flex items-center justify-center gap-2.5 active:scale-[0.99]"
          >
            {paying ? (
              <div className="flex items-center gap-2.5">
                <Loader />
                <span>Connecting to Razorpay Secure Gateway...</span>
              </div>
            ) : (
              <>
                <CreditCard className="w-5 h-5 text-white" />
                <span>Pay ₹{parsedPayAmount > 0 ? parsedPayAmount.toLocaleString('en-IN') : '0'} via Razorpay (UPI, Cards, NetBanking)</span>
              </>
            )}
          </Button>
          <p className="text-center text-[11px] text-gray-500 mt-2 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            256-bit encrypted official Razorpay payment gateway • Instant auto-settlement & unblock
          </p>
        </div>
      </Card>

      {/* ─── DETAILED BREAKDOWN TABS: PENDING COD vs PAID COD vs WITHDRAWALS vs LEDGER ──── */}
      <div className="space-y-4 pt-2">
        {/* Tab Switcher */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('pending_cod')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'pending_cod'
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Banknote className="w-4 h-4" />
            Pending COD Orders ({codOrders.length})
          </button>

          <button
            onClick={() => setActiveTab('paid_cod')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'paid_cod'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            Paid COD Settlements ({paidDepositsList.length})
          </button>

          <button
            onClick={() => setActiveTab('withdrawals')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'withdrawals'
                ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <ArrowDownToLine className="w-4 h-4" />
            Withdrawal History ({withdrawals.length})
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'history'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            Ledger Transactions ({transactions.length})
          </button>
        </div>

        {/* Tab 1: Pending COD Orders (Vertical Infinite Scroll Feed) */}
        {activeTab === 'pending_cod' && (
          <div className="bg-white/5 border border-white/10 rounded-3xl p-4 sm:p-6 backdrop-blur-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-orange-400" />
                <h3 className="font-bold text-white text-base">Delivered COD Orders Feed</h3>
              </div>
              <Badge className="bg-orange-500/15 text-orange-400 border-orange-500/30 text-xs font-mono font-bold">
                {codOrders.length} Orders
              </Badge>
            </div>

            {codOrders.length === 0 ? (
              <div className="py-14 text-center text-gray-500 text-sm">
                No COD orders delivered yet. When you deliver cash-on-delivery orders, they will appear here in chronological order with exact collection and earnings breakdown.
              </div>
            ) : (
              <div className="max-h-[580px] overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                {codOrders.map((ord) => {
                  const shortId = formatOrderId(ord.id);
                  const orderTotal = Number(ord.total || 0);
                  const earning = Number(ord.deliveryEarnings || ord.earnings || 40);
                  const netDue = orderTotal - earning;
                  return (
                    <div
                      key={ord.id}
                      className="bg-black/40 border border-white/10 rounded-2xl p-4 hover:border-orange-500/30 transition-all space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="text-sm font-mono font-black text-orange-400">#{shortId}</span>
                          <Badge className="bg-orange-500/15 text-orange-300 text-[10px] border border-orange-500/30 font-bold">
                            Cash on Delivery
                          </Badge>
                        </div>
                        <span className="text-xs text-gray-500 font-mono">
                          {ord.deliveredAt?.toDate ? ord.deliveredAt.toDate().toLocaleString() : 'Delivered'}
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div>
                          <p className="text-white font-bold text-sm">{ord.customerName || 'Customer'}</p>
                          <p className="text-gray-400 text-xs mt-0.5">{ord.restaurantName || 'Restaurant'}</p>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-[11px] text-gray-400">Cash Collected from Customer:</p>
                          <p className="font-mono font-black text-orange-400 text-lg">₹{orderTotal.toLocaleString('en-IN')}</p>
                        </div>
                      </div>

                      <div className="bg-black/60 border border-white/10 rounded-xl p-2.5 text-xs flex flex-wrap items-center justify-between gap-2 font-mono">
                        <span className="text-gray-400">Cash Collected: ₹{orderTotal}</span>
                        <span className="text-emerald-400 font-bold">Rider Share (80%): +₹{earning}</span>
                        <span className="text-amber-400 font-black">Net Platform Payable: -₹{netDue}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Paid COD Settlements (Vertical Infinite Scroll Feed) */}
        {activeTab === 'paid_cod' && (
          <div className="bg-white/5 border border-white/10 rounded-3xl p-4 sm:p-6 backdrop-blur-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-base">Verified COD Settlements Feed</h3>
              </div>
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs font-mono font-bold">
                {paidDepositsList.length} Settlements
              </Badge>
            </div>

            {paidDepositsList.length === 0 ? (
              <div className="py-14 text-center text-gray-500 text-sm">
                No COD cash settlements recorded yet. Use the Razorpay deposit section above to settle your collected cash.
              </div>
            ) : (
              <div className="max-h-[580px] overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                {paidDepositsList.map((dep) => (
                  <div
                    key={dep.id}
                    className="bg-black/40 border border-emerald-500/20 rounded-2xl p-4 hover:border-emerald-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                        <Receipt className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-white font-bold text-sm truncate">{dep.description || 'COD Cash Deposit'}</p>
                        <p className="text-gray-400 text-xs font-mono mt-0.5">
                          Ref: {dep.paymentId || dep.id?.slice(0, 10)} • {dep.createdAt?.toDate ? dep.createdAt.toDate().toLocaleString() : 'Settled'}
                        </p>
                      </div>
                    </div>

                    <div className="text-left sm:text-right shrink-0">
                      <p className="font-mono font-black text-emerald-400 text-lg">
                        +₹{Number(dep.amount || 0).toLocaleString('en-IN')}
                      </p>
                      <Badge className="bg-emerald-500/15 text-emerald-300 text-[10px] border border-emerald-500/30 font-bold mt-0.5">
                        Verified & Settled
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Withdrawal History (Vertical Infinite Scroll Feed) */}
        {activeTab === 'withdrawals' && (
          <div className="bg-white/5 border border-white/10 rounded-3xl p-4 sm:p-6 backdrop-blur-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <ArrowDownToLine className="w-5 h-5 text-teal-400" />
                <h3 className="font-bold text-white text-base">Withdrawal Payout History</h3>
              </div>
              <Badge className="bg-teal-500/15 text-teal-400 border-teal-500/30 text-xs font-mono font-bold">
                {withdrawals.length} Withdrawals
              </Badge>
            </div>

            {withdrawals.length === 0 ? (
              <div className="py-14 text-center text-gray-500 text-sm">
                No withdrawal requests found. Click the <strong>💸 Withdraw Earnings</strong> button above to request payouts to your Bank or UPI account.
              </div>
            ) : (
              <div className="max-h-[580px] overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                {withdrawals.map((w) => (
                  <div
                    key={w.id || w.withdrawalId}
                    className="bg-black/40 border border-white/10 rounded-2xl p-4 hover:border-teal-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400 shrink-0">
                        <ArrowDownToLine className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-white text-lg">₹{Number(w.amount).toLocaleString('en-IN')}</span>
                          <Badge className={`text-[10px] font-bold ${
                            w.status === 'COMPLETED'
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                              : w.status === 'PROCESSING'
                              ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                              : w.status === 'FAILED'
                              ? 'bg-red-500/20 text-red-400 border-red-500/30'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          }`}>
                            {w.status}
                          </Badge>
                        </div>
                        <p className="text-gray-400 text-xs mt-0.5">
                          {w.paymentMethod?.toUpperCase()} • {w.destinationReference}
                        </p>
                        <p className="text-gray-500 text-[11px] font-mono mt-0.5">
                          ID: {w.withdrawalId || w.id} • {w.requestedAt?.toDate ? w.requestedAt.toDate().toLocaleString() : 'Recent'}
                        </p>
                      </div>
                    </div>

                    {w.failureReason && (
                      <div className="text-left sm:text-right text-xs text-red-400 font-bold">
                        <span>Failed: {w.failureReason}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: All Wallet Transactions History (Vertical Infinite Scroll Feed) */}
        {activeTab === 'history' && (
          <div className="bg-white/5 border border-white/10 rounded-3xl p-4 sm:p-6 backdrop-blur-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-white text-base">Double-Entry Financial Ledger</h3>
              </div>
              <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-xs font-mono font-bold">
                {transactions.length} Ledger Entries
              </Badge>
            </div>

            {transactions.length === 0 ? (
              <div className="py-14 text-center text-gray-500 text-sm">No ledger transactions recorded yet.</div>
            ) : (
              <div className="max-h-[580px] overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-3.5 sm:p-4 rounded-2xl bg-black/40 border border-white/5 hover:border-white/15 transition-all flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        tx.isDebit || tx.direction === 'DEBIT'
                          ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                          : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      }`}>
                        {tx.isDebit || tx.direction === 'DEBIT' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-white text-xs sm:text-sm truncate">{tx.description || tx.type}</p>
                        <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                          {tx.createdAt?.toDate ? tx.createdAt.toDate().toLocaleString() : 'Just now'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-mono font-black text-sm sm:text-base ${
                        tx.isDebit || tx.direction === 'DEBIT' ? 'text-orange-400' : 'text-emerald-400'
                      }`}>
                        {tx.isDebit || tx.direction === 'DEBIT' ? '-' : '+'}₹{Number(tx.amount || 0).toFixed(2)}
                      </p>
                      <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold block mt-0.5">
                        {tx.type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── WITHDRAW EARNINGS MODAL (Section 23, 24, 25) ──────────────────── */}
      <Dialog open={withdrawModalOpen} onOpenChange={setWithdrawModalOpen}>
        <DialogContent className="bg-gray-950 border border-emerald-500/30 text-white max-w-md rounded-3xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-white flex items-center gap-2">
              <ArrowDownToLine className="w-6 h-6 text-emerald-400" />
              Withdraw Earnings
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Balance Badge */}
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex justify-between items-center">
              <div>
                <p className="text-[11px] text-gray-400 uppercase font-bold">Total Available Earnings</p>
                <p className="text-2xl font-black font-mono text-emerald-400">₹{availableEarnings.toLocaleString('en-IN')}</p>
              </div>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
                Eligible to Withdraw
              </Badge>
            </div>

            {/* Amount input */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-300">Enter Withdrawal Amount (₹):</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">₹</span>
                <Input
                  type="number"
                  min="100"
                  max="5000"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="500"
                  className="pl-8 bg-black/60 border-white/20 h-12 rounded-xl text-white font-mono font-bold text-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Quick Presets */}
              <div className="flex gap-2">
                {[200, 500, 1000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setWithdrawAmount(amt.toString())}
                    className="text-xs px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 font-bold"
                  >
                    ₹{amt}
                  </button>
                ))}
                {availableEarnings > 0 && (
                  <button
                    type="button"
                    onClick={() => setWithdrawAmount(Math.min(5000, availableEarnings).toString())}
                    className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-bold"
                  >
                    Max (₹{Math.min(5000, availableEarnings)})
                  </button>
                )}
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-300">Select Payout Method:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setWithdrawMethod('upi')}
                  className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    withdrawMethod === 'upi'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                      : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <Smartphone className="w-4 h-4" /> UPI ID
                </button>
                <button
                  type="button"
                  onClick={() => setWithdrawMethod('bank')}
                  className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    withdrawMethod === 'bank'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                      : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <Building2 className="w-4 h-4" /> Bank Account
                </button>
              </div>
            </div>

            {/* UPI Form */}
            {withdrawMethod === 'upi' ? (
              <div className="space-y-1.5">
                <label className="text-xs text-gray-400">Virtual Payment Address (UPI ID):</label>
                <Input
                  type="text"
                  placeholder="e.g. 9876543210@paytm or name@okaxis"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  className="bg-black/60 border-white/20 h-10 text-xs rounded-xl"
                />
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                <div>
                  <label className="text-gray-400 block mb-1">Account Holder Name:</label>
                  <Input
                    type="text"
                    placeholder="Full Name as in Bank"
                    value={accountHolder}
                    onChange={(e) => setAccountHolder(e.target.value)}
                    className="bg-black/60 border-white/20 h-9 text-xs rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-gray-400 block mb-1">Bank Name:</label>
                  <Input
                    type="text"
                    placeholder="e.g. HDFC Bank, SBI"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="bg-black/60 border-white/20 h-9 text-xs rounded-xl"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-gray-400 block mb-1">Account Number:</label>
                    <Input
                      type="password"
                      placeholder="XXXXXX1234"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      className="bg-black/60 border-white/20 h-9 text-xs rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 block mb-1">IFSC Code:</label>
                    <Input
                      type="text"
                      placeholder="e.g. HDFC0001234"
                      value={ifscCode}
                      onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                      className="bg-black/60 border-white/20 h-9 text-xs rounded-xl uppercase"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Fee & Receive Summary (Section 24) */}
            <div className="bg-black/50 border border-white/10 rounded-2xl p-3 text-xs space-y-1.5">
              <div className="flex justify-between text-gray-400">
                <span>Withdrawal Amount:</span>
                <span className="font-mono text-white font-bold">₹{parseFloat(withdrawAmount) || 0}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Processing Fee:</span>
                <span className="font-mono text-emerald-400 font-bold">₹0 (Free)</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-white/10 font-bold text-sm">
                <span className="text-white">You Receive:</span>
                <span className="font-mono text-emerald-400">₹{parseFloat(withdrawAmount) || 0}</span>
              </div>
            </div>

            <Button
              onClick={handleConfirmWithdrawal}
              disabled={withdrawing || !withdrawAmount || parseFloat(withdrawAmount) < 100 || parseFloat(withdrawAmount) > availableEarnings}
              className="w-full h-12 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm rounded-xl"
            >
              {withdrawing ? <Loader /> : 'CONFIRM WITHDRAWAL'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
