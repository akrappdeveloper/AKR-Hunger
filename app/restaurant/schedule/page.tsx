'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Clock, Calendar, Sun, Moon, AlertTriangle, CheckCircle2,
  Loader2, Save, Plus, Trash2, Coffee
} from 'lucide-react';
import { toast } from 'sonner';

import { checkRestaurantOperatingStatus, formatTime12Hr } from '@/lib/restaurant-schedule';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SHORT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface DaySchedule {
  isOpen: boolean;
  openTime: string;
  closeTime: string;
  breakStart?: string;
  breakEnd?: string;
}

interface SpecialDay {
  date: string;
  reason: string;
  isClosed: boolean;
  openTime?: string;
  closeTime?: string;
}

const DEFAULT_SCHEDULE: Record<string, DaySchedule> = {
  Monday: { isOpen: true, openTime: '09:00', closeTime: '22:00' },
  Tuesday: { isOpen: true, openTime: '09:00', closeTime: '22:00' },
  Wednesday: { isOpen: true, openTime: '09:00', closeTime: '22:00' },
  Thursday: { isOpen: true, openTime: '09:00', closeTime: '22:00' },
  Friday: { isOpen: true, openTime: '09:00', closeTime: '23:00' },
  Saturday: { isOpen: true, openTime: '08:00', closeTime: '23:00' },
  Sunday: { isOpen: true, openTime: '10:00', closeTime: '21:00' },
};

