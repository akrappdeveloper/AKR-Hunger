'use client';

import React from 'react';

/**
 * 1. Unified Payments Interface (NPCI UPI)
 * Authentic angled green & orange arrows with bold italic typography
 */
export function UpiIcon({ className = 'h-4 w-auto' }: { className?: string }) {
  return (
    <svg viewBox="0 0 62 20" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="UPI">
      {/* Green Chevron Arrow */}
      <path d="M12.5 2.5L4 17.5H9L13 10.5H18L20.2 6.5H13.8L15.3 2.5H12.5Z" fill="#097939" />
      {/* Orange Chevron Arrow */}
      <path d="M19.5 2.5L11 17.5H16L20 10.5H25L27.2 6.5H20.8L22.3 2.5H19.5Z" fill="#ED7524" />
      {/* UPI Wordmark */}
      <text
        x="30"
        y="15"
        fill="currentColor"
        fontSize="13"
        fontWeight="900"
        fontStyle="italic"
        letterSpacing="-0.5"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        UPI
      </text>
    </svg>
  );
}

/**
 * 2. Google Pay (GPay)
 * Authentic Google 4-color 'G' + 'Pay' wordmark
 */
export function GPayIcon({ className = 'h-4 w-auto' }: { className?: string }) {
  return (
    <svg viewBox="0 0 56 20" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Google Pay">
      <g transform="translate(1, 2)">
        <path d="M7.8 3.5c1.1 0 2.2.4 3 1.1l2.2-2.2C11.6 1.4 9.8.7 7.8.7 4.8.7 2.2 2.4.9 4.9l2.6 2c.6-1.9 2.3-3.4 4.3-3.4z" fill="#EA4335" />
        <path d="M14.7 7.8c0-.5-.1-1.1-.2-1.5H7.8v3h3.9c-.2 1-.7 1.9-1.5 2.5l2.5 2c1.5-1.4 2-3.5 2-6z" fill="#4285F4" />
        <path d="M3.5 7.1c-.2.6-.3 1.3-.3 2s.1 1.4.3 2L.9 13.1C.3 11.9 0 10.5 0 9.1s.3-2.8.9-4L3.5 7.1z" fill="#FBBC05" />
        <path d="M7.8 15.3c2 0 3.8-.7 5.1-1.8l-2.5-2c-.7.5-1.6.8-2.6.8-2 0-3.7-1.4-4.3-3.4L.9 11c1.3 2.5 3.9 4.3 6.9 4.3z" fill="#34A853" />
      </g>
      <text x="19" y="15" fill="currentColor" fontSize="12" fontWeight="700" letterSpacing="-0.3" fontFamily="system-ui, sans-serif">
        Pay
      </text>
    </svg>
  );
}

/**
 * 3. PhonePe
 * Official deep indigo-purple disc with authentic stylized 'पे' ligature
 */
export function PhonePeIcon({ className = 'h-4 w-auto' }: { className?: string }) {
  return (
    <svg viewBox="0 0 70 20" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="PhonePe">
      <circle cx="10" cy="10" r="9" fill="#5F259F" />
      <path d="M10 5v10M10 5c2.5 0 4 1.2 4 2.8s-1.5 2.8-4 2.8H7.8v4.4" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.2 5.5l3.4 8" stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round" />
      <text x="23" y="14.5" fill="currentColor" fontSize="11" fontWeight="800" letterSpacing="-0.3" fontFamily="system-ui, sans-serif">
        PhonePe
      </text>
    </svg>
  );
}

/**
 * 4. Paytm
 * Official dark navy 'Pay' + vibrant cyan 'tm'
 */
export function PaytmIcon({ className = 'h-4 w-auto' }: { className?: string }) {
  return (
    <svg viewBox="0 0 54 20" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Paytm">
      <text x="1" y="15" fill="#002970" className="dark:fill-[#4A90E2]" fontSize="13" fontWeight="900" fontStyle="italic" letterSpacing="-0.5" fontFamily="system-ui, sans-serif">
        Pay
      </text>
      <text x="26" y="15" fill="#00BAF2" fontSize="13" fontWeight="900" fontStyle="italic" letterSpacing="-0.5" fontFamily="system-ui, sans-serif">
        tm
      </text>
    </svg>
  );
}

/**
 * 5. Amazon Pay
 * Signature Amazon smile curve in orange + bold wordmark
 */
export function AmazonPayIcon({ className = 'h-4 w-auto' }: { className?: string }) {
  return (
    <svg viewBox="0 0 86 20" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Amazon Pay">
      <text x="1" y="13" fill="currentColor" fontSize="10.5" fontWeight="800" letterSpacing="-0.3" fontFamily="system-ui, sans-serif">
        amazon
      </text>
      <text x="49" y="13" fill="#FF9900" fontSize="10.5" fontWeight="900" letterSpacing="-0.2" fontFamily="system-ui, sans-serif">
        pay
      </text>
      {/* Curved smile arrow */}
      <path d="M4 16.5C14 20 30 19.5 44 14.5" stroke="#FF9900" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M42 13l2.8 1.6-1.8 2.2" fill="#FF9900" />
    </svg>
  );
}

