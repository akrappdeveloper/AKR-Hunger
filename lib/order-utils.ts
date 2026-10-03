/**
 * Order Utilities
 * Standardizes Order ID generation and formatting across all panels
 * (Customer, Restaurant, Delivery, Admin, Firebase).
 */

/**
 * Generates a real, professional Order ID.
 * Format: 8 uppercase letters followed by 4 digits (e.g., KRIIEFDI4829)
 * Example matches user specification: "KRIIEFDI" + 4-digit number.
 */
export function generateProfessionalOrderId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let letters = '';
  for (let i = 0; i < 8; i++) {
    letters += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const digits = Math.floor(1000 + Math.random() * 9000); // 4-digit number (1000 - 9999)
  return `${letters}${digits}`;
}

/**
 * Formats an order ID for display.
 * If already a 12-char professional ID (e.g. KRIIEFDI4829), preserves it.
 * If legacy 20-char Firestore document ID, displays last 8 characters uppercase.
 */
export function formatOrderId(id: string | undefined | null): string {
  if (!id) return '';
  const trimmed = id.trim();
  // Standard professional ID format: 8 letters + 4 digits (12 chars) or short ID
  if (trimmed.length <= 14) {
    return trimmed.toUpperCase();
  }
  // Legacy random Firestore document ID (20+ chars)
  return trimmed.slice(-8).toUpperCase();
}
