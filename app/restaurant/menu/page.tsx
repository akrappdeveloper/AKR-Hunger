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
  Clock, CheckCircle, XCircle, X, Star, Flame, Tag, Users, AlertCircle, Utensils
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Checkbox } from '@/components/ui/checkbox';
import { motion, AnimatePresence } from 'framer-motion';

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
      return <Badge variant="default" className="bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/50"><CheckCircle className="w-3 h-3 mr-1" /> Live</Badge>;
    }
    if (item.approvalStatus === 'pending') {
      return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 hover:bg-yellow-500/30"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
    }
    if (item.approvalStatus === 'rejected') {
      return <Badge variant="destructive" className="bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30"><XCircle className="w-3 h-3 mr-1" /> Rejected</Badge>;
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

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-6"
      >
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-orange-400 via-red-500 to-amber-500 bg-clip-text text-transparent flex items-center gap-3">
            <Utensils className="w-10 h-10 text-orange-500" />
            Menu Management
          </h1>
          <p className="text-gray-400 mt-2 text-lg font-light">
            Curate your restaurant's <span className="text-white font-medium">culinary masterpieces</span>
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="h-12 px-6 rounded-full gap-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 shadow-xl shadow-orange-900/40 text-white font-bold transition-all hover:scale-105 active:scale-95 border border-white/10">
              <Plus className="w-5 h-5" />
              Add New Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-black/95 border-white/10 text-white backdrop-blur-xl shadow-2xl">
            <DialogHeader className="border-b border-white/10 pb-4">
              <DialogTitle className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
                Add New Menu Item
              </DialogTitle>
              <DialogDescription className="text-gray-400">
                Fill in the details below to add a new dish to your menu.
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="basic" className="w-full mt-4">
              <TabsList className="bg-white/5 border border-white/10 p-1 rounded-full w-full grid grid-cols-3 gap-1">
                <TabsTrigger value="basic" className="rounded-full data-[state=active]:bg-orange-600 data-[state=active]:text-white text-gray-400 font-medium transition-all">Basic Info</TabsTrigger>
                <TabsTrigger value="details" className="rounded-full data-[state=active]:bg-orange-600 data-[state=active]:text-white text-gray-400 font-medium transition-all">Details</TabsTrigger>
                <TabsTrigger value="attributes" className="rounded-full data-[state=active]:bg-orange-600 data-[state=active]:text-white text-gray-400 font-medium transition-all">Attributes</TabsTrigger>
              </TabsList>

              {/* Basic Info Tab */}
              <TabsContent value="basic" className="space-y-6 mt-6">
                {/* Images Upload */}
                <div className="space-y-3">
                  <Label className="text-white font-medium">Item Images * (Up to 5)</Label>
                  <div className="border border-dashed border-white/20 bg-white/5 rounded-xl p-4 transition-all hover:border-orange-500/50 hover:bg-white/10">
                    {imagePreviews.length > 0 ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {imagePreviews.map((preview, index) => (
                            <div key={index} className="relative group aspect-square rounded-lg overflow-hidden border border-white/10">
                              <img
                                src={preview}
                                alt={`Preview ${index + 1}`}
                                className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500"
                              />
                              <button
                                type="button"
                                onClick={() => removeImage(index)}
                                className="absolute top-2 right-2 p-1.5 bg-red-600/80 hover:bg-red-700 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                        {imageFiles.length < 5 && (
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white"
                            onClick={() => document.getElementById('image-upload')?.click()}
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add More Images
                          </Button>
                        )}
                      </div>
                    ) : (
                      <label htmlFor="image-upload" className="cursor-pointer flex flex-col items-center gap-3 py-10">
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center border border-white/10 group-hover:border-orange-500/50 transition-colors">
                          <ImageIcon className="w-8 h-8 text-gray-500 group-hover:text-orange-400 transition-colors" />
                        </div>
                        <div className="text-center">
                          <p className="text-base font-medium text-white">Click to upload images</p>
                          <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 5MB (Max 5)</p>
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
                    <Label htmlFor="name" className="text-gray-300">Item Name *</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Truffle Burger"
                      value={newItem.name}
                      onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                      className="bg-white/5 border-white/10 text-white focus:border-orange-500 h-12"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category" className="text-gray-300">Category *</Label>
                    <Input
                      id="category"
                      placeholder="e.g., Burgers"
                      value={newItem.category}
                      onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                      className="bg-white/5 border-white/10 text-white focus:border-orange-500 h-12"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="text-gray-300">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe textures, flavors, and ingredients..."
                    value={newItem.description}
                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                    className="bg-white/5 border-white/10 text-white focus:border-orange-500 min-h-[100px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price" className="text-gray-300">Price (₹) *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">₹</span>
                    <Input
                      id="price"
                      type="number"
                      placeholder="999"
                      value={newItem.price}
                      onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                      min="0"
                      step="0.01"
                      className="bg-white/5 border-white/10 text-white focus:border-orange-500 pl-8 h-12 font-mono text-lg"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Details Tab */}
              <TabsContent value="details" className="space-y-6 mt-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="prepTime" className="text-gray-300">Prep Time (min)</Label>
                    <Input
                      id="prepTime"
                      type="number"
                      placeholder="30"
                      value={newItem.preparationTime}
                      onChange={(e) => setNewItem({ ...newItem, preparationTime: e.target.value })}
                      className="bg-white/5 border-white/10 text-white h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="servings" className="text-gray-300">Servings</Label>
                    <Input
                      id="servings"
                      type="number"
                      placeholder="1"
                      value={newItem.servings}
                      onChange={(e) => setNewItem({ ...newItem, servings: e.target.value })}
                      className="bg-white/5 border-white/10 text-white h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="calories" className="text-gray-300">Calories</Label>
                    <Input
                      id="calories"
                      type="number"
                      placeholder="450"
                      value={newItem.calories}
                      onChange={(e) => setNewItem({ ...newItem, calories: e.target.value })}
                      className="bg-white/5 border-white/10 text-white h-12"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="allergens" className="text-gray-300">Allergens</Label>
                  <Input
                    id="allergens"
                    placeholder="e.g., Gluten, Dairy, Nuts"
                    value={newItem.allergens}
                    onChange={(e) => setNewItem({ ...newItem, allergens: e.target.value })}
                    className="bg-white/5 border-white/10 text-white h-12"
                  />
                  <p className="text-xs text-gray-500">Comma separated values</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tags" className="text-gray-300">Tags</Label>
                  <Input
                    id="tags"
                    placeholder="e.g., Best Seller, Spicy, New"
                    value={newItem.tags}
                    onChange={(e) => setNewItem({ ...newItem, tags: e.target.value })}
                    className="bg-white/5 border-white/10 text-white h-12"
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
                    <label key={attr.key} className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all ${attr.checked ? 'bg-orange-600/10 border-orange-500/50' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                      <Checkbox
                        checked={attr.checked}
                        onCheckedChange={(c) => setNewItem({ ...newItem, [attr.key]: !!c })}
                        className="mt-1 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                      />
                      <div>
                        <p className="font-semibold text-white flex items-center gap-2">{attr.icon} {attr.label}</p>
                        <p className="text-sm text-gray-400 mt-0.5">{attr.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="mt-8 border-t border-white/10 pt-4 gap-3">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting} className="border-white/10 bg-transparent text-white hover:bg-white/10">
                Cancel
              </Button>
              <Button onClick={handleAddItem} disabled={submitting} className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-bold px-8 shadow-lg">
                {submitting && <Spinner className="mr-2 h-4 w-4" />}
                {submitting ? 'Submitting...' : 'Submit Item'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* Info Banner */}
      <div className="p-4 rounded-xl bg-blue-900/10 border border-blue-500/20 backdrop-blur-md flex items-start gap-3">
        <div className="p-1.5 bg-blue-500/20 rounded-full shrink-0">
          <Clock className="w-4 h-4 text-blue-400" />
        </div>
        <p className="text-sm text-blue-200">
          <strong className="text-blue-100 font-semibold">Note:</strong> All new items require admin approval.
        </p>
      </div>

      {/* Menu Items */}
      {categories.length === 0 ? (
        <Card className="py-20 text-center bg-white/5 border-white/10 border-dashed backdrop-blur-sm rounded-3xl">
          <div className="w-24 h-24 mx-auto bg-white/5 rounded-full flex items-center justify-center mb-6">
            <Utensils className="w-10 h-10 text-gray-500" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">Your Menu is Empty</h3>
          <p className="text-gray-400 mb-8 max-w-sm mx-auto">Start building your restaurant's legacy by adding your first dish.</p>
          <Button onClick={() => setDialogOpen(true)} size="lg" className="bg-white text-black font-bold rounded-full px-8 shadow-xl hover:bg-gray-200">
            <Plus className="w-5 h-5 mr-2" />
            Create First Item
          </Button>
        </Card>
      ) : (
        <div className="space-y-6">
          <AnimatePresence>
            {categories.map((category, idx) => {
              const categoryItems = menuItems.filter((item) => item.category === category);
              const isExpanded = expandedCategory === category;

              return (
                <motion.div
                  key={category}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <Card className="overflow-hidden bg-[#0A0A0A] border-white/10 shadow-xl transition-all hover:border-white/20">
                    <button
                      onClick={() => setExpandedCategory(isExpanded ? null : category)}
                      className="w-full p-6 flex items-center justify-between bg-gradient-to-r from-gray-900 to-black transition-all hover:bg-gray-900/80"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-1 h-8 bg-orange-500 rounded-full" />
                        <h3 className="font-bold text-white text-2xl tracking-tight">{category}</h3>
                        <Badge className="bg-white/10 text-gray-300 hover:bg-white/20 border-0">{categoryItems.length} items</Badge>
                      </div>
                      <div className={`p-2 rounded-full bg-white/5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      </div>
                    </button>

                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="p-4 space-y-4"
                      >
                        {categoryItems.map((item) => (
                          <div key={item.id} className="group relative flex flex-col md:flex-row gap-5 p-5 bg-white/5 rounded-2xl border border-white/5 hover:border-orange-500/30 transition-all duration-300 hover:shadow-2xl hover:shadow-black/40 hover:bg-white/[0.07]">
                            <div className="relative w-full md:w-48 h-48 md:h-36 rounded-xl overflow-hidden shrink-0 shadow-lg">
                              {item.image ? (
                                <img
                                  src={item.image}
                                  alt={item.name}
                                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                />
                              ) : (
                                <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                                  <ImageIcon className="w-8 h-8 text-gray-600" />
                                </div>
                              )}
                              {/* Status Badge Overlay */}
                              <div className="absolute top-2 left-2 flex flex-col gap-1">
                                {getStatusBadge(item)}
                              </div>
                            </div>

                            <div className="flex-1 min-w-0 flex flex-col justify-between">
                              <div>
                                <div className="flex items-start justify-between gap-4 mb-2">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <h4 className="font-bold text-white text-xl truncate group-hover:text-orange-400 transition-colors">{item.name}</h4>
                                      {item.isBestSeller && <Badge className="bg-amber-400 text-black font-bold text-[10px] px-1.5 border-0">BESTSELLER</Badge>}
                                      {item.isNew && <Badge className="bg-blue-500 text-white font-bold text-[10px] px-1.5 border-0">NEW</Badge>}
                                    </div>
                                    <p className="text-gray-400 text-sm line-clamp-2 leading-relaxed">{item.description || 'No description provided.'}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-2xl font-bold text-white tracking-tight">₹{item.price}</p>
                                  </div>
                                </div>

                                <div className="flex flex-wrap gap-2 text-xs text-gray-500 mt-3">
                                  {item.vegetarian && <Badge variant="outline" className="border-green-500/30 text-green-400 bg-green-500/10 text-[10px]">VEG</Badge>}
                                  {item.spicy && <Badge variant="outline" className="border-red-500/30 text-red-400 bg-red-500/10 text-[10px]">SPICY</Badge>}
                                  <span className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded-md"><Clock className="w-3 h-3" /> {item.preparationTime}m</span>
                                  <span className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded-md"><Users className="w-3 h-3" /> Serves {item.servings}</span>
                                </div>
                              </div>

                              <div className="flex justify-end gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteItem(item.id || '')}
                                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                >
                                  <Trash2 className="w-4 h-4 mr-1" /> Delete
                                </Button>
                              </div>
                            </div>
                            {item.approvalStatus === 'rejected' && item.rejectionReason && (
                              <div className="absolute inset-x-0 -bottom-2 mx-4 bg-red-900/90 text-white text-xs p-2 rounded-b-xl backdrop-blur-md border border-red-500/30 flex items-center justify-center gap-2">
                                <AlertCircle className="w-3 h-3" /> Action Required: {item.rejectionReason}
                              </div>
                            )}
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Success Dialog */}
      <Dialog open={successDialog} onOpenChange={setSuccessDialog}>
        <DialogContent className="max-w-sm bg-black border-white/10 text-white text-center p-8 shadow-2xl">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 ring-2 ring-green-500/50 animate-bounce">
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">Item Submitted!</h3>
          <p className="text-gray-400 text-sm mb-8 leading-relaxed">Your culinary creation has been sent for approval. It will shine on your menu once verified.</p>
          <Button onClick={() => setSuccessDialog(false)} className="w-full bg-white text-black hover:bg-gray-200 font-bold rounded-full h-12">
            Awesome
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