/**
 * 6. CRED Pay
 * Sleek CRED lock monogram + tracked brand text
 */
export function CredIcon({ className = 'h-4 w-auto' }: { className?: string }) {
  return (
    <svg viewBox="0 0 56 20" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="CRED">
      <rect x="2" y="3" width="13" height="14" rx="2.5" fill="#18181B" stroke="currentColor" strokeWidth="0.8" />
      <path d="M5.5 7h6v2.2h-6zM5.5 11h6v2.2h-6z" fill="#FFFFFF" />
      <text x="19" y="14.5" fill="currentColor" fontSize="10" fontWeight="900" letterSpacing="1" fontFamily="system-ui, sans-serif">
        CRED
      </text>
    </svg>
  );
}

/**
 * 7. Razorpay
 * Official electric-blue blade flash + corporate wordmark
 */
export function RazorpayIcon({ className = 'h-4 w-auto' }: { className?: string }) {
  return (
    <svg viewBox="0 0 74 20" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Razorpay">
      <path d="M11 2L4 17H8L9.7 13H13L11.5 17H16L18.8 2H11Z" fill="#0C2340" className="dark:fill-[#60A5FA]" />
      <path d="M6 14.5L11 2H6.5L1.5 14.5H6Z" fill="#0C83FD" />
      <text x="21" y="14.5" fill="currentColor" fontSize="10.5" fontWeight="800" letterSpacing="-0.3" fontFamily="system-ui, sans-serif">
        Razorpay
      </text>
    </svg>
  );
}

/**
 * 8. RuPay
 * Official RuPay wordmark with tricolor angled forward wings
 */
export function RuPayIcon({ className = 'h-4 w-auto' }: { className?: string }) {
  return (
    <svg viewBox="0 0 66 20" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="RuPay">
      <text x="1" y="14.5" fill="currentColor" fontSize="11.5" fontWeight="900" letterSpacing="-0.3" fontFamily="system-ui, sans-serif">
        RuPay
      </text>
      <path d="M46 4.5l-3.2 11h3.2l3.2-11H46z" fill="#097939" />
      <path d="M52 4.5l-3.2 11h3.2l3.2-11H52z" fill="#F47920" />
      <path d="M58 4.5l-3.2 11h3.2l3.2-11H58z" fill="#0C2340" className="dark:fill-[#94A3B8]" />
    </svg>
  );
}

/**
 * 9. Visa
 * Classic Visa typography with italic flare
 */
export function VisaIcon({ className = 'h-4 w-auto' }: { className?: string }) {
  return (
    <svg viewBox="0 0 46 20" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="VISA">
      <text
        x="2"
        y="15.5"
        fill="#1A1F71"
        className="dark:fill-[#60A5FA]"
        fontSize="15"
        fontWeight="900"
        fontStyle="italic"
        letterSpacing="-0.6"
        fontFamily="system-ui, sans-serif"
      >
        VISA
      </text>
    </svg>
  );
}

/**
 * 10. Mastercard
 * Authentic interlocking red & yellow-orange circles with amber overlap
 */
export function MastercardIcon({ className = 'h-4 w-auto' }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 20" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Mastercard">
      <circle cx="9" cy="10" r="7.5" fill="#EB001B" />
      <circle cx="18" cy="10" r="7.5" fill="#F79E1B" fillOpacity="0.88" />
      <path d="M13.5 5.2a7.5 7.5 0 0 1 0 9.6 7.5 7.5 0 0 1 0-9.6z" fill="#FF5F00" />
      <text x="28" y="14" fill="currentColor" fontSize="8.5" fontWeight="800" letterSpacing="0.2" fontFamily="system-ui, sans-serif">
        mastercard
      </text>
    </svg>
  );
}

/**
 * 11. American Express (Amex)
 * Classic blue card box with bold white wordmark
 */
export function AmexIcon({ className = 'h-4 w-auto' }: { className?: string }) {
  return (
    <svg viewBox="0 0 50 20" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="American Express">
      <rect x="2" y="2.5" width="46" height="15" rx="3" fill="#006FCF" />
      <text x="7" y="13.5" fill="#FFFFFF" fontSize="9" fontWeight="900" letterSpacing="0.6" fontFamily="system-ui, sans-serif">
        AMEX
      </text>
    </svg>
  );
}

/**
 * 12. No-Cost EMI & Card EMI
 * Professional percent calendar badge with indigo highlight
 */
export function EmiIcon() {
  return (
    <span className="flex items-center gap-1.5" aria-label="No Cost EMI & Easy Installments">
      <span className="w-4 h-4 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-black text-[9px] flex items-center justify-center border border-indigo-500/30">
        %
      </span>
      <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
        No-Cost EMI
      </span>
    </span>
  );
}

/**
 * 13. Pay Later (Simpl / LazyPay / Zest)
 * Instant checkout pay later badge
 */
export function PayLaterIcon() {
  return (
    <span className="flex items-center gap-1.5" aria-label="Pay Later - Simpl & LazyPay">
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-cyan-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
      <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400">
        PayLater
      </span>
    </span>
  );
}

