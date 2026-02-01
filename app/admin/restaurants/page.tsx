'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, updateDoc, doc, deleteDoc, query, orderBy, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Trash2,
  Edit2,
  CheckCircle,
  Clock,
  AlertCircle,
  Search,
  MoreVertical,
  MapPin,
  Phone,
  Mail,
  UtensilsCrossed,
  Store,
  Star,
  Ban,
  ChefHat,
  Download,
  RefreshCw,
  Building2,
  Landmark,
  CreditCard,
  User,
  ArrowRight
} from 'lucide-react';
import { Restaurant, MenuItem } from '@/lib/types';
import {
  Card,
  CardContent,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from 'sonner';

export default function RestaurantsPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);

  // Details State
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [reviewsCount, setReviewsCount] = useState(0);
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    // Real-time listener for restaurants
    const q = query(collection(db, 'restaurants'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Restaurant[];
      setRestaurants(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching restaurants:", error);
      toast.error("Failed to fetch restaurants");
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch details (Menu & Reviews) whenever selectedRestaurant changes
  useEffect(() => {
    if (!selectedRestaurant?.id) {
      setMenuItems([]);
      setReviewsCount(0);
      return;
    }

    const fetchDetails = async () => {
      setDetailsLoading(true);
      try {
        // 1. Fetch Menu Items (from root collection menuItems where restaurantId matches)
        // Note: Adjust collection name if your schema is different (e.g., subcollection)
        // Based on rules, we try fetching from root 'menuItems' first as per typical flat structure
        const menuQuery = query(collection(db, 'menuItems'), where('restaurantId', '==', selectedRestaurant.id));
        const menuSnap = await getDocs(menuQuery);
        const fetchedMenuItems = menuSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem));
        setMenuItems(fetchedMenuItems);

        // 2. Fetch Reviews Count
        const reviewsQuery = query(collection(db, 'reviews'), where('restaurantId', '==', selectedRestaurant.id));
        const reviewsSnap = await getDocs(reviewsQuery);
        setReviewsCount(reviewsSnap.size);

      } catch (error) {
        console.error("Error fetching restaurant details:", error);
        // toast.error("Could not load full details"); // Optional: don't spam toasts
      } finally {
        setDetailsLoading(false);
      }
    };

    fetchDetails();
  }, [selectedRestaurant]);


  const deleteRestaurant = async (id: string) => {
    if (!confirm('Are you sure you want to delete this restaurant? This action cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'restaurants', id));
      if (selectedRestaurant?.id === id) setSelectedRestaurant(null);
      toast.success("Restaurant deleted successfully");
    } catch (error) {
      console.error('Error deleting restaurant:', error);
      toast.error("Failed to delete restaurant");
    }
  };

  const toggleRestaurantStatus = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'restaurants', id), {
        isActive: !currentStatus,
      });
      if (selectedRestaurant?.id === id) {
        setSelectedRestaurant(prev => prev ? ({ ...prev, isActive: !currentStatus }) : null);
      }
      toast.success(`Restaurant ${!currentStatus ? 'activated' : 'deactivated'}`);
    } catch (error) {
      console.error('Error updating restaurant status:', error);
      toast.error("Failed to update status");
    }
  };

  const filteredRestaurants = restaurants.filter(
    (restaurant) =>
      restaurant.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      restaurant.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Stats
  const totalRestaurants = restaurants.length;
  const activeRestaurants = restaurants.filter(r => r.isActive).length;
  const avgRating = totalRestaurants > 0
    ? (restaurants.reduce((acc, curr) => acc + (curr.rating || 0), 0) / totalRestaurants).toFixed(1)
    : 'New';

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Restaurant Management</h1>
          <p className="text-gray-200 font-medium">Manage partner restaurants and oversee their performance.</p>
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

      {/* Enhanced Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-blue-900/30 to-gray-900 border-blue-500/30 text-white shadow-lg hover:shadow-blue-500/20 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-gray-100 uppercase tracking-widest">Total Partners</CardTitle>
            <Store className="h-5 w-5 text-blue-300" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-white mb-1">{totalRestaurants}</div>
            <p className="text-xs text-gray-200 font-medium">Registered restaurants</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-900/30 to-gray-900 border-green-500/30 text-white shadow-lg hover:shadow-green-500/20 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-gray-100 uppercase tracking-widest">Active Now</CardTitle>
            <CheckCircle className="h-5 w-5 text-green-300" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-green-300 mb-1">{activeRestaurants}</div>
            <p className="text-xs text-gray-200 font-medium">Open for business</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-900/30 to-gray-900 border-yellow-500/30 text-white shadow-lg hover:shadow-yellow-500/20 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-gray-100 uppercase tracking-widest">Avg Rating</CardTitle>
            <Star className="h-5 w-5 text-yellow-300" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-yellow-300 mb-1">{avgRating}</div>
            <p className="text-xs text-gray-200 font-medium">Platform-wide average</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl text-white font-bold">All Restaurants</CardTitle>

            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search restaurants..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-gray-900/50 border-gray-700 text-white placeholder:text-gray-400 focus-visible:ring-blue-600 focus-visible:border-blue-600 font-medium"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-gray-800 overflow-hidden">
            <Table>
              <TableHeader className="bg-gray-900 text-white">
                <TableRow className="border-gray-800 hover:bg-gray-900">
                  <TableHead className="font-bold text-gray-300 pl-4">Restaurant</TableHead>
                  <TableHead className="font-bold text-gray-300">Contact</TableHead>
                  <TableHead className="font-bold text-gray-300">Cuisine</TableHead>
                  <TableHead className="font-bold text-gray-300">Status</TableHead>
                  <TableHead className="text-right font-bold text-gray-300 pr-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-gray-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <p>Loading restaurants...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredRestaurants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-gray-400">
                      No restaurants found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRestaurants.map((restaurant) => (
                    <TableRow key={restaurant.id} className="border-gray-800 hover:bg-gray-800/20 transition-colors">
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border-2 border-gray-800 ring-2 ring-gray-900">
                            <AvatarImage src={restaurant.image || ''} className="object-cover" />
                            <AvatarFallback className="bg-gray-800 text-gray-400 font-bold">{restaurant.name?.charAt(0).toUpperCase() || 'R'}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-semibold text-white">{restaurant.name}</span>
                            <div className="flex items-center gap-1 text-xs text-yellow-500">
                              <Star className="h-3 w-3 fill-current" />
                              <span>{restaurant.rating?.toFixed(1) || '0.0'}</span>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-sm text-gray-200 gap-1">
                          <div className="flex items-center gap-1.5">
                            <Mail className="h-3 w-3 text-gray-400" />
                            <span className="text-xs text-gray-300">{restaurant.email}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3 w-3 text-gray-400" />
                            <span className="text-xs text-gray-300">{restaurant.phone}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {restaurant.cuisineType?.slice(0, 3).map((cuisine, idx) => (
                            <Badge key={idx} variant="outline" className="text-[10px] px-1.5 py-0 border-gray-700 text-gray-400 bg-gray-800/50">
                              {cuisine}
                            </Badge>
                          ))}
                          {(restaurant.cuisineType?.length || 0) > 3 && (
                            <span className="text-[10px] text-gray-500">+{restaurant.cuisineType!.length - 3} more</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full w-fit border text-xs font-medium ${restaurant.isActive
                          ? 'bg-green-500/10 text-green-400 border-green-500/20'
                          : 'bg-red-500/10 text-red-400 border-red-500/20'
                          }`}>
                          {restaurant.isActive ? 'Active' : 'Closed'}
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-gray-900 border-gray-800 text-gray-300 w-48">
                            <DropdownMenuLabel className="text-xs uppercase text-gray-500 tracking-wider">Options</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-gray-800" />
                            <DropdownMenuItem onClick={() => setSelectedRestaurant(restaurant)} className="hover:bg-gray-800 hover:text-white cursor-pointer">
                              <Store className="mr-2 h-4 w-4" /> View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleRestaurantStatus(restaurant.id!, restaurant.isActive!)} className="hover:bg-gray-800 hover:text-white cursor-pointer">
                              {restaurant.isActive ? (
                                <><Ban className="mr-2 h-4 w-4 text-red-400" /> Disable</>
                              ) : (
                                <><CheckCircle className="mr-2 h-4 w-4 text-green-400" /> Enable</>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-gray-800" />
                            <DropdownMenuItem onClick={() => deleteRestaurant(restaurant.id!)} className="text-red-400 hover:text-red-300 hover:bg-red-950/20 cursor-pointer">
                              <Trash2 className="mr-2 h-4 w-4" /> Delete Restaurant
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
        </CardContent>
      </Card>

      {/* Restaurant Details Dialog */}
      <Dialog open={!!selectedRestaurant} onOpenChange={(open) => !open && setSelectedRestaurant(null)}>
        <DialogContent className="bg-[#0a0a0a] border-gray-800 text-white sm:max-w-4xl p-0 overflow-hidden shadow-2xl gap-0 max-h-[90vh] flex flex-col">
          {/* Header Image & Info */}
          <div className="relative shrink-0">
            <DialogTitle className="sr-only">{selectedRestaurant?.name} Details</DialogTitle>
            <div className="h-40 bg-gradient-to-r from-blue-900/40 via-purple-900/40 to-gray-900 w-full absolute top-0 left-0 z-0"></div>
            <div className="absolute top-4 right-4 z-20 flex gap-2">
              <Badge className={`px-3 py-1 shadow-lg backdrop-blur-md border ${selectedRestaurant?.isActive ? 'bg-green-500/80 text-white border-green-400/30' : 'bg-red-500/80 text-white border-red-400/30'}`}>
                {selectedRestaurant?.isActive ? 'Active & Open' : 'Inactive'}
              </Badge>
            </div>

            <div className="relative z-10 px-8 pt-20 pb-6 flex flex-col md:flex-row items-start md:items-end gap-6">
              <Avatar className="h-28 w-28 border-4 border-[#0a0a0a] shadow-2xl ring-2 ring-gray-800 rounded-2xl bg-gray-900">
                <AvatarImage src={selectedRestaurant?.image} className="object-cover" />
                <AvatarFallback className="bg-gray-800 text-4xl font-bold text-gray-500">{selectedRestaurant?.name?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="mb-1 flex-1">
                <h2 className="text-3xl font-bold text-white drop-shadow-lg mb-2">{selectedRestaurant?.name}</h2>
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300">
                  <div className="flex items-center gap-1.5 bg-black/30 px-3 py-1 rounded-full border border-white/5 backdrop-blur-sm">
                    <MapPin className="h-3.5 w-3.5 text-blue-400" />
                    <span>{selectedRestaurant?.city || 'Location Unknown'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-black/30 px-3 py-1 rounded-full border border-white/5 backdrop-blur-sm">
                    <Star className="h-3.5 w-3.5 text-yellow-400 fill-current" />
                    <span className="font-bold text-white">{selectedRestaurant?.rating?.toFixed(1) || 'N/A'}</span>
                    <span className="text-gray-300">({reviewsCount} reviews)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Tabs defaultValue="overview" className="w-full flex-1 overflow-hidden flex flex-col">
            <div className="px-8 border-b border-gray-800 bg-gray-900/50 shrink-0">
              <TabsList className="bg-transparent h-auto p-0 space-x-8">
                <TabsTrigger value="overview" className="bg-transparent border-b-2 border-transparent data-[state=active]:border-blue-500 rounded-none px-0 py-4 text-gray-400 hover:text-white data-[state=active]:text-white data-[state=active]:bg-transparent font-medium transition-all shadow-none">Overview</TabsTrigger>
                <TabsTrigger value="contact" className="bg-transparent border-b-2 border-transparent data-[state=active]:border-blue-500 rounded-none px-0 py-4 text-gray-400 hover:text-white data-[state=active]:text-white data-[state=active]:bg-transparent font-medium transition-all shadow-none">Contact & Location</TabsTrigger>
                <TabsTrigger value="bank" className="bg-transparent border-b-2 border-transparent data-[state=active]:border-blue-500 rounded-none px-0 py-4 text-gray-400 hover:text-white data-[state=active]:text-white data-[state=active]:bg-transparent font-medium transition-all shadow-none">Bank Details</TabsTrigger>
                <TabsTrigger value="menu" className="bg-transparent border-b-2 border-transparent data-[state=active]:border-blue-500 rounded-none px-0 py-4 text-gray-400 hover:text-white data-[state=active]:text-white data-[state=active]:bg-transparent font-medium transition-all shadow-none">Menu & Cuisine</TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              <TabsContent value="overview" className="space-y-8 mt-0 focus-visible:ring-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Quick Stats */}
                  <div className="bg-gray-900/30 p-5 rounded-2xl border border-white/5">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Store className="w-4 h-4" /> Description
                    </h4>
                    <p className="text-gray-300 leading-relaxed italic">
                      "{selectedRestaurant?.description || "No description provided for this restaurant."}"
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-gray-900/30 p-5 rounded-2xl border border-white/5 flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Total Reviews</h4>
                        <p className="text-2xl font-bold text-white">{reviewsCount || 0}</p>
                      </div>
                      <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                        <Star className="w-5 h-5 text-blue-500" />
                      </div>
                    </div>
                    <div className="bg-gray-900/30 p-5 rounded-2xl border border-white/5 flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Platform Status</h4>
                        <p className="text-2xl font-bold text-white">{selectedRestaurant?.isActive ? 'Online' : 'Offline'}</p>
                      </div>
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center border ${selectedRestaurant?.isActive ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
                        {selectedRestaurant?.isActive ? <CheckCircle className="w-5 h-5" /> : <Ban className="w-5 h-5" />}
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="contact" className="space-y-6 mt-0 focus-visible:ring-0">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-gray-900/30 p-6 rounded-2xl border border-white/5 space-y-4">
                    <h4 className="text-sm font-bold text-blue-400 flex items-center gap-2 uppercase tracking-wide">
                      <User className="h-4 w-4" /> Contact Information
                    </h4>
                    <div className="space-y-4">
                      <div className="group">
                        <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Email Address</label>
                        <div className="flex items-center gap-3 text-gray-200 bg-black/20 p-3 rounded-lg border border-white/5">
                          <Mail className="w-4 h-4 text-gray-400" />
                          {selectedRestaurant?.email}
                        </div>
                      </div>
                      <div className="group">
                        <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Phone Number</label>
                        <div className="flex items-center gap-3 text-gray-200 bg-black/20 p-3 rounded-lg border border-white/5">
                          <Phone className="w-4 h-4 text-gray-400" />
                          {selectedRestaurant?.phone}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-900/30 p-6 rounded-2xl border border-white/5 space-y-4">
                    <h4 className="text-sm font-bold text-green-400 flex items-center gap-2 uppercase tracking-wide">
                      <MapPin className="h-4 w-4" /> Address Details
                    </h4>
                    <div className="space-y-4">
                      <div className="bg-black/20 p-4 rounded-xl border border-white/5 space-y-3">
                        <p className="text-white font-medium">{selectedRestaurant?.street || selectedRestaurant?.address || 'No street address'}</p>
                        <div className="flex gap-4 text-sm text-gray-400">
                          <span>{selectedRestaurant?.city}</span>
                          <span>{selectedRestaurant?.state}</span>
                          <span>{selectedRestaurant?.pincode}</span>
                        </div>
                      </div>
                      {(selectedRestaurant?.latitude && selectedRestaurant?.longitude) && (
                        <div className="flex items-center gap-2 text-xs text-gray-500 bg-black/20 p-2 rounded border border-white/5 w-fit">
                          <span className="font-mono text-gray-300">LAT: {selectedRestaurant.latitude}</span>
                          <span className="w-px h-3 bg-gray-700"></span>
                          <span className="font-mono text-gray-300">LNG: {selectedRestaurant.longitude}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="bank" className="mt-0 focus-visible:ring-0">
                <div className="bg-gradient-to-br from-gray-900 to-black p-8 rounded-2xl border border-white/10 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-32 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

                  <h4 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wide mb-6 relative z-10">
                    <Building2 className="h-5 w-5 text-blue-400" /> Banking Information
                  </h4>

                  {selectedRestaurant?.bankDetails ? (
                    <div className="grid md:grid-cols-2 gap-8 relative z-10">
                      <div className="space-y-6">
                        <div>
                          <label className="text-xs text-gray-500 uppercase tracking-widest block mb-2">Account Holder</label>
                          <p className="text-xl text-white font-medium flex items-center gap-3">
                            <User className="w-5 h-5 text-gray-400" />
                            {selectedRestaurant.bankDetails.accountHolderName}
                          </p>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 uppercase tracking-widest block mb-2">Bank Name</label>
                          <p className="text-xl text-white font-medium flex items-center gap-3">
                            <Landmark className="w-5 h-5 text-gray-400" />
                            {selectedRestaurant.bankDetails.bankName}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-6">
                        <div>
                          <label className="text-xs text-gray-500 uppercase tracking-widest block mb-2">Account Number</label>
                          <p className="text-xl text-white font-mono font-medium flex items-center gap-3 bg-black/30 p-3 rounded-lg border border-white/5 w-fit">
                            <CreditCard className="w-5 h-5 text-gray-400" />
                            {selectedRestaurant.bankDetails.accountNumber}
                          </p>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 uppercase tracking-widest block mb-2">IFSC Code</label>
                          <p className="text-xl text-white font-mono font-medium flex items-center gap-3">
                            <Building2 className="w-5 h-5 text-gray-400" />
                            {selectedRestaurant.bankDetails.ifscCode}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                      <AlertCircle className="w-12 h-12 mb-4 opacity-50" />
                      <p>No bank details available for this partner.</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="menu" className="mt-0 focus-visible:ring-0 space-y-6 pb-6">
                <div className="bg-gray-900/30 p-6 rounded-2xl border border-white/5">
                  <h4 className="text-sm font-bold text-orange-400 flex items-center gap-2 uppercase tracking-wide mb-4">
                    <ChefHat className="h-4 w-4" /> Cuisine Types
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedRestaurant?.cuisineType?.length ? (
                      selectedRestaurant.cuisineType.map((cuisine, i) => (
                        <Badge key={i} variant="secondary" className="bg-black/40 text-gray-200 border border-white/10 px-3 py-1.5 text-sm hover:bg-white/10 transition-colors">
                          {cuisine}
                        </Badge>
                      ))
                    ) : (
                      <div className="flex items-center gap-2 text-gray-500 text-sm">
                        <AlertCircle className="w-4 h-4" />
                        No specific cuisines tagged.
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wide mb-4">
                    <UtensilsCrossed className="h-4 w-4" /> Menu Items ({menuItems.length})
                  </h4>

                  {detailsLoading ? (
                    <div className="h-40 flex items-center justify-center text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <p>Loading menu...</p>
                      </div>
                    </div>
                  ) : menuItems.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {menuItems.map((item) => (
                        <div key={item.id} className="flex gap-4 p-3 rounded-xl bg-gray-900/30 border border-white/5 hover:bg-gray-900/50 transition-colors">
                          <div className="h-20 w-20 shrink-0 rounded-lg bg-gray-800 overflow-hidden">
                            <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                          </div>
                          <div className="flex flex-col justify-between flex-1 py-1">
                            <div>
                              <div className="flex justify-between items-start">
                                <h5 className="font-semibold text-white line-clamp-1">{item.name}</h5>
                                <div className="flex items-center gap-1 text-[10px] text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded">
                                  <Star className="w-3 h-3 fill-current" /> {item.averageRating?.toFixed(1) || 'N/A'}
                                </div>
                              </div>
                              <p className="text-xs text-gray-400 line-clamp-2 mt-1">{item.description}</p>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <span className="font-mono font-bold text-white">₹{item.price}</span>
                              <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ${item.vegetarian ? 'border-green-800 text-green-400 bg-green-900/20' : 'border-red-800 text-red-400 bg-red-900/20'}`}>
                                {item.vegetarian ? 'VEG' : 'NON-VEG'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-32 flex flex-col items-center justify-center border border-dashed border-gray-800 rounded-lg bg-gray-900/30 text-gray-400 text-sm">
                      <UtensilsCrossed className="h-6 w-6 mb-2 opacity-50" />
                      <span className="font-medium">No menu items found for this restaurant.</span>
                    </div>
                  )}
                </div>
              </TabsContent>
            </div>

            <DialogFooter className="bg-[#0a0a0a] border-t border-gray-800 p-6 flex justify-between items-center shrink-0 z-20">
              <Button
                variant="ghost"
                className="text-red-500 hover:text-red-400 hover:bg-red-500/10 px-4"
                onClick={() => deleteRestaurant(selectedRestaurant?.id!)}
              >
                <Trash2 className="h-4 w-4 mr-2" /> Delete Partner
              </Button>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setSelectedRestaurant(null)} className="border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800">
                  Close
                </Button>
                <Button
                  onClick={() => toggleRestaurantStatus(selectedRestaurant?.id!, selectedRestaurant?.isActive!)}
                  className={`min-w-[120px] shadow-lg ${selectedRestaurant?.isActive ? "bg-red-600 hover:bg-red-500 text-white border border-red-500/50" : "bg-green-600 hover:bg-green-500 text-white border border-green-500/50"}`}
                >
                  {selectedRestaurant?.isActive ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            </DialogFooter>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
