/**
 * Indian GST & State Code Utility
 * Supports all 37 Indian States and Union Territories with official 2-digit GST State Codes.
 */

export interface IndianStateInfo {
  code: string; // 2-digit GST code
  name: string;
}

export const INDIAN_GST_STATES: Record<string, IndianStateInfo> = {
  'JAMMU AND KASHMIR': { code: '01', name: 'Jammu and Kashmir' },
  'HIMACHAL PRADESH': { code: '02', name: 'Himachal Pradesh' },
  'PUNJAB': { code: '03', name: 'Punjab' },
  'CHANDIGARH': { code: '04', name: 'Chandigarh' },
  'UTTARAKHAND': { code: '05', name: 'Uttarakhand' },
  'HARYANA': { code: '06', name: 'Haryana' },
  'DELHI': { code: '07', name: 'Delhi' },
  'RAJASTHAN': { code: '08', name: 'Rajasthan' },
  'UTTAR PRADESH': { code: '09', name: 'Uttar Pradesh' },
  'BIHAR': { code: '10', name: 'Bihar' },
  'SIKKIM': { code: '11', name: 'Sikkim' },
  'ARUNACHAL PRADESH': { code: '12', name: 'Arunachal Pradesh' },
  'NAGALAND': { code: '13', name: 'Nagaland' },
  'MANIPUR': { code: '14', name: 'Manipur' },
  'MIZORAM': { code: '15', name: 'Mizoram' },
  'TRIPURA': { code: '16', name: 'Tripura' },
  'MEGHALAYA': { code: '17', name: 'Meghalaya' },
  'ASSAM': { code: '18', name: 'Assam' },
  'WEST BENGAL': { code: '19', name: 'West Bengal' },
  'JHARKHAND': { code: '20', name: 'Jharkhand' },
  'ODISHA': { code: '21', name: 'Odisha' },
  'CHHATTISGARH': { code: '22', name: 'Chhattisgarh' },
  'MADHYA PRADESH': { code: '23', name: 'Madhya Pradesh' },
  'GUJARAT': { code: '24', name: 'Gujarat' },
  'DADRA AND NAGAR HAVELI AND DAMAN AND DIU': { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu' },
  'MAHARASHTRA': { code: '27', name: 'Maharashtra' },
  'ANDHRA PRADESH': { code: '28', name: 'Andhra Pradesh' },
  'KARNATAKA': { code: '29', name: 'Karnataka' },
  'GOA': { code: '30', name: 'Goa' },
  'LAKSHADWEEP': { code: '31', name: 'Lakshadweep' },
  'KERALA': { code: '32', name: 'Kerala' },
  'TAMIL NADU': { code: '33', name: 'Tamil Nadu' },
  'PUDUCHERRY': { code: '34', name: 'Puducherry' },
  'ANDAMAN AND NICOBAR ISLANDS': { code: '35', name: 'Andaman and Nicobar Islands' },
  'TELANGANA': { code: '36', name: 'Telangana' },
  'ANDHRA PRADESH (NEW)': { code: '37', name: 'Andhra Pradesh' },
  'LADAKH': { code: '38', name: 'Ladakh' },
};

/**
 * Normalizes state name string and resolves official 2-digit GST code
 */
export function resolveStateCode(stateName?: string | null): IndianStateInfo {
  if (!stateName || typeof stateName !== 'string') {
    return { code: '09', name: 'Uttar Pradesh' }; // Default platform origin if unspecified
  }

  const clean = stateName.trim().toUpperCase();

  // Exact match
  if (INDIAN_GST_STATES[clean]) {
    return INDIAN_GST_STATES[clean];
  }

  // Substring match
  const foundKey = Object.keys(INDIAN_GST_STATES).find(k => clean.includes(k) || k.includes(clean));
  if (foundKey) {
    return INDIAN_GST_STATES[foundKey];
  }

  // Check common abbreviations
  if (clean === 'UP' || clean === 'U.P.') return { code: '09', name: 'Uttar Pradesh' };
  if (clean === 'DL' || clean === 'DELHI NCT' || clean === 'NEW DELHI') return { code: '07', name: 'Delhi' };
  if (clean === 'MH' || clean === 'M.H.') return { code: '27', name: 'Maharashtra' };
  if (clean === 'KA' || clean === 'K.A.') return { code: '29', name: 'Karnataka' };
  if (clean === 'TN' || clean === 'T.N.') return { code: '33', name: 'Tamil Nadu' };
  if (clean === 'WB' || clean === 'W.B.') return { code: '19', name: 'West Bengal' };
  if (clean === 'TS' || clean === 'TG') return { code: '36', name: 'Telangana' };
  if (clean === 'HR') return { code: '06', name: 'Haryana' };
  if (clean === 'PB') return { code: '03', name: 'Punjab' };
  if (clean === 'GJ') return { code: '24', name: 'Gujarat' };
  if (clean === 'MP') return { code: '23', name: 'Madhya Pradesh' };
  if (clean === 'RJ') return { code: '08', name: 'Rajasthan' };

  return { code: '09', name: stateName.trim() };
}

/**
 * Formats Place of Supply string, e.g. "Uttar Pradesh (09)"
 */
export function formatPlaceOfSupply(stateName?: string | null): string {
  const info = resolveStateCode(stateName);
  return `${info.name} (${info.code})`;
}

/**
 * Convert number in Indian Rupees to Words
 * Supports Rupees and Paise e.g. "Five Hundred Forty Rupees and Fifty Paise Only"
 */
export function numberToWordsINR(amount: number): string {
  if (!isFinite(amount) || isNaN(amount) || amount <= 0) {
    return 'Zero Rupees Only';
  }

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 
                'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwoDigits(num: number): string {
    if (num < 20) return ones[num];
    const unit = num % 10;
    return tens[Math.floor(num / 10)] + (unit ? ' ' + ones[unit] : '');
  }

  function convertThreeDigits(num: number): string {
    let str = '';
    const hundred = Math.floor(num / 100);
    const rest = num % 100;
    if (hundred > 0) {
      str += ones[hundred] + ' Hundred';
      if (rest > 0) str += ' ';
    }
    if (rest > 0) {
      str += convertTwoDigits(rest);
    }
    return str.trim();
  }

  const rounded = Math.round(amount * 100) / 100;
  const rupeePart = Math.floor(rounded);
  const paisePart = Math.round((rounded - rupeePart) * 100);

  let result = '';

  const crore = Math.floor(rupeePart / 10000000);
  const lakh = Math.floor((rupeePart % 10000000) / 100000);
  const thousand = Math.floor((rupeePart % 100000) / 1000);
  const remainder = rupeePart % 1000;

  if (crore > 0) result += convertThreeDigits(crore) + ' Crore ';
  if (lakh > 0) result += convertTwoDigits(lakh) + ' Lakh ';
  if (thousand > 0) result += convertTwoDigits(thousand) + ' Thousand ';
  if (remainder > 0) result += convertThreeDigits(remainder) + ' ';

  result = result.trim();
  if (!result) {
    result = 'Zero';
  }

  result += ' Rupees';

  if (paisePart > 0) {
    result += ' and ' + convertTwoDigits(paisePart) + ' Paise';
  }

  result += ' Only';

  return result.replace(/\s+/g, ' ').trim();
}

