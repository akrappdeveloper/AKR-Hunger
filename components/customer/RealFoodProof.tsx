'use client';

/**
 * Real Food Proof Component
 * ==========================
 * After delivery, customer can upload actual food photos,
 * compare with restaurant photo, rate portion/packaging/taste,
 * and report missing items.
 */

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Upload, CheckCircle2, AlertTriangle, Package, Utensils, Star, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import SafeImage from '@/components/ui/safe-image';

interface RealFoodProofProps {
  orderId: string;
  restaurantId: string;
  menuItemId?: string;
  restaurantPhotoUrl?: string;
  menuItemName: string;
  onSubmit?: (proof: FoodProofData) => void;
}

interface FoodProofData {
  orderId: string;
  restaurantId: string;
  menuItemId?: string;
  customerPhotoUrl: string;
  portionFeedback: 'too_less' | 'normal' | 'generous';
  packagingFeedback: 'poor' | 'acceptable' | 'excellent';
  tasteFeedback: 'disappointing' | 'okay' | 'great';
  missingItems: string[];
  additionalNotes: string;
}

const PORTION_OPTIONS = [
  { value: 'too_less', label: 'Too Less', emoji: '😞', color: 'text-red-400' },
  { value: 'normal', label: 'Normal', emoji: '😊', color: 'text-amber-400' },
  { value: 'generous', label: 'Generous', emoji: '🤩', color: 'text-emerald-400' },
] as const;

const PACKAGING_OPTIONS = [
  { value: 'poor', label: 'Poor', emoji: '📦💔', color: 'text-red-400' },
  { value: 'acceptable', label: 'Okay', emoji: '📦', color: 'text-amber-400' },
  { value: 'excellent', label: 'Excellent', emoji: '📦✨', color: 'text-emerald-400' },
] as const;

const TASTE_OPTIONS = [
  { value: 'disappointing', label: 'Disappointing', emoji: '😔', color: 'text-red-400' },
  { value: 'okay', label: 'Okay', emoji: '😐', color: 'text-amber-400' },
  { value: 'great', label: 'Great!', emoji: '😋', color: 'text-emerald-400' },
] as const;

