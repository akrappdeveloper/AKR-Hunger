'use client';

import React, { useState } from 'react';
import { useNotifications } from '@/context/NotificationContext';
import NotificationItem from './NotificationItem';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotificationBell() {
  const { notifications, unreadCount, markAllAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  const recentNotifications = notifications.slice(0, 5);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all duration-300"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-blue-600 rounded-full shadow-[0_0_8px_rgba(37,99,235,0.8)] animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-3 w-[90vw] sm:w-[400px] bg-[#0a0a0a]/90 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-sm">Notifications</h3>
                <span className="bg-blue-600/20 text-blue-400 text-[10px] px-2 py-0.5 rounded-full border border-blue-500/20 font-medium">
                  {unreadCount} New
                </span>
              </div>
              {unreadCount > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    markAllAsRead();
                    // Keep open or close? Usually keep open to see effect
                  }}
                  className="h-7 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                >
                  Mark all read
                </Button>
              )}
            </div>

            <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
              {recentNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                    <Bell className="w-6 h-6 text-gray-600" />
                  </div>
                  <p className="text-gray-400 text-sm font-medium">No new notifications</p>
                  <p className="text-gray-600 text-xs mt-1">You're all caught up!</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {recentNotifications.map((notification) => (
                    <NotificationItem key={notification.id} notification={notification} />
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-white/5 bg-black/20 text-center">
              <Button
                size="sm"
                variant="ghost"
                className="w-full text-xs text-gray-400 hover:text-white hover:bg-white/5 h-8 font-medium"
              >
                View All Activity
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
