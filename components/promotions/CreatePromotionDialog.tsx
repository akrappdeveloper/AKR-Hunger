'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { CalendarIcon, Loader2, Sparkles } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { createPromotion, generatePromotionCode } from '@/lib/promotions';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import type { Promotion } from '@/lib/types';

const promotionSchema = z.object({
    code: z.string().min(4, 'Code must be at least 4 characters'),
    type: z.enum(['percentage', 'fixed', 'free_delivery']),
    value: z.number().min(0),
    description: z.string().min(10, 'Description must be at least 10 characters'),
    minOrderAmount: z.number().min(0).optional(),
    maxDiscount: z.number().min(0).optional(),
    usageLimit: z.number().min(1).optional(),
    perUserLimit: z.number().min(1).optional(),
    validFrom: z.date(),
    validUntil: z.date(),
});

type PromotionFormData = z.infer<typeof promotionSchema>;

interface CreatePromotionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    adminId: string;
    onSuccess?: () => void;
}

export function CreatePromotionDialog({
    open,
    onOpenChange,
    adminId,
    onSuccess,
}: CreatePromotionDialogProps) {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
        setValue,
        watch,
        reset,
    } = useForm<PromotionFormData>({
        resolver: zodResolver(promotionSchema),
        defaultValues: {
            type: 'percentage',
            value: 0,
            validFrom: new Date(),
            validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        },
    });

    const promotionType = watch('type');
    const validFrom = watch('validFrom');
    const validUntil = watch('validUntil');

    const handleGenerateCode = () => {
        const code = generatePromotionCode();
        setValue('code', code);
    };

    const onSubmit = async (data: PromotionFormData) => {
        setIsSubmitting(true);
        try {
            await createPromotion({
                ...data,
                isActive: true,
                createdBy: adminId,
            } as Omit<Promotion, 'id' | 'usageCount' | 'createdAt'>);

            toast({
                title: 'Success!',
                description: 'Promotion created successfully',
            });

            reset();
            onOpenChange(false);
            onSuccess?.();
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to create promotion. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Create New Promotion</DialogTitle>
                    <DialogDescription>
                        Create a promotional code to offer discounts to customers
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    {/* Promotion Code */}
                    <div className="space-y-2">
                        <Label htmlFor="code">Promotion Code *</Label>
                        <div className="flex gap-2">
                            <Input
                                id="code"
                                placeholder="WELCOME20"
                                {...register('code')}
                                className="flex-1"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleGenerateCode}
                                className="gap-2"
                            >
                                <Sparkles className="w-4 h-4" />
                                Generate
                            </Button>
                        </div>
                        {errors.code && (
                            <p className="text-sm text-destructive">{errors.code.message}</p>
                        )}
                    </div>

                    {/* Type */}
                    <div className="space-y-2">
                        <Label>Promotion Type *</Label>
                        <Select
                            value={promotionType}
                            onValueChange={(value: any) => setValue('type', value)}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="percentage">Percentage Discount</SelectItem>
                                <SelectItem value="fixed">Fixed Amount Discount</SelectItem>
                                <SelectItem value="free_delivery">Free Delivery</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Value */}
                    {promotionType !== 'free_delivery' && (
                        <div className="space-y-2">
                            <Label htmlFor="value">
                                {promotionType === 'percentage' ? 'Discount Percentage' : 'Discount Amount (₹)'} *
                            </Label>
                            <Input
                                id="value"
                                type="number"
                                placeholder={promotionType === 'percentage' ? '20' : '50'}
                                {...register('value', { valueAsNumber: true })}
                            />
                            {errors.value && (
                                <p className="text-sm text-destructive">{errors.value.message}</p>
                            )}
                        </div>
                    )}

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="description">Description *</Label>
                        <Textarea
                            id="description"
                            placeholder="Get 20% off on your first order"
                            {...register('description')}
                        />
                        {errors.description && (
                            <p className="text-sm text-destructive">{errors.description.message}</p>
                        )}
                    </div>

                    {/* Min Order Amount */}
                    <div className="space-y-2">
                        <Label htmlFor="minOrderAmount">Minimum Order Amount (₹) - Optional</Label>
                        <Input
                            id="minOrderAmount"
                            type="number"
                            placeholder="100"
                            {...register('minOrderAmount', { valueAsNumber: true })}
                        />
                    </div>

                    {/* Max Discount (for percentage type) */}
                    {promotionType === 'percentage' && (
                        <div className="space-y-2">
                            <Label htmlFor="maxDiscount">Maximum Discount Cap (₹) - Optional</Label>
                            <Input
                                id="maxDiscount"
                                type="number"
                                placeholder="100"
                                {...register('maxDiscount', { valueAsNumber: true })}
                            />
                        </div>
                    )}

                    {/* Usage Limits */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="usageLimit">Total Usage Limit - Optional</Label>
                            <Input
                                id="usageLimit"
                                type="number"
                                placeholder="1000"
                                {...register('usageLimit', { valueAsNumber: true })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="perUserLimit">Per User Limit - Optional</Label>
                            <Input
                                id="perUserLimit"
                                type="number"
                                placeholder="1"
                                {...register('perUserLimit', { valueAsNumber: true })}
                            />
                        </div>
                    </div>

                    {/* Date Range */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Valid From *</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start text-left">
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {validFrom ? format(validFrom, 'PPP') : 'Pick a date'}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={validFrom}
                                        onSelect={(date) => date && setValue('validFrom', date)}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-2">
                            <Label>Valid Until *</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start text-left">
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {validUntil ? format(validUntil, 'PPP') : 'Pick a date'}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={validUntil}
                                        onSelect={(date) => date && setValue('validUntil', date)}
                                        disabled={(date) => date < validFrom}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    {/* Submit */}
                    <div className="flex gap-3 justify-end pt-4">
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
                                    Creating...
                                </>
                            ) : (
                                'Create Promotion'
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
