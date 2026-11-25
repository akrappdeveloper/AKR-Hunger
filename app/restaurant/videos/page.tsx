'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRestaurantAuth } from '@/context/RestaurantAuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Video, Plus, Play, Trash2, Eye, Heart, Clock, Film, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import VideoUploadDialog from '@/components/video/VideoUploadDialog';

export default function RestaurantVideosPage() {
  const { restaurant } = useRestaurantAuth();
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    if (!restaurant?.id) return;

    const videosRef = collection(db, 'videos');
    const q = query(
      videosRef,
      where('restaurantId', '==', restaurant.id),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setVideos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => {
      console.warn('[Restaurant Videos] Listener notice:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [restaurant]);

  const handleDelete = async (videoId: string) => {
    if (!confirm('Delete this video?')) return;
    try {
      await deleteDoc(doc(db, 'videos', videoId));
      toast.success('Video deleted');
    } catch {
      toast.error('Failed to delete video');
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'kitchen_tour': return '🏪 Kitchen Tour';
      case 'food_prep': return '🍳 Food Prep';
      case 'story': return '📸 Story';
      case 'review': return '⭐ Review';
      default: return '🎬 Video';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black flex items-center gap-2">
              <Film className="w-6 h-6 text-primary" />
              Video Manager
            </h1>
            <p className="text-sm text-muted-foreground">Upload and manage your restaurant videos</p>
          </div>
          <Button onClick={() => setShowUpload(true)} className="gap-2 rounded-full">
            <Plus className="w-4 h-4" />
            Upload Video
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Videos', value: videos.length, icon: Video, color: 'text-blue-500' },
            { label: 'Total Views', value: videos.reduce((s, v) => s + (v.views || 0), 0), icon: Eye, color: 'text-green-500' },
            { label: 'Total Likes', value: videos.reduce((s, v) => s + (v.likes || 0), 0), icon: Heart, color: 'text-red-500' },
            { label: 'Stories', value: videos.filter(v => v.type === 'story').length, icon: Film, color: 'text-purple-500' },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="p-4">
              <Icon className={`w-5 h-5 ${color} mb-2`} />
              <p className="text-2xl font-black">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </Card>
          ))}
        </div>

        {/* Videos Grid */}
        {videos.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-2xl border border-dashed border-border">
            <Video className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground font-medium">No videos uploaded yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Upload kitchen tours, food prep videos, or stories</p>
            <Button onClick={() => setShowUpload(true)} className="mt-4 gap-2">
              <Plus className="w-4 h-4" />
              Upload Your First Video
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map((video, i) => (
              <motion.div
                key={video.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="overflow-hidden">
                  <div className="relative h-48 bg-black">
                    {video.thumbnailUrl ? (
                      <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/30 to-orange-500/30">
                        <Play className="w-10 h-10 text-white/50" />
                      </div>
                    )}
                    <Badge className="absolute top-2 left-2 text-[10px] bg-black/60 text-white border-0 backdrop-blur-md">
                      {getTypeLabel(video.type)}
                    </Badge>
                    {video.duration && (
                      <Badge className="absolute bottom-2 right-2 text-[10px] bg-black/60 text-white border-0 backdrop-blur-md">
                        <Clock className="w-2.5 h-2.5 mr-0.5" />
                        {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}
                      </Badge>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-sm line-clamp-1">{video.title}</h3>
                    {video.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{video.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{video.views || 0}</span>
                        <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{video.likes || 0}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(video.id)}
                        className="text-destructive hover:text-destructive h-8 w-8"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Dialog */}
      {showUpload && restaurant && (
        <VideoUploadDialog
          open={showUpload}
          onOpenChange={setShowUpload}
          uploaderType="restaurant"
          uploaderId={restaurant.id || ''}
          uploaderName={restaurant.name || 'Restaurant'}
          restaurantId={restaurant.id || ''}
          restaurantImage={restaurant.imageUrl || restaurant.image || ''}
          onUploaded={() => {
            setShowUpload(false);
            toast.success('Story / Video published! Now live on Customer Kitchen Stories & Reels.');
          }}
        />
      )}
    </div>
  );
}
