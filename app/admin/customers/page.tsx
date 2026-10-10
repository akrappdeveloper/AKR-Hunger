'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Search, Ban, CheckCircle2, MoreVertical, Eye, ShieldAlert, Mail, Phone, CreditCard, ShoppingBag, MapPin, Edit } from 'lucide-react';
import { toast } from 'sonner';

import { DataTable, ColumnDef } from '@/components/admin/DataTable';
import { AdminDialog } from '@/components/admin/AdminDialog';
import { ProtectedRoute } from '@/components/admin/ProtectedRoute';
import { CustomerService } from '@/lib/services/CustomerService';
import { Customer } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export default function AdminCustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [viewDialogState, setViewDialogState] = useState<{ open: boolean; customer: Customer | null }>({ open: false, customer: null });
  const [editForm, setEditForm] = useState<Partial<Customer>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = CustomerService.listenAllCustomers(data => {
      setCustomers(data);
      setLoading(false);
    }, (error) => {
      console.error(error);
      toast.error('Failed to load customers');
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleToggleBlockStatus = async (id: string, currentStatus: boolean) => {
    try {
      await CustomerService.toggleBlockStatus(id, currentStatus);
      toast.success(currentStatus ? 'Customer unblocked successfully' : 'Customer blocked successfully');
    } catch {
      toast.error('Failed to update status');
    }
  };

  const columns: ColumnDef<Customer>[] = [
    {
      header: 'Customer',
      cell: (row) => (
        <div 
          className="flex items-center gap-3 cursor-pointer hover:bg-card/5 p-2 -m-2 rounded-lg transition-colors"
          onClick={() => router.push(`/admin/customers/${row.id}`)}
        >
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold border border-blue-500/30">
            {row.name?.charAt(0) || 'U'}
          </div>
          <div>
            <p className="font-semibold text-foreground hover:text-blue-400 transition-colors">{row.name || 'Unknown'}</p>
            <p className="text-xs text-muted-foreground">{row.email || 'No email'}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Contact',
      cell: (row) => (
        <div>
          <p className="text-sm text-foreground">{row.phone || 'N/A'}</p>
          <p className="text-xs text-muted-foreground flex items-center mt-1">
            {row.phoneVerified ? <CheckCircle2 className="w-3 h-3 text-emerald-400 mr-1" /> : <ShieldAlert className="w-3 h-3 text-amber-400 mr-1" />}
            {row.phoneVerified ? 'Verified' : 'Unverified'}
          </p>
        </div>
      ),
    },
    {
      header: 'Status',
      cell: (row) => (
        row.isBlocked ? (
          <Badge variant="outline" className="bg-rose-500/10 text-rose-400 border-rose-500/20">Blocked</Badge>
        ) : (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Active</Badge>
        )
      ),
    },
    {
      header: 'Wallet Balance',
      cell: (row) => (
        <p className="font-medium text-foreground">₹{row.walletBalance || 0}</p>
      ),
    },
    {
      header: 'Actions',
      className: 'text-right',
      cell: (row) => (
        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 hover:bg-card/10 text-muted-foreground"
            onClick={(e) => {
              e.stopPropagation();
              setViewDialogState({ open: true, customer: row });
              setEditForm(row);
            }}
          >
            <Edit className="h-4 w-4 text-blue-400" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-card/10 text-muted-foreground">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-card border-border/50 text-foreground">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation();
                setViewDialogState({ open: true, customer: row });
                setEditForm(row);
              }} className="hover:bg-secondary hover:text-foreground cursor-pointer">
              <Edit className="w-4 h-4 mr-2" /> Edit Profile
            </DropdownMenuItem>
            
            <DropdownMenuSeparator className="bg-secondary" />
            
            <DropdownMenuLabel>Management</DropdownMenuLabel>
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation();
                handleToggleBlockStatus(row.id!, row.isBlocked || false);
              }} className="hover:bg-secondary hover:text-foreground cursor-pointer">
                {row.isBlocked ? (
                  <><CheckCircle2 className="w-4 h-4 mr-2 text-emerald-400" /> Unblock User</>
                ) : (
                  <><Ban className="w-4 h-4 mr-2 text-rose-400" /> Block User</>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  const filteredCustomers = customers.filter(c => 
    c.name?.toLowerCase().includes(search.toLowerCase()) || 
    c.email?.toLowerCase().includes(search.toLowerCase()) || 
    c.phone?.includes(search)
  );

  const stats = {
    total: customers.length,
    active: customers.filter(c => !c.isBlocked).length,
    blocked: customers.filter(c => c.isBlocked).length,
    totalWallet: customers.reduce((sum, c) => sum + (c.walletBalance || 0), 0),
  };

  const handleSaveEdit = async () => {
    if (!viewDialogState.customer?.id) return;
    setSaving(true);
    try {
      const updates = {
        name: editForm.name,
        email: editForm.email,
        phone: editForm.phone,
        walletBalance: Number(editForm.walletBalance) || 0,
      };
      await CustomerService.updateCustomer(viewDialogState.customer.id, updates);
      toast.success('Customer profile updated');
      setViewDialogState({ open: false, customer: null });
    } catch {
      toast.error('Failed to update customer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['super_admin', 'operations_admin', 'support_admin']}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2 flex items-center gap-2">
              <Users className="w-8 h-8 text-blue-500" /> Customer Management
            </h1>
            <p className="text-muted-foreground">View customer accounts, monitor statuses, and manage access.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-background/40 border-border/50 backdrop-blur-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Customers</p>
                  <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-background/40 border-border/50 backdrop-blur-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold text-foreground">{stats.active}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-background/40 border-border/50 backdrop-blur-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-rose-500/20 flex items-center justify-center">
                  <Ban className="w-6 h-6 text-rose-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Blocked</p>
                  <p className="text-2xl font-bold text-foreground">{stats.blocked}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-background/40 border-border/50 backdrop-blur-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Wallet Bal</p>
                  <p className="text-2xl font-bold text-foreground">₹{stats.totalWallet}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DataTable
          columns={columns}
          data={filteredCustomers}
          loading={loading}
          searchValue={search}
          onSearch={setSearch}
          searchPlaceholder="Search customers by name, email, or phone..."
          onRowClick={(row) => {
            router.push(`/admin/customers/${row.id}`);
          }}
        />

        <AdminDialog
          title="Customer Profile"
          description={`Edit details for ${viewDialogState.customer?.name}`}
          isOpen={viewDialogState.open}
          onClose={() => setViewDialogState({ open: false, customer: null })}
        >
          {viewDialogState.customer && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input 
                    value={editForm.name || ''} 
                    onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                    className="bg-card/5 border-border/50 text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input 
                    type="email"
                    value={editForm.email || ''} 
                    onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                    className="bg-card/5 border-border/50 text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input 
                    type="tel"
                    value={editForm.phone || ''} 
                    onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                    className="bg-card/5 border-border/50 text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Wallet Balance (₹)</Label>
                  <Input 
                    type="number"
                    value={editForm.walletBalance || 0} 
                    onChange={e => setEditForm(f => ({ ...f, walletBalance: Number(e.target.value) }))}
                    className="bg-card/5 border-border/50 text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-card/5 p-4 rounded-xl border border-border/50">
                <div>
                  <p className="text-sm text-muted-foreground flex items-center"><ShoppingBag className="w-4 h-4 mr-2"/> Total Orders</p>
                  <p className="font-medium text-foreground">{viewDialogState.customer.orders?.length || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground flex items-center"><MapPin className="w-4 h-4 mr-2"/> Saved Addresses</p>
                  <p className="font-medium text-foreground">{viewDialogState.customer.addresses?.length || 0}</p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
                <Button variant="ghost" onClick={() => setViewDialogState({ open: false, customer: null })}>
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit} disabled={saving} className="bg-blue-600 hover:bg-blue-500 text-foreground">
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          )}
        </AdminDialog>
      </div>
    </ProtectedRoute>
  );
}
