'use client';

import { useState } from 'react';
import { Check, X, Tag, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { validatePromotionCode, calculateDiscount } from '@/lib/promotions';
import type { Promotion } from '@/lib/types';

interface PromoCodeInputProps {
    orderTotal: number;
    deliveryCharge: number;
    restaurantId?: string;
    customerId: string;
    onPromoApplied: (promotion: Promotion, discount: number) => void;
    onPromoRemoved: () => void;
    appliedPromotion?: Promotion;
}

export function PromoCodeInput({
    orderTotal,
    deliveryCharge,
    restaurantId,
    customerId,
    onPromoApplied,
    onPromoRemoved,
    appliedPromotion,
}: PromoCodeInputProps) {
    const [code, setCode] = useState('');
    const [isValidating, setIsValidating] = useState(false);
    const [error, setError] = useState('');

    const handleApply = async () => {
        if (!code.trim()) {
            setError('Please enter a promo code');
            return;
        }

        setIsValidating(true);
        setError('');

        try {
            const result = await validatePromotionCode(
                code,
                customerId,
                orderTotal,
                restaurantId
            );

            if (result.valid && result.promotion) {
                const discount = calculateDiscount(
                    result.promotion,
                    orderTotal,
                    deliveryCharge
                );
                onPromoApplied(result.promotion, discount);
                setCode('');
            } else {
                setError(result.error || 'Invalid promo code');
            }
        } catch (err) {
            setError('Failed to apply promo code');
        } finally {
            setIsValidating(false);
        }
    };

    const handleRemove = () => {
        onPromoRemoved();
        setCode('');
        setError('');
    };

    if (appliedPromotion) {
        return (
            <div className="flex items-center gap-3 p-4 border border-green-500/20 bg-green-500/10 rounded-lg">
                <div className="flex items-center gap-2 flex-1">
                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                        <Check className="w-5 h-5 text-green-500" />
                    </div>
                    <div className="flex-1">
                        <p className="font-semibold text-sm">
                            {appliedPromotion.code} Applied
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {appliedPromotion.description}
                        </p>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemove}
                    className="text-muted-foreground hover:text-foreground"
                >
                    <X className="w-4 h-4" />
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Enter promo code"
                        value={code}
                        onChange={(e) => {
                            setCode(e.target.value.toUpperCase());
                            setError('');
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleApply();
                            }
                        }}
                        className="pl-10"
                        disabled={isValidating}
                    />
                </div>
                <Button
                    onClick={handleApply}
                    disabled={isValidating || !code.trim()}
                    className="min-w-[100px]"
                >
                    {isValidating ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Applying...
                        </>
                    ) : (
                        'Apply'
                    )}
                </Button>
            </div>
            {error && (
                <p className="text-sm text-destructive flex items-center gap-1">
                    <X className="w-3 h-3" />
                    {error}
                </p>
            )}
        </div>
    );
}