export default function RealFoodProof({
  orderId,
  restaurantId,
  menuItemId,
  restaurantPhotoUrl,
  menuItemName,
  onSubmit,
}: RealFoodProofProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [portionFeedback, setPortionFeedback] = useState<typeof PORTION_OPTIONS[number]['value'] | null>(null);
  const [packagingFeedback, setPackagingFeedback] = useState<typeof PACKAGING_OPTIONS[number]['value'] | null>(null);
  const [tasteFeedback, setTasteFeedback] = useState<typeof TASTE_OPTIONS[number]['value'] | null>(null);
  const [missingItems, setMissingItems] = useState<string[]>([]);
  const [newMissingItem, setNewMissingItem] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side preview
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoUrl(ev.target?.result as string);
    reader.readAsDataURL(file);

    // Upload to imgBB
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch('/api/upload-image', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) setPhotoUrl(data.url);
    } catch {
      toast({ title: 'Upload failed', description: 'Using local preview.', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const addMissingItem = () => {
    if (newMissingItem.trim()) {
      setMissingItems(prev => [...prev, newMissingItem.trim()]);
      setNewMissingItem('');
    }
  };

  const handleSubmit = async () => {
    if (!photoUrl || !portionFeedback || !packagingFeedback || !tasteFeedback) {
      toast({ title: 'Please complete all ratings', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    const proof: FoodProofData = {
      orderId,
      restaurantId,
      menuItemId,
      customerPhotoUrl: photoUrl,
      portionFeedback,
      packagingFeedback,
      tasteFeedback,
      missingItems,
      additionalNotes: notes,
    };

    try {
      await fetch('/api/food-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proof),
      });
      setSubmitted(true);
      onSubmit?.(proof);
    } catch {
      toast({ title: 'Submit failed', description: 'Try again.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-12 px-4"
      >
        <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
        <h3 className="text-xl font-bold mb-2">Thanks for the proof! 📸</h3>
        <p className="text-sm text-muted-foreground">
          Your feedback helps improve restaurant quality for everyone.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-blue-500/20">
          <Camera className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h2 className="font-bold">Real Food Proof</h2>
          <p className="text-xs text-muted-foreground">Show what you received — {menuItemName}</p>
        </div>
      </div>

      {/* Photo Upload */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-all overflow-hidden ${
          photoUrl ? 'border-emerald-500/40' : 'border-border hover:border-blue-500/40'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoChange}
          className="hidden"
        />

        {photoUrl ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt="Your food" className="w-full h-48 object-cover" />
            <div className="absolute top-2 right-2">
              <button
                onClick={(e) => { e.stopPropagation(); setPhotoUrl(null); }}
                className="p-1.5 rounded-full bg-black/50 text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {uploading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="text-white text-sm">Uploading...</div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-10 text-center">
            <Camera className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium">Take a photo of your food</p>
            <p className="text-xs text-muted-foreground mt-1">or upload from gallery</p>
          </div>
        )}
      </div>

      {/* Comparison with restaurant photo */}
      {restaurantPhotoUrl && photoUrl && (
        <div className="grid grid-cols-2 gap-2">
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">What you got</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt="Your food" className="w-full h-28 object-cover rounded-xl" />
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">Restaurant menu</div>
            <SafeImage src={restaurantPhotoUrl} alt="Menu photo" width={150} height={112} className="w-full h-28 object-cover rounded-xl" />
          </div>
        </div>
      )}

      {/* Ratings */}
      {[
        { label: 'Portion Size', icon: Utensils, options: PORTION_OPTIONS, value: portionFeedback, setter: setPortionFeedback },
        { label: 'Packaging', icon: Package, options: PACKAGING_OPTIONS, value: packagingFeedback, setter: setPackagingFeedback },
        { label: 'Taste', icon: Star, options: TASTE_OPTIONS, value: tasteFeedback, setter: setTasteFeedback },
      ].map((section) => (
        <div key={section.label}>
          <div className="flex items-center gap-2 mb-2.5">
            <section.icon className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold">{section.label}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(section.options as readonly any[]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => section.setter(opt.value as any)}
                className={`p-3 rounded-xl border text-center transition-all ${
                  section.value === opt.value
                    ? 'border-blue-500/40 bg-blue-500/15'
                    : 'border-border bg-card hover:border-border/70'
                }`}
              >
                <div className="text-xl mb-1">{opt.emoji}</div>
                <div className={`text-xs font-medium ${section.value === opt.value ? opt.color : 'text-muted-foreground'}`}>
                  {opt.label}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Missing Items */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold">Missing Items?</span>
        </div>
        <div className="flex gap-2">
          <input
            value={newMissingItem}
            onChange={e => setNewMissingItem(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addMissingItem()}
            placeholder="e.g. Extra sauce, side salad"
            className="flex-1 text-sm px-3 py-2 rounded-xl border border-border bg-background outline-none focus:border-amber-500/40"
          />
          <Button size="sm" onClick={addMissingItem} variant="outline" className="border-amber-500/30 text-amber-400">
            Add
          </Button>
        </div>
        {missingItems.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {missingItems.map((item, i) => (
              <Badge key={i} className="bg-amber-500/15 text-amber-400 border-amber-500/30">
                {item}
                <button onClick={() => setMissingItems(prev => prev.filter((_, j) => j !== i))} className="ml-1">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Any additional feedback..."
        className="w-full text-sm px-3 py-2.5 rounded-xl border border-border bg-background resize-none outline-none focus:border-blue-500/40"
        rows={2}
      />

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={!photoUrl || !portionFeedback || !packagingFeedback || !tasteFeedback || submitting}
        className="w-full h-12 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold shadow-lg shadow-blue-500/30"
      >
        {submitting ? 'Submitting...' : '📸 Submit Food Proof'}
      </Button>
    </div>
  );
}
