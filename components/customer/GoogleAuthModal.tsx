'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  ShieldCheck,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Zap,
  Lock,
  ArrowRight,
  Info
} from 'lucide-react';

interface GoogleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPopupSignIn: () => Promise<void> | void;
  onRedirectSignIn: () => Promise<void> | void;
  loading: boolean;
  isPopupBlocked?: boolean;
  error?: string;
}

export default function GoogleAuthModal({
  isOpen,
  onClose,
  onPopupSignIn,
  onRedirectSignIn,
  loading,
  isPopupBlocked = false,
  error = '',
}: GoogleAuthModalProps) {
  const [showTroubleshooting, setShowTroubleshooting] = useState(isPopupBlocked);
  const [activeMethod, setActiveMethod] = useState<'redirect' | 'popup' | null>(null);

  const handleRedirect = async () => {
    setActiveMethod('redirect');
    await onRedirectSignIn();
  };

  const handlePopup = async () => {
    setActiveMethod('popup');
    await onPopupSignIn();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open && !loading) {
        onClose();
      }
    }}>
      <DialogContent className="max-w-md w-[92vw] sm:w-full rounded-3xl p-0 overflow-hidden bg-card/95 backdrop-blur-2xl border border-border/80 shadow-2xl">
        {/* Top Glowing Color Accent Bar (Google Brand Spectrum + AKR Orange) */}
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 via-red-500 via-amber-400 via-green-500 to-primary" />

        <div className="p-6 sm:p-7 space-y-5">
          {/* Header with Dual Brand Identity */}
          <DialogHeader className="text-center space-y-3">
            <div className="flex items-center justify-center gap-3 pt-1">
              {/* Hunger Brand Badge */}
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center p-2 shadow-sm ring-2 ring-primary/15 transition-transform hover:scale-105">
                <img src="/hunger.png" alt="Hunger" className="w-full h-full object-contain" />
              </div>

              {/* Connected Glow Icon */}
              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
              </div>

              {/* Google Brand Badge */}
              <div className="w-12 h-12 rounded-2xl bg-muted/60 border border-border flex items-center justify-center p-2.5 shadow-sm ring-2 ring-border/50 transition-transform hover:scale-105">
                <svg className="w-full h-full" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              </div>
            </div>

            <div>
              <DialogTitle className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                Google Authentication
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                Sign in securely with your Google account to access your food orders, saved addresses & exclusive offers.
              </DialogDescription>
            </div>
          </DialogHeader>

          {/* Popup-Blocked Alert Notification (if triggered) */}
          {isPopupBlocked && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-foreground animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="flex-1 text-xs">
                  <span className="font-bold text-amber-700 dark:text-amber-300 block mb-0.5">
                    Browser Blocked the Pop-Up Window
                  </span>
                  <p className="text-muted-foreground leading-relaxed">
                    Modern browsers often block floating pop-ups. Please click the <strong className="text-foreground">Instant Redirect</strong> button below — it works 100% reliably without needing any pop-ups!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error Message (if any) */}
          {error && !isPopupBlocked && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs font-medium flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Authentication Method Options */}
          <div className="space-y-3 pt-1">
            {/* Option 1: Instant Redirect Sign-in (Recommended / 100% Reliable) */}
            <div
              onClick={!loading ? handleRedirect : undefined}
              className={`group relative p-4 rounded-2xl border transition-all cursor-pointer select-none ${
                isPopupBlocked
                  ? 'border-primary bg-primary/10 ring-2 ring-primary/30 shadow-lg shadow-primary/10'
                  : 'border-border hover:border-primary/50 bg-card hover:bg-muted/40 shadow-xs'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                    {loading && activeMethod === 'redirect' ? (
                      <Spinner className="w-5 h-5 text-primary" />
                    ) : (
                      <Zap className="w-5 h-5 fill-primary/20 text-primary" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                        Instant Redirect Sign-In
                      </h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide uppercase bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        Recommended
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      100% reliable • Never blocked by browser pop-up blockers • Best for mobile & strict browsers.
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0 mt-1" />
              </div>
            </div>

            {/* Option 2: Floating Pop-up Window */}
            <div
              onClick={!loading ? handlePopup : undefined}
              className="group relative p-4 rounded-2xl border border-border hover:border-border/80 bg-card/50 hover:bg-muted/30 transition-all cursor-pointer select-none"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted text-foreground flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                    {loading && activeMethod === 'popup' ? (
                      <Spinner className="w-5 h-5 text-foreground" />
                    ) : (
                      <ExternalLink className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-foreground">
                        Floating Pop-up Window
                      </h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-muted-foreground bg-muted border border-border">
                        Quick Window
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      Opens Google login in a floating browser window (requires pop-ups allowed).
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all shrink-0 mt-1" />
              </div>
            </div>
          </div>

          {/* Collapsible Browser Pop-up Unblock Guide */}
          <div className="rounded-2xl border border-border/70 bg-muted/30 overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setShowTroubleshooting(!showTroubleshooting)}
              className="w-full px-3.5 py-2.5 flex items-center justify-between text-muted-foreground hover:text-foreground font-semibold transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-primary" />
                <span>How to allow pop-ups in Chrome / Safari / Brave</span>
              </div>
              {showTroubleshooting ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {showTroubleshooting && (
              <div className="px-3.5 pb-3 pt-1 space-y-2 border-t border-border/50 text-muted-foreground animate-in fade-in duration-200">
                <ol className="list-decimal list-inside space-y-1.5 pl-1 leading-relaxed">
                  <li>
                    Look for the <strong className="text-foreground">Pop-up Blocked (🚫)</strong> icon in the right side of your browser address bar.
                  </li>
                  <li>
                    Click it and choose <strong className="text-foreground">"Always allow pop-ups and redirects"</strong> for this site.
                  </li>
                  <li>
                    Or simply use our <strong className="text-foreground">Instant Redirect Sign-In</strong> above to bypass all pop-ups.
                  </li>
                </ol>
              </div>
            )}
          </div>

          {/* Security & Privacy Notice Footer */}
          <div className="pt-2 text-center space-y-2">
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              <Lock className="w-3 h-3 text-emerald-500" />
              <span>Official Google OAuth 2.0 • End-to-End Encrypted</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={loading}
              onClick={onClose}
              className="w-full text-xs text-muted-foreground hover:text-foreground h-8 cursor-pointer"
            >
              Cancel and Return to Sign In
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
