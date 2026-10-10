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
        <div className="text-muted-foreground text-sm">Loading order details...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-8 text-center space-y-4">
        <h2 className="text-xl font-bold text-foreground">Order Not Found</h2>
        <p className="text-sm text-muted-foreground">Order #{orderId} does not exist or has been removed.</p>
        <Button onClick={() => router.push('/admin/orders')} variant="outline" className="border-border/50 text-foreground">
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
            className="border-border/50 text-muted-foreground hover:text-foreground rounded-xl"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
              Order #{order.id?.slice(-8).toUpperCase()}
              <Badge variant="outline" className={`text-xs font-bold uppercase ${statusColor}`}>
                {order.status}
              </Badge>
            </h1>
            <p className="text-xs text-muted-foreground">
              Placed on {order.createdAt ? new Date(order.createdAt).toLocaleString() : 'N/A'}
            </p>
          </div>
        </div>

        {/* Status Override Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/admin/support`}>
            <Button variant="outline" size="sm" className="border-border/50 text-blue-400 rounded-xl text-xs gap-1.5">
              <LifeBuoy className="w-3.5 h-3.5" /> Support Tickets
            </Button>
          </Link>
          {order.status !== 'delivered' && order.status !== 'cancelled' && (
            <>
              <Button
                size="sm"
                onClick={() => handleUpdateStatus('delivered')}
                disabled={updating}
                className="bg-emerald-600 hover:bg-emerald-700 text-foreground rounded-xl text-xs font-bold gap-1"
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
          <Card className="bg-card border-border/50 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
            <CardHeader className="p-5 border-b border-border/50 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-blue-500" />
                Ordered Items ({items.length})
              </CardTitle>
              <span className="text-xs text-muted-foreground">Restaurant: {order.restaurantName || 'Kitchen'}</span>
            </CardHeader>
            <CardContent className="p-5 divide-y divide-border/50">
              {items.map((item: any, idx: number) => (
                <div key={idx} className="py-3 flex items-center justify-between first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-secondary text-secondary-foreground flex items-center justify-center text-xs font-bold">
                      {item.quantity}x
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.name || item.title}</p>
                      {item.selectedOptions && (
                        <p className="text-xs text-muted-foreground">{JSON.stringify(item.selectedOptions)}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-bold text-foreground">
                    ₹{((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                  </span>
                </div>
              ))}

              {/* Price Breakdown */}
              <div className="pt-4 mt-4 space-y-2 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Subtotal / Taxable Value</span>
                  <span>₹{((order as any).taxableValue || order.subtotal || 0).toFixed(2)}</span>
                </div>
                {(order as any).packagingCharges ? (
                  <div className="flex justify-between">
                    <span>Packaging Charges</span>
                    <span>₹{(order as any).packagingCharges.toFixed(2)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <span>Delivery Charge</span>
                  <span>₹{((order as any).deliveryCharge ?? (order as any).deliveryFee ?? 0).toFixed(2)}</span>
                </div>
                {(order as any).platformFee ? (
                  <div className="flex justify-between">
                    <span>Platform Fee</span>
                    <span>₹{(order as any).platformFee.toFixed(2)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <span>CGST</span>
                  <span>₹{((order as any).cgst || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>SGST</span>
                  <span>₹{((order as any).sgst || 0).toFixed(2)}</span>
                </div>
                {order.discount ? (
                  <div className="flex justify-between text-emerald-500">
                    <span>Discount Coupon</span>
                    <span>-₹{order.discount.toFixed(2)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between pt-2 border-t border-border/50 text-sm font-bold text-foreground">
                  <span>Total Amount</span>
                  <span>₹{(order.total || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-1 font-bold">
                  <span>Amount Paid</span>
                  <span className="text-emerald-500">₹{((order as any).amountPaid || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Balance Due</span>
                  <span className="text-rose-500">₹{((order as any).balanceDue || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[11px] pt-2 border-t border-border/50 mt-2">
                  <span>Payment Status</span>
                  <span className="uppercase text-foreground font-bold">{order.paymentStatus || 'unknown'}</span>
                </div>
                <div className="flex justify-between text-[11px] pt-1">
                  <span>Payment Method</span>
                  <span className="uppercase font-bold">{order.paymentMethod || 'Online / UPI'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Col: Customer & Rider Details */}
        <div className="space-y-6">
          {/* Customer Card */}
          <Card className="bg-card border-border/50 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
            <CardHeader className="p-5 border-b border-border/50">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <User className="w-4 h-4 text-blue-500" /> Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-3 text-xs">
              <div>
                <p className="text-muted-foreground">Name</p>
                <p className="text-sm font-bold text-foreground mt-0.5">{order.customerName || 'Customer'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Contact</p>
                <div className="flex items-center gap-2 mt-1">
                  {order.customerPhone ? (
                    <>
                      <a href={`tel:${order.customerPhone}`}>
                        <Button size="sm" variant="outline" className="border-border/50 text-xs h-7 gap-1">
                          <Phone className="w-3 h-3 text-blue-500" /> {order.customerPhone}
                        </Button>
                      </a>
                      <a
                        href={`https://wa.me/${order.customerPhone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Button size="sm" variant="outline" className="border-emerald-500/30 text-emerald-500 text-xs h-7">
                          WhatsApp
                        </Button>
                      </a>
                    </>
                  ) : (
                    <span className="text-muted-foreground">No phone attached</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-muted-foreground">Delivery Address</p>
                <p className="text-xs text-foreground mt-1 leading-relaxed flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                  {typeof order.deliveryAddress === 'object' && order.deliveryAddress !== null
                    ? (order.deliveryAddress as any).address || (order.deliveryAddress as any).street || 'Address recorded'
                    : typeof order.deliveryAddress === 'string'
                    ? order.deliveryAddress
                    : ((order as any).drop?.address || 'Address recorded')}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Restaurant / Kitchen Card */}
          <Card className="bg-card border-border/50 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
            <CardHeader className="p-5 border-b border-border/50">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <Store className="w-4 h-4 text-amber-500" /> Kitchen Fulfillment
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-2 text-xs text-foreground">
              <p className="font-bold text-sm text-foreground">{order.restaurantName || 'Restaurant'}</p>
              <p className="text-muted-foreground">Restaurant ID: #{order.restaurantId?.slice(-6)}</p>
              <p className="text-muted-foreground mt-2">Address: {(order as any).restaurantAddress || (order as any).pickup?.address || 'N/A'}</p>
              <div className="flex gap-2 mt-3">
                {(order as any).restaurantPhone && (
                  <a href={`tel:${(order as any).restaurantPhone}`}>
                    <Button size="sm" variant="outline" className="border-border/50 text-xs h-7 gap-1">
                      <Phone className="w-3 h-3 text-amber-500" /> Call Kitchen
                    </Button>
                  </a>
                )}
                {order.restaurantId && (
                  <Link href={`/admin/restaurants/${order.restaurantId}`}>
                    <Button size="sm" variant="outline" className="border-border/50 text-xs h-7 gap-1 text-amber-500">
                      <Store className="w-3 h-3" /> View Restaurant
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Delivery Rider Card */}
          <Card className="bg-card border-border/50 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
            <CardHeader className="p-5 border-b border-border/50">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-500" /> Delivery Dispatch
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-3 text-xs text-foreground">
              <div>
                <p className="font-bold text-sm text-foreground">{order.deliveryPersonName || 'No rider assigned yet'}</p>
                {order.deliveryPersonPhone && (
                  <div className="flex items-center gap-2 mt-2">
                    <a href={`tel:${order.deliveryPersonPhone}`}>
                      <Button size="sm" variant="outline" className="border-border/50 text-xs h-7 gap-1">
                        <Phone className="w-3 h-3 text-emerald-500" /> Call Rider
                      </Button>
                    </a>
                  </div>
                )}
              </div>

              <div className="flex justify-between border-t border-border/50 pt-3">
                <span className="text-muted-foreground">Vehicle</span>
                <span className="font-bold text-foreground uppercase">{(order as any).deliveryVehicle || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="font-bold text-emerald-500 uppercase">{(order as any).deliveryStatus || 'N/A'}</span>
              </div>

              {/* Delivery Timelines from order.delivery */}
              {(order as any).delivery && typeof (order as any).delivery === 'object' && (
                <div className="mt-3 space-y-2 border-t border-border/50 pt-3">
                  <p className="font-bold text-muted-foreground text-[10px] uppercase tracking-wider mb-2">Timeline</p>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Assigned</span>
                    <span>{(order as any).delivery.assignedAt?.toDate ? (order as any).delivery.assignedAt.toDate().toLocaleTimeString() : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Arrived at Pickup</span>
                    <span>{(order as any).delivery.arrivedPickupAt?.toDate ? (order as any).delivery.arrivedPickupAt.toDate().toLocaleTimeString() : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Arrived at Drop</span>
                    <span>{(order as any).delivery.arrivedCustomerAt?.toDate ? (order as any).delivery.arrivedCustomerAt.toDate().toLocaleTimeString() : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between font-bold text-emerald-500">
                    <span>Delivered</span>
                    <span>{(order as any).delivery.deliveredAt?.toDate ? (order as any).delivery.deliveredAt.toDate().toLocaleTimeString() : 'N/A'}</span>
                  </div>
                </div>
              )}

              {order.deliveryOtp && (
                <div className="mt-3 p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between">
                  <span className="text-[11px] text-blue-500 font-medium">Delivery Verification OTP</span>
                  <span className="font-mono font-black text-sm text-blue-500 tracking-wider">
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
