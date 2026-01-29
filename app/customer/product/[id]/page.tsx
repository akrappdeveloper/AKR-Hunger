'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, arrayUnion, arrayRemove, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MenuItem, Restaurant } from '@/lib/types';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Star, Flame, Leaf, Clock, ArrowLeft, Plus, Minus, Zap,
    ShoppingCart, Heart, Share2, Info, ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function ProductDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const { addItem } = useCart();
    const { user, customer } = useAuth();

    const [product, setProduct] = useState<MenuItem | null>(null);
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
    const [recommendations, setRecommendations] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [quantity, setQuantity] = useState(1);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isFavorite, setIsFavorite] = useState(false);

    useEffect(() => {
        loadProductData();
    }, [id]);

    useEffect(() => {
        if (customer?.favorites && id) {
            setIsFavorite(customer.favorites.includes(id));
        }
    }, [customer, id]);

    const loadProductData = async () => {
        try {
            setLoading(true);
            const productDoc = await getDoc(doc(db, 'menuItems', id));
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
                .filter(item => item.id !== id)
                .slice(0, 4) as MenuItem[];
            setRecommendations(recItems);
        } catch (error) {
            console.error('Error loading:', error);
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
                    favorites: arrayRemove(id)
                });
                setIsFavorite(false);
                toast.success('Removed from favorites');
            } else {
                await updateDoc(customerRef, {
                    favorites: arrayUnion(id)
                });
                setIsFavorite(true);
                toast.success('Added to favorites');
            }
        } catch (error) {
            console.error("Error toggling favorite:", error);
            toast.error("Failed to update favorite");
        }
    };

    const handleAddToCart = (isBuyNow = false) => {
        if (!product || !restaurant) return;
        addItem({
            menuItemId: product.id!,
            restaurantId: product.restaurantId,
            name: product.name,
            price: product.price,
            image: product.image,
            quantity: quantity,
            restaurantName: restaurant.name,
            category: product.category,
            id: `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            addedAt: new Date(),
        });
        if (isBuyNow) router.push('/customer/checkout');
        else toast.success(`${product.name} added to cart`);
    };

    if (loading || !product) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const images = product.images && product.images.length > 0 ? product.images : [product.image];

    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-blue-500/30 pb-24">

            {/* Background Gradients */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-900/20 rounded-full blur-[100px]" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-orange-900/10 rounded-full blur-[100px]" />
            </div>

            {/* Nav */}
            <div className="sticky top-0 z-50 p-4">
                <div className="bg-black/50 backdrop-blur-xl border border-white/10 rounded-full px-4 py-2 flex items-center justify-between max-w-7xl mx-auto shadow-xl">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full hover:bg-white/10 text-white">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <span className="font-bold text-sm tracking-wide text-gray-300">{restaurant?.name}</span>
                    <Link href="/customer/cart">
                        <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/10 text-white">
                            <ShoppingCart className="w-5 h-5" />
                        </Button>
                    </Link>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-4 mt-4 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 relative z-10">

                {/* Image Gallery */}
                <div className="space-y-4">
                    <div className="aspect-square w-full bg-gray-900 rounded-3xl overflow-hidden border border-white/10 relative shadow-2xl shadow-black/50">
                        <img
                            src={images[currentImageIndex]}
                            alt={product.name}
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute top-4 left-4 flex flex-col gap-2">
                            {product.isBestSeller && (
                                <Badge className="bg-yellow-500/90 text-black border-none backdrop-blur-md shadow-lg font-bold">⭐ Best Seller</Badge>
                            )}
                            {product.vegetarian ? (
                                <Badge className="bg-green-500/90 text-white border-none backdrop-blur-md shadow-lg">🥦 Veg</Badge>
                            ) : (
                                <Badge className="bg-red-500/90 text-white border-none backdrop-blur-md shadow-lg">🍖 Non-Veg</Badge>
                            )}
                        </div>
                        <Button
                            onClick={handleToggleFavorite}
                            variant="secondary"
                            size="icon"
                            className={`absolute top-4 right-4 rounded-full border-none backdrop-blur-md transition-colors ${isFavorite ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-black/40 text-white hover:bg-black/60'}`}
                        >
                            <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
                        </Button>
                    </div>

                    {/* Thumbnails */}
                    {images.length > 1 && (
                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                            {images.map((img, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setCurrentImageIndex(idx)}
                                    className={`w-20 h-20 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 ${idx === currentImageIndex ? 'border-blue-500 scale-105' : 'border-transparent opacity-50 hover:opacity-100'}`}
                                >
                                    <img src={img} alt="" className="w-full h-full object-cover" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Details */}
                <div className="flex flex-col">
                    <div>
                        <div className="flex items-center gap-2 mb-2 text-blue-400 text-sm font-bold uppercase tracking-wider">
                            <Badge variant="outline" className="border-blue-500/30 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20">{product.category}</Badge>
                            {product.spicy && <Badge variant="outline" className="border-red-500/30 text-red-500 bg-red-500/10 hover:bg-red-500/20 flex gap-1"><Flame className="w-3 h-3" /> Spicy</Badge>}
                        </div>

                        <h1 className="text-4xl md:text-5xl font-black text-white leading-tight mb-4">{product.name}</h1>

                        <div className="flex items-center gap-6 mb-6 text-gray-400">
                            <div className="flex items-center gap-1">
                                <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                                <span className="text-white font-bold text-lg">{product.averageRating?.toFixed(1) || 'NEW'}</span>
                                <span className="text-sm">({product.totalReviews || 0} reviews)</span>
                            </div>
                            <div className="w-1 h-1 bg-gray-600 rounded-full" />
                            <div className="flex items-center gap-1.5">
                                <Clock className="w-4 h-4" />
                                <span>{product.preparationTime || 25} min</span>
                            </div>
                        </div>

                        <p className="text-lg text-gray-300 leading-relaxed mb-8 border-l-4 border-blue-500 pl-4 bg-white/5 p-4 rounded-r-xl">
                            {product.description || "A delicious mastery of flavors."}
                        </p>

                        {/* Nutrition / Info Grid */}
                        <div className="grid grid-cols-3 gap-4 mb-8">
                            <div className="bg-gray-900/50 rounded-2xl p-4 border border-white/5 text-center">
                                <div className="text-2xl font-bold text-orange-500">{product.calories || '320'}</div>
                                <div className="text-xs text-gray-500 uppercase tracking-widest font-bold">Kcal</div>
                            </div>
                            <div className="bg-gray-900/50 rounded-2xl p-4 border border-white/5 text-center">
                                <div className="text-2xl font-bold text-green-500">{product.servings || '1'}</div>
                                <div className="text-xs text-gray-500 uppercase tracking-widest font-bold">Person</div>
                            </div>
                            <div className="bg-gray-900/50 rounded-2xl p-4 border border-white/5 text-center">
                                <div className="text-2xl font-bold text-blue-500">100%</div>
                                <div className="text-xs text-gray-500 uppercase tracking-widest font-bold">Fresh</div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto space-y-4">
                        <div className="bg-gray-900/80 backdrop-blur-xl p-5 rounded-3xl border border-white/10 flex items-center justify-between">
                            <div>
                                <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Total Price</p>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-black text-white">₹{product.price * quantity}</span>
                                    {quantity > 1 && <span className="text-sm text-gray-500 line-through">₹{product.price} / item</span>}
                                </div>
                            </div>

                            {/* Quantity Control */}
                            <div className="flex items-center gap-4 bg-black p-1.5 rounded-full border border-gray-800">
                                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-10 h-10 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-colors text-white">
                                    <Minus className="w-4 h-4" />
                                </button>
                                <span className="w-8 text-center font-bold text-lg">{quantity}</span>
                                <button onClick={() => setQuantity(quantity + 1)} className="w-10 h-10 rounded-full bg-white text-black hover:bg-gray-200 flex items-center justify-center transition-colors">
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <Button
                                onClick={() => handleAddToCart(false)}
                                variant="outline"
                                className="flex-1 h-14 rounded-2xl border-gray-700 bg-transparent text-white hover:bg-white/5 hover:text-white font-bold"
                            >
                                Add to Cart
                            </Button>
                            <Button
                                onClick={() => handleAddToCart(true)}
                                className="flex-1 h-14 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold shadow-lg shadow-blue-500/20"
                            >
                                <Zap className="w-4 h-4 mr-2 fill-current" />
                                Buy Now
                            </Button>
                        </div>
                    </div>
                </div>
            </main>

            {/* Recommendations Section */}
            {recommendations.length > 0 && (
                <section className="max-w-7xl mx-auto px-4 mt-20">
                    <h3 className="text-2xl font-bold mb-8 flex items-center gap-2">
                        Recommended for you <SparklesIcon className="w-5 h-5 text-yellow-500" />
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {recommendations.map(item => (
                            <Link key={item.id} href={`/customer/product/${item.id}`} className="block group">
                                <div className="bg-gray-900/50 border border-white/5 rounded-2xl overflow-hidden hover:border-gray-700 transition-colors">
                                    <div className="h-40 relative">
                                        <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent opacity-60" />

                                        {/* Price Badge */}
                                        <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg text-xs font-bold border border-white/10">
                                            ₹{item.price}
                                        </div>

                                        {/* Rating Badge Overlay */}
                                        <div className="absolute top-2 left-2 flex items-center gap-1 bg-yellow-500/90 text-black px-2 py-0.5 rounded-md text-[10px] font-bold shadow-lg backdrop-blur-sm">
                                            <Star className="w-3 h-3 fill-black text-black" />
                                            <span>{item.averageRating?.toFixed(1) || '4.5'}</span>
                                        </div>
                                    </div>
                                    <div className="p-4">
                                        <h4 className="font-bold text-white truncate mb-1 group-hover:text-blue-400 transition-colors">{item.name}</h4>

                                        <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/5">
                                            <div className="flex items-center gap-1 text-xs text-gray-400">
                                                <Clock className="w-3 h-3" /> 25m
                                            </div>

                                            {/* Mini Rating System for Recommendation */}
                                            <div className="flex items-center gap-0.5">
                                                {[1, 2, 3, 4, 5].map(star => (
                                                    <Star
                                                        key={star}
                                                        className={`w-3 h-3 ${(item.averageRating || 4) >= star ? 'fill-yellow-500 text-yellow-500' : 'text-gray-700'}`}
                                                    />
                                                ))}
                                                <span className="text-[10px] text-gray-500 ml-1">({item.totalReviews || 0})</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* Ratings & Reviews Section */}
            <ReviewsSection productId={id} />
        </div>
    );
}

function ReviewsSection({ productId }: { productId: string }) {
    const [reviews, setReviews] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchReviews = async () => {
            const q = query(collection(db, 'reviews'), where('menuItemId', '==', productId), limit(10));
            try {
                const snapshot = await getDocs(q);
                const reviewList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setReviews(reviewList);
            } catch (err) {
                console.error("Failed to load reviews", err);
            } finally {
                setLoading(false);
            }
        };
        fetchReviews();
    }, [productId]);

    if (loading) return <div className="p-8 text-center"><div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto" /></div>;

    if (reviews.length === 0) return null;

    return (
        <section className="max-w-7xl mx-auto px-4 mt-20 mb-10">
            <h3 className="text-2xl font-bold mb-8 flex items-center gap-2">
                Ratings & Reviews <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {reviews.map((review: any) => (
                    <div key={review.id} className="bg-gray-900/30 backdrop-blur-sm border border-white/5 p-6 rounded-2xl flex flex-col gap-4 hover:bg-gray-900/50 transition-colors">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center font-bold text-sm border border-white/10 uppercase">
                                    {review.customerName?.[0] || 'U'}
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm text-gray-200">{review.customerName}</h4>
                                    <div className="flex items-center gap-1">
                                        {[1, 2, 3, 4, 5].map(s => (
                                            <Star key={s} className={`w-3 h-3 ${review.rating >= s ? 'fill-yellow-500 text-yellow-500' : 'text-gray-700'}`} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <span className="text-xs text-gray-500">{review.createdAt?.seconds ? new Date(review.createdAt.seconds * 1000).toLocaleDateString() : 'Just now'}</span>
                        </div>
                        {review.comment && (
                            <p className="text-gray-400 text-sm leading-relaxed bg-black/20 p-3 rounded-lg border border-white/5">
                                "{review.comment}"
                            </p>
                        )}
                    </div>
                ))}
            </div>
        </section>
    )
}

function SparklesIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
        </svg>
    )
}
