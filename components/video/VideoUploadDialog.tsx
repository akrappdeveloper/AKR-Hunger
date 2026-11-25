'use client';

import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Video, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface VideoUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  uploaderType: 'restaurant' | 'customer';
  uploaderId: string;
  uploaderName?: string;
  restaurantId?: string;
  restaurantImage?: string;
  onUploaded?: (videoData: any) => void;
}

export default function VideoUploadDialog({
  open,
  onOpenChange,
  uploaderType,
  uploaderId,
  uploaderName = 'Restaurant',
  restaurantId,
  restaurantImage,
  onUploaded,
}: VideoUploadDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<string>('story');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string>('');
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      toast.error('Please select a valid video file');
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      toast.error('Video must be less than 100MB');
      return;
    }

    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    const finalVideoUrl = videoUrlInput.trim() || videoPreview;
    if (!finalVideoUrl && !videoFile) {
      toast.error('Please select a video file or paste a video URL');
      return;
    }
    if (!title.trim()) {
      toast.error('Please enter a video/story title');
      return;
    }

    setUploading(true);
    try {
      const videoData = {
        uploaderId,
        uploaderType,
        uploaderName,
        type,
        title: title.trim(),
        description: description.trim(),
        videoUrl: finalVideoUrl,
        thumbnailUrl: thumbnailUrl.trim() || (restaurantImage || ''),
        restaurantId: restaurantId || uploaderId,
        restaurantName: uploaderName,
        restaurantImage: restaurantImage || '',
        tags: [],
        isActive: true,
      };

      const response = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(videoData),
      });

      if (!response.ok) throw new Error('Upload failed');

      const result = await response.json();
      toast.success('Kitchen Story uploaded successfully! 🎬 Live on Customer Reels.');
      onUploaded?.({ ...videoData, id: result.id });
      onOpenChange(false);
      resetForm();
    } catch (error) {
      toast.error('Failed to upload video');
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setType('story');
    setVideoFile(null);
    setVideoPreview('');
    setVideoUrlInput('');
    setThumbnailUrl('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" />
            Upload Video
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Video Preview / Upload Area */}
          {videoPreview ? (
            <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
              <video src={videoPreview} className="w-full h-full object-contain" controls />
              <button
                onClick={() => { setVideoFile(null); setVideoPreview(''); }}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
            >
              <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-semibold text-foreground">Click to select video</p>
              <p className="text-xs text-muted-foreground mt-1">MP4, MOV, WebM — Max 100MB</p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Video URL alternative input */}
          <div className="space-y-1.5 pt-1">
            <Label className="text-xs">Or Paste Direct Video / MP4 / Reel URL</Label>
            <Input
              value={videoUrlInput}
              onChange={e => setVideoUrlInput(e.target.value)}
              placeholder="https://example.com/kitchen-reel.mp4"
              className="text-xs"
            />
          </div>

          <div className="space-y-3">
            <div>
              <Label>Title *</Label>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Master Chef Live Dum Biryani Prep..."
                className="mt-1"
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe your kitchen story or special dish..."
                className="mt-1"
                rows={2}
              />
            </div>

            <div>
              <Label>Cover Thumbnail Image URL (Optional)</Label>
              <Input
                value={thumbnailUrl}
                onChange={e => setThumbnailUrl(e.target.value)}
                placeholder="https://example.com/cover.jpg"
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <Label>Video Category</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="story">📸 Kitchen Story (Reel)</SelectItem>
                  <SelectItem value="food_prep">🍳 Food Preparation</SelectItem>
                  <SelectItem value="kitchen_tour">🏪 Kitchen Tour</SelectItem>
                  <SelectItem value="review">⭐ Dish Showcase</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={uploading || (!videoFile && !videoUrlInput.trim()) || !title.trim()}>
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload Story / Video
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
