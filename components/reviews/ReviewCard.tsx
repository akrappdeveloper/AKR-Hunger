'use client';

import { useState } from 'react';
import { Star, ThumbsUp, MessageCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { Review } from '@/lib/types';
import { markReviewHelpful } from '@/lib/reviews';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';

interface ReviewCardProps {
    review: Review;
    onHelpfulUpdate?: () => void;
}

export function ReviewCard({ review, onHelpfulUpdate }: ReviewCardProps) {
    const { user } = useAuth();
    const [isVoting, setIsVoting] = useState(false);
    const [localHelpful, setLocalHelpful] = useState(review.helpful);
    const [hasVoted, setHasVoted] = useState(
        review.helpfulVoters?.includes(user?.uid || '') || false
    );

    const handleHelpfulClick = async () => {
        if (!user || !review.id) {
            return;
        }

        setIsVoting(true);
        try {
            await markReviewHelpful(review.id, user.uid);

            // Optimistic update
            if (hasVoted) {
                setLocalHelpful(prev => (prev ?? 0) - 1);
                setHasVoted(false);
            } else {
                setLocalHelpful(prev => (prev ?? 0) + 1);
                setHasVoted(true);
            }

            onHelpfulUpdate?.();
        } catch (error) {
            console.error('Error marking review helpful:', error);
        } finally {
            setIsVoting(false);
        }
    };

    const renderStars = (rating: number) => {
        return (
            <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                        key={star}
                        className={`w-4 h-4 ${star <= rating
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'fill-muted text-muted-foreground/30'
                            }`}
                    />
                ))}
            </div>
        );
    };

    return (
        <Card className="overflow-hidden transition-all hover:shadow-md">
            <CardContent className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <Avatar>
                            <AvatarImage src={review.customerAvatar} alt={review.customerName} />
                            <AvatarFallback className="bg-primary/10 text-primary">
                                {review.customerName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-semibold">{review.customerName}</p>
                            <p className="text-sm text-muted-foreground">
                                {format(review.createdAt, 'MMM dd, yyyy')}
                            </p>
                        </div>
                    </div>
                    {renderStars(review.rating)}
                </div>

                {/* Title */}
                {review.title && (
                    <h4 className="font-semibold mb-2">{review.title}</h4>
                )}

                {/* Comment */}
                <p className="text-muted-foreground mb-4 leading-relaxed">
                    {review.comment}
                </p>

                {/* Images */}
                {review.images && review.images.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mb-4">
                        {review.images.map((image, index) => (
                            <div
                                key={index}
                                className="relative aspect-square rounded-lg overflow-hidden bg-muted"
                            >
                                <img
                                    src={image}
                                    alt={`Review image ${index + 1}`}
                                    className="object-cover w-full h-full"
                                />
                            </div>
                        ))}
                    </div>
                )}

                {/* Helpful Button */}
                <div className="flex items-center gap-3">
                    <Button
                        variant={hasVoted ? 'default' : 'outline'}
                        size="sm"
                        onClick={handleHelpfulClick}
                        disabled={isVoting || !user}
                        className="gap-2"
                    >
                        <ThumbsUp className="w-4 h-4" />
                        Helpful ({localHelpful})
                    </Button>
                </div>

                {/* Restaurant Response */}
                {review.response && (
                    <div className="mt-4 p-4 bg-secondary/50 rounded-lg border border-border">
                        <div className="flex items-start gap-2 mb-2">
                            <MessageCircle className="w-4 h-4 text-primary mt-0.5" />
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="secondary" className="text-xs">
                                        Restaurant Response
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                        {typeof review.response === 'object' && review.response.respondedAt
                                            ? format(review.response.respondedAt, 'MMM dd, yyyy')
                                            : ''}
                                    </span>
                                </div>
                                <p className="text-sm leading-relaxed">
                                    {typeof review.response === 'object' ? review.response.message : review.response}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
