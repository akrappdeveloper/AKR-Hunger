'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import SafeImage from '@/components/ui/safe-image';
import { Restaurant, MenuItem, Promotion } from '@/lib/types';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import {
    Star,
    Clock,
    MapPin,
    ArrowLeft,
    Heart,
    Search,
    Share2,
    Plus,
    Minus,
    ShoppingBag,
    AlertTriangle,
    X,
    Sparkles,
    ShieldCheck,
    Store,
    ChevronRight,
    Tag,
    Bike,
    Navigation,
    CheckCircle2
} from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogClose
} from '@/components/ui/dialog';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { copyToClipboard } from '@/lib/utils';

interface RestaurantClientProps {
    restaurantId: string;
    initialRestaurant?: Restaurant | null;
    initialMenuItems?: MenuItem[];
}

export default function RestaurantClient({
    restaurantId,
    initialRestaurant,
    initialMenuItems
}: RestaurantClientProps) {
    const router = useRouter();
    const { items: cartItems, addItem, removeItem, updateQuantity, total, deliveryAddress } = useCart();
    const { user, customer } = useAuth();

    const [restaurant, setRestaurant] = useState<Restaurant | null>(initialRestaurant || null);
    const [menuItems, setMenuItems] = useState<MenuItem[]>(initialMenuItems || []);
    const [loading, setLoading] = useState(!initialRestaurant);
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [categories, setCategories] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isServiceable, setIsServiceable] = useState(true);
    const [activeFilter, setActiveFilter] = useState<'all' | 'veg' | 'non-veg'>('all');
    const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isFavorite, setIsFavorite] = useState(false);
    const [activePromotions, setActivePromotions] = useState<any[]>([]);
    const [activeOrder, setActiveOrder] = useState<any | null>(null);

    const categoryRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

    // Listen for customer's ongoing active order with this restaurant
    useEffect(() => {
        if (!user || !restaurantId) {
            setActiveOrder(null);
            return;
        }

        try {
            const { collection, query, where, onSnapshot } = require('firebase/firestore');
            const ordersRef = collection(db, 'orders');
            const q = query(
                ordersRef,
                where('customerId', '==', user.uid),
                where('restaurantId', '==', restaurantId)
            );

            const unsubscribe = onSnapshot(q, (snapshot: any) => {
                const active = snapshot.docs
                    .map((d: any) => ({ id: d.id, ...d.data() }))
                    .filter((ord: any) => ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(ord.status))
                    .sort((a: any, b: any) => {
                        const timeA = a.createdAt?.seconds || 0;
                        const timeB = b.createdAt?.seconds || 0;
                        return timeB - timeA;
                    })[0];
                setActiveOrder(active || null);
            }, (err: any) => {
                console.error('Error tracking active restaurant order:', err);
            });

            return () => unsubscribe();
        } catch (e) {
            console.error('Active order listener setup error:', e);
        }
    }, [user, restaurantId]);

    // Fetch active promotions specifically applicable to this restaurant or global platform
    useEffect(() => {
        const fetchPromotions = async () => {
            if (!restaurantId) return;

            // 1. First try fetching via server-side API (fast, secure, avoids client-side permission issues)
            try {
                const response = await fetch(`/api/promotions?restaurantId=${encodeURIComponent(restaurantId)}`);
                if (response.ok) {
                    const data = await response.json();
                    if (Array.isArray(data?.promotions)) {
                        setActivePromotions(data.promotions);
                        return;
                    }
                }
            } catch {
                // Silently fallback if API call fails
            }

            // 2. Client-side Firestore fallback with silent error catch to prevent console permission spam
            try {
                const { collection, getDocs, query, where } = await import('firebase/firestore');
                const promotionsRef = collection(db, 'promotions');
                const q = query(promotionsRef, where('isActive', '==', true));
                const snapshot = await getDocs(q);
                const now = new Date();

                const validPromotions = snapshot.docs
                    .map(doc => {
                        const data = doc.data();
                        return {
                            id: doc.id,
                            ...data,
                            validFrom: data.validFrom?.toDate ? data.validFrom.toDate() : new Date(data.validFrom || Date.now()),
                            validUntil: data.validUntil?.toDate ? data.validUntil.toDate() : new Date(data.validUntil || Date.now()),
                        } as Promotion;
                    })
                    .filter(promo => {
                        // Check date validity
                        if (now < promo.validFrom || now > promo.validUntil) return false;
                        // Check usage limit
                        if (promo.usageLimit && promo.usageCount >= promo.usageLimit) return false;
                        // Check if applicable to this restaurant (empty = global platform coupon by Admin)
                        if (promo.applicableRestaurants && promo.applicableRestaurants.length > 0) {
                            return promo.applicableRestaurants.includes(restaurantId);
                        }
                        return true;
                    });

                setActivePromotions(validPromotions);
            } catch {
                // Silently ignore permission errors when cloud firestore rules are not yet deployed
            }
        };

        fetchPromotions();
    }, [restaurantId]);

    // Initialize categories from initial or fetched items
    useEffect(() => {
        if (initialMenuItems && initialMenuItems.length > 0) {
            const uniqueCategories = Array.from(new Set(initialMenuItems.map((item) => item.category)));
            setCategories(uniqueCategories);
            if (uniqueCategories.length > 0) setActiveCategory(uniqueCategories[0]);
        }
    }, [initialMenuItems]);

    // Check favorite status
    useEffect(() => {
        if (customer?.favoriteRestaurants && restaurantId) {
            setIsFavorite(customer.favoriteRestaurants.includes(restaurantId));
        }
    }, [customer, restaurantId]);

    // Silky Smooth 60 FPS Scroll Spy (Zero layout shifts, zero DOM unmounting, no flickering)
    useEffect(() => {
        if (categories.length === 0) return;

        let ticking = false;

        const handleScroll = () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    const scrollPosition = window.scrollY + 200;

                    // Search from bottom up to find current active section
                    for (let i = categories.length - 1; i >= 0; i--) {
                        const cat = categories[i];
                        const el = categoryRefs.current[cat];
                        if (el) {
                            const offsetTop = el.offsetTop;
                            if (scrollPosition >= offsetTop - 60) {
                                setActiveCategory(prev => (prev !== cat ? cat : prev));
                                break;
                            }
                        }
                    }
                    ticking = false;
                });
                ticking = true;
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [categories]);

    // Fetch Restaurant fallback if not supplied through SSR
    useEffect(() => {
        if (initialRestaurant && restaurant?.id === restaurantId) return;

        const fetchRestaurantData = async () => {
            try {
                setLoading(true);
                const response = await fetch(`/api/restaurants/${restaurantId}`);
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Failed to fetch restaurant');

                const fetchedRestaurant = data.restaurant as Restaurant;
                setRestaurant(fetchedRestaurant);

                const rawItems = data.menuItems as MenuItem[];
                const items = rawItems.filter(item => item.approvalStatus === 'approved' && item.isLive);
                setMenuItems(items);

                const uniqueCategories = Array.from(new Set(items.map((item) => item.category)));
                setCategories(uniqueCategories);
                if (uniqueCategories.length > 0) setActiveCategory(uniqueCategories[0]);
            } catch (error) {
                console.error('Error fetching restaurant data:', error);
            } finally {
                setLoading(false);
            }
        };

        if (restaurantId) fetchRestaurantData();
    }, [restaurantId, initialRestaurant, restaurant?.id]);

    // Serviceability check based on user's active cart delivery address
    useEffect(() => {
        if (restaurant && restaurant.servicePincodes && restaurant.servicePincodes.length > 0) {
            const activePincode = deliveryAddress?.pincode || customer?.addresses?.find(a => a.isDefault)?.pincode;
            if (activePincode) {
                const canServe = restaurant.servicePincodes.includes(activePincode);
                setIsServiceable(canServe);
            } else {
                setIsServiceable(true);
            }
        } else {
            setIsServiceable(true);
        }
    }, [restaurant, deliveryAddress, customer]);

    // Smooth scroll to category without screen jump
    const scrollToCategory = (category: string) => {
        setActiveCategory(category);
        const element = categoryRefs.current[category];
        if (element) {
            const navOffset = 160; // sticky navbar + category header height
            const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
            window.scrollTo({ top: elementPosition - navOffset, behavior: 'smooth' });
        }
    };

    const getQuantityInCart = (itemId: string) => {
        return cartItems
            .filter(item => item.menuItemId === itemId)
            .reduce((sum, item) => sum + item.quantity, 0);
    };

    const handleAddToCart = (item: MenuItem, e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (!isServiceable) {
            toast.error("Sorry, this restaurant does not deliver to your current location.");
            return;
        }
        addItem({
            id: `${item.id}-${Date.now()}`,
            menuItemId: item.id,
            restaurantId: item.restaurantId,
            name: item.name,
            price: item.price,
            quantity: 1,
            image: item.image,
            restaurantName: restaurant?.name || '',
            category: item.category,
            addedAt: new Date(),
        });
        toast.success(`Added "${item.name}" to cart`);
    };

    const handleToggleFavorite = async () => {
        if (!user) {
            toast.error("Please login to save favorite restaurants");
            return;
        }

        try {
            const customerRef = doc(db, 'customers', user.uid);
            if (isFavorite) {
                await updateDoc(customerRef, {
                    favoriteRestaurants: arrayRemove(restaurantId)
                });
                setIsFavorite(false);
                toast.success('Removed from favorite restaurants');
            } else {
                await updateDoc(customerRef, {
                    favoriteRestaurants: arrayUnion(restaurantId)
                });
                setIsFavorite(true);
                toast.success('Added to favorite restaurants!');
            }
        } catch (error) {
            console.error("Error toggling favorite:", error);
            toast.error("Failed to update favorite");
        }
    };

    const openItemModal = (item: MenuItem) => {
        setSelectedItem(item);
        setIsModalOpen(true);
    };

    const getCategoryEmoji = (cat: string) => {
        const c = cat.toLowerCase();
        if (c.includes('pizza')) return '🍕';
        if (c.includes('burger')) return '🍔';
        if (c.includes('biryani') || c.includes('rice')) return '🍲';
        if (c.includes('noodle') || c.includes('chinese') || c.includes('soup')) return '🍜';
        if (c.includes('dessert') || c.includes('sweet') || c.includes('cake') || c.includes('pastry') || c.includes('ice')) return '🍰';
        if (c.includes('drink') || c.includes('beverage') || c.includes('shake') || c.includes('juice') || c.includes('tea') || c.includes('coffee')) return '🥤';
        if (c.includes('salad') || c.includes('healthy')) return '🥗';
        if (c.includes('roll') || c.includes('wrap') || c.includes('shawarma')) return '🌯';
        if (c.includes('kebab') || c.includes('tandoor') || c.includes('grill') || c.includes('tikka')) return '🍢';
        if (c.includes('south') || c.includes('dosa') || c.includes('idli')) return '🥞';
        if (c.includes('chaat') || c.includes('street') || c.includes('snack') || c.includes('samosa')) return '🥘';
        if (c.includes('bread') || c.includes('roti') || c.includes('naan')) return '🫓';
        if (c.includes('curry') || c.includes('gravy') || c.includes('dal') || c.includes('main')) return '🍛';
        return '🍽️';
    };

    // Filter Items by query and veg/non-veg
    const filteredItems = menuItems.filter(item => {
        const matchesSearch = !searchQuery.trim() ||
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.category?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesFilter = activeFilter === 'all'
            ? true
            : activeFilter === 'veg'
                ? item.vegetarian
                : !item.vegetarian;

        return matchesSearch && matchesFilter;
    });

    if (loading) {
        return (
            <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-sm text-muted-foreground animate-pulse font-medium">Loading restaurant menu...</p>
            </div>
        );
    }

    if (!restaurant) {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-4">
                    <Store className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-black mb-2 text-foreground">Restaurant Not Found</h2>
                <p className="text-muted-foreground text-sm mb-6 max-w-sm">We couldn't locate this restaurant or it is currently not operational.</p>
                <Button onClick={() => router.push('/customer')} className="rounded-xl font-bold bg-primary text-primary-foreground">
                    Back to Food Explorer
                </Button>
            </div>
        );
    }

    const rating = restaurant.rating || restaurant.averageRating || 4.2;

    return (
        <div className="min-h-screen bg-background text-foreground pb-36 sm:pb-28 font-sans selection:bg-primary/20 relative">

            {/* Ambient Background Warm Glow */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
                <div className="absolute top-[-5%] right-[-5%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[140px]" />
                <div className="absolute top-[20%] left-[-10%] w-[450px] h-[450px] bg-amber-500/5 rounded-full blur-[120px]" />
            </div>

            {/* 1. TOP HEADER NAVIGATION BAR */}
            <div className="sticky top-0 z-40 bg-background/85 backdrop-blur-xl border-b border-border/60">
                <div className="w-full max-w-[1440px] mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.back()}
                            className="rounded-full w-9 h-9 sm:w-10 sm:h-10 hover:bg-muted text-foreground border border-border/60 shrink-0"
                            title="Go back"
                        >
                            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                        </Button>
                        <div className="min-w-0">
                            <h2 className="font-black text-sm sm:text-base text-foreground truncate flex items-center gap-1.5">
                                <span className="truncate">{restaurant.name}</span>
                                <ShieldCheck className="w-4 h-4 text-primary shrink-0 inline-block" />
                            </h2>
                            <p className="text-[11px] text-muted-foreground truncate hidden sm:block">
                                {restaurant.cuisineType?.join(', ') || 'Delicious Indian & Continental'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {/* Favorite Button */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleToggleFavorite}
                            className={`h-9 px-3 rounded-full text-xs font-bold gap-1.5 transition-all ${
                                isFavorite
                                    ? 'bg-rose-500/10 text-rose-500 border-rose-500/30 hover:bg-rose-500/20'
                                    : 'border-border/80 hover:bg-muted text-foreground'
                            }`}
                        >
                            <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current text-rose-500' : ''}`} />
                            <span className="hidden md:inline">{isFavorite ? 'Saved' : 'Favorite'}</span>
                        </Button>

                        {/* Share Button */}
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={async () => {
                                if (typeof navigator !== 'undefined' && navigator.share) {
                                    try {
                                        await navigator.share({ title: restaurant.name, url: window.location.href });
                                        return;
                                    } catch {
                                        // Share was cancelled or failed, fallback to clipboard
                                    }
                                }
                                const success = await copyToClipboard(window.location.href);
                                if (success) {
                                    toast.success('Restaurant link copied to clipboard!');
                                } else {
                                    toast.info('Link: ' + window.location.href);
                                }
                            }}
                            className="rounded-full w-9 h-9 border-border/80 hover:bg-muted text-foreground"
                            title="Share Restaurant"
                        >
                            <Share2 className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* 2. LUXURY RESTAURANT HERO CARD & DETAILS SECTION */}
            <div className="w-full max-w-[1440px] mx-auto px-3 sm:px-6 pt-4 sm:pt-6">
                {/* Active Order In-Progress Alert Banner */}
                {activeOrder && (
                    <div className="mb-4 p-4 rounded-3xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-primary/15 border-2 border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg shadow-emerald-500/5 animate-pulse-subtle">
                        <div className="flex items-center gap-3.5 w-full sm:w-auto">
                            <div className="w-11 h-11 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md">
                                <Bike className="w-6 h-6 animate-bounce" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                                        Order in Progress
                                    </span>
                                    <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] uppercase font-black px-2 py-0.5">
                                        {activeOrder.status === 'out_for_delivery' ? 'Rider on the way' : activeOrder.status?.replace('_', ' ')}
                                    </Badge>
                                </div>
                                <p className="text-xs font-bold text-foreground mt-0.5">
                                    Order #{activeOrder.id ? (activeOrder.id.length <= 14 ? activeOrder.id : activeOrder.id.slice(-8)).toUpperCase() : 'ORDER'} • {activeOrder.items?.length || 0} item{(activeOrder.items?.length || 0) > 1 ? 's' : ''}
                                </p>
                            </div>
                        </div>
                        <Link href={`/customer/orders/tracking/${activeOrder.id}`} className="w-full sm:w-auto shrink-0">
                            <Button size="sm" className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md gap-1.5 text-xs px-5 py-2.5">
                                <Navigation className="w-3.5 h-3.5" /> Track Live Map ➔
                            </Button>
                        </Link>
                    </div>
                )}

                <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-card via-card/95 to-primary/5 border border-border/80 shadow-lg p-5 sm:p-7 md:p-8">
                    
                    {/* Top Accent Line */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-amber-500 to-red-500" />

                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        
                        {/* Restaurant Brand Info */}
                        <div className="flex items-start sm:items-center gap-4 sm:gap-6 flex-1 min-w-0">
                            <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-2xl sm:rounded-3xl overflow-hidden border-2 border-primary/20 shadow-md bg-muted shrink-0 relative">
                                <SafeImage
                                    src={restaurant.image}
                                    alt={restaurant.name}
                                    fallbackType="restaurant"
                                    className="object-cover"
                                    fill
                                    priority
                                />
                                <div className="absolute bottom-1 right-1 bg-background/90 backdrop-blur-md p-1 rounded-md shadow-xs">
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                                </div>
                            </div>

                            <div className="flex-1 min-w-0 space-y-1.5">
                                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight truncate">
                                        {restaurant.name}
                                    </h1>
                                    <div className="inline-flex items-center gap-1 bg-emerald-600 text-white px-2.5 py-0.5 rounded-lg text-xs font-black shadow-xs shrink-0">
                                        <span>{Number(rating).toFixed(1)}</span>
                                        <Star className="w-3 h-3 fill-current" />
                                    </div>
                                </div>

                                <p className="text-xs sm:text-sm text-muted-foreground font-medium line-clamp-2 leading-relaxed max-w-2xl">
                                    {restaurant.description || 'Delicious culinary creations crafted with love, premium ingredients and exceptional hygiene.'}
                                </p>

                                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                    {restaurant.cuisineType && restaurant.cuisineType.length > 0 ? (
                                        restaurant.cuisineType.map((c, i) => (
                                            <span key={i} className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                                                {c}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                                            Multi-Cuisine
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Delivery Badges & Metadata */}
                        <div className="flex flex-wrap md:flex-col gap-2 sm:gap-2.5 w-full md:w-auto shrink-0 md:min-w-[210px]">
                            {/* Delivery ETA */}
                            <div className="flex items-center gap-2 bg-muted/60 px-3 py-2 rounded-xl border border-border/70 text-foreground text-xs sm:text-sm font-semibold flex-1 md:flex-none">
                                <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                    <Clock className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                    <span className="text-[10px] text-muted-foreground uppercase font-bold block leading-none">Delivery ETA</span>
                                    <span className="font-bold">{restaurant.deliveryTime || '25-35'} mins</span>
                                </div>
                            </div>

                            {/* Distance */}
                            <div className="flex items-center gap-2 bg-muted/60 px-3 py-2 rounded-xl border border-border/70 text-foreground text-xs sm:text-sm font-semibold flex-1 md:flex-none">
                                <div className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                                    <MapPin className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                    <span className="text-[10px] text-muted-foreground uppercase font-bold block leading-none">Distance</span>
                                    <span className="font-bold">Nearby Outlet</span>
                                </div>
                            </div>

                            {/* Order Limit / Min Order */}
                            <div className="flex items-center gap-2 bg-muted/60 px-3 py-2 rounded-xl border border-border/70 text-foreground text-xs sm:text-sm font-semibold flex-1 md:flex-none">
                                <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                                    <ShoppingBag className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                    <span className="text-[10px] text-muted-foreground uppercase font-bold block leading-none">Order Limit</span>
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                        No Min. Order
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Offers & Safe Delivery Strip (Only shows coupon if admin or restaurant has provided one) */}
                    <div className="mt-5 pt-4 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/30 -mx-5 -mb-5 sm:-mx-7 sm:-mb-7 md:-mx-8 md:-mb-8 p-4 sm:px-8">
                        {activePromotions.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                                <Tag className="w-4 h-4 text-primary shrink-0" />
                                <span className="font-bold text-foreground">
                                    {activePromotions[0].type === 'percentage'
                                        ? `${activePromotions[0].value}% OFF${activePromotions[0].maxDiscount ? ` up to ₹${activePromotions[0].maxDiscount}` : ''}`
                                        : activePromotions[0].type === 'fixed'
                                        ? `Flat ₹${activePromotions[0].value} OFF`
                                        : 'Free Delivery'
                                    }
                                </span>
                                <span className="text-muted-foreground text-xs">
                                    {activePromotions[0].minOrderAmount ? `on orders above ₹${activePromotions[0].minOrderAmount}` : ''}
                                </span>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        await copyToClipboard(activePromotions[0].code);
                                        try {
                                            localStorage.setItem('suggestedPromo', activePromotions[0].code);
                                        } catch {
                                            // Safe storage
                                        }
                                        toast.success(`Coupon code "${activePromotions[0].code}" copied! Apply it in your cart.`);
                                    }}
                                    className="inline-flex items-center gap-1 font-mono font-bold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/25 px-2 py-0.5 rounded-md cursor-pointer transition-colors text-xs"
                                    title="Click to copy promo code"
                                >
                                    <span>{activePromotions[0].code}</span>
                                    <span className="text-[10px] uppercase font-sans font-bold bg-primary text-primary-foreground px-1 rounded">COPY</span>
                                </button>
                                {activePromotions.length > 1 && (
                                    <span className="text-[11px] text-muted-foreground font-semibold">
                                        (+{activePromotions.length - 1} more offers in cart)
                                    </span>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Store className="w-3.5 h-3.5 text-primary" />
                                <span>Fresh food prepared on demand &bull; Authentic recipes</span>
                            </div>
                        )}
                        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>100% Contactless & Safe Delivery</span>
                        </div>
                    </div>
                </div>

                {/* Not Serviceable Warning */}
                {!isServiceable && (
                    <div className="mt-4 bg-destructive/10 border border-destructive/30 rounded-2xl p-4 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                        <div>
                            <h4 className="font-bold text-destructive text-sm">Location Not Serviceable</h4>
                            <p className="text-xs text-destructive/90 mt-0.5">
                                This kitchen currently does not deliver to your active pincode ({deliveryAddress?.pincode || 'Not specified'}). You can still explore the menu or change delivery location in header.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* 3. PROFESSIONAL STICKY "BROWSE MENU" & FILTERS BAR (ZERO BLINK / ZERO LAG) */}
            <div className="sticky top-14 sm:top-16 z-30 bg-background/95 backdrop-blur-xl border-y border-border/80 shadow-xs mt-6">
                <div className="w-full max-w-[1440px] mx-auto px-3 sm:px-6 py-2.5 sm:py-3 space-y-2.5">
                    
                    {/* Top Row: Category Pills Scroll Bar */}
                    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-0.5 snap-x">
                        {categories.map((cat) => {
                            const count = filteredItems.filter(i => i.category === cat).length;
                            const isActive = activeCategory === cat;
                            return (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => scrollToCategory(cat)}
                                    className={`snap-start inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-200 cursor-pointer select-none shrink-0 ${
                                        isActive
                                            ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25 scale-[1.02]'
                                            : 'bg-card border border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted'
                                    }`}
                                >
                                    <span>{getCategoryEmoji(cat)}</span>
                                    <span>{cat}</span>
                                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                                        isActive ? 'bg-black/20 text-white' : 'bg-muted text-muted-foreground'
                                    }`}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Bottom Row: In-Menu Search & Dietary Toggles */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1 border-t border-border/50">
                        
                        {/* Segmented Dietary Filter Pills */}
                        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/60 self-start sm:self-auto">
                            <button
                                type="button"
                                onClick={() => setActiveFilter('all')}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                    activeFilter === 'all'
                                        ? 'bg-card text-foreground shadow-xs'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                All Items
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveFilter('veg')}
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                    activeFilter === 'veg'
                                        ? 'bg-emerald-600 text-white shadow-xs'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                Pure Veg
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveFilter('non-veg')}
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                    activeFilter === 'non-veg'
                                        ? 'bg-rose-600 text-white shadow-xs'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <div className="w-2 h-2 rounded-full bg-rose-400" />
                                Non-Veg
                            </button>
                        </div>

                        {/* In-Menu Instant Search Input */}
                        <div className="relative flex-1 sm:max-w-xs">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                            <Input
                                placeholder="Search in this menu..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 pr-8 h-9 text-xs rounded-xl bg-card border-border/80 focus:border-primary/50 text-foreground placeholder:text-muted-foreground font-medium"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>

                </div>
            </div>

            {/* 4. MENU ITEMS SECTION */}
            <div className="w-full max-w-[1440px] mx-auto px-3 sm:px-6 pt-6 sm:pt-8 space-y-12">
                
                {filteredItems.length === 0 ? (
                    <div className="text-center py-16 bg-card rounded-3xl border border-dashed border-border p-6 space-y-3">
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                            <Search className="w-7 h-7" />
                        </div>
                        <h3 className="font-bold text-base sm:text-lg text-foreground">No dishes found matching your filter</h3>
                        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                            Try clearing your search query or switching dietary filter to see delicious options.
                        </p>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setSearchQuery(''); setActiveFilter('all'); }}
                            className="rounded-xl font-bold text-xs mt-2 text-primary border-primary/30"
                        >
                            Reset Filters
                        </Button>
                    </div>
                ) : (
                    categories.map((category) => {
                        const items = filteredItems.filter(item => item.category === category);
                        if (items.length === 0) return null;

                        return (
                            <div
                                key={category}
                                ref={(el) => { categoryRefs.current[category] = el; }}
                                className="scroll-mt-36 space-y-4"
                            >
                                {/* Category Section Header */}
                                <div className="flex items-center justify-between gap-3 pb-2 border-b border-border/60">
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl">{getCategoryEmoji(category)}</span>
                                        <h2 className="text-lg sm:text-xl font-black text-foreground tracking-tight">
                                            {category}
                                        </h2>
                                        <Badge variant="secondary" className="text-xs font-bold px-2 py-0.5 rounded-full ml-1">
                                            {items.length}
                                        </Badge>
                                    </div>
                                    <span className="text-xs text-muted-foreground font-semibold">
                                        Freshly Cooked
                                    </span>
                                </div>

                                {/* Items Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                                    {items.map((item) => {
                                        const qty = getQuantityInCart(item.id);

                                        return (
                                            <div
                                                key={item.id}
                                                onClick={() => router.push(`/customer/product/${item.id}`)}
                                                className={`group bg-card rounded-2xl sm:rounded-3xl border border-border/70 hover:border-primary/50 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 p-3.5 sm:p-4.5 flex gap-3.5 sm:gap-4 cursor-pointer relative overflow-hidden ${
                                                    !isServiceable ? 'opacity-60' : ''
                                                }`}
                                            >
                                                {/* Left Info Column */}
                                                <div className="flex-1 flex flex-col justify-between min-w-0 py-0.5">
                                                    <div>
                                                        {/* Veg / Non-Veg badge + Bestseller */}
                                                        <div className="flex items-center gap-2 mb-1.5">
                                                            <div className={`w-4 h-4 rounded-xs border-2 flex items-center justify-center shrink-0 bg-white/95 shadow-xs ${
                                                                item.vegetarian ? 'border-emerald-600' : 'border-rose-600'
                                                            }`}>
                                                                <div className={`w-2 h-2 rounded-full ${
                                                                    item.vegetarian ? 'bg-emerald-600' : 'bg-rose-600'
                                                                }`} />
                                                            </div>

                                                            {item.isBestSeller && (
                                                                <span className="text-[10px] font-extrabold bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-md border border-amber-500/25 flex items-center gap-1 uppercase tracking-wider">
                                                                    <Star className="w-2.5 h-2.5 fill-current" /> Bestseller
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Item Title */}
                                                        <h3 className="font-bold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors line-clamp-1 mb-1">
                                                            {item.name}
                                                        </h3>

                                                        {/* Price */}
                                                        <div className="text-base sm:text-lg font-black text-foreground tracking-tight mb-1.5">
                                                            ₹{item.price}
                                                        </div>

                                                        {/* Description */}
                                                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                                            {item.description || 'Prepared fresh with chef-curated herbs and genuine spices.'}
                                                        </p>
                                                    </div>

                                                    {/* Rating & Prep Metadata */}
                                                    <div className="flex items-center gap-3 pt-3 mt-2 border-t border-border/40 text-[11px] text-muted-foreground font-semibold">
                                                        <div className="flex items-center gap-1">
                                                            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                                                            <span className="text-foreground font-bold">
                                                                {item.averageRating ? item.averageRating.toFixed(1) : '4.2'}
                                                            </span>
                                                            {item.totalReviews ? (
                                                                <span className="text-[10px] text-muted-foreground">({item.totalReviews})</span>
                                                            ) : null}
                                                        </div>

                                                        <div className="flex items-center gap-1">
                                                            <Clock className="w-3 h-3 text-primary" />
                                                            <span>{item.preparationTime || 20}m</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Right Image & ADD Button Column */}
                                                <div className="w-28 sm:w-32 flex-shrink-0 flex flex-col items-center justify-between">
                                                    <div className="w-full h-24 sm:h-28 rounded-2xl overflow-hidden relative bg-muted shadow-xs border border-border/40">
                                                        <SafeImage
                                                            src={item.image}
                                                            alt={item.name}
                                                            fill
                                                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                                                            fallbackType="food"
                                                        />
                                                    </div>

                                                    {/* ADD / Quantity Counter Button */}
                                                    <div
                                                        className="w-full mt-2"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        {qty > 0 ? (
                                                            <div className="w-full h-8 bg-primary rounded-xl flex items-center justify-between px-1.5 shadow-md shadow-primary/20 text-primary-foreground font-black">
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        const cartItem = cartItems.find(ci => ci.menuItemId === item.id);
                                                                        if (qty === 1 && cartItem) removeItem(cartItem.menuItemId);
                                                                        else if (cartItem) updateQuantity(cartItem.menuItemId, qty - 1);
                                                                    }}
                                                                    className="w-6 h-6 rounded-lg hover:bg-black/20 flex items-center justify-center transition-colors active:scale-95"
                                                                    aria-label="Decrease"
                                                                >
                                                                    <Minus className="w-3.5 h-3.5" />
                                                                </button>
                                                                <span className="text-xs font-black tabular-nums">{qty}</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => handleAddToCart(item, e)}
                                                                    className="w-6 h-6 rounded-lg hover:bg-black/20 flex items-center justify-center transition-colors active:scale-95"
                                                                    disabled={!isServiceable}
                                                                    aria-label="Increase"
                                                                >
                                                                    <Plus className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => handleAddToCart(item, e)}
                                                                disabled={!isServiceable}
                                                                className="w-full h-8 rounded-xl bg-card border-2 border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground font-black text-xs shadow-xs transition-all flex items-center justify-center gap-1 active:scale-95"
                                                            >
                                                                <Plus className="w-3.5 h-3.5" /> ADD
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* 5. FLOATING CART ACTION BAR */}
            {cartItems.length > 0 && (
                <div className="fixed bottom-20 md:bottom-6 left-3 right-3 sm:left-6 sm:right-6 z-40 max-w-3xl mx-auto animate-in slide-in-from-bottom-5 fade-in duration-300">
                    <div
                        onClick={() => router.push('/customer/cart')}
                        className="bg-primary text-primary-foreground rounded-2xl p-4 shadow-2xl flex justify-between items-center cursor-pointer hover:bg-primary/95 transition-all group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-black text-base">
                                <ShoppingBag className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider opacity-90 leading-tight">
                                    {cartItems.reduce((acc, i) => acc + i.quantity, 0)} Items Added
                                </p>
                                <p className="text-base sm:text-lg font-black tracking-tight">₹{total}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 font-black text-xs sm:text-sm uppercase tracking-wider bg-white/20 px-4 py-2 rounded-xl group-hover:bg-white/30 transition-colors">
                            <span>View Cart</span>
                            <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                        </div>
                    </div>
                </div>
            )}

            {/* 6. DISH DETAIL MODAL */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="bg-card border-border text-card-foreground p-0 max-w-lg overflow-hidden rounded-3xl shadow-2xl">
                    {selectedItem && (
                        <div className="flex flex-col">
                            <div className="relative h-60 bg-muted flex-shrink-0">
                                <SafeImage
                                    src={selectedItem.image}
                                    alt={selectedItem.name}
                                    fill
                                    className="object-cover"
                                    fallbackType="food"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                
                                <DialogClose className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/70 transition-colors">
                                    <X className="w-4 h-4" />
                                </DialogClose>

                                <div className={`absolute top-3 left-3 w-5 h-5 rounded-xs border-2 bg-white/95 flex items-center justify-center shadow-md ${
                                    selectedItem.vegetarian ? 'border-emerald-600' : 'border-rose-600'
                                }`}>
                                    <div className={`w-2.5 h-2.5 rounded-full ${
                                        selectedItem.vegetarian ? 'bg-emerald-600' : 'bg-rose-600'
                                    }`} />
                                </div>

                                <div className="absolute bottom-3 left-4 text-white">
                                    <div className="text-2xl font-black drop-shadow-md">₹{selectedItem.price}</div>
                                </div>

                                <div className="absolute bottom-3 right-4 flex items-center gap-1 bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-xl">
                                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                    <span className="text-white text-xs font-bold">
                                        {selectedItem.averageRating ? selectedItem.averageRating.toFixed(1) : '4.2'}
                                    </span>
                                </div>
                            </div>

                            <div className="p-5 sm:p-6">
                                <h2 className="text-xl font-black text-foreground mb-1.5">{selectedItem.name}</h2>
                                <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed mb-5">
                                    {selectedItem.description || 'Made with handpicked ingredients, traditional recipes, and authentic flavours.'}
                                </p>

                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    <div className="bg-muted/60 rounded-xl p-3 border border-border/60 flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-base">⏱️</div>
                                        <div>
                                            <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Prep Time</div>
                                            <div className="text-xs sm:text-sm font-black text-foreground">{selectedItem.preparationTime || 20} min</div>
                                        </div>
                                    </div>
                                    <div className="bg-muted/60 rounded-xl p-3 border border-border/60 flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-base">🔥</div>
                                        <div>
                                            <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Energy</div>
                                            <div className="text-xs sm:text-sm font-black text-foreground">{selectedItem.calories || 350} kcal</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-2">
                                    {getQuantityInCart(selectedItem.id) > 0 ? (
                                        <div className="flex items-center bg-primary rounded-xl h-11 px-3 gap-3 w-full justify-between">
                                            <button
                                                className="w-9 h-full flex items-center justify-center text-primary-foreground hover:opacity-80 transition-opacity"
                                                onClick={() => {
                                                    const currentQty = getQuantityInCart(selectedItem.id);
                                                    const cartItem = cartItems.find(ci => ci.menuItemId === selectedItem.id);
                                                    if (currentQty === 1 && cartItem) removeItem(cartItem.menuItemId);
                                                    else if (cartItem) updateQuantity(cartItem.menuItemId, currentQty - 1);
                                                }}
                                            >
                                                <Minus className="w-4 h-4" />
                                            </button>
                                            <span className="font-black text-base text-primary-foreground tabular-nums">
                                                {getQuantityInCart(selectedItem.id)} In Cart
                                            </span>
                                            <button
                                                className="w-9 h-full flex items-center justify-center text-primary-foreground hover:opacity-80 transition-opacity"
                                                onClick={() => handleAddToCart(selectedItem)}
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <Button
                                            onClick={() => handleAddToCart(selectedItem)}
                                            className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-black shadow-md text-sm gap-2"
                                            disabled={!isServiceable}
                                        >
                                            <Plus className="w-4 h-4" /> Add to Order (₹{selectedItem.price})
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

        </div>
    );
}
