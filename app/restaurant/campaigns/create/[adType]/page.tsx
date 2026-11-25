'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useRestaurantAuth } from '@/context/RestaurantAuthContext';
import { loadRazorpayScript } from '@/lib/razorpay';
import {
  AD_PLACEMENTS,
  DEFAULT_AD_SETTINGS,
  estimateCampaignPerformance,
  formatDurationLabel,
  slugToAdType,
} from '@/lib/campaigns/constants';
import { AdSettings, CampaignAdType } from '@/lib/types';
import { AdPlacementPreview } from '@/components/restaurant/campaigns/AdPlacementPreviews';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ArrowLeft,
  CheckCircle2,
  Coins,
  CreditCard,
  IndianRupee,
  Info,
  Loader2,
  Megaphone,
  Search,
  ShieldCheck,
  Sparkles,
  Utensils,
  Wallet,
  AlertTriangle,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';

function toLocalDateInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toLocalTimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function CreateCampaignPage() {
  const params = useParams();
  const router = useRouter();
  const { user, restaurant, loading: authLoading } = useRestaurantAuth();

  const adType: CampaignAdType | null = slugToAdType(String(params?.adType || ''));
  const placementMeta = adType ? AD_PLACEMENTS[adType] : null;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [settings, setSettings] = useState<AdSettings>(DEFAULT_AD_SETTINGS);
  const [financials, setFinancials] = useState({
    availableWalletBalance: 0,
    availablePoints: 0,
    pointsToRupeeRate: 1,
  });
  const [menuItems, setMenuItems] = useState<any[]>([]);

  // Step 1: Info
  const [campaignName, setCampaignName] = useState('');
  const [description, setDescription] = useState('');
  const [offerBadge, setOfferBadge] = useState('');
  const [keywordsText, setKeywordsText] = useState('');

  // Step 2: Menu items
  const [itemSearch, setItemSearch] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  // Step 3: Budget
  const [budgetType, setBudgetType] = useState<'DAILY' | 'TOTAL'>('TOTAL');
  const [dailyBudgetInput, setDailyBudgetInput] = useState<string>('150');
  const [totalBudgetInput, setTotalBudgetInput] = useState<string>('500');

  // Step 4: Schedule (default start +10 mins, end +3 days)
  const defaultStart = useMemo(() => new Date(Date.now() + 10 * 60 * 1000), []);
  const defaultEnd = useMemo(() => new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), []);
  const [startDate, setStartDate] = useState(() => toLocalDateInputValue(defaultStart));
  const [startTime, setStartTime] = useState(() => toLocalTimeInputValue(defaultStart));
  const [endDate, setEndDate] = useState(() => toLocalDateInputValue(defaultEnd));
  const [endTime, setEndTime] = useState(() => toLocalTimeInputValue(defaultEnd));

  // Step 5: Payment Method
  const [paymentMode, setPaymentMode] = useState<'WALLET' | 'RAZORPAY' | 'REWARD_POINTS'>('WALLET');
  const [pointsToUseInput, setPointsToUseInput] = useState<string>('0');
  const [secondaryMethod, setSecondaryMethod] = useState<'WALLET' | 'RAZORPAY' | 'WALLET_AND_RAZORPAY'>('RAZORPAY');

  // Step 6: Terms & idempotency
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    `idem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  );

  const userTimezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
    []
  );

  useEffect(() => {
    const loadInitial = async () => {
      const firebaseUser = auth.currentUser || user;
      if (!firebaseUser) return;
      setLoading(true);
      try {
        const token = await firebaseUser.getIdToken();
        const res = await fetch('/api/campaigns', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const data = await res.json();
        if (res.ok && data.success) {
          if (data.settings) {
            setSettings(data.settings);
            setDailyBudgetInput(String(Math.max(150, data.settings.minDailyBudget || 50)));
            setTotalBudgetInput(String(Math.max(300, data.settings.minTotalBudget || 100)));
          }
          if (data.financials) {
            setFinancials(data.financials);
            setPointsToUseInput(String(Math.floor(data.financials.availablePoints || 0)));
          }
          const restId = data.restaurantId || user?.restaurantId || firebaseUser.uid;
          const itemsSnap = await getDocs(
            query(collection(db, 'menuItems'), where('restaurantId', '==', restId))
          );
          const loaded = itemsSnap.docs.map((d) => {
            const raw = d.data();
            const approved = !raw.approvalStatus || raw.approvalStatus === 'approved';
            const available = raw.available !== false && raw.isAvailable !== false;
            const notDeleted = raw.deleted !== true && raw.isDeleted !== true;
            return {
              id: d.id,
              ...raw,
              image: raw.image || raw.imageUrl || '/placeholder-food.png',
              eligible: approved && available && notDeleted,
              ineligibleReason: !notDeleted
                ? 'Deleted'
                : !approved
                ? `Status: ${raw.approvalStatus}`
                : !available
                ? 'Out of stock / Unavailable'
                : '',
            };
          });
          loaded.sort((a, b) => Number(b.eligible) - Number(a.eligible));
          setMenuItems(loaded);
          const firstEligible = loaded.find((i) => i.eligible);
          if (firstEligible) {
            setSelectedItemIds([firstEligible.id]);
          }
        }
      } catch (err: any) {
        toast.error(err.message || 'Failed to load campaign setup');
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading && user && adType) {
      loadInitial();
    }
  }, [authLoading, user, adType]);

  const startMs = useMemo(() => new Date(`${startDate}T${startTime}`).getTime(), [startDate, startTime]);
  const endMs = useMemo(() => new Date(`${endDate}T${endTime}`).getTime(), [endDate, endTime]);
  const durationInfo = useMemo(() => formatDurationLabel(startMs || 0, endMs || 0), [startMs, endMs]);
  const durationDays = useMemo(() => {
    if (!startMs || !endMs || endMs <= startMs) return 1;
    return Math.max(1, Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24)));
  }, [startMs, endMs]);

  const scheduleError = useMemo(() => {
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) return 'Please select valid start and end dates/times.';
    if (startMs < Date.now() - 5 * 60 * 1000) return 'Campaign start date and time cannot be in the past.';
    if (endMs <= startMs) return 'Campaign end date/time must be later than start date/time.';
    return '';
  }, [startMs, endMs]);

  const computedBudgets = useMemo(() => {
    const dailyVal = Math.max(0, Number(dailyBudgetInput || 0));
    const totalVal = Math.max(0, Number(totalBudgetInput || 0));
    if (budgetType === 'DAILY') {
      const total = Math.round(dailyVal * durationDays * 100) / 100;
      return { dailyBudget: dailyVal, totalBudget: total };
    }
    const daily = Math.round((totalVal / durationDays) * 100) / 100;
    return { dailyBudget: daily, totalBudget: totalVal };
  }, [budgetType, dailyBudgetInput, totalBudgetInput, durationDays]);

  const budgetError = useMemo(() => {
    if (budgetType === 'DAILY') {
      if (computedBudgets.dailyBudget < settings.minDailyBudget) {
        return `Minimum daily budget is ₹${settings.minDailyBudget}.`;
      }
      if (computedBudgets.totalBudget < settings.minTotalBudget) {
        return `Total campaign budget (₹${computedBudgets.totalBudget}) must be at least ₹${settings.minTotalBudget}.`;
      }
    } else if (computedBudgets.totalBudget < settings.minTotalBudget) {
      return `Minimum total campaign budget is ₹${settings.minTotalBudget}.`;
    }
    return '';
  }, [budgetType, computedBudgets, settings]);

  const estimates = useMemo(() => {
    if (!adType) return null;
    return estimateCampaignPerformance({
      totalBudget: computedBudgets.totalBudget,
      adType,
      settings,
    });
  }, [computedBudgets.totalBudget, adType, settings]);

  // Payment breakdown math (mirrored on backend atomically)
  const paymentBreakdown = useMemo(() => {
    const total = computedBudgets.totalBudget;
    const rate = Math.max(0.1, financials.pointsToRupeeRate || settings.pointsToRupeeRate || 1);
    const walletBal = financials.availableWalletBalance;
    const availPts = financials.availablePoints;

    if (paymentMode === 'WALLET') {
      const sufficient = walletBal >= total;
      return {
        pointsUsed: 0,
        pointsRupees: 0,
        walletAmount: sufficient ? total : 0,
        onlineAmount: 0,
        remainingWalletAfter: Math.max(0, walletBal - total),
        remainingPayable: sufficient ? 0 : total,
        sufficient,
        walletError: sufficient
          ? ''
          : 'Insufficient Wallet Balance. Please add funds or choose another payment method.',
      };
    }

    if (paymentMode === 'RAZORPAY') {
      return {
        pointsUsed: 0,
        pointsRupees: 0,
        walletAmount: 0,
        onlineAmount: total,
        remainingWalletAfter: walletBal,
        remainingPayable: total,
        sufficient: true,
        walletError: '',
      };
    }

    // REWARD_POINTS (full or partial + secondary)
    const maxPtsNeeded = Math.ceil(total / rate);
    const requestedPts = Math.max(0, Math.floor(Number(pointsToUseInput || 0)));
    const usablePts = Math.min(requestedPts, availPts, maxPtsNeeded);
    const ptsRupees = Math.min(total, Math.round(usablePts * rate * 100) / 100);
    const remainingAfterPoints = Math.max(0, Math.round((total - ptsRupees) * 100) / 100);

    if (remainingAfterPoints === 0) {
      return {
        pointsUsed: usablePts,
        pointsRupees: ptsRupees,
        walletAmount: 0,
        onlineAmount: 0,
        remainingWalletAfter: walletBal,
        remainingPayable: 0,
        sufficient: true,
        walletError: '',
      };
    }

    if (secondaryMethod === 'WALLET') {
      const ok = walletBal >= remainingAfterPoints;
      return {
        pointsUsed: usablePts,
        pointsRupees: ptsRupees,
        walletAmount: ok ? remainingAfterPoints : 0,
        onlineAmount: 0,
        remainingWalletAfter: Math.max(0, walletBal - remainingAfterPoints),
        remainingPayable: remainingAfterPoints,
        sufficient: ok,
        walletError: ok
          ? ''
          : `Insufficient Wallet Balance for remaining ₹${remainingAfterPoints.toFixed(2)}. Choose Online Payment or Wallet + Online Split.`,
      };
    }

    if (secondaryMethod === 'WALLET_AND_RAZORPAY') {
      const wUse = Math.max(0, Math.min(walletBal, remainingAfterPoints));
      const online = Math.max(0, Math.round((remainingAfterPoints - wUse) * 100) / 100);
      return {
        pointsUsed: usablePts,
        pointsRupees: ptsRupees,
        walletAmount: Math.round(wUse * 100) / 100,
        onlineAmount: online,
        remainingWalletAfter: Math.max(0, walletBal - wUse),
        remainingPayable: remainingAfterPoints,
        sufficient: true,
        walletError: '',
      };
    }

    return {
      pointsUsed: usablePts,
      pointsRupees: ptsRupees,
      walletAmount: 0,
      onlineAmount: remainingAfterPoints,
      remainingWalletAfter: walletBal,
      remainingPayable: remainingAfterPoints,
      sufficient: true,
      walletError: '',
    };
  }, [paymentMode, secondaryMethod, pointsToUseInput, computedBudgets.totalBudget, financials, settings]);

  const filteredMenuItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return menuItems;
    return menuItems.filter(
      (i) =>
        (i.name || '').toLowerCase().includes(q) ||
        (i.category || '').toLowerCase().includes(q)
    );
  }, [menuItems, itemSearch]);

  const selectedItems = useMemo(
    () => menuItems.filter((i) => selectedItemIds.includes(i.id)),
    [menuItems, selectedItemIds]
  );

  const primaryPreviewItem = selectedItems[0] || menuItems.find((i) => i.eligible) || null;

  const toggleItem = (id: string, eligible: boolean) => {
    if (!eligible) {
      toast.error('Only approved, active, and available menu items can be promoted.');
      return;
    }
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleConfirmAndCreate = async () => {
    if (!adType) return;
    if (!campaignName.trim() || campaignName.trim().length < 3) {
      toast.error('Please enter a Campaign Name (at least 3 characters).');
      return;
    }
    if (selectedItemIds.length === 0) {
      toast.error('Please select at least one available menu item.');
      return;
    }
    if (budgetError) {
      toast.error(budgetError);
      return;
    }
    if (scheduleError) {
      toast.error(scheduleError);
      return;
    }
    if (paymentBreakdown.walletError) {
      toast.error(paymentBreakdown.walletError);
      return;
    }
    if (!acceptedTerms) {
      toast.error('Please accept the campaign terms to continue.');
      return;
    }

    const firebaseUser = auth.currentUser || user;
    if (!firebaseUser) {
      toast.error('Please sign in again.');
      return;
    }

    setSubmitting(true);
    try {
      const token = await firebaseUser.getIdToken();
      const targetKeywords = keywordsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch('/api/campaigns/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          restaurantId: user?.restaurantId || firebaseUser.uid,
          campaignName: campaignName.trim(),
          description: description.trim(),
          adType,
          menuItemIds: selectedItemIds,
          offerBadge: offerBadge.trim() || undefined,
          targetKeywords,
          budgetType,
          dailyBudget: computedBudgets.dailyBudget,
          totalBudget: computedBudgets.totalBudget,
          startAt: new Date(startMs).toISOString(),
          endAt: new Date(endMs).toISOString(),
          timezone: userTimezone,
          paymentMode,
          usePoints: paymentMode === 'REWARD_POINTS',
          pointsToUse: paymentBreakdown.pointsUsed,
          secondaryPaymentMethod: secondaryMethod,
          useWalletAmount: paymentBreakdown.walletAmount,
          acceptedTerms: true,
          idempotencyKey,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create campaign');
      }

      if (!data.requiresOnlinePayment) {
        toast.success('Campaign created & payment verified!');
        router.push(`/restaurant/campaigns/${data.campaignId}`);
        return;
      }

      // Open Razorpay Checkout for online portion
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded || !(window as any).Razorpay) {
        await fetch('/api/campaigns/payment-failed', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            paymentId: data.paymentId,
            reason: 'Razorpay SDK failed to load',
            cancelled: true,
          }),
        });
        throw new Error('Could not load Razorpay checkout SDK');
      }

      const rzp = new (window as any).Razorpay({
        key: data.razorpayKeyId,
        amount: Math.round(Number(data.onlineAmount) * 100),
        currency: 'INR',
        name: 'AKR Hunger Ads',
        description: `Campaign: ${campaignName.trim()}`,
        order_id: data.razorpayOrderId,
        prefill: {
          name: restaurant?.name || firebaseUser.displayName || 'Restaurant Partner',
          email: firebaseUser.email || '',
        },
        theme: { color: '#f97316' },
        handler: async (response: any) => {
          try {
            const verifyRes = await fetch('/api/campaigns/verify-payment', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                paymentId: data.paymentId,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }),
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok || !verifyData.success) {
              throw new Error(verifyData.error || 'Payment verification failed');
            }
            toast.success('Online payment verified! Your campaign is activating.');
            router.push(`/restaurant/campaigns/${verifyData.campaignId || data.campaignId}`);
          } catch (vErr: any) {
            toast.error(vErr.message || 'Verification failed');
            setSubmitting(false);
          }
        },
        modal: {
          ondismiss: async () => {
            await fetch('/api/campaigns/payment-failed', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                paymentId: data.paymentId,
                reason: 'Checkout dismissed by restaurant',
                cancelled: true,
              }),
            }).catch(() => {});
            setIdempotencyKey(`idem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`);
            toast.info('Payment cancelled. Any reserved balance has been released.');
            setSubmitting(false);
          },
        },
      });

      rzp.on('payment.failed', async (resp: any) => {
        await fetch('/api/campaigns/payment-failed', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            paymentId: data.paymentId,
            reason: resp?.error?.description || 'Razorpay payment failed',
            cancelled: false,
          }),
        }).catch(() => {});
        setIdempotencyKey(`idem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`);
        toast.error(resp?.error?.description || 'Payment failed');
        setSubmitting(false);
      });

      rzp.open();
    } catch (err: any) {
      toast.error(err.message || 'Failed to launch campaign');
      setIdempotencyKey(`idem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`);
      setSubmitting(false);
    }
  };

  if (!adType || !placementMeta) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
        <h1 className="text-2xl font-black">Invalid Advertisement Type</h1>
        <p className="text-muted-foreground">Please select a valid placement from the Campaigns Hub.</p>
        <Button asChild><Link href="/restaurant/campaigns">Back to Campaigns</Link></Button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" asChild className="rounded-xl">
            <Link href="/restaurant/campaigns">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                Create {placementMeta.title}
              </h1>
              <Badge className="bg-primary/10 text-primary border-primary/25 font-bold">
                {placementMeta.badgeText}
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">{placementMeta.examplePlacement}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading restaurant catalog &amp; balances...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: 6-STEP FORM */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">
            {/* STEP 1 – CAMPAIGN INFORMATION */}
            <Card className="rounded-2xl border-border/70 shadow-sm">
              <CardHeader>
                <div className="text-xs font-bold uppercase tracking-wider text-primary">Step 1</div>
                <CardTitle className="text-lg font-black">Campaign Information</CardTitle>
                <CardDescription>Basic campaign identity and placement targeting details.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Campaign Name *</Label>
                    <Input
                      placeholder="e.g., Weekend Biryani Boost"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Advertisement Type</Label>
                    <Input value={placementMeta.title} disabled className="rounded-xl bg-muted/60 font-semibold" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Restaurant</Label>
                    <Input
                      value={restaurant?.name || 'Authenticated Kitchen'}
                      disabled
                      className="rounded-xl bg-muted/60 font-semibold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Promotional Badge (Optional)</Label>
                    <Input
                      placeholder="e.g., 20% OFF or Chef Special"
                      value={offerBadge}
                      onChange={(e) => setOfferBadge(e.target.value)}
                      className="rounded-xl"
                    />
                  </div>
                </div>

                {adType === 'SEARCH' && (
                  <div className="space-y-1.5">
                    <Label>Target Search Keywords (Comma separated, optional)</Label>
                    <Input
                      placeholder="e.g., biryani, chicken, dum, spicy"
                      value={keywordsText}
                      onChange={(e) => setKeywordsText(e.target.value)}
                      className="rounded-xl"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Campaign Description (Optional)</Label>
                  <Input
                    placeholder="Internal note or promotion objective..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
              </CardContent>
            </Card>

            {/* STEP 2 – SELECT MENU ITEMS */}
            <Card className="rounded-2xl border-border/70 shadow-sm">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-primary">Step 2</div>
                    <CardTitle className="text-lg font-black">Select Menu Items ({selectedItemIds.length} selected)</CardTitle>
                    <CardDescription>
                      Only approved, active, and available dishes from your menu can be promoted.
                    </CardDescription>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      placeholder="Filter dishes..."
                      value={itemSearch}
                      onChange={(e) => setItemSearch(e.target.value)}
                      className="pl-9 rounded-xl h-9"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredMenuItems.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    No menu items found. Add available dishes in Menu Management first.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-1">
                    {filteredMenuItems.map((item) => {
                      const checked = selectedItemIds.includes(item.id);
                      return (
                        <div
                          key={item.id}
                          onClick={() => toggleItem(item.id, item.eligible)}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                            !item.eligible
                              ? 'opacity-55 bg-muted/40 border-border/50 cursor-not-allowed'
                              : checked
                              ? 'border-primary bg-primary/5 shadow-sm cursor-pointer'
                              : 'border-border/70 hover:border-primary/40 cursor-pointer'
                          }`}
                        >
                          <Checkbox
                            checked={checked}
                            disabled={!item.eligible}
                            onCheckedChange={() => {}}
                          />
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-12 h-12 rounded-lg object-cover bg-muted flex-shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-sm text-foreground truncate">{item.name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {item.category || 'Menu'} • ₹{Number(item.price || 0)}
                            </div>
                            <div className="mt-0.5">
                              {item.eligible ? (
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                  Available
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-rose-500">
                                  {item.ineligibleReason}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* STEP 4 & STEP 3 COMBINED CLEARLY (Schedule & Budget) */}
            <Card className="rounded-2xl border-border/70 shadow-sm">
              <CardHeader>
                <div className="text-xs font-bold uppercase tracking-wider text-primary">Step 3</div>
                <CardTitle className="text-lg font-black">Campaign Schedule</CardTitle>
                <CardDescription>
                  Timezone: <span className="font-semibold text-foreground">{userTimezone}</span>. Campaign ends automatically when end time is reached or budget is spent.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2 p-3.5 rounded-xl bg-muted/40 border border-border/60">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Start Date &amp; Time</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-lg" />
                      <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="rounded-lg" />
                    </div>
                  </div>
                  <div className="space-y-2 p-3.5 rounded-xl bg-muted/40 border border-border/60">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">End Date &amp; Time</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-lg" />
                      <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="rounded-lg" />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs p-3 rounded-xl bg-blue-500/10 border border-blue-500/25 text-blue-700 dark:text-blue-300">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <Calendar className="w-4 h-4" /> Calculated Campaign Duration:
                  </span>
                  <span className="font-black">
                    {scheduleError ? 'Invalid window' : `${durationInfo.label} (${durationDays} billing day${durationDays > 1 ? 's' : ''})`}
                  </span>
                </div>
                {scheduleError && (
                  <p className="text-xs font-bold text-rose-500 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" /> {scheduleError}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* STEP 3/4 – CAMPAIGN BUDGET */}
            <Card className="rounded-2xl border-border/70 shadow-sm">
              <CardHeader>
                <div className="text-xs font-bold uppercase tracking-wider text-primary">Step 4</div>
                <CardTitle className="text-lg font-black">Campaign Budget &amp; Estimates</CardTitle>
                <CardDescription>
                  Choose Daily or Total Budget. Minimum Total: ₹{settings.minTotalBudget} • Minimum Daily: ₹{settings.minDailyBudget}.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setBudgetType('DAILY')}
                    className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
                      budgetType === 'DAILY'
                        ? 'border-primary bg-primary/10 shadow-sm'
                        : 'border-border/70 hover:bg-muted/40'
                    }`}
                  >
                    <div className="font-bold text-sm text-foreground">A. Daily Budget</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Set daily cap across {durationDays} day(s)</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBudgetType('TOTAL')}
                    className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
                      budgetType === 'TOTAL'
                        ? 'border-primary bg-primary/10 shadow-sm'
                        : 'border-border/70 hover:bg-muted/40'
                    }`}
                  >
                    <div className="font-bold text-sm text-foreground">B. Total Campaign Budget</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Set overall maximum campaign spend</div>
                  </button>
                </div>

                {budgetType === 'DAILY' ? (
                  <div className="space-y-1.5">
                    <Label>Daily Budget (₹)</Label>
                    <Input
                      type="number"
                      min={settings.minDailyBudget}
                      value={dailyBudgetInput}
                      onChange={(e) => setDailyBudgetInput(e.target.value)}
                      className="rounded-xl text-lg font-bold"
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label>Total Campaign Budget (₹)</Label>
                    <Input
                      type="number"
                      min={settings.minTotalBudget}
                      value={totalBudgetInput}
                      onChange={(e) => setTotalBudgetInput(e.target.value)}
                      className="rounded-xl text-lg font-bold"
                    />
                  </div>
                )}

                {budgetError && (
                  <p className="text-xs font-bold text-rose-500 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" /> {budgetError}
                  </p>
                )}

                {estimates && (
                  <div className="rounded-xl border border-border/70 bg-muted/30 p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase">
                      <span>Estimated Performance (Rate-Based)</span>
                      <span>
                        CPC: ₹{estimates.effectiveCpc.toFixed(2)} • CPM: ₹{estimates.effectiveCpm.toFixed(0)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                      <div className="p-2.5 rounded-lg bg-card border border-border/60">
                        <div className="text-[11px] text-muted-foreground">Est. Impressions</div>
                        <div className="font-black">
                          {estimates.estimatedImpressionsMin.toLocaleString()}–{estimates.estimatedImpressionsMax.toLocaleString()}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-card border border-border/60">
                        <div className="text-[11px] text-muted-foreground">Est. Clicks</div>
                        <div className="font-black">
                          {estimates.estimatedClicksMin.toLocaleString()}–{estimates.estimatedClicksMax.toLocaleString()}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-card border border-border/60">
                        <div className="text-[11px] text-muted-foreground">Est. Reach</div>
                        <div className="font-black">
                          {estimates.estimatedReachMin.toLocaleString()}–{estimates.estimatedReachMax.toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 flex-shrink-0" />
                      Estimates only, derived from configurable platform CPM/CPC rates and historical CTR assumptions; not guaranteed delivery.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* STEP 5 – PAYMENT METHOD */}
            <Card className="rounded-2xl border-border/70 shadow-sm">
              <CardHeader>
                <div className="text-xs font-bold uppercase tracking-wider text-primary">Step 5</div>
                <CardTitle className="text-lg font-black">Payment Method</CardTitle>
                <CardDescription>Choose Restaurant Wallet, Razorpay Online Payment, or Reward Points (with partial payment split).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Option 1: Restaurant Wallet */}
                  <button
                    type="button"
                    onClick={() => setPaymentMode('WALLET')}
                    className={`p-4 rounded-xl border text-left transition cursor-pointer ${
                      paymentMode === 'WALLET'
                        ? 'border-emerald-500 bg-emerald-500/10 shadow-sm'
                        : 'border-border/70 hover:bg-muted/40'
                    }`}
                  >
                    <Wallet className="w-5 h-5 text-emerald-500 mb-2" />
                    <div className="font-bold text-sm">Restaurant Wallet</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Avail: ₹{financials.availableWalletBalance.toFixed(2)}
                    </div>
                  </button>

                  {/* Option 2: Online Payment */}
                  <button
                    type="button"
                    onClick={() => setPaymentMode('RAZORPAY')}
                    className={`p-4 rounded-xl border text-left transition cursor-pointer ${
                      paymentMode === 'RAZORPAY'
                        ? 'border-blue-500 bg-blue-500/10 shadow-sm'
                        : 'border-border/70 hover:bg-muted/40'
                    }`}
                  >
                    <CreditCard className="w-5 h-5 text-blue-500 mb-2" />
                    <div className="font-bold text-sm">Online Payment</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      UPI, Cards, NetBanking (Razorpay)
                    </div>
                  </button>

                  {/* Option 3: Reward Points */}
                  <button
                    type="button"
                    onClick={() => setPaymentMode('REWARD_POINTS')}
                    className={`p-4 rounded-xl border text-left transition cursor-pointer ${
                      paymentMode === 'REWARD_POINTS'
                        ? 'border-amber-500 bg-amber-500/10 shadow-sm'
                        : 'border-border/70 hover:bg-muted/40'
                    }`}
                  >
                    <Coins className="w-5 h-5 text-amber-500 mb-2" />
                    <div className="font-bold text-sm">Reward Points</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {financials.availablePoints.toLocaleString()} pts (1 pt = ₹{financials.pointsToRupeeRate})
                    </div>
                  </button>
                </div>

                {/* Wallet Details */}
                {paymentMode === 'WALLET' && (
                  <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Current Restaurant Wallet Balance</span>
                      <span className="font-bold">₹{financials.availableWalletBalance.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Campaign Total Budget</span>
                      <span className="font-bold">₹{computedBudgets.totalBudget.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount to Deduct</span>
                      <span className="font-bold text-rose-500">-₹{computedBudgets.totalBudget.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-border">
                      <span className="font-semibold">Remaining Wallet Balance After Payment</span>
                      <span className="font-black">
                        ₹{Math.max(0, financials.availableWalletBalance - computedBudgets.totalBudget).toFixed(2)}
                      </span>
                    </div>
                    {paymentBreakdown.walletError && (
                      <div className="mt-2 p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        {paymentBreakdown.walletError}
                      </div>
                    )}
                  </div>
                )}

                {/* Online Details */}
                {paymentMode === 'RAZORPAY' && (
                  <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/25 text-xs sm:text-sm space-y-1.5">
                    <div className="font-bold text-foreground flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-blue-500" /> Secure Server-Verified Razorpay Checkout
                    </div>
                    <p className="text-muted-foreground">
                      Pay ₹{computedBudgets.totalBudget.toFixed(2)} via UPI, Debit/Credit Card, NetBanking, or Wallets. Payment signatures are cryptographically verified on the server before activation.
                    </p>
                  </div>
                )}

                {/* Reward Points + Split Details */}
                {paymentMode === 'REWARD_POINTS' && (
                  <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-3 text-sm">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                      <div className="space-y-1">
                        <Label className="text-xs">Points to Redeem (Max {financials.availablePoints} pts)</Label>
                        <Input
                          type="number"
                          min={0}
                          max={financials.availablePoints}
                          value={pointsToUseInput}
                          onChange={(e) => setPointsToUseInput(e.target.value)}
                          className="rounded-lg font-bold"
                        />
                      </div>
                      <div className="text-xs text-muted-foreground p-2.5 rounded-lg bg-card border border-border">
                        Conversion: <strong>1 Point = ₹{financials.pointsToRupeeRate}</strong> • Redeeming{' '}
                        <strong>{paymentBreakdown.pointsUsed} pts = ₹{paymentBreakdown.pointsRupees.toFixed(2)}</strong>
                      </div>
                    </div>

                    <div className="space-y-1 pt-2 border-t border-border">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Campaign Amount</span>
                        <span className="font-bold">₹{computedBudgets.totalBudget.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Points Value Applied</span>
                        <span className="font-bold text-amber-600">-₹{paymentBreakdown.pointsRupees.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-black">
                        <span>Remaining Payable Amount</span>
                        <span>₹{paymentBreakdown.remainingPayable.toFixed(2)}</span>
                      </div>
                    </div>

                    {paymentBreakdown.remainingPayable > 0 && (
                      <div className="space-y-2 pt-2 border-t border-border">
                        <Label className="text-xs font-bold uppercase text-muted-foreground">
                          Select Method for Remaining ₹{paymentBreakdown.remainingPayable.toFixed(2)}
                        </Label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={secondaryMethod === 'WALLET' ? 'default' : 'outline'}
                            onClick={() => setSecondaryMethod('WALLET')}
                            className="rounded-lg text-xs"
                          >
                            Restaurant Wallet (₹{financials.availableWalletBalance.toFixed(0)})
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={secondaryMethod === 'RAZORPAY' ? 'default' : 'outline'}
                            onClick={() => setSecondaryMethod('RAZORPAY')}
                            className="rounded-lg text-xs"
                          >
                            Razorpay Online
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={secondaryMethod === 'WALLET_AND_RAZORPAY' ? 'default' : 'outline'}
                            onClick={() => setSecondaryMethod('WALLET_AND_RAZORPAY')}
                            className="rounded-lg text-xs"
                          >
                            Wallet + Online Split
                          </Button>
                        </div>

                        {paymentBreakdown.walletError && (
                          <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                            {paymentBreakdown.walletError}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* STEP 6 – ORDER SUMMARY */}
            <Card className="rounded-2xl border-primary/30 bg-card shadow-md">
              <CardHeader>
                <div className="text-xs font-bold uppercase tracking-wider text-primary">Step 6</div>
                <CardTitle className="text-lg font-black">Order Summary &amp; Confirmation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm bg-muted/40 p-4 rounded-xl border border-border/70">
                  <div><span className="text-muted-foreground">Campaign Name:</span> <strong>{campaignName || '—'}</strong></div>
                  <div><span className="text-muted-foreground">Advertisement Type:</span> <strong>{placementMeta.title}</strong></div>
                  <div>
                    <span className="text-muted-foreground">Selected Items:</span>{' '}
                    <strong>{selectedItems.map((i) => i.name).join(', ') || 'None'}</strong>
                  </div>
                  <div><span className="text-muted-foreground">Duration:</span> <strong>{durationInfo.label}</strong></div>
                  <div><span className="text-muted-foreground">Daily Budget:</span> <strong>₹{computedBudgets.dailyBudget.toFixed(2)}/day</strong></div>
                  <div><span className="text-muted-foreground">Total Budget:</span> <strong>₹{computedBudgets.totalBudget.toFixed(2)}</strong></div>
                  <div><span className="text-muted-foreground">Payment Mode:</span> <strong>{paymentMode}</strong></div>
                  <div><span className="text-muted-foreground">Points Used:</span> <strong>{paymentBreakdown.pointsUsed} pts (₹{paymentBreakdown.pointsRupees.toFixed(2)})</strong></div>
                  <div><span className="text-muted-foreground">Wallet Amount:</span> <strong>₹{paymentBreakdown.walletAmount.toFixed(2)}</strong></div>
                  <div><span className="text-muted-foreground">Online Payment Amount:</span> <strong>₹{paymentBreakdown.onlineAmount.toFixed(2)}</strong></div>
                </div>

                <div className="flex items-center justify-between text-lg font-black px-2">
                  <span>Total Payable</span>
                  <span className="text-primary">₹{computedBudgets.totalBudget.toFixed(2)}</span>
                </div>

                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-border/70 cursor-pointer hover:bg-muted/30">
                  <Checkbox
                    checked={acceptedTerms}
                    onCheckedChange={(v) => setAcceptedTerms(v === true)}
                    className="mt-0.5"
                  />
                  <span className="text-xs text-muted-foreground leading-relaxed">
                    I agree to the AKR Hunger Advertising Terms. Eligible approved dishes will run within the scheduled window until the end time or budget is exhausted.
                  </span>
                </label>

                <Button
                  onClick={handleConfirmAndCreate}
                  disabled={submitting || !acceptedTerms || Boolean(budgetError) || Boolean(scheduleError) || Boolean(paymentBreakdown.walletError)}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-600 hover:to-rose-700 text-white font-black text-base shadow-lg shadow-orange-500/25 gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" /> Processing Campaign...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" /> Confirm &amp; Create Campaign
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN: LIVE CAMPAIGN PREVIEW */}
          <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-6 space-y-4">
            <Card className="rounded-2xl border-border/80 shadow-md overflow-hidden">
              <CardHeader className="pb-3 bg-muted/30 border-b border-border/60">
                <CardTitle className="text-base font-black flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" /> Live Customer App Preview
                </CardTitle>
                <CardDescription className="text-xs">
                  Updates automatically when you select a menu item or add an offer badge.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <AdPlacementPreview
                  adType={adType}
                  restaurantName={restaurant?.name || 'Your Kitchen'}
                  itemName={primaryPreviewItem?.name || 'Select a Menu Item'}
                  itemPrice={Number(primaryPreviewItem?.price || 249)}
                  itemImage={primaryPreviewItem?.image}
                  offerBadge={offerBadge.trim() || undefined}
                  searchQuery={keywordsText.split(',')[0]?.trim() || primaryPreviewItem?.name}
                  itemCount={selectedItems.length}
                />

                <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Placement</span>
                    <span className="font-bold text-foreground">{placementMeta.shortTitle}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Items Selected</span>
                    <span className="font-bold text-foreground">{selectedItems.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Budget</span>
                    <span className="font-black text-primary">₹{computedBudgets.totalBudget.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
