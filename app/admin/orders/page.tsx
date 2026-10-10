'use client';

import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  ShoppingBag,
  Truck,
  ChefHat,
  Package,
  Search,
  Filter,
  DollarSign,
  ArrowRight,
  Printer,
  MoreHorizontal,
  MapPin,
  Calendar,
  Activity,
  Phone,
  Mail,
  User,
  TrendingUp,
  Download,
  RefreshCw,
  Eye,
  CheckCheck,
  Ban
} from 'lucide-react';
import { Order, formatOrderId } from '@/lib/types';
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
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProtectedRoute } from '@/components/admin/ProtectedRoute';
import { OrderService } from '@/lib/services/OrderService';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";

const statusConfig: { [key: string]: { color: string, icon: any, label: string, step: number, bgColor: string } } = {
  pending: { color: "text-yellow-300", bgColor: "bg-yellow-500/20 border-yellow-500/30", icon: Clock, label: "Pending", step: 1 },
  confirmed: { color: "text-blue-300", bgColor: "bg-blue-500/20 border-blue-500/30", icon: CheckCircle, label: "Confirmed", step: 2 },
  preparing: { color: "text-orange-300", bgColor: "bg-orange-500/20 border-orange-500/30", icon: ChefHat, label: "Preparing", step: 3 },
  ready: { color: "text-purple-300", bgColor: "bg-purple-500/20 border-purple-500/30", icon: Package, label: "Ready", step: 4 },
  out_for_delivery: { color: "text-cyan-300", bgColor: "bg-cyan-500/20 border-cyan-500/30", icon: Truck, label: "Out for Delivery", step: 5 },
  delivered: { color: "text-green-300", bgColor: "bg-green-500/20 border-green-500/30", icon: CheckCircle, label: "Delivered", step: 6 },
  cancelled: { color: "text-red-300", bgColor: "bg-red-500/20 border-red-500/30", icon: XCircle, label: "Cancelled", step: 0 },
};

