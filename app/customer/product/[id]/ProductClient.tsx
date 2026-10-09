'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, arrayUnion, arrayRemove, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MenuItem, Restaurant } from '@/lib/types';
import { checkRestaurantOperatingStatus } from '@/lib/restaurant-schedule';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Star, Flame, Leaf, Clock, ArrowLeft, Plus, Minus, Zap,
    ShoppingCart, Heart, Share2, MapPin, Store, ShieldCheck,
    CheckCircle2, Tag, Truck, Sparkles, AlertCircle, Utensils, MessageSquareText,
    Percent, ChevronRight, ChevronLeft, ZoomIn, X, ExternalLink, Info
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
    type?: string;
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

// ─────────────── Image Carousel ───────────────────────────────────────────────
function ImageCarousel({ images, productName }: { images: string[]; productName: string }) {
    const [current, setCurrent] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isZoomed, setIsZoomed] = useState(false);
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const autoSlideRef = useRef<NodeJS.Timeout | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const goTo = useCallback((idx: number) => {
        setCurrent((idx + images.length) % images.length);
        setIsLoading(true);
    }, [images.length]);

    const next = useCallback(() => goTo(current + 1), [current, goTo]);
    const prev = useCallback(() => goTo(current - 1), [current, goTo]);

    useEffect(() => {
        if (images.length <= 1) return;
        autoSlideRef.current = setInterval(next, 4000);
        return () => { if (autoSlideRef.current) clearInterval(autoSlideRef.current); };
    }, [next, images.length]);

    const resetSlide = () => {
        if (autoSlideRef.current) clearInterval(autoSlideRef.current);
        if (images.length > 1) autoSlideRef.current = setInterval(next, 4000);
    };

    const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.touches[0].clientX);
    const handleTouchEnd = (e: React.TouchEvent) => {
        if (touchStart === null) return;
        const diff = touchStart - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) { diff > 0 ? (next(), resetSlide()) : (prev(), resetSlide()); }
        setTouchStart(null);
    };

    return (
        <>
            <div
                className="relative w-full aspect-square rounded-3xl overflow-hidden border border-border/70 shadow-2xl group bg-muted select-none"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                {isLoading && <div className="absolute inset-0 z-10 bg-gradient-to-r from-muted via-muted/60 to-muted animate-pulse" />}

                <div
                    className={`w-full h-full transition-transform duration-500 ease-out cursor-zoom-in ${isZoomed ? 'scale-150' : 'scale-100'}`}
                    onDoubleClick={() => setIsZoomed(z => !z)}
                >
                    <SafeImage
                        src={images[current]}
                        alt={`${productName} - image ${current + 1}`}
                        className="object-cover transition-opacity duration-300"
                        fill
                        priority
                        onLoad={() => setIsLoading(false)}
                    />
                </div>

                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10 pointer-events-none" />

                {images.length > 1 && (
                    <>
                        <button onClick={() => { prev(); resetSlide(); }}
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 backdrop-blur-md text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-black/70 z-20"
                            aria-label="Previous image"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button onClick={() => { next(); resetSlide(); }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 backdrop-blur-md text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-black/70 z-20"
                            aria-label="Next image"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20">
                            {images.map((_, i) => (
                                <button key={i} onClick={() => { goTo(i); resetSlide(); }}
                                    className={`rounded-full transition-all ${i === current ? 'w-6 h-2 bg-white' : 'w-2 h-2 bg-white/50'}`}
                                    aria-label={`Image ${i + 1}`}
                                />
                            ))}
                        </div>
                        <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-md text-white text-xs font-bold px-2 py-1 rounded-lg z-20">
                            {current + 1}/{images.length}
                        </div>
                    </>
                )}

                <button onClick={() => setIsFullscreen(true)}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-black/60 z-20"
                    aria-label="View fullscreen"
                >
                    <ZoomIn className="w-3.5 h-3.5" />
                </button>

                <div className="absolute bottom-3 left-3 right-3 p-2.5 rounded-2xl bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-between text-white text-xs z-10">
                    <span className="flex items-center gap-1.5 font-semibold">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" /> Tamper-Proof Sealed Pack
                    </span>
                    <span className="flex items-center gap-1 text-amber-300 font-bold">
                        <Truck className="w-3.5 h-3.5" /> 30-min Delivery
                    </span>
                </div>
            </div>

            {/* Thumbnail strip */}
            {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {images.map((img, idx) => (
                        <button key={idx} onClick={() => { goTo(idx); resetSlide(); }}
                            className={`flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 transition-all relative cursor-pointer ${idx === current ? 'border-primary ring-2 ring-primary/25 scale-105 shadow-md' : 'border-border/60 opacity-60 hover:opacity-100'}`}
                        >
                            <SafeImage src={img} alt={`thumb ${idx + 1}`} className="object-cover" fill />
                            {idx === 0 && <span className="absolute bottom-0.5 left-0.5 bg-primary/90 text-[8px] text-white font-bold px-1 rounded">Main</span>}
                        </button>
                    ))}
                </div>
            )}

            {/* Fullscreen Lightbox */}
            {isFullscreen && (
                <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center"
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                >
                    <button onClick={() => setIsFullscreen(false)}
                        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all z-10"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    <div className="text-white text-xs font-bold absolute top-5 left-5 bg-white/10 px-3 py-1 rounded-full">
                        {current + 1} / {images.length}
                    </div>
                    <div
                        className={`relative w-full max-w-2xl aspect-square mx-4 transition-transform duration-300 ${isZoomed ? 'scale-150 cursor-zoom-out' : 'cursor-zoom-in'}`}
                        onDoubleClick={() => setIsZoomed(z => !z)}
                    >
                        <SafeImage src={images[current]} alt={productName} className="object-contain" fill />
                    </div>
                    {images.length > 1 && (
                        <>
                            <button onClick={() => { prev(); }} className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all"><ChevronLeft className="w-5 h-5" /></button>
                            <button onClick={() => { next(); }} className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all"><ChevronRight className="w-5 h-5" /></button>
                            <div className="absolute bottom-6 flex gap-2">
                                {images.map((_, i) => <button key={i} onClick={() => goTo(i)} className={`rounded-full transition-all ${i === current ? 'w-6 h-2 bg-white' : 'w-2 h-2 bg-white/40'}`} />)}
                            </div>
                            <div className="absolute bottom-14 flex gap-2 overflow-x-auto max-w-sm px-4">
                                {images.map((img, idx) => (
                                    <button key={idx} onClick={() => goTo(idx)}
                                        className={`flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 relative transition-all ${idx === current ? 'border-white' : 'border-white/20 opacity-50'}`}
                                    >
                                        <SafeImage src={img} alt="" className="object-cover" fill />
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}
        </>
    );
}

// ─────────────── Reviews Section ──────────────────────────────────────────────
interface ReviewsSectionProps {
    productName: string;
    reviews: any[];
    loading: boolean;
    realAverageRating: number;
}

function ReviewsSection({ productName, reviews, loading, realAverageRating }: ReviewsSectionProps) {
    if (loading) {
        return <div className="p-12 text-center text-xs font-semibold text-muted-foreground">Loading reviews for {productName}...</div>;
    }
    if (reviews.length === 0) {
        return (
            <section className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 mt-16">
                <div className="bg-card/70 border border-border/70 rounded-3xl p-8 text-center max-w-xl mx-auto space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
                        <Star className="w-6 h-6 fill-amber-500/20" />
                    </div>
                    <h4 className="text-xl font-black text-foreground">No Reviews Yet</h4>
                    <p className="text-xs sm:text-sm text-muted-foreground">Be the first to order <span className="font-bold text-foreground">"{productName}"</span> and share your experience!</p>
                </div>
            </section>
        );
    }

    const starCounts = [5, 4, 3, 2, 1].map(s => ({
        star: s,
        count: reviews.filter(r => Math.round(r.rating || 0) === s).length
    }));

    const formatDate = (ts: any) => {
        if (!ts?.seconds) return 'Recent';
        const date = new Date(ts.seconds * 1000);
        const diff = Math.floor((Date.now() - date.getTime()) / 1000);
        if (diff < 86400) return 'Today';
        if (diff < 172800) return 'Yesterday';
        if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
        return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    return (
        <section className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 mt-16 sm:mt-24 mb-16">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h3 className="text-2xl sm:text-3xl font-black flex items-center gap-3 text-foreground">Ratings & Reviews</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Verified customer feedback for {productName}</p>
                </div>
                <span className="text-xs sm:text-sm text-muted-foreground font-semibold bg-muted/60 px-3 py-1 rounded-full border border-border/50">
                    {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
                </span>
            </div>

            <div className="bg-card border border-border/60 rounded-2xl sm:rounded-3xl p-5 sm:p-6 mb-8 flex flex-col sm:flex-row gap-6 sm:gap-10 items-center">
                <div className="text-center flex-shrink-0">
                    <div className="text-6xl sm:text-7xl font-black text-foreground tracking-tight">{realAverageRating.toFixed(1)}</div>
                    <div className="flex justify-center gap-1 mt-2">
                        {[1, 2, 3, 4, 5].map(s => (
                            <Star key={s} className={`w-5 h-5 ${realAverageRating >= s ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground/30'}`} />
                        ))}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 font-medium">{reviews.length} ratings</div>
                </div>
                <div className="flex-1 w-full space-y-2">
                    {starCounts.map(({ star, count }) => (
                        <div key={star} className="flex items-center gap-3">
                            <span className="text-xs font-bold text-muted-foreground w-4 text-right">{star}</span>
                            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 flex-shrink-0" />
                            <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                                <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: reviews.length > 0 ? `${(count / reviews.length) * 100}%` : '0%' }} />
                            </div>
                            <span className="text-xs text-muted-foreground font-medium w-6">{count}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                {reviews.map((review: any) => (
                    <div key={review.id} className="bg-card border border-border/60 p-5 sm:p-6 rounded-2xl sm:rounded-3xl flex flex-col gap-4 hover:border-primary/40 hover:shadow-md transition-all">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3 sm:gap-4">
                                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-primary to-amber-500 p-[2px] shadow-xs flex-shrink-0">
                                    <div className="w-full h-full rounded-full bg-card overflow-hidden relative">
                                        {review.customerAvatar ? (
                                            <SafeImage src={review.customerAvatar} alt={review.customerName || 'Reviewer'} className="object-cover" fallbackType="generic" fill />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center font-black text-base sm:text-lg text-primary bg-primary/10">
                                                {(review.customerName || review.authorName || 'U')?.[0]?.toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm sm:text-base text-foreground flex items-center gap-1.5">
                                        {review.customerName || review.authorName || 'Verified Diner'}
                                        {review.isVerified && (
                                            <span className="inline-flex items-center gap-0.5 text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full border border-emerald-500/30 font-semibold">
                                                <ShieldCheck className="w-2.5 h-2.5" /> Verified
                                            </span>
                                        )}
                                    </h4>
                                    <div className="flex items-center gap-1 mt-0.5">
                                        {[1, 2, 3, 4, 5].map(s => <Star key={s} className={`w-3.5 h-3.5 ${review.rating >= s ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground/30'}`} />)}
                                        <span className="text-xs font-bold text-foreground ml-0.5">{review.rating?.toFixed(1)}</span>
                                    </div>
                                </div>
                            </div>
                            <span className="text-[11px] text-muted-foreground font-medium bg-muted px-2 py-1 rounded-lg">{formatDate(review.createdAt)}</span>
                        </div>
                        {review.comment && (
                            <div className="relative">
                                <span className="absolute -top-2 -left-1 text-3xl text-muted-foreground/20 font-serif leading-none">"</span>
                                <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed pl-3.5 relative z-10 italic">{review.comment}</p>
                            </div>
                        )}
                        {review.images && review.images.length > 0 && (
                            <div className="flex gap-2 overflow-x-auto">
                                {review.images.map((img: string, i: number) => (
                                    <div key={i} className="w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden border border-border/60 relative">
                                        <SafeImage src={img} alt={`Review photo ${i + 1}`} fill className="object-cover" />
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="mt-auto pt-3.5 border-t border-border/60 flex items-center gap-4 text-xs text-muted-foreground">
                            <button onClick={() => toast.success("Thanks for your feedback!")} className="flex items-center gap-1.5 hover:text-rose-500 transition-colors cursor-pointer">
                                <Heart className="w-3.5 h-3.5" /> Helpful
                            </button>
                            <button onClick={async () => { const ok = await copyToClipboard(window.location.href); if (ok) toast.success("Link copied!"); }} className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer">
                                <Share2 className="w-3.5 h-3.5" /> Share
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

// ─────────────── Main Product Client ──────────────────────────────────────────
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
    const [isFavorite, setIsFavorite] = useState(false);
    const [reviews, setReviews] = useState<any[]>([]);
    const [loadingReviews, setLoadingReviews] = useState(true);
    const [restaurantOffers, setRestaurantOffers] = useState<RestaurantOffer[]>([]);
    const [loadingOffers, setLoadingOffers] = useState(true);
    const [selectedSize, setSelectedSize] = useState(DEFAULT_SIZES[0]);
    const [selectedAddOns, setSelectedAddOns] = useState<Record<string, { name: string; price: number }>>({});
    const [selectedSpice, setSelectedSpice] = useState<string>('Medium');
    const [cookingNote, setCookingNote] = useState<string>('');
    const [activeTab, setActiveTab] = useState<'customize' | 'nutrition' | 'info'>('customize');
    const [shareOpen, setShareOpen] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

    const totalCartCount = items.reduce((sum, item) => sum + item.quantity, 0);

    // Keep clock tick every 30s so time-based schedule changes evaluate live
    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(new Date()), 30000);
        return () => clearInterval(interval);
    }, []);

    // Real-time restaurant listener
    useEffect(() => {
        const rid = product?.restaurantId || initialRestaurant?.id;
        if (!rid) return;
        const unsub = onSnapshot(doc(db, 'restaurants', rid), (snap) => {
            if (snap.exists()) {
                setRestaurant({ id: snap.id, ...snap.data() } as Restaurant);
            }
        });
        return () => unsub();
    }, [product?.restaurantId, initialRestaurant?.id]);

    const operatingStatus = checkRestaurantOperatingStatus(restaurant, currentTime);

    useEffect(() => {
        if (!initialProduct && productId) loadProductData();
    }, [productId, initialProduct]);

    useEffect(() => {
        const fetchReviews = async () => {
            if (!productId) return;
            try {
                setLoadingReviews(true);
                const q = query(collection(db, 'reviews'), where('menuItemId', '==', productId), limit(50));
                const snapshot = await getDocs(q);
                setReviews(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (e) {
                setReviews([]);
            } finally {
                setLoadingReviews(false);
            }
        };
        fetchReviews();
    }, [productId]);

    useEffect(() => {
        if (customer?.favorites && productId) setIsFavorite(customer.favorites.includes(productId));
    }, [customer, productId]);

    useEffect(() => {
        const fetchOffers = async () => {
            const rid = product?.restaurantId || restaurant?.id;
            if (!rid) { setLoadingOffers(false); return; }
            try {
                setLoadingOffers(true);
                const offers: RestaurantOffer[] = [];
                try {
                    const res = await fetch(`/api/promotions?restaurantId=${encodeURIComponent(rid)}`);
                    if (res.ok) {
                        const data = await res.json();
                        if (Array.isArray(data?.promotions)) {
                            data.promotions.forEach((p: any) => offers.push({ id: p.id, code: p.code, type: p.type, value: p.value, description: p.description || 'Discount', minOrderAmount: p.minOrderAmount, restaurantName: restaurant?.name }));
                        }
                    }
                } catch {}
                const inline = (restaurant as any)?.offers || (restaurant as any)?.promotions;
                if (Array.isArray(inline)) {
                    inline.forEach((io: any, idx: number) => {
                        if (io?.code && !offers.some(o => o.code === io.code)) {
                            offers.push({ id: io.id || `i${idx}`, code: io.code, type: io.type || 'percentage', value: io.value || 0, description: io.description || `Offer from ${restaurant?.name}`, minOrderAmount: io.minOrderAmount });
                        }
                    });
                }
                setRestaurantOffers(offers);
            } catch {
                setRestaurantOffers([]);
            } finally {
                setLoadingOffers(false);
            }
        };
        fetchOffers();
    }, [product?.restaurantId, restaurant?.id, restaurant?.name]);

    const configuredSizes = product?.sizes && product.sizes.length > 0
        ? product.sizes.map((s, idx) => ({ id: (s as any).id || `size_${idx}`, name: s.name, price: Number(s.price) || 0, desc: (s as any).desc || '' }))
        : DEFAULT_SIZES;

    const configuredAddOns = product?.addOns && product.addOns.length > 0
        ? product.addOns.map((a, idx) => ({ id: (a as any).id || `addon_${idx}`, name: a.name, price: Number(a.price) || 0 }))
        : DEFAULT_ADDONS;

    useEffect(() => {
        if (configuredSizes.length > 0) setSelectedSize(configuredSizes[0]);
    }, [product?.id]);

    const loadProductData = async () => {
        try {
            setLoading(true);
            const productDoc = await getDoc(doc(db, 'menuItems', productId));
            if (!productDoc.exists()) { router.push('/customer'); return; }
            const pData = { ...productDoc.data(), id: productDoc.id } as MenuItem;
            setProduct(pData);
            const restDoc = await getDoc(doc(db, 'restaurants', pData.restaurantId));
            if (restDoc.exists()) setRestaurant({ ...restDoc.data(), id: restDoc.id } as Restaurant);
            const recQ = query(collection(db, 'menuItems'), where('restaurantId', '==', pData.restaurantId), where('category', '==', pData.category));
            const recSnap = await getDocs(recQ);
            setRecommendations(recSnap.docs.map(d => ({ ...d.data(), id: d.id })).filter((i: any) => i.id !== productId).slice(0, 6) as MenuItem[]);
        } catch (e) {
            console.error('Error loading product:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleFavorite = async () => {
        if (!user) { toast.error("Please login to save favorites"); return; }
        try {
            const ref = doc(db, 'customers', user.uid);
            if (isFavorite) {
                await updateDoc(ref, { favorites: arrayRemove(productId) });
                setIsFavorite(false);
                toast.success('Removed from favorites');
            } else {
                await updateDoc(ref, { favorites: arrayUnion(productId) });
                setIsFavorite(true);
                toast.success('Added to favorites ❤️');
            }
        } catch { toast.error("Failed to update favorite"); }
    };

    const toggleAddOn = (addon: { id: string; name: string; price: number }) => {
        setSelectedAddOns(prev => {
            const next = { ...prev };
            if (next[addon.id]) { delete next[addon.id]; } else { next[addon.id] = { name: addon.name, price: addon.price }; }
            return next;
        });
    };

    const realReviewCount = reviews.length;
    const realAverageRating = realReviewCount > 0 ? reviews.reduce((s, r) => s + (Number(r.rating) || 0), 0) / realReviewCount : (product?.averageRating || 0);

    const basePrice = product?.price || 0;
    const sizePrice = selectedSize.price || 0;
    const addOnsTotal = Object.values(selectedAddOns).reduce((s, a) => s + a.price, 0);
    const unitPrice = basePrice + sizePrice + addOnsTotal;
    const totalPrice = unitPrice * quantity;

    const handleAddToCart = (isBuyNow = false) => {
        if (!product || !restaurant) return;
        if (!operatingStatus.isOpen) {
            toast.error(`Restaurant is currently closed (${operatingStatus.reason}). Ordering is paused, but you can save this dish to your wishlist!`);
            return;
        }
        const parts: string[] = [`Spice: ${selectedSpice}`];
        if (selectedSize.name !== 'Regular') parts.push(`Size: ${selectedSize.name}${selectedSize.price > 0 ? ` (+₹${selectedSize.price})` : ''}`);
        const addonList = Object.values(selectedAddOns);
        if (addonList.length > 0) parts.push(`Extras: ${addonList.map(a => `${a.name} (+₹${a.price})`).join(', ')}`);
        if (cookingNote.trim()) parts.push(`Note: ${cookingNote.trim()}`);

        addItem({
            menuItemId: product.id!,
            restaurantId: product.restaurantId,
            name: selectedSize.name !== 'Regular' ? `${product.name} (${selectedSize.name})` : product.name,
            price: unitPrice,
            image: product.image,
            quantity,
            restaurantName: restaurant.name,
            category: product.category,
            specialInstructions: parts.join(' | '),
            id: `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            addedAt: new Date(),
        });

        if (isBuyNow) router.push('/customer/checkout');
        else toast.success(`${product.name} added to cart!`);
    };

    if (loading || !product) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-semibold text-muted-foreground">Loading Dish Details...</p>
            </div>
        );
    }

    const images = (product.images && product.images.length > 0) ? product.images : [product.image];
    const foodType = (product as any)?.foodType || (product.vegetarian ? 'veg' : 'non-veg');
    const spiceLevel = (product as any)?.spiceLevel || 'medium';
    const originalPrice = (product as any)?.originalPrice;
    const discount = originalPrice && originalPrice > product.price ? Math.round(((originalPrice - product.price) / originalPrice) * 100) : null;
    const allergens = product.allergens || [];
    const productTags = product.tags || [];
    const nutrition = (product as any)?.nutrition || {};
    const restaurantIngredients: string[] = (product as any)?.ingredients || [];
    const servingSize = (product as any)?.servingSize || (product as any)?.portionSize;

    return (
        <div className="min-h-screen text-foreground font-sans selection:bg-primary/30 pb-32 md:pb-20">
            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
                <div className="absolute top-[-10%] right-[-10%] w-[650px] h-[650px] bg-primary/10 rounded-full blur-[150px]" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-[150px]" />
            </div>

            {/* HEADER */}
            <header className="sticky top-0 z-40 p-3 sm:p-4">
                <div className="bg-card/90 backdrop-blur-2xl border border-border/70 rounded-2xl sm:rounded-3xl px-3.5 sm:px-5 py-2.5 flex items-center justify-between w-full max-w-[1440px] mx-auto shadow-lg">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        <Button variant="ghost" size="icon" onClick={() => router.back()}
                            className="rounded-xl hover:bg-muted h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 border border-border/50"
                        >
                            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                        </Button>
                        {restaurant ? (
                            <Link href={`/customer/restaurant/${restaurant.id}`} className="flex items-center gap-2 group min-w-0 pr-2 hover:opacity-90 transition-opacity">
                                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl overflow-hidden border border-border/70 relative flex-shrink-0 bg-muted">
                                    <SafeImage src={restaurant.image} alt={restaurant.name} fill className="object-cover" fallbackType="restaurant" />
                                </div>
                                <div className="truncate">
                                    <div className="font-extrabold text-xs sm:text-sm text-foreground group-hover:text-primary transition-colors truncate flex items-center gap-1.5">
                                        <span>{restaurant.name}</span>
                                        <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                                    </div>
                                    <div className="text-[10px] sm:text-[11px] text-muted-foreground flex items-center gap-2 font-medium">
                                        <span className="text-amber-500 font-bold flex items-center gap-0.5"><Star className="w-2.5 h-2.5 fill-amber-500" />{(restaurant.rating || restaurant.averageRating || 4.2).toFixed(1)}</span>
                                        <span>•</span>
                                        <span>{restaurant.deliveryTime || 30} mins</span>
                                    </div>
                                </div>
                            </Link>
                        ) : (
                            <span className="font-extrabold text-sm text-foreground truncate">Hunger</span>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                        <div className="relative">
                            <Button variant="ghost" size="icon" onClick={() => setShareOpen(o => !o)} className="rounded-xl hover:bg-muted h-9 w-9 sm:h-10 sm:w-10 border border-border/40">
                                <Share2 className="w-4 h-4" />
                            </Button>
                            {shareOpen && (
                                <div className="absolute right-0 top-12 z-50 bg-card border border-border rounded-2xl shadow-xl p-3 min-w-[180px] space-y-1">
                                    <p className="text-xs font-bold text-muted-foreground px-2 pb-1 border-b border-border/60">Share this dish</p>
                                    <button onClick={() => { window.open(`https://wa.me/?text=${encodeURIComponent(`Check out ${product.name} on Hunger! ₹${product.price}. ${window.location.href}`)}`, '_blank'); setShareOpen(false); }} className="w-full text-left px-3 py-2 rounded-xl text-sm font-semibold hover:bg-muted flex items-center gap-2.5 transition-colors">💬 WhatsApp</button>
                                    <button onClick={async () => { setShareOpen(false); const ok = await copyToClipboard(window.location.href); if (ok) toast.success("Link copied!"); }} className="w-full text-left px-3 py-2 rounded-xl text-sm font-semibold hover:bg-muted flex items-center gap-2.5 transition-colors">🔗 Copy Link</button>
                                </div>
                            )}
                        </div>
                        <Button onClick={handleToggleFavorite} variant="ghost" size="icon"
                            className={`rounded-xl h-9 w-9 sm:h-10 sm:w-10 border shadow-xs transition-all ${isFavorite ? 'bg-rose-500 text-white border-rose-500 hover:bg-rose-600' : 'border-border/40 hover:bg-muted'}`}
                        >
                            <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
                        </Button>
                        <div className="hidden sm:block"><ThemeToggle /></div>
                        <Link href="/customer/cart">
                            <Button variant="ghost" size="icon" className="rounded-xl hover:bg-muted h-9 w-9 sm:h-10 sm:w-10 relative border border-border/40">
                                <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
                                {totalCartCount > 0 && <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-background">{totalCartCount}</span>}
                            </Button>
                        </Link>
                    </div>
                </div>
            </header>

            {shareOpen && <div className="fixed inset-0 z-40" onClick={() => setShareOpen(false)} />}

            <main className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 mt-4 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 relative z-10">
                {/* Real-time Closed Alert Banner */}
                {!operatingStatus.isOpen && (
                    <div className="lg:col-span-12 p-4 sm:p-5 rounded-3xl bg-rose-500/10 border-2 border-rose-500/30 text-rose-700 dark:text-rose-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg shadow-rose-500/5 transition-all">
                        <div className="flex items-center gap-3.5">
                            <div className="w-12 h-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-md">
                                <AlertCircle className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block animate-pulse" />
                                        Restaurant is Currently Closed
                                    </span>
                                    {operatingStatus.nextOpenTime && (
                                        <Badge variant="outline" className="text-[10px] border-rose-500/40 text-rose-600 dark:text-rose-400 font-bold">
                                            Opens {operatingStatus.nextOpenTime}
                                        </Badge>
                                    )}
                                </div>
                                <h4 className="font-extrabold text-sm sm:text-base text-foreground mt-0.5">
                                    {operatingStatus.reason}
                                </h4>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Orders and cart adding are paused. You can still save this dish to your wishlist!
                                </p>
                            </div>
                        </div>
                        <Badge variant="destructive" className="px-3 py-1 font-black text-xs uppercase tracking-wider shrink-0">
                            Closed for Orders
                        </Badge>
                    </div>
                )}

                {/* ── LEFT COLUMN ────────────────────────────────────── */}
                <div className="lg:col-span-6 space-y-5">
                    <ImageCarousel images={images} productName={product.name} />

                    {/* Offers */}
                    {!loadingOffers && restaurantOffers.length > 0 && (
                        <div className="rounded-2xl p-4 bg-card/80 backdrop-blur-md border border-border/70 shadow-sm space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Tag className="w-3.5 h-3.5 text-primary" /> Store Exclusive Offers</span>
                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">Valid only at {restaurant?.name || 'this store'}</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {restaurantOffers.map((offer) => (
                                    <button key={offer.id} type="button"
                                        onClick={async () => {
                                            await copyToClipboard(offer.code);
                                            localStorage.setItem('suggestedPromo', offer.code);
                                            toast.success(`Coupon "${offer.code}" copied!`);
                                        }}
                                        className="p-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition-all text-left flex items-center justify-between group cursor-pointer"
                                    >
                                        <div className="min-w-0 pr-2">
                                            <div className="text-xs font-black text-primary flex items-center gap-1.5">
                                                <span>{offer.code}</span>
                                                <span className="text-[10px] font-normal text-muted-foreground">{offer.type === 'percentage' ? `${offer.value}% OFF` : offer.type === 'free_delivery' ? 'FREE DELIVERY' : `₹${offer.value} OFF`}</span>
                                            </div>
                                            <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{offer.minOrderAmount ? `Min ₹${offer.minOrderAmount}` : offer.description}</div>
                                        </div>
                                        <div className="p-1.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all flex-shrink-0">
                                            <Percent className="w-3.5 h-3.5" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Guarantees */}
                    <div className="grid grid-cols-3 gap-2.5 text-center">
                        {[
                            { icon: <Clock className="w-5 h-5 text-primary" />, title: 'Fast Delivery', sub: '25-35 Mins' },
                            { icon: <ShieldCheck className="w-5 h-5 text-emerald-500" />, title: 'Safe Food', sub: 'Hygiene Certified' },
                            { icon: <Sparkles className="w-5 h-5 text-amber-500" />, title: 'Fresh Made', sub: 'Cooked on Order' },
                        ].map((g, i) => (
                            <div key={i} className="p-3 rounded-2xl bg-card/60 border border-border/60 flex flex-col items-center gap-1">
                                {g.icon}
                                <span className="text-xs font-bold text-foreground">{g.title}</span>
                                <span className="text-[10px] text-muted-foreground">{g.sub}</span>
                            </div>
                        ))}
                    </div>

                    {/* Restaurant Card */}
                    {restaurant && (
                        <div className="rounded-2xl p-5 bg-card/90 border border-border/70 shadow-md space-y-4">
                            <h3 className="text-sm font-black text-foreground flex items-center gap-2"><Store className="w-4 h-4 text-primary" /> Restaurant Info</h3>
                            <div className="flex items-start gap-4">
                                <div className="w-14 h-14 rounded-2xl overflow-hidden border border-border/70 relative flex-shrink-0 bg-muted">
                                    <SafeImage src={restaurant.image} alt={restaurant.name} fill className="object-cover" fallbackType="restaurant" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-black text-base text-foreground flex items-center gap-1.5 flex-wrap">
                                        {restaurant.name} <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-muted-foreground font-medium">
                                        <span className="flex items-center gap-1 text-amber-500 font-bold"><Star className="w-3 h-3 fill-amber-500" />{(restaurant.rating || restaurant.averageRating || 4.2).toFixed(1)}</span>
                                        <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-primary" />{restaurant.deliveryTime || 25}–{(restaurant.deliveryTime || 25) + 10} min</span>
                                        {restaurant.deliveryCharge !== undefined && <span className="flex items-center gap-1"><Truck className="w-3 h-3 text-emerald-500" />{restaurant.deliveryCharge === 0 ? 'Free Delivery' : `₹${restaurant.deliveryCharge} delivery`}</span>}
                                    </div>
                                    {restaurant.address && <p className="text-[11px] text-muted-foreground mt-1.5 flex items-start gap-1 line-clamp-1"><MapPin className="w-3 h-3 flex-shrink-0 mt-0.5 text-primary" />{restaurant.address}</p>}
                                </div>
                            </div>
                            <Link href={`/customer/restaurant/${restaurant.id}`}>
                                <Button variant="outline" size="sm" className="w-full h-9 rounded-xl border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground font-bold text-xs transition-all">
                                    <Store className="w-3.5 h-3.5 mr-1.5" /> View Full Restaurant Menu <ExternalLink className="w-3 h-3 ml-auto" />
                                </Button>
                            </Link>
                        </div>
                    )}
                </div>

                {/* ── RIGHT COLUMN ───────────────────────────────────── */}
                <div className="lg:col-span-6 flex flex-col space-y-6">
                    <div>
                        {/* Badges */}
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                            <Badge variant="outline" className="border-primary/40 text-primary bg-primary/10 font-bold px-3 py-1">{product.category}</Badge>
                            {foodType === 'veg' || foodType === 'vegan' ? (
                                <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 font-semibold flex gap-1">
                                    <span className="w-2 h-2 rounded-sm border border-emerald-600 flex items-center justify-center"><span className="w-1 h-1 rounded-full bg-emerald-600" /></span>
                                    {foodType === 'vegan' ? 'Pure Vegan' : '100% Vegetarian'}
                                </Badge>
                            ) : foodType === 'egg' ? (
                                <Badge variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10 font-semibold">🟡 Contains Egg</Badge>
                            ) : (
                                <Badge variant="outline" className="border-rose-500/30 text-rose-500 bg-rose-500/10 font-semibold flex gap-1"><Flame className="w-3 h-3" /> Non-Vegetarian</Badge>
                            )}
                            {product.isBestSeller && <Badge className="bg-amber-500 text-black border-none font-bold">⭐ Bestseller</Badge>}
                            {product.isNew && <Badge className="bg-blue-600 text-white border-none font-bold">✨ New Arrival</Badge>}
                            {(product as any)?.isChefSpecial && <Badge className="bg-rose-500 text-white border-none font-bold">👨‍🍳 Chef's Special</Badge>}
                            {(product as any)?.isMustTry && <Badge className="bg-orange-500 text-white border-none font-bold">🔥 Must Try</Badge>}
                            {(product as any)?.isTrending && <Badge className="bg-violet-600 text-white border-none font-bold">⚡ Trending</Badge>}
                            {(product as any)?.isHealthyChoice && <Badge className="bg-emerald-600 text-white border-none font-bold">🥗 Healthy Choice</Badge>}
                            {(product as any)?.isSeasonalSpecial && <Badge className="bg-amber-600 text-white border-none font-bold">🌟 Seasonal Special</Badge>}
                            {(product as any)?.isLimitedEdition && <Badge className="bg-zinc-800 text-amber-300 border border-amber-400/40 font-bold">⏳ Limited Batch</Badge>}
                            {(product as any)?.isHouseSpecialty && <Badge className="bg-indigo-600 text-white border-none font-bold">👑 House Specialty</Badge>}
                            {(product as any)?.isKidsFavorite && <Badge className="bg-sky-500 text-white border-none font-bold">👶 Kids' Favorite</Badge>}
                        </div>

                        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-foreground leading-tight tracking-tight mb-2">{product.name}</h1>

                        {/* Rating & Quick Meta */}
                        <div className="flex flex-wrap items-center gap-4 sm:gap-6 mb-4 text-muted-foreground text-sm">
                            <div className="flex items-center gap-2">
                                {realReviewCount > 0 ? (
                                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-500 font-black text-sm">
                                        <Star className="w-4 h-4 fill-amber-500" /> <span>{realAverageRating.toFixed(1)}</span>
                                    </div>
                                ) : (
                                    <span className="px-2.5 py-0.5 rounded-lg bg-muted text-muted-foreground font-bold text-xs border border-border/50">NEW</span>
                                )}
                                <span className="text-xs sm:text-sm font-semibold">({realReviewCount} {realReviewCount === 1 ? 'review' : 'reviews'})</span>
                            </div>
                            <div className="w-1 h-1 bg-border rounded-full" />
                            <div className="flex items-center gap-1.5 font-medium"><Clock className="w-4 h-4 text-primary" /><span>{product.preparationTime || 25} mins prep</span></div>
                            {product.servings && <><div className="w-1 h-1 bg-border rounded-full" /><div className="flex items-center gap-1.5 font-medium"><Utensils className="w-4 h-4 text-primary" /><span>Serves {product.servings}</span></div></>}
                        </div>

                        {/* Price */}
                        <div className="flex flex-wrap items-baseline gap-3 mb-4">
                            <span className="text-3xl sm:text-4xl font-black text-foreground">₹{product.price}</span>
                            {originalPrice && originalPrice > product.price && (
                                <>
                                    <span className="text-xl text-muted-foreground line-through font-mono">₹{originalPrice}</span>
                                    <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-black px-3 py-1 text-sm">{discount}% OFF</Badge>
                                </>
                            )}
                        </div>

                        {/* Description */}
                        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-6 border-l-4 border-primary pl-4 bg-muted/30 p-3.5 rounded-r-xl">
                            {product.description || "Prepared fresh with chef-curated premium ingredients, seasoned with authentic aromatic spices and crafted for an unforgettable culinary experience."}
                        </p>

                        {/* Quick Stats */}
                        <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-6">
                            {[
                                { emoji: '🔥', value: product.calories || (nutrition as any)?.calories || '~320', label: 'Calories' },
                                { emoji: '⏱️', value: `${product.preparationTime || 25}m`, label: 'Prep Time' },
                                { emoji: '🍽️', value: product.servings || '1', label: 'Serves' },
                                { emoji: spiceLevel === 'hot' ? '🌶️🌶️🌶️' : spiceLevel === 'mild' ? '🌶️' : '🌶️🌶️', value: spiceLevel === 'none' ? 'No Spice' : spiceLevel === 'mild' ? 'Mild' : spiceLevel === 'hot' ? 'Extra Hot' : 'Medium', label: 'Spice' },
                            ].map((m, i) => (
                                <div key={i} className="bg-card/90 rounded-2xl p-3 border border-border/60 text-center flex flex-col items-center gap-0.5 shadow-xs">
                                    <span className="text-xl">{m.emoji}</span>
                                    <div className="text-sm sm:text-base font-black text-foreground truncate w-full text-center">{m.value}</div>
                                    <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-semibold">{m.label}</div>
                                </div>
                            ))}
                        </div>

                        {/* Tab Bar */}
                        <div className="flex p-1 bg-muted/60 rounded-2xl border border-border/60 mb-6 text-xs sm:text-sm font-bold overflow-x-auto">
                            {([
                                { key: 'customize', icon: <Utensils className="w-4 h-4 text-primary" />, label: 'Customize' },
                                { key: 'nutrition', icon: <Info className="w-4 h-4 text-amber-500" />, label: 'Nutrition' },
                                { key: 'info', icon: <Sparkles className="w-4 h-4 text-emerald-500" />, label: 'Food Info' },
                            ] as const).map(tab => (
                                <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
                                    className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap px-2 ${activeTab === tab.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    {tab.icon} <span>{tab.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* TAB: CUSTOMIZE */}
                        {activeTab === 'customize' && (
                            <div className="space-y-6">
                                {/* Spice Level */}
                                <div className="space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-bold text-foreground flex items-center gap-1.5">
                                            <Flame className="w-4 h-4 text-orange-500" /> Spice Level
                                            <span className="text-[10px] bg-rose-500/15 text-rose-500 px-1.5 py-0.5 rounded-full font-bold">Required</span>
                                        </label>
                                        <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{selectedSpice}</span>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        {SPICE_LEVELS.map(level => (
                                            <button key={level.id} type="button" onClick={() => setSelectedSpice(level.id)}
                                                className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer flex flex-col items-center gap-0.5 ${selectedSpice === level.id ? 'border-primary bg-primary/15 text-foreground ring-2 ring-primary/25 shadow-xs' : 'border-border/70 bg-card/60 text-muted-foreground hover:text-foreground hover:bg-card'}`}
                                            >
                                                <span className="font-extrabold">{level.label}</span>
                                                <span className="text-[10px] text-muted-foreground font-normal">{level.desc}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Size */}
                                <div className="space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-bold text-foreground">Choose Size</label>
                                        {selectedSize.price > 0 && <span className="text-xs font-bold text-primary">+₹{selectedSize.price}</span>}
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                        {configuredSizes.map(sizeOpt => (
                                            <button key={sizeOpt.id} type="button" onClick={() => setSelectedSize(sizeOpt)}
                                                className={`p-3 rounded-2xl text-left border transition-all cursor-pointer relative ${selectedSize.id === sizeOpt.id ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary/20' : 'border-border/70 bg-card/60 hover:border-border hover:bg-card'}`}
                                            >
                                                {selectedSize.id === sizeOpt.id && <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px]">✓</div>}
                                                <div className="font-bold text-sm text-foreground">{sizeOpt.name}</div>
                                                {(sizeOpt as any).desc && <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">{(sizeOpt as any).desc}</div>}
                                                <div className="text-xs font-black text-primary mt-2">{sizeOpt.price === 0 ? 'Standard Price' : `+₹${sizeOpt.price}`}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Add-ons */}
                                <div className="space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-bold text-foreground">Add-ons & Extras</label>
                                        <span className="text-xs text-muted-foreground font-medium">Optional</span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                        {configuredAddOns.map(addon => {
                                            const isSelected = Boolean(selectedAddOns[addon.id]);
                                            return (
                                                <button key={addon.id} type="button" onClick={() => toggleAddOn(addon)}
                                                    className={`p-3 rounded-2xl text-left border transition-all flex items-center justify-between cursor-pointer ${isSelected ? 'border-primary bg-primary/10 ring-1 ring-primary/20 shadow-xs' : 'border-border/70 bg-card/60 hover:border-border hover:bg-card'}`}
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center text-xs transition-colors ${isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40 bg-card'}`}>{isSelected && '✓'}</div>
                                                        <div className="truncate text-xs sm:text-sm font-bold text-foreground">{addon.name}</div>
                                                    </div>
                                                    <span className="text-xs font-black text-primary flex-shrink-0">{addon.price > 0 ? `+₹${addon.price}` : 'Free'}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Special Instructions */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-foreground flex items-center gap-1.5"><MessageSquareText className="w-4 h-4 text-primary" /> Special Instructions</label>
                                    <textarea value={cookingNote} onChange={(e) => setCookingNote(e.target.value)}
                                        placeholder="e.g. Less spicy, no onions, extra sauce, no coriander..."
                                        rows={2}
                                        className="w-full rounded-xl bg-muted/40 border border-border/70 p-3 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all resize-none"
                                    />
                                    <p className="text-[11px] text-muted-foreground">*Saved with your order and sent to the kitchen.</p>
                                </div>
                            </div>
                        )}

                        {/* TAB: NUTRITION */}
                        {activeTab === 'nutrition' && (
                            <div className="space-y-5">
                                <div className="rounded-2xl p-4 bg-card/90 border border-border/70 shadow-xs space-y-4">
                                    <h4 className="font-black text-sm text-foreground flex items-center gap-2">🔥 Nutritional Facts <span className="text-xs font-normal text-muted-foreground">(Per Serving)</span></h4>
                                    {product.calories || nutrition.protein || nutrition.carbs || nutrition.fat ? (
                                        <div className="space-y-3 text-xs">
                                            {[
                                                { label: 'Calories', value: `${product.calories || nutrition.calories || 320} kcal`, color: 'bg-orange-500', width: '35%' },
                                                { label: 'Protein', value: `${nutrition.protein || Math.round(((product.calories || 320) * 0.15) / 4)}g`, color: 'bg-emerald-500', width: '45%' },
                                                { label: 'Carbohydrates', value: `${nutrition.carbs || Math.round(((product.calories || 320) * 0.55) / 4)}g`, color: 'bg-blue-500', width: '40%' },
                                                { label: 'Fats', value: `${nutrition.fat || Math.round(((product.calories || 320) * 0.30) / 9)}g`, color: 'bg-rose-500', width: '28%' },
                                            ].map(n => (
                                                <div key={n.label}>
                                                    <div className="flex justify-between font-bold text-foreground mb-1"><span>{n.label}</span><span>{n.value}</span></div>
                                                    <div className="h-2 rounded-full bg-muted overflow-hidden"><div className={`h-full ${n.color} rounded-full`} style={{ width: n.width }} /></div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="p-3 rounded-xl bg-muted/30 text-xs text-muted-foreground italic">Nutritional values not provided by the restaurant for this item.</p>
                                    )}
                                </div>

                                {/* Spice display */}
                                <div className="rounded-2xl p-4 bg-card/90 border border-border/70 shadow-xs">
                                    <h4 className="font-black text-sm text-foreground mb-3">🌶️ Spice Level</h4>
                                    <div className="flex items-center gap-3">
                                        {['none', 'mild', 'medium', 'hot'].map((s, i) => {
                                            const labels = ['Not Spicy', 'Mild', 'Medium', 'Extra Hot'];
                                            const emojis = ['🍃', '🌶️', '🌶️🌶️', '🌶️🌶️🌶️'];
                                            const isActive = s === spiceLevel || (i === 2 && !spiceLevel);
                                            return (
                                                <div key={s} className={`flex-1 p-2 rounded-xl text-center text-xs font-bold border transition-all ${isActive ? 'border-red-500/50 bg-red-500/10 text-red-500' : 'border-border/40 text-muted-foreground'}`}>
                                                    <div>{emojis[i]}</div>
                                                    <div className="text-[10px] mt-0.5">{labels[i]}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Allergens */}
                                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5 text-xs text-amber-600 dark:text-amber-400">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <span className="font-bold">Allergen Notice: </span>
                                        {allergens.length > 0 ? <span>Contains: <strong>{allergens.join(', ')}</strong>. Please inform us of severe allergies via special instructions.</span> : <span>If you have severe allergies, please add them to the special instructions before ordering.</span>}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB: FOOD INFO */}
                        {activeTab === 'info' && (
                            <div className="space-y-5">
                                {/* Ingredients */}
                                <div className="rounded-2xl p-4 bg-card/90 border border-border/70 shadow-xs space-y-2.5">
                                    <h4 className="font-black text-sm text-foreground flex items-center gap-1.5"><Leaf className="w-4 h-4 text-emerald-500" /> Key Ingredients</h4>
                                    {restaurantIngredients.length > 0 ? (
                                        <div className="flex flex-wrap gap-2 pt-1">
                                            {restaurantIngredients.map((item: string, i: number) => (
                                                <span key={i} className="px-3 py-1.5 rounded-xl bg-muted/60 border border-border/60 text-xs font-semibold text-foreground flex items-center gap-1">🌱 {item}</span>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="p-3 rounded-xl bg-muted/30 text-xs text-muted-foreground italic">Detailed ingredient list not provided by the restaurant.</p>
                                    )}
                                </div>

                                {/* Dietary */}
                                <div className="rounded-2xl p-4 bg-card/90 border border-border/70 shadow-xs space-y-3">
                                    <h4 className="font-black text-sm text-foreground">🥗 Dietary Information</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { label: foodType === 'veg' || foodType === 'vegan' ? '✅ Vegetarian' : '❌ Non-Vegetarian', active: true },
                                            { label: foodType === 'vegan' ? '✅ Vegan' : '❌ Not Vegan', active: foodType === 'vegan' },
                                            { label: (product as any)?.isJain ? '✅ Jain Friendly' : '— Jain: Not Specified', active: (product as any)?.isJain },
                                            { label: (product as any)?.isGlutenFree ? '✅ Gluten Free' : '— Gluten Free: Not Specified', active: (product as any)?.isGlutenFree },
                                            { label: (product as any)?.isHalal ? '✅ Halal Certified' : '— Halal: Not Specified', active: (product as any)?.isHalal },
                                            { label: spiceLevel === 'none' ? '🍃 Not Spicy' : spiceLevel === 'mild' ? '🌶️ Mildly Spicy' : spiceLevel === 'hot' ? '🌶️🌶️🌶️ Very Spicy' : '🌶️🌶️ Medium Spicy', active: true },
                                        ].map((d, i) => (
                                            <div key={i} className={`px-3 py-2 rounded-xl text-xs font-semibold border ${d.active ? 'bg-emerald-500/5 border-emerald-500/20 text-foreground' : 'bg-muted/30 border-border/40 text-muted-foreground'}`}>{d.label}</div>
                                        ))}
                                    </div>
                                </div>

                                {/* Prep & Serving */}
                                <div className="rounded-2xl p-4 bg-card/90 border border-border/70 shadow-xs space-y-3">
                                    <h4 className="font-black text-sm text-foreground">⏱️ Preparation & Serving</h4>
                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                        {[
                                            { label: 'Preparation Time', value: `${product.preparationTime || 15}–${(product.preparationTime || 15) + 5} min` },
                                            { label: 'Serving Size', value: servingSize || 'Standard' },
                                            { label: 'Serves', value: `${product.servings || 1}–${(product.servings || 1) + 1} Person` },
                                            { label: 'Calories', value: `${product.calories || nutrition.calories || '~320'} kcal` },
                                        ].map((m, i) => (
                                            <div key={i} className="p-3 bg-muted/40 rounded-xl">
                                                <div className="text-muted-foreground font-medium mb-0.5">{m.label}</div>
                                                <div className="font-black text-foreground text-sm">{m.value}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Tags */}
                                {productTags.length > 0 && (
                                    <div className="rounded-2xl p-4 bg-card/90 border border-border/70 shadow-xs space-y-2.5">
                                        <h4 className="font-black text-sm text-foreground">🏷️ Tags</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {productTags.map((tag: string, i: number) => (
                                                <span key={i} className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold">#{tag}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Price Breakdown & CTA */}
                    <div className="space-y-4 pt-6 border-t border-border/60">
                        <div className="bg-card/90 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-border/70 shadow-md">
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-0.5">Calculated Total</p>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">₹{totalPrice}</span>
                                        {quantity > 1 && <span className="text-xs text-muted-foreground font-medium">(₹{unitPrice} × {quantity})</span>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 bg-muted/60 p-1.5 rounded-full border border-border/60 shadow-inner">
                                    <button onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1}
                                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-card hover:bg-accent flex items-center justify-center transition-all border border-border/60 disabled:opacity-40 cursor-pointer"
                                        aria-label="Decrease quantity"
                                    >
                                        <Minus className="w-4 h-4" />
                                    </button>
                                    <span className="w-7 text-center font-black text-base sm:text-lg tabular-nums text-foreground">{quantity}</span>
                                    <button onClick={() => setQuantity(quantity + 1)}
                                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center transition-all shadow-sm cursor-pointer"
                                        aria-label="Increase quantity"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div className="text-[11px] text-muted-foreground pt-2 border-t border-border/50 flex flex-wrap gap-x-2 gap-y-1">
                                <span>Base: ₹{basePrice}</span>
                                {sizePrice > 0 && <span>• Size (+₹{sizePrice})</span>}
                                {addOnsTotal > 0 && <span>• Add-ons (+₹{addOnsTotal})</span>}
                                <span className="font-semibold text-primary">• Spice: {selectedSpice}</span>
                            </div>
                        </div>

                        {!operatingStatus.isOpen ? (
                            <div className="flex gap-3 sm:gap-4">
                                <Button
                                    onClick={handleToggleFavorite}
                                    variant="outline"
                                    className={`flex-1 h-12 sm:h-14 rounded-xl sm:rounded-2xl border-border bg-card font-bold text-sm sm:text-base gap-2 cursor-pointer transition-all ${
                                        isFavorite ? 'border-rose-500 text-rose-500 bg-rose-500/10 hover:bg-rose-500/20' : 'hover:bg-muted text-foreground'
                                    }`}
                                >
                                    <Heart className={`w-4 h-4 sm:w-5 sm:h-5 ${isFavorite ? 'fill-current text-rose-500' : ''}`} />
                                    {isFavorite ? 'Saved in Wishlist' : 'Add to Wishlist'}
                                </Button>
                                <Button
                                    disabled
                                    className="flex-1 h-12 sm:h-14 rounded-xl sm:rounded-2xl bg-muted text-muted-foreground font-black text-sm sm:text-base cursor-not-allowed"
                                >
                                    Restaurant Closed
                                </Button>
                            </div>
                        ) : (
                            <div className="flex gap-3 sm:gap-4">
                                <Button onClick={() => handleAddToCart(false)} variant="outline"
                                    className="flex-1 h-12 sm:h-14 rounded-xl sm:rounded-2xl border-border bg-card hover:bg-muted text-foreground font-bold text-sm sm:text-base tracking-wide transition-all cursor-pointer shadow-sm"
                                >
                                    <ShoppingCart className="w-4 h-4 mr-2" /> Add to Cart
                                </Button>
                                <Button onClick={() => handleAddToCart(true)}
                                    className="flex-1 h-12 sm:h-14 rounded-xl sm:rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm sm:text-base shadow-lg shadow-primary/25 tracking-wide transition-all cursor-pointer"
                                >
                                    <Zap className="w-4 h-4 sm:w-5 sm:h-5 mr-2 fill-current" /> Buy Now
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Similar Products */}
            {recommendations.length > 0 && (
                <section className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 mt-16 sm:mt-20">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl sm:text-2xl font-black flex items-center gap-2 text-foreground">You May Also Like <Sparkles className="w-5 h-5 text-amber-500" /></h3>
                        {restaurant && <Link href={`/customer/restaurant/${restaurant.id}`} className="text-xs text-primary font-bold hover:underline flex items-center gap-1">View All <ChevronRight className="w-3.5 h-3.5" /></Link>}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-5">
                        {recommendations.map(item => (
                            <Link key={item.id} href={`/customer/product/${item.id}`} className="block group">
                                <div className="bg-card border border-border/60 rounded-2xl overflow-hidden hover:border-primary/50 transition-all shadow-xs hover:shadow-md h-full">
                                    <div className="aspect-square relative bg-muted">
                                        <SafeImage src={item.image} alt={item.name} className="object-cover group-hover:scale-105 transition-transform duration-500" fill />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                        <div className="absolute bottom-2 right-2 bg-card/90 backdrop-blur-md px-2 py-0.5 rounded-lg text-xs font-black text-foreground border border-border/60">₹{item.price}</div>
                                        <div className="absolute top-2 left-2 flex items-center gap-1 bg-amber-500 text-black px-1.5 py-0.5 rounded-md text-[10px] font-bold"><Star className="w-2.5 h-2.5 fill-black" />{item.averageRating?.toFixed(1) || '4.5'}</div>
                                    </div>
                                    <div className="p-2.5">
                                        <h4 className="font-bold text-foreground text-xs truncate group-hover:text-primary transition-colors">{item.name}</h4>
                                        <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                                            <Clock className="w-2.5 h-2.5 text-primary" /> {item.preparationTime || 25}m
                                            {item.vegetarian && <span className="ml-auto text-emerald-500 font-bold">Veg</span>}
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* Reviews */}
            <ReviewsSection productName={product.name} reviews={reviews} loading={loadingReviews} realAverageRating={realAverageRating} />

            {/* Mobile Sticky Bar */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 p-3 bg-card/95 backdrop-blur-xl border-t border-border/70 z-50 shadow-2xl flex items-center justify-between gap-3">
                <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Price</div>
                    <div className="text-xl font-black text-foreground">₹{totalPrice}</div>
                    <div className="text-[10px] text-primary font-semibold truncate max-w-[120px]">{selectedSpice}</div>
                </div>
                {!operatingStatus.isOpen ? (
                    <div className="flex items-center gap-2 flex-1 justify-end">
                        <Button
                            onClick={handleToggleFavorite}
                            variant="outline"
                            className={`h-11 px-3 rounded-xl border font-bold text-xs gap-1.5 cursor-pointer ${
                                isFavorite ? 'border-rose-500 text-rose-500 bg-rose-500/10' : ''
                            }`}
                        >
                            <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current text-rose-500' : ''}`} />
                            {isFavorite ? 'Saved' : 'Wishlist'}
                        </Button>
                        <Button
                            disabled
                            className="h-11 px-4 rounded-xl bg-muted text-muted-foreground font-black text-xs cursor-not-allowed"
                        >
                            Closed
                        </Button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 flex-1 justify-end">
                        <Button onClick={() => handleAddToCart(false)} variant="outline" className="h-11 px-4 rounded-xl border-border font-bold text-xs cursor-pointer">Cart</Button>
                        <Button onClick={() => handleAddToCart(true)} className="h-11 px-6 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs shadow-md shadow-primary/25 cursor-pointer"><Zap className="w-3.5 h-3.5 mr-1.5 fill-current" /> Buy Now</Button>
                    </div>
                )}
            </div>
        </div>
    );
}
