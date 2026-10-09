'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, setDoc, addDoc, collection, updateDoc, Timestamp, onSnapshot, runTransaction, increment, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { loadRazorpayScript } from '@/lib/razorpay';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { Restaurant, Order, OrderItem, Promotion } from '@/lib/types';
import { generateProfessionalOrderId } from '@/lib/order-utils';
import { validatePromotionCode, calculateDiscount, recordPromotionUsage } from '@/lib/promotions';
import { notifyOrderPlaced, notifyPaymentResult } from '@/lib/customer-notifications';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  Wallet,
  MapPin,
  ChefHat,
  ShoppingBag,
  ShoppingCart,
  Home,
  Briefcase,
  ChevronDown,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Banknote,
  Sparkles,
  Tag,
  X,
  Check,
  Phone,
  Edit2,
  CheckCircle2,
  Smartphone,
} from 'lucide-react';
import { toast } from 'sonner';
import SafeImage from '@/components/ui/safe-image';
import DeliveryLocationDialog from '@/components/customer/DeliveryLocationDialog';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

import { checkRestaurantOperatingStatus } from '@/lib/restaurant-schedule';

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
  const [currentTime, setCurrentTime] = useState(new Date());

  // Keep clock tick every 30s
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  // Checkout State
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'online' | 'wallet'>('cod');
  const [razorpayKeyId, setRazorpayKeyId] = useState<string>('');
  const [isAddressDialogOpen, setIsAddressDialogOpen] = useState(false);
  const [isLowBalanceModalOpen, setIsLowBalanceModalOpen] = useState(false);

  // Customer Contact Phone State
  const [customerPhoneInput, setCustomerPhoneInput] = useState('');
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneSaveLoading, setPhoneSaveLoading] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  // Coupon & Promotions State
  const [appliedPromotion, setAppliedPromotion] = useState<Promotion | null>(null);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [promoInput, setPromoInput] = useState<string>('');
  const [isValidatingPromo, setIsValidatingPromo] = useState<boolean>(false);
  const [promoError, setPromoError] = useState<string>('');
  const [availablePromotions, setAvailablePromotions] = useState<Promotion[]>([]);

  // Fetch available promotions for this restaurant from Firestore
  useEffect(() => {
    const fetchPromos = async () => {
      try {
        const promotionsRef = collection(db, 'promotions');
        const q = query(promotionsRef, where('isActive', '==', true));
        const snapshot = await getDocs(q);
        const now = new Date();

        const validPromotions = snapshot.docs
          .map((doc: any) => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              validFrom: data.validFrom?.toDate ? data.validFrom.toDate() : new Date(data.validFrom || Date.now()),
              validUntil: data.validUntil?.toDate ? data.validUntil.toDate() : new Date(data.validUntil || Date.now()),
            } as Promotion;
          })
          .filter((promo: Promotion) => {
            if (now < promo.validFrom || now > promo.validUntil) return false;
            if (promo.usageLimit && promo.usageCount >= promo.usageLimit) return false;
            if (promo.applicableRestaurants && promo.applicableRestaurants.length > 0) {
              return restaurantId ? promo.applicableRestaurants.includes(restaurantId) : false;
            }
            return true;
          });

        setAvailablePromotions(validPromotions);

        // Pre-fill if customer copied code from this specific restaurant page
        const savedCode = localStorage.getItem('suggestedPromo');
        const savedRestaurantId = localStorage.getItem('suggestedPromoRestaurantId');
        if (savedCode) {
          if (!savedRestaurantId || savedRestaurantId === restaurantId) {
            setPromoInput(savedCode);
          } else {
            // Belongs to a different restaurant - do not prefill or allow cross-restaurant leakage
            localStorage.removeItem('suggestedPromo');
            localStorage.removeItem('suggestedPromoRestaurantId');
          }
        }
      } catch (err) {
        console.error('Failed to fetch available promotions for cart:', err);
      }
    };

    fetchPromos();
  }, [restaurantId]);

  // Fetch payment config and listen in realtime to restaurant
  useEffect(() => {
    if (restaurantId) {
      const fetchConfig = async () => {
        try {
          const configRes = await fetch('/api/payment/config');
          const config = await configRes.json();
          setRazorpayKeyId(config.razorpayKeyId);
        } catch (error) {
          console.error('Error fetching payment config:', error);
        }
      };
      fetchConfig();
      loadRazorpayScript();

      // Realtime listener for restaurant status & schedule
      const unsub = onSnapshot(doc(db, 'restaurants', restaurantId), (docSnap) => {
        if (docSnap.exists()) {
          setRestaurant({ ...docSnap.data(), id: docSnap.id } as Restaurant);
        }
      });
      return () => unsub();
    }
  }, [restaurantId]);

  const operatingStatus = checkRestaurantOperatingStatus(restaurant, currentTime);

  // Real-time Customer Sync
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'customers', user.uid), (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data() as any;
        setRealtimeCustomer(data);
      }
    }, () => {});
    return () => unsubscribe();
  }, [user]);

  const [realtimeCustomer, setRealtimeCustomer] = useState<any>(customer);

  useEffect(() => {
    if (user && !realtimeCustomer) setRealtimeCustomer(customer);
  }, [customer, user]);

  const activeCustomerPhone = realtimeCustomer?.phone || customer?.phone || '';
  const hasSavedPhone = Boolean(activeCustomerPhone && activeCustomerPhone.trim().length > 0);

  // Sync initial phone input if user hasn't edited
  useEffect(() => {
    if (activeCustomerPhone && !customerPhoneInput && !isEditingPhone) {
      setCustomerPhoneInput(activeCustomerPhone.replace(/\D/g, '').slice(-10));
    }
  }, [activeCustomerPhone]);

  const handleSavePhoneInCart = async () => {
    if (!user) return;
    setPhoneError('');
    const rawDigits = customerPhoneInput.replace(/\D/g, '');
    if (rawDigits.length < 10) {
      setPhoneError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setPhoneSaveLoading(true);
    const last10 = rawDigits.slice(-10);
    const formattedPhone = `+91 ${last10.slice(0, 5)} ${last10.slice(5)}`;

    try {
      await updateDoc(doc(db, 'customers', user.uid), {
        phone: formattedPhone,
        updatedAt: new Date(),
      });
      setIsEditingPhone(false);
      toast.success('Phone number saved successfully!');
    } catch (err: any) {
      console.error('Failed to save phone number:', err);
      setPhoneError(err.message || 'Failed to save phone number');
      toast.error('Could not save phone number');
    } finally {
      setPhoneSaveLoading(false);
    }
  };

  const subtotal = getSubtotal();
  const packagingCharges = 0; // restaurant?.packagingCharges || 0
  // Delivery Charge: ₹40 standard single item/quantity, ₹60 for multi-quantity or multi-items
  const totalItemsQuantity = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const deliveryCharge = totalItemsQuantity > 1 ? 60 : 40;
  const platformFee = 0;
  const discountedSubtotal = Math.max(0, subtotal - discountAmount);
  const taxableValue = discountedSubtotal; // CGST+SGST on food value
  const cgst = parseFloat((taxableValue * 0.025).toFixed(2));
  const sgst = parseFloat((taxableValue * 0.025).toFixed(2));
  const taxes = parseFloat((cgst + sgst).toFixed(2));
  const total = parseFloat((discountedSubtotal + packagingCharges + deliveryCharge + platformFee + taxes).toFixed(2));
  const amountPaid = paymentMethod === 'cod' ? 0 : 0; // 0 before order placed
  const balanceDue = total;

  // Apply Promo Handler
  const handleApplyPromo = async (codeToApply?: string) => {
    const code = (codeToApply || promoInput).trim().toUpperCase();
    if (!code) {
      setPromoError('Please enter a coupon code');
      return;
    }

    setIsValidatingPromo(true);
    setPromoError('');

    try {
      const result = await validatePromotionCode(code, user?.uid || 'guest', subtotal, restaurantId || undefined);
      if (result.valid && result.promotion) {
        const discount = calculateDiscount(result.promotion, subtotal, deliveryCharge);
        setAppliedPromotion(result.promotion);
        setDiscountAmount(discount);
        setPromoInput('');
        localStorage.removeItem('suggestedPromo');
        toast.success(`Coupon "${result.promotion.code}" applied! You saved ₹${discount}`);
      } else {
        setPromoError(result.error || 'Invalid or expired coupon');
        toast.error(result.error || 'Invalid coupon');
      }
    } catch (err: any) {
      setPromoError('Failed to apply coupon');
      toast.error('Failed to validate coupon');
    } finally {
      setIsValidatingPromo(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromotion(null);
    setDiscountAmount(0);
    setPromoError('');
    toast.info('Coupon removed');
  };

  // Real-time Wallet Calculations
  const walletBalance = Number(realtimeCustomer?.walletBalance ?? customer?.walletBalance ?? 0);
  const isWalletSufficient = walletBalance >= total;
  const deficitAmount = Math.max(0, total - walletBalance);

  const handlePlaceOrder = async () => {
    if (!user || !restaurantId) return;
    if (items.length === 0) return toast.error('Cart is empty');

    if (!deliveryAddress) {
      toast.error('Please select a delivery address!');
      return;
    }

    // Mandatory Phone Number Validation
    const cleanDigits = (customerPhoneInput || realtimeCustomer?.phone || customer?.phone || '').replace(/\D/g, '');
    const currentSavedPhone = (realtimeCustomer?.phone || customer?.phone || '').trim();

    if (cleanDigits.length < 10) {
      toast.error('Contact phone number is mandatory! Please enter and save your phone number before confirming your order.');
      setIsEditingPhone(true);
      return;
    }

    let verifiedPhone = currentSavedPhone;
    if (!currentSavedPhone || (customerPhoneInput && customerPhoneInput.replace(/\D/g, '').length === 10 && !currentSavedPhone.includes(customerPhoneInput.slice(-10)))) {
      const last10 = cleanDigits.slice(-10);
      verifiedPhone = `+91 ${last10.slice(0, 5)} ${last10.slice(5)}`;
      try {
        await updateDoc(doc(db, 'customers', user.uid), {
          phone: verifiedPhone,
          updatedAt: new Date(),
        });
      } catch (err) {
        console.error('Failed to auto-save phone in cart:', err);
      }
    }

    // Operating Status Validation
    if (!operatingStatus.isOpen) {
      toast.error(`Cannot place order: This restaurant is currently closed (${operatingStatus.reason}). Please try again later!`);
      return;
    }

    // Service Area Validation
    if (restaurant?.servicePincodes && restaurant.servicePincodes.length > 0) {
      if (!restaurant.servicePincodes.includes(deliveryAddress.pincode)) {
        toast.error(`Restaurant does not deliver to ${deliveryAddress.pincode}`);
        return;
      }
    }

    // Wallet Balance Pre-Check: Do not place order if wallet has insufficient amount
    if (paymentMethod === 'wallet') {
      if (!isWalletSufficient) {
        toast.error(
          `Insufficient Wallet Balance! Your balance is ₹${walletBalance.toFixed(2)}, but order total is ₹${total.toFixed(2)}. Please add funds or change payment method.`
        );
        setIsLowBalanceModalOpen(true);
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

      // ================= WALLET PAYMENT FLOW =================
      if (paymentMethod === 'wallet') {
        const walletTxId = `WLT-${Date.now().toString(36).toUpperCase()}`;
        const customerRef = doc(db, 'customers', user.uid);
        const txColRef = collection(db, 'customers', user.uid, 'walletTransactions');

        // Atomically verify balance and deduct funds inside Firestore transaction
        await runTransaction(db, async (transaction) => {
          const custDoc = await transaction.get(customerRef);
          if (!custDoc.exists()) {
            throw new Error('Customer account not found');
          }
          const currentBal = Number(custDoc.data().walletBalance || 0);
          if (currentBal < total) {
            throw new Error(
              `Insufficient wallet balance. Available: ₹${currentBal.toFixed(2)}, Required: ₹${total.toFixed(2)}`
            );
          }

          transaction.update(customerRef, {
            walletBalance: increment(-total),
            updatedAt: serverTimestamp(),
          });
        });

        // Create immediately confirmed order
        // Generate unified professional Order ID (e.g. KRIIEFDI4829)
        const orderId = generateProfessionalOrderId();

        const orderData: Order = {
          id: orderId,
          orderId: orderId,
          orderNumber: orderId,
          customerId: user.uid,
          restaurantId,
          items: orderItems,
          deliveryAddress,
          status: 'confirmed',
          paymentMethod: 'wallet',
          paymentStatus: 'completed',
          walletTransactionId: walletTxId,
          subtotal,
          packagingCharges,
          platformFee,
          taxableValue,
          cgst,
          sgst,
          deliveryCharge,
          deliveryFee: deliveryCharge,
          taxes,
          discountAmount: discountAmount || 0,
          promotionId: appliedPromotion?.id || '',
          specialInstructions: specialInstructions || '',
          total,
          amountPaid: total,
          balanceDue: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          customerName: realtimeCustomer?.name || 'Guest',
          customerPhone: verifiedPhone || realtimeCustomer?.phone || '',
          restaurantName: restaurant?.name || 'Unknown Restaurant',
          deliveryOtp: Math.floor(1000 + Math.random() * 9000).toString(),
        };

        // Save order with matching document ID so all panels see the exact same ID
        await setDoc(doc(db, 'orders', orderId), {
          ...orderData,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });

        // Record promotion usage if a promotion was applied
        if (appliedPromotion && user) {
          recordPromotionUsage(appliedPromotion.id, user.uid, orderId, discountAmount).catch(e => console.error('Promo record error:', e));
        }

        // Record customer wallet debit transaction
        await addDoc(txColRef, {
          customerId: user.uid,
          amount: total,
          type: 'payment',
          status: 'completed',
          referenceId: orderId,
          description: `Paid for Order #${orderId} at ${restaurant?.name || 'Hunger'}`,
          createdAt: serverTimestamp(),
        });

        // Trigger Notification (Fire and forget)
        fetch('/api/notifications/new-order', {
          method: 'POST',
          body: JSON.stringify({ orderId }),
        }).catch((err) => console.error('Failed to trigger notification', err));

        // Notify Customer of Order & Wallet Payment
        notifyOrderPlaced({
          orderId,
          customerId: user.uid,
          restaurantName: restaurant?.name || 'Restaurant',
          total,
          paymentMethod: 'wallet',
        }).catch((e) => console.error('Error sending wallet notification:', e));

        toast.success(`₹${total} paid securely from your Hunger Wallet! Order #${orderId} confirmed.`);
        clearCart();
        router.push(`/customer/orders/tracking/${orderId}`);
        return;
      }

      // ================= COD / ONLINE PAYMENT FLOW =================
      const orderId = generateProfessionalOrderId();

      const orderData: Order = {
        id: orderId,
        orderId: orderId,
        orderNumber: orderId,
        customerId: user.uid,
        restaurantId,
        items: orderItems,
        deliveryAddress,
        status: 'pending',
        paymentMethod,
        paymentStatus: 'pending',
        subtotal,
        packagingCharges,
        platformFee,
        taxableValue,
        cgst,
        sgst,
        deliveryCharge,
        deliveryFee: deliveryCharge,
        taxes,
        discountAmount: discountAmount || 0,
        promotionId: appliedPromotion?.id || '',
        specialInstructions: specialInstructions || '',
        total,
        amountPaid: paymentMethod === 'cod' ? 0 : total,
        balanceDue: paymentMethod === 'cod' ? total : 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        customerName: realtimeCustomer?.name || 'Guest',
        customerPhone: verifiedPhone || realtimeCustomer?.phone || '',
        restaurantName: restaurant?.name || 'Unknown Restaurant',
        deliveryOtp: Math.floor(1000 + Math.random() * 9000).toString(),
      };

      // Save order with matching document ID so all panels see the exact same ID
      await setDoc(doc(db, 'orders', orderId), {
        ...orderData,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      // Record promotion usage if a promotion was applied
      if (appliedPromotion && user) {
        recordPromotionUsage(appliedPromotion.id, user.uid, orderId, discountAmount).catch(e => console.error('Promo record error:', e));
      }

      if (paymentMethod === 'cod') {
        // Trigger Notification (Fire and forget)
        fetch('/api/notifications/new-order', {
          method: 'POST',
          body: JSON.stringify({ orderId }),
        }).catch((err) => console.error('Failed to trigger notification', err));

        // Notify Customer of Order & COD Payment
        notifyOrderPlaced({
          orderId,
          customerId: user.uid,
          restaurantName: restaurant?.name || 'Restaurant',
          total,
          paymentMethod: 'cod',
        }).catch((e) => console.error('Error sending COD notification:', e));

        toast.success(`Order #${orderId} placed successfully!`);
        clearCart();
        router.push(`/customer/orders/tracking/${orderId}`);
      } else {
        await handleOnlinePayment(orderId, total, verifiedPhone);
      }
    } catch (error: any) {
      console.error('Order placement failed:', error);
      toast.error('Failed to place order: ' + error.message);
      setLoading(false);
    }
  };

  const handleOnlinePayment = async (orderId: string, amount: number, contactPhone?: string) => {
    if (!user) return;
    const currentUserId = user.uid;
    try {
      const phoneToUse = contactPhone || realtimeCustomer?.phone || '';
      const res = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Math.round(amount * 100),
          orderId,
          customerName: realtimeCustomer?.name,
          customerEmail: user.email,
          customerPhone: phoneToUse
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
        name: 'Hunger',
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
              amountPaid: amount,
              balanceDue: 0,
              updatedAt: Timestamp.now()
            });
            // Trigger Notification
            fetch('/api/notifications/new-order', {
              method: 'POST',
              body: JSON.stringify({ orderId: orderId })
            }).catch(err => console.error("Failed to trigger notification", err));

            // Notify Customer of Payment Success & Confirmed Order
            notifyPaymentResult({
              orderId,
              customerId: currentUserId,
              amount,
              status: 'completed',
              method: 'online',
              paymentId: response.razorpay_payment_id,
            }).catch((e) => console.error('Error sending online payment notification:', e));

            clearCart();
            toast.success('Payment successful!');
            router.push(`/customer/orders/tracking/${orderId}`);
          } else {
            notifyPaymentResult({
              orderId,
              customerId: currentUserId,
              amount,
              status: 'failed',
              method: 'online',
              errorReason: 'Payment verification failed',
            }).catch((e) => console.error('Error sending payment failed notification:', e));
            toast.error('Payment verification failed');
            setLoading(false);
          }
        },
        prefill: {
          name: realtimeCustomer?.name,
          email: user.email,
          contact: phoneToUse || realtimeCustomer?.phone,
        },
        theme: { color: '#F97316' },
        modal: {
          ondismiss: () => {
            setLoading(false);
            toast.info('Payment cancelled');
            notifyPaymentResult({
              orderId,
              customerId: currentUserId,
              amount,
              status: 'cancelled',
              method: 'online',
              errorReason: 'Payment dismissed by user',
            }).catch((e) => console.error('Error sending cancel notification:', e));
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
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="text-center max-w-md space-y-6">
          <div className="w-24 h-24 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-primary/10">
            <ShoppingBag className="w-10 h-10 text-primary animate-pulse" />
          </div>
          <h2 className="text-3xl font-bold text-foreground">Your Cart is Empty</h2>
          <p className="text-muted-foreground">Looks like you haven't added any delicious food yet.</p>
          <Button onClick={() => router.push('/customer')} size="lg" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-105 transition-all">
            Browse Food
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-foreground pb-24 md:pb-16 font-sans w-full max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 relative selection:bg-primary/30">

      {/* Ambient Background Accent */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[140px]" />
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-8">
        <Button variant="outline" size="icon" onClick={() => router.back()} className="rounded-full bg-card hover:bg-accent border-border text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Checkout</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Review your delicious selection & choose payment</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-5 sm:gap-6 lg:gap-8">

        {/* Left Column (Items & Options) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4 sm:space-y-6">

          {/* 1. Address Section */}
          <div className="bg-card/90 backdrop-blur-md rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-border/60 shadow-sm">
            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary/15 flex items-center justify-center text-primary">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base sm:text-lg text-foreground">Delivery Address</h3>
                <p className="text-xs text-muted-foreground">Where should we deliver your order?</p>
              </div>
            </div>

            {deliveryAddress ? (
              <div className="bg-muted/40 rounded-2xl p-4 border border-border/60 flex items-start gap-4">
                <div className="mt-1">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${restaurant?.servicePincodes && restaurant.servicePincodes.includes(deliveryAddress.pincode)
                    ? 'border-emerald-500'
                    : 'border-destructive'
                    }`}>
                    <div className={`w-2.5 h-2.5 rounded-full ${restaurant?.servicePincodes && restaurant.servicePincodes.includes(deliveryAddress.pincode)
                      ? 'bg-emerald-500'
                      : 'bg-destructive'
                      }`} />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-base sm:text-lg text-foreground">
                      {deliveryAddress.type}
                    </span>
                    {deliveryAddress.isDefault &&
                      <Badge className="bg-primary/15 text-primary hover:bg-primary/20 border-none text-xs font-semibold">Default</Badge>
                    }
                  </div>
                  <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">
                    {deliveryAddress.street}, {deliveryAddress.city} - <span className="text-foreground font-bold">{deliveryAddress.pincode}</span>
                  </p>

                  {/* Service Area Status */}
                  {restaurant?.servicePincodes && !restaurant.servicePincodes.includes(deliveryAddress.pincode) && (
                    <div className="mt-2 text-destructive text-xs font-bold bg-destructive/10 p-2.5 rounded-lg border border-destructive/20 flex items-center gap-2">
                      <span>⚠️</span> Restaurant does not deliver to this pincode ({deliveryAddress.pincode}).
                    </div>
                  )}
                </div>

                {/* Change Address Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddressDialogOpen(true)}
                  className="text-primary border-primary/30 hover:bg-primary/10 rounded-xl font-bold"
                >
                  Change
                </Button>
              </div>
            ) : (
              <div className="text-center py-6 border-2 border-dashed border-border rounded-2xl bg-muted/20">
                <p className="text-muted-foreground mb-4 text-sm font-medium">No delivery address selected</p>
                <Button
                  onClick={() => setIsAddressDialogOpen(true)}
                  variant="outline"
                  className="border-primary/50 text-primary hover:bg-primary/10 rounded-xl font-bold"
                >
                  + Select / Add Address
                </Button>
              </div>
            )}

            {/* Reusable Luxury Delivery Location Dialog */}
            <DeliveryLocationDialog
              open={isAddressDialogOpen}
              onOpenChange={setIsAddressDialogOpen}
              servicePincodes={restaurant?.servicePincodes}
            />
          </div>

          {/* 2. Contact Phone Number Section */}
          <div className="bg-card/90 backdrop-blur-md rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-border/60 shadow-sm relative z-10">
            <div className="flex items-center justify-between mb-4 sm:mb-5">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary/15 flex items-center justify-center text-primary">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base sm:text-lg text-foreground">Contact Phone Number</h3>
                    {hasSavedPhone && (
                      <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold py-0.5 px-2">
                        <CheckCircle2 className="w-3 h-3 mr-1 inline" /> Saved
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Required for delivery coordination & order OTP</p>
                </div>
              </div>

              {hasSavedPhone && !isEditingPhone && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsEditingPhone(true);
                    setCustomerPhoneInput(activeCustomerPhone.replace(/\D/g, '').slice(-10));
                    setPhoneError('');
                  }}
                  className="text-primary border-primary/30 hover:bg-primary/10 rounded-xl font-bold text-xs h-8 px-3 gap-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Change
                </Button>
              )}
            </div>

            {hasSavedPhone && !isEditingPhone ? (
              <div className="bg-muted/40 rounded-2xl p-4 border border-border/60 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-foreground text-base tracking-wide">
                        {realtimeCustomer?.phone || customer?.phone}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Driver and restaurant partner will call this number if needed.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 bg-muted/30 p-4 rounded-2xl border border-dashed border-border/80">
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>
                    {hasSavedPhone
                      ? 'Enter a new 10-digit mobile number to update your contact details.'
                      : 'Please enter and save your 10-digit mobile number to proceed with your order.'}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
                  <div className="relative flex-1">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs font-bold text-muted-foreground pointer-events-none select-none">
                      <span>🇮🇳</span>
                      <span>+91</span>
                    </div>
                    <Input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="Enter 10-digit mobile number"
                      value={customerPhoneInput}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setCustomerPhoneInput(cleaned);
                        if (phoneError) setPhoneError('');
                      }}
                      className="pl-16 h-11 rounded-xl bg-background border-border/80 text-foreground text-sm font-semibold tracking-wider transition-all focus:border-primary"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      onClick={handleSavePhoneInCart}
                      disabled={phoneSaveLoading || customerPhoneInput.replace(/\D/g, '').length !== 10}
                      className="h-11 px-4 rounded-xl font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 shadow-xs shrink-0 cursor-pointer"
                    >
                      {phoneSaveLoading ? (
                        <>
                          <Spinner className="w-3.5 h-3.5 text-primary-foreground" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Save Phone Number</span>
                        </>
                      )}
                    </Button>

                    {isEditingPhone && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setIsEditingPhone(false);
                          setPhoneError('');
                        }}
                        className="h-11 px-3 rounded-xl font-semibold text-xs text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>

                {phoneError && (
                  <p className="text-xs text-destructive font-medium flex items-center gap-1.5 animate-in fade-in">
                    <span className="w-1.5 h-1.5 rounded-full bg-destructive inline-block" />
                    {phoneError}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 3. Items Section */}
          <div className="bg-card/90 backdrop-blur-md rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-border/60 shadow-sm relative z-10">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg sm:text-xl text-foreground">Order Items</h3>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{items.length} Items in Cart</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={clearCart} className="text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                Clear all
              </Button>
            </div>

            <div className="space-y-3 sm:space-y-4">
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-muted/40 border border-border/60 hover:bg-muted/60 transition-colors group/item">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden flex-shrink-0 bg-muted relative">
                    <SafeImage
                      src={item.image}
                      alt={item.name}
                      className="object-cover group-hover/item:scale-105 transition-transform duration-300"
                      fill
                    />
                  </div>
                  <div className="flex-1 flex flex-col justify-between py-0.5">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <h4 className="font-bold text-foreground text-sm sm:text-base line-clamp-1">{item.name}</h4>
                        <p className="text-xs text-muted-foreground line-clamp-1">{item.restaurantName}</p>
                        {item.specialInstructions && (
                          <div className="mt-1">
                            <span className="text-[11px] text-primary font-semibold bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md inline-block">
                              {item.specialInstructions}
                            </span>
                          </div>
                        )}
                      </div>
                      <span className="font-bold text-primary text-sm sm:text-base whitespace-nowrap">₹{item.price * item.quantity}</span>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      {/* Quantity */}
                      <div className="flex items-center gap-1 bg-card rounded-lg p-1 border border-border shadow-xs">
                        <button onClick={() => updateQuantity(item.menuItemId, item.quantity - 1)} className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center hover:bg-accent rounded-md transition text-foreground" aria-label="Decrease quantity"><Minus className="w-3.5 h-3.5" /></button>
                        <span className="text-xs sm:text-sm font-bold w-6 text-center text-foreground">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.menuItemId, item.quantity + 1)} className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center hover:bg-accent rounded-md transition text-foreground" aria-label="Increase quantity"><Plus className="w-3.5 h-3.5" /></button>
                      </div>

                      <button onClick={() => removeItem(item.menuItemId)} className="text-muted-foreground hover:bg-destructive/15 hover:text-destructive p-2 rounded-lg transition" aria-label="Remove item">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Payment Method */}
          <div className="bg-card/90 backdrop-blur-md rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-border/60 shadow-sm relative z-10">
            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-500">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg sm:text-xl text-foreground">Payment Method</h3>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">100% Secure Checkout</p>
              </div>
            </div>

            <RadioGroup value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)} className="grid grid-cols-1 gap-3 sm:gap-3.5">
              {/* Option 1: Hunger Wallet */}
              <div
                onClick={() => setPaymentMethod('wallet')}
                className={`cursor-pointer p-4 sm:p-5 rounded-2xl border-2 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  paymentMethod === 'wallet'
                    ? isWalletSufficient
                      ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary/20'
                      : 'border-amber-500 bg-amber-500/10 shadow-sm ring-1 ring-amber-500/20'
                    : 'border-border hover:border-border/80 bg-muted/30'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      paymentMethod === 'wallet'
                        ? isWalletSufficient
                          ? 'border-primary'
                          : 'border-amber-500'
                        : 'border-muted-foreground'
                    }`}
                  >
                    {paymentMethod === 'wallet' && (
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${
                          isWalletSufficient ? 'bg-primary' : 'bg-amber-500'
                        }`}
                      />
                    )}
                  </div>

                  <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                    <Wallet className="w-5 h-5" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-foreground text-sm sm:text-base">Hunger Wallet</p>
                      {isWalletSufficient ? (
                        <Badge
                          variant="outline"
                          className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold py-0"
                        >
                          Sufficient Balance
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] font-bold py-0"
                        >
                          Low Balance
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Available Balance: <strong className="text-foreground font-bold">₹{walletBalance.toFixed(2)}</strong>
                      {isWalletSufficient ? (
                        <span className="text-emerald-600 dark:text-emerald-400 ml-1.5 font-medium">• 1-Click Fast Checkout</span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 ml-1.5 font-medium">• Short by ₹{deficitAmount.toFixed(2)}</span>
                      )}
                    </p>
                  </div>
                </div>

                {!isWalletSufficient && (
                  <div className="sm:text-right flex items-center justify-end pl-8 sm:pl-0">
                    <Link
                      href="/customer/wallet"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline bg-primary/10 hover:bg-primary/15 px-3 py-1.5 rounded-xl transition"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Funds
                    </Link>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                {/* Option 2: Pay Online */}
                <div
                  onClick={() => setPaymentMethod('online')}
                  className={`cursor-pointer p-4 rounded-2xl border-2 transition-all flex items-center gap-3.5 ${
                    paymentMethod === 'online'
                      ? 'border-primary bg-primary/10 shadow-sm'
                      : 'border-border hover:border-border/80 bg-muted/30'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      paymentMethod === 'online' ? 'border-primary' : 'border-muted-foreground'
                    }`}
                  >
                    {paymentMethod === 'online' && <div className="w-2.5 h-2.5 bg-primary rounded-full" />}
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-500 flex items-center justify-center shrink-0">
                    <CreditCard className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground text-sm sm:text-base">Pay Online</p>
                    <p className="text-xs text-muted-foreground">UPI, Cards, NetBanking, Wallets</p>
                  </div>
                </div>

                {/* Option 3: Cash on Delivery */}
                <div
                  onClick={() => setPaymentMethod('cod')}
                  className={`cursor-pointer p-4 rounded-2xl border-2 transition-all flex items-center gap-3.5 ${
                    paymentMethod === 'cod'
                      ? 'border-emerald-500 bg-emerald-500/10 shadow-sm'
                      : 'border-border hover:border-border/80 bg-muted/30'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      paymentMethod === 'cod' ? 'border-emerald-500' : 'border-muted-foreground'
                    }`}
                  >
                    {paymentMethod === 'cod' && <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />}
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                    <Banknote className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground text-sm sm:text-base">Cash on Delivery</p>
                    <p className="text-xs text-muted-foreground">Pay with cash when order arrives</p>
                  </div>
                </div>
              </div>
            </RadioGroup>

            {/* Insufficient Wallet Warning Banner */}
            {paymentMethod === 'wallet' && !isWalletSufficient && (
              <div className="mt-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-200">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-foreground">
                      Insufficient Wallet Balance: ₹{walletBalance.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Order total is ₹{total}. You need ₹{deficitAmount.toFixed(2)} more. Please add funds to your wallet or choose another payment method to place your order.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 flex-wrap">
                  <Link href="/customer/wallet">
                    <Button size="sm" variant="default" className="h-8 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white gap-1 shadow-xs">
                      <Plus className="w-3.5 h-3.5" /> Add Funds
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPaymentMethod('online')}
                    className="h-8 text-xs font-bold rounded-xl"
                  >
                    Pay Online
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPaymentMethod('cod')}
                    className="h-8 text-xs font-bold rounded-xl"
                  >
                    Cash on Delivery
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Bill Summary, Offers & Instructions */}
        <div className="lg:col-span-5 xl:col-span-4">
          <div className="sticky top-20 sm:top-24 space-y-4">
            
            {/* Offers & Coupons Card */}
            <div className="bg-card border border-border/70 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                <Tag className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-sm sm:text-base text-foreground">Offers & Coupons</h3>
              </div>

              {appliedPromotion ? (
                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                        <span className="font-mono">{appliedPromotion.code}</span>
                        <Badge className="bg-emerald-600 text-white text-[9px] py-0 px-1.5 h-4">APPLIED</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        You saved ₹{discountAmount.toFixed(2)} on this order!
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleRemovePromo}
                    className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                    title="Remove coupon"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Enter coupon code"
                        value={promoInput}
                        onChange={(e) => {
                          setPromoInput(e.target.value.toUpperCase());
                          setPromoError('');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleApplyPromo();
                        }}
                        className="pl-8 h-10 text-xs font-mono font-bold uppercase rounded-xl bg-muted/40 border-border/80"
                      />
                    </div>
                    <Button
                      onClick={() => handleApplyPromo()}
                      disabled={isValidatingPromo || !promoInput.trim()}
                      className="h-10 px-4 rounded-xl font-bold text-xs bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 shadow-xs"
                    >
                      {isValidatingPromo ? <Spinner className="w-3.5 h-3.5" /> : 'Apply'}
                    </Button>
                  </div>

                  {promoError && (
                    <p className="text-xs text-destructive flex items-center gap-1 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{promoError}</span>
                    </p>
                  )}

                  {/* Available Coupons list for this restaurant (only if admin or restaurant gave them) */}
                  {availablePromotions.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                        Available Coupons:
                      </p>
                      <div className="space-y-2">
                        {availablePromotions.map((p) => {
                          const isEligible = !p.minOrderAmount || subtotal >= p.minOrderAmount;
                          return (
                            <div
                              key={p.id}
                              className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 text-xs ${
                                isEligible
                                  ? 'bg-card border-border/80 hover:border-primary/40'
                                  : 'bg-muted/30 border-dashed border-border/60 opacity-60'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded text-[11px]">
                                    {p.code}
                                  </span>
                                  <span className="font-bold text-foreground text-xs truncate">
                                    {p.type === 'percentage'
                                      ? `${p.value}% OFF`
                                      : p.type === 'fixed'
                                      ? `₹${p.value} OFF`
                                      : 'FREE DELIVERY'}
                                  </span>
                                </div>
                                <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                                  {p.minOrderAmount
                                    ? `Min order ₹${p.minOrderAmount}`
                                    : 'Valid on all orders'}
                                  {p.maxDiscount ? ` &bull; Max disc ₹${p.maxDiscount}` : ''}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleApplyPromo(p.code)}
                                disabled={!isEligible || isValidatingPromo}
                                className="h-7 px-2.5 text-[11px] font-bold rounded-lg text-primary border-primary/30 hover:bg-primary hover:text-primary-foreground shrink-0"
                              >
                                Apply
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bill Summary Card */}
            <div className="bg-card border border-border/70 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-md">
              {/* No Minimum Order Guarantee Badge */}
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold mb-4">
                <Sparkles className="w-4 h-4 shrink-0 text-emerald-500" />
                <span>No Minimum Order Limit • Order any amount freely!</span>
              </div>

              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/70">
                <ChefHat className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-base sm:text-lg text-foreground">Bill Summary</h3>
              </div>

              <div className="space-y-2.5 text-sm">
                {/* Item Subtotal */}
                <div className="flex justify-between text-muted-foreground">
                  <span>Item Subtotal</span>
                  <span className="text-foreground font-semibold">₹{subtotal.toFixed(2)}</span>
                </div>

                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                    <span className="flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5" />
                      Coupon Discount ({appliedPromotion?.code})
                    </span>
                    <span>-₹{discountAmount.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between text-muted-foreground">
                  <span>Packaging Charges</span>
                  <span className="text-foreground font-semibold">₹{packagingCharges.toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span>Delivery Partner Fee</span>
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-md">
                      {totalItemsQuantity > 1 ? 'Multi-item (₹60)' : 'Standard (₹40)'}
                    </span>
                  </span>
                  <span className="text-foreground font-semibold">₹{deliveryCharge.toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-muted-foreground">
                  <span>Platform Fee</span>
                  <span className="text-foreground font-semibold">₹{platformFee.toFixed(2)}</span>
                </div>

                <div className="border-t border-border/40 pt-2 space-y-1.5">
                  <div className="flex justify-between text-muted-foreground text-xs">
                    <span>Taxable Supply Value</span>
                    <span>₹{taxableValue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground text-xs">
                    <span>CGST (2.5%)</span>
                    <span>₹{cgst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground text-xs">
                    <span>SGST (2.5%)</span>
                    <span>₹{sgst.toFixed(2)}</span>
                  </div>
                </div>

                <div className="border-t border-border/70 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-black text-foreground text-base sm:text-lg">GRAND TOTAL</span>
                    <span className="font-black text-primary text-xl sm:text-2xl">₹{total.toFixed(2)}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground text-right mt-0.5">(All taxes included)</p>
                </div>

                <div className="border-t border-border/40 pt-2.5 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Amount Paid</span>
                    <span className={`font-bold ${amountPaid > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                      ₹{amountPaid.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Balance Due</span>
                    <span className={`font-black ${balanceDue > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      ₹{balanceDue.toFixed(2)}
                    </span>
                  </div>
                  {paymentMethod === 'cod' && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                      Pay ₹{total.toFixed(2)} cash when order arrives
                    </p>
                  )}
                </div>
              </div>

              {!operatingStatus.isOpen && (
                <div className="mt-4 p-4 rounded-2xl bg-rose-500/10 border-2 border-rose-500/30 text-rose-700 dark:text-rose-300 flex items-start sm:items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5 sm:mt-0" />
                  <div>
                    <p className="font-extrabold text-sm text-foreground">Restaurant is Currently Closed</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {restaurant?.name || 'This restaurant'} is not accepting orders ({operatingStatus.reason}). Please try again later.
                    </p>
                  </div>
                </div>
              )}

              <Button
                onClick={handlePlaceOrder}
                disabled={loading || items.length === 0 || !operatingStatus.isOpen}
                className={`w-full mt-5 sm:mt-6 h-13 sm:h-14 rounded-xl sm:rounded-2xl text-base font-bold shadow-lg transition-all active:scale-[0.98] ${
                  !operatingStatus.isOpen
                    ? 'bg-muted text-muted-foreground cursor-not-allowed shadow-none'
                    : paymentMethod === 'wallet' && !isWalletSufficient
                    ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20'
                    : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20'
                }`}
              >
                {loading ? (
                  <Spinner className="w-5 h-5 text-primary-foreground" />
                ) : !operatingStatus.isOpen ? (
                  <span className="flex items-center justify-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-rose-500" /> Restaurant Closed ({operatingStatus.reason})
                  </span>
                ) : !hasSavedPhone && customerPhoneInput.replace(/\D/g, '').length !== 10 ? (
                  <span className="flex items-center justify-center gap-2">
                    <Phone className="w-5 h-5" /> Add Phone Number to Place Order
                  </span>
                ) : paymentMethod === 'wallet' ? (
                  isWalletSufficient ? (
                    <span className="flex items-center gap-2">
                      <Wallet className="w-5 h-5" /> Pay ₹{total} from Wallet
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-sm sm:text-base">
                      <AlertTriangle className="w-5 h-5" /> Insufficient Balance (Add Funds)
                    </span>
                  )
                ) : paymentMethod === 'cod' ? (
                  'Place Cash on Delivery Order'
                ) : (
                  'Proceed to Online Payment'
                )}
              </Button>

              {!hasSavedPhone && customerPhoneInput.replace(/\D/g, '').length !== 10 && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 text-center font-medium mt-2 flex items-center justify-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>A contact phone number is required before confirming your order.</span>
                </p>
              )}

              {paymentMethod === 'wallet' && !isWalletSufficient && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 text-center font-medium mt-2">
                  ⚠️ Wallet balance (₹{walletBalance.toFixed(2)}) is insufficient. Please add funds or change method.
                </p>
              )}
            </div>

            <div className="bg-card/70 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-4 border border-border/60">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Cooking / Delivery Instructions</label>
              <textarea
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="e.g. Please avoid plastic cutlery, leave at the door..."
                className="w-full bg-muted/40 border border-border/70 rounded-xl p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors h-20 sm:h-24 resize-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Low Wallet Balance Dialog */}
      <Dialog open={isLowBalanceModalOpen} onOpenChange={setIsLowBalanceModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 bg-card border-border">
          <DialogHeader className="text-left space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center mb-1">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <DialogTitle className="text-xl font-black text-foreground">
              Insufficient Wallet Balance
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Your Hunger Wallet has <strong className="text-foreground">₹{walletBalance.toFixed(2)}</strong>, but this order requires <strong className="text-foreground">₹{total.toFixed(2)}</strong>. You cannot place the order using wallet until funds are added.
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 p-4 rounded-2xl bg-muted/50 border border-border space-y-2 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Order Amount:</span>
              <span className="font-bold text-foreground">₹{total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Your Wallet Balance:</span>
              <span className="font-bold text-foreground">₹{walletBalance.toFixed(2)}</span>
            </div>
            <div className="border-t border-border pt-1.5 flex justify-between font-bold text-amber-600 dark:text-amber-400">
              <span>Deficit Needed:</span>
              <span>₹{deficitAmount.toFixed(2)}</span>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Link href="/customer/wallet" className="w-full sm:w-auto flex-1">
              <Button className="w-full rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5">
                <Plus className="w-4 h-4" /> Add Funds to Wallet
              </Button>
            </Link>
            <Button
              variant="outline"
              onClick={() => {
                setPaymentMethod('online');
                setIsLowBalanceModalOpen(false);
              }}
              className="w-full sm:w-auto rounded-xl font-bold"
            >
              Pay Online
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setPaymentMethod('cod');
                setIsLowBalanceModalOpen(false);
              }}
              className="w-full sm:w-auto rounded-xl font-bold"
            >
              Cash on Delivery
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
