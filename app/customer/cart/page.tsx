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
import { ArrowLeft, Trash2, Plus, Minus, CreditCard, Wallet, MapPin, ChefHat, ShoppingBag, ShoppingCart, Home, Briefcase, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function CartPage() {
  const router = useRouter();
  const { user, customer } = useAuth();
  const { items, restaurantId, removeItem, updateQuantity, getSubtotal, clearCart, deliveryAddress, setDeliveryAddress } = useCart();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Checkout State
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'online'>('cod');
  const [razorpayKeyId, setRazorpayKeyId] = useState<string>('');
  const [isAddressDialogOpen, setIsAddressDialogOpen] = useState(false);

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

  // Real-time Customer Sync
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'customers', user.uid), (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data() as any;
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

    if (!deliveryAddress) {
      toast.error('Please select a delivery address!');
      return;
    }

    // Service Area Validation
    if (restaurant?.servicePincodes && restaurant.servicePincodes.length > 0) {
      if (!restaurant.servicePincodes.includes(deliveryAddress.pincode)) {
        toast.error(`Restaurant does not deliver to ${deliveryAddress.pincode}`);
        return;
      }
    }

    setLoading(true);

    try {
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
        restaurantName: restaurant?.name || 'Unknown Restaurant',
        deliveryOtp: Math.floor(1000 + Math.random() * 9000).toString() // Generate 4-digit OTP
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
    <div className="min-h-screen bg-black text-white pb-24 font-sans max-w-7xl mx-auto px-4 py-8 relative selection:bg-orange-500/30">

      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-orange-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[120px]" />
      </div>

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

            {deliveryAddress ? (
              <div className="bg-black/40 rounded-2xl p-4 border border-white/5 flex items-start gap-4">
                <div className="mt-1">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${restaurant?.servicePincodes && restaurant.servicePincodes.includes(deliveryAddress.pincode)
                    ? 'border-green-500'
                    : 'border-red-500'
                    }`}>
                    <div className={`w-2.5 h-2.5 rounded-full ${restaurant?.servicePincodes && restaurant.servicePincodes.includes(deliveryAddress.pincode)
                      ? 'bg-green-500'
                      : 'bg-red-500'
                      }`} />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-lg text-white">
                      {deliveryAddress.type}
                    </span>
                    {deliveryAddress.isDefault &&
                      <Badge className="bg-orange-500/20 text-orange-500 hover:bg-orange-500/30 border-none">Default</Badge>
                    }
                  </div>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    {deliveryAddress.street}, {deliveryAddress.city} - <span className="text-white font-bold">{deliveryAddress.pincode}</span>
                  </p>

                  {/* Service Area Status */}
                  {restaurant?.servicePincodes && !restaurant.servicePincodes.includes(deliveryAddress.pincode) && (
                    <div className="mt-2 text-red-400 text-xs font-bold bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                      ⚠️ Not delivering to this pincode.
                    </div>
                  )}
                </div>

                {/* Address Selection Dialog */}
                <Dialog open={isAddressDialogOpen} onOpenChange={setIsAddressDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="link" className="text-orange-400">
                      Change
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Select Delivery Location</DialogTitle>
                      <DialogDescription className="text-gray-400">
                        Choose from your saved addresses.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-4">
                      {realtimeCustomer?.addresses && realtimeCustomer.addresses.length > 0 ? (
                        realtimeCustomer.addresses.map((addr: any) => (
                          <div
                            key={addr.id}
                            onClick={() => {
                              setDeliveryAddress(addr);
                              setIsAddressDialogOpen(false);
                            }}
                            className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center gap-3 ${deliveryAddress?.id === addr.id ? 'bg-orange-900/20 border-orange-500/50' : 'bg-gray-800/50 border-gray-700 hover:bg-gray-800'}`}
                          >
                            <div className={`p-2 rounded-full ${addr.type === 'Home' ? 'bg-blue-500/20 text-blue-400' : addr.type === 'Work' ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-700 text-gray-400'}`}>
                              {addr.type === 'Home' && <Home className="w-4 h-4" />}
                              {addr.type === 'Work' && <Briefcase className="w-4 h-4" />}
                              {addr.type === 'Other' && <MapPin className="w-4 h-4" />}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm">{addr.type}</span>
                                {addr.isDefault && <span className="text-[10px] bg-green-900/30 text-green-400 px-1.5 rounded uppercase font-bold">Default</span>}
                              </div>
                              <p className="text-xs text-gray-400 line-clamp-1">{addr.street}, {addr.city} {addr.pincode}</p>
                            </div>
                            {deliveryAddress?.id === addr.id && <div className="w-3 h-3 bg-orange-500 rounded-full" />}
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-6 text-gray-500">
                          <p>No saved addresses found.</p>
                          <Button variant="link" onClick={() => router.push('/customer/profile')} className="text-orange-500">
                            Add New Address
                          </Button>
                        </div>
                      )}

                      <Button
                        className="w-full mt-2 bg-gray-800 hover:bg-gray-700 text-white border border-gray-700"
                        onClick={() => { setIsAddressDialogOpen(false); router.push('/customer/profile'); }}
                      >
                        Manage Addresses
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
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
          <div className="bg-gray-900/40 backdrop-blur-xl rounded-3xl p-6 border border-white/5 hover:border-white/10 transition-colors relative z-10 group">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center border border-blue-500/10 group-hover:scale-105 transition-transform">
                <ShoppingBag className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h3 className="font-bold text-xl text-white">Order Summary</h3>
                <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">{items.length} Items in Cart</p>
              </div>
            </div>

            <div className="space-y-4">
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-4 p-4 rounded-2xl bg-black/40 border border-white/5 hover:bg-black/60 transition-colors group/item">
                  <div className="w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 bg-gray-800 relative">
                    <SafeImage
                      src={item.image}
                      alt={item.name}
                      className="object-cover"
                      fill
                    />
                  </div>
                  <div className="flex-1 flex flex-col justify-between py-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-white text-lg line-clamp-1">{item.name}</h4>
                        <p className="text-xs text-gray-400">{item.restaurantName}</p>
                      </div>
                      <span className="font-bold text-orange-400 text-lg">₹{item.price * item.quantity}</span>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      {/* Quantity */}
                      <div className="flex items-center gap-1 bg-gray-800/80 rounded-lg p-1 border border-white/5">
                        <button onClick={() => updateQuantity(item.menuItemId, item.quantity - 1)} className="w-8 h-8 flex items-center justify-center hover:bg-gray-700 rounded-md transition text-white"><Minus className="w-3.5 h-3.5" /></button>
                        <span className="text-sm font-bold w-6 text-center text-white">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.menuItemId, item.quantity + 1)} className="w-8 h-8 flex items-center justify-center hover:bg-gray-700 rounded-md transition text-white"><Plus className="w-3.5 h-3.5" /></button>
                      </div>

                      <button onClick={() => removeItem(item.menuItemId)} className="text-red-400 hover:bg-red-500/20 hover:text-red-300 p-2 rounded-lg transition opacity-0 group-hover/item:opacity-100">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Payment Method */}
          <div className="bg-gray-900/40 backdrop-blur-xl rounded-3xl p-6 border border-white/5 hover:border-white/10 transition-colors relative z-10 group">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center border border-green-500/10 group-hover:scale-105 transition-transform">
                <Wallet className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <h3 className="font-bold text-xl text-white">Payment Method</h3>
                <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Secure Transactions</p>
              </div>
            </div>

            <RadioGroup value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div onClick={() => setPaymentMethod('cod')} className={`cursor-pointer p-4 rounded-2xl border-2 transition-all flex items-center gap-3 hover:scale-[1.02] ${paymentMethod === 'cod' ? 'border-green-500 bg-green-500/10' : 'border-gray-800 hover:border-gray-600 bg-black/40'}`}>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'cod' ? 'border-green-500' : 'border-gray-500'}`}>
                  {paymentMethod === 'cod' && <div className="w-3 h-3 bg-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)]" />}
                </div>
                <div>
                  <p className="font-bold text-white text-base">Cash on Delivery</p>
                  <p className="text-xs text-gray-400">Pay cash upon arrival</p>
                </div>
              </div>

              <div onClick={() => setPaymentMethod('online')} className={`cursor-pointer p-4 rounded-2xl border-2 transition-all flex items-center gap-3 hover:scale-[1.02] ${paymentMethod === 'online' ? 'border-blue-500 bg-blue-500/10' : 'border-gray-800 hover:border-gray-600 bg-black/40'}`}>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'online' ? 'border-blue-500' : 'border-gray-500'}`}>
                  {paymentMethod === 'online' && <div className="w-3 h-3 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />}
                </div>
                <div>
                  <p className="font-bold text-white text-base">Pay Online</p>
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
                className="w-full mt-6 h-16 rounded-2xl text-lg font-bold bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 shadow-xl shadow-orange-900/30 transition-all active:scale-[0.98] border border-orange-500/20"
              >
                {loading ? <Spinner className="w-6 h-6 text-white" /> : (paymentMethod === 'cod' ? 'Tap to Place Order' : 'Proceed to Payment')}
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
