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
        className="relative p-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-background border border-border rounded-lg shadow-lg z-50">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Notifications</h3>
            {unreadCount > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={markAllAsRead}
                className="text-xs"
              >
                Mark all as read
              </Button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {recentNotifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <p>No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentNotifications.map((notification) => (
                  <NotificationItem key={notification.id} notification={notification} />
                ))}
              </div>
            )}
          </div>

          {notifications.length > 5 && (
            <div className="p-3 border-t border-border text-center">
              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs bg-transparent"
              >
                View all notifications
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
