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
  Clock, CheckCircle, XCircle, X, Star, Flame, Tag, Users, AlertCircle, Utensils,
  Search, Filter, ArrowUpRight
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
  const [searchQuery, setSearchQuery] = useState('');

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

  const [editingId, setEditingId] = useState<string | null>(null);

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

      if (items.length > 0 && !expandedCategory) {
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

  const handleEditItem = (item: MenuItem) => {
    setEditingId(item.id!);
    setNewItem({
      name: item.name,
      description: item.description,
      price: item.price.toString(),
      category: item.category,
      preparationTime: (item.preparationTime || 30).toString(),
      servings: (item.servings || 1).toString(),
      calories: item.calories?.toString() || '',
      allergens: item.allergens?.join(', ') || '',
      tags: item.tags?.join(', ') || '',
      isVegetarian: item.vegetarian,
      isSpicy: item.spicy,
      isAvailable: item.available,
      isBestSeller: item.isBestSeller || false,
      isNew: item.isNew || false,
    });
    // For images, we just show previews of existing URLs initially
    // If they add new files, those get uploaded. Existing URLs stay unless removed (logic simplified here)
    // NOTE: For simplicity in this edit flow, we'll re-use previews for existing images.
    // Handling removal of existing remote images vs new local files requires more complex state,
    // but we'll treat previews as the source of truth for display.
    setImagePreviews(item.images || [item.image]);
    setImageFiles([]); // Clear new files
    setDialogOpen(true);
  };

  const handleAddItem = async () => {
    if (!newItem.name || !newItem.price || !newItem.category) {
      alert('Please fill in all required fields (Name, Category, Price)');
      return;
    }

    if (imagePreviews.length === 0) {
      alert('Please provide at least one image for the menu item');
      return;
    }

    try {
      setSubmitting(true);

      // Upload NEW images
      let imageUrls: string[] = [];
      if (imageFiles.length > 0) {
        console.log('[Menu] Uploading', imageFiles.length, 'new images...');
        const newUrls = await uploadImages(imageFiles);
        imageUrls = [...newUrls];
      }

      // Combine with existing images (if editing and strictly keeping existing ones)
      // For this implementation, we append new uploads to existing remote URLs in preview
      const existingUrls = imagePreviews.filter(url => url.startsWith('http'));
      const finalImageUrls = [...existingUrls, ...imageUrls];

      if (finalImageUrls.length === 0) {
        // Fallback if something went wrong
        alert('Image processing failed.');
        return;
      }

      // Parse tags
      const tagArray = newItem.tags.split(',').map(t => t.trim()).filter(t => t);
      const allergenArray = newItem.allergens.split(',').map(a => a.trim()).filter(a => a);

      const itemData = {
        name: newItem.name,
        description: newItem.description,
        price: parseFloat(newItem.price),
        category: newItem.category,
        vegetarian: newItem.isVegetarian,
        spicy: newItem.isSpicy,
        available: newItem.isAvailable,
        image: finalImageUrls[0], // Primary image
        images: finalImageUrls, // All images
        preparationTime: parseInt(newItem.preparationTime) || 30,
        servings: parseInt(newItem.servings) || 1,
        calories: newItem.calories ? parseInt(newItem.calories) : undefined,
        allergens: allergenArray,
        tags: tagArray,
        isBestSeller: newItem.isBestSeller,
        isNew: newItem.isNew,
        restaurantId: user!.uid,
        approvalStatus: 'pending', // Always reset to pending on edit
        isLive: false, // Reset live status
        submittedAt: new Date(),
        updatedAt: new Date(),
      };

      if (editingId) {
        // Update existing doc
        // @ts-ignore
        await updateDoc(doc(db, 'menuItems', editingId), itemData);
      } else {
        // Create new doc
        // @ts-ignore
        await addDoc(collection(db, 'menuItems'), {
          ...itemData,
          createdAt: new Date(),
        });
      }

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
      setEditingId(null);
      setDialogOpen(false);

      await fetchMenuItems();

      setSuccessDialog(true);
    } catch (error) {
      console.error('[Menu] Error saving item:', error);
      alert('Failed to save item. Please try again.');
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
      return (
        <Badge variant="default" className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/50 backdrop-blur-sm">
          <CheckCircle className="w-3 h-3 mr-1" /> Live
        </Badge>
      );
    }
    if (item.approvalStatus === 'pending') {
      return (
        <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 hover:bg-yellow-500/30 backdrop-blur-sm">
          <Clock className="w-3 h-3 mr-1" /> Pending
        </Badge>
      );
    }
    if (item.approvalStatus === 'rejected') {
      return (
        <Badge variant="destructive" className="bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 backdrop-blur-sm">
          <XCircle className="w-3 h-3 mr-1" /> Rejected
        </Badge>
      );
    }
    return null;
  };

  // Group items by category and filter by search
  const filteredItems = menuItems.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const categories = Array.from(new Set(filteredItems.map((item) => item.category)));

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <Spinner className="w-8 h-8 text-orange-500" />
      </div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="min-h-screen bg-[#050505] p-4 md:p-8 space-y-8 text-white selection:bg-orange-500/30 font-sans pb-24"
    >

      {/* Hero Header */}
      <motion.div variants={itemVariants} className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-600/10 via-red-900/10 to-black border border-white/5 p-8 md:p-10 mb-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-[80px] -z-10" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Badge className="bg-orange-500/20 text-orange-400 border border-orange-500/30 hover:bg-orange-500/30 px-3 py-1">
                Restaurant Partners
              </Badge>
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight mb-3">
              Menu <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600">Editor</span>
            </h1>
            <p className="text-gray-400 text-lg max-w-xl leading-relaxed">
              Craft your digital menu with precision. Add detailed descriptions, enticing images, and manage availability in real-time.
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={(open) => {
            if (open) {
              setEditingId(null);
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
            }
            setDialogOpen(open);
          }}>
            <DialogTrigger asChild>
              <Button className="h-14 px-8 rounded-full gap-2 bg-white text-black hover:bg-gray-200 font-bold text-lg shadow-[0_0_30px_-5px_rgba(255,255,255,0.3)] transition-all hover:scale-105 active:scale-95 group">
                <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
                Add New Dish
              </Button>
            </DialogTrigger>

            {/* ADD ITEM DIALOG */}
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto bg-black border-white/10 text-white backdrop-blur-2xl shadow-2xl p-0 gap-0 [&::-webkit-scrollbar]:hidden">
              <div className="sticky top-0 z-20 bg-black/90 backdrop-blur-md border-b border-white/10 p-6 flex justify-between items-center">
                <div>
                  <DialogTitle className="text-2xl font-bold text-white">Add New Menu Item</DialogTitle>
                  <DialogDescription className="text-gray-400">Create a masterpiece for your menu.</DialogDescription>
                </div>
                {/* Close button is handled by DialogPrimitive, but we can add custom if needed or rely on default */}
              </div>

              <div className="p-6 md:p-8">
                <Tabs defaultValue="basic" className="w-full">
                  <TabsList className="bg-white/5 border border-white/10 p-1 rounded-2xl w-full grid grid-cols-3 gap-1 mb-8">
                    <TabsTrigger value="basic" className="rounded-xl py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-600 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=active]:shadow-lg text-gray-400 font-bold transition-all">Basic Info</TabsTrigger>
                    <TabsTrigger value="details" className="rounded-xl py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-600 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=active]:shadow-lg text-gray-400 font-bold transition-all">Details</TabsTrigger>
                    <TabsTrigger value="attributes" className="rounded-xl py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-600 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=active]:shadow-lg text-gray-400 font-bold transition-all">Attributes</TabsTrigger>
                  </TabsList>

                  {/* Basic Info Tab */}
                  <TabsContent value="basic" className="space-y-6 focus-visible:outline-none">
                    {/* Images Upload */}
                    <div className="space-y-3">
                      <Label className="text-white font-bold flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-orange-500" /> Item Images * (Up to 5)
                      </Label>
                      <div className="border-2 border-dashed border-white/10 bg-white/5 rounded-2xl p-6 transition-all hover:border-orange-500/30 hover:bg-white/[0.07] group/upload">
                        {imagePreviews.length > 0 ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {imagePreviews.map((preview, index) => (
                                <div key={index} className="relative group aspect-square rounded-xl overflow-hidden border border-white/10 shadow-lg">
                                  <img
                                    src={preview}
                                    alt={`Preview ${index + 1}`}
                                    className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500"
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <button
                                      type="button"
                                      onClick={() => removeImage(index)}
                                      className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-transform hover:scale-110"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                              {imageFiles.length < 5 && (
                                <button
                                  type="button"
                                  onClick={() => document.getElementById('image-upload')?.click()}
                                  className="aspect-square rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-white transition-all"
                                >
                                  <Plus className="w-8 h-8 opacity-50" />
                                  <span className="text-xs font-bold uppercase tracking-wider">Add More</span>
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <label htmlFor="image-upload" className="cursor-pointer flex flex-col items-center gap-4 py-8">
                            <div className="w-20 h-20 bg-gradient-to-br from-gray-800 to-black rounded-full flex items-center justify-center border border-white/10 group-hover/upload:border-orange-500/50 shadow-inner transition-all">
                              <Upload className="w-8 h-8 text-gray-400 group-hover/upload:text-orange-500 transition-colors" />
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-white group-hover/upload:text-orange-400 transition-colors">Click to upload images</p>
                              <p className="text-sm text-gray-500 mt-1">PNG, JPG up to 5MB (Max 5)</p>
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
                          placeholder="e.g., Truffle Mushroom Burger"
                          value={newItem.name}
                          onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                          className="bg-white/5 border-white/10 text-white focus:border-orange-500 h-14 rounded-xl px-4 text-lg font-medium"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="category" className="text-gray-300">Category *</Label>
                        <Input
                          id="category"
                          placeholder="e.g., Burgers & Wraps"
                          value={newItem.category}
                          onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                          className="bg-white/5 border-white/10 text-white focus:border-orange-500 h-14 rounded-xl px-4 text-lg"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description" className="text-gray-300">Description</Label>
                      <Textarea
                        id="description"
                        placeholder="Describe the textures, flavors, and key ingredients that make this dish special..."
                        value={newItem.description}
                        onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                        className="bg-white/5 border-white/10 text-white focus:border-orange-500 min-h-[120px] rounded-xl p-4 text-base resize-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="price" className="text-gray-300">Price (₹) *</Label>
                      <div className="relative group/price">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-lg group-focus-within/price:text-orange-500 transition-colors">₹</span>
                        <Input
                          id="price"
                          type="number"
                          placeholder="299"
                          value={newItem.price}
                          onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                          min="0"
                          step="0.01"
                          className="bg-white/5 border-white/10 text-white focus:border-orange-500 pl-10 h-14 rounded-xl text-xl font-bold font-mono tracking-wide"
                        />
                      </div>
                    </div>
                  </TabsContent>

                  {/* Details Tab */}
                  <TabsContent value="details" className="space-y-6 focus-visible:outline-none">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="prepTime" className="text-gray-300">Prep Time (min)</Label>
                        <div className="relative">
                          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                          <Input
                            id="prepTime"
                            type="number"
                            placeholder="30"
                            value={newItem.preparationTime}
                            onChange={(e) => setNewItem({ ...newItem, preparationTime: e.target.value })}
                            className="bg-white/5 border-white/10 text-white h-12 rounded-xl pl-10"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="servings" className="text-gray-300">Servings</Label>
                        <div className="relative">
                          <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                          <Input
                            id="servings"
                            type="number"
                            placeholder="1"
                            value={newItem.servings}
                            onChange={(e) => setNewItem({ ...newItem, servings: e.target.value })}
                            className="bg-white/5 border-white/10 text-white h-12 rounded-xl pl-10"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="calories" className="text-gray-300">Calories</Label>
                        <div className="relative">
                          <Flame className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                          <Input
                            id="calories"
                            type="number"
                            placeholder="450"
                            value={newItem.calories}
                            onChange={(e) => setNewItem({ ...newItem, calories: e.target.value })}
                            className="bg-white/5 border-white/10 text-white h-12 rounded-xl pl-10"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="allergens" className="text-gray-300">Allergens</Label>
                      <div className="relative">
                        <AlertCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <Input
                          id="allergens"
                          placeholder="e.g., Gluten, Dairy, Cashews (Comma separated)"
                          value={newItem.allergens}
                          onChange={(e) => setNewItem({ ...newItem, allergens: e.target.value })}
                          className="bg-white/5 border-white/10 text-white h-14 rounded-xl pl-12"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="tags" className="text-gray-300">Tags</Label>
                      <div className="relative">
                        <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <Input
                          id="tags"
                          placeholder="e.g., Chef's Special, Spicy, Weekend Only"
                          value={newItem.tags}
                          onChange={(e) => setNewItem({ ...newItem, tags: e.target.value })}
                          className="bg-white/5 border-white/10 text-white h-14 rounded-xl pl-12"
                        />
                      </div>
                    </div>
                  </TabsContent>

                  {/* Attributes Tab */}
                  <TabsContent value="attributes" className="space-y-6 focus-visible:outline-none">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { label: 'Vegetarian', desc: 'Contains no meat ingredients', checked: newItem.isVegetarian, key: 'isVegetarian', icon: '🥬', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
                        { label: 'Spicy', desc: 'Contains hot spices or peppers', checked: newItem.isSpicy, key: 'isSpicy', icon: '🌶️', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
                        { label: 'Available', desc: 'Currently in stock and ready to serve', checked: newItem.isAvailable, key: 'isAvailable', icon: '✅', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
                        { label: 'Best Seller', desc: 'Popular item among customers', checked: newItem.isBestSeller, key: 'isBestSeller', icon: '⭐', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
                        { label: 'New Item', desc: 'Recently added to the menu', checked: newItem.isNew, key: 'isNew', icon: '🆕', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
                      ].map((attr) => (
                        <label
                          key={attr.key}
                          className={`flex items-start gap-4 p-5 rounded-2xl border cursor-pointer transition-all duration-300 ${attr.checked ? `${attr.bg} ${attr.border}` : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'}`}
                        >
                          <Checkbox
                            checked={attr.checked}
                            onCheckedChange={(c) => setNewItem({ ...newItem, [attr.key]: !!c })}
                            className={`mt-1 h-5 w-5 data-[state=checked]:${attr.color.replace('text-', 'bg-').replace('-400', '-500')} border-white/30`}
                          />
                          <div>
                            <p className={`font-bold text-lg flex items-center gap-2 ${attr.checked ? attr.color : 'text-white'}`}>
                              {attr.icon} {attr.label}
                            </p>
                            <p className="text-sm text-gray-400 mt-1">{attr.desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              <div className="sticky bottom-0 z-20 bg-black/90 backdrop-blur-xl border-t border-white/10 p-6 flex justify-end gap-4">
                <DialogTrigger asChild>
                  <Button variant="outline" type="button" disabled={submitting} className="border-white/10 bg-transparent text-white hover:bg-white/10 h-12 px-6 rounded-xl font-bold">
                    Cancel
                  </Button>
                </DialogTrigger>
                <Button
                  onClick={handleAddItem}
                  disabled={submitting}
                  className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-bold h-12 px-8 rounded-xl shadow-lg hover:shadow-orange-500/20 transition-all"
                >
                  {submitting && <Spinner className="mr-2 h-5 w-5" />}
                  {submitting ? (editingId ? 'Updating...' : 'Publishing...') : (editingId ? 'Update Item' : 'Publish Item')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      {/* Info Banner */}
      <motion.div variants={itemVariants} className="p-5 rounded-2xl bg-blue-900/10 border border-blue-500/20 backdrop-blur-md flex items-center gap-4 shadow-lg">
        <div className="p-3 bg-blue-500/20 rounded-full shrink-0">
          <Clock className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h4 className="text-blue-200 font-bold text-sm">Review Process</h4>
          <p className="text-sm text-blue-300/80 mt-0.5">
            All newly added items require admin approval before they appear on the customer app.
          </p>
        </div>
      </motion.div>

      {/* Search & Filter */}
      <motion.div variants={itemVariants} className="sticky top-0 z-10 bg-[#050505]/80 backdrop-blur-xl py-4 flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <Input
            placeholder="Search your menu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-white/5 border-white/10 h-12 pl-12 rounded-full text-white focus:border-orange-500 focus:bg-white/10 transition-all font-medium"
          />
        </div>
      </motion.div>

      {/* Menu Items */}
      {categories.length === 0 ? (
        <Card className="py-32 text-center bg-[#0A0A0A] border-white/10 border-dashed rounded-3xl group hover:border-white/20 transition-colors">
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-gray-800 to-black rounded-full flex items-center justify-center mb-6 shadow-inner ring-1 ring-white/10 group-hover:scale-110 transition-transform duration-500">
            <Utensils className="w-10 h-10 text-gray-500 group-hover:text-white transition-colors" />
          </div>
          <h3 className="text-3xl font-black text-white mb-3">Your Menu is Empty</h3>
          <p className="text-gray-400 mb-8 max-w-sm mx-auto text-lg">Start building your restaurant's legacy by adding your first dish.</p>
          <Button onClick={() => setDialogOpen(true)} size="lg" className="bg-white text-black font-bold rounded-full px-10 h-14 text-lg shadow-xl hover:bg-gray-200 transition-all hover:scale-105 active:scale-95">
            <Plus className="w-6 h-6 mr-2" />
            Create First Item
          </Button>
        </Card>
      ) : (
        <div className="space-y-6">
          <AnimatePresence mode='popLayout'>
            {categories.map((category, idx) => {
              const categoryItems = filteredItems.filter((item) => item.category === category);
              const isExpanded = expandedCategory === category;

              return (
                <motion.div
                  key={category}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <div className={`overflow-hidden rounded-3xl transition-all duration-300 border ${isExpanded ? 'bg-[#0A0A0A] border-orange-500/20 shadow-2xl shadow-orange-900/10' : 'bg-white/5 border-white/5 hover:border-white/10'}`}>
                    <button
                      onClick={() => setExpandedCategory(isExpanded ? null : category)}
                      className="w-full p-6 md:p-8 flex items-center justify-between bg-gradient-to-r from-transparent via-transparent to-white/[0.02] hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-5">
                        <div className={`w-1.5 h-10 rounded-full transition-colors ${isExpanded ? 'bg-orange-500' : 'bg-gray-700'}`} />
                        <div className="text-left">
                          <h3 className="font-black text-white text-2xl md:text-3xl tracking-tight">{category}</h3>
                          <p className="text-gray-500 text-sm font-medium mt-1 uppercase tracking-wider">{categoryItems.length} ITEMS</p>
                        </div>
                      </div>
                      <div className={`w-12 h-12 rounded-full border border-white/10 flex items-center justify-center bg-black/40 transition-transform duration-300 ${isExpanded ? 'rotate-180 bg-orange-500/10 text-orange-400 border-orange-500/30' : 'text-gray-400'}`}>
                        <ChevronDown className="w-6 h-6" />
                      </div>
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="border-t border-white/5"
                        >
                          <div className="p-4 md:p-6 grid gap-4">
                            {categoryItems.map((item, index) => (
                              <motion.div
                                key={item.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="group relative flex flex-col md:flex-row p-4 md:p-5 bg-black/40 rounded-2xl border border-white/5 hover:border-orange-500/30 transition-all duration-300 hover:shadow-2xl hover:shadow-black/60 hover:bg-white/[0.03]"
                              >
                                <div className="relative w-full md:w-56 h-48 md:h-40 rounded-xl overflow-hidden shrink-0 shadow-lg ring-1 ring-white/10">
                                  {item.image ? (
                                    <img
                                      src={item.image}
                                      alt={item.name}
                                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                    />
                                  ) : (
                                    <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                                      <ImageIcon className="w-10 h-10 text-gray-700" />
                                    </div>
                                  )}
                                  {/* Status Badge Overlay */}
                                  <div className="absolute top-3 left-3 flex flex-col gap-2">
                                    {getStatusBadge(item)}
                                  </div>
                                </div>

                                <div className="flex-1 min-w-0 flex flex-col justify-between pt-4 md:pt-0 md:pl-6">
                                  <div>
                                    <div className="flex items-start justify-between gap-4 mb-2">
                                      <div className="flex-1">
                                        <div className="flex flex-wrap items-center gap-2 mb-2">
                                          <h4 className="font-bold text-white text-xl md:text-2xl truncate group-hover:text-orange-400 transition-colors">{item.name}</h4>
                                          {item.isBestSeller && <Badge className="bg-amber-500 text-black font-extrabold text-[10px] px-2 py-0.5 border-0 shadow-lg">BESTSELLER</Badge>}
                                          {item.isNew && <Badge className="bg-blue-600 text-white font-extrabold text-[10px] px-2 py-0.5 border-0 shadow-lg">NEW</Badge>}
                                        </div>
                                        <p className="text-gray-400 text-sm md:text-base line-clamp-2 leading-relaxed max-w-2xl">{item.description || 'No description provided.'}</p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-2xl font-black text-white tracking-tight">₹{item.price}</p>
                                        <p className="text-xs text-gray-500 font-medium">per item</p>
                                      </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2 text-xs font-semibold mt-4">
                                      {item.vegetarian && <Badge variant="outline" className="border-green-500/30 text-green-400 bg-green-500/5 px-2 py-1">VEG</Badge>}
                                      {item.spicy && <Badge variant="outline" className="border-red-500/30 text-red-400 bg-red-500/5 px-2 py-1">SPICY</Badge>}
                                      <span className="flex items-center gap-1.5 bg-white/5 px-3 py-1 rounded-lg text-gray-300 border border-white/5"><Clock className="w-3.5 h-3.5" /> {item.preparationTime}m</span>
                                      <span className="flex items-center gap-1.5 bg-white/5 px-3 py-1 rounded-lg text-gray-300 border border-white/5"><Users className="w-3.5 h-3.5" /> Serves {item.servings}</span>
                                    </div>
                                  </div>

                                  <div className="flex justify-end gap-3 mt-4 md:mt-0 pt-4 border-t border-white/5 md:border-0 md:pt-0">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteItem(item.id || '')}
                                      className="text-red-400 hover:text-white hover:bg-red-600 rounded-lg px-4 transition-colors"
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" /> Delete
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleEditItem(item)}
                                      className="border-white/10 bg-white/5 text-white hover:bg-white hover:text-black rounded-lg px-4 transition-all"
                                    >
                                      Edit Details
                                    </Button>
                                  </div>
                                </div>
                                {item.approvalStatus === 'rejected' && item.rejectionReason && (
                                  <div className="absolute inset-x-0 -bottom-3 mx-6 bg-red-900/90 text-white text-xs font-bold p-2.5 rounded-b-xl backdrop-blur-md border border-red-500/30 flex items-center justify-center gap-2 shadow-lg z-10">
                                    <AlertCircle className="w-4 h-4" /> REJECTED: {item.rejectionReason}
                                  </div>
                                )}
                              </motion.div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Success Dialog */}
      <Dialog open={successDialog} onOpenChange={setSuccessDialog}>
        <DialogContent className="max-w-md bg-black border-white/10 text-white text-center p-10 shadow-2xl rounded-3xl">
          <div className="w-24 h-24 bg-gradient-to-br from-green-500/20 to-emerald-600/20 rounded-full flex items-center justify-center mx-auto mb-8 ring-4 ring-green-500/10 shadow-[0_0_40px_-10px_rgba(16,185,129,0.5)]">
            <CheckCircle className="w-12 h-12 text-green-400" />
          </div>
          <h3 className="text-3xl font-black text-white mb-3">Item Submitted!</h3>
          <p className="text-gray-400 text-base mb-8 leading-relaxed">
            Your culinary creation has been successfully sent for approval. It will appear on your menu once verified by our team.
          </p>
          <Button onClick={() => setSuccessDialog(false)} className="w-full bg-white text-black hover:bg-gray-200 font-bold rounded-xl h-14 text-lg shadow-lg">
            Awesome, Continue
          </Button>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
