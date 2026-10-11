'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFcmToken } from '@/hooks/use-fcm-token';
import {
  detectBrowserInfo,
  playNotificationSound,
  UserRole,
} from '@/lib/web-push';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Bell,
  BellRing,
  Send,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Sparkles,
  Volume2,
  Copy,
  Check,
  RefreshCw,
  Globe,
  Smartphone,
  Laptop,
  Compass,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface WebPushManagerCardProps {
  role: UserRole;
  title?: string;
  description?: string;
  className?: string;
}

const ROLE_CONFIGS: Record<
  UserRole,
  {
    themeGradient: string;
    badgeColor: string;
    iconBg: string;
    defaultTitle: string;
    defaultDesc: string;
    testPresets: { label: string; title: string; body: string; actionUrl: string }[];
  }
> = {
  customer: {
    themeGradient: 'from-blue-600/15 via-sky-500/10 to-transparent border-blue-500/30',
    badgeColor: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
    iconBg: 'bg-gradient-to-br from-blue-500 to-sky-600 text-white shadow-blue-500/20',
    defaultTitle: 'Customer Web Push Notifications',
    defaultDesc:
      'Get instant alerts on Chrome, Safari, Edge & mobile browsers when your food is cooking, out for delivery with OTP, and delivered.',
    testPresets: [
      {
        label: 'Order Confirmed 👨‍🍳',
        title: 'Order Confirmed! 👨‍🍳',
        body: 'The restaurant has confirmed your meal. Cooking is starting now!',
        actionUrl: '/customer/orders',
      },
      {
        label: 'Out for Delivery 🛵',
        title: 'Food Out for Delivery! 🛵',
        body: 'Driver Amit is on the way with your hot meal! Delivery OTP: 7842.',
        actionUrl: '/customer/orders',
      },
      {
        label: 'Special 50% Deal 🎁',
        title: 'Flash Sale: 50% Off 🍕',
        body: 'Craving pizza? Get flat 50% discount on top restaurants today!',
        actionUrl: '/customer/deals',
      },
    ],
  },
  delivery: {
    themeGradient: 'from-violet-600/15 via-purple-500/10 to-transparent border-violet-500/30',
    badgeColor: 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30',
    iconBg: 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-violet-500/20',
    defaultTitle: 'Rider Web Push Job Alerts',
    defaultDesc:
      'Receive instant sound and vibration alerts across Chrome, Edge, and Safari whenever high-payout orders are ready for pickup.',
    testPresets: [
      {
        label: 'New Delivery Request 🛵',
        title: 'New Delivery Request! 🛵',
        body: 'New order ready for pickup (₹95 payout, 2.4 km). Tap to accept!',
        actionUrl: '/delivery/available',
      },
      {
        label: 'Food Packed at Kitchen 📦',
        title: 'Order Ready for Pickup 📦',
        body: 'Royal Biryani kitchen has packed Order #HNG-482. Ready for pickup.',
        actionUrl: '/delivery/dashboard',
      },
      {
        label: 'Daily Earnings Credited 💰',
        title: 'Weekly Payout Deposited 💰',
        body: '₹4,850.00 successfully transferred to your bank account!',
        actionUrl: '/delivery/wallet',
      },
    ],
  },
  restaurant: {
    themeGradient: 'from-orange-600/15 via-amber-500/10 to-transparent border-orange-500/30',
    badgeColor: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30',
    iconBg: 'bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-orange-500/20',
    defaultTitle: 'Kitchen & Merchant Web Push Alerts',
    defaultDesc:
      'Never miss a customer order! Receive background web push chimes across desktop & mobile browsers even when the tab is closed.',
    testPresets: [
      {
        label: 'New Customer Order 🔔',
        title: 'New Order Received! 🔔',
        body: 'Order #HNG-9921 placed for ₹640 (2x Butter Chicken, 4x Naan). Start cooking!',
        actionUrl: '/restaurant/orders',
      },
      {
        label: 'Rider Arrived 🛵',
        title: 'Delivery Partner Arrived 🛵',
        body: 'Rider Vikram has arrived at your restaurant to collect Order #HNG-9921.',
        actionUrl: '/restaurant/orders',
      },
      {
        label: '5-Star Review Received ⭐',
        title: 'New 5-Star Review! ⭐⭐⭐⭐⭐',
        body: '"Delicious food and fast preparation!" - Customer Priya S.',
        actionUrl: '/restaurant/reviews',
      },
    ],
  },
  admin: {
    themeGradient: 'from-emerald-600/15 via-teal-500/10 to-transparent border-emerald-500/30',
    badgeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-emerald-500/20',
    defaultTitle: 'Admin Web Push Console',
    defaultDesc: 'Platform alerts and system-wide push broadcast tester.',
    testPresets: [],
  },
};

