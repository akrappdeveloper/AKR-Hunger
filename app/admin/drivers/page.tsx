'use client';

import { useState, useEffect } from 'react';
import { Truck, Search, ShieldCheck, ShieldAlert, CheckCircle2, XCircle, MoreVertical, Ban, Check, Eye } from 'lucide-react';
import { toast } from 'sonner';

import { DataTable, ColumnDef } from '@/components/admin/DataTable';
import { AdminDialog } from '@/components/admin/AdminDialog';
import { ProtectedRoute } from '@/components/admin/ProtectedRoute';
import { DeliveryService } from '@/lib/services/DeliveryService';
import { DeliveryPerson } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  online: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  inactive: 'bg-gray-500/10 text-muted-foreground border-border/20',
  offline: 'bg-gray-500/10 text-muted-foreground border-border/20',
  suspended: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

export default function AdminDriversPage() {
  const [drivers, setDrivers] = useState<DeliveryPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [viewDialogState, setViewDialogState] = useState<{ open: boolean; driver: DeliveryPerson | null }>({ open: false, driver: null });

  useEffect(() => {
    const unsub = DeliveryService.listenAllPartners(data => {
      setDrivers(data);
      setLoading(false);
    }, (error) => {
      console.error(error);
      toast.error('Failed to load drivers');
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const updateDriverStatus = async (id: string, status: DeliveryPerson['status']) => {
    try {
      await DeliveryService.updatePartner(id, { status });
      toast.success(`Driver status updated to ${status}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleKycAction = async (id: string, action: 'approved' | 'rejected') => {
    try {
      await DeliveryService.verifyKyc(id, action);
      toast.success(`KYC ${action}`);
    } catch {
      toast.error(`Failed to ${action} KYC`);
    }
  };

  const columns: ColumnDef<DeliveryPerson>[] = [
    {
      header: 'Driver',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold border border-blue-500/30">
            {row.name.charAt(0)}
          </div>
          <div>
            <p className="font-semibold text-foreground">{row.name}</p>
            <p className="text-xs text-muted-foreground">{row.phone}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Vehicle',
      cell: (row) => (
        <div>
          <p className="text-sm text-foreground capitalize">{row.vehicle || 'Unknown'}</p>
          <p className="text-xs text-muted-foreground uppercase">{row.vehicleNumber}</p>
        </div>
      ),
    },
    {
      header: 'Status',
      cell: (row) => (
        <Badge variant="outline" className={STATUS_COLORS[row.status || 'pending'] || STATUS_COLORS['pending']}>
          {row.status?.toUpperCase() || 'PENDING'}
        </Badge>
      ),
    },
    {
      header: 'Verification',
      cell: (row) => (
        <div className="flex items-center gap-2">
          {row.isVerified ? (
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
              <ShieldCheck className="w-3 h-3 mr-1" /> Verified
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20">
              <ShieldAlert className="w-3 h-3 mr-1" /> Unverified
            </Badge>
          )}
        </div>
      ),
    },
    {
      header: 'Actions',
      className: 'text-right',
      cell: (row) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-card/10 text-muted-foreground">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-card border-border/50 text-foreground">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setViewDialogState({ open: true, driver: row }); }} className="hover:bg-secondary hover:text-foreground cursor-pointer">
                <Eye className="w-4 h-4 mr-2" /> View Details
              </DropdownMenuItem>
              
              <DropdownMenuSeparator className="bg-secondary" />
              
              <DropdownMenuLabel>KYC Verification</DropdownMenuLabel>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleKycAction(row.id, 'approved'); }} disabled={row.isVerified} className="hover:bg-secondary hover:text-foreground cursor-pointer">
                <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-400" /> Approve KYC
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleKycAction(row.id, 'rejected'); }} disabled={row.kycStatus === 'rejected'} className="hover:bg-secondary hover:text-foreground cursor-pointer">
                <XCircle className="w-4 h-4 mr-2 text-rose-400" /> Reject KYC
              </DropdownMenuItem>
              
              <DropdownMenuSeparator className="bg-secondary" />
              
              <DropdownMenuLabel>Status</DropdownMenuLabel>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); updateDriverStatus(row.id, 'online'); }} disabled={row.status === 'online'} className="hover:bg-secondary hover:text-foreground cursor-pointer">
                <Check className="w-4 h-4 mr-2 text-blue-400" /> Set Active
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); updateDriverStatus(row.id, 'offline'); }} disabled={row.status === 'offline' || row.status === 'suspended'} className="hover:bg-secondary hover:text-foreground cursor-pointer">
                <Ban className="w-4 h-4 mr-2 text-amber-400" /> Suspend
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  const filteredDrivers = drivers.filter(d => 
    d.name?.toLowerCase().includes(search.toLowerCase()) || 
    d.phone?.includes(search)
  );

  const stats = {
    total: drivers.length,
    active: drivers.filter(d => d.status === 'active' || d.status === 'online').length,
    verified: drivers.filter(d => d.isVerified).length,
    pendingKyc: drivers.filter(d => d.kycStatus === 'pending' || !d.isVerified).length,
  };

  return (
    <ProtectedRoute allowedRoles={['super_admin', 'operations_admin']}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2 flex items-center gap-2">
              <Truck className="w-8 h-8 text-blue-500" /> Driver Fleet
            </h1>
            <p className="text-muted-foreground">Manage delivery partners, approve KYC, and track performance.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-background/40 border-border/50 backdrop-blur-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <Truck className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Fleet</p>
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
                <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Verified</p>
                  <p className="text-2xl font-bold text-foreground">{stats.verified}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-background/40 border-border/50 backdrop-blur-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <ShieldAlert className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending KYC</p>
                  <p className="text-2xl font-bold text-foreground">{stats.pendingKyc}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DataTable
          columns={columns}
          data={filteredDrivers}
          loading={loading}
          searchValue={search}
          onSearch={setSearch}
          searchPlaceholder="Search drivers by name or phone..."
          onRowClick={(row) => setViewDialogState({ open: true, driver: row })}
        />

        <AdminDialog
          title="Driver Details"
          description={`Details for ${viewDialogState.driver?.name}`}
          isOpen={viewDialogState.open}
          onClose={() => setViewDialogState({ open: false, driver: null })}
        >
          {viewDialogState.driver && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium text-foreground">{viewDialogState.driver.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium text-foreground">{viewDialogState.driver.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Vehicle Type</p>
                  <p className="font-medium text-foreground capitalize">{viewDialogState.driver.vehicle || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Vehicle Number</p>
                  <p className="font-medium text-foreground uppercase">{viewDialogState.driver.vehicleNumber || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Earnings</p>
                  <p className="font-medium text-foreground">₹{viewDialogState.driver.totalEarnings || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Wallet Balance</p>
                  <p className="font-medium text-foreground">₹{viewDialogState.driver.walletBalance || 0}</p>
                </div>
              </div>
            </div>
          )}
        </AdminDialog>
      </div>
    </ProtectedRoute>
  );
}