/**
 * Mask string for safe non-sensitive public display (e.g. on QR verification screen)
 */
export function maskPhone(phone?: string | null): string {
  if (!phone) return 'Verified Customer';
  const clean = phone.replace(/\D/g, '');
  if (clean.length >= 10) {
    const last3 = clean.slice(-3);
    const first2 = clean.slice(0, 2);
    return `+91 ${first2}*** ***${last3}`;
  }
  return '*** ***' + phone.slice(-3);
}

export function maskEmail(email?: string | null): string {
  if (!email || !email.includes('@')) return '';
  const [user, domain] = email.split('@');
  const visible = user.slice(0, 2);
  return `${visible}***@${domain}`;
}

/**
 * Deterministic cryptographic verification seal hash for authentic invoices
 */
export function generateInvoiceVerificationHash(
  invoiceNumber: string,
  orderId: string,
  grandTotal: number,
  timestamp: string
): string {
  const payload = `${invoiceNumber}|${orderId}|${grandTotal.toFixed(2)}|${timestamp}|AKR_TAX_SEC_2026`;
  let hash1 = 0x811c9dc5;
  let hash2 = 0x27d4eb2f;
  for (let i = 0; i < payload.length; i++) {
    const char = payload.charCodeAt(i);
    hash1 ^= char;
    hash1 = Math.imul(hash1, 0x01000193);
    hash2 ^= char;
    hash2 = Math.imul(hash2, 0x5bd1e995);
  }
  const h1 = (hash1 >>> 0).toString(16).padStart(8, '0').toUpperCase();
  const h2 = (hash2 >>> 0).toString(16).padStart(8, '0').toUpperCase();
  return `${h1.slice(0, 4)}-${h1.slice(4, 8)}-${h2.slice(0, 4)}-${h2.slice(4, 8)}`;
}

