'use client';

/**
 * Hunger Meal Subscriptions Page
 * ================================
 * Browse meal plans, subscribe, pause, skip days,
 * view remaining meals and history.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar, Pause, Play, SkipForward, ChevronRight,
  CheckCircle2, Clock, UtensilsCrossed, Star, Repeat,
  Bell
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MealPlan } from '@/lib/hunger-types-client';

// Sample plans (in production, loaded from Firestore)
const SAMPLE_PLANS: MealPlan[] = [
  {
    id: 'student-lunch',
    restaurantId: 'demo',
    restaurantName: 'Campus Kitchen',
    title: 'Student Lunch Plan',
    description: 'Healthy weekday lunches crafted for students',
    planType: 'lunch',
    mealsPerDay: 1,
    daysPerWeek: 5,
    pricePerMonth: 1499,
    totalMealsPerMonth: 22,
    items: [
      { name: 'Dal Rice' },
      { name: 'Roti Sabzi' },
      { name: 'Mix Veg Thali' },
    ],
    isActive: true,
    createdAt: new Date(),
  },
  {
    id: 'lunch-dinner',
    restaurantId: 'demo',
    restaurantName: 'Home Bites',
    title: 'Lunch + Dinner Plan',
    description: 'Two meals a day, 5 days a week',
    planType: 'lunch_dinner',
    mealsPerDay: 2,
    daysPerWeek: 5,
    pricePerMonth: 2999,
    totalMealsPerMonth: 44,
    items: [
      { name: 'Lunch Thali' },
      { name: 'Dinner Combo' },
    ],
    isActive: true,
    createdAt: new Date(),
  },
  {
    id: 'office-plan',
    restaurantId: 'demo',
    restaurantName: 'Office Eats',
    title: 'Office Meal Plan',
    description: 'Weekday lunches with healthy office-friendly options',
    planType: 'office',
    mealsPerDay: 1,
    daysPerWeek: 5,
    pricePerMonth: 3999,
    totalMealsPerMonth: 22,
    items: [
      { name: 'Grilled Chicken Bowl' },
      { name: 'Salad + Wrap Combo' },
      { name: 'Protein Thali' },
    ],
    isActive: true,
    createdAt: new Date(),
  },
];

const PLAN_ICONS: Record<string, string> = {
  'student-lunch': '🎓',
  'lunch-dinner': '🍽️',
  'office-plan': '💼',
};

const PLAN_COLORS: Record<string, string> = {
  'student-lunch': 'from-blue-500/20 to-indigo-500/10 border-blue-500/30',
  'lunch-dinner': 'from-orange-500/20 to-amber-500/10 border-orange-500/30',
  'office-plan': 'from-emerald-500/20 to-teal-500/10 border-emerald-500/30',
};

export default function SubscriptionsPage() {
  const [activeTab, setActiveTab] = useState<'browse' | 'my'>('browse');
  const [selectedPlan, setSelectedPlan] = useState<MealPlan | null>(null);
  const [subscribed, setSubscribed] = useState<Set<string>>(new Set());

  // Mock active subscription data
  const activeSub = subscribed.size > 0 ? {
    mealsRemaining: 18,
    mealsTaken: 4,
    totalMeals: 22,
    nextMeal: 'Tomorrow, Lunch',
    status: 'active' as const,
    planTitle: 'Student Lunch Plan',
  } : null;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 px-6 pt-14 pb-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(255,255,255,0.1),transparent_60%)]" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative text-white"
        >
          <div className="flex items-center gap-3 mb-2">
            <Repeat className="w-7 h-7" />
            <h1 className="text-2xl font-bold">Hunger Meal Plans</h1>
          </div>
          <p className="text-white/70 text-sm">Subscribe & save. Never skip a meal.</p>
        </motion.div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border bg-card sticky top-0 z-10">
        {['browse', 'my'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as 'browse' | 'my')}
            className={`flex-1 py-4 text-sm font-semibold transition-colors ${
              activeTab === tab
                ? 'text-emerald-500 border-b-2 border-emerald-500'
                : 'text-muted-foreground'
            }`}
          >
            {tab === 'browse' ? '🔍 Browse Plans' : '📋 My Subscriptions'}
          </button>
        ))}
      </div>

      {/* Browse Plans */}
      {activeTab === 'browse' && (
        <div className="px-4 py-4 space-y-4">
          {SAMPLE_PLANS.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`rounded-2xl border bg-gradient-to-br ${PLAN_COLORS[plan.id] || 'border-border'} overflow-hidden`}
            >
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">{PLAN_ICONS[plan.id] || '🍽️'}</div>
                    <div>
                      <h3 className="font-bold">{plan.title}</h3>
                      <p className="text-xs text-muted-foreground">{plan.restaurantName}</p>
                    </div>
                  </div>
                  {subscribed.has(plan.id) && (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Subscribed
                    </Badge>
                  )}
                </div>

                <p className="text-sm text-muted-foreground mb-3">{plan.description}</p>

                {/* Items included */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {plan.items.map((item, j) => (
                    <span
                      key={j}
                      className="text-xs px-2 py-1 rounded-full bg-background/50 border border-border/60"
                    >
                      {item.name}
                    </span>
                  ))}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { icon: UtensilsCrossed, label: `${plan.mealsPerDay}x daily` },
                    { icon: Calendar, label: `${plan.daysPerWeek} days/wk` },
                    { icon: Clock, label: `${plan.totalMealsPerMonth} meals/mo` },
                  ].map(stat => (
                    <div key={stat.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <stat.icon className="w-3.5 h-3.5" />
                      {stat.label}
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-2xl font-bold">₹{plan.pricePerMonth.toLocaleString()}</span>
                    <span className="text-sm text-muted-foreground">/month</span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      setSubscribed(prev => new Set([...prev, plan.id]));
                      setActiveTab('my');
                    }}
                    disabled={subscribed.has(plan.id)}
                    className={subscribed.has(plan.id)
                      ? 'bg-muted text-muted-foreground'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white'
                    }
                  >
                    {subscribed.has(plan.id) ? 'Subscribed' : 'Subscribe'}
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* My Subscriptions */}
      {activeTab === 'my' && (
        <div className="px-4 py-4">
          {activeSub ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold">{activeSub.planTitle}</h3>
                  <Badge className="mt-1 bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                    Active
                  </Badge>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-emerald-400">{activeSub.mealsRemaining}</div>
                  <div className="text-xs text-muted-foreground">meals left</div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{activeSub.mealsTaken} used</span>
                  <span>{activeSub.totalMeals} total</span>
                </div>
                <div className="w-full h-2 rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                    style={{ width: `${(activeSub.mealsTaken / activeSub.totalMeals) * 100}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
                <Clock className="w-4 h-4" />
                Next meal: <span className="text-foreground font-medium">{activeSub.nextMeal}</span>
              </div>

              {/* Controls */}
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex flex-col h-auto py-3 gap-1 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                >
                  <Pause className="w-4 h-4" />
                  <span className="text-xs">Pause</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex flex-col h-auto py-3 gap-1 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                >
                  <SkipForward className="w-4 h-4" />
                  <span className="text-xs">Skip Day</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex flex-col h-auto py-3 gap-1 border-border text-muted-foreground"
                >
                  <Bell className="w-4 h-4" />
                  <span className="text-xs">Reminders</span>
                </Button>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="mt-3 w-full text-red-400 hover:bg-red-500/10 hover:text-red-400"
                onClick={() => setSubscribed(new Set())}
              >
                Cancel Subscription
              </Button>
            </motion.div>
          ) : (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">📋</div>
              <h3 className="font-semibold mb-2">No Active Subscriptions</h3>
              <p className="text-sm text-muted-foreground mb-6">Subscribe to a meal plan and never miss a meal</p>
              <Button
                onClick={() => setActiveTab('browse')}
                className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
              >
                Browse Plans <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
