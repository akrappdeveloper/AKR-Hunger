'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  LayoutDashboard, Users, Store, Truck, ShoppingBag, ShieldCheck,
  Wallet, DollarSign, RotateCcw, ImageIcon, BookOpen, UtensilsCrossed,
  Megaphone, Tag, Film, Gift, Percent, TrendingUp, Brain, Shield,
  Zap, Activity, Navigation, Map, IdCard, CreditCard, MessageSquare,
  Star, Bell, FileText, LifeBuoy, Headset, Settings, GraduationCap,
  Sparkles, Leaf, Calculator, CalendarDays, Salad, Sliders,
  Search, ArrowRight, CheckCircle2, ChevronRight
} from 'lucide-react';

interface AdminModule {
  href: string;
  title: string;
  description: string;
  icon: any;
  category: 'Operations' | 'Management' | 'Financial' | 'Content & Marketing' | 'Advanced Ecosystem' | 'Monitoring & System';
  badge?: string;
  color: string;
}

const ALL_MODULES: AdminModule[] = [
  // Operations & Management
  { href: '/admin', title: 'Executive Dashboard', description: 'Real-time overview of revenue, orders, active drivers, and KPIs', icon: LayoutDashboard, category: 'Operations', color: 'from-blue-600 to-indigo-600' },
  { href: '/admin/orders', title: 'Orders Command Center', description: 'Monitor live orders, kitchen prep, out for delivery status and dispatch', icon: ShoppingBag, category: 'Operations', color: 'from-blue-500 to-cyan-500' },
  { href: '/admin/customers', title: 'Customer Management', description: 'Customer profiles, order frequency, addresses, and account statuses', icon: Users, category: 'Management', color: 'from-indigo-500 to-purple-500' },
  { href: '/admin/restaurants', title: 'Restaurant Directory', description: 'Onboarding, restaurant approvals, operating hours, and KYC details', icon: Store, category: 'Management', color: 'from-amber-500 to-orange-500' },
  { href: '/admin/delivery', title: 'Delivery Fleet Partners', description: 'Delivery partner profiles, payouts, and vehicle documents', icon: Truck, category: 'Management', color: 'from-emerald-500 to-teal-500' },
  { href: '/admin/drivers', title: 'Driver Activity Radar', description: 'Live driver radar, online/offline status, and shift management', icon: Activity, category: 'Management', color: 'from-blue-500 to-sky-500' },
  { href: '/admin/kyc', title: 'KYC & Verification', description: 'FSSAI approvals, Aadhaar/PAN cards, and driver license verifications', icon: ShieldCheck, category: 'Management', color: 'from-purple-500 to-pink-500' },
  { href: '/admin/fraud-detection', title: 'Fraud & Sybil Shield', description: 'AI anti-fraud protection, multi-accounting detection, and geo-spoofing flags', icon: Shield, category: 'Management', color: 'from-red-500 to-rose-600' },
  { href: '/admin/students', title: 'Student Verifications', description: 'Verify college student IDs and auto-issue STUDENT15 discounts', icon: GraduationCap, category: 'Management', badge: 'New', color: 'from-blue-600 to-purple-600' },
  { href: '/admin/split-bills', title: 'Split Bills & Group Orders', description: 'Monitor bill splits, group orders, and UPI member contributions', icon: Calculator, category: 'Operations', badge: 'New', color: 'from-cyan-500 to-blue-600' },

  // Financial
  { href: '/admin/payments', title: 'Restaurant Settlements', description: 'Restaurant order payouts, platform commissions, and bank transfers', icon: Wallet, category: 'Financial', color: 'from-emerald-600 to-green-600' },
  { href: '/admin/delivery-payments', title: 'Driver Earnings & Payouts', description: 'Daily driver earnings, distance pay, tips, and bonus settlements', icon: DollarSign, category: 'Financial', color: 'from-teal-600 to-emerald-600' },
  { href: '/admin/customer-wallet', title: 'Customer Wallet Engine', description: 'Wallet top-ups, refund deposits, withdrawal requests, and balance ledger', icon: Wallet, category: 'Financial', color: 'from-blue-600 to-indigo-600' },
  { href: '/admin/refunds', title: 'Refund Command Desk', description: 'Fast automated & manual refund processing with audit logs', icon: RotateCcw, category: 'Financial', color: 'from-amber-600 to-orange-600' },
  { href: '/admin/points', title: 'VIP Loyalty Points', description: 'Customer reward points ledger, earning rules, and redemption conversion', icon: Gift, category: 'Financial', color: 'from-purple-600 to-pink-600' },
  { href: '/admin/delivery-policies', title: 'Delivery Policies & SLA', description: 'Global base delivery fees, per-km charges, SLA timers, and surge multipliers', icon: Sliders, category: 'Financial', badge: 'Config', color: 'from-slate-600 to-zinc-600' },

  // Content & Marketing
  { href: '/admin/menus', title: 'Menu Catalog Master', description: 'Edit dishes, category hierarchies, pricing, and dietary flags', icon: BookOpen, category: 'Content & Marketing', color: 'from-amber-500 to-orange-500' },
  { href: '/admin/menu-approvals', title: 'Menu Item Approvals', description: 'Review and approve restaurant menu item changes and pricing updates', icon: UtensilsCrossed, category: 'Content & Marketing', color: 'from-orange-500 to-red-500' },
  { href: '/admin/banners', title: 'Banners & Hero Carousels', description: 'Customer home page banners, festival graphics, and promotional sliders', icon: ImageIcon, category: 'Content & Marketing', color: 'from-pink-500 to-rose-500' },
  { href: '/admin/campaigns', title: 'Marketing Campaigns', description: 'Flash sales, festival announcements, and targeted marketing pushes', icon: Megaphone, category: 'Content & Marketing', color: 'from-purple-500 to-violet-600' },
  { href: '/admin/deals', title: 'Deals & Discount Coupons', description: 'Create percentage and flat discount coupons with minimum order rules', icon: Tag, category: 'Content & Marketing', color: 'from-blue-500 to-indigo-500' },
  { href: '/admin/promotions', title: 'Promotion Code Engine', description: 'Configure sitewide promo codes, referral benefits, and first-order perks', icon: Percent, category: 'Content & Marketing', color: 'from-green-500 to-emerald-600' },
  { href: '/admin/redeem-codes', title: 'Gift Vouchers & Redeem Codes', description: 'Issue prepaid gift cards, corporate codes, and cash vouchers', icon: Gift, category: 'Content & Marketing', color: 'from-amber-500 to-yellow-600' },
  { href: '/admin/videos', title: 'Food Stories & Reels Moderation', description: 'Approve or remove user and restaurant short video food stories', icon: Film, category: 'Content & Marketing', color: 'from-red-500 to-pink-600' },

  // Advanced Ecosystem & Gamification
  { href: '/admin/gamification', title: 'Mystery Box & Secret Vault', description: 'Configure Mystery Gourmet Boxes, Secret Vault passcodes, and Roulette odds', icon: Sparkles, category: 'Advanced Ecosystem', badge: 'Featured', color: 'from-purple-600 to-fuchsia-600' },
  { href: '/admin/eco', title: 'Green EV & Eco-Delivery', description: 'Track CO2 saved, plastic container diverted, and EV fleet dispatches', icon: Leaf, category: 'Advanced Ecosystem', badge: 'Featured', color: 'from-emerald-600 to-green-600' },
  { href: '/admin/meal-plans', title: 'Weekly Tiffin Planner', description: 'Monitor recurring meal subscriptions, daily kitchen dispatches, and menus', icon: CalendarDays, category: 'Advanced Ecosystem', badge: 'New', color: 'from-blue-600 to-cyan-600' },
  { href: '/admin/diet-planner', title: 'Diet & Nutritional Catalog', description: 'Tag calories, protein, carbs, and keto/healthy flags on all dishes', icon: Salad, category: 'Advanced Ecosystem', badge: 'New', color: 'from-teal-600 to-emerald-600' },
  { href: '/admin/memberships', title: 'VIP Hunger Club Memberships', description: 'Manage VIP membership tiers, free delivery perks, and subscription renewals', icon: IdCard, category: 'Advanced Ecosystem', color: 'from-amber-600 to-yellow-600' },
  { href: '/admin/card-requests', title: 'Physical VIP Cards', description: 'Manage customized physical VIP metal & NFC card delivery requests', icon: CreditCard, category: 'Advanced Ecosystem', color: 'from-indigo-600 to-purple-600' },

  // Monitoring & System
  { href: '/admin/analytics', title: 'Business Analytics & Reports', description: 'GMV growth, order trends, popular cuisines, and cohort analysis', icon: TrendingUp, category: 'Monitoring & System', color: 'from-blue-600 to-indigo-600' },
  { href: '/admin/ai-pricing', title: 'AI Demand & Dynamic Pricing', description: 'Automated pricing recommendations based on demand, weather, and traffic', icon: Brain, category: 'Monitoring & System', color: 'from-purple-600 to-indigo-600' },
  { href: '/admin/ai-config', title: 'AI Engine Configuration', description: 'Configure local AI models, smart recommendations, and observability', icon: Brain, category: 'Monitoring & System', badge: 'AI', color: 'from-violet-600 to-purple-700' },
  { href: '/admin/quality', title: 'Restaurant Food Quality Control', description: 'Food hygiene audits, temperature checks, and kitchen compliance grades', icon: Shield, category: 'Monitoring & System', color: 'from-emerald-600 to-teal-600' },
  { href: '/admin/surge', title: 'Surge & Peak Hour Rules', description: 'Automated surge multipliers for rain, peak festival hours, and driver shortages', icon: Zap, category: 'Monitoring & System', color: 'from-amber-500 to-orange-600' },
  { href: '/admin/system-health', title: 'System Health & Latency', description: 'Firebase sync latency, API response times, errors, and uptime status', icon: Activity, category: 'Monitoring & System', color: 'from-emerald-500 to-green-600' },
  { href: '/admin/tracking', title: 'Live Radar & GPS Fleet Map', description: 'Interactive real-time map showing active delivery riders and ongoing orders', icon: Navigation, category: 'Monitoring & System', color: 'from-blue-500 to-indigo-600' },
  { href: '/admin/zones', title: 'Delivery Zones & Geospatial Polygons', description: 'Draw delivery boundary polygons, service pincodes, and coverage radii', icon: Map, category: 'Monitoring & System', color: 'from-cyan-500 to-blue-600' },
  { href: '/admin/messages', title: 'Admin Messaging Center', description: 'Internal broadcast messaging, cross-panel announcements, and live chat', icon: MessageSquare, category: 'Monitoring & System', color: 'from-blue-500 to-indigo-600' },
  { href: '/admin/reviews', title: 'Customer Reviews & Feedback', description: 'Moderate restaurant and dish reviews, flag inappropriate content', icon: Star, category: 'Monitoring & System', color: 'from-amber-500 to-yellow-500' },
  { href: '/admin/notifications', title: 'Push Notifications Center', description: 'Broadcast web push alerts to customers, drivers, and restaurant panels', icon: Bell, category: 'Monitoring & System', color: 'from-red-500 to-pink-500' },
  { href: '/admin/reports', title: 'Financial & Tax Reports', description: 'Generate GST reports, commission invoices, and exportable CSV/PDF summaries', icon: FileText, category: 'Monitoring & System', color: 'from-slate-600 to-zinc-600' },
  { href: '/admin/support', title: 'Customer Support Desk', description: 'Manage customer complaints, live chats, missing item tickets, and refunds', icon: LifeBuoy, category: 'Monitoring & System', color: 'from-blue-500 to-cyan-500' },
  { href: '/admin/support/delivery', title: 'Delivery Partner Support Desk', description: 'Specialized support desk for on-road delivery rider assistance', icon: Headset, category: 'Monitoring & System', color: 'from-teal-500 to-emerald-600' },
  { href: '/admin/audit-logs', title: 'Security Audit Logs', description: 'Immutable log of all administrator actions, config changes, and logins', icon: ShieldCheck, category: 'Monitoring & System', color: 'from-purple-600 to-indigo-600' },
  { href: '/admin/settings', title: 'System & Platform Settings', description: 'Configure platform fees, currency, notification gateways, and security', icon: Settings, category: 'Monitoring & System', color: 'from-slate-600 to-zinc-700' },
];

