'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, doc, increment, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Order, MenuItem } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, RefreshCw, ChevronRight, Clock, ShoppingBag, MapPin, ChefHat, Star, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useRouter } from 'next/navigation';
import InvoiceButton from './InvoiceButton';
import { toast } from 'sonner';

export default function OrdersPage() {
  const { user, customer } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { addItem } = useCart();

  // Rating State
  const [ratingOrder, setRatingOrder] = useState<Order | null>(null);
  const [ratingItem, setRatingItem] = useState<{ id: string, name: string, image: string } | null>(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [cancelOrderData, setCancelOrderData] = useState<Order | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'orders'),
      where('customerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersList = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date(doc.data().createdAt),
      })) as Order[];

      // Client-side sorting to avoid Firestore Index requirement
      ordersList.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      });

      setOrders(ordersList);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching orders:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleReorder = (order: Order) => {
    if (!order.items) return;
    order.items.forEach(item => {
      addItem({
        menuItemId: item.menuItemId,
        restaurantId: order.restaurantId || '',
        name: item.name,
        price: item.price,
        image: item.image,
        quantity: item.quantity,
        restaurantName: order.restaurantName || 'Unknown Restaurant',
        id: `reorder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        addedAt: new Date()
      });
    });
    router.push('/customer/cart');
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'delivered': return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
      case 'out_for_delivery': return 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/20';
      case 'preparing': return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20';
      case 'confirmed': return 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20';
      case 'cancelled': return 'bg-destructive/15 text-destructive border border-destructive/20';
      default: return 'bg-muted text-muted-foreground border border-border';
    }
  };

  const formatDate = (date: any) => {
    if (!date) return '';
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    }).format(new Date(date));
  };


  const openRatingDialog = (order: Order, item: { id: string, name: string, image: string }) => {
    setRatingOrder(order);
    setRatingItem(item);
    setRatingValue(5);
    setRatingComment('');
  };

  const submitRating = async () => {
    if (!user || !ratingOrder || !ratingItem) return;

    setSubmittingRating(true);
    try {
      await addDoc(collection(db, 'reviews'), {
        customerId: user.uid,
        customerName: user.displayName || 'Customer',
        customerAvatar: user.photoURL || '',
        restaurantId: ratingOrder.restaurantId,
        menuItemId: ratingItem.id,
        menuItemName: ratingItem.name,
        orderId: ratingOrder.id,
        rating: ratingValue,
        comment: ratingComment,
        createdAt: serverTimestamp(),
      });

      const itemRef = doc(db, 'menuItems', ratingItem.id);
      const itemDoc = await getDoc(itemRef);

      if (itemDoc.exists()) {
        const currentData = itemDoc.data();
        const currentTotal = currentData.totalReviews || 0;
        const currentAvg = currentData.averageRating || 0;

        const newTotal = currentTotal + 1;
        const newAvg = ((currentAvg * currentTotal) + ratingValue) / newTotal;

        await updateDoc(itemRef, {
          totalReviews: newTotal,
          averageRating: newAvg
        });
      }

      if (ratingOrder.id) {
        await updateDoc(doc(db, 'orders', ratingOrder.id), {
          [`ratings.${ratingItem.id}`]: {
            rating: ratingValue,
            comment: ratingComment,
            ratedAt: new Date()
          }
        });
      }

      toast.success("Thanks for your feedback!");
      setRatingOrder(null);
      setRatingItem(null);

    } catch (error) {
      console.error("Error submitting rating:", error);
      toast.error("Failed to submit rating");
    } finally {
      setSubmittingRating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-foreground pb-24 md:pb-16 font-sans selection:bg-primary/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6 sm:mb-8">
          <div className="w-11 h-11 rounded-2xl bg-primary/15 flex items-center justify-center text-primary shadow-xs">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">Your Orders</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Track ongoing deliveries and view past orders</p>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-20 bg-card/70 backdrop-blur-md rounded-3xl border border-border/60 shadow-sm">
            <div className="w-20 h-20 bg-muted/60 rounded-full flex items-center justify-center mx-auto mb-6">
              <Package className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold mb-2 text-foreground">No orders yet</h3>
            <p className="text-muted-foreground mb-8 max-w-sm mx-auto text-sm">Looks like you haven't placed any orders yet. Explore top dishes and get quick delivery!</p>
            <Link href="/customer">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-8 py-6 font-bold text-base shadow-lg shadow-primary/20 hover:scale-105 transition-all">
                Browse Food
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-5 sm:space-y-6">
            {orders.map((order) => (
              <div
                key={order.id}
                onClick={() => router.push(`/customer/orders/${order.id}`)}
                className="bg-card border border-border/70 rounded-2xl sm:rounded-3xl overflow-hidden hover:border-primary/50 hover:shadow-lg transition-all duration-300 shadow-xs group cursor-pointer"
              >

                {/* Order Header */}
                <div className="p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-border/60 bg-muted/30 group-hover:bg-muted/40 transition-colors">
                  <div className="flex gap-3 sm:gap-4">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 bg-card rounded-xl flex items-center justify-center flex-shrink-0 border border-border text-primary shadow-xs group-hover:scale-105 transition-transform">
                      <ChefHat className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-base sm:text-lg text-foreground group-hover:text-primary transition-colors mb-0.5">
                          {order.restaurantName || 'Restaurant'}
                        </h3>
                        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                        <span className="bg-muted px-2 py-0.5 rounded text-foreground font-semibold">#{order.id ? order.id.slice(-6).toUpperCase() : 'ORDER'}</span>
                        <span>•</span>
                        <span>{formatDate(order.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  <Badge className={`${getStatusColor(order.status || 'pending')} px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-lg`}>
                    {order.status?.replace('_', ' ') || 'PENDING'}
                  </Badge>
                </div>

                {/* Order Items */}
                <div className="p-4 sm:p-6 space-y-4">
                  <div className="space-y-3">
                    {order.items?.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 bg-muted rounded flex items-center justify-center text-xs font-bold text-foreground border border-border">
                            {item.quantity}x
                          </span>
                          <div className="flex flex-col">
                            <span className="text-foreground font-medium text-xs sm:text-sm">{item.name}</span>
                            {order.status === 'delivered' && (
                              <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                                {(order as any).ratings?.[item.menuItemId] ? (
                                  <div className="flex items-center gap-1 text-amber-500 text-xs font-bold bg-amber-500/10 px-2 py-0.5 rounded-md w-fit">
                                    <Star className="w-3 h-3 fill-amber-500" />
                                    <span>{(order as any).ratings[item.menuItemId].rating}/5</span>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => openRatingDialog(order, { id: item.menuItemId, name: item.name, image: item.image })}
                                    className="text-[11px] text-primary hover:underline text-left flex items-center gap-1 font-semibold"
                                  >
                                    <Star className="w-3 h-3" /> Rate Item
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <span className="text-foreground font-bold text-xs sm:text-sm">₹{item.price * item.quantity}</span>
                      </div>
                    ))}
                  </div>

                  <div className="h-px w-full bg-border/60 my-4" />

                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs sm:text-sm">
                      <MapPin className="w-4 h-4 text-primary" />
                      <span className="capitalize">{typeof order.deliveryAddress === 'string' ? 'Saved Address' : order.deliveryAddress?.type || 'Home'}</span>
                    </div>
                    <div className="text-base sm:text-lg font-black text-foreground">
                      Total: <span className="text-primary font-black">₹{order.total}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div
                  className="p-3.5 sm:p-4 bg-muted/20 border-t border-border/50 flex flex-wrap gap-2 justify-end items-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <InvoiceButton order={order} customer={customer} />

                  <Button
                    variant="outline"
                    size="sm"
                    className="border-border hover:bg-accent text-foreground rounded-xl text-xs sm:text-sm font-semibold"
                    onClick={() => handleReorder(order)}
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Reorder
                  </Button>

                  {order.status === 'pending' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive border-destructive/30 hover:bg-destructive/10 rounded-xl text-xs sm:text-sm font-semibold"
                      onClick={() => setCancelOrderData(order)}
                    >
                      <X className="w-3.5 h-3.5 mr-1.5" /> Cancel
                    </Button>
                  )}

                  {['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(order.status || '') ? (
                    <Button
                      size="sm"
                      className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20 font-bold rounded-xl px-4 text-xs sm:text-sm"
                      onClick={() => router.push(`/customer/orders/${order.id}`)}
                    >
                      Track Live <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="bg-muted hover:bg-muted/80 text-foreground border border-border/80 font-bold rounded-xl px-4 text-xs sm:text-sm"
                      onClick={() => router.push(`/customer/orders/${order.id}`)}
                    >
                      Order Details <ChevronRight className="w-3.5 h-3.5 ml-1 text-primary" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Rating Dialog */}
        <Dialog open={!!ratingOrder} onOpenChange={(open) => !open && setRatingOrder(null)}>
          <DialogContent className="bg-card border-border text-card-foreground sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
                Rate <span className="text-primary">{ratingItem?.name}</span>
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col items-center py-4 space-y-5">
              {/* Star Rating */}
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRatingValue(star)}
                    className={`transition-transform hover:scale-110 ${ratingValue >= star ? 'scale-110' : ''}`}
                    aria-label={`Rate ${star} stars`}
                  >
                    <Star
                      className={`w-9 h-9 sm:w-10 sm:h-10 ${ratingValue >= star ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground/30'}`}
                    />
                  </button>
                ))}
              </div>
              <p className="text-base font-bold text-amber-500">
                {ratingValue === 5 ? 'Excellent! 🌟' : ratingValue === 4 ? 'Good 👍' : ratingValue === 3 ? 'Average 👌' : 'Could be better'}
              </p>

              {/* Comment Area */}
              <div className="w-full">
                <label className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-2 block">Leave a comment</label>
                <Textarea
                  className="bg-muted/40 border-border text-foreground placeholder:text-muted-foreground"
                  placeholder="Tell us what you liked about this dish..."
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                />
              </div>

              <Button
                onClick={submitRating}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-11 rounded-xl shadow-md"
                disabled={submittingRating}
              >
                {submittingRating ? 'Submitting...' : 'Submit Review'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Cancel Dialog */}
        <CancelOrderDialog
          order={cancelOrderData}
          isOpen={!!cancelOrderData}
          onClose={() => setCancelOrderData(null)}
        />

      </div>
    </div>
  );
}

function CancelOrderDialog({ order, isOpen, onClose }: { order: Order | null, isOpen: boolean, onClose: () => void }) {
  const [loading, setLoading] = useState(false);

  if (!order) return null;

  const handleCancel = async () => {
    if (!order.id) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
      });
      toast.success("Order cancelled successfully");
      onClose();
    } catch (error) {
      console.error("Error cancelling order:", error);
      toast.error("Failed to cancel order");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-card border-border text-card-foreground w-[90vw] max-w-[400px] rounded-2xl p-6 gap-5">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-destructive text-center">Cancel Order?</DialogTitle>
        </DialogHeader>

        <div className="text-center space-y-2">
          <p className="text-foreground text-sm sm:text-base">
            Are you sure you want to cancel Order <span className="font-bold text-primary">#{order.id ? order.id.slice(-6).toUpperCase() : 'ORDER'}</span>?
          </p>
          <p className="text-xs text-muted-foreground">
            This action cannot be undone.
          </p>
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-3 mt-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 h-11 rounded-xl border-border text-foreground hover:bg-muted text-sm font-medium transition-colors"
          >
            No, Keep Order
          </Button>
          <Button
            onClick={handleCancel}
            disabled={loading}
            className="flex-1 h-11 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-xl font-bold text-sm shadow-md transition-all active:scale-[0.98]"
          >
            {loading ? 'Cancelling...' : 'Yes, Cancel Order'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
