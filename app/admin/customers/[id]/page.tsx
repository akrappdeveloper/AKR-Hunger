'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  doc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  updateDoc,
  increment,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Customer, Order, SupportTicket } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  Phone,
  Mail,
  Wallet,
  ShoppingBag,
  LifeBuoy,
  MapPin,
  Calendar,
  CheckCircle,
  Clock,
  Plus,
  ArrowUpRight,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

export default function AdminCustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);

  // Wallet adjustment modal
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustType, setAdjustType] = useState<'credit' | 'debit'>('credit');
  const [adjustReason, setAdjustReason] = useState('Admin discretionary wallet adjustment');
  const [savingWallet, setSavingWallet] = useState(false);

  useEffect(() => {
    if (!customerId) return;

    // 1. Customer live listener
    const unsub = onSnapshot(doc(db, 'customers', customerId), (docSnap) => {
      if (docSnap.exists()) {
        setCustomer({
          id: docSnap.id,
          ...docSnap.data(),
        } as Customer);
      } else {
        setCustomer(null);
      }
      setLoading(false);
    });

    // 2. Fetch Customer Orders
    const fetchOrders = async () => {
      try {
        const qOrders = query(
          collection(db, 'orders'),
          where('customerId', '==', customerId),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(qOrders);
        setOrders(
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
            createdAt: d.data().createdAt?.toDate ? d.data().createdAt.toDate() : new Date(),
          })) as Order[]
        );
      } catch (err) {
        console.warn('Orders query:', err);
      }
    };

    // 3. Fetch Customer Support Tickets
    const fetchTickets = async () => {
      try {
        const qTickets = query(
          collection(db, 'supportTickets'),
          where('userId', '==', customerId),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(qTickets);
        setTickets(
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          })) as SupportTicket[]
        );
      } catch (err) {
        console.warn('Tickets query:', err);
      }
    };

    fetchOrders();
    fetchTickets();

    return () => unsub();
  }, [customerId]);

  const handleAdjustWallet = async () => {
    const num = parseFloat(adjustAmount);
    if (isNaN(num) || num <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setSavingWallet(true);
    try {
      const delta = adjustType === 'credit' ? num : -num;

      // Update customer balance
      await updateDoc(doc(db, 'customers', customerId), {
        walletBalance: increment(delta),
        updatedAt: serverTimestamp(),
      });

      // Log transaction
      await addDoc(collection(db, 'customers', customerId, 'walletTransactions'), {
        amount: num,
        type: adjustType,
        category: 'adjustment',
        description: adjustReason,
        processedBy: 'Admin Console',
        createdAt: serverTimestamp(),
      });

      toast.success(`Wallet ${adjustType === 'credit' ? 'credited' : 'debited'} with ₹${num}`);
      setWalletModalOpen(false);
      setAdjustAmount('');
    } catch (err: any) {
      console.error('Wallet adjustment failed:', err);
      toast.error('Adjustment failed: ' + err.message);
    } finally {
      setSavingWallet(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-gray-400 text-sm">
        Loading customer dossier...
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-8 text-center space-y-4">
        <h2 className="text-xl font-bold text-white">Customer Not Found</h2>
        <p className="text-sm text-gray-400">Profile #{customerId} does not exist.</p>
        <Button onClick={() => router.push('/admin/customers')} variant="outline" className="border-white/10 text-white">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Customers
        </Button>
      </div>
    );
  }

  const totalSpent = orders.reduce((sum, o) => sum + (o.total || 0), 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/admin/customers')}
            className="border-white/10 text-gray-300 hover:text-white rounded-xl"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              {customer.name || 'Customer'}
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px] font-mono">
                ACTIVE
              </Badge>
            </h1>
            <p className="text-xs text-gray-400">UID: {customer.id}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {customer.phone && (
            <a href={`https://wa.me/${customer.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline" className="border-emerald-500/30 text-emerald-400 rounded-xl text-xs gap-1.5">
                <Phone className="w-3.5 h-3.5" /> WhatsApp
              </Button>
            </a>
          )}
          {customer.email && (
            <a href={`mailto:${customer.email}`}>
              <Button size="sm" variant="outline" className="border-white/10 text-gray-300 rounded-xl text-xs gap-1.5">
                <Mail className="w-3.5 h-3.5" /> Email
              </Button>
            </a>
          )}
          <Button
            size="sm"
            onClick={() => setWalletModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs gap-1.5 shadow-md shadow-blue-600/20"
          >
            <Wallet className="w-3.5 h-3.5" /> Adjust Balance
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-black/40 border-white/5 rounded-2xl">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold text-gray-500 uppercase">Wallet Balance</p>
            <h3 className="text-2xl font-black text-emerald-400 mt-1">₹{(customer.walletBalance || 0).toFixed(2)}</h3>
          </CardContent>
        </Card>

        <Card className="bg-black/40 border-white/5 rounded-2xl">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold text-gray-500 uppercase">Total Orders</p>
            <h3 className="text-2xl font-black text-white mt-1">{orders.length}</h3>
          </CardContent>
        </Card>

        <Card className="bg-black/40 border-white/5 rounded-2xl">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold text-gray-500 uppercase">Lifetime Spend</p>
            <h3 className="text-2xl font-black text-blue-400 mt-1">₹{totalSpent.toFixed(2)}</h3>
          </CardContent>
        </Card>

        <Card className="bg-black/40 border-white/5 rounded-2xl">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold text-gray-500 uppercase">Support Tickets</p>
            <h3 className="text-2xl font-black text-amber-400 mt-1">{tickets.length}</h3>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Orders & Support */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order History */}
        <Card className="bg-black/40 border-white/5 rounded-2xl">
          <CardHeader className="p-5 border-b border-white/5 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-blue-400" /> Recent Orders ({orders.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 divide-y divide-white/5 max-h-[420px] overflow-y-auto">
            {orders.length === 0 ? (
              <p className="text-xs text-gray-500 py-6 text-center">No orders placed yet.</p>
            ) : (
              orders.map((o) => (
                <div key={o.id} className="py-3 flex items-center justify-between first:pt-0 last:pb-0 text-xs">
                  <div>
                    <p className="font-bold text-white">{o.restaurantName || 'Restaurant'}</p>
                    <p className="text-[11px] text-gray-400">
                      {o.createdAt ? new Date(o.createdAt).toLocaleDateString() : ''} • {o.items?.length || 0} items
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-emerald-400">₹{(o.total || 0).toFixed(2)}</span>
                    <Badge variant="outline" className="text-[10px] uppercase border-white/10 text-gray-300">
                      {o.status}
                    </Badge>
                    <Link href={`/admin/orders/${o.id}`}>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-400 hover:text-white">
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Support Tickets */}
        <Card className="bg-black/40 border-white/5 rounded-2xl">
          <CardHeader className="p-5 border-b border-white/5 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
              <LifeBuoy className="w-4 h-4 text-amber-400" /> Support Tickets ({tickets.length})
            </CardTitle>
            <Link href="/admin/support">
              <Button size="sm" variant="ghost" className="text-xs text-blue-400 hover:text-blue-300 h-7">
                All Tickets
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-4 divide-y divide-white/5 max-h-[420px] overflow-y-auto">
            {tickets.length === 0 ? (
              <p className="text-xs text-gray-500 py-6 text-center">No support tickets filed.</p>
            ) : (
              tickets.map((t) => (
                <div key={t.id} className="py-3 flex items-center justify-between first:pt-0 last:pb-0 text-xs">
                  <div className="min-w-0 pr-2">
                    <p className="font-bold text-white truncate">{t.subject}</p>
                    <p className="text-[11px] text-gray-400 truncate">{t.description || t.message}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant="outline"
                      className={`text-[9px] uppercase font-bold ${
                        t.status === 'resolved' ? 'border-emerald-500/30 text-emerald-400' : 'border-amber-500/30 text-amber-400'
                      }`}
                    >
                      {t.status || 'open'}
                    </Badge>
                    <Link href={`/admin/support?id=${t.id}`}>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-400 hover:text-white">
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Wallet Adjustment Dialog */}
      <Dialog open={walletModalOpen} onOpenChange={setWalletModalOpen}>
        <DialogContent className="sm:max-w-md bg-gray-900 border-gray-800 text-white rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Wallet className="w-4 h-4 text-blue-400" /> Adjust Customer Wallet Balance
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-bold text-gray-300">Action Type</label>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                <Button
                  type="button"
                  onClick={() => setAdjustType('credit')}
                  className={adjustType === 'credit' ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400'}
                >
                  Credit (+)
                </Button>
                <Button
                  type="button"
                  onClick={() => setAdjustType('debit')}
                  className={adjustType === 'debit' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400'}
                >
                  Debit (-)
                </Button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-300">Amount (₹)</label>
              <Input
                type="number"
                placeholder="100"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                className="bg-black/50 border-white/10 text-white mt-1 rounded-xl font-bold font-mono text-lg"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-300">Reason / Internal Note</label>
              <Input
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className="bg-black/50 border-white/10 text-white mt-1 rounded-xl text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setWalletModalOpen(false)} className="border-white/10 text-gray-400">
              Cancel
            </Button>
            <Button
              onClick={handleAdjustWallet}
              disabled={savingWallet || !adjustAmount}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold"
            >
              {savingWallet ? 'Saving...' : 'Apply Adjustment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
