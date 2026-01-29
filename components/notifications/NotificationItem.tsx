'use client';

import React from 'react';
import { Notification, getNotificationColor } from '@/lib/notifications';
import { useNotifications } from '@/context/NotificationContext';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface NotificationItemProps {
  notification: Notification;
}

export default function NotificationItem({ notification }: NotificationItemProps) {
  const { markAsRead, deleteNotification } = useNotifications();

  const handleClick = () => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteNotification(notification.id);
  };

  const timeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  return (
    <div
      onClick={handleClick}
      className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-all ${
        getNotificationColor(notification.type)
      } ${!notification.read ? 'opacity-100' : 'opacity-75'} hover:shadow-md`}
    >
      <div className="flex-shrink-0 text-xl">{notification.icon || '📬'}</div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-sm text-foreground">{notification.title}</h3>
        <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
        <p className="text-xs text-muted-foreground mt-2">{timeAgo(notification.createdAt)}</p>
      </div>
      <button
        onClick={handleDelete}
        className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );
}
