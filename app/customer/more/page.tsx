'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  GraduationCap, Users, Calendar, Heart, Sparkles, ChevronRight,
  CheckCircle2, ArrowRight, Share2, Copy, ShieldCheck, Clock,
  UtensilsCrossed, Gift, Crown, Tag, MessageCircle, Wallet, HelpCircle,
  Plus, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

function MoreFeaturesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  // Active dialog state: 'student' | 'group' | 'subscriptions' | 'circle' | null
  const [activeDialog, setActiveDialog] = useState<string | null>(null);

  // Read initial query param
  useEffect(() => {
    const feat = searchParams.get('feature');
    if (feat && ['student', 'group', 'subscriptions', 'circle'].includes(feat)) {
      setActiveDialog(feat);
    }
  }, [searchParams]);

  // Form states for dialogs
  // 1. Student mode form
  const [collegeName, setCollegeName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [studentVerified, setStudentVerified] = useState(false);

  // 2. Group order form
  const [groupName, setGroupName] = useState('');
  const [budgetPerPerson, setBudgetPerPerson] = useState('300');
  const [createdGroupCode, setCreatedGroupCode] = useState<string | null>(null);

  // 3. Subscriptions form
  const [selectedPlan, setSelectedPlan] = useState<'lunch' | 'lunch_dinner' | 'fitness'>('lunch');
  const [mealSlot, setMealSlot] = useState('12:30 PM - 1:30 PM');

  // 4. Hunger Circle form
  const [circleMemberName, setCircleMemberName] = useState('');
  const [circleRelation, setCircleRelation] = useState('Parent');
  const [circleEmoji, setCircleEmoji] = useState('👩');
  const [circleVegOnly, setCircleVegOnly] = useState(false);

  const handleVerifyStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!collegeName.trim() || !studentId.trim()) {
      toast.error('Please enter your college name and student ID.');
      return;
    }
    setStudentVerified(true);
    toast.success('Student ID verified! 15% extra discount unlocked.');
  };

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) {
      toast.error('Please enter a group name.');
      return;
    }
    const code = 'HNG-' + Math.floor(1000 + Math.random() * 9000);
    setCreatedGroupCode(code);
    toast.success(`Group Order "${groupName}" created! Code: ${code}`);
  };

  const handleAddCircleMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!circleMemberName.trim()) {
      toast.error('Please enter family member name.');
      return;
    }
    toast.success(`${circleMemberName} added to your Hunger Circle!`);
    setActiveDialog(null);
    router.push('/customer/circle');
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      {/* Top Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-b from-primary/10 via-background to-background border-b border-border/50 pt-8 pb-10 sm:py-14 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto text-center space-y-3">
          <Badge className="bg-primary/15 text-primary border-primary/30 px-3 py-1 rounded-full text-xs font-bold gap-1.5 shadow-xs">
            <Sparkles className="w-3.5 h-3.5" />
            Hunger Ecosystem
          </Badge>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground">
            More Ways to <span className="text-primary">Order & Save</span>
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
            Discover student canteen deals, group order bill splitting, daily meal plans, and family ordering with your private Hunger Circle.
          </p>

          {/* Quick Dialog Triggers Pill Row */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveDialog('student')}
              className="rounded-full gap-1.5 text-xs font-bold hover:border-blue-500 hover:text-blue-500"
            >
              <span>🎓</span> Student Mode Dialog
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveDialog('group')}
              className="rounded-full gap-1.5 text-xs font-bold hover:border-violet-500 hover:text-violet-500"
            >
              <span>👥</span> Group Order Dialog
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveDialog('subscriptions')}
              className="rounded-full gap-1.5 text-xs font-bold hover:border-emerald-500 hover:text-emerald-500"
            >
              <span>📅</span> Meal Plans Dialog
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveDialog('circle')}
              className="rounded-full gap-1.5 text-xs font-bold hover:border-rose-500 hover:text-rose-500"
            >
              <span>❤️</span> Hunger Circle Dialog
            </Button>
          </div>
        </div>
      </div>

      {/* Main 4 Flagship Feature Cards */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-4 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* 1. Student Mode Card */}
          <motion.div
            whileHover={{ y: -4 }}
            transition={{ duration: 0.2 }}
            className="p-6 rounded-3xl border border-blue-500/25 bg-gradient-to-br from-blue-500/10 via-card to-card shadow-lg flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-500 flex items-center justify-center text-2xl font-black shadow-inner">
                  🎓
                </div>
                <Badge className="bg-blue-500/15 text-blue-500 border-blue-500/30 text-xs font-bold">
                  Deals from ₹99
                </Badge>
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">Student Mode</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Budget canteen meals, late-night hostel deliveries till 2 AM, and verified campus discounts.
                </p>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>Lite Bites at ₹99 & Campus Meals from ₹149</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>Direct doorstep delivery to hostel rooms</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>Student ID verification with 15% extra perk</span>
                </li>
              </ul>
            </div>
            <div className="flex items-center gap-2.5 pt-6 mt-4 border-t border-border/60">
              <Button
                onClick={() => setActiveDialog('student')}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs h-10 shadow-md"
              >
                Open Student Dialog
              </Button>
              <Link href="/customer/student" className="flex-1">
                <Button variant="outline" className="w-full font-bold rounded-xl text-xs h-10 border-blue-500/30 text-blue-500 hover:bg-blue-500/10">
                  Full Page <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* 2. Group Order Card */}
          <motion.div
            whileHover={{ y: -4 }}
            transition={{ duration: 0.2 }}
            className="p-6 rounded-3xl border border-violet-500/25 bg-gradient-to-br from-violet-500/10 via-card to-card shadow-lg flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-violet-500/20 text-violet-500 flex items-center justify-center text-2xl font-black shadow-inner">
                  👥
                </div>
                <Badge className="bg-violet-500/15 text-violet-500 border-violet-500/30 text-xs font-bold">
                  Split The Bill
                </Badge>
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">Group Order</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Invite friends, coworkers, or roomates to add their own dishes and split the bill transparently.
                </p>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                  <span>Single delivery fee for the entire group</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                  <span>Real-time cart synchronization & spending caps</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                  <span>Equal split or pay-for-what-you-ordered options</span>
                </li>
              </ul>
            </div>
            <div className="flex items-center gap-2.5 pt-6 mt-4 border-t border-border/60">
              <Button
                onClick={() => setActiveDialog('group')}
                className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl text-xs h-10 shadow-md"
              >
                Open Group Dialog
              </Button>
              <Link href="/customer/group" className="flex-1">
                <Button variant="outline" className="w-full font-bold rounded-xl text-xs h-10 border-violet-500/30 text-violet-500 hover:bg-violet-500/10">
                  Full Page <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* 3. Meal Plans Card */}
          <motion.div
            whileHover={{ y: -4 }}
            transition={{ duration: 0.2 }}
            className="p-6 rounded-3xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-card to-card shadow-lg flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center text-2xl font-black shadow-inner">
                  📅
                </div>
                <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 text-xs font-bold">
                  Subscribe & Save
                </Badge>
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">Meal Plans & Subscriptions</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Automatic daily lunch & dinner deliveries. Set your schedule, skip days anytime, and save up to 40%.
                </p>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Student & office weekday plans from ₹1,499/mo</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Pause, skip weekends, or adjust delivery slots freely</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Fresh rotating menu prepared by certified kitchens</span>
                </li>
              </ul>
            </div>
            <div className="flex items-center gap-2.5 pt-6 mt-4 border-t border-border/60">
              <Button
                onClick={() => setActiveDialog('subscriptions')}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs h-10 shadow-md"
              >
                Open Plans Dialog
              </Button>
              <Link href="/customer/subscriptions" className="flex-1">
                <Button variant="outline" className="w-full font-bold rounded-xl text-xs h-10 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10">
                  Full Page <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* 4. Hunger Circle Card */}
          <motion.div
            whileHover={{ y: -4 }}
            transition={{ duration: 0.2 }}
            className="p-6 rounded-3xl border border-rose-500/25 bg-gradient-to-br from-rose-500/10 via-card to-card shadow-lg flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-500 flex items-center justify-center text-2xl font-black shadow-inner">
                  ❤️
                </div>
                <Badge className="bg-rose-500/15 text-rose-500 border-rose-500/30 text-xs font-bold">
                  Order For Family
                </Badge>
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">Hunger Circle</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Private family & friends network. Share delivery addresses, record diet restrictions, and order food for loved ones.
                </p>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <span>Send surprise meals to parents, spouse or siblings</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <span>Record dietary allergies & preferences per member</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <span>Shared addresses with automatic GPS pin delivery</span>
                </li>
              </ul>
            </div>
            <div className="flex items-center gap-2.5 pt-6 mt-4 border-t border-border/60">
              <Button
                onClick={() => setActiveDialog('circle')}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs h-10 shadow-md"
              >
                Open Circle Dialog
              </Button>
              <Link href="/customer/circle" className="flex-1">
                <Button variant="outline" className="w-full font-bold rounded-xl text-xs h-10 border-rose-500/30 text-rose-500 hover:bg-rose-500/10">
                  Full Page <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>

        {/* More Hunger Perks & Services Section */}
        <div className="pt-8 space-y-4">
          <h2 className="text-lg font-black tracking-tight text-foreground">Additional Hunger Services</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                title: 'VIP Membership',
                desc: 'Free delivery & zero surge fees',
                icon: Crown,
                href: '/customer/membership',
                color: 'text-amber-500',
                bg: 'bg-amber-500/10',
              },
              {
                title: 'Rewards & Points',
                desc: 'Earn coins on every order',
                icon: Gift,
                href: '/customer/rewards',
                color: 'text-primary',
                bg: 'bg-primary/10',
              },
              {
                title: 'Daily Deals',
                desc: 'Up to 50% off promo codes',
                icon: Tag,
                href: '/customer/deals',
                color: 'text-emerald-500',
                bg: 'bg-emerald-500/10',
              },
              {
                title: 'Live Chat Support',
                desc: 'Real-time order assistance',
                icon: MessageCircle,
                href: '/customer/chat',
                color: 'text-blue-500',
                bg: 'bg-blue-500/10',
              },
            ].map((svc) => (
              <Link key={svc.title} href={svc.href}>
                <div className="p-4 rounded-2xl border border-border bg-card hover:bg-muted/50 transition-all flex flex-col justify-between h-full group">
                  <div className={`w-9 h-9 rounded-xl ${svc.bg} ${svc.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                    <svc.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-foreground">{svc.title}</h4>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{svc.desc}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. STUDENT MODE DIALOG */}
      {/* ───────────────────────────────────────────────────────────── */}
      <Dialog open={activeDialog === 'student'} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent className="max-w-md bg-card border-border text-foreground p-6 rounded-3xl">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-500 flex items-center justify-center text-xl">
                🎓
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-foreground">Hunger Student Mode</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Verify your college credentials to unlock ₹99 meal deals & hostel delivery.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {studentVerified ? (
            <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 space-y-3 text-center my-2">
              <div className="w-12 h-12 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center mx-auto text-2xl">
                ✅
              </div>
              <h4 className="font-bold text-sm text-foreground">Student Verification Active!</h4>
              <p className="text-xs text-muted-foreground">
                You are verified with {collegeName || 'Campus Pass'}. All student discounts are now applied to your cart.
              </p>
              <Link href="/customer/student" className="block pt-2">
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs h-10">
                  Browse Student Canteen Deals →
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleVerifyStudent} className="space-y-3.5 my-2">
              <div>
                <label className="text-xs font-bold text-muted-foreground">College / University Name</label>
                <Input
                  placeholder="e.g. Pune University / IIT / Symbiosis"
                  value={collegeName}
                  onChange={(e) => setCollegeName(e.target.value)}
                  className="rounded-xl mt-1 text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground">Student ID / Roll Number</label>
                <Input
                  placeholder="e.g. STU-2024-890"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="rounded-xl mt-1 text-xs"
                />
              </div>

              {/* Sample ₹99 Deals Pill */}
              <div className="p-3 rounded-xl bg-muted/40 border border-border text-xs space-y-1.5">
                <span className="font-bold text-foreground">Featured Student Canteen Specials:</span>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Badge variant="secondary" className="text-[10px]">🥗 Veg Roll (₹99)</Badge>
                  <Badge variant="secondary" className="text-[10px]">🍛 Dal Rice (₹99)</Badge>
                  <Badge variant="secondary" className="text-[10px]">🥘 Chole Bhature (₹129)</Badge>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs h-10">
                  Verify Student ID
                </Button>
                <Link href="/customer/student" className="flex-1">
                  <Button type="button" variant="outline" className="w-full font-bold rounded-xl text-xs h-10">
                    Visit Hub
                  </Button>
                </Link>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. GROUP ORDER DIALOG */}
      {/* ───────────────────────────────────────────────────────────── */}
      <Dialog open={activeDialog === 'group'} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent className="max-w-md bg-card border-border text-foreground p-6 rounded-3xl">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-violet-500/20 text-violet-500 flex items-center justify-center text-xl">
                👥
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-foreground">Start a Group Order</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Order together with friends, split payment, and share one delivery fee.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {createdGroupCode ? (
            <div className="p-4 rounded-2xl bg-violet-500/10 border border-violet-500/30 space-y-3.5 my-2">
              <div className="text-center">
                <span className="text-[10px] uppercase font-bold text-violet-500 tracking-wider">Group Join Code</span>
                <p className="text-2xl font-black text-foreground tracking-widest mt-0.5">{createdGroupCode}</p>
              </div>
              <div className="flex items-center gap-2 bg-background p-2.5 rounded-xl border border-border text-xs">
                <span className="truncate text-muted-foreground">https://hunger.app/group?code={createdGroupCode}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    navigator.clipboard.writeText(`https://hunger.app/group?code=${createdGroupCode}`);
                    toast.success('Group link copied!');
                  }}
                  className="shrink-0 h-7 text-xs font-bold text-violet-500"
                >
                  <Copy className="w-3.5 h-3.5 mr-1" /> Copy
                </Button>
              </div>
              <Link href="/customer/group" className="block pt-1">
                <Button className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl text-xs h-10">
                  Open Group Order Room →
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleCreateGroup} className="space-y-3.5 my-2">
              <div>
                <label className="text-xs font-bold text-muted-foreground">Group Order Name</label>
                <Input
                  placeholder="e.g. Friday Pizza Night, Office Lunch"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="rounded-xl mt-1 text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground">Spending Cap Per Person (₹)</label>
                <Input
                  type="number"
                  placeholder="e.g. 300"
                  value={budgetPerPerson}
                  onChange={(e) => setBudgetPerPerson(e.target.value)}
                  className="rounded-xl mt-1 text-xs"
                />
              </div>

              <div className="p-3 rounded-xl bg-muted/40 border border-border text-xs space-y-1">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Host:</span>
                  <span className="font-bold text-foreground">{user?.displayName || 'You'}</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Bill Splitting:</span>
                  <span className="font-bold text-foreground">Auto-calculated per dish</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button type="submit" className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl text-xs h-10">
                  Create Group Code
                </Button>
                <Link href="/customer/group" className="flex-1">
                  <Button type="button" variant="outline" className="w-full font-bold rounded-xl text-xs h-10">
                    Join Existing
                  </Button>
                </Link>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. MEAL PLANS DIALOG */}
      {/* ───────────────────────────────────────────────────────────── */}
      <Dialog open={activeDialog === 'subscriptions'} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent className="max-w-md bg-card border-border text-foreground p-6 rounded-3xl">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center text-xl">
                📅
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-foreground">Meal Plans & Subscriptions</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Select your daily recurring plan. Skip or pause days anytime with 1 click.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3.5 my-2">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">Select Subscription Plan</label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { id: 'lunch', title: 'Student Lunch Plan', price: '₹1,499/mo', desc: '1 meal/day, Mon–Fri (22 meals)' },
                  { id: 'lunch_dinner', title: 'Full Day Dual Plan', price: '₹2,999/mo', desc: 'Lunch + Dinner, Mon–Fri (44 meals)' },
                  { id: 'fitness', title: 'Fitness High-Protein', price: '₹3,799/mo', desc: 'Custom macros & grilled meals' },
                ].map((plan) => (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan.id as any)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedPlan === plan.id
                        ? 'border-emerald-500 bg-emerald-500/10 shadow-xs'
                        : 'border-border bg-muted/20 hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-foreground">{plan.title}</h4>
                      <span className="text-xs font-black text-emerald-500">{plan.price}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{plan.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground">Preferred Delivery Slot</label>
              <select
                value={mealSlot}
                onChange={(e) => setMealSlot(e.target.value)}
                className="w-full mt-1 bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-hidden"
              >
                <option value="12:00 PM - 01:00 PM">Lunch: 12:00 PM - 01:00 PM</option>
                <option value="12:30 PM - 01:30 PM">Lunch: 12:30 PM - 01:30 PM</option>
                <option value="07:30 PM - 08:30 PM">Dinner: 07:30 PM - 08:30 PM</option>
                <option value="08:30 PM - 09:30 PM">Dinner: 08:30 PM - 09:30 PM</option>
              </select>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                onClick={() => {
                  toast.success(`Subscribed to plan! Delivery slot set to ${mealSlot}.`);
                  setActiveDialog(null);
                  router.push('/customer/subscriptions');
                }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs h-10"
              >
                Subscribe Now
              </Button>
              <Link href="/customer/subscriptions" className="flex-1">
                <Button variant="outline" className="w-full font-bold rounded-xl text-xs h-10">
                  View Full Menu
                </Button>
              </Link>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. HUNGER CIRCLE DIALOG */}
      {/* ───────────────────────────────────────────────────────────── */}
      <Dialog open={activeDialog === 'circle'} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent className="max-w-md bg-card border-border text-foreground p-6 rounded-3xl">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-500 flex items-center justify-center text-xl">
                ❤️
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-foreground">Hunger Circle — Family & Friends</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Add family members to order food directly to their addresses with their preferred taste.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleAddCircleMember} className="space-y-3.5 my-2">
            <div>
              <label className="text-xs font-bold text-muted-foreground">Member Name</label>
              <Input
                placeholder="e.g. Mom, Dad, Rahul"
                value={circleMemberName}
                onChange={(e) => setCircleMemberName(e.target.value)}
                className="rounded-xl mt-1 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-muted-foreground">Relationship</label>
                <select
                  value={circleRelation}
                  onChange={(e) => setCircleRelation(e.target.value)}
                  className="w-full mt-1 bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-hidden"
                >
                  <option value="Parent">Parent</option>
                  <option value="Sibling">Sibling</option>
                  <option value="Partner">Partner</option>
                  <option value="Friend">Friend</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground">Avatar Emoji</label>
                <div className="flex items-center gap-1.5 mt-1 overflow-x-auto py-1">
                  {['👩', '👨', '👧', '👦', '👵', '👴', '❤️'].map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setCircleEmoji(em)}
                      className={`text-base p-1.5 rounded-lg border transition ${
                        circleEmoji === em ? 'border-rose-500 bg-rose-500/20' : 'border-border'
                      }`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="vegOnly"
                checked={circleVegOnly}
                onChange={(e) => setCircleVegOnly(e.target.checked)}
                className="rounded text-rose-500 focus:ring-rose-500"
              />
              <label htmlFor="vegOnly" className="text-xs text-foreground font-medium cursor-pointer">
                Strict Vegetarian (Filter out non-veg dishes when ordering for them)
              </label>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button type="submit" className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs h-10">
                Add to Circle
              </Button>
              <Link href="/customer/circle" className="flex-1">
                <Button type="button" variant="outline" className="w-full font-bold rounded-xl text-xs h-10">
                  Open Circle Hub
                </Button>
              </Link>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function MorePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>}>
      <MoreFeaturesContent />
    </Suspense>
  );
}
