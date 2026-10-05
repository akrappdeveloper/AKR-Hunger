'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import {
  Search,
  Mic,
  X,
  Clock,
  Flame,
  ArrowUpRight,
  Sparkles,
  Utensils,
  Store,
  Star,
  ChevronRight,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import SafeImage from '@/components/ui/safe-image';
import VoiceSearchDialog from './VoiceSearchDialog';
import {
  recordSearchQuery,
  getLiveSuggestions,
  getSearchHistory,
  SearchSuggestion,
  SearchHistoryItem,
} from '@/lib/search-service';

interface CustomerSearchBarProps {
  placeholder?: string;
  className?: string;
  initialValue?: string;
  size?: 'sm' | 'md' | 'lg';
  onSearch?: (query: string) => void;
  showRecentHistory?: boolean;
}

const TRENDING_TAGS = [
  'Dum Biryani',
  'Woodfired Pizza',
  'Truffle Burger',
  'Butter Chicken',
  'Cold Brew',
  'Hakka Noodles',
  'Waffles',
];

export default function CustomerSearchBar({
  placeholder = 'Search dishes, restaurants, cuisines...',
  className = '',
  initialValue = '',
  size = 'md',
  onSearch,
  showRecentHistory = true,
}: CustomerSearchBarProps) {
  const router = useRouter();
  const { user } = useAuth();

  const [queryText, setQueryText] = React.useState(initialValue);
  const [isOpen, setIsOpen] = React.useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<SearchSuggestion[]>([]);
  const [recentSearches, setRecentSearches] = React.useState<SearchHistoryItem[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = React.useState(false);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const debounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Sync initial value if changed from outside
  React.useEffect(() => {
    if (initialValue !== undefined) {
      setQueryText(initialValue);
    }
  }, [initialValue]);

  // Load recent searches on mount / when focused
  const loadRecent = React.useCallback(async () => {
    try {
      const items = await getSearchHistory(user?.uid);
      setRecentSearches(items.slice(0, 5));
    } catch (_) {}
  }, [user]);

  React.useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  // Handle outside click to close suggestions
  React.useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Fetch suggestions when query changes
  React.useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    const trimmed = queryText.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }

    setLoadingSuggestions(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const results = await getLiveSuggestions(trimmed);
        setSuggestions(results);
      } catch (err) {
        console.warn('Failed to load suggestions:', err);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 250);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [queryText]);

  const executeSearch = async (term: string) => {
    const cleanTerm = term.trim();
    if (!cleanTerm) return;

    setIsOpen(false);
    // Record to Firebase & local storage
    recordSearchQuery(cleanTerm, user?.uid);

    if (onSearch) {
      onSearch(cleanTerm);
    } else {
      router.push(`/customer/search?q=${encodeURIComponent(cleanTerm)}`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(queryText);
  };

  const handleVoiceTranscript = (transcriptText: string) => {
    setQueryText(transcriptText);
    executeSearch(transcriptText);
  };

  const handleClear = () => {
    setQueryText('');
    setSuggestions([]);
  };

  const sizeClasses = {
    sm: 'h-10 text-xs pl-10 pr-20 rounded-xl',
    md: 'h-11 md:h-12 text-sm pl-11 pr-24 rounded-2xl',
    lg: 'h-14 sm:h-16 text-base sm:text-lg pl-12 sm:pl-14 pr-28 rounded-2xl',
  }[size];

  const dishSuggestions = suggestions.filter((s) => s.type === 'dish');
  const restaurantSuggestions = suggestions.filter((s) => s.type === 'restaurant');

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <form onSubmit={handleSubmit} className="relative w-full group">
        {/* Left Search Icon */}
        <Search
          className={`absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors pointer-events-none ${
            size === 'lg' ? 'w-5 h-5 sm:w-6 sm:h-6' : 'w-4 h-4'
          }`}
        />

        {/* Search Input */}
        <Input
          type="text"
          value={queryText}
          onChange={(e) => {
            setQueryText(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            loadRecent();
          }}
          placeholder={placeholder}
          className={`${sizeClasses} bg-muted/60 border border-border/70 text-foreground placeholder:text-muted-foreground/80 focus:bg-background focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all duration-200 font-medium shadow-sm`}
        />

        {/* Right Action Icons (Clear + Voice Mic) */}
        <div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {queryText && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          )}

          {/* Voice Search Button */}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => setIsVoiceOpen(true)}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full text-primary hover:text-primary hover:bg-primary/10 transition-all hover:scale-105"
            title="Search with your voice"
          >
            <Mic className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </Button>
        </div>
      </form>

      {/* Voice Search Modal Dialog */}
      <VoiceSearchDialog
        open={isVoiceOpen}
        onOpenChange={setIsVoiceOpen}
        onTranscript={handleVoiceTranscript}
      />

      {/* Live Suggestions Dropdown Popover */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-card/95 backdrop-blur-2xl border border-border/80 shadow-2xl rounded-2xl overflow-hidden max-h-[460px] overflow-y-auto animate-in fade-in-50 zoom-in-95 duration-200">
          {/* Case 1: When user has typed >= 2 characters */}
          {queryText.trim().length >= 2 ? (
            <div className="p-2 sm:p-3 space-y-3">
              {/* Direct Query Option */}
              <div
                onClick={() => executeSearch(queryText)}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-primary/10 cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Search className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground group-hover:text-primary">
                      Search for &ldquo;{queryText.trim()}&rdquo;
                    </p>
                    <p className="text-[11px] text-muted-foreground">Press enter or tap to view all results</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
              </div>

              {/* Loading Indicator */}
              {loadingSuggestions && (
                <div className="p-3 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <div className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  Searching menu & restaurants...
                </div>
              )}

              {/* Dish Matches */}
              {dishSuggestions.length > 0 && (
                <div>
                  <p className="px-2 pb-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Utensils className="w-3.5 h-3.5 text-primary" /> Dishes ({dishSuggestions.length})
                  </p>
                  <div className="space-y-1">
                    {dishSuggestions.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => executeSearch(item.title)}
                        className="flex items-center justify-between p-2 rounded-xl hover:bg-muted/70 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {item.imageUrl ? (
                            <SafeImage
                              src={item.imageUrl}
                              alt={item.title}
                              width={36}
                              height={36}
                              className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-xs flex-shrink-0">
                              🍲
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{item.subtitle}</p>
                          </div>
                        </div>
                        {item.price !== undefined && (
                          <span className="text-xs font-bold text-primary pl-2">₹{item.price}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Restaurant Matches */}
              {restaurantSuggestions.length > 0 && (
                <div className="pt-2 border-t border-border/50">
                  <p className="px-2 pb-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-orange-500" /> Restaurants ({restaurantSuggestions.length})
                  </p>
                  <div className="space-y-1">
                    {restaurantSuggestions.map((rest) => (
                      <Link
                        key={rest.id}
                        href={rest.link}
                        onClick={() => setIsOpen(false)}
                        className="flex items-center justify-between p-2 rounded-xl hover:bg-muted/70 cursor-pointer transition-colors block"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {rest.imageUrl ? (
                            <SafeImage
                              src={rest.imageUrl}
                              alt={rest.title}
                              width={36}
                              height={36}
                              className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-xs flex-shrink-0">
                              🏪
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{rest.title}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{rest.subtitle}</p>
                          </div>
                        </div>
                        {rest.rating && (
                          <Badge variant="secondary" className="text-[10px] gap-1 px-1.5 py-0.5">
                            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                            {rest.rating.toFixed(1)}
                          </Badge>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* No matches state */}
              {!loadingSuggestions && dishSuggestions.length === 0 && restaurantSuggestions.length === 0 && (
                <div className="p-4 text-center">
                  <p className="text-sm font-medium text-muted-foreground">
                    No instant suggestions for &ldquo;{queryText}&rdquo;
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => executeSearch(queryText)}
                    className="text-xs text-primary font-bold mt-1"
                  >
                    Search anyway &rarr;
                  </Button>
                </div>
              )}
            </div>
          ) : (
            /* Case 2: When input is focused but empty or 1 character */
            <div className="p-3 sm:p-4 space-y-4">
              {/* Recent Searches */}
              {showRecentHistory && recentSearches.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2 px-1">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Recent Searches
                    </p>
                    <Link
                      href="/customer/search/history"
                      onClick={() => setIsOpen(false)}
                      className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5"
                    >
                      View All <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {recentSearches.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => executeSearch(item.query)}
                        className="text-xs px-3 py-1.5 rounded-xl bg-muted/70 hover:bg-primary/10 hover:text-primary border border-border/50 text-foreground transition-colors flex items-center gap-1.5 font-medium"
                      >
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span>{item.query}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Trending Dishes */}
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-orange-500" /> Trending Dishes
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {TRENDING_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => executeSearch(tag)}
                      className="text-xs px-3 py-1.5 rounded-xl bg-muted/50 hover:bg-primary/10 hover:text-primary border border-border/50 text-foreground transition-colors font-medium flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      <span>{tag}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
