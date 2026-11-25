'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRestaurantAuth } from '@/context/RestaurantAuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  UtensilsCrossed, Clock, Bell, CheckCircle2, ChevronRight,
  Printer, AlertCircle, ChefHat, Flame, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

interface KDSOrder {
  id: string;
  orderNumber?: string;
  customerName?: string;
  items: {
    name: string;
    quantity: number;
    specialInstructions?: string;
  }[];
  status: 'pending' | 'confirmed' | 'preparing' | 'ready';
  createdAt: any;
  specialInstructions?: string;
  total?: number;
}

export default function KitchenDisplaySystemPage() {
  const { restaurant, user } = useRestaurantAuth();
  const [orders, setOrders] = useState<KDSOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const restaurantId = restaurant?.id || user?.restaurantId || user?.uid;

  useEffect(() => {
    if (!restaurantId) return;

    const q = query(
      collection(db, 'orders'),
      where('restaurantId', '==', restaurantId),
      where('status', 'in', ['pending', 'confirmed', 'preparing', 'ready'])
    );

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
      } as KDSOrder));
      setOrders(list);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsub();
  }, [restaurantId]);

  const handleUpdateStatus = async (orderId: string, nextStatus: 'preparing' | 'ready') => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status: nextStatus });
      toast.success(nextStatus === 'preparing' ? 'Order marked: Preparing in kitchen 🍳' : 'Order marked: Ready for pickup! 🛵');
    } catch {
      toast.error('Failed to update status');
    }
  };

  const newOrders = orders.filter(o => o.status === 'pending' || o.status === 'confirmed');
  const preparingOrders = orders.filter(o => o.status === 'preparing');
  const readyOrders = orders.filter(o => o.status === 'ready');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 space-y-6">
      {/* Top KDS Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-500 flex items-center justify-center">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">Kitchen Display System (KDS)</h1>
            <p className="text-xs text-slate-400">Live order queue for kitchen staff and chefs</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs font-bold py-1 px-3">
            🔔 {newOrders.length} New Orders
          </Badge>
          <Badge className="bg-orange-500/15 text-orange-400 border-orange-500/30 text-xs font-bold py-1 px-3">
            🍳 {preparingOrders.length} Cooking
          </Badge>
          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs font-bold py-1 px-3">
            ✅ {readyOrders.length} Ready
          </Badge>
        </div>
      </div>

      {/* 3-Column Kitchen Board */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Column 1: New / Confirmed */}
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-slate-900 p-3 rounded-2xl border border-slate-800">
            <h2 className="font-black text-sm uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
              1. New Incoming ({newOrders.length})
            </h2>
          </div>

          <div className="space-y-3">
            {newOrders.map(order => (
              <Card key={order.id} className="bg-slate-900 border-amber-500/30 text-slate-100 p-4 space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-sm text-amber-400">#{order.orderNumber || order.id.slice(0, 6)}</span>
                  <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-300">
                    {order.customerName || 'Customer'}
                  </Badge>
                </div>

                <div className="space-y-1.5 py-1 divide-y divide-slate-800">
                  {(order.items || []).map((item, idx) => (
                    <div key={idx} className="pt-1.5 flex items-start justify-between text-sm">
                      <span className="font-bold text-slate-200">
                        <strong className="text-amber-400 mr-2">{item.quantity}x</strong>
                        {item.name}
                      </span>
                    </div>
                  ))}
                </div>

                {order.specialInstructions && (
                  <p className="text-xs text-amber-300/90 bg-amber-500/10 p-2 rounded-lg">
                    ⚠️ Note: {order.specialInstructions}
                  </p>
                )}

                <Button
                  onClick={() => handleUpdateStatus(order.id, 'preparing')}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-black font-black rounded-xl text-xs h-10 gap-2"
                >
                  <Flame className="w-4 h-4" /> Start Cooking
                </Button>
              </Card>
            ))}
          </div>
        </div>

        {/* Column 2: Cooking in Kitchen */}
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-slate-900 p-3 rounded-2xl border border-slate-800">
            <h2 className="font-black text-sm uppercase tracking-wider text-orange-400 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-400 animate-pulse" />
              2. In Preparation ({preparingOrders.length})
            </h2>
          </div>

          <div className="space-y-3">
            {preparingOrders.map(order => (
              <Card key={order.id} className="bg-slate-900 border-orange-500/30 text-slate-100 p-4 space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-sm text-orange-400">#{order.orderNumber || order.id.slice(0, 6)}</span>
                  <Badge className="bg-orange-500/20 text-orange-300 text-[10px]">
                    Cooking
                  </Badge>
                </div>

                <div className="space-y-1.5 py-1 divide-y divide-slate-800">
                  {(order.items || []).map((item, idx) => (
                    <div key={idx} className="pt-1.5 flex items-start justify-between text-sm">
                      <span className="font-bold text-slate-200">
                        <strong className="text-orange-400 mr-2">{item.quantity}x</strong>
                        {item.name}
                      </span>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={() => handleUpdateStatus(order.id, 'ready')}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black rounded-xl text-xs h-10 gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" /> Mark Order Ready
                </Button>
              </Card>
            ))}
          </div>
        </div>

        {/* Column 3: Ready for Pickup */}
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-slate-900 p-3 rounded-2xl border border-slate-800">
            <h2 className="font-black text-sm uppercase tracking-wider text-emerald-400 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              3. Ready for Driver Pickup ({readyOrders.length})
            </h2>
          </div>

          <div className="space-y-3">
            {readyOrders.map(order => (
              <Card key={order.id} className="bg-slate-900 border-emerald-500/30 text-slate-100 p-4 space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-sm text-emerald-400">#{order.orderNumber || order.id.slice(0, 6)}</span>
                  <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px]">
                    Waiting for Rider
                  </Badge>
                </div>

                <p className="text-xs text-slate-400">
                  Food packed and placed at restaurant dispatch counter.
                </p>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
