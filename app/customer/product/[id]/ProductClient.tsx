'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, arrayUnion, arrayRemove, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MenuItem, Restaurant, CustomizationGroup, CustomizationOption } from '@/lib/types';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Star, Flame, Leaf, Clock, ArrowLeft, Plus, Minus, Zap,
    ShoppingCart, Heart, Share2, Info, ArrowRight, MapPin, Store, ShieldCheck,
    Check, CheckCircle2, Tag, Truck, Sparkles, AlertCircle, Utensils, MessageSquareText,
    Percent, HelpCircle, ChevronRight, Share
} from 'lucide-react';
import Link from 'next/link';
import SafeImage from '@/components/ui/safe-image';
import { toast } from 'sonner';
import { copyToClipboard } from '@/lib/utils';
import ThemeToggle from '@/components/customer/ThemeToggle';

interface ProductClientProps {
    productId: string;
    initialProduct?: MenuItem | null;
    initialRestaurant?: Restaurant | null;
    initialRecommendations?: MenuItem[];
}

interface RestaurantOffer {
    id: string;
    code: string;
    type?: 'percentage' | 'fixed' | 'free_delivery' | string;
    value?: number;
    description: string;
    minOrderAmount?: number;
    maxDiscount?: number;
    restaurantName?: string;
}

const DEFAULT_SIZES = [
    { id: 'regular', name: 'Regular', desc: 'Standard individual serving', price: 0 },
    { id: 'medium', name: 'Medium Combo', desc: 'Larger portion + signature dip', price: 40 },
    { id: 'large', name: 'Monster Feast', desc: 'Jumbo portion with extra toppings', price: 80 },
];

const DEFAULT_ADDONS = [
    { id: 'extra-cheese', name: 'Extra Melted Cheese Slice', price: 25 },
    { id: 'peri-peri-fries', name: 'Crispy Peri-Peri Fries', price: 49 },
    { id: 'onion-rings', name: 'Crispy Fried Onion Rings', price: 35 },
    { id: 'jalapeno-dip', name: 'Spicy Jalapeño Mayo Dip', price: 20 },
    { id: 'double-patty', name: 'Extra Patty Upgrade', price: 59 },
    { id: 'beverage', name: 'Chilled Soft Drink Can (330ml)', price: 39 },
];

const SPICE_LEVELS = [
    { id: 'Mild', label: 'Mild 🟢', desc: 'Mild & aromatic' },
    { id: 'Medium', label: 'Medium 🟡', desc: 'Balanced flavor (Popular)' },
    { id: 'Spicy', label: 'Spicy 🌶️', desc: 'Authentic Indian heat' },
    { id: 'Extra Hot', label: 'Extra Hot 🔥', desc: 'Fiery intensity' },
];

