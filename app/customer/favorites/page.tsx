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

export default function FavoritesPage() {
    const { user, customer } = useAuth();
    const [favorites, setFavorites] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchFavorites = async () => {
            if (!user || !customer?.favorites) {
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const favIds = customer.favorites;
                const favItems: MenuItem[] = [];

                // Fetch each favorite item (could be optimized with 'in' query if list is small, 
                // but id fetching is clean for now)
                for (const id of favIds) {
                    const docRef = doc(db, 'menuItems', id);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        favItems.push({ ...docSnap.data(), id: docSnap.id } as MenuItem);
                    }
                }
                setFavorites(favItems);
            } catch (error) {
                console.error("Error fetching favorites:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchFavorites();
    }, [user, customer]);

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white pb-24 font-sans selection:bg-orange-500/30">
            <div className="max-w-7xl mx-auto px-4 py-8">

                {/* Header */}
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                        <Heart className="w-5 h-5 text-red-500" />
                    </div>
                    <h1 className="text-3xl font-bold">My Favorites</h1>
                </div>

                {favorites.length === 0 ? (
                    <div className="text-center py-20 bg-gray-900/50 backdrop-blur-md rounded-3xl border border-white/5">
                        <div className="w-20 h-20 bg-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Heart className="w-10 h-10 text-gray-600" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">No favorites yet</h3>
                        <p className="text-gray-400 mb-8 max-w-sm mx-auto">Save items you love to find them easily later.</p>
                        <Link href="/customer">
                            <Button className="bg-gradient-to-r from-orange-600 to-red-600 rounded-xl px-8 py-6 font-bold text-lg hover:scale-105 transition-transform shadow-lg shadow-orange-900/40">
                                Find Food
                            </Button>
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {favorites.map((item) => (
                            <Link key={item.id} href={`/customer/product/${item.id}`} className="group block">
                                <div className="flex p-4 rounded-3xl bg-gray-900/40 border border-white/5 hover:bg-gray-900/80 hover:border-orange-500/30 transition-all duration-300 relative overflow-hidden backdrop-blur-md">

                                    {/* Image */}
                                    <div className="w-32 h-32 flex-shrink-0 rounded-2xl overflow-hidden relative">
                                        <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                        <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                                        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg text-xs font-bold text-white flex items-center gap-1">
                                            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" /> {item.averageRating || 'New'}
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="ml-5 flex-1 flex flex-col justify-between py-1">
                                        <div>
                                            <div className="flex justify-between items-start">
                                                <h3 className="font-bold text-lg text-white group-hover:text-orange-400 transition-colors line-clamp-1">{item.name}</h3>
                                            </div>
                                            <p className="text-sm text-gray-400 line-clamp-2 mt-1 font-medium">{item.description}</p>
                                        </div>

                                        <div className="flex items-center justify-between mt-3">
                                            <span className="font-bold text-xl text-orange-500">₹{item.price}</span>
                                            <Button size="icon" className="w-8 h-8 rounded-full bg-white text-black hover:bg-gray-200">
                                                <ArrowRight className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
