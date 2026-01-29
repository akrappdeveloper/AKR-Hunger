'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, addDoc, collection, updateDoc, Timestamp, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { loadRazorpayScript } from '@/lib/razorpay';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { Restaurant, Order, OrderItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Trash2, Plus, Minus, CreditCard, Wallet, MapPin, ChefHat, ShoppingBag, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function CartPage() {
  const router = useRouter();
  const { user, customer } = useAuth();
  const { items, restaurantId, removeItem, updateQuantity, getSubtotal, clearCart } = useCart();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Checkout State
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'online'>('cod');
  const [razorpayKeyId, setRazorpayKeyId] = useState<string>('');

  // Fetch restaurant details
  useEffect(() => {
    if (restaurantId) {
      const fetchRestaurant = async () => {
        try {
          const configRes = await fetch('/api/payment/config');
          const config = await configRes.json();
          setRazorpayKeyId(config.razorpayKeyId);

          const restaurantDoc = await getDoc(doc(db, 'restaurants', restaurantId));
          if (restaurantDoc.exists()) {
            setRestaurant({ ...restaurantDoc.data(), id: restaurantDoc.id } as Restaurant);
          }
        } catch (error) {
          console.error('Error fetching data:', error);
        }
      };
      fetchRestaurant();
      loadRazorpayScript();
    }
  }, [restaurantId]);

  // Real-time Address Sync
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'customers', user.uid), (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data() as any;
        if (data.addresses && data.addresses.length > 0) {
          setSelectedAddress(prev => {
            // Keep existing selection if valid, else default to first/default
            const exists = data.addresses.find((a: any) => a.id === prev);
            return exists ? prev : (data.addresses.find((a: any) => a.isDefault)?.id || data.addresses[0].id);
          });
        } else {
          setSelectedAddress(null);
        }
        setRealtimeCustomer(data);
      }
    });
    return () => unsubscribe();
  }, [user]);

  const [realtimeCustomer, setRealtimeCustomer] = useState<any>(customer);

  useEffect(() => {
    if (user && !realtimeCustomer) setRealtimeCustomer(customer);
  }, [customer, user]);

  const subtotal = getSubtotal();
  const deliveryCharge = restaurant?.deliveryCharge || 40;
  const taxes = Math.round(subtotal * 0.05);
  const total = subtotal + deliveryCharge + taxes;

  const handlePlaceOrder = async () => {
    if (!user || !restaurantId) return;
    if (items.length === 0) return toast.error('Cart is empty');

    if (!selectedAddress || !realtimeCustomer?.addresses || realtimeCustomer.addresses.length === 0) {
      toast.error('Please add a delivery address first!');
      router.push('/customer/profile');
      return;
    }

    setLoading(true);

    try {
      const deliveryAddress = realtimeCustomer.addresses.find((a: any) => a.id === selectedAddress) || realtimeCustomer.addresses[0];

      const orderItems: OrderItem[] = items.map((item) => ({
        menuItemId: item.menuItemId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image,
        specialInstructions: item.specialInstructions || specialInstructions,
      }));

      const orderData: Order = {
        id: '',
        customerId: user.uid,
        restaurantId,
        items: orderItems,
        deliveryAddress,
        status: 'pending',
        paymentMethod,
        paymentStatus: 'pending',
        subtotal,
        deliveryCharge,
        taxes,
        total,
        createdAt: new Date(),
        updatedAt: new Date(),
        customerName: realtimeCustomer?.name || 'Guest',
        customerPhone: realtimeCustomer?.phone || '',
        restaurantName: restaurant?.name || 'Unknown Restaurant'
      };

      const docRef = await addDoc(collection(db, 'orders'), {
        ...orderData,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      if (paymentMethod === 'cod') {
        toast.success('Order placed successfully!');
        clearCart();
        router.push(`/customer/orders/${docRef.id}`);
      } else {
        await handleOnlinePayment(docRef.id, total);
      }

    } catch (error: any) {
      console.error('Order placement failed:', error);
      toast.error('Failed to place order: ' + error.message);
      setLoading(false);
    }
  };

  const handleOnlinePayment = async (orderId: string, amount: number) => {
    try {
      const res = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Math.round(amount * 100),
          orderId,
          customerName: realtimeCustomer?.name,
          customerEmail: user?.email,
          customerPhone: realtimeCustomer?.phone
        }),
      });

      if (!res.ok) throw new Error('Failed to init payment');
      const { razorpayOrderId } = await res.json();

      await updateDoc(doc(db, 'orders', orderId), { razorpayOrderId });

      const options = {
        key: razorpayKeyId || 'rzp_test_YOUR_KEY_HERE', // Fallback for dev if fetch failed
        order_id: razorpayOrderId,
        amount: Math.round(amount * 100),
        currency: 'INR',
        name: 'AKR Hunger',
        description: `Order #${orderId}`,
        handler: async (response: any) => {
          const verifyRes = await fetch('/api/payment/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            }),
          });

          if (verifyRes.ok) {
            await updateDoc(doc(db, 'orders', orderId), {
              paymentStatus: 'completed',
              status: 'confirmed',
              razorpayPaymentId: response.razorpay_payment_id,
              updatedAt: Timestamp.now()
            });
            clearCart();
            toast.success('Payment successful!');
            router.push(`/customer/orders/${orderId}`);
          } else {
            toast.error('Payment verification failed');
            setLoading(false);
          }
        },
        prefill: {
          name: realtimeCustomer?.name,
          email: user?.email,
          contact: realtimeCustomer?.phone,
        },
        theme: { color: '#F97316' },
        modal: {
          ondismiss: () => {
            setLoading(false);
            toast.info('Payment cancelled');
            router.push(`/customer/orders/${orderId}`);
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();

    } catch (err) {
      console.error('Payment Error:', err);
      toast.error('Online payment initialization failed.');
      setLoading(false);
    }
  };

  if (!user) return null; // Or loader

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center max-w-md space-y-6">
          <div className="w-24 h-24 bg-gray-900 rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-orange-500/10">
            <ShoppingBag className="w-10 h-10 text-orange-500" />
          </div>
          <h2 className="text-3xl font-bold text-white">Your Cart is Empty</h2>
          <p className="text-gray-400">Looks like you haven't added anything yet.</p>
          <Button onClick={() => router.push('/customer')} size="lg" className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:scale-105 transition-transform font-bold rounded-xl">
            Browse Food
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-24 font-sans max-w-7xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-gray-900 hover:bg-gray-800 text-white">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-3xl font-bold">Checkout</h1>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">

        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">

          {/* 1. Address Section */}
          <div className="bg-gray-900/50 backdrop-blur-md rounded-3xl p-6 border border-white/5">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-orange-500" />
              </div>
              <h3 className="font-bold text-lg">Delivery Address</h3>
            </div>

            {realtimeCustomer?.addresses && realtimeCustomer.addresses.length > 0 ? (
              <div className="bg-black/40 rounded-2xl p-4 border border-white/5 flex items-start gap-4">
                <div className="mt-1">
                  <div className="w-5 h-5 rounded-full border-2 border-orange-500 flex items-center justify-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-lg text-white">
                      {realtimeCustomer.addresses.find((a: any) => a.id === selectedAddress)?.type || 'Home'}
                    </span>
                    {realtimeCustomer.addresses.find((a: any) => a.id === selectedAddress)?.isDefault &&
                      <Badge className="bg-orange-500/20 text-orange-500 hover:bg-orange-500/30 border-none">Default</Badge>
                    }
                  </div>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    {realtimeCustomer.addresses.find((a: any) => a.id === selectedAddress)?.street}, {realtimeCustomer.addresses.find((a: any) => a.id === selectedAddress)?.city}
                  </p>
                </div>
                <Button variant="link" className="text-orange-400" onClick={() => router.push('/customer/profile')}>
                  Change
                </Button>
              </div>
            ) : (
              <div className="text-center py-6 border-2 border-dashed border-gray-800 rounded-2xl">
                <p className="text-gray-500 mb-4">No address found</p>
                <Button onClick={() => router.push('/customer/profile')} variant="outline" className="border-orange-500/50 text-orange-400 hover:bg-orange-950">
                  + Add Address
                </Button>
              </div>
            )}
          </div>

          {/* 2. Items Section */}
          <div className="bg-gray-900/50 backdrop-blur-md rounded-3xl p-6 border border-white/5">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-blue-500" />
              </div>
              <h3 className="font-bold text-lg">Order Items</h3>
            </div>

            <div className="space-y-4">
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-4 p-4 rounded-2xl bg-black/20 border border-white/5 hover:bg-black/40 transition-colors">
                  <img src={item.image} alt={item.name} className="w-20 h-20 rounded-xl object-cover bg-gray-800" />
                  <div className="flex-1 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-white line-clamp-1">{item.name}</h4>
                        <p className="text-xs text-gray-400">{item.restaurantName}</p>
                      </div>
                      <span className="font-bold text-orange-400">₹{item.price * item.quantity}</span>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-3 bg-gray-800 rounded-lg p-1">
                        <button onClick={() => updateQuantity(item.menuItemId, item.quantity - 1)} className="w-7 h-7 flex items-center justify-center hover:bg-gray-700 rounded-md transition text-white"><Minus className="w-3 h-3" /></button>
                        <span className="text-sm font-bold w-4 text-center text-white">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.menuItemId, item.quantity + 1)} className="w-7 h-7 flex items-center justify-center hover:bg-gray-700 rounded-md transition text-white"><Plus className="w-3 h-3" /></button>
                      </div>
                      <button onClick={() => removeItem(item.menuItemId)} className="text-red-400 hover:bg-red-500/10 p-2 rounded-lg transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Payment Method */}
          <div className="bg-gray-900/50 backdrop-blur-md rounded-3xl p-6 border border-white/5">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-green-500" />
              </div>
              <h3 className="font-bold text-lg">Payment Method</h3>
            </div>

            <RadioGroup value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div onClick={() => setPaymentMethod('cod')} className={`cursor-pointer p-4 rounded-2xl border-2 transition-all flex items-center gap-3 ${paymentMethod === 'cod' ? 'border-green-500 bg-green-500/10' : 'border-gray-800 hover:border-gray-700 bg-black/20'}`}>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'cod' ? 'border-green-500' : 'border-gray-500'}`}>
                  {paymentMethod === 'cod' && <div className="w-2.5 h-2.5 bg-green-500 rounded-full" />}
                </div>
                <div>
                  <p className="font-bold text-white">Cash on Delivery</p>
                  <p className="text-xs text-gray-400">Pay cash upon arrival</p>
                </div>
              </div>

              <div onClick={() => setPaymentMethod('online')} className={`cursor-pointer p-4 rounded-2xl border-2 transition-all flex items-center gap-3 ${paymentMethod === 'online' ? 'border-blue-500 bg-blue-500/10' : 'border-gray-800 hover:border-gray-700 bg-black/20'}`}>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'online' ? 'border-blue-500' : 'border-gray-500'}`}>
                  {paymentMethod === 'online' && <div className="w-2.5 h-2.5 bg-blue-500 rounded-full" />}
                </div>
                <div>
                  <p className="font-bold text-white">Pay Online</p>
                  <p className="text-xs text-gray-400">UPI, Cards, NetBanking</p>
                </div>
              </div>
            </RadioGroup>
          </div>
        </div>

        {/* Right Column - Summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 space-y-4">
            <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-800">
                <ChefHat className="w-5 h-5 text-orange-500" />
                <h3 className="font-bold text-lg">Bill Details</h3>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-gray-400">
                  <span>Item Total</span>
                  <span className="text-white font-medium">₹{subtotal}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Delivery Fee</span>
                  <span className="text-white font-medium">₹{deliveryCharge}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Taxes & Charges</span>
                  <span className="text-white font-medium">₹{taxes}</span>
                </div>
                <div className="border-t border-gray-800 pt-3 flex justify-between items-center text-lg">
                  <span className="font-bold text-white">To Pay</span>
                  <span className="font-bold text-orange-500">₹{total}</span>
                </div>
              </div>

              <Button
                onClick={handlePlaceOrder}
                disabled={loading || items.length === 0}
                className="w-full mt-6 h-14 rounded-xl text-lg font-bold bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 shadow-lg shadow-orange-900/20"
              >
                {loading ? <Spinner className="w-6 h-6 text-white" /> : (paymentMethod === 'cod' ? 'Place Order' : 'Proceed to Pay')}
              </Button>
            </div>

            <div className="bg-gray-900/50 rounded-3xl p-4 border border-white/5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Cooking Instructions</label>
              <textarea
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="e.g. Less spicy, no onions..."
                className="w-full bg-black/50 border border-gray-800 rounded-xl p-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors h-24 resize-none"
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
