'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import {
  Settings,
  User,
  Bell,
  MapPin,
  Moon,
  Sun,
  Shield,
  Smartphone,
  Volume2,
  Check,
  ChevronRight,
  LogOut,
  Save,
  Loader2,
  Sliders,
  Sparkles,
  HelpCircle,
  Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import ThemeToggle from '@/components/customer/ThemeToggle';
import FullscreenToggle from '@/components/customer/FullscreenToggle';
import { toast } from 'sonner';

export default function CustomerSettingsPage() {
  const router = useRouter();
  const { user, customer, logout } = useAuth();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Preference switches
  const [orderPushEnabled, setOrderPushEnabled] = useState(true);
  const [promoPushEnabled, setPromoPushEnabled] = useState(true);
  const [contactlessDefault, setContactlessDefault] = useState(false);
  const [ringBellDefault, setRingBellDefault] = useState(true);
  const [soundAlerts, setSoundAlerts] = useState(true);

  useEffect(() => {
    if (customer) {
      setName(customer.name || customer.displayName || '');
      setPhone(customer.phone || '');
    } else if (user) {
      setName(user.displayName || (user.email ? user.email.split('@')[0] : ''));
    }
  }, [customer, user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please login to save settings');
      return;
    }

    setIsSaving(true);
    try {
      await setDoc(
        doc(db, 'customers', user.uid),
        {
          name: name.trim(),
          phone: phone.trim(),
          updatedAt: new Date(),
        },
        { merge: true }
      );
      toast.success('Profile settings updated successfully!');
    } catch (err: any) {
      console.error('Failed to update customer settings:', err);
      toast.error(err?.message || 'Could not save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
      toast.success('🔔 Order chime sound played successfully!');
    } catch (err) {
      toast.info('Sound test notification');
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 pt-6">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-8 animate-in fade-in duration-300">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-6">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/25">
              <Settings className="w-6 h-6 animate-spin-slow" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
                Account Settings
                <Badge variant="outline" className="border-primary/30 text-primary text-xs font-bold px-2 py-0.5 rounded-full">
                  Customer
                </Badge>
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Manage your profile, alerts, delivery preferences and display themes
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/customer/profile')}
            className="rounded-xl text-xs font-bold gap-1.5 self-start sm:self-auto border-border hover:bg-muted"
          >
            <User className="w-3.5 h-3.5 text-muted-foreground" />
            Full Profile
          </Button>
        </div>

        {/* Section 1: Personal Profile Details */}
        <Card className="rounded-3xl border-border bg-card shadow-sm">
          <CardHeader className="pb-4 border-b border-border/50">
            <CardTitle className="text-lg font-black flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Personal Information
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Your name displayed across food orders and delivery receipts
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1.5">
                    Your Full Name
                  </label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    className="h-11 rounded-xl bg-muted/40 border-border text-foreground font-semibold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1.5">
                    Registered Email (Read-only)
                  </label>
                  <Input
                    value={user?.email || ''}
                    disabled
                    className="h-11 rounded-xl bg-muted/70 border-border text-muted-foreground"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1.5">
                    Contact Phone Number
                  </label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    className="h-11 rounded-xl bg-muted/40 border-border text-foreground"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1.5">
                    Account Status
                  </label>
                  <div className="h-11 rounded-xl bg-muted/40 border border-border px-3.5 flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">Verified Customer</span>
                    <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold border-0 text-[11px]">
                      Active
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-black rounded-xl text-xs px-6 h-10 shadow-md"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5 mr-1.5" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Section 2: Notifications & Sound */}
        <Card className="rounded-3xl border-border bg-card shadow-sm">
          <CardHeader className="pb-4 border-b border-border/50">
            <CardTitle className="text-lg font-black flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              Notifications & Sound Alerts
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Configure real-time web push alerts and order status sound chimes
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/30 border border-border/60">
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-foreground">Live Order Tracking Alerts</p>
                <p className="text-xs text-muted-foreground">Receive instant alerts when food is prepared and out for delivery</p>
              </div>
              <Switch checked={orderPushEnabled} onCheckedChange={setOrderPushEnabled} />
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/30 border border-border/60">
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-foreground">Special Deals & Food Discounts</p>
                <p className="text-xs text-muted-foreground">Get notified about flash offers, coupons, and seasonal sales</p>
              </div>
              <Switch checked={promoPushEnabled} onCheckedChange={setPromoPushEnabled} />
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/30 border border-border/60">
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-foreground">Order Chime & Sound Effects</p>
                <p className="text-xs text-muted-foreground">Play a cheerful notification sound when delivery status updates</p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTestSound}
                  className="rounded-xl text-xs font-bold h-8 px-2.5 gap-1.5 border-border hover:bg-muted"
                >
                  <Volume2 className="w-3.5 h-3.5 text-primary" />
                  Test Sound
                </Button>
                <Switch checked={soundAlerts} onCheckedChange={setSoundAlerts} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Delivery & Drop-off Preferences */}
        <Card className="rounded-3xl border-border bg-card shadow-sm">
          <CardHeader className="pb-4 border-b border-border/50">
            <CardTitle className="text-lg font-black flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              Delivery & Drop-off Preferences
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Default delivery instructions passed to riders
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/30 border border-border/60">
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-foreground">Contactless Doorstep Drop-off</p>
                <p className="text-xs text-muted-foreground">Rider will place food package at your doorstep or security gate</p>
              </div>
              <Switch checked={contactlessDefault} onCheckedChange={setContactlessDefault} />
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/30 border border-border/60">
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-foreground">Ring Doorbell Upon Arrival</p>
                <p className="text-xs text-muted-foreground">Rider will ring doorbell after placing package</p>
              </div>
              <Switch checked={ringBellDefault} onCheckedChange={setRingBellDefault} />
            </div>

            <div className="pt-2">
              <Button
                variant="outline"
                onClick={() => router.push('/customer/addresses')}
                className="w-full justify-between h-12 rounded-2xl border-border font-bold text-xs hover:bg-muted"
              >
                <span className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  Manage Saved Home & Work Addresses ({customer?.addresses?.length || 0})
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Appearance & Theme Display */}
        <Card className="rounded-3xl border-border bg-card shadow-sm">
          <CardHeader className="pb-4 border-b border-border/50">
            <CardTitle className="text-lg font-black flex items-center gap-2">
              <Moon className="w-5 h-5 text-primary" />
              Appearance & Theme
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Customize the look and feel of your gourmet ordering experience
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/30 border border-border/60">
              <div>
                <p className="text-sm font-bold text-foreground">Theme Mode</p>
                <p className="text-xs text-muted-foreground">Toggle between Light and Dark interface colors</p>
              </div>
              <ThemeToggle variant="compact" />
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/30 border border-border/60">
              <div>
                <p className="text-sm font-bold text-foreground">Fullscreen Immersion</p>
                <p className="text-xs text-muted-foreground">Expand window for an immersive food discovery view</p>
              </div>
              <FullscreenToggle showText className="h-9 px-3 rounded-xl text-xs font-bold" />
            </div>
          </CardContent>
        </Card>

        {/* Section 5: Account & Logout */}
        <Card className="rounded-3xl border-border bg-card shadow-sm">
          <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-0.5 text-center sm:text-left">
              <p className="text-sm font-black text-foreground">Sign out of this device</p>
              <p className="text-xs text-muted-foreground">You can log back in at any time with {user?.email || 'your credentials'}</p>
            </div>

            <Button
              variant="destructive"
              onClick={async () => {
                await logout();
                router.push('/customer/login');
              }}
              className="rounded-xl text-xs font-black px-6 h-10 shadow-sm gap-2"
            >
              <LogOut className="w-4 h-4" />
              Logout Now
            </Button>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
