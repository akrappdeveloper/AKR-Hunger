'use client';

import { useState, useEffect } from 'react';
import { Landmark, CheckCircle, XCircle, Clock, Eye, Download, Search } from 'lucide-react';
import { toast } from 'sonner';

import { DataTable, ColumnDef } from '@/components/admin/DataTable';
import { AdminDialog } from '@/components/admin/AdminDialog';
import { ProtectedRoute } from '@/components/admin/ProtectedRoute';
import { FinanceService } from '@/lib/services/FinanceService';
import { WithdrawalRequest } from '@/lib/types';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AdminPaymentsPage() {
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('pending');
  
  const [viewDialogState, setViewDialogState] = useState<{ open: boolean; request: WithdrawalRequest | null }>({ open: false, request: null });

  useEffect(() => {
    const unsub = FinanceService.listenWithdrawalRequests(data => {
      // Assuming we're viewing all withdrawals or we could filter by userType if it exists
      setRequests(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleProcess = async (id: string, status: 'COMPLETED' | 'FAILED', reason?: string) => {
    try {
      await FinanceService.processWithdrawal(id, status, reason);
      toast.success(`Withdrawal marked as ${status}`);
      setViewDialogState({ open: false, request: null });
    } catch {
      toast.error('Failed to process withdrawal');
    }
  };

  const columns: ColumnDef<WithdrawalRequest>[] = [
    {
      header: 'Request ID',
      cell: (row) => (
        <span className="font-mono text-xs text-muted-foreground">{row.id?.substring(0, 8)}...</span>
      ),
    },
    {
      header: 'User',
      cell: (row) => (
        <div>
          <p className="font-semibold text-foreground">{row.riderName || row.id}</p>
        </div>
      ),
    },
    {
      header: 'Amount',
      cell: (row) => (
        <span className="font-semibold text-foreground">₹{row.amount}</span>
      ),
    },
    {
      header: 'Date',
      cell: (row) => {
        const date = row.requestedAt?.toDate ? row.requestedAt.toDate() : new Date(row.requestedAt);
        return <span className="text-sm text-muted-foreground">{date.toLocaleDateString()}</span>;
      }
    },
    {
      header: 'Status',
      cell: (row) => {
        if (row.status === 'COMPLETED') return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Completed</Badge>;
        if (row.status === 'FAILED') return <Badge variant="outline" className="bg-rose-500/10 text-rose-400 border-rose-500/20">Failed</Badge>;
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20">Pending</Badge>;
      }
    },
    {
      header: 'Actions',
      className: 'text-right',
      cell: (row) => (
        <Button variant="ghost" size="sm" onClick={() => setViewDialogState({ open: true, request: row })} className="text-blue-400 hover:text-blue-300">
          <Eye className="w-4 h-4 mr-2" /> View
        </Button>
      ),
    },
  ];

  const filteredRequests = requests.filter(r => 
    (activeTab === 'all' || (r.status || 'PENDING').toLowerCase() === activeTab) &&
    (r.id?.includes(search) || r.riderName?.toLowerCase().includes(search.toLowerCase()))
  );

  const stats = {
    totalPending: requests.filter(r => r.status === 'PENDING').reduce((acc, r) => acc + r.amount, 0),
    totalCompleted: requests.filter(r => r.status === 'COMPLETED').reduce((acc, r) => acc + r.amount, 0),
  };

  return (
    <ProtectedRoute allowedRoles={['super_admin', 'finance_admin']}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2 flex items-center gap-2">
            <Landmark className="w-8 h-8 text-blue-500" /> Payout Requests
          </h1>
          <p className="text-muted-foreground">Process withdrawal requests and view payment history.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-background/40 border-border/50 backdrop-blur-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending Amount</p>
                  <p className="text-2xl font-bold text-foreground">₹{stats.totalPending}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-background/40 border-border/50 backdrop-blur-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Processed</p>
                  <p className="text-2xl font-bold text-foreground">₹{stats.totalCompleted}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-background/40 border border-border/50">
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="failed">Failed</TabsTrigger>
            <TabsTrigger value="all">All Requests</TabsTrigger>
          </TabsList>
        </Tabs>

        <DataTable
          columns={columns}
          data={filteredRequests}
          loading={loading}
          searchValue={search}
          onSearch={setSearch}
          searchPlaceholder="Search by ID or Name..."
          onRowClick={(row) => setViewDialogState({ open: true, request: row })}
        />

        <AdminDialog
          title="Withdrawal Request Details"
          description={`Details for Request ID: ${viewDialogState.request?.id}`}
          isOpen={viewDialogState.open}
          onClose={() => setViewDialogState({ open: false, request: null })}
        >
          {viewDialogState.request && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 bg-card/5 p-4 rounded-xl border border-border/50">
                <div>
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="font-bold text-xl text-foreground">₹{viewDialogState.request.amount}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Payment Method</p>
                  <p className="font-medium text-foreground uppercase">{viewDialogState.request.paymentMethod}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Destination Reference</p>
                  <p className="font-medium text-foreground break-all">{viewDialogState.request.destinationReference}</p>
                </div>
              </div>

              {viewDialogState.request.status === 'PENDING' && (
                <div className="flex gap-4">
                  <Button onClick={() => handleProcess(viewDialogState.request!.id!, 'COMPLETED')} className="flex-1 bg-emerald-500 hover:bg-emerald-600">
                    <CheckCircle className="w-4 h-4 mr-2" /> Mark as Paid
                  </Button>
                  <Button onClick={() => handleProcess(viewDialogState.request!.id!, 'FAILED', 'Admin Rejected')} variant="destructive" className="flex-1">
                    <XCircle className="w-4 h-4 mr-2" /> Reject
                  </Button>
                </div>
              )}
            </div>
          )}
        </AdminDialog>
      </div>
    </ProtectedRoute>
  );
}
