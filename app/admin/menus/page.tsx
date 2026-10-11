'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  updateDoc,
  doc,
  addDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MenuItem } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  BookOpen,
  Search,
  Store,
  Eye,
  Edit,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  Package,
  Utensils,
  IndianRupee,
  Star,
  Leaf,
  Flame,
  Image as ImageIcon,
  Plus,
  Trash2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Award,
  Check,
  X,
  ChefHat,
  Tag,
  Percent,
} from 'lucide-react';
import { toast } from 'sonner';

interface MenuItemWithRestaurant extends MenuItem {
  restaurantName: string;
}

const DEFAULT_CATEGORIES = [
  'Pizza',
  'Burgers & Wraps',
  'Biryani & Rice',
  'North Indian',
  'South Indian',
  'Chinese & Asian',
  'Street Food & Chaat',
  'Rolls & Shawarma',
  'Sandwiches & Snacks',
  'Desserts & Ice Cream',
  'Cakes & Bakery',
  'Beverages & Shakes',
  'Healthy & Salads',
  'Combos & Thali',
];

export default function AdminMenusPage() {
  const [menuItems, setMenuItems] = useState<MenuItemWithRestaurant[]>([]);
  const [restaurants, setRestaurants] = useState<Record<string, string>>({});
  const [allRestaurants, setAllRestaurants] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [restaurantFilter, setRestaurantFilter] = useState('all');
  const [dietaryFilter, setDietaryFilter] = useState<'all' | 'veg' | 'non-veg'>('all');

  // Edit Dialog State
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItemWithRestaurant | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    restaurantId: '',
    category: '',
    customCategory: '',
    price: 0,
    originalPrice: 0,
    description: '',
    image: '',
    available: true,
    isLive: true,
    vegetarian: false,
    dietaryType: 'non-vegetarian' as 'vegetarian' | 'non-vegetarian' | 'vegan',
    spicy: false,
    preparationTime: 20,
    servings: 1,
    calories: 0,
    isBestSeller: false,
    isChefSpecial: false,
    isMustTry: false,
    isTrending: false,
    isNew: false,
    approvalStatus: 'approved' as 'pending' | 'approved' | 'rejected',
  });

  // Add Item Dialog State
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [savingAdd, setSavingAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    restaurantId: '',
    category: 'Pizza',
    customCategory: '',
    price: 199,
    originalPrice: 249,
    description: '',
    image: '',
    available: true,
    isLive: true,
    vegetarian: false,
    dietaryType: 'non-vegetarian' as 'vegetarian' | 'non-vegetarian' | 'vegan',
    spicy: false,
    preparationTime: 25,
    servings: 1,
    calories: 350,
    isBestSeller: false,
    isChefSpecial: false,
    isMustTry: false,
    isTrending: false,
    isNew: true,
    approvalStatus: 'approved' as 'pending' | 'approved' | 'rejected',
  });

  // Detail Dialog State
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<MenuItemWithRestaurant | null>(null);

  // Delete Confirm Dialog State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<MenuItemWithRestaurant | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    // 1. Listen to restaurants
    const unsubRest = onSnapshot(collection(db, 'restaurants'), (snap) => {
      const restMap: Record<string, string> = {};
      const restList: { id: string; name: string }[] = [];
      snap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const rName = data.name || 'Unnamed Restaurant';
        restMap[docSnap.id] = rName;
        restList.push({ id: docSnap.id, name: rName });
      });
      setRestaurants(restMap);
      setAllRestaurants(restList.sort((a, b) => a.name.localeCompare(b.name)));
    });

    // 2. Listen to menuItems
    const unsubMenu = onSnapshot(collection(db, 'menuItems'), (snap) => {
      const items = snap.docs.map((docSnap) => ({
        ...docSnap.data(),
        id: docSnap.id,
      })) as MenuItem[];

      setMenuItems(
        items.map((item) => ({
          ...item,
          restaurantName: '',
        }))
      );

      // Extract unique categories and merge with defaults
      const existingCats = items.map((i) => i.category).filter(Boolean);
      const uniqueCats = Array.from(new Set([...DEFAULT_CATEGORIES, ...existingCats])).sort();
      setCategories(uniqueCats);
      setLoading(false);
    });

    return () => {
      unsubRest();
      unsubMenu();
    };
  }, []);

  // Enrich items with restaurant names
  const enrichedItems: MenuItemWithRestaurant[] = menuItems.map((item) => ({
    ...item,
    restaurantName: restaurants[item.restaurantId] || item.restaurantId || 'AKR Hunger',
  }));

  // Apply filters
  const filteredItems = enrichedItems.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      q === '' ||
      item.name?.toLowerCase().includes(q) ||
      item.restaurantName?.toLowerCase().includes(q) ||
      item.category?.toLowerCase().includes(q) ||
      item.description?.toLowerCase().includes(q);

    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'available' && item.available) ||
      (statusFilter === 'unavailable' && !item.available) ||
      (statusFilter === 'pending' && item.approvalStatus === 'pending') ||
      (statusFilter === 'approved' && (item.approvalStatus === 'approved' || !item.approvalStatus)) ||
      (statusFilter === 'rejected' && item.approvalStatus === 'rejected');

    const matchesRestaurant = restaurantFilter === 'all' || item.restaurantId === restaurantFilter;

    const matchesDietary =
      dietaryFilter === 'all' ||
      (dietaryFilter === 'veg' && item.vegetarian) ||
      (dietaryFilter === 'non-veg' && !item.vegetarian);

    return matchesSearch && matchesCategory && matchesStatus && matchesRestaurant && matchesDietary;
  });

  // Open Edit Dialog with Full Menu Attributes
  const handleOpenEdit = (item: MenuItemWithRestaurant) => {
    setSelectedItem(item);
    const isVeg = item.vegetarian ?? (item.dietary?.includes('vegetarian') || false);
    setEditForm({
      name: item.name || '',
      restaurantId: item.restaurantId || (allRestaurants[0]?.id ?? ''),
      category: item.category || 'Pizza',
      customCategory: '',
      price: item.price || 0,
      originalPrice: (item as any).originalPrice || item.price || 0,
      description: item.description || '',
      image: item.image || '',
      available: item.available ?? true,
      isLive: item.isLive ?? true,
      vegetarian: isVeg,
      dietaryType: isVeg ? 'vegetarian' : 'non-vegetarian',
      spicy: item.spicy ?? false,
      preparationTime: item.preparationTime || 20,
      servings: item.servings || 1,
      calories: item.calories || 0,
      isBestSeller: item.isBestSeller ?? false,
      isChefSpecial: item.isChefSpecial ?? false,
      isMustTry: item.isMustTry ?? false,
      isTrending: item.isTrending ?? false,
      isNew: item.isNew ?? false,
      approvalStatus: item.approvalStatus || 'approved',
    });
    setEditDialogOpen(true);
  };

  // Save Edit to Firestore
  const handleSaveEdit = async () => {
    if (!selectedItem) return;
    if (!editForm.name.trim()) {
      toast.error('Item name is required');
      return;
    }
    if (editForm.price < 0) {
      toast.error('Price cannot be negative');
      return;
    }

    setSavingEdit(true);
    try {
      const finalCategory =
        editForm.category === '__custom__' && editForm.customCategory.trim()
          ? editForm.customCategory.trim()
          : editForm.category;

      const isVeg = editForm.dietaryType === 'vegetarian' || editForm.dietaryType === 'vegan';

      const updateData: any = {
        name: editForm.name.trim(),
        restaurantId: editForm.restaurantId,
        category: finalCategory,
        price: Number(editForm.price),
        originalPrice: Number(editForm.originalPrice || editForm.price),
        description: editForm.description.trim(),
        image: editForm.image.trim(),
        available: editForm.available,
        isLive: editForm.isLive,
        vegetarian: isVeg,
        dietary: [editForm.dietaryType],
        spicy: editForm.spicy,
        preparationTime: Number(editForm.preparationTime || 20),
        servings: Number(editForm.servings || 1),
        calories: Number(editForm.calories || 0),
        isBestSeller: editForm.isBestSeller,
        isChefSpecial: editForm.isChefSpecial,
        isMustTry: editForm.isMustTry,
        isTrending: editForm.isTrending,
        isNew: editForm.isNew,
        approvalStatus: editForm.approvalStatus,
        updatedAt: new Date(),
      };

      await updateDoc(doc(db, 'menuItems', selectedItem.id), updateData);
      toast.success(`"${editForm.name}" updated successfully!`);
      setEditDialogOpen(false);
    } catch (err: any) {
      console.error('Failed to update menu item:', err);
      toast.error(err.message || 'Failed to update menu item');
    } finally {
      setSavingEdit(false);
    }
  };

  // Save New Menu Item to Firestore
  const handleSaveAdd = async () => {
    if (!addForm.name.trim()) {
      toast.error('Item name is required');
      return;
    }
    if (!addForm.restaurantId) {
      toast.error('Please select a restaurant for this item');
      return;
    }

    setSavingAdd(true);
    try {
      const finalCategory =
        addForm.category === '__custom__' && addForm.customCategory.trim()
          ? addForm.customCategory.trim()
          : addForm.category;

      const isVeg = addForm.dietaryType === 'vegetarian' || addForm.dietaryType === 'vegan';

      const newItemData: any = {
        name: addForm.name.trim(),
        restaurantId: addForm.restaurantId,
        category: finalCategory,
        price: Number(addForm.price),
        originalPrice: Number(addForm.originalPrice || addForm.price),
        description: addForm.description.trim(),
        image:
          addForm.image.trim() ||
          'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=60',
        available: addForm.available,
        isLive: addForm.isLive,
        vegetarian: isVeg,
        dietary: [addForm.dietaryType],
        spicy: addForm.spicy,
        preparationTime: Number(addForm.preparationTime || 20),
        servings: Number(addForm.servings || 1),
        calories: Number(addForm.calories || 0),
        isBestSeller: addForm.isBestSeller,
        isChefSpecial: addForm.isChefSpecial,
        isMustTry: addForm.isMustTry,
        isTrending: addForm.isTrending,
        isNew: addForm.isNew,
        approvalStatus: addForm.approvalStatus,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await addDoc(collection(db, 'menuItems'), newItemData);
      toast.success(`"${addForm.name}" added successfully to menu!`);
      setAddDialogOpen(false);
    } catch (err: any) {
      console.error('Failed to add menu item:', err);
      toast.error(err.message || 'Failed to add menu item');
    } finally {
      setSavingAdd(false);
    }
  };

  // Toggle Availability directly from table
  const handleToggleAvailability = async (item: MenuItemWithRestaurant) => {
    const nextState = !item.available;
    try {
      await updateDoc(doc(db, 'menuItems', item.id), {
        available: nextState,
        updatedAt: new Date(),
      });
      toast.success(`"${item.name}" marked as ${nextState ? 'Available' : 'Unavailable'}`);
    } catch (err: any) {
      toast.error('Failed to update availability');
    }
  };

  // Toggle Approval directly from table
  const handleToggleApproval = async (
    item: MenuItemWithRestaurant,
    status: 'approved' | 'rejected' | 'pending'
  ) => {
    try {
      await updateDoc(doc(db, 'menuItems', item.id), {
        approvalStatus: status,
        isLive: status === 'approved',
        updatedAt: new Date(),
      });
      toast.success(`"${item.name}" approval set to ${status.toUpperCase()}`);
    } catch (err: any) {
      toast.error(`Failed to update approval status`);
    }
  };

  // Delete Menu Item
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'menuItems', itemToDelete.id));
      toast.success(`"${itemToDelete.name}" removed from menu.`);
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
      if (editDialogOpen) setEditDialogOpen(false);
    } catch (err: any) {
      toast.error('Failed to delete item: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  // Key Stats
  const totalItems = enrichedItems.length;
  const availableItems = enrichedItems.filter((i) => i.available).length;
  const vegItems = enrichedItems.filter((i) => i.vegetarian).length;
  const pendingApproval = enrichedItems.filter((i) => i.approvalStatus === 'pending').length;
  const avgPrice =
    totalItems > 0 ? Math.round(enrichedItems.reduce((s, i) => s + (i.price || 0), 0) / totalItems) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[65vh]">
        <div className="text-center space-y-3">
          <div className="h-10 w-10 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm font-medium">Loading catalog and menu items...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Header with High-Contrast Dual Theme Styling */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight mb-1">
            Menu Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Browse, customize, approve, and manage menu items across all registered restaurants.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            onClick={() => {
              setAddForm((prev) => ({
                ...prev,
                restaurantId: allRestaurants[0]?.id || '',
              }));
              setAddDialogOpen(true);
            }}
            className="rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-md gap-2 h-10 px-4 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Menu Item</span>
          </Button>
        </div>
      </div>

      {/* 5 Key Metric Cards (Dual Theme High Contrast) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {/* 1. Total Items */}
        <Card className="rounded-2xl border-border bg-card shadow-xs hover:shadow-md transition-all">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Items</p>
              <h3 className="text-2xl sm:text-3xl font-black text-foreground font-mono mt-1">{totalItems}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Across all menus</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* 2. Available Items */}
        <Card className="rounded-2xl border-border bg-card shadow-xs hover:shadow-md transition-all">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Available</p>
              <h3 className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                {availableItems}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Ready for orders</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* 3. Vegetarian */}
        <Card className="rounded-2xl border-border bg-card shadow-xs hover:shadow-md transition-all">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Vegetarian</p>
              <h3 className="text-2xl sm:text-3xl font-black text-green-600 dark:text-green-400 font-mono mt-1">
                {vegItems}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Pure veg dishes</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center shrink-0">
              <Leaf className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* 4. Pending Approval */}
        <Card className="rounded-2xl border-border bg-card shadow-xs hover:shadow-md transition-all">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pending</p>
              <h3 className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 font-mono mt-1">
                {pendingApproval}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Requires audit</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* 5. Avg Price */}
        <Card className="rounded-2xl border-border bg-card shadow-xs hover:shadow-md transition-all col-span-2 sm:col-span-1">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Avg Price</p>
              <h3 className="text-2xl sm:text-3xl font-black text-purple-600 dark:text-purple-400 font-mono mt-1">
                ₹{avgPrice}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Mean catalog value</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <IndianRupee className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Filter & Table Card */}
      <Card className="bg-card border-border shadow-md rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-border bg-muted/20 pb-4">
          <div className="space-y-4">
            {/* Top row: Title + Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Utensils className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg font-bold text-foreground">
                  All Menu Catalog Items
                </CardTitle>
                <Badge variant="outline" className="text-xs font-bold border-border bg-muted/40">
                  {filteredItems.length} of {totalItems}
                </Badge>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search items, restaurant, category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 rounded-xl bg-background border-border text-foreground placeholder:text-muted-foreground text-sm font-medium focus:border-primary"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Filter Controls Row */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              {/* Restaurant Selector */}
              <select
                value={restaurantFilter}
                onChange={(e) => setRestaurantFilter(e.target.value)}
                className="h-9 px-3 rounded-xl bg-background border border-border text-foreground text-xs font-semibold focus:outline-none focus:border-primary"
              >
                <option value="all">🏢 All Restaurants</option>
                {allRestaurants.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>

              {/* Category Selector */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-9 px-3 rounded-xl bg-background border border-border text-foreground text-xs font-semibold focus:outline-none focus:border-primary"
              >
                <option value="all">📂 All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              {/* Status Selector */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 px-3 rounded-xl bg-background border border-border text-foreground text-xs font-semibold focus:outline-none focus:border-primary"
              >
                <option value="all">⚡ All Status</option>
                <option value="available">🟢 Available Live</option>
                <option value="unavailable">🔴 Unavailable</option>
                <option value="approved">✅ Approved</option>
                <option value="pending">⏳ Pending Review</option>
                <option value="rejected">❌ Rejected</option>
              </select>

              {/* Dietary Filter Segment */}
              <div className="flex items-center p-0.5 bg-muted rounded-xl border border-border text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setDietaryFilter('all')}
                  className={`px-2.5 py-1.5 rounded-lg transition-all ${
                    dietaryFilter === 'all'
                      ? 'bg-card text-foreground shadow-xs font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  All Food
                </button>
                <button
                  type="button"
                  onClick={() => setDietaryFilter('veg')}
                  className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-all ${
                    dietaryFilter === 'veg'
                      ? 'bg-card text-green-600 dark:text-green-400 shadow-xs font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Leaf className="w-3 h-3 text-green-500" />
                  <span>Veg Only</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDietaryFilter('non-veg')}
                  className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-all ${
                    dietaryFilter === 'non-veg'
                      ? 'bg-card text-rose-600 dark:text-rose-400 shadow-xs font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span>Non-Veg</span>
                </button>
              </div>

              {/* Reset Filter Button */}
              {(searchQuery ||
                categoryFilter !== 'all' ||
                statusFilter !== 'all' ||
                restaurantFilter !== 'all' ||
                dietaryFilter !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setCategoryFilter('all');
                    setStatusFilter('all');
                    setRestaurantFilter('all');
                    setDietaryFilter('all');
                  }}
                  className="h-9 px-2.5 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Filters</span>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        {/* Table Content */}
        <CardContent className="p-0">
          {filteredItems.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-14 h-14 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto mb-3">
                <Utensils className="w-7 h-7 stroke-1" />
              </div>
              <h3 className="text-lg font-bold text-foreground">No menu items found</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                Try adjusting your search criteria, category filters, or add a new menu item.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('all');
                  setStatusFilter('all');
                  setRestaurantFilter('all');
                  setDietaryFilter('all');
                }}
                className="mt-4 rounded-xl text-xs font-bold"
              >
                Clear All Filters
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent bg-muted/30">
                    <TableHead className="w-[300px] text-xs font-bold text-muted-foreground uppercase">
                      Dish / Item
                    </TableHead>
                    <TableHead className="text-xs font-bold text-muted-foreground uppercase">
                      Restaurant
                    </TableHead>
                    <TableHead className="text-xs font-bold text-muted-foreground uppercase">
                      Category
                    </TableHead>
                    <TableHead className="text-xs font-bold text-muted-foreground uppercase">
                      Price
                    </TableHead>
                    <TableHead className="text-xs font-bold text-muted-foreground uppercase">
                      Dietary
                    </TableHead>
                    <TableHead className="text-xs font-bold text-muted-foreground uppercase">
                      Live Status
                    </TableHead>
                    <TableHead className="text-xs font-bold text-muted-foreground uppercase">
                      Approval
                    </TableHead>
                    <TableHead className="text-right text-xs font-bold text-muted-foreground uppercase pr-5">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => {
                    const isVeg = item.vegetarian || item.dietary?.includes('vegetarian');
                    const hasDiscount =
                      (item as any).originalPrice && (item as any).originalPrice > item.price;

                    return (
                      <TableRow
                        key={item.id}
                        className="border-border hover:bg-muted/40 transition-colors"
                      >
                        {/* Item Details */}
                        <TableCell className="py-3">
                          <div className="flex items-center gap-3">
                            <div className="relative w-12 h-12 rounded-xl bg-muted overflow-hidden shrink-0 border border-border">
                              {item.image ? (
                                <img
                                  src={item.image}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                  <ImageIcon className="w-5 h-5" />
                                </div>
                              )}
                              {/* Veg / Non-Veg Dot */}
                              <div
                                className={`absolute top-1 left-1 w-3 h-3 rounded-md flex items-center justify-center bg-card/90 border ${
                                  isVeg ? 'border-green-600' : 'border-rose-600'
                                }`}
                              >
                                <div
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    isVeg ? 'bg-green-600' : 'bg-rose-600'
                                  }`}
                                />
                              </div>
                            </div>
                            <div>
                              <p className="font-bold text-foreground text-sm line-clamp-1">{item.name}</p>
                              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                {item.isBestSeller && (
                                  <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[9px] font-bold px-1.5 py-0">
                                    ★ Best Seller
                                  </Badge>
                                )}
                                {item.spicy && (
                                  <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20 text-[9px] font-bold px-1.5 py-0 flex items-center gap-0.5">
                                    <Flame className="w-2.5 h-2.5" /> Spicy
                                  </Badge>
                                )}
                                {item.isNew && (
                                  <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20 text-[9px] font-bold px-1.5 py-0">
                                    New
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        {/* Restaurant Name */}
                        <TableCell className="py-3 text-xs font-semibold text-foreground">
                          {item.restaurantName}
                        </TableCell>

                        {/* Category */}
                        <TableCell className="py-3">
                          <span className="text-xs font-medium text-muted-foreground bg-muted/60 px-2 py-1 rounded-lg border border-border/50">
                            {item.category || 'General'}
                          </span>
                        </TableCell>

                        {/* Price */}
                        <TableCell className="py-3">
                          <div className="font-mono">
                            <span className="text-sm font-black text-foreground">₹{item.price}</span>
                            {hasDiscount && (
                              <span className="text-xs text-muted-foreground line-through ml-1.5">
                                ₹{(item as any).originalPrice}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* Dietary Badge */}
                        <TableCell className="py-3">
                          {isVeg ? (
                            <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30 text-[11px] font-bold gap-1 px-2 py-0.5">
                              <Leaf className="w-3 h-3" /> Veg
                            </Badge>
                          ) : (
                            <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 text-[11px] font-bold gap-1 px-2 py-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Non-Veg
                            </Badge>
                          )}
                        </TableCell>

                        {/* Available Toggle Switch */}
                        <TableCell className="py-3">
                          <button
                            type="button"
                            onClick={() => handleToggleAvailability(item)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                              item.available
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                                : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/25'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                item.available ? 'bg-emerald-500' : 'bg-rose-500'
                              }`}
                            />
                            <span>{item.available ? 'In Stock' : 'Out of Stock'}</span>
                          </button>
                        </TableCell>

                        {/* Approval Status */}
                        <TableCell className="py-3">
                          {item.approvalStatus === 'rejected' ? (
                            <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 text-[11px] font-bold">
                              Rejected
                            </Badge>
                          ) : item.approvalStatus === 'pending' ? (
                            <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[11px] font-bold">
                              Pending
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[11px] font-bold">
                              Approved
                            </Badge>
                          )}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="py-3 text-right pr-5">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setDetailItem(item);
                                setDetailDialogOpen(true);
                              }}
                              className="h-8 w-8 p-0 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                              title="View Dish Details"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEdit(item)}
                              className="h-8 w-8 p-0 rounded-lg hover:bg-primary/10 text-primary hover:text-primary"
                              title="Edit Full Menu Item"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setItemToDelete(item);
                                setDeleteConfirmOpen(true);
                              }}
                              className="h-8 w-8 p-0 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                              title="Delete Item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ========================================================================= */}
      {/* COMPREHENSIVE FULL DESKTOP-SIZED VERTICALLY SCROLLABLE EDIT DIALOG         */}
      {/* ========================================================================= */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl sm:max-w-3xl w-full max-h-[90vh] flex flex-col p-0 overflow-hidden bg-card border border-border shadow-2xl rounded-3xl text-foreground">
          {/* Header */}
          <DialogHeader className="px-6 py-4 border-b border-border bg-muted/20 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl sm:text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
                  <ChefHat className="w-5 h-5 text-primary" />
                  <span>Edit Menu Item</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Full control over pricing, dietary tags, images, kitchen prep time, and admin approval.
                </DialogDescription>
              </div>
              <Badge variant="outline" className="font-mono text-xs border-border bg-muted/40">
                ID: {selectedItem?.id.slice(0, 8)}
              </Badge>
            </div>
          </DialogHeader>

          {/* Fully Vertically Scrollable Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 max-h-[calc(90vh-135px)]">
            {/* Section 1: Basic Dish Identity */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                <span>1. Core Dish Information</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Item Name */}
                <div className="sm:col-span-2">
                  <Label className="text-xs font-bold text-foreground block mb-1.5">
                    Dish / Item Name *
                  </Label>
                  <Input
                    value={editForm.name}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Double Cheese Margherita Pizza"
                    className="h-11 rounded-xl bg-muted/40 border-border text-foreground font-semibold focus:border-primary"
                  />
                </div>

                {/* Restaurant Selection */}
                <div>
                  <Label className="text-xs font-bold text-foreground block mb-1.5">
                    Assigned Restaurant *
                  </Label>
                  <select
                    value={editForm.restaurantId}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, restaurantId: e.target.value }))
                    }
                    className="w-full h-11 px-3 rounded-xl bg-muted/40 border border-border text-foreground text-sm font-semibold focus:outline-none focus:border-primary"
                  >
                    {allRestaurants.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Category Selection */}
                <div>
                  <Label className="text-xs font-bold text-foreground block mb-1.5">
                    Menu Category *
                  </Label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, category: e.target.value }))}
                    className="w-full h-11 px-3 rounded-xl bg-muted/40 border border-border text-foreground text-sm font-semibold focus:outline-none focus:border-primary"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    <option value="__custom__">+ Add Custom Category</option>
                  </select>
                  {editForm.category === '__custom__' && (
                    <Input
                      placeholder="Type new category..."
                      value={editForm.customCategory}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, customCategory: e.target.value }))
                      }
                      className="mt-2 h-10 rounded-xl bg-muted/40 border-border text-foreground text-sm"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Section 2: Pricing & Discounts */}
            <div className="space-y-4 pt-2 border-t border-border">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <IndianRupee className="w-3.5 h-3.5" />
                <span>2. Pricing & Financials</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-bold text-foreground block mb-1.5">
                    Selling Price (₹) *
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-muted-foreground text-sm">
                      ₹
                    </span>
                    <Input
                      type="number"
                      min={0}
                      value={editForm.price}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, price: Number(e.target.value) }))
                      }
                      className="pl-8 h-11 rounded-xl bg-muted/40 border-border text-foreground font-mono font-bold text-base focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs font-bold text-foreground">
                      Original / MRP Price (₹)
                    </Label>
                    {editForm.originalPrice > editForm.price && (
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        {Math.round(
                          ((editForm.originalPrice - editForm.price) / editForm.originalPrice) * 100
                        )}
                        % OFF
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-muted-foreground text-sm">
                      ₹
                    </span>
                    <Input
                      type="number"
                      min={0}
                      value={editForm.originalPrice}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, originalPrice: Number(e.target.value) }))
                      }
                      className="pl-8 h-11 rounded-xl bg-muted/40 border-border text-foreground font-mono text-base focus:border-primary"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Visual Image & Preview */}
            <div className="space-y-4 pt-2 border-t border-border">
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" />
                <span>3. Dish Photography & Visuals</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                <div className="sm:col-span-2">
                  <Label className="text-xs font-bold text-foreground block mb-1.5">
                    Image URL (Direct link)
                  </Label>
                  <Input
                    value={editForm.image}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, image: e.target.value }))}
                    placeholder="https://images.unsplash.com/photo-..."
                    className="h-11 rounded-xl bg-muted/40 border-border text-foreground text-xs focus:border-primary"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Paste a direct image URL (PNG, JPG, WebP) to display across the web and app.
                  </p>
                </div>

                {/* Preview Box */}
                <div className="flex flex-col items-center justify-center p-2 rounded-2xl border border-border bg-muted/30 h-28 overflow-hidden relative">
                  {editForm.image ? (
                    <img
                      src={editForm.image}
                      alt="Preview"
                      className="w-full h-full object-cover rounded-xl"
                      onError={(e) => {
                        (e.target as HTMLElement).style.opacity = '0.3';
                      }}
                    />
                  ) : (
                    <div className="text-center text-muted-foreground text-xs">
                      <ImageIcon className="w-6 h-6 mx-auto mb-1 opacity-40" />
                      <span>No image preview</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Section 4: Dietary Type & Spicy */}
            <div className="space-y-4 pt-2 border-t border-border">
              <h4 className="text-xs font-bold uppercase tracking-wider text-green-600 dark:text-green-400 flex items-center gap-1.5">
                <Leaf className="w-3.5 h-3.5" />
                <span>4. Dietary Classification & Spice Level</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Dietary Choice Radio Pill */}
                <div>
                  <Label className="text-xs font-bold text-foreground block mb-2">
                    Dietary Type
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'vegetarian', label: 'Veg', icon: Leaf, color: 'text-green-500' },
                      { id: 'non-vegetarian', label: 'Non-Veg', icon: null, color: 'text-rose-500' },
                      { id: 'vegan', label: 'Vegan', icon: Leaf, color: 'text-emerald-500' },
                    ].map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() =>
                          setEditForm((prev) => ({
                            ...prev,
                            dietaryType: d.id as any,
                            vegetarian: d.id === 'vegetarian' || d.id === 'vegan',
                          }))
                        }
                        className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          editForm.dietaryType === d.id
                            ? 'bg-primary/10 border-primary text-primary shadow-xs'
                            : 'bg-muted/30 border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {d.icon && <d.icon className={`w-3.5 h-3.5 ${d.color}`} />}
                        <span>{d.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Spicy Toggle */}
                <div>
                  <Label className="text-xs font-bold text-foreground block mb-2">
                    Spiciness Level
                  </Label>
                  <button
                    type="button"
                    onClick={() => setEditForm((prev) => ({ ...prev, spicy: !prev.spicy }))}
                    className={`w-full py-2 px-4 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                      editForm.spicy
                        ? 'bg-rose-500/15 border-rose-500/40 text-rose-600 dark:text-rose-400'
                        : 'bg-muted/30 border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-rose-500" />
                      <span>{editForm.spicy ? 'Spicy Recipe (Active)' : 'Mild / Non-Spicy'}</span>
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {editForm.spicy ? 'Hot' : 'Mild'}
                    </Badge>
                  </button>
                </div>
              </div>
            </div>

            {/* Section 5: Description & Kitchen Operation Times */}
            <div className="space-y-4 pt-2 border-t border-border">
              <h4 className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                <ChefHat className="w-3.5 h-3.5" />
                <span>5. Recipe Description & Cooking Times</span>
              </h4>

              <div>
                <Label className="text-xs font-bold text-foreground block mb-1.5">
                  Detailed Item Description
                </Label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  placeholder="Ingredients, flavors, special sauces, serving style..."
                  className="w-full p-3.5 rounded-xl bg-muted/40 border border-border text-foreground text-sm font-medium focus:outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-[11px] font-bold text-foreground block mb-1">
                    Prep Time (min)
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    value={editForm.preparationTime}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, preparationTime: Number(e.target.value) }))
                    }
                    className="h-10 rounded-xl bg-muted/40 border-border text-foreground font-mono text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-bold text-foreground block mb-1">
                    Servings
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    value={editForm.servings}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, servings: Number(e.target.value) }))
                    }
                    className="h-10 rounded-xl bg-muted/40 border-border text-foreground font-mono text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-bold text-foreground block mb-1">
                    Calories (kcal)
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={editForm.calories}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, calories: Number(e.target.value) }))
                    }
                    className="h-10 rounded-xl bg-muted/40 border-border text-foreground font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Section 6: Badges & Promotions */}
            <div className="space-y-4 pt-2 border-t border-border">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5" />
                <span>6. Badges & Featured Placement</span>
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { key: 'isBestSeller', label: 'Best Seller', icon: Star },
                  { key: 'isChefSpecial', label: "Chef's Special", icon: ChefHat },
                  { key: 'isTrending', label: 'Trending', icon: Flame },
                  { key: 'isNew', label: 'New Launch', icon: Sparkles },
                ].map((b) => (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() =>
                      setEditForm((prev: any) => ({ ...prev, [b.key]: !prev[b.key] }))
                    }
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      (editForm as any)[b.key]
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400'
                        : 'bg-muted/30 border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <b.icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{b.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Section 7: Live Availability & Approval Status */}
            <div className="space-y-4 pt-2 border-t border-border">
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>7. Platform Live Status & Moderation Approval</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Live Availability Switch */}
                <div className="p-3.5 rounded-2xl bg-muted/30 border border-border flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-bold text-foreground block">
                      In-Stock Availability
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Whether customers can add dish to cart
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditForm((prev) => ({ ...prev, available: !prev.available }))}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                      editForm.available ? 'bg-emerald-500' : 'bg-muted-foreground/30'
                    }`}
                  >
                    <span
                      className={`block w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                        editForm.available ? 'translate-x-6' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                {/* Approval Status */}
                <div>
                  <Label className="text-xs font-bold text-foreground block mb-1.5">
                    Admin Approval Status
                  </Label>
                  <select
                    value={editForm.approvalStatus}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, approvalStatus: e.target.value as any }))
                    }
                    className="w-full h-11 px-3 rounded-xl bg-muted/40 border border-border text-foreground text-sm font-semibold focus:outline-none focus:border-primary"
                  >
                    <option value="approved">✅ Approved & Published</option>
                    <option value="pending">⏳ Pending Review</option>
                    <option value="rejected">❌ Rejected (Hidden from Customers)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Sticky Modal Footer */}
          <DialogFooter className="px-6 py-4 bg-muted/30 border-t border-border flex items-center justify-between sm:justify-between w-full shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (selectedItem) {
                  setItemToDelete(selectedItem);
                  setDeleteConfirmOpen(true);
                }
              }}
              className="border-destructive/30 text-destructive hover:bg-destructive/10 text-xs font-bold gap-1.5 cursor-pointer rounded-xl h-10"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Dish</span>
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
                className="rounded-xl border-border text-xs font-bold h-10 px-4"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-md text-xs sm:text-sm h-10 px-5 cursor-pointer"
              >
                {savingEdit ? 'Saving Updates...' : 'Save All Changes'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* ADD NEW MENU ITEM DIALOG (FULL DESKTOP & VERTICALLY SCROLLABLE)            */}
      {/* ========================================================================= */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-2xl sm:max-w-3xl w-full max-h-[90vh] flex flex-col p-0 overflow-hidden bg-card border border-border shadow-2xl rounded-3xl text-foreground">
          <DialogHeader className="px-6 py-4 border-b border-border bg-muted/20 shrink-0">
            <DialogTitle className="text-xl sm:text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary stroke-[2.5]" />
              <span>Add New Menu Item</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Create a new dish/product and instantly assign it to any restaurant.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 max-h-[calc(90vh-135px)]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label className="text-xs font-bold text-foreground block mb-1.5">
                  Dish / Item Name *
                </Label>
                <Input
                  value={addForm.name}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Gourmet Truffle Pasta"
                  className="h-11 rounded-xl bg-muted/40 border-border text-foreground font-semibold focus:border-primary"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-foreground block mb-1.5">
                  Assigned Restaurant *
                </Label>
                <select
                  value={addForm.restaurantId}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, restaurantId: e.target.value }))}
                  className="w-full h-11 px-3 rounded-xl bg-muted/40 border border-border text-foreground text-sm font-semibold focus:outline-none focus:border-primary"
                >
                  {allRestaurants.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs font-bold text-foreground block mb-1.5">
                  Menu Category *
                </Label>
                <select
                  value={addForm.category}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, category: e.target.value }))}
                  className="w-full h-11 px-3 rounded-xl bg-muted/40 border border-border text-foreground text-sm font-semibold focus:outline-none focus:border-primary"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                  <option value="__custom__">+ Add Custom Category</option>
                </select>
                {addForm.category === '__custom__' && (
                  <Input
                    placeholder="Type new category..."
                    value={addForm.customCategory}
                    onChange={(e) =>
                      setAddForm((prev) => ({ ...prev, customCategory: e.target.value }))
                    }
                    className="mt-2 h-10 rounded-xl bg-muted/40 border-border text-foreground text-sm"
                  />
                )}
              </div>
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
              <div>
                <Label className="text-xs font-bold text-foreground block mb-1.5">
                  Selling Price (₹) *
                </Label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-muted-foreground text-sm">
                    ₹
                  </span>
                  <Input
                    type="number"
                    min={0}
                    value={addForm.price}
                    onChange={(e) => setAddForm((prev) => ({ ...prev, price: Number(e.target.value) }))}
                    className="pl-8 h-11 rounded-xl bg-muted/40 border-border text-foreground font-mono font-bold text-base focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold text-foreground block mb-1.5">
                  Original / MRP Price (₹)
                </Label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-muted-foreground text-sm">
                    ₹
                  </span>
                  <Input
                    type="number"
                    min={0}
                    value={addForm.originalPrice}
                    onChange={(e) =>
                      setAddForm((prev) => ({ ...prev, originalPrice: Number(e.target.value) }))
                    }
                    className="pl-8 h-11 rounded-xl bg-muted/40 border-border text-foreground font-mono text-base focus:border-primary"
                  />
                </div>
              </div>
            </div>

            {/* Image */}
            <div className="pt-2 border-t border-border">
              <Label className="text-xs font-bold text-foreground block mb-1.5">
                Image URL
              </Label>
              <Input
                value={addForm.image}
                onChange={(e) => setAddForm((prev) => ({ ...prev, image: e.target.value }))}
                placeholder="https://images.unsplash.com/..."
                className="h-11 rounded-xl bg-muted/40 border-border text-foreground text-xs"
              />
            </div>

            {/* Dietary */}
            <div className="pt-2 border-t border-border">
              <Label className="text-xs font-bold text-foreground block mb-2">Dietary Type</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'vegetarian', label: 'Veg' },
                  { id: 'non-vegetarian', label: 'Non-Veg' },
                  { id: 'vegan', label: 'Vegan' },
                ].map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() =>
                      setAddForm((prev) => ({
                        ...prev,
                        dietaryType: d.id as any,
                        vegetarian: d.id === 'vegetarian' || d.id === 'vegan',
                      }))
                    }
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      addForm.dietaryType === d.id
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'bg-muted/30 border-border text-muted-foreground'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="pt-2 border-t border-border">
              <Label className="text-xs font-bold text-foreground block mb-1.5">
                Description
              </Label>
              <textarea
                value={addForm.description}
                onChange={(e) => setAddForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
                placeholder="Ingredients and culinary notes..."
                className="w-full p-3.5 rounded-xl bg-muted/40 border border-border text-foreground text-sm font-medium focus:outline-none focus:border-primary resize-none"
              />
            </div>
          </div>

          <DialogFooter className="px-6 py-4 bg-muted/30 border-t border-border flex items-center justify-end gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddDialogOpen(false)}
              className="rounded-xl border-border text-xs font-bold h-10 px-4"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveAdd}
              disabled={savingAdd}
              className="rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-md text-xs sm:text-sm h-10 px-5 cursor-pointer"
            >
              {savingAdd ? 'Publishing Item...' : 'Publish to Menu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* DETAIL DIALOG                                                             */}
      {/* ========================================================================= */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-lg rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-foreground">
              {detailItem?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Restaurant: <strong className="text-foreground">{detailItem?.restaurantName}</strong>
            </DialogDescription>
          </DialogHeader>

          {detailItem && (
            <div className="space-y-4 mt-3">
              {detailItem.image && (
                <div className="w-full h-44 rounded-2xl overflow-hidden border border-border bg-muted">
                  <img src={detailItem.image} alt={detailItem.name} className="w-full h-full object-cover" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/30 rounded-xl p-3 border border-border">
                  <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">
                    Price
                  </p>
                  <p className="text-foreground font-black font-mono text-lg mt-0.5">
                    ₹{detailItem.price}
                  </p>
                </div>
                <div className="bg-muted/30 rounded-xl p-3 border border-border">
                  <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">
                    Category
                  </p>
                  <p className="text-foreground font-bold text-sm mt-0.5">
                    {detailItem.category || 'General'}
                  </p>
                </div>
                <div className="bg-muted/30 rounded-xl p-3 border border-border">
                  <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">
                    Availability
                  </p>
                  <p
                    className={`font-bold text-xs mt-1 ${
                      detailItem.available ? 'text-emerald-500' : 'text-rose-500'
                    }`}
                  >
                    {detailItem.available ? '🟢 In Stock (Live)' : '🔴 Out of Stock'}
                  </p>
                </div>
                <div className="bg-muted/30 rounded-xl p-3 border border-border">
                  <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">
                    Approval
                  </p>
                  <p className="text-foreground font-bold text-xs mt-1 capitalize">
                    {detailItem.approvalStatus || 'Approved'}
                  </p>
                </div>
              </div>

              {detailItem.description && (
                <div className="bg-muted/20 rounded-xl p-3 border border-border/60">
                  <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider mb-1">
                    Description
                  </p>
                  <p className="text-foreground text-xs leading-relaxed">{detailItem.description}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDetailDialogOpen(false)}
              className="rounded-xl font-bold w-full"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* DELETE CONFIRMATION DIALOG                                                */}
      {/* ========================================================================= */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-md bg-card border-border text-foreground rounded-3xl p-6">
          <DialogHeader className="space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <DialogTitle className="text-xl font-black text-foreground">
              Confirm Delete Dish
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to permanently remove <strong className="text-foreground">"{itemToDelete?.name}"</strong> from the menu? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4 flex gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              className="rounded-xl text-xs font-bold flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="rounded-xl text-xs font-bold flex-1"
            >
              {deleting ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
