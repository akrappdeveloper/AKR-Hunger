import { SelectedCustomizationOption } from './types';

export interface ItemCustomizationBadge {
  kind: 'spice' | 'size' | 'addon' | 'note';
  label: string;
  price?: number;
}

export interface ItemCustomizationSummary {
  basePrice: number;
  unitPrice: number;
  sizeExtra: number;
  addOnsTotal: number;
  extrasTotal: number;
  hasCustomizations: boolean;
  badges: ItemCustomizationBadge[];
}

export interface OrderCustomizationTotals {
  baseItemsSubtotal: number;
  sizeExtrasTotal: number;
  addOnsExtrasTotal: number;
  customizationExtrasTotal: number;
  hasPricedExtras: boolean;
}

/**
 * Deterministic key for matching cart items with identical dish + customizations.
 */
export function getItemCustomizationSignature(item: any): string {
  const menuItemId = String(item?.menuItemId || '');
  const spice = String(item?.spiceLevel || '').trim();
  const size = item?.selectedSize?.name
    ? `${item.selectedSize.name}:${Number(item.selectedSize.price || 0)}`
    : '';
  const addons = Array.isArray(item?.selectedAddOns)
    ? item.selectedAddOns
        .map((a: any) => `${a.name}:${Number(a.price || 0)}`)
        .sort()
        .join(',')
    : '';
  const note = String(item?.specialInstructions || '').trim();
  return `${menuItemId}|${spice}|${size}|${addons}|${note}`;
}

export function getItemSizeExtra(item: any): number {
  return Number(item?.selectedSize?.price || 0);
}

export function getItemAddOnsTotal(item: any): number {
  if (!Array.isArray(item?.selectedAddOns)) return 0;
  return item.selectedAddOns.reduce((sum: number, a: any) => sum + Number(a?.price || 0), 0);
}

export function getItemBasePrice(item: any): number {
  const unitPrice = Number(item?.price ?? item?.unitPrice ?? 0);
  if (item?.basePrice !== undefined && item?.basePrice !== null && !Number.isNaN(Number(item.basePrice))) {
    return Number(item.basePrice);
  }
  const extras = getItemSizeExtra(item) + getItemAddOnsTotal(item);
  return extras > 0 ? Math.max(0, unitPrice - extras) : unitPrice;
}

/**
 * Extracts only the customizations the user actually selected/entered for an item.
 */
export function getItemCustomizations(item: any): ItemCustomizationSummary {
  const unitPrice = Number(item?.price ?? item?.unitPrice ?? 0);
  const sizeExtra = getItemSizeExtra(item);
  const addOnsTotal = getItemAddOnsTotal(item);
  const extrasTotal = sizeExtra + addOnsTotal;
  const basePrice = getItemBasePrice(item);

  const badges: ItemCustomizationBadge[] = [];

  if (item?.spiceLevel && String(item.spiceLevel).trim()) {
    badges.push({
      kind: 'spice',
      label: `Spice: ${String(item.spiceLevel).trim()}`,
    });
  }

  if (item?.selectedSize?.name) {
    badges.push({
      kind: 'size',
      label: `Size: ${item.selectedSize.name}`,
      price: Number(item.selectedSize.price || 0),
    });
  }

  if (Array.isArray(item?.selectedAddOns) && item.selectedAddOns.length > 0) {
    for (const addon of item.selectedAddOns) {
      if (addon?.name) {
        badges.push({
          kind: 'addon',
          label: addon.name,
          price: Number(addon.price || 0),
        });
      }
    }
  }

  const note = String(item?.specialInstructions || item?.instructions || '').trim();
  if (note) {
    badges.push({
      kind: 'note',
      label: note,
    });
  }

  return {
    basePrice,
    unitPrice,
    sizeExtra,
    addOnsTotal,
    extrasTotal,
    hasCustomizations: badges.length > 0,
    badges,
  };
}

/**
 * Aggregates base dish totals and optional size/add-on totals for Bill Summary displays.
 */
export function calculateCustomizationTotals(items: any[] = []): OrderCustomizationTotals {
  let baseItemsSubtotal = 0;
  let sizeExtrasTotal = 0;
  let addOnsExtrasTotal = 0;

  for (const item of items) {
    const qty = Number(item?.quantity || 1);
    const base = getItemBasePrice(item);
    const sizeExtra = getItemSizeExtra(item);
    const addOnsExtra = getItemAddOnsTotal(item);

    baseItemsSubtotal += base * qty;
    sizeExtrasTotal += sizeExtra * qty;
    addOnsExtrasTotal += addOnsExtra * qty;
  }

  const customizationExtrasTotal = sizeExtrasTotal + addOnsExtrasTotal;
  return {
    baseItemsSubtotal,
    sizeExtrasTotal,
    addOnsExtrasTotal,
    customizationExtrasTotal,
    hasPricedExtras: customizationExtrasTotal > 0,
  };
}

/**
 * Strips undefined keys from an item object before persisting to Firestore.
 */
export function buildCleanItemPayload<T extends Record<string, any>>(item: T): T {
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(item)) {
    if (value !== undefined) {
      cleaned[key] = value;
    }
  }
  return cleaned as T;
}

export function formatSelectedOptionPrice(price?: number): string {
  const num = Number(price || 0);
  return num > 0 ? `+₹${num.toFixed(num % 1 === 0 ? 0 : 2)}` : 'Standard';
}

export function serializeAddOns(
  addOns?: SelectedCustomizationOption[]
): SelectedCustomizationOption[] | undefined {
  if (!Array.isArray(addOns) || addOns.length === 0) return undefined;
  return addOns.map((a) => ({
    ...(a.id ? { id: a.id } : {}),
    name: a.name,
    price: Number(a.price || 0),
  }));
}
