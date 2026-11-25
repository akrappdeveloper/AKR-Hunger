'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRestaurantAuth } from '@/context/RestaurantAuthContext';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { MenuItem } from '@/lib/types';
import {
  CURATED_BADGES,
  POPULAR_CATEGORIES,
  checkIsBestSeller,
  checkIsNewArrival,
} from '@/lib/menu-constants';
import ThemeToggle from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Award,
  Check,
  CheckCircle2,
  Clock,
  Edit2,
  Film,
  Flame,
  Image as ImageIcon,
  Layers,
  Link2,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Trash2,
  Upload,
  Users,
  Utensils,
  Video,
  X,
  Zap,
} from 'lucide-react';

interface MenuItemEditorPageProps {
  itemId?: string;
}

interface VideoEntry {
  url: string;
  file?: File;
  name?: string;
}

const SECTIONS = [
  { id: 'section-media', label: '1. Photos & Video', icon: Film },
  { id: 'section-basic', label: '2. Basic Details', icon: Utensils },
  { id: 'section-options', label: '3. Portions & Extras', icon: Layers },
  { id: 'section-badges', label: '4. Badges & Stock', icon: Award },
  { id: 'section-nutrition', label: '5. Nutrition & Diet', icon: Flame },
  { id: 'section-pickup', label: '6. Takeaway', icon: ShoppingBag },
] as const;

