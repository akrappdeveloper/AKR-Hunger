import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Recursively converts Firestore documents (including Timestamps and custom prototypes)
 * into plain serializable JavaScript objects for Next.js Client Components.
 * This eliminates the Next.js Flight error:
 * "Only plain objects can be passed to Client Components from Server Components. Objects with toJSON methods are not supported."
 */
export function sanitizeForClient<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  // Handle Firestore Timestamp or Date instances
  if (typeof (data as any)?.toDate === 'function') {
    return (data as any).toDate().toISOString() as any;
  }
  if (typeof (data as any)?.toMillis === 'function') {
    return new Date((data as any).toMillis()).toISOString() as any;
  }
  if (data instanceof Date) {
    return data.toISOString() as any;
  }
  if (
    typeof data === 'object' &&
    'seconds' in (data as any) &&
    typeof (data as any).seconds === 'number' &&
    'nanoseconds' in (data as any)
  ) {
    return new Date((data as any).seconds * 1000).toISOString() as any;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForClient(item)) as any;
  }

  if (typeof data === 'object') {
    const plainObj: any = {};
    for (const [key, value] of Object.entries(data as any)) {
      plainObj[key] = sanitizeForClient(value);
    }
    return plainObj;
  }

  return data;
}

/**
 * Safely copy text to clipboard across all environments:
 * Works in HTTPS, localhost, HTTP LAN (e.g. 192.168.x.x), mobile browsers, and webviews.
 * Never throws "Cannot read properties of undefined (reading 'writeText')".
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // Modern navigator.clipboard API (requires secure context: HTTPS or localhost)
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to fallback
    }
  }

  // Fallback: document.execCommand('copy') with hidden textarea
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, textArea.value.length);
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
}
