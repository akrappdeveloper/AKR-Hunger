'use client';

import { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getActivePromotions } from '@/lib/promotions';
import type { Promotion } from '@/lib/types';
import { format } from 'date-fns';
import { copyToClipboard } from '@/lib/utils';

export function PromotionBanner() {
    const [promotions, setPromotions] = useState<Promotion[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [dismissed, setDismissed] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const fetchPromotions = async () => {
            const activePromos = await getActivePromotions();
            setPromotions(activePromos);
        };

        fetchPromotions();
    }, []);

    useEffect(() => {
        if (promotions.length > 1) {
            const interval = setInterval(() => {
                setCurrentIndex((prev) => (prev + 1) % promotions.length);
            }, 5000); // Auto-advance every 5 seconds

            return () => clearInterval(interval);
        }
    }, [promotions.length]);

    const handleCopy = async (code: string) => {
        await copyToClipboard(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handlePrevious = () => {
        setCurrentIndex((prev) => (prev - 1 + promotions.length) % promotions.length);
    };

    const handleNext = () => {
        setCurrentIndex((prev) => (prev + 1) % promotions.length);
    };

    if (dismissed || promotions.length === 0) {
        return null;
    }

    const currentPromotion = promotions[currentIndex];

    const getDiscountText = (promo: Promotion) => {
        switch (promo.type) {
            case 'percentage':
                return `${promo.value}% OFF`;
            case 'fixed':
                return `₹${promo.value} OFF`;
            case 'free_delivery':
                return 'FREE DELIVERY';
            default:
                return '';
        }
    };

    return (
        <div className="relative w-full bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border-y border-border animate-in slide-in-from-top duration-500">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <div className="flex items-center justify-between gap-4">
                    {/* Dismiss Button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => setDismissed(true)}
                    >
                        <X className="w-4 h-4" />
                    </Button>

                    {/* Content */}
                    <div className="flex-1 flex items-center justify-center gap-4 min-h-[60px]">
                        {/* Navigation - Previous */}
                        {promotions.length > 1 && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                onClick={handlePrevious}
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                        )}

                        {/* Promotion Info */}
                        <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
                            <Badge variant="secondary" className="text-base font-bold px-4 py-1">
                                {getDiscountText(currentPromotion)}
                            </Badge>

                            <div className="flex-1">
                                <p className="font-medium">{currentPromotion.description}</p>
                                <p className="text-xs text-muted-foreground">
                                    Valid until {format(currentPromotion.validUntil, 'MMM dd, yyyy')}
                                </p>
                            </div>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCopy(currentPromotion.code)}
                                className="gap-2 min-w-[120px]"
                            >
                                {copied ? (
                                    <>
                                        <Check className="w-4 h-4" />
                                        Copied!
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-4 h-4" />
                                        {currentPromotion.code}
                                    </>
                                )}
                            </Button>
                        </div>

                        {/* Navigation - Next */}
                        {promotions.length > 1 && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                onClick={handleNext}
                            >
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        )}
                    </div>

                    {/* Spacer for symmetry */}
                    <div className="w-8 shrink-0" />
                </div>

                {/* Indicators */}
                {promotions.length > 1 && (
                    <div className="flex justify-center gap-1.5 mt-2">
                        {promotions.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => setCurrentIndex(index)}
                                className={`h-1.5 rounded-full transition-all ${index === currentIndex
                                        ? 'bg-primary w-6'
                                        : 'bg-primary/30 w-1.5'
                                    }`}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
