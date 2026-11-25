'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import PaymentBadges from './PaymentBadges';
import {
  Film,
  UtensilsCrossed,
  Sparkles,
  Dices,
  Calculator,
  Salad,
  Calendar,
  RotateCcw,
  BookOpen,
  Leaf,
  ShieldCheck,
  Headphones,
  Award,
  Crown,
  GraduationCap,
  Users,
  CreditCard,
  Heart,
  HelpCircle,
  Clock,
  CheckCircle2,
  Gift,
  Tag,
  Package,
  MapPin,
  FileText,
  Shield,
  Bell,
  Star,
  User,
  Share2
} from 'lucide-react';

export default function CustomerFooter() {
  const pathname = usePathname();

  // Hide on auth pages
  if (pathname?.includes('/login') || pathname?.includes('/signup')) {
    return null;
  }

  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-card text-card-foreground border-t border-border/80 transition-colors duration-300 mt-12 pb-24 md:pb-8">
      {/* Top Highlights Banner */}
      <div className="border-b border-border/60 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 text-center md:text-left">
            <div className="flex items-center gap-3 justify-center md:justify-start">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold text-foreground">Lightning Fast</p>
                <p className="text-[11px] text-muted-foreground">Average delivery 28 mins</p>
              </div>
            </div>

            <div className="flex items-center gap-3 justify-center md:justify-start">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold text-foreground">FSSAI Certified</p>
                <p className="text-[11px] text-muted-foreground">100% hygienic kitchen checks</p>
              </div>
            </div>

            <div className="flex items-center gap-3 justify-center md:justify-start">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Headphones className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold text-foreground">24/7 AI Support</p>
                <p className="text-[11px] text-muted-foreground">Instant order resolution</p>
              </div>
            </div>

            <div className="flex items-center gap-3 justify-center md:justify-start">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold text-foreground">VIP Perks</p>
                <p className="text-[11px] text-muted-foreground">Zero delivery fee on all orders</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Sitemap Directory */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 lg:gap-10">
          {/* Brand Info & Mission */}
          <div className="col-span-2 md:col-span-1 space-y-4">
            <Link href="/customer" className="inline-flex items-center gap-2">
              <img src="/hunger.png" alt="Hunger Logo" className="w-8 h-8 rounded-xl object-contain shadow-sm" />
              <span className="text-xl font-black bg-gradient-to-r from-primary to-orange-400 bg-clip-text text-transparent">
                Hunger
              </span>
            </Link>
            <p className="text-xs text-muted-foreground leading-relaxed">
              India&apos;s premium next-generation food delivery and culinary discovery experience. Fresh gourmet flavors, live kitchen reels, and fair rider support.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                All Systems Normal
              </span>
            </div>
          </div>

          {/* Interactive Tools & Discovery */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Food Discovery
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/customer/stories" className="flex items-center gap-2 text-foreground/80 hover:text-primary transition-colors">
                  <Film className="w-3.5 h-3.5 text-primary" />
                  <span>Food Reels &amp; Stories</span>
                </Link>
              </li>
              <li>
                <Link href="/customer/cuisines" className="flex items-center gap-2 text-foreground/80 hover:text-primary transition-colors">
                  <UtensilsCrossed className="w-3.5 h-3.5 text-amber-500" />
                  <span>16+ Cuisines Guide</span>
                </Link>
              </li>
              <li>
                <Link href="/customer/roulette" className="flex items-center gap-2 text-foreground/80 hover:text-primary transition-colors">
                  <Dices className="w-3.5 h-3.5 text-purple-500" />
                  <span>Hunger Roulette</span>
                </Link>
              </li>
              <li>
                <Link href="/customer/mood" className="flex items-center gap-2 text-foreground/80 hover:text-primary transition-colors">
                  <Sparkles className="w-3.5 h-3.5 text-pink-500" />
                  <span>Mood Food Matcher</span>
                </Link>
              </li>
              <li>
                <Link href="/customer/split-bill" className="flex items-center gap-2 text-foreground/80 hover:text-primary transition-colors">
                  <Calculator className="w-3.5 h-3.5 text-blue-500" />
                  <span>Split Bill Calculator</span>
                </Link>
              </li>
              <li>
                <Link href="/customer/diet-planner" className="flex items-center gap-2 text-foreground/80 hover:text-primary transition-colors">
                  <Salad className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Diet &amp; Calorie Goal</span>
                </Link>
              </li>
              <li>
                <Link href="/customer/meal-planner" className="flex items-center gap-2 text-foreground/80 hover:text-primary transition-colors">
                  <Calendar className="w-3.5 h-3.5 text-orange-500" />
                  <span>Weekly Tiffin Planner</span>
                </Link>
              </li>
              <li>
                <Link href="/customer/reorder" className="flex items-center gap-2 text-foreground/80 hover:text-primary transition-colors">
                  <RotateCcw className="w-3.5 h-3.5 text-cyan-500" />
                  <span>1-Click Past Reorder</span>
                </Link>
              </li>
              <li>
                <Link href="/customer/secret-menu" className="flex items-center gap-2 text-foreground/80 hover:text-purple-500 transition-colors">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>The Secret Vault Menu</span>
                </Link>
              </li>
              <li>
                <Link href="/customer/mystery-box" className="flex items-center gap-2 text-foreground/80 hover:text-primary transition-colors">
                  <Gift className="w-3.5 h-3.5 text-amber-500" />
                  <span>Blind Mystery Food Box</span>
                </Link>
              </li>
              <li>
                <Link href="/customer/eco" className="flex items-center gap-2 text-foreground/80 hover:text-primary transition-colors">
                  <Leaf className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Green EV Delivery</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Customer Club & Benefits */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Customer Club
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/customer/membership" className="flex items-center gap-2 text-foreground/80 hover:text-primary transition-colors">
                  <Crown className="w-3.5 h-3.5 text-amber-500" />
                  <span>VIP Gold Pass</span>
                </Link>
              </li>
              <li>
                <Link href="/customer/student" className="flex items-center gap-2 text-foreground/80 hover:text-primary transition-colors">
                  <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Student Meals @ ₹99</span>
                </Link>
              </li>
              <li>
                <Link href="/customer/group" className="flex items-center gap-2 text-foreground/80 hover:text-primary transition-colors">
                  <Users className="w-3.5 h-3.5 text-blue-500" />
                  <span>Group Order Cart</span>
                </Link>
              </li>
              <li>
                <Link href="/customer/rewards" className="flex items-center gap-2 text-foreground/80 hover:text-primary transition-colors">
                  <Award className="w-3.5 h-3.5 text-yellow-500" />
                  <span>Hunger Points &amp; Perks</span>
                </Link>
              </li>
              <li>
                <Link href="/customer/deals" className="flex items-center gap-2 text-foreground/80 hover:text-primary transition-colors">
                  <Tag className="w-3.5 h-3.5 text-orange-500" />
                  <span>Deals, Vouchers &amp; Codes</span>
                </Link>
              </li>
              <li>
                <Link href="/customer/wallet" className="flex items-center gap-2 text-foreground/80 hover:text-primary transition-colors">
                  <CreditCard className="w-3.5 h-3.5 text-green-500" />
                  <span>Hunger Cash Wallet</span>
                </Link>
              </li>
              <li>
                <Link href="/customer/favorites" className="flex items-center gap-2 text-foreground/80 hover:text-primary transition-colors">
                  <Heart className="w-3.5 h-3.5 text-rose-500" />
                  <span>Favorite Dishes</span>
                </Link>
              </li>
              <li>
                <Link href="/customer/blog" className="flex items-center gap-2 text-foreground/80 hover:text-primary transition-colors">
                  <BookOpen className="w-3.5 h-3.5 text-teal-500" />
                  <span>Foodie Stories &amp; Blog</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Customer Services & Family */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Family &amp; Services
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/customer/circle" className="flex items-center gap-2 text-foreground/80 hover:text-primary transition-colors">
                  <Users className="w-3.5 h-3.5 text-rose-500" />
                  <span>Hunger Family Circle</span>
                </Link>
              </li>
              <li>
                <Link href="/customer/subscriptions" className="flex items-center gap-2 text-foreground/80 hover:text-primary transition-colors">
                  <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Meal Plans &amp; Tiffin</span>
                </Link>
              </li>
              <li>
                <Link href="/customer/referral" className="flex items-center gap-2 text-foreground/80 hover:text-primary transition-colors">
                  <Share2 className="w-3.5 h-3.5 text-blue-500" />
                  <span>Refer Friends &amp; Earn ₹150</span>
                </Link>
              </li>
              <li>
                <Link href="/customer/chat" className="flex items-center gap-2 text-foreground/80 hover:text-primary transition-colors">
                  <Headphones className="w-3.5 h-3.5 text-purple-500" />
                  <span>AI Food Assistant &amp; Chat</span>
                </Link>
              </li>
              <li>
                <Link href="/customer/notifications" className="flex items-center gap-2 text-foreground/80 hover:text-primary transition-colors">
                  <Bell className="w-3.5 h-3.5 text-amber-500" />
                  <span>Live Order Notifications</span>
                </Link>
              </li>
              <li>
                <Link href="/customer/reviews" className="flex items-center gap-2 text-foreground/80 hover:text-primary transition-colors">
                  <Star className="w-3.5 h-3.5 text-yellow-500" />
                  <span>Community Food Reviews</span>
                </Link>
              </li>
              <li>
                <Link href="/customer/profile" className="flex items-center gap-2 text-foreground/80 hover:text-primary transition-colors">
                  <User className="w-3.5 h-3.5 text-primary" />
                  <span>My Profile &amp; Preferences</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Help & Trust */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Help &amp; Trust
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/customer/support" className="flex items-center gap-2 text-foreground/80 hover:text-primary transition-colors">
                  <HelpCircle className="w-3.5 h-3.5 text-primary" />
                  <span>24/7 Help &amp; Support Desk</span>
                </Link>
              </li>
              <li>
                <Link href="/customer/orders" className="flex items-center gap-2 text-foreground/80 hover:text-primary transition-colors">
                  <Package className="w-3.5 h-3.5 text-blue-500" />
                  <span>Live Order Tracking</span>
                </Link>
              </li>
              <li>
                <Link href="/customer/addresses" className="flex items-center gap-2 text-foreground/80 hover:text-primary transition-colors">
                  <MapPin className="w-3.5 h-3.5 text-red-500" />
                  <span>Delivery Address Book</span>
                </Link>
              </li>
              <li>
                <Link href="/terms" className="flex items-center gap-2 text-foreground/80 hover:text-primary transition-colors">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Terms of Service</span>
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="flex items-center gap-2 text-foreground/80 hover:text-primary transition-colors">
                  <Shield className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Privacy Policy &amp; GDPR</span>
                </Link>
              </li>
              <li>
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  100% Secure Razorpay Checkout
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Verified Trust Badges */}
        <div className="mt-10 pt-6 border-t border-border/60 flex flex-col lg:flex-row items-center justify-between gap-5 text-xs text-muted-foreground">
          <p className="text-center lg:text-left">© {currentYear} Hunger Food Delivery Technologies Pvt. Ltd. All rights reserved.</p>

          <PaymentBadges />
        </div>
      </div>
    </footer>
  );
}
