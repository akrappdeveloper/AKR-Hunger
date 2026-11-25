'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { Order, Restaurant, CartItem } from '@/lib/types';
import { checkRestaurantOperatingStatus } from '@/lib/restaurant-schedule';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import FullscreenToggle from '@/components/customer/FullscreenToggle';
import {
  ArrowLeft, RotateCcw, ShoppingCart, Store, Clock, Package,
  ChevronRight, Plus, Search, Check, AlertCircle, Sparkles,
  Calendar, Receipt, FileText, ArrowUpRight, Flame, Heart
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface FrequentItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  image: string;
  restaurantId: string;
  restaurantName: string;
  count: number;
}

export default function ReorderPage() {
  const { user, loading: authLoading } = useAuth();
  const { addItem, clearCart, restaurantId: cartRestaurantId, items: currentCartItems } = useCart();

  const [orders, setOrders] = useState<Order[]>([]);
  const [restaurants, setRestaurants] = useState<Map<string, Restaurant>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [reorderedOrderIds, setReorderedOrderIds] = useState<Set<string>>(new Set());
  const [reorderedItemKeys, setReorderedItemKeys] = useState<Set<string>>(new Set());

  // Listen to restaurants for live open/closed status & branding
  useEffect(() => {
    const unsubR = onSnapshot(collection(db, 'restaurants'), snap => {
      const map = new Map<string, Restaurant>();
      snap.docs.forEach(doc => {
        map.set(doc.id, { id: doc.id, ...doc.data() } as Restaurant);
      });
      setRestaurants(map);
    });
    return () => unsubR();
  }, []);

  // Listen to real customer orders from Firestore (Safe query without index failure)
  useEffect(() => {
    if (authLoading) return;
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const ordersRef = collection(db, 'orders');
    // Resilient single-field where query avoids composite index requirements!
    const q = query(ordersRef, where('customerId', '==', user.uid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now()),
          } as Order;
        });

        // Client-side sort by newest date
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setOrders(list);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching customer orders:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, authLoading]);

  // Aggregate Frequently Reordered Dishes across past orders
  const frequentItems: FrequentItem[] = useMemo(() => {
    const itemMap = new Map<string, FrequentItem>();

    orders.forEach(order => {
      (order.items || []).forEach(item => {
        const key = item.menuItemId || item.name;
        if (!key) return;

        if (itemMap.has(key)) {
          const existing = itemMap.get(key)!;
          existing.count += (item.quantity || 1);
        } else {
          itemMap.set(key, {
            id: key,
            menuItemId: item.menuItemId || key,
            name: item.name,
            price: item.price || 0,
            image: item.image || '',
            restaurantId: order.restaurantId || '',
            restaurantName: order.restaurantName || 'Restaurant',
            count: item.quantity || 1,
          });
        }
      });
    });

    return Array.from(itemMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [orders]);

  // Filtered orders by search query
  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return orders;
    const q = searchQuery.toLowerCase();
    return orders.filter(order => {
      const matchRest = order.restaurantName?.toLowerCase().includes(q);
      const matchItem = (order.items || []).some(item => item.name?.toLowerCase().includes(q));
      return matchRest || matchItem;
    });
  }, [orders, searchQuery]);

  // 1-Click Reorder an individual item
  const handleReorderSingleItem = (item: any, restaurantId: string, restaurantName: string) => {
    // If cart has items from a different restaurant, warn and prompt
    if (cartRestaurantId && cartRestaurantId !== restaurantId && currentCartItems.length > 0) {
      if (confirm(`Your cart has items from another restaurant. Clear cart and add "${item.name}" from ${restaurantName}?`)) {
        clearCart();
      } else {
        return;
      }
    }

    const cartItem: CartItem = {
      id: `${item.menuItemId || item.name}-${Date.now()}`,
      menuItemId: item.menuItemId || item.name,
      restaurantId: restaurantId,
      name: item.name,
      price: item.price,
      quantity: 1,
      image: item.image || '',
      restaurantName: restaurantName,
      addedAt: new Date(),
    };

    addItem(cartItem);
    const key = `${item.menuItemId || item.name}-${restaurantId}`;
    setReorderedItemKeys(prev => new Set(prev).add(key));
    toast.success(`Added "${item.name}" to cart! 🍽️`);
    setTimeout(() => {
      setReorderedItemKeys(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, 2000);
  };

  // 1-Click Reorder an entire past order
  const handleReorderFullOrder = (order: Order) => {
    if (!order.items || order.items.length === 0) {
      toast.error('No items to reorder in this order');
      return;
    }

    // Check restaurant operating status
    const rest = restaurants.get(order.restaurantId || '');
    if (rest) {
      const status = checkRestaurantOperatingStatus(rest, new Date());
      if (!status.isOpen) {
        toast.error(`"${order.restaurantName}" is currently closed (${status.reason}). You can still reorder when they reopen!`);
        return;
      }
    }

    // Cart restaurant conflict check
    if (cartRestaurantId && cartRestaurantId !== order.restaurantId && currentCartItems.length > 0) {
      if (confirm(`Your cart has items from another restaurant. Clear current cart to reorder from ${order.restaurantName}?`)) {
        clearCart();
      } else {
        return;
      }
    }

    order.items.forEach((item: any) => {
      addItem({
        id: `${item.menuItemId || item.name}-${Date.now()}-${Math.random()}`,
        menuItemId: item.menuItemId || item.name,
        restaurantId: order.restaurantId || '',
        name: item.name,
        price: item.price,
        quantity: item.quantity || 1,
        image: item.image || '',
        restaurantName: order.restaurantName || 'Restaurant',
        addedAt: new Date(),
      });
    });

    setReorderedOrderIds(prev => new Set(prev).add(order.id!));
    toast.success(`Added all ${order.items.length} items from "${order.restaurantName}" to cart! 🚀`);
    setTimeout(() => {
      setReorderedOrderIds(prev => {
        const next = new Set(prev);
        next.delete(order.id!);
        return next;
      });
    }, 2500);
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* Full-width Sticky Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/70 px-4 sm:px-6 lg:px-8 py-3.5 shadow-xs">
        <div className="w-full max-w-[1700px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          <div className="flex items-center gap-3">
            <Link href="/customer">
              <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-black flex items-center gap-2 tracking-tight">
                <RotateCcw className="w-6 h-6 text-primary" />
                Quick Reorder Hub
              </h1>
              <p className="text-xs text-muted-foreground">
                One-tap reordering of your past meals, favorites &amp; comfort dishes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Search past orders */}
            {user && (
              <div className="relative w-48 sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search past meals or places..."
                  className="pl-8 py-1.5 h-9 text-xs rounded-xl bg-card border-border"
                />
              </div>
            )}
            <FullscreenToggle className="border border-border/80 rounded-xl" showText={false} />
          </div>

        </div>
      </div>

      {/* Main Container */}
      <div className="w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6">
        
        {/* Loading Spinner */}
        {loading ? (
          <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-4">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-semibold text-muted-foreground">Syncing your order history...</p>
          </div>
        ) : !user ? (
          /* Guest / Logged-out State */
          <div className="py-16 text-center max-w-lg mx-auto bg-card rounded-3xl border border-dashed border-border/80 p-8 space-y-5 shadow-lg">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-primary">
              <RotateCcw className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-foreground">Sign In to Order Again</h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Log in to see your past orders, favorite dishes, and repeat your favorite meals with a single click.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3">
              <Link href="/customer/login">
                <Button size="lg" className="rounded-2xl px-6 font-bold shadow-lg shadow-primary/25">
                  Sign In to Hunger
                </Button>
              </Link>
              <Link href="/customer">
                <Button variant="outline" size="lg" className="rounded-2xl font-bold">
                  Explore Restaurants
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          /* Authenticated Reorder Experience */
          <div className="space-y-8">
            
            {/* Top Quick Stats Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <Card className="p-4 rounded-2xl border border-border/70 flex items-center gap-3 bg-card">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                  📦
                </div>
                <div>
                  <span className="text-xs text-muted-foreground font-semibold block">Total Orders</span>
                  <span className="text-lg font-black text-foreground">{orders.length}</span>
                </div>
              </Card>

              <Card className="p-4 rounded-2xl border border-border/70 flex items-center gap-3 bg-card">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 font-bold">
                  ✅
                </div>
                <div>
                  <span className="text-xs text-muted-foreground font-semibold block">Delivered</span>
                  <span className="text-lg font-black text-emerald-600">
                    {orders.filter(o => o.status === 'delivered').length}
                  </span>
                </div>
              </Card>

              <Card className="p-4 rounded-2xl border border-border/70 flex items-center gap-3 bg-card">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 font-bold">
                  ⭐
                </div>
                <div>
                  <span className="text-xs text-muted-foreground font-semibold block">Top Dishes</span>
                  <span className="text-lg font-black text-foreground">{frequentItems.length}</span>
                </div>
              </Card>

              <Card className="p-4 rounded-2xl border border-border/70 flex items-center gap-3 bg-card">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 font-bold">
                  ⚡
                </div>
                <div>
                  <span className="text-xs text-muted-foreground font-semibold block">1-Tap Reorder</span>
                  <span className="text-lg font-black text-purple-600">Enabled</span>
                </div>
              </Card>
            </div>

            {/* Main Split Layout: Left Frequently Ordered Dishes, Right Past Orders */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Left Column: Frequently Reordered Shelf (5 cols on lg) */}
              {frequentItems.length > 0 && (
                <div className="lg:col-span-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-black flex items-center gap-2 text-foreground">
                      <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
                      Your Most-Ordered Dishes
                    </h2>
                    <span className="text-xs text-muted-foreground font-semibold">
                      Frequently Ordered
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3.5">
                    {frequentItems.map(item => {
                      const itemKey = `${item.menuItemId}-${item.restaurantId}`;
                      const isAdded = reorderedItemKeys.has(itemKey);

                      return (
                        <Card
                          key={item.id}
                          className="p-3.5 rounded-2xl border border-border/70 hover:border-primary/50 transition-all flex items-center justify-between gap-3 bg-card shadow-xs hover:shadow-md"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-14 h-14 rounded-xl bg-muted overflow-hidden flex-shrink-0 relative">
                              <img
                                src={item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500'}
                                alt={item.name}
                                className="w-full h-full object-cover"
                                onError={(e: any) => {
                                  e.currentTarget.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500';
                                }}
                              />
                              <Badge className="absolute bottom-0 right-0 rounded-tl-lg rounded-br-none bg-black/80 text-white text-[9px] px-1 py-0 font-mono">
                                {item.count}x
                              </Badge>
                            </div>

                            <div className="min-w-0">
                              <h4 className="font-bold text-sm text-foreground truncate">
                                {item.name}
                              </h4>
                              <p className="text-xs text-muted-foreground truncate">
                                {item.restaurantName}
                              </p>
                              <span className="text-xs font-black text-primary font-mono block mt-0.5">
                                ₹{item.price}
                              </span>
                            </div>
                          </div>

                          <Button
                            size="sm"
                            variant={isAdded ? "outline" : "default"}
                            onClick={() => handleReorderSingleItem(item, item.restaurantId, item.restaurantName)}
                            className={`rounded-xl text-xs font-bold gap-1 h-9 px-3 flex-shrink-0 ${
                              isAdded
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                            }`}
                          >
                            {isAdded ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                            {isAdded ? 'Added' : 'Add'}
                          </Button>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Right Column: Order History Receipts & Full Reorder Cards (7-12 cols on lg) */}
              <div className={`${frequentItems.length > 0 ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-4`}>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-black flex items-center gap-2 text-foreground">
                    <Receipt className="w-5 h-5 text-primary" />
                    Past Orders &amp; Full Meal Reorders
                  </h2>
                  <span className="text-xs text-muted-foreground font-semibold">
                    {filteredOrders.length} orders
                  </span>
                </div>

                {filteredOrders.length === 0 ? (
                  <div className="text-center py-16 bg-card rounded-3xl border border-dashed border-border/80 p-8 space-y-3">
                    <Package className="w-12 h-12 mx-auto text-muted-foreground" />
                    <h3 className="font-bold text-foreground">No matching past orders</h3>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      {searchQuery ? 'No past orders matched your search query.' : 'You haven’t completed any deliveries yet. Delicious food awaits!'}
                    </p>
                    <Link href="/customer">
                      <Button className="mt-2 rounded-xl" size="sm">Browse Restaurants</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredOrders.map((order, i) => {
                      const rest = restaurants.get(order.restaurantId || '');
                      const operating = rest ? checkRestaurantOperatingStatus(rest, new Date()) : { isOpen: true, reason: 'Open' };
                      const isOrderReordered = reorderedOrderIds.has(order.id!);
                      const dateDisplay = order.createdAt ? new Date(order.createdAt).toLocaleDateString(undefined, {
                        month: 'short', day: 'numeric', year: 'numeric'
                      }) : 'Recently';

                      return (
                        <motion.div
                          key={order.id}
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(i * 0.04, 0.3) }}
                        >
                          <Card className="p-4 sm:p-5 rounded-3xl border border-border/70 hover:border-primary/50 transition-all shadow-xs hover:shadow-md bg-card space-y-4">
                            
                            {/* Card Top: Restaurant Brand, Status, and Date */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
                                  <Store className="w-6 h-6" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-black text-base text-foreground">
                                      {order.restaurantName || 'Restaurant'}
                                    </h3>
                                    {operating.isOpen ? (
                                      <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px] font-bold">
                                        Open Now
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-muted-foreground text-[10px]">
                                        Closed
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                                    <Calendar className="w-3 h-3" /> {dateDisplay}
                                    <span>•</span>
                                    <span>Order #{order.orderNumber || order.id?.slice(-6).toUpperCase()}</span>
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 self-start sm:self-auto">
                                <Badge
                                  className={`text-xs font-bold capitalize ${
                                    order.status === 'delivered'
                                      ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                                      : 'bg-primary/15 text-primary border-primary/30'
                                  }`}
                                >
                                  {order.status || 'Delivered'}
                                </Badge>
                                <Link href={`/customer/orders/${order.id}`}>
                                  <Button variant="ghost" size="sm" className="rounded-xl h-8 px-2 text-xs font-bold text-muted-foreground hover:text-foreground">
                                    Details <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
                                  </Button>
                                </Link>
                              </div>
                            </div>

                            {/* Card Middle: Items Breakdown with Single-Item Re-add */}
                            <div className="space-y-2 py-1">
                              {(order.items || []).map((item: any, idx: number) => {
                                const itemKey = `${item.menuItemId || item.name}-${order.restaurantId}`;
                                const isItemAdded = reorderedItemKeys.has(itemKey);

                                return (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between text-xs sm:text-sm py-1 border-b border-border/30 last:border-0"
                                  >
                                    <div className="flex items-center gap-2 min-w-0 pr-2">
                                      <span className="font-bold text-primary font-mono">{item.quantity}x</span>
                                      <span className="font-semibold text-foreground truncate">{item.name}</span>
                                    </div>
                                    <div className="flex items-center gap-3 flex-shrink-0">
                                      <span className="text-muted-foreground font-mono font-semibold">
                                        ₹{(item.price || 0) * (item.quantity || 1)}
                                      </span>
                                      <button
                                        onClick={() => handleReorderSingleItem(item, order.restaurantId || '', order.restaurantName || '')}
                                        title="Add only this item to cart"
                                        className="w-6 h-6 rounded-full bg-muted/60 hover:bg-primary/10 hover:text-primary flex items-center justify-center transition-colors"
                                      >
                                        {isItemAdded ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Plus className="w-3.5 h-3.5" />}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Card Bottom: Total & 1-Click Reorder All Button */}
                            <div className="flex items-center justify-between pt-3 border-t border-border/60">
                              <div>
                                <span className="text-xs text-muted-foreground block">Order Total</span>
                                <span className="text-base sm:text-lg font-black text-foreground font-mono">
                                  ₹{order.total || order.amountPaid || 0}
                                </span>
                              </div>

                              <Button
                                size="sm"
                                onClick={() => handleReorderFullOrder(order)}
                                className={`rounded-xl font-bold gap-1.5 px-4 shadow-md transition-all ${
                                  isOrderReordered
                                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                    : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                                }`}
                              >
                                {isOrderReordered ? (
                                  <>
                                    <Check className="w-4 h-4" /> Reordered to Cart
                                  </>
                                ) : (
                                  <>
                                    <RotateCcw className="w-4 h-4" /> Reorder Full Meal
                                  </>
                                )}
                              </Button>
                            </div>

                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