export default function WebPushManagerCard({
  role,
  title,
  description,
  className = '',
}: WebPushManagerCardProps) {
  const {
    fcmToken,
    permission,
    loading,
    browserInfo,
    isSupported,
    requestPermission,
    sendTestPush,
  } = useFcmToken({ role });

  const config = ROLE_CONFIGS[role] || ROLE_CONFIGS.customer;

  // UI state
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customBody, setCustomBody] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [sendingPush, setSendingPush] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [expandedDiagnostics, setExpandedDiagnostics] = useState(false);

  // Handle Enable Push Click
  const handleEnablePush = async () => {
    toast.info('Requesting notification permission...');
    const res = await requestPermission();
    if (res.success) {
      toast.success('🎉 Push Notifications enabled successfully!');
      playNotificationSound();
    } else {
      if (res.permission === 'denied') {
        toast.error('Permission denied. Please unblock notifications in your browser settings.');
        setIsHelpModalOpen(true);
      } else {
        toast.error(res.error || 'Failed to enable notifications');
      }
    }
  };

  // Handle Quick Test Push
  const handleQuickTest = async (preset?: { title: string; body: string; actionUrl: string }) => {
    setSendingPush(true);
    try {
      const pushTitle = preset?.title || customTitle || '🔔 Test Web Push from Hunger';
      const pushBody =
        preset?.body || customBody || 'Web Push Notifications are working perfectly on this browser!';
      const pushUrl = preset?.actionUrl || customUrl || '/';

      const res = await sendTestPush(pushTitle, pushBody, pushUrl);
      if (res.success) {
        toast.success('🚀 Web Push notification dispatched to your browser!');
        playNotificationSound();
        setIsTestModalOpen(false);
      } else {
        toast.error(res.error || 'Failed to dispatch test push');
      }
    } finally {
      setSendingPush(false);
    }
  };

  const handleCopyToken = () => {
    if (!fcmToken) return;
    navigator.clipboard.writeText(fcmToken);
    setCopiedToken(true);
    toast.success('FCM Web Push token copied to clipboard');
    setTimeout(() => setCopiedToken(false), 2500);
  };

  const isGranted = permission === 'granted';
  const isDenied = permission === 'denied';

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border bg-card/90 backdrop-blur-xl p-5 sm:p-6 transition-all duration-300 shadow-md ${config.themeGradient} ${className}`}
    >
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Header Line */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${config.iconBg}`}
          >
            {isGranted ? (
              <BellRing className="w-6 h-6 animate-bounce-subtle" />
            ) : (
              <Bell className="w-6 h-6" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-black text-foreground tracking-tight">
                {title || config.defaultTitle}
              </h2>
              <Badge variant="outline" className={`text-[10px] font-bold ${config.badgeColor}`}>
                Web Push V1
              </Badge>
            </div>

            <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-xl leading-relaxed">
              {description || config.defaultDesc}
            </p>
          </div>
        </div>

        {/* Live Permission Pill */}
        <div className="shrink-0 self-start sm:self-auto flex items-center gap-2">
          {isGranted ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Push Active
            </span>
          ) : isDenied ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
              <XCircle className="w-3.5 h-3.5" />
              Blocked in Browser
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
              <AlertTriangle className="w-3.5 h-3.5" />
              Not Enabled
            </span>
          )}
        </div>
      </div>

      {/* Browser Support Bar */}
      <div className="mt-4 pt-4 border-t border-border/60 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap text-muted-foreground">
          <span className="font-semibold flex items-center gap-1.5 text-foreground">
            <Globe className="w-3.5 h-3.5 text-primary" />
            Detected:
          </span>
          <span className="bg-muted px-2 py-0.5 rounded-lg font-bold text-foreground border border-border/50">
            {browserInfo.browser} ({browserInfo.os})
          </span>

          {/* Cross Browser Badges */}
          <div className="hidden md:flex items-center gap-1.5 pl-2 text-[11px] opacity-80">
            <span className="px-1.5 py-0.5 bg-muted/60 rounded border border-border/40">Chrome</span>
            <span className="px-1.5 py-0.5 bg-muted/60 rounded border border-border/40">Safari</span>
            <span className="px-1.5 py-0.5 bg-muted/60 rounded border border-border/40">Edge</span>
            <span className="px-1.5 py-0.5 bg-muted/60 rounded border border-border/40">Firefox</span>
            <span className="px-1.5 py-0.5 bg-muted/60 rounded border border-border/40">Opera</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => playNotificationSound()}
            className="h-8 px-2.5 rounded-xl text-xs gap-1.5 text-muted-foreground hover:text-foreground"
            title="Test audio chime in this browser"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Test Sound</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsHelpModalOpen(true)}
            className="h-8 px-2.5 rounded-xl text-xs gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Browser Setup</span>
          </Button>

          {!isGranted ? (
            <Button
              onClick={handleEnablePush}
              disabled={loading}
              className="h-9 px-4 rounded-xl text-xs font-bold gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Enabling...</span>
                </>
              ) : (
                <>
                  <BellRing className="w-3.5 h-3.5" />
                  <span>Enable Push Notifications</span>
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={() => setIsTestModalOpen(true)}
              size="sm"
              className="h-9 px-4 rounded-xl text-xs font-bold gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-600/20"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send Test Push Alert</span>
            </Button>
          )}
        </div>
      </div>

      {/* Quick Test Presets (When Granted) */}
      {isGranted && config.testPresets.length > 0 && (
        <div className="mt-4 pt-3 border-t border-dashed border-border/60">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-amber-500" />
              1-Click Live Push Testers:
            </span>
            <button
              onClick={() => setExpandedDiagnostics(!expandedDiagnostics)}
              className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <span>{expandedDiagnostics ? 'Hide Token' : 'Show Token & Diagnostics'}</span>
              {expandedDiagnostics ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {config.testPresets.map((preset, idx) => (
              <button
                key={idx}
                disabled={sendingPush}
                onClick={() => handleQuickTest(preset)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-muted/60 hover:bg-muted text-foreground border border-border/70 whitespace-nowrap transition-all hover:scale-102 active:scale-98 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>{preset.label}</span>
                <Send className="w-3 h-3 text-primary opacity-70" />
              </button>
            ))}
          </div>

          {/* Expandable FCM Token Diagnostics */}
          <AnimatePresence>
            {expandedDiagnostics && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 p-3 bg-muted/40 rounded-2xl border border-border/60 text-xs space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    FCM Registration Token ({role}):
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyToken}
                    className="h-7 px-2 text-[11px] rounded-lg gap-1"
                  >
                    {copiedToken ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" /> Copy Token
                      </>
                    )}
                  </Button>
                </div>
                <div className="font-mono text-[10px] break-all bg-background/80 p-2 rounded-xl border border-border text-foreground/80 max-h-16 overflow-y-auto">
                  {fcmToken || 'Token retrieving or generating...'}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Test Push Modal */}
      <Dialog open={isTestModalOpen} onOpenChange={setIsTestModalOpen}>
        <DialogContent className="max-w-md bg-card border-border text-foreground rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-black text-foreground">
              <Send className="w-5 h-5 text-emerald-500" />
              Send Live Web Push Alert
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Dispatches a real push notification via Firebase Admin to your browser window or system
              notification center.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">
                Notification Title
              </label>
              <Input
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder={config.testPresets[0]?.title || '🔔 New Alert'}
                className="h-10 text-xs rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-foreground block mb-1">
                Notification Body
              </label>
              <textarea
                value={customBody}
                onChange={(e) => setCustomBody(e.target.value)}
                placeholder={config.testPresets[0]?.body || 'Web push notification message content...'}
                className="w-full text-xs p-3 rounded-xl border border-border bg-muted/40 resize-none h-20 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-foreground block mb-1">
                Deep Link Action URL
              </label>
              <Input
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder={config.testPresets[0]?.actionUrl || `/${role}`}
                className="h-10 text-xs rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsTestModalOpen(false)}
              className="rounded-xl text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleQuickTest()}
              disabled={sendingPush}
              className="rounded-xl text-xs font-bold bg-primary text-primary-foreground gap-1.5 shadow-md"
            >
              {sendingPush ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Dispatching...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Notification</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Browser Setup & Troubleshooting Help Modal */}
      <Dialog open={isHelpModalOpen} onOpenChange={setIsHelpModalOpen}>
        <DialogContent className="max-w-lg bg-card border-border text-foreground rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-black text-foreground">
              <Compass className="w-5 h-5 text-primary" />
              Web Push Browser Compatibility Guide
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              How to enable notifications across Chrome, Safari, Microsoft Edge, and Mobile.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Google Chrome & Edge */}
            <div className="p-3 bg-muted/40 rounded-2xl border border-border space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-foreground">
                <Laptop className="w-4 h-4 text-blue-500" />
                <span>Google Chrome & Microsoft Edge (Desktop / Android)</span>
              </div>
              <p className="text-muted-foreground">
                1. Click the lock 🔒 or tune ⚙️ icon in the address bar next to the website URL.
              </p>
              <p className="text-muted-foreground">
                2. Set <strong>Notifications</strong> to <strong>Allow</strong>.
              </p>
              <p className="text-muted-foreground">
                3. Reload the tab and tap "Enable Push Notifications" on this page.
              </p>
            </div>

            {/* Apple Safari on iOS */}
            <div className="p-3 bg-muted/40 rounded-2xl border border-border space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-foreground">
                <Smartphone className="w-4 h-4 text-purple-500" />
                <span>Apple Safari on iPhone / iPad (iOS 16.4+)</span>
              </div>
              <p className="text-muted-foreground">
                1. In Mobile Safari, tap the <strong>Share</strong> button (box with upward arrow).
              </p>
              <p className="text-muted-foreground">
                2. Select <strong>"Add to Home Screen"</strong> and open the Hunger icon from your home screen.
              </p>
              <p className="text-muted-foreground">
                3. Web Push is now active! Tap "Enable Push Notifications" to receive lock-screen alerts.
              </p>
            </div>

            {/* Apple Safari on macOS */}
            <div className="p-3 bg-muted/40 rounded-2xl border border-border space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-foreground">
                <Compass className="w-4 h-4 text-sky-500" />
                <span>Apple Safari on macOS (Ventura / Sonoma / Sequoia)</span>
              </div>
              <p className="text-muted-foreground">
                1. Open <strong>Safari Settings &gt; Websites &gt; Notifications</strong>.
              </p>
              <p className="text-muted-foreground">
                2. Find <strong>Hunger</strong> and set the dropdown to <strong>Allow</strong>.
              </p>
              <p className="text-muted-foreground">
                3. Ensure macOS System Settings &gt; Notifications allows Safari notifications.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => setIsHelpModalOpen(false)}
              className="w-full rounded-xl text-xs font-bold bg-primary text-primary-foreground"
            >
              Got it!
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
