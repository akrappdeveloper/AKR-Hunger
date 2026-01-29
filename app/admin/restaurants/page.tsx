'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, updateDoc, doc, deleteDoc, query, orderBy } from 'firebase/firestore';
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
  RefreshCw
} from 'lucide-react';
import { Restaurant, MenuItem } from '@/lib/types'; // Assuming MenuItem is needed for preview if we fetch it, for now just Restaurant
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

export default function RestaurantsPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);

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
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const deleteRestaurant = async (id: string) => {
    if (!confirm('Are you sure you want to delete this restaurant? This action cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'restaurants', id));
      if (selectedRestaurant?.id === id) setSelectedRestaurant(null);
    } catch (error) {
      console.error('Error deleting restaurant:', error);
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
    } catch (error) {
      console.error('Error updating restaurant status:', error);
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
                  <TableHead className="font-bold text-white pl-4">Restaurant</TableHead>
                  <TableHead className="font-bold text-white">Contact</TableHead>
                  <TableHead className="font-bold text-white">Cuisine</TableHead>
                  <TableHead className="font-bold text-white">Status</TableHead>
                  <TableHead className="text-right font-bold text-white pr-4">Actions</TableHead>
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
                    <TableCell colSpan={5} className="h-32 text-center text-white">
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
                            <Mail className="h-3 w-3 text-white" />
                            <span className="text-xs text-gray-200">{restaurant.email}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3 w-3 text-white" />
                            <span className="text-xs text-gray-200">{restaurant.phone}</span>
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
        <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-[700px] p-0 overflow-hidden gap-0">
          <div className="relative">
            <div className="h-32 bg-gradient-to-r from-blue-900/40 to-purple-900/40 w-full absolute top-0 left-0 z-0"></div>
            <div className="relative z-10 px-6 pt-16 pb-6 flex items-end gap-4">
              <Avatar className="h-24 w-24 border-4 border-gray-900 shadow-xl ring-2 ring-gray-800">
                <AvatarImage src={selectedRestaurant?.image} className="object-cover" />
                <AvatarFallback className="bg-gray-800 text-3xl font-bold">{selectedRestaurant?.name?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="mb-2">
                <h2 className="text-2xl font-bold text-white drop-shadow-md">{selectedRestaurant?.name}</h2>
                <div className="flex items-center gap-2 text-sm text-gray-300 drop-shadow-sm">
                  <MapPin className="h-3.5 w-3.5 text-blue-400" />
                  <span className="line-clamp-1 max-w-[300px]">{selectedRestaurant?.address}</span>
                </div>
              </div>
            </div>
          </div>

          <Tabs defaultValue="overview" className="w-full">
            <div className="px-6 border-b border-gray-800 bg-gray-900/50">
              <TabsList className="bg-transparent h-auto p-0 space-x-6">
                <TabsTrigger value="overview" className="bg-transparent border-b-2 border-transparent data-[state=active]:border-blue-500 rounded-none px-0 py-3 text-gray-400 data-[state=active]:text-blue-400 shadow-none">Overview</TabsTrigger>
                <TabsTrigger value="menu" className="bg-transparent border-b-2 border-transparent data-[state=active]:border-blue-500 rounded-none px-0 py-3 text-gray-400 data-[state=active]:text-blue-400 shadow-none">Menu & Cuisine</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview" className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-800/40 border border-gray-800 rounded-xl">
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Status</div>
                  <Badge className={selectedRestaurant?.isActive ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}>
                    {selectedRestaurant?.isActive ? 'Active' : 'Disabled'}
                  </Badge>
                </div>
                <div className="p-4 bg-gray-800/40 border border-gray-800 rounded-xl">
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Rating</div>
                  <div className="flex items-center gap-2 text-xl font-bold text-white">
                    {selectedRestaurant?.rating?.toFixed(1) || '0.0'}
                    <Star className="h-5 w-5 text-yellow-500 fill-current" />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-bold text-gray-200 flex items-center gap-2">
                  <Store className="h-4 w-4" /> Business Info
                </h4>
                <div className="bg-gray-950/50 rounded-lg border border-gray-800 p-4 space-y-3">
                  <div className="flex justify-between border-b border-gray-800 pb-2">
                    <span className="text-sm text-gray-400 font-medium">Email</span>
                    <span className="text-sm text-white font-semibold">{selectedRestaurant?.email}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-800 pb-2">
                    <span className="text-sm text-gray-400 font-medium">Phone</span>
                    <span className="text-sm text-white font-semibold">{selectedRestaurant?.phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400 font-medium">Description</span>
                  </div>
                  <p className="text-sm text-gray-200 italic font-medium">
                    {selectedRestaurant?.description || "No description provided."}
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="menu" className="p-6">
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-gray-200 flex items-center gap-2">
                  <ChefHat className="h-4 w-4" /> Cuisine Types
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedRestaurant?.cuisineType?.length ? (
                    selectedRestaurant.cuisineType.map((bg, i) => (
                      <Badge key={i} variant="secondary" className="bg-gray-800 text-blue-200 border-gray-700 font-semibold">
                        {bg}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-gray-400 font-medium">No cuisine types specificed.</span>
                  )}
                </div>

                <div className="h-32 flex items-center justify-center border border-dashed border-gray-700 rounded-lg bg-gray-900/30 text-gray-400 text-sm">
                  <UtensilsCrossed className="h-5 w-5 mr-2 opacity-50" />
                  <span className="font-medium">Menu Item list placeholder</span>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="bg-gray-900 border-t border-gray-800 p-4 flex sm:justify-between items-center">
            <Button
              variant="ghost"
              className="text-red-400 hover:text-red-300 hover:bg-red-950/30"
              onClick={() => deleteRestaurant(selectedRestaurant?.id!)}
            >
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSelectedRestaurant(null)} className="border-gray-700 text-white hover:bg-gray-800 font-medium">Close</Button>
              <Button
                onClick={() => toggleRestaurantStatus(selectedRestaurant?.id!, selectedRestaurant?.isActive!)}
                className={selectedRestaurant?.isActive ? "bg-orange-600 hover:bg-orange-700 text-white" : "bg-green-600 hover:bg-green-700 text-white"}
              >
                {selectedRestaurant?.isActive ? 'Deactivate' : 'Activate'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
