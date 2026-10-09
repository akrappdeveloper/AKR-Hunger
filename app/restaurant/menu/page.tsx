'use client';

import { useEffect, useState, useMemo } from 'react';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
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
  getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { MenuItem } from '@/lib/types';
import { toast } from 'sonner';
import {
  Plus, Trash2, ChevronDown, Upload, Image as ImageIcon,
  Clock, CheckCircle, XCircle, X, Star, Flame, Users, AlertCircle, Utensils,
  Search, Filter, ShoppingBag, Store, Sparkles, Check, Edit2,
  Layers, LayoutGrid, List, Eye, Zap, Award, ChefHat, Heart, ShieldCheck
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

// Special culinary badges that the restaurant manager can assign
const CURATED_BADGES = [
  {
    key: 'isChefSpecial',
    label: "Chef's Special",
    desc: 'Signature preparation recommended by head chef',
    icon: '👨‍🍳',
    color: 'from-rose-500 to-pink-600',
    badgeClass: 'bg-rose-500/15 text-rose-500 border-rose-500/30',
  },
  {
    key: 'isMustTry',
    label: 'Must Try',
    desc: 'Crowd-favorite dish highly recommended for first-timers',
    icon: '🔥',
    color: 'from-amber-500 to-orange-600',
    badgeClass: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  },
  {
    key: 'isTrending',
    label: 'Trending Now',
    desc: 'Currently in high demand among food enthusiasts',
    icon: '⚡',
    color: 'from-violet-500 to-purple-600',
    badgeClass: 'bg-violet-500/15 text-violet-500 border-violet-500/30',
  },
  {
    key: 'isHealthyChoice',
    label: 'Healthy Choice',
    desc: 'Nutrient-rich, macro-balanced, and guilt-free',
    icon: '🥗',
    color: 'from-emerald-500 to-teal-600',
    badgeClass: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  },
  {
    key: 'isSeasonalSpecial',
    label: 'Seasonal Special',
    desc: 'Crafted with fresh seasonal harvest for a limited time',
    icon: '🌟',
    color: 'from-yellow-500 to-amber-600',
    badgeClass: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30',
  },
  {
    key: 'isLimitedEdition',
    label: 'Limited Batch',
    desc: 'Cooked in strictly restricted daily batches',
    icon: '⏳',
    color: 'from-zinc-700 to-slate-900',
    badgeClass: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  },
  {
    key: 'isHouseSpecialty',
    label: 'House Specialty',
    desc: 'Authentic heritage recipe unique to your kitchen',
    icon: '👑',
    color: 'from-indigo-500 to-blue-600',
    badgeClass: 'bg-indigo-500/15 text-indigo-500 border-indigo-500/30',
  },
  {
    key: 'isKidsFavorite',
    label: "Kids' Favorite",
    desc: 'Mild spices, delicious taste loved by younger guests',
    icon: '👶',
    color: 'from-sky-500 to-blue-500',
    badgeClass: 'bg-sky-500/15 text-sky-500 border-sky-500/30',
  },
];

// Helper: Check if item qualifies for Automatic Best Seller
export function checkIsBestSeller(item: MenuItem, allItems?: MenuItem[]): boolean {
  const raw = item as any;
  const orders = Number(raw.orderCount || raw.totalOrders || raw.salesCount || 0);
  const rating = Number(raw.averageRating || raw.rating || 0);
  const reviews = Number(raw.totalReviews || raw.reviewsCount || 0);

  // 1. Explicit high orders threshold
  if (orders >= 5) return true;

  // 2. High rating with verified review count
  if (rating >= 4.5 && reviews >= 3) return true;

  // 3. Top 15% of restaurant catalog if enough items exist
  if (allItems && allItems.length >= 4) {
    const sorted = [...allItems].sort((a: any, b: any) =>
      Number(b.orderCount || b.totalOrders || 0) - Number(a.orderCount || a.totalOrders || 0)
    );
    const topCount = Math.max(1, Math.floor(allItems.length * 0.15));
    const isTop = sorted.slice(0, topCount).some((topItem) => topItem.id === item.id);
    if (isTop && orders > 0) return true;
  }

  // Legacy fallback if previously tagged
  return Boolean(item.isBestSeller);
}

// Helper: Check if item qualifies for Automatic New Arrival (within 14 days)
export function checkIsNewArrival(item: MenuItem): boolean {
  const raw = item as any;
  const created = item.createdAt || raw.submittedAt;
  if (!created) return Boolean(item.isNew);

  const dateObj =
    created instanceof Date
      ? created
      : (created as any)?.toDate
      ? (created as any).toDate()
      : new Date(created);

  if (isNaN(dateObj.getTime())) return Boolean(item.isNew);

  const ageInDays = (Date.now() - dateObj.getTime()) / (1000 * 60 * 60 * 24);
  return ageInDays >= 0 && ageInDays <= 14;
}

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

  // Layout View Switcher (Grid vs List)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [dietFilter, setDietFilter] = useState<'all' | 'veg' | 'non-veg' | 'bestseller' | 'special'>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'in-stock' | 'out-of-stock'>('all');

  // Images state
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState('');

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

  // Add-on / Size variant creators inside dialog
  const [newAddOnName, setNewAddOnName] = useState('');
  const [newAddOnPrice, setNewAddOnPrice] = useState('');
  const [newSizeName, setNewSizeName] = useState('');
  const [newSizePrice, setNewSizePrice] = useState('');

  // Form State
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
    // Curated Special Badges (manually selected)
    isChefSpecial: false,
    isMustTry: false,
    isTrending: false,
    isHealthyChoice: false,
    isSeasonalSpecial: false,
    isLimitedEdition: false,
    isHouseSpecialty: false,
    isKidsFavorite: false,
    // Takeaway & Pickup
    isPickupAvailable: true,
    pickupPrepTime: '20',
    packagingFee: '0',
    addOns: [] as { name: string; price: number }[],
    sizes: [] as { name: string; price: number }[],
    // Nutrition & Dietary
    protein: '',
    carbs: '',
    fat: '',
    ingredients: '',
    portionSize: '',
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

    const remainingSlots = 5 - imagePreviews.length;
    if (remainingSlots <= 0) {
      toast.warning('Maximum 5 images allowed per menu item');
      return;
    }

    const newFiles = files.slice(0, remainingSlots);
    setImageFiles((prev) => [...prev, ...newFiles]);

    newFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setImagePreviews((prev) => [...prev, reader.result as string]);
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
    setImagePreviews((prev) => [...prev, trimmed]);
    setImageUrlInput('');
    toast.success('Image URL added');
  };

  const removeImage = (index: number) => {
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadAllImagesToCloudinary = async (files: File[]): Promise<string[]> => {
    if (files.length === 0) return [];

    const uploadedUrls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadStatus(`Uploading photo ${i + 1} of ${files.length} to Cloudinary...`);
      try {
        const cdnUrl = await uploadToCloudinary(file);
        if (cdnUrl && cdnUrl.startsWith('http')) {
          uploadedUrls.push(cdnUrl);
        } else {
          throw new Error('Invalid Cloudinary response URL');
        }
      } catch (err: any) {
        console.error(`[Menu] Cloudinary upload error for image ${i + 1}:`, err);
        throw new Error(`Failed to upload image "${file.name}": ${err?.message || 'Network error'}`);
      }
    }
    return uploadedUrls;
  };

  const resetFormState = () => {
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
      isChefSpecial: false,
      isMustTry: false,
      isTrending: false,
      isHealthyChoice: false,
      isSeasonalSpecial: false,
      isLimitedEdition: false,
      isHouseSpecialty: false,
      isKidsFavorite: false,
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
      isChefSpecial: Boolean(rawAny.isChefSpecial),
      isMustTry: Boolean(rawAny.isMustTry),
      isTrending: Boolean(rawAny.isTrending),
      isHealthyChoice: Boolean(rawAny.isHealthyChoice),
      isSeasonalSpecial: Boolean(rawAny.isSeasonalSpecial),
      isLimitedEdition: Boolean(rawAny.isLimitedEdition),
      isHouseSpecialty: Boolean(rawAny.isHouseSpecialty),
      isKidsFavorite: Boolean(rawAny.isKidsFavorite),
      isPickupAvailable: rawAny.isPickupAvailable !== false,
      pickupPrepTime: (rawAny.pickupPrepTime || 20).toString(),
      packagingFee: (rawAny.packagingFee || 0).toString(),
      addOns: rawAny.addOns || rawAny.addons || [],
      sizes: rawAny.sizes || [],
      protein: rawAny.nutrition?.protein ? rawAny.nutrition.protein.toString() : '',
      carbs: rawAny.nutrition?.carbs ? rawAny.nutrition.carbs.toString() : '',
      fat: rawAny.nutrition?.fat ? rawAny.nutrition.fat.toString() : '',
      ingredients: Array.isArray(rawAny.ingredients) ? rawAny.ingredients.join(', ') : rawAny.ingredients || '',
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
      toast.error('You must be logged in to manage menu items');
      return;
    }

    if (!newItem.name.trim() || !newItem.price.trim() || !newItem.category.trim()) {
      toast.error('Please enter Dish Name, Category, and Price');
      return;
    }

    if (imagePreviews.length === 0 && imageFiles.length === 0) {
      toast.error('Please add at least one dish photo');
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

      // 1. Upload local files to Cloudinary
      let newlyUploadedCloudinaryUrls: string[] = [];
      if (imageFiles.length > 0) {
        newlyUploadedCloudinaryUrls = await uploadAllImagesToCloudinary(imageFiles);
      }

      // 2. Existing remote URLs
      const existingRemoteUrls = imagePreviews.filter(
        (url) =>
          (url.startsWith('http://') || url.startsWith('https://')) &&
          !url.startsWith('data:image/')
      );

      const finalImageUrls = Array.from(new Set([...newlyUploadedCloudinaryUrls, ...existingRemoteUrls]));
      if (finalImageUrls.length === 0 && imagePreviews.length > 0) {
        finalImageUrls.push(imagePreviews[0]);
      }

      if (finalImageUrls.length === 0) {
        toast.error('Please select an image file to upload');
        return;
      }

      setUploadStatus('Saving dish details...');

      const tagArray = newItem.tags
        ? newItem.tags.split(',').map((t) => t.trim()).filter(Boolean)
        : [];
      const allergenArray = newItem.allergens
        ? newItem.allergens.split(',').map((a) => a.trim()).filter(Boolean)
        : [];

      const resolvedRestaurantId = restaurant?.id || user.restaurantId || user.uid;

      // Automatic system calculations
      const existingItem = editingId ? menuItems.find((m) => m.id === editingId) : null;
      const isAutoBestseller = existingItem ? checkIsBestSeller(existingItem, menuItems) : false;
      const isAutoNewArrival = existingItem ? checkIsNewArrival(existingItem) : true;

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
        // Automatic dynamic badges
        isBestSeller: isAutoBestseller,
        isNew: isAutoNewArrival,
        // Curated special badges
        isChefSpecial: Boolean(newItem.isChefSpecial),
        isMustTry: Boolean(newItem.isMustTry),
        isTrending: Boolean(newItem.isTrending),
        isHealthyChoice: Boolean(newItem.isHealthyChoice),
        isSeasonalSpecial: Boolean(newItem.isSeasonalSpecial),
        isLimitedEdition: Boolean(newItem.isLimitedEdition),
        isHouseSpecialty: Boolean(newItem.isHouseSpecialty),
        isKidsFavorite: Boolean(newItem.isKidsFavorite),
        // Takeaway / Pickup
        isPickupAvailable: Boolean(newItem.isPickupAvailable),
        pickupPrepTime: parseInt(newItem.pickupPrepTime) || 20,
        packagingFee: parseFloat(newItem.packagingFee) || 0,
        addOns: newItem.addOns || [],
        addons: newItem.addOns || [],
        sizes: newItem.sizes || [],
        restaurantId: resolvedRestaurantId,
        ownerId: user.uid,
        restaurantName: restaurant?.name || 'Restaurant',
        approvalStatus: 'approved',
        isLive: true,
        updatedAt: new Date(),
        nutrition: {
          protein: parseFloat(newItem.protein) || null,
          carbs: parseFloat(newItem.carbs) || null,
          fat: parseFloat(newItem.fat) || null,
        },
        ingredients: newItem.ingredients
          ? newItem.ingredients.split(',').map((i: string) => i.trim()).filter(Boolean)
          : [],
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
        if (!isNaN(cal)) cleanItemData.calories = cal;
      }

      if (editingId) {
        await updateDoc(doc(db, 'menuItems', editingId), cleanItemData);
        try {
          await setDoc(doc(db, 'restaurants', resolvedRestaurantId, 'menuItems', editingId), cleanItemData, { merge: true });
        } catch (_) {}

        toast.success(`"${cleanItemData.name}" updated successfully!`);
        setMenuItems((prev) =>
          prev.map((item) => (item.id === editingId ? ({ ...item, ...cleanItemData, id: editingId } as MenuItem) : item))
        );
      } else {
        const docRef = await addDoc(collection(db, 'menuItems'), {
          ...cleanItemData,
          createdAt: new Date(),
          submittedAt: new Date(),
        });

        try {
          await setDoc(doc(db, 'restaurants', resolvedRestaurantId, 'menuItems', docRef.id), {
            ...cleanItemData,
            createdAt: new Date(),
          });
        } catch (_) {}

        toast.success(`"${cleanItemData.name}" added to menu and is now live!`);
        setMenuItems((prev) => [{ ...cleanItemData, id: docRef.id, createdAt: new Date() } as MenuItem, ...prev]);
      }

      resetFormState();
      setDialogOpen(false);
      fetchMenuItems();
      setSuccessDialog(true);
    } catch (error: any) {
      console.error('[Menu] Error saving item:', error);
      toast.error(`Save failed: ${error?.message || 'Network error'}`);
    } finally {
      setSubmitting(false);
      setUploadStatus(null);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this dish from your menu?')) return;

    try {
      const resolvedRestaurantId = restaurant?.id || user?.restaurantId || user?.uid || '';
      await deleteDoc(doc(db, 'menuItems', itemId));
      if (resolvedRestaurantId) {
        try {
          await deleteDoc(doc(db, 'restaurants', resolvedRestaurantId, 'menuItems', itemId));
        } catch (_) {}
      }
      setMenuItems((prev) => prev.filter((item) => item.id !== itemId));
      toast.success('Dish removed from menu');
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
      setMenuItems((prev) => prev.map((m) => (m.id === item.id ? { ...m, available: newStatus } : m)));
      toast.success(`${item.name} is now ${newStatus ? 'In Stock (Live)' : 'Marked Out of Stock'}`);
    } catch (e) {
      toast.error('Could not update availability');
    }
  };

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

      if (pickupSettings.applyToAllItems && menuItems.length > 0) {
        const updatePromises = menuItems.map((item) =>
          updateDoc(doc(db, 'menuItems', item.id), {
            isPickupAvailable: pickupSettings.isPickupEnabled,
            pickupPrepTime: pickupSettings.defaultPickupTime,
            packagingFee: pickupSettings.packagingFee,
          }).catch(() => {})
        );
        await Promise.all(updatePromises);
        setMenuItems((prev) =>
          prev.map((m) => ({
            ...m,
            isPickupAvailable: pickupSettings.isPickupEnabled,
            pickupPrepTime: pickupSettings.defaultPickupTime,
            packagingFee: pickupSettings.packagingFee,
          } as any))
        );
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

  // Add-on & size helpers
  const handleAddCustomAddOn = () => {
    if (!newAddOnName.trim()) return;
    const price = parseFloat(newAddOnPrice) || 0;
    setNewItem((prev) => ({
      ...prev,
      addOns: [...prev.addOns, { name: newAddOnName.trim(), price }],
    }));
    setNewAddOnName('');
    setNewAddOnPrice('');
  };

  const handleRemoveAddOn = (index: number) => {
    setNewItem((prev) => ({
      ...prev,
      addOns: prev.addOns.filter((_, i) => i !== index),
    }));
  };

  const handleAddSizeVariant = () => {
    if (!newSizeName.trim()) return;
    const price = parseFloat(newSizePrice) || 0;
    setNewItem((prev) => ({
      ...prev,
      sizes: [...prev.sizes, { name: newSizeName.trim(), price }],
    }));
    setNewSizeName('');
    setNewSizePrice('');
  };

  const handleRemoveSize = (index: number) => {
    setNewItem((prev) => ({
      ...prev,
      sizes: prev.sizes.filter((_, i) => i !== index),
    }));
  };

  // Badges resolver for each dish
  const getDishBadges = (item: MenuItem) => {
    const rawAny = item as any;
    const badges: { label: string; icon: string; className: string }[] = [];

    // 1. Automatic Dynamic Badges (Calculated automatically for qualifying special items)
    if (checkIsBestSeller(item, menuItems)) {
      badges.push({
        label: 'BESTSELLER',
        icon: '⭐',
        className: 'bg-gradient-to-r from-amber-500 to-yellow-500 text-amber-950 font-black shadow-sm shadow-amber-500/30',
      });
    }

    if (checkIsNewArrival(item)) {
      badges.push({
        label: 'NEW ARRIVAL',
        icon: '✨',
        className: 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-extrabold shadow-sm shadow-blue-500/30',
      });
    }

    // 2. Curated Badges (Assigned manually by restaurant to special items)
    if (rawAny.isChefSpecial) {
      badges.push({
        label: "CHEF'S SPECIAL",
        icon: '👨‍🍳',
        className: 'bg-gradient-to-r from-rose-600 to-pink-500 text-white font-extrabold shadow-sm shadow-rose-500/20',
      });
    }

    if (rawAny.isMustTry) {
      badges.push({
        label: 'MUST TRY',
        icon: '🔥',
        className: 'bg-gradient-to-r from-orange-600 to-amber-500 text-white font-extrabold shadow-sm shadow-orange-500/20',
      });
    }

    if (rawAny.isTrending) {
      badges.push({
        label: 'TRENDING',
        icon: '⚡',
        className: 'bg-gradient-to-r from-violet-600 to-purple-500 text-white font-extrabold shadow-sm shadow-violet-500/20',
      });
    }

    if (rawAny.isHealthyChoice) {
      badges.push({
        label: 'HEALTHY',
        icon: '🥗',
        className: 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-extrabold shadow-sm shadow-emerald-500/20',
      });
    }

    if (rawAny.isSeasonalSpecial) {
      badges.push({
        label: 'SEASONAL',
        icon: '🌟',
        className: 'bg-gradient-to-r from-amber-600 to-yellow-500 text-white font-extrabold shadow-sm shadow-amber-500/20',
      });
    }

    if (rawAny.isLimitedEdition) {
      badges.push({
        label: 'LIMITED BATCH',
        icon: '⏳',
        className: 'bg-zinc-800 text-amber-300 border border-amber-400/40 font-extrabold',
      });
    }

    if (rawAny.isHouseSpecialty) {
      badges.push({
        label: 'HOUSE SPECIAL',
        icon: '👑',
        className: 'bg-gradient-to-r from-indigo-600 to-blue-500 text-white font-extrabold shadow-sm shadow-indigo-500/20',
      });
    }

    if (rawAny.isKidsFavorite) {
      badges.push({
        label: "KIDS' FAVORITE",
        icon: '👶',
        className: 'bg-gradient-to-r from-sky-500 to-blue-400 text-white font-extrabold shadow-sm shadow-sky-500/20',
      });
    }

    return badges;
  };

  // Filter items
  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      const rawAny = item as any;
      const isVeg = item.vegetarian || rawAny.foodType === 'veg' || rawAny.foodType === 'vegan';

      // Search match
      const queryMatch =
        searchQuery.trim() === '' ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!queryMatch) return false;

      // Category filter
      if (selectedCategoryFilter !== 'all' && item.category !== selectedCategoryFilter) {
        return false;
      }

      // Dietary & Special filter
      if (dietFilter === 'veg' && !isVeg) return false;
      if (dietFilter === 'non-veg' && isVeg) return false;
      if (dietFilter === 'bestseller' && !checkIsBestSeller(item, menuItems)) return false;
      if (dietFilter === 'special' && !(rawAny.isChefSpecial || rawAny.isMustTry || rawAny.isTrending || rawAny.isHouseSpecialty)) return false;

      // Stock filter
      const inStock = item.available !== false;
      if (stockFilter === 'in-stock' && !inStock) return false;
      if (stockFilter === 'out-of-stock' && inStock) return false;

      return true;
    });
  }, [menuItems, searchQuery, selectedCategoryFilter, dietFilter, stockFilter]);

  const existingCategories = Array.from(new Set(menuItems.map((item) => item.category).filter(Boolean)));
  const categoriesInFiltered = Array.from(new Set(filteredItems.map((item) => item.category).filter(Boolean)));

  const filteredCategoriesForDialog = POPULAR_CATEGORIES.filter((cat) =>
    cat.name.toLowerCase().includes(categorySearchQuery.toLowerCase())
  );

  // Statistics
  const totalDishes = menuItems.length;
  const inStockCount = menuItems.filter((m) => m.available !== false).length;
  const outOfStockCount = totalDishes - inStockCount;
  const bestSellersCount = menuItems.filter((m) => checkIsBestSeller(m, menuItems)).length;
  const takeawayCount = menuItems.filter((m) => (m as any).isPickupAvailable !== false).length;

  if (authLoading || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
        <div className="w-16 h-16 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center animate-pulse">
          <Utensils className="w-8 h-8 text-primary" />
        </div>
        <p className="text-muted-foreground font-semibold text-sm tracking-wide">Loading Menu Studio...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-4 md:p-8">
      {/* ── HERO & KPI STATS BAR ────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl p-6 md:p-8 border border-border/80 bg-gradient-to-br from-card via-card/90 to-background shadow-xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <Badge className="bg-primary/10 hover:bg-primary/15 text-primary border border-primary/25 px-3 py-1 font-bold text-xs rounded-full gap-1.5 shadow-xs">
                <Store className="w-3.5 h-3.5" />
                {restaurant?.name || 'Hunger Partner Kitchen'}
              </Badge>
              <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 bg-emerald-500/10 font-bold text-xs rounded-full px-2.5 py-0.5">
                ● Live Catalog
              </Badge>
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-foreground tracking-tight">
              Menu <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-orange-500 to-amber-500">Studio</span>
            </h1>
            <p className="text-muted-foreground text-sm md:text-base max-w-2xl leading-relaxed">
              Manage your culinary creations, automatic algorithm badges, custom pricing, dietary classifications, and express takeaway availability.
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setPickupDialogOpen(true)}
              className="h-12 px-5 rounded-2xl gap-2 border-border/80 bg-card hover:bg-muted font-bold text-foreground transition-all shadow-sm hover:shadow"
            >
              <ShoppingBag className="w-4 h-4 text-primary" />
              Pickup Settings
            </Button>

            <Button
              onClick={() => {
                resetFormState();
                setDialogOpen(true);
              }}
              className="h-12 px-6 rounded-2xl gap-2.5 bg-gradient-to-r from-primary to-orange-500 text-primary-foreground hover:opacity-95 font-black text-base shadow-lg shadow-primary/25 transition-all hover:scale-105 active:scale-95"
            >
              <Plus className="w-5 h-5 stroke-[2.5]" />
              Add New Menu Item
            </Button>
          </div>
        </div>

        {/* Quick KPI Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 md:gap-4 mt-8 pt-6 border-t border-border/60">
          <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/60">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Total Dishes</p>
            <p className="text-2xl font-black text-foreground mt-0.5 font-mono">{totalDishes}</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">In Stock</p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">{inStockCount}</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20">
            <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Out of Stock</p>
            <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-0.5 font-mono">{outOfStockCount}</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> Bestsellers
            </p>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5 font-mono">{bestSellersCount}</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 col-span-2 sm:col-span-1">
            <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1">
              <ShoppingBag className="w-3 h-3" /> Takeaway
            </p>
            <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-0.5 font-mono">{takeawayCount}</p>
          </div>
        </div>
      </div>

      {/* ── SEARCH, FILTER & VIEW CONTROLS ──────────────────────────────── */}
      <div className="sticky top-2 z-20 space-y-3 bg-background/90 backdrop-blur-2xl p-4 rounded-3xl border border-border/80 shadow-md">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search dishes by name, ingredients, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-card border-border/80 h-11 pl-11 pr-10 rounded-2xl text-foreground placeholder:text-muted-foreground text-sm font-medium focus:border-primary shadow-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Filter Selectors & View Mode Switcher */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            {/* Dietary Filter */}
            <div className="flex items-center p-1 bg-muted/40 border border-border/80 rounded-2xl">
              {[
                { id: 'all', label: 'All' },
                { id: 'veg', label: '🟢 Veg' },
                { id: 'non-veg', label: '🔴 Non-Veg' },
                { id: 'bestseller', label: '⭐ Bestseller' },
                { id: 'special', label: '👨‍🍳 Special' },
              ].map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDietFilter(d.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    dietFilter === d.id
                      ? 'bg-card text-foreground shadow-xs border border-border/80'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>

            {/* In-Stock Filter */}
            <div className="flex items-center p-1 bg-muted/40 border border-border/80 rounded-2xl">
              {[
                { id: 'all', label: 'All Stock' },
                { id: 'in-stock', label: 'In Stock' },
                { id: 'out-of-stock', label: 'Out of Stock' },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStockFilter(s.id as any)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    stockFilter === s.id
                      ? 'bg-card text-foreground shadow-xs border border-border/80'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center p-1 bg-muted/40 border border-border/80 rounded-2xl">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-xl text-xs font-bold transition-all ${
                  viewMode === 'grid'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Grid Cards View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-xl text-xs font-bold transition-all ${
                  viewMode === 'list'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="List Accordion View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Category Horizontal Filter Pills */}
        {existingCategories.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pt-1 no-scrollbar">
            <button
              onClick={() => setSelectedCategoryFilter('all')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 border ${
                selectedCategoryFilter === 'all'
                  ? 'bg-foreground text-background border-foreground shadow-sm'
                  : 'bg-card border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              All Categories ({menuItems.length})
            </button>
            {existingCategories.map((cat) => {
              const count = menuItems.filter((m) => m.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategoryFilter(cat)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 border flex items-center gap-1.5 ${
                    selectedCategoryFilter === cat
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-card border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span>{cat}</span>
                  <span className="text-[10px] opacity-75 font-mono">({count})</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── MENU ITEMS DISPLAY ────────────────────────────────────────── */}
      {filteredItems.length === 0 ? (
        <Card className="py-24 text-center bg-card border-border/80 border-dashed rounded-3xl group shadow-sm">
          <div className="w-20 h-20 mx-auto bg-primary/10 rounded-3xl flex items-center justify-center mb-5 ring-1 ring-primary/20">
            <Utensils className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-2xl font-black text-foreground mb-2">No Dishes Match Your Search</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto text-sm leading-relaxed">
            {searchQuery || dietFilter !== 'all' || stockFilter !== 'all' || selectedCategoryFilter !== 'all'
              ? 'Try resetting your search query or filters to view all menu items.'
              : 'Your culinary catalog is currently empty. Add your first signature dish to start receiving live orders!'}
          </p>
          <div className="flex justify-center gap-3">
            {(searchQuery || dietFilter !== 'all' || stockFilter !== 'all' || selectedCategoryFilter !== 'all') && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery('');
                  setDietFilter('all');
                  setStockFilter('all');
                  setSelectedCategoryFilter('all');
                }}
                className="rounded-2xl px-6 h-11 text-xs font-bold"
              >
                Reset Filters
              </Button>
            )}
            <Button
              onClick={() => {
                resetFormState();
                setDialogOpen(true);
              }}
              className="bg-primary text-primary-foreground font-black rounded-2xl px-7 h-11 text-xs shadow-lg hover:bg-primary/90"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add First Dish
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {categoriesInFiltered.map((category) => {
            const categoryItems = filteredItems.filter((item) => item.category === category);
            const isExpanded = expandedCategory === category || categoriesInFiltered.length === 1;

            return (
              <div
                key={category}
                className="overflow-hidden rounded-3xl border border-border/80 bg-card/70 backdrop-blur-xl transition-all shadow-md"
              >
                {/* Category Header */}
                <button
                  onClick={() => setExpandedCategory(isExpanded ? null : category)}
                  className="w-full p-5 md:p-6 flex items-center justify-between bg-card hover:bg-muted/15 transition-colors border-b border-border/60"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-2 h-9 rounded-full bg-gradient-to-b from-primary to-orange-500" />
                    <div className="text-left">
                      <div className="flex items-center gap-2.5">
                        <h3 className="font-black text-foreground text-xl md:text-2xl tracking-tight">
                          {category}
                        </h3>
                        <Badge variant="outline" className="text-xs font-mono font-bold bg-muted/40 border-border">
                          {categoryItems.length} {categoryItems.length === 1 ? 'item' : 'items'}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-xs mt-0.5">
                        {categoryItems.filter((i) => i.available !== false).length} currently in stock
                      </p>
                    </div>
                  </div>
                  <div
                    className={`w-10 h-10 rounded-2xl border border-border flex items-center justify-center bg-muted/40 transition-transform duration-300 ${
                      isExpanded ? 'rotate-180 bg-primary/10 text-primary border-primary/30' : 'text-muted-foreground'
                    }`}
                  >
                    <ChevronDown className="w-5 h-5" />
                  </div>
                </button>

                {/* Items in Category */}
                {isExpanded && (
                  <div className="p-4 md:p-6">
                    {viewMode === 'grid' ? (
                      /* ── GRID CARDS VIEW ──────────────────────────────── */
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {categoryItems.map((item) => {
                          const rawAny = item as any;
                          const isVeg = item.vegetarian || rawAny.foodType === 'veg' || rawAny.foodType === 'vegan';
                          const originalPrice = rawAny.originalPrice;
                          const badges = getDishBadges(item);
                          const isInStock = item.available !== false;

                          return (
                            <div
                              key={item.id}
                              className={`group relative rounded-3xl overflow-hidden border transition-all duration-300 flex flex-col justify-between bg-card hover:shadow-xl ${
                                isInStock
                                  ? 'border-border/80 hover:border-primary/40'
                                  : 'border-border/60 opacity-80 bg-muted/20'
                              }`}
                            >
                              <div>
                                {/* Dish Image Container */}
                                <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
                                  {item.image ? (
                                    <img
                                      src={item.image}
                                      alt={item.name}
                                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-muted">
                                      <ImageIcon className="w-12 h-12 text-muted-foreground" />
                                    </div>
                                  )}

                                  {/* Top Left Veg / Non-Veg Icon */}
                                  <div className="absolute top-3 left-3 z-10">
                                    <span
                                      className={`w-6 h-6 rounded-lg bg-card/95 backdrop-blur-md border flex items-center justify-center shadow-md ${
                                        isVeg ? 'border-emerald-600' : 'border-red-600'
                                      }`}
                                      title={isVeg ? 'Vegetarian Dish' : 'Non-Vegetarian Dish'}
                                    >
                                      <span
                                        className={`w-3 h-3 rounded-full ${
                                          isVeg ? 'bg-emerald-600' : 'bg-red-600'
                                        }`}
                                      />
                                    </span>
                                  </div>

                                  {/* Badges on Top Right Image */}
                                  <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-1.5 max-w-[70%]">
                                    {badges.map((b, idx) => (
                                      <span
                                        key={idx}
                                        className={`px-2.5 py-1 rounded-full text-[10px] tracking-wider uppercase flex items-center gap-1 ${b.className}`}
                                      >
                                        <span>{b.icon}</span>
                                        <span>{b.label}</span>
                                      </span>
                                    ))}
                                  </div>

                                  {/* Bottom Gradient overlay */}
                                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/75 to-transparent pointer-events-none" />

                                  {/* Bottom Overlay Price */}
                                  <div className="absolute bottom-2.5 left-3 right-3 flex items-baseline justify-between z-10 text-white">
                                    <div className="flex items-baseline gap-2">
                                      <span className="text-xl font-black font-mono tracking-tight drop-shadow-md">
                                        ₹{item.price}
                                      </span>
                                      {originalPrice && originalPrice > item.price && (
                                        <span className="text-xs line-through text-white/70 font-mono">
                                          ₹{originalPrice}
                                        </span>
                                      )}
                                    </div>
                                    {originalPrice && originalPrice > item.price && (
                                      <span className="text-[10px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded-full shadow-sm">
                                        {Math.round(((originalPrice - item.price) / originalPrice) * 100)}% OFF
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Content Details */}
                                <div className="p-4 space-y-3">
                                  <div>
                                    <h4 className="font-black text-foreground text-base tracking-tight group-hover:text-primary transition-colors line-clamp-1">
                                      {item.name}
                                    </h4>
                                    <p className="text-muted-foreground text-xs line-clamp-2 mt-1 leading-relaxed">
                                      {item.description || 'Freshly prepared signature dish.'}
                                    </p>
                                  </div>

                                  {/* Meta tags */}
                                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-muted-foreground">
                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-muted/60 border border-border/60">
                                      <Clock className="w-3 h-3 text-primary" /> {item.preparationTime || 30}m
                                    </span>
                                    {item.servings && (
                                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-muted/60 border border-border/60">
                                        <Users className="w-3 h-3" /> Serves {item.servings}
                                      </span>
                                    )}
                                    {rawAny.isPickupAvailable && (
                                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                                        <ShoppingBag className="w-3 h-3" /> Takeaway
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Footer Card Actions */}
                              <div className="p-4 pt-2 border-t border-border/60 flex items-center justify-between gap-2">
                                {/* Fast Stock Switch */}
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={isInStock}
                                    onCheckedChange={() => handleToggleItemAvailability(item)}
                                    aria-label="Toggle dish stock availability"
                                  />
                                  <span className={`text-xs font-bold ${isInStock ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                                    {isInStock ? 'In Stock' : 'Out of Stock'}
                                  </span>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center gap-1.5">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteItem(item.id || '')}
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl"
                                    title="Delete dish"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEditItem(item)}
                                    className="h-8 px-3 rounded-xl text-xs font-bold border-border/80 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all"
                                  >
                                    <Edit2 className="w-3 h-3 mr-1" /> Edit
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* ── COMPACT LIST VIEW ────────────────────────────── */
                      <div className="space-y-3">
                        {categoryItems.map((item) => {
                          const rawAny = item as any;
                          const isVeg = item.vegetarian || rawAny.foodType === 'veg' || rawAny.foodType === 'vegan';
                          const originalPrice = rawAny.originalPrice;
                          const badges = getDishBadges(item);
                          const isInStock = item.available !== false;

                          return (
                            <div
                              key={item.id}
                              className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-card hover:bg-muted/15 ${
                                isInStock ? 'border-border/80' : 'border-border/60 opacity-80'
                              }`}
                            >
                              <div className="flex items-center gap-4 min-w-0 flex-1">
                                {/* Thumbnail */}
                                <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-muted border border-border">
                                  {item.image ? (
                                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <ImageIcon className="w-6 h-6 m-auto text-muted-foreground" />
                                  )}
                                  <span
                                    className={`absolute top-1 left-1 w-3 h-3 rounded-full border border-card ${
                                      isVeg ? 'bg-emerald-600' : 'bg-red-600'
                                    }`}
                                  />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2 mb-0.5">
                                    <h4 className="font-bold text-foreground text-sm truncate">{item.name}</h4>
                                    {badges.map((b, idx) => (
                                      <span
                                        key={idx}
                                        className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-bold flex items-center gap-1 ${b.className}`}
                                      >
                                        <span>{b.icon}</span>
                                        <span>{b.label}</span>
                                      </span>
                                    ))}
                                  </div>
                                  <p className="text-muted-foreground text-xs line-clamp-1">{item.description}</p>
                                </div>
                              </div>

                              {/* Price & Actions */}
                              <div className="flex items-center justify-between md:justify-end gap-5 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-border/60">
                                <div className="text-right">
                                  <p className="text-base font-black font-mono text-foreground">₹{item.price}</p>
                                  {originalPrice && originalPrice > item.price && (
                                    <p className="text-[10px] text-muted-foreground line-through font-mono">₹{originalPrice}</p>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={isInStock}
                                    onCheckedChange={() => handleToggleItemAvailability(item)}
                                  />
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEditItem(item)}
                                    className="h-8 px-3 rounded-xl text-xs font-bold"
                                  >
                                    <Edit2 className="w-3 h-3 mr-1" /> Edit
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteItem(item.id || '')}
                                    className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 rounded-xl"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── ADD / EDIT MENU ITEM DIALOG (PREMIUM EXECUTIVE REDESIGN) ───── */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open && !submitting) {
            resetFormState();
          }
          setDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto bg-card border-border text-card-foreground shadow-2xl p-0 gap-0 rounded-3xl">
          {/* Sticky Luxury Header */}
          <div className="sticky top-0 z-30 bg-card/95 backdrop-blur-xl border-b border-border/80 px-6 py-5 flex justify-between items-center">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center text-primary-foreground shadow-md shadow-primary/25">
                {editingId ? <Edit2 className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
              </div>
              <div>
                <DialogTitle className="text-xl md:text-2xl font-black text-foreground tracking-tight">
                  {editingId ? 'Edit Menu Item' : 'Add New Menu Item'}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-xs">
                  High-fidelity photo upload to Cloudinary & real-time catalog synchronization.
                </DialogDescription>
              </div>
            </div>

            <button
              onClick={() => setDialogOpen(false)}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Tabs */}
          <div className="p-6 md:p-8 space-y-6">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="bg-muted/40 border border-border/80 p-1.5 rounded-2xl w-full grid grid-cols-5 gap-1.5 mb-6">
                <TabsTrigger value="basic" className="rounded-xl py-2.5 font-bold text-xs md:text-sm data-[state=checked]:bg-card data-[state=checked]:shadow-xs">
                  1. Basic Details
                </TabsTrigger>
                <TabsTrigger value="options" className="rounded-xl py-2.5 font-bold text-xs md:text-sm data-[state=checked]:bg-card data-[state=checked]:shadow-xs">
                  2. Portions & Extras
                </TabsTrigger>
                <TabsTrigger value="badges" className="rounded-xl py-2.5 font-bold text-xs md:text-sm data-[state=checked]:bg-card data-[state=checked]:shadow-xs text-amber-600 dark:text-amber-400">
                  3. Badges & Tags
                </TabsTrigger>
                <TabsTrigger value="nutrition" className="rounded-xl py-2.5 font-bold text-xs md:text-sm data-[state=checked]:bg-card data-[state=checked]:shadow-xs">
                  4. Nutrition & Diet
                </TabsTrigger>
                <TabsTrigger value="pickup" className="rounded-xl py-2.5 font-bold text-xs md:text-sm data-[state=checked]:bg-card data-[state=checked]:shadow-xs">
                  5. Takeaway
                </TabsTrigger>
              </TabsList>

              {/* ── TAB 1: BASIC DETAILS ────────────────────────────────── */}
              <TabsContent value="basic" className="space-y-6 focus-visible:outline-none">
                {/* Images Upload Section */}
                <div className="space-y-3 p-5 rounded-2xl border border-border/80 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <Label className="text-foreground font-bold flex items-center gap-2 text-sm">
                      <ImageIcon className="w-4 h-4 text-primary" /> Dish Photos (Cloudinary Upload) *
                    </Label>
                    <span className="text-xs text-muted-foreground">PNG, JPG, WEBP (Max 5 photos)</span>
                  </div>

                  {/* Previews grid */}
                  {imagePreviews.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-3">
                      {imagePreviews.map((preview, index) => (
                        <div
                          key={index}
                          className="relative aspect-square rounded-2xl overflow-hidden border border-border/80 shadow-md group"
                        >
                          <img
                            src={preview}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute top-1.5 right-1.5 p-1.5 bg-black/70 hover:bg-destructive text-white rounded-full transition-colors shadow-sm"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          {index === 0 && (
                            <span className="absolute bottom-1.5 left-1.5 bg-primary text-primary-foreground text-[9px] font-black uppercase px-2 py-0.5 rounded-md shadow-xs">
                              Cover
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload controls */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <label className="flex-1 border-2 border-dashed border-primary/30 hover:border-primary/60 bg-card rounded-2xl p-4 flex items-center justify-center gap-3 cursor-pointer transition-colors text-center group">
                      <Upload className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                      <div>
                        <p className="text-xs font-bold text-foreground">Select photos from computer</p>
                        <p className="text-[10px] text-muted-foreground">Uploads straight to Cloudinary CDN</p>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </label>

                    {/* Or URL input */}
                    <div className="flex gap-2 sm:w-1/2">
                      <Input
                        placeholder="Or paste image URL (https://...)"
                        value={imageUrlInput}
                        onChange={(e) => setImageUrlInput(e.target.value)}
                        className="bg-card border-border/80 text-xs rounded-2xl h-auto"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleAddImageUrl}
                        className="rounded-2xl text-xs font-bold px-4"
                      >
                        Add URL
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Name & Category */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">Dish Name *</Label>
                    <Input
                      placeholder="e.g. Royal Chicken Dum Biryani"
                      value={newItem.name}
                      onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                      className="bg-card border-border/80 h-11 rounded-2xl font-semibold text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">Category *</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="e.g. Biryani & Rice"
                        value={newItem.category}
                        onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                        className="bg-card border-border/80 h-11 rounded-2xl text-sm font-semibold flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setCategoryDialogOpen(true)}
                        className="h-11 px-4 rounded-2xl border-border/80 text-xs font-bold gap-1.5 shrink-0"
                      >
                        <Layers className="w-3.5 h-3.5 text-primary" /> Choose
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Pricing: Selling Price & Original Price */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 rounded-2xl border border-border/80 bg-muted/20">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">Selling Price (₹) *</Label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-primary font-black text-sm">₹</span>
                      <Input
                        type="number"
                        placeholder="299"
                        value={newItem.price}
                        onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                        className="bg-card border-border/80 h-11 pl-8 rounded-2xl text-sm font-mono font-bold"
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground">Price customer actually pays at checkout</span>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">Original / MRP Price (₹) (Optional)</Label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">₹</span>
                      <Input
                        type="number"
                        placeholder="399"
                        value={newItem.originalPrice}
                        onChange={(e) => setNewItem({ ...newItem, originalPrice: e.target.value })}
                        className="bg-card border-border/80 h-11 pl-8 rounded-2xl text-sm font-mono"
                      />
                    </div>
                    {newItem.originalPrice && parseFloat(newItem.originalPrice) > parseFloat(newItem.price || '0') && (
                      <span className="text-[11px] font-bold text-emerald-500">
                        {Math.round(
                          ((parseFloat(newItem.originalPrice) - parseFloat(newItem.price || '0')) /
                            parseFloat(newItem.originalPrice)) *
                            100
                        )}
                        % Strike-through Discount displayed to customers!
                      </span>
                    )}
                  </div>
                </div>

                {/* Dietary Food Type Selector */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-foreground">Dietary Classification *</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { id: 'veg', label: 'Vegetarian', icon: '🟢', desc: '100% Pure Veg' },
                      { id: 'non-veg', label: 'Non-Veg', icon: '🔴', desc: 'Chicken / Mutton / Fish' },
                      { id: 'egg', label: 'Contains Egg', icon: '🥚', desc: 'Egg-based items' },
                      { id: 'vegan', label: 'Vegan', icon: '🌱', desc: 'Dairy-free plant diet' },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() =>
                          setNewItem({
                            ...newItem,
                            foodType: f.id,
                            isVegetarian: f.id === 'veg' || f.id === 'vegan',
                          })
                        }
                        className={`p-3 rounded-2xl border text-left transition-all ${
                          newItem.foodType === f.id
                            ? 'bg-primary/10 border-primary shadow-xs ring-1 ring-primary'
                            : 'bg-card border-border/80 hover:bg-muted/40'
                        }`}
                      >
                        <span className="text-lg">{f.icon}</span>
                        <p className="font-bold text-xs text-foreground mt-1">{f.label}</p>
                        <p className="text-[10px] text-muted-foreground">{f.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">Dish Story & Description</Label>
                  <Textarea
                    placeholder="Describe aroma, preparation style, key spices, or serving recommendation..."
                    value={newItem.description}
                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                    className="bg-card border-border/80 text-xs rounded-2xl min-h-[90px] leading-relaxed resize-none"
                  />
                </div>
              </TabsContent>

              {/* ── TAB 2: PORTIONS & ADD-ONS ───────────────────────────── */}
              <TabsContent value="options" className="space-y-6 focus-visible:outline-none">
                {/* Size / Portion Variants */}
                <div className="p-5 rounded-2xl border border-border/80 bg-card space-y-4">
                  <div>
                    <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
                      <Layers className="w-4 h-4 text-primary" /> Portion & Size Variants
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Allow customers to pick sizes (e.g., Half, Full, Small, Medium, Large) with incremental pricing.
                    </p>
                  </div>

                  {newItem.sizes.length > 0 && (
                    <div className="space-y-2">
                      {newItem.sizes.map((size, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border text-xs font-bold"
                        >
                          <span className="text-foreground">{size.name}</span>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-primary">
                              {size.price > 0 ? `+₹${size.price}` : 'Base Price'}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveSize(idx)}
                              className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      placeholder="Size Name (e.g. Half / Full / Large)"
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
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add Portion
                    </Button>
                  </div>
                </div>

                {/* Customizable Extras / Add-ons */}
                <div className="p-5 rounded-2xl border border-border/80 bg-card space-y-4">
                  <div>
                    <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
                      <Plus className="w-4 h-4 text-primary" /> Customizable Extras & Add-ons
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Let diners customize with extra cheese, dips, dressings, or toppings.
                    </p>
                  </div>

                  {newItem.addOns.length > 0 && (
                    <div className="space-y-2">
                      {newItem.addOns.map((addon, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border text-xs font-bold"
                        >
                          <span className="text-foreground">{addon.name}</span>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-primary">+₹{addon.price}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveAddOn(idx)}
                              className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      placeholder="Extra Name (e.g. Extra Cheese / Mint Chutney)"
                      value={newAddOnName}
                      onChange={(e) => setNewAddOnName(e.target.value)}
                      className="bg-muted/30 border-border h-10 text-xs rounded-xl flex-1"
                    />
                    <div className="relative w-full sm:w-36">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">+₹</span>
                      <Input
                        type="number"
                        placeholder="40"
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

                {/* Spiciness Level */}
                <div className="space-y-2">
                  <Label className="text-foreground font-bold text-xs">Spice Level</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { id: 'none', label: 'Not Spicy', icon: '🍃' },
                      { id: 'mild', label: 'Mild Spice', icon: '🌶️' },
                      { id: 'medium', label: 'Medium Spice', icon: '🌶️🌶️' },
                      { id: 'hot', label: 'Extra Fiery', icon: '🔥🔥🔥' },
                    ].map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setNewItem({ ...newItem, spiceLevel: s.id, isSpicy: s.id !== 'none' })}
                        className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                          newItem.spiceLevel === s.id
                            ? 'border-red-500 bg-red-500/10 text-red-500 ring-1 ring-red-500'
                            : 'border-border bg-card/60 text-muted-foreground hover:bg-muted/40'
                        }`}
                      >
                        <span>{s.icon}</span>
                        <span>{s.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* ── TAB 3: BADGES & SPECIAL TAGS ───────────────────────── */}
              <TabsContent value="badges" className="space-y-6 focus-visible:outline-none">
                {/* Automatic Badges Informational Card */}
                <div className="p-5 rounded-2xl border border-primary/25 bg-gradient-to-r from-primary/10 via-amber-500/10 to-transparent">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center text-primary shrink-0">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-black text-sm text-foreground flex items-center gap-2">
                        Automatic Performance Badges
                        <Badge className="bg-primary text-primary-foreground text-[10px] font-bold">Auto Intelligence</Badge>
                      </h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        To maintain customer trust, <strong>Best Seller</strong> (awarded automatically to top-selling dishes with 4.5★+ ratings) and <strong>New Arrival</strong> (applied to newly added dishes for their first 14 days) are calculated automatically by the platform algorithm.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Curated Culinary Badges Grid */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-foreground font-black text-sm">
                        Curated Special Badges
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Select special tags to highlight your signature menu items.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {CURATED_BADGES.map((b) => {
                      const isChecked = Boolean((newItem as any)[b.key]);
                      return (
                        <label
                          key={b.key}
                          className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-start gap-3.5 ${
                            isChecked
                              ? 'bg-primary/5 border-primary shadow-xs ring-1 ring-primary/40'
                              : 'bg-muted/20 border-border/80 hover:bg-muted/40'
                          }`}
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(c) => setNewItem({ ...newItem, [b.key]: !!c } as any)}
                            className="mt-0.5 h-5 w-5 data-[state=checked]:bg-primary"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-black text-sm text-foreground flex items-center gap-1.5">
                              <span>{b.icon}</span>
                              <span>{b.label}</span>
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{b.desc}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Stock Live Toggle */}
                <div className="p-4 rounded-2xl border border-border/80 bg-muted/20 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-foreground text-sm">Instant Live Availability</h4>
                    <p className="text-xs text-muted-foreground">
                      Switch off to immediately mark this dish as Out of Stock on customer mobile apps.
                    </p>
                  </div>
                  <Switch
                    checked={newItem.isAvailable}
                    onCheckedChange={(c) => setNewItem({ ...newItem, isAvailable: Boolean(c) })}
                  />
                </div>
              </TabsContent>

              {/* ── TAB 4: NUTRITION & DIET ────────────────────────────── */}
              <TabsContent value="nutrition" className="space-y-6 focus-visible:outline-none">
                {/* Prep Time, Servings, Calories */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">Kitchen Prep Time (mins)</Label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="number"
                        placeholder="30"
                        value={newItem.preparationTime}
                        onChange={(e) => setNewItem({ ...newItem, preparationTime: e.target.value })}
                        className="bg-card border-border/80 h-11 pl-9 rounded-2xl text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">Servings</Label>
                    <div className="relative">
                      <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="number"
                        placeholder="1"
                        value={newItem.servings}
                        onChange={(e) => setNewItem({ ...newItem, servings: e.target.value })}
                        className="bg-card border-border/80 h-11 pl-9 rounded-2xl text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">Calories (kcal)</Label>
                    <div className="relative">
                      <Flame className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="number"
                        placeholder="450"
                        value={newItem.calories}
                        onChange={(e) => setNewItem({ ...newItem, calories: e.target.value })}
                        className="bg-card border-border/80 h-11 pl-9 rounded-2xl text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Nutritional Macros */}
                <div className="p-5 rounded-2xl border border-border/80 bg-muted/20 space-y-3">
                  <Label className="text-xs font-bold text-foreground">Nutritional Macros (per serving)</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Protein (g)</Label>
                      <Input
                        type="number"
                        placeholder="25"
                        value={newItem.protein}
                        onChange={(e) => setNewItem({ ...newItem, protein: e.target.value })}
                        className="bg-card border-border/80 h-10 rounded-xl text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Carbs (g)</Label>
                      <Input
                        type="number"
                        placeholder="45"
                        value={newItem.carbs}
                        onChange={(e) => setNewItem({ ...newItem, carbs: e.target.value })}
                        className="bg-card border-border/80 h-10 rounded-xl text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Fats (g)</Label>
                      <Input
                        type="number"
                        placeholder="12"
                        value={newItem.fat}
                        onChange={(e) => setNewItem({ ...newItem, fat: e.target.value })}
                        className="bg-card border-border/80 h-10 rounded-xl text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Dietary Certifications */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-foreground">Dietary Friendly Badges</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { key: 'isGlutenFree', label: 'Gluten Free', desc: 'No wheat / gluten', icon: '🌾' },
                      { key: 'isJain', label: 'Jain Friendly', desc: 'No root vegetables', icon: '🙏' },
                      { key: 'isHalal', label: 'Halal Certified', desc: 'Halal prepared', icon: '✅' },
                    ].map((cert) => (
                      <label
                        key={cert.key}
                        className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                          (newItem as any)[cert.key]
                            ? 'bg-primary/5 border-primary shadow-xs'
                            : 'bg-card border-border/80 hover:bg-muted/40'
                        }`}
                      >
                        <Checkbox
                          checked={(newItem as any)[cert.key]}
                          onCheckedChange={(c) => setNewItem({ ...newItem, [cert.key]: !!c } as any)}
                          className="mt-0.5 h-4 w-4 data-[state=checked]:bg-primary"
                        />
                        <div>
                          <p className="font-bold text-xs text-foreground flex items-center gap-1">
                            <span>{cert.icon}</span> {cert.label}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{cert.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* ── TAB 5: TAKEAWAY & PICKUP ───────────────────────────── */}
              <TabsContent value="pickup" className="space-y-6 focus-visible:outline-none">
                <div className="p-5 rounded-2xl border border-primary/25 bg-primary/5 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4 text-primary" /> Self-Pickup / Takeaway Availability
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Allow customers to order online and collect this dish directly from your counter.
                      </p>
                    </div>
                    <Switch
                      checked={newItem.isPickupAvailable}
                      onCheckedChange={(c) => setNewItem({ ...newItem, isPickupAvailable: Boolean(c) })}
                    />
                  </div>

                  {newItem.isPickupAvailable && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-border/40">
                      <div className="space-y-1.5">
                        <Label className="text-foreground text-xs font-bold">Pickup Packing Time (mins)</Label>
                        <div className="relative">
                          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                          <Input
                            type="number"
                            placeholder="20"
                            value={newItem.pickupPrepTime}
                            onChange={(e) => setNewItem({ ...newItem, pickupPrepTime: e.target.value })}
                            className="bg-card border-border/80 h-11 rounded-2xl pl-9 text-xs font-mono"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-foreground text-xs font-bold">Takeaway Packaging Fee (₹)</Label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">₹</span>
                          <Input
                            type="number"
                            placeholder="0"
                            value={newItem.packagingFee}
                            onChange={(e) => setNewItem({ ...newItem, packagingFee: e.target.value })}
                            className="bg-card border-border/80 h-11 pl-8 text-xs rounded-2xl font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sticky Dialog Footer */}
          <div className="sticky bottom-0 z-30 bg-card/95 backdrop-blur-xl border-t border-border/80 px-6 py-4 flex items-center justify-between gap-4">
            <div className="text-xs">
              {uploadStatus && (
                <span className="flex items-center gap-2 text-primary font-bold animate-pulse">
                  <Spinner className="w-3.5 h-3.5" /> {uploadStatus}
                </span>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                type="button"
                disabled={submitting}
                onClick={() => setDialogOpen(false)}
                className="h-11 px-5 rounded-2xl font-bold text-xs"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddItem}
                disabled={submitting}
                className="bg-gradient-to-r from-primary to-orange-500 text-primary-foreground hover:opacity-95 font-black h-11 px-7 rounded-2xl text-xs shadow-lg shadow-primary/25 transition-all"
              >
                {submitting && <Spinner className="mr-2 h-4 w-4" />}
                {submitting ? (editingId ? 'Updating...' : 'Publishing...') : editingId ? 'Update Dish' : 'Publish Dish'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── CATEGORY PICKER DIALOG ──────────────────────────────────────── */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="max-w-2xl bg-card border-border text-card-foreground shadow-2xl p-6 rounded-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="pb-3 border-b border-border">
            <DialogTitle className="text-2xl font-black flex items-center gap-2">
              <Layers className="w-6 h-6 text-primary" /> Choose Food Category
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Select a popular category or type a custom category name for your dish.
            </DialogDescription>
          </DialogHeader>

          <div className="relative mt-4 mb-4">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search categories (e.g. Biryani, Pizza, Beverage)..."
              value={categorySearchQuery}
              onChange={(e) => setCategorySearchQuery(e.target.value)}
              className="bg-muted/40 border-border h-11 pl-10 rounded-2xl text-sm"
            />
          </div>

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
                      setNewItem((prev) => ({ ...prev, category: cat }));
                      setCategoryDialogOpen(false);
                      toast.success(`Selected "${cat}"`);
                    }}
                    className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                      newItem.category === cat
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
                    setNewItem((prev) => ({ ...prev, category: cat.name }));
                    setCategoryDialogOpen(false);
                    toast.success(`Category set to "${cat.name}"`);
                  }}
                  className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98] ${
                    newItem.category === cat.name
                      ? 'bg-primary text-primary-foreground border-primary shadow-md'
                      : `bg-gradient-to-br ${cat.color} hover:shadow-xs`
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
                      setNewItem((prev) => ({ ...prev, category: customCategoryInput.trim() }));
                      setCategoryDialogOpen(false);
                      toast.success(`Custom category "${customCategoryInput.trim()}" applied`);
                    }
                  }
                }}
                className="bg-muted/40 border-border h-11 text-xs rounded-2xl"
              />
              <Button
                type="button"
                onClick={() => {
                  if (customCategoryInput.trim()) {
                    setNewItem((prev) => ({ ...prev, category: customCategoryInput.trim() }));
                    setCategoryDialogOpen(false);
                    toast.success(`Custom category "${customCategoryInput.trim()}" applied`);
                  }
                }}
                disabled={!customCategoryInput.trim()}
                className="h-11 px-5 rounded-2xl font-bold text-xs bg-primary text-primary-foreground whitespace-nowrap"
              >
                Use Category
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── PICKUP & TAKEAWAY CONFIGURATION DIALOG ─────────────────────── */}
      <Dialog open={pickupDialogOpen} onOpenChange={setPickupDialogOpen}>
        <DialogContent className="max-w-xl bg-card border-border text-card-foreground shadow-2xl p-6 rounded-3xl">
          <DialogHeader className="pb-3 border-b border-border">
            <DialogTitle className="text-2xl font-black flex items-center gap-2">
              <ShoppingBag className="w-6 h-6 text-primary" /> Pickup & Takeaway Settings
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Manage how customers order for self-pickup from your restaurant counter.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div className="p-4 rounded-2xl border border-border bg-muted/20 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-foreground text-sm">Enable Self-Pickup (Takeaway)</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Customers can choose Takeaway at checkout to collect food directly.
                </p>
              </div>
              <Switch
                checked={pickupSettings.isPickupEnabled}
                onCheckedChange={(c) => setPickupSettings({ ...pickupSettings, isPickupEnabled: Boolean(c) })}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground">Standard Pickup Preparation Time</Label>
              <div className="grid grid-cols-4 gap-2">
                {[15, 20, 30, 45].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setPickupSettings({ ...pickupSettings, defaultPickupTime: mins })}
                    className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${
                      pickupSettings.defaultPickupTime === mins
                        ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                        : 'border-border bg-card text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {mins} mins
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="counter" className="text-xs font-bold text-foreground">Pickup Counter Spot</Label>
              <Input
                id="counter"
                placeholder="e.g. Express Online Pickup Window #1"
                value={pickupSettings.pickupCounter}
                onChange={(e) => setPickupSettings({ ...pickupSettings, pickupCounter: e.target.value })}
                className="bg-card border-border h-11 text-xs rounded-2xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="instructions" className="text-xs font-bold text-foreground">Customer Pickup Instructions</Label>
              <Textarea
                id="instructions"
                placeholder="e.g. Show digital Order OTP at the pickup window. No waiting in the dine-in queue."
                value={pickupSettings.pickupInstructions}
                onChange={(e) => setPickupSettings({ ...pickupSettings, pickupInstructions: e.target.value })}
                className="bg-card border-border text-xs rounded-2xl min-h-[75px] resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="packaging" className="text-xs font-bold text-foreground">Takeaway Packaging Fee (₹)</Label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xs">₹</span>
                <Input
                  id="packaging"
                  type="number"
                  placeholder="0"
                  value={pickupSettings.packagingFee}
                  onChange={(e) =>
                    setPickupSettings({ ...pickupSettings, packagingFee: parseFloat(e.target.value) || 0 })
                  }
                  className="bg-card border-border h-11 pl-8 text-xs rounded-2xl font-mono"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">Keep ₹0 for free customer takeaway packaging.</p>
            </div>

            <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-primary/20 bg-primary/5 cursor-pointer">
              <Checkbox
                checked={pickupSettings.applyToAllItems}
                onCheckedChange={(c) => setPickupSettings({ ...pickupSettings, applyToAllItems: !!c })}
                className="mt-0.5 h-4 w-4 data-[state=checked]:bg-primary"
              />
              <div>
                <p className="font-bold text-xs text-foreground">Apply Pickup availability to all menu items</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Synchronizes all dishes to be available for self-pickup with this prep time.
                </p>
              </div>
            </label>
          </div>

          <DialogFooter className="pt-3 border-t border-border flex justify-end gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => setPickupDialogOpen(false)}
              className="rounded-2xl h-11 px-5 text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSavePickupSettings}
              disabled={savingPickupSettings}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-2xl h-11 px-6 text-xs font-bold shadow-md"
            >
              {savingPickupSettings && <Spinner className="mr-2 h-3.5 w-3.5" />}
              {savingPickupSettings ? 'Saving...' : 'Save Settings'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── SUCCESS DIALOG ──────────────────────────────────────────────── */}
      <Dialog open={successDialog} onOpenChange={setSuccessDialog}>
        <DialogContent className="max-w-md bg-card border-border text-card-foreground text-center p-8 shadow-2xl rounded-3xl">
          <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 ring-4 ring-emerald-500/15 shadow-md">
            <CheckCircle className="w-10 h-10 text-emerald-500" />
          </div>
          <h3 className="text-2xl font-black text-foreground mb-2">Dish Saved & Live!</h3>
          <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
            Your dish photos are securely stored in Cloudinary and the menu item is now active in Firestore for hungry diners and restaurant kitchen management.
          </p>
          <Button
            onClick={() => setSuccessDialog(false)}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-2xl h-12 text-sm shadow-md"
          >
            Got it, Continue
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
