'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MenuItem } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Search,
    Clock,
    Star,
    X,
    Flame,
    TrendingUp,
    Sparkles,
    Trash2,
    ArrowUpRight,
    ShoppingBag
} from 'lucide-react';
import Link from 'next/link';
import SafeImage from '@/components/ui/safe-image';

const TRENDING_TAGS = [
    'Dum Biryani',
    'Woodfired Pizza',
    'Truffle Burger',
    'Butter Chicken',
    'Cold Brew',
    'Crispy Dimsum',
    'Hakka Noodles',
    'Sizzling Brownie'
];

const POPULAR_CUISINES = [
    { name: 'Pizza', img: '🍕', bg: 'bg-orange-500/10 border-orange-500/25 text-orange-600 dark:text-orange-400' },
    { name: 'Burger', img: '🍔', bg: 'bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-400' },
    { name: 'Biryani', img: '🍲', bg: 'bg-red-500/10 border-red-500/25 text-red-600 dark:text-red-400' },
    { name: 'Chinese', img: '🍜', bg: 'bg-blue-500/10 border-blue-500/25 text-blue-600 dark:text-blue-400' },
    { name: 'Dessert', img: '🍰', bg: 'bg-pink-500/10 border-pink-500/25 text-pink-600 dark:text-pink-400' },
    { name: 'Healthy', img: '🥗', bg: 'bg-green-500/10 border-green-500/25 text-green-600 dark:text-green-400' },
    { name: 'Drinks', img: '🥤', bg: 'bg-purple-500/10 border-purple-500/25 text-purple-600 dark:text-purple-400' },
    { name: 'Rolls', img: '🌯', bg: 'bg-cyan-500/10 border-cyan-500/25 text-cyan-600 dark:text-cyan-400' },
    { name: 'Kebabs', img: '🍢', bg: 'bg-amber-600/10 border-amber-600/25 text-amber-600 dark:text-amber-400' },
    { name: 'South Indian', img: '🥞', bg: 'bg-indigo-500/10 border-indigo-500/25 text-indigo-600 dark:text-indigo-400' },
    { name: 'Chai & Cafe', img: '☕', bg: 'bg-amber-700/10 border-amber-700/25 text-amber-700 dark:text-amber-300' },
    { name: 'Bakery', img: '🥐', bg: 'bg-yellow-600/10 border-yellow-600/25 text-yellow-600 dark:text-yellow-400' },
];

