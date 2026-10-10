'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Shield, AlertTriangle, CheckCircle, Star, TrendingUp, TrendingDown,
  Search, Store, Award, Target, Activity, ArrowUpRight, ArrowDownRight,
  Zap, AlertCircle, XCircle, BarChart3
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadialBarChart, RadialBar, Legend, Cell } from 'recharts';
import { toast } from 'sonner';

interface RestaurantQuality {
  id: string;
  name: string;
  totalOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  successRate: number;
  avgRating: number;
  totalReviews: number;
  qualityScore: number;
  flagged: boolean;
}

interface FlaggedItem {
  id: string;
  name: string;
  restaurantName: string;
  restaurantId: string;
  avgRating: number;
  totalReviews: number;
  cancelRate: number;
  issue: string;
}

export default function AdminQualityPage() {
  const [restaurantQuality, setRestaurantQuality] = useState<RestaurantQuality[]>([]);
  const [flaggedItems, setFlaggedItems] = useState<FlaggedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'qualityScore' | 'successRate' | 'avgRating'>('qualityScore');

  useEffect(() => {
    loadQualityData();
  }, []);

  const loadQualityData = async () => {
    try {
      setLoading(true);

      // Fetch all restaurants
      const restSnap = await getDocs(collection(db, 'restaurants'));
      const restaurants = restSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

      // Fetch all orders
      const ordersSnap = await getDocs(collection(db, 'orders'));
      const orders = ordersSnap.docs.map(doc => doc.data()) as any[];

      // Fetch all reviews
      const reviewsSnap = await getDocs(collection(db, 'reviews'));
      const reviews = reviewsSnap.docs.map(doc => doc.data()) as any[];

      // Fetch all menu items
      const menuSnap = await getDocs(collection(db, 'menuItems'));
      const menuItems = menuSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

      // Process per-restaurant quality
      const qualityData: RestaurantQuality[] = restaurants.map(rest => {
        const restOrders = orders.filter(o => o.restaurantId === rest.id);
        const delivered = restOrders.filter(o => o.status === 'delivered').length;
        const cancelled = restOrders.filter(o => o.status === 'cancelled').length;
        const totalOrders = restOrders.length;
        const successRate = totalOrders > 0 ? (delivered / totalOrders) * 100 : 100;

        const restReviews = reviews.filter(r => r.restaurantId === rest.id);
        const avgRating = restReviews.length > 0
          ? restReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / restReviews.length
          : 0;

        // Quality score: weighted combination
        const ratingScore = (avgRating / 5) * 40;
        const successScore = (successRate / 100) * 40;
        const volumeScore = Math.min(totalOrders / 50, 1) * 20;
        const qualityScore = Math.round(ratingScore + successScore + volumeScore);

        return {
          id: rest.id,
          name: rest.name || 'Unknown',
          totalOrders,
          deliveredOrders: delivered,
          cancelledOrders: cancelled,
          successRate: Math.round(successRate * 10) / 10,
          avgRating: Math.round(avgRating * 10) / 10,
          totalReviews: restReviews.length,
          qualityScore,
          flagged: qualityScore < 40 || successRate < 70 || avgRating < 2.5,
        };
      });

      setRestaurantQuality(qualityData);

      // Flagged items: menu items with low ratings or high cancel rates
      const flagged: FlaggedItem[] = [];
      menuItems.forEach(item => {
        const restaurant = restaurants.find(r => r.id === item.restaurantId);
        const itemReviews = reviews.filter(r => r.menuItemId === item.id);
        const itemAvgRating = itemReviews.length > 0
          ? itemReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / itemReviews.length
          : 0;

        const itemOrders = orders.filter(o =>
          o.restaurantId === item.restaurantId &&
          o.items?.some((oi: any) => oi.menuItemId === item.id)
        );
        const itemCancelled = itemOrders.filter(o => o.status === 'cancelled').length;
        const cancelRate = itemOrders.length > 0 ? (itemCancelled / itemOrders.length) * 100 : 0;

        const issues: string[] = [];
        if (itemAvgRating > 0 && itemAvgRating < 2.5) issues.push('Low rating');
        if (cancelRate > 30 && itemOrders.length >= 3) issues.push('High cancellations');

        if (issues.length > 0) {
          flagged.push({
            id: item.id,
            name: item.name,
            restaurantName: restaurant?.name || 'Unknown',
            restaurantId: item.restaurantId,
            avgRating: Math.round(itemAvgRating * 10) / 10,
            totalReviews: itemReviews.length,
            cancelRate: Math.round(cancelRate),
            issue: issues.join(', '),
          });
        }
      });

      setFlaggedItems(flagged);
    } catch (error) {
      console.error('Error loading quality data:', error);
      toast.error('Failed to load quality data');
    } finally {
      setLoading(false);
    }
  };

  const filteredRestaurants = restaurantQuality
    .filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => b[sortBy] - a[sortBy]);

  const avgPlatformQuality = restaurantQuality.length > 0
    ? Math.round(restaurantQuality.reduce((s, r) => s + r.qualityScore, 0) / restaurantQuality.length)
    : 0;
  const flaggedCount = restaurantQuality.filter(r => r.flagged).length;
  const excellentCount = restaurantQuality.filter(r => r.qualityScore >= 80).length;
  const avgPlatformRating = restaurantQuality.length > 0
    ? (restaurantQuality.reduce((s, r) => s + r.avgRating, 0) / restaurantQuality.length).toFixed(1)
    : '0';

  const qualityDistribution = [
    { name: 'Excellent (80+)', value: restaurantQuality.filter(r => r.qualityScore >= 80).length, fill: '#10B981' },
    { name: 'Good (60-79)', value: restaurantQuality.filter(r => r.qualityScore >= 60 && r.qualityScore < 80).length, fill: '#3B82F6' },
    { name: 'Average (40-59)', value: restaurantQuality.filter(r => r.qualityScore >= 40 && r.qualityScore < 60).length, fill: '#F59E0B' },
    { name: 'Poor (<40)', value: restaurantQuality.filter(r => r.qualityScore < 40).length, fill: '#EF4444' },
  ];

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-blue-400';
    if (score >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-emerald-500/10 border-emerald-500/20';
    if (score >= 60) return 'bg-blue-500/10 border-blue-500/20';
    if (score >= 40) return 'bg-yellow-500/10 border-yellow-500/20';
    return 'bg-red-500/10 border-red-500/20';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-4">
          <div className="h-10 w-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Analyzing quality metrics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-100 to-gray-400 tracking-tight mb-2">
          Quality Control
        </h1>
        <p className="text-muted-foreground">Monitor food quality, restaurant performance, and customer satisfaction.</p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'Platform Quality Score', value: `${avgPlatformQuality}/100`, icon: Shield, color: avgPlatformQuality >= 60 ? 'emerald' : 'red', sub: 'Weighted average' },
          { title: 'Average Rating', value: `${avgPlatformRating} ★`, icon: Star, color: 'blue', sub: `${restaurantQuality.length} restaurants` },
          { title: 'Excellent Restaurants', value: excellentCount, icon: Award, color: 'purple', sub: 'Score 80+' },
          { title: 'Flagged Restaurants', value: flaggedCount, icon: AlertTriangle, color: 'orange', sub: 'Needs attention' },
        ].map((stat, i) => {
          const Icon = stat.icon;
          const colors: Record<string, string> = {
            emerald: 'from-emerald-600/20 to-emerald-600/5 border-emerald-500/20',
            blue: 'from-blue-600/20 to-blue-600/5 border-blue-500/20',
            purple: 'from-purple-600/20 to-purple-600/5 border-purple-500/20',
            orange: 'from-orange-600/20 to-orange-600/5 border-orange-500/20',
            red: 'from-red-600/20 to-red-600/5 border-red-500/20',
          };
          const iconColors: Record<string, string> = {
            emerald: 'text-emerald-400', blue: 'text-blue-400', purple: 'text-purple-400',
            orange: 'text-orange-400', red: 'text-red-400',
          };
          return (
            <Card key={i} className={`bg-gradient-to-br ${colors[stat.color]} border backdrop-blur-md shadow-xl`}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <Icon className={`w-5 h-5 ${iconColors[stat.color]}`} />
                </div>
                <p className="text-2xl font-bold text-foreground font-mono">{stat.value}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{stat.title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{stat.sub}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quality Distribution Chart */}
      <Card className="bg-background/40 border-border/50 backdrop-blur-md shadow-xl overflow-hidden">
        <CardHeader className="border-b border-border/50 bg-card/5 pb-4">
          <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            Quality Score Distribution
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 pl-0">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={qualityDistribution} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="name" stroke="#6B7280" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} />
              <YAxis stroke="#6B7280" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
              <Tooltip contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff' }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={48}>
                {qualityDistribution.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Flagged Items Alert */}
      {flaggedItems.length > 0 && (
        <Card className="bg-red-950/20 border-red-500/20 backdrop-blur-md shadow-xl overflow-hidden">
          <CardHeader className="border-b border-red-500/10 bg-red-500/5 pb-4">
            <CardTitle className="text-lg font-semibold text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Flagged Menu Items ({flaggedItems.length})
            </CardTitle>
            <CardDescription className="text-red-400/60">Items with quality concerns that need admin review</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-red-500/10 hover:bg-transparent">
                    <TableHead className="text-red-400/60">Item Name</TableHead>
                    <TableHead className="text-red-400/60">Restaurant</TableHead>
                    <TableHead className="text-red-400/60">Avg Rating</TableHead>
                    <TableHead className="text-red-400/60">Reviews</TableHead>
                    <TableHead className="text-red-400/60">Cancel Rate</TableHead>
                    <TableHead className="text-red-400/60">Issue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flaggedItems.slice(0, 10).map((item) => (
                    <TableRow key={item.id} className="border-red-500/10 hover:bg-red-500/5 transition-colors">
                      <TableCell className="text-foreground font-medium text-sm">{item.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{item.restaurantName}</TableCell>
                      <TableCell>
                        <span className={`font-mono text-sm ${item.avgRating < 2.5 ? 'text-red-400' : 'text-yellow-400'}`}>
                          {item.avgRating > 0 ? `${item.avgRating} ★` : 'N/A'}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{item.totalReviews}</TableCell>
                      <TableCell>
                        <span className={`font-mono text-sm ${item.cancelRate > 30 ? 'text-red-400' : 'text-muted-foreground'}`}>
                          {item.cancelRate}%
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 text-xs">
                          {item.issue}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Restaurant Quality Table */}
      <Card className="bg-background/40 border-border/50 backdrop-blur-md shadow-xl overflow-hidden">
        <CardHeader className="border-b border-border/50 bg-card/5 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Store className="w-5 h-5 text-blue-400" />
              Restaurant Quality Scores
            </CardTitle>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search restaurants..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-background/20 border-border/50 text-foreground placeholder:text-muted-foreground w-56"
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 bg-background/20 border border-border/50 rounded-lg text-foreground text-sm focus:outline-none focus:border-blue-500/50"
              >
                <option value="qualityScore">Quality Score</option>
                <option value="successRate">Success Rate</option>
                <option value="avgRating">Rating</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Restaurant</TableHead>
                  <TableHead className="text-muted-foreground text-center">Quality Score</TableHead>
                  <TableHead className="text-muted-foreground text-right">Orders</TableHead>
                  <TableHead className="text-muted-foreground text-right">Success Rate</TableHead>
                  <TableHead className="text-muted-foreground text-right">Avg Rating</TableHead>
                  <TableHead className="text-muted-foreground text-right">Reviews</TableHead>
                  <TableHead className="text-muted-foreground text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRestaurants.map((rest) => (
                  <TableRow key={rest.id} className="border-border/50 hover:bg-card/5 transition-colors">
                    <TableCell className="text-foreground font-medium text-sm">{rest.name}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={`${getScoreBg(rest.qualityScore)} ${getScoreColor(rest.qualityScore)} font-mono font-bold text-xs`}>
                        {rest.qualityScore}/100
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right font-mono text-sm">{rest.totalOrders}</TableCell>
                    <TableCell className="text-right">
                      <span className={`font-mono text-sm ${rest.successRate >= 90 ? 'text-emerald-400' : rest.successRate >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {rest.successRate}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-yellow-400 font-mono text-sm">{rest.avgRating > 0 ? `${rest.avgRating} ★` : 'N/A'}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right font-mono text-sm">{rest.totalReviews}</TableCell>
                    <TableCell className="text-center">
                      {rest.flagged ? (
                        <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 text-xs gap-1">
                          <AlertCircle size={10} /> Flagged
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs gap-1">
                          <CheckCircle size={10} /> Good
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