export default function MenuItemEditorPage({ itemId }: MenuItemEditorPageProps) {
  const router = useRouter();
  const { user, restaurant, loading: authLoading } = useRestaurantAuth();
  const isEditing = Boolean(itemId);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<string>(SECTIONS[0].id);

  const [loadingItem, setLoadingItem] = useState<boolean>(Boolean(itemId));
  const [notFound, setNotFound] = useState(false);
  const [allRestaurantItems, setAllRestaurantItems] = useState<MenuItem[]>([]);
  const [existingCategories, setExistingCategories] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  // Images state
  const [imageEntries, setImageEntries] = useState<Array<{ preview: string; file?: File }>>([]);
  const [imageUrlInput, setImageUrlInput] = useState('');

  // Videos state (up to 3 dish videos)
  const [videoEntries, setVideoEntries] = useState<VideoEntry[]>([]);
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [publishToReels, setPublishToReels] = useState(false);

  // Category picker dialog
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [customCategoryInput, setCustomCategoryInput] = useState('');

  // Add-on / Size variant creators
  const [newAddOnName, setNewAddOnName] = useState('');
  const [newAddOnPrice, setNewAddOnPrice] = useState('');
  const [newSizeName, setNewSizeName] = useState('');
  const [newSizePrice, setNewSizePrice] = useState('');

  // Form State
  const [form, setForm] = useState({
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
    // Curated Special Badges
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

  const resolvedRestaurantId = restaurant?.id || user?.restaurantId || user?.uid || '';

  // Load restaurant's existing categories & item if editing
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/restaurant/login');
      return;
    }

    const loadData = async () => {
      try {
        const targetIds = Array.from(
          new Set([user.uid, user.restaurantId, restaurant?.id].filter(Boolean))
        ) as string[];

        const itemsMap = new Map<string, MenuItem>();
        for (const tId of targetIds) {
          const snap = await getDocs(query(collection(db, 'menuItems'), where('restaurantId', '==', tId)));
          snap.docs.forEach((d) => itemsMap.set(d.id, { ...d.data(), id: d.id } as MenuItem));
        }

        const items = Array.from(itemsMap.values());
        setAllRestaurantItems(items);
        setExistingCategories(Array.from(new Set(items.map((m) => m.category).filter(Boolean))));

        if (itemId) {
          setLoadingItem(true);
          let foundItem: MenuItem | undefined = itemsMap.get(itemId);
          if (!foundItem) {
            const docSnap = await getDoc(doc(db, 'menuItems', itemId));
            if (docSnap.exists()) {
              foundItem = { ...docSnap.data(), id: docSnap.id } as MenuItem;
            }
          }

          if (!foundItem) {
            setNotFound(true);
            setLoadingItem(false);
            return;
          }

          const rawAny = foundItem as any;
          setForm({
            name: foundItem.name || '',
            description: foundItem.description || '',
            price: foundItem.price !== undefined ? foundItem.price.toString() : '',
            originalPrice: rawAny.originalPrice !== undefined ? rawAny.originalPrice.toString() : '',
            category: foundItem.category || '',
            preparationTime: (foundItem.preparationTime || 30).toString(),
            servings: (foundItem.servings || 1).toString(),
            calories: foundItem.calories ? foundItem.calories.toString() : '',
            allergens: foundItem.allergens ? foundItem.allergens.join(', ') : '',
            tags: foundItem.tags ? foundItem.tags.join(', ') : '',
            foodType: rawAny.foodType || (foundItem.vegetarian ? 'veg' : 'non-veg'),
            isVegetarian: Boolean(foundItem.vegetarian),
            isSpicy: Boolean(foundItem.spicy),
            spiceLevel: rawAny.spiceLevel || (foundItem.spicy ? 'medium' : 'none'),
            isAvailable: foundItem.available !== undefined ? foundItem.available : true,
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
            ingredients: Array.isArray(rawAny.ingredients)
              ? rawAny.ingredients.join(', ')
              : rawAny.ingredients || '',
            portionSize: rawAny.portionSize || rawAny.servingSize || '',
            isGlutenFree: Boolean(rawAny.isGlutenFree),
            isJain: Boolean(rawAny.isJain),
            isHalal: Boolean(rawAny.isHalal),
          });

          const initialImgs =
            foundItem.images && foundItem.images.length > 0
              ? foundItem.images
              : foundItem.image
              ? [foundItem.image]
              : [];
          setImageEntries(initialImgs.map((url) => ({ preview: url })));

          const initialVideos: string[] = Array.isArray(rawAny.videos) && rawAny.videos.length > 0
            ? rawAny.videos
            : rawAny.videoUrl
            ? [rawAny.videoUrl]
            : [];
          setVideoEntries(initialVideos.map((url) => ({ url })));
        }
      } catch (err) {
        console.error('[MenuEditor] Load error:', err);
        toast.error('Failed to load dish details');
      } finally {
        setLoadingItem(false);
      }
    };

    loadData();
  }, [authLoading, user, restaurant?.id, itemId, router]);

  // Revoke object URLs on unmount
  useEffect(() => {
    return () => {
      videoEntries.forEach((v) => {
        if (v.file && v.url.startsWith('blob:')) {
          URL.revokeObjectURL(v.url);
        }
      });
    };
  }, []);

  // Scroll spy for section jump bar
  const handleBodyScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const containerTop = container.getBoundingClientRect().top;

    for (let i = SECTIONS.length - 1; i >= 0; i--) {
      const el = document.getElementById(SECTIONS[i].id);
      if (el) {
        const offset = el.getBoundingClientRect().top - containerTop;
        if (offset <= 140) {
          setActiveSection(SECTIONS[i].id);
          break;
        }
      }
    }
  };

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(sectionId);
    }
  };

  // Image handlers
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remainingSlots = 5 - imageEntries.length;
    if (remainingSlots <= 0) {
      toast.warning('Maximum 5 photos allowed per menu item');
      return;
    }

    const selected = files.slice(0, remainingSlots);
    selected.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setImageEntries((prev) =>
            prev.length < 5 ? [...prev, { preview: reader.result as string, file }] : prev
          );
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleAddImageUrl = () => {
    const trimmed = imageUrlInput.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      toast.error('Please enter a valid image URL starting with http:// or https://');
      return;
    }
    if (imageEntries.length >= 5) {
      toast.warning('Maximum 5 photos allowed per menu item');
      return;
    }
    setImageEntries((prev) => [...prev, { preview: trimmed }]);
    setImageUrlInput('');
    toast.success('Photo URL added');
  };

  const removeImage = (index: number) => {
    setImageEntries((prev) => prev.filter((_, i) => i !== index));
  };

  // Video handlers
  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remainingSlots = 3 - videoEntries.length;
    if (remainingSlots <= 0) {
      toast.warning('Maximum 3 videos allowed per menu item');
      return;
    }

    const validFiles: VideoEntry[] = [];
    for (const file of files.slice(0, remainingSlots)) {
      if (!file.type.startsWith('video/')) {
        toast.error(`"${file.name}" is not a valid video file`);
        continue;
      }
      if (file.size > 100 * 1024 * 1024) {
        toast.error(`"${file.name}" exceeds the 100MB limit`);
        continue;
      }
      validFiles.push({
        url: URL.createObjectURL(file),
        file,
        name: file.name,
      });
    }

    if (validFiles.length > 0) {
      setVideoEntries((prev) => [...prev, ...validFiles]);
      toast.success(`${validFiles.length} video${validFiles.length > 1 ? 's' : ''} ready to upload`);
    }
    e.target.value = '';
  };

  const handleAddVideoUrl = () => {
    const trimmed = videoUrlInput.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      toast.error('Please enter a valid video URL starting with http:// or https://');
      return;
    }
    if (videoEntries.length >= 3) {
      toast.warning('Maximum 3 videos allowed per menu item');
      return;
    }
    setVideoEntries((prev) => [...prev, { url: trimmed, name: 'External Video URL' }]);
    setVideoUrlInput('');
    toast.success('Video URL attached');
  };

  const removeVideo = (index: number) => {
    setVideoEntries((prev) => {
      const target = prev[index];
      if (target?.file && target.url.startsWith('blob:')) {
        URL.revokeObjectURL(target.url);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  // Add-on & size helpers
  const handleAddSizeVariant = () => {
    if (!newSizeName.trim()) return;
    const price = parseFloat(newSizePrice) || 0;
    setForm((prev) => ({
      ...prev,
      sizes: [...prev.sizes, { name: newSizeName.trim(), price }],
    }));
    setNewSizeName('');
    setNewSizePrice('');
  };

  const handleRemoveSize = (index: number) => {
    setForm((prev) => ({
      ...prev,
      sizes: prev.sizes.filter((_, i) => i !== index),
    }));
  };

  const handleAddCustomAddOn = () => {
    if (!newAddOnName.trim()) return;
    const price = parseFloat(newAddOnPrice) || 0;
    setForm((prev) => ({
      ...prev,
      addOns: [...prev.addOns, { name: newAddOnName.trim(), price }],
    }));
    setNewAddOnName('');
    setNewAddOnPrice('');
  };

  const handleRemoveAddOn = (index: number) => {
    setForm((prev) => ({
      ...prev,
      addOns: prev.addOns.filter((_, i) => i !== index),
    }));
  };

  // Save handler
  const handleSave = async (addAnother = false) => {
    if (!user) {
      toast.error('You must be logged in to manage menu items');
      return;
    }

    if (!form.name.trim() || !form.price.trim() || !form.category.trim()) {
      toast.error('Please enter Dish Name, Category, and Selling Price');
      scrollToSection('section-basic');
      return;
    }

    if (imageEntries.length === 0) {
      toast.error('Please add at least one dish photo');
      scrollToSection('section-media');
      return;
    }

    const parsedPrice = parseFloat(form.price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      toast.error('Please enter a valid selling price');
      scrollToSection('section-basic');
      return;
    }

    const parsedOriginalPrice = form.originalPrice ? parseFloat(form.originalPrice) : null;
    if (parsedOriginalPrice !== null && (isNaN(parsedOriginalPrice) || parsedOriginalPrice < 0)) {
      toast.error('Please enter a valid original price or leave blank');
      scrollToSection('section-basic');
      return;
    }

    try {
      setSubmitting(true);
      setUploadProgress(0);

      // 1. Upload Photos
      const finalImageUrls: string[] = [];
      const filesToUpload = imageEntries.filter((e) => e.file);
      let uploadedPhotoIdx = 0;

      for (const entry of imageEntries) {
        if (entry.file) {
          uploadedPhotoIdx += 1;
          setUploadStatus(`Uploading photo ${uploadedPhotoIdx} of ${filesToUpload.length} to Cloudinary...`);
          const cdnUrl = await uploadToCloudinary(
            entry.file,
            (pct) => setUploadProgress(pct),
            'image'
          );
          if (cdnUrl && cdnUrl.startsWith('http')) {
            finalImageUrls.push(cdnUrl);
          }
        } else if (entry.preview.startsWith('http://') || entry.preview.startsWith('https://')) {
          finalImageUrls.push(entry.preview);
        }
      }

      if (finalImageUrls.length === 0) {
        toast.error('Could not resolve any valid photo URLs');
        return;
      }

      // 2. Upload Videos
      const finalVideoUrls: string[] = [];
      const videoFilesToUpload = videoEntries.filter((v) => v.file);
      let uploadedVideoIdx = 0;

      for (const vEntry of videoEntries) {
        if (vEntry.file) {
          uploadedVideoIdx += 1;
          setUploadProgress(0);
          setUploadStatus(
            `Uploading video ${uploadedVideoIdx} of ${videoFilesToUpload.length} to Cloudinary...`
          );
          const videoCdnUrl = await uploadToCloudinary(
            vEntry.file,
            (pct) => setUploadProgress(pct),
            'video'
          );
          if (videoCdnUrl && videoCdnUrl.startsWith('http')) {
            finalVideoUrls.push(videoCdnUrl);
          }
        } else if (vEntry.url.startsWith('http://') || vEntry.url.startsWith('https://')) {
          finalVideoUrls.push(vEntry.url);
        }
      }

      setUploadStatus('Saving dish details...');
      setUploadProgress(100);

      const tagArray = form.tags
        ? form.tags.split(',').map((t) => t.trim()).filter(Boolean)
        : [];
      const allergenArray = form.allergens
        ? form.allergens.split(',').map((a) => a.trim()).filter(Boolean)
        : [];

      const existingItem = itemId ? allRestaurantItems.find((m) => m.id === itemId) : null;
      const isAutoBestseller = existingItem ? checkIsBestSeller(existingItem, allRestaurantItems) : false;
      const isAutoNewArrival = existingItem ? checkIsNewArrival(existingItem) : true;

      const cleanItemData: Record<string, any> = {
        name: form.name.trim(),
        description: form.description?.trim() || '',
        price: parsedPrice,
        category: form.category.trim(),
        foodType: form.foodType,
        vegetarian: form.foodType === 'veg' || form.foodType === 'vegan' || Boolean(form.isVegetarian),
        spicy: form.spiceLevel !== 'none' || Boolean(form.isSpicy),
        spiceLevel: form.spiceLevel,
        available: Boolean(form.isAvailable),
        image: finalImageUrls[0] || '',
        images: Array.from(new Set(finalImageUrls)),
        videoUrl: finalVideoUrls[0] || '',
        videos: Array.from(new Set(finalVideoUrls)),
        preparationTime: parseInt(form.preparationTime) || 30,
        servings: parseInt(form.servings) || 1,
        allergens: allergenArray,
        tags: tagArray,
        isBestSeller: isAutoBestseller,
        isNew: isAutoNewArrival,
        isChefSpecial: Boolean(form.isChefSpecial),
        isMustTry: Boolean(form.isMustTry),
        isTrending: Boolean(form.isTrending),
        isHealthyChoice: Boolean(form.isHealthyChoice),
        isSeasonalSpecial: Boolean(form.isSeasonalSpecial),
        isLimitedEdition: Boolean(form.isLimitedEdition),
        isHouseSpecialty: Boolean(form.isHouseSpecialty),
        isKidsFavorite: Boolean(form.isKidsFavorite),
        isPickupAvailable: Boolean(form.isPickupAvailable),
        pickupPrepTime: parseInt(form.pickupPrepTime) || 20,
        packagingFee: parseFloat(form.packagingFee) || 0,
        addOns: form.addOns || [],
        addons: form.addOns || [],
        sizes: form.sizes || [],
        restaurantId: resolvedRestaurantId,
        ownerId: user.uid,
        restaurantName: restaurant?.name || 'Restaurant',
        approvalStatus: 'approved',
        isLive: true,
        updatedAt: new Date(),
        nutrition: {
          protein: parseFloat(form.protein) || null,
          carbs: parseFloat(form.carbs) || null,
          fat: parseFloat(form.fat) || null,
        },
        ingredients: form.ingredients
          ? form.ingredients.split(',').map((i: string) => i.trim()).filter(Boolean)
          : [],
        portionSize: form.portionSize?.trim() || null,
        isGlutenFree: Boolean(form.isGlutenFree),
        isJain: Boolean(form.isJain),
        isHalal: Boolean(form.isHalal),
      };

      if (parsedOriginalPrice !== null && parsedOriginalPrice > parsedPrice) {
        cleanItemData.originalPrice = parsedOriginalPrice;
      }

      if (form.calories && form.calories.trim() !== '') {
        const cal = parseInt(form.calories.trim());
        if (!isNaN(cal)) cleanItemData.calories = cal;
      }

      let savedDocId = itemId || '';
      if (itemId) {
        await updateDoc(doc(db, 'menuItems', itemId), cleanItemData);
        try {
          await setDoc(doc(db, 'restaurants', resolvedRestaurantId, 'menuItems', itemId), cleanItemData, {
            merge: true,
          });
        } catch (_) {}
        toast.success(`"${cleanItemData.name}" updated successfully!`);
      } else {
        const docRef = await addDoc(collection(db, 'menuItems'), {
          ...cleanItemData,
          createdAt: new Date(),
          submittedAt: new Date(),
        });
        savedDocId = docRef.id;
        try {
          await setDoc(doc(db, 'restaurants', resolvedRestaurantId, 'menuItems', docRef.id), {
            ...cleanItemData,
            createdAt: new Date(),
          });
        } catch (_) {}
        toast.success(`"${cleanItemData.name}" added and is now live!`);
      }

      // Optional: also publish dish video to Kitchen Reels (/api/videos)
      if (publishToReels && finalVideoUrls.length > 0) {
        try {
          await fetch('/api/videos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              uploaderId: resolvedRestaurantId,
              uploaderType: 'restaurant',
              uploaderName: restaurant?.name || 'Restaurant',
              type: 'food_prep',
              title: cleanItemData.name,
              description: cleanItemData.description || `${cleanItemData.name} — Fresh from our kitchen`,
              videoUrl: finalVideoUrls[0],
              thumbnailUrl: finalImageUrls[0] || restaurant?.image || '',
              restaurantId: resolvedRestaurantId,
              restaurantName: restaurant?.name || 'Restaurant',
              restaurantImage: restaurant?.image || '',
              menuItemId: savedDocId,
              tags: tagArray,
              isActive: true,
            }),
          });
          toast.success('Dish video also published to Customer Reels!');
        } catch (reelErr) {
          console.warn('[MenuEditor] Reel publish warning:', reelErr);
        }
      }

      if (addAnother && !itemId) {
        setForm({
          name: '',
          description: '',
          price: '',
          originalPrice: '',
          category: form.category,
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
        setImageEntries([]);
        setVideoEntries([]);
        setPublishToReels(false);
        scrollToSection('section-media');
      } else {
        router.push('/restaurant/menu');
      }
    } catch (error: any) {
      console.error('[MenuEditor] Save error:', error);
      toast.error(`Save failed: ${error?.message || 'Network error'}`);
    } finally {
      setSubmitting(false);
      setUploadStatus(null);
      setUploadProgress(0);
    }
  };

  const filteredCategoriesForDialog = useMemo(
    () =>
      POPULAR_CATEGORIES.filter((cat) =>
        cat.name.toLowerCase().includes(categorySearchQuery.toLowerCase())
      ),
    [categorySearchQuery]
  );

  const isVegPreview = form.foodType === 'veg' || form.foodType === 'vegan';
  const discountPercent = useMemo(() => {
    const p = parseFloat(form.price || '0');
    const op = parseFloat(form.originalPrice || '0');
    if (op > p && p >= 0) {
      return Math.round(((op - p) / op) * 100);
    }
    return 0;
  }, [form.price, form.originalPrice]);

  const activeCuratedBadges = useMemo(
    () => CURATED_BADGES.filter((b) => Boolean((form as any)[b.key])),
    [form]
  );

  if (authLoading || loadingItem) {
    return (
      <div className="h-[100dvh] w-full bg-background text-foreground flex flex-col items-center justify-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Spinner className="w-6 h-6 text-primary" />
        </div>
        <p className="text-xs font-semibold text-muted-foreground">
          {isEditing ? 'Loading dish editor...' : 'Preparing Menu Studio Editor...'}
        </p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="h-[100dvh] w-full bg-background text-foreground flex flex-col items-center justify-center p-6 text-center relative">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="max-w-md w-full bg-card border border-border rounded-3xl p-8 shadow-xl space-y-4">
          <Utensils className="w-10 h-10 text-primary mx-auto" />
          <h2 className="text-xl font-black">Dish Not Found</h2>
          <p className="text-xs text-muted-foreground">
            This menu item could not be found or may have been deleted.
          </p>
          <Link href="/restaurant/menu" className="block">
            <Button className="w-full rounded-2xl font-bold h-11">Back to Menu Studio</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-background text-foreground overflow-hidden transition-colors duration-300">
      {/* ── STICKY FULL-SCREEN HEADER ─────────────────────────────────────── */}
      <header className="shrink-0 z-30 bg-card/95 backdrop-blur-xl border-b border-border px-3 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.push('/restaurant/menu')}
            className="h-9 px-2.5 sm:px-3 rounded-xl gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Menu Studio</span>
          </Button>

          <div className="h-5 w-px bg-border hidden sm:block" />

          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-primary to-primary/75 flex items-center justify-center text-primary-foreground shadow-sm shrink-0">
            {isEditing ? <Edit2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-lg font-black tracking-tight truncate">
                {isEditing ? `Edit: ${form.name || 'Menu Item'}` : 'Add New Menu Item'}
              </h1>
              <Badge
                variant="outline"
                className="hidden md:inline-flex text-[10px] font-bold border-primary/30 text-primary bg-primary/10 shrink-0"
              >
                {restaurant?.name || 'Partner Kitchen'}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground truncate hidden sm:block">
              Full-screen dish studio • Photos, video showcase, portions, badges, nutrition & takeaway
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle className="h-9 w-9 rounded-xl border-border/70" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={submitting}
            onClick={() => router.push('/restaurant/menu')}
            className="hidden md:inline-flex h-9 px-4 rounded-xl text-xs font-bold"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={submitting}
            onClick={() => handleSave(false)}
            className="h-9 px-4 sm:px-5 rounded-xl text-xs font-black bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20 gap-1.5"
          >
            {submitting ? <Spinner className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            <span>{submitting ? 'Saving...' : isEditing ? 'Update Dish' : 'Publish Dish'}</span>
          </Button>
        </div>
      </header>

      {/* ── SECTION QUICK-JUMP BAR (MOBILE / TABLET) ───────────────────────── */}
      <nav className="lg:hidden shrink-0 bg-card/70 backdrop-blur-md border-b border-border px-3 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {SECTIONS.map((sec) => {
          const Icon = sec.icon;
          const isActive = activeSection === sec.id;
          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => scrollToSection(sec.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 border ${
                isActive
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                  : 'bg-background/80 text-muted-foreground border-border hover:text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{sec.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ── MAIN BODY: LEFT OUTLINE + VERTICALLY SCROLLABLE FORM + LIVE PREVIEW */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Desktop Left Section Jump Rail */}
        <aside className="hidden lg:flex w-64 xl:w-72 flex-col border-r border-border bg-card/40 p-4 space-y-2 shrink-0 overflow-y-auto">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-2 mb-1">
            All Sections (Same Page)
          </p>
          {SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => scrollToSection(sec.id)}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left border ${
                  isActive
                    ? 'bg-primary/15 text-primary border-primary/30 shadow-xs'
                    : 'bg-transparent border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{sec.label}</span>
              </button>
            );
          })}

          <div className="pt-4 mt-4 border-t border-border space-y-2 px-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Completion Checklist
            </p>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${imageEntries.length > 0 ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
                <span className={imageEntries.length > 0 ? 'text-foreground font-semibold' : 'text-muted-foreground'}>
                  Photos ({imageEntries.length}/5)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${videoEntries.length > 0 ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
                <span className={videoEntries.length > 0 ? 'text-foreground font-semibold' : 'text-muted-foreground'}>
                  Videos ({videoEntries.length}/3)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${form.name.trim() && form.category.trim() && form.price.trim() ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
                <span className={form.name.trim() && form.category.trim() && form.price.trim() ? 'text-foreground font-semibold' : 'text-muted-foreground'}>
                  Name, Category & Price
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* Vertically Scrollable Form Canvas (ALL Sections in One Page) */}
        <div
          ref={scrollContainerRef}
          onScroll={handleBodyScroll}
          className="flex-1 overflow-y-auto scroll-smooth p-4 sm:p-6 lg:p-8"
        >
          <div className="max-w-4xl mx-auto space-y-8 pb-12">
            {/* ── SECTION 1: PHOTOS & VIDEO UPLOAD ──────────────────────── */}
            <section
              id="section-media"
              className="scroll-mt-4 rounded-3xl border border-border bg-card p-5 sm:p-6 space-y-6 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2 border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                    <Film className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black">1. Dish Photos & Video Studio</h2>
                    <p className="text-xs text-muted-foreground">
                      Upload high-resolution photos and showcase videos straight to Cloudinary CDN
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-[10px] font-bold">
                  Media Required
                </Badge>
              </div>

              {/* Photos Block */}
              <div className="space-y-3 p-4 sm:p-5 rounded-2xl border border-border bg-muted/20">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-foreground font-bold flex items-center gap-2 text-sm">
                    <ImageIcon className="w-4 h-4 text-primary" /> Dish Photos *
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    {imageEntries.length}/5 • PNG, JPG, WEBP
                  </span>
                </div>

                {imageEntries.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {imageEntries.map((entry, index) => (
                      <div
                        key={index}
                        className="relative aspect-square rounded-2xl overflow-hidden border border-border shadow-sm group bg-muted"
                      >
                        <img
                          src={entry.preview}
                          alt={`Dish preview ${index + 1}`}
                          className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-1.5 right-1.5 p-1.5 bg-black/70 hover:bg-destructive text-white rounded-full transition-colors shadow-sm"
                          title="Remove photo"
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

                <div className="flex flex-col sm:flex-row gap-3">
                  <label className="flex-1 border-2 border-dashed border-primary/35 hover:border-primary bg-card rounded-2xl p-4 flex items-center justify-center gap-3 cursor-pointer transition-colors text-center group">
                    <Upload className="w-5 h-5 text-primary group-hover:scale-110 transition-transform shrink-0" />
                    <div className="text-left">
                      <p className="text-xs font-bold text-foreground">Select dish photos</p>
                      <p className="text-[10px] text-muted-foreground">Upload from computer or phone</p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>

                  <div className="flex gap-2 sm:w-1/2">
                    <Input
                      placeholder="Or paste photo URL (https://...)"
                      value={imageUrlInput}
                      onChange={(e) => setImageUrlInput(e.target.value)}
                      className="bg-card border-border text-xs rounded-2xl h-auto min-h-[46px]"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleAddImageUrl}
                      className="rounded-2xl text-xs font-bold px-4 h-auto min-h-[46px]"
                    >
                      Add URL
                    </Button>
                  </div>
                </div>
              </div>

              {/* Video Upload Block */}
              <div className="space-y-4 p-4 sm:p-5 rounded-2xl border border-primary/25 bg-primary/5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <Label className="text-foreground font-bold flex items-center gap-2 text-sm">
                      <Video className="w-4 h-4 text-primary" /> Dish Video Showcase (Optional)
                    </Label>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Show sizzling food prep, plating, or steam to boost customer conversions.
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-bold w-fit border-primary/30 text-primary">
                    {videoEntries.length}/3 Videos • MP4, MOV, WebM (Max 100MB)
                  </Badge>
                </div>

                {videoEntries.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {videoEntries.map((v, idx) => (
                      <div
                        key={idx}
                        className="relative rounded-2xl overflow-hidden border border-border bg-black shadow-md flex flex-col"
                      >
                        <div className="relative aspect-video bg-black">
                          <video
                            src={v.url}
                            controls
                            playsInline
                            poster={imageEntries[0]?.preview}
                            className="w-full h-full object-contain"
                          />
                          <button
                            type="button"
                            onClick={() => removeVideo(idx)}
                            className="absolute top-2 right-2 p-1.5 bg-black/75 hover:bg-destructive text-white rounded-full transition-colors shadow-md"
                            title="Remove video"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          {idx === 0 && (
                            <span className="absolute top-2 left-2 bg-primary text-primary-foreground text-[9px] font-black uppercase px-2 py-0.5 rounded-md">
                              Primary Reel
                            </span>
                          )}
                        </div>
                        <div className="px-3 py-2 bg-card border-t border-border flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-foreground truncate">
                            {v.name || `Dish Video #${idx + 1}`}
                          </span>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {v.file ? `${(v.file.size / (1024 * 1024)).toFixed(1)} MB` : 'Remote URL'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                  <label className="flex-1 border-2 border-dashed border-primary/35 hover:border-primary bg-card rounded-2xl p-4 flex items-center justify-center gap-3 cursor-pointer transition-colors text-center group">
                    <Video className="w-5 h-5 text-primary group-hover:scale-110 transition-transform shrink-0" />
                    <div className="text-left">
                      <p className="text-xs font-bold text-foreground">Upload dish video file</p>
                      <p className="text-[10px] text-muted-foreground">MP4, MOV or WebM up to 100MB</p>
                    </div>
                    <input
                      type="file"
                      accept="video/*"
                      multiple
                      onChange={handleVideoChange}
                      className="hidden"
                    />
                  </label>

                  <div className="flex gap-2 sm:w-1/2">
                    <div className="relative flex-1">
                      <Link2 className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                      <Input
                        placeholder="Or paste video URL (https://...mp4)"
                        value={videoUrlInput}
                        onChange={(e) => setVideoUrlInput(e.target.value)}
                        className="bg-card border-border text-xs rounded-2xl pl-8 h-auto min-h-[46px]"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleAddVideoUrl}
                      className="rounded-2xl text-xs font-bold px-4 h-auto min-h-[46px]"
                    >
                      Add Video
                    </Button>
                  </div>
                </div>

                {videoEntries.length > 0 && (
                  <label className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-card border border-border cursor-pointer">
                    <div>
                      <p className="text-xs font-bold text-foreground">Also feature on Customer Kitchen Reels</p>
                      <p className="text-[11px] text-muted-foreground">
                        Publishes the primary dish video to Hunger Reels feed alongside saving it on this dish.
                      </p>
                    </div>
                    <Switch checked={publishToReels} onCheckedChange={setPublishToReels} />
                  </label>
                )}
              </div>
            </section>

            {/* ── SECTION 2: BASIC DETAILS & PRICING ───────────────────── */}
            <section
              id="section-basic"
              className="scroll-mt-4 rounded-3xl border border-border bg-card p-5 sm:p-6 space-y-6 shadow-sm"
            >
              <div className="flex items-center gap-3 border-b border-border pb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Utensils className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black">2. Basic Details & Pricing</h2>
                  <p className="text-xs text-muted-foreground">
                    Dish title, category, pricing, dietary type, and description
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">Dish Name *</Label>
                  <Input
                    placeholder="e.g. Royal Chicken Dum Biryani"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="bg-background border-border h-11 rounded-2xl font-semibold text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">Category *</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. Biryani & Rice"
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="bg-background border-border h-11 rounded-2xl text-sm font-semibold flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCategoryDialogOpen(true)}
                      className="h-11 px-4 rounded-2xl border-border text-xs font-bold gap-1.5 shrink-0"
                    >
                      <Layers className="w-3.5 h-3.5 text-primary" /> Choose
                    </Button>
                  </div>
                </div>
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 sm:p-5 rounded-2xl border border-border bg-muted/20">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">Selling Price (₹) *</Label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-primary font-black text-sm">
                      ₹
                    </span>
                    <Input
                      type="number"
                      placeholder="299"
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: e.target.value })}
                      className="bg-card border-border h-11 pl-8 rounded-2xl text-sm font-mono font-bold"
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Price customer pays at checkout
                  </span>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">
                    Original / MRP Price (₹) (Optional)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">
                      ₹
                    </span>
                    <Input
                      type="number"
                      placeholder="399"
                      value={form.originalPrice}
                      onChange={(e) => setForm({ ...form, originalPrice: e.target.value })}
                      className="bg-card border-border h-11 pl-8 rounded-2xl text-sm font-mono"
                    />
                  </div>
                  {discountPercent > 0 && (
                    <span className="text-[11px] font-bold text-emerald-500">
                      {discountPercent}% strike-through discount displayed to customers!
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
                        setForm({
                          ...form,
                          foodType: f.id,
                          isVegetarian: f.id === 'veg' || f.id === 'vegan',
                        })
                      }
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        form.foodType === f.id
                          ? 'bg-primary/10 border-primary shadow-xs ring-1 ring-primary'
                          : 'bg-background border-border hover:bg-muted/40'
                      }`}
                    >
                      <span className="text-lg">{f.icon}</span>
                      <p className="font-bold text-xs text-foreground mt-1">{f.label}</p>
                      <p className="text-[10px] text-muted-foreground">{f.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Description + Portion Size + Search Tags */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">Dish Story & Description</Label>
                  <Textarea
                    placeholder="Describe aroma, preparation style, key spices, or serving recommendation..."
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="bg-background border-border text-xs rounded-2xl min-h-[95px] leading-relaxed resize-y"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">Portion / Weight Label (Optional)</Label>
                    <Input
                      placeholder="e.g. 500g / 6 Pieces / 350ml"
                      value={form.portionSize}
                      onChange={(e) => setForm({ ...form, portionSize: e.target.value })}
                      className="bg-background border-border h-10 rounded-xl text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">Search Tags (Comma separated)</Label>
                    <Input
                      placeholder="e.g. spicy, dum, bestseller, weekend"
                      value={form.tags}
                      onChange={(e) => setForm({ ...form, tags: e.target.value })}
                      className="bg-background border-border h-10 rounded-xl text-xs"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* ── SECTION 3: PORTIONS, ADD-ONS & SPICE LEVEL ───────────── */}
            <section
              id="section-options"
              className="scroll-mt-4 rounded-3xl border border-border bg-card p-5 sm:p-6 space-y-6 shadow-sm"
            >
              <div className="flex items-center gap-3 border-b border-border pb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black">3. Portions, Extras & Spice Level</h2>
                  <p className="text-xs text-muted-foreground">
                    Configure size variants, customizable add-ons, and spiciness rating
                  </p>
                </div>
              </div>

              {/* Size / Portion Variants */}
              <div className="p-4 sm:p-5 rounded-2xl border border-border bg-muted/15 space-y-4">
                <div>
                  <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" /> Portion & Size Variants
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Allow customers to pick sizes (e.g., Half, Full, Small, Medium, Large) with incremental pricing.
                  </p>
                </div>

                {form.sizes.length > 0 && (
                  <div className="space-y-2">
                    {form.sizes.map((size, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-xl bg-card border border-border text-xs font-bold"
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
                    className="bg-card border-border h-10 text-xs rounded-xl flex-1"
                  />
                  <div className="relative w-full sm:w-36">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">
                      +₹
                    </span>
                    <Input
                      type="number"
                      placeholder="0"
                      value={newSizePrice}
                      onChange={(e) => setNewSizePrice(e.target.value)}
                      className="bg-card border-border h-10 text-xs rounded-xl pl-8 font-mono"
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
              <div className="p-4 sm:p-5 rounded-2xl border border-border bg-muted/15 space-y-4">
                <div>
                  <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
                    <Plus className="w-4 h-4 text-primary" /> Customizable Extras & Add-ons
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Let diners customize with extra cheese, dips, dressings, or toppings.
                  </p>
                </div>

                {form.addOns.length > 0 && (
                  <div className="space-y-2">
                    {form.addOns.map((addon, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-xl bg-card border border-border text-xs font-bold"
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
                    className="bg-card border-border h-10 text-xs rounded-xl flex-1"
                  />
                  <div className="relative w-full sm:w-36">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">
                      +₹
                    </span>
                    <Input
                      type="number"
                      placeholder="40"
                      value={newAddOnPrice}
                      onChange={(e) => setNewAddOnPrice(e.target.value)}
                      className="bg-card border-border h-10 text-xs rounded-xl pl-8 font-mono"
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

              {/* Spice Level */}
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
                      onClick={() => setForm({ ...form, spiceLevel: s.id, isSpicy: s.id !== 'none' })}
                      className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                        form.spiceLevel === s.id
                          ? 'border-destructive bg-destructive/10 text-destructive ring-1 ring-destructive'
                          : 'border-border bg-background text-muted-foreground hover:bg-muted/40'
                      }`}
                    >
                      <span>{s.icon}</span>
                      <span>{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* ── SECTION 4: BADGES & LIVE AVAILABILITY ────────────────── */}
            <section
              id="section-badges"
              className="scroll-mt-4 rounded-3xl border border-border bg-card p-5 sm:p-6 space-y-6 shadow-sm"
            >
              <div className="flex items-center gap-3 border-b border-border pb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black">4. Badges, Tags & Stock Status</h2>
                  <p className="text-xs text-muted-foreground">
                    Highlight signature specialties and manage live availability
                  </p>
                </div>
              </div>

              <div className="p-4 sm:p-5 rounded-2xl border border-primary/25 bg-gradient-to-r from-primary/10 via-accent/40 to-transparent">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center text-primary shrink-0">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-black text-sm text-foreground flex items-center gap-2 flex-wrap">
                      Automatic Performance Badges
                      <Badge className="bg-primary text-primary-foreground text-[10px] font-bold">
                        Auto Intelligence
                      </Badge>
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      <strong>Best Seller</strong> (top-selling dishes with 4.5★+ ratings) and{' '}
                      <strong>New Arrival</strong> (first 14 days) are automatically awarded by the platform.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-foreground font-black text-sm">Curated Special Badges</Label>
                  <p className="text-xs text-muted-foreground">
                    Select special tags to highlight your signature menu items.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {CURATED_BADGES.map((b) => {
                    const isChecked = Boolean((form as any)[b.key]);
                    return (
                      <label
                        key={b.key}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-start gap-3.5 ${
                          isChecked
                            ? 'bg-primary/10 border-primary shadow-xs ring-1 ring-primary/40'
                            : 'bg-muted/20 border-border hover:bg-muted/40'
                        }`}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(c) => setForm({ ...form, [b.key]: !!c } as any)}
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

              <div className="p-4 rounded-2xl border border-border bg-muted/20 flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-foreground text-sm">Instant Live Availability</h4>
                  <p className="text-xs text-muted-foreground">
                    Switch off to immediately mark this dish as Out of Stock on customer apps.
                  </p>
                </div>
                <Switch
                  checked={form.isAvailable}
                  onCheckedChange={(c) => setForm({ ...form, isAvailable: Boolean(c) })}
                />
              </div>
            </section>

            {/* ── SECTION 5: NUTRITION, INGREDIENTS & DIETARY ──────────── */}
            <section
              id="section-nutrition"
              className="scroll-mt-4 rounded-3xl border border-border bg-card p-5 sm:p-6 space-y-6 shadow-sm"
            >
              <div className="flex items-center gap-3 border-b border-border pb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black">5. Nutrition, Ingredients & Diet</h2>
                  <p className="text-xs text-muted-foreground">
                    Prep time, serving size, calories, macros, allergens & dietary certifications
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">Kitchen Prep Time (mins)</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="number"
                      placeholder="30"
                      value={form.preparationTime}
                      onChange={(e) => setForm({ ...form, preparationTime: e.target.value })}
                      className="bg-background border-border h-11 pl-9 rounded-2xl text-xs font-mono"
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
                      value={form.servings}
                      onChange={(e) => setForm({ ...form, servings: e.target.value })}
                      className="bg-background border-border h-11 pl-9 rounded-2xl text-xs font-mono"
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
                      value={form.calories}
                      onChange={(e) => setForm({ ...form, calories: e.target.value })}
                      className="bg-background border-border h-11 pl-9 rounded-2xl text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-5 rounded-2xl border border-border bg-muted/20 space-y-3">
                <Label className="text-xs font-bold text-foreground">Nutritional Macros (per serving)</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Protein (g)</Label>
                    <Input
                      type="number"
                      placeholder="25"
                      value={form.protein}
                      onChange={(e) => setForm({ ...form, protein: e.target.value })}
                      className="bg-card border-border h-10 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Carbs (g)</Label>
                    <Input
                      type="number"
                      placeholder="45"
                      value={form.carbs}
                      onChange={(e) => setForm({ ...form, carbs: e.target.value })}
                      className="bg-card border-border h-10 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Fats (g)</Label>
                    <Input
                      type="number"
                      placeholder="12"
                      value={form.fat}
                      onChange={(e) => setForm({ ...form, fat: e.target.value })}
                      className="bg-card border-border h-10 rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">Key Ingredients (Comma separated)</Label>
                  <Input
                    placeholder="e.g. Basmati Rice, Saffron, Ghee, Mint"
                    value={form.ingredients}
                    onChange={(e) => setForm({ ...form, ingredients: e.target.value })}
                    className="bg-background border-border h-10 rounded-xl text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">Allergens (Comma separated)</Label>
                  <Input
                    placeholder="e.g. Dairy, Nuts, Gluten"
                    value={form.allergens}
                    onChange={(e) => setForm({ ...form, allergens: e.target.value })}
                    className="bg-background border-border h-10 rounded-xl text-xs"
                  />
                </div>
              </div>

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
                        (form as any)[cert.key]
                          ? 'bg-primary/10 border-primary shadow-xs'
                          : 'bg-background border-border hover:bg-muted/40'
                      }`}
                    >
                      <Checkbox
                        checked={(form as any)[cert.key]}
                        onCheckedChange={(c) => setForm({ ...form, [cert.key]: !!c } as any)}
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
            </section>

            {/* ── SECTION 6: TAKEAWAY & PICKUP ─────────────────────────── */}
            <section
              id="section-pickup"
              className="scroll-mt-4 rounded-3xl border border-border bg-card p-5 sm:p-6 space-y-5 shadow-sm"
            >
              <div className="flex items-center gap-3 border-b border-border pb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black">6. Takeaway & Self-Pickup</h2>
                  <p className="text-xs text-muted-foreground">
                    Configure express counter pickup availability and packaging fee
                  </p>
                </div>
              </div>

              <div className="p-4 sm:p-5 rounded-2xl border border-primary/25 bg-primary/5 space-y-4">
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
                    checked={form.isPickupAvailable}
                    onCheckedChange={(c) => setForm({ ...form, isPickupAvailable: Boolean(c) })}
                  />
                </div>

                {form.isPickupAvailable && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-border/60">
                    <div className="space-y-1.5">
                      <Label className="text-foreground text-xs font-bold">Pickup Packing Time (mins)</Label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                        <Input
                          type="number"
                          placeholder="20"
                          value={form.pickupPrepTime}
                          onChange={(e) => setForm({ ...form, pickupPrepTime: e.target.value })}
                          className="bg-card border-border h-11 rounded-2xl pl-9 text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-foreground text-xs font-bold">Takeaway Packaging Fee (₹)</Label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">
                          ₹
                        </span>
                        <Input
                          type="number"
                          placeholder="0"
                          value={form.packagingFee}
                          onChange={(e) => setForm({ ...form, packagingFee: e.target.value })}
                          className="bg-card border-border h-11 pl-8 text-xs rounded-2xl font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>

        {/* Desktop Live Dish Card Preview Panel */}
        <aside className="hidden xl:flex w-80 2xl:w-96 flex-col border-l border-border bg-card/40 p-5 shrink-0 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Live Customer Preview
            </p>
            <Badge variant={form.isAvailable ? 'default' : 'secondary'} className="text-[10px]">
              {form.isAvailable ? 'In Stock' : 'Out of Stock'}
            </Badge>
          </div>

          <div className="rounded-3xl overflow-hidden border border-border bg-card shadow-lg">
            <div className="relative aspect-[16/10] bg-muted">
              {imageEntries[0]?.preview ? (
                <img
                  src={imageEntries[0].preview}
                  alt={form.name || 'Preview'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-1.5">
                  <ImageIcon className="w-8 h-8" />
                  <span className="text-[11px]">Cover photo preview</span>
                </div>
              )}

              <div className="absolute top-3 left-3 flex items-center gap-1.5">
                <span
                  className={`w-6 h-6 rounded-lg bg-card/95 border flex items-center justify-center shadow ${
                    isVegPreview ? 'border-emerald-600' : 'border-red-600'
                  }`}
                >
                  <span className={`w-3 h-3 rounded-full ${isVegPreview ? 'bg-emerald-600' : 'bg-red-600'}`} />
                </span>
                {videoEntries.length > 0 && (
                  <span className="px-2 py-0.5 rounded-lg bg-black/75 text-white text-[10px] font-bold flex items-center gap-1">
                    <Video className="w-3 h-3 text-primary" /> Video
                  </span>
                )}
              </div>

              {activeCuratedBadges.length > 0 && (
                <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
                  {activeCuratedBadges.slice(0, 2).map((b) => (
                    <span
                      key={b.key}
                      className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-gradient-to-r ${b.color} text-white shadow`}
                    >
                      {b.icon} {b.label}
                    </span>
                  ))}
                </div>
              )}

              <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/75 to-transparent" />
              <div className="absolute bottom-2.5 left-3 right-3 flex items-baseline justify-between text-white">
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-black font-mono">₹{form.price || '0'}</span>
                  {discountPercent > 0 && (
                    <span className="text-xs line-through text-white/70 font-mono">
                      ₹{form.originalPrice}
                    </span>
                  )}
                </div>
                {discountPercent > 0 && (
                  <span className="text-[10px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                    {discountPercent}% OFF
                  </span>
                )}
              </div>
            </div>

            <div className="p-4 space-y-2.5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  {form.category || 'Category'}
                </p>
                <h4 className="font-black text-base text-foreground line-clamp-1">
                  {form.name || 'Your Signature Dish'}
                </h4>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                  {form.description || 'Your appetizing dish description will appear here.'}
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5 text-[10px] font-bold text-muted-foreground pt-1">
                <span className="px-2 py-0.5 rounded-lg bg-muted border border-border">
                  ⏱ {form.preparationTime || 30}m
                </span>
                {form.sizes.length > 0 && (
                  <span className="px-2 py-0.5 rounded-lg bg-muted border border-border">
                    {form.sizes.length} sizes
                  </span>
                )}
                {form.addOns.length > 0 && (
                  <span className="px-2 py-0.5 rounded-lg bg-muted border border-border">
                    {form.addOns.length} extras
                  </span>
                )}
                {form.isPickupAvailable && (
                  <span className="px-2 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                    Takeaway
                  </span>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* ── STICKY BOTTOM FOOTER ACTION BAR ───────────────────────────────── */}
      <footer className="shrink-0 z-30 bg-card/95 backdrop-blur-xl border-t border-border px-4 sm:px-6 py-3 flex items-center justify-between gap-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="min-w-0 flex-1">
          {uploadStatus ? (
            <div className="space-y-1 max-w-md">
              <div className="flex items-center gap-2 text-xs text-primary font-bold">
                <Spinner className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{uploadStatus}</span>
                {uploadProgress > 0 && <span className="font-mono shrink-0">{uploadProgress}%</span>}
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-200"
                  style={{ width: `${Math.max(8, uploadProgress)}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground truncate">
              {imageEntries.length} photo{imageEntries.length === 1 ? '' : 's'} • {videoEntries.length} video
              {videoEntries.length === 1 ? '' : 's'} • {form.sizes.length} portions • {form.addOns.length} extras
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => router.push('/restaurant/menu')}
            className="h-10 sm:h-11 px-4 sm:px-5 rounded-2xl font-bold text-xs"
          >
            Cancel
          </Button>
          {!isEditing && (
            <Button
              type="button"
              variant="secondary"
              disabled={submitting}
              onClick={() => handleSave(true)}
              className="hidden sm:inline-flex h-11 px-4 rounded-2xl font-bold text-xs"
            >
              Save & Add Another
            </Button>
          )}
          <Button
            type="button"
            disabled={submitting}
            onClick={() => handleSave(false)}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-black h-10 sm:h-11 px-5 sm:px-7 rounded-2xl text-xs shadow-lg shadow-primary/25 transition-all"
          >
            {submitting && <Spinner className="mr-2 h-4 w-4" />}
            {submitting ? (isEditing ? 'Updating...' : 'Publishing...') : isEditing ? 'Update Dish' : 'Publish Dish'}
          </Button>
        </div>
      </footer>

      {/* ── CATEGORY PICKER DIALOG ─────────────────────────────────────────── */}
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
                      setForm((prev) => ({ ...prev, category: cat }));
                      setCategoryDialogOpen(false);
                      toast.success(`Selected "${cat}"`);
                    }}
                    className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                      form.category === cat
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-card border-border hover:border-primary text-foreground'
                    }`}
                  >
                    <Check className={`w-3.5 h-3.5 ${form.category === cat ? 'opacity-100' : 'opacity-0'}`} />
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
                    setForm((prev) => ({ ...prev, category: cat.name }));
                    setCategoryDialogOpen(false);
                    toast.success(`Category set to "${cat.name}"`);
                  }}
                  className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98] ${
                    form.category === cat.name
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
                      setForm((prev) => ({ ...prev, category: customCategoryInput.trim() }));
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
                    setForm((prev) => ({ ...prev, category: customCategoryInput.trim() }));
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
    </div>
  );
}
