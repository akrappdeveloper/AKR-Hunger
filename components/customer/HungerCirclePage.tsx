'use client';

/**
 * Hunger Circle — Private Family/Friend Groups
 * ==============================================
 * Create a private circle, add members, save shared addresses,
 * order for another member, and manage food preferences.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, MapPin, Heart, Plus, ChevronRight, ShoppingBag, Bell, Smile, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { HungerCircle, CircleMember } from '@/lib/hunger-types-client';

const EMOJI_AVATARS = ['😊', '👨', '👩', '👦', '👧', '👴', '👵', '🧑', '🧒'];

// Mock demo circle
const DEMO_CIRCLE: HungerCircle = {
  id: 'demo',
  ownerId: 'user1',
  name: 'Aman Family',
  members: [
    {
      userId: 'user1', name: 'Aman', role: 'owner', isHost: true, joinedAt: new Date(),
      canOrderForOthers: true, notifyOnOrder: true,
      foodPreferences: { vegetarian: false, favoriteCuisines: ['Biryani', 'Pizza'] },
    },
    {
      userId: 'user2', name: 'Mom', role: 'member', isHost: false, joinedAt: new Date(),
      canOrderForOthers: true, notifyOnOrder: true,
      foodPreferences: { vegetarian: true, allergies: ['nuts'] },
    },
    {
      userId: 'user3', name: 'Dad', role: 'member', isHost: false, joinedAt: new Date(),
      canOrderForOthers: false, notifyOnOrder: true,
      foodPreferences: { vegetarian: false, favoriteCuisines: ['South Indian'] },
    },
    {
      userId: 'user4', name: 'Brother', role: 'member', isHost: false, joinedAt: new Date(),
      canOrderForOthers: false, notifyOnOrder: false,
      foodPreferences: { vegetarian: false, favoriteCuisines: ['Burger', 'Chinese'] },
    },
  ],
  savedAddresses: [
    { id: 'a1', memberId: 'user1', memberName: 'Aman', label: "Aman's Hostel", address: 'Room 204, Boys Hostel, Delhi University', latitude: 28.6, longitude: 77.2, pincode: '110007' },
    { id: 'a2', memberId: 'user2', memberName: 'Mom', label: 'Home', address: '45 Green Park, New Delhi', latitude: 28.55, longitude: 77.21, pincode: '110016' },
    { id: 'a3', memberId: 'user3', memberName: 'Dad', label: 'Office', address: 'Connaught Place, New Delhi', latitude: 28.63, longitude: 77.22, pincode: '110001' },
  ],
  createdAt: new Date(),
};

interface HungerCirclePageProps {
  currentUserId?: string;
}

export default function HungerCirclePage({ currentUserId = 'user1' }: HungerCirclePageProps) {
  const [circle] = useState<HungerCircle>(DEMO_CIRCLE);
  const [activeTab, setActiveTab] = useState<'members' | 'addresses' | 'settings'>('members');
  const [orderingFor, setOrderingFor] = useState<CircleMember | null>(null);

  const currentMember = circle.members.find(m => m.userId === currentUserId);
  const isOwner = currentMember?.role === 'owner';

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-rose-600 via-pink-600 to-fuchsia-700 px-5 pt-14 pb-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(255,255,255,0.08),transparent_70%)]" />
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative text-white">
          <div className="flex items-center gap-3 mb-2">
            <Heart className="w-7 h-7 fill-white/30" />
            <div>
              <p className="text-white/70 text-sm">Hunger Circle</p>
              <h1 className="text-2xl font-bold">{circle.name}</h1>
            </div>
          </div>
          <p className="text-white/60 text-sm">{circle.members.length} members · Order for anyone, anywhere</p>
        </motion.div>

        {/* Members row */}
        <div className="relative mt-4 flex -space-x-2">
          {circle.members.slice(0, 5).map((m, i) => (
            <motion.div
              key={m.userId}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.08 }}
              className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm border-2 border-white/40 flex items-center justify-center text-lg font-bold text-white shadow-lg"
            >
              {EMOJI_AVATARS[i]}
            </motion.div>
          ))}
          {circle.members.length > 5 && (
            <div className="w-10 h-10 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-xs text-white">
              +{circle.members.length - 5}
            </div>
          )}
        </div>
      </div>

      {/* Order for someone feature */}
      <div className="mx-4 -mt-4 relative z-10">
        <div className="p-4 rounded-2xl bg-card border border-border shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <ShoppingBag className="w-4 h-4 text-rose-400" />
            <span className="font-semibold text-sm">Order for a family member</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {circle.members.filter(m => m.userId !== currentUserId).map((m) => (
              <button
                key={m.userId}
                onClick={() => setOrderingFor(orderingFor?.userId === m.userId ? null : m)}
                className={`flex-shrink-0 flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                  orderingFor?.userId === m.userId
                    ? 'bg-rose-500/20 border-rose-500/40'
                    : 'border-border bg-background hover:border-rose-500/30'
                }`}
              >
                <div className="text-2xl">
                  {EMOJI_AVATARS[circle.members.findIndex(x => x.userId === m.userId)] || '😊'}
                </div>
                <span className="text-xs font-medium">{m.name}</span>
                {m.foodPreferences?.vegetarian && (
                  <span className="text-xs text-emerald-400">🌱</span>
                )}
              </button>
            ))}
          </div>

          <AnimatePresence>
            {orderingFor && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-3 pt-3 border-t border-border"
              >
                <p className="text-sm text-muted-foreground mb-2">
                  Ordering for <span className="font-semibold text-foreground">{orderingFor.name}</span>
                </p>

                {/* Delivery address for the member */}
                {circle.savedAddresses.filter(a => a.memberId === orderingFor.userId).map(addr => (
                  <div key={addr.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/30 border border-border/50 mb-2">
                    <MapPin className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium">{addr.label}</div>
                      <div className="text-xs text-muted-foreground">{addr.address}</div>
                    </div>
                  </div>
                ))}

                {/* Preferences */}
                {orderingFor.foodPreferences && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {orderingFor.foodPreferences.vegetarian && (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">🌱 Veg</Badge>
                    )}
                    {orderingFor.foodPreferences.allergies?.map(a => (
                      <Badge key={a} className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">⚠️ No {a}</Badge>
                    ))}
                    {orderingFor.foodPreferences.favoriteCuisines?.slice(0, 2).map(c => (
                      <Badge key={c} className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">❤️ {c}</Badge>
                    ))}
                  </div>
                )}

                <Button size="sm" className="w-full bg-gradient-to-r from-rose-500 to-pink-600 text-white">
                  <ShoppingBag className="w-3.5 h-3.5 mr-2" />
                  Start Ordering for {orderingFor.name}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mx-4 mt-5 bg-muted/30 p-1 rounded-xl">
        {(['members', 'addresses', 'settings'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all capitalize ${
              activeTab === tab
                ? 'bg-card shadow-sm text-foreground'
                : 'text-muted-foreground'
            }`}
          >
            {tab === 'members' ? '👥 Members' : tab === 'addresses' ? '📍 Addresses' : '⚙️ Settings'}
          </button>
        ))}
      </div>

      {/* Members Tab */}
      {activeTab === 'members' && (
        <div className="px-4 mt-4 space-y-3">
          {circle.members.map((m, i) => (
            <motion.div
              key={m.userId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="p-4 rounded-2xl border border-border bg-card"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center text-2xl">
                  {EMOJI_AVATARS[i]}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{m.name}</span>
                    {m.role === 'owner' && (
                      <Badge className="text-xs bg-amber-500/20 text-amber-400 border-amber-500/30">Owner</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {m.foodPreferences?.vegetarian && (
                      <span className="text-xs bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded-full border border-emerald-500/20">🌱 Veg</span>
                    )}
                    {m.foodPreferences?.favoriteCuisines?.slice(0, 2).map(c => (
                      <span key={c} className="text-xs bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded-full border border-blue-500/20">❤️ {c}</span>
                    ))}
                  </div>
                </div>
                {m.notifyOnOrder && (
                  <Bell className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </motion.div>
          ))}

          {isOwner && (
            <button className="w-full p-4 rounded-2xl border-2 border-dashed border-border hover:border-rose-500/40 transition-colors flex items-center justify-center gap-2 text-muted-foreground hover:text-rose-400">
              <Plus className="w-4 h-4" /> Invite a member
            </button>
          )}
        </div>
      )}

      {/* Addresses Tab */}
      {activeTab === 'addresses' && (
        <div className="px-4 mt-4 space-y-3">
          {circle.savedAddresses.map((addr, i) => (
            <motion.div
              key={addr.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="p-4 rounded-2xl border border-border bg-card"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-rose-500/15 mt-0.5">
                  <MapPin className="w-4 h-4 text-rose-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{addr.label}</span>
                    <Badge className="text-xs bg-muted text-muted-foreground">{addr.memberName}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{addr.address}</p>
                  <p className="text-xs text-muted-foreground">PIN: {addr.pincode}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="px-4 mt-4 space-y-4">
          <div className="p-4 rounded-2xl border border-border bg-card">
            <h3 className="font-semibold mb-4">Circle Settings</h3>
            <div className="space-y-3">
              {[
                { label: 'Circle Name', value: circle.name },
                { label: 'Notifications', value: 'Enabled for all orders' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <span className="text-sm font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-red-500/20 bg-red-500/5">
            <Button variant="ghost" size="sm" className="w-full text-red-400 hover:bg-red-500/10 hover:text-red-400">
              Leave Circle
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
