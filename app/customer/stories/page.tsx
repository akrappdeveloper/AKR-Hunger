'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Video, Play, TrendingUp, Store, ArrowLeft, RefreshCw, UtensilsCrossed } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

interface StoryItem {
  id: string;
  restaurantId: string;
  restaurantName?: string;
  restaurantImage?: string;
  title: string;
  description?: string;
  videoUrl?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  type: string;
  views: number;
  likes: number;
  createdAt?: any;
}

function StoriesContent() {
  const searchParams = useSearchParams();
  const targetRestaurantId = searchParams.get('restaurantId');

  const [stories, setStories] = useState<StoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStory, setActiveStory] = useState<StoryItem | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let unsubscribe = () => {};

    const loadStories = async () => {
      try {
        const storiesRef = collection(db, 'videos');
        // Safe query without composite indexes to guarantee immediate execution
        const q = query(
          storiesRef,
          where('isActive', '==', true),
          limit(50)
        );

        unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            const list = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
            })) as StoryItem[];

            // ONLY show stories that have actually been uploaded by restaurants (restaurantId exists)
            const validRestaurantStories = list.filter(item => Boolean(item.restaurantId));

            // Sort client-side by createdAt
            validRestaurantStories.sort((a, b) => {
              const timeA = a.createdAt?.seconds || 0;
              const timeB = b.createdAt?.seconds || 0;
              return timeB - timeA;
            });

            setStories(validRestaurantStories);
            setLoading(false);

            // Auto-select restaurant story if restaurantId provided in URL
            if (targetRestaurantId && validRestaurantStories.length > 0) {
              const match = validRestaurantStories.find(s => s.restaurantId === targetRestaurantId);
              if (match) {
                setActiveStory(match);
              }
            }
          },
          async (error) => {
            // Graceful error handling - never crash with uncaught listener error
            console.warn('[Stories] Firestore listener warning (fetching via API fallback):', error.message);
            try {
              const res = await fetch('/api/videos');
              if (res.ok) {
                const data = await res.json();
                const apiStories = ((data.videos || []) as StoryItem[]).filter(v => Boolean(v.restaurantId));
                setStories(apiStories);
                if (targetRestaurantId && apiStories.length > 0) {
                  const match = apiStories.find(s => s.restaurantId === targetRestaurantId);
                  if (match) setActiveStory(match);
                }
              }
            } catch (apiErr) {
              console.error('[Stories] API fallback failed:', apiErr);
            } finally {
              setLoading(false);
            }
          }
        );
      } catch (err) {
        console.warn('[Stories] Setup error:', err);
        setLoading(false);
      }
    };

    loadStories();

    return () => unsubscribe();
  }, [targetRestaurantId]);

  // Group stories by restaurant (only restaurants that have uploaded stories)
  const groupedStories = stories.reduce((acc, story) => {
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/60 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/customer">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-black flex items-center gap-2">
                <Video className="w-5 h-5 text-primary" />
                Restaurant Kitchen Stories &amp; Reels
              </h1>
              <p className="text-xs text-muted-foreground">Fresh video stories uploaded by verified restaurants</p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs font-bold">
            <TrendingUp className="w-3 h-3 mr-1" />
            {stories.length} Restaurant Stories
          </Badge>
        </div>
      </div>

      {/* Story Circles (Only restaurants who uploaded stories) */}
      {Object.keys(groupedStories).length > 0 && (
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
            {Object.values(groupedStories).map((group) => (
              <button
                key={group.restaurantId}
                onClick={() => {
                  setActiveStory(group.stories[0]);
                  setActiveIndex(0);
                }}
                className="flex flex-col items-center gap-1.5 min-w-[72px] group cursor-pointer"
              >
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary via-orange-500 to-amber-500 p-0.5 transition-transform duration-300 group-hover:scale-105">
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
                  {group.stories.length} {group.stories.length === 1 ? 'story' : 'stories'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stories Grid / Feed */}
      <div className="max-w-4xl mx-auto px-4 space-y-4">
        <h2 className="text-base font-bold flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          Uploaded Restaurant Stories
        </h2>

        {stories.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-2xl border border-dashed border-border p-6 space-y-3">
            <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <Video className="w-7 h-7" />
            </div>
            <p className="text-base font-bold text-foreground">No Restaurant Stories Uploaded Yet</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              When restaurants upload kitchen tours, dish preparation clips, or food reels from their portal, they will appear here live!
            </p>
            <Link href="/customer" className="inline-block pt-2">
              <Button variant="outline" size="sm" className="rounded-xl text-xs font-bold gap-1.5">
                <UtensilsCrossed className="w-3.5 h-3.5 text-primary" /> Explore Restaurants
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {stories.map((story, i) => (
              <motion.div
                key={story.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => { setActiveStory(story); setActiveIndex(i); }}
                className="relative aspect-[9/16] rounded-2xl overflow-hidden cursor-pointer group bg-muted shadow-md"
              >
                {story.thumbnailUrl || story.imageUrl ? (
                  <img
                    src={story.thumbnailUrl || story.imageUrl}
                    alt={story.title}
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
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-white text-xs font-bold line-clamp-2">{story.title}</p>
                  <p className="text-white/80 text-[10px] mt-0.5 font-semibold">{story.restaurantName}</p>
                </div>
                <div className="absolute top-2 right-2">
                  <Badge className="bg-black/60 text-white border-0 text-[10px] backdrop-blur-md">
                    <Play className="w-2.5 h-2.5 mr-0.5" fill="white" />
                    {story.views || 0}
                  </Badge>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Full-screen Story Viewer */}
      <AnimatePresence>
        {activeStory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
          >
            <div className="relative w-full max-w-md h-full bg-black flex flex-col justify-between">
              {/* Media viewer */}
              <div className="relative w-full flex-1 flex items-center justify-center overflow-hidden">
                {activeStory.videoUrl ? (
                  <video
                    src={activeStory.videoUrl}
                    className="w-full h-full object-cover"
                    autoPlay
                    playsInline
                    controls
                  />
                ) : activeStory.imageUrl || activeStory.thumbnailUrl ? (
                  <img
                    src={activeStory.imageUrl || activeStory.thumbnailUrl}
                    alt={activeStory.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center">
                    <p className="text-white text-2xl font-bold text-center px-8">{activeStory.title}</p>
                  </div>
                )}
              </div>

              {/* Close button */}
              <button
                onClick={() => setActiveStory(null)}
                className="absolute top-6 right-4 z-20 p-2.5 rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-black/80 transition-colors"
                aria-label="Close Story"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              {/* Info overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 via-black/60 to-transparent z-10 space-y-2">
                <div className="flex items-center gap-2">
                  {activeStory.restaurantImage ? (
                    <img
                      src={activeStory.restaurantImage}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover border border-white/40"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/20 text-white flex items-center justify-center">
                      <Store className="w-4 h-4" />
                    </div>
                  )}
                  <div>
                    <p className="text-white font-bold text-sm leading-tight">{activeStory.restaurantName}</p>
                    <p className="text-white/60 text-[10px]">Restaurant Partner</p>
                  </div>
                </div>

                <p className="text-white font-black text-base">{activeStory.title}</p>
                {activeStory.description && (
                  <p className="text-white/80 text-xs leading-relaxed">{activeStory.description}</p>
                )}

                <div className="pt-2">
                  <Link href={`/customer/restaurant/${activeStory.restaurantId}`}>
                    <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-xs h-10 shadow-lg">
                      <Store className="w-3.5 h-3.5 mr-2" /> View Restaurant &amp; Order Menu
                    </Button>
                  </Link>
                </div>
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
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <StoriesContent />
    </Suspense>
  );
}
