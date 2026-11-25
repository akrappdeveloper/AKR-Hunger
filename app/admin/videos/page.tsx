'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ProtectedRoute } from '@/components/admin/ProtectedRoute';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Film, Video, Search, Check, X, Trash2, Eye, Heart,
  Star, Store, ShieldCheck, AlertCircle, Play
} from 'lucide-react';
import { toast } from 'sonner';

interface VideoDoc {
  id: string;
  title: string;
  description?: string;
  type: string;
  uploaderName: string;
  uploaderType: 'restaurant' | 'customer';
  videoUrl: string;
  thumbnailUrl?: string;
  views: number;
  likes: number;
  isActive: boolean;
  isPinned?: boolean;
  createdAt: any;
}

export default function AdminVideosPage() {
  const [videos, setVideos] = useState<VideoDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    const q = query(collection(db, 'videos'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setVideos(snap.docs.map(d => ({ id: d.id, ...d.data() } as VideoDoc)));
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleToggleActive = async (id: string, current: boolean) => {
    try {
      await updateDoc(doc(db, 'videos', id), { isActive: !current });
      toast.success(current ? 'Video hidden' : 'Video approved & made live');
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleTogglePinned = async (id: string, current?: boolean) => {
    try {
      await updateDoc(doc(db, 'videos', id), { isPinned: !current });
      toast.success(current ? 'Removed from featured' : 'Featured on customer feed');
    } catch {
      toast.error('Failed to update featured status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this video?')) return;
    try {
      await deleteDoc(doc(db, 'videos', id));
      toast.success('Video permanently deleted');
    } catch {
      toast.error('Failed to delete video');
    }
  };

  const filtered = videos.filter(v => {
    const matchSearch = v.title?.toLowerCase().includes(search.toLowerCase()) ||
      v.uploaderName?.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || v.type === filterType;
    return matchSearch && matchType;
  });

  return (
    <ProtectedRoute allowedRoles={['super_admin', 'operations_admin', 'content_manager']}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
              <Film className="w-6 h-6 text-primary" />
              Video &amp; Stories Moderation
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Review, feature, or remove kitchen tours, stories, and customer video reviews
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-bold">
              {videos.length} Total Videos
            </Badge>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Active Live', count: videos.filter(v => v.isActive).length, color: 'text-green-500', bg: 'bg-green-500/10' },
            { label: 'Featured', count: videos.filter(v => v.isPinned).length, color: 'text-amber-500', bg: 'bg-amber-500/10' },
            { label: 'Total Views', count: videos.reduce((acc, v) => acc + (v.views || 0), 0), color: 'text-blue-500', bg: 'bg-blue-500/10' },
            { label: 'Hidden / Flagged', count: videos.filter(v => !v.isActive).length, color: 'text-rose-500', bg: 'bg-rose-500/10' },
          ].map(stat => (
            <Card key={stat.label} className="p-4 border-border/60">
              <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
              <p className={`text-2xl font-black mt-1 ${stat.color}`}>{stat.count}</p>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by video title or uploader..."
              className="pl-10"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {['all', 'kitchen_tour', 'food_prep', 'story', 'review'].map(t => (
              <Button
                key={t}
                size="sm"
                variant={filterType === t ? 'default' : 'outline'}
                onClick={() => setFilterType(t)}
                className="capitalize text-xs h-9"
              >
                {t.replace('_', ' ')}
              </Button>
            ))}
          </div>
        </div>

        {/* Videos Grid */}
        {loading ? (
          <div className="py-20 text-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Loading video stream...</p>
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center border-dashed">
            <Video className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm font-semibold text-foreground">No videos found</p>
            <p className="text-xs text-muted-foreground mt-0.5">Uploaded kitchen stories and reviews will appear here</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(video => (
              <Card key={video.id} className="overflow-hidden border-border/70 flex flex-col justify-between">
                <div className="relative aspect-video bg-black/80">
                  {video.thumbnailUrl ? (
                    <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Play className="w-10 h-10 text-white/40" />
                    </div>
                  )}
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                    <Badge className="bg-black/60 text-white backdrop-blur-md text-[10px] capitalize">
                      {video.type.replace('_', ' ')}
                    </Badge>
                    {video.isPinned && (
                      <Badge className="bg-amber-500 text-white text-[10px] font-bold">
                        ⭐ Featured
                      </Badge>
                    )}
                  </div>
                  <div className="absolute bottom-2.5 right-2.5 flex items-center gap-2 text-white text-xs bg-black/60 px-2 py-0.5 rounded-lg backdrop-blur-md">
                    <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" /> {video.views || 0}</span>
                    <span className="flex items-center gap-0.5"><Heart className="w-3 h-3 text-rose-400" /> {video.likes || 0}</span>
                  </div>
                </div>

                <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-foreground line-clamp-1">{video.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">By {video.uploaderName} ({video.uploaderType})</p>
                    {video.description && (
                      <p className="text-xs text-muted-foreground/80 line-clamp-2 mt-1">{video.description}</p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant={video.isActive ? 'outline' : 'default'}
                        onClick={() => handleToggleActive(video.id, video.isActive)}
                        className={`text-xs h-8 ${video.isActive ? 'text-amber-500 border-amber-500/30' : 'bg-green-600 text-white'}`}
                      >
                        {video.isActive ? 'Hide' : 'Approve'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleTogglePinned(video.id, video.isPinned)}
                        className={`text-xs h-8 ${video.isPinned ? 'text-amber-500' : 'text-muted-foreground'}`}
                      >
                        <Star className={`w-3.5 h-3.5 mr-1 ${video.isPinned ? 'fill-amber-500' : ''}`} />
                        {video.isPinned ? 'Pinned' : 'Pin'}
                      </Button>
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(video.id)}
                      className="text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
