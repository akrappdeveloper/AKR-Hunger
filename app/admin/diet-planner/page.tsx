'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, updateDoc, getDocs } from 'firebase/firestore';
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
  Salad, Flame, Apple, Heart, Activity, Search,
  RefreshCw, Edit2, Check, CheckCircle2, Plus
} from 'lucide-react';
import { MenuItem } from '@/lib/types';

export default function DietPlannerAdminPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    calories: 350,
    protein: 20,
    carbs: 40,
    fat: 10,
    isHealthy: true,
    dietType: 'keto',
  });

  useEffect(() => {
    const fetchDishes = async () => {
      try {
        const snap = await getDocs(collection(db, 'menuItems'));
        const list: MenuItem[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() } as MenuItem));
        setItems(list);
      } catch (err) {
        console.error('Error fetching menu items:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDishes();
  }, []);

  const handleOpenEdit = (item: MenuItem) => {
    setSelectedItem(item);
    setEditForm({
      calories: (item as any).calories || 350,
      protein: (item as any).protein || 20,
      carbs: (item as any).carbs || 40,
      fat: (item as any).fat || 10,
      isHealthy: (item as any).isHealthy ?? true,
      dietType: (item as any).dietType || 'balanced',
    });
    setEditModalOpen(true);
  };

  const handleSaveNutrition = async () => {
    if (!selectedItem) return;
    try {
      await updateDoc(doc(db, 'menuItems', selectedItem.id), {
        calories: Number(editForm.calories),
        protein: Number(editForm.protein),
        carbs: Number(editForm.carbs),
        fat: Number(editForm.fat),
        isHealthy: editForm.isHealthy,
        dietType: editForm.dietType,
      });

      setItems(prev => prev.map(m => m.id === selectedItem.id ? {
        ...m,
        ...editForm,
        calories: Number(editForm.calories),
        protein: Number(editForm.protein),
      } as any : m));

      toast.success(`Updated nutrition details for ${selectedItem.name}!`);
      setEditModalOpen(false);
    } catch (err: any) {
      toast.error('Failed to update nutrition: ' + err.message);
    }
  };

  const filtered = items.filter(i =>
    i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <Salad className="w-8 h-8 text-emerald-500" />
          Diet &amp; Nutritional Catalog Management
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tag dishes with verified nutritional metrics (calories, protein, carbs, healthy labels) to feed the /customer/diet-planner engine.
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="border-border/60 bg-card/60 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              Catalog Items
              <Apple className="w-4 h-4 text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">{items.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Total active dishes</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-emerald-500 flex items-center justify-between">
              Healthy Tagged
              <Heart className="w-4 h-4 text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-emerald-500">
              {items.filter((i: any) => i.isHealthy).length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Eligible for diet filters</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-orange-500 flex items-center justify-between">
              High Protein Items
              <Flame className="w-4 h-4 text-orange-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-orange-500">
              {items.filter((i: any) => (i.protein || 0) >= 20).length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">&gt; 20g protein/serving</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-blue-500 flex items-center justify-between">
              Low Calorie Items
              <Activity className="w-4 h-4 text-blue-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-blue-500">
              {items.filter((i: any) => (i.calories || 500) <= 350).length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">&lt; 350 kcal/serving</p>
          </CardContent>
        </Card>
      </div>

      {/* Dishes Table */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-md overflow-hidden">
        <CardHeader className="border-b border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-bold text-foreground">Menu Items Nutrition</CardTitle>
              <CardDescription className="text-xs">
                Edit caloric and macronutrient values for customer nutrition goals.
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search dish or category..."
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
                <TableHead className="font-bold">Dish Name</TableHead>
                <TableHead className="font-bold">Price</TableHead>
                <TableHead className="font-bold">Calories</TableHead>
                <TableHead className="font-bold">Macros (P/C/F)</TableHead>
                <TableHead className="font-bold">Diet Tag</TableHead>
                <TableHead className="text-right font-bold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Loading dishes...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No menu items found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.slice(0, 50).map((dish) => {
                  const cal = (dish as any).calories || 380;
                  const pro = (dish as any).protein || 18;
                  const carbs = (dish as any).carbs || 45;
                  const fat = (dish as any).fat || 12;
                  const isHealthy = (dish as any).isHealthy ?? false;

                  return (
                    <TableRow key={dish.id} className="border-border/40 hover:bg-muted/20">
                      <TableCell>
                        <p className="font-semibold text-sm text-foreground">{dish.name}</p>
                        <p className="text-xs text-muted-foreground">{dish.category || 'General'}</p>
                      </TableCell>
                      <TableCell className="font-bold text-foreground">₹{dish.price}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-semibold gap-1 text-orange-400 border-orange-500/30">
                          <Flame className="w-3 h-3" /> {cal} kcal
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-muted-foreground">
                        <span className="text-emerald-400 font-bold">{pro}g P</span> / {carbs}g C / {fat}g F
                      </TableCell>
                      <TableCell>
                        {isHealthy ? (
                          <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 text-xs font-semibold">
                            ✓ Healthy Choice
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Standard
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenEdit(dish)}
                          className="rounded-xl h-8 text-xs font-bold gap-1"
                        >
                          <Edit2 className="w-3 h-3" /> Edit Macros
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Edit Macros Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="rounded-2xl max-w-md bg-card border-border/80">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">
              Edit Nutrition: {selectedItem?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Define the nutritional profile shown to customers on /customer/diet-planner.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">Calories (kcal)</label>
              <Input
                type="number"
                value={editForm.calories}
                onChange={(e) => setEditForm(prev => ({ ...prev, calories: Number(e.target.value) }))}
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">Protein (g)</label>
              <Input
                type="number"
                value={editForm.protein}
                onChange={(e) => setEditForm(prev => ({ ...prev, protein: Number(e.target.value) }))}
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">Carbs (g)</label>
              <Input
                type="number"
                value={editForm.carbs}
                onChange={(e) => setEditForm(prev => ({ ...prev, carbs: Number(e.target.value) }))}
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">Fat (g)</label>
              <Input
                type="number"
                value={editForm.fat}
                onChange={(e) => setEditForm(prev => ({ ...prev, fat: Number(e.target.value) }))}
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditModalOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button onClick={handleSaveNutrition} className="rounded-xl font-bold bg-primary text-primary-foreground">
              Save Nutrition
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