export default function AdminMorePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = ['All', 'Operations', 'Management', 'Financial', 'Content & Marketing', 'Advanced Ecosystem', 'Monitoring & System'];

  const filteredModules = ALL_MODULES.filter((m) => {
    const matchesSearch =
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || m.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-purple-900/40 p-6 sm:p-8 border border-blue-500/20 backdrop-blur-xl">
        <div className="relative z-10 max-w-3xl space-y-3">
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 gap-1.5 px-3 py-1 font-bold text-xs uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" /> Platform Command Directory
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">
            All Admin Tools, Pages &amp; Ecosystem Functions
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Centralized access to all {ALL_MODULES.length} platform control centers, financial engines, customer gamification tools, and monitoring modules.
          </p>
        </div>
      </div>

      {/* Search & Category Filter */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search 40+ admin tools, modules, settings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 rounded-2xl bg-card/60 border-border/60 text-foreground"
            />
          </div>
          <div className="text-xs text-muted-foreground font-semibold">
            Showing {filteredModules.length} of {ALL_MODULES.length} tools
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(cat)}
              className="rounded-xl text-xs font-bold shrink-0 capitalize h-8"
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>

      {/* Grid of Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredModules.map((module) => {
          const Icon = module.icon;
          return (
            <Link key={module.href} href={module.href} className="group">
              <Card className="h-full border-border/60 bg-card/60 backdrop-blur-md hover:border-blue-500/40 hover:bg-card/90 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col justify-between overflow-hidden relative">
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${module.color} flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    {module.badge && (
                      <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] font-black uppercase tracking-wider">
                        {module.badge}
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-base font-bold text-foreground group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">
                    {module.title}
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                    {module.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 pt-0 mt-auto">
                  <div className="pt-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground group-hover:text-foreground">
                    <span className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
                      {module.category}
                    </span>
                    <span className="flex items-center gap-1 font-bold text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      Open <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
