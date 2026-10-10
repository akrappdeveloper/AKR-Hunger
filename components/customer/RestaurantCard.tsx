'use client';

import * as React from 'react';
import Link from 'next/link';
import { Restaurant } from '@/lib/types';
import SafeImage from '@/components/ui/safe-image';
import { Star, Clock, Bike, MapPin, Sparkles, CheckCircle2 } from 'lucide-react';
import { checkRestaurantOperatingStatus } from '@/lib/restaurant-schedule';

export interface RestaurantCardProps {
  restaurant: Restaurant;
  variant?: 'carousel' | 'grid';
  isPromoted?: boolean;
  currentTime?: Date;
  className?: string;
}

export default function RestaurantCard({
  restaurant,
  variant = 'grid',
  isPromoted = false,
  currentTime,
  className = '',
}: RestaurantCardProps) {
  const current = currentTime || new Date();
  const operatingStatus = checkRestaurantOperatingStatus(restaurant, current);
  const isOpen = operatingStatus.isOpen;

  // Format rating & review counts
  const ratingValue = restaurant.averageRating || restaurant.rating || 4.5;
  const ratingFormatted = ratingValue.toFixed(1);
  const reviewCount = restaurant.totalReviews || restaurant.reviews;

  // Format cuisines
  const cuisines = Array.isArray(restaurant.cuisineType) && restaurant.cuisineType.length > 0
    ? restaurant.cuisineType.slice(0, 3).join(' • ')
    : (restaurant.description || 'Multi-Cuisine');

  // Format location / area
  const areaName = restaurant.street || restaurant.city || (restaurant.address ? restaurant.address.split(',')[0].trim() : 'Local Gourmet');

  // Format delivery time
  const deliveryMins = restaurant.deliveryTime || 30;

  // Delivery charge display
  const deliveryCharge = Number(restaurant.deliveryCharge) || 0;
  const isFreeDelivery = deliveryCharge === 0;

  // Dedicated Brand Logo (square 1:1 icon, no banner)
  const brandLogo = restaurant.imageUrl || restaurant.image || '/hunger.png';

  const cardWidthClass = variant === 'carousel'
    ? 'w-[240px] sm:w-[260px] md:w-[270px] flex-shrink-0 snap-start'
    : 'w-full';

  return (
    <Link
      href={`/customer/restaurant/${restaurant.id}`}
      className={`group block select-none ${cardWidthClass} ${className}`}
    >
      <div className="bg-card text-card-foreground rounded-2xl sm:rounded-3xl border border-border/70 hover:border-primary/50 shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300 p-3.5 sm:p-4 flex flex-col justify-between h-[285px] sm:h-[300px] relative overflow-hidden">
        
        {/* Top Badges Row */}
        <div className="flex items-center justify-between gap-1.5 w-full">
          <div className="flex items-center gap-1.5 flex-wrap">
            {isPromoted && (
              <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-black font-black text-[10px] tracking-wider uppercase px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 fill-black text-black" />
                <span>Featured</span>
              </span>
            )}
            {(restaurant.isPureVeg || restaurant.isVeg) && (
              <span className="bg-emerald-600 text-white font-bold text-[10px] px-1.5 py-0.5 rounded-md shadow-xs flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                <span>Pure Veg</span>
              </span>
            )}
          </div>

          {/* Live Operating Status */}
          <div className="flex-shrink-0">
            {isOpen ? (
              <span className="bg-emerald-600/90 text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-xs uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span>Open</span>
              </span>
            ) : (
              <span className="bg-rose-600/90 text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-xs uppercase tracking-wider flex items-center gap-1">
                <span>Closed</span>
              </span>
            )}
          </div>
        </div>

        {/* Center: Fixed Size Dedicated Brand Logo Icon Container */}
        <div className="my-auto flex flex-col items-center justify-center">
          <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl bg-muted/40 dark:bg-muted/20 border border-border/80 shadow-xs flex items-center justify-center p-2 group-hover:scale-105 group-hover:border-primary/50 group-hover:shadow-md transition-all duration-300">
            <SafeImage
              src={brandLogo}
              alt={`${restaurant.name} logo`}
              fallbackType="restaurant"
              useImgTag={true}
              className="w-full h-full object-contain rounded-xl"
            />
          </div>

          {/* Rating & Delivery Time Pills Strip */}
          <div className="flex items-center justify-center gap-2 mt-2.5">
            {/* Star Rating */}
            <div className="flex items-center gap-1 bg-emerald-600 dark:bg-emerald-500 text-white px-2 py-0.5 rounded-md text-[11px] font-black shadow-xs">
              <Star className="w-3 h-3 fill-white" />
              <span>{ratingFormatted}</span>
              {reviewCount ? (
                <span className="text-[9px] text-emerald-100 font-medium">({reviewCount})</span>
              ) : null}
            </div>

            {/* Delivery Time */}
            <div className="flex items-center gap-1 bg-muted/80 text-foreground px-2 py-0.5 rounded-md text-[11px] font-bold border border-border/60">
              <Clock className="w-3 h-3 text-orange-500" />
              <span>{deliveryMins} mins</span>
            </div>
          </div>
        </div>

        {/* Restaurant Name & Cuisines */}
        <div className="text-center space-y-0.5 px-1">
          <h3 className="font-black text-foreground text-sm sm:text-base group-hover:text-primary transition-colors truncate flex items-center justify-center gap-1.5">
            <span className="truncate">{restaurant.name}</span>
            <CheckCircle2 className="w-4 h-4 text-primary fill-primary/10 flex-shrink-0" />
          </h3>
          <p className="text-xs text-muted-foreground font-medium truncate">
            {cuisines}
          </p>
        </div>

        {/* Bottom Meta Strip: Location & Delivery Charge */}
        <div className="flex items-center justify-between pt-2.5 border-t border-border/60 text-xs text-muted-foreground">
          <div className="flex items-center gap-1 max-w-[55%] truncate">
            <MapPin className="w-3.5 h-3.5 text-primary/70 flex-shrink-0" />
            <span className="truncate">{areaName}</span>
          </div>

          <div className="flex items-center gap-1 font-semibold flex-shrink-0">
            {isFreeDelivery ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                <Bike className="w-3 h-3" /> Free Delivery
              </span>
            ) : (
              <span>₹{deliveryCharge} delivery</span>
            )}
          </div>
        </div>

      </div>
    </Link>
  );
}