const timelineSteps = [
  { id: 'pending', label: 'Order Placed', icon: Clock },
  { id: 'confirmed', label: 'Confirmed', icon: CheckCircle },
  { id: 'preparing', label: 'Preparing', icon: ChefHat },
  { id: 'out_for_delivery', label: 'On the Way', icon: Truck },
  { id: 'delivered', label: 'Delivered', icon: CheckCircle },
];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'status'>('date');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const unsubscribe = OrderService.listenAllOrders(
      (data) => {
        setOrders(data);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching orders:", error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await OrderService.updateOrderStatus(orderId, newStatus as Order['status']);
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus as any });
      }
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  };

  const bulkUpdateStatus = async (status: string) => {
    for (const orderId of selectedOrders) {
      await updateOrderStatus(orderId, status);
    }
    setSelectedOrders([]);
  };

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders(prev =>
      prev.includes(orderId)
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedOrders.length === filteredOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(filteredOrders.map(o => o.id!));
    }
  };

  const filteredOrders = orders.filter((order) => {
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    const matchesSearch =
      order.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.restaurantName?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Stats
  const activeOrders = orders.filter(o => ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(o.status || '')).length;
  const pendingOrders = orders.filter(o => o.status === 'pending').length;
  const totalRevenue = orders
    .filter(o => o.status === 'delivered')
    .reduce((acc, curr) => acc + (curr.total || 0), 0);
  const todaysOrders = orders.filter(o => {
    const orderDate = o.createdAt?.toDate?.() || new Date();
    const today = new Date();
    return orderDate.toDateString() === today.toDateString();
  }).length;
  const avgOrderValue = orders.length > 0 ? totalRevenue / orders.filter(o => o.status === 'delivered').length : 0;

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    if (date?.toDate) return date.toDate().toLocaleDateString() + ' ' + date.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (date instanceof Date) return date.toLocaleDateString();
    return 'Invalid Date';
  };

  const exportOrders = () => {
    const csvContent = "data:text/csv;charset=utf-8,"
      + "Order ID,Customer,Restaurant,Amount,Status,Date\n"
      + filteredOrders.map(o =>
        `${o.id},${o.customerName},${o.restaurantName},${o.total},${o.status},${formatDate(o.createdAt)}`
      ).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `orders_${new Date().toISOString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <ProtectedRoute allowedRoles={['operations_admin', 'support_admin']}>
      <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Order Management</h1>
          <p className="text-foreground font-medium">Monitor and control all orders across the platform in real-time.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportOrders} variant="outline" className="border-border bg-secondary/50 text-foreground hover:bg-secondary hover:text-foreground hover:border-border font-semibold">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => window.location.reload()} variant="outline" className="border-border bg-secondary/50 text-foreground hover:bg-secondary hover:text-foreground hover:border-border font-semibold">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Enhanced Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-blue-900/20 to-black/40 border-blue-500/20 backdrop-blur-md shadow-[0_0_30px_rgba(59,130,246,0.1)] group hover:shadow-[0_0_40px_rgba(59,130,246,0.2)] transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-blue-400 uppercase tracking-widest">Active Orders</CardTitle>
            <Activity className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-foreground mb-1 tracking-tight">{activeOrders}</div>
            <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              In progress right now
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-900/20 to-black/40 border-orange-500/20 backdrop-blur-md shadow-[0_0_30px_rgba(249,115,22,0.1)] group hover:shadow-[0_0_40px_rgba(249,115,22,0.2)] transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-orange-400 uppercase tracking-widest">Pending Action</CardTitle>
            <Clock className="h-5 w-5 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-foreground mb-1 tracking-tight">{pendingOrders}</div>
            <p className="text-xs text-muted-foreground font-medium">Orders waiting for confirmation</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-900/20 to-black/40 border-green-500/20 backdrop-blur-md shadow-[0_0_30px_rgba(34,197,94,0.1)] group hover:shadow-[0_0_40px_rgba(34,197,94,0.2)] transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-green-400 uppercase tracking-widest">Total Revenue</CardTitle>
            <DollarSign className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-foreground mb-1 tracking-tight">₹{totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground font-medium">From delivered orders</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-900/20 to-black/40 border-purple-500/20 backdrop-blur-md shadow-[0_0_30px_rgba(168,85,247,0.1)] group hover:shadow-[0_0_40px_rgba(168,85,247,0.2)] transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-purple-400 uppercase tracking-widest">Today's Orders</CardTitle>
            <Calendar className="h-5 w-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-foreground mb-1 tracking-tight">{todaysOrders}</div>
            <p className="text-xs text-muted-foreground font-medium">Avg: ₹{avgOrderValue.toFixed(0)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-background/40 border-border/50 backdrop-blur-xl shadow-2xl">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
            <Tabs defaultValue="all" value={filterStatus} onValueChange={setFilterStatus} className="w-full md:w-auto">
              <TabsList className="bg-card/50 border border-border/50 h-10 p-1">
                <TabsTrigger value="all" className="data-[state=active]:bg-blue-600 data-[state=active]:text-foreground text-muted-foreground font-medium">All</TabsTrigger>
                <TabsTrigger value="pending" className="data-[state=active]:bg-yellow-600 data-[state=active]:text-foreground text-muted-foreground font-medium">Pending</TabsTrigger>
                <TabsTrigger value="preparing" className="data-[state=active]:bg-orange-600 data-[state=active]:text-foreground text-muted-foreground font-medium">Preparing</TabsTrigger>
                <TabsTrigger value="out_for_delivery" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-foreground text-muted-foreground font-medium">En Route</TabsTrigger>
                <TabsTrigger value="delivered" className="data-[state=active]:bg-green-600 data-[state=active]:text-foreground text-muted-foreground font-medium">Completed</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-background/20 border-border/50 text-foreground placeholder:text-muted-foreground focus:bg-background/40 focus:border-blue-500/50 h-10 transition-all rounded-lg"
              />
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedOrders.length > 0 && (
            <div className="mt-4 p-3 bg-blue-900/20 border border-blue-500/20 rounded-lg flex items-center justify-between">
              <span className="text-sm text-blue-200 font-medium">
                {selectedOrders.length} order{selectedOrders.length > 1 ? 's' : ''} selected
              </span>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => bulkUpdateStatus('confirmed')} className="bg-blue-600 hover:bg-blue-500 text-foreground shadow-lg shadow-blue-900/20">
                  <CheckCircle className="h-3.5 w-3.5 mr-1" />
                  Confirm
                </Button>
                <Button size="sm" onClick={() => bulkUpdateStatus('preparing')} className="bg-orange-600 hover:bg-orange-500 text-foreground shadow-lg shadow-orange-900/20">
                  <ChefHat className="h-3.5 w-3.5 mr-1" />
                  Prepare
                </Button>
                <Button size="sm" onClick={() => bulkUpdateStatus('cancelled')} variant="outline" className="border-red-500/30 bg-red-950/20 text-red-300 hover:bg-red-950/40">
                  <Ban className="h-3.5 w-3.5 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[600px]">
            <div className="rounded-none">
              <Table>
                <TableHeader className="bg-card/5 sticky top-0 z-10 backdrop-blur-sm">
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0}
                        onCheckedChange={toggleSelectAll}
                        className="border-border data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                      />
                    </TableHead>
                    <TableHead className="font-bold text-foreground">Order ID</TableHead>
                    <TableHead className="font-bold text-foreground">Customer</TableHead>
                    <TableHead className="font-bold text-foreground">Restaurant</TableHead>
                    <TableHead className="font-bold text-foreground">Amount</TableHead>
                    <TableHead className="font-bold text-foreground">Status</TableHead>
                    <TableHead className="font-bold text-foreground">Time</TableHead>
                    <TableHead className="text-right font-bold text-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32 text-center text-foreground">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                          <p className="font-medium">Loading orders...</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32 text-center text-foreground font-medium">No orders found.</TableCell>
                    </TableRow>
                  ) : (
                    filteredOrders.map((order, index) => {
                      const status = statusConfig[order.status || 'pending'] || statusConfig.pending;
                      const StatusIcon = status.icon;
                      return (
                        <TableRow 
                          key={order.id || `order-${index}`} 
                          className="border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer"
                          onClick={() => setSelectedOrder(order)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedOrders.includes(order.id!)}
                              onCheckedChange={() => toggleOrderSelection(order.id!)}
                              className="border-border"
                            />
                          </TableCell>
                          <TableCell className="font-mono text-xs text-foreground font-bold">
                            #{formatOrderId(order.id)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8 border border-border/50">
                                <AvatarFallback className="bg-secondary text-foreground text-xs font-bold">{order.customerName?.slice(0, 2).toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col">
                                <span className="font-semibold text-foreground text-sm">{order.customerName}</span>
                                <span className="text-xs text-muted-foreground">{order.customerPhone}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-foreground text-sm font-medium">
                            {order.restaurantName}
                          </TableCell>
                          <TableCell className="text-green-300 font-bold text-sm">
                            ₹{order.total}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`${status.color} ${status.bgColor} border flex w-fit items-center gap-1.5 px-2.5 py-1 font-bold`}>
                              <StatusIcon className="h-3.5 w-3.5" />
                              {status.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-foreground font-medium">
                            {formatDate(order.createdAt).split(' ')[1] || 'N/A'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedOrder(order);
                                }}
                                size="sm"
                                variant="ghost"
                                className="h-8 px-3 text-foreground hover:text-foreground hover:bg-secondary"
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-card border-border/50 text-foreground w-40">
                                  <DropdownMenuItem onClick={() => updateOrderStatus(order.id!, 'confirmed')} className="hover:bg-secondary hover:text-foreground cursor-pointer">
                                    <CheckCircle className="mr-2 h-4 w-4 text-blue-400" />
                                    Confirm
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => updateOrderStatus(order.id!, 'preparing')} className="hover:bg-secondary hover:text-foreground cursor-pointer">
                                    <ChefHat className="mr-2 h-4 w-4 text-orange-400" />
                                    Preparing
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => updateOrderStatus(order.id!, 'out_for_delivery')} className="hover:bg-secondary hover:text-foreground cursor-pointer">
                                    <Truck className="mr-2 h-4 w-4 text-cyan-400" />
                                    Dispatch
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator className="bg-secondary" />
                                  <DropdownMenuItem onClick={() => updateOrderStatus(order.id!, 'cancelled')} className="hover:bg-red-950/30 hover:text-red-300 cursor-pointer text-red-400">
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Cancel
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Enhanced Order Details Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="bg-card border-border/50 text-foreground sm:max-w-[800px] p-0 overflow-hidden gap-0 max-h-[90vh]">
          <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 p-6 border-b border-border/50">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <DialogTitle className="text-2xl font-bold text-foreground">Order #{formatOrderId(selectedOrder?.id)}</DialogTitle>
                  <Badge variant="outline" className={`${statusConfig[selectedOrder?.status || 'pending'].color} ${statusConfig[selectedOrder?.status || 'pending'].bgColor} border text-sm px-3 py-1 font-bold`}>
                    {statusConfig[selectedOrder?.status || 'pending'].label}
                  </Badge>
                </div>
                <p className="text-foreground text-sm flex items-center gap-2 font-medium">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(selectedOrder?.createdAt)}
                </p>
              </div>
              <Button variant="outline" size="sm" className="border-border/50 text-foreground gap-2 hover:bg-secondary hover:text-foreground">
                <Printer className="h-4 w-4" /> Print Invoice
              </Button>
            </div>

            {/* Enhanced Status Timeline */}
            <div className="mt-8 relative">
              <div className="absolute top-1/2 left-0 right-0 h-1 bg-secondary -translate-y-1/2 hidden md:block rounded-full" />
              <div className="flex justify-between relative z-10 overflow-x-auto pb-2 md:pb-0 gap-4 md:gap-0">
                {timelineSteps.map((step, idx) => {
                  const statusMap: { [key: string]: number } = { 'pending': 1, 'confirmed': 2, 'preparing': 3, 'out_for_delivery': 4, 'delivered': 5 };
                  const currentStepIndex = statusMap[selectedOrder?.status || 'pending'] || 0;
                  const isActive = idx + 1 <= currentStepIndex;
                  const isCurrent = idx + 1 === currentStepIndex;
                  const Icon = step.icon;

                  if (selectedOrder?.status === 'cancelled') return null;

                  return (
                    <div key={step.id} className="flex flex-col items-center gap-2 min-w-[90px]">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${isActive
                        ? 'bg-blue-600 border-blue-500 text-foreground shadow-lg shadow-blue-500/50'
                        : 'bg-card border-border/50 text-muted-foreground'
                        } ${isCurrent ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-900' : ''}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className={`text-xs font-bold whitespace-nowrap ${isActive ? 'text-blue-300' : 'text-muted-foreground'}`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
                {selectedOrder?.status === 'cancelled' && (
                  <div className="w-full flex justify-center text-red-300 font-bold items-center gap-2 bg-red-950/30 p-3 rounded-lg border border-red-800/50">
                    <XCircle className="h-5 w-5" /> Order Cancelled
                  </div>
                )}
              </div>
            </div>
          </div>

          <ScrollArea className="max-h-[500px]">
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-background/30">
              {/* Customer & Restaurant Info */}
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-border/50 rounded-xl p-5 shadow-lg">
                  <h4 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Customer Details
                  </h4>
                  <div className="flex items-center gap-3 mb-4">
                    <Avatar className="h-12 w-12 border-2 border-blue-500/30">
                      <AvatarFallback className="bg-blue-900 text-blue-200 font-bold text-lg">{selectedOrder?.customerName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-foreground font-bold text-lg">{selectedOrder?.customerName}</p>
                      <p className="text-sm text-blue-300 font-medium flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {selectedOrder?.customerPhone}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 text-sm text-foreground bg-background/50 p-3 rounded-lg border border-border/50/50">
                    <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-blue-400" />
                    <span className="line-clamp-3 font-medium">{(selectedOrder?.deliveryAddress as any)?.address || (typeof selectedOrder?.deliveryAddress === 'string' ? selectedOrder?.deliveryAddress : '')}</span>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-border/50 rounded-xl p-5 shadow-lg">
                  <h4 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                    <ChefHat className="h-4 w-4" />
                    Restaurant
                  </h4>
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 bg-orange-900/30 border border-orange-500/30 rounded-full flex items-center justify-center">
                      <ChefHat className="h-6 w-6 text-orange-400" />
                    </div>
                    <div>
                      <p className="text-foreground font-bold text-lg">{selectedOrder?.restaurantName}</p>
                      <p className="text-sm text-muted-foreground font-mono">ID: {selectedOrder?.restaurantId?.slice(0, 8)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-border/50 rounded-xl flex flex-col h-full shadow-lg">
                <div className="p-5 border-b border-border/50 flex justify-between items-center">
                  <h4 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4" />
                    Order Items
                  </h4>
                  <span className="text-xs text-muted-foreground bg-background px-2 py-1 rounded-full font-bold">{selectedOrder?.items?.length} Items</span>
                </div>
                <div className="flex-1 overflow-y-auto max-h-[250px] p-3 space-y-2">
                  {selectedOrder?.items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-secondary/30 hover:bg-secondary/50 p-3 rounded-lg transition-colors border border-border/50/50">
                      <div className="flex items-center gap-3">
                        <span className="bg-blue-900/50 text-blue-200 h-7 w-7 rounded flex items-center justify-center text-xs font-bold border border-blue-700/50">
                          {item.quantity}x
                        </span>
                        <span className="text-sm font-semibold text-foreground">{item.name}</span>
                      </div>
                      <span className="text-sm font-bold text-green-300">₹{item.price * item.quantity}</span>
                    </div>
                  ))}
                </div>
                <div className="p-5 bg-background/70 border-t border-border/50">
                  <div className="flex justify-between items-center mb-2 text-muted-foreground">
                    <span className="font-medium">Subtotal</span>
                    <span className="font-bold">₹{selectedOrder?.total}</span>
                  </div>
                  <div className="flex justify-between items-center mb-4 text-muted-foreground">
                    <span className="font-medium">Delivery Fee</span>
                    <span className="text-green-400 font-bold">Free</span>
                  </div>
                  <div className="w-full h-px bg-secondary mb-4" />
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-foreground">Total Amount</span>
                    <span className="text-2xl font-bold text-green-400">₹{selectedOrder?.total}</span>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <div className="bg-card border-t border-border/50 p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-muted-foreground font-medium">
                Quick Status Update:
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                {Object.keys(statusConfig).filter(s => s !== 'cancelled').map((status) => (
                  <Button
                    key={status}
                    variant="outline"
                    size="sm"
                    onClick={() => updateOrderStatus(selectedOrder?.id!, status)}
                    className={`border-border/50 bg-secondary/50 hover:bg-secondary hover:text-foreground font-bold ${selectedOrder?.status === status ? 'bg-blue-600/30 border-blue-500 text-blue-300' : 'text-muted-foreground'}`}
                  >
                    {statusConfig[status].label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </ProtectedRoute>
  );
}
