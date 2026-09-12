'use client';

import React from 'react';
import { Notification } from '@/lib/notifications';
import { useNotifications } from '@/context/NotificationContext';
import { Button } from '@/components/ui/button';
import { X, ShoppingBag, AlertCircle, CheckCircle, Info, Bell } from 'lucide-react';

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
    if (!date) return '';
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  // Determine icon and color based on notification type
  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'order':
        return { icon: <ShoppingBag size={16} />, color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
      case 'alert':
        return { icon: <AlertCircle size={16} />, color: 'bg-red-500/10 text-red-400 border-red-500/20' };
      case 'success':
        return { icon: <CheckCircle size={16} />, color: 'bg-green-500/10 text-green-400 border-green-500/20' };
      case 'system':
        return { icon: <Info size={16} />, color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' };
      default:
        return { icon: <Bell size={16} />, color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' };
    }
  };

  const { icon, color } = getTypeStyles(notification.type);

  return (
    <div
      onClick={handleClick}
      className={`relative flex items-start gap-4 p-4 cursor-pointer transition-all duration-200 group hover:bg-muted/60 ${!notification.read ? 'bg-primary/5' : ''
        }`}
    >
      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border ${color}`}>
        {icon}
      </div>

      <div className="flex-1 min-w-0 pt-0.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className={`text-sm font-semibold truncate ${!notification.read ? 'text-foreground font-bold' : 'text-foreground/80'}`}>
            {notification.title}
          </h3>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap pt-0.5">
            {timeAgo(notification.createdAt)}
          </span>
        </div>

        <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2 group-hover:text-foreground transition-colors">
          {notification.message}
        </p>
      </div>

      {!notification.read && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
      )}

      {/* Delete button (visible on hover) */}
      <button
        onClick={handleDelete}
        className="absolute right-2 top-2 p-1.5 text-muted-foreground hover:text-red-500 rounded-full hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all duration-200"
      >
        <X size={14} />
      </button>
    </div>
  );
}
