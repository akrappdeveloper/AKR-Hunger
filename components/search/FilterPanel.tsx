'use client';

import { useEffect, useState } from 'react';
import { Filter, X } from 'lucide-react';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { getAllCuisineTypes } from '@/lib/search';
import type { SearchFilters } from '@/lib/types';

interface FilterPanelProps {
    filters: SearchFilters;
    onFiltersChange: (filters: Partial<SearchFilters>) => void;
    onClearFilters: () => void;
    activeFilterCount: number;
}

export function FilterPanel({
    filters,
    onFiltersChange,
    onClearFilters,
    activeFilterCount,
}: FilterPanelProps) {
    const [cuisineTypes, setCuisineTypes] = useState<string[]>([]);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const fetchCuisines = async () => {
            const types = await getAllCuisineTypes();
            setCuisineTypes(types);
        };

        fetchCuisines();
    }, []);

    const handleCuisineToggle = (cuisine: string) => {
        const currentCuisines = filters.cuisineTypes || [];
        const newCuisines = currentCuisines.includes(cuisine)
            ? currentCuisines.filter((c) => c !== cuisine)
            : [...currentCuisines, cuisine];

        onFiltersChange({ cuisineTypes: newCuisines });
    };

    const FilterContent = () => (
        <div className="space-y-6 py-4">
            {/* Clear Filters */}
            {activeFilterCount > 0 && (
                <div className="flex items-center justify-between pb-4 border-b">
                    <span className="text-sm font-medium">
                        {activeFilterCount} {activeFilterCount === 1 ? 'filter' : 'filters'} active
                    </span>
                    <Button variant="ghost" size="sm" onClick={onClearFilters}>
                        Clear All
                    </Button>
                </div>
            )}

            {/* Cuisine Types */}
            <div className="space-y-3">
                <Label className="text-base font-semibold">Cuisine Type</Label>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {cuisineTypes.map((cuisine) => (
                        <div key={cuisine} className="flex items-center space-x-2">
                            <Checkbox
                                id={`cuisine-${cuisine}`}
                                checked={filters.cuisineTypes?.includes(cuisine)}
                                onCheckedChange={() => handleCuisineToggle(cuisine)}
                            />
                            <label
                                htmlFor={`cuisine-${cuisine}`}
                                className="text-sm cursor-pointer flex-1"
                            >
                                {cuisine}
                            </label>
                        </div>
                    ))}
                </div>
            </div>

            {/* Minimum Rating */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Minimum Rating</Label>
                    {filters.rating && (
                        <Badge variant="secondary">{filters.rating}+ stars</Badge>
                    )}
                </div>
                <Slider
                    value={[filters.rating || 0]}
                    onValueChange={([value]) => onFiltersChange({ rating: value || undefined })}
                    max={5}
                    min={0}
                    step={0.5}
                    className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Any</span>
                    <span>5 Stars</span>
                </div>
            </div>

            {/* Maximum Delivery Time */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Delivery Time</Label>
                    {filters.deliveryTime && (
                        <Badge variant="secondary">≤ {filters.deliveryTime} min</Badge>
                    )}
                </div>
                <Slider
                    value={[filters.deliveryTime || 60]}
                    onValueChange={([value]) => onFiltersChange({ deliveryTime: value })}
                    max={60}
                    min={15}
                    step={5}
                    className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                    <span>15 min</span>
                    <span>60 min</span>
                </div>
            </div>
        </div>
    );

    return (
        <>
            {/* Mobile: Sheet */}
            <div className="lg:hidden">
                <Sheet open={open} onOpenChange={setOpen}>
                    <SheetTrigger asChild>
                        <Button variant="outline" className="gap-2">
                            <Filter className="w-4 h-4" />
                            Filters
                            {activeFilterCount > 0 && (
                                <Badge variant="secondary" className="ml-1">
                                    {activeFilterCount}
                                </Badge>
                            )}
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-80">
                        <SheetHeader>
                            <SheetTitle>Filters</SheetTitle>
                            <SheetDescription>
                                Refine your restaurant search
                            </SheetDescription>
                        </SheetHeader>
                        <FilterContent />
                    </SheetContent>
                </Sheet>
            </div>

            {/* Desktop: Sidebar */}
            <div className="hidden lg:block w-64 shrink-0">
                <div className="sticky top-4 border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-lg">Filters</h3>
                        {activeFilterCount > 0 && (
                            <Badge variant="secondary">{activeFilterCount}</Badge>
                        )}
                    </div>
                    <FilterContent />
                </div>
            </div>
        </>
    );
}
