'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Restaurant } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, Clock, Truck } from 'lucide-react';

interface RestaurantCardProps {
  restaurant: Restaurant;
}

export default function RestaurantCard({ restaurant }: RestaurantCardProps) {
  return (
    <Link href={`/customer/restaurant/${restaurant.id}`}>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer h-full">
        {/* Restaurant Image */}
        <div className="relative w-full h-40 bg-muted">
          <Image
            src={restaurant.image || "/placeholder.svg"}
            alt={restaurant.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
          {!restaurant.isOpen && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="text-white font-semibold">Closed</span>
            </div>
          )}
        </div>

        {/* Restaurant Info */}
        <div className="p-4 space-y-3">
          {/* Name and Rating */}
          <div>
            <h3 className="font-semibold text-foreground text-lg truncate">
              {restaurant.name}
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {restaurant.description}
            </p>
          </div>

          {/* Cuisines */}
          <div className="flex flex-wrap gap-1">
            {((restaurant as any).cuisines || restaurant.cuisineType || []).slice(0, 3).map((cuisine: string, idx: number) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {cuisine}
              </Badge>
            ))}
          </div>

          {/* Rating and Info */}
          <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-primary text-primary" />
              <span className="font-medium text-foreground">
                {restaurant.rating?.toFixed(1) || '4.5'}
              </span>
              <span className="text-muted-foreground">({(restaurant as any).reviews || 0})</span>
            </div>
          </div>

          {/* Delivery Info */}
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{restaurant.deliveryTime}m</span>
            </div>
            <div className="flex items-center gap-1">
              <Truck className="w-3 h-3" />
              <span>₹{restaurant.deliveryCharge}</span>
            </div>
            <span>
              {restaurant.minimumOrder && restaurant.minimumOrder > 0
                ? `Min ₹${restaurant.minimumOrder}`
                : 'No Min Order'}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
