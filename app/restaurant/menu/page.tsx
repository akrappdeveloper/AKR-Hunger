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
  Clock, CheckCircle, XCircle, X, Star, Flame, Tag, Users
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

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
      return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> Live</Badge>;
    }
    if (item.approvalStatus === 'pending') {
      return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Pending Approval</Badge>;
    }
    if (item.approvalStatus === 'rejected') {
      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Rejected</Badge>;
    }
    return null;
  };

  const categories = Array.from(new Set(menuItems.map((item) => item.category)));

  if (authLoading || loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-orange-400 via-red-400 to-orange-300 bg-clip-text text-transparent">Menu Management</h1>
          <p className="text-gray-200 mt-2 text-lg font-medium">Add and manage your restaurant menu items</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600">
              <Plus className="w-5 h-5" />
              Add New Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">Add New Menu Item</DialogTitle>
              <DialogDescription>
                Fill in the details below. Your item will be submitted for admin approval before going live.
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="attributes">Attributes</TabsTrigger>
              </TabsList>

              {/* Basic Info Tab */}
              <TabsContent value="basic" className="space-y-4 mt-4">
                {/* Images Upload */}
                <div className="space-y-2">
                  <Label>Item Images * (Up to 5)</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-4">
                    {imagePreviews.length > 0 ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                          {imagePreviews.map((preview, index) => (
                            <div key={index} className="relative group">
                              <img
                                src={preview}
                                alt={`Preview ${index + 1}`}
                                className="w-full h-32 object-cover rounded-lg"
                              />
                              <button
                                type="button"
                                onClick={() => removeImage(index)}
                                className="absolute top-1 right-1 p-1 bg-destructive text-white rounded-full opacity-0 group-hover:opacity-100 transition"
                              >
                                <X className="w-4 h-4" />
                              </button>
                              {index === 0 && (
                                <Badge className="absolute bottom-1 left-1 text-xs">Primary</Badge>
                              )}
                            </div>
                          ))}
                        </div>
                        {imageFiles.length < 5 && (
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={() => document.getElementById('image-upload')?.click()}
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add More Images ({5 - imageFiles.length} remaining)
                          </Button>
                        )}
                      </div>
                    ) : (
                      <label htmlFor="image-upload" className="cursor-pointer flex flex-col items-center gap-2 py-8">
                        <ImageIcon className="w-12 h-12 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Click to upload images</p>
                        <p className="text-xs text-muted-foreground">PNG, JPG up to 5MB each (max 5 images)</p>
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
                  <p className="text-xs text-muted-foreground">First image will be the primary display image</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Item Name *</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Margherita Pizza"
                      value={newItem.name}
                      onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Category *</Label>
                    <Input
                      id="category"
                      placeholder="e.g., Pizzas, Starters, Desserts"
                      value={newItem.category}
                      onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe your dish..."
                    value={newItem.description}
                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price">Price (₹) *</Label>
                  <Input
                    id="price"
                    type="number"
                    placeholder="299"
                    value={newItem.price}
                    onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                    min="0"
                    step="0.01"
                  />
                </div>
              </TabsContent>

              {/* Details Tab */}
              <TabsContent value="details" className="space-y-4 mt-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="prepTime">Prep Time (min)</Label>
                    <Input
                      id="prepTime"
                      type="number"
                      placeholder="30"
                      value={newItem.preparationTime}
                      onChange={(e) => setNewItem({ ...newItem, preparationTime: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="servings">Servings</Label>
                    <Input
                      id="servings"
                      type="number"
                      placeholder="1"
                      value={newItem.servings}
                      onChange={(e) => setNewItem({ ...newItem, servings: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="calories">Calories (kcal)</Label>
                    <Input
                      id="calories"
                      type="number"
                      placeholder="450"
                      value={newItem.calories}
                      onChange={(e) => setNewItem({ ...newItem, calories: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="allergens">Allergens (comma separated)</Label>
                  <Input
                    id="allergens"
                    placeholder="e.g., Gluten, Dairy, Nuts"
                    value={newItem.allergens}
                    onChange={(e) => setNewItem({ ...newItem, allergens: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Separate multiple allergens with commas</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tags">Tags (comma separated)</Label>
                  <Input
                    id="tags"
                    placeholder="e.g., Popular, Chef's Special, Healthy"
                    value={newItem.tags}
                    onChange={(e) => setNewItem({ ...newItem, tags: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Add descriptive tags for better search</p>
                </div>
              </TabsContent>

              {/* Attributes Tab */}
              <TabsContent value="attributes" className="space-y-4 mt-4">
                <div className="space-y-3">
                  <Label>Item Attributes</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-secondary">
                      <input
                        type="checkbox"
                        checked={newItem.isVegetarian}
                        onChange={(e) => setNewItem({ ...newItem, isVegetarian: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <div className="flex-1">
                        <p className="font-medium">🥬 Vegetarian</p>
                        <p className="text-xs text-muted-foreground">No meat or fish</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-secondary">
                      <input
                        type="checkbox"
                        checked={newItem.isSpicy}
                        onChange={(e) => setNewItem({ ...newItem, isSpicy: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <div className="flex-1">
                        <p className="font-medium">🌶️ Spicy</p>
                        <p className="text-xs text-muted-foreground">Has heat level</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-secondary">
                      <input
                        type="checkbox"
                        checked={newItem.isAvailable}
                        onChange={(e) => setNewItem({ ...newItem, isAvailable: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <div className="flex-1">
                        <p className="font-medium">✅ Available</p>
                        <p className="text-xs text-muted-foreground">Currently in stock</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-secondary">
                      <input
                        type="checkbox"
                        checked={newItem.isBestSeller}
                        onChange={(e) => setNewItem({ ...newItem, isBestSeller: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <div className="flex-1">
                        <p className="font-medium">⭐ Best Seller</p>
                        <p className="text-xs text-muted-foreground">Popular item</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-secondary">
                      <input
                        type="checkbox"
                        checked={newItem.isNew}
                        onChange={(e) => setNewItem({ ...newItem, isNew: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <div className="flex-1">
                        <p className="font-medium">🆕 New Item</p>
                        <p className="text-xs text-muted-foreground">Recently added</p>
                      </div>
                    </label>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={handleAddItem} disabled={submitting} className="bg-gradient-to-r from-orange-500 to-red-500">
                {submitting && <Spinner className="mr-2 h-4 w-4" />}
                {submitting ? 'Submitting...' : 'Submit for Approval'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Info Banner */}
      <Card className="p-5 bg-gradient-to-r from-blue-900/30 to-blue-800/30 border-blue-500/30 backdrop-blur-sm shadow-lg">
        <p className="text-sm text-blue-200 font-medium">
          ℹ️ <strong className="text-white">Note:</strong> All new items require admin approval before they appear on your public menu.
          Items marked as "Live" are visible to customers.
        </p>
      </Card>

      {/* Menu Items */}
      {categories.length === 0 ? (
        <Card className="p-12 text-center bg-gray-900/50 border-gray-800 backdrop-blur-sm">
          <ImageIcon className="w-16 h-16 mx-auto text-gray-500 mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">No menu items yet</h3>
          <p className="text-gray-300 mb-4 font-medium">Get started by adding your first menu item!</p>
          <Button onClick={() => setDialogOpen(true)} className="bg-gradient-to-r from-orange-500 to-red-500 shadow-lg font-bold">
            <Plus className="w-4 h-4 mr-2" />
            Add First Item
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {categories.map((category) => {
            const categoryItems = menuItems.filter((item) => item.category === category);
            const isExpanded = expandedCategory === category;

            return (
              <Card key={category} className="overflow-hidden bg-gray-900/50 border-gray-800 backdrop-blur-sm shadow-xl">
                <button
                  onClick={() => setExpandedCategory(isExpanded ? null : category)}
                  className="w-full p-5 flex items-center justify-between bg-gradient-to-r from-gray-800 via-gray-900 to-gray-800 hover:from-gray-750 hover:via-gray-850 hover:to-gray-750 transition border-b border-gray-700"
                >
                  <h3 className="font-bold text-white text-xl">{category}</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-300 font-semibold bg-gray-700/50 px-3 py-1 rounded-full">{categoryItems.length} items</span>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-white" /> : <ChevronDown className="w-5 h-5 text-white" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="p-4 space-y-3 bg-gray-900/30">
                    {categoryItems.map((item) => (
                      <div key={item.id} className="flex gap-4 p-5 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-gray-600 hover:bg-gray-800/70 transition shadow-lg">
                        {item.image && (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-24 h-24 object-cover rounded-lg"
                          />
                        )}

                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-bold text-white text-lg">{item.name}</h4>
                                {item.vegetarian && (
                                  <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-100 rounded">
                                    Veg
                                  </span>
                                )}
                                {item.spicy && (
                                  <span className="px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-100 rounded">
                                    Spicy
                                  </span>
                                )}
                              </div>
                              {getStatusBadge(item)}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-green-400 text-2xl">₹{item.price}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteItem(item.id || '')}
                                className="hover:bg-red-500/20"
                              >
                                <Trash2 className="w-4 h-4 text-red-400" />
                              </Button>
                            </div>
                          </div>
                          {item.description && (
                            <p className="text-sm text-gray-300 mb-2 font-medium">{item.description}</p>
                          )}
                          {item.approvalStatus === 'rejected' && item.rejectionReason && (
                            <p className="text-sm text-red-400 mt-2 bg-red-500/10 p-2 rounded border border-red-500/30">
                              <strong className="text-red-300">Rejection Reason:</strong> {item.rejectionReason}
                            </p>
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
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center text-center py-6">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            <DialogTitle className="text-2xl font-bold mb-2">Item Submitted Successfully!</DialogTitle>
            <DialogDescription className="text-base">
              Your menu item has been submitted for admin approval. It will appear on your menu once approved.
            </DialogDescription>
            <Button
              onClick={() => setSuccessDialog(false)}
              className="mt-6 bg-gradient-to-r from-green-500 to-blue-500"
            >
              Got it!
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
