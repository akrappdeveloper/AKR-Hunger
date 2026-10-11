'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, BellRing, X, Volume2, Sparkles, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFcmToken } from '@/hooks/use-fcm-token';
import { playNotificationSound, UserRole } from '@/lib/web-push';
import { toast } from 'sonner';

interface PushNotificationPromptBannerProps {
  role?: UserRole;
  className?: string;
}

const ROLE_CONTENT: Record<
  UserRole,
  {
    title: string;
    subtitle: string;
    buttonText: string;
    badgeText: string;
    themeGradient: string;
    accentColor: string;
    iconBg: string;
  }
> = {
  customer: {
    title: 'Enable Live Order Updates 🔔',
    subtitle: 'Get instant notifications & sound alerts for food preparation, live rider GPS, and exclusive hot deals!',
    buttonText: 'Enable Push Notifications',
    badgeText: 'Live Food Tracking',
    themeGradient: 'from-orange-500/15 via-amber-500/10 to-red-500/15 border-orange-500/30',
    accentColor: 'text-orange-500',
    iconBg: 'bg-gradient-to-tr from-orange-500 to-amber-500 text-white shadow-orange-500/30',
  },
  restaurant: {
    title: 'Enable Live Order Alerts 🔔',
    subtitle: 'Hear instant audible chimes and receive lock-screen alerts whenever customers place new orders!',
    buttonText: 'Enable Order Alerts',
    badgeText: 'Instant Kitchen Rings',
    themeGradient: 'from-emerald-500/15 via-teal-500/10 to-green-500/15 border-emerald-500/30',
    accentColor: 'text-emerald-500',
    iconBg: 'bg-gradient-to-tr from-emerald-500 to-teal-500 text-white shadow-emerald-500/30',
  },
  delivery: {
    title: 'Enable Delivery Pickup Pings 🛵',
    subtitle: 'Never miss an order! Get sound alerts and high-priority push notifications when deliveries are assigned.',
    buttonText: 'Enable Delivery Alerts',
    badgeText: 'Pickup Sound Alerts',
    themeGradient: 'from-blue-500/15 via-cyan-500/10 to-indigo-500/15 border-blue-500/30',
    accentColor: 'text-blue-500',
    iconBg: 'bg-gradient-to-tr from-blue-500 to-cyan-500 text-white shadow-blue-500/30',
  },
  admin: {
    title: 'Enable Admin Operations Alerts 🛡️',
    subtitle: 'Stay on top of critical platform alerts, refund approvals, and partner verifications in real-time.',
    buttonText: 'Enable Admin Alerts',
    badgeText: 'Operations Radar',
    themeGradient: 'from-purple-500/15 via-violet-500/10 to-indigo-500/15 border-purple-500/30',
    accentColor: 'text-purple-500',
    iconBg: 'bg-gradient-to-tr from-purple-500 to-violet-500 text-white shadow-purple-500/30',
  },
};

let globalActiveBannerCount = 0;

