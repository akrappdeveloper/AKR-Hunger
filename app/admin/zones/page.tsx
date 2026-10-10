'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
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
  Map, MapPin, Plus, Edit, Trash2, ToggleLeft, ToggleRight,
  Search, Store, Activity, IndianRupee, Package
} from 'lucide-react';
import { toast } from 'sonner';

interface DeliveryZone {
  id: string;
  name: string;
  pincode: string;
  city: string;
  state: string;
  deliveryFee: number;
  minOrderAmount: number;
  isActive: boolean;
  restaurantCount: number;
  createdAt: any;
}

export default function AdminZonesPage() {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    pincode: '',
    city: '',
    state: '',
    deliveryFee: 50,
    minOrderAmount: 100,
    isActive: true,
  });

  useEffect(() => {
    const unsubZones = onSnapshot(
      collection(db, 'delivery_zones'),
      (snap) => {
        const data = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          restaurantCount: 0,
        })) as DeliveryZone[];
        setZones(data);
        setLoading(false);
      },
      (error) => {
        console.warn("Snapshot listener notice for delivery_zones:", error.message);
        setLoading(false);
      }
    );

    const unsubRestaurants = onSnapshot(
      collection(db, 'restaurants'),
      (snap) => {
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setRestaurants(data);
      },
      (error) => {
        console.warn("Snapshot listener notice for restaurants:", error.message);
      }
    );

    return () => {
      unsubZones();
      unsubRestaurants();
    };
  }, []);

  // Enrich zones with restaurant counts
  const enrichedZones = zones.map(zone => {
    const count = restaurants.filter(r =>
      r.servicePincodes?.includes(zone.pincode) ||
      r.pincode === zone.pincode
    ).length;
    return { ...zone, restaurantCount: count };
  });

  const filteredZones = enrichedZones.filter(z =>
    z.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    z.pincode.includes(searchQuery) ||
    z.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenCreate = () => {
    setEditingZone(null);
    setFormData({ name: '', pincode: '', city: '', state: '', deliveryFee: 50, minOrderAmount: 100, isActive: true });
    setDialogOpen(true);
  };

  const handleOpenEdit = (zone: DeliveryZone) => {
    setEditingZone(zone);
    setFormData({
      name: zone.name,
      pincode: zone.pincode,
      city: zone.city,
      state: zone.state,
      deliveryFee: zone.deliveryFee,
      minOrderAmount: zone.minOrderAmount,
      isActive: zone.isActive,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.pincode) {
      toast.error('Name and pincode are required');
      return;
    }

    try {
      if (editingZone) {
        await updateDoc(doc(db, 'delivery_zones', editingZone.id), {
          ...formData,
          updatedAt: serverTimestamp(),
        });
        toast.success('Zone updated successfully');
      } else {
        await addDoc(collection(db, 'delivery_zones'), {
          ...formData,
          createdAt: serverTimestamp(),
        });
        toast.success('Zone created successfully');
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error('Failed to save zone');
      console.error(err);
    }
  };

  const handleToggle = async (zone: DeliveryZone) => {
    try {
      await updateDoc(doc(db, 'delivery_zones', zone.id), {
        isActive: !zone.isActive,
      });
      toast.success(`Zone ${zone.isActive ? 'disabled' : 'enabled'}`);
    } catch (err) {
      toast.error('Failed to update zone');
    }
  };

  const handleDelete = async (zone: DeliveryZone) => {
    if (!confirm(`Delete zone "${zone.name}" (${zone.pincode})?`)) return;
    try {
      await deleteDoc(doc(db, 'delivery_zones', zone.id));
      toast.success('Zone deleted');
    } catch (err) {
      toast.error('Failed to delete zone');
    }
  };

  const activeZones = enrichedZones.filter(z => z.isActive).length;
  const totalRestaurantsCovered = new Set(
    enrichedZones.flatMap(z =>
      restaurants.filter(r => r.servicePincodes?.includes(z.pincode)).map(r => r.id)
    )
  ).size;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-4">
          <div className="h-10 w-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading delivery zones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-100 to-gray-400 tracking-tight mb-2">
            Delivery Zones
          </h1>
          <p className="text-muted-foreground">Manage delivery areas, fees, and restaurant coverage.</p>
        </div>
        <Button onClick={handleOpenCreate} className="gap-2 bg-blue-600 hover:bg-blue-700 text-foreground">
          <Plus size={16} />
          Add Zone
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'Total Zones', value: enrichedZones.length, icon: Map, color: 'blue' },
          { title: 'Active Zones', value: activeZones, icon: MapPin, color: 'emerald' },
          { title: 'Restaurants Covered', value: totalRestaurantsCovered, icon: Store, color: 'purple' },
          { title: 'Avg Delivery Fee', value: `₹${enrichedZones.length > 0 ? Math.round(enrichedZones.reduce((s, z) => s + z.deliveryFee, 0) / enrichedZones.length) : 0}`, icon: IndianRupee, color: 'orange' },
        ].map((stat, i) => {
          const Icon = stat.icon;
          const colors: Record<string, string> = {
            blue: 'from-blue-600/20 to-blue-600/5 border-blue-500/20',
            emerald: 'from-emerald-600/20 to-emerald-600/5 border-emerald-500/20',
            purple: 'from-purple-600/20 to-purple-600/5 border-purple-500/20',
            orange: 'from-orange-600/20 to-orange-600/5 border-orange-500/20',
          };
          const iconColors: Record<string, string> = {
            blue: 'text-blue-400', emerald: 'text-emerald-400', purple: 'text-purple-400', orange: 'text-orange-400',
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

      {/* Zones Table */}
      <Card className="bg-background/40 border-border/50 backdrop-blur-md shadow-xl overflow-hidden">
        <CardHeader className="border-b border-border/50 bg-card/5 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Map className="w-5 h-5 text-blue-400" />
              All Delivery Zones
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search zones..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-background/20 border-border/50 text-foreground placeholder:text-muted-foreground w-56"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredZones.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Map className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium">No delivery zones</p>
              <p className="text-sm">Create your first delivery zone to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Zone Name</TableHead>
                    <TableHead className="text-muted-foreground">Pincode</TableHead>
                    <TableHead className="text-muted-foreground">City</TableHead>
                    <TableHead className="text-muted-foreground">State</TableHead>
                    <TableHead className="text-muted-foreground text-right">Delivery Fee</TableHead>
                    <TableHead className="text-muted-foreground text-right">Min Order</TableHead>
                    <TableHead className="text-muted-foreground text-center">Restaurants</TableHead>
                    <TableHead className="text-muted-foreground text-center">Status</TableHead>
                    <TableHead className="text-muted-foreground text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredZones.map((zone) => (
                    <TableRow 
                      key={zone.id} 
                      className="border-border/50 hover:bg-card/5 transition-colors cursor-pointer"
                      onClick={() => handleOpenEdit(zone)}
                    >
                      <TableCell className="text-foreground font-medium text-sm">{zone.name}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-sm">{zone.pincode}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{zone.city || '-'}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{zone.state || '-'}</TableCell>
                      <TableCell className="text-emerald-400 text-right font-mono text-sm">₹{zone.deliveryFee}</TableCell>
                      <TableCell className="text-muted-foreground text-right font-mono text-sm">₹{zone.minOrderAmount}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs">
                          {zone.restaurantCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => handleToggle(zone)} className="inline-flex items-center">
                          {zone.isActive ? (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs gap-1 cursor-pointer hover:bg-emerald-500/20 transition-colors">
                              <ToggleRight size={12} /> Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 text-xs gap-1 cursor-pointer hover:bg-red-500/20 transition-colors">
                              <ToggleLeft size={12} /> Inactive
                            </Badge>
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => handleOpenEdit(zone)} className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 h-8 w-8 p-0">
                            <Edit size={14} />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(zone)} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8 p-0">
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Zone Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border/50 text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle>{editingZone ? 'Edit Zone' : 'Create New Zone'}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {editingZone ? 'Update delivery zone settings' : 'Add a new delivery zone to the platform'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label className="text-muted-foreground text-sm">Zone Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Downtown Area"
                className="mt-1 bg-background/20 border-border/50 text-foreground"
              />
            </div>
            <div>
              <Label className="text-muted-foreground text-sm">Pincode</Label>
              <Input
                value={formData.pincode}
                onChange={(e) => setFormData(prev => ({ ...prev, pincode: e.target.value }))}
                placeholder="e.g., 560001"
                className="mt-1 bg-background/20 border-border/50 text-foreground"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground text-sm">City</Label>
                <Input
                  value={formData.city}
                  onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                  placeholder="e.g., Bangalore"
                  className="mt-1 bg-background/20 border-border/50 text-foreground"
                />
              </div>
              <div>
                <Label className="text-muted-foreground text-sm">State</Label>
                <Input
                  value={formData.state}
                  onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                  placeholder="e.g., Karnataka"
                  className="mt-1 bg-background/20 border-border/50 text-foreground"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground text-sm">Delivery Fee (₹)</Label>
                <Input
                  type="number"
                  value={formData.deliveryFee}
                  onChange={(e) => setFormData(prev => ({ ...prev, deliveryFee: Number(e.target.value) }))}
                  className="mt-1 bg-background/20 border-border/50 text-foreground font-mono"
                />
              </div>
              <div>
                <Label className="text-muted-foreground text-sm">Min Order (₹)</Label>
                <Input
                  type="number"
                  value={formData.minOrderAmount}
                  onChange={(e) => setFormData(prev => ({ ...prev, minOrderAmount: Number(e.target.value) }))}
                  className="mt-1 bg-background/20 border-border/50 text-foreground font-mono"
                />
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-background/20 rounded-xl border border-border/50">
              <span className="text-muted-foreground text-sm">Zone Active</span>
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                className="w-5 h-5 rounded bg-background/40 border-border text-blue-600"
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-border/50 text-foreground hover:bg-card/10">
              Cancel
            </Button>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-foreground">
              {editingZone ? 'Update Zone' : 'Create Zone'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
