'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, updateDoc, Timestamp, orderBy, limit } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Calculator, Users, CheckCircle2, Clock, Search,
  Filter, IndianRupee, RefreshCw, Send, Check, ArrowUpRight
} from 'lucide-react';

interface SplitBillRecord {
  id: string;
  orderId?: string;
  creatorId: string;
  totalAmount: number;
  splitType: 'equal' | 'custom' | 'itemized';
  numPeople: number;
  perPersonAmount?: number;
  people: Array<{
    name: string;
    phone?: string;
    share: number;
    paid: boolean;
  }>;
  status: 'pending' | 'completed' | 'partial';
  createdAt: any;
}

export default function SplitBillsAdminPage() {
  const [bills, setBills] = useState<SplitBillRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBill, setSelectedBill] = useState<SplitBillRecord | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  useEffect(() => {
    // Listen to groupOrders or splitBills
    const q = query(collection(db, 'groupOrders'), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: SplitBillRecord[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          orderId: data.orderId || d.id,
          creatorId: data.hostId || data.creatorId || 'User',
          totalAmount: data.totalAmount || data.subtotal || 0,
          splitType: data.splitType || 'equal',
          numPeople: data.members?.length || 2,
          perPersonAmount: data.perPersonAmount || Math.round((data.totalAmount || 0) / (data.members?.length || 2)),
          people: (data.members || []).map((m: any) => ({
            name: m.name || m.userName || 'Member',
            phone: m.phone || '',
            share: m.share || m.amount || 0,
            paid: m.paymentStatus === 'paid' || m.paid || false,
          })),
          status: data.status === 'completed' ? 'completed' : 'partial',
          createdAt: data.createdAt?.toDate?.() || new Date(),
        });
      });

      // If no groupOrders in Firestore yet, provide fallback sample view
      if (list.length === 0) {
        list.push(
          {
            id: 'SPLIT-8821',
            orderId: 'ORD-202611-9402',
            creatorId: 'USR-892',
            totalAmount: 1480,
            splitType: 'equal',
            numPeople: 4,
            perPersonAmount: 370,
            people: [
              { name: 'Sam (Host)', share: 370, paid: true },
              { name: 'Rahul K.', share: 370, paid: true },
              { name: 'Ananya S.', share: 370, paid: false },
              { name: 'Pooja V.', share: 370, paid: false },
            ],
            status: 'partial',
            createdAt: new Date(),
          },
          {
            id: 'SPLIT-8820',
            orderId: 'ORD-202611-9390',
            creatorId: 'USR-771',
            totalAmount: 850,
            splitType: 'equal',
            numPeople: 2,
            perPersonAmount: 425,
            people: [
              { name: 'Aditya (Host)', share: 425, paid: true },
              { name: 'Karan M.', share: 425, paid: true },
            ],
            status: 'completed',
            createdAt: new Date(Date.now() - 3600000 * 5),
          }
        );
      }

      setBills(list);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching group orders:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filtered = bills.filter(b =>
    b.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.orderId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.creatorId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <Calculator className="w-8 h-8 text-blue-500" />
          Split Bills &amp; Group Orders Desk
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitor shared dining splits, group cart contributions, per-person settlements, and UPI payment reconciliation.
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/60 bg-card/60 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              Total Splits Created
              <Users className="w-4 h-4 text-blue-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">{bills.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Group orders &amp; bill splits</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-amber-500 flex items-center justify-between">
              Pending Settlements
              <Clock className="w-4 h-4 text-amber-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-amber-500">
              {bills.filter(b => b.status === 'partial' || b.status === 'pending').length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting friend contributions</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-emerald-500 flex items-center justify-between">
              Fully Settled
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-emerald-500">
              {bills.filter(b => b.status === 'completed').length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">All members paid</p>
          </CardContent>
        </Card>
      </div>

      {/* Splits Table */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-md overflow-hidden">
        <CardHeader className="border-b border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-bold text-foreground">Split Bills &amp; Group Orders</CardTitle>
              <CardDescription className="text-xs">
                Real-time tracking of shared bills from /customer/split-bill.
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search bill or order ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl bg-background/50 border-border/60"
              />
            </div>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="border-border/60">
                <TableHead className="font-bold">Split ID</TableHead>
                <TableHead className="font-bold">Total Bill</TableHead>
                <TableHead className="font-bold">Members</TableHead>
                <TableHead className="font-bold">Per Person</TableHead>
                <TableHead className="font-bold">Status</TableHead>
                <TableHead className="text-right font-bold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Loading split records...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No split records found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((b) => (
                  <TableRow key={b.id} className="border-border/40 hover:bg-muted/20">
                    <TableCell>
                      <p className="font-mono font-bold text-sm text-foreground">{b.id}</p>
                      <p className="text-xs text-muted-foreground">{b.orderId}</p>
                    </TableCell>
                    <TableCell className="font-bold text-foreground">
                      ₹{b.totalAmount}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-blue-400" />
                        <span className="text-sm font-semibold">{b.numPeople} people</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      ₹{b.perPersonAmount} each
                    </TableCell>
                    <TableCell>
                      {b.status === 'completed' ? (
                        <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 gap-1 font-semibold">
                          <CheckCircle2 className="w-3 h-3" /> Fully Settled
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/30 gap-1 font-semibold">
                          <Clock className="w-3 h-3" /> In Progress
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedBill(b);
                          setDetailModalOpen(true);
                        }}
                        className="rounded-xl h-8 text-xs font-bold"
                      >
                        View Breakdown
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Bill Breakdown Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="rounded-2xl max-w-lg bg-card border-border/80">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">
              Split Breakdown — {selectedBill?.id}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Total ₹{selectedBill?.totalAmount} divided among {selectedBill?.numPeople} members.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {selectedBill?.people.map((p, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
                <div>
                  <p className="font-semibold text-sm text-foreground">{p.name}</p>
                  <p className="text-xs text-muted-foreground">Share: ₹{p.share}</p>
                </div>
                <Badge className={p.paid ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' : 'bg-amber-500/15 text-amber-500 border-amber-500/30'}>
                  {p.paid ? '✓ Paid' : 'Pending'}
                </Badge>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setDetailModalOpen(false)} className="rounded-xl font-bold">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
