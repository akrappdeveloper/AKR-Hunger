'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Order, Restaurant, DeliveryPerson } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowLeft,
  Phone,
  MapPin,
  Clock,
  CheckCircle,
  Truck,
  Store,
  User,
  ShoppingBag,
  CreditCard,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  FileText,
  LifeBuoy,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function AdminOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!orderId) return;

    const unsub = onSnapshot(
      doc(db, 'orders', orderId),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = {
            id: docSnap.id,
            ...docSnap.data(),
            createdAt: docSnap.data().createdAt?.toDate
              ? docSnap.data().createdAt.toDate()
              : new Date(docSnap.data().createdAt || Date.now()),
          } as Order;
          setOrder(data);
        } else {
          setOrder(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching order:', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [orderId]);

  const handleUpdateStatus = async (newStatus: string) => {
    if (!orderId) return;
    setUpdating(true);
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      toast.success(`Order status changed to ${newStatus.toUpperCase()}`);
    } catch (err: any) {
      console.error('Status update failed:', err);
      toast.error('Failed: ' + err.message);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400 text-sm">Loading order details...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-8 text-center space-y-4">
        <h2 className="text-xl font-bold text-white">Order Not Found</h2>
        <p className="text-sm text-gray-400">Order #{orderId} does not exist or has been removed.</p>
        <Button onClick={() => router.push('/admin/orders')} variant="outline" className="border-white/10 text-white">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Orders
        </Button>
      </div>
    );
  }

  const items = order.items || [];
  const statusColor =
    order.status === 'delivered'
      ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
      : order.status === 'cancelled'
      ? 'border-red-500/30 text-red-400 bg-red-500/10'
      : 'border-blue-500/30 text-blue-400 bg-blue-500/10';

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/admin/orders')}
            className="border-white/10 text-gray-300 hover:text-white rounded-xl"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              Order #{order.id?.slice(-8).toUpperCase()}
              <Badge variant="outline" className={`text-xs font-bold uppercase ${statusColor}`}>
                {order.status}
              </Badge>
            </h1>
            <p className="text-xs text-gray-400">
              Placed on {order.createdAt ? new Date(order.createdAt).toLocaleString() : 'N/A'}
            </p>
          </div>
        </div>

        {/* Status Override Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/admin/support`}>
            <Button variant="outline" size="sm" className="border-white/10 text-blue-400 rounded-xl text-xs gap-1.5">
              <LifeBuoy className="w-3.5 h-3.5" /> Support Tickets
            </Button>
          </Link>
          {order.status !== 'delivered' && order.status !== 'cancelled' && (
            <>
              <Button
                size="sm"
                onClick={() => handleUpdateStatus('delivered')}
                disabled={updating}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold gap-1"
              >
                <CheckCircle className="w-3.5 h-3.5" /> Mark Delivered
              </Button>
              <Button
                size="sm"
                onClick={() => handleUpdateStatus('cancelled')}
                disabled={updating}
                variant="destructive"
                className="rounded-xl text-xs font-bold gap-1"
              >
                Cancel Order
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Order Items & Financials */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items Card */}
          <Card className="bg-black/40 border-white/5 rounded-2xl">
            <CardHeader className="p-5 border-b border-white/5 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-blue-400" />
                Ordered Items ({items.length})
              </CardTitle>
              <span className="text-xs text-gray-400">Restaurant: {order.restaurantName || 'Kitchen'}</span>
            </CardHeader>
            <CardContent className="p-5 divide-y divide-white/5">
              {items.map((item: any, idx: number) => (
                <div key={idx} className="py-3 flex items-center justify-between first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-white/5 text-gray-300 flex items-center justify-center text-xs font-bold">
                      {item.quantity}x
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-white">{item.name || item.title}</p>
                      {item.selectedOptions && (
                        <p className="text-xs text-gray-400">{JSON.stringify(item.selectedOptions)}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-bold text-gray-200">
                    ₹{((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                  </span>
                </div>
              ))}

              {/* Price Breakdown */}
              <div className="pt-4 mt-4 space-y-2 text-xs text-gray-400">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>₹{(order.subtotal || order.total || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery Fee</span>
                  <span>₹{((order as any).deliveryFee ?? (order as any).delivery ?? 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Taxes &amp; Platform Fee</span>
                  <span>₹{((order as any).tax || 0).toFixed(2)}</span>
                </div>
                {order.discount ? (
                  <div className="flex justify-between text-emerald-400">
                    <span>Discount Coupon</span>
                    <span>-₹{order.discount.toFixed(2)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between pt-2 border-t border-white/10 text-sm font-bold text-white">
                  <span>Total Paid</span>
                  <span className="text-emerald-400">₹{(order.total || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-gray-500 pt-1">
                  <span>Payment Method</span>
                  <span className="uppercase text-gray-300 font-bold">{order.paymentMethod || 'Online / UPI'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Col: Customer & Rider Details */}
        <div className="space-y-6">
          {/* Customer Card */}
          <Card className="bg-black/40 border-white/5 rounded-2xl">
            <CardHeader className="p-5 border-b border-white/5">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                <User className="w-4 h-4 text-blue-400" /> Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-3 text-xs">
              <div>
                <p className="text-gray-400">Name</p>
                <p className="text-sm font-bold text-white mt-0.5">{order.customerName || 'Customer'}</p>
              </div>
              <div>
                <p className="text-gray-400">Contact</p>
                <div className="flex items-center gap-2 mt-1">
                  {order.customerPhone ? (
                    <>
                      <a href={`tel:${order.customerPhone}`}>
                        <Button size="sm" variant="outline" className="border-white/10 text-xs h-7 gap-1">
                          <Phone className="w-3 h-3 text-blue-400" /> {order.customerPhone}
                        </Button>
                      </a>
                      <a
                        href={`https://wa.me/${order.customerPhone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Button size="sm" variant="outline" className="border-emerald-500/30 text-emerald-400 text-xs h-7">
                          WhatsApp
                        </Button>
                      </a>
                    </>
                  ) : (
                    <span className="text-gray-500">No phone attached</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-gray-400">Delivery Address</p>
                <p className="text-xs text-gray-300 mt-1 leading-relaxed flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                  {typeof order.deliveryAddress === 'object' && order.deliveryAddress !== null
                    ? (order.deliveryAddress as any).address || (order.deliveryAddress as any).street || 'Address recorded'
                    : typeof order.deliveryAddress === 'string'
                    ? order.deliveryAddress
                    : 'Address recorded'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Restaurant / Kitchen Card */}
          <Card className="bg-black/40 border-white/5 rounded-2xl">
            <CardHeader className="p-5 border-b border-white/5">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                <Store className="w-4 h-4 text-amber-400" /> Kitchen Fulfillment
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-2 text-xs text-gray-300">
              <p className="font-bold text-sm text-white">{order.restaurantName || 'Restaurant'}</p>
              <p className="text-gray-400">Restaurant ID: #{order.restaurantId?.slice(-6)}</p>
              {(order as any).restaurantPhone && (
                <a href={`tel:${(order as any).restaurantPhone}`}>
                  <Button size="sm" variant="outline" className="border-white/10 text-xs h-7 gap-1 mt-2">
                    <Phone className="w-3 h-3 text-amber-400" /> Call Kitchen
                  </Button>
                </a>
              )}
            </CardContent>
          </Card>

          {/* Delivery Rider Card */}
          <Card className="bg-black/40 border-white/5 rounded-2xl">
            <CardHeader className="p-5 border-b border-white/5">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-400" /> Delivery Dispatch
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-2 text-xs text-gray-300">
              <p className="font-bold text-sm text-white">{order.deliveryPersonName || 'No rider assigned yet'}</p>
              {order.deliveryPersonPhone && (
                <div className="flex items-center gap-2 mt-2">
                  <a href={`tel:${order.deliveryPersonPhone}`}>
                    <Button size="sm" variant="outline" className="border-white/10 text-xs h-7 gap-1">
                      <Phone className="w-3 h-3 text-emerald-400" /> Call Rider
                    </Button>
                  </a>
                </div>
              )}
              {order.deliveryOtp && (
                <div className="mt-3 p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between">
                  <span className="text-[11px] text-blue-300 font-medium">Delivery Verification OTP</span>
                  <span className="font-mono font-black text-sm text-blue-400 tracking-wider">
                    {order.deliveryOtp}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
