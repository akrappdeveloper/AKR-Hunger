'use client';

import { CampaignAdType } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Star, Store, Sparkles, Plus, MapPin, Heart } from 'lucide-react';

interface PreviewProps {
  adType: CampaignAdType;
  restaurantName?: string;
  itemName?: string;
  itemPrice?: number;
  itemImage?: string;
  offerBadge?: string;
  searchQuery?: string;
  itemCount?: number;
  compact?: boolean;
}

export function AdPlacementPreview({
  adType,
  restaurantName = 'Royal Biryani House',
  itemName = 'Hyderabadi Chicken Dum Biryani',
  itemPrice = 289,
  itemImage,
  offerBadge,
  searchQuery,
  itemCount = 1,
  compact = false,
}: PreviewProps) {
  const displayImg =
    itemImage ||
    'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=500&q=80';

  return (
    <div
      className={`rounded-2xl border border-border/80 bg-zinc-950/5 dark:bg-zinc-950/70 overflow-hidden shadow-inner ${
        compact ? 'p-2.5' : 'p-4'
      }`}
    >
      {/* Phone Top Chrome */}
      <div className="bg-card border border-border/70 rounded-xl overflow-hidden shadow-md">
        <div className="px-3 py-2 border-b border-border/60 flex items-center justify-between bg-muted/40">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-foreground">
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            <span>AKR Hunger</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <MapPin className="w-2.5 h-2.5 text-primary" />
            <span>Home • 15 mins</span>
          </div>
        </div>

        {/* HOME PAGE AD MOCKUP */}
        {adType === 'HOME_PAGE' && (
          <div className="p-2.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span className="text-[11px] font-black text-foreground">
                  Sponsored Recommendations
                </span>
              </div>
              <span className="text-[9px] text-muted-foreground">Home Feed</span>
            </div>

            <div className="rounded-xl border border-amber-500/40 bg-card overflow-hidden shadow-sm">
              <div className="relative h-24 sm:h-28 bg-muted">
                <img
                  src={displayImg}
                  alt={itemName}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                <div className="absolute top-2 left-2 flex items-center gap-1">
                  <span className="px-1.5 py-0.5 rounded-full bg-black/80 text-amber-300 text-[9px] font-bold uppercase tracking-wider border border-amber-400/30">
                    Sponsored
                  </span>
                  {offerBadge && (
                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-black">
                      {offerBadge}
                    </span>
                  )}
                </div>
                <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between text-white">
                  <span className="text-[10px] font-semibold flex items-center gap-1 truncate">
                    <Store className="w-2.5 h-2.5 text-amber-400" />
                    {restaurantName}
                  </span>
                  <span className="text-[9px] font-bold bg-black/60 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                    <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" /> 4.7
                  </span>
                </div>
              </div>
              <div className="p-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-foreground truncate">{itemName}</div>
                  <div className="text-xs font-black text-primary">₹{itemPrice}</div>
                </div>
                <Button size="sm" type="button" className="h-7 px-2.5 rounded-lg text-[10px] font-bold pointer-events-none">
                  Order Now
                </Button>
              </div>
            </div>

            {!compact && (
              <div className="grid grid-cols-2 gap-2 opacity-45">
                <div className="h-12 rounded-lg bg-muted/80 border border-border/50 p-2 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="w-16 h-2 bg-muted-foreground/30 rounded" />
                    <div className="w-10 h-2 bg-muted-foreground/20 rounded" />
                  </div>
                  <div className="w-8 h-8 rounded bg-muted-foreground/20" />
                </div>
                <div className="h-12 rounded-lg bg-muted/80 border border-border/50 p-2 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="w-16 h-2 bg-muted-foreground/30 rounded" />
                    <div className="w-10 h-2 bg-muted-foreground/20 rounded" />
                  </div>
                  <div className="w-8 h-8 rounded bg-muted-foreground/20" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* SEARCH AD MOCKUP */}
        {adType === 'SEARCH' && (
          <div className="p-2.5 space-y-2.5">
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/70 border border-border text-[11px] text-foreground">
              <Search className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <span className="truncate font-medium">
                {searchQuery || itemName.split(' ')[0] || 'Biryani'}
              </span>
              <span className="ml-auto text-[9px] text-muted-foreground">Search</span>
            </div>

            {/* Highlighted Sponsored Result */}
            <div className="rounded-xl border border-amber-500/45 bg-gradient-to-br from-amber-500/10 via-card to-card p-2 flex items-center gap-2.5 shadow-sm">
              <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                <img src={displayImg} alt={itemName} className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 mb-0.5">
                  <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[8px] font-bold px-1.5 py-0">
                    Sponsored
                  </Badge>
                  {offerBadge && (
                    <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-0 text-[8px] font-bold px-1 py-0">
                      {offerBadge}
                    </Badge>
                  )}
                </div>
                <div className="text-xs font-bold text-foreground truncate">{itemName}</div>
                <div className="text-[10px] text-muted-foreground truncate">{restaurantName}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs font-black text-foreground">₹{itemPrice}</span>
                  <span className="px-2 py-0.5 rounded bg-primary text-primary-foreground text-[9px] font-bold flex items-center gap-0.5">
                    <Plus className="w-2.5 h-2.5" /> Add
                  </span>
                </div>
              </div>
            </div>

            {/* Organic muted search results */}
            <div className="space-y-1.5 opacity-55">
              <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                Organic Results
              </div>
              <div className="flex items-center gap-2 p-1.5 rounded-lg bg-muted/50 border border-border/50">
                <div className="w-8 h-8 rounded bg-muted-foreground/20 flex-shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="w-24 h-2 bg-muted-foreground/30 rounded" />
                  <div className="w-16 h-1.5 bg-muted-foreground/20 rounded" />
                </div>
                <div className="w-8 h-3 bg-muted-foreground/20 rounded" />
              </div>
            </div>
          </div>
        )}

        {/* PRODUCT DETAILS PAGE AD MOCKUP */}
        {adType === 'PRODUCT_DETAILS' && (
          <div className="p-2.5 space-y-2.5">
            {/* Main Product Details Snippet */}
            <div className="rounded-lg border border-border/60 bg-muted/40 p-2 flex items-center gap-2.5">
              <div className="w-12 h-12 rounded-md bg-muted-foreground/20 flex items-center justify-center text-lg flex-shrink-0">
                🍽️
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[9px] text-muted-foreground uppercase font-bold">
                  Main Dish Viewed by Customer
                </div>
                <div className="text-[11px] font-bold text-foreground truncate">
                  Special Tandoori Platter
                </div>
                <div className="text-[10px] text-muted-foreground">₹340 • Popular Kitchen</div>
              </div>
              <Heart className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            </div>

            {/* Sponsored Related Section */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-foreground flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  Sponsored Related Items
                </span>
                <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[8px] font-bold uppercase">
                  Sponsored
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-amber-500/45 bg-card overflow-hidden shadow-sm">
                  <div className="relative h-16 bg-muted">
                    <img src={displayImg} alt={itemName} className="w-full h-full object-cover" />
                    <span className="absolute top-1 left-1 px-1 py-0.5 rounded bg-black/75 text-amber-300 text-[8px] font-bold">
                      Sponsored
                    </span>
                    <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/75 text-white text-[9px] font-black">
                      ₹{itemPrice}
                    </span>
                  </div>
                  <div className="p-1.5">
                    <div className="text-[10px] font-bold text-foreground truncate">{itemName}</div>
                    <div className="text-[9px] text-muted-foreground truncate">{restaurantName}</div>
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-muted/40 overflow-hidden opacity-60">
                  <div className="h-16 bg-muted-foreground/15" />
                  <div className="p-1.5 space-y-1">
                    <div className="w-16 h-2 bg-muted-foreground/30 rounded" />
                    <div className="w-12 h-1.5 bg-muted-foreground/20 rounded" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {itemCount > 1 && !compact && (
        <p className="text-[11px] text-muted-foreground mt-2 text-center font-medium">
          Previewing primary item (+{itemCount - 1} more selected item{itemCount - 1 > 1 ? 's' : ''} in rotation)
        </p>
      )}
    </div>
  );
}
