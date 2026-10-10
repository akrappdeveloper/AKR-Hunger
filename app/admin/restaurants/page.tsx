'use client';

import { useEffect, useState } from 'react';
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

import { ProtectedRoute } from '@/components/admin/ProtectedRoute';
import { RestaurantService } from '@/lib/services/RestaurantService';
import { useRouter } from 'next/navigation';

export default function RestaurantsPage() {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);

  // Details State
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [reviewsCount, setReviewsCount] = useState(0);
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = RestaurantService.listenAllRestaurants(
      (data) => {
        setRestaurants(data);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching restaurants:", error);
        toast.error("Failed to fetch restaurants");
        setLoading(false);
      }
    );
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
        const fetchedMenuItems = await RestaurantService.getRestaurantMenu(selectedRestaurant.id!);
        setMenuItems(fetchedMenuItems);

        const count = await RestaurantService.getReviewCount(selectedRestaurant.id!);
        setReviewsCount(count);
      } catch (error) {
        console.error("Error fetching restaurant details:", error);
      } finally {
        setDetailsLoading(false);
      }
    };

    fetchDetails();
  }, [selectedRestaurant]);

  const deleteRestaurant = async (id: string) => {
    if (!confirm('Are you sure you want to delete this restaurant? This action cannot be undone.')) return;
    try {
      await RestaurantService.deleteRestaurant(id);
      if (selectedRestaurant?.id === id) setSelectedRestaurant(null);
      toast.success("Restaurant deleted successfully");
    } catch (error) {
      console.error('Error deleting restaurant:', error);
      toast.error("Failed to delete restaurant");
    }
  };

  const toggleRestaurantStatus = async (id: string, currentStatus: boolean) => {
    try {
      await RestaurantService.toggleStatus(id, currentStatus);
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

  const totalRestaurants = restaurants.length;
  const activeRestaurants = restaurants.filter(r => r.isActive).length;
  const avgRating = totalRestaurants > 0
    ? (restaurants.reduce((acc, curr) => acc + (curr.rating || 0), 0) / totalRestaurants).toFixed(1)
    : 'New';

  return (
    <ProtectedRoute allowedRoles={['operations_admin']}>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Restaurant Management</h1>
            <p className="text-muted-foreground font-medium">Manage partner restaurants and oversee their performance.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-border/50 bg-secondary/50 text-foreground hover:bg-secondary hover:text-foreground font-semibold">
              <Download className="h-4 w-4 mr-2" /> Export
            </Button>
            <Button onClick={() => window.location.reload()} variant="outline" className="border-border/50 bg-secondary/50 text-foreground hover:bg-secondary hover:text-foreground font-semibold">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Enhanced Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-card border-border/50 shadow-sm hover:shadow-md transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-bold text-blue-500 uppercase tracking-widest">Total Partners</CardTitle>
              <div className="p-2.5 rounded-xl bg-blue-500/10 transition-colors">
                <Store className="h-5 w-5 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-foreground mb-1 tracking-tight">{totalRestaurants}</div>
              <p className="text-xs text-muted-foreground font-medium">Registered restaurants</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border/50 shadow-sm hover:shadow-md transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-bold text-emerald-500 uppercase tracking-widest">Active Now</CardTitle>
              <div className="p-2.5 rounded-xl bg-emerald-500/10 transition-colors">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-foreground mb-1 tracking-tight">{activeRestaurants}</div>
              <p className="text-xs text-muted-foreground font-medium">Open for business</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border/50 shadow-sm hover:shadow-md transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-bold text-amber-500 uppercase tracking-widest">Avg Rating</CardTitle>
              <div className="p-2.5 rounded-xl bg-amber-500/10 transition-colors">
                <Star className="h-5 w-5 text-amber-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-foreground mb-1 tracking-tight">{avgRating}</div>
              <p className="text-xs text-muted-foreground font-medium">Platform-wide average</p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card border-border/50 shadow-md overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/50 bg-secondary/20">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
                  <Store className="w-5 h-5 text-orange-500" />
                </div>
                <CardTitle className="text-xl text-foreground font-bold">All Restaurants</CardTitle>
              </div>

              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search restaurants..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-background border-border/50 text-foreground placeholder:text-muted-foreground focus-visible:ring-blue-600 focus-visible:border-blue-600 font-medium transition-all rounded-lg"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <Table>
                <TableHeader className="bg-secondary/50 text-foreground">
                  <TableRow className="border-border/50 hover:bg-secondary/50">
                    <TableHead className="font-bold text-muted-foreground pl-4">Restaurant</TableHead>
                    <TableHead className="font-bold text-muted-foreground">Contact</TableHead>
                    <TableHead className="font-bold text-muted-foreground">Cuisine</TableHead>
                    <TableHead className="font-bold text-muted-foreground">Status</TableHead>
                    <TableHead className="text-right font-bold text-muted-foreground pr-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                          <p>Loading restaurants...</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredRestaurants.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                        No restaurants found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRestaurants.map((restaurant) => (
                      <TableRow 
                        key={restaurant.id} 
                        className="border-border/50 hover:bg-secondary/20 transition-colors cursor-pointer"
                        onClick={() => router.push(`/admin/restaurants/${restaurant.id}`)}
                      >
                        <TableCell className="pl-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border-2 border-border/50 ring-2 ring-background">
                              <AvatarImage src={restaurant.image || ''} className="object-cover" />
                              <AvatarFallback className="bg-secondary text-muted-foreground font-bold">{restaurant.name?.charAt(0).toUpperCase() || 'R'}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span className="font-semibold text-foreground">{restaurant.name}</span>
                              <div className="flex items-center gap-1 text-xs text-yellow-500">
                                <Star className="h-3 w-3 fill-current" />
                                <span>{restaurant.rating?.toFixed(1) || '0.0'}</span>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col text-sm text-foreground gap-1">
                            <div className="flex items-center gap-1.5">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">{restaurant.email}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">{restaurant.phone}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {restaurant.cuisineType?.slice(0, 3).map((cuisine, idx) => (
                              <Badge key={idx} variant="outline" className="text-[10px] px-1.5 py-0 border-border/50 text-muted-foreground bg-secondary/20">
                                {cuisine}
                              </Badge>
                            ))}
                            {(restaurant.cuisineType?.length || 0) > 3 && (
                              <span className="text-[10px] text-muted-foreground">+{restaurant.cuisineType!.length - 3} more</span>
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
                        <TableCell className="text-right pr-4" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-card border-border/50 text-foreground w-48">
                              <DropdownMenuLabel className="text-xs uppercase text-muted-foreground tracking-wider">Options</DropdownMenuLabel>
                              <DropdownMenuSeparator className="bg-border/50" />
                              <DropdownMenuItem onClick={() => router.push(`/admin/restaurants/${restaurant.id}`)} className="hover:bg-secondary hover:text-foreground cursor-pointer">
                                <Store className="mr-2 h-4 w-4" /> View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleRestaurantStatus(restaurant.id!, restaurant.isActive!)} className="hover:bg-secondary hover:text-foreground cursor-pointer">
                                {restaurant.isActive ? (
                                  <><Ban className="mr-2 h-4 w-4 text-red-500" /> Disable</>
                                ) : (
                                  <><CheckCircle className="mr-2 h-4 w-4 text-green-500" /> Enable</>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-border/50" />
                              <DropdownMenuItem onClick={() => deleteRestaurant(restaurant.id!)} className="text-red-500 hover:text-red-400 hover:bg-red-500/20 cursor-pointer">
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
      </div>
    </ProtectedRoute>
  );
}
