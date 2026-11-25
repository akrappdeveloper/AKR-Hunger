'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Sparkles, Star, Plus, Store, Clock, Megaphone, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import SafeImage from '@/components/ui/safe-image';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { CampaignAdType } from '@/lib/types';
import {
  ServedAdItem,
  fetchSponsoredAds,
  saveAdAttribution,
  trackAdEvent,
} from '@/lib/campaigns/client-ads';
import { toast } from 'sonner';

function AdImpressionTrigger({
  ad,
  placement,
  userId,
  children,
}: {
  ad: ServedAdItem;
  placement: CampaignAdType;
  userId?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            trackAdEvent({
              eventType: 'IMPRESSION',
              campaignId: ad.campaignId,
              menuItemId: ad.menuItem.id,
              placement,
              userId,
            });
            observer.disconnect();
          }
        });
      },
      { threshold: 0.35 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [ad.campaignId, ad.menuItem.id, placement, userId]);

  return <div ref={ref}>{children}</div>;
}

export function SponsoredHomeAds({
  pincode,
  category,
}: {
  pincode?: string;
  category?: string;
}) {
  const [ads, setAds] = useState<ServedAdItem[]>([]);
  const { addItem } = useCart();
  const { user } = useAuth();

  useEffect(() => {
    let active = true;
    fetchSponsoredAds({
      placement: 'HOME_PAGE',
      pincode,
      category: category && category !== 'all' ? category : undefined,
      limit: 4,
    }).then((items) => {
      if (active) setAds(items);
    });
    return () => {
      active = false;
    };
  }, [pincode, category]);

  if (ads.length === 0) return null;

  const handleAdClick = (ad: ServedAdItem) => {
    saveAdAttribution({
      campaignId: ad.campaignId,
      menuItemId: ad.menuItem.id,
      restaurantId: ad.restaurantId,
      adType: 'HOME_PAGE',
    });
    trackAdEvent({
      eventType: 'CLICK',
      campaignId: ad.campaignId,
      menuItemId: ad.menuItem.id,
      placement: 'HOME_PAGE',
      userId: user?.uid,
    });
  };

  const handleQuickOrder = (e: React.MouseEvent, ad: ServedAdItem) => {
    e.preventDefault();
    e.stopPropagation();
    handleAdClick(ad);
    if (!ad.restaurantIsOpen) {
      toast.error(`${ad.restaurantName} is currently closed.`);
      return;
    }
    addItem({
      id: `${ad.menuItem.id}-${Date.now()}`,
      menuItemId: ad.menuItem.id,
      restaurantId: ad.restaurantId,
      name: ad.menuItem.name,
      price: ad.menuItem.price,
      quantity: 1,
      image: ad.menuItem.image,
      restaurantName: ad.restaurantName,
      addedAt: new Date(),
    });
    toast.success(`Added "${ad.menuItem.name}" to your order`);
  };

  return (
    <section className="space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-sm">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-foreground flex items-center gap-2">
              Sponsored Recommendations
              <Badge
                variant="outline"
                className="text-[10px] font-bold uppercase tracking-wider border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
              >
                Sponsored
              </Badge>
            </h2>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {ads.map((ad) => (
          <AdImpressionTrigger key={`${ad.campaignId}_${ad.menuItem.id}`} ad={ad} placement="HOME_PAGE" userId={user?.uid}>
            <Link
              href={`/customer/product/${ad.menuItem.id}`}
              onClick={() => handleAdClick(ad)}
              className="group block h-full"
            >
              <div className="bg-card border border-amber-500/30 dark:border-amber-500/20 rounded-2xl sm:rounded-3xl overflow-hidden hover:border-amber-500 hover:shadow-xl hover:shadow-amber-500/10 transition-all duration-300 h-full flex flex-col relative">
                <div className="h-44 relative overflow-hidden bg-muted">
                  <SafeImage
                    src={ad.menuItem.image}
                    alt={ad.menuItem.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />

                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full bg-black/75 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider text-amber-300 border border-amber-400/30">
                      Sponsored
                    </span>
                    {ad.offerBadge && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black shadow">
                        {ad.offerBadge}
                      </span>
                    )}
                  </div>

                  <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-white">
                    <span className="text-xs font-semibold flex items-center gap-1 truncate max-w-[70%]">
                      <Store className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      <span className="truncate">{ad.restaurantName}</span>
                    </span>
                    <span className="text-[11px] font-bold flex items-center gap-1 bg-black/55 px-2 py-0.5 rounded-full">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      {ad.menuItem.rating.toFixed(1)}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 flex flex-col justify-between flex-1 gap-3">
                  <div>
                    <h3 className="font-bold text-sm sm:text-base text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                      {ad.menuItem.name}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                      {ad.menuItem.category} • {ad.deliveryTime}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/60">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-base sm:text-lg font-black text-foreground">
                        ₹{ad.menuItem.price}
                      </span>
                      {ad.menuItem.originalPrice && ad.menuItem.originalPrice > ad.menuItem.price && (
                        <span className="text-xs text-muted-foreground line-through">
                          ₹{ad.menuItem.originalPrice}
                        </span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={(e) => handleQuickOrder(e, ad)}
                      className="h-8 px-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold gap-1 cursor-pointer"
                    >
                      Order Now
                    </Button>
                  </div>
                </div>
              </div>
            </Link>
          </AdImpressionTrigger>
        ))}
      </div>
    </section>
  );
}

export function SponsoredSearchAds({
  searchQuery,
  pincode,
}: {
  searchQuery: string;
  pincode?: string;
}) {
  const [ads, setAds] = useState<ServedAdItem[]>([]);
  const { addItem } = useCart();
  const { user } = useAuth();

  useEffect(() => {
    let active = true;
    fetchSponsoredAds({
      placement: 'SEARCH',
      q: searchQuery,
      pincode,
      limit: 3,
    }).then((items) => {
      if (active) setAds(items);
    });
    return () => {
      active = false;
    };
  }, [searchQuery, pincode]);

  if (ads.length === 0) return null;

  const handleClick = (ad: ServedAdItem) => {
    saveAdAttribution({
      campaignId: ad.campaignId,
      menuItemId: ad.menuItem.id,
      restaurantId: ad.restaurantId,
      adType: 'SEARCH',
    });
    trackAdEvent({
      eventType: 'CLICK',
      campaignId: ad.campaignId,
      menuItemId: ad.menuItem.id,
      placement: 'SEARCH',
      userId: user?.uid,
      searchQuery,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Megaphone className="w-4 h-4 text-amber-500" />
        <h3 className="text-sm font-black uppercase tracking-wider text-muted-foreground">
          Sponsored Search Results
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ads.map((ad) => (
          <AdImpressionTrigger key={`${ad.campaignId}_${ad.menuItem.id}`} ad={ad} placement="SEARCH" userId={user?.uid}>
            <Link
              href={`/customer/product/${ad.menuItem.id}`}
              onClick={() => handleClick(ad)}
              className="group flex items-center gap-3.5 p-3.5 rounded-2xl border border-amber-500/35 bg-gradient-to-br from-amber-500/5 via-card to-card hover:border-amber-500 hover:shadow-lg transition-all"
            >
              <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                <SafeImage
                  src={ad.menuItem.image}
                  alt={ad.menuItem.name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform"
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] font-bold px-1.5 py-0">
                    Sponsored
                  </Badge>
                  {ad.offerBadge && (
                    <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-0 text-[10px] font-bold px-1.5 py-0">
                      {ad.offerBadge}
                    </Badge>
                  )}
                </div>
                <h4 className="font-bold text-sm text-foreground truncate group-hover:text-primary">
                  {ad.menuItem.name}
                </h4>
                <p className="text-xs text-muted-foreground truncate">{ad.restaurantName}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-black text-sm text-foreground">₹{ad.menuItem.price}</span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleClick(ad);
                      if (!ad.restaurantIsOpen) {
                        toast.error(`${ad.restaurantName} is currently closed.`);
                        return;
                      }
                      addItem({
                        id: `${ad.menuItem.id}-${Date.now()}`,
                        menuItemId: ad.menuItem.id,
                        restaurantId: ad.restaurantId,
                        name: ad.menuItem.name,
                        price: ad.menuItem.price,
                        quantity: 1,
                        image: ad.menuItem.image,
                        restaurantName: ad.restaurantName,
                        addedAt: new Date(),
                      });
                      toast.success(`Added "${ad.menuItem.name}" to cart`);
                    }}
                    className="h-7 px-2.5 rounded-lg text-xs font-bold gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Add
                  </Button>
                </div>
              </div>
            </Link>
          </AdImpressionTrigger>
        ))}
      </div>
    </div>
  );
}

export function SponsoredProductRelatedAds({
  currentProductId,
  category,
}: {
  currentProductId: string;
  category?: string;
}) {
  const [ads, setAds] = useState<ServedAdItem[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    let active = true;
    fetchSponsoredAds({
      placement: 'PRODUCT_DETAILS',
      category,
      excludeMenuItemId: currentProductId,
      limit: 4,
    }).then((items) => {
      if (active) setAds(items);
    });
    return () => {
      active = false;
    };
  }, [currentProductId, category]);

  if (ads.length === 0) return null;

  return (
    <section className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 mt-12">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <h3 className="text-lg sm:text-xl font-black text-foreground">
            Sponsored Related Items
          </h3>
          <Badge
            variant="outline"
            className="text-[10px] font-bold uppercase tracking-wider border-amber-500/35 bg-amber-500/10 text-amber-600 dark:text-amber-400"
          >
            Sponsored
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
        {ads.map((ad) => (
          <AdImpressionTrigger
            key={`${ad.campaignId}_${ad.menuItem.id}`}
            ad={ad}
            placement="PRODUCT_DETAILS"
            userId={user?.uid}
          >
            <Link
              href={`/customer/product/${ad.menuItem.id}`}
              onClick={() => {
                saveAdAttribution({
                  campaignId: ad.campaignId,
                  menuItemId: ad.menuItem.id,
                  restaurantId: ad.restaurantId,
                  adType: 'PRODUCT_DETAILS',
                });
                trackAdEvent({
                  eventType: 'CLICK',
                  campaignId: ad.campaignId,
                  menuItemId: ad.menuItem.id,
                  placement: 'PRODUCT_DETAILS',
                  userId: user?.uid,
                });
              }}
              className="group block"
            >
              <div className="bg-card rounded-2xl border border-amber-500/30 overflow-hidden hover:border-amber-500 hover:shadow-lg transition-all">
                <div className="relative aspect-[4/3] bg-muted overflow-hidden">
                  <SafeImage
                    src={ad.menuItem.image}
                    alt={ad.menuItem.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/75 text-amber-300 text-[9px] font-bold uppercase tracking-wider">
                    Sponsored
                  </span>
                  <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-lg bg-black/75 text-white text-xs font-black">
                    ₹{ad.menuItem.price}
                  </span>
                </div>
                <div className="p-3">
                  <h4 className="font-bold text-foreground text-xs sm:text-sm truncate group-hover:text-primary transition-colors">
                    {ad.menuItem.name}
                  </h4>
                  <div className="flex items-center justify-between mt-1 text-[11px] text-muted-foreground">
                    <span className="truncate">{ad.restaurantName}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  </div>
                </div>
              </div>
            </Link>
          </AdImpressionTrigger>
        ))}
      </div>
    </section>
  );
}
