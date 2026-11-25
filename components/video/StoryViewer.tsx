'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart, Share2, ChevronLeft, ChevronRight, Store, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SafeImage from '@/components/ui/safe-image';

interface Story {
  id: string;
  videoUrl?: string;
  imageUrl?: string;
  title?: string;
  description?: string;
  duration?: number;
  likes?: number;
  restaurantName?: string;
  restaurantImage?: string;
  createdAt?: any;
}

interface StoryGroup {
  restaurantId: string;
  restaurantName: string;
  restaurantImage?: string;
  stories: Story[];
}

interface StoryViewerProps {
  storyGroups: StoryGroup[];
  initialGroupIndex?: number;
  onClose: () => void;
  onLike?: (storyId: string) => void;
}

export default function StoryViewer({ storyGroups, initialGroupIndex = 0, onClose, onLike }: StoryViewerProps) {
  const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const currentGroup = storyGroups[groupIndex];
  const currentStory = currentGroup?.stories[storyIndex];
  const storyDuration = currentStory?.duration || 5; // seconds

  const goNext = useCallback(() => {
    if (storyIndex < currentGroup.stories.length - 1) {
      setStoryIndex(prev => prev + 1);
      setProgress(0);
    } else if (groupIndex < storyGroups.length - 1) {
      setGroupIndex(prev => prev + 1);
      setStoryIndex(0);
      setProgress(0);
    } else {
      onClose();
    }
  }, [storyIndex, groupIndex, currentGroup, storyGroups, onClose]);

  const goPrev = () => {
    if (storyIndex > 0) {
      setStoryIndex(prev => prev - 1);
      setProgress(0);
    } else if (groupIndex > 0) {
      setGroupIndex(prev => prev - 1);
      setStoryIndex(0);
      setProgress(0);
    }
  };

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          goNext();
          return 0;
        }
        return prev + (100 / (storyDuration * 20));
      });
    }, 50);
    return () => clearInterval(interval);
  }, [isPaused, storyDuration, goNext]);

  const handleTap = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width / 3) goPrev();
    else if (x > (rect.width * 2) / 3) goNext();
    else setIsPaused(!isPaused);
  };

  const handleLike = (id: string) => {
    setLiked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    onLike?.(id);
  };

  if (!currentStory) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
    >
      <div className="relative w-full max-w-md h-full max-h-[100dvh] overflow-hidden">
        {/* Story content */}
        <div className="absolute inset-0 cursor-pointer" onClick={handleTap}>
          {currentStory.videoUrl ? (
            <video
              ref={videoRef}
              src={currentStory.videoUrl}
              className="w-full h-full object-cover"
              autoPlay
              playsInline
              muted
            />
          ) : currentStory.imageUrl ? (
            <img
              src={currentStory.imageUrl}
              alt={currentStory.title || ''}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center">
              <p className="text-white text-2xl font-bold text-center px-8">{currentStory.title}</p>
            </div>
          )}
        </div>

        {/* Top overlay */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/60 to-transparent p-4 pt-6 safe-area-top">
          {/* Progress bars */}
          <div className="flex gap-1 mb-4">
            {currentGroup.stories.map((_, i) => (
              <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-100"
                  style={{
                    width: i < storyIndex ? '100%' : i === storyIndex ? `${progress}%` : '0%',
                  }}
                />
              </div>
            ))}
          </div>

          {/* Restaurant info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full border-2 border-primary overflow-hidden bg-muted">
                {currentGroup.restaurantImage ? (
                  <img src={currentGroup.restaurantImage} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Store className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div>
                <p className="text-white font-bold text-sm">{currentGroup.restaurantName}</p>
                <p className="text-white/60 text-xs">
                  {currentStory.createdAt ? 'Recently' : 'Just now'}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-white p-2 hover:bg-white/10 rounded-full transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Bottom overlay */}
        <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/70 to-transparent p-6 pb-8 safe-area-bottom">
          {currentStory.title && (
            <p className="text-white font-bold text-lg mb-1">{currentStory.title}</p>
          )}
          {currentStory.description && (
            <p className="text-white/80 text-sm mb-4">{currentStory.description}</p>
          )}
          <div className="flex items-center gap-4">
            <button
              onClick={() => handleLike(currentStory.id)}
              className="flex items-center gap-1.5 text-white"
            >
              <Heart
                className={`w-6 h-6 transition-all ${liked.has(currentStory.id) ? 'fill-red-500 text-red-500 scale-110' : 'hover:scale-110'}`}
              />
              <span className="text-sm">{(currentStory.likes || 0) + (liked.has(currentStory.id) ? 1 : 0)}</span>
            </button>
            <button className="flex items-center gap-1.5 text-white hover:scale-110 transition-transform">
              <MessageCircle className="w-6 h-6" />
            </button>
            <button className="flex items-center gap-1.5 text-white hover:scale-110 transition-transform">
              <Share2 className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
