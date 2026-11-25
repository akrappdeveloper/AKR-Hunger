'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Restaurant, MenuItem, Order } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, MapPin, Phone, Mail, Star, Building2, User, CreditCard, Landmark, CheckCircle, Ban, Store, ChefHat, Edit, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function RestaurantDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const restaurantId = params.id as string;

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // For Edit Form
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Restaurant>>({});

  useEffect(() => {
    if (!restaurantId) return;

    const fetchAllData = async () => {
      setLoading(true);
      try {
        // 1. Fetch Restaurant
        const restSnap = await getDoc(doc(db, 'restaurants', restaurantId));
        if (restSnap.exists()) {
          const restData = { id: restSnap.id, ...restSnap.data() } as Restaurant;
          setRestaurant(restData);
          setEditForm(restData);
        }

        // 2. Fetch Menu Items (assuming collection 'menuItems' with restaurantId)
        const menuQ = query(collection(db, 'menuItems'), where('restaurantId', '==', restaurantId));
        const menuSnap = await getDocs(menuQ);
        const fetchedMenus = menuSnap.docs.map(d => ({ id: d.id, ...d.data() })) as MenuItem[];
        setMenuItems(fetchedMenus);

        // 3. Fetch Orders
        const ordersQ = query(collection(db, 'orders'), where('restaurantId', '==', restaurantId));
        const ordersSnap = await getDocs(ordersQ);
        const fetchedOrders = ordersSnap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now())
          } as Order;
        });
        setOrders(fetchedOrders);
      } catch (err) {
        console.error('Error fetching restaurant details:', err);
        toast.error('Failed to load restaurant details');
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [restaurantId]);

  const handleSaveProfile = async () => {
    if (!restaurantId) return;
    try {
      const updates = {
        name: editForm.name || '',
        email: editForm.email || '',
        phone: editForm.phone || '',
        description: editForm.description || '',
        address: editForm.address || '',
        street: editForm.street || '',
        city: editForm.city || '',
        state: editForm.state || '',
        pincode: editForm.pincode || '',
        deliveryCharge: Number(editForm.deliveryCharge) || 0,
        deliveryRadius: Number(editForm.deliveryRadius) || 0,
        deliveryTime: Number(editForm.deliveryTime) || 0,
        minimumOrder: Number(editForm.minimumOrder) || 0,
        packagingFee: Number(editForm.packagingFee) || 0,
        isActive: !!editForm.isActive,
        isOpen: !!editForm.isOpen,
        isVeg: !!editForm.isVeg,
        isPureVeg: !!editForm.isPureVeg,
        fssaiLicense: editForm.fssaiLicense || '',
        gstNumber: editForm.gstNumber || '',
        category: editForm.category || '',
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, 'restaurants', restaurantId), updates);
      toast.success('Restaurant profile updated successfully');
      setRestaurant(prev => prev ? ({ ...prev, ...updates } as any) : null);
      setIsEditing(false);
    } catch (error: any) {
      toast.error('Failed to update profile: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-2">
          <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-muted-foreground">Loading restaurant details...</p>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="p-8 text-center space-y-4">
        <h2 className="text-xl font-bold text-foreground">Restaurant Not Found</h2>
        <Button onClick={() => router.push('/admin/restaurants')} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Restaurants
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/admin/restaurants')}
            className="border-border/50 text-muted-foreground hover:text-foreground rounded-xl"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
              {restaurant.name}
              <Badge variant="outline" className={`text-xs font-bold uppercase ${restaurant.isActive ? 'bg-green-500/10 text-green-500 border-green-500/30' : 'bg-red-500/10 text-red-500 border-red-500/30'}`}>
                {restaurant.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {restaurant.city || 'No City'}
            </p>
          </div>
        </div>
        <Button onClick={() => setIsEditing(!isEditing)} variant={isEditing ? "destructive" : "outline"} className="gap-2">
          {isEditing ? 'Cancel Editing' : <><Edit className="w-4 h-4" /> Edit Profile</>}
        </Button>
      </div>

      <Tabs defaultValue="overview" className="w-full flex-1 flex flex-col">
        <div className="border-b border-border/50 bg-card/50 rounded-t-xl px-4">
          <TabsList className="bg-transparent h-auto p-0 space-x-8">
            <TabsTrigger value="overview" className="bg-transparent border-b-2 border-transparent data-[state=active]:border-blue-500 rounded-none px-0 py-4 text-muted-foreground data-[state=active]:text-foreground font-medium transition-all">Overview</TabsTrigger>
            <TabsTrigger value="menu" className="bg-transparent border-b-2 border-transparent data-[state=active]:border-blue-500 rounded-none px-0 py-4 text-muted-foreground data-[state=active]:text-foreground font-medium transition-all">Menu Items ({menuItems.length})</TabsTrigger>
            <TabsTrigger value="orders" className="bg-transparent border-b-2 border-transparent data-[state=active]:border-blue-500 rounded-none px-0 py-4 text-muted-foreground data-[state=active]:text-foreground font-medium transition-all">Orders ({orders.length})</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-6 mt-6 focus-visible:ring-0">
          {isEditing ? (
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle>Edit Restaurant Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Name</label>
                    <input type="text" className="w-full p-2 bg-background border border-border/50 rounded" value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Category</label>
                    <input type="text" className="w-full p-2 bg-background border border-border/50 rounded" value={editForm.category || ''} onChange={e => setEditForm({ ...editForm, category: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Email</label>
                    <input type="email" className="w-full p-2 bg-background border border-border/50 rounded" value={editForm.email || ''} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Phone</label>
                    <input type="text" className="w-full p-2 bg-background border border-border/50 rounded" value={editForm.phone || ''} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">FSSAI License</label>
                    <input type="text" className="w-full p-2 bg-background border border-border/50 rounded" value={editForm.fssaiLicense || ''} onChange={e => setEditForm({ ...editForm, fssaiLicense: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">GST Number</label>
                    <input type="text" className="w-full p-2 bg-background border border-border/50 rounded" value={editForm.gstNumber || ''} onChange={e => setEditForm({ ...editForm, gstNumber: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Delivery Charge</label>
                    <input type="number" className="w-full p-2 bg-background border border-border/50 rounded" value={editForm.deliveryCharge || 0} onChange={e => setEditForm({ ...editForm, deliveryCharge: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Packaging Fee</label>
                    <input type="number" className="w-full p-2 bg-background border border-border/50 rounded" value={editForm.packagingFee || 0} onChange={e => setEditForm({ ...editForm, packagingFee: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Is Active (App visibility)</label>
                    <select className="w-full p-2 bg-background border border-border/50 rounded" value={editForm.isActive ? 'true' : 'false'} onChange={e => setEditForm({ ...editForm, isActive: e.target.value === 'true' })}>
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Is Open (Accepting Orders)</label>
                    <select className="w-full p-2 bg-background border border-border/50 rounded" value={editForm.isOpen ? 'true' : 'false'} onChange={e => setEditForm({ ...editForm, isOpen: e.target.value === 'true' })}>
                      <option value="true">Open</option>
                      <option value="false">Closed</option>
                    </select>
                  </div>
                </div>
                <Button onClick={handleSaveProfile} className="w-full bg-blue-600 hover:bg-blue-700 text-foreground mt-4">Save Changes</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Info cards */}
              <Card className="bg-card border-border/50 shadow-sm hover:shadow-md transition-all duration-300 group">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2"><Store className="w-4 h-4 text-blue-500" /> Restaurant Profile</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Name:</span> <span className="font-bold">{restaurant.name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Category:</span> <span>{restaurant.category}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Status:</span> <span>{restaurant.isActive ? 'Active' : 'Inactive'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Open:</span> <span>{restaurant.isOpen ? 'Yes' : 'No'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">FSSAI:</span> <span>{restaurant.fssaiLicense || restaurant.fssaiNumber || 'N/A'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">GST:</span> <span>{restaurant.gstNumber || 'N/A'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Rating:</span> <span>{restaurant.rating?.toFixed(1) || '0'} ({restaurant.reviews || 0} reviews)</span></div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border/50 shadow-sm hover:shadow-md transition-all duration-300 group">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2"><MapPin className="w-4 h-4 text-green-500" /> Contact & Location</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Email:</span> <span>{restaurant.email}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Phone:</span> <span>{restaurant.phone}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Address:</span> <span className="text-right max-w-[200px]">{restaurant.street || restaurant.address}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">City:</span> <span>{restaurant.city}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Coordinates:</span> <span>{restaurant.latitude}, {restaurant.longitude}</span></div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border/50 shadow-sm hover:shadow-md transition-all duration-300 group">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2"><CreditCard className="w-4 h-4 text-purple-500" /> Financials</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Delivery Charge:</span> <span>₹{restaurant.deliveryCharge || restaurant.deliveryFee || 0}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Packaging Fee:</span> <span>₹{restaurant.packagingFee || 0}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Minimum Order:</span> <span>₹{restaurant.minimumOrder || 0}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Delivery Radius:</span> <span>{restaurant.deliveryRadius || 0} km</span></div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border/50 shadow-sm hover:shadow-md transition-all duration-300 group">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2"><Landmark className="w-4 h-4 text-amber-500" /> Bank Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {restaurant.bankDetails ? (
                    <>
                      <div className="flex justify-between"><span className="text-muted-foreground">Bank Name:</span> <span>{restaurant.bankDetails.bankName || 'N/A'}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Account Holder:</span> <span>{restaurant.bankDetails.accountHolderName || 'N/A'}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Account Number:</span> <span>{restaurant.bankDetails.accountNumber || 'N/A'}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">IFSC Code:</span> <span>{restaurant.bankDetails.ifscCode || 'N/A'}</span></div>
                    </>
                  ) : (
                    <div className="text-center text-muted-foreground py-4">No bank details provided</div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="menu" className="mt-6">
          <div className="grid grid-cols-1 gap-4">
            {menuItems.map(item => (
              <Card key={item.id} className="bg-card border-border/50 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden group">
                <div className="flex flex-col md:flex-row">
                  <div className="h-32 w-full md:w-48 shrink-0 bg-secondary">
                    {item.image || (item as any).images?.[0] ? (
                      <img src={item.image || (item as any).images?.[0]} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground"><ChefHat className="w-8 h-8 opacity-20" /></div>
                    )}
                  </div>
                  <div className="p-4 flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-bold text-foreground text-lg">{item.name}</h4>
                        <p className="text-xs text-muted-foreground mb-1">{item.category} • {item.foodType}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">₹{item.price}</p>
                        {item.originalPrice && <p className="text-xs text-muted-foreground line-through">₹{item.originalPrice}</p>}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{item.description}</p>
                    <div className="flex flex-wrap gap-2 text-[10px]">
                      {item.isBestSeller && <Badge variant="secondary" className="bg-blue-500/10 text-blue-500">Best Seller</Badge>}
                      {item.isLive ? <Badge variant="secondary" className="bg-green-500/10 text-green-500">Live</Badge> : <Badge variant="secondary" className="bg-red-500/10 text-red-500">Offline</Badge>}
                      {item.vegetarian ? <Badge variant="secondary" className="bg-green-800/20 text-green-500 border border-green-500/30">VEG</Badge> : <Badge variant="secondary" className="bg-red-800/20 text-red-500 border border-red-500/30">NON-VEG</Badge>}
                      {(item as any).preparationTime && <Badge variant="outline"><Clock className="w-3 h-3 mr-1" /> {(item as any).preparationTime}m</Badge>}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
            {menuItems.length === 0 && (
              <div className="text-center py-12 text-muted-foreground border border-dashed border-border/50 rounded-xl">
                No menu items found for this restaurant.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="orders" className="mt-6">
          <div className="space-y-4">
            {orders.map(order => (
              <Card key={order.id} className="bg-card border-border/50 shadow-sm hover:shadow-md hover:bg-secondary/20 transition-all duration-300 cursor-pointer" onClick={() => router.push(`/admin/orders/${order.id}`)}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-foreground">Order #{order.orderNumber || order.id?.slice(-8).toUpperCase()}</h4>
                      <p className="text-xs text-muted-foreground">
                        {order.createdAt ? new Date(order.createdAt).toLocaleString() : 'N/A'} • {order.items?.length || 0} items
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-500">₹{order.total || 0}</p>
                      <Badge variant="outline" className={`text-[10px] uppercase mt-1 ${order.status === 'delivered' ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500'}`}>
                        {order.status}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {orders.length === 0 && (
              <div className="text-center py-12 text-muted-foreground border border-dashed border-border/50 rounded-xl">
                No orders found for this restaurant.
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
