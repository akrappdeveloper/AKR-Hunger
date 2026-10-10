'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, updateDoc, doc, getDocs, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AdCampaign, PointsAccount } from '@/lib/types';
import { ContentService } from '@/lib/services/ContentService';
import { ProtectedRoute } from '@/components/admin/ProtectedRoute';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Megaphone, Play, Pause, Ban, Eye, MousePointer, IndianRupee,
  Search, Filter, TrendingUp, Target, Zap, BarChart3, Activity,
  ArrowUpRight, Coins
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { toast } from 'sonner';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<(AdCampaign & { id: string })[]>([]);
  const [filteredCampaigns, setFilteredCampaigns] = useState<(AdCampaign & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedCampaign, setSelectedCampaign] = useState<(AdCampaign & { id: string }) | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [totalPointsInCirculation, setTotalPointsInCirculation] = useState(0);

  useEffect(() => {
    const unsubCampaigns = onSnapshot(
      query(collection(db, 'adCampaigns'), orderBy('createdAt', 'desc')),
      (snap) => {
        const data = snap.docs.map(doc => ({
          ...doc.data(),
          id: doc.id,
        })) as (AdCampaign & { id: string })[];
        setCampaigns(data);
        setLoading(false);
      },
      (error) => {
        console.warn("Snapshot listener notice for adCampaigns:", error.message);
        setLoading(false);
      }
    );

    // Fetch total points in circulation
    const unsubPoints = onSnapshot(
      collection(db, 'pointsAccounts'),
      (snap) => {
        let total = 0;
        snap.docs.forEach(doc => {
          const data = doc.data();
          total += data.availablePoints || 0;
        });
        setTotalPointsInCirculation(total);
      },
      (error) => {
        console.warn("Snapshot listener notice for pointsAccounts:", error.message);
      }
    );

    return () => {
      unsubCampaigns();
      unsubPoints();
    };
  }, []);

  useEffect(() => {
    let filtered = campaigns;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.title?.toLowerCase().includes(q) ||
        c.restaurantName?.toLowerCase().includes(q) ||
        c.menuItemName?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter(c => c.status === statusFilter);
    }
    setFilteredCampaigns(filtered);
  }, [campaigns, searchQuery, statusFilter]);

  const handleTogglePause = async (campaign: AdCampaign & { id: string }) => {
    try {
      const newStatus = campaign.status === 'active' ? 'paused' : 'active';
      await ContentService.updateCampaignStatus(campaign.id, newStatus);
      toast.success(`Campaign ${newStatus === 'active' ? 'resumed' : 'paused'} successfully`);
    } catch (err) {
      toast.error('Failed to update campaign');
    }
  };

  const handleCancel = async (campaign: AdCampaign & { id: string }) => {
    try {
      await ContentService.updateCampaignStatus(campaign.id, 'cancelled');
      toast.success('Campaign cancelled');
    } catch (err) {
      toast.error('Failed to cancel campaign');
    }
  };

  // Aggregated stats
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
  const totalSpent = campaigns.reduce((acc, c) => acc + (c.totalSpent || 0), 0);
  const totalImpressions = campaigns.reduce((acc, c) => acc + (c.impressions || 0), 0);
  const totalClicks = campaigns.reduce((acc, c) => acc + (c.totalClicks || 0), 0);
  const avgCTR = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0';

  const statusDistribution = [
    { name: 'Active', value: campaigns.filter(c => c.status === 'active').length, fill: '#10B981' },
    { name: 'Paused', value: campaigns.filter(c => c.status === 'paused').length, fill: '#F59E0B' },
    { name: 'Completed', value: campaigns.filter(c => c.status === 'completed').length, fill: '#3B82F6' },
    { name: 'Cancelled', value: campaigns.filter(c => c.status === 'cancelled').length, fill: '#EF4444' },
  ];

  // Top campaigns by clicks
  const topByClicks = [...campaigns].sort((a, b) => (b.totalClicks || 0) - (a.totalClicks || 0)).slice(0, 5);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'paused': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'completed': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'cancelled': return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-gray-500/10 text-muted-foreground border-border/20';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-4">
          <div className="h-10 w-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading campaigns...</p>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['super_admin', 'marketing_admin']}>
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-100 to-gray-400 tracking-tight mb-2">
            Campaign Management
          </h1>
          <p className="text-muted-foreground">Monitor and manage all restaurant advertising campaigns.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { title: 'Total Campaigns', value: campaigns.length, icon: Megaphone, color: 'blue' },
          { title: 'Active Campaigns', value: activeCampaigns, icon: Activity, color: 'emerald' },
          { title: 'Total Points Spent', value: totalSpent.toLocaleString(), icon: Coins, color: 'purple' },
          { title: 'Total Impressions', value: totalImpressions.toLocaleString(), icon: Eye, color: 'orange' },
          { title: 'Avg CTR', value: `${avgCTR}%`, icon: Target, color: 'cyan' },
        ].map((stat, i) => {
          const Icon = stat.icon;
          const colors: Record<string, string> = {
            blue: 'from-blue-600/20 to-blue-600/5 border-blue-500/20',
            emerald: 'from-emerald-600/20 to-emerald-600/5 border-emerald-500/20',
            purple: 'from-purple-600/20 to-purple-600/5 border-purple-500/20',
            orange: 'from-orange-600/20 to-orange-600/5 border-orange-500/20',
            cyan: 'from-cyan-600/20 to-cyan-600/5 border-cyan-500/20',
          };
          const iconColors: Record<string, string> = {
            blue: 'text-blue-400', emerald: 'text-emerald-400', purple: 'text-purple-400',
            orange: 'text-orange-400', cyan: 'text-cyan-400',
          };
          return (
            <Card key={i} className={`bg-gradient-to-br ${colors[stat.color]} border backdrop-blur-md shadow-xl`}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <Icon className={`w-5 h-5 ${iconColors[stat.color]}`} />
                </div>
                <p className="text-2xl font-bold text-foreground font-mono">{stat.value}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{stat.title}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-background/40 border-border/50 backdrop-blur-md shadow-xl overflow-hidden">
          <CardHeader className="border-b border-border/50 bg-card/5 pb-4">
            <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              Top Campaigns by Clicks
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 pl-0">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topByClicks.map(c => ({ name: c.title?.slice(0, 15) || 'Untitled', clicks: c.totalClicks || 0, impressions: c.impressions || 0 }))} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="#6B7280" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                <YAxis stroke="#6B7280" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                <Tooltip contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff' }} />
                <Bar dataKey="clicks" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={24} name="Clicks" />
                <Bar dataKey="impressions" fill="#8B5CF6" radius={[4, 4, 0, 0]} barSize={24} name="Impressions" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-background/40 border-border/50 backdrop-blur-md shadow-xl overflow-hidden">
          <CardHeader className="border-b border-border/50 bg-card/5 pb-4">
            <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-emerald-400" />
              Campaign Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 flex items-center justify-center">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={statusDistribution.filter(s => s.value > 0)} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value" stroke="none">
                  {statusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff' }} />
                <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} formatter={(value) => <span className="text-muted-foreground">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Table */}
      <Card className="bg-background/40 border-border/50 backdrop-blur-md shadow-xl overflow-hidden">
        <CardHeader className="border-b border-border/50 bg-card/5 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-blue-400" />
              All Campaigns
            </CardTitle>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search campaigns..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-background/20 border-border/50 text-foreground placeholder:text-muted-foreground w-64"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-background/20 border border-border/50 rounded-lg text-foreground text-sm focus:outline-none focus:border-blue-500/50"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredCampaigns.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No campaigns found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Campaign</TableHead>
                    <TableHead className="text-muted-foreground">Restaurant</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                    <TableHead className="text-muted-foreground text-right">Impressions</TableHead>
                    <TableHead className="text-muted-foreground text-right">Clicks</TableHead>
                    <TableHead className="text-muted-foreground text-right">CTR</TableHead>
                    <TableHead className="text-muted-foreground text-right">Spent</TableHead>
                    <TableHead className="text-muted-foreground text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCampaigns.map((campaign) => {
                    const ctr = campaign.impressions
                      ? ((campaign.totalClicks / campaign.impressions) * 100).toFixed(1)
                      : '0';
                    return (
                      <TableRow key={campaign.id} className="border-border/50 hover:bg-card/5 transition-colors">
                        <TableCell className="text-foreground font-medium">
                          <div>
                            <p className="text-sm">{campaign.title || 'Untitled'}</p>
                            <p className="text-muted-foreground text-xs">{campaign.menuItemName}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{campaign.restaurantName}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${getStatusColor(campaign.status)}`}>
                            {campaign.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-right font-mono text-sm">{(campaign.impressions || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-muted-foreground text-right font-mono text-sm">{(campaign.totalClicks || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-muted-foreground text-right font-mono text-sm">{ctr}%</TableCell>
                        <TableCell className="text-muted-foreground text-right font-mono text-sm">{(campaign.totalSpent || 0).toLocaleString()} pts</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => { setSelectedCampaign(campaign); setDetailOpen(true); }}
                              className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 h-8 w-8 p-0"
                            >
                              <Eye size={14} />
                            </Button>
                            {(campaign.status === 'active' || campaign.status === 'paused') && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleTogglePause(campaign)}
                                className={`h-8 w-8 p-0 ${campaign.status === 'active'
                                  ? 'text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10'
                                  : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
                                  }`}
                              >
                                {campaign.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                              </Button>
                            )}
                            {campaign.status !== 'cancelled' && campaign.status !== 'completed' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleCancel(campaign)}
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8 p-0"
                              >
                                <Ban size={14} />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Campaign Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="bg-card border-border/50 text-foreground max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">{selectedCampaign?.title || 'Campaign Details'}</DialogTitle>
            <DialogDescription className="text-muted-foreground">{selectedCampaign?.description}</DialogDescription>
          </DialogHeader>
          {selectedCampaign && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-background/20 rounded-xl p-4 border border-border/50">
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Restaurant</p>
                  <p className="text-foreground font-medium text-sm">{selectedCampaign.restaurantName}</p>
                </div>
                <div className="bg-background/20 rounded-xl p-4 border border-border/50">
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Menu Item</p>
                  <p className="text-foreground font-medium text-sm">{selectedCampaign.menuItemName}</p>
                </div>
                <div className="bg-background/20 rounded-xl p-4 border border-border/50">
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Status</p>
                  <Badge variant="outline" className={`text-xs ${getStatusColor(selectedCampaign.status)}`}>
                    {selectedCampaign.status}
                  </Badge>
                </div>
                <div className="bg-background/20 rounded-xl p-4 border border-border/50">
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Budget Type</p>
                  <p className="text-foreground font-medium text-sm capitalize">{selectedCampaign.budget}</p>
                </div>
                <div className="bg-background/20 rounded-xl p-4 border border-border/50">
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Total Spent</p>
                  <p className="text-emerald-400 font-bold font-mono">{selectedCampaign.totalSpent || 0} pts</p>
                </div>
                <div className="bg-background/20 rounded-xl p-4 border border-border/50">
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Remaining</p>
                  <p className="text-orange-400 font-bold font-mono">{selectedCampaign.pointsRemaining || 0} pts</p>
                </div>
                <div className="bg-background/20 rounded-xl p-4 border border-border/50">
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Impressions</p>
                  <p className="text-foreground font-bold font-mono">{(selectedCampaign.impressions || 0).toLocaleString()}</p>
                </div>
                <div className="bg-background/20 rounded-xl p-4 border border-border/50">
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Clicks</p>
                  <p className="text-foreground font-bold font-mono">{(selectedCampaign.totalClicks || 0).toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="mt-4 gap-2">
            {selectedCampaign && selectedCampaign.status !== 'cancelled' && selectedCampaign.status !== 'completed' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => { handleTogglePause(selectedCampaign); setDetailOpen(false); }}
                  className="border-border/50 text-foreground hover:bg-card/10 gap-2"
                >
                  {selectedCampaign.status === 'active' ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Resume</>}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => { handleCancel(selectedCampaign); setDetailOpen(false); }}
                  className="gap-2"
                >
                  <Ban size={14} /> Cancel Campaign
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </ProtectedRoute>
  );
}