export default function RestaurantSchedulePage() {
  const { user } = useAuth();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<Record<string, DaySchedule>>(DEFAULT_SCHEDULE);
  const [specialDays, setSpecialDays] = useState<SpecialDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preparationTime, setPreparationTime] = useState(30);
  const [maxOrdersPerHour, setMaxOrdersPerHour] = useState(20);
  const [isCurrentlyOpen, setIsCurrentlyOpen] = useState(true);
  const [temporaryClosure, setTemporaryClosure] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Clock tick every minute to re-evaluate real-time operating status
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user) return;
    let unsubscribeRestaurant: (() => void) | null = null;

    const resolveAndListen = async () => {
      try {
        let rid = (user as any)?.restaurantId;

        if (!rid) {
          const userSnap = await getDoc(doc(db, 'users', user.uid));
          if (userSnap.exists() && userSnap.data()?.restaurantId) {
            rid = userSnap.data().restaurantId;
          }
        }

        if (!rid) {
          const directRestDoc = await getDoc(doc(db, 'restaurants', user.uid));
          if (directRestDoc.exists()) {
            rid = user.uid;
          } else {
            const q = query(collection(db, 'restaurants'), where('ownerId', '==', user.uid));
            const ownerSnap = await getDocs(q);
            if (!ownerSnap.empty) {
              rid = ownerSnap.docs[0].id;
            }
          }
        }

        if (!rid) {
          setLoading(false);
          return;
        }

        setRestaurantId(rid);

        // Realtime listener for restaurant document
        unsubscribeRestaurant = onSnapshot(doc(db, 'restaurants', rid), snap => {
          if (!snap.exists()) {
            setLoading(false);
            return;
          }
          const data = snap.data();
          if (data?.schedule) setSchedule({ ...DEFAULT_SCHEDULE, ...data.schedule });
          if (data?.specialDays) setSpecialDays(data.specialDays);
          if (data?.preparationTime) setPreparationTime(data.preparationTime);
          if (data?.maxOrdersPerHour) setMaxOrdersPerHour(data.maxOrdersPerHour);
          
          // Sync isOpen & isCurrentlyOpen seamlessly
          const openState = typeof data?.isCurrentlyOpen === 'boolean'
            ? data.isCurrentlyOpen
            : (typeof data?.isOpen === 'boolean' ? data.isOpen : true);
          setIsCurrentlyOpen(openState);

          setLoading(false);
        });
      } catch (err) {
        console.error('Error resolving restaurant for schedule:', err);
        setLoading(false);
      }
    };

    resolveAndListen();

    return () => {
      if (unsubscribeRestaurant) unsubscribeRestaurant();
    };
  }, [user]);

  const handleSave = async () => {
    if (!restaurantId) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'restaurants', restaurantId), {
        schedule,
        specialDays,
        preparationTime,
        maxOrdersPerHour,
        isCurrentlyOpen,
        isOpen: isCurrentlyOpen,
        updatedAt: new Date(),
      });
      toast.success('Schedule saved successfully! Real-time status updated across apps.');
    } catch (e: any) {
      console.error('Save schedule error:', e);
      toast.error('Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };

  const toggleCurrentlyOpen = async () => {
    if (!restaurantId) return;
    const newVal = !isCurrentlyOpen;
    setIsCurrentlyOpen(newVal);
    try {
      await updateDoc(doc(db, 'restaurants', restaurantId), {
        isCurrentlyOpen: newVal,
        isOpen: newVal,
        updatedAt: new Date(),
      });
      toast.success(
        newVal
          ? '🟢 Restaurant is now OPEN! Customers can order.'
          : '🔴 Restaurant is now CLOSED! Customers can only view & wishlist.'
      );
    } catch (e: any) {
      console.error('Toggle error:', e);
      toast.error('Failed to update live status');
    }
  };

  // Real-time computed operating status
  const currentComputedStatus = checkRestaurantOperatingStatus(
    {
      isOpen: isCurrentlyOpen,
      isCurrentlyOpen,
      schedule,
      specialDays,
    },
    currentTime
  );

  const updateDay = (day: string, field: keyof DaySchedule, value: any) => {
    setSchedule(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
  };

  const addSpecialDay = () => {
    setSpecialDays(prev => [...prev, {
      date: new Date().toISOString().split('T')[0],
      reason: '',
      isClosed: true,
    }]);
  };

  const updateSpecialDay = (i: number, field: keyof SpecialDay, value: any) => {
    setSpecialDays(prev => prev.map((d, idx) => idx === i ? { ...d, [field]: value } : d));
  };

  const removeSpecialDay = (i: number) => {
    setSpecialDays(prev => prev.filter((_, idx) => idx !== i));
  };

  const openDaysCount = Object.values(schedule).filter(d => d.isOpen).length;

  if (loading) return (
    <div className="flex items-center justify-center min-h-96">
      <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
    </div>
  );

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <Clock className="w-6 h-6 text-blue-500" /> Operating Schedule
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Set your weekly hours, breaks & special closures</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Schedule
        </Button>
      </div>

      {/* Live Status Toggle */}
      <Card className={`rounded-2xl border-2 transition-all ${isCurrentlyOpen ? 'border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/10' : 'border-rose-500/50 bg-rose-50/50 dark:bg-rose-950/10'}`}>
        <CardContent className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${isCurrentlyOpen ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-rose-100 dark:bg-rose-900/30'}`}>
              {isCurrentlyOpen ? '🟢' : '🔴'}
            </div>
            <div>
              <p className="font-bold text-base">{isCurrentlyOpen ? 'Restaurant is OPEN' : 'Restaurant is CLOSED'}</p>
              <p className="text-sm text-muted-foreground">Override toggle — overrides weekly schedule instantly across apps</p>
            </div>
          </div>
          <Switch checked={isCurrentlyOpen} onCheckedChange={toggleCurrentlyOpen} className="data-[state=checked]:bg-emerald-500" />
        </CardContent>
      </Card>

      {/* Real-time Customer View Status Banner */}
      <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
        currentComputedStatus.isOpen
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
          : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300'
      }`}>
        <div className="flex items-center gap-2.5">
          <span className="text-xl">{currentComputedStatus.isOpen ? '⚡' : '⏸️'}</span>
          <div>
            <p className="text-xs uppercase font-black tracking-wider opacity-80">
              Customer Live Status Right Now
            </p>
            <p className="text-sm font-bold">
              {currentComputedStatus.isOpen
                ? '🟢 Active & Accepting Orders in Web & Android App'
                : `🔴 Closed to Customers (${currentComputedStatus.reason}) — Ordering & Cart adding disabled, Wishlist only`}
            </p>
          </div>
        </div>
        <Badge variant={currentComputedStatus.isOpen ? 'default' : 'destructive'} className="font-bold shrink-0">
          {currentComputedStatus.isOpen ? 'Live: Open' : 'Live: Closed'}
        </Badge>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="rounded-2xl border-0 shadow-sm text-center p-4">
          <p className="text-3xl font-black text-blue-600">{openDaysCount}</p>
          <p className="text-xs text-muted-foreground">Days Open/Week</p>
        </Card>
        <Card className="rounded-2xl border-0 shadow-sm text-center p-4">
          <p className="text-3xl font-black text-orange-600">{preparationTime}</p>
          <p className="text-xs text-muted-foreground">Min Prep Time</p>
        </Card>
        <Card className="rounded-2xl border-0 shadow-sm text-center p-4">
          <p className="text-3xl font-black text-purple-600">{maxOrdersPerHour}</p>
          <p className="text-xs text-muted-foreground">Max Orders/Hour</p>
        </Card>
      </div>

      {/* Settings */}
      <Card className="rounded-2xl border-0 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Order Settings</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label>Avg. Preparation Time (mins)</Label>
            <Input
              type="number"
              min={5} max={120}
              value={preparationTime}
              onChange={e => setPreparationTime(Number(e.target.value))}
              className="mt-1 rounded-xl"
            />
          </div>
          <div>
            <Label>Max Orders per Hour</Label>
            <Input
              type="number"
              min={1} max={100}
              value={maxOrdersPerHour}
              onChange={e => setMaxOrdersPerHour(Number(e.target.value))}
              className="mt-1 rounded-xl"
            />
          </div>
        </CardContent>
      </Card>

      {/* Weekly Schedule */}
      <Card className="rounded-2xl border-0 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="w-4 h-4 text-blue-500" />
            Weekly Hours
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {DAYS.map((day, i) => {
            const daySchedule = schedule[day] || DEFAULT_SCHEDULE[day];
            return (
              <div key={day} className={`p-4 rounded-2xl transition-colors ${daySchedule.isOpen ? 'bg-muted/40' : 'bg-muted/20 opacity-60'}`}>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="w-24 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={daySchedule.isOpen}
                        onCheckedChange={v => updateDay(day, 'isOpen', v)}
                      />
                      <span className="font-semibold text-sm">{SHORT_DAYS[i]}</span>
                    </div>
                  </div>
                  {daySchedule.isOpen ? (
                    <div className="flex items-center gap-2 flex-1 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <Sun className="w-4 h-4 text-amber-500" />
                        <Input
                          type="time"
                          value={daySchedule.openTime}
                          onChange={e => updateDay(day, 'openTime', e.target.value)}
                          className="w-28 rounded-xl h-8 text-sm"
                        />
                      </div>
                      <span className="text-muted-foreground text-sm">to</span>
                      <div className="flex items-center gap-1.5">
                        <Moon className="w-4 h-4 text-indigo-500" />
                        <Input
                          type="time"
                          value={daySchedule.closeTime}
                          onChange={e => updateDay(day, 'closeTime', e.target.value)}
                          className="w-28 rounded-xl h-8 text-sm"
                        />
                      </div>
                      {daySchedule.breakStart && (
                        <>
                          <span className="text-xs text-muted-foreground ml-2">Break:</span>
                          <Input type="time" value={daySchedule.breakStart || ''} onChange={e => updateDay(day, 'breakStart', e.target.value)} className="w-24 rounded-xl h-8 text-xs" />
                          <span className="text-xs">–</span>
                          <Input type="time" value={daySchedule.breakEnd || ''} onChange={e => updateDay(day, 'breakEnd', e.target.value)} className="w-24 rounded-xl h-8 text-xs" />
                        </>
                      )}
                      {!daySchedule.breakStart && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSchedule(prev => ({ ...prev, [day]: { ...prev[day], breakStart: '14:00', breakEnd: '15:00' } }))}
                          className="text-xs text-muted-foreground rounded-xl"
                        >
                          <Coffee className="w-3 h-3 mr-1" /> Add Break
                        </Button>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Closed</span>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Special Days */}
      <Card className="rounded-2xl border-0 shadow-md">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Special Hours / Closures
          </CardTitle>
          <Button size="sm" variant="outline" onClick={addSpecialDay} className="rounded-xl gap-1 text-xs">
            <Plus className="w-3 h-3" /> Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {specialDays.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No special days added. Add holiday closures or special hours here.
            </p>
          ) : (
            specialDays.map((sd, i) => (
              <div key={i} className="p-4 rounded-2xl bg-muted/40 flex flex-wrap items-center gap-3">
                <Input
                  type="date"
                  value={sd.date}
                  onChange={e => updateSpecialDay(i, 'date', e.target.value)}
                  className="w-36 rounded-xl h-9 text-sm"
                />
                <Input
                  placeholder="Reason (e.g. Diwali, National Holiday)"
                  value={sd.reason}
                  onChange={e => updateSpecialDay(i, 'reason', e.target.value)}
                  className="flex-1 min-w-32 rounded-xl h-9 text-sm"
                />
                <div className="flex items-center gap-2">
                  <Switch
                    checked={sd.isClosed}
                    onCheckedChange={v => updateSpecialDay(i, 'isClosed', v)}
                  />
                  <span className="text-xs font-medium">{sd.isClosed ? 'Closed' : 'Open'}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeSpecialDay(i)}
                  className="text-destructive hover:bg-destructive/10 rounded-xl"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
