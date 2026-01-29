'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MenuItem } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, TrendingUp, Clock, Star, X, Filter, Flame, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function SearchPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialQuery = searchParams.get('q') || '';

    const [searchQuery, setSearchQuery] = useState(initialQuery);
    const [results, setResults] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState<'all' | 'veg' | 'non-veg'>('all');

    useEffect(() => {
        const saved = localStorage.getItem('recentSearches');
        if (saved) setRecentSearches(JSON.parse(saved));
        if (initialQuery) performSearch(initialQuery);
    }, [initialQuery]);

    const performSearch = async (term: string) => {
        if (!term.trim()) return;

        setLoading(true);
        try {
            const menuRef = collection(db, 'menuItems');
            const q = query(menuRef);
            const snapshot = await getDocs(q);
            const allItems = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as MenuItem));

            const filtered = allItems.filter(item =>
                item.name.toLowerCase().includes(term.toLowerCase()) ||
                item.description?.toLowerCase().includes(term.toLowerCase()) ||
                item.category.toLowerCase().includes(term.toLowerCase()) ||
                item.tags?.some(tag => tag.toLowerCase().includes(term.toLowerCase()))
            );

            setResults(filtered);

            if (!recentSearches.includes(term)) {
                const newRecent = [term, ...recentSearches].slice(0, 5);
                setRecentSearches(newRecent);
                localStorage.setItem('recentSearches', JSON.stringify(newRecent));
            }
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        performSearch(searchQuery);
        router.replace(`/customer/search?q=${encodeURIComponent(searchQuery)}`);
    };

    const clearRecent = () => {
        setRecentSearches([]);
        localStorage.removeItem('recentSearches');
    };

    const filteredResults = results.filter(item => {
        if (activeTab === 'veg') return item.vegetarian;
        if (activeTab === 'non-veg') return !item.vegetarian;
        return true;
    });

    return (
        <div className="min-h-screen bg-black text-white pb-24 font-sans selection:bg-orange-500/30">
            {/* Background Gradients */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-gradient-to-b from-blue-900/10 to-transparent blur-[80px]" />
            </div>

            <div className="max-w-4xl mx-auto px-4 py-8 relative z-10">

                {/* Search Bar */}
                <form onSubmit={handleSearchSubmit} className="relative mb-8 group">
                    <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl opacity-20 group-hover:opacity-30 blur-xl transition-opacity" />
                    <div className="relative">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 group-focus-within:text-orange-500 transition-colors" />
                        <Input
                            placeholder="Search dishes, restaurants, or cuisines..."
                            className="pl-14 pr-4 h-16 text-lg rounded-2xl bg-black border border-gray-800 text-white placeholder:text-gray-600 focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/10 shadow-2xl transition-all"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            autoFocus
                        />
                        {searchQuery && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </Button>
                        )}
                    </div>
                </form>

                {/* Results State */}
                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-32 bg-gray-900/50 rounded-3xl animate-pulse border border-white/5" />
                        ))}
                    </div>
                ) : paramsHasQuery(searchQuery) && results.length > 0 ? (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                Finding results for "<span className="text-orange-500">{searchQuery}</span>"
                            </h2>

                            {/* Filter Tabs */}
                            <div className="flex bg-gray-900/80 p-1 rounded-xl border border-white/5">
                                {['all', 'veg', 'non-veg'].map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab as any)}
                                        className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === tab
                                                ? 'bg-gray-800 text-white shadow-lg'
                                                : 'text-gray-500 hover:text-gray-300'
                                            }`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid gap-4">
                            {filteredResults.map(item => (
                                <Link key={item.id} href={`/customer/product/${item.id}`} className="group block">
                                    <div className="flex p-4 rounded-3xl bg-gray-900/40 border border-white/5 hover:bg-gray-900/80 hover:border-orange-500/30 transition-all duration-300 relative overflow-hidden backdrop-blur-md">

                                        {/* Image */}
                                        <div className="w-28 h-28 flex-shrink-0 rounded-2xl overflow-hidden relative">
                                            <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                            <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                                        </div>

                                        {/* Content */}
                                        <div className="ml-5 flex-1 flex flex-col justify-between py-1">
                                            <div>
                                                <div className="flex justify-between items-start">
                                                    <h3 className="font-bold text-lg text-white group-hover:text-orange-400 transition-colors line-clamp-1">{item.name}</h3>
                                                    <span className="font-bold text-orange-500 bg-orange-500/10 px-2 py-1 rounded-lg text-sm">₹{item.price}</span>
                                                </div>
                                                <p className="text-sm text-gray-400 line-clamp-1 mt-1 font-medium">{item.category}</p>
                                                <p className="text-xs text-gray-500 line-clamp-1 mt-1">{item.description}</p>
                                            </div>

                                            <div className="flex items-center gap-4 mt-2">
                                                {item.averageRating && (
                                                    <div className="flex items-center gap-1 bg-yellow-500/10 px-2 py-1 rounded-lg border border-yellow-500/20">
                                                        <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                                                        <span className="text-xs font-bold text-yellow-500">{item.averageRating.toFixed(1)}</span>
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-1 text-xs text-gray-400 font-medium">
                                                    <Clock className="w-3 h-3" />
                                                    <span>{item.preparationTime || 25} mins</span>
                                                </div>
                                                <div className={`w-2 h-2 rounded-full ${item.vegetarian ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`} />
                                            </div>
                                        </div>

                                        {/* Arrow Hint */}
                                        <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0">
                                            <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center">
                                                <ArrowRight className="w-4 h-4" />
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                ) : paramsHasQuery(searchQuery) && results.length === 0 && !loading ? (
                    <div className="text-center py-20">
                        <div className="w-24 h-24 bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-6 border border-dashed border-gray-800">
                            <Search className="w-10 h-10 text-gray-600" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">No results found</h3>
                        <p className="text-gray-500">We couldn't find anything matching "{searchQuery}".<br />Try searching for something else.</p>
                    </div>
                ) : (
                    /* Suggestions State */
                    <div className="space-y-10">

                        {/* Recent Searches */}
                        {recentSearches.length > 0 && (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center px-1">
                                    <h3 className="font-bold text-lg text-gray-200">Recent Searches</h3>
                                    <button onClick={clearRecent} className="text-xs text-red-400 hover:text-red-300 font-bold uppercase tracking-wider">
                                        Clear All
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {recentSearches.map((term, i) => (
                                        <button
                                            key={i}
                                            onClick={() => { setSearchQuery(term); performSearch(term); }}
                                            className="flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-800 rounded-xl text-sm font-medium text-gray-300 hover:bg-gray-800 hover:border-gray-700 hover:text-white transition-all group"
                                        >
                                            <Clock className="w-3.5 h-3.5 text-gray-500 group-hover:text-orange-500 transition-colors" />
                                            {term}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Popular Cuisines Grid */}
                        <div className="space-y-4">
                            <h3 className="font-bold text-lg text-gray-200 flex items-center gap-2 px-1">
                                <Flame className="w-5 h-5 text-orange-500" /> Popular Cuisines
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                    { name: 'Pizza', img: '🍕', color: 'from-orange-500/20 to-red-500/20' },
                                    { name: 'Burger', img: '🍔', color: 'from-yellow-500/20 to-orange-500/20' },
                                    { name: 'Biryani', img: '🥘', color: 'from-red-500/20 to-pink-500/20' },
                                    { name: 'Chinese', img: '🥢', color: 'from-blue-500/20 to-indigo-500/20' },
                                    { name: 'Dessert', img: '🍩', color: 'from-pink-500/20 to-purple-500/20' },
                                    { name: 'Healthy', img: '🥗', color: 'from-green-500/20 to-emerald-500/20' },
                                    { name: 'Drinks', img: '🥤', color: 'from-purple-500/20 to-blue-500/20' },
                                    { name: 'Rolls', img: '🌯', color: 'from-indigo-500/20 to-cyan-500/20' },
                                ].map((cat) => (
                                    <div
                                        key={cat.name}
                                        onClick={() => { setSearchQuery(cat.name); performSearch(cat.name); }}
                                        className={`group relative p-4 rounded-2xl border border-white/5 cursor-pointer overflow-hidden backdrop-blur-sm bg-gradient-to-br ${cat.color} hover:border-white/20 transition-all`}
                                    >
                                        <div className="relative z-10 flex flex-col items-center gap-2">
                                            <span className="text-3xl group-hover:scale-110 transition-transform duration-300">{cat.img}</span>
                                            <span className="font-bold text-white group-hover:text-orange-400 transition-colors">{cat.name}</span>
                                        </div>
                                        <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function paramsHasQuery(q: string) {
    return q && q.length > 0;
}
