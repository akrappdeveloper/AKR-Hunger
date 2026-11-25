'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRestaurantAuth } from '@/context/RestaurantAuthContext';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CheckCircle,
  Edit,
  Inbox,
  Minus,
  Package,
  Plus,
  Search,
  Store,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';

type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

interface InventoryItem {
  id: string;
  restaurantId: string;
  ownerId?: string;
  name: string;
  category: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  unit: string;
  costPerUnit: number;
  supplier?: string;
  notes?: string;
  status: StockStatus;
  updatedAt?: any;
  createdAt?: any;
}

const INVENTORY_CATEGORIES = [
  'Grains & Flour',
  'Vegetables & Herbs',
  'Meat & Seafood',
  'Dairy & Paneer',
  'Oils & Ghee',
  'Spices & Masalas',
  'Sauces & Condiments',
  'Beverages',
  'Packaging & Supplies',
  'Other',
];

const UNITS = ['kg', 'g', 'l', 'ml', 'pcs', 'packs', 'boxes', 'trays', 'bottles'];

function computeStockStatus(currentStock: number, minStock: number): StockStatus {
  if (currentStock <= 0) return 'out_of_stock';
  if (currentStock <= minStock) return 'low_stock';
  return 'in_stock';
}

export default function InventoryPage() {
  const router = useRouter();
  const { user, restaurant, loading: authLoading } = useRestaurantAuth();

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | StockStatus>('all');

  // Add / Edit Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    category: 'Grains & Flour',
    currentStock: '',
    minStock: '5',
    maxStock: '50',
    unit: 'kg',
    costPerUnit: '',
    supplier: '',
    notes: '',
  });

  // Delete confirmation dialog
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const resolvedRestaurantId = restaurant?.id || user?.restaurantId || user?.uid || '';

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/restaurant/login');
      return;
    }
    if (!resolvedRestaurantId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const invRef = collection(db, 'inventory');
    const targetIds = Array.from(
      new Set([resolvedRestaurantId, user.uid, user.restaurantId].filter(Boolean))
    ) as string[];

    const buckets: Record<string, Map<string, InventoryItem>> = {};

    const syncAll = () => {
      const merged = new Map<string, InventoryItem>();
      Object.values(buckets).forEach((m) => {
        m.forEach((val, key) => merged.set(key, val));
      });
      const list = Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name));
      setInventory(list);
      setLoading(false);
    };

    const unsubs = targetIds.map((idVal, idx) => {
      const key = `rest_${idx}`;
      buckets[key] = new Map();
      return onSnapshot(
        query(invRef, where('restaurantId', '==', idVal)),
        (snap) => {
          const nextMap = new Map<string, InventoryItem>();
          snap.docs.forEach((d) => {
            const data = d.data();
            const curr = Number(data.currentStock ?? 0);
            const min = Number(data.minStock ?? 0);
            nextMap.set(d.id, {
              id: d.id,
              restaurantId: data.restaurantId || idVal,
              ownerId: data.ownerId,
              name: data.name || 'Unnamed Item',
              category: data.category || 'Other',
              currentStock: curr,
              minStock: min,
              maxStock: Number(data.maxStock ?? 0),
              unit: data.unit || 'kg',
              costPerUnit: Number(data.costPerUnit ?? 0),
              supplier: data.supplier || '',
              notes: data.notes || '',
              status: computeStockStatus(curr, min),
              updatedAt: data.updatedAt,
              createdAt: data.createdAt,
            });
          });
          buckets[key] = nextMap;
          syncAll();
        },
        (err) => {
          console.error('[Inventory] Firestore listener error:', err);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [authLoading, user, resolvedRestaurantId, router]);

  const openAddDialog = () => {
    setEditingItem(null);
    setForm({
      name: '',
      category: 'Grains & Flour',
      currentStock: '',
      minStock: '5',
      maxStock: '50',
      unit: 'kg',
      costPerUnit: '',
      supplier: '',
      notes: '',
    });
    setDialogOpen(true);
  };

  const openEditDialog = (item: InventoryItem) => {
    setEditingItem(item);
    setForm({
      name: item.name,
      category: item.category,
      currentStock: String(item.currentStock),
      minStock: String(item.minStock),
      maxStock: String(item.maxStock || ''),
      unit: item.unit,
      costPerUnit: String(item.costPerUnit),
      supplier: item.supplier || '',
      notes: item.notes || '',
    });
    setDialogOpen(true);
  };

  const handleSaveItem = async () => {
    if (!user || !resolvedRestaurantId) return;

    if (!form.name.trim()) {
      toast.error('Please enter an ingredient or item name');
      return;
    }

    const currentStock = Math.max(0, parseFloat(form.currentStock) || 0);
    const minStock = Math.max(0, parseFloat(form.minStock) || 0);
    const maxStock = Math.max(minStock, parseFloat(form.maxStock) || 0);
    const costPerUnit = Math.max(0, parseFloat(form.costPerUnit) || 0);
    const status = computeStockStatus(currentStock, minStock);

    setSaving(true);
    try {
      const payload = {
        restaurantId: resolvedRestaurantId,
        ownerId: user.uid,
        name: form.name.trim(),
        category: form.category.trim() || 'Other',
        currentStock,
        minStock,
        maxStock,
        unit: form.unit || 'kg',
        costPerUnit,
        supplier: form.supplier.trim(),
        notes: form.notes.trim(),
        status,
        updatedAt: serverTimestamp(),
      };

      if (editingItem) {
        await updateDoc(doc(db, 'inventory', editingItem.id), payload);
        toast.success(`"${payload.name}" updated`);
      } else {
        await addDoc(collection(db, 'inventory'), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        toast.success(`"${payload.name}" added to inventory`);
      }

      setDialogOpen(false);
    } catch (err: any) {
      console.error('[Inventory] Save error:', err);
      toast.error('Failed to save inventory item: ' + (err?.message || 'Error'));
    } finally {
      setSaving(false);
    }
  };

  const handleQuickAdjustStock = async (item: InventoryItem, delta: number) => {
    const nextStock = Math.max(0, Number((item.currentStock + delta).toFixed(2)));
    const nextStatus = computeStockStatus(nextStock, item.minStock);

    try {
      await updateDoc(doc(db, 'inventory', item.id), {
        currentStock: nextStock,
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (err: any) {
      console.error('[Inventory] Quick adjust error:', err);
      toast.error('Could not update stock');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'inventory', deleteTarget.id));
      toast.success(`"${deleteTarget.name}" removed from inventory`);
      setDeleteTarget(null);
    } catch (err: any) {
      console.error('[Inventory] Delete error:', err);
      toast.error('Failed to delete item');
    } finally {
      setDeleting(false);
    }
  };

  const existingCategories = useMemo(
    () => Array.from(new Set(inventory.map((i) => i.category).filter(Boolean))),
    [inventory]
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return inventory.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (q) {
        return (
          item.name.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          (item.supplier?.toLowerCase() || '').includes(q)
        );
      }
      return true;
    });
  }, [inventory, searchQuery, categoryFilter, statusFilter]);

  const inStockCount = inventory.filter((i) => i.status === 'in_stock').length;
  const lowStockCount = inventory.filter((i) => i.status === 'low_stock').length;
  const outOfStockCount = inventory.filter((i) => i.status === 'out_of_stock').length;
  const totalValue = inventory.reduce(
    (sum, i) => sum + (Number(i.currentStock) || 0) * (Number(i.costPerUnit) || 0),
    0
  );

  const getStatusBadge = (status: StockStatus) => {
    switch (status) {
      case 'in_stock':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
            <CheckCircle className="w-3 h-3 mr-1" />
            In Stock
          </Badge>
        );
      case 'low_stock':
        return (
          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Low Stock
          </Badge>
        );
      case 'out_of_stock':
        return (
          <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
            <XCircle className="w-3 h-3 mr-1" />
            Out of Stock
          </Badge>
        );
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3 p-6">
        <Spinner className="w-9 h-9 text-primary" />
        <p className="text-sm font-medium text-muted-foreground">Loading restaurant inventory...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 transition-colors duration-300">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-[11px] font-bold border-primary/30 text-primary bg-primary/10 gap-1">
                <Store className="w-3 h-3" />
                {restaurant?.name || 'Restaurant Kitchen'}
              </Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black flex items-center gap-2.5">
              <Package className="w-7 h-7 text-primary" />
              Inventory Manager
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Live kitchen stock levels, low-stock thresholds, and ingredient valuation
            </p>
          </div>
          <Button onClick={openAddDialog} className="gap-2 rounded-2xl h-11 px-5 font-bold shadow-md">
            <Plus className="w-4 h-4" />
            Add Inventory Item
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="p-4 border-l-4 border-l-emerald-500 bg-card">
            <div className="flex items-center gap-2.5">
              <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
              <div>
                <p className="text-2xl font-black font-mono">{inStockCount}</p>
                <p className="text-xs text-muted-foreground">In Stock</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 border-l-4 border-l-amber-500 bg-card">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              <div>
                <p className="text-2xl font-black font-mono">{lowStockCount}</p>
                <p className="text-xs text-muted-foreground">Low Stock</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 border-l-4 border-l-red-500 bg-card">
            <div className="flex items-center gap-2.5">
              <XCircle className="w-5 h-5 text-red-500 shrink-0" />
              <div>
                <p className="text-2xl font-black font-mono">{outOfStockCount}</p>
                <p className="text-xs text-muted-foreground">Out of Stock</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 border-l-4 border-l-primary bg-card">
            <div>
              <p className="text-2xl font-black font-mono text-primary">
                ₹{totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-muted-foreground">Estimated Stock Value</p>
            </div>
          </Card>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-card/70 p-3.5 rounded-2xl border border-border">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ingredients, categories, or suppliers..."
              className="pl-10 pr-9 h-10 rounded-xl bg-background border-border text-xs sm:text-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-10 px-3 rounded-xl border border-border bg-background text-xs font-semibold text-foreground"
            >
              <option value="all">All Categories</option>
              {existingCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <div className="flex items-center p-1 bg-muted/60 rounded-xl border border-border/60">
              {[
                { id: 'all', label: 'All' },
                { id: 'in_stock', label: 'In Stock' },
                { id: 'low_stock', label: 'Low' },
                { id: 'out_of_stock', label: 'Out' },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStatusFilter(s.id as any)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                    statusFilter === s.id
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Inventory Content */}
        {inventory.length === 0 ? (
          <Card className="p-12 sm:p-16 text-center rounded-3xl border-dashed border-border bg-card/60 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Inbox className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-black text-foreground">No Inventory Items Yet</h3>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
                Add your restaurant&apos;s real ingredients, packaging supplies, and raw materials to track stock levels in real time.
              </p>
            </div>
            <Button onClick={openAddDialog} className="rounded-2xl font-bold h-11 px-6 gap-2">
              <Plus className="w-4 h-4" />
              Add Your First Item
            </Button>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center rounded-3xl border-border bg-card/60 space-y-3">
            <p className="text-base font-bold text-foreground">No matching inventory items</p>
            <p className="text-xs text-muted-foreground">Try adjusting your search or filter selection.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setCategoryFilter('all');
                setStatusFilter('all');
              }}
              className="rounded-xl text-xs font-bold"
            >
              Reset Filters
            </Button>
          </Card>
        ) : (
          <Card className="rounded-2xl overflow-hidden border-border bg-card">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-center">Current Stock</TableHead>
                    <TableHead className="text-center">Min Alert</TableHead>
                    <TableHead className="text-right">Cost / Unit</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <p className="font-bold text-sm text-foreground">{item.name}</p>
                          {item.supplier && (
                            <p className="text-[11px] text-muted-foreground">Supplier: {item.supplier}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs font-medium">
                        {item.category}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => handleQuickAdjustStock(item, -1)}
                            disabled={item.currentStock <= 0}
                            className="h-7 w-7 rounded-lg"
                            title="Decrease by 1"
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="min-w-[68px] text-center font-mono font-bold text-xs sm:text-sm">
                            {item.currentStock} {item.unit}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => handleQuickAdjustStock(item, 1)}
                            className="h-7 w-7 rounded-lg"
                            title="Increase by 1"
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground text-xs font-mono">
                        {item.minStock} {item.unit}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs sm:text-sm font-semibold">
                        ₹{item.costPerUnit}
                      </TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(item)}
                            className="h-8 w-8 rounded-lg"
                            title="Edit item"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(item)}
                            className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
                            title="Delete item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </div>

      {/* Add / Edit Inventory Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg bg-card border-border text-card-foreground rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              {editingItem ? `Edit ${editingItem.name}` : 'Add Inventory Item'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Manage real kitchen ingredient stock, alert thresholds, and unit cost.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Ingredient / Item Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Basmati Rice, Paneer, Packaging Boxes"
                className="h-10 rounded-xl text-xs sm:text-sm bg-background border-border"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Category</Label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl border border-border bg-background text-xs font-medium text-foreground"
                >
                  {INVENTORY_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Unit</Label>
                <select
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl border border-border bg-background text-xs font-medium text-foreground"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Current Stock *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.currentStock}
                  onChange={(e) => setForm({ ...form, currentStock: e.target.value })}
                  placeholder="25"
                  className="h-10 rounded-xl text-xs font-mono bg-background border-border"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Min Alert</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.minStock}
                  onChange={(e) => setForm({ ...form, minStock: e.target.value })}
                  placeholder="5"
                  className="h-10 rounded-xl text-xs font-mono bg-background border-border"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Max Capacity</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.maxStock}
                  onChange={(e) => setForm({ ...form, maxStock: e.target.value })}
                  placeholder="50"
                  className="h-10 rounded-xl text-xs font-mono bg-background border-border"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Cost Per Unit (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={form.costPerUnit}
                  onChange={(e) => setForm({ ...form, costPerUnit: e.target.value })}
                  placeholder="120"
                  className="h-10 rounded-xl text-xs font-mono bg-background border-border"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Supplier (Optional)</Label>
                <Input
                  value={form.supplier}
                  onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                  placeholder="e.g. Fresh Farms Wholesale"
                  className="h-10 rounded-xl text-xs bg-background border-border"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Notes (Optional)</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Storage temperature or reorder note"
                className="h-10 rounded-xl text-xs bg-background border-border"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="rounded-xl text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveItem}
              disabled={saving}
              className="rounded-xl text-xs font-bold gap-1.5"
            >
              {saving && <Spinner className="w-3.5 h-3.5" />}
              {editingItem ? 'Update Item' : 'Save Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm bg-card border-border text-card-foreground rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Delete Inventory Item
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Remove <strong>{deleteTarget?.name}</strong> permanently from your restaurant inventory?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              className="rounded-xl text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="rounded-xl text-xs font-bold"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
