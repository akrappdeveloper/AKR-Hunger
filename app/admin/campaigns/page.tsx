'use client';

import { useEffect, useMemo, useState } from 'react';
import { auth } from '@/lib/firebase';
import { AdSettings } from '@/lib/types';
import { ProtectedRoute } from '@/components/admin/ProtectedRoute';
import {
  DEFAULT_AD_SETTINGS,
  getCampaignStatusMeta,
  normalizeCampaignStatus,
  AD_PLACEMENTS,
} from '@/lib/campaigns/constants';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Megaphone, Play, Pause, Ban, Eye, MousePointer, IndianRupee,
  Search, RefreshCw, TrendingUp, ShoppingBag, Coins, Settings, Wallet,
  CheckCircle2, AlertTriangle, Loader2, BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';

export default function AdminCampaignsPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [walletTransactions, setWalletTransactions] = useState<any[]>([]);
  const [rewardTransactions, setRewardTransactions] = useState<any[]>([]);
  const [totalPointsInCirculation, setTotalPointsInCirculation] = useState(0);
  const [settings, setSettings] = useState<AdSettings>(DEFAULT_AD_SETTINGS);
  const [savingSettings, setSavingSettings] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [adTypeFilter, setAdTypeFilter] = useState('ALL');

  // Modals
  const [selectedCampaign, setSelectedCampaign] = useState<any | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const getToken = async () => {
    const user = auth.currentUser;
    if (!user) throw new Error('Admin session not ready');
    return user.getIdToken();
  };

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/admin/campaigns', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to load admin campaign data');
      }
      setCampaigns(data.campaigns || []);
      setPayments(data.payments || []);
      setWalletTransactions(data.walletTransactions || []);
      setRewardTransactions(data.rewardTransactions || []);
      setTotalPointsInCirculation(Number(data.totalPointsInCirculation || 0));
      if (data.settings) setSettings(data.settings);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load campaigns');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      if (u) fetchData();
    });
    return () => unsub();
  }, []);

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
          c.restaurantName,
          c.restaurantId,
          c.menuItemName,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [campaigns, statusFilter, adTypeFilter, searchQuery]);

  const kpis = useMemo(() => {
    let active = 0;
    let scheduled = 0;
    let totalSpent = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalOrders = 0;
    let totalRevenue = 0;

    campaigns.forEach((c) => {
      const st = normalizeCampaignStatus(c);
      if (st === 'ACTIVE') active++;
      if (st === 'SCHEDULED' || st === 'ACTIVATING') scheduled++;
      totalSpent += Number(c.spentAmount ?? c.totalSpent ?? 0);
      totalImpressions += Number(c.impressions || 0);
      totalClicks += Number(c.totalClicks ?? c.clicks ?? 0);
      totalOrders += Number(c.ordersGenerated ?? c.conversions ?? 0);
      totalRevenue += Number(c.revenueAttributed || 0);
    });

    return {
      total: campaigns.length,
      active,
      scheduled,
      totalSpent,
      totalImpressions,
      totalClicks,
      totalOrders,
      totalRevenue,
    };
  }, [campaigns]);

  const handleCampaignAction = async (
    campaignId: string,
    action: 'PAUSE' | 'RESUME' | 'REJECT',
    reason?: string
  ) => {
    setActionLoading(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/admin/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ campaignId, action, reason }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Failed to ${action.toLowerCase()} campaign`);
      }
      toast.success(
        action === 'REJECT'
          ? `Campaign rejected${data.refundedAmount > 0 ? ` & ₹${data.refundedAmount} refunded` : ''}`
          : `Campaign status updated to ${data.campaignStatus}`
      );
      setRejectOpen(false);
      setRejectReason('');
      setDetailOpen(false);
      await fetchData(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/admin/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'UPDATE_SETTINGS', settings }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to save settings');
      toast.success('Global Ad Platform Settings updated successfully');
      await fetchData(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const formatDt = (val: any) => {
    if (!val) return '—';
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  };

  return (
    <ProtectedRoute allowedRoles={['super_admin', 'operations_admin', 'content_manager', 'finance_admin']}>
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-rose-600 text-white flex items-center justify-center shadow-md">
                <Megaphone className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                  Campaigns &amp; Ads Operations
                </h1>
                <p className="text-sm text-muted-foreground">
                  Manage restaurant advertisements, enforce quality, audit ledger transactions, and configure ad rates.
                </p>
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => fetchData(true)}
            disabled={refreshing || loading}
            className="gap-2 rounded-xl"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh &amp; Run Scheduler
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
          {[
            { label: 'Total Campaigns', val: kpis.total, icon: Megaphone, color: 'text-orange-500' },
            { label: 'Active Now', val: kpis.active, icon: Play, color: 'text-emerald-500' },
            { label: 'Scheduled', val: kpis.scheduled, icon: BarChart3, color: 'text-blue-500' },
            { label: 'Ad Spend', val: `₹${kpis.totalSpent.toFixed(0)}`, icon: IndianRupee, color: 'text-amber-500' },
            { label: 'Impressions', val: kpis.totalImpressions.toLocaleString(), icon: Eye, color: 'text-indigo-500' },
            { label: 'Clicks', val: kpis.totalClicks.toLocaleString(), icon: MousePointer, color: 'text-cyan-500' },
            { label: 'Orders Attr.', val: kpis.totalOrders, icon: ShoppingBag, color: 'text-pink-500' },
            { label: 'Reward Circ.', val: `${totalPointsInCirculation.toLocaleString()} pts`, icon: Coins, color: 'text-yellow-500' },
          ].map((item) => (
            <Card key={item.label} className="rounded-2xl border-border/70">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-xs font-medium text-muted-foreground mb-1">
                  <span>{item.label}</span>
                  <item.icon className={`w-4 h-4 ${item.color}`} />
                </div>
                <div className="text-xl font-black text-foreground">{item.val}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="campaigns" className="space-y-4">
          <TabsList className="rounded-xl p-1 bg-muted/70">
            <TabsTrigger value="campaigns" className="rounded-lg gap-2">
              <Megaphone className="w-4 h-4" /> Campaigns ({campaigns.length})
            </TabsTrigger>
            <TabsTrigger value="ledger" className="rounded-lg gap-2">
              <Wallet className="w-4 h-4" /> Wallet &amp; Points Ledger
            </TabsTrigger>
            <TabsTrigger value="settings" className="rounded-lg gap-2">
              <Settings className="w-4 h-4" /> Ad Rates &amp; Settings
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: CAMPAIGNS */}
          <TabsContent value="campaigns" className="space-y-4">
            <Card className="rounded-2xl border-border/70">
              <CardHeader className="pb-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      placeholder="Search campaign name, ID, restaurant, item..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 rounded-xl"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={adTypeFilter}
                      onChange={(e) => setAdTypeFilter(e.target.value)}
                      className="h-9 rounded-xl border border-input bg-background px-3 text-sm"
                    >
                      <option value="ALL">All Ad Types</option>
                      <option value="HOME_PAGE">Home Page Ads</option>
                      <option value="SEARCH">Search Ads</option>
                      <option value="PRODUCT_DETAILS">Product Details Ads</option>
                    </select>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="h-9 rounded-xl border border-input bg-background px-3 text-sm"
                    >
                      <option value="ALL">All Statuses</option>
                      {['ACTIVE', 'ACTIVATING', 'SCHEDULED', 'PENDING_PAYMENT', 'PAUSED', 'COMPLETED', 'REJECTED', 'CANCELLED', 'FAILED', 'DRAFT'].map((st) => (
                        <option key={st} value={st}>{st.replace('_', ' ')}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0 overflow-x-auto">
                {loading ? (
                  <div className="py-16 flex justify-center items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" /> Loading platform campaigns...
                  </div>
                ) : filteredCampaigns.length === 0 ? (
                  <div className="py-16 text-center text-muted-foreground text-sm">
                    No campaigns match the selected filters.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campaign</TableHead>
                        <TableHead>Restaurant</TableHead>
                        <TableHead>Ad Type</TableHead>
                        <TableHead>Budget / Spent</TableHead>
                        <TableHead>Performance</TableHead>
                        <TableHead>Schedule</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCampaigns.map((c) => {
                        const status = normalizeCampaignStatus(c);
                        const meta = getCampaignStatusMeta(status);
                        const adMeta = AD_PLACEMENTS[(c.adType as keyof typeof AD_PLACEMENTS) || 'HOME_PAGE'] || AD_PLACEMENTS.HOME_PAGE;
                        const spent = Number(c.spentAmount ?? c.totalSpent ?? 0);
                        const budget = Number(c.totalBudget ?? c.monthlyCost ?? 0);
                        const clicks = Number(c.totalClicks ?? c.clicks ?? 0);
                        const imps = Number(c.impressions || 0);
                        const orders = Number(c.ordersGenerated ?? c.conversions ?? 0);

                        return (
                          <TableRow key={c.id}>
                            <TableCell>
                              <div className="font-bold text-foreground">
                                {c.campaignName || c.title || c.id}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {c.menuItemName || `${(c.menuItemIds || []).length} items`} • {c.id}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm font-medium">{c.restaurantName || 'Partner'}</div>
                              <div className="text-xs text-muted-foreground">{c.restaurantId}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-semibold">
                                {adMeta.shortTitle}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm font-bold">
                                ₹{spent.toFixed(2)} <span className="text-muted-foreground font-normal">/ ₹{budget}</span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Pay: {c.paymentMethodUsed || 'POINTS'}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-xs space-y-0.5">
                                <div>{imps.toLocaleString()} imp • {clicks} clicks</div>
                                <div className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                  {orders} orders • ₹{Number(c.revenueAttributed || 0).toFixed(0)} rev
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-xs text-muted-foreground">
                                <div>Start: {formatDt(c.startAt || c.startDate)}</div>
                                <div>End: {formatDt(c.endAt || c.endDate)}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={meta.className}>
                                {meta.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setSelectedCampaign(c);
                                    setDetailOpen(true);
                                  }}
                                >
                                  Details
                                </Button>
                                {['ACTIVE', 'SCHEDULED', 'ACTIVATING'].includes(status) && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={actionLoading}
                                    onClick={() => handleCampaignAction(c.id, 'PAUSE', 'Paused by Admin')}
                                  >
                                    <Pause className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                                {status === 'PAUSED' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={actionLoading}
                                    onClick={() => handleCampaignAction(c.id, 'RESUME')}
                                  >
                                    <Play className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                                {!['REJECTED', 'CANCELLED', 'COMPLETED'].includes(status) && (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    disabled={actionLoading}
                                    onClick={() => {
                                      setSelectedCampaign(c);
                                      setRejectReason('');
                                      setRejectOpen(true);
                                    }}
                                  >
                                    <Ban className="w-3.5 h-3.5" />
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
            </Card>
          </TabsContent>

          {/* TAB 2: LEDGER */}
          <TabsContent value="ledger" className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card className="rounded-2xl border-border/70">
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-primary" /> Restaurant Wallet Ad Transactions
                </CardTitle>
                <CardDescription>Real-time debits, payment reservations, releases, and refunds</CardDescription>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto max-h-[520px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Restaurant</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {walletTransactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell>
                          <div className="text-xs font-bold">{tx.restaurantId}</div>
                          <div className="text-[11px] text-muted-foreground line-clamp-1">{tx.description}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{tx.type}</Badge>
                        </TableCell>
                        <TableCell className="font-bold">₹{Number(tx.amount || 0).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{tx.status}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDt(tx.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/70">
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Coins className="w-5 h-5 text-amber-500" /> Reward Points Transactions
                </CardTitle>
                <CardDescription>Points redemptions, reservations, and releases across restaurants</CardDescription>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto max-h-[520px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Restaurant</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Points (₹ Value)</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rewardTransactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell>
                          <div className="text-xs font-bold">{tx.restaurantId}</div>
                          <div className="text-[11px] text-muted-foreground line-clamp-1">{tx.description}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{tx.type}</Badge>
                        </TableCell>
                        <TableCell className="font-bold">
                          {tx.points} pts (₹{Number(tx.rupeeValue || 0).toFixed(0)})
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{tx.status}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDt(tx.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: SETTINGS */}
          <TabsContent value="settings">
            <Card className="rounded-2xl border-border/70 max-w-3xl">
              <CardHeader>
                <CardTitle className="text-xl font-bold">Global Advertising Rates &amp; Rules</CardTitle>
                <CardDescription>
                  Changes immediately affect campaign budget estimates, minimum spend enforcement, CPC/CPM billing, and points conversion.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveSettings} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Minimum Daily Budget (₹)</Label>
                      <Input
                        type="number"
                        value={settings.minDailyBudget}
                        onChange={(e) => setSettings({ ...settings, minDailyBudget: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Minimum Total Budget (₹)</Label>
                      <Input
                        type="number"
                        value={settings.minTotalBudget}
                        onChange={(e) => setSettings({ ...settings, minTotalBudget: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Base CPC Rate (₹ per Click)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={settings.cpcRate}
                        onChange={(e) => setSettings({ ...settings, cpcRate: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Base CPM Rate (₹ per 1,000 Impressions)</Label>
                      <Input
                        type="number"
                        step="1"
                        value={settings.cpmRate}
                        onChange={(e) => setSettings({ ...settings, cpmRate: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Reward Points Conversion (₹ per 1 Point)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={settings.pointsToRupeeRate}
                        onChange={(e) => setSettings({ ...settings, pointsToRupeeRate: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Activation Review Window (seconds)</Label>
                      <Input
                        type="number"
                        value={settings.activationDelaySeconds}
                        onChange={(e) => setSettings({ ...settings, activationDelaySeconds: Number(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-border">
                    <h4 className="font-bold text-sm">Placements &amp; Rate Multipliers</h4>
                    {(['HOME_PAGE', 'SEARCH', 'PRODUCT_DETAILS'] as const).map((pl) => (
                      <div key={pl} className="flex items-center justify-between gap-4 p-3 rounded-xl bg-muted/40 border border-border/60">
                        <div>
                          <div className="font-semibold text-sm">{AD_PLACEMENTS[pl].title}</div>
                          <div className="text-xs text-muted-foreground">{AD_PLACEMENTS[pl].examplePlacement}</div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Label className="text-xs">Multiplier</Label>
                            <Input
                              type="number"
                              step="0.1"
                              className="w-20 h-8"
                              value={settings.placementMultipliers[pl]}
                              onChange={(e) =>
                                setSettings({
                                  ...settings,
                                  placementMultipliers: {
                                    ...settings.placementMultipliers,
                                    [pl]: Number(e.target.value),
                                  },
                                })
                              }
                            />
                          </div>
                          <Switch
                            checked={settings.placementsEnabled[pl]}
                            onCheckedChange={(checked) =>
                              setSettings({
                                ...settings,
                                placementsEnabled: {
                                  ...settings.placementsEnabled,
                                  [pl]: checked,
                                },
                              })
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button type="submit" disabled={savingSettings} className="rounded-xl gap-2">
                    {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Save Global Ad Settings
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Campaign Detail Modal */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedCampaign?.campaignName || selectedCampaign?.title || 'Campaign Details'}</DialogTitle>
              <DialogDescription>
                ID: {selectedCampaign?.id} • Restaurant: {selectedCampaign?.restaurantName || selectedCampaign?.restaurantId}
              </DialogDescription>
            </DialogHeader>
            {selectedCampaign && (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-muted/50">
                    <div className="text-xs text-muted-foreground">Total Budget</div>
                    <div className="font-bold">₹{Number(selectedCampaign.totalBudget ?? selectedCampaign.monthlyCost ?? 0)}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/50">
                    <div className="text-xs text-muted-foreground">Spent / Remaining</div>
                    <div className="font-bold">
                      ₹{Number(selectedCampaign.spentAmount || 0).toFixed(2)} / ₹{Number(selectedCampaign.remainingBudget || 0).toFixed(2)}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/50">
                    <div className="text-xs text-muted-foreground">Payment Split</div>
                    <div className="font-bold">
                      {selectedCampaign.paymentMethodUsed || 'POINTS'}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/50">
                    <div className="text-xs text-muted-foreground">Orders / Revenue</div>
                    <div className="font-bold">
                      {Number(selectedCampaign.ordersGenerated || 0)} / ₹{Number(selectedCampaign.revenueAttributed || 0).toFixed(0)}
                    </div>
                  </div>
                </div>
                {selectedCampaign.campaignDescription && (
                  <div className="p-3 rounded-xl border border-border">
                    <div className="text-xs font-semibold text-muted-foreground mb-1">Description</div>
                    <p>{selectedCampaign.campaignDescription}</p>
                  </div>
                )}
                {selectedCampaign.rejectionReason && (
                  <div className="p-3 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400">
                    <div className="text-xs font-bold mb-1">Rejection Reason</div>
                    <p>{selectedCampaign.rejectionReason}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Reject Reason Dialog */}
        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-rose-600">
                <AlertTriangle className="w-5 h-5" /> Reject Campaign &amp; Refund Unused Budget
              </DialogTitle>
              <DialogDescription>
                Rejecting "{selectedCampaign?.campaignName || selectedCampaign?.id}" immediately halts delivery and refunds any unused paid budget to the restaurant wallet.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label>Rejection Reason (shown to restaurant owner)</Label>
              <Input
                placeholder="e.g., Misleading offer claim or prohibited item image"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={actionLoading || !rejectReason.trim()}
                onClick={() => selectedCampaign && handleCampaignAction(selectedCampaign.id, 'REJECT', rejectReason)}
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Reject &amp; Issue Refund
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  );
}
