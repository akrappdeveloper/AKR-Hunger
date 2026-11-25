'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, updateDoc, setDoc, Timestamp, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Sparkles, Lock, Gift, Dices, Smile, Check, KeyRound,
  Plus, Edit2, Trash2, Tag, RefreshCw, Trophy, ShieldAlert
} from 'lucide-react';
import { MenuItem, Restaurant } from '@/lib/types';

export default function GamificationAdminPage() {
  const [activeTab, setActiveTab] = useState<'vault' | 'mystery' | 'roulette' | 'mood'>('vault');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);

  // Secret Vault Passcodes
  const [passcodes, setPasscodes] = useState<string[]>(['HUNGERSECRET', 'VIP', 'VAULT', 'CHEFGIFT']);
  const [newPasscode, setNewPasscode] = useState('');

  // Mystery Box Settings
  const [mysteryTiers, setMysteryTiers] = useState([
    { id: 'bronze', name: 'Bronze Surprise Box', price: 199, itemsCount: '2-3 items', desc: 'Delicious street bites, rolls & munchies' },
    { id: 'silver', name: 'Silver Gourmet Box', price: 349, itemsCount: '3-4 items', desc: 'Chef specialty curries, premium mains & dessert' },
    { id: 'gold', name: 'Gold Royal Feast Box', price: 599, itemsCount: '5+ items', desc: 'Luxury multi-course feast with artisanal sides' },
  ]);

  // Roulette Prizes
  const [roulettePrizes, setRoulettePrizes] = useState([
    { id: '1', label: 'Flat 25% OFF', code: 'SPIN25', discount: '25% OFF up to ₹100', probability: '35%' },
    { id: '2', label: 'Free Delivery', code: 'SPINFREEDEL', discount: 'Zero delivery fee', probability: '25%' },
    { id: '3', label: '₹60 Cashback', code: 'SPINCASH60', discount: 'Instant wallet credit', probability: '20%' },
    { id: '4', label: 'Flat 50% Mega', code: 'SPIN50MEGA', discount: 'Grand 50% discount', probability: '10%' },
    { id: '5', label: '100 Reward Pts', code: 'SPINPTS100', discount: '100 VIP reward points', probability: '10%' },
  ]);

  useEffect(() => {
    // Fetch dishes and restaurants to link secret dishes
    const fetchCatalog = async () => {
      try {
        const itemSnap = await getDocs(collection(db, 'menuItems'));
        const restSnap = await getDocs(collection(db, 'restaurants'));
        const items: MenuItem[] = [];
        itemSnap.forEach(d => items.push({ id: d.id, ...d.data() } as MenuItem));
        const rests: Restaurant[] = [];
        restSnap.forEach(d => rests.push({ id: d.id, ...d.data() } as Restaurant));
        setMenuItems(items);
        setRestaurants(rests);
      } catch (err) {
        console.error('Error fetching catalog for gamification:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCatalog();
  }, []);

  const handleToggleSecretItem = async (item: MenuItem) => {
    try {
      const isNowSecret = !(item as any).isSecretMenu;
      await updateDoc(doc(db, 'menuItems', item.id), {
        isSecretMenu: isNowSecret,
        secretCodeRequired: isNowSecret ? 'HUNGERSECRET' : null,
      });
      setMenuItems(prev => prev.map(m => m.id === item.id ? { ...m, isSecretMenu: isNowSecret } as any : m));
      toast.success(`${item.name} is now ${isNowSecret ? 'locked in Secret Vault' : 'unlocked in regular menu'}`);
    } catch (err: any) {
      toast.error('Failed to update dish: ' + err.message);
    }
  };

  const handleAddPasscode = () => {
    if (!newPasscode.trim()) return;
    const clean = newPasscode.trim().toUpperCase();
    if (passcodes.includes(clean)) {
      toast.error('Passcode already exists');
      return;
    }
    setPasscodes(prev => [...prev, clean]);
    setNewPasscode('');
    toast.success(`Passcode "${clean}" added to secret vault system.`);
  };

  const handleRemovePasscode = (code: string) => {
    setPasscodes(prev => prev.filter(c => c !== code));
    toast.success(`Passcode "${code}" revoked.`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-purple-500" />
          Gamification, Mystery Box &amp; Secret Vault
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure customer interactive experiences: Secret Vault menus, Mystery Gourmet boxes, Food Roulette wheel rewards, and Mood Food tags.
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
        <TabsList className="bg-card/70 border border-border/60 p-1 rounded-2xl">
          <TabsTrigger value="vault" className="gap-2 rounded-xl text-xs font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Lock className="w-4 h-4" /> Secret Vault Menu
          </TabsTrigger>
          <TabsTrigger value="mystery" className="gap-2 rounded-xl text-xs font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Gift className="w-4 h-4" /> Mystery Food Boxes
          </TabsTrigger>
          <TabsTrigger value="roulette" className="gap-2 rounded-xl text-xs font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Dices className="w-4 h-4" /> Hunger Roulette Wheel
          </TabsTrigger>
          <TabsTrigger value="mood" className="gap-2 rounded-xl text-xs font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Smile className="w-4 h-4" /> Mood Food Matcher
          </TabsTrigger>
        </TabsList>

        {/* 1. SECRET VAULT TAB */}
        <TabsContent value="vault" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Passcodes Management */}
            <Card className="border-border/60 bg-card/60 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-purple-400" /> Active Vault Passcodes
                </CardTitle>
                <CardDescription className="text-xs">
                  Passcodes customers type on /customer/secret-menu to reveal secret dishes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="NEWCODE..."
                    value={newPasscode}
                    onChange={(e) => setNewPasscode(e.target.value.toUpperCase())}
                    className="rounded-xl font-mono uppercase"
                  />
                  <Button onClick={handleAddPasscode} className="rounded-xl font-bold">
                    Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {passcodes.map((code) => (
                    <div key={code} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 border border-border/50">
                      <span className="font-mono font-bold text-sm text-foreground">{code}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemovePasscode(code)}
                        className="h-7 w-7 p-0 text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Secret Dishes Management */}
            <Card className="border-border/60 bg-card/60 backdrop-blur-md md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base font-bold text-foreground flex items-center justify-between">
                  <span>Secret Vault Dishes</span>
                  <Badge variant="outline" className="text-purple-400 border-purple-500/30">
                    {menuItems.filter((m: any) => m.isSecretMenu).length} Dishes Locked
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  Toggle dishes to only appear in the Secret Vault instead of normal category listings.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1">
                  {menuItems.slice(0, 15).map((dish) => {
                    const isSecret = (dish as any).isSecretMenu;
                    return (
                      <div key={dish.id} className="flex items-center justify-between p-3 rounded-xl bg-background/50 border border-border/50">
                        <div>
                          <p className="font-semibold text-sm text-foreground">{dish.name}</p>
                          <p className="text-xs text-muted-foreground">₹{dish.price} • {dish.category || 'Special'}</p>
                        </div>
                        <Button
                          size="sm"
                          variant={isSecret ? 'default' : 'outline'}
                          onClick={() => handleToggleSecretItem(dish)}
                          className={`rounded-xl text-xs font-bold gap-1.5 ${isSecret ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}`}
                        >
                          {isSecret ? <Lock className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                          {isSecret ? 'Vault Exclusive' : 'Standard Menu'}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 2. MYSTERY BOX TAB */}
        <TabsContent value="mystery" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {mysteryTiers.map((tier) => (
              <Card key={tier.id} className="border-border/60 bg-card/60 backdrop-blur-md">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-foreground flex items-center justify-between">
                    {tier.name}
                    <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/30 font-bold">
                      ₹{tier.price}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">{tier.itemsCount}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{tier.desc}</p>
                  <div className="pt-2 border-t border-border/50 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Active in Customer App</span>
                    <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">
                      Live
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* 3. ROULETTE TAB */}
        <TabsContent value="roulette" className="space-y-6 mt-6">
          <Card className="border-border/60 bg-card/60 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Dices className="w-5 h-5 text-purple-400" /> Hunger Roulette Wheel Prize Table
              </CardTitle>
              <CardDescription className="text-xs">
                Active wheel segments and discount codes mapped to /customer/roulette.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="border-border/60">
                    <TableHead className="font-bold">Prize Label</TableHead>
                    <TableHead className="font-bold">Promo Code</TableHead>
                    <TableHead className="font-bold">Discount Details</TableHead>
                    <TableHead className="font-bold">Win Probability</TableHead>
                    <TableHead className="text-right font-bold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roulettePrizes.map((p) => (
                    <TableRow key={p.id} className="border-border/40">
                      <TableCell className="font-bold text-foreground">{p.label}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs text-primary border-primary/30">
                          {p.code}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.discount}</TableCell>
                      <TableCell className="text-sm font-semibold">{p.probability}</TableCell>
                      <TableCell className="text-right">
                        <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30">
                          Active
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. MOOD MATCHER TAB */}
        <TabsContent value="mood" className="space-y-6 mt-6">
          <Card className="border-border/60 bg-card/60 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Smile className="w-5 h-5 text-pink-400" /> Mood-to-Food AI Mapping Rules
              </CardTitle>
              <CardDescription className="text-xs">
                Cuisine categories matched when customers select their current mood on /customer/mood.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { mood: 'Happy & Celebrating 🎉', tags: ['Biryani', 'Pizza', 'Desserts', 'Burgers'] },
                  { mood: 'Stressed / Work Mode 💼', tags: ['Comfort Food', 'Chai', 'Coffee', 'Warm Bowls'] },
                  { mood: 'Chill & Movie Night 🍿', tags: ['Tacos', 'Loaded Fries', 'Wings', 'Pasta'] },
                  { mood: 'Healthy & Fitness 💪', tags: ['Salads', 'Smoothie Bowls', 'Grilled Chicken', 'Quinoa'] },
                  { mood: 'Late Night Cravings 🌙', tags: ['Midnight Rolls', 'Maggi Specials', 'Ice Cream', 'Sandwiches'] },
                  { mood: 'Romantic Dinner 🕯️', tags: ['Italian Pasta', 'Gourmet Kebabs', 'Cheesecakes', 'Mocktails'] },
                ].map((m) => (
                  <div key={m.mood} className="p-4 rounded-2xl bg-background/50 border border-border/50 space-y-2">
                    <p className="font-bold text-sm text-foreground">{m.mood}</p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {m.tags.map((t) => (
                        <Badge key={t} variant="secondary" className="text-xs rounded-lg">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
