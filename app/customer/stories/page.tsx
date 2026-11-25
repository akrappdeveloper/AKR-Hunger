'use client';

import { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Video,
  Play,
  TrendingUp,
  Store,
  ArrowLeft,
  UtensilsCrossed,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  X,
  Sparkles,
  ShoppingBag,
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

type ConcreteRatio = '9:16' | '16:9' | '1:1';
type SourceFilter = 'all' | 'menu' | 'stories';

interface StoryItem {
  id: string;
  restaurantId: string;
  restaurantName?: string;
  restaurantImage?: string;
  menuItemId?: string;
  price?: number;
  title: string;
  description?: string;
  videoUrl?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  type: string;
  views: number;
  likes: number;
  aspectRatio?: ConcreteRatio;
  createdAt?: any;
}

function toSeconds(val: any): number {
  if (!val) return 0;
  if (typeof val?.seconds === 'number') return val.seconds;
  if (typeof val?.toDate === 'function') return Math.floor(val.toDate().getTime() / 1000);
  const ms = new Date(val).getTime();
  return Number.isNaN(ms) ? 0 : Math.floor(ms / 1000);
}

function classifyDimensions(width: number, height: number): ConcreteRatio {
  if (!width || !height) return '9:16';
  const ratio = width / height;
  if (ratio < 0.78) return '9:16';
  if (ratio > 1.25) return '16:9';
  return '1:1';
}

function getEmbedUrl(rawUrl?: string): string | null {
  if (!rawUrl) return null;
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.toLowerCase();
    if (host.includes('youtube.com')) {
      if (u.pathname.startsWith('/shorts/')) {
        const id = u.pathname.split('/shorts/')[1]?.split('/')[0];
        return id ? `https://www.youtube.com/embed/${id}?autoplay=1&rel=0` : null;
      }
      const v = u.searchParams.get('v');
      if (v) return `https://www.youtube.com/embed/${v}?autoplay=1&rel=0`;
      if (u.pathname.startsWith('/embed/')) return rawUrl;
    }
    if (host === 'youtu.be') {
      const id = u.pathname.replace('/', '').trim();
      return id ? `https://www.youtube.com/embed/${id}?autoplay=1&rel=0` : null;
    }
    if (host.includes('vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean)[0];
      return id ? `https://player.vimeo.com/video/${id}?autoplay=1` : null;
    }
  } catch {
    // Direct video URL
  }
  return null;
}

function ratioCardClass(ratio: ConcreteRatio): string {
  if (ratio === '16:9') return 'aspect-video';
  if (ratio === '1:1') return 'aspect-square';
  return 'aspect-[9/16]';
}

function ratioModalContainerClass(ratio: ConcreteRatio, isNativeFullscreen: boolean): string {
  if (isNativeFullscreen) return 'w-full h-full flex-1 flex items-center justify-center';
  if (ratio === '16:9') return 'w-full max-w-5xl aspect-video max-h-[78vh]';
  if (ratio === '1:1') return 'w-full max-w-[min(92vw,76vh)] aspect-square max-h-[78vh]';
  return 'w-full max-w-[min(92vw,440px)] aspect-[9/16] max-h-[80vh]';
}

function StoriesContent() {
  const searchParams = useSearchParams();
  const targetRestaurantId = searchParams.get('restaurantId');

  const pageRootRef = useRef<HTMLDivElement | null>(null);
  const playerModalRef = useRef<HTMLDivElement | null>(null);

  const [rawVideos, setRawVideos] = useState<StoryItem[]>([]);
  const [rawMenuItems, setRawMenuItems] = useState<any[]>([]);
  const [restaurantMap, setRestaurantMap] = useState<Record<string, { name: string; image: string }>>({});
  const [loading, setLoading] = useState(true);

  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string>(targetRestaurantId || 'ALL');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [detectedRatios, setDetectedRatios] = useState<Record<string, ConcreteRatio>>({});

  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const hasAutoOpenedRef = useRef(false);
  const [isPageFullscreen, setIsPageFullscreen] = useState(false);
  const [isPlayerFullscreen, setIsPlayerFullscreen] = useState(false);

  // Listen for browser fullscreen state transitions
  useEffect(() => {
    const onFsChange = () => {
      const fsEl = document.fullscreenElement;
      setIsPageFullscreen(fsEl === pageRootRef.current);
      setIsPlayerFullscreen(fsEl === playerModalRef.current);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Load real-time restaurants, videos collection, and menuItems (for menu dish videos)
  useEffect(() => {
    let unsubVideos = () => {};
    let unsubMenu = () => {};
    let unsubRestaurants = () => {};

    try {
      unsubRestaurants = onSnapshot(collection(db, 'restaurants'), (snap) => {
        const map: Record<string, { name: string; image: string }> = {};
        snap.docs.forEach((d) => {
          const data = d.data();
          map[d.id] = {
            name: data.name || data.restaurantName || 'Restaurant Partner',
            image: data.image || '/hunger.png',
          };
        });
        setRestaurantMap(map);
      });

      unsubVideos = onSnapshot(
        query(collection(db, 'videos'), where('isActive', '==', true), limit(60)),
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as StoryItem[];
          setRawVideos(list.filter((v) => Boolean(v.restaurantId)));
          setLoading(false);
        },
        async () => {
          try {
            const res = await fetch('/api/videos');
            if (res.ok) {
              const data = await res.json();
              setRawVideos(((data.videos || []) as StoryItem[]).filter((v) => Boolean(v.restaurantId)));
            }
          } finally {
            setLoading(false);
          }
        }
      );

      unsubMenu = onSnapshot(
        query(collection(db, 'menuItems'), limit(300)),
        (snap) => {
          const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setRawMenuItems(items);
          setLoading(false);
        },
        (err) => {
          console.warn('[Stories] Menu listener notice:', err.message);
        }
      );
    } catch (e) {
      console.warn('[Stories] Setup notice:', e);
      setLoading(false);
    }

    return () => {
      unsubRestaurants();
      unsubVideos();
      unsubMenu();
    };
  }, []);

  // Merge uploaded `videos` + menu item videos (`videoUrl` & `videos[]`), deduplicated
  const allStories = useMemo(() => {
    const merged: StoryItem[] = [];
    const seenUrls = new Set<string>();

    rawVideos.forEach((v) => {
      if (!v.restaurantId) return;
      const rest = restaurantMap[v.restaurantId];
      const url = typeof v.videoUrl === 'string' ? v.videoUrl.trim() : '';
      if (url) seenUrls.add(`${v.restaurantId}::${url}`);
      merged.push({
        ...v,
        restaurantName: v.restaurantName || rest?.name || 'Restaurant Partner',
        restaurantImage: v.restaurantImage || rest?.image || '/hunger.png',
      });
    });

    rawMenuItems.forEach((item) => {
      if (!item.restaurantId) return;
      const approved = !item.approvalStatus || item.approvalStatus === 'approved';
      const available = item.available !== false && item.isAvailable !== false;
      const notDeleted = item.deleted !== true && item.isDeleted !== true;
      if (!approved || !available || !notDeleted) return;

      const urls = Array.from(
        new Set(
          [
            ...(Array.isArray(item.videos) ? item.videos : []),
            ...(item.videoUrl ? [item.videoUrl] : []),
            ...(item.video ? [item.video] : []),
          ].filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
        )
      );

      const rest = restaurantMap[item.restaurantId];
      urls.forEach((url, idx) => {
        const key = `${item.restaurantId}::${url}`;
        if (seenUrls.has(key)) return;
        seenUrls.add(key);

        merged.push({
          id: `menu_${item.id}_${idx}`,
          restaurantId: item.restaurantId,
          restaurantName: rest?.name || 'Restaurant Partner',
          restaurantImage: rest?.image || '/hunger.png',
          menuItemId: item.id,
          price: Number(item.price || 0),
          title: item.name || 'Dish Showcase Video',
          description: item.description || `Fresh dish video from ${rest?.name || 'our kitchen'}`,
          videoUrl: url,
          thumbnailUrl: item.image || (Array.isArray(item.images) ? item.images[0] : '') || rest?.image || '',
          imageUrl: item.image || '',
          type: 'menu_video',
          views: Number(item.views || 0),
          likes: Number(item.likes || 0),
          createdAt: item.updatedAt || item.createdAt,
        });
      });
    });

    merged.sort((a, b) => toSeconds(b.createdAt) - toSeconds(a.createdAt));
    return merged;
  }, [rawVideos, rawMenuItems, restaurantMap]);

  // Restaurant story groups
  const groupedStories = useMemo(() => {
    return allStories.reduce((acc, story) => {
      const key = story.restaurantId;
      if (!key) return acc;
      if (!acc[key]) {
        acc[key] = {
          restaurantId: key,
          restaurantName: story.restaurantName || 'Restaurant',
          restaurantImage: story.restaurantImage,
          stories: [],
        };
      }
      acc[key].stories.push(story);
      return acc;
    }, {} as Record<string, { restaurantId: string; restaurantName: string; restaurantImage?: string; stories: StoryItem[] }>);
  }, [allStories]);

  const visibleStories = useMemo(() => {
    return allStories.filter((s) => {
      if (selectedRestaurantId !== 'ALL' && s.restaurantId !== selectedRestaurantId) return false;
      const isMenuVideo = s.type === 'menu_video' || Boolean(s.menuItemId);
      if (sourceFilter === 'menu' && !isMenuVideo) return false;
      if (sourceFilter === 'stories' && isMenuVideo) return false;
      return true;
    });
  }, [allStories, selectedRestaurantId, sourceFilter]);

  // Auto-open once if ?restaurantId= is passed
  useEffect(() => {
    if (!targetRestaurantId || hasAutoOpenedRef.current || visibleStories.length === 0) return;
    const idx = visibleStories.findIndex((s) => s.restaurantId === targetRestaurantId);
    if (idx !== -1) {
      hasAutoOpenedRef.current = true;
      setActiveIndex(idx);
    }
  }, [targetRestaurantId, visibleStories]);

  const activeStory = activeIndex !== null && visibleStories[activeIndex] ? visibleStories[activeIndex] : null;

  const goPrev = useCallback(() => {
    setActiveIndex((prev) => {
      if (prev === null || visibleStories.length === 0) return prev;
      return (prev - 1 + visibleStories.length) % visibleStories.length;
    });
  }, [visibleStories.length]);

  const goNext = useCallback(() => {
    setActiveIndex((prev) => {
      if (prev === null || visibleStories.length === 0) return prev;
      return (prev + 1) % visibleStories.length;
    });
  }, [visibleStories.length]);

  const togglePageFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (pageRootRef.current?.requestFullscreen) {
        await pageRootRef.current.requestFullscreen();
      }
    } catch {
      // Browser denied fullscreen
    }
  };

  const togglePlayerFullscreen = async () => {
    try {
      if (document.fullscreenElement === playerModalRef.current) {
        await document.exitFullscreen();
      } else if (playerModalRef.current?.requestFullscreen) {
        await playerModalRef.current.requestFullscreen();
      }
    } catch {
      // Fallback: modal already covers full viewport
    }
  };

  // Keyboard navigation in active player
  useEffect(() => {
    if (activeIndex === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.fullscreenElement) setActiveIndex(null);
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeIndex, goPrev, goNext]);

  const recordDetectedRatio = useCallback((id: string, width: number, height: number) => {
    if (!width || !height) return;
    const detected = classifyDimensions(width, height);
    setDetectedRatios((prev) => (prev[id] === detected ? prev : { ...prev, [id]: detected }));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const activeConcreteRatio: ConcreteRatio =
    (activeStory && (detectedRatios[activeStory.id] || activeStory.aspectRatio)) || '9:16';

  return (
    <div ref={pageRootRef} className="min-h-screen bg-background pb-20 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/60 px-4 py-3">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/customer">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg sm:text-xl font-black flex items-center gap-2">
                <Video className="w-5 h-5 text-primary" />
                Kitchen Stories &amp; Menu Videos
              </h1>
              <p className="text-xs text-muted-foreground">
                Dish showcase videos &amp; restaurant reels • Supports 9:16, 16:9 &amp; 1:1
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-xs font-bold">
              <TrendingUp className="w-3 h-3 mr-1" />
              {visibleStories.length} Videos
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={togglePageFullscreen}
              className="rounded-xl gap-1.5 text-xs font-bold cursor-pointer"
            >
              {isPageFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              {isPageFullscreen ? 'Exit Full Screen' : 'Full Screen'}
            </Button>
          </div>
        </div>
      </div>

      {/* Restaurant Story Circles */}
      {Object.keys(groupedStories).length > 0 && (
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setSelectedRestaurantId('ALL')}
              className={`flex flex-col items-center gap-1.5 min-w-[72px] cursor-pointer group ${
                selectedRestaurantId === 'ALL' ? 'opacity-100' : 'opacity-70 hover:opacity-100'
              }`}
            >
              <div
                className={`w-16 h-16 rounded-full p-0.5 ${
                  selectedRestaurantId === 'ALL'
                    ? 'bg-gradient-to-br from-primary to-orange-600'
                    : 'bg-border'
                }`}
              >
                <div className="w-full h-full rounded-full bg-card flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
              </div>
              <span className="text-xs font-bold text-foreground">All Kitchens</span>
              <span className="text-[10px] text-muted-foreground -mt-1">{allStories.length} clips</span>
            </button>

            {Object.values(groupedStories).map((group) => {
              const isSelected = selectedRestaurantId === group.restaurantId;
              return (
                <button
                  key={group.restaurantId}
                  onClick={() => {
                    setSelectedRestaurantId(isSelected ? 'ALL' : group.restaurantId);
                  }}
                  className="flex flex-col items-center gap-1.5 min-w-[72px] group cursor-pointer"
                >
                  <div
                    className={`w-16 h-16 rounded-full p-0.5 transition-transform duration-300 group-hover:scale-105 ${
                      isSelected
                        ? 'bg-gradient-to-br from-emerald-500 to-teal-600 ring-2 ring-emerald-500/30'
                        : 'bg-gradient-to-br from-primary via-orange-500 to-amber-500'
                    }`}
                  >
                    <div className="w-full h-full rounded-full bg-background p-0.5">
                      <div className="w-full h-full rounded-full overflow-hidden bg-muted">
                        {group.restaurantImage ? (
                          <img
                            src={group.restaurantImage}
                            alt={group.restaurantName}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/hunger.png';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-muted">
                            <Store className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-center truncate max-w-[76px] text-foreground">
                    {group.restaurantName}
                  </span>
                  <span className="text-[10px] text-muted-foreground -mt-1 font-medium">
                    {group.stories.length} {group.stories.length === 1 ? 'video' : 'videos'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Source Filter Controls */}
      <div className="max-w-6xl mx-auto px-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-card/80 border border-border/70 rounded-2xl p-3">
          {/* Source Filter Tabs */}
          <div className="flex items-center gap-1.5 bg-muted/70 p-1 rounded-xl self-start">
            {[
              { id: 'all' as SourceFilter, label: 'All Videos' },
              { id: 'menu' as SourceFilter, label: 'Menu Dish Videos' },
              { id: 'stories' as SourceFilter, label: 'Kitchen Reels' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSourceFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  sourceFilter === tab.id
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <span className="text-xs font-medium text-muted-foreground px-1">
            Auto-fitted for 9:16, 16:9 &amp; 1:1 videos
          </span>
        </div>

        {/* Feed Grid */}
        {visibleStories.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-2xl border border-dashed border-border p-6 space-y-3">
            <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <Video className="w-7 h-7" />
            </div>
            <p className="text-base font-bold text-foreground">No Videos Found</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Uploaded restaurant stories and dish menu videos will appear here automatically.
            </p>
            <Link href="/customer" className="inline-block pt-2">
              <Button variant="outline" size="sm" className="rounded-xl text-xs font-bold gap-1.5">
                <UtensilsCrossed className="w-3.5 h-3.5 text-primary" /> Explore Restaurants
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 items-start">
            {visibleStories.map((story, i) => {
              const effectiveRatio: ConcreteRatio =
                detectedRatios[story.id] || story.aspectRatio || '9:16';
              const isMenu = story.type === 'menu_video' || Boolean(story.menuItemId);
              const isDirectVideo = Boolean(story.videoUrl && !getEmbedUrl(story.videoUrl));

              return (
                <motion.div
                  key={story.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 10) * 0.03 }}
                  onClick={() => setActiveIndex(i)}
                  className={`relative ${ratioCardClass(effectiveRatio)} rounded-2xl overflow-hidden cursor-pointer group bg-zinc-950 border border-border/60 shadow-md`}
                >
                  {isDirectVideo ? (
                    <video
                      src={story.videoUrl}
                      poster={story.thumbnailUrl || story.imageUrl || undefined}
                      muted
                      playsInline
                      preload="metadata"
                      onLoadedMetadata={(e) => {
                        const v = e.currentTarget;
                        recordDetectedRatio(story.id, v.videoWidth, v.videoHeight);
                      }}
                      className="w-full h-full object-contain bg-black group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : story.thumbnailUrl || story.imageUrl ? (
                    <img
                      src={story.thumbnailUrl || story.imageUrl}
                      alt={story.title}
                      onLoad={(e) => {
                        if (!detectedRatios[story.id]) {
                          const img = e.currentTarget;
                          recordDetectedRatio(story.id, img.naturalWidth, img.naturalHeight);
                        }
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/hunger.png';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/80 to-orange-600 flex items-center justify-center">
                      <Play className="w-10 h-10 text-white" fill="white" />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/30 pointer-events-none" />

                  {/* Center Play Icon */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-11 h-11 rounded-full bg-black/55 backdrop-blur-md border border-white/25 text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                      <Play className="w-5 h-5 fill-white ml-0.5" />
                    </div>
                  </div>

                  {/* Top Badges */}
                  <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1.5">
                    <Badge className="bg-black/65 text-white border-0 text-[10px] backdrop-blur-md">
                      {isMenu ? 'Dish Video' : 'Kitchen Reel'}
                    </Badge>
                    <Badge className="bg-black/65 text-amber-300 border-0 text-[10px] backdrop-blur-md">
                      {effectiveRatio}
                    </Badge>
                  </div>

                  {/* Bottom Details */}
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-white text-xs sm:text-sm font-bold line-clamp-1">{story.title}</p>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className="text-white/80 text-[11px] font-medium truncate">{story.restaurantName}</p>
                      {story.price ? (
                        <span className="text-emerald-300 text-[11px] font-black flex-shrink-0">
                          ₹{story.price}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Interactive Full-Screen Video & Ratio Viewer */}
      <AnimatePresence>
        {activeStory && (
          <motion.div
            ref={playerModalRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col justify-between p-3 sm:p-5"
          >
            {/* Top Controls Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 z-20 max-w-6xl w-full mx-auto">
              <div className="flex items-center gap-2.5 min-w-0">
                {activeStory.restaurantImage ? (
                  <img
                    src={activeStory.restaurantImage}
                    alt=""
                    className="w-9 h-9 rounded-full object-cover border border-white/40 flex-shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-primary/20 text-white flex items-center justify-center flex-shrink-0">
                    <Store className="w-4 h-4" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-white font-bold text-sm truncate">{activeStory.restaurantName}</p>
                  <p className="text-white/65 text-xs truncate">{activeStory.title}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Native Fullscreen Button */}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={togglePlayerFullscreen}
                  className="rounded-full bg-white/10 text-white hover:bg-white/20 h-9 w-9 cursor-pointer"
                  title={isPlayerFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                >
                  {isPlayerFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </Button>

                {/* Close Button */}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
                    setActiveIndex(null);
                  }}
                  className="rounded-full bg-white/10 text-white hover:bg-white/20 h-9 w-9 cursor-pointer"
                  aria-label="Close Video"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Center Media Stage (Auto-fits 9:16 / 16:9 / 1:1 & Fullscreen cleanly) */}
            <div className="relative flex-1 flex items-center justify-center my-2 min-h-0">
              {visibleStories.length > 1 && (
                <button
                  type="button"
                  onClick={goPrev}
                  className="hidden sm:flex absolute left-2 lg:left-6 z-20 w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 text-white items-center justify-center transition-all cursor-pointer"
                  aria-label="Previous video"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}

              <div
                className={`relative rounded-2xl overflow-hidden bg-black border border-white/15 shadow-2xl flex items-center justify-center transition-all duration-200 ${ratioModalContainerClass(
                  activeConcreteRatio,
                  isPlayerFullscreen
                )}`}
              >
                {activeStory.videoUrl ? (
                  getEmbedUrl(activeStory.videoUrl) ? (
                    <iframe
                      key={activeStory.id}
                      src={getEmbedUrl(activeStory.videoUrl)!}
                      title={activeStory.title}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                      allowFullScreen
                    />
                  ) : (
                    <video
                      key={activeStory.id}
                      src={activeStory.videoUrl}
                      poster={activeStory.thumbnailUrl || activeStory.imageUrl || undefined}
                      onLoadedMetadata={(e) => {
                        const v = e.currentTarget;
                        recordDetectedRatio(activeStory.id, v.videoWidth, v.videoHeight);
                      }}
                      className="w-full h-full object-contain bg-black"
                      autoPlay
                      playsInline
                      controls
                    />
                  )
                ) : activeStory.imageUrl || activeStory.thumbnailUrl ? (
                  <img
                    src={activeStory.imageUrl || activeStory.thumbnailUrl}
                    alt={activeStory.title}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center p-8">
                    <p className="text-white text-2xl font-bold text-center">{activeStory.title}</p>
                  </div>
                )}
              </div>

              {visibleStories.length > 1 && (
                <button
                  type="button"
                  onClick={goNext}
                  className="hidden sm:flex absolute right-2 lg:right-6 z-20 w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 text-white items-center justify-center transition-all cursor-pointer"
                  aria-label="Next video"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              )}
            </div>

            {/* Bottom Info & Action Bar (kept clear below player controls!) */}
            <div className="z-20 max-w-5xl w-full mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-white font-black text-sm sm:text-base truncate">{activeStory.title}</p>
                  <Badge className="bg-white/15 text-amber-300 border-0 text-[10px]">
                    {activeConcreteRatio}
                  </Badge>
                  {activeStory.price ? (
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-0 text-xs font-black">
                      ₹{activeStory.price}
                    </Badge>
                  ) : null}
                </div>
                {activeStory.description && (
                  <p className="text-white/75 text-xs line-clamp-1 mt-0.5">{activeStory.description}</p>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {visibleStories.length > 1 && (
                  <div className="flex sm:hidden items-center gap-1">
                    <Button size="sm" variant="secondary" onClick={goPrev} className="h-9 px-2.5 rounded-xl">
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="secondary" onClick={goNext} className="h-9 px-2.5 rounded-xl">
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                {activeStory.menuItemId && (
                  <Link href={`/customer/product/${activeStory.menuItemId}`}>
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs h-9 gap-1.5 cursor-pointer">
                      <ShoppingBag className="w-3.5 h-3.5" /> Order This Dish
                    </Button>
                  </Link>
                )}
                <Link href={`/customer/restaurant/${activeStory.restaurantId}`}>
                  <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-xs h-9 gap-1.5 cursor-pointer">
                    <Store className="w-3.5 h-3.5" /> View Restaurant
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function StoriesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <StoriesContent />
    </Suspense>
  );
}
