'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRestaurantAuth } from '@/context/RestaurantAuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { uploadToImgBB } from '@/lib/imgbb';
import { MenuItem } from '@/lib/types';
import {
  Plus, Trash2, ChevronDown, ChevronUp, Upload, Image as ImageIcon,
  Clock, CheckCircle, XCircle, X, Star, Flame, Tag, Users, AlertCircle
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Checkbox } from '@/components/ui/checkbox';

export default function MenuManagementPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useRestaurantAuth();

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [successDialog, setSuccessDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  const [newItem, setNewItem] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    preparationTime: '30',
    servings: '1',
    calories: '',
    allergens: '',
    tags: '',
    isVegetarian: false,
    isSpicy: false,
    isAvailable: true,
    isBestSeller: false,
    isNew: false,
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/restaurant/login');
      return;
    }
    fetchMenuItems();
  }, [user, authLoading, router]);

  const fetchMenuItems = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const menuRef = collection(db, 'menuItems');
      const q = query(menuRef, where('restaurantId', '==', user.uid));
      const snapshot = await getDocs(q);

      const items = snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
      })) as MenuItem[];

      setMenuItems(items);

      if (items.length > 0) {
        setExpandedCategory(items[0].category);
      }
    } catch (error) {
      console.error('[Menu] Error fetching menu items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Limit to 5 images
    const newFiles = files.slice(0, 5 - imageFiles.length);
    setImageFiles([...imageFiles, ...newFiles]);

    // Create previews
    newFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async (files: File[]): Promise<string[]> => {
    const uploadPromises = files.map(file => uploadToImgBB(file));
    return await Promise.all(uploadPromises);
  };

  const handleAddItem = async () => {
    if (!newItem.name || !newItem.price || !newItem.category) {
      alert('Please fill in all required fields (Name, Category, Price)');
      return;
    }

    if (imageFiles.length === 0) {
      alert('Please upload at least one image for the menu item');
      return;
    }

    try {
      setSubmitting(true);

      // Upload all images
      console.log('[Menu] Uploading', imageFiles.length, 'images...');
      const imageUrls = await uploadImages(imageFiles);

      // Parse tags
      const tagArray = newItem.tags.split(',').map(t => t.trim()).filter(t => t);
      const allergenArray = newItem.allergens.split(',').map(a => a.trim()).filter(a => a);

      // Add menu item
      await addDoc(collection(db, 'menuItems'), {
        name: newItem.name,
        description: newItem.description,
        price: parseFloat(newItem.price),
        category: newItem.category,
        vegetarian: newItem.isVegetarian,
        spicy: newItem.isSpicy,
        available: newItem.isAvailable,
        image: imageUrls[0], // Primary image
        images: imageUrls, // All images
        preparationTime: parseInt(newItem.preparationTime) || 30,
        servings: parseInt(newItem.servings) || 1,
        calories: newItem.calories ? parseInt(newItem.calories) : undefined,
        allergens: allergenArray,
        tags: tagArray,
        isBestSeller: newItem.isBestSeller,
        isNew: newItem.isNew,
        restaurantId: user!.uid,
        approvalStatus: 'pending',
        isLive: false,
        submittedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Reset form
      setNewItem({
        name: '',
        description: '',
        price: '',
        category: '',
        preparationTime: '30',
        servings: '1',
        calories: '',
        allergens: '',
        tags: '',
        isVegetarian: false,
        isSpicy: false,
        isAvailable: true,
        isBestSeller: false,
        isNew: false,
      });
      setImageFiles([]);
      setImagePreviews([]);
      setDialogOpen(false);

      await fetchMenuItems();

      setSuccessDialog(true);
    } catch (error) {
      console.error('[Menu] Error adding item:', error);
      alert('Failed to add item. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      await deleteDoc(doc(db, 'menuItems', itemId));
      setMenuItems(menuItems.filter((item) => item.id !== itemId));
    } catch (error) {
      console.error('[Menu] Error deleting item:', error);
      alert('Failed to delete item');
    }
  };

  const getStatusBadge = (item: MenuItem) => {
    if (item.approvalStatus === 'approved' && item.isLive) {
      return <Badge variant="default" className="bg-green-500 hover:bg-green-600"><CheckCircle className="w-3 h-3 mr-1" /> Live</Badge>;
    }
    if (item.approvalStatus === 'pending') {
      return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30 hover:bg-yellow-500/30"><Clock className="w-3 h-3 mr-1" /> Pending Approval</Badge>;
    }
    if (item.approvalStatus === 'rejected') {
      return <Badge variant="destructive" className="bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30"><XCircle className="w-3 h-3 mr-1" /> Rejected</Badge>;
    }
    return null;
  };

  const categories = Array.from(new Set(menuItems.map((item) => item.category)));

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <Spinner className="w-8 h-8 text-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-4 md:p-8 space-y-8 text-white selection:bg-orange-500/30">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-orange-400 via-red-400 to-amber-300 bg-clip-text text-transparent animate-in slide-in-from-left duration-500">
            Menu Management
          </h1>
          <p className="text-slate-400 mt-2 text-lg">Curate your restaurant&apos;s culinary offerings</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="h-12 px-6 rounded-full gap-2 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 shadow-lg shadow-orange-500/20 text-white font-semibold transition-all hover:scale-105 active:scale-95">
              <Plus className="w-5 h-5" />
              Add New Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-slate-950/95 border-slate-800 text-white backdrop-blur-xl shadow-2xl">
            <DialogHeader className="border-b border-slate-800 pb-4">
              <DialogTitle className="text-2xl font-bold text-white">Add New Menu Item</DialogTitle>
              <DialogDescription className="text-slate-400">
                Fill in the details below. Your item will be submitted for admin approval.
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="basic" className="w-full mt-2">
              <TabsList className="bg-slate-900 border border-slate-800 p-1 rounded-xl w-full grid grid-cols-3 gap-1">
                <TabsTrigger value="basic" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400 font-medium py-2.5">Basic Info</TabsTrigger>
                <TabsTrigger value="details" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400 font-medium py-2.5">Details</TabsTrigger>
                <TabsTrigger value="attributes" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400 font-medium py-2.5">Attributes</TabsTrigger>
              </TabsList>

              {/* Basic Info Tab */}
              <TabsContent value="basic" className="space-y-6 mt-6">
                {/* Images Upload */}
                <div className="space-y-3">
                  <Label className="text-slate-300 font-medium">Item Images * (Up to 5)</Label>
                  <div className="border-2 border-dashed border-slate-700 bg-slate-900/50 rounded-xl p-4 transition-colors hover:border-slate-600 hover:bg-slate-900">
                    {imagePreviews.length > 0 ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {imagePreviews.map((preview, index) => (
                            <div key={index} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-700">
                              <img
                                src={preview}
                                alt={`Preview ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => removeImage(index)}
                                className="absolute top-2 right-2 p-1.5 bg-red-500/80 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm"
                              >
                                <X className="w-4 h-4" />
                              </button>
                              {index === 0 && (
                                <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-sm text-center py-1">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-white">Primary</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        {imageFiles.length < 5 && (
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                            onClick={() => document.getElementById('image-upload')?.click()}
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add More Images
                          </Button>
                        )}
                      </div>
                    ) : (
                      <label htmlFor="image-upload" className="cursor-pointer flex flex-col items-center gap-3 py-10">
                        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center">
                          <ImageIcon className="w-8 h-8 text-slate-400" />
                        </div>
                        <div className="text-center">
                          <p className="text-base font-medium text-slate-300">Click to upload images</p>
                          <p className="text-xs text-slate-500 mt-1">PNG, JPG up to 5MB (Max 5)</p>
                        </div>
                      </label>
                    )}
                    <input
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleImageChange}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-slate-300">Item Name *</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Truffle Burger"
                      value={newItem.name}
                      onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                      className="bg-slate-900 border-slate-700 text-white focus:border-orange-500 h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category" className="text-slate-300">Category *</Label>
                    <Input
                      id="category"
                      placeholder="e.g., Burgers"
                      value={newItem.category}
                      onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                      className="bg-slate-900 border-slate-700 text-white focus:border-orange-500 h-11"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="text-slate-300">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe textures, flavors, and ingredients..."
                    value={newItem.description}
                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                    className="bg-slate-900 border-slate-700 text-white focus:border-orange-500 min-h-[100px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price" className="text-slate-300">Price (₹) *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">₹</span>
                    <Input
                      id="price"
                      type="number"
                      placeholder="999"
                      value={newItem.price}
                      onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                      min="0"
                      step="0.01"
                      className="bg-slate-900 border-slate-700 text-white focus:border-orange-500 pl-8 h-11"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Details Tab */}
              <TabsContent value="details" className="space-y-6 mt-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="prepTime" className="text-slate-300">Prep Time (min)</Label>
                    <Input
                      id="prepTime"
                      type="number"
                      placeholder="30"
                      value={newItem.preparationTime}
                      onChange={(e) => setNewItem({ ...newItem, preparationTime: e.target.value })}
                      className="bg-slate-900 border-slate-700 text-white h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="servings" className="text-slate-300">Servings</Label>
                    <Input
                      id="servings"
                      type="number"
                      placeholder="1"
                      value={newItem.servings}
                      onChange={(e) => setNewItem({ ...newItem, servings: e.target.value })}
                      className="bg-slate-900 border-slate-700 text-white h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="calories" className="text-slate-300">Calories</Label>
                    <Input
                      id="calories"
                      type="number"
                      placeholder="450"
                      value={newItem.calories}
                      onChange={(e) => setNewItem({ ...newItem, calories: e.target.value })}
                      className="bg-slate-900 border-slate-700 text-white h-11"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="allergens" className="text-slate-300">Allergens</Label>
                  <Input
                    id="allergens"
                    placeholder="e.g., Gluten, Dairy, Nuts"
                    value={newItem.allergens}
                    onChange={(e) => setNewItem({ ...newItem, allergens: e.target.value })}
                    className="bg-slate-900 border-slate-700 text-white h-11"
                  />
                  <p className="text-xs text-slate-500">Comma separated values</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tags" className="text-slate-300">Tags</Label>
                  <Input
                    id="tags"
                    placeholder="e.g., Best Seller, Spicy, New"
                    value={newItem.tags}
                    onChange={(e) => setNewItem({ ...newItem, tags: e.target.value })}
                    className="bg-slate-900 border-slate-700 text-white h-11"
                  />
                </div>
              </TabsContent>

              {/* Attributes Tab */}
              <TabsContent value="attributes" className="space-y-6 mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { label: 'Vegetarian', desc: 'No meat ingredients', checked: newItem.isVegetarian, key: 'isVegetarian', icon: '🥬' },
                    { label: 'Spicy', desc: 'Contains hot spices', checked: newItem.isSpicy, key: 'isSpicy', icon: '🌶️' },
                    { label: 'Available', desc: 'Currently in stock', checked: newItem.isAvailable, key: 'isAvailable', icon: '✅' },
                    { label: 'Best Seller', desc: 'Popular among customers', checked: newItem.isBestSeller, key: 'isBestSeller', icon: '⭐' },
                    { label: 'New Item', desc: 'Recently Added', checked: newItem.isNew, key: 'isNew', icon: '🆕' },
                  ].map((attr) => (
                    <label key={attr.key} className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all ${attr.checked ? 'bg-orange-500/10 border-orange-500/50' : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}>
                      <Checkbox
                        checked={attr.checked}
                        onCheckedChange={(c) => setNewItem({ ...newItem, [attr.key]: !!c })}
                        className="mt-1 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                      />
                      <div>
                        <p className="font-semibold text-white flex items-center gap-2">{attr.icon} {attr.label}</p>
                        <p className="text-sm text-slate-400 mt-0.5">{attr.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="mt-8 border-t border-slate-800 pt-4 gap-3">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting} className="border-slate-700 text-white hover:bg-slate-800 hover:text-white">
                Cancel
              </Button>
              <Button onClick={handleAddItem} disabled={submitting} className="bg-gradient-to-r from-orange-500 to-red-600 text-white font-semibold px-8 shadow-lg shadow-orange-500/20">
                {submitting && <Spinner className="mr-2 h-4 w-4" />}
                {submitting ? 'Submitting...' : 'Submit for Approval'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Info Banner */}
      <div className="p-4 rounded-xl bg-blue-900/20 border border-blue-500/30 backdrop-blur-sm flex items-start gap-3">
        <div className="p-1.5 bg-blue-500/20 rounded-full shrink-0">
          <Clock className="w-4 h-4 text-blue-400" />
        </div>
        <p className="text-sm text-blue-200">
          <strong className="text-blue-100 font-semibold">Note:</strong> All new items require admin approval. Items marked as &quot;Live&quot; are visible to customers instantly.
        </p>
      </div>

      {/* Menu Items */}
      {categories.length === 0 ? (
        <Card className="py-20 text-center bg-slate-900/30 border-slate-800 border-dashed backdrop-blur-sm">
          <div className="w-20 h-20 mx-auto bg-slate-800/50 rounded-full flex items-center justify-center mb-6">
            <ImageIcon className="w-10 h-10 text-slate-600" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No menu items yet</h3>
          <p className="text-slate-400 mb-8 max-w-sm mx-auto">Get started by creating your first category and adding delicious items to your menu.</p>
          <Button onClick={() => setDialogOpen(true)} size="lg" className="bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-full px-8 shadow-lg">
            <Plus className="w-5 h-5 mr-2" />
            Add First Item
          </Button>
        </Card>
      ) : (
        <div className="space-y-6">
          {categories.map((category) => {
            const categoryItems = menuItems.filter((item) => item.category === category);
            const isExpanded = expandedCategory === category;

            return (
              <Card key={category} className="overflow-hidden bg-slate-900/40 border-slate-800 backdrop-blur-md shadow-xl transition-all hover:border-slate-700">
                <button
                  onClick={() => setExpandedCategory(isExpanded ? null : category)}
                  className="w-full p-6 flex items-center justify-between bg-gradient-to-r from-slate-900/80 to-slate-800/80 transition-all hover:from-slate-800 hover:to-slate-700"
                >
                  <div className="flex items-center gap-4">
                    <h3 className="font-bold text-white text-xl tracking-tight">{category}</h3>
                    <Badge variant="secondary" className="bg-slate-700 text-slate-200 hover:bg-slate-600 border-0">{categoryItems.length} items</Badge>
                  </div>
                  {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </button>

                {isExpanded && (
                  <div className="p-4 space-y-4">
                    {categoryItems.map((item) => (
                      <div key={item.id} className="group flex flex-col md:flex-row gap-5 p-5 bg-slate-950/50 rounded-xl border border-slate-800 hover:border-slate-600 transition-all duration-300 hover:shadow-lg hover:shadow-black/20">
                        <div className="relative w-full md:w-40 h-40 md:h-32 rounded-lg overflow-hidden shrink-0">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            />
                          ) : (
                            <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                              <ImageIcon className="w-8 h-8 text-slate-600" />
                            </div>
                          )}
                          {!item.isLive && item.approvalStatus === 'approved' && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                              <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30">Hidden</Badge>
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <h4 className="font-bold text-white text-xl truncate">{item.name}</h4>
                                {item.vegetarian && <Badge variant="outline" className="border-green-500/30 text-green-400 bg-green-500/10 text-[10px] px-1.5 py-0">VEG</Badge>}
                                {item.spicy && <Badge variant="outline" className="border-red-500/30 text-red-400 bg-red-500/10 text-[10px] px-1.5 py-0">SPICY</Badge>}
                                {getStatusBadge(item)}
                              </div>
                              <p className="text-slate-400 text-sm line-clamp-2 mb-3 max-w-2xl">{item.description || 'No description provided.'}</p>

                              <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                                {item.calories && <span className="flex items-center gap-1"><Flame className="w-3 h-3" /> {item.calories} kcal</span>}
                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {item.preparationTime}m</span>
                                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> Serves {item.servings}</span>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <p className="text-2xl font-bold text-white mb-3">₹{item.price}</p>
                              <div className="flex gap-2 justify-end">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 text-slate-400 hover:text-white hover:bg-slate-800"
                                // Add Edit functionality here later
                                >
                                  <Tag className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteItem(item.id || '')}
                                  className="h-9 w-9 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </div>

                          {item.approvalStatus === 'rejected' && item.rejectionReason && (
                            <div className="mt-3 p-3 rounded-lg bg-red-950/30 border border-red-900/50 flex gap-2 items-start">
                              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                              <p className="text-sm text-red-300"><strong>Action Required:</strong> {item.rejectionReason}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Success Dialog */}
      <Dialog open={successDialog} onOpenChange={setSuccessDialog}>
        <DialogContent className="max-w-sm bg-slate-900 border-slate-800 text-white text-center p-8">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 ring-1 ring-green-500/50">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Item Submitted!</h3>
          <p className="text-slate-400 text-sm mb-6">Your menu item has been sent to the admin team for approval. It will go live once verified.</p>
          <Button onClick={() => setSuccessDialog(false)} className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold">
            Okay, got it
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
