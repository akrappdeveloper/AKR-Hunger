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
  Edit,
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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

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

  // Edit profile modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Customer>>({});
  const [savingProfile, setSavingProfile] = useState(false);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const updates: any = {
        name: editForm.name || '',
        email: editForm.email || '',
        phone: editForm.phone || '',
        phoneVerified: !!editForm.phoneVerified,
        isBlocked: !!editForm.isBlocked,
        rewardPoints: Number(editForm.rewardPoints) || 0,
        membershipStatus: editForm.membershipStatus || 'none',
        avatar: editForm.avatar || '',
        bankDetails: {
          bankName: editForm.bankDetails?.bankName || '',
          accountNumber: editForm.bankDetails?.accountNumber || '',
          ifscCode: editForm.bankDetails?.ifscCode || '',
          accountHolderName: editForm.bankDetails?.accountHolderName || '',
        },
        updatedAt: serverTimestamp(),
      };
      
      if ((editForm as any).upiId !== undefined) updates.upiId = (editForm as any).upiId;
      if ((editForm as any).platform !== undefined) updates.platform = (editForm as any).platform;
      if ((editForm as any).referralCode !== undefined) updates.referralCode = (editForm as any).referralCode;

      await updateDoc(doc(db, 'customers', customerId), updates);
      toast.success('Customer profile updated successfully');
      setEditModalOpen(false);
    } catch (err: any) {
      toast.error('Failed to update profile: ' + err.message);
    } finally {
      setSavingProfile(false);
    }
  };

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
      <div className="flex items-center justify-center min-h-[50vh] text-muted-foreground text-sm">
        Loading customer dossier...
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-8 text-center space-y-4">
        <h2 className="text-xl font-bold text-foreground">Customer Not Found</h2>
        <p className="text-sm text-muted-foreground">Profile #{customerId} does not exist.</p>
        <Button onClick={() => router.push('/admin/customers')} variant="outline" className="border-border/50 text-foreground">
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
            className="border-border/50 text-muted-foreground hover:text-foreground rounded-xl"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
              {customer.name || 'Customer'}
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px] font-mono">
                ACTIVE
              </Badge>
            </h1>
            <p className="text-xs text-muted-foreground">UID: {customer.id}</p>
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
              <Button size="sm" variant="outline" className="border-border/50 text-muted-foreground rounded-xl text-xs gap-1.5">
                <Mail className="w-3.5 h-3.5" /> Email
              </Button>
            </a>
          )}
          <Button
            size="sm"
            onClick={() => {
              setEditForm(customer);
              setEditModalOpen(true);
            }}
            className="bg-secondary hover:bg-secondary text-foreground font-bold rounded-xl text-xs gap-1.5 border border-border/50"
          >
            <Edit className="w-3.5 h-3.5" /> Edit Profile
          </Button>
          <Button
            size="sm"
            onClick={() => setWalletModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 text-foreground font-bold rounded-xl text-xs gap-1.5 shadow-md shadow-blue-600/20"
          >
            <Wallet className="w-3.5 h-3.5" /> Adjust Balance
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-background/40 border-border/50 rounded-2xl">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold text-muted-foreground uppercase">Wallet Balance</p>
            <h3 className="text-2xl font-black text-emerald-400 mt-1">₹{(customer.walletBalance || 0).toFixed(2)}</h3>
          </CardContent>
        </Card>

        <Card className="bg-background/40 border-border/50 rounded-2xl">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold text-muted-foreground uppercase">Total Orders</p>
            <h3 className="text-2xl font-black text-foreground mt-1">{orders.length}</h3>
          </CardContent>
        </Card>

        <Card className="bg-background/40 border-border/50 rounded-2xl">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold text-muted-foreground uppercase">Lifetime Spend</p>
            <h3 className="text-2xl font-black text-blue-400 mt-1">₹{totalSpent.toFixed(2)}</h3>
          </CardContent>
        </Card>

        <Card className="bg-background/40 border-border/50 rounded-2xl">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold text-muted-foreground uppercase">Support Tickets</p>
            <h3 className="text-2xl font-black text-amber-400 mt-1">{tickets.length}</h3>
          </CardContent>
        </Card>
      </div>

      {/* Extended Profile Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Contact & Platform Info */}
        <Card className="bg-background/40 border-border/50 rounded-2xl">
          <CardHeader className="p-5 border-b border-border/50">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <Mail className="w-4 h-4 text-purple-400" /> Account & Platform
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Platform</span>
              <span className="font-bold text-foreground capitalize">{(customer as any).platform || 'Unknown'}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">FCM Token</span>
              <span className="font-bold text-foreground truncate max-w-[120px]" title={(customer as any).fcmToken}>
                {(customer as any).fcmToken ? 'Registered' : 'None'}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Referral Code</span>
              <span className="font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">{customer.referralCode || 'None'}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Referral Count</span>
              <span className="font-bold text-foreground">{customer.referralCount || 0}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Referral Earnings</span>
              <span className="font-bold text-emerald-400">₹{customer.referralEarnings || 0}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Joined</span>
              <span className="font-bold text-foreground">
                {customer.createdAt?.toDate ? customer.createdAt.toDate().toLocaleDateString() : 'N/A'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Bank & Payment Info */}
        <Card className="bg-background/40 border-border/50 rounded-2xl">
          <CardHeader className="p-5 border-b border-border/50">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <Wallet className="w-4 h-4 text-cyan-400" /> Bank & Payment Details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">UPI ID</span>
              <span className="font-bold text-foreground">{(customer as any).upiId || 'Not Set'}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Bank Name</span>
              <span className="font-bold text-foreground">{customer.bankDetails?.bankName || 'Not Set'}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Account Number</span>
              <span className="font-bold text-foreground">{customer.bankDetails?.accountNumber || 'Not Set'}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">IFSC Code</span>
              <span className="font-bold text-foreground">{customer.bankDetails?.ifscCode || 'Not Set'}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Account Holder</span>
              <span className="font-bold text-foreground">{customer.bankDetails?.accountHolderName || 'Not Set'}</span>
            </div>
          </CardContent>
        </Card>

        {/* Saved Addresses */}
        <Card className="bg-background/40 border-border/50 rounded-2xl">
          <CardHeader className="p-5 border-b border-border/50">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <MapPin className="w-4 h-4 text-rose-400" /> Saved Addresses
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 overflow-y-auto max-h-[220px] space-y-3">
            {customer.addresses && customer.addresses.length > 0 ? (
              customer.addresses.map((addr: any, idx: number) => (
                <div key={addr.id || idx} className="text-xs p-3 rounded-xl bg-card/5 border border-border/50">
                  <div className="flex justify-between mb-1">
                    <span className="font-bold text-foreground uppercase">{addr.type || 'Address'}</span>
                    {addr.isDefault && <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400 h-4">DEFAULT</Badge>}
                  </div>
                  <p className="text-muted-foreground">{addr.street || addr.landmark || ''}</p>
                  <p className="text-muted-foreground">{addr.city}, {addr.state} - {addr.pincode}</p>
                </div>
              ))
            ) : (customer as any).currentAddress ? (
              <div className="text-xs p-3 rounded-xl bg-card/5 border border-border/50">
                <div className="flex justify-between mb-1">
                  <span className="font-bold text-foreground uppercase">{(customer as any).currentAddress.type || 'Current'}</span>
                  <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400 h-4">ACTIVE</Badge>
                </div>
                <p className="text-muted-foreground">{(customer as any).currentAddress.street || (customer as any).currentAddress.landmark || ''}</p>
                <p className="text-muted-foreground">{(customer as any).currentAddress.city}, {(customer as any).currentAddress.state} - {(customer as any).currentAddress.pincode}</p>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground text-center py-4">No addresses saved</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Orders & Support */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order History */}
        <Card className="bg-background/40 border-border/50 rounded-2xl">
          <CardHeader className="p-5 border-b border-border/50 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-blue-400" /> Recent Orders ({orders.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 divide-y divide-white/5 max-h-[420px] overflow-y-auto">
            {orders.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">No orders placed yet.</p>
            ) : (
              orders.map((o) => (
                <div key={o.id} className="py-3 flex items-center justify-between first:pt-0 last:pb-0 text-xs">
                  <div>
                    <p className="font-bold text-foreground">{o.restaurantName || 'Restaurant'}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {o.createdAt ? new Date(o.createdAt).toLocaleDateString() : ''} • {o.items?.length || 0} items
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-emerald-400">₹{(o.total || 0).toFixed(2)}</span>
                    <Badge variant="outline" className="text-[10px] uppercase border-border/50 text-muted-foreground">
                      {o.status}
                    </Badge>
                    <Link href={`/admin/orders/${o.id}`}>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground">
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
        <Card className="bg-background/40 border-border/50 rounded-2xl">
          <CardHeader className="p-5 border-b border-border/50 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
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
              <p className="text-xs text-muted-foreground py-6 text-center">No support tickets filed.</p>
            ) : (
              tickets.map((t) => (
                <div key={t.id} className="py-3 flex items-center justify-between first:pt-0 last:pb-0 text-xs">
                  <div className="min-w-0 pr-2">
                    <p className="font-bold text-foreground truncate">{t.subject}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{t.description || t.message}</p>
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
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground">
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
        <DialogContent className="sm:max-w-md bg-card border-border/50 text-foreground rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Wallet className="w-4 h-4 text-blue-400" /> Adjust Customer Wallet Balance
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-bold text-muted-foreground">Action Type</label>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                <Button
                  type="button"
                  onClick={() => setAdjustType('credit')}
                  className={adjustType === 'credit' ? 'bg-emerald-600 text-foreground' : 'bg-secondary text-muted-foreground'}
                >
                  Credit (+)
                </Button>
                <Button
                  type="button"
                  onClick={() => setAdjustType('debit')}
                  className={adjustType === 'debit' ? 'bg-red-600 text-foreground' : 'bg-secondary text-muted-foreground'}
                >
                  Debit (-)
                </Button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground">Amount (₹)</label>
              <Input
                type="number"
                placeholder="100"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                className="bg-background/50 border-border/50 text-foreground mt-1 rounded-xl font-bold font-mono text-lg"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground">Reason / Internal Note</label>
              <Input
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className="bg-background/50 border-border/50 text-foreground mt-1 rounded-xl text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setWalletModalOpen(false)} className="border-border/50 text-muted-foreground">
              Cancel
            </Button>
            <Button
              onClick={handleAdjustWallet}
              disabled={savingWallet || !adjustAmount}
              className="bg-blue-600 hover:bg-blue-500 text-foreground font-bold"
            >
              {savingWallet ? 'Saving...' : 'Apply Adjustment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Profile Dialog */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-2xl bg-card border-border/50 text-foreground rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Edit className="w-4 h-4 text-blue-400" /> Edit Full Customer Profile
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-muted-foreground">Name</Label>
              <Input
                value={editForm.name || ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                className="bg-background/50 border-border/50 text-foreground rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-muted-foreground">Email</Label>
              <Input
                type="email"
                value={editForm.email || ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                className="bg-background/50 border-border/50 text-foreground rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-muted-foreground">Phone Number</Label>
              <Input
                type="tel"
                value={editForm.phone || ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                className="bg-background/50 border-border/50 text-foreground rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-muted-foreground">Avatar URL</Label>
              <Input
                value={editForm.avatar || ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, avatar: e.target.value }))}
                className="bg-background/50 border-border/50 text-foreground rounded-xl"
                placeholder="https://..."
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-muted-foreground">Reward Points</Label>
              <Input
                type="number"
                value={editForm.rewardPoints || 0}
                onChange={(e) => setEditForm(prev => ({ ...prev, rewardPoints: Number(e.target.value) }))}
                className="bg-background/50 border-border/50 text-foreground rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-muted-foreground">Referral Code</Label>
              <Input
                value={(editForm as any).referralCode || ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, referralCode: e.target.value }))}
                className="bg-background/50 border-border/50 text-foreground rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-muted-foreground">Platform</Label>
              <select
                value={(editForm as any).platform || 'android'}
                onChange={(e) => setEditForm(prev => ({ ...prev, platform: e.target.value }))}
                className="flex h-10 w-full rounded-xl border border-border/50 bg-background/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="android">Android</option>
                <option value="ios">iOS</option>
                <option value="web">Web</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-muted-foreground">Membership Status</Label>
              <select
                value={editForm.membershipStatus || 'none'}
                onChange={(e) => setEditForm(prev => ({ ...prev, membershipStatus: e.target.value as any }))}
                className="flex h-10 w-full rounded-xl border border-border/50 bg-background/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="none">None</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <div className="col-span-1 md:col-span-2 flex items-center justify-between p-3 rounded-xl border border-border/50 bg-card/5 mt-2">
              <div className="space-y-0.5">
                <Label className="text-sm font-bold text-foreground">Phone Verified</Label>
                <p className="text-xs text-muted-foreground">Mark phone number as verified</p>
              </div>
              <Switch
                checked={!!editForm.phoneVerified}
                onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, phoneVerified: checked }))}
              />
            </div>

            <div className="col-span-1 md:col-span-2 flex items-center justify-between p-3 rounded-xl border border-rose-500/20 bg-rose-500/5 mt-2">
              <div className="space-y-0.5">
                <Label className="text-sm font-bold text-rose-400">Block Account</Label>
                <p className="text-xs text-rose-400/70">Prevent this user from accessing their account</p>
              </div>
              <Switch
                checked={!!editForm.isBlocked}
                onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, isBlocked: checked }))}
                className="data-[state=checked]:bg-rose-500"
              />
            </div>

            {/* Bank Details section */}
            <div className="col-span-1 md:col-span-2 mt-4 pt-4 border-t border-border/50">
              <h4 className="text-sm font-bold text-foreground mb-3">Bank Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Bank Name</Label>
                  <Input
                    value={editForm.bankDetails?.bankName || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, bankDetails: { ...prev.bankDetails!, bankName: e.target.value } }))}
                    className="bg-background/50 border-border/50 text-foreground rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Account Number</Label>
                  <Input
                    value={editForm.bankDetails?.accountNumber || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, bankDetails: { ...prev.bankDetails!, accountNumber: e.target.value } }))}
                    className="bg-background/50 border-border/50 text-foreground rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">IFSC Code</Label>
                  <Input
                    value={editForm.bankDetails?.ifscCode || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, bankDetails: { ...prev.bankDetails!, ifscCode: e.target.value } }))}
                    className="bg-background/50 border-border/50 text-foreground rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Account Holder Name</Label>
                  <Input
                    value={editForm.bankDetails?.accountHolderName || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, bankDetails: { ...prev.bankDetails!, accountHolderName: e.target.value } }))}
                    className="bg-background/50 border-border/50 text-foreground rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">UPI ID</Label>
                  <Input
                    value={(editForm as any).upiId || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, upiId: e.target.value }))}
                    className="bg-background/50 border-border/50 text-foreground rounded-xl"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setEditModalOpen(false)} className="border-border/50 text-muted-foreground">
              Cancel
            </Button>
            <Button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="bg-blue-600 hover:bg-blue-500 text-foreground font-bold"
            >
              {savingProfile ? 'Saving...' : 'Save Profile'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
