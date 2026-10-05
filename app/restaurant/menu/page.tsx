'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRestaurantAuth } from '@/context/RestaurantAuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  setDoc,
  getDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { MenuItem } from '@/lib/types';
import { toast } from 'sonner';
import {
  Plus, Trash2, ChevronDown, ChevronUp, Upload, Image as ImageIcon,
  Clock, CheckCircle, XCircle, X, Star, Flame, Tag, Users, AlertCircle, Utensils,
  Search, Filter, ArrowUpRight, ShoppingBag, Store, Sparkles, Check, Edit2,
  DollarSign, PackageCheck, Layers, Coffee, Percent, Info
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Checkbox } from '@/components/ui/checkbox';
import { motion, AnimatePresence } from 'framer-motion';

// Curated platform food categories with emojis and color schemes
const POPULAR_CATEGORIES = [
  { name: 'Pizza', icon: '🍕', color: 'from-orange-500/20 to-red-500/20 border-orange-500/30 text-orange-600 dark:text-orange-400' },
  { name: 'Burgers & Wraps', icon: '🍔', color: 'from-amber-500/20 to-yellow-500/20 border-amber-500/30 text-amber-600 dark:text-amber-400' },
  { name: 'Biryani & Rice', icon: '🍲', color: 'from-red-500/20 to-rose-500/20 border-red-500/30 text-red-600 dark:text-red-400' },
  { name: 'Chinese & Asian', icon: '🍜', color: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30 text-blue-600 dark:text-blue-400' },
  { name: 'North Indian', icon: '🍛', color: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' },
  { name: 'South Indian & Dosa', icon: '🥞', color: 'from-yellow-500/20 to-amber-500/20 border-yellow-500/30 text-yellow-600 dark:text-yellow-400' },
  { name: 'Rolls & Shawarma', icon: '🌯', color: 'from-orange-500/20 to-amber-500/20 border-orange-500/30 text-orange-600 dark:text-orange-400' },
  { name: 'Tandoor & Kebabs', icon: '🍢', color: 'from-red-600/20 to-orange-600/20 border-red-600/30 text-red-600 dark:text-red-400' },
  { name: 'Italian & Pasta', icon: '🍝', color: 'from-rose-500/20 to-pink-500/20 border-rose-500/30 text-rose-600 dark:text-rose-400' },
  { name: 'Salads & Healthy', icon: '🥗', color: 'from-green-500/20 to-emerald-500/20 border-green-500/30 text-green-600 dark:text-green-400' },
  { name: 'Desserts & Sweets', icon: '🍰', color: 'from-pink-500/20 to-purple-500/20 border-pink-500/30 text-pink-600 dark:text-pink-400' },
  { name: 'Beverages & Shakes', icon: '🧋', color: 'from-purple-500/20 to-indigo-500/20 border-purple-500/30 text-purple-600 dark:text-purple-400' },
  { name: 'Momos & Dimsums', icon: '🥟', color: 'from-cyan-500/20 to-sky-500/20 border-cyan-500/30 text-cyan-600 dark:text-cyan-400' },
  { name: 'Combos & Thalis', icon: '🍱', color: 'from-amber-600/20 to-orange-600/20 border-amber-600/30 text-amber-600 dark:text-amber-400' },
  { name: 'Bakery & Quick Bites', icon: '🥐', color: 'from-yellow-600/20 to-orange-500/20 border-yellow-600/30 text-yellow-600 dark:text-yellow-400' },
  { name: 'Sandwiches & Snacks', icon: '🥪', color: 'from-lime-500/20 to-green-500/20 border-lime-500/30 text-lime-600 dark:text-lime-400' },
  { name: 'Chai & Coffee', icon: '☕', color: 'from-amber-700/20 to-amber-900/20 border-amber-700/30 text-amber-700 dark:text-amber-300' },
  { name: 'Fast Food', icon: '🍟', color: 'from-red-500/20 to-yellow-500/20 border-red-500/30 text-red-600 dark:text-red-400' },
];

export default function MenuManagementPage() {
  const router = useRouter();
  const { user, restaurant, loading: authLoading } = useRestaurantAuth();

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [successDialog, setSuccessDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  // Images state
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Dialogs
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [customCategoryInput, setCustomCategoryInput] = useState('');

  const [pickupDialogOpen, setPickupDialogOpen] = useState(false);
  const [savingPickupSettings, setSavingPickupSettings] = useState(false);
  const [pickupSettings, setPickupSettings] = useState({
    isPickupEnabled: true,
    defaultPickupTime: 20,
    pickupCounter: 'Express Takeaway Counter',
    pickupInstructions: 'Show digital Order OTP at the pickup counter for instant handover.',
    packagingFee: 0,
    applyToAllItems: true,
  });

  // Add-on creator temporary fields inside menu item modal
  const [newAddOnName, setNewAddOnName] = useState('');
  const [newAddOnPrice, setNewAddOnPrice] = useState('');
  const [newSizeName, setNewSizeName] = useState('');
  const [newSizePrice, setNewSizePrice] = useState('');

  // Menu item form state
  const [newItem, setNewItem] = useState({
    name: '',
    description: '',
    price: '',
    originalPrice: '',
    category: '',
    preparationTime: '30',
    servings: '1',
    calories: '',
    allergens: '',
    tags: '',
    foodType: 'veg', // 'veg' | 'non-veg' | 'egg' | 'vegan'
    isVegetarian: true,
    isSpicy: false,
    spiceLevel: 'medium', // 'none' | 'mild' | 'medium' | 'hot'
    isAvailable: true,
    isBestSeller: false,
    isNew: false,
    isChefSpecial: false,
    isPickupAvailable: true,
    pickupPrepTime: '20',
    packagingFee: '0',
    addOns: [] as { name: string; price: number }[],
    sizes: [] as { name: string; price: number }[],
    // ── NEW NUTRITION & DETAILS FIELDS ──────────────────────────
    protein: '',         // grams
    carbs: '',           // grams
    fat: '',             // grams
    ingredients: '',     // comma-separated list
    portionSize: '',     // e.g. '250g', '1 plate'
    isGlutenFree: false,
    isJain: false,
    isHalal: false,
  });

  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/restaurant/login');
      return;
    }
    fetchMenuItems();
    loadRestaurantPickupSettings();
  }, [user, authLoading, router]);

  // Load restaurant's pickup settings from Firestore
  const loadRestaurantPickupSettings = async () => {
    if (!user) return;
    try {
      const restId = restaurant?.id || user.restaurantId || user.uid;
      const snap = await getDoc(doc(db, 'restaurants', restId));
      if (snap.exists()) {
        const data = snap.data();
        if (data.pickupSettings) {
          setPickupSettings({
            isPickupEnabled: data.pickupSettings.isPickupEnabled !== false,
            defaultPickupTime: data.pickupSettings.defaultPickupTime || 20,
            pickupCounter: data.pickupSettings.pickupCounter || 'Express Takeaway Counter',
            pickupInstructions: data.pickupSettings.pickupInstructions || 'Show digital Order OTP at the counter.',
            packagingFee: data.pickupSettings.packagingFee || 0,
            applyToAllItems: false,
          });
        }
      }
    } catch (e) {
      console.warn('[Menu] Could not load pickup settings:', e);
    }
  };

  const fetchMenuItems = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const menuRef = collection(db, 'menuItems');
      const targetIds = Array.from(new Set([user.uid, user.restaurantId, restaurant?.id].filter(Boolean))) as string[];

      const itemsMap = new Map<string, MenuItem>();
      for (const targetId of targetIds) {
        const q = query(menuRef, where('restaurantId', '==', targetId));
        const snapshot = await getDocs(q);
        snapshot.docs.forEach((d) => {
          itemsMap.set(d.id, {
            ...d.data(),
            id: d.id,
          } as MenuItem);
        });
      }

      // Also fetch items where ownerId == user.uid
      const qOwner = query(menuRef, where('ownerId', '==', user.uid));
      const ownerSnap = await getDocs(qOwner);
      ownerSnap.docs.forEach((d) => {
        itemsMap.set(d.id, {
          ...d.data(),
          id: d.id,
        } as MenuItem);
      });

      const items = Array.from(itemsMap.values());
      setMenuItems(items);

      if (items.length > 0 && !expandedCategory) {
        setExpandedCategory(items[0].category);
      }
    } catch (error) {
      console.error('[Menu] Error fetching menu items:', error);
      toast.error('Failed to load menu items');
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Limit to 5 images total
    const remainingSlots = 5 - imagePreviews.length;
    if (remainingSlots <= 0) {
      toast.warning('Maximum 5 images allowed per menu item');
      return;
    }

    const newFiles = files.slice(0, remainingSlots);
    setImageFiles(prev => [...prev, ...newFiles]);

    // Create fast instant preview
    newFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setImagePreviews(prev => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleAddImageUrl = () => {
    const trimmed = imageUrlInput.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      toast.error('Please enter a valid image URL starting with http:// or https://');
      return;
    }
    if (imagePreviews.length >= 5) {
      toast.warning('Maximum 5 images allowed per menu item');
      return;
    }
    setImagePreviews(prev => [...prev, trimmed]);
    setImageUrlInput('');
    toast.success('Image URL added');
  };

  const removeImage = (index: number) => {
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
    setImageFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Upload all local files directly to Cloudinary
  const uploadAllImagesToCloudinary = async (files: File[]): Promise<string[]> => {
    if (files.length === 0) return [];

    const uploadedUrls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadStatus(`Uploading image ${i + 1} of ${files.length} to Cloudinary...`);
      try {
        const cdnUrl = await uploadToCloudinary(file);
        if (cdnUrl && cdnUrl.startsWith('http')) {
          uploadedUrls.push(cdnUrl);
        } else {
          throw new Error('Invalid Cloudinary response URL');
        }
      } catch (err: any) {
        console.error(`[Menu] Cloudinary upload error for image ${i + 1}:`, err);
        throw new Error(`Failed to upload image "${file.name}" to Cloudinary: ${err?.message || 'Network error'}`);
      }
    }
    return uploadedUrls;
  };

  const handleEditItem = (item: MenuItem) => {
    setEditingId(item.id!);
    const rawAny = item as any;
    setNewItem({
      name: item.name || '',
      description: item.description || '',
      price: item.price !== undefined ? item.price.toString() : '',
      originalPrice: rawAny.originalPrice !== undefined ? rawAny.originalPrice.toString() : '',
      category: item.category || '',
      preparationTime: (item.preparationTime || 30).toString(),
      servings: (item.servings || 1).toString(),
      calories: item.calories ? item.calories.toString() : '',
      allergens: item.allergens ? item.allergens.join(', ') : '',
      tags: item.tags ? item.tags.join(', ') : '',
      foodType: rawAny.foodType || (item.vegetarian ? 'veg' : 'non-veg'),
      isVegetarian: Boolean(item.vegetarian),
      isSpicy: Boolean(item.spicy),
      spiceLevel: rawAny.spiceLevel || (item.spicy ? 'medium' : 'none'),
      isAvailable: item.available !== undefined ? item.available : true,
      isBestSeller: Boolean(item.isBestSeller),
      isNew: Boolean(item.isNew),
      isChefSpecial: Boolean(rawAny.isChefSpecial),
      isPickupAvailable: rawAny.isPickupAvailable !== false,
      pickupPrepTime: (rawAny.pickupPrepTime || 20).toString(),
      packagingFee: (rawAny.packagingFee || 0).toString(),
      addOns: rawAny.addOns || rawAny.addons || [],
      sizes: rawAny.sizes || [],
      // Nutrition & Details
      protein: rawAny.nutrition?.protein ? rawAny.nutrition.protein.toString() : '',
      carbs: rawAny.nutrition?.carbs ? rawAny.nutrition.carbs.toString() : '',
      fat: rawAny.nutrition?.fat ? rawAny.nutrition.fat.toString() : '',
      ingredients: Array.isArray(rawAny.ingredients) ? rawAny.ingredients.join(', ') : (rawAny.ingredients || ''),
      portionSize: rawAny.portionSize || rawAny.servingSize || '',
      isGlutenFree: Boolean(rawAny.isGlutenFree),
      isJain: Boolean(rawAny.isJain),
      isHalal: Boolean(rawAny.isHalal),
    });
    setImagePreviews(item.images && item.images.length > 0 ? item.images : item.image ? [item.image] : []);
    setImageFiles([]);
    setImageUrlInput('');
    setDialogOpen(true);
  };

  const handleAddItem = async () => {
    if (!user) {
      toast.error('You must be logged in to add menu items');
      return;
    }

    if (!newItem.name.trim() || !newItem.price.trim() || !newItem.category.trim()) {
      toast.error('Please fill in all required fields (Name, Category, Price)');
      return;
    }

    if (imagePreviews.length === 0 && imageFiles.length === 0) {
      toast.error('Please provide at least one item image');
      return;
    }

    const parsedPrice = parseFloat(newItem.price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      toast.error('Please enter a valid price');
      return;
    }

    const parsedOriginalPrice = newItem.originalPrice ? parseFloat(newItem.originalPrice) : null;
    if (parsedOriginalPrice !== null && (isNaN(parsedOriginalPrice) || parsedOriginalPrice < 0)) {
      toast.error('Please enter a valid original price or leave blank');
      return;
    }

    try {
      setSubmitting(true);

      // 1. Upload any newly selected local files to Cloudinary
      let newlyUploadedCloudinaryUrls: string[] = [];
      if (imageFiles.length > 0) {
        newlyUploadedCloudinaryUrls = await uploadAllImagesToCloudinary(imageFiles);
      }

      // 2. Existing remote URLs (excluding local data: previews)
      const existingRemoteUrls = imagePreviews.filter(url =>
        (url.startsWith('http://') || url.startsWith('https://')) &&
        !url.startsWith('data:image/')
      );

      const finalImageUrls = Array.from(new Set([...newlyUploadedCloudinaryUrls, ...existingRemoteUrls]));

      // Fallback: If no remote URLs exist (e.g. user only had base64 without files), use first preview
      if (finalImageUrls.length === 0 && imagePreviews.length > 0) {
        finalImageUrls.push(imagePreviews[0]);
      }

      if (finalImageUrls.length === 0) {
        toast.error('Please select an image file to upload to Cloudinary');
        return;
      }

      setUploadStatus('Saving menu item to Firestore...');

      // 3. Parse tags and allergens
      const tagArray = newItem.tags ? newItem.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
      const allergenArray = newItem.allergens ? newItem.allergens.split(',').map(a => a.trim()).filter(Boolean) : [];

      const resolvedRestaurantId = restaurant?.id || user.restaurantId || user.uid;

      // 4. Construct payload with strict sanitization
      const cleanItemData: Record<string, any> = {
        name: newItem.name.trim(),
        description: newItem.description?.trim() || '',
        price: parsedPrice,
        category: newItem.category.trim(),
        foodType: newItem.foodType,
        vegetarian: newItem.foodType === 'veg' || newItem.foodType === 'vegan' || Boolean(newItem.isVegetarian),
        spicy: newItem.spiceLevel !== 'none' || Boolean(newItem.isSpicy),
        spiceLevel: newItem.spiceLevel,
        available: newItem.isAvailable !== undefined ? Boolean(newItem.isAvailable) : true,
        image: finalImageUrls[0] || '',
        images: finalImageUrls,
        preparationTime: parseInt(newItem.preparationTime) || 30,
        servings: parseInt(newItem.servings) || 1,
        allergens: allergenArray,
        tags: tagArray,
        isBestSeller: Boolean(newItem.isBestSeller),
        isNew: Boolean(newItem.isNew),
        isChefSpecial: Boolean(newItem.isChefSpecial),
        isPickupAvailable: Boolean(newItem.isPickupAvailable),
        pickupPrepTime: parseInt(newItem.pickupPrepTime) || 20,
        packagingFee: parseFloat(newItem.packagingFee) || 0,
        addOns: newItem.addOns || [],
        addons: newItem.addOns || [],
        sizes: newItem.sizes || [],
        restaurantId: resolvedRestaurantId,
        ownerId: user.uid,
        restaurantName: restaurant?.name || 'Restaurant',
        approvalStatus: 'approved', // Auto-approved so restaurant and customer immediately see it!
        isLive: true,               // Live on customer app immediately
        updatedAt: new Date(),
        // ── Nutrition & Details ──────────────────────────────────
        nutrition: {
          protein: parseFloat(newItem.protein) || null,
          carbs: parseFloat(newItem.carbs) || null,
          fat: parseFloat(newItem.fat) || null,
        },
        ingredients: newItem.ingredients ? newItem.ingredients.split(',').map((i: string) => i.trim()).filter(Boolean) : [],
        portionSize: newItem.portionSize?.trim() || null,
        isGlutenFree: Boolean(newItem.isGlutenFree),
        isJain: Boolean(newItem.isJain),
        isHalal: Boolean(newItem.isHalal),
      };

      if (parsedOriginalPrice !== null && parsedOriginalPrice > parsedPrice) {
        cleanItemData.originalPrice = parsedOriginalPrice;
      }

      if (newItem.calories && newItem.calories.trim() !== '') {
        const cal = parseInt(newItem.calories.trim());
        if (!isNaN(cal)) {
          cleanItemData.calories = cal;
        }
      }

      let savedId = editingId;

      if (editingId) {
        // Update in root collection
        await updateDoc(doc(db, 'menuItems', editingId), cleanItemData);

        // Also update subcollection if exists
        try {
          await setDoc(doc(db, 'restaurants', resolvedRestaurantId, 'menuItems', editingId), cleanItemData, { merge: true });
        } catch (subErr) {
          console.warn('[Menu] Subcollection sync note:', subErr);
        }

        toast.success(`"${cleanItemData.name}" updated successfully!`);

        // Optimistically update local state
        setMenuItems(prev => prev.map(item => item.id === editingId ? { ...item, ...cleanItemData, id: editingId } : item));
      } else {
        // Create in root collection
        const docRef = await addDoc(collection(db, 'menuItems'), {
          ...cleanItemData,
          createdAt: new Date(),
          submittedAt: new Date(),
        });
        savedId = docRef.id;

        // Also sync to subcollection
        try {
          await setDoc(doc(db, 'restaurants', resolvedRestaurantId, 'menuItems', docRef.id), {
            ...cleanItemData,
            createdAt: new Date(),
          });
        } catch (subErr) {
          console.warn('[Menu] Subcollection sync note:', subErr);
        }

        toast.success(`"${cleanItemData.name}" added to menu and is now live!`);

        // Optimistically prepend to local state
        setMenuItems(prev => [{ ...cleanItemData, id: docRef.id, createdAt: new Date() } as MenuItem, ...prev]);
      }

      // Reset form
      setNewItem({
        name: '',
        description: '',
        price: '',
        originalPrice: '',
        category: '',
        preparationTime: '30',
        servings: '1',
        calories: '',
        allergens: '',
        tags: '',
        foodType: 'veg',
        isVegetarian: true,
        isSpicy: false,
        spiceLevel: 'medium',
        isAvailable: true,
        isBestSeller: false,
        isNew: false,
        isChefSpecial: false,
        isPickupAvailable: true,
        pickupPrepTime: '20',
        packagingFee: '0',
        addOns: [],
        sizes: [],
        protein: '',
        carbs: '',
        fat: '',
        ingredients: '',
        portionSize: '',
        isGlutenFree: false,
        isJain: false,
        isHalal: false,
      });
      setImageFiles([]);
      setImagePreviews([]);
      setImageUrlInput('');
      setEditingId(null);
      setDialogOpen(false);

      // Re-fetch in background to ensure total sync
      fetchMenuItems();
      setSuccessDialog(true);
    } catch (error: any) {
      console.error('[Menu] Error saving item:', error);
      const errMsg = error?.message || 'Failed to save item. Please check network and Cloudinary setup.';
      toast.error(`Save failed: ${errMsg}`);
    } finally {
      setSubmitting(false);
      setUploadStatus(null);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      const resolvedRestaurantId = restaurant?.id || user?.restaurantId || user?.uid || '';
      await deleteDoc(doc(db, 'menuItems', itemId));
      if (resolvedRestaurantId) {
        try {
          await deleteDoc(doc(db, 'restaurants', resolvedRestaurantId, 'menuItems', itemId));
        } catch (_) { }
      }
      setMenuItems(menuItems.filter((item) => item.id !== itemId));
      toast.success('Menu item deleted');
    } catch (error) {
      console.error('[Menu] Error deleting item:', error);
      toast.error('Failed to delete item');
    }
  };

  const handleToggleItemAvailability = async (item: MenuItem) => {
    const newStatus = !(item.available !== false);
    try {
      await updateDoc(doc(db, 'menuItems', item.id), {
        available: newStatus,
        updatedAt: new Date(),
      });
      setMenuItems(prev => prev.map(m => m.id === item.id ? { ...m, available: newStatus } : m));
      toast.success(`${item.name} is now ${newStatus ? 'In Stock (Available)' : 'Out of Stock'}`);
    } catch (e) {
      toast.error('Could not update availability');
    }
  };

  // Save pickup settings to Firestore
  const handleSavePickupSettings = async () => {
    if (!user) return;
    try {
      setSavingPickupSettings(true);
      const restId = restaurant?.id || user.restaurantId || user.uid;

      await updateDoc(doc(db, 'restaurants', restId), {
        isPickupAvailable: pickupSettings.isPickupEnabled,
        pickupSettings: {
          isPickupEnabled: pickupSettings.isPickupEnabled,
          defaultPickupTime: pickupSettings.defaultPickupTime,
          pickupCounter: pickupSettings.pickupCounter,
          pickupInstructions: pickupSettings.pickupInstructions,
          packagingFee: pickupSettings.packagingFee,
          updatedAt: new Date(),
        },
      });

      // Optionally batch update all menu items
      if (pickupSettings.applyToAllItems && menuItems.length > 0) {
        const updatePromises = menuItems.map(item =>
          updateDoc(doc(db, 'menuItems', item.id), {
            isPickupAvailable: pickupSettings.isPickupEnabled,
            pickupPrepTime: pickupSettings.defaultPickupTime,
            packagingFee: pickupSettings.packagingFee,
          }).catch(err => console.warn('Could not update item pickup:', item.id, err))
        );
        await Promise.all(updatePromises);
        setMenuItems(prev => prev.map(m => ({
          ...m,
          isPickupAvailable: pickupSettings.isPickupEnabled,
          pickupPrepTime: pickupSettings.defaultPickupTime,
          packagingFee: pickupSettings.packagingFee,
        } as any)));
      }

      toast.success('Pickup & Takeaway settings saved successfully!');
      setPickupDialogOpen(false);
    } catch (error: any) {
      console.error('[Menu] Error saving pickup settings:', error);
      toast.error('Failed to save pickup settings: ' + (error?.message || 'Network error'));
    } finally {
      setSavingPickupSettings(false);
    }
  };

  // Add-on helpers
  const handleAddCustomAddOn = () => {
    if (!newAddOnName.trim()) return;
    const price = parseFloat(newAddOnPrice) || 0;
    setNewItem(prev => ({
      ...prev,
      addOns: [...prev.addOns, { name: newAddOnName.trim(), price }]
    }));
    setNewAddOnName('');
    setNewAddOnPrice('');
  };

  const handleRemoveAddOn = (index: number) => {
    setNewItem(prev => ({
      ...prev,
      addOns: prev.addOns.filter((_, i) => i !== index)
    }));
  };

  const handleAddSizeVariant = () => {
    if (!newSizeName.trim()) return;
    const price = parseFloat(newSizePrice) || 0;
    setNewItem(prev => ({
      ...prev,
      sizes: [...prev.sizes, { name: newSizeName.trim(), price }]
    }));
    setNewSizeName('');
    setNewSizePrice('');
  };

  const handleRemoveSize = (index: number) => {
    setNewItem(prev => ({
      ...prev,
      sizes: prev.sizes.filter((_, i) => i !== index)
    }));
  };

  // Group items by category and filter by search
  const filteredItems = menuItems.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const existingCategories = Array.from(new Set(menuItems.map((item) => item.category).filter(Boolean)));
  const categories = Array.from(new Set(filteredItems.map((item) => item.category).filter(Boolean)));

  const filteredCategoriesForDialog = POPULAR_CATEGORIES.filter(cat =>
    cat.name.toLowerCase().includes(categorySearchQuery.toLowerCase())
  );

  if (authLoading || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Spinner className="w-12 h-12 text-primary" />
        <p className="text-muted-foreground font-medium animate-pulse">Loading culinary catalogue...</p>
      </div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="max-w-7xl mx-auto space-y-8 p-4 md:p-8"
    >
      {/* Header section with Action Buttons */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-border/60">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Badge className="bg-primary/10 text-primary border border-primary/20 px-3 py-1 font-bold">
              <Store className="w-3.5 h-3.5 mr-1" /> {restaurant?.name || 'Restaurant Partner'}
            </Badge>
            <Badge variant="outline" className="text-muted-foreground border-border">
              {menuItems.length} Dishes Live
            </Badge>
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-foreground tracking-tight mb-2">
            Menu <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-orange-500">Studio</span>
          </h1>
          <p className="text-muted-foreground text-sm md:text-base max-w-xl">
            Upload dish photos directly to Cloudinary, manage pricing, add-ons, dietary classifications, and takeaway pickup settings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Pickup & Takeaway Settings Dialog Trigger */}
          <Button
            variant="outline"
            onClick={() => setPickupDialogOpen(true)}
            className="h-12 px-5 rounded-2xl gap-2 border-border bg-card hover:bg-muted font-bold text-foreground transition-all shadow-sm hover:shadow"
          >
            <ShoppingBag className="w-4 h-4 text-primary" />
            Pickup Settings
          </Button>

          {/* Add New Dish Dialog Trigger */}
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            if (open) {
              setEditingId(null);
              setNewItem({
                name: '',
                description: '',
                price: '',
                originalPrice: '',
                category: '',
                preparationTime: '30',
                servings: '1',
                calories: '',
                allergens: '',
                tags: '',
                foodType: 'veg',
                isVegetarian: true,
                isSpicy: false,
                spiceLevel: 'medium',
                isAvailable: true,
                isBestSeller: false,
                isNew: false,
                isChefSpecial: false,
                isPickupAvailable: true,
                pickupPrepTime: '20',
                packagingFee: '0',
                addOns: [],
                sizes: [],
                protein: '',
                carbs: '',
                fat: '',
                ingredients: '',
                portionSize: '',
                isGlutenFree: false,
                isJain: false,
                isHalal: false,
              });
              setImageFiles([]);
              setImagePreviews([]);
              setImageUrlInput('');
            }
            setDialogOpen(open);
          }}>
            <DialogTrigger asChild>
              <Button className="h-12 px-6 rounded-2xl gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-base shadow-lg hover:shadow-primary/25 transition-all hover:scale-105 active:scale-95">
                <Plus className="w-5 h-5" />
                Add New Dish
              </Button>
            </DialogTrigger>

            {/* ADD / EDIT ITEM DIALOG */}
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card border-border text-card-foreground shadow-2xl p-0 gap-0">
              <div className="sticky top-0 z-20 bg-card/95 backdrop-blur-md border-b border-border p-6 flex justify-between items-center">
                <div>
                  <DialogTitle className="text-2xl font-bold text-foreground flex items-center gap-2">
                    {editingId ? <Edit2 className="w-6 h-6 text-primary" /> : <Sparkles className="w-6 h-6 text-primary" />}
                    {editingId ? 'Edit Dish Details' : 'Add New Menu Item'}
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground text-xs mt-0.5">
                    Images upload automatically to Cloudinary and sync live to Firestore.
                  </DialogDescription>
                </div>
              </div>

              <div className="p-6 md:p-8">
                <Tabs defaultValue="basic" className="w-full">
                  <TabsList className="bg-muted/50 border border-border p-1 rounded-2xl w-full grid grid-cols-5 gap-1 mb-8">
                    <TabsTrigger value="basic" className="rounded-xl py-2.5 font-bold text-[11px] md:text-sm">Basic Info</TabsTrigger>
                    <TabsTrigger value="options" className="rounded-xl py-2.5 font-bold text-[11px] md:text-sm">Options</TabsTrigger>
                    <TabsTrigger value="nutrition" className="rounded-xl py-2.5 font-bold text-[11px] md:text-sm">🔥 Nutrition</TabsTrigger>
                    <TabsTrigger value="pickup" className="rounded-xl py-2.5 font-bold text-[11px] md:text-sm">Pickup</TabsTrigger>
                    <TabsTrigger value="attributes" className="rounded-xl py-2.5 font-bold text-[11px] md:text-sm">Badges</TabsTrigger>
                  </TabsList>

                  {/* TAB 1: BASIC INFO */}
                  <TabsContent value="basic" className="space-y-6 focus-visible:outline-none">
                    {/* Images Upload via Cloudinary */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-foreground font-bold flex items-center gap-2 text-sm">
                          <ImageIcon className="w-4 h-4 text-primary" /> Dish Photos (Cloudinary Upload) *
                        </Label>
                        <span className="text-xs text-muted-foreground">PNG, JPG, WEBP (Max 5)</span>
                      </div>

                      <div className="border-2 border-dashed border-border bg-muted/20 rounded-2xl p-5 transition-all hover:border-primary/50 group/upload">
                        {imagePreviews.length > 0 ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                              {imagePreviews.map((preview, index) => (
                                <div key={index} className="relative group aspect-square rounded-xl overflow-hidden border border-border shadow-md">
                                  <img
                                    src={preview}
                                    alt={`Preview ${index + 1}`}
                                    className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300"
                                  />
                                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <button
                                      type="button"
                                      onClick={() => removeImage(index)}
                                      className="p-1.5 bg-destructive text-destructive-foreground rounded-full hover:scale-110 transition-transform"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                  {index === 0 && (
                                    <span className="absolute bottom-1 left-1 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded">
                                      Main Cover
                                    </span>
                                  )}
                                </div>
                              ))}

                              {imagePreviews.length < 5 && (
                                <button
                                  type="button"
                                  onClick={() => document.getElementById('image-upload')?.click()}
                                  className="aspect-square rounded-xl border-2 border-dashed border-border hover:border-primary bg-muted/30 hover:bg-muted/60 flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground transition-all"
                                >
                                  <Plus className="w-6 h-6 text-primary" />
                                  <span className="text-[11px] font-bold uppercase tracking-wider">Add Photo</span>
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <label htmlFor="image-upload" className="cursor-pointer flex flex-col items-center gap-3 py-6">
                            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 group-hover/upload:scale-110 transition-all">
                              <Upload className="w-7 h-7 text-primary" />
                            </div>
                            <div className="text-center">
                              <p className="text-base font-bold text-foreground group-hover/upload:text-primary transition-colors">
                                Click to select dish photos
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                High-res photos upload directly to Cloudinary cloud storage
                              </p>
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

                        {/* Optional Direct URL Input */}
                        <div className="mt-4 pt-3 border-t border-border/40 flex flex-col sm:flex-row gap-2">
                          <Input
                            placeholder="Or paste external image URL (https://...)"
                            value={imageUrlInput}
                            onChange={(e) => setImageUrlInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddImageUrl();
                              }
                            }}
                            className="bg-card border-border h-10 text-xs rounded-xl flex-1"
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={handleAddImageUrl}
                            className="h-10 rounded-xl px-4 font-semibold text-xs whitespace-nowrap"
                          >
                            Add URL
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Dish Name & Category */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <Label htmlFor="name" className="text-foreground font-bold">Dish Name *</Label>
                        <Input
                          id="name"
                          placeholder="e.g., Butter Chicken Deluxe"
                          value={newItem.name}
                          onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                          className="bg-card border-border h-12 rounded-xl text-base font-medium"
                        />
                      </div>

                      {/* Category Input + Select Dialog Button */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="category" className="text-foreground font-bold">Category *</Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setCategoryDialogOpen(true)}
                            className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/10 px-2 rounded-lg font-bold gap-1"
                          >
                            <Layers className="w-3.5 h-3.5" />
                            Browse Categories
                          </Button>
                        </div>
                        <div className="flex gap-2">
                          <Input
                            id="category"
                            placeholder="e.g., Biryani & Rice"
                            value={newItem.category}
                            onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                            className="bg-card border-border h-12 rounded-xl text-base"
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setCategoryDialogOpen(true)}
                            className="h-12 px-4 rounded-xl font-bold whitespace-nowrap text-xs border border-border"
                          >
                            Choose
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                      <Label htmlFor="description" className="text-foreground font-bold">Description</Label>
                      <Textarea
                        id="description"
                        placeholder="Tell customers about the rich flavors, cooking technique, and key ingredients..."
                        value={newItem.description}
                        onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                        className="bg-card border-border min-h-[90px] rounded-xl p-3 text-sm resize-none"
                      />
                    </div>

                    {/* Price and Original Strike-Through Price */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <Label htmlFor="price" className="text-foreground font-bold">Selling Price (₹) *</Label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-lg">₹</span>
                          <Input
                            id="price"
                            type="number"
                            placeholder="249"
                            value={newItem.price}
                            onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                            min="0"
                            step="0.01"
                            className="bg-card border-border pl-10 h-12 rounded-xl text-lg font-bold font-mono"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="originalPrice" className="text-muted-foreground font-medium text-xs">
                            Original / MRP Price (Optional Strike-through)
                          </Label>
                          {newItem.originalPrice && newItem.price && parseFloat(newItem.originalPrice) > parseFloat(newItem.price) && (
                            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] font-bold">
                              {Math.round(((parseFloat(newItem.originalPrice) - parseFloat(newItem.price)) / parseFloat(newItem.originalPrice)) * 100)}% OFF
                            </Badge>
                          )}
                        </div>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-lg">₹</span>
                          <Input
                            id="originalPrice"
                            type="number"
                            placeholder="299"
                            value={newItem.originalPrice}
                            onChange={(e) => setNewItem({ ...newItem, originalPrice: e.target.value })}
                            min="0"
                            step="0.01"
                            className="bg-card border-border pl-10 h-12 rounded-xl text-sm font-mono text-muted-foreground"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Food Classification (Veg / Non-Veg / Vegan / Egg) */}
                    <div className="space-y-2">
                      <Label className="text-foreground font-bold text-sm">Food Classification *</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        {[
                          { id: 'veg', label: 'Vegetarian', icon: '🟢', color: 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
                          { id: 'non-veg', label: 'Non-Vegetarian', icon: '🔴', color: 'border-red-500 bg-red-500/10 text-red-600 dark:text-red-400' },
                          { id: 'egg', label: 'Contains Egg', icon: '🟡', color: 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400' },
                          { id: 'vegan', label: 'Pure Vegan', icon: '🌿', color: 'border-green-600 bg-green-600/10 text-green-600 dark:text-green-400' },
                        ].map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setNewItem({ ...newItem, foodType: t.id, isVegetarian: t.id === 'veg' || t.id === 'vegan' })}
                            className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${newItem.foodType === t.id
                              ? `${t.color} ring-2 ring-primary/40 shadow-sm`
                              : 'border-border bg-card/60 text-muted-foreground hover:bg-muted/40'
                              }`}
                          >
                            <span>{t.icon}</span>
                            <span>{t.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </TabsContent>

                  {/* TAB 2: OPTIONS & ADD-ONS */}
                  <TabsContent value="options" className="space-y-6 focus-visible:outline-none">
                    {/* Portion Sizes / Variants */}
                    <div className="p-5 rounded-2xl border border-border bg-card space-y-4">
                      <div>
                        <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
                          <Layers className="w-4 h-4 text-primary" /> Size / Portion Variants
                        </h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Add portion variations (e.g. Half, Full, Small, Medium, Large) with additional pricing.
                        </p>
                      </div>

                      {newItem.sizes.length > 0 && (
                        <div className="space-y-2">
                          {newItem.sizes.map((size, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border text-sm">
                              <span className="font-semibold text-foreground">{size.name}</span>
                              <div className="flex items-center gap-3">
                                <span className="font-mono font-bold text-primary">
                                  {size.price > 0 ? `+₹${size.price}` : 'Base Price'}
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveSize(idx)}
                                  className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                          placeholder="Size Name (e.g., Full Portion / Large)"
                          value={newSizeName}
                          onChange={(e) => setNewSizeName(e.target.value)}
                          className="bg-muted/30 border-border h-10 text-xs rounded-xl flex-1"
                        />
                        <div className="relative w-full sm:w-36">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">+₹</span>
                          <Input
                            type="number"
                            placeholder="0"
                            value={newSizePrice}
                            onChange={(e) => setNewSizePrice(e.target.value)}
                            className="bg-muted/30 border-border h-10 text-xs rounded-xl pl-8 font-mono"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={handleAddSizeVariant}
                          className="h-10 px-4 rounded-xl text-xs font-bold whitespace-nowrap"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" /> Add Size
                        </Button>
                      </div>
                    </div>

                    {/* Add-on Customizations */}
                    <div className="p-5 rounded-2xl border border-border bg-card space-y-4">
                      <div>
                        <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
                          <Plus className="w-4 h-4 text-primary" /> Customizable Extras & Add-ons
                        </h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Let customers add extra cheese, dips, drinks, or toppings to their order.
                        </p>
                      </div>

                      {newItem.addOns.length > 0 && (
                        <div className="space-y-2">
                          {newItem.addOns.map((addon, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border text-sm">
                              <span className="font-semibold text-foreground">{addon.name}</span>
                              <div className="flex items-center gap-3">
                                <span className="font-mono font-bold text-primary">+₹{addon.price}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveAddOn(idx)}
                                  className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                          placeholder="Add-on Name (e.g., Extra Cheese / Mint Chutney)"
                          value={newAddOnName}
                          onChange={(e) => setNewAddOnName(e.target.value)}
                          className="bg-muted/30 border-border h-10 text-xs rounded-xl flex-1"
                        />
                        <div className="relative w-full sm:w-36">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">+₹</span>
                          <Input
                            type="number"
                            placeholder="30"
                            value={newAddOnPrice}
                            onChange={(e) => setNewAddOnPrice(e.target.value)}
                            className="bg-muted/30 border-border h-10 text-xs rounded-xl pl-8 font-mono"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={handleAddCustomAddOn}
                          className="h-10 px-4 rounded-xl text-xs font-bold whitespace-nowrap"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" /> Add Extra
                        </Button>
                      </div>
                    </div>

                    {/* Spiciness Level Selector */}
                    <div className="space-y-2">
                      <Label className="text-foreground font-bold text-sm">Spice Level</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        {[
                          { id: 'none', label: 'Not Spicy', icon: '🍃' },
                          { id: 'mild', label: 'Mild', icon: '🌶️' },
                          { id: 'medium', label: 'Medium', icon: '🌶️🌶️' },
                          { id: 'hot', label: 'Extra Hot', icon: '🔥🔥🔥' },
                        ].map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setNewItem({ ...newItem, spiceLevel: s.id, isSpicy: s.id !== 'none' })}
                            className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${newItem.spiceLevel === s.id
                              ? 'border-red-500 bg-red-500/10 text-red-500 ring-2 ring-red-500/30'
                              : 'border-border bg-card/60 text-muted-foreground hover:bg-muted/40'
                              }`}
                          >
                            <span>{s.icon}</span>
                            <span>{s.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Prep time, Servings, Calories */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="prepTime" className="text-foreground text-xs font-bold">Kitchen Prep (min)</Label>
                        <div className="relative">
                          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="prepTime"
                            type="number"
                            placeholder="30"
                            value={newItem.preparationTime}
                            onChange={(e) => setNewItem({ ...newItem, preparationTime: e.target.value })}
                            className="bg-card border-border h-11 rounded-xl pl-9 text-xs"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="servings" className="text-foreground text-xs font-bold">Servings</Label>
                        <div className="relative">
                          <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="servings"
                            type="number"
                            placeholder="1"
                            value={newItem.servings}
                            onChange={(e) => setNewItem({ ...newItem, servings: e.target.value })}
                            className="bg-card border-border h-11 rounded-xl pl-9 text-xs"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="calories" className="text-foreground text-xs font-bold">Calories (kcal)</Label>
                        <div className="relative">
                          <Flame className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="calories"
                            type="number"
                            placeholder="450"
                            value={newItem.calories}
                            onChange={(e) => setNewItem({ ...newItem, calories: e.target.value })}
                            className="bg-card border-border h-11 rounded-xl pl-9 text-xs"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Allergens & Tags */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="allergens" className="text-foreground text-xs font-bold">Allergens</Label>
                        <Input
                          id="allergens"
                          placeholder="e.g., Peanuts, Dairy, Gluten"
                          value={newItem.allergens}
                          onChange={(e) => setNewItem({ ...newItem, allergens: e.target.value })}
                          className="bg-card border-border h-11 rounded-xl text-xs"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="tags" className="text-foreground text-xs font-bold">Search Tags</Label>
                        <Input
                          id="tags"
                          placeholder="e.g., Crispy, Cheesy, Weekend Special"
                          value={newItem.tags}
                          onChange={(e) => setNewItem({ ...newItem, tags: e.target.value })}
                          className="bg-card border-border h-11 rounded-xl text-xs"
                        />
                      </div>
                    </div>
                  </TabsContent>

                  {/* TAB 3: NUTRITION & DETAILS */}
                  <TabsContent value="nutrition" className="space-y-6 focus-visible:outline-none">
                    {/* Caloric & Macros */}
                    <div className="p-5 rounded-2xl border border-border bg-card space-y-4">
                      <div>
                        <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
                          <Flame className="w-4 h-4 text-orange-500" /> Nutritional Information
                        </h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Displayed on the customer product page. Leave blank if unknown.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="calories_input" className="text-foreground text-xs font-bold">Calories (kcal)</Label>
                          <div className="relative">
                            <Flame className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-500" />
                            <Input id="calories_input" type="number" placeholder="e.g. 320" value={newItem.calories}
                              onChange={(e) => setNewItem({ ...newItem, calories: e.target.value })}
                              className="bg-card border-border h-11 rounded-xl pl-9 text-xs" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="portionSize" className="text-foreground text-xs font-bold">Portion / Serving Size</Label>
                          <Input id="portionSize" placeholder="e.g. 250g, 1 plate, 2 pieces"
                            value={newItem.portionSize}
                            onChange={(e) => setNewItem({ ...newItem, portionSize: e.target.value })}
                            className="bg-card border-border h-11 rounded-xl text-xs" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[
                          { key: 'protein', label: 'Protein (g)', placeholder: '15', color: 'text-emerald-500' },
                          { key: 'carbs', label: 'Carbs (g)', placeholder: '40', color: 'text-blue-500' },
                          { key: 'fat', label: 'Fat (g)', placeholder: '12', color: 'text-rose-500' },
                        ].map(macro => (
                          <div key={macro.key} className="space-y-2">
                            <Label htmlFor={macro.key} className={`text-foreground text-xs font-bold ${macro.color}`}>{macro.label}</Label>
                            <Input id={macro.key} type="number" placeholder={macro.placeholder}
                              value={(newItem as any)[macro.key]}
                              onChange={(e) => setNewItem({ ...newItem, [macro.key]: e.target.value } as any)}
                              className="bg-card border-border h-11 rounded-xl text-xs" />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Ingredients */}
                    <div className="space-y-2">
                      <Label htmlFor="ingredients" className="text-foreground font-bold flex items-center gap-2 text-sm">
                        🌱 Key Ingredients
                      </Label>
                      <Textarea id="ingredients" placeholder="e.g. Chicken, Basmati Rice, Saffron, Onions, Tomatoes, Garam Masala..."
                        value={newItem.ingredients}
                        onChange={(e) => setNewItem({ ...newItem, ingredients: e.target.value })}
                        className="bg-card border-border min-h-[80px] rounded-xl p-3 text-xs resize-none" />
                      <p className="text-[11px] text-muted-foreground">Comma-separated ingredient list shown to customers on the product page.</p>
                    </div>

                    {/* Allergens (moved here from options tab) */}
                    <div className="space-y-2">
                      <Label htmlFor="allergens_nutrition" className="text-foreground text-xs font-bold flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500" /> Allergen Warnings
                      </Label>
                      <Input id="allergens_nutrition" placeholder="e.g. Peanuts, Dairy, Gluten, Tree Nuts, Shellfish"
                        value={newItem.allergens}
                        onChange={(e) => setNewItem({ ...newItem, allergens: e.target.value })}
                        className="bg-card border-border h-11 rounded-xl text-xs" />
                    </div>

                    {/* Dietary Certifications */}
                    <div className="p-5 rounded-2xl border border-border bg-card space-y-4">
                      <h4 className="font-bold text-foreground text-sm">🥗 Dietary Certifications</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                          { key: 'isGlutenFree', label: 'Gluten Free', desc: 'No gluten-containing ingredients', icon: '🌾' },
                          { key: 'isJain', label: 'Jain Friendly', desc: 'No root vegetables (Jain cuisine)', icon: '🙏' },
                          { key: 'isHalal', label: 'Halal Certified', desc: 'Prepared according to halal standards', icon: '✅' },
                        ].map((cert) => (
                          <label key={cert.key}
                            className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                              (newItem as any)[cert.key] ? 'bg-primary/5 border-primary/40 shadow-sm' : 'bg-muted/20 border-border hover:bg-muted/40'
                            }`}
                          >
                            <Checkbox
                              checked={(newItem as any)[cert.key]}
                              onCheckedChange={(c) => setNewItem({ ...newItem, [cert.key]: !!c } as any)}
                              className="mt-0.5 h-5 w-5 data-[state=checked]:bg-primary"
                            />
                            <div>
                              <p className="font-bold text-sm text-foreground flex items-center gap-1">
                                <span>{cert.icon}</span> {cert.label}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">{cert.desc}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </TabsContent>

                  {/* TAB 4: PICKUP / TAKEAWAY SETTINGS */}
                  <TabsContent value="pickup" className="space-y-6 focus-visible:outline-none">
                    <div className="p-5 rounded-2xl border border-primary/20 bg-primary/5 space-y-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h4 className="font-bold text-foreground text-base flex items-center gap-2">
                            <ShoppingBag className="w-5 h-5 text-primary" /> Self-Pickup / Takeaway Availability
                          </h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            Allow customers to order this item online and pick it up directly from your restaurant without delivery fee.
                          </p>
                        </div>
                        <Checkbox
                          checked={newItem.isPickupAvailable}
                          onCheckedChange={(c) => setNewItem({ ...newItem, isPickupAvailable: !!c })}
                          className="h-6 w-6 rounded-md data-[state=checked]:bg-primary"
                        />
                      </div>

                      {newItem.isPickupAvailable && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-border/40">
                          <div className="space-y-2">
                            <Label className="text-foreground text-xs font-bold">Pickup Ready Time</Label>
                            <div className="relative">
                              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                              <Input
                                type="number"
                                placeholder="20"
                                value={newItem.pickupPrepTime}
                                onChange={(e) => setNewItem({ ...newItem, pickupPrepTime: e.target.value })}
                                className="bg-card border-border h-11 rounded-xl pl-9 text-xs"
                              />
                            </div>
                            <span className="text-[11px] text-muted-foreground">Estimated minutes for takeaway packing</span>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-foreground text-xs font-bold">Packaging Fee (₹)</Label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">₹</span>
                              <Input
                                type="number"
                                placeholder="0"
                                value={newItem.packagingFee}
                                onChange={(e) => setNewItem({ ...newItem, packagingFee: e.target.value })}
                                className="bg-card border-border h-11 rounded-xl pl-7 text-xs font-mono"
                              />
                            </div>
                            <span className="text-[11px] text-muted-foreground">Set ₹0 for free customer takeaway packaging</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* TAB 4: BADGES & ATTRIBUTES */}
                  <TabsContent value="attributes" className="space-y-4 focus-visible:outline-none">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {[
                        {
                          key: 'isAvailable',
                          label: 'In Stock & Ready',
                          desc: 'Customers can add this item to cart right now',
                          checked: newItem.isAvailable,
                          icon: '✅',
                          color: 'text-emerald-500'
                        },
                        {
                          key: 'isBestSeller',
                          label: 'Bestseller Badge',
                          desc: 'Highlighted with a golden Bestseller tag',
                          checked: newItem.isBestSeller,
                          icon: '⭐',
                          color: 'text-amber-500'
                        },
                        {
                          key: 'isChefSpecial',
                          label: "Chef's Special",
                          desc: "Marked as your head chef's recommendation",
                          checked: newItem.isChefSpecial,
                          icon: '👨‍🍳',
                          color: 'text-rose-500'
                        },
                        {
                          key: 'isNew',
                          label: 'New Arrival',
                          desc: 'Prominently features a NEW badge',
                          checked: newItem.isNew,
                          icon: '🆕',
                          color: 'text-blue-500'
                        },
                      ].map((attr) => (
                        <label
                          key={attr.key}
                          className={`flex items-start gap-3.5 p-4 rounded-2xl border cursor-pointer transition-all ${attr.checked ? 'bg-primary/5 border-primary/40 shadow-sm' : 'bg-muted/20 border-border hover:bg-muted/40'
                            }`}
                        >
                          <Checkbox
                            checked={attr.checked}
                            onCheckedChange={(c) => setNewItem({ ...newItem, [attr.key]: !!c })}
                            className="mt-0.5 h-5 w-5 data-[state=checked]:bg-primary"
                          />
                          <div>
                            <p className="font-bold text-sm text-foreground flex items-center gap-1.5">
                              <span>{attr.icon}</span> {attr.label}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">{attr.desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              <div className="sticky bottom-0 z-20 bg-card/95 backdrop-blur-xl border-t border-border p-5 flex items-center justify-between gap-4">
                <div className="text-xs text-muted-foreground">
                  {uploadStatus && (
                    <span className="flex items-center gap-2 text-primary font-semibold animate-pulse">
                      <Spinner className="w-3.5 h-3.5" /> {uploadStatus}
                    </span>
                  )}
                </div>
                <div className="flex gap-3">
                  <DialogTrigger asChild>
                    <Button variant="outline" type="button" disabled={submitting} className="border-border bg-card text-foreground hover:bg-muted h-11 px-5 rounded-xl font-bold">
                      Cancel
                    </Button>
                  </DialogTrigger>
                  <Button
                    onClick={handleAddItem}
                    disabled={submitting}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold h-11 px-7 rounded-xl shadow-lg transition-all"
                  >
                    {submitting && <Spinner className="mr-2 h-4 w-4" />}
                    {submitting ? (editingId ? 'Updating...' : 'Publishing...') : (editingId ? 'Update Item' : 'Publish Dish')}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      {/* CATEGORY SELECT DIALOG */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="max-w-2xl bg-card border-border text-card-foreground shadow-2xl p-6 rounded-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="pb-3 border-b border-border">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Layers className="w-6 h-6 text-primary" /> Choose Food Category
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Select a popular category or type a custom category name for your dish.
            </DialogDescription>
          </DialogHeader>

          {/* Search bar inside category dialog */}
          <div className="relative mt-4 mb-4">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search categories (e.g. Biryani, Pizza, Beverage)..."
              value={categorySearchQuery}
              onChange={(e) => setCategorySearchQuery(e.target.value)}
              className="bg-muted/40 border-border h-11 pl-10 rounded-xl text-sm"
            />
          </div>

          {/* Your Restaurant's Active Categories */}
          {existingCategories.length > 0 && (
            <div className="mb-5 space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Categories in Your Menu
              </Label>
              <div className="flex flex-wrap gap-2">
                {existingCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setNewItem(prev => ({ ...prev, category: cat }));
                      setCategoryDialogOpen(false);
                      toast.success(`Selected "${cat}"`);
                    }}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${newItem.category === cat
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-card border-border hover:border-primary text-foreground'
                      }`}
                  >
                    <Check className={`w-3.5 h-3.5 ${newItem.category === cat ? 'opacity-100' : 'opacity-0'}`} />
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Popular Platform Categories Grid */}
          <div className="space-y-2 mb-6">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Popular Categories
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
              {filteredCategoriesForDialog.map((cat) => (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => {
                    setNewItem(prev => ({ ...prev, category: cat.name }));
                    setCategoryDialogOpen(false);
                    toast.success(`Category set to "${cat.name}"`);
                  }}
                  className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98] ${newItem.category === cat.name
                    ? 'bg-primary text-primary-foreground border-primary shadow-md'
                    : `bg-gradient-to-br ${cat.color} hover:shadow-sm`
                    }`}
                >
                  <span className="text-2xl shrink-0">{cat.icon}</span>
                  <div className="min-w-0">
                    <p className="font-bold text-xs truncate">{cat.name}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Create Custom Category */}
          <div className="pt-4 border-t border-border space-y-2">
            <Label className="text-xs font-bold text-foreground">Or Create Custom Category</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Midnight Munchies"
                value={customCategoryInput}
                onChange={(e) => setCustomCategoryInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (customCategoryInput.trim()) {
                      setNewItem(prev => ({ ...prev, category: customCategoryInput.trim() }));
                      setCategoryDialogOpen(false);
                      toast.success(`Custom category "${customCategoryInput.trim()}" applied`);
                    }
                  }
                }}
                className="bg-muted/40 border-border h-11 text-xs rounded-xl"
              />
              <Button
                type="button"
                onClick={() => {
                  if (customCategoryInput.trim()) {
                    setNewItem(prev => ({ ...prev, category: customCategoryInput.trim() }));
                    setCategoryDialogOpen(false);
                    toast.success(`Custom category "${customCategoryInput.trim()}" applied`);
                  }
                }}
                disabled={!customCategoryInput.trim()}
                className="h-11 px-5 rounded-xl font-bold text-xs bg-primary text-primary-foreground whitespace-nowrap"
              >
                Use Category
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* RESTAURANT PICKUP & TAKEAWAY CONFIGURATION DIALOG */}
      <Dialog open={pickupDialogOpen} onOpenChange={setPickupDialogOpen}>
        <DialogContent className="max-w-xl bg-card border-border text-card-foreground shadow-2xl p-6 rounded-3xl">
          <DialogHeader className="pb-3 border-b border-border">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <ShoppingBag className="w-6 h-6 text-primary" /> Pickup & Takeaway Settings
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Manage how customers order for self-pickup from your restaurant counter.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {/* Master Toggle */}
            <div className="p-4 rounded-2xl border border-border bg-muted/20 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-foreground text-sm">Enable Self-Pickup (Takeaway)</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Customers can choose Takeaway at checkout to collect food directly.
                </p>
              </div>
              <Checkbox
                checked={pickupSettings.isPickupEnabled}
                onCheckedChange={(c) => setPickupSettings({ ...pickupSettings, isPickupEnabled: !!c })}
                className="h-6 w-6 rounded-md data-[state=checked]:bg-primary"
              />
            </div>

            {/* Default Prep Time */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground">Standard Pickup Preparation Time</Label>
              <div className="grid grid-cols-4 gap-2">
                {[15, 20, 30, 45].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setPickupSettings({ ...pickupSettings, defaultPickupTime: mins })}
                    className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${pickupSettings.defaultPickupTime === mins
                      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted'
                      }`}
                  >
                    {mins} mins
                  </button>
                ))}
              </div>
            </div>

            {/* Handover Counter Location */}
            <div className="space-y-1.5">
              <Label htmlFor="counter" className="text-xs font-bold text-foreground">Pickup Counter / Handover Spot</Label>
              <Input
                id="counter"
                placeholder="e.g. Express Online Pickup Window #1"
                value={pickupSettings.pickupCounter}
                onChange={(e) => setPickupSettings({ ...pickupSettings, pickupCounter: e.target.value })}
                className="bg-card border-border h-11 text-xs rounded-xl"
              />
            </div>

            {/* Customer Handover Instructions */}
            <div className="space-y-1.5">
              <Label htmlFor="instructions" className="text-xs font-bold text-foreground">Customer Pickup Instructions</Label>
              <Textarea
                id="instructions"
                placeholder="e.g. Show digital Order OTP at the pickup window. No waiting in the dine-in queue."
                value={pickupSettings.pickupInstructions}
                onChange={(e) => setPickupSettings({ ...pickupSettings, pickupInstructions: e.target.value })}
                className="bg-card border-border text-xs rounded-xl min-h-[75px] resize-none"
              />
            </div>

            {/* Takeaway Packaging Charge */}
            <div className="space-y-1.5">
              <Label htmlFor="packaging" className="text-xs font-bold text-foreground">Takeaway Packaging Fee (₹)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xs">₹</span>
                <Input
                  id="packaging"
                  type="number"
                  placeholder="0"
                  value={pickupSettings.packagingFee}
                  onChange={(e) => setPickupSettings({ ...pickupSettings, packagingFee: parseFloat(e.target.value) || 0 })}
                  className="bg-card border-border h-11 pl-7 text-xs rounded-xl font-mono"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">Keep ₹0 to offer free takeaway packing for customers.</p>
            </div>

            {/* Batch apply */}
            <label className="flex items-start gap-3 p-3.5 rounded-xl border border-primary/20 bg-primary/5 cursor-pointer">
              <Checkbox
                checked={pickupSettings.applyToAllItems}
                onCheckedChange={(c) => setPickupSettings({ ...pickupSettings, applyToAllItems: !!c })}
                className="mt-0.5 h-4 w-4 data-[state=checked]:bg-primary"
              />
              <div>
                <p className="font-bold text-xs text-foreground">Apply Pickup availability to all existing menu items</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Synchronizes all dishes to be available for self-pickup with the configured prep time.
                </p>
              </div>
            </label>
          </div>

          <DialogFooter className="pt-3 border-t border-border flex justify-end gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => setPickupDialogOpen(false)}
              className="rounded-xl h-11 px-5 text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSavePickupSettings}
              disabled={savingPickupSettings}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl h-11 px-6 text-xs font-bold shadow-md"
            >
              {savingPickupSettings && <Spinner className="mr-2 h-3.5 w-3.5" />}
              {savingPickupSettings ? 'Saving...' : 'Save Settings'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Search & Category Filter Bar */}
      <motion.div variants={itemVariants} className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl py-3 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search dishes or categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-card border-border h-11 pl-11 rounded-full text-foreground placeholder:text-muted-foreground focus:border-primary text-sm font-medium"
          />
        </div>
      </motion.div>

      {/* Menu Items List */}
      {categories.length === 0 ? (
        <Card className="py-24 text-center bg-card border-border border-dashed rounded-3xl group">
          <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-5 ring-1 ring-primary/20">
            <Utensils className="w-9 h-9 text-primary" />
          </div>
          <h3 className="text-2xl font-black text-foreground mb-2">No Menu Items Found</h3>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto text-sm">
            {searchQuery ? `No results matching "${searchQuery}"` : 'Your menu is currently empty. Add your signature dishes to start taking customer orders!'}
          </p>
          <Button onClick={() => setDialogOpen(true)} className="bg-primary text-primary-foreground font-bold rounded-full px-8 h-12 text-sm shadow-lg hover:bg-primary/90">
            <Plus className="w-5 h-5 mr-1.5" />
            Add First Dish
          </Button>
        </Card>
      ) : (
        <div className="space-y-6">
          <AnimatePresence mode="popLayout">
            {categories.map((category, idx) => {
              const categoryItems = filteredItems.filter((item) => item.category === category);
              const isExpanded = expandedCategory === category;

              return (
                <motion.div
                  key={category}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <div className={`overflow-hidden rounded-3xl transition-all duration-300 border ${isExpanded ? 'bg-card border-primary/30 shadow-lg' : 'bg-card/70 border-border hover:border-primary/20'}`}>
                    <button
                      onClick={() => setExpandedCategory(isExpanded ? null : category)}
                      className="w-full p-5 md:p-6 flex items-center justify-between bg-card hover:bg-muted/15 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-1.5 h-8 rounded-full transition-colors ${isExpanded ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                        <div className="text-left">
                          <h3 className="font-black text-foreground text-xl md:text-2xl tracking-tight">{category}</h3>
                          <p className="text-muted-foreground text-xs font-semibold mt-0.5 tracking-wider uppercase">{categoryItems.length} ITEMS</p>
                        </div>
                      </div>
                      <div className={`w-10 h-10 rounded-full border border-border flex items-center justify-center bg-muted/40 transition-transform duration-300 ${isExpanded ? 'rotate-180 bg-primary/10 text-primary border-primary/30' : 'text-muted-foreground'}`}>
                        <ChevronDown className="w-5 h-5" />
                      </div>
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="border-t border-border"
                        >
                          <div className="p-4 md:p-6 grid gap-4">
                            {categoryItems.map((item, index) => {
                              const rawAny = item as any;
                              const isVeg = item.vegetarian || rawAny.foodType === 'veg' || rawAny.foodType === 'vegan';
                              const originalPrice = rawAny.originalPrice;
                              const addOnsCount = (rawAny.addOns || rawAny.addons || []).length;
                              const sizesCount = (rawAny.sizes || []).length;

                              return (
                                <motion.div
                                  key={item.id}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: index * 0.04 }}
                                  className="group relative flex flex-col md:flex-row p-4 md:p-5 bg-card rounded-2xl border border-border hover:border-primary/30 transition-all hover:shadow-lg hover:bg-muted/10"
                                >
                                  {/* Item Image with Badges */}
                                  <div className="relative w-full md:w-52 h-44 md:h-36 rounded-2xl overflow-hidden shrink-0 shadow-sm border border-border bg-muted">
                                    {item.image ? (
                                      <img
                                        src={item.image}
                                        alt={item.name}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <ImageIcon className="w-10 h-10 text-muted-foreground" />
                                      </div>
                                    )}

                                    {/* Cloudinary Badge overlay */}
                                    {item.image && item.image.includes('cloudinary') && (
                                      <span className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                        <Sparkles className="w-2.5 h-2.5 text-primary" /> Cloud
                                      </span>
                                    )}

                                    {/* Veg / Non-Veg Indicator */}
                                    <div className="absolute top-2.5 left-2.5">
                                      {isVeg ? (
                                        <span className="w-5 h-5 rounded-md bg-white/95 backdrop-blur-sm border border-emerald-600 flex items-center justify-center shadow-md">
                                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                                        </span>
                                      ) : (
                                        <span className="w-5 h-5 rounded-md bg-white/95 backdrop-blur-sm border border-red-600 flex items-center justify-center shadow-md">
                                          <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Item Details */}
                                  <div className="flex-1 min-w-0 flex flex-col justify-between pt-4 md:pt-0 md:pl-5">
                                    <div>
                                      <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                            <h4 className="font-bold text-foreground text-lg md:text-xl truncate group-hover:text-primary transition-colors">
                                              {item.name}
                                            </h4>
                                            {item.isBestSeller && (
                                              <Badge className="bg-amber-500 text-amber-950 font-extrabold text-[10px] px-2 py-0.5 border-0">
                                                BESTSELLER
                                              </Badge>
                                            )}
                                            {item.isNew && (
                                              <Badge className="bg-blue-600 text-white font-extrabold text-[10px] px-2 py-0.5 border-0">
                                                NEW
                                              </Badge>
                                            )}
                                            {rawAny.isChefSpecial && (
                                              <Badge className="bg-rose-500 text-white font-extrabold text-[10px] px-2 py-0.5 border-0">
                                                CHEF SPECIAL
                                              </Badge>
                                            )}
                                            {rawAny.isPickupAvailable && (
                                              <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5 text-[10px] font-bold gap-1 px-2 py-0.5">
                                                <ShoppingBag className="w-2.5 h-2.5" /> Takeaway Ready
                                              </Badge>
                                            )}
                                          </div>
                                          <p className="text-muted-foreground text-xs md:text-sm line-clamp-2 leading-relaxed">
                                            {item.description || 'Freshly prepared upon order.'}
                                          </p>
                                        </div>

                                        {/* Price display with discount strike-through */}
                                        <div className="text-right shrink-0">
                                          <div className="flex items-baseline justify-end gap-1.5">
                                            {originalPrice && originalPrice > item.price && (
                                              <span className="text-xs text-muted-foreground line-through font-mono">
                                                ₹{originalPrice}
                                              </span>
                                            )}
                                            <p className="text-xl md:text-2xl font-black text-foreground tracking-tight font-mono">
                                              ₹{item.price}
                                            </p>
                                          </div>
                                          {originalPrice && originalPrice > item.price && (
                                            <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                              {Math.round(((originalPrice - item.price) / originalPrice) * 100)}% OFF
                                            </p>
                                          )}
                                        </div>
                                      </div>

                                      {/* Tags, Add-ons count & Details */}
                                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold mt-3">
                                        <span className="flex items-center gap-1 bg-muted/60 px-2.5 py-1 rounded-lg text-muted-foreground border border-border">
                                          <Clock className="w-3 h-3" /> {item.preparationTime || 30}m
                                        </span>
                                        {item.servings && (
                                          <span className="flex items-center gap-1 bg-muted/60 px-2.5 py-1 rounded-lg text-muted-foreground border border-border">
                                            <Users className="w-3 h-3" /> Serves {item.servings}
                                          </span>
                                        )}
                                        {addOnsCount > 0 && (
                                          <span className="bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-lg">
                                            +{addOnsCount} Extras
                                          </span>
                                        )}
                                        {sizesCount > 0 && (
                                          <span className="bg-blue-500/10 text-blue-500 border border-blue-500/20 px-2.5 py-1 rounded-lg">
                                            {sizesCount} Sizes
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Footer Actions: Availability Toggle, Edit, Delete */}
                                    <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-border/60">
                                      {/* Quick Stock Toggle */}
                                      <button
                                        type="button"
                                        onClick={() => handleToggleItemAvailability(item)}
                                        className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${item.available !== false
                                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                                          : 'bg-muted border-border text-muted-foreground hover:bg-muted/80'
                                          }`}
                                      >
                                        <span className={`w-2 h-2 rounded-full ${item.available !== false ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'}`} />
                                        {item.available !== false ? 'In Stock (Live)' : 'Out of Stock'}
                                      </button>

                                      <div className="flex items-center gap-2">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleDeleteItem(item.id || '')}
                                          className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl px-3 h-9 text-xs transition-colors"
                                        >
                                          <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleEditItem(item)}
                                          className="border-border bg-card text-foreground hover:bg-primary hover:text-primary-foreground rounded-xl px-4 h-9 text-xs font-bold transition-all"
                                        >
                                          <Edit2 className="w-3.5 h-3.5 mr-1.5" /> Edit Dish
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              );
                            })}
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
        <DialogContent className="max-w-md bg-card border-border text-card-foreground text-center p-8 shadow-2xl rounded-3xl">
          <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 ring-4 ring-emerald-500/10 shadow-lg">
            <CheckCircle className="w-10 h-10 text-emerald-500" />
          </div>
          <h3 className="text-2xl font-black text-foreground mb-2">Dish Saved & Live!</h3>
          <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
            Your dish photo has been safely stored in Cloudinary and the menu item is now active in Firestore for your restaurant and hungry customers.
          </p>
          <Button onClick={() => setSuccessDialog(false)} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl h-12 text-sm shadow-md">
            Got it, Continue
          </Button>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