export default function PushNotificationPromptBanner({
  role: initialRole,
  className = '',
}: PushNotificationPromptBannerProps) {
  const pathname = usePathname();
  const [isPrimaryInstance, setIsPrimaryInstance] = useState(false);

  useEffect(() => {
    if (globalActiveBannerCount === 0) {
      globalActiveBannerCount++;
      setIsPrimaryInstance(true);
    }
    return () => {
      globalActiveBannerCount = Math.max(0, globalActiveBannerCount - 1);
    };
  }, []);

  // Inferred role based on route prefix if not explicitly provided
  const role: UserRole = React.useMemo(() => {
    if (initialRole) return initialRole;
    if (pathname?.startsWith('/restaurant')) return 'restaurant';
    if (pathname?.startsWith('/delivery')) return 'delivery';
    if (pathname?.startsWith('/admin')) return 'admin';
    return 'customer';
  }, [initialRole, pathname]);

  const {
    fcmToken,
    permission,
    loading,
    isSupported,
    requestPermission,
  } = useFcmToken({ role });

  const [dismissed, setDismissed] = useState(true); // default true to avoid hydration flash
  const [justEnabled, setJustEnabled] = useState(false);
  const [showBlockedDialog, setShowBlockedDialog] = useState(false);

  const content = ROLE_CONTENT[role] || ROLE_CONTENT.customer;

  // Check sessionStorage dismissal on client mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storageKey = `hunger_push_prompt_dismissed_${role}`;
    const wasDismissed = sessionStorage.getItem(storageKey) === 'true';

    // Banner should only show if:
    // 1. Web push is supported
    // 2. Permission is 'default' OR (permission is 'granted' but token is still not registered/synced)
    // 3. User hasn't dismissed it this session
    const shouldShow = isSupported && !wasDismissed && (permission === 'default' || (permission === 'granted' && !fcmToken));
    setDismissed(!shouldShow);
  }, [role, isSupported, permission, fcmToken]);

  // Never display push prompt banner on login, signup, or authentication pages
  if (
    pathname?.includes('/login') ||
    pathname?.includes('/signup') ||
    pathname?.includes('/auth')
  ) {
    return null;
  }

  // If another banner instance is already active, don't duplicate
  if (!isPrimaryInstance) {
    return null;
  }

  // When dismissed
  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`hunger_push_prompt_dismissed_${role}`, 'true');
    }
  };

  // When user clicks "Enable Push Notifications"
  const handleEnable = async () => {
    try {
      const res = await requestPermission();
      if (res.success) {
        setJustEnabled(true);
        playNotificationSound();
        toast.success('🎉 Push Notifications enabled successfully!', {
          description: 'You will now receive live alerts with sound even when in another tab.',
        });
        setTimeout(() => {
          handleDismiss();
        }, 2500);
      } else {
        if (res.permission === 'denied') {
          setShowBlockedDialog(true);
          toast.error('Notification permission was blocked in browser settings.');
        } else {
          toast.error(res.error || 'Could not enable notifications. Please try again.');
        }
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to enable notifications');
    }
  };

  // Don't render if unsupported, already granted with token, or dismissed
  if (!isSupported || (permission === 'granted' && fcmToken && !justEnabled) || dismissed) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.96 }}
        transition={{ type: 'spring', damping: 22, stiffness: 280 }}
        className={`fixed z-50 bottom-20 md:bottom-6 right-3 left-3 md:left-auto md:right-6 md:max-w-md ${className}`}
      >
        <div
          className={`relative overflow-hidden rounded-2xl border bg-card/95 backdrop-blur-xl p-4 md:p-5 shadow-2xl transition-all ${content.themeGradient}`}
        >
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-12 -right-12 w-36 h-36 bg-primary/10 rounded-full blur-2xl pointer-events-none" />

          {/* Close Button */}
          <button
            onClick={handleDismiss}
            aria-label="Dismiss notification prompt"
            className="absolute top-3 right-3 p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-start gap-3.5 pr-6">
            {/* Animated Icon */}
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${content.iconBg}`}
            >
              {justEnabled ? (
                <CheckCircle2 className="w-6 h-6 animate-bounce" />
              ) : (
                <BellRing className="w-6 h-6 animate-pulse" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" />
                  {content.badgeText}
                </span>
                {permission === 'denied' && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center gap-1">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    Blocked
                  </span>
                )}
              </div>

              <h4 className="font-semibold text-sm text-foreground tracking-tight">
                {justEnabled ? '🎉 Push Notifications Active!' : content.title}
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                {justEnabled
                  ? 'Your device is now registered for live Web Push notifications & sound chimes.'
                  : content.subtitle}
              </p>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 mt-3.5 flex-wrap">
                {!justEnabled && (
                  <Button
                    size="sm"
                    onClick={handleEnable}
                    disabled={loading}
                    className="h-8 px-3.5 text-xs font-semibold rounded-xl bg-primary text-primary-foreground shadow-md hover:shadow-lg transition-all gap-1.5"
                  >
                    {loading ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        <span>Enabling...</span>
                      </>
                    ) : (
                      <>
                        <Bell className="w-3.5 h-3.5" />
                        <span>{content.buttonText}</span>
                      </>
                    )}
                  </Button>
                )}

                {/* Sound Chime Preview */}
                <button
                  type="button"
                  onClick={() => {
                    playNotificationSound();
                    toast.info('🔔 Played notification audio chime preview');
                  }}
                  className="h-8 px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors inline-flex items-center gap-1"
                  title="Test Sound"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Preview Tone</span>
                </button>

                {!justEnabled && (
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto text-[11px]"
                  >
                    Maybe later
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Blocked Permission Guide if clicked while blocked */}
          {showBlockedDialog && (
            <div className="mt-3 pt-3 border-t border-border/60 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground flex items-center gap-1.5 text-rose-500">
                <AlertTriangle className="w-3.5 h-3.5" /> Notifications are blocked in your browser settings:
              </p>
              <p className="text-[11px]">
                Click the padlock / settings icon next to <strong>https://</strong> in your URL address bar, change <strong>Notifications</strong> to <strong>Allow</strong>, then reload this tab.
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
