'use client';

import React, { useState } from 'react';
import { useNotifications } from '@/context/NotificationContext';
import NotificationItem from './NotificationItem';
import { Bell, CheckCheck, Trash2, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

export default function NotificationBell() {
  const { notifications, unreadCount, markAllAsRead, clearOldNotifications } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Determine panel prefix for "View All" link
  const prefix = pathname.startsWith('/admin') ? '/admin' : pathname.startsWith('/delivery') ? '/delivery' : '/restaurant';
  const allLink = `${prefix}/notifications`;

  const recentNotifications = notifications.slice(0, 6);

  return (
    <div className="relative">
      <button
        id="notification-bell-btn"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-all duration-200 group"
        aria-label="Notifications"
      >
        <Bell size={20} className={`transition-transform duration-200 ${isOpen ? 'rotate-12' : 'group-hover:rotate-6'}`} />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute top-0.5 right-0.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-rose-500 rounded-full shadow-lg shadow-rose-500/50"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -8 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="absolute right-0 mt-3 w-[92vw] sm:w-[400px] bg-card border border-border text-card-foreground rounded-2xl shadow-2xl backdrop-blur-xl z-50 overflow-hidden origin-top-right"
            >
              {/* Header */}
              <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-gradient-to-r from-muted/60 to-muted/30">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Bell className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <h3 className="font-bold text-foreground text-sm">Notifications</h3>
                  {unreadCount > 0 && (
                    <span className="bg-rose-500/15 text-rose-500 text-[10px] px-2 py-0.5 rounded-full border border-rose-500/20 font-bold">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={markAllAsRead}
                      className="h-7 text-xs text-muted-foreground hover:text-foreground hover:bg-muted px-2 gap-1"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      All read
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={clearOldNotifications}
                    className="h-7 text-xs text-muted-foreground hover:text-foreground hover:bg-muted px-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* List */}
              <div className="max-h-[56vh] overflow-y-auto custom-scrollbar">
                {recentNotifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                      <Sparkles className="w-7 h-7 text-muted-foreground/50" />
                    </div>
                    <p className="text-foreground text-sm font-semibold">All caught up!</p>
                    <p className="text-muted-foreground text-xs mt-1">No new notifications right now</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    <AnimatePresence>
                      {recentNotifications.map((notification, i) => (
                        <motion.div
                          key={notification.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                        >
                          <NotificationItem notification={notification} onClose={() => setIsOpen(false)} />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-2 border-t border-border bg-muted/20">
                <Link href={allLink} onClick={() => setIsOpen(false)}>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full text-xs text-primary hover:text-primary hover:bg-primary/10 h-9 font-semibold gap-1.5 rounded-xl"
                  >
                    View All Notifications
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
