'use client';

import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, updateDoc, query, orderBy, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Trash2, Mail, Phone, MapPin, Search, MoreVertical, Ban, CheckCircle, User, Filter, Download, Users, UserCheck, UserX, ShoppingBag, Calendar, CreditCard, Clock, RefreshCw } from 'lucide-react';
import { Customer, Order } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  useEffect(() => {
    // Real-time listener
    const q = query(collection(db, 'customers'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Customer[];
      setCustomers(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching customers:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch orders when a customer is selected
  useEffect(() => {
    const fetchCustomerOrders = async () => {
      if (!selectedCustomer?.id) return;
      setLoadingOrders(true);
      try {
        const q = query(
          collection(db, 'orders'),
          where('customerId', '==', selectedCustomer.id),
          orderBy('createdAt', 'desc'),
          limit(20)
        );
        const snapshot = await getDocs(q);
        const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
        setCustomerOrders(orders);
      } catch (error) {
        console.error("Error fetching customer orders:", error);
      } finally {
        setLoadingOrders(false);
      }
    };

    if (selectedCustomer) {
      fetchCustomerOrders();
    } else {
      setCustomerOrders([]);
    }
  }, [selectedCustomer]);

  const deleteCustomer = async (id: string) => {
    if (!confirm('Are you sure you want to delete this customer? This action cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'customers', id));
    } catch (error) {
      console.error('Error deleting customer:', error);
    }
  };

  const toggleBlockStatus = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'customers', id), {
        isBlocked: !currentStatus
      });
      // Optimistic update for the selected customer dialog view
      if (selectedCustomer?.id === id) {
        setSelectedCustomer(prev => prev ? { ...prev, isBlocked: !prev.isBlocked } : null);
      }
    } catch (error) {
      console.error('Error updating block status:', error);
    }
  };

  const filteredCustomers = customers.filter((customer) => {
    const matchesSearch =
      customer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter =
      statusFilter === 'all' ||
      (statusFilter === 'active' && !customer.isBlocked) ||
      (statusFilter === 'blocked' && customer.isBlocked);

    return matchesSearch && matchesFilter;
  });

  // Calculate stats
  const totalCustomers = customers.length;
  const activeCustomers = customers.filter(c => !c.isBlocked).length;
  const blockedCustomers = customers.filter(c => c.isBlocked).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Customer Management</h1>
          <p className="text-gray-200 font-medium">Monitor, manage, and engage with your customer base.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-gray-600 bg-gray-800/50 text-white hover:bg-gray-700 hover:text-white hover:border-gray-500 font-semibold">
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
          <Button onClick={() => window.location.reload()} variant="outline" className="border-gray-600 bg-gray-800/50 text-white hover:bg-gray-700 hover:text-white hover:border-gray-500 font-semibold">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-blue-900/20 to-black/40 border-blue-500/20 backdrop-blur-md shadow-[0_0_30px_rgba(59,130,246,0.1)]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-blue-400 uppercase tracking-widest">Total Customers</CardTitle>
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Users className="h-4 w-4 text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white mb-1">{totalCustomers}</div>
            <p className="text-xs text-gray-400">Registered users</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-900/20 to-black/40 border-emerald-500/20 backdrop-blur-md shadow-[0_0_30px_rgba(16,185,129,0.1)]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-emerald-400 uppercase tracking-widest">Active Users</CardTitle>
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <UserCheck className="h-4 w-4 text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white mb-1">{activeCustomers}</div>
            <p className="text-xs text-gray-400">Currently active</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-900/20 to-black/40 border-red-500/20 backdrop-blur-md shadow-[0_0_30px_rgba(239,68,68,0.1)]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-red-400 uppercase tracking-widest">Blocked Users</CardTitle>
            <div className="p-2 bg-red-500/10 rounded-lg">
              <UserX className="h-4 w-4 text-red-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white mb-1">{blockedCustomers}</div>
            <p className="text-xs text-gray-400">Restricted access</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-black/40 border-white/10 backdrop-blur-md shadow-2xl overflow-hidden">
        <CardHeader className="border-b border-white/5 bg-white/5 pb-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <CardTitle className="text-xl font-bold text-white">Customer Database</CardTitle>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] bg-black/20 border-white/10 text-white font-medium hover:bg-white/5 transition-colors">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-gray-800 text-white">
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Search customers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-black/20 border-white/10 text-white placeholder:text-gray-500 focus-visible:ring-blue-500 focus-visible:border-blue-500 transition-all rounded-lg"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-gray-800/80">
                  <TableRow className="border-gray-800 hover:bg-gray-800/80">
                    <TableHead className="text-white font-bold pl-6">Customer</TableHead>
                    <TableHead className="text-white font-bold">Contact Info</TableHead>
                    <TableHead className="text-white font-bold">Orders</TableHead>
                    <TableHead className="text-white font-bold">Status</TableHead>
                    <TableHead className="text-white font-bold">Joined Date</TableHead>
                    <TableHead className="text-right text-white font-bold pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-gray-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" />
                          <p>Loading customers...</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-gray-400">
                        No customers match your criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCustomers.map((customer) => (
                      <TableRow key={customer.id} className="border-gray-800 hover:bg-gray-800/40 transition-colors bg-gray-900/20">
                        <TableCell className="pl-6 py-4">
                          <div className="flex items-center gap-4">
                            <Avatar className="h-10 w-10 border-2 border-gray-800 shadow-sm">
                              <AvatarImage src={customer.image} alt={customer.name} className="object-cover" />
                              <AvatarFallback className="bg-blue-900/50 text-blue-200 font-semibold">
                                {customer.name?.charAt(0).toUpperCase() || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span className="font-semibold text-white tracking-tight">{customer.name}</span>
                              <span className="text-xs text-gray-500 font-mono">ID: {customer.id?.slice(0, 8)}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2 text-sm text-gray-300">
                              <Mail className="h-3.5 w-3.5 text-gray-500" /> {customer.email}
                            </div>
                            {customer.phone && (
                              <div className="flex items-center gap-2 text-sm text-gray-400">
                                <Phone className="h-3.5 w-3.5 text-gray-500" /> {customer.phone}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700">
                            {customer.orders?.length || 0} Orders
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={customer.isBlocked ? "destructive" : "default"}
                            className={customer.isBlocked
                              ? "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20"
                              : "bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20"
                            }
                          >
                            <div className="flex items-center gap-1.5">
                              {customer.isBlocked
                                ? <UserX className="h-3 w-3" />
                                : <UserCheck className="h-3 w-3" />
                              }
                              {customer.isBlocked ? 'Blocked' : 'Active'}
                            </div>
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-400 text-sm">
                          {customer.createdAt?.toDate ? customer.createdAt.toDate().toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          }) : 'N/A'}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full">
                                <span className="sr-only">Open menu</span>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-gray-800 border-gray-700 text-gray-300 w-48">
                              <DropdownMenuLabel>Customer Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator className="bg-gray-700" />
                              <DropdownMenuItem
                                onClick={() => setSelectedCustomer(customer)}
                                className="focus:bg-gray-700 focus:text-white cursor-pointer py-2"
                              >
                                <User className="mr-2 h-4 w-4" /> View Profile
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => toggleBlockStatus(customer.id!, customer.isBlocked || false)}
                                className="focus:bg-gray-700 focus:text-white cursor-pointer py-2"
                              >
                                {customer.isBlocked ? (
                                  <>
                                    <CheckCircle className="mr-2 h-4 w-4 text-green-400" /> Unblock Access
                                  </>
                                ) : (
                                  <>
                                    <Ban className="mr-2 h-4 w-4 text-orange-400" /> Block Access
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-gray-700" />
                              <DropdownMenuItem
                                onClick={() => deleteCustomer(customer.id!)}
                                className="text-red-400 focus:bg-red-900/20 focus:text-red-300 cursor-pointer py-2"
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete Account
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedCustomer} onOpenChange={() => setSelectedCustomer(null)}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-[700px] shadow-2xl overflow-hidden p-0 gap-0">
          <div className="p-6 bg-gradient-to-b from-gray-800/50 to-gray-900 border-b border-gray-800">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-5">
                <Avatar className="h-20 w-20 border-4 border-gray-800 shadow-xl ring-2 ring-gray-700">
                  <AvatarImage src={selectedCustomer?.image} className="object-cover" />
                  <AvatarFallback className="bg-gray-800 text-2xl text-gray-400 font-bold">
                    {selectedCustomer?.name?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-1.5">
                  <h2 className="text-2xl font-bold tracking-tight text-white">{selectedCustomer?.name}</h2>
                  <p className="text-base text-gray-300 flex items-center gap-2 font-medium">
                    <Mail className="h-4 w-4 text-blue-400" /> {selectedCustomer?.email}
                  </p>
                  <p className="text-sm text-gray-400 flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    Joined {selectedCustomer?.createdAt?.toDate ? selectedCustomer.createdAt.toDate().toLocaleDateString() : 'Unknown'}
                  </p>
                </div>
              </DialogTitle>
            </DialogHeader>
          </div>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="w-full justify-start rounded-none border-b border-gray-800 bg-gray-900/50 p-0 h-12">
              <TabsTrigger
                value="overview"
                className="rounded-none border-b-2 border-transparent px-6 py-3 data-[state=active]:border-blue-500 data-[state=active]:bg-gray-800/50 text-gray-400 data-[state=active]:text-white transition-all"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="orders"
                className="rounded-none border-b-2 border-transparent px-6 py-3 data-[state=active]:border-blue-500 data-[state=active]:bg-gray-800/50 text-gray-400 data-[state=active]:text-white transition-all"
              >
                Order History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="p-6 space-y-6 m-0">
              <div className="grid grid-cols-2 gap-x-12 gap-y-8">
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-500">System ID</p>
                  <p className="text-sm text-gray-200 font-mono bg-black/40 px-3 py-2 rounded border border-gray-800 select-all block break-all">
                    {selectedCustomer?.id}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Mobile Number</p>
                  <div className="flex items-center gap-2">
                    {selectedCustomer?.phone ? (
                      <div className="bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-full flex items-center gap-2 w-fit">
                        <Phone className="h-3.5 w-3.5 text-green-400" />
                        <span className="text-sm font-semibold text-green-100">{selectedCustomer.phone}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500 italic bg-gray-800 px-3 py-1 rounded w-fit">Not Verified</span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Account Status</p>
                  <Badge variant={selectedCustomer?.isBlocked ? "destructive" : "default"} className="px-3 py-1.5 text-sm">
                    {selectedCustomer?.isBlocked ? 'Suspended / Blocked' : 'Active Account'}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Total Engagement</p>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <ShoppingBag className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-white">{selectedCustomer?.orders?.length || 0}</p>
                      <p className="text-xs text-gray-400">Lifetime Orders</p>
                    </div>
                  </div>
                </div>
              </div>

              {selectedCustomer?.addresses && selectedCustomer.addresses.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-gray-800">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-2">
                    <MapPin className="h-3 w-3" /> Saved Addresses ({selectedCustomer.addresses.length})
                  </p>
                  <div className="grid grid-cols-1 gap-3">
                    {selectedCustomer.addresses.map((addr: any, idx: number) => (
                      <div key={idx} className="flex gap-4 p-4 rounded-xl bg-gray-800/30 border border-gray-700/40 hover:bg-gray-800/60 transition-colors group">
                        <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 group-hover:bg-blue-500/20 transition-colors">
                          <MapPin className="h-5 w-5 text-blue-400" />
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-base font-bold text-white mb-1">{addr.label}</p>
                          <p className="text-sm text-gray-300 leading-relaxed font-medium">{addr.address}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="orders" className="p-0 m-0">
              {loadingOrders ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-600 border-t-blue-500" />
                  <p className="text-gray-400 text-sm">Loading order history...</p>
                </div>
              ) : customerOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 gap-2 text-gray-400">
                  <ShoppingBag className="h-8 w-8 opacity-20" />
                  <p>No orders found for this customer.</p>
                </div>
              ) : (
                <div className="max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader className="bg-gray-800/80 sticky top-0 backdrop-blur-sm z-10">
                      <TableRow className="border-gray-700 hover:bg-gray-800/80">
                        <TableHead className="text-gray-300 pl-6">Order ID</TableHead>
                        <TableHead className="text-gray-300">Date</TableHead>
                        <TableHead className="text-gray-300">Amount</TableHead>
                        <TableHead className="text-gray-300">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerOrders.map((order) => (
                        <TableRow key={order.id} className="border-gray-800 hover:bg-gray-800/30">
                          <TableCell className="font-mono text-xs text-gray-400 pl-6">
                            {(order.id || '').slice(0, 8)}...
                          </TableCell>
                          <TableCell className="text-gray-300 text-sm">
                            <div className="flex flex-col">
                              <span>{order.createdAt?.toDate().toLocaleDateString()}</span>
                              <span className="text-xs text-gray-500">{order.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-green-400 font-medium">
                            ₹{order.total}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`capitalize ${order.status === 'delivered' ? 'text-green-400 border-green-500/30 bg-green-500/10' :
                              order.status === 'cancelled' ? 'text-red-400 border-red-500/30 bg-red-500/10' :
                                'text-blue-400 border-blue-500/30 bg-blue-500/10'
                              }`}>
                              {order.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3 p-6 bg-gray-900 border-t border-gray-800">
            <Button
              variant="outline"
              onClick={() => setSelectedCustomer(null)}
              className="bg-transparent border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white"
            >
              Close
            </Button>
            <Button
              variant={selectedCustomer?.isBlocked ? "default" : "destructive"}
              className="px-6"
              onClick={() => {
                if (selectedCustomer?.id) {
                  toggleBlockStatus(selectedCustomer.id, selectedCustomer.isBlocked || false);
                }
              }}
            >
              {selectedCustomer?.isBlocked ? 'Unblock Account' : 'Block Account'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
