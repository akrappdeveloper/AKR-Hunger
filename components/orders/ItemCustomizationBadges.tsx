'use client';

import React from 'react';
import {
  getItemCustomizations,
  calculateCustomizationTotals,
  formatSelectedOptionPrice,
} from '@/lib/customization-utils';

interface ItemCustomizationBadgesProps {
  item: any;
  compact?: boolean;
}

/**
 * Renders only the customizations (Spice Level, Size + price, Add-ons + price, Special Instructions)
 * that the user explicitly added for an item.
 */
export function ItemCustomizationBadges({ item, compact = false }: ItemCustomizationBadgesProps) {
  const { basePrice, extrasTotal, hasCustomizations, badges } = getItemCustomizations(item);

  if (!hasCustomizations) return null;

  return (
    <div className={compact ? 'mt-1 space-y-1' : 'mt-1.5 space-y-1'}>
      {extrasTotal > 0 && (
        <div className="text-[11px] font-medium text-muted-foreground">
          Base Price: <span className="font-semibold text-foreground">₹{basePrice.toFixed(basePrice % 1 === 0 ? 0 : 2)}</span>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {badges.map((badge, idx) => {
          if (badge.kind === 'spice') {
            return (
              <span
                key={`spice-${idx}`}
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20"
              >
                🌶️ {badge.label}
              </span>
            );
          }

          if (badge.kind === 'size') {
            return (
              <span
                key={`size-${idx}`}
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
              >
                📏 {badge.label}{' '}
                <span className="font-bold">({formatSelectedOptionPrice(badge.price)})</span>
              </span>
            );
          }

          if (badge.kind === 'addon') {
            return (
              <span
                key={`addon-${idx}`}
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20"
              >
                + {badge.label}{' '}
                <span className="font-bold">
                  ({Number(badge.price || 0) > 0 ? `+₹${Number(badge.price)}` : 'Free'})
                </span>
              </span>
            );
          }

          return (
            <span
              key={`note-${idx}`}
              className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
            >
              📝 Note: {badge.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

interface BillCustomizationBreakdownRowsProps {
  items: any[];
  monoValues?: boolean;
}

/**
 * Renders Base Dishes Total, Size Upgrades, and Add-ons & Extras rows in Bill Summary
 * only when the order contains priced item customizations.
 */
export function BillCustomizationBreakdownRows({
  items,
  monoValues = false,
}: BillCustomizationBreakdownRowsProps) {
  const {
    baseItemsSubtotal,
    sizeExtrasTotal,
    addOnsExtrasTotal,
    hasPricedExtras,
  } = calculateCustomizationTotals(items);

  if (!hasPricedExtras) return null;

  const valClass = monoValues
    ? 'font-mono text-foreground'
    : 'text-foreground font-semibold';

  return (
    <>
      <div className="flex justify-between text-muted-foreground text-xs sm:text-sm">
        <span>Base Dishes Price</span>
        <span className={valClass}>₹{baseItemsSubtotal.toFixed(2)}</span>
      </div>
      {sizeExtrasTotal > 0 && (
        <div className="flex justify-between text-blue-600 dark:text-blue-400 text-xs sm:text-sm">
          <span>Size Upgrades</span>
          <span className={monoValues ? 'font-mono font-semibold' : 'font-semibold'}>
            +₹{sizeExtrasTotal.toFixed(2)}
          </span>
        </div>
      )}
      {addOnsExtrasTotal > 0 && (
        <div className="flex justify-between text-primary text-xs sm:text-sm">
          <span>Add-ons &amp; Extras</span>
          <span className={monoValues ? 'font-mono font-semibold' : 'font-semibold'}>
            +₹{addOnsExtrasTotal.toFixed(2)}
          </span>
        </div>
      )}
    </>
  );
}