export default function ProductClient({
    productId,
    initialProduct,
    initialRestaurant,
    initialRecommendations
}: ProductClientProps) {
    const router = useRouter();
    const { items, addItem } = useCart();
    const { user, customer } = useAuth();

    const [product, setProduct] = useState<MenuItem | null>(initialProduct || null);
    const [restaurant, setRestaurant] = useState<Restaurant | null>(initialRestaurant || null);
    const [recommendations, setRecommendations] = useState<MenuItem[]>(initialRecommendations || []);
    const [loading, setLoading] = useState(!initialProduct);
    const [quantity, setQuantity] = useState(1);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isFavorite, setIsFavorite] = useState(false);

    // Real Reviews from Firestore for THIS specific product
    const [reviews, setReviews] = useState<any[]>([]);
    const [loadingReviews, setLoadingReviews] = useState(true);

    // Offers strictly exclusive to this restaurant
    const [restaurantOffers, setRestaurantOffers] = useState<RestaurantOffer[]>([]);
    const [loadingOffers, setLoadingOffers] = useState(true);

    // Customization & Spice Selection States
    const [selectedSize, setSelectedSize] = useState<{ id: string; name: string; desc?: string; price: number }>(DEFAULT_SIZES[0]);
    const [selectedAddOns, setSelectedAddOns] = useState<Record<string, { name: string; price: number }>>({});
    const [selectedSpice, setSelectedSpice] = useState<string>('Medium');
    const [cookingNote, setCookingNote] = useState<string>('');
    const [activeTab, setActiveTab] = useState<'customize' | 'nutrition'>('customize');

    // Total Cart Items Count for Header Cart Badge
    const totalCartCount = items.reduce((sum, item) => sum + item.quantity, 0);

    // 1. Load Product Data if not initially provided
    useEffect(() => {
        if (!initialProduct && productId) {
            loadProductData();
        }
    }, [productId, initialProduct]);

    // 2. Fetch Real Reviews strictly for THIS Product ID (without querying restricted /customers collection)
    useEffect(() => {
        const fetchProductReviews = async () => {
            if (!productId) return;
            try {
                setLoadingReviews(true);
                const q = query(
                    collection(db, 'reviews'),
                    where('menuItemId', '==', productId),
                    limit(50)
                );
                const snapshot = await getDocs(q);
                const rawReviews = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // Process review authors directly from review document without unauthorized calls to /customers/{customerId}
                const enrichedReviews = rawReviews.map((review: any) => ({
                    ...review,
                    authorName: review.customerName || review.authorName || 'Verified Diner',
                    authorImage: review.customerAvatar || review.authorImage || null
                }));

                setReviews(enrichedReviews);
            } catch (err: any) {
                // Silently handle without console spam if permissions or indexes are missing
                if (process.env.NODE_ENV === 'development' && err?.code !== 'permission-denied') {
                    console.error("Error fetching product-specific reviews:", err);
                }
                setReviews([]);
            } finally {
                setLoadingReviews(false);
            }
        };

        fetchProductReviews();
    }, [productId]);

    // 3. Check customer favorites
    useEffect(() => {
        if (customer?.favorites && productId) {
            setIsFavorite(customer.favorites.includes(productId));
        }
    }, [customer, productId]);

    // 4. Fetch Offers strictly for THIS Restaurant via Server API to eliminate client permission errors
    useEffect(() => {
        const fetchRestaurantOffers = async () => {
            const targetRestaurantId = product?.restaurantId || restaurant?.id;
            if (!targetRestaurantId) {
                setLoadingOffers(false);
                return;
            }

            try {
                setLoadingOffers(true);
                const validOffers: RestaurantOffer[] = [];

                // 1. Fetch via server-side API (safe, secure, avoids client-side permission issues)
                try {
                    const response = await fetch(`/api/promotions?restaurantId=${encodeURIComponent(targetRestaurantId)}`);
                    if (response.ok) {
                        const data = await response.json();
                        if (Array.isArray(data?.promotions)) {
                            data.promotions.forEach((p: any) => {
                                validOffers.push({
                                    id: p.id,
                                    code: p.code,
                                    type: p.type,
                                    value: p.value,
                                    description: p.description || 'Exclusive Restaurant Discount',
                                    minOrderAmount: p.minOrderAmount,
                                    maxDiscount: p.maxDiscount,
                                    restaurantName: restaurant?.name || 'this store'
                                });
                            });
                        }
                    }
                } catch {
                    // Silently ignore if server API is temporarily unavailable
                }

                // 2. Also check inline offers on restaurant document
                const inlineOffers = (restaurant as any)?.offers || (restaurant as any)?.promotions;
                if (Array.isArray(inlineOffers)) {
                    inlineOffers.forEach((io: any, idx: number) => {
                        if (io && io.code && !validOffers.some(o => o.code === io.code)) {
                            validOffers.push({
                                id: io.id || `inline_${idx}`,
                                code: io.code,
                                type: io.type || 'percentage',
                                value: io.value || io.discount || 0,
                                description: io.description || io.title || `Special offer from ${restaurant?.name}`,
                                minOrderAmount: io.minOrderAmount || io.minOrder,
                                maxDiscount: io.maxDiscount,
                                restaurantName: restaurant?.name
                            });
                        }
                    });
                }

                setRestaurantOffers(validOffers);
            } catch {
                setRestaurantOffers([]);
            } finally {
                setLoadingOffers(false);
            }
        };

        fetchRestaurantOffers();
    }, [product?.restaurantId, restaurant?.id, restaurant?.name]);

    // Initial sizes & add-on choices based on product configuration
    const configuredSizes = product?.sizes && product.sizes.length > 0
        ? product.sizes.map((s, idx) => ({ id: s.id || `size_${idx}`, name: s.name, price: Number(s.price) || 0 }))
        : DEFAULT_SIZES;

    const configuredAddOns = product?.addOns && product.addOns.length > 0
        ? product.addOns.map((a, idx) => ({ id: a.id || `addon_${idx}`, name: a.name, price: Number(a.price) || 0 }))
        : DEFAULT_ADDONS;

    // Set initial size when product loaded
    useEffect(() => {
        if (configuredSizes.length > 0) {
            setSelectedSize(configuredSizes[0]);
        }
    }, [product?.id]);

    const loadProductData = async () => {
        try {
            setLoading(true);
            const productDoc = await getDoc(doc(db, 'menuItems', productId));
            if (!productDoc.exists()) {
                router.push('/customer');
                return;
            }
            const productData = { ...productDoc.data(), id: productDoc.id } as MenuItem;
            setProduct(productData);

            const restaurantDoc = await getDoc(doc(db, 'restaurants', productData.restaurantId));
            if (restaurantDoc.exists()) {
                setRestaurant({ ...restaurantDoc.data(), id: restaurantDoc.id } as Restaurant);
            }

            const menuRef = collection(db, 'menuItems');
            const recQuery = query(
                menuRef,
                where('restaurantId', '==', productData.restaurantId),
                where('category', '==', productData.category)
            );
            const recSnapshot = await getDocs(recQuery);
            const recItems = recSnapshot.docs
                .map(doc => ({ ...doc.data(), id: doc.id }))
                .filter(item => item.id !== productId)
                .slice(0, 4) as MenuItem[];
            setRecommendations(recItems);
        } catch (error) {
            console.error('Error loading product data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleFavorite = async () => {
        if (!user) {
            toast.error("Please login to save favorites");
            return;
        }

        try {
            const customerRef = doc(db, 'customers', user.uid);
            if (isFavorite) {
                await updateDoc(customerRef, {
                    favorites: arrayRemove(productId)
                });
                setIsFavorite(false);
                toast.success('Removed from favorites');
            } else {
                await updateDoc(customerRef, {
                    favorites: arrayUnion(productId)
                });
                setIsFavorite(true);
                toast.success('Added to favorites');
            }
        } catch (error) {
            console.error("Error toggling favorite:", error);
            toast.error("Failed to update favorite");
        }
    };

    const toggleAddOn = (addon: { id: string; name: string; price: number }) => {
        setSelectedAddOns(prev => {
            const next = { ...prev };
            if (next[addon.id]) {
                delete next[addon.id];
            } else {
                next[addon.id] = { name: addon.name, price: addon.price };
            }
            return next;
        });
    };

    // Calculate Real Rating & Real Review Count
    const realReviewCount = reviews.length;
    const realAverageRating = realReviewCount > 0
        ? reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / realReviewCount
        : (product?.averageRating || 0);

    // Calculate Dynamic Price
    const basePrice = product?.price || 0;
    const sizePrice = selectedSize.price || 0;
    const addOnsTotal = Object.values(selectedAddOns).reduce((sum, a) => sum + a.price, 0);

    const unitPrice = basePrice + sizePrice + addOnsTotal;
    const totalPrice = unitPrice * quantity;

    // Handle Add to Cart & Save Spice Preference with Order
    const handleAddToCart = (isBuyNow = false) => {
        if (!product || !restaurant) return;

        // Bundle custom options into specialInstructions so it is saved with order
        const customParts: string[] = [
            `Spice Preference: ${selectedSpice}`
        ];

        if (selectedSize && selectedSize.name !== 'Regular') {
            customParts.push(`Portion: ${selectedSize.name}${selectedSize.price > 0 ? ` (+₹${selectedSize.price})` : ''}`);
        }

        const chosenAddOnsList = Object.values(selectedAddOns);
        if (chosenAddOnsList.length > 0) {
            customParts.push(`Extras: ${chosenAddOnsList.map(a => `${a.name} (+₹${a.price})`).join(', ')}`);
        }

        if (cookingNote.trim()) {
            customParts.push(`Special Request: ${cookingNote.trim()}`);
        }

        const fullCustomInstructions = customParts.join(' | ');

        addItem({
            menuItemId: product.id!,
            restaurantId: product.restaurantId,
            name: selectedSize.name !== 'Regular'
                ? `${product.name} (${selectedSize.name})`
                : product.name,
            price: unitPrice,
            image: product.image,
            quantity: quantity,
            restaurantName: restaurant.name,
            category: product.category,
            specialInstructions: fullCustomInstructions,
            id: `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            addedAt: new Date(),
        });

        if (isBuyNow) {
            router.push('/customer/checkout');
        } else {
            toast.success(`${product.name} added to cart! (${selectedSpice} spice)`);
        }
    };

    // Copy restaurant promo code
    const copyRestaurantPromo = async (promo: RestaurantOffer) => {
        await copyToClipboard(promo.code);
        localStorage.setItem('suggestedPromo', promo.code);
        localStorage.setItem('suggestedPromoRestaurantId', restaurant?.id || product?.restaurantId || '');
        toast.success(`Coupon "${promo.code}" copied! Valid only for ${restaurant?.name || 'this restaurant'}.`);
    };

    const handleShareProduct = async () => {
        const url = window.location.href;
        const copied = await copyToClipboard(url);
        if (copied) {
            toast.success("Dish link copied to clipboard!");
        } else {
            toast.info(`Dish: ${product.name}`);
        }
    };

    if (loading || !product) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-semibold text-muted-foreground tracking-wide">Loading Dish Details...</p>
            </div>
        );
    }

    const images = product.images && product.images.length > 0 ? product.images : [product.image];

    // Check if restaurant configured real ingredients or nutritional data
    const restaurantIngredients = (product as any)?.ingredients || product?.tags || [];
    const restaurantCalories = product.calories;
    const hasNutritionalData = Boolean(restaurantCalories || restaurantIngredients.length > 0);

    return (
        <div className="min-h-screen text-foreground font-sans selection:bg-primary/30 pb-32 md:pb-20">

            {/* Background Ambient Glow */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
                <div className="absolute top-[-10%] right-[-10%] w-[650px] h-[650px] bg-primary/10 rounded-full blur-[150px]" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-[150px]" />
            </div>

            {/* REDESIGNED & IMPROVED MODERN HEADER */}
            <header className="sticky top-0 z-40 p-3 sm:p-4">
                <div className="bg-card/90 backdrop-blur-2xl border border-border/70 rounded-2xl sm:rounded-3xl px-3.5 sm:px-5 py-2.5 flex items-center justify-between max-w-7xl mx-auto shadow-lg transition-all">
                    
                    {/* Left: Back Arrow & Restaurant Badge */}
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.back()}
                            className="rounded-xl hover:bg-muted text-foreground h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 cursor-pointer border border-border/50 shadow-xs"
                            aria-label="Go back"
                        >
                            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                        </Button>

                        {restaurant ? (
                            <Link
                                href={`/customer/restaurant/${restaurant.id}`}
                                className="flex items-center gap-2 group min-w-0 pr-2 hover:opacity-90 transition-opacity"
                            >
                                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl overflow-hidden border border-border/70 relative flex-shrink-0 bg-muted shadow-xs">
                                    <SafeImage
                                        src={restaurant.image}
                                        alt={restaurant.name}
                                        fill
                                        className="object-cover"
                                        fallbackType="restaurant"
                                    />
                                </div>
                                <div className="truncate">
                                    <div className="font-extrabold text-xs sm:text-sm text-foreground group-hover:text-primary transition-colors truncate flex items-center gap-1.5">
                                        <span>{restaurant.name}</span>
                                        <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                                    </div>
                                    <div className="text-[10px] sm:text-[11px] text-muted-foreground flex items-center gap-2 font-medium">
                                        <span className="text-amber-500 font-bold flex items-center gap-0.5">
                                            <Star className="w-2.5 h-2.5 fill-amber-500" />
                                            {(restaurant.rating || restaurant.averageRating || 4.2).toFixed(1)}
                                        </span>
                                        <span>•</span>
                                        <span>{restaurant.deliveryTime || 30} mins</span>
                                    </div>
                                </div>
                            </Link>
                        ) : (
                            <span className="font-extrabold text-sm text-foreground truncate">AKR Hunger</span>
                        )}
                    </div>

                    {/* Right: Share, Theme Toggle & Cart Button with Live Badge */}
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleShareProduct}
                            className="rounded-xl hover:bg-muted text-foreground h-9 w-9 sm:h-10 sm:w-10 cursor-pointer border border-border/40 shadow-xs"
                            aria-label="Share dish"
                        >
                            <Share2 className="w-4 h-4" />
                        </Button>

                        <div className="hidden sm:block">
                            <ThemeToggle />
                        </div>

                        <Link href="/customer/cart">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="rounded-xl hover:bg-muted text-foreground h-9 w-9 sm:h-10 sm:w-10 relative cursor-pointer border border-border/40 shadow-xs"
                                aria-label="View shopping cart"
                            >
                                <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 text-foreground" />
                                {totalCartCount > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-background animate-in zoom-in-50">
                                        {totalCartCount}
                                    </span>
                                )}
                            </Button>
                        </Link>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 relative z-10">

                {/* Left Column: Image Gallery, Store-Specific Offers & Badges */}
                <div className="lg:col-span-6 xl:col-span-6 space-y-5">
                    <div className="aspect-square w-full bg-muted rounded-3xl overflow-hidden border border-border/70 relative shadow-2xl group">
                        <SafeImage
                            src={images[currentImageIndex]}
                            alt={product.name}
                            className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                            style={{ imageRendering: 'auto' }}
                            fill
                            priority
                        />

                        {/* Top Badges */}
                        <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none">
                            {product.isBestSeller && (
                                <Badge className="bg-amber-500 text-black border-none backdrop-blur-md shadow-lg font-bold text-xs">
                                    ⭐ Best Seller
                                </Badge>
                            )}
                            {product.vegetarian ? (
                                <Badge className="bg-emerald-600 text-white border-none backdrop-blur-md shadow-lg text-xs flex items-center gap-1">
                                    <Leaf className="w-3 h-3" /> Pure Veg
                                </Badge>
                            ) : (
                                <Badge className="bg-rose-600 text-white border-none backdrop-blur-md shadow-lg text-xs flex items-center gap-1">
                                    <Flame className="w-3 h-3" /> Non-Veg
                                </Badge>
                            )}
                        </div>

                        {/* Favorite Button */}
                        <Button
                            onClick={handleToggleFavorite}
                            variant="secondary"
                            size="icon"
                            className={`absolute top-4 right-4 h-11 w-11 rounded-full border border-border/40 backdrop-blur-md transition-all shadow-md active:scale-95 cursor-pointer ${isFavorite ? 'bg-rose-500 text-white hover:bg-rose-600' : 'bg-card/80 text-foreground hover:bg-card'}`}
                            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                        >
                            <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
                        </Button>

                        {/* Bottom Bar Guarantee Pill inside image */}
                        <div className="absolute bottom-4 left-4 right-4 p-2.5 rounded-2xl bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-between text-white text-xs">
                            <span className="flex items-center gap-1.5 font-semibold">
                                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Tamper-Proof Sealed Pack
                            </span>
                            <span className="flex items-center gap-1 text-amber-300 font-bold">
                                <Truck className="w-3.5 h-3.5" /> 30-min Delivery
                            </span>
                        </div>
                    </div>

                    {/* Image Thumbnails */}
                    {images.length > 1 && (
                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                            {images.map((img, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setCurrentImageIndex(idx)}
                                    className={`w-20 h-20 rounded-2xl overflow-hidden border-2 transition-all flex-shrink-0 relative cursor-pointer ${idx === currentImageIndex ? 'border-primary ring-2 ring-primary/20 scale-105 shadow-md' : 'border-border/60 opacity-60 hover:opacity-100'}`}
                                >
                                    <SafeImage src={img} alt="" className="object-cover" fill />
                                </button>
                            ))}
                        </div>
                    )}

                    {/* STORE OFFERS - ONLY SHOWN IF THIS SPECIFIC RESTAURANT HAS ACTIVE OFFERS */}
                    {!loadingOffers && restaurantOffers.length > 0 && (
                        <div className="rounded-2xl p-4 bg-card/80 backdrop-blur-md border border-border/70 shadow-sm space-y-3 animate-in fade-in duration-300">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                    <Tag className="w-3.5 h-3.5 text-primary" /> Store Exclusive Offers
                                </span>
                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                    Valid only at {restaurant?.name || 'this store'}
                                </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {restaurantOffers.map((offer) => (
                                    <button
                                        key={offer.id}
                                        type="button"
                                        onClick={() => copyRestaurantPromo(offer)}
                                        className="p-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition-all text-left flex items-center justify-between group cursor-pointer"
                                    >
                                        <div className="min-w-0 pr-2">
                                            <div className="text-xs font-black text-primary flex items-center gap-1.5">
                                                <span>{offer.code}</span>
                                                <span className="text-[10px] font-normal text-muted-foreground truncate">
                                                    {offer.type === 'percentage'
                                                        ? `${offer.value}% OFF`
                                                        : offer.type === 'free_delivery'
                                                        ? 'FREE DELIVERY'
                                                        : `₹${offer.value} OFF`}
                                                </span>
                                            </div>
                                            <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                                                {offer.minOrderAmount ? `Min order ₹${offer.minOrderAmount}` : offer.description}
                                            </div>
                                        </div>
                                        <div className="p-1.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all flex-shrink-0">
                                            <Percent className="w-3.5 h-3.5" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                            <p className="text-[10px] text-muted-foreground text-center">
                                *Tap coupon to copy. Applied specifically to orders from {restaurant?.name || 'this restaurant'}.
                            </p>
                        </div>
                    )}

                    {/* Delivery & Hygiene Guarantees */}
                    <div className="grid grid-cols-3 gap-2.5 text-center">
                        <div className="p-3 rounded-2xl bg-card/60 border border-border/60 flex flex-col items-center gap-1">
                            <Clock className="w-5 h-5 text-primary" />
                            <span className="text-xs font-bold text-foreground">Fast Delivery</span>
                            <span className="text-[10px] text-muted-foreground">25-35 Mins</span>
                        </div>
                        <div className="p-3 rounded-2xl bg-card/60 border border-border/60 flex flex-col items-center gap-1">
                            <ShieldCheck className="w-5 h-5 text-emerald-500" />
                            <span className="text-xs font-bold text-foreground">Safe Food</span>
                            <span className="text-[10px] text-muted-foreground">Hygiene Certified</span>
                        </div>
                        <div className="p-3 rounded-2xl bg-card/60 border border-border/60 flex flex-col items-center gap-1">
                            <Sparkles className="w-5 h-5 text-amber-500" />
                            <span className="text-xs font-bold text-foreground">Fresh Made</span>
                            <span className="text-[10px] text-muted-foreground">Cooked on Order</span>
                        </div>
                    </div>
                </div>

                {/* Right Column: Title, Real Ratings, Restored Options & Add to Cart */}
                <div className="lg:col-span-6 xl:col-span-6 flex flex-col justify-between space-y-6">
                    <div>
                        {/* Categories & Badges */}
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                            <Badge variant="outline" className="border-primary/40 text-primary bg-primary/10 font-bold px-3 py-1">
                                {product.category}
                            </Badge>
                            {product.vegetarian ? (
                                <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 font-semibold flex gap-1">
                                    <Leaf className="w-3 h-3" /> 100% Vegetarian
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="border-rose-500/30 text-rose-500 bg-rose-500/10 font-semibold flex gap-1">
                                    <Flame className="w-3 h-3" /> Non-Vegetarian
                                </Badge>
                            )}
                        </div>

                        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-foreground leading-tight tracking-tight mb-2">
                            {product.name}
                        </h1>

                        {/* REAL REVIEWS COUNT & REAL RATING STATS */}
                        <div className="flex flex-wrap items-center gap-4 sm:gap-6 mb-4 text-muted-foreground text-sm">
                            <div className="flex items-center gap-2">
                                {realReviewCount > 0 ? (
                                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-500 font-black text-sm">
                                        <Star className="w-4 h-4 fill-amber-500" />
                                        <span>{realAverageRating.toFixed(1)}</span>
                                    </div>
                                ) : (
                                    <span className="px-2.5 py-0.5 rounded-lg bg-muted text-muted-foreground font-bold text-xs border border-border/50">
                                        NEW
                                    </span>
                                )}
                                <span className="text-xs sm:text-sm font-semibold text-muted-foreground">
                                    ({realReviewCount} verified customer {realReviewCount === 1 ? 'review' : 'reviews'})
                                </span>
                            </div>
                            <div className="w-1 h-1 bg-border rounded-full" />
                            <div className="flex items-center gap-1.5 font-medium">
                                <Clock className="w-4 h-4 text-primary" />
                                <span>{product.preparationTime || 25} mins prep</span>
                            </div>
                        </div>

                        {/* Short Description */}
                        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-6 border-l-4 border-primary pl-4 bg-muted/30 p-3.5 rounded-r-xl">
                            {product.description || "Prepared fresh with chef-curated premium ingredients, seasoned with authentic aromatic spices and crafted for an unforgettable culinary experience."}
                        </p>

                        {/* Quick Metrics */}
                        <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
                            <div className="bg-card/90 rounded-2xl p-3.5 sm:p-4 border border-border/60 text-center shadow-xs flex flex-col items-center gap-1">
                                <span className="text-2xl">🔥</span>
                                <div className="text-xl sm:text-2xl font-black text-foreground">{product.calories || '320'}</div>
                                <div className="text-[11px] sm:text-xs text-muted-foreground uppercase tracking-wider font-semibold">Calories</div>
                            </div>
                            <div className="bg-card/90 rounded-2xl p-3.5 sm:p-4 border border-border/60 text-center shadow-xs flex flex-col items-center gap-1">
                                <span className="text-2xl">🧑</span>
                                <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">{product.servings || '1'}</div>
                                <div className="text-[11px] sm:text-xs text-muted-foreground uppercase tracking-wider font-semibold">Portion</div>
                            </div>
                            <div className="bg-card/90 rounded-2xl p-3.5 sm:p-4 border border-border/60 text-center shadow-xs flex flex-col items-center gap-1">
                                <span className="text-2xl">🌿</span>
                                <div className="text-xl sm:text-2xl font-black text-amber-500">100%</div>
                                <div className="text-[11px] sm:text-xs text-muted-foreground uppercase tracking-wider font-semibold">Fresh Quality</div>
                            </div>
                        </div>

                        {/* Segment Tabs: Customize Options vs Nutrition & Ingredients */}
                        <div className="flex p-1 bg-muted/60 rounded-2xl border border-border/60 mb-6 text-xs sm:text-sm font-bold">
                            <button
                                type="button"
                                onClick={() => setActiveTab('customize')}
                                className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                    activeTab === 'customize' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <Utensils className="w-4 h-4 text-primary" />
                                <span>Customize &amp; Options</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('nutrition')}
                                className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                    activeTab === 'nutrition' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <Info className="w-4 h-4 text-amber-500" />
                                <span>Nutrition &amp; Ingredients</span>
                            </button>
                        </div>

                        {/* TAB 1: RESTORED CUSTOMIZE OPTIONS & SPICE PREFERENCE */}
                        {activeTab === 'customize' && (
                            <div className="space-y-6 animate-in fade-in duration-200">
                                
                                {/* 1. SPICE PREFERENCE (ALWAYS SAVED WITH ORDER) */}
                                <div className="space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-bold text-foreground flex items-center gap-1.5">
                                            <Flame className="w-4 h-4 text-orange-500" />
                                            <span>Spice Preference</span>
                                        </label>
                                        <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                            Selected: {selectedSpice}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        {SPICE_LEVELS.map(level => {
                                            const isSelected = selectedSpice === level.id;
                                            return (
                                                <button
                                                    key={level.id}
                                                    type="button"
                                                    onClick={() => setSelectedSpice(level.id)}
                                                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer flex flex-col items-center gap-0.5 ${
                                                        isSelected
                                                            ? 'border-primary bg-primary/15 text-foreground ring-2 ring-primary/25 shadow-xs'
                                                            : 'border-border/70 bg-card/60 text-muted-foreground hover:text-foreground hover:bg-card'
                                                    }`}
                                                >
                                                    <span className="font-extrabold">{level.label}</span>
                                                    <span className="text-[10px] text-muted-foreground font-normal">{level.desc}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* 2. PORTION / SIZE SELECTION */}
                                <div className="space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-bold text-foreground">
                                            Portion Size
                                        </label>
                                        {selectedSize.price > 0 && (
                                            <span className="text-xs font-bold text-primary">+₹{selectedSize.price}</span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                        {configuredSizes.map(sizeOpt => {
                                            const isSelected = selectedSize.id === sizeOpt.id;
                                            return (
                                                <button
                                                    key={sizeOpt.id}
                                                    type="button"
                                                    onClick={() => setSelectedSize(sizeOpt)}
                                                    className={`p-3 rounded-2xl text-left border transition-all cursor-pointer relative ${
                                                        isSelected
                                                            ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary/20'
                                                            : 'border-border/70 bg-card/60 hover:border-border hover:bg-card'
                                                    }`}
                                                >
                                                    {isSelected && (
                                                        <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px]">
                                                            ✓
                                                        </div>
                                                    )}
                                                    <div className="font-bold text-sm text-foreground">{sizeOpt.name}</div>
                                                    {sizeOpt.desc && (
                                                        <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">{sizeOpt.desc}</div>
                                                    )}
                                                    <div className="text-xs font-black text-primary mt-2">
                                                        {sizeOpt.price === 0 ? 'Standard Price' : `+₹${sizeOpt.price}`}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* 3. GOURMET ADD-ONS / EXTRAS MULTI-SELECT */}
                                <div className="space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-bold text-foreground">
                                            Add-ons &amp; Extras
                                        </label>
                                        <span className="text-xs text-muted-foreground font-medium">Select multiple</span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                        {configuredAddOns.map(addon => {
                                            const isSelected = Boolean(selectedAddOns[addon.id]);
                                            return (
                                                <button
                                                    key={addon.id}
                                                    type="button"
                                                    onClick={() => toggleAddOn(addon)}
                                                    className={`p-3 rounded-2xl text-left border transition-all flex items-center justify-between cursor-pointer ${
                                                        isSelected
                                                            ? 'border-primary bg-primary/10 ring-1 ring-primary/20 shadow-xs'
                                                            : 'border-border/70 bg-card/60 hover:border-border hover:bg-card'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center text-xs transition-colors ${
                                                            isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40 bg-card'
                                                        }`}>
                                                            {isSelected && '✓'}
                                                        </div>
                                                        <div className="truncate">
                                                            <div className="text-xs sm:text-sm font-bold text-foreground truncate">{addon.name}</div>
                                                        </div>
                                                    </div>
                                                    <span className="text-xs font-black text-primary flex-shrink-0">
                                                        {addon.price > 0 ? `+₹${addon.price}` : 'Free'}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* 4. COOKING INSTRUCTIONS / SPECIAL REQUEST (SAVED WITH ORDER) */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-foreground flex items-center gap-1.5">
                                        <MessageSquareText className="w-4 h-4 text-primary" />
                                        <span>Special Cooking Instructions</span>
                                    </label>
                                    <textarea
                                        value={cookingNote}
                                        onChange={(e) => setCookingNote(e.target.value)}
                                        placeholder="e.g. Less spicy, no onions, extra crispy, ketchup pouches..."
                                        rows={2}
                                        className="w-full rounded-xl bg-muted/40 border border-border/70 p-3 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:bg-background transition-all resize-none"
                                    />
                                    <p className="text-[11px] text-muted-foreground">
                                        *Saved directly with your order and sent to the kitchen chef.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* TAB 2: NUTRITION & FRESH INGREDIENTS */}
                        {activeTab === 'nutrition' && (
                            <div className="space-y-5 animate-in fade-in duration-200">
                                
                                {/* A. KEY FRESH INGREDIENTS (SHOWS REAL RESTAURANT INGREDIENTS IF ADDED, OR EMPTY NOTICE) */}
                                <div className="rounded-2xl p-4 bg-card/90 border border-border/70 shadow-xs space-y-2.5">
                                    <h4 className="font-black text-sm text-foreground flex items-center gap-1.5">
                                        <Leaf className="w-4 h-4 text-emerald-500" />
                                        <span>Key Fresh Ingredients</span>
                                    </h4>

                                    {restaurantIngredients && restaurantIngredients.length > 0 ? (
                                        <div className="flex flex-wrap gap-2 pt-1">
                                            {restaurantIngredients.map((item: string, i: number) => (
                                                <span key={i} className="px-3 py-1.5 rounded-xl bg-muted/60 border border-border/60 text-xs font-semibold text-foreground flex items-center gap-1">
                                                    🌱 {item}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-3 rounded-xl bg-muted/30 text-xs text-muted-foreground italic">
                                            Detailed ingredient list has not been provided by the restaurant for this item.
                                        </div>
                                    )}
                                </div>

                                {/* B. NUTRITIONAL FACTS (PER SERVING) */}
                                <div className="rounded-2xl p-4 bg-card/90 border border-border/70 shadow-xs space-y-3">
                                    <h4 className="font-black text-sm text-foreground flex items-center gap-2">
                                        <span>Nutritional Facts (Per Serving)</span>
                                    </h4>

                                    {hasNutritionalData ? (
                                        <div className="space-y-2.5 text-xs">
                                            <div>
                                                <div className="flex justify-between font-bold text-foreground mb-1">
                                                    <span>Energy (Calories)</span>
                                                    <span>{restaurantCalories || 320} kcal</span>
                                                </div>
                                                <div className="h-2 rounded-full bg-muted overflow-hidden">
                                                    <div className="h-full bg-orange-500 rounded-full w-[35%]" />
                                                </div>
                                            </div>

                                            <div>
                                                <div className="flex justify-between font-bold text-foreground mb-1">
                                                    <span>Protein</span>
                                                    <span>{Math.round(((restaurantCalories || 320) * 0.15) / 4)}g</span>
                                                </div>
                                                <div className="h-2 rounded-full bg-muted overflow-hidden">
                                                    <div className="h-full bg-emerald-500 rounded-full w-[45%]" />
                                                </div>
                                            </div>

                                            <div>
                                                <div className="flex justify-between font-bold text-foreground mb-1">
                                                    <span>Total Carbohydrates</span>
                                                    <span>{Math.round(((restaurantCalories || 320) * 0.55) / 4)}g</span>
                                                </div>
                                                <div className="h-2 rounded-full bg-muted overflow-hidden">
                                                    <div className="h-full bg-blue-500 rounded-full w-[40%]" />
                                                </div>
                                            </div>

                                            <div>
                                                <div className="flex justify-between font-bold text-foreground mb-1">
                                                    <span>Fats</span>
                                                    <span>{Math.round(((restaurantCalories || 320) * 0.30) / 9)}g</span>
                                                </div>
                                                <div className="h-2 rounded-full bg-muted overflow-hidden">
                                                    <div className="h-full bg-rose-500 rounded-full w-[28%]" />
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-3 rounded-xl bg-muted/30 text-xs text-muted-foreground italic">
                                            Specific nutritional values have not been provided by the restaurant.
                                        </div>
                                    )}
                                </div>

                                {/* C. ALLERGEN NOTICE */}
                                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5 text-xs text-amber-600 dark:text-amber-400">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <span className="font-bold">Allergen Notice: </span>
                                        <span>If you have severe dietary allergies, please add your specifications in the cooking instructions box above before ordering.</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Pricing Breakdown & Action Buttons Card */}
                    <div className="space-y-4 pt-6 border-t border-border/60">
                        <div className="bg-card/90 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-border/70 shadow-md">
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-0.5">Calculated Total</p>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">₹{totalPrice}</span>
                                        {quantity > 1 && (
                                            <span className="text-xs text-muted-foreground font-medium">
                                                (₹{unitPrice} × {quantity})
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Quantity Counter */}
                                <div className="flex items-center gap-3 bg-muted/60 p-1.5 rounded-full border border-border/60 shadow-inner">
                                    <button
                                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-card hover:bg-accent flex items-center justify-center transition-all active:scale-95 text-foreground disabled:opacity-40 disabled:cursor-not-allowed border border-border/60 shadow-xs cursor-pointer"
                                        disabled={quantity <= 1}
                                        aria-label="Decrease quantity"
                                    >
                                        <Minus className="w-4 h-4" />
                                    </button>
                                    <span className="w-7 text-center font-black text-base sm:text-lg tabular-nums text-foreground">{quantity}</span>
                                    <button
                                        onClick={() => setQuantity(quantity + 1)}
                                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center transition-all active:scale-95 shadow-sm cursor-pointer"
                                        aria-label="Increase quantity"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Summary breakdown line */}
                            <div className="text-[11px] text-muted-foreground pt-2 border-t border-border/50 flex flex-wrap gap-x-2 gap-y-1">
                                <span>Base: ₹{basePrice}</span>
                                {sizePrice > 0 && <span>• Size (+₹{sizePrice})</span>}
                                {addOnsTotal > 0 && <span>• Add-ons (+₹{addOnsTotal})</span>}
                                <span className="font-semibold text-primary">• Spice: {selectedSpice}</span>
                            </div>
                        </div>

                        {/* CTA Buttons */}
                        <div className="flex gap-3 sm:gap-4">
                            <Button
                                onClick={() => handleAddToCart(false)}
                                variant="outline"
                                className="flex-1 h-12 sm:h-14 rounded-xl sm:rounded-2xl border-border bg-card hover:bg-muted text-foreground font-bold text-sm sm:text-base tracking-wide transition-all active:scale-[0.98] cursor-pointer shadow-sm"
                            >
                                <ShoppingCart className="w-4 h-4 mr-2" />
                                Add to Cart
                            </Button>
                            <Button
                                onClick={() => handleAddToCart(true)}
                                className="flex-1 h-12 sm:h-14 rounded-xl sm:rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm sm:text-base shadow-lg shadow-primary/25 tracking-wide transition-all active:scale-[0.98] cursor-pointer"
                            >
                                <Zap className="w-4 h-4 sm:w-5 sm:h-5 mr-2 fill-current" />
                                Buy Now
                            </Button>
                        </div>
                    </div>
                </div>
            </main>

            {/* Recommendations Section */}
            {recommendations.length > 0 && (
                <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 sm:mt-20">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl sm:text-2xl font-black flex items-center gap-2 text-foreground">
                            <span>Frequently Ordered Together</span>
                            <Sparkles className="w-5 h-5 text-amber-500" />
                        </h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
                        {recommendations.map(item => (
                            <Link key={item.id} href={`/customer/product/${item.id}`} className="block group">
                                <div className="bg-card border border-border/60 rounded-2xl overflow-hidden hover:border-primary/50 transition-all shadow-xs hover:shadow-md">
                                    <div className="h-44 relative bg-muted">
                                        <SafeImage
                                            src={item.image}
                                            alt={item.name}
                                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                                            fill
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

                                        {/* Price Badge */}
                                        <div className="absolute bottom-2.5 right-2.5 bg-card/90 backdrop-blur-md px-2.5 py-1 rounded-lg text-xs font-black text-foreground border border-border/60 shadow-xs">
                                            ₹{item.price}
                                        </div>

                                        {/* Rating Badge */}
                                        <div className="absolute top-2.5 left-2.5 flex items-center gap-1 bg-amber-500 text-black px-2 py-0.5 rounded-md text-[11px] font-bold shadow-sm">
                                            <Star className="w-3 h-3 fill-black text-black" />
                                            <span>{item.averageRating?.toFixed(1) || '4.5'}</span>
                                        </div>
                                    </div>
                                    <div className="p-4">
                                        <h4 className="font-bold text-foreground text-base truncate mb-1 group-hover:text-primary transition-colors">{item.name}</h4>

                                        <div className="flex justify-between items-center mt-3 pt-3 border-t border-border/60">
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <Clock className="w-3 h-3 text-primary" /> 25m
                                            </div>

                                            <div className="flex items-center gap-0.5">
                                                {[1, 2, 3, 4, 5].map(star => (
                                                    <Star
                                                        key={star}
                                                        className={`w-3 h-3 ${(item.averageRating || 4) >= star ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground/40'}`}
                                                    />
                                                ))}
                                                <span className="text-[10px] text-muted-foreground ml-1">({item.totalReviews || 0})</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* REAL RATINGS & REVIEWS SECTION - STRICTLY FOR THIS PRODUCT */}
            <ReviewsSection
                productId={productId}
                productName={product.name}
                reviews={reviews}
                loading={loadingReviews}
                realAverageRating={realAverageRating}
            />

            {/* Sticky Mobile Add To Cart Floating Bar */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 p-3 bg-card/95 backdrop-blur-xl border-t border-border/70 z-50 shadow-2xl flex items-center justify-between gap-3">
                <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Price</div>
                    <div className="text-xl font-black text-foreground">₹{totalPrice}</div>
                    <div className="text-[10px] text-primary font-semibold truncate max-w-[120px]">{selectedSpice}</div>
                </div>
                <div className="flex items-center gap-2 flex-1 justify-end">
                    <Button
                        onClick={() => handleAddToCart(false)}
                        variant="outline"
                        className="h-11 px-4 rounded-xl border-border font-bold text-xs cursor-pointer"
                    >
                        Cart
                    </Button>
                    <Button
                        onClick={() => handleAddToCart(true)}
                        className="h-11 px-6 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs shadow-md shadow-primary/25 cursor-pointer"
                    >
                        <Zap className="w-3.5 h-3.5 mr-1.5 fill-current" />
                        Buy Now
                    </Button>
                </div>
            </div>
        </div>
    );
}

interface ReviewsSectionProps {
    productId: string;
    productName: string;
    reviews: any[];
    loading: boolean;
    realAverageRating: number;
}

function ReviewsSection({
    productName,
    reviews,
    loading,
    realAverageRating
}: ReviewsSectionProps) {
    const handleShare = async (reviewId: string) => {
        const url = window.location.href;
        const copied = await copyToClipboard(url);
        if (copied) {
            toast.success("Link copied to clipboard!");
        } else {
            toast.info(`Dish link: ${url}`);
        }
    };

    const handleHelpful = async (reviewId: string) => {
        toast.success("Thanks for your feedback!");
    };

    if (loading) {
        return (
            <div className="p-12 text-center text-xs font-semibold text-muted-foreground">
                Loading customer reviews for {productName}...
            </div>
        );
    }

    if (reviews.length === 0) {
        return (
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 sm:mt-20">
                <div className="bg-card/70 border border-border/70 rounded-3xl p-8 text-center max-w-xl mx-auto space-y-3 shadow-xs">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
                        <Star className="w-6 h-6 fill-amber-500/20" />
                    </div>
                    <h4 className="text-xl font-black text-foreground">No Customer Reviews Yet</h4>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                        Be the first customer to order <span className="font-bold text-foreground">"{productName}"</span> and share your rating with fellow diners!
                    </p>
                </div>
            </section>
        );
    }

    // Per-star counts for real reviews
    const starCounts = [5, 4, 3, 2, 1].map(s => ({
        star: s,
        count: reviews.filter(r => Math.round(r.rating || 0) === s).length
    }));

    const formatDate = (ts: any) => {
        if (!ts?.seconds) return 'Recent';
        const date = new Date(ts.seconds * 1000);
        const now = Date.now();
        const diff = Math.floor((now - date.getTime()) / 1000);
        if (diff < 86400) return 'Today';
        if (diff < 172800) return 'Yesterday';
        if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
        return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    return (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 sm:mt-24 mb-16">
            {/* Section Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h3 className="text-2xl sm:text-3xl font-black flex items-center gap-3 text-foreground">
                        Ratings &amp; Reviews
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Real verified customer feedback for {productName}</p>
                </div>
                <span className="text-xs sm:text-sm text-muted-foreground font-semibold bg-muted/60 px-3 py-1 rounded-full border border-border/50">
                    {reviews.length} {reviews.length === 1 ? 'verified review' : 'verified reviews'}
                </span>
            </div>

            {/* Overall Rating Summary */}
            <div className="bg-card border border-border/60 rounded-2xl sm:rounded-3xl p-5 sm:p-6 mb-8 flex flex-col sm:flex-row gap-6 sm:gap-10 items-center">
                <div className="text-center flex-shrink-0">
                    <div className="text-6xl sm:text-7xl font-black text-foreground tracking-tight">
                        {realAverageRating.toFixed(1)}
                    </div>
                    <div className="flex justify-center gap-1 mt-2">
                        {[1, 2, 3, 4, 5].map(s => (
                            <Star
                                key={s}
                                className={`w-5 h-5 ${realAverageRating >= s ? 'fill-amber-500 text-amber-500' : realAverageRating >= s - 0.5 ? 'fill-amber-300 text-amber-300' : 'text-muted-foreground/30'}`}
                            />
                        ))}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 font-medium">{reviews.length} authentic ratings</div>
                </div>

                <div className="flex-1 w-full space-y-2">
                    {starCounts.map(({ star, count }) => (
                        <div key={star} className="flex items-center gap-3">
                            <span className="text-xs font-bold text-muted-foreground w-4 text-right">{star}</span>
                            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 flex-shrink-0" />
                            <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                                <div
                                    className="h-full bg-amber-500 rounded-full transition-all duration-500"
                                    style={{ width: reviews.length > 0 ? `${(count / reviews.length) * 100}%` : '0%' }}
                                />
                            </div>
                            <span className="text-xs text-muted-foreground font-medium w-6">{count}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Individual Review Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                {reviews.map((review: any) => (
                    <div key={review.id} className="bg-card border border-border/60 p-5 sm:p-6 rounded-2xl sm:rounded-3xl flex flex-col gap-4 hover:border-primary/40 hover:shadow-md transition-all group">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3 sm:gap-4">
                                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-primary to-amber-500 p-[2px] shadow-xs flex-shrink-0">
                                    <div className="w-full h-full rounded-full bg-card overflow-hidden relative">
                                        {review.authorImage ? (
                                            <SafeImage
                                                src={review.authorImage}
                                                alt={review.authorName}
                                                className="object-cover"
                                                fallbackType="generic"
                                                fill
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center font-black text-base sm:text-lg text-primary bg-primary/10">
                                                {review.authorName?.[0]?.toUpperCase() || 'U'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm sm:text-base text-foreground flex items-center gap-1.5">
                                        {review.authorName}
                                        {review.isVerified && (
                                            <span className="inline-flex items-center gap-0.5 text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full border border-emerald-500/30 font-semibold">
                                                <ShieldCheck className="w-2.5 h-2.5" /> Verified
                                            </span>
                                        )}
                                    </h4>
                                    <div className="flex items-center gap-1 mt-0.5">
                                        {[1, 2, 3, 4, 5].map(s => (
                                            <Star key={s} className={`w-3.5 h-3.5 ${review.rating >= s ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground/30'}`} />
                                        ))}
                                        <span className="text-xs font-bold text-foreground ml-0.5">{review.rating?.toFixed(1)}</span>
                                    </div>
                                </div>
                            </div>
                            <span className="text-[11px] text-muted-foreground font-medium bg-muted px-2 py-1 rounded-lg">
                                {formatDate(review.createdAt)}
                            </span>
                        </div>

                        {review.comment && (
                            <div className="relative">
                                <span className="absolute -top-2 -left-1 text-3xl text-muted-foreground/20 font-serif leading-none">"</span>
                                <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed pl-3.5 relative z-10 italic">
                                    {review.comment}
                                </p>
                            </div>
                        )}

                        <div className="mt-auto pt-3.5 border-t border-border/60 flex items-center gap-4 text-xs text-muted-foreground">
                            <button onClick={() => handleHelpful(review.id)} className="flex items-center gap-1.5 hover:text-rose-500 transition-colors cursor-pointer">
                                <Heart className="w-3.5 h-3.5" /> Helpful
                            </button>
                            <button onClick={() => handleShare(review.id)} className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer">
                                <Share2 className="w-3.5 h-3.5" /> Share
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