/**
 * 14. Hunger Cash Wallet
 * Official Hunger internal wallet badge
 */
export function HungerWalletIcon() {
  return (
    <span className="flex items-center gap-1.5" aria-label="Hunger Cash Wallet">
      <span className="w-4 h-4 rounded-full bg-gradient-to-tr from-primary to-orange-400 text-white font-black text-[9px] flex items-center justify-center shadow-xs">
        ₹
      </span>
      <span className="text-[10px] font-bold text-foreground">
        Hunger Wallet
      </span>
    </span>
  );
}

/**
 * 15. Digital Wallets (MobiKwik / Amazon Pay / FreeCharge)
 */
export function DigitalWalletsIcon() {
  return (
    <span className="flex items-center gap-1.5" aria-label="Digital Wallets">
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-purple-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
        <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
      </svg>
      <span className="text-[10px] font-bold text-foreground">
        Wallets
      </span>
    </span>
  );
}

/**
 * 16. Net Banking (50+ Indian Banks)
 */
export function NetBankingIcon() {
  return (
    <span className="flex items-center gap-1.5" aria-label="NetBanking">
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-blue-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m2 7 10-5 10 5v2H2z" />
        <path d="M4 11v8" />
        <path d="M8 11v8" />
        <path d="M12 11v8" />
        <path d="M16 11v8" />
        <path d="M20 11v8" />
        <path d="M2 21h20" />
      </svg>
      <span className="text-[10px] font-bold text-foreground">50+ Banks</span>
    </span>
  );
}

/**
 * 17. Cash on Delivery (COD)
 */
export function CodIcon() {
  return (
    <span className="flex items-center gap-1.5" aria-label="Cash on Delivery">
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="12" x="2" y="6" rx="2" />
        <circle cx="12" cy="12" r="2" />
        <path d="M6 12h.01M18 12h.01" />
      </svg>
      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Cash on Delivery</span>
    </span>
  );
}

/**
 * 18. Pluxee / Sodexo Food Cards
 */
export function MealCardIcon() {
  return (
    <span className="flex items-center gap-1.5" aria-label="Pluxee / Sodexo Meal Passes">
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="14" x="2" y="5" rx="2" />
        <line x1="2" x2="22" y1="10" y2="10" />
      </svg>
      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">Pluxee / Sodexo</span>
    </span>
  );
}

/**
 * Unified PaymentBadges strip rendering all supported payment gateways, cards, wallets & EMI
 */
export default function PaymentBadges() {
  const badgeClass =
    'inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-background/90 dark:bg-card border border-border/80 shadow-2xs hover:border-primary/50 hover:bg-muted/40 transition-all select-none shrink-0 h-7';

  return (
    <div className="flex flex-wrap items-center justify-center lg:justify-end gap-1.5 sm:gap-2">
      {/* UPI Ecosystem */}
      <div className={badgeClass} title="UPI (Unified Payments Interface)">
        <UpiIcon />
      </div>

      <div className={badgeClass} title="Google Pay">
        <GPayIcon />
      </div>

      <div className={badgeClass} title="PhonePe UPI">
        <PhonePeIcon />
      </div>

      <div className={badgeClass} title="Paytm UPI & Wallet">
        <PaytmIcon />
      </div>

      <div className={badgeClass} title="Amazon Pay">
        <AmazonPayIcon />
      </div>

      <div className={badgeClass} title="CRED Pay">
        <CredIcon />
      </div>

      {/* Gateway & Cards */}
      <div className={badgeClass} title="Razorpay Secure Checkout">
        <RazorpayIcon />
      </div>

      <div className={badgeClass} title="RuPay Debit & Credit Cards">
        <RuPayIcon />
      </div>

      <div className={badgeClass} title="Visa Cards">
        <VisaIcon />
      </div>

      <div className={badgeClass} title="Mastercard Worldwide">
        <MastercardIcon />
      </div>

      <div className={badgeClass} title="American Express">
        <AmexIcon />
      </div>

      {/* EMI & PayLater */}
      <div className={badgeClass} title="No-Cost EMI on Eligible Cards">
        <EmiIcon />
      </div>

      <div className={badgeClass} title="Pay Later (Simpl, LazyPay)">
        <PayLaterIcon />
      </div>

      {/* Wallets & Banking */}
      <div className={badgeClass} title="Hunger Cash Wallet (1-Click Instant Checkout)">
        <HungerWalletIcon />
      </div>

      <div className={badgeClass} title="Digital Wallets (MobiKwik, Freecharge, etc.)">
        <DigitalWalletsIcon />
      </div>

      <div className={badgeClass} title="NetBanking (50+ Indian Banks)">
        <NetBankingIcon />
      </div>

      <div className={badgeClass} title="Cash on Delivery (Pay upon arrival)">
        <CodIcon />
      </div>

      <div className={badgeClass} title="Corporate Meal Cards (Pluxee, Sodexo, Zeta)">
        <MealCardIcon />
      </div>
    </div>
  );
}
