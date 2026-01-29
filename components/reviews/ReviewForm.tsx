'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Star, Upload, X, Loader2 } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { submitReview } from '@/lib/reviews';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { Review } from '@/lib/types';

const reviewSchema = z.object({
    rating: z.number().min(1, 'Please select a rating').max(5),
    title: z.string().optional(),
    comment: z.string().min(10, 'Review must be at least 10 characters'),
});

type ReviewFormData = z.infer<typeof reviewSchema>;

interface ReviewFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orderId: string;
    restaurantId: string;
    restaurantName: string;
    onSuccess?: () => void;
}

export function ReviewForm({
    open,
    onOpenChange,
    orderId,
    restaurantId,
    restaurantName,
    onSuccess,
}: ReviewFormProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [images, setImages] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
    } = useForm<ReviewFormData>({
        resolver: zodResolver(reviewSchema),
        defaultValues: {
            rating: 0,
            title: '',
            comment: '',
        },
    });

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        const newImages: string[] = [];
        const maxImages = 3 - images.length;

        for (let i = 0; i < Math.min(files.length, maxImages); i++) {
            const file = files[i];
            const reader = new FileReader();

            reader.onloadend = () => {
                newImages.push(reader.result as string);
                if (newImages.length === Math.min(files.length, maxImages)) {
                    setImages([...images, ...newImages]);
                }
            };

            reader.readAsDataURL(file);
        }
    };

    const removeImage = (index: number) => {
        setImages(images.filter((_, i) => i !== index));
    };

    const onSubmit = async (data: ReviewFormData) => {
        if (!user) {
            toast({
                title: 'Error',
                description: 'You must be logged in to submit a review',
                variant: 'destructive',
            });
            return;
        }

        setIsSubmitting(true);
        try {
            await submitReview({
                customerId: user.uid,
                customerName: user.displayName || 'Anonymous',
                customerAvatar: user.photoURL || undefined,
                orderId,
                restaurantId,
                rating,
                title: data.title,
                comment: data.comment,
                images: images.length > 0 ? images : undefined,
            });

            toast({
                title: 'Success!',
                description: 'Your review has been submitted',
            });

            reset();
            setRating(0);
            setImages([]);
            onOpenChange(false);
            onSuccess?.();
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to submit review. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Write a Review</DialogTitle>
                    <DialogDescription>
                        Share your experience at {restaurantName}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    {/* Rating */}
                    <div className="space-y-2">
                        <Label>Overall Rating *</Label>
                        <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => setRating(star)}
                                    onMouseEnter={() => setHoverRating(star)}
                                    onMouseLeave={() => setHoverRating(0)}
                                    className="transition-transform hover:scale-110"
                                >
                                    <Star
                                        className={`w-8 h-8 ${star <= (hoverRating || rating)
                                                ? 'fill-yellow-400 text-yellow-400'
                                                : 'fill-muted text-muted-foreground/30'
                                            }`}
                                    />
                                </button>
                            ))}
                        </div>
                        {errors.rating && (
                            <p className="text-sm text-destructive">{errors.rating.message}</p>
                        )}
                        <input type="hidden" {...register('rating', { value: rating })} />
                    </div>

                    {/* Title */}
                    <div className="space-y-2">
                        <Label htmlFor="title">Review Title (Optional)</Label>
                        <Input
                            id="title"
                            placeholder="Summarize your experience"
                            {...register('title')}
                        />
                    </div>

                    {/* Comment */}
                    <div className="space-y-2">
                        <Label htmlFor="comment">Your Review *</Label>
                        <Textarea
                            id="comment"
                            placeholder="Tell us about your experience..."
                            rows={4}
                            {...register('comment')}
                        />
                        {errors.comment && (
                            <p className="text-sm text-destructive">{errors.comment.message}</p>
                        )}
                    </div>

                    {/* Images */}
                    <div className="space-y-2">
                        <Label>Add Photos (Optional, max 3)</Label>
                        {images.length < 3 && (
                            <div className="relative">
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={handleImageUpload}
                                    className="hidden"
                                    id="image-upload"
                                />
                                <label htmlFor="image-upload">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full"
                                        asChild
                                    >
                                        <div className="cursor-pointer">
                                            <Upload className="w-4 h-4 mr-2" />
                                            Upload Images
                                        </div>
                                    </Button>
                                </label>
                            </div>
                        )}

                        {images.length > 0 && (
                            <div className="grid grid-cols-3 gap-2">
                                {images.map((image, index) => (
                                    <div key={index} className="relative aspect-square rounded-lg overflow-hidden">
                                        <img
                                            src={image}
                                            alt={`Upload ${index + 1}`}
                                            className="object-cover w-full h-full"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeImage(index)}
                                            className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Submit */}
                    <div className="flex gap-3 justify-end">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Submitting...
                                </>
                            ) : (
                                'Submit Review'
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
