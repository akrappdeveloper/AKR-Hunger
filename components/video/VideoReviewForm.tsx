'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Video, Star, Camera, X, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface VideoReviewFormProps {
  restaurantId: string;
  menuItemId?: string;
  orderId?: string;
  customerId: string;
  customerName: string;
  onSubmitted?: () => void;
}

export default function VideoReviewForm({
  restaurantId,
  menuItemId,
  orderId,
  customerId,
  customerName,
  onSubmitted,
}: VideoReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      toast.error('Please select a valid video file');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error('Video must be less than 50MB');
      return;
    }
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }
    setSubmitting(true);
    try {
      // Upload video and create review
      const reviewData = {
        customerId,
        customerName,
        restaurantId,
        menuItemId,
        orderId,
        rating,
        comment: comment.trim(),
        videoUrl: videoPreview || '',
        uploaderType: 'customer',
        uploaderName: customerName,
        type: 'review',
        title: `${rating}★ Review`,
      };

      const response = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reviewData),
      });

      if (!response.ok) throw new Error('Failed to submit');
      toast.success('Video review submitted! 🎬⭐');
      onSubmitted?.();
    } catch (error) {
      toast.error('Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <h3 className="font-bold text-foreground flex items-center gap-2">
        <Video className="w-5 h-5 text-primary" />
        Video Review
      </h3>

      {/* Star Rating */}
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <motion.button
            key={star}
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            className="p-0.5"
          >
            <Star
              className={`w-8 h-8 transition-colors ${
                star <= (hoverRating || rating)
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-muted-foreground/40'
              }`}
            />
          </motion.button>
        ))}
        {rating > 0 && (
          <span className="ml-2 text-sm font-semibold text-foreground">
            {rating === 5 ? 'Amazing!' : rating === 4 ? 'Great!' : rating === 3 ? 'Good' : rating === 2 ? 'Fair' : 'Poor'}
          </span>
        )}
      </div>

      {/* Video upload */}
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
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 hover:bg-primary/5 transition-all"
        >
          <Camera className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium text-muted-foreground">
            Record or upload a video review
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">MP4, MOV — Max 50MB</p>
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Comment */}
      <Textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder="Share your experience... (optional)"
        rows={3}
      />

      <Button
        onClick={handleSubmit}
        disabled={submitting || rating === 0}
        className="w-full"
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            <Send className="w-4 h-4 mr-2" />
            Submit Video Review
          </>
        )}
      </Button>
    </div>
  );
}
