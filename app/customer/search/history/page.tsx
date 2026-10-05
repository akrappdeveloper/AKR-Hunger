'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import {
  Clock,
  Trash2,
  Search,
  ArrowLeft,
  Sparkles,
  Flame,
  ArrowUpRight,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  getSearchHistory,
  removeSearchHistoryItem,
  clearAllSearchHistory,
  SearchHistoryItem,
} from '@/lib/search-service';

export default function SearchHistoryPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [history, setHistory] = React.useState<SearchHistoryItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isClearing, setIsClearing] = React.useState(false);

  const loadHistory = React.useCallback(async () => {
    setLoading(true);
    try {
      const items = await getSearchHistory(user?.uid);
      setHistory(items);
    } catch (err) {
      console.error('Failed to load search history:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleRemove = async (item: SearchHistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await removeSearchHistoryItem(item.id, item.query, user?.uid);
      setHistory((prev) => prev.filter((h) => h.id !== item.id));
      toast.success('Removed from search history');
    } catch (err) {
      toast.error('Failed to remove item');
    }
  };

  const handleClearAll = async () => {
    if (history.length === 0) return;
    if (!confirm('Are you sure you want to clear your entire search history?')) return;

    setIsClearing(true);
    try {
      await clearAllSearchHistory(user?.uid);
      setHistory([]);
      toast.success('Search history cleared');
    } catch (err) {
      toast.error('Failed to clear search history');
    } finally {
      setIsClearing(false);
    }
  };

  const handleSelectQuery = (term: string) => {
    router.push(`/customer/search?q=${encodeURIComponent(term)}`);
  };

  const trendingPicks = [
    'Dum Biryani',
    'Woodfired Pizza',
    'Butter Chicken',
    'Cold Brew Coffee',
    'Truffle Burger',
    'Crispy Noodles',
    'Belgian Waffles',
  ];

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return 'Recent';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (_) {
      return 'Recent';
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 selection:bg-primary/20">
      {/* Top Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-b from-primary/10 via-primary/5 to-transparent border-b border-border/50 py-8 sm:py-12">
        <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb Back */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Link
              href="/customer/search"
              className="inline-flex items-center gap-1.5 hover:text-foreground font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Search
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
                  <Clock className="w-5 h-5" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                  Search History
                </h1>
                <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-xs font-bold">
                  {history.length} {history.length === 1 ? 'search' : 'searches'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground max-w-xl">
                Review and manage your past culinary searches. Synchronized securely in real-time.
              </p>
            </div>

            {history.length > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearAll}
                  disabled={isClearing}
                  className="rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5 font-semibold transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                  {isClearing ? 'Clearing...' : 'Clear All History'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="space-y-3 max-w-2xl">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-16 rounded-2xl bg-muted/40 animate-pulse border border-border/40"
              />
            ))}
          </div>
        ) : history.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <AnimatePresence>
              {history.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, delay: index * 0.03 }}
                >
                  <Card
                    onClick={() => handleSelectQuery(item.query)}
                    className="group cursor-pointer rounded-2xl border border-border/70 bg-card hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 relative overflow-hidden"
                  >
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-muted group-hover:bg-primary/10 text-muted-foreground group-hover:text-primary transition-colors flex items-center justify-center flex-shrink-0">
                          <Search className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
                            {item.query}
                          </p>
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTimestamp(item.timestamp)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={(e) => handleRemove(item, e)}
                          title="Remove from history"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all">
                          <ArrowUpRight className="w-4 h-4" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          /* Empty State */
          <div className="max-w-md mx-auto text-center py-12 px-4">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-muted/60 border border-border/60 flex items-center justify-center text-muted-foreground mb-4">
              <Clock className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-1">No search history yet</h3>
            <p className="text-xs sm:text-sm text-muted-foreground mb-6">
              When you search for delicious dishes and restaurants, your queries will appear here for fast access.
            </p>

            <Link href="/customer/search">
              <Button className="rounded-2xl bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20 hover:bg-primary/90">
                <Search className="w-4 h-4 mr-2" /> Start Exploring
              </Button>
            </Link>

            {/* Trending Suggestions */}
            <div className="mt-10 pt-8 border-t border-border/60">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center justify-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-orange-500" /> Popular searches right now
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {trendingPicks.map((term) => (
                  <button
                    key={term}
                    onClick={() => handleSelectQuery(term)}
                    className="text-xs px-3 py-1.5 rounded-full bg-muted/60 hover:bg-primary/10 hover:text-primary border border-border/60 transition-colors font-medium"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
