'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Order, Restaurant, DeliveryPerson, DeliveryStage,
  getRouteDestination, getStageLabel, formatOrderId
} from '@/lib/types';
import { useTrackDriver } from '@/hooks/useTrackDriver';
import dynamic from 'next/dynamic';
import type { MapMarker } from '@/components/tracking/LiveTrackingMap';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Phone, MapPin, Clock, Bike, ShoppingBag,
  CheckCircle, ChefHat, Package, Navigation, ShieldCheck,
  Store, UtensilsCrossed, Copy, Share2, ExternalLink,
  Timer, Sparkles, Wifi, WifiOff, Gauge, Zap, Route
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { copyToClipboard } from '@/lib/utils';
import { calculateDistance, formatDistance } from '@/lib/gps-tracking';

// ─── Dynamic import for LiveTrackingMap (no SSR) ─────────────────────────────
const LiveTrackingMap = dynamic(
  () => import('@/components/tracking/LiveTrackingMap'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-slate-900 rounded-2xl">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-xs font-semibold">Loading Live Map...</p>
        </div>
      </div>
    ),
  }
);

// ─── Helper: Determine tracking phase from order/delivery stage ───────────────
function getTrackingPhase(order: Order | null): 'to_restaurant' | 'to_customer' | 'delivered' | 'pending' {
  if (!order) return 'pending';
  const stage = order.delivery?.stage as DeliveryStage | undefined;
  const status = order.status;

  if (status === 'delivered') return 'delivered';
  if (status === 'cancelled') return 'delivered'; // stop tracking

  // Stage-based detection (most precise)
  if (stage === 'TO_PICKUP' || stage === 'ARRIVED_PICKUP') return 'to_restaurant';
  if (stage === 'PICKED_UP' || stage === 'TO_CUSTOMER' || stage === 'ARRIVED_CUSTOMER') return 'to_customer';
  if (stage === 'DELIVERED') return 'delivered';

  // Fallback to order status
  if (status === 'out_for_delivery') return 'to_customer';
  if (status === 'preparing' || status === 'ready' || status === 'confirmed' || status === 'pending') return 'to_restaurant';

  return 'pending';
}

