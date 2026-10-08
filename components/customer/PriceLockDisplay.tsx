'use client';

/**
 * Hunger Price Lock Breakdown Component
 * =======================================
 * Shows transparent pricing before checkout.
 * Displays "PRICE LOCKED" badge once locked.
 * Never hides any charges.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Shield, ChevronDown, ChevronUp, Info, CheckCircle2, Clock } from 'lucide-react';
import { PriceLockBreakdown, formatPriceLockDisplay } from '@/lib/price-lock-service';

interface PriceLockDisplayProps {
  breakdown: PriceLockBreakdown;
  isLocked?: boolean;
  onLock?: () => void;
  className?: string;
}

export default function PriceLockDisplay({
  breakdown,
  isLocked = false,
  onLock,
  className,
}: PriceLockDisplayProps) {
  const [expanded, setExpanded] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  // Countdown timer for lock expiry
  useEffect(() => {
    if (!isLocked) return;
    const update = () => {
      const diff = Math.max(0, new Date(breakdown.expiresAt).getTime() - Date.now());
      setTimeLeft(Math.floor(diff / 1000));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [isLocked, breakdown.expiresAt]);

  const rows = formatPriceLockDisplay(breakdown);
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className={`rounded-2xl border overflow-hidden ${
      isLocked
        ? 'border-emerald-500/40 bg-gradient-to-br from-emerald-500/5 to-teal-500/5'
        : 'border-border bg-card'
    } ${className || ''}`}>

      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${isLocked ? 'bg-emerald-500/20' : 'bg-orange-500/15'}`}>
            {isLocked
              ? <Lock className="w-4 h-4 text-emerald-400" />
              : <Shield className="w-4 h-4 text-orange-500" />
            }
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">Price Breakdown</span>
              {isLocked && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium border border-emerald-500/30 flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3 h-3" /> PRICE LOCKED
                </motion.span>
              )}
            </div>
            {isLocked && timeLeft > 0 && (
              <div className="flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Locked for {minutes}:{seconds.toString().padStart(2, '0')}
                </span>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => setExpanded(v => !v)}
          className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors"
        >
          {expanded
            ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
            : <ChevronDown className="w-4 h-4 text-muted-foreground" />
          }
        </button>
      </div>

      {/* Breakdown rows */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-4 pb-2 space-y-2 border-t border-border/50">
              {rows.map((row, i) => (
                <div key={i} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-muted-foreground">{row.label}</span>
                  <span className={`text-sm font-medium ${row.amount < 0 ? 'text-emerald-400' : 'text-foreground'}`}>
                    {row.amount < 0 ? '−' : ''}₹{Math.abs(row.amount).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Total Section */}
      <div className={`px-4 py-4 border-t ${isLocked ? 'border-emerald-500/20' : 'border-border'}`}>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-base font-bold">YOU PAY</span>
            {breakdown.isUnderBudget !== undefined && (
              <div className={`text-xs mt-0.5 ${breakdown.isUnderBudget ? 'text-emerald-400' : 'text-red-400'}`}>
                {breakdown.isUnderBudget
                  ? `✓ ₹${Math.abs(breakdown.remainingBudget || 0).toFixed(0)} under your budget`
                  : `⚠ ₹${Math.abs(breakdown.remainingBudget || 0).toFixed(0)} over budget`
                }
              </div>
            )}
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${isLocked ? 'text-emerald-400' : 'text-orange-500'}`}>
              ₹{breakdown.finalAmount.toFixed(2)}
            </div>
            {breakdown.totalDiscount > 0 && (
              <div className="text-xs text-emerald-400">
                You saved ₹{breakdown.totalDiscount.toFixed(0)}
              </div>
            )}
          </div>
        </div>

        {/* Lock Button */}
        {!isLocked && onLock && (
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={onLock}
            className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold text-sm shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 transition-all"
          >
            <Lock className="w-4 h-4" />
            Lock This Price & Proceed
          </motion.button>
        )}

        {/* No hidden charges guarantee */}
        <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>No hidden charges. What you see is what you pay. Price locked for 15 minutes.</span>
        </div>
      </div>
    </div>
  );
}
