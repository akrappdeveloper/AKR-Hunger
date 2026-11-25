'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRestaurantAuth } from '@/context/RestaurantAuthContext';
import { auth } from '@/lib/firebase';
import {
  AD_PLACEMENTS,
  getCampaignStatusMeta,
  normalizeCampaignStatus,
  adTypeToSlug,
} from '@/lib/campaigns/constants';
import { AdPlacementPreview } from '@/components/restaurant/campaigns/AdPlacementPreviews';
import { CampaignAdType } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Megaphone,
  Plus,
  Play,
  Pause,
  Calendar,
  CheckCircle2,
  IndianRupee,
  Eye,
  MousePointer,
  ShoppingBag,
  TrendingUp,
  Search,
  Wallet,
  Coins,
  ArrowRight,
  RefreshCw,
  BarChart3,
  XCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
} from 'lucide-react';
import { toast } from 'sonner';

const PAGE_SIZE = 10;

export default function RestaurantCampaignsDashboardPage() {
  const router = useRouter();
  const { user, restaurant, loading: authLoading } = useRestaurantAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [walletTransactions, setWalletTransactions] = useState<any[]>([]);
  const [rewardTransactions, setRewardTransactions] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [financials, setFinancials] = useState({
    availableWalletBalance: 0,
    availablePoints: 0,
    pointsToRupeeRate: 1,
    totalEarnings: 0,
  });

  // Table Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [adTypeFilter, setAdTypeFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [actingId, setActingId] = useState<string | null>(null);

  const loadData = async (silent = false) => {
    const firebaseUser = auth.currentUser || user;
    if (!firebaseUser) return;

    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/campaigns', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to load campaigns');
      }
      setCampaigns(data.campaigns || []);
      setWalletTransactions(data.walletTransactions || []);
      setRewardTransactions(data.rewardTransactions || []);
      setPayments(data.payments || []);
      if (data.financials) setFinancials(data.financials);
    } catch (err: any) {
      toast.error(err.message || 'Unable to load campaign dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      loadData();
    } else if (!authLoading && !user) {
      setLoading(false);
    }
  }, [authLoading, user]);

  // Poll gently only while a campaign is ACTIVATING or PENDING_PAYMENT so status transitions live
  useEffect(() => {
    const hasPendingTransition = campaigns.some((c) => {
      const st = normalizeCampaignStatus(c);
      return st === 'ACTIVATING' || st === 'PENDING_PAYMENT';
    });
    if (!hasPendingTransition) return;

    const interval = setInterval(() => {
      loadData(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [campaigns]);

  const kpis = useMemo(() => {
    let active = 0;
    let scheduled = 0;
    let completed = 0;
    let spend = 0;
    let impressions = 0;
    let clicks = 0;
    let orders = 0;
    let revenue = 0;

    campaigns.forEach((c) => {
      const st = normalizeCampaignStatus(c);
      if (st === 'ACTIVE') active++;
      if (st === 'SCHEDULED' || st === 'ACTIVATING') scheduled++;
      if (st === 'COMPLETED') completed++;
      spend += Number(c.spentAmount ?? c.totalSpent ?? 0);
      impressions += Number(c.impressions || 0);
      clicks += Number(c.totalClicks ?? c.clicks ?? 0);
      orders += Number(c.ordersGenerated ?? c.conversions ?? 0);
      revenue += Number(c.revenueAttributed || 0);
    });

    const roas = spend > 0 ? revenue / spend : 0;
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

    return {
      total: campaigns.length,
      active,
      scheduled,
      completed,
      spend,
      impressions,
      clicks,
      ctr,
      orders,
      revenue,
      roas,
    };
  }, [campaigns]);

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      const st = normalizeCampaignStatus(c);
      const adType = c.adType || 'HOME_PAGE';
      if (statusFilter !== 'ALL' && st !== statusFilter) return false;
      if (adTypeFilter !== 'ALL' && adType !== adTypeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hay = [
          c.id,
          c.campaignName,
          c.title,
          c.menuItemName,
          ...(Array.isArray(c.menuItemsSnapshot) ? c.menuItemsSnapshot.map((m: any) => m.name) : []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [campaigns, statusFilter, adTypeFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredCampaigns.length / PAGE_SIZE));
  const paginatedCampaigns = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredCampaigns.slice(start, start + PAGE_SIZE);
  }, [filteredCampaigns, page, totalPages]);

  const handleLifecycleAction = async (campaignId: string, action: 'PAUSE' | 'RESUME' | 'CANCEL') => {
    if (
      action === 'CANCEL' &&
      !window.confirm('Cancel this campaign? Any unused paid balance will be refunded to your Restaurant Wallet.')
    ) {
      return;
    }
    setActingId(campaignId);
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
      toast.success(
        action === 'CANCEL' && data.refundedAmount > 0
          ? `Campaign cancelled & ₹${data.refundedAmount} refunded to Restaurant Wallet`
          : `Campaign updated to ${data.campaignStatus}`
      );
      await loadData(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActingId(null);
    }
  };

  const formatDateTime = (val: any) => {
    if (!val) return '—';
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const adTypeCards: CampaignAdType[] = ['HOME_PAGE', 'SEARCH', 'PRODUCT_DETAILS'];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-card border border-border/70 rounded-3xl p-5 sm:p-6 shadow-sm">
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 via-amber-500 to-rose-600 text-white flex items-center justify-center shadow-lg shadow-orange-500/25 flex-shrink-0">
            <Megaphone className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                Campaigns &amp; Ads Manager
              </h1>
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary font-bold">
                {restaurant?.name || 'Partner Kitchen'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Promote your menu items across AKR Hunger Home Feed, Search Results, and Product Details pages.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Wallet & Points quick badges */}
          <Link
            href="/restaurant/wallet"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-muted/60 hover:bg-muted border border-border/70 transition text-sm"
          >
            <Wallet className="w-4 h-4 text-emerald-500" />
            <div>
              <div className="text-[10px] uppercase font-bold text-muted-foreground leading-none">
                Wallet Balance
              </div>
              <div className="font-black text-foreground">
                ₹{financials.availableWalletBalance.toFixed(0)}
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-muted/60 border border-border/70 text-sm">
            <Coins className="w-4 h-4 text-amber-500" />
            <div>
              <div className="text-[10px] uppercase font-bold text-muted-foreground leading-none">
                Reward Points
              </div>
              <div className="font-black text-foreground">
                {financials.availablePoints.toLocaleString()} pts
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={() => loadData(true)}
            disabled={refreshing || loading}
            className="rounded-xl h-11 w-11"
            title="Refresh metrics & lifecycle"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>

          <Button
            onClick={() => setCreateDialogOpen(true)}
            className="h-11 px-5 rounded-xl bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-600 hover:to-rose-700 text-white font-bold shadow-lg shadow-orange-500/25 gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Campaign
          </Button>
        </div>
      </div>

      {/* KPI Analytics Cards — 5 cards per horizontal row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5 sm:gap-4">
        {[
          { label: 'Total Campaigns', value: kpis.total, sub: 'All time', icon: Megaphone, color: 'text-orange-500', bg: 'bg-orange-500/10' },
          { label: 'Active Campaigns', value: kpis.active, sub: 'Running live', icon: Play, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: 'Scheduled', value: kpis.scheduled, sub: 'Queued / Activating', icon: Calendar, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { label: 'Completed', value: kpis.completed, sub: 'Finished runs', icon: CheckCircle2, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
          { label: 'Total Ad Spend', value: `₹${kpis.spend.toFixed(0)}`, sub: 'Budget consumed', icon: IndianRupee, color: 'text-amber-500', bg: 'bg-amber-500/10' },
          { label: 'Impressions', value: kpis.impressions.toLocaleString(), sub: 'Ad views', icon: Eye, color: 'text-purple-500', bg: 'bg-purple-500/10' },
          { label: 'Total Clicks', value: kpis.clicks.toLocaleString(), sub: `${kpis.ctr.toFixed(2)}% CTR`, icon: MousePointer, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
          { label: 'Orders Generated', value: kpis.orders, sub: 'Attributed orders', icon: ShoppingBag, color: 'text-pink-500', bg: 'bg-pink-500/10' },
          { label: 'Attributed Revenue', value: `₹${kpis.revenue.toFixed(0)}`, sub: 'Sales from ads', icon: Wallet, color: 'text-teal-500', bg: 'bg-teal-500/10' },
          { label: 'Campaign ROI', value: `${kpis.roas.toFixed(2)}x`, sub: `ROAS return`, icon: TrendingUp, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
        ].map((kpi) => (
          <Card key={kpi.label} className="rounded-2xl border-border/70 hover:shadow-md transition-all">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-semibold text-muted-foreground leading-tight truncate">{kpi.label}</span>
                <div className={`w-8 h-8 rounded-xl ${kpi.bg} flex items-center justify-center flex-shrink-0`}>
                  <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-foreground tracking-tight">{kpi.value}</div>
              <div className="text-[11px] text-muted-foreground mt-1 truncate">{kpi.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="campaigns" className="space-y-4">
        <TabsList className="rounded-xl p-1 bg-muted/70">
          <TabsTrigger value="campaigns" className="rounded-lg gap-2">
            <BarChart3 className="w-4 h-4" /> Campaign History ({campaigns.length})
          </TabsTrigger>
          <TabsTrigger value="transactions" className="rounded-lg gap-2">
            <CreditCard className="w-4 h-4" /> Wallet, Points &amp; Payment Ledger
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="space-y-4">
          <Card className="rounded-2xl border-border/70 overflow-hidden shadow-sm">
            <CardHeader className="pb-4 border-b border-border/60 bg-muted/20">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    placeholder="Search campaign name, menu item, or ID..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPage(1);
                    }}
                    className="pl-9 rounded-xl bg-background"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={adTypeFilter}
                    onChange={(e) => {
                      setAdTypeFilter(e.target.value);
                      setPage(1);
                    }}
                    className="h-9 rounded-xl border border-input bg-background px-3 text-sm"
                  >
                    <option value="ALL">All Ad Types</option>
                    <option value="HOME_PAGE">Home Page Ads</option>
                    <option value="SEARCH">Search Ads</option>
                    <option value="PRODUCT_DETAILS">Product Details Ads</option>
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPage(1);
                    }}
                    className="h-9 rounded-xl border border-input bg-background px-3 text-sm"
                  >
                    <option value="ALL">All Statuses</option>
                    {[
                      'DRAFT',
                      'PENDING_PAYMENT',
                      'SCHEDULED',
                      'ACTIVATING',
                      'ACTIVE',
                      'PAUSED',
                      'COMPLETED',
                      'REJECTED',
                      'CANCELLED',
                      'FAILED',
                    ].map((st) => (
                      <option key={st} value={st}>
                        {getCampaignStatusMeta(st).label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0 overflow-x-auto">
              {loading ? (
                <div className="py-16 flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" /> Loading campaigns...
                </div>
              ) : paginatedCampaigns.length === 0 ? (
                <div className="py-16 px-4 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                    <Megaphone className="w-6 h-6" />
                  </div>
                  <div className="font-bold text-foreground">No campaigns found</div>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Launch your first Home Page, Search, or Product Details advertisement to reach more hungry customers on AKR Hunger.
                  </p>
                  <Button onClick={() => setCreateDialogOpen(true)} className="rounded-xl gap-2">
                    <Plus className="w-4 h-4" /> Create Your First Campaign
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Campaign Name</TableHead>
                      <TableHead>Advertisement Type</TableHead>
                      <TableHead>Selected Menu Item</TableHead>
                      <TableHead>Budget</TableHead>
                      <TableHead>Spent</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Impr.</TableHead>
                      <TableHead className="text-right">Clicks</TableHead>
                      <TableHead className="text-right">Orders</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedCampaigns.map((c) => {
                      const status = normalizeCampaignStatus(c);
                      const statusMeta = getCampaignStatusMeta(status);
                      const adMeta =
                        AD_PLACEMENTS[(c.adType as CampaignAdType) || 'HOME_PAGE'] ||
                        AD_PLACEMENTS.HOME_PAGE;
                      const budget = Number(c.totalBudget ?? c.monthlyCost ?? 0);
                      const spent = Number(c.spentAmount ?? c.totalSpent ?? 0);
                      const imps = Number(c.impressions || 0);
                      const clicks = Number((c.totalClicks ?? c.clicks) || 0);
                      const orders = Number((c.ordersGenerated ?? c.conversions) || 0);
                      const itemNames =
                        Array.isArray(c.menuItemsSnapshot) && c.menuItemsSnapshot.length > 0
                          ? c.menuItemsSnapshot.map((m: any) => m.name).join(', ')
                          : c.menuItemName || '—';

                      return (
                        <TableRow key={c.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell>
                            <Link
                              href={`/restaurant/campaigns/${c.id}`}
                              className="font-bold text-foreground hover:text-primary transition-colors block max-w-[180px] truncate"
                            >
                              {c.campaignName || c.title || c.id}
                            </Link>
                            <span className="text-[11px] text-muted-foreground">{c.id}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-medium whitespace-nowrap">
                              {adMeta.title}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-[180px] truncate text-sm font-medium text-foreground" title={itemNames}>
                              {itemNames}
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold whitespace-nowrap">₹{budget.toFixed(0)}</TableCell>
                          <TableCell className="font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                            ₹{spent.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDateTime(c.startAt || c.startDate)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDateTime(c.endAt || c.endDate)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`${statusMeta.className} whitespace-nowrap`}>
                              {statusMeta.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold">{imps.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-semibold">{clicks.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400">
                            {orders}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => router.push(`/restaurant/campaigns/${c.id}`)}
                                className="h-8 px-2.5 text-xs font-semibold"
                              >
                                Analytics
                              </Button>
                              {status === 'ACTIVE' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={actingId === c.id}
                                  onClick={() => handleLifecycleAction(c.id, 'PAUSE')}
                                  className="h-8 w-8 p-0"
                                  title="Pause campaign"
                                >
                                  <Pause className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              {status === 'PAUSED' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={actingId === c.id}
                                  onClick={() => handleLifecycleAction(c.id, 'RESUME')}
                                  className="h-8 w-8 p-0"
                                  title="Resume campaign"
                                >
                                  <Play className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              {['PENDING_PAYMENT', 'SCHEDULED', 'ACTIVATING', 'ACTIVE', 'PAUSED'].includes(status) && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={actingId === c.id}
                                  onClick={() => handleLifecycleAction(c.id, 'CANCEL')}
                                  className="h-8 w-8 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                                  title="Cancel & refund unused balance"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>

            {filteredCampaigns.length > PAGE_SIZE && (
              <div className="px-4 py-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredCampaigns.length)} of{' '}
                  {filteredCampaigns.length} campaigns
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="font-semibold px-2">
                    Page {page} / {totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card className="rounded-2xl border-border/70">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-500" /> Restaurant Wallet Ad Transactions
              </CardTitle>
              <CardDescription>Wallet deductions, holds, and unused-budget refunds</CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto max-h-[420px]">
              {walletTransactions.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">No wallet campaign transactions yet.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {walletTransactions.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>
                          <div className="font-semibold text-xs">{t.campaignName || t.campaignId}</div>
                          <div className="text-[11px] text-muted-foreground line-clamp-1">{t.description}</div>
                        </TableCell>
                        <TableCell><Badge variant="outline">{t.type}</Badge></TableCell>
                        <TableCell className="font-bold">₹{Number(t.amount || 0).toFixed(2)}</TableCell>
                        <TableCell><Badge variant="secondary">{t.status}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDateTime(t.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-500" /> Reward Points &amp; Online Payments
              </CardTitle>
              <CardDescription>Reward point redemptions and Razorpay order references</CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto max-h-[420px]">
              {rewardTransactions.length === 0 && payments.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">No points or online ad payments yet.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Amount / Pts</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="font-semibold text-xs">{p.campaignName || p.campaignId}</div>
                          <div className="text-[11px] text-muted-foreground">{p.razorpayPaymentId || p.paymentId}</div>
                        </TableCell>
                        <TableCell><Badge variant="outline">{p.paymentMethod}</Badge></TableCell>
                        <TableCell className="font-bold text-xs">
                          ₹{Number(p.totalAmount || 0)}
                          {Number(p.pointsUsed || 0) > 0 ? ` (${p.pointsUsed} pts)` : ''}
                        </TableCell>
                        <TableCell><Badge variant="secondary">{p.status}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDateTime(p.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                    {rewardTransactions.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="font-semibold text-xs">{r.campaignName || r.campaignId}</div>
                          <div className="text-[11px] text-muted-foreground line-clamp-1">{r.description}</div>
                        </TableCell>
                        <TableCell><Badge variant="outline">POINTS ({r.type})</Badge></TableCell>
                        <TableCell className="font-bold text-xs">{r.points} pts (₹{r.rupeeValue})</TableCell>
                        <TableCell><Badge variant="secondary">{r.status}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* CREATE CAMPAIGN DIALOG — EXACTLY THREE ADVERTISEMENT TYPE CARDS WITH VISUAL MOCKUPS */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="w-[96vw] max-w-[96vw] sm:max-w-[94vw] lg:max-w-6xl xl:max-w-7xl max-h-[92vh] overflow-y-auto rounded-3xl p-5 sm:p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black flex items-center gap-2">
              <Megaphone className="w-6 h-6 text-primary" /> Choose Advertisement Type
            </DialogTitle>
            <DialogDescription>
              Select where your restaurant dishes should appear inside the AKR Hunger customer app. Each option includes a live customer placement preview.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 pt-2">
            {adTypeCards.map((adType) => {
              const meta = AD_PLACEMENTS[adType];
              const targetHref = `/restaurant/campaigns/create/${adTypeToSlug(adType)}`;

              return (
                <Card
                  key={adType}
                  className="rounded-2xl border-border/80 hover:border-primary/60 hover:shadow-xl transition-all flex flex-col justify-between overflow-hidden"
                >
                  <CardHeader className="pb-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Badge className="bg-primary/10 text-primary border-primary/25 text-[11px] font-bold">
                        {meta.badgeText}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg font-black text-foreground">{meta.title}</CardTitle>
                    <CardDescription className="text-xs leading-relaxed">
                      {meta.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-2.5">
                      <AdPlacementPreview
                        adType={adType}
                        restaurantName={restaurant?.name || 'Your Restaurant'}
                        offerBadge={adType === 'HOME_PAGE' ? '20% OFF' : undefined}
                        compact
                      />
                      <div className="p-2.5 rounded-xl bg-muted/50 border border-border/60 text-[11px]">
                        <span className="font-bold text-foreground">Example placement: </span>
                        <span className="text-muted-foreground">{meta.examplePlacement}</span>
                      </div>
                    </div>

                    <Button
                      onClick={() => {
                        setCreateDialogOpen(false);
                        router.push(targetHref);
                      }}
                      className="w-full h-10 rounded-xl font-bold gap-2 cursor-pointer"
                    >
                      Select Advertisement <ArrowRight className="w-4 h-4" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