// ─── Helper: Get phase color ──────────────────────────────────────────────────
function getPhaseColors(phase: string) {
  switch (phase) {
    case 'to_restaurant':
      return { badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30', dot: 'bg-orange-500', route: 'orange' };
    case 'to_customer':
      return { badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30', dot: 'bg-blue-500', route: 'blue' };
    case 'delivered':
      return { badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-500', route: 'green' };
    default:
      return { badge: 'bg-slate-500/20 text-slate-400 border-slate-500/30', dot: 'bg-slate-500', route: 'gray' };
  }
}

// ─── Animated Running Delivery Bike with Spinning Wheels & Wind Trails ────────
function RunningDeliveryBike({
  isRunning = true,
  speedKmh = 32,
  distanceText,
  phase = 'to_customer',
}: {
  isRunning?: boolean;
  speedKmh?: number | string;
  distanceText?: string | null;
  phase?: string;
}) {
  return (
    <div className="relative flex flex-col items-center select-none">
      {/* ── Floating Live Speed & Distance Tooltip ───────────────────────── */}
      <motion.div
        className="mb-1.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/95 text-white text-[10px] font-black shadow-2xl border border-orange-500/40 backdrop-blur-md whitespace-nowrap z-30"
        initial={{ y: -4, opacity: 0 }}
        animate={{ y: [0, -3, 0], opacity: 1 }}
        transition={{
          y: { repeat: Infinity, duration: 1.4, ease: 'easeInOut' },
          opacity: { duration: 0.3 },
        }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block shrink-0" />
        <span className="text-amber-300 font-mono font-bold tracking-tight">
          {speedKmh} km/h
        </span>
        {distanceText && (
          <>
            <span className="text-white/40">•</span>
            <span className="text-white/90 font-mono text-[9px]">{distanceText}</span>
          </>
        )}
        {/* Tooltip downward pointer arrow */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-950/95" />
      </motion.div>

      {/* ── Vehicle Body + Wheels + Animations ────────────────────────────── */}
      <div className="relative flex items-center justify-center">
        {/* Trailing Wind / Exhaust streaks behind the bike (left side) */}
        {isRunning && (
          <div className="absolute right-full top-1/2 -translate-y-1/2 flex flex-col gap-1 pr-1.5 pointer-events-none">
            <motion.span
              className="h-[2px] bg-gradient-to-l from-orange-400 via-amber-300 to-transparent rounded-full"
              animate={{ width: [16, 6, 16], opacity: [0.9, 0.2, 0.9], x: [0, -8, 0] }}
              transition={{ repeat: Infinity, duration: 0.4, ease: 'linear' }}
            />
            <motion.span
              className="h-[2px] bg-gradient-to-l from-amber-400 via-orange-300 to-transparent rounded-full ml-1"
              animate={{ width: [22, 8, 22], opacity: [1, 0.3, 1], x: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 0.45, delay: 0.08, ease: 'linear' }}
            />
            <motion.span
              className="h-[2px] bg-gradient-to-l from-rose-400 via-amber-200 to-transparent rounded-full"
              animate={{ width: [14, 4, 14], opacity: [0.8, 0.15, 0.8], x: [0, -6, 0] }}
              transition={{ repeat: Infinity, duration: 0.35, delay: 0.15, ease: 'linear' }}
            />
          </div>
        )}

        {/* Headlight beam shining forward (right side) */}
        {isRunning && (
          <div className="absolute left-[85%] top-1/2 -translate-y-1/2 pointer-events-none w-10 h-7 bg-gradient-to-r from-amber-300/50 via-amber-200/20 to-transparent blur-[3px] rounded-r-full" />
        )}

        {/* Radar wave pulse ring around vehicle base */}
        {isRunning && (
          <div className="absolute inset-0 rounded-2xl bg-orange-500/30 animate-ping opacity-60 pointer-events-none" />
        )}

        {/* Animated Bike Container with Road Vibration & Bobbing */}
        <motion.div
          className="relative w-12 h-11 sm:w-13 sm:h-12 rounded-2xl bg-gradient-to-br from-orange-500 via-amber-500 to-rose-500 border-2 border-white shadow-xl shadow-orange-500/40 flex items-center justify-center text-white"
          animate={
            isRunning
              ? {
                y: [0, -3, 0, -1.5, 0],
                rotate: [0, -1.5, 0, 1, 0],
              }
              : { y: 0, rotate: 0 }
          }
          transition={{
            repeat: Infinity,
            duration: 0.6,
            ease: 'easeInOut',
          }}
        >
          {/* Detailed Delivery Scooter SVG */}
          <svg
            viewBox="0 0 64 48"
            className="w-10 h-8 drop-shadow-md"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Delivery Box at Rear */}
            <rect x="5" y="10" width="16" height="15" rx="3" fill="#ea580c" stroke="#fed7aa" strokeWidth="1.5" />
            <path d="M9 17h8M9 20h5" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
            {/* Hunger Mini Logo Dot */}
            <circle cx="13" cy="14" r="1.5" fill="#fef08a" />

            {/* Scooter Chassis / Frame */}
            <path
              d="M18 26h14l8-10h7"
              stroke="#ffffff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M30 26l5-9h7" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />

            {/* Front Handlebars & Mirror */}
            <path d="M47 13l2-5h-4" stroke="#fed7aa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {/* Headlight */}
            <circle cx="50" cy="14" r="3" fill="#fef08a" stroke="#ffffff" strokeWidth="1" />

            {/* Rider Helmet & Body */}
            <circle cx="32" cy="9" r="5" fill="#ffffff" />
            <path d="M33 9h4" stroke="#0284c7" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M26 19c2-5 6-6 10-3l5 5" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />

            {/* Rear Wheel with Rotating Spokes */}
            <g transform="translate(14, 34)">
              <motion.g
                animate={isRunning ? { rotate: 360 } : { rotate: 0 }}
                transition={{ repeat: Infinity, duration: 0.5, ease: 'linear' }}
              >
                <circle cx="0" cy="0" r="9" fill="#0f172a" stroke="#ffffff" strokeWidth="2.5" />
                <circle cx="0" cy="0" r="3.5" fill="#ea580c" />
                <line x1="-7" y1="0" x2="7" y2="0" stroke="#94a3b8" strokeWidth="1.5" />
                <line x1="0" y1="-7" x2="0" y2="7" stroke="#94a3b8" strokeWidth="1.5" />
              </motion.g>
            </g>

            {/* Front Wheel with Rotating Spokes */}
            <g transform="translate(48, 34)">
              <motion.g
                animate={isRunning ? { rotate: 360 } : { rotate: 0 }}
                transition={{ repeat: Infinity, duration: 0.5, ease: 'linear' }}
              >
                <circle cx="0" cy="0" r="9" fill="#0f172a" stroke="#ffffff" strokeWidth="2.5" />
                <circle cx="0" cy="0" r="3.5" fill="#ea580c" />
                <line x1="-7" y1="0" x2="7" y2="0" stroke="#94a3b8" strokeWidth="1.5" />
                <line x1="0" y1="-7" x2="0" y2="7" stroke="#94a3b8" strokeWidth="1.5" />
              </motion.g>
            </g>
          </svg>
        </motion.div>
      </div>

      {/* Road Shadow underneath vehicle */}
      <motion.div
        className="w-10 h-1.5 bg-black/40 rounded-full blur-[1px] mt-0.5"
        animate={isRunning ? { scaleX: [1, 0.85, 1], opacity: [0.6, 0.35, 0.6] } : {}}
        transition={{ repeat: Infinity, duration: 0.6, ease: 'easeInOut' }}
      />
    </div>
  );
}

// ─── Enhanced Delivery Progress Track with Telemetry, High Contrast Road & Bike ──
function DeliveryProgressTrack({
  order,
  phase,
  driverLocation,
  routeInfo,
  restaurantPosition,
  customerPosition,
  driverPosition,
}: {
  order: Order;
  phase: string;
  driverLocation?: any;
  routeInfo?: { distance: string; eta: string } | null;
  restaurantPosition?: { latitude: number; longitude: number } | null;
  customerPosition?: { latitude: number; longitude: number } | null;
  driverPosition?: { latitude: number; longitude: number } | null;
}) {
  // ── Calculate Progress Percentage ──
  const getProgress = () => {
    const stage = order?.delivery?.stage as DeliveryStage | undefined;
    switch (stage) {
      case 'TO_PICKUP': return 25;
      case 'ARRIVED_PICKUP': return 45;
      case 'PICKED_UP': return 58;
      case 'TO_CUSTOMER': return 78;
      case 'ARRIVED_CUSTOMER': return 92;
      case 'DELIVERED': return 100;
      default:
        if (order?.status === 'delivered') return 100;
        if (order?.status === 'out_for_delivery') return 75;
        if (order?.status === 'ready') return 50;
        if (order?.status === 'preparing') return 30;
        if (order?.status === 'confirmed') return 15;
        return 10;
    }
  };
  const progress = getProgress();

  // ── Calculate Distance ──
  const distance = useMemo(() => {
    if (routeInfo?.distance) return routeInfo.distance;

    if (phase === 'to_restaurant' && driverPosition && restaurantPosition) {
      const meters = calculateDistance(
        driverPosition.latitude, driverPosition.longitude,
        restaurantPosition.latitude, restaurantPosition.longitude
      );
      return formatDistance(meters);
    }
    if (phase === 'to_customer' && driverPosition && customerPosition) {
      const meters = calculateDistance(
        driverPosition.latitude, driverPosition.longitude,
        customerPosition.latitude, customerPosition.longitude
      );
      return formatDistance(meters);
    }
    if (restaurantPosition && customerPosition) {
      const meters = calculateDistance(
        restaurantPosition.latitude, restaurantPosition.longitude,
        customerPosition.latitude, customerPosition.longitude
      );
      return formatDistance(meters);
    }
    return '1.8 km';
  }, [routeInfo?.distance, phase, driverPosition, restaurantPosition, customerPosition]);

  // ── Calculate Speed ──
  const speed = useMemo(() => {
    if (order.status === 'delivered' || order.status === 'cancelled') return 0;
    if (driverLocation?.speed && driverLocation.speed > 0) {
      return Math.round(driverLocation.speed);
    }
    const isMoving = phase === 'to_customer' || phase === 'to_restaurant' || order.status === 'out_for_delivery' || order.delivery?.stage === 'TO_CUSTOMER' || order.delivery?.stage === 'TO_PICKUP';
    if (isMoving) {
      return 34; // standard delivery bike cruising speed
    }
    return 0;
  }, [driverLocation?.speed, order.status, phase, order.delivery?.stage]);

  const isRunning = order.status !== 'delivered' && order.status !== 'cancelled' && (
    phase === 'to_customer' || phase === 'to_restaurant' || order.status === 'out_for_delivery' || order.delivery?.stage === 'TO_CUSTOMER' || order.delivery?.stage === 'TO_PICKUP'
  );

  return (
    <div className="space-y-4">
      {/* ── High-Impact Telemetry Metrics Bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Speed Card */}
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-2xl bg-orange-500/10 dark:bg-orange-500/15 border border-orange-500/25">
          <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
            <Gauge className="w-4 h-4 animate-pulse" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Speed</p>
            <p className="text-sm font-black text-foreground font-mono flex items-center gap-1.5 truncate">
              {speed} <span className="text-[10px] font-semibold text-muted-foreground">km/h</span>
              {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping shrink-0" />}
            </p>
          </div>
        </div>

        {/* Distance Card */}
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-2xl bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/25">
          <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Navigation className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Distance</p>
            <p className="text-sm font-black text-foreground font-mono truncate">
              {distance}
            </p>
          </div>
        </div>

        {/* ETA Card */}
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/25">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Est. Time</p>
            <p className="text-sm font-black text-foreground font-mono truncate">
              {routeInfo?.eta || (order.status === 'delivered' ? 'Delivered' : '~15-20m')}
            </p>
          </div>
        </div>

        {/* Progress Card */}
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-2xl bg-purple-500/10 dark:bg-purple-500/15 border border-purple-500/25">
          <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Route className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Journey</p>
            <p className="text-sm font-black text-foreground font-mono truncate">
              {progress}% <span className="text-[10px] font-semibold text-muted-foreground">done</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── High-Contrast Highway Road Track with Running Bike ── */}
      <div className="pt-8 pb-3 px-1">
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Restaurant Terminal Node */}
          <div className="flex flex-col items-center gap-1.5 shrink-0 select-none">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 border-2 border-white/40 shadow-lg shadow-orange-500/30 flex items-center justify-center text-white ring-4 ring-orange-500/20">
              <ChefHat className="w-5 h-5 drop-shadow" />
            </div>
            <span className="text-[10px] sm:text-[11px] text-orange-600 dark:text-orange-400 font-black uppercase tracking-wider">
              Kitchen
            </span>
          </div>

          {/* Road Highway Container */}
          <div className="flex-1 relative h-7 sm:h-8 bg-slate-900 dark:bg-slate-950 border border-slate-700/80 rounded-full shadow-inner overflow-visible">
            {/* Center Dashed Highway Lane Marking */}
            <div className="absolute top-1/2 -translate-y-1/2 left-3 right-3 border-b-2 border-dashed border-white/20 pointer-events-none" />

            {/* Glowing Active Route Segment */}
            <motion.div
              className={`h-full rounded-full relative overflow-hidden shadow-[0_0_18px_rgba(249,115,22,0.65)] ${
                phase === 'to_restaurant'
                  ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400'
                  : phase === 'to_customer'
                    ? 'bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-400'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-400'
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            >
              {/* Traveling Shimmer Light Sweep on active road */}
              {isRunning && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                />
              )}
            </motion.div>

            {/* ── Running Delivery Bike Marker directly on the track ── */}
            <motion.div
              className="absolute top-1/2 -translate-y-1/2 z-20 pointer-events-none"
              animate={{
                left: `calc(${Math.max(6, Math.min(94, progress))}% - 28px)`,
              }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            >
              <RunningDeliveryBike
                isRunning={isRunning}
                speedKmh={speed}
                distanceText={distance}
                phase={phase}
              />
            </motion.div>
          </div>

          {/* Destination / Customer Terminal Node */}
          <div className="flex flex-col items-center gap-1.5 shrink-0 select-none">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 border-2 border-white/40 shadow-lg shadow-emerald-500/30 flex items-center justify-center text-white ring-4 ring-emerald-500/20">
              <MapPin className="w-5 h-5 drop-shadow" />
            </div>
            <span className="text-[10px] sm:text-[11px] text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-wider">
              You
            </span>
          </div>
        </div>
      </div>

      {/* ── Journey Route Waypoint Subline ── */}
      <div className="flex justify-between items-center text-[11px] text-muted-foreground font-semibold px-1 pt-1 border-t border-border/50">
        <span className="flex items-center gap-1 text-orange-600/90 dark:text-orange-400 truncate max-w-[35%]">
          <span>🏪</span> <span className="truncate">{order.restaurantName || 'Kitchen Pickup'}</span>
        </span>
        <span className="text-foreground/80 font-bold flex items-center gap-1 text-center shrink-0">
          {phase === 'to_restaurant' && '🛵 Heading to Restaurant'}
          {phase === 'to_customer' && '🚀 En route to your doorstep'}
          {phase === 'delivered' && '✅ Arrived & Delivered'}
          {phase === 'pending' && '⏳ Order is being prepared'}
        </span>
        <span className="flex items-center gap-1 text-emerald-600/90 dark:text-emerald-400 truncate max-w-[35%] justify-end">
          <span>🏠</span> <span className="truncate">Your Location</span>
        </span>
      </div>
    </div>
  );
}

// ─── ETA Countdown ───────────────────────────────────────────────────────────
function ETATimer({ createdAt, estimatedMins }: { createdAt: any; estimatedMins: number }) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  useEffect(() => {
    const compute = () => {
      if (!createdAt) return;
      const createdDate = createdAt instanceof Date ? createdAt : new Date(createdAt);
      const etaMs = createdDate.getTime() + estimatedMins * 60 * 1000;
      const diff = Math.max(0, Math.floor((etaMs - Date.now()) / 1000));
      setSecondsLeft(diff);
    };
    compute();
    const interval = setInterval(compute, 1000);
    return () => clearInterval(interval);
  }, [createdAt, estimatedMins]);

  if (secondsLeft === null) return null;
  if (secondsLeft === 0) return <span className="text-emerald-400 font-black animate-pulse">Arriving Now!</span>;
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  return (
    <span className="font-mono font-black tabular-nums text-primary text-xl">
      {mins > 0 ? `${mins}m ` : ''}{secs.toString().padStart(2, '0')}s
    </span>
  );
}

// ─── Status Steps ─────────────────────────────────────────────────────────────
const STATUS_STEPS = [
  { key: 'confirmed', label: 'Order Confirmed', icon: ShoppingBag },
  { key: 'preparing', label: 'Cooking', icon: UtensilsCrossed },
  { key: 'ready', label: 'Food Packed', icon: Package },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: Bike },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle },
];

function getStepIndex(status: string) {
  if (status === 'pending') return 0;
  const idx = STATUS_STEPS.findIndex(s => s.key === status);
  return idx === -1 ? 0 : idx;
}

// ─── Connection Status indicator ─────────────────────────────────────────────
function ConnectionBadge({ lastUpdated }: { lastUpdated: Date | null }) {
  const [stale, setStale] = useState(false);
  const [secondsAgo, setSecondsAgo] = useState(0);

  useEffect(() => {
    if (!lastUpdated) return;
    const check = () => {
      const elapsed = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
      setSecondsAgo(elapsed);
      setStale(elapsed > 30);
    };
    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  if (!lastUpdated) return null;

  if (stale) {
    return (
      <div className="flex items-center gap-1.5 text-amber-400 text-[10px] font-mono bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg">
        <WifiOff className="w-3 h-3" />
        Last updated {secondsAgo}s ago
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-mono bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg">
      <Wifi className="w-3 h-3" />
      Live GPS Active
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CustomerOrderTrackingPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = (params.id as string) || '';

  const [order, setOrder] = useState<Order | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [deliveryPerson, setDeliveryPerson] = useState<DeliveryPerson | null>(null);
  const [loading, setLoading] = useState(true);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; eta: string } | null>(null);
  const [driverLastUpdated, setDriverLastUpdated] = useState<Date | null>(null);
  const [mapKey, setMapKey] = useState(0); // to force map remount on phase change

  // Real-time driver location from Firebase
  const { location: driverLocation, loading: locationLoading } = useTrackDriver(
    order?.deliveryPersonId || null
  );

  // Track driver location updates
  useEffect(() => {
    if (driverLocation?.updatedAt) {
      const ts = driverLocation.updatedAt?.toDate?.() ?? new Date(driverLocation.updatedAt);
      setDriverLastUpdated(ts instanceof Date ? ts : new Date());
    }
  }, [driverLocation?.updatedAt]);

  // Real-time Order Subscription
  useEffect(() => {
    if (!orderId) return;
    const unsub = onSnapshot(
      doc(db, 'orders', orderId),
      async (snap) => {
        if (snap.exists()) {
          const data = { ...snap.data(), id: snap.id } as Order;
          if (data.createdAt?.toDate) data.createdAt = data.createdAt.toDate();

          // Auto-generate OTP
          let otp = data.deliveryOtp;
          if (!otp && !['delivered', 'cancelled'].includes(data.status || '')) {
            otp = (Math.abs(orderId.split('').reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) | 0, 0)) % 9000 + 1000).toString();
            data.deliveryOtp = otp;
            updateDoc(doc(db, 'orders', orderId), { deliveryOtp: otp }).catch(() => { });
          }

          setOrder(data);

          // Fetch restaurant
          if (data.restaurantId) {
            try {
              const rSnap = await getDoc(doc(db, 'restaurants', data.restaurantId));
              if (rSnap.exists()) setRestaurant({ ...rSnap.data(), id: rSnap.id } as Restaurant);
            } catch { }
          }
        } else {
          setOrder(null);
        }
        setLoading(false);
      },
      async () => {
        try {
          const snap = await getDoc(doc(db, 'orders', orderId));
          if (snap.exists()) {
            const data = { ...snap.data(), id: snap.id } as Order;
            if (data.createdAt?.toDate) data.createdAt = data.createdAt.toDate();
            setOrder(data);
          }
        } catch { }
        setLoading(false);
      }
    );
    return () => unsub();
  }, [orderId]);

  // Real-time Delivery Partner
  useEffect(() => {
    if (!order?.deliveryPersonId) return;
    const dpUnsub = onSnapshot(
      doc(db, 'deliveryPersons', order.deliveryPersonId),
      (snap) => {
        if (snap.exists()) setDeliveryPerson({ ...snap.data(), id: snap.id } as DeliveryPerson);
      },
      () => { }
    );
    return () => dpUnsub();
  }, [order?.deliveryPersonId]);

  // Determine phase and remount map when phase changes
  const phase = useMemo(() => getTrackingPhase(order), [order?.delivery?.stage, order?.status]);
  const prevPhaseRef = useRef(phase);
  useEffect(() => {
    if (prevPhaseRef.current !== phase) {
      prevPhaseRef.current = phase;
      setMapKey(k => k + 1);
      if (phase === 'to_customer') {
        toast.success('🍱 Food picked up! Driver is heading to you now!', { duration: 4000 });
      }
    }
  }, [phase]);

  // Build map markers
  const mapMarkers = useMemo((): MapMarker[] => {
    const markers: MapMarker[] = [];

    // Restaurant marker
    const restLat = restaurant?.latitude ?? (order as any)?.restaurantLocation?.lat ?? (order as any)?.delivery?.pickup?.latitude;
    const restLng = restaurant?.longitude ?? (order as any)?.restaurantLocation?.lng ?? (order as any)?.delivery?.pickup?.longitude;
    if (restLat && restLng) {
      markers.push({
        id: 'restaurant',
        latitude: restLat,
        longitude: restLng,
        type: 'restaurant',
        label: restaurant?.name || order?.restaurantName || 'Restaurant',
        popup: `<strong>${restaurant?.name || 'Restaurant'}</strong><br/>Pickup Point`,
      });
    }

    // Customer marker
    const custLat = typeof order?.deliveryAddress === 'object'
      ? (order.deliveryAddress as any)?.latitude
      : (order as any)?.delivery?.drop?.latitude;
    const custLng = typeof order?.deliveryAddress === 'object'
      ? (order.deliveryAddress as any)?.longitude
      : (order as any)?.delivery?.drop?.longitude;
    if (custLat && custLng) {
      markers.push({
        id: 'customer',
        latitude: custLat,
        longitude: custLng,
        type: 'customer',
        label: 'Your Location',
        popup: `<strong>Your Delivery Location</strong>`,
      });
    }

    // Driver marker (only for active orders)
    if (driverLocation && order?.status !== 'delivered' && order?.status !== 'cancelled') {
      markers.push({
        id: 'driver',
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
        type: 'driver',
        heading: driverLocation.heading,
        label: order?.deliveryPersonName || 'Driver',
        popup: `<strong>${order?.deliveryPersonName || 'Your Driver'}</strong><br/>🛵 ${Math.round(driverLocation.speed || 0)} km/h`,
      });
    }

    return markers;
  }, [restaurant, order, driverLocation]);

  // Positions for route calculation
  const driverPosition = driverLocation
    ? { latitude: driverLocation.latitude, longitude: driverLocation.longitude }
    : null;

  const restaurantPosition = useMemo(() => {
    const lat = restaurant?.latitude ?? (order as any)?.restaurantLocation?.lat ?? (order as any)?.delivery?.pickup?.latitude;
    const lng = restaurant?.longitude ?? (order as any)?.restaurantLocation?.lng ?? (order as any)?.delivery?.pickup?.longitude;
    return lat && lng ? { latitude: lat, longitude: lng } : null;
  }, [restaurant, order]);

  const customerPosition = useMemo(() => {
    const lat = typeof order?.deliveryAddress === 'object'
      ? (order.deliveryAddress as any)?.latitude
      : (order as any)?.delivery?.drop?.latitude;
    const lng = typeof order?.deliveryAddress === 'object'
      ? (order.deliveryAddress as any)?.longitude
      : (order as any)?.delivery?.drop?.longitude;
    return lat && lng ? { latitude: lat, longitude: lng } : null;
  }, [order]);

  // Route destination
  const routeDestination: 'restaurant' | 'customer' | 'auto' = useMemo(() => {
    if (phase === 'to_restaurant') return 'restaurant';
    if (phase === 'to_customer') return 'customer';
    return 'auto';
  }, [phase]);

  const copyOrderId = () => {
    copyToClipboard(orderId);
    toast.success(`Order ID copied!`);
  };

  const shareTrackingLink = () => {
    const trackingUrl = `https://shunger.vercel.app/customer/orders/tracking/${orderId}`;
    copyToClipboard(trackingUrl);
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      (navigator as any).share({
        title: `Hunger Live Order Tracking #${orderId}`,
        text: `Track your food delivery in real-time on Hunger:`,
        url: trackingUrl,
      }).catch(() => { });
    }
    toast.success('Tracking link copied!');
  };

  // ─── Loading State ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-lg" />
          <p className="text-muted-foreground font-semibold text-sm">Connecting to live satellite tracking...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-3xl p-8 max-w-md w-full text-center shadow-xl">
          <div className="w-16 h-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-foreground mb-1">Order Not Found</h2>
          <p className="text-sm text-muted-foreground mb-6 font-mono">Could not find order #{orderId}.</p>
          <Button onClick={() => router.push('/customer/orders')} className="w-full rounded-2xl font-bold">
            View My Orders
          </Button>
        </div>
      </div>
    );
  }

  const stepIndex = getStepIndex(order.status || 'confirmed');
  const isDelivered = order.status === 'delivered';
  const isCancelled = order.status === 'cancelled';
  const isActive = !isDelivered && !isCancelled;
  const displayId = formatOrderId(order.id || orderId);
  const phaseColors = getPhaseColors(phase);
  const stageLabel = order.delivery?.stage ? getStageLabel(order.delivery.stage as DeliveryStage) : null;

  // Phase label for display
  const phaseLabel = phase === 'to_restaurant'
    ? '🏍️ Driver heading to Restaurant'
    : phase === 'to_customer'
      ? '🚀 Driver heading to You'
      : isDelivered
        ? '🎉 Delivered!'
        : '⏳ Order Processing';

  const hasDriverLocation = !!driverLocation && isActive;

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 font-sans selection:bg-primary/20">

      {/* ── Top Header Bar ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border/70 px-4 py-3 shadow-xs">
        <div className="w-full max-w-[1440px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => router.push('/customer/orders')}
              className="rounded-2xl h-10 w-10 shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-foreground flex items-center gap-1.5">
                  Live Tracking
                  {isActive && <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping inline-block" />}
                </h1>
                <Badge variant="outline" className="font-mono text-xs px-2 py-0.5 bg-muted/60 text-foreground font-bold">
                  #{displayId}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground truncate max-w-[200px] sm:max-w-xs">
                {order.restaurantName || 'Restaurant'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={copyOrderId} title="Copy Order ID"
              className="p-2 rounded-xl border border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <Copy className="w-4 h-4" />
            </button>
            <button onClick={shareTrackingLink} title="Share Tracking Link"
              className="p-2 rounded-xl border border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <Share2 className="w-4 h-4" />
            </button>
            <Button variant="default" size="sm"
              onClick={() => router.push(`/customer/orders/${order.id || orderId}`)}
              className="rounded-xl font-bold text-xs hidden sm:flex items-center gap-1">
              Details <ExternalLink className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="w-full max-w-[1440px] mx-auto px-4 py-6 space-y-5">

        {/* ── LIVE MAP SECTION ────────────────────────────────────────────── */}
        <div className="relative w-full rounded-3xl overflow-hidden border border-white/10 shadow-2xl"
          style={{ height: '380px', background: '#0f172a' }}>

          {/* Map */}
          {isActive ? (
            <LiveTrackingMap
              key={`map-${orderId}-${mapKey}`}
              markers={mapMarkers}
              showRoute={hasDriverLocation}
              driverPosition={driverPosition}
              restaurantPosition={restaurantPosition}
              customerPosition={customerPosition}
              routeDestination={routeDestination}
              followDriver={false}
              height="100%"
              className="w-full h-full"
              onRouteInfo={info => {
                if (info) setRouteInfo({ distance: info.distance, eta: info.eta });
                else setRouteInfo(null);
              }}
            />
          ) : (
            /* Delivered/cancelled state */
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900">
              <div className="text-5xl mb-4">{isDelivered ? '🎉' : '❌'}</div>
              <p className="text-white font-black text-xl">{isDelivered ? 'Order Delivered!' : 'Order Cancelled'}</p>
              <p className="text-slate-400 text-sm mt-1">GPS tracking has ended</p>
            </div>
          )}

          {/* Phase overlay badge — top left */}
          <div className="absolute top-3 right-14 z-20 pointer-events-none">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border backdrop-blur-md bg-black/60 text-xs font-bold ${phaseColors.badge}`}>
              {isActive && <span className={`w-2 h-2 rounded-full ${phaseColors.dot} animate-pulse`} />}
              {phaseLabel}
            </div>
          </div>

          {/* GPS connection indicator — bottom left */}
          {isActive && (
            <div className="absolute bottom-3 left-3 z-20 pointer-events-none">
              <ConnectionBadge lastUpdated={driverLastUpdated} />
            </div>
          )}

          {/* No driver assigned notice */}
          {isActive && !order.deliveryPersonId && (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <div className="bg-black/70 backdrop-blur-md border border-white/10 rounded-2xl px-5 py-3 text-center">
                <div className="text-2xl mb-1">🛵</div>
                <p className="text-white font-bold text-sm">Assigning Delivery Partner</p>
                <p className="text-white/50 text-xs mt-0.5">GPS tracking will start shortly</p>
              </div>
            </div>
          )}

          {/* No driver location but driver assigned */}
          {isActive && order.deliveryPersonId && !driverLocation && !locationLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <div className="bg-black/70 backdrop-blur-md border border-white/10 rounded-2xl px-5 py-3 text-center">
                <div className="text-2xl mb-1">📡</div>
                <p className="text-white font-bold text-sm">Connecting to Driver GPS</p>
                <p className="text-white/50 text-xs mt-0.5">Real-time location coming soon...</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Route Info Bar (Distance + ETA) ─────────────────────────────── */}
        <AnimatePresence>
          {isActive && (routeInfo || hasDriverLocation) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-3 gap-3"
            >
              {/* Phase */}
              <div className="bg-card border border-border rounded-2xl p-3.5 flex flex-col items-center text-center">
                <div className="text-lg mb-1">{phase === 'to_restaurant' ? '🏍️' : phase === 'to_customer' ? '🚀' : '✅'}</div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Phase</p>
                <p className="text-xs font-bold text-foreground mt-0.5 leading-tight">
                  {phase === 'to_restaurant' ? 'To Restaurant' : phase === 'to_customer' ? 'To You' : 'Delivered'}
                </p>
              </div>

              {/* Distance */}
              <div className="bg-card border border-border rounded-2xl p-3.5 flex flex-col items-center text-center">
                <MapPin className="w-4 h-4 text-primary mb-1" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Distance</p>
                <p className="text-sm font-black text-foreground mt-0.5">
                  {routeInfo?.distance ?? (hasDriverLocation ? '...' : '—')}
                </p>
              </div>

              {/* ETA */}
              <div className="bg-card border border-border rounded-2xl p-3.5 flex flex-col items-center text-center">
                <Clock className="w-4 h-4 text-emerald-500 mb-1" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">ETA</p>
                <p className="text-sm font-black text-foreground mt-0.5">
                  {routeInfo?.eta ?? (hasDriverLocation ? '...' : '—')}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Driver Location Detail (speed, heading, accuracy) ────────────── */}
        {isActive && driverLocation && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border/70 rounded-2xl p-4 grid grid-cols-3 gap-3"
          >
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Speed</p>
              <p className="text-base font-black text-foreground">{Math.round(driverLocation.speed || 0)} km/h</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">GPS Acc.</p>
              <p className="text-base font-black text-foreground">{driverLocation.accuracy ? `±${Math.round(driverLocation.accuracy)}m` : '—'}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Heading</p>
              <p className="text-base font-black text-foreground">{driverLocation.heading ? `${Math.round(driverLocation.heading)}°` : '—'}</p>
            </div>
          </motion.div>
        )}

        {/* ── Delivery Progress Track ──────────────────────────────────────── */}
        {isActive && (
          <div className="relative overflow-hidden rounded-3xl border-2 border-orange-500/25 dark:border-orange-500/35 bg-gradient-to-br from-card via-card to-orange-500/5 p-5 sm:p-6 shadow-xl shadow-orange-500/5 space-y-4">
            {/* Ambient background glow orbs */}
            <div className="absolute -top-20 -left-20 w-44 h-44 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -right-20 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Top Multi-Color Glowing Accent Line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-500" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
                  <Bike className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                    Delivery Journey
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  </h3>
                  <p className="text-[11px] text-muted-foreground hidden sm:block">Live GPS vehicle tracking & progress</p>
                </div>
              </div>
              {stageLabel && (
                <Badge variant="outline" className={`text-xs font-bold border px-2.5 py-1 ${phaseColors.badge}`}>
                  {stageLabel}
                </Badge>
              )}
            </div>

            <DeliveryProgressTrack
              order={order}
              phase={phase}
              driverLocation={driverLocation}
              routeInfo={routeInfo}
              restaurantPosition={restaurantPosition}
              customerPosition={customerPosition}
              driverPosition={driverPosition}
            />
          </div>
        )}

        {/* ── Live ETA Card ────────────────────────────────────────────────── */}
        {isActive && (
          <div className="bg-card border border-primary/20 rounded-3xl p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 bg-gradient-to-r from-primary/5 via-card to-primary/5">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                <Timer className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Estimated Delivery Time</p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <ETATimer createdAt={order.createdAt} estimatedMins={(order as any).estimatedDeliveryMinutes || 35} />
                  <span className="text-xs text-muted-foreground">remaining</span>
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm"
              onClick={() => router.push(`/customer/orders/${order.id || orderId}`)}
              className="w-full sm:w-auto rounded-xl text-xs font-bold sm:hidden">
              View Full Details
            </Button>
          </div>
        )}

        {/* ── OTP Security Card ───────────────────────────────────────────── */}
        {isActive && (
          <div className="bg-gradient-to-r from-orange-500/15 via-amber-500/10 to-orange-500/15 border-2 border-orange-500/30 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-orange-600 dark:text-orange-400">Delivery Verification Code</p>
                <p className="text-xs text-muted-foreground mt-0.5">Share this 4-digit OTP with the driver upon arrival.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-3xl sm:text-4xl font-black font-mono tracking-[0.25em] text-foreground bg-card px-4 py-2 rounded-2xl border border-border shadow-inner select-all">
                {order.deliveryOtp || '----'}
              </div>
              <Button variant="outline" size="sm"
                onClick={() => {
                  if (order.deliveryOtp) {
                    copyToClipboard(order.deliveryOtp);
                    toast.success('OTP copied: ' + order.deliveryOtp);
                  }
                }}
                className="h-10 px-3.5 rounded-xl text-xs font-bold gap-1.5 border-orange-500/40 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10">
                <Copy className="w-4 h-4" /> Copy
              </Button>
            </div>
          </div>
        )}

        {/* ── Status Steps ─────────────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-3xl p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> Delivery Steps
          </h2>
          <div className="grid grid-cols-5 gap-2">
            {STATUS_STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isPassed = idx <= stepIndex;
              const isCurrent = idx === stepIndex;
              return (
                <div key={step.key} className="flex flex-col items-center text-center space-y-1.5">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${isPassed
                        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30 scale-105'
                        : 'bg-muted text-muted-foreground border border-border'
                      } ${isCurrent && !isDelivered ? 'ring-4 ring-primary/20 animate-pulse' : ''}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <p className={`text-[11px] font-bold leading-tight line-clamp-2 ${isPassed ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {step.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Driver & Restaurant Cards ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Driver Card */}
          <div className="bg-card border border-border rounded-3xl p-5 shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Bike className="w-4 h-4 text-primary" /> Delivery Partner
                </span>
                <Badge variant="outline" className="text-[10px] font-bold">
                  {order.deliveryPersonName ? 'Assigned' : 'Searching Partner'}
                </Badge>
              </div>

              {order.deliveryPersonName ? (
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-500 flex items-center justify-center font-black text-lg shrink-0">
                    {order.deliveryPersonName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-base text-foreground truncate">{order.deliveryPersonName}</h3>
                    <p className="text-xs text-muted-foreground">
                      {deliveryPerson?.vehicleNumber ? `${deliveryPerson.vehicle ?? ''} • ${deliveryPerson.vehicleNumber}` : 'Verified AKR Rider'}
                    </p>
                    {deliveryPerson?.averageRating && (
                      <p className="text-xs font-bold text-amber-500 flex items-center gap-1 mt-0.5">
                        ★ {deliveryPerson.averageRating.toFixed(1)} / 5.0
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-2">
                  Matching with the closest delivery driver in your area...
                </p>
              )}
            </div>

            {order.deliveryPersonPhone && (
              <a href={`tel:${order.deliveryPersonPhone}`}
                className="w-full py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-sm">
                <Phone className="w-4 h-4" /> Call Driver ({order.deliveryPersonPhone})
              </a>
            )}
          </div>

          {/* Restaurant Card */}
          <div className="bg-card border border-border rounded-3xl p-5 shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Store className="w-4 h-4 text-primary" /> Kitchen Partner
                </span>
                <Badge variant="outline" className="text-[10px] font-bold">Verified</Badge>
              </div>

              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-black text-lg shrink-0">
                  <UtensilsCrossed className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-base text-foreground truncate">{order.restaurantName || restaurant?.name || 'Restaurant'}</h3>
                  <p className="text-xs text-muted-foreground truncate">
                    {order.restaurantAddress || restaurant?.address || 'Pickup Point'}
                  </p>
                </div>
              </div>
            </div>

            {restaurant?.phone && (
              <a href={`tel:${restaurant.phone}`}
                className="w-full py-2.5 rounded-2xl bg-muted hover:bg-muted/80 text-foreground font-bold text-xs flex items-center justify-center gap-2 transition-colors border border-border">
                <Phone className="w-4 h-4 text-muted-foreground" /> Call Restaurant ({restaurant.phone})
              </a>
            )}
          </div>
        </div>

        {/* ── Order Items ──────────────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-3xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <h2 className="text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-primary" /> Order Items ({order.items?.length || 0})
            </h2>
            <span className="text-xs font-black text-primary font-mono text-base">₹{order.total}</span>
          </div>

          <div className="divide-y divide-border/60">
            {order.items?.map((item, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between text-xs sm:text-sm">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center font-bold text-xs border border-border">
                    {item.quantity}x
                  </span>
                  <span className="font-semibold text-foreground">{item.name}</span>
                </div>
                <span className="font-bold text-foreground">₹{item.price * item.quantity}</span>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-border space-y-1.5 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Payment Mode:</span>
              <span className="font-bold text-foreground capitalize">{order.paymentMethod}</span>
            </div>
            <div className="flex justify-between">
              <span>Delivery Address:</span>
              <span className="font-semibold text-foreground text-right max-w-xs truncate">
                {typeof order.deliveryAddress === 'string'
                  ? order.deliveryAddress
                  : `${(order.deliveryAddress as any)?.street || ''}, ${(order.deliveryAddress as any)?.city || ''} ${(order.deliveryAddress as any)?.pincode || ''}`}
              </span>
            </div>
          </div>
        </div>

        {/* ── Delivered State ─────────────────────────────────────────────── */}
        {isDelivered && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/15 border-2 border-emerald-500/30 rounded-3xl p-6 text-center"
          >
            <div className="text-4xl mb-3">🎉</div>
            <h3 className="font-black text-lg text-emerald-600 dark:text-emerald-400">Order Delivered!</h3>
            <p className="text-sm text-muted-foreground mt-1">Enjoy your meal!</p>
            <Button
              className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold"
              onClick={() => router.push(`/customer/orders/${order.id || orderId}`)}
            >
              Rate Your Experience
            </Button>
          </motion.div>
        )}

      </div>
    </div>
  );
}
