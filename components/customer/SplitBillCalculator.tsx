'use client';

import React, { useState, useEffect } from 'react';
import {
  Users, Plus, Trash2, Share2, IndianRupee, Split,
  Calculator, Check, QrCode, ShoppingCart, ArrowRight,
  Sparkles, Copy, MessageCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, addDoc, Timestamp } from 'firebase/firestore';
import { Order } from '@/lib/types';
import Link from 'next/link';
import { toast } from 'sonner';

interface FriendShare {
  id: string;
  name: string;
  customAmount?: number;
}

export default function SplitBillCalculator() {
  const { user } = useAuth();
  const { total: cartTotal, items: cartItems } = useCart();

  const [totalBill, setTotalBill] = useState<number>(cartTotal > 0 ? Math.round(cartTotal) : 850);
  const [tipPercentage, setTipPercentage] = useState<number>(5);
  const [friends, setFriends] = useState<FriendShare[]>([
    { id: '1', name: 'You' },
    { id: '2', name: 'Rahul' },
    { id: '3', name: 'Sneha' },
  ]);
  const [newFriendName, setNewFriendName] = useState('');
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [savedSplitId, setSavedSplitId] = useState<string | null>(null);

  // Sync recent delivered orders from Firestore to easily pull bill
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, 'orders'), where('customerId', '==', user.uid));
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRecentOrders(list.slice(0, 5));
    });
    return () => unsub();
  }, [user]);

  const tipAmount = Math.round((totalBill * tipPercentage) / 100);
  const grandTotal = totalBill + tipAmount;
  const perPersonShare = friends.length > 0 ? Math.round(grandTotal / friends.length) : 0;

  const handleAddFriend = () => {
    if (!newFriendName.trim()) return;
    setFriends(prev => [...prev, { id: Date.now().toString(), name: newFriendName.trim() }]);
    setNewFriendName('');
  };

  const handleRemoveFriend = (id: string) => {
    if (friends.length <= 1) {
      toast.error('At least one person is required to split');
      return;
    }
    setFriends(prev => prev.filter(f => f.id !== id));
  };

  // Save bill split to Firestore
  const handleSaveBillSplit = async () => {
    if (!user) {
      toast.error('Please log in to save and share split records');
      return;
    }

    try {
      const docRef = await addDoc(collection(db, 'customers', user.uid, 'splitBills'), {
        totalBill,
        tipAmount,
        grandTotal,
        friendsCount: friends.length,
        perPersonShare,
        friendsList: friends.map(f => f.name),
        createdAt: Timestamp.now(),
      });
      setSavedSplitId(docRef.id);
      toast.success('Split bill saved to your account!');
    } catch (err: any) {
      console.error('Error saving split bill:', err);
      toast.error('Failed to save split bill');
    }
  };

  const handleShareWhatsApp = () => {
    const friendNames = friends.map(f => f.name).join(', ');
    const text = encodeURIComponent(
      `🍕 Hunger Group Order Bill Split!\n\n` +
      `Food Bill: ₹${totalBill}\n` +
      `Tip (${tipPercentage}%): ₹${tipAmount}\n` +
      `Grand Total: ₹${grandTotal}\n` +
      `Split Between: ${friends.length} people (${friendNames})\n\n` +
      `👉 Each Person Pays: ₹${perPersonShare}\n\n` +
      `Pay your share via UPI or Hunger Wallet: https://shunger.vercel.app/customer`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  return (
    <div className="w-full space-y-8">
      {/* Top Banner & Cart Auto-Pull */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-5 sm:p-6 rounded-3xl border border-border/70 shadow-sm">
        <div>
          <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-bold mb-1">
            <Calculator className="w-3.5 h-3.5 mr-1" />
            Fair Split Engine
          </Badge>
          <h2 className="text-xl sm:text-2xl font-black text-foreground">Party &amp; Hostel Bill Splitter</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Divide group meals evenly, calculate tips, and send instant WhatsApp requests with UPI payment links
          </p>
        </div>

        {cartTotal > 0 && (
          <Button
            size="sm"
            onClick={() => setTotalBill(Math.round(cartTotal))}
            className="rounded-xl font-bold bg-primary text-primary-foreground text-xs gap-1.5 self-start sm:self-auto shrink-0 shadow-md"
          >
            <ShoppingCart className="w-3.5 h-3.5" /> Pull Cart Bill (₹{Math.round(cartTotal)})
          </Button>
        )}
      </div>

      {/* Main Split Layout: Inputs on Left, Visual Share Cards on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Bill Inputs & Friends (6 cols) */}
        <div className="lg:col-span-6 space-y-6">
          <Card className="p-6 rounded-3xl border border-border/70 shadow-md space-y-5 bg-card">
            <h3 className="font-black text-base flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-primary" />
              Order Amount &amp; Tip
            </h3>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Order Total (₹)</label>
              <div className="relative mt-1.5">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-black text-lg">₹</span>
                <Input
                  type="number"
                  value={totalBill}
                  onChange={e => setTotalBill(Math.max(0, Number(e.target.value) || 0))}
                  className="pl-9 text-xl font-black rounded-2xl h-12"
                  placeholder="Enter total bill amount"
                />
              </div>
            </div>

            {/* Quick Fill from Recent Orders */}
            {recentOrders.length > 0 && (
              <div>
                <span className="text-[11px] font-bold text-muted-foreground block mb-2">Or select from recent orders:</span>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {recentOrders.map(order => (
                    <button
                      key={order.id}
                      onClick={() => setTotalBill(Math.round(order.total || 0))}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold border border-border bg-muted/30 hover:border-primary/50 whitespace-nowrap transition-colors"
                    >
                      {order.restaurantName?.slice(0, 15)} (₹{Math.round(order.total || 0)})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tip Selector */}
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Delivery Partner Tip</label>
              <div className="grid grid-cols-4 gap-2 mt-1.5">
                {[0, 5, 10, 15].map(tip => (
                  <button
                    key={tip}
                    onClick={() => setTipPercentage(tip)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      tipPercentage === tip
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-muted/30 border-border hover:border-primary/40'
                    }`}
                  >
                    {tip === 0 ? 'No Tip' : `${tip}% (₹${Math.round((totalBill * tip) / 100)})`}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* Friends Management Card */}
          <Card className="p-6 rounded-3xl border border-border/70 shadow-md space-y-4 bg-card">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Friends in this Order ({friends.length})
              </h3>
              <Badge variant="secondary" className="text-xs font-mono">
                ₹{perPersonShare} / person
              </Badge>
            </div>

            <div className="flex gap-2">
              <Input
                value={newFriendName}
                onChange={e => setNewFriendName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddFriend()}
                placeholder="Enter friend's name (e.g. Priya)"
                className="rounded-xl text-sm"
              />
              <Button onClick={handleAddFriend} className="rounded-xl font-bold px-4 gap-1">
                <Plus className="w-4 h-4" /> Add
              </Button>
            </div>

            <div className="space-y-2 pt-2 max-h-60 overflow-y-auto pr-1">
              {friends.map((friend, idx) => (
                <div
                  key={friend.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 border border-border/60"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-xs">
                      {idx + 1}
                    </div>
                    <span className="font-bold text-sm text-foreground">{friend.name}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-primary font-mono">₹{perPersonShare}</span>
                    {friends.length > 1 && (
                      <button
                        onClick={() => handleRemoveFriend(friend.id)}
                        className="p-1 rounded-lg text-muted-foreground hover:text-rose-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Column: Split Result & WhatsApp Share Cards (6 cols) */}
        <div className="lg:col-span-6 space-y-6">
          <Card className="p-6 sm:p-8 rounded-3xl border-2 border-primary/30 bg-gradient-to-br from-card via-card to-primary/5 shadow-xl text-center space-y-6">
            <span className="text-5xl">🍕</span>
            <div>
              <span className="text-xs uppercase font-black text-muted-foreground tracking-wider block">
                Each Person&apos;s Exact Share
              </span>
              <div className="text-5xl sm:text-6xl font-black text-primary font-mono mt-1">
                ₹{perPersonShare}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Grand total ₹{grandTotal} (Food ₹{totalBill} + Tip ₹{tipAmount}) split among {friends.length} people
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                onClick={handleShareWhatsApp}
                size="lg"
                className="rounded-2xl font-black bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-lg shadow-emerald-600/25 h-12"
              >
                <MessageCircle className="w-4 h-4" /> Share on WhatsApp
              </Button>

              <Button
                onClick={handleSaveBillSplit}
                size="lg"
                variant="outline"
                className="rounded-2xl font-bold gap-2 h-12"
              >
                <Check className="w-4 h-4 text-primary" /> Save Split Record
              </Button>
            </div>

            {/* Direct UPI Payment Request String */}
            <div className="p-4 rounded-2xl bg-muted/40 border border-border/70 text-left space-y-2">
              <span className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-primary" /> UPI Payment Direct Note:
              </span>
              <p className="text-xs font-mono text-foreground select-all bg-card p-2 rounded-xl border border-border">
                Please UPI ₹{perPersonShare} for today&apos;s food order at Hunger.
              </p>
            </div>
          </Card>
        </div>

      </div>
    </div>
  );
}