export default function SearchPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialQuery = searchParams.get('q') || '';

    const [searchQuery, setSearchQuery] = useState(initialQuery);
    const [results, setResults] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState<'all' | 'veg' | 'non-veg' | 'top-rated'>('all');

    useEffect(() => {
        const saved = localStorage.getItem('recentSearches');
        if (saved) {
            try {
                setRecentSearches(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to parse recent searches', e);
            }
        }
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

            const lowerTerm = term.toLowerCase();
            const filtered = allItems.filter(item =>
                item.name?.toLowerCase().includes(lowerTerm) ||
                item.description?.toLowerCase().includes(lowerTerm) ||
                item.category?.toLowerCase().includes(lowerTerm) ||
                item.tags?.some(tag => tag.toLowerCase().includes(lowerTerm))
            );

            setResults(filtered);

            // Save to local storage history
            const cleanTerm = term.trim();
            const updatedRecent = [cleanTerm, ...recentSearches.filter(t => t.toLowerCase() !== cleanTerm.toLowerCase())].slice(0, 8);
            setRecentSearches(updatedRecent);
            localStorage.setItem('recentSearches', JSON.stringify(updatedRecent));
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

    const handleSelectTag = (term: string) => {
        setSearchQuery(term);
        performSearch(term);
        router.replace(`/customer/search?q=${encodeURIComponent(term)}`);
    };

    const removeRecentItem = (termToRemove: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const updated = recentSearches.filter(t => t !== termToRemove);
        setRecentSearches(updated);
        localStorage.setItem('recentSearches', JSON.stringify(updated));
    };

    const clearRecent = () => {
        setRecentSearches([]);
        localStorage.removeItem('recentSearches');
    };

    const filteredResults = results.filter(item => {
        if (activeTab === 'veg') return item.vegetarian;
        if (activeTab === 'non-veg') return !item.vegetarian;
        if (activeTab === 'top-rated') return (item.averageRating || 0) >= 4.0;
        return true;
    });

    return (
        <div className="min-h-screen bg-background text-foreground pb-40 sm:pb-24 font-sans selection:bg-primary/20">
            <div className="max-w-5xl mx-auto px-3 sm:px-4 py-6 sm:py-8 relative z-10">

                {/* Search Bar */}
                <form onSubmit={handleSearchSubmit} className="relative mb-6 sm:mb-8 group">
                    <div className="relative">
                        <Search className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5 group-focus-within:text-primary transition-colors" />
                        <Input
                            placeholder="Search dishes, restaurants, cuisines or snacks..."
                            className="pl-12 sm:pl-14 pr-12 h-14 sm:h-16 text-base sm:text-lg rounded-2xl bg-card border border-border/80 text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:ring-4 focus:ring-primary/15 shadow-sm transition-all font-medium"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            autoFocus
                        />
                        {searchQuery && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                    setSearchQuery('');
                                    setResults([]);
                                    router.replace('/customer/search');
                                }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground rounded-full w-9 h-9"
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        )}
                    </div>
                </form>

                {/* Results State */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-32 bg-muted/50 rounded-2xl animate-pulse border border-border/60" />
                        ))}
                    </div>
                ) : searchQuery.trim().length > 0 && results.length > 0 ? (
                    <div className="space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h2 className="text-base sm:text-lg font-black text-foreground flex items-center gap-2">
                                Results for "<span className="text-primary">{searchQuery}</span>"
                                <Badge variant="secondary" className="text-xs font-bold px-2.5 py-0.5 rounded-full">
                                    {filteredResults.length} items
                                </Badge>
                            </h2>

                            {/* Filter Tabs */}
                            <div className="flex bg-muted/60 p-1 rounded-xl border border-border/60">
                                {([
                                    { id: 'all', label: 'All' },
                                    { id: 'veg', label: 'Pure Veg' },
                                    { id: 'non-veg', label: 'Non-Veg' },
                                    { id: 'top-rated', label: '★ 4.0+' },
                                ] as const).map((tab) => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all ${
                                            activeTab === tab.id
                                                ? 'bg-card text-foreground shadow-sm'
                                                : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Result Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredResults.map(item => (
                                <Link key={item.id} href={`/customer/product/${item.id}`} className="group block">
                                    <div className="flex p-3 sm:p-4 rounded-2xl bg-card border border-border/80 hover:border-primary/50 hover:shadow-lg transition-all duration-300 relative overflow-hidden">
                                        {/* Image */}
                                        <div className="w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0 rounded-xl overflow-hidden relative bg-muted">
                                            <SafeImage
                                                src={item.image}
                                                alt={item.name}
                                                className="object-cover group-hover:scale-105 transition-transform duration-500"
                                                fill
                                            />
                                        </div>

                                        {/* Content */}
                                        <div className="ml-3 sm:ml-4 flex-1 flex flex-col justify-between py-0.5 min-w-0">
                                            <div>
                                                <div className="flex justify-between items-start gap-2">
                                                    <h3 className="font-bold text-base sm:text-lg text-foreground group-hover:text-primary transition-colors truncate">
                                                        {item.name}
                                                    </h3>
                                                    <span className="font-black text-primary bg-primary/10 px-2 py-0.5 rounded-md text-sm shrink-0">
                                                        ₹{item.price}
                                                    </span>
                                                </div>
                                                <p className="text-xs font-semibold text-primary/80 truncate mt-0.5">{item.category}</p>
                                                <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{item.description}</p>
                                            </div>

                                            <div className="flex items-center gap-3 mt-2">
                                                {item.averageRating && (
                                                    <div className="flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                                                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                                                        <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{item.averageRating.toFixed(1)}</span>
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                                                    <Clock className="w-3 h-3 text-primary" />
                                                    <span>{item.preparationTime || 25} mins</span>
                                                </div>
                                                <div className={`w-2.5 h-2.5 rounded-full ml-auto ${item.vegetarian ? 'bg-green-500 ring-2 ring-green-500/20 shadow-sm' : 'bg-red-500 ring-2 ring-red-500/20 shadow-sm'}`} />
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                ) : searchQuery.trim().length > 0 && results.length === 0 && !loading ? (
                    <div className="text-center py-16 sm:py-20 bg-card rounded-3xl border border-dashed border-border p-6 space-y-4">
                        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto border border-border/80 text-muted-foreground">
                            <Search className="w-8 h-8" />
                        </div>
                        <div>
                            <h3 className="text-lg sm:text-xl font-bold text-foreground mb-1">No culinary match found</h3>
                            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                                We couldn't find anything matching "{searchQuery}". Try exploring our trending searches or top categories below.
                            </p>
                        </div>
                        <div className="flex flex-wrap justify-center gap-2 pt-2">
                            {TRENDING_TAGS.slice(0, 4).map(tag => (
                                <button
                                    key={tag}
                                    type="button"
                                    onClick={() => handleSelectTag(tag)}
                                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                                >
                                    Try "{tag}"
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    /* Suggestions & Exploration State */
                    <div className="space-y-8">
                        {/* Recent Searches (Local Storage) */}
                        {recentSearches.length > 0 && (
                            <div className="space-y-3">
                                <div className="flex justify-between items-center px-1">
                                    <h3 className="font-bold text-base sm:text-lg text-foreground flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-primary" />
                                        Recent Searches
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={clearRecent}
                                        className="text-xs text-destructive hover:underline font-bold uppercase tracking-wider flex items-center gap-1"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                        Clear All
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {recentSearches.map((term, i) => (
                                        <div
                                            key={i}
                                            onClick={() => handleSelectTag(term)}
                                            className="inline-flex items-center gap-2 pl-3.5 pr-2 py-1.5 bg-card border border-border/80 rounded-xl text-xs sm:text-sm font-semibold text-foreground hover:bg-muted hover:border-primary/40 transition-all group shadow-sm cursor-pointer"
                                        >
                                            <Clock className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                                            <span>{term}</span>
                                            <button
                                                type="button"
                                                onClick={(e) => removeRecentItem(term, e)}
                                                className="p-1 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                                title="Remove search"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Trending Searches */}
                        <div className="space-y-3">
                            <h3 className="font-bold text-base sm:text-lg text-foreground flex items-center gap-2 px-1">
                                <TrendingUp className="w-5 h-5 text-primary" />
                                Trending Searches
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {TRENDING_TAGS.map((tag) => (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={() => handleSelectTag(tag)}
                                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-card border border-border/80 hover:border-primary/50 text-xs sm:text-sm font-bold text-foreground hover:text-primary hover:bg-primary/5 transition-all shadow-sm group cursor-pointer"
                                    >
                                        <Sparkles className="w-3.5 h-3.5 text-amber-500 group-hover:rotate-12 transition-transform" />
                                        {tag}
                                        <ArrowUpRight className="w-3 h-3 text-muted-foreground opacity-60 group-hover:opacity-100 group-hover:text-primary transition-all" />
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Popular Cuisines Grid */}
                        <div className="space-y-3">
                            <h3 className="font-bold text-base sm:text-lg text-foreground flex items-center gap-2 px-1">
                                <Flame className="w-5 h-5 text-primary" />
                                Popular Cuisines
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                                {POPULAR_CUISINES.map((cat) => (
                                    <div
                                        key={cat.name}
                                        onClick={() => handleSelectTag(cat.name)}
                                        className={`group relative p-4 rounded-2xl border cursor-pointer overflow-hidden backdrop-blur-sm transition-all duration-300 hover:scale-[1.03] shadow-sm flex flex-col items-center gap-2 text-center ${cat.bg}`}
                                    >
                                        <span className="text-3xl sm:text-4xl group-hover:scale-110 transition-transform duration-300">
                                            {cat.img}
                                        </span>
                                        <span className="font-bold text-xs sm:text-sm text-foreground group-hover:text-primary transition-colors">
                                            {cat.name}
                                        </span>
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
