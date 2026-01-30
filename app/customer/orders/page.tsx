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
      case 'delivered': return 'bg-green-500/20 text-green-400 border-none';
      case 'out_for_delivery': return 'bg-blue-500/20 text-blue-400 border-none';
      case 'preparing': return 'bg-yellow-500/20 text-yellow-400 border-none';
      case 'confirmed': return 'bg-purple-500/20 text-purple-400 border-none';
      case 'cancelled': return 'bg-red-500/20 text-red-400 border-none';
      default: return 'bg-gray-800 text-gray-400 border-none';
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
      // 1. Create Review Document
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

      // 2. Update MenuItem Stats (Average Rating)
      // Note: In a real app, this should be a Cloud Function or Transaction for safety
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

      // 3. Mark Order Item as rated (optional logic - locally or by updating order)
      // Currently just closing dialog
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
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-24 font-sans selection:bg-orange-500/30">
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-orange-500" />
          </div>
          <h1 className="text-3xl font-bold">Your Orders</h1>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-20 bg-gray-900/50 backdrop-blur-md rounded-3xl border border-white/5">
            <div className="w-20 h-20 bg-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Package className="w-10 h-10 text-gray-500" />
            </div>
            <h3 className="text-xl font-bold mb-2">No orders yet</h3>
            <p className="text-gray-400 mb-8 max-w-sm mx-auto">Looks like you haven't placed any orders yet. Order now to get delicious food delivered!</p>
            <Link href="/customer">
              <Button className="bg-gradient-to-r from-orange-600 to-red-600 rounded-xl px-8 py-6 font-bold text-lg hover:scale-105 transition-transform shadow-lg shadow-orange-900/40">
                Browse Food
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <div key={order.id} className="bg-gray-900/60 backdrop-blur-md border border-white/5 rounded-3xl overflow-hidden hover:border-gray-700 transition-colors group">

                {/* Order Header */}
                <div className="p-6 flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-white/5 bg-white/5">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center flex-shrink-0 border border-white/5">
                      <ChefHat className="w-6 h-6 text-gray-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-white mb-1">{order.restaurantName || 'Restaurant'}</h3>
                      <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
                        <span className="bg-gray-800 px-2 py-0.5 rounded text-gray-300">#{order.id.slice(-6).toUpperCase()}</span>
                        <span>•</span>
                        <span>{formatDate(order.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  <Badge className={`${getStatusColor(order.status || 'pending')} px-3 py-1 text-xs font-bold uppercase tracking-wider`}>
                    {order.status?.replace('_', ' ') || 'PENDING'}
                  </Badge>
                </div>

                {/* Order Items */}
                <div className="p-6 space-y-4">
                  <div className="space-y-3">
                    {order.items?.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center text-xs font-bold text-gray-400 border border-gray-700">
                            {item.quantity}x
                          </span>
                          <div className="flex flex-col">
                            <span className="text-gray-300">{item.name}</span>
                            {order.status === 'delivered' && (
                              <button
                                onClick={() => openRatingDialog(order, { id: item.menuItemId, name: item.name, image: item.image })}
                                className="text-[10px] text-blue-400 hover:text-blue-300 text-left flex items-center gap-1 mt-0.5"
                              >
                                <Star className="w-3 h-3" /> Rate Item
                              </button>
                            )}
                          </div>
                        </div>
                        <span className="text-gray-400 font-medium">₹{item.price * item.quantity}</span>
                      </div>
                    ))}
                  </div>

                  <div className="h-px w-full bg-white/5 my-4" />

                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                      <MapPin className="w-4 h-4" />
                      <span className="capitalize">{typeof order.deliveryAddress === 'string' ? 'Saved Address' : order.deliveryAddress?.type || 'Home'}</span>
                    </div>
                    <div className="text-xl font-bold text-white">
                      Total: <span className="text-orange-500">₹{order.total}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-4 bg-black/40 flex flex-wrap gap-2 justify-end">
                  <InvoiceButton order={order} customer={customer} />

                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-white hover:bg-white/10"
                    onClick={() => handleReorder(order)}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" /> Reorder
                  </Button>

                  {order.status === 'pending' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-400 hover:text-red-500 hover:bg-red-500/10"
                      onClick={() => setCancelOrderData(order)}
                    >
                      <X className="w-4 h-4 mr-2" /> Cancel
                    </Button>
                  )}

                  {['pending', 'confirmed', 'preparing', 'out_for_delivery'].includes(order.status || '') && (
                    <Button
                      size="sm"
                      className="bg-orange-600 hover:bg-orange-700 text-white border-none shadow-lg shadow-orange-900/20 font-bold rounded-lg px-4"
                      onClick={() => router.push(`/customer/orders/${order.id}`)}
                    >
                      Track Order <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Rating Dialog */}
        <Dialog open={!!ratingOrder} onOpenChange={(open) => !open && setRatingOrder(null)}>
          <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                Rate <span className="text-orange-500">{ratingItem?.name}</span>
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col items-center py-6 space-y-6">
              {/* Star Rating */}
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRatingValue(star)}
                    className={`transition-transform hover:scale-110 ${ratingValue >= star ? 'scale-110' : ''}`}
                  >
                    <Star
                      className={`w-10 h-10 ${ratingValue >= star ? 'fill-yellow-500 text-yellow-500' : 'text-gray-700'}`}
                    />
                  </button>
                ))}
              </div>
              <p className="text-lg font-bold text-yellow-500">
                {ratingValue === 5 ? 'Excellent!' : ratingValue === 4 ? 'Good' : ratingValue === 3 ? 'Average' : 'Poor'}
              </p>

              {/* Comment Area */}
              <div className="w-full">
                <label className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2 block">Leave a comment</label>
                <Textarea
                  className="bg-black/50 border-gray-700 text-white"
                  placeholder="Tell us what you liked..."
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                />
              </div>

              <Button
                onClick={submitRating}
                className="w-full bg-white text-black hover:bg-gray-200 font-bold h-12 rounded-xl"
                disabled={submittingRating}
              >
                {submittingRating ? 'Submitting...' : 'Submit Review'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Helper for Cancel Dialog - implemented inline or via new state if preferred, 
            but for succinctness adding a separate component or inline logic is good. 
            Here sticking to simple state-based dialogs for consistency with Ratings. 
        */}
        <CancelOrderDialog
          order={cancelOrderData}
          isOpen={!!cancelOrderData}
          onClose={() => setCancelOrderData(null)}
        />

      </div>
    </div>
  );
}

