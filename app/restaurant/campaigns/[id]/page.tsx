'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { useRestaurantAuth } from '@/context/RestaurantAuthContext';
import {
  AD_PLACEMENTS,
  getCampaignStatusMeta,
  normalizeCampaignStatus,
} from '@/lib/campaigns/constants';
import { AdPlacementPreview } from '@/components/restaurant/campaigns/AdPlacementPreviews';
import { CampaignAdType } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  Eye,
  Users,
  MousePointer,
  Percent,
  ShoppingBag,
  TrendingUp,
  IndianRupee,
  Wallet,
  Play,
  Pause,
  XCircle,
  Loader2,
  RefreshCw,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

export default function CampaignAnalyticsDetailPage() {
  const params = useParams();
  const campaignId = String(params?.id || '');
  const { user, loading: authLoading } = useRestaurantAuth();

  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [campaign, setCampaign] = useState<any | null>(null);
  const [walletTxs, setWalletTxs] = useState<any[]>([]);
  const [rewardTxs, setRewardTxs] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);

  const fetchDetails = async (silent = false) => {
    const firebaseUser = auth.currentUser || user;
    if (!firebaseUser) return;
    if (!silent) setLoading(true);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/campaigns', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load campaign');

      const found = (data.campaigns || []).find((c: any) => c.id === campaignId) || null;
      setCampaign(found);
      setWalletTxs((data.walletTransactions || []).filter((t: any) => t.campaignId === campaignId));
      setRewardTxs((data.rewardTransactions || []).filter((t: any) => t.campaignId === campaignId));
      setPayments((data.payments || []).filter((p: any) => p.campaignId === campaignId));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user && campaignId) {
      fetchDetails();
    }
  }, [authLoading, user, campaignId]);

  useEffect(() => {
    if (!campaign) return;
    const st = normalizeCampaignStatus(campaign);
    if (st !== 'ACTIVATING' && st !== 'PENDING_PAYMENT') return;

    const timer = setInterval(() => {
      fetchDetails(true);
    }, 10000);
    return () => clearInterval(timer);
  }, [campaign]);

  const handleAction = async (action: 'PAUSE' | 'RESUME' | 'CANCEL') => {
    if (
      action === 'CANCEL' &&
      !window.confirm('Cancel this campaign? Unused paid budget will be refunded to your Restaurant Wallet.')
    ) {
      return;
    }
    setActing(true);
    try {
      const token = await (auth.currentUser || user)!.getIdToken();
      const res = await fetch(`/api/campaigns/${campaignId}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Action failed');
      toast.success(`Campaign updated to ${data.campaignStatus}`);
      await fetchDetails(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading campaign analytics...
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4">
        <h1 className="text-2xl font-black">Campaign Not Found</h1>
        <Button asChild><Link href="/restaurant/campaigns">Back to Campaigns</Link></Button>
      </div>
    );
  }

  const status = normalizeCampaignStatus(campaign);
  const statusMeta = getCampaignStatusMeta(status);
  const adType: CampaignAdType = campaign.adType || 'HOME_PAGE';
  const adMeta = AD_PLACEMENTS[adType] || AD_PLACEMENTS.HOME_PAGE;

  const impressions = Number(campaign.impressions || 0);
  const uniqueImpressions = Number(campaign.uniqueImpressions || 0);
  const clicks = Number(campaign.totalClicks ?? campaign.clicks ?? 0);
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const orders = Number(campaign.ordersGenerated ?? campaign.conversions ?? 0);
  const conversionRate = clicks > 0 ? (orders / clicks) * 100 : 0;
  const totalBudget = Number(campaign.totalBudget ?? campaign.monthlyCost ?? 0);
  const totalSpent = Number(campaign.spentAmount ?? campaign.totalSpent ?? 0);
  const remainingBudget =
    campaign.remainingBudget !== undefined
      ? Number(campaign.remainingBudget)
      : Math.max(0, totalBudget - totalSpent);
  const cpc = clicks > 0 ? totalSpent / clicks : 0;
  const cpo = orders > 0 ? totalSpent / orders : 0;
  const revenueAttributed = Number(campaign.revenueAttributed || 0);
  const roas = totalSpent > 0 ? revenueAttributed / totalSpent : 0;
  const budgetPct = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0;

  const primaryItem =
    (Array.isArray(campaign.menuItemsSnapshot) && campaign.menuItemsSnapshot[0]) || {
      name: campaign.menuItemName,
      price: campaign.menuItemPrice,
      image: campaign.menuItemImage,
    };

  const formatDt = (val: any) => {
    if (!val) return '—';
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1500px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-card border border-border/70 rounded-3xl p-5 sm:p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <Button variant="outline" size="icon" asChild className="rounded-xl mt-0.5">
            <Link href="/restaurant/campaigns"><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-foreground">
                {campaign.campaignName || campaign.title || campaign.id}
              </h1>
              <Badge variant="outline" className={statusMeta.className}>{statusMeta.label}</Badge>
              <Badge variant="outline">{adMeta.title}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Campaign ID: <span className="font-mono">{campaign.id}</span> • Window: {formatDt(campaign.startAt || campaign.startDate)} → {formatDt(campaign.endAt || campaign.endDate)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchDetails(true)} className="rounded-xl gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          {status === 'ACTIVE' && (
            <Button variant="outline" size="sm" disabled={acting} onClick={() => handleAction('PAUSE')} className="rounded-xl gap-1.5">
              <Pause className="w-3.5 h-3.5" /> Pause
            </Button>
          )}
          {status === 'PAUSED' && (
            <Button variant="outline" size="sm" disabled={acting} onClick={() => handleAction('RESUME')} className="rounded-xl gap-1.5">
              <Play className="w-3.5 h-3.5" /> Resume
            </Button>
          )}
          {['PENDING_PAYMENT', 'SCHEDULED', 'ACTIVATING', 'ACTIVE', 'PAUSED'].includes(status) && (
            <Button variant="destructive" size="sm" disabled={acting} onClick={() => handleAction('CANCEL')} className="rounded-xl gap-1.5">
              <XCircle className="w-3.5 h-3.5" /> Cancel Campaign
            </Button>
          )}
        </div>
      </div>

      {/* Status notices */}
      {status === 'ACTIVATING' && (
        <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-700 dark:text-cyan-300 flex items-center gap-3 text-sm">
          <Clock className="w-5 h-5 flex-shrink-0 animate-pulse" />
          <div>
            <strong>Campaign Activating:</strong> Your payment is verified. Server scheduler will transition this campaign to <strong>Active</strong> automatically at {formatDt(campaign.activationDueAt || campaign.startAt)}.
          </div>
        </div>
      )}

      {(campaign.pauseReason || campaign.rejectionReason) && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 flex items-center gap-3 text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <div>
            <strong>{status === 'REJECTED' ? 'Rejection Reason:' : 'Pause Notice:'}</strong>{' '}
            {campaign.rejectionReason || campaign.pauseReason}
          </div>
        </div>
      )}

      {/* Full Analytics KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Impressions', val: impressions.toLocaleString(), icon: Eye },
          { label: 'Unique Impressions', val: uniqueImpressions.toLocaleString(), icon: Users },
          { label: 'Clicks', val: clicks.toLocaleString(), icon: MousePointer },
          { label: 'CTR', val: `${ctr.toFixed(2)}%`, icon: Percent },
          { label: 'Orders Generated', val: orders, icon: ShoppingBag },
          { label: 'Conversion Rate', val: `${conversionRate.toFixed(2)}%`, icon: TrendingUp },
          { label: 'Total Spent', val: `₹${totalSpent.toFixed(2)}`, icon: IndianRupee },
          { label: 'Remaining Budget', val: `₹${remainingBudget.toFixed(2)}`, icon: Wallet },
          { label: 'Cost Per Click (CPC)', val: `₹${cpc.toFixed(2)}`, icon: MousePointer },
          { label: 'Cost Per Order (CPO)', val: `₹${cpo.toFixed(2)}`, icon: ShoppingBag },
          { label: 'Revenue Attributed', val: `₹${revenueAttributed.toFixed(0)}`, icon: IndianRupee },
          { label: 'ROAS', val: `${roas.toFixed(2)}x`, icon: TrendingUp },
        ].map((metric) => (
          <Card key={metric.label} className="rounded-2xl border-border/70">
            <CardContent className="p-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>{metric.label}</span>
                <metric.icon className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="text-xl font-black text-foreground">{metric.val}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Budget Pacing & Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          <Card className="rounded-2xl border-border/70">
            <CardHeader>
              <CardTitle className="text-lg font-black">Budget Consumption &amp; Promoted Dishes</CardTitle>
              <CardDescription>
                Payment Method: {campaign.paymentMethodUsed || 'POINTS'} • Budget Type: {campaign.budgetType || 'TOTAL'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-bold">
                  <span>Spent: ₹{totalSpent.toFixed(2)}</span>
                  <span>Budget: ₹{totalBudget.toFixed(2)} ({budgetPct.toFixed(1)}%)</span>
                </div>
                <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 to-rose-600 transition-all"
                    style={{ width: `${budgetPct}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase text-muted-foreground">Promoted Menu Items</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(Array.isArray(campaign.menuItemsSnapshot) && campaign.menuItemsSnapshot.length > 0
                    ? campaign.menuItemsSnapshot
                    : [primaryItem]
                  ).map((item: any, idx: number) => (
                    <div key={item?.id || idx} className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/60">
                      <img
                        src={item?.image || '/placeholder-food.png'}
                        alt={item?.name || 'Item'}
                        className="w-12 h-12 rounded-lg object-cover bg-muted"
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-sm truncate">{item?.name || 'Menu Item'}</div>
                        <div className="text-xs text-muted-foreground">₹{Number(item?.price || 0)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70">
            <CardHeader>
              <CardTitle className="text-lg font-black">Campaign Payment &amp; Ledger History</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {payments.length === 0 && walletTxs.length === 0 && rewardTxs.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No linked ledger entries found.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead>Type / Method</TableHead>
                      <TableHead>Amount / Pts</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-semibold text-xs">Checkout ({p.paymentId})</TableCell>
                        <TableCell><Badge variant="outline">{p.paymentMethod}</Badge></TableCell>
                        <TableCell className="font-bold text-xs">₹{Number(p.totalAmount || 0)}</TableCell>
                        <TableCell><Badge variant="secondary">{p.status}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDt(p.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                    {walletTxs.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-xs">{t.description}</TableCell>
                        <TableCell><Badge variant="outline">Wallet ({t.type})</Badge></TableCell>
                        <TableCell className="font-bold text-xs">₹{Number(t.amount || 0)}</TableCell>
                        <TableCell><Badge variant="secondary">{t.status}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDt(t.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                    {rewardTxs.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs">{r.description}</TableCell>
                        <TableCell><Badge variant="outline">Points ({r.type})</Badge></TableCell>
                        <TableCell className="font-bold text-xs">{r.points} pts (₹{r.rupeeValue})</TableCell>
                        <TableCell><Badge variant="secondary">{r.status}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDt(r.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-5">
          <Card className="rounded-2xl border-border/70">
            <CardHeader>
              <CardTitle className="text-base font-black">Customer Placement Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <AdPlacementPreview
                adType={adType}
                restaurantName={campaign.restaurantName}
                itemName={primaryItem?.name}
                itemPrice={Number(primaryItem?.price || 249)}
                itemImage={primaryItem?.image}
                offerBadge={campaign.offerBadge}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
