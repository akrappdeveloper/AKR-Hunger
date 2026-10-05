'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MenuItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Heart, ShoppingCart, ArrowRight, Star } from 'lucide-react';
import Link from 'next/link';
import SafeImage from '@/components/ui/safe-image';

export default function FavoritesPage() {
    const { user, customer } = useAuth();
    const [favorites, setFavorites] = useState<MenuItem[]>([]);
    const [favoriteRestaurants, setFavoriteRestaurants] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!user || (!customer?.favorites && !customer?.favoriteRestaurants)) {
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                // Fetch Favorite Items
                const itemPromises = (customer.favorites || []).map(id => getDoc(doc(db, 'menuItems', id)));
                const itemSnaps = await Promise.all(itemPromises);
                const favItems = itemSnaps.filter(s => s.exists()).map(s => ({ ...s.data(), id: s.id } as MenuItem));
                setFavorites(favItems);

                // Fetch Favorite Restaurants
                const restPromises = (customer.favoriteRestaurants || []).map(id => getDoc(doc(db, 'restaurants', id)));
                const restSnaps = await Promise.all(restPromises);
                const favRests = restSnaps.filter(s => s.exists()).map(s => ({ ...s.data(), id: s.id }));
                setFavoriteRestaurants(favRests);

            } catch (error) {
                console.error("Error fetching favorites:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user, customer]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen text-foreground pb-24 md:pb-16 font-sans selection:bg-primary/20">
            <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

                {/* Header */}
                <div className="flex items-center gap-3 mb-6 sm:mb-8">
                    <div className="w-11 h-11 rounded-2xl bg-rose-500/15 flex items-center justify-center text-rose-500 shadow-xs">
                        <Heart className="w-5 h-5 fill-current" />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">My Favorites</h1>
                        <p className="text-xs sm:text-sm text-muted-foreground">Your saved dishes and favorite restaurants</p>
                    </div>
                </div>

                {favorites.length === 0 && favoriteRestaurants.length === 0 ? (
                    <div className="text-center py-20 bg-card border border-border/60 rounded-3xl shadow-sm">
                        <div className="w-20 h-20 bg-muted/60 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Heart className="w-10 h-10 text-muted-foreground" />
                        </div>
                        <h3 className="text-xl font-bold mb-2 text-foreground">No favorites yet</h3>
                        <p className="text-muted-foreground mb-8 max-w-sm mx-auto text-sm">Save items and restaurants you love to find and reorder them quickly.</p>
                        <Link href="/customer">
                            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-8 py-6 font-bold text-base shadow-lg shadow-primary/20 hover:scale-105 transition-all">
                                Explore Food
                            </Button>
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-10 sm:space-y-12">
                        {/* Favorite Items Section */}
                        {favorites.length > 0 && (
                            <div>
                                <h2 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 text-foreground">Favorite Dishes</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                                    {favorites.map((item) => (
                                        <Link key={item.id} href={`/customer/product/${item.id}`} className="group block">
                                            <div className="flex p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl bg-card border border-border/60 hover:border-primary/40 hover:shadow-md transition-all duration-300 relative overflow-hidden">
                                                <div className="w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0 rounded-xl sm:rounded-2xl overflow-hidden relative bg-muted">
                                                    <SafeImage
                                                        src={item.image}
                                                        alt={item.name}
                                                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                                                        fill
                                                    />
                                                    <div className="absolute top-2 left-2 bg-card/85 backdrop-blur-md px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-bold text-foreground flex items-center gap-1 border border-border/50">
                                                        <Star className="w-3 h-3 text-amber-500 fill-amber-500" /> {item.averageRating?.toFixed(1) || '4.5'}
                                                    </div>
                                                </div>
                                                <div className="ml-3 sm:ml-4 flex-1 flex flex-col justify-between py-0.5">
                                                    <div>
                                                        <h3 className="font-bold text-base sm:text-lg text-foreground group-hover:text-primary transition-colors line-clamp-1">{item.name}</h3>
                                                        <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 mt-1">{item.description}</p>
                                                    </div>
                                                    <div className="flex items-center justify-between mt-3">
                                                        <span className="font-black text-lg sm:text-xl text-primary">₹{item.price}</span>
                                                        <Button size="icon" className="w-8 h-8 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs">
                                                            <ArrowRight className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Favorite Restaurants Section */}
                        {favoriteRestaurants.length > 0 && (
                            <div>
                                <h2 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 text-foreground">Favorite Restaurants</h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                                    {favoriteRestaurants.map((restaurant) => (
                                        <Link key={restaurant.id} href={`/customer/restaurant/${restaurant.id}`} className="group block">
                                            <div className="rounded-2xl sm:rounded-3xl bg-card border border-border/60 hover:border-primary/40 hover:shadow-md transition-all duration-300 overflow-hidden">
                                                <div className="h-40 sm:h-44 relative bg-muted">
                                                    <SafeImage
                                                        src={restaurant.image}
                                                        alt={restaurant.name}
                                                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                                                        fill
                                                    />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                                                    <div className="absolute bottom-3.5 left-4 right-4">
                                                        <h3 className="font-bold text-lg sm:text-xl text-white mb-0.5 group-hover:text-amber-400 transition-colors drop-shadow-sm">{restaurant.name}</h3>
                                                        <p className="text-xs sm:text-sm text-gray-200 line-clamp-1 drop-shadow-xs">{restaurant.cuisineType?.join(', ') || 'Multi-cuisine'}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