// Add Cancel Dialog Component
function CancelOrderDialog({ order, isOpen, onClose }: { order: Order | null, isOpen: boolean, onClose: () => void }) {
  const [loading, setLoading] = useState(false);

  if (!order) return null;

  const handleCancel = async () => {
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
      <DialogContent className="bg-gray-900 border-gray-800 text-white w-[90vw] max-w-[400px] rounded-2xl p-6 gap-6">
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl font-bold text-red-500 text-center">Cancel Order?</DialogTitle>
        </DialogHeader>

        <div className="text-center space-y-2">
          <p className="text-gray-300 text-sm sm:text-base">
            Are you sure you want to cancel Order <span className="font-bold text-white">#{order.id.slice(-6).toUpperCase()}</span>?
          </p>
          <p className="text-xs sm:text-sm text-gray-500">
            This action cannot be undone.
          </p>
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-3 mt-2">
          <Button
            variant="ghost"
            onClick={onClose}
            className="flex-1 h-11 sm:h-12 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 text-sm sm:text-base font-medium transition-colors"
          >
            No, Keep Order
          </Button>
          <Button
            onClick={handleCancel}
            disabled={loading}
            className="flex-1 h-11 sm:h-12 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm sm:text-base shadow-lg shadow-red-900/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            {loading ? 'Cancelling...' : 'Yes, Cancel Order'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
