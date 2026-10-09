'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRestaurantAuth } from '@/context/RestaurantAuthContext';
import { db } from '@/lib/firebase';
import { doc, collection, onSnapshot, getDoc, getDocs, query, where } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { copyToClipboard } from '@/lib/utils';
import {
  Users, Plus, Trash2, Edit2, Phone, Mail, Shield,
  ChefHat, Loader2, CheckCircle2, Search, UserCheck, UserX,
  KeyRound, Eye, EyeOff, Copy, Check, ExternalLink, Sparkles,
  Lock, RefreshCw, AlertCircle, IndianRupee, Calendar, Clock,
  MessageCircle, MoreVertical, CheckCircle, XCircle, ArrowUpRight,
  ShieldCheck, ShieldAlert
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

export interface StaffMember {
  id: string;
  uid?: string;
  name: string;
  phone: string;
  email?: string;
  role: 'manager' | 'chef' | 'cashier' | 'helper';
  staffRole?: string;
  status: 'active' | 'on_leave' | 'inactive';
  joinedAt?: any;
  createdAt?: any;
  updatedAt?: any;
  salary?: number;
  permissions?: string[];
  lastLoginAt?: any;
}

const ROLES = [
  { value: 'manager', label: 'Manager', icon: Shield, color: 'from-purple-600 to-indigo-600', badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30', desc: 'Full store access & team control' },
  { value: 'chef', label: 'Chef', icon: ChefHat, color: 'from-orange-500 to-amber-600', badgeColor: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30', desc: 'Orders, menu items & schedule' },
  { value: 'cashier', label: 'Cashier', icon: Users, color: 'from-blue-600 to-cyan-600', badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30', desc: 'Orders, wallet & customer reviews' },
  { value: 'helper', label: 'Helper', icon: UserCheck, color: 'from-emerald-600 to-teal-600', badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30', desc: 'Kitchen tickets & order prep' },
];

const AVAILABLE_PERMISSIONS = [
  { id: 'orders', label: 'Orders & Live Kitchen', desc: 'Accept, update and manage live customer orders' },
  { id: 'menu', label: 'Menu & Stock Management', desc: 'Manage menu items, prices, and food availability' },
  { id: 'schedule', label: 'Kitchen Schedule & Hours', desc: 'Set opening hours, breaks, and live closed toggles' },
  { id: 'quality', label: 'Quality & Prep Time', desc: 'Monitor kitchen preparation metrics and efficiency' },
  { id: 'reviews', label: 'Customer Reviews', desc: 'View customer ratings and food feedback' },
  { id: 'wallet', label: 'Daily Wallet & Payouts', desc: 'Access daily cash register and payout records' },
  { id: 'analytics', label: 'Kitchen Analytics', desc: 'View sales trends, order volume and peak hours' },
  { id: 'campaigns', label: 'Offers & Campaigns', desc: 'Manage food discounts, coupons and ad campaigns' },
  { id: 'staff', label: 'Staff Management', desc: 'Add or modify crew members and permissions' },
  { id: 'settings', label: 'Restaurant Settings', desc: 'Modify restaurant configuration & kitchen profile' },
];

const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  manager: ['orders', 'menu', 'schedule', 'quality', 'reviews', 'wallet', 'analytics', 'campaigns', 'staff', 'settings'],
  chef: ['orders', 'menu', 'schedule', 'quality'],
  cashier: ['orders', 'wallet', 'reviews'],
  helper: ['orders'],
};

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  active: { label: 'Active (On Duty)', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-500' },
  on_leave: { label: 'On Leave', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30', dot: 'bg-amber-500' },
  inactive: { label: 'Inactive / Suspended', color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30', dot: 'bg-rose-500' },
};

function formatDate(val: any): string {
  if (!val) return 'Recently';
  try {
    if (typeof val?.toDate === 'function') {
      return val.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }
  } catch {}
  return 'Recently';
}

const emptyForm = {
  name: '',
  phone: '',
  email: '',
  password: '',
  role: 'chef' as 'manager' | 'chef' | 'cashier' | 'helper',
  status: 'active' as 'active' | 'on_leave' | 'inactive',
  salary: '',
  permissions: ['orders', 'menu', 'schedule', 'quality'] as string[],
};

export default function RestaurantStaffPage() {
  const { user: authUser } = useAuth();
  const { restaurant, user: rUser } = useRestaurantAuth();
  const [resolvedRestaurantId, setResolvedRestaurantId] = useState<string>('');
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');

  // Dialogs state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Detail View Modal
  const [selectedStaffDetails, setSelectedStaffDetails] = useState<StaffMember | null>(null);

  // Quick Password Reset Modal
  const [resetModalStaff, setResetModalStaff] = useState<StaffMember | null>(null);
  const [newPasswordValue, setNewPasswordValue] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  // Success credentials modal
  const [createdCreds, setCreatedCreds] = useState<{
    name: string;
    email: string;
    password?: string;
    role: string;
    loginUrl: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // 1. Resolve Restaurant ID
  useEffect(() => {
    async function resolveId() {
      if (restaurant?.id) {
        setResolvedRestaurantId(restaurant.id);
        return;
      }
      if (rUser?.restaurantId) {
        setResolvedRestaurantId(rUser.restaurantId);
        return;
      }
      const uid = authUser?.uid || rUser?.uid;
      if (!uid) return;

      try {
        const uSnap = await getDoc(doc(db, 'users', uid));
        if (uSnap.exists() && uSnap.data()?.restaurantId) {
          setResolvedRestaurantId(uSnap.data().restaurantId);
          return;
        }

        const rSnap = await getDoc(doc(db, 'restaurants', uid));
        if (rSnap.exists()) {
          setResolvedRestaurantId(uid);
          return;
        }

        const ownerQ = query(collection(db, 'restaurants'), where('ownerId', '==', uid));
        const ownerSnap = await getDocs(ownerQ);
        if (!ownerSnap.empty) {
          setResolvedRestaurantId(ownerSnap.docs[0].id);
          return;
        }

        setResolvedRestaurantId(uid);
      } catch (err) {
        console.error('[Staff Page] Error resolving restaurantId:', err);
        setResolvedRestaurantId(uid);
      }
    }
    resolveId();
  }, [restaurant?.id, rUser?.restaurantId, authUser?.uid, rUser?.uid]);

  // 2. Fetch staff members via API (Admin SDK backed, rule & index independent)
  const fetchStaffFromApi = useCallback(async (rid: string) => {
    if (!rid) return;
    try {
      const res = await fetch(`/api/restaurant/staff?restaurantId=${rid}`);
      if (res.ok) {
        const data = await res.json();
        if (data.staff && Array.isArray(data.staff)) {
          setStaff((prev) => {
            const map = new Map<string, StaffMember>();
            data.staff.forEach((s: StaffMember) => map.set(s.id || (s as any).uid, s));
            prev.forEach((s) => {
              if (!map.has(s.id)) map.set(s.id, s);
            });
            return Array.from(map.values()).sort((a, b) => {
              const dateA = new Date(a.joinedAt || a.createdAt || 0).getTime();
              const dateB = new Date(b.joinedAt || b.createdAt || 0).getTime();
              return dateB - dateA;
            });
          });
        }
      }
    } catch (err) {
      console.warn('[Staff Page] API staff fetch notice:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // 3. Real-time listener on staff subcollection + initial API fetch
  useEffect(() => {
    if (!resolvedRestaurantId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchStaffFromApi(resolvedRestaurantId);

    // Live Snapshot Listener (without fragile orderBy, sorting safely in memory)
    const staffCol = collection(db, 'restaurants', resolvedRestaurantId, 'staff');
    const unsub = onSnapshot(
      staffCol,
      (staffSnap) => {
        const liveList = staffSnap.docs.map((d) => ({ id: d.id, ...d.data() } as StaffMember));
        setStaff((prev) => {
          const map = new Map<string, StaffMember>();
          // Keep whatever we already had from API
          prev.forEach((s) => map.set(s.id, s));
          // Apply live updates from Firestore
          liveList.forEach((s) => map.set(s.id, s));
          return Array.from(map.values()).sort((a, b) => {
            const dateA = new Date(a.joinedAt || a.createdAt || 0).getTime();
            const dateB = new Date(b.joinedAt || b.createdAt || 0).getTime();
            return dateB - dateA;
          });
        });
        setLoading(false);
      },
      (err) => {
        console.warn('[Staff Page] Firestore listener notice (API fallback will serve):', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [resolvedRestaurantId, fetchStaffFromApi]);

  const handleManualRefresh = () => {
    if (!resolvedRestaurantId) return;
    setIsRefreshing(true);
    fetchStaffFromApi(resolvedRestaurantId);
    toast.info('Refreshing staff list...');
  };

  const generateRandomPassword = () => {
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const pass = `Hunger@${randomDigits}`;
    setForm((prev) => ({ ...prev, password: pass }));
    toast.success('Generated strong password: ' + pass);
  };

  const handleRoleSelect = (newRole: 'manager' | 'chef' | 'cashier' | 'helper') => {
    const defaultPerms = DEFAULT_ROLE_PERMISSIONS[newRole] || ['orders'];
    setForm((prev) => ({
      ...prev,
      role: newRole,
      permissions: defaultPerms,
    }));
  };

  const togglePermission = (permId: string) => {
    setForm((prev) => {
      const exists = prev.permissions.includes(permId);
      const updated = exists
        ? prev.permissions.filter((p) => p !== permId)
        : [...prev.permissions, permId];
      return { ...prev, permissions: updated };
    });
  };

  const openAdd = () => {
    setEditing(null);
    const initialPass = `Hunger@${Math.floor(1000 + Math.random() * 9000)}`;
    setForm({
      ...emptyForm,
      password: initialPass,
    });
    setShowPassword(false);
    setDialogOpen(true);
  };

  const openEdit = (s: StaffMember) => {
    setEditing(s);
    setForm({
      name: s.name,
      phone: s.phone || '',
      email: s.email || '',
      password: '', // Empty means keep current password
      role: (s.role || 'helper') as any,
      status: (s.status || 'active') as any,
      salary: s.salary?.toString() || '',
      permissions: Array.isArray(s.permissions) && s.permissions.length > 0
        ? s.permissions
        : DEFAULT_ROLE_PERMISSIONS[s.role] || ['orders'],
    });
    setShowPassword(false);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!resolvedRestaurantId) {
      toast.error('Restaurant ID not identified. Please try again.');
      return;
    }
    if (!form.name.trim()) {
      toast.error('Staff name is required');
      return;
    }
    if (!form.phone.trim()) {
      toast.error('Staff phone number is required');
      return;
    }
    if (!form.email.trim()) {
      toast.error('Staff email address is required');
      return;
    }

    if (!editing && (!form.password || form.password.length < 6)) {
      toast.error('Please enter a password with at least 6 characters');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        // Update via API
        const res = await fetch('/api/restaurant/staff', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            restaurantId: resolvedRestaurantId,
            staffId: editing.id,
            name: form.name.trim(),
            phone: form.phone.trim(),
            role: form.role,
            status: form.status,
            salary: form.salary ? parseFloat(form.salary) : 0,
            permissions: form.permissions,
            password: form.password || undefined,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to update staff member');
        }

        // Optimistic UI update
        setStaff((prev) =>
          prev.map((item) =>
            item.id === editing.id
              ? {
                  ...item,
                  name: form.name.trim(),
                  phone: form.phone.trim(),
                  role: form.role,
                  status: form.status,
                  salary: form.salary ? parseFloat(form.salary) : 0,
                  permissions: form.permissions,
                }
              : item
          )
        );

        toast.success(`Staff member "${form.name}" updated successfully!`);
        setDialogOpen(false);
        fetchStaffFromApi(resolvedRestaurantId);
      } else {
        // Create new staff with Firebase Auth via server API
        let successCreated = false;
        try {
          const res = await fetch('/api/restaurant/staff', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              restaurantId: resolvedRestaurantId,
              name: form.name.trim(),
              email: form.email.trim(),
              password: form.password,
              phone: form.phone.trim(),
              role: form.role,
              status: form.status,
              salary: form.salary ? parseFloat(form.salary) : 0,
              permissions: form.permissions,
            }),
          });

          const data = await res.json();
          if (res.ok && data?.success) {
            successCreated = true;
          } else {
            console.warn('[Staff API Notice]: Server responded with error, falling back:', data?.error);
          }
        } catch (apiErr) {
          console.warn('[Staff API Network Error]: Falling back to client auth:', apiErr);
        }

        // Client fallback if server API was unavailable
        if (!successCreated) {
          const { initializeApp, getApps } = await import('firebase/app');
          const { getAuth, createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth');
          const { doc: fireDoc, setDoc, serverTimestamp } = await import('firebase/firestore');

          const secondaryName = 'SecondaryStaffAuthApp';
          let secondaryApp;
          const existing = getApps().find((a) => a.name === secondaryName);
          if (existing) {
            secondaryApp = existing;
          } else {
            const { auth: primaryAuth } = await import('@/lib/firebase');
            secondaryApp = initializeApp(primaryAuth.app.options, secondaryName);
          }

          const secAuth = getAuth(secondaryApp);
          const cred = await createUserWithEmailAndPassword(secAuth, form.email.trim().toLowerCase(), form.password);
          await updateProfile(cred.user, { displayName: form.name.trim() });
          const uid = cred.user.uid;

          const staffRecord = {
            id: uid,
            uid,
            name: form.name.trim(),
            email: form.email.trim().toLowerCase(),
            phone: form.phone.trim(),
            role: form.role,
            staffRole: form.role,
            status: form.status,
            salary: form.salary ? parseFloat(form.salary) : 0,
            permissions: form.permissions,
            isStaff: true,
            restaurantId: resolvedRestaurantId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            joinedAt: serverTimestamp(),
          };

          await setDoc(fireDoc(db, 'users', uid), staffRecord, { merge: true });
          await setDoc(fireDoc(db, 'restaurants', resolvedRestaurantId, 'staff', uid), staffRecord, { merge: true });
          await secAuth.signOut();
        }

        toast.success(`Staff account created for ${form.name}! 🎉`);
        setDialogOpen(false);

        // Show credentials modal for sharing
        setCreatedCreds({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          role: form.role,
          loginUrl: 'https://shunger.vercel.app/restaurant/staff/dashboard/login',
        });

        fetchStaffFromApi(resolvedRestaurantId);
      }
    } catch (err: any) {
      console.error('[Staff Save Error]:', err);
      toast.error(err.message || 'Failed to save staff member');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickStatusChange = async (s: StaffMember, newStatus: 'active' | 'on_leave' | 'inactive') => {
    if (!resolvedRestaurantId) return;
    try {
      // Optimistic update
      setStaff((prev) => prev.map((item) => (item.id === s.id ? { ...item, status: newStatus } : item)));

      const res = await fetch('/api/restaurant/staff', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: resolvedRestaurantId,
          staffId: s.id,
          status: newStatus,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to update status');
      }
      toast.success(`${s.name}'s status changed to ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
    } catch (err: any) {
      toast.error('Could not update status');
      fetchStaffFromApi(resolvedRestaurantId);
    }
  };

  const handleQuickPasswordReset = async () => {
    if (!resetModalStaff || !resolvedRestaurantId) return;
    if (!newPasswordValue || newPasswordValue.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    setResettingPassword(true);
    try {
      const res = await fetch('/api/restaurant/staff', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: resolvedRestaurantId,
          staffId: resetModalStaff.id,
          password: newPasswordValue,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      toast.success(`Password updated for ${resetModalStaff.name}!`);
      const updatedCreds = {
        name: resetModalStaff.name,
        email: resetModalStaff.email || '',
        password: newPasswordValue,
        role: resetModalStaff.role,
        loginUrl: 'https://shunger.vercel.app/restaurant/staff/dashboard/login',
      };
      setResetModalStaff(null);
      setNewPasswordValue('');
      setCreatedCreds(updatedCreds);
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset password');
    } finally {
      setResettingPassword(false);
    }
  };

  const handleDelete = async (s: StaffMember) => {
    if (!confirm(`Are you sure you want to remove ${s.name}? They will lose access to the staff portal.`)) {
      return;
    }

    setDeletingId(s.id);
    try {
      // Optimistic delete
      setStaff((prev) => prev.filter((item) => item.id !== s.id));

      const res = await fetch(`/api/restaurant/staff?restaurantId=${resolvedRestaurantId}&staffId=${s.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete staff member');
      }
      toast.success(`${s.name} has been removed from staff.`);
    } catch (err: any) {
      console.error('[Staff Delete Error]:', err);
      toast.error(err.message || 'Failed to remove staff');
      fetchStaffFromApi(resolvedRestaurantId);
    } finally {
      setDeletingId(null);
    }
  };

  // Safe clipboard copy handler
  const handleCopyCredentials = async () => {
    if (!createdCreds) return;
    const text = `🍽️ *Hunger Staff Portal Login*\n\n👤 *Name:* ${createdCreds.name}\n💼 *Role:* ${createdCreds.role.toUpperCase()}\n📧 *Email:* ${createdCreds.email}\n🔑 *Password:* ${createdCreds.password || 'Existing Password'}\n\n🔗 *Login Portal:*\n${createdCreds.loginUrl}\n\n📱 *Access:* Sign in using the email & password above to access your assigned kitchen modules.`;
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      toast.success('Credentials copied to clipboard! Ready to send on WhatsApp or SMS.');
      setTimeout(() => setCopied(false), 3000);
    } else {
      toast.error('Unable to auto-copy. Please select and copy the text manually.');
    }
  };

  const handleShareWhatsApp = (s: StaffMember) => {
    const text = `🍽️ *Hunger Staff Portal Access*\n\nHello ${s.name},\nHere is your crew access details:\n\n💼 *Role:* ${s.role.toUpperCase()}\n📧 *Email:* ${s.email || 'N/A'}\n🔗 *Login Portal:* https://shunger.vercel.app/restaurant/staff/dashboard/login\n\nPlease log in to access your assigned kitchen features.`;
    const cleanPhone = (s.phone || '').replace(/[^0-9]/g, '');
    const url = cleanPhone.length >= 10
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // Filtered & computed staff list
  const filtered = useMemo(() => {
    return staff.filter((s) => {
      const matchSearch =
        !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.email && s.email.toLowerCase().includes(search.toLowerCase())) ||
        (s.phone && s.phone.includes(search)) ||
        s.role.toLowerCase().includes(search.toLowerCase());

      const matchRole = selectedRoleFilter === 'all' || s.role === selectedRoleFilter;
      const matchStatus = selectedStatusFilter === 'all' || s.status === selectedStatusFilter;
      return matchSearch && matchRole && matchStatus;
    });
  }, [staff, search, selectedRoleFilter, selectedStatusFilter]);

  const activeCount = staff.filter((s) => s.status === 'active').length;
  const onLeaveCount = staff.filter((s) => s.status === 'on_leave').length;
  const chefCount = staff.filter((s) => s.role === 'chef').length;
  const totalPayroll = staff.reduce((acc, curr) => acc + (curr.salary || 0), 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/20 shadow-sm">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
                Staff Management & Access Control
              </h1>
              <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
                Manage crew logins, assign roles, grant granular module permissions, and control kitchen shifts.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="rounded-xl gap-1.5 text-xs font-semibold h-10"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-purple-500' : ''}`} />
            Refresh List
          </Button>

          <Button
            asChild
            variant="outline"
            className="rounded-xl gap-2 text-xs font-semibold h-10 border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10"
          >
            <a
              href="/restaurant/staff/dashboard/login"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Staff Login Portal
            </a>
          </Button>

          <Button
            onClick={openAdd}
            className="bg-gradient-to-r from-purple-600 via-indigo-600 to-primary hover:from-purple-700 hover:to-primary text-white font-bold rounded-xl gap-2 h-10 shadow-lg shadow-purple-500/20"
          >
            <Plus className="w-4 h-4" /> Add New Staff Member
          </Button>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {[
          { label: 'Total Crew', value: staff.length, sub: 'Registered members', icon: Users, color: 'from-blue-600 to-indigo-600' },
          { label: 'Active on Duty', value: activeCount, sub: 'Currently working', icon: UserCheck, color: 'from-emerald-500 to-teal-600' },
          { label: 'On Leave', value: onLeaveCount, sub: 'Off duty shifts', icon: AlertCircle, color: 'from-amber-500 to-orange-600' },
          { label: 'Kitchen Chefs', value: chefCount, sub: 'Head & prep chefs', icon: ChefHat, color: 'from-rose-500 to-pink-600' },
          { label: 'Monthly Payroll', value: `₹${totalPayroll.toLocaleString('en-IN')}`, sub: 'Estimated monthly', icon: IndianRupee, color: 'from-violet-600 to-purple-700' },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i} className="border-border/60 shadow-sm overflow-hidden relative">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">{stat.label}</p>
                  <p className="text-xl sm:text-2xl font-black mt-0.5 text-foreground">{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground/80 mt-0.5">{stat.sub}</p>
                </div>
                <div className={`w-10 h-10 rounded-2xl bg-gradient-to-tr ${stat.color} text-white flex items-center justify-center shadow-md shrink-0`}>
                  <Icon className="w-4 h-4" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Staff Login Link Notice Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-500/10 via-indigo-500/5 to-transparent border border-purple-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-purple-500/20">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">
              Official Staff Portal URL (Share with Team):
            </p>
            <p className="text-xs font-mono text-purple-600 dark:text-purple-400 select-all font-semibold">
              https://shunger.vercel.app/restaurant/staff/dashboard/login
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const ok = await copyToClipboard('https://shunger.vercel.app/restaurant/staff/dashboard/login');
              if (ok) toast.success('Staff portal link copied to clipboard!');
            }}
            className="rounded-xl gap-1.5 text-xs font-semibold shrink-0 flex-1 sm:flex-none h-9"
          >
            <Copy className="w-3.5 h-3.5" /> Copy Link
          </Button>
          <Button
            size="sm"
            asChild
            className="rounded-xl gap-1.5 text-xs font-bold shrink-0 bg-purple-600 hover:bg-purple-700 text-white flex-1 sm:flex-none h-9"
          >
            <a href="/restaurant/staff/dashboard/login" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3.5 h-3.5" /> Open Portal
            </a>
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, phone, or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10 rounded-xl bg-card border-border/70 text-xs sm:text-sm"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 flex-wrap">
          {/* Role Filter */}
          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/60">
            {['all', 'manager', 'chef', 'cashier', 'helper'].map((r) => (
              <Button
                key={r}
                variant={selectedRoleFilter === r ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedRoleFilter(r)}
                className={`rounded-lg text-xs capitalize font-semibold h-8 px-2.5 ${
                  selectedRoleFilter === r
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {r === 'all' ? 'All Roles' : r}
              </Button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/60">
            {[
              { val: 'all', label: 'All Shifts' },
              { val: 'active', label: 'Active' },
              { val: 'on_leave', label: 'On Leave' },
              { val: 'inactive', label: 'Inactive' },
            ].map((s) => (
              <Button
                key={s.val}
                variant={selectedStatusFilter === s.val ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedStatusFilter(s.val)}
                className={`rounded-lg text-xs font-semibold h-8 px-2.5 ${
                  selectedStatusFilter === s.val
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {s.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Staff Grid */}
      {loading ? (
        <div className="flex flex-col justify-center items-center py-20 space-y-3">
          <Loader2 className="w-9 h-9 animate-spin text-purple-600" />
          <p className="text-xs text-muted-foreground font-medium animate-pulse">Loading crew members & permissions...</p>
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-2 p-12 text-center bg-card/40">
          <Users className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          <h3 className="text-lg font-bold text-foreground">No Staff Members Found</h3>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            {search || selectedRoleFilter !== 'all' || selectedStatusFilter !== 'all'
              ? 'No staff members match the selected filters. Try clearing your search.'
              : 'You have not added any staff members yet. Add your crew members now to grant them portal access with automatic Firebase Auth.'}
          </p>
          <div className="flex items-center justify-center gap-2 mt-5">
            {(search || selectedRoleFilter !== 'all' || selectedStatusFilter !== 'all') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setSelectedRoleFilter('all');
                  setSelectedStatusFilter('all');
                }}
                className="rounded-xl text-xs"
              >
                Clear Filters
              </Button>
            )}
            <Button onClick={openAdd} className="rounded-xl gap-2 text-xs bg-purple-600 hover:bg-purple-700 text-white font-bold">
              <Plus className="w-4 h-4" /> Add Crew Member
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <AnimatePresence>
            {filtered.map((s) => {
              const roleMeta = ROLES.find((r) => r.value === s.role) || ROLES[3];
              const RoleIcon = roleMeta.icon;
              const statusCfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.active;
              const permissionsCount = Array.isArray(s.permissions) ? s.permissions.length : 0;

              return (
                <motion.div
                  key={s.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                >
                  <Card className="border-border/70 shadow-sm hover:shadow-md transition-all relative overflow-hidden group hover:border-purple-500/40 bg-card">
                    <CardHeader className="p-5 pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${roleMeta.color} text-white flex items-center justify-center shadow-md shrink-0 font-black text-lg`}>
                            {s.name ? s.name.charAt(0).toUpperCase() : <RoleIcon className="w-5 h-5" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-base font-bold text-foreground leading-tight">
                                {s.name}
                              </CardTitle>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className={`text-[10px] uppercase font-bold tracking-wider gap-1.5 py-0 px-2 border ${statusCfg.color}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot} animate-pulse`} />
                                {statusCfg.label.split(' ')[0]}
                              </Badge>
                              <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-wider py-0 px-2 ${roleMeta.badgeColor}`}>
                                {roleMeta.label}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        {/* Dropdown Options */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 rounded-xl">
                            <DropdownMenuItem onClick={() => setSelectedStaffDetails(s)} className="text-xs font-semibold gap-2">
                              <Eye className="w-3.5 h-3.5 text-purple-500" /> View Full Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(s)} className="text-xs font-semibold gap-2">
                              <Edit2 className="w-3.5 h-3.5 text-blue-500" /> Edit Permissions
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setResetModalStaff(s);
                                setNewPasswordValue(`Hunger@${Math.floor(1000 + Math.random() * 9000)}`);
                              }}
                              className="text-xs font-semibold gap-2"
                            >
                              <KeyRound className="w-3.5 h-3.5 text-amber-500" /> Reset Password
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleShareWhatsApp(s)} className="text-xs font-semibold gap-2">
                              <MessageCircle className="w-3.5 h-3.5 text-emerald-500" /> Send via WhatsApp
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              Quick Shift Status
                            </div>
                            <DropdownMenuItem
                              onClick={() => handleQuickStatusChange(s, 'active')}
                              className="text-xs gap-2 font-medium"
                            >
                              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Set Active
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleQuickStatusChange(s, 'on_leave')}
                              className="text-xs gap-2 font-medium"
                            >
                              <span className="w-2 h-2 rounded-full bg-amber-500" /> Set On Leave
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleQuickStatusChange(s, 'inactive')}
                              className="text-xs gap-2 font-medium"
                            >
                              <span className="w-2 h-2 rounded-full bg-rose-500" /> Set Inactive
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDelete(s)}
                              className="text-xs font-semibold text-rose-600 dark:text-rose-400 gap-2"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Remove Member
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>

                    <CardContent className="p-5 pt-1 space-y-3">
                      {/* Contact & Employment Details */}
                      <div className="space-y-1.5 text-xs text-muted-foreground pt-2 border-t border-border/50">
                        {s.email && (
                          <div className="flex items-center justify-between group/email">
                            <div className="flex items-center gap-2 truncate">
                              <Mail className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0" />
                              <span className="truncate font-mono select-all text-[11px]">{s.email}</span>
                            </div>
                            <button
                              onClick={async () => {
                                if (s.email) {
                                  await copyToClipboard(s.email);
                                  toast.success('Email copied: ' + s.email);
                                }
                              }}
                              className="opacity-0 group-hover/email:opacity-100 transition-opacity p-0.5 hover:text-foreground text-muted-foreground"
                              title="Copy Email"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0" />
                            <a href={`tel:${s.phone}`} className="hover:underline hover:text-foreground font-mono text-[11px]">
                              {s.phone}
                            </a>
                          </div>
                          {s.phone && (
                            <button
                              onClick={() => handleShareWhatsApp(s)}
                              className="text-emerald-600 hover:text-emerald-700 text-[11px] font-semibold flex items-center gap-1"
                              title="WhatsApp Chat"
                            >
                              <MessageCircle className="w-3 h-3" /> Chat
                            </button>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center gap-1.5 text-foreground font-medium">
                            <span className="text-[11px] text-muted-foreground">Salary:</span>
                            <span className="font-bold text-xs">
                              {s.salary ? `₹${s.salary.toLocaleString('en-IN')}/mo` : 'Not Set'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Calendar className="w-3 h-3 text-muted-foreground/60" />
                            <span>{formatDate(s.joinedAt || s.createdAt)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Permissions Pills */}
                      <div className="pt-2 border-t border-border/50">
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                            Permissions ({permissionsCount} / {AVAILABLE_PERMISSIONS.length})
                          </p>
                          <button
                            onClick={() => setSelectedStaffDetails(s)}
                            className="text-[10px] text-purple-600 dark:text-purple-400 hover:underline font-bold"
                          >
                            View All
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {s.permissions && s.permissions.length > 0 ? (
                            s.permissions.slice(0, 3).map((p) => {
                              const pMeta = AVAILABLE_PERMISSIONS.find((m) => m.id === p);
                              return (
                                <span
                                  key={p}
                                  className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-muted text-foreground border border-border/60"
                                >
                                  {pMeta ? pMeta.label.split(' ')[0] : p}
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-[10px] text-muted-foreground">Standard basic access</span>
                          )}
                          {permissionsCount > 3 && (
                            <button
                              onClick={() => setSelectedStaffDetails(s)}
                              className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20"
                            >
                              +{permissionsCount - 3} more
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="flex items-center justify-between pt-3 border-t border-border/50 gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            const shareText = `🍽️ Hunger Staff Login\nRole: ${s.role.toUpperCase()}\nEmail: ${s.email || 'N/A'}\nLogin Link: https://shunger.vercel.app/restaurant/staff/dashboard/login`;
                            await copyToClipboard(shareText);
                            toast.success('Login details copied for ' + s.name);
                          }}
                          className="h-8 px-2 text-xs font-bold text-purple-600 dark:text-purple-400 gap-1.5 hover:bg-purple-500/10"
                        >
                          <Copy className="w-3 h-3" /> Copy Login
                        </Button>

                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEdit(s)}
                            className="h-8 px-2.5 rounded-lg text-xs font-semibold gap-1"
                          >
                            <Edit2 className="w-3.5 h-3.5" /> Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={deletingId === s.id}
                            onClick={() => handleDelete(s)}
                            className="h-8 px-2.5 rounded-lg text-xs"
                          >
                            {deletingId === s.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Add / Edit Staff Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-black flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" />
              {editing ? `Edit ${editing.name}` : 'Add New Staff Member'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {editing
                ? 'Update role assignment, granular module permissions, or reset their login password.'
                : 'Enter name, contact, password, and role. Firebase Auth and access credentials will be created automatically.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Name & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="staff-name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Full Name *
                </Label>
                <Input
                  id="staff-name"
                  placeholder="e.g. Ramesh Kumar"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="staff-phone" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Phone Number *
                </Label>
                <Input
                  id="staff-phone"
                  placeholder="e.g. 9876543210"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="rounded-xl"
                />
              </div>
            </div>

            {/* Email & Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="staff-email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Staff Email * {editing && <span className="text-[10px] text-muted-foreground">(Primary ID)</span>}
                </Label>
                <Input
                  id="staff-email"
                  type="email"
                  placeholder="staff@restaurant.com"
                  value={form.email}
                  disabled={!!editing}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="rounded-xl font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="staff-pass" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {editing ? 'New Password (Optional)' : 'Login Password *'}
                  </Label>
                  {!editing && (
                    <button
                      type="button"
                      onClick={generateRandomPassword}
                      className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 font-semibold"
                    >
                      <RefreshCw className="w-3 h-3" /> Auto Strong
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="staff-pass"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={editing ? 'Leave empty to keep current' : 'Min 6 characters'}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="rounded-xl pr-9 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Role Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Staff Role & Default Profile *
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ROLES.map((r) => {
                  const Icon = r.icon;
                  const isSelected = form.role === r.value;
                  return (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => handleRoleSelect(r.value as any)}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        isSelected
                          ? 'border-purple-600 bg-purple-500/10 shadow-sm ring-2 ring-purple-600/20'
                          : 'border-border/70 hover:bg-muted/50'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl bg-gradient-to-tr ${r.color} text-white flex items-center justify-center mb-2 shadow-sm`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <p className="font-bold text-xs text-foreground">{r.label}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{r.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Granular Permissions Checkboxes */}
            <div className="space-y-2 pt-2 border-t border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Assigned Module Permissions ({form.permissions.length} Selected)
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Customize what this crew member can view and operate in the staff portal
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const allPermIds = AVAILABLE_PERMISSIONS.map((p) => p.id);
                    const isAll = form.permissions.length === allPermIds.length;
                    setForm({ ...form, permissions: isAll ? ['orders'] : allPermIds });
                  }}
                  className="text-xs h-7 text-purple-600 dark:text-purple-400 font-bold"
                >
                  {form.permissions.length === AVAILABLE_PERMISSIONS.length ? 'Reset to Min' : 'Select All'}
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1.5 border rounded-xl bg-muted/20">
                {AVAILABLE_PERMISSIONS.map((p) => {
                  const isChecked = form.permissions.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${
                        isChecked ? 'bg-purple-500/10 border border-purple-500/30' : 'hover:bg-muted/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => togglePermission(p.id)}
                        className="mt-0.5 rounded text-purple-600 focus:ring-purple-500 shrink-0"
                      />
                      <div>
                        <p className="text-xs font-bold text-foreground leading-tight">{p.label}</p>
                        <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{p.desc}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Status & Salary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/50">
              <div className="space-y-1.5">
                <Label htmlFor="staff-status" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Shift Duty Status
                </Label>
                <select
                  id="staff-status"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                  className="w-full h-10 px-3 rounded-xl border border-input bg-background text-xs font-semibold focus:ring-2 focus:ring-purple-500"
                >
                  <option value="active">Active (On Duty)</option>
                  <option value="on_leave">On Leave</option>
                  <option value="inactive">Inactive (Suspended)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="staff-salary" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Monthly Salary (₹ Optional)
                </Label>
                <Input
                  id="staff-salary"
                  type="number"
                  placeholder="e.g. 18000"
                  value={form.salary}
                  onChange={(e) => setForm({ ...form, salary: e.target.value })}
                  className="rounded-xl text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving} className="rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl gap-2 font-bold shadow-md shadow-purple-500/20"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                </>
              ) : editing ? (
                'Update Staff'
              ) : (
                'Confirm & Create Staff'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Staff Full Profile Details Modal */}
      <Dialog open={!!selectedStaffDetails} onOpenChange={() => setSelectedStaffDetails(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedStaffDetails && (
            <div>
              <DialogHeader className="pb-3 border-b border-border/60">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${ROLES.find(r => r.value === selectedStaffDetails.role)?.color || 'from-purple-600 to-indigo-600'} text-white flex items-center justify-center font-black text-xl shadow-md`}>
                    {selectedStaffDetails.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-black">{selectedStaffDetails.name}</DialogTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="capitalize text-xs font-bold">
                        {selectedStaffDetails.role}
                      </Badge>
                      <Badge variant="outline" className={`text-xs font-bold ${STATUS_CONFIG[selectedStaffDetails.status]?.color}`}>
                        {STATUS_CONFIG[selectedStaffDetails.status]?.label}
                      </Badge>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="py-4 space-y-4">
                {/* Meta details */}
                <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-muted/40 border border-border/60 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px] font-semibold">Email:</span>
                    <span className="font-mono font-bold text-foreground select-all break-all">{selectedStaffDetails.email || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px] font-semibold">Phone:</span>
                    <span className="font-mono font-bold text-foreground select-all">{selectedStaffDetails.phone}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px] font-semibold">Monthly Salary:</span>
                    <span className="font-bold text-foreground">
                      {selectedStaffDetails.salary ? `₹${selectedStaffDetails.salary.toLocaleString('en-IN')}` : 'Not Specified'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px] font-semibold">Joined Date:</span>
                    <span className="font-bold text-foreground">{formatDate(selectedStaffDetails.joinedAt || selectedStaffDetails.createdAt)}</span>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-border/50">
                    <span className="text-muted-foreground block text-[11px] font-semibold">Staff UID:</span>
                    <span className="font-mono text-[10px] text-muted-foreground select-all break-all">{selectedStaffDetails.id}</span>
                  </div>
                </div>

                {/* Permissions Breakdown */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Granted Module Access ({selectedStaffDetails.permissions?.length || 0} / {AVAILABLE_PERMISSIONS.length})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {AVAILABLE_PERMISSIONS.map((p) => {
                      const hasPerm = selectedStaffDetails.permissions?.includes(p.id);
                      return (
                        <div
                          key={p.id}
                          className={`p-2.5 rounded-xl border flex items-start gap-2.5 ${
                            hasPerm
                              ? 'bg-emerald-500/10 border-emerald-500/30'
                              : 'bg-muted/20 border-border/40 opacity-50'
                          }`}
                        >
                          {hasPerm ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          ) : (
                            <Lock className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                          )}
                          <div>
                            <p className="text-xs font-bold text-foreground leading-tight">{p.label}</p>
                            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{p.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Actions inside modal */}
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    onClick={() => {
                      const s = selectedStaffDetails;
                      setSelectedStaffDetails(null);
                      openEdit(s);
                    }}
                    className="flex-1 rounded-xl text-xs font-bold gap-1.5"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Edit Member
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleShareWhatsApp(selectedStaffDetails)}
                    className="flex-1 rounded-xl text-xs font-bold gap-1.5 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> Send Login on WhatsApp
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Quick Password Reset Dialog */}
      <Dialog open={!!resetModalStaff} onOpenChange={() => setResetModalStaff(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-amber-500" />
              Reset Password for {resetModalStaff?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Enter a new login password for {resetModalStaff?.email}. This will update their Firebase Auth account immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="new-pass" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  New Password *
                </Label>
                <button
                  type="button"
                  onClick={() => setNewPasswordValue(`Hunger@${Math.floor(1000 + Math.random() * 9000)}`)}
                  className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  <RefreshCw className="w-3 h-3" /> Auto Generate
                </button>
              </div>
              <div className="relative">
                <Input
                  id="new-pass"
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="Min 6 characters"
                  value={newPasswordValue}
                  onChange={(e) => setNewPasswordValue(e.target.value)}
                  className="rounded-xl pr-9 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setResetModalStaff(null)} disabled={resettingPassword} className="rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={handleQuickPasswordReset}
              disabled={resettingPassword}
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl gap-2 font-bold"
            >
              {resettingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Created Credentials Modal */}
      <Dialog open={!!createdCreds} onOpenChange={() => setCreatedCreds(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader className="text-center pb-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-emerald-500 text-white flex items-center justify-center mx-auto mb-3 shadow-lg shadow-purple-500/25">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <DialogTitle className="text-2xl font-black">Staff Account Ready!</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Firebase Auth login is active. Send these credentials to {createdCreds?.name}.
            </DialogDescription>
          </DialogHeader>

          {createdCreds && (
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-2xl bg-muted/50 border border-border/80 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-semibold">Staff Name:</span>
                  <span className="font-bold text-foreground">{createdCreds.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-semibold">Assigned Role:</span>
                  <Badge variant="secondary" className="capitalize text-xs font-bold bg-purple-500/10 text-purple-600">
                    {createdCreds.role}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-semibold">Email (Login ID):</span>
                  <span className="font-mono font-bold text-foreground select-all">{createdCreds.email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-semibold">Password:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 select-all">{createdCreds.password || 'Existing Password'}</span>
                </div>
                <div className="pt-2 border-t border-border/60">
                  <span className="text-[11px] text-muted-foreground font-semibold block mb-1">Staff Portal Link:</span>
                  <p className="font-mono text-[11px] text-purple-600 dark:text-purple-400 break-all select-all font-semibold">
                    {createdCreds.loginUrl}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  onClick={handleCopyCredentials}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-xl gap-2 h-11 shadow-md shadow-purple-500/20"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied to Clipboard!' : 'Copy Credentials for WhatsApp / SMS'}
                </Button>

                <Button
                  onClick={() => {
                    const text = `🍽️ *Hunger Staff Portal Login*\n\n👤 *Name:* ${createdCreds.name}\n💼 *Role:* ${createdCreds.role.toUpperCase()}\n📧 *Email:* ${createdCreds.email}\n🔑 *Password:* ${createdCreds.password || 'Existing Password'}\n\n🔗 *Login Portal:*\n${createdCreds.loginUrl}\n\n📱 *Access:* Sign in using the email & password above.`;
                    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
                  }}
                  variant="outline"
                  className="w-full rounded-xl gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 border-emerald-500/30 h-10 hover:bg-emerald-500/10"
                >
                  <MessageCircle className="w-4 h-4" /> Send via WhatsApp
                </Button>

                <Button
                  asChild
                  variant="ghost"
                  className="w-full rounded-xl gap-2 text-xs text-muted-foreground hover:text-foreground h-9"
                >
                  <a href="/restaurant/staff/dashboard/login" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5" /> Test Staff Login in New Window
                  </a>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
