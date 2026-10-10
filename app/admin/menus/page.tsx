'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, updateDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MenuItem, Restaurant } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  BookOpen, Search, Store, Eye, Edit, ToggleLeft, ToggleRight,
  CheckCircle, XCircle, Clock, Filter, Package, Utensils,
  IndianRupee, Star, Leaf, Flame, Image, ShoppingBag, Activity, Users
} from 'lucide-react';
import { toast } from 'sonner';

interface MenuItemWithRestaurant extends MenuItem {
  restaurantName: string;
}

export default function AdminMenusPage() {
  const [menuItems, setMenuItems] = useState<MenuItemWithRestaurant[]>([]);
  const [restaurants, setRestaurants] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [restaurantFilter, setRestaurantFilter] = useState('all');
  const [allRestaurants, setAllRestaurants] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItemWithRestaurant | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    price: 0,
    description: '',
    available: true,
    vegetarian: false,
    spicy: false,
  });
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<MenuItemWithRestaurant | null>(null);

  useEffect(() => {
    // Fetch restaurants first
    const unsubRest = onSnapshot(collection(db, 'restaurants'), (snap) => {
      const restMap: Record<string, string> = {};
      const restList: { id: string; name: string }[] = [];
      snap.docs.forEach(doc => {
        const data = doc.data();
        restMap[doc.id] = data.name || 'Unknown';
        restList.push({ id: doc.id, name: data.name || 'Unknown' });
      });
      setRestaurants(restMap);
      setAllRestaurants(restList.sort((a, b) => a.name.localeCompare(b.name)));
    });

    // Fetch all menu items
    const unsubMenu = onSnapshot(collection(db, 'menuItems'), (snap) => {
      const items = snap.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
      })) as MenuItem[];
      setMenuItems(items.map(item => ({
        ...item,
        restaurantName: '',
      })));

      // Extract unique categories
      const cats = [...new Set(items.map(i => i.category).filter(Boolean))].sort();
      setCategories(cats);
      setLoading(false);
    });

    return () => {
      unsubRest();
      unsubMenu();
    };
  }, []);

  // Enrich items with restaurant names
  const enrichedItems = menuItems.map(item => ({
    ...item,
    restaurantName: restaurants[item.restaurantId] || 'Unknown',
  }));

  // Apply filters
  const filteredItems = enrichedItems.filter(item => {
    const matchesSearch = searchQuery === '' ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.restaurantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'available' && item.available) ||
      (statusFilter === 'unavailable' && !item.available) ||
      (statusFilter === 'pending' && item.approvalStatus === 'pending') ||
      (statusFilter === 'approved' && item.approvalStatus === 'approved') ||
      (statusFilter === 'rejected' && item.approvalStatus === 'rejected');
    const matchesRestaurant = restaurantFilter === 'all' || item.restaurantId === restaurantFilter;
    return matchesSearch && matchesCategory && matchesStatus && matchesRestaurant;
  });

  const handleOpenEdit = (item: MenuItemWithRestaurant) => {
    setSelectedItem(item);
    setEditForm({
      name: item.name,
      price: item.price,
      description: item.description,
      available: item.available,
      vegetarian: item.vegetarian,
      spicy: item.spicy,
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedItem) return;
    try {
      await updateDoc(doc(db, 'menuItems', selectedItem.id), {
        name: editForm.name,
        price: editForm.price,
        description: editForm.description,
        available: editForm.available,
        vegetarian: editForm.vegetarian,
        spicy: editForm.spicy,
        updatedAt: new Date(),
      });
      toast.success('Menu item updated successfully');
      setEditDialogOpen(false);
    } catch (err) {
      toast.error('Failed to update menu item');
      console.error(err);
    }
  };

  const handleToggleAvailability = async (item: MenuItemWithRestaurant) => {
    try {
      await updateDoc(doc(db, 'menuItems', item.id), {
        available: !item.available,
      });
      toast.success(`${item.name} is now ${item.available ? 'unavailable' : 'available'}`);
    } catch (err) {
      toast.error('Failed to update availability');
    }
  };

  const handleApproval = async (item: MenuItemWithRestaurant, status: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'menuItems', item.id), {
        approvalStatus: status,
        isLive: status === 'approved',
      });
      toast.success(`Menu item ${status}`);
    } catch (err) {
      toast.error(`Failed to ${status} item`);
    }
  };

  // Stats
  const totalItems = enrichedItems.length;
  const availableItems = enrichedItems.filter(i => i.available).length;
  const vegItems = enrichedItems.filter(i => i.vegetarian).length;
  const pendingApproval = enrichedItems.filter(i => i.approvalStatus === 'pending').length;
  const avgPrice = totalItems > 0 ? Math.round(enrichedItems.reduce((s, i) => s + i.price, 0) / totalItems) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-4">
          <div className="h-10 w-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading menu items...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-100 to-gray-400 tracking-tight mb-2">
          Menu Management
        </h1>
        <p className="text-muted-foreground">Browse, edit, and manage menu items across all restaurants.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { title: 'Total Items', value: totalItems, icon: BookOpen, color: 'blue' },
          { title: 'Available', value: availableItems, icon: CheckCircle, color: 'emerald' },
          { title: 'Vegetarian', value: vegItems, icon: Leaf, color: 'green' },
          { title: 'Pending Approval', value: pendingApproval, icon: Clock, color: 'yellow' },
          { title: 'Avg Price', value: `₹${avgPrice}`, icon: IndianRupee, color: 'purple' },
        ].map((stat, i) => {
          const Icon = stat.icon;
          const colors: Record<string, string> = {
            blue: 'from-blue-600/20 to-blue-600/5 border-blue-500/20',
            emerald: 'from-emerald-600/20 to-emerald-600/5 border-emerald-500/20',
            green: 'from-green-600/20 to-green-600/5 border-green-500/20',
            yellow: 'from-yellow-600/20 to-yellow-600/5 border-yellow-500/20',
            purple: 'from-purple-600/20 to-purple-600/5 border-purple-500/20',
          };
          const iconColors: Record<string, string> = {
            blue: 'text-blue-400', emerald: 'text-emerald-400', green: 'text-green-400',
            yellow: 'text-yellow-400', purple: 'text-purple-400',
          };
          return (
            <Card key={i} className={`bg-gradient-to-br ${colors[stat.color]} border backdrop-blur-md shadow-xl`}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <Icon className={`w-5 h-5 ${iconColors[stat.color]}`} />
                </div>
                <p className="text-2xl font-bold text-foreground font-mono">{stat.value}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{stat.title}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters & Menu Table */}
      <Card className="bg-background/40 border-border/50 backdrop-blur-md shadow-xl overflow-hidden">
        <CardHeader className="border-b border-border/50 bg-card/5 pb-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Utensils className="w-5 h-5 text-blue-400" />
                All Menu Items
                <Badge variant="outline" className="bg-card/5 text-muted-foreground border-border/50 text-xs ml-2">
                  {filteredItems.length} of {totalItems}
                </Badge>
              </CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search items, restaurants..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-background/20 border-border/50 text-foreground placeholder:text-muted-foreground w-64"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={restaurantFilter}
                onChange={(e) => setRestaurantFilter(e.target.value)}
                className="px-3 py-2 bg-background/20 border border-border/50 rounded-lg text-foreground text-sm focus:outline-none focus:border-blue-500/50"
              >
                <option value="all">All Restaurants</option>
                {allRestaurants.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 bg-background/20 border border-border/50 rounded-lg text-foreground text-sm focus:outline-none focus:border-blue-500/50"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-background/20 border border-border/50 rounded-lg text-foreground text-sm focus:outline-none focus:border-blue-500/50"
              >
                <option value="all">All Status</option>
                <option value="available">Available</option>
                <option value="unavailable">Unavailable</option>
                <option value="pending">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Utensils className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium">No menu items found</p>
              <p className="text-sm">Try adjusting your filters or search query.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Item</TableHead>
                    <TableHead className="text-muted-foreground">Restaurant</TableHead>
                    <TableHead className="text-muted-foreground">Category</TableHead>
                    <TableHead className="text-muted-foreground text-right">Price</TableHead>
                    <TableHead className="text-muted-foreground text-center">Type</TableHead>
                    <TableHead className="text-muted-foreground text-center">Available</TableHead>
                    <TableHead className="text-muted-foreground text-center">Approval</TableHead>
                    <TableHead className="text-muted-foreground text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.slice(0, 50).map((item) => (
                    <TableRow key={item.id} className="border-border/50 hover:bg-card/5 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-10 h-10 rounded-lg object-cover border border-border/50" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-card/5 flex items-center justify-center border border-border/50">
                              <Image className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <p className="text-foreground font-medium text-sm">{item.name}</p>
                            {item.isBestSeller && (
                              <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20 text-[9px] mt-0.5">
                                Best Seller
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{item.restaurantName}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{item.category || '-'}</TableCell>
                      <TableCell className="text-emerald-400 text-right font-mono text-sm font-bold">₹{item.price}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {item.vegetarian && (
                            <span className="text-green-400" title="Vegetarian">
                              <Leaf size={14} />
                            </span>
                          )}
                          {item.spicy && (
                            <span className="text-red-400" title="Spicy">
                              <Flame size={14} />
                            </span>
                          )}
                          {!item.vegetarian && !item.spicy && (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <button onClick={() => handleToggleAvailability(item)} className="inline-flex">
                          {item.available ? (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] cursor-pointer hover:bg-emerald-500/20 gap-1">
                              <ToggleRight size={10} /> Yes
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 text-[10px] cursor-pointer hover:bg-red-500/20 gap-1">
                              <ToggleLeft size={10} /> No
                            </Badge>
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="text-center">
                        {item.approvalStatus === 'pending' ? (
                          <div className="flex items-center justify-center gap-1">
                            <Button size="sm" variant="ghost" onClick={() => handleApproval(item, 'approved')} className="text-emerald-400 hover:bg-emerald-500/10 h-6 w-6 p-0">
                              <CheckCircle size={12} />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleApproval(item, 'rejected')} className="text-red-400 hover:bg-red-500/10 h-6 w-6 p-0">
                              <XCircle size={12} />
                            </Button>
                          </div>
                        ) : (
                          <Badge variant="outline" className={`text-[10px] capitalize ${
                            item.approvalStatus === 'approved'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : item.approvalStatus === 'rejected'
                                ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                : 'bg-gray-500/10 text-muted-foreground border-border/20'
                          }`}>
                            {item.approvalStatus || 'N/A'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setDetailItem(item); setDetailDialogOpen(true); }}
                            className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 h-8 w-8 p-0"
                          >
                            <Eye size={14} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenEdit(item)}
                            className="text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 h-8 w-8 p-0"
                          >
                            <Edit size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredItems.length > 50 && (
                <div className="text-center py-4 text-muted-foreground text-sm border-t border-border/50">
                  Showing first 50 of {filteredItems.length} items. Use filters to narrow down.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-card border-border/50 text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Menu Item</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {selectedItem?.restaurantName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label className="text-muted-foreground text-sm">Item Name</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                className="mt-1 bg-background/20 border-border/50 text-foreground"
              />
            </div>
            <div>
              <Label className="text-muted-foreground text-sm">Price (₹)</Label>
              <Input
                type="number"
                value={editForm.price}
                onChange={(e) => setEditForm(prev => ({ ...prev, price: Number(e.target.value) }))}
                className="mt-1 bg-background/20 border-border/50 text-foreground font-mono"
              />
            </div>
            <div>
              <Label className="text-muted-foreground text-sm">Description</Label>
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="mt-1 w-full px-4 py-3 bg-background/20 border border-border/50 rounded-lg text-foreground focus:outline-none focus:border-blue-500/50 resize-none text-sm"
              />
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.available}
                  onChange={(e) => setEditForm(prev => ({ ...prev, available: e.target.checked }))}
                  className="w-4 h-4 rounded bg-background/40 border-border text-blue-600"
                />
                <span className="text-muted-foreground text-sm">Available</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.vegetarian}
                  onChange={(e) => setEditForm(prev => ({ ...prev, vegetarian: e.target.checked }))}
                  className="w-4 h-4 rounded bg-background/40 border-border text-green-600"
                />
                <span className="text-muted-foreground text-sm flex items-center gap-1"><Leaf size={12} className="text-green-400" /> Veg</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.spicy}
                  onChange={(e) => setEditForm(prev => ({ ...prev, spicy: e.target.checked }))}
                  className="w-4 h-4 rounded bg-background/40 border-border text-red-600"
                />
                <span className="text-muted-foreground text-sm flex items-center gap-1"><Flame size={12} className="text-red-400" /> Spicy</span>
              </label>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="border-border/50 text-foreground hover:bg-card/10">
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} className="bg-blue-600 hover:bg-blue-700 text-foreground">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="bg-card border-border/50 text-foreground max-w-lg">
          <DialogHeader>
            <DialogTitle>{detailItem?.name}</DialogTitle>
            <DialogDescription className="text-muted-foreground">{detailItem?.restaurantName}</DialogDescription>
          </DialogHeader>
          {detailItem && (
            <div className="space-y-4 mt-4">
              {detailItem.image && (
                <img src={detailItem.image} alt={detailItem.name} className="w-full h-48 object-cover rounded-xl border border-border/50" />
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-background/20 rounded-xl p-4 border border-border/50">
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Price</p>
                  <p className="text-emerald-400 font-bold font-mono text-lg">₹{detailItem.price}</p>
                </div>
                <div className="bg-background/20 rounded-xl p-4 border border-border/50">
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Category</p>
                  <p className="text-foreground font-medium">{detailItem.category || 'Uncategorized'}</p>
                </div>
                <div className="bg-background/20 rounded-xl p-4 border border-border/50">
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Status</p>
                  <div className="flex items-center gap-2 mt-1">
                    {detailItem.available ? (
                      <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">Available</Badge>
                    ) : (
                      <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-xs">Unavailable</Badge>
                    )}
                  </div>
                </div>
                <div className="bg-background/20 rounded-xl p-4 border border-border/50">
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Type</p>
                  <div className="flex items-center gap-2 mt-1">
                    {detailItem.vegetarian && <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-xs gap-1"><Leaf size={10} /> Veg</Badge>}
                    {detailItem.spicy && <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-xs gap-1"><Flame size={10} /> Spicy</Badge>}
                    {!detailItem.vegetarian && !detailItem.spicy && <span className="text-muted-foreground text-sm">Standard</span>}
                  </div>
                </div>
              </div>
              {detailItem.description && (
                <div className="bg-background/20 rounded-xl p-4 border border-border/50">
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-2">Description</p>
                  <p className="text-muted-foreground text-sm">{detailItem.description}</p>
                </div>
              )}
              {(detailItem.preparationTime || detailItem.calories || detailItem.servings) && (
                <div className="grid grid-cols-3 gap-4">
                  {detailItem.preparationTime && (
                    <div className="bg-background/20 rounded-xl p-3 border border-border/50 text-center">
                      <Clock className="w-4 h-4 text-orange-400 mx-auto mb-1" />
                      <p className="text-foreground font-mono text-sm">{detailItem.preparationTime} min</p>
                      <p className="text-muted-foreground text-[10px]">Prep time</p>
                    </div>
                  )}
                  {detailItem.calories && (
                    <div className="bg-background/20 rounded-xl p-3 border border-border/50 text-center">
                      <Activity className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                      <p className="text-foreground font-mono text-sm">{detailItem.calories}</p>
                      <p className="text-muted-foreground text-[10px]">Calories</p>
                    </div>
                  )}
                  {detailItem.servings && (
                    <div className="bg-background/20 rounded-xl p-3 border border-border/50 text-center">
                      <Users className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                      <p className="text-foreground font-mono text-sm">{detailItem.servings}</p>
                      <p className="text-muted-foreground text-[10px]">Servings</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
