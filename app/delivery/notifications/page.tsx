'use client';

import React, { useState } from 'react';
import { useNotifications } from '@/context/NotificationContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Bell, Check, Trash2, CheckCheck, Wallet, Package, Truck,
  ShoppingBag, ShieldCheck, MessageSquare, Star, AlertCircle,
  Info, Gift, Sparkles, Clock, ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import WebPushManagerCard from '@/components/notifications/WebPushManagerCard';

const NOTIF_ICONS: Record<string, { icon: any; color: string; bg: string }> = {
  wallet:    { icon: Wallet,       color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  payment:   { icon: Wallet,       color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  order:     { icon: ShoppingBag,  color: 'text-blue-400',    bg: 'bg-blue-500/15' },
  delivery:  { icon: Truck,        color: 'text-violet-400',  bg: 'bg-violet-500/15' },
  kyc:       { icon: ShieldCheck,  color: 'text-amber-400',   bg: 'bg-amber-500/15' },
  review:    { icon: Star,         color: 'text-yellow-400',  bg: 'bg-yellow-500/15' },
  support:   { icon: MessageSquare,color: 'text-cyan-400',    bg: 'bg-cyan-500/15' },
  alert:     { icon: AlertCircle,  color: 'text-rose-400',    bg: 'bg-rose-500/15' },
  promo:     { icon: Gift,         color: 'text-pink-400',    bg: 'bg-pink-500/15' },
  system:    { icon: Info,         color: 'text-gray-400',    bg: 'bg-gray-500/15' },
  default:   { icon: Bell,         color: 'text-gray-400',    bg: 'bg-gray-500/15' },
};

const FILTERS = ['all', 'wallet', 'order', 'delivery', 'kyc', 'support', 'system'] as const;

export default function DeliveryNotificationsPage() {
  const { notifications, markAsRead, deleteNotification, markAllAsRead, clearOldNotifications } = useNotifications();
  const [filter, setFilter] = useState<string>('all');

  const filtered = notifications.filter(n =>
    filter === 'all' || (n as any).type === filter
  );

  const getConfig = (type: string) => NOTIF_ICONS[type] || NOTIF_ICONS.default;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
  };
  const itemVariants = {
    hidden: { x: -16, opacity: 0 },
    visible: { x: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 120 } },
    exit: { x: 20, opacity: 0, transition: { duration: 0.2 } },
  };

  const unread = notifications.filter(n => !n.isRead).length;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="p-4 md:p-6 max-w-3xl mx-auto pb-28 md:pb-6 space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="relative">
          <div className="absolute -left-6 -top-6 w-24 h-24 bg-yellow-500/10 rounded-full blur-2xl -z-10" />
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center">
              <Bell className="w-5 h-5 text-white" />
            </div>
            Notifications
            {unread > 0 && <span className="text-sm bg-rose-500 text-white rounded-full px-2 py-0.5 font-bold">{unread}</span>}
          </h1>
          <p className="text-gray-400 text-sm mt-1">All your alerts, updates & activity in one place</p>
        </div>
        <motion.div variants={itemVariants} className="flex gap-2">
          {unread > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead} className="border-white/10 text-gray-300 hover:text-white hover:bg-white/10 gap-2 text-xs">
              <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> Mark all read
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={clearOldNotifications} className="border-white/10 text-gray-300 hover:text-white hover:bg-white/10 gap-2 text-xs">
            <Trash2 className="w-3.5 h-3.5 text-rose-400" /> Clear old
          </Button>
        </motion.div>
      </motion.div>

      {/* Web Push Management & Testing Card for Delivery Partners */}
      <motion.div variants={itemVariants}>
        <WebPushManagerCard role="delivery" />
      </motion.div>

      {/* Filter Tabs */}
      <motion.div variants={itemVariants} className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${filter===f?'bg-white text-gray-900 border-transparent shadow-lg':'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-white'}`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && (
              <span className="ml-1.5 opacity-60">{notifications.filter(n => (n as any).type === f).length}</span>
            )}
          </button>
        ))}
      </motion.div>

      {/* Notification List */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-24 border border-dashed border-white/10 rounded-3xl bg-white/[0.02]"
            >
              <div className="relative w-20 h-20 mb-5">
                <div className="absolute inset-0 bg-yellow-500/10 blur-xl rounded-full animate-pulse" />
                <div className="relative w-full h-full bg-gradient-to-br from-gray-800 to-black rounded-full flex items-center justify-center border border-white/10">
                  <Sparkles className="w-9 h-9 text-gray-500" />
                </div>
              </div>
              <p className="text-gray-300 font-bold text-lg">All caught up!</p>
              <p className="text-gray-500 text-sm mt-1">No {filter !== 'all' ? filter : ''} notifications</p>
            </motion.div>
          ) : (
            filtered.map(notif => {
              const type = (notif as any).type || 'default';
              const cfg = getConfig(type);
              const Icon = cfg.icon;
              const date = notif.createdAt
                ? (() => { try { const raw = notif.createdAt as any; const d = raw?.toDate?.() || new Date(raw); return format(d, 'MMM d, h:mm a'); } catch { return ''; } })()
                : '';

              return (
                <motion.div
                  key={notif.id}
                  variants={itemVariants}
                  layout
                  exit={{ x: 20, opacity: 0, height: 0, marginBottom: 0 }}
                >
                  <Card
                    className={`rounded-2xl border transition-all cursor-pointer group ${!notif.isRead ? 'bg-white/[0.06] border-white/15 shadow-lg' : 'bg-white/[0.02] border-white/5'}`}
                    onClick={() => markAsRead(notif.id)}
                  >
                    <div className="flex items-start gap-3 p-4">
                      <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                        <Icon className={`w-5 h-5 ${cfg.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className={`text-sm font-semibold leading-tight ${!notif.isRead ? 'text-white' : 'text-gray-300'}`}>{notif.title}</p>
                            <p className="text-gray-400 text-xs mt-1 leading-relaxed">{notif.message || (notif as any).body || ''}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                            {!notif.isRead && <span className="w-2 h-2 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50" />}
                            <button
                              onClick={e => { e.stopPropagation(); deleteNotification(notif.id); }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-600 hover:text-rose-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          {date && <span className="text-[11px] text-gray-600 flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{date}</span>}
                          {type !== 'default' && (
                            <Badge className={`text-[10px] border-0 px-1.5 py-0 font-medium ${cfg.bg} ${cfg.color}`}>
                              {type}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
