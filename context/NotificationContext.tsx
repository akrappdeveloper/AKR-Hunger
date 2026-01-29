'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, addDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Notification, NotificationType } from '@/lib/notifications';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  clearOldNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [userId, setUserId] = useState<string>('');
  const [userType, setUserType] = useState<'customer' | 'restaurant' | 'delivery' | 'admin'>('customer');

  // Listen for current user (set from auth context in layout)
  useEffect(() => {
    const stored = localStorage.getItem('notif_user');
    if (stored) {
      const { userId, userType } = JSON.parse(stored);
      setUserId(userId);
      setUserType(userType);
    }
  }, []);

  // Setup real-time listener for notifications
  useEffect(() => {
    if (!userId) return;

    const notificationsRef = collection(db, 'notifications');
    const q = query(notificationsRef, where('userId', '==', userId));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      } as Notification));

      // Sort by newest first
      notifs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setNotifications(notifs);
    });

    return () => unsubscribe();
  }, [userId]);

  const addNotification = useCallback(async (notification: Omit<Notification, 'id' | 'createdAt'>) => {
    try {
      const notificationsRef = collection(db, 'notifications');
      await addDoc(notificationsRef, {
        ...notification,
        createdAt: new Date(),
      });
      console.log('[v0] Notification sent:', notification.title);
    } catch (error) {
      console.error('[v0] Error adding notification:', error);
    }
  }, []);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const notifRef = doc(db, 'notifications', notificationId);
      await updateDoc(notifRef, { read: true });
    } catch (error) {
      console.error('[v0] Error marking notification as read:', error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const unreadNotifs = notifications.filter((n) => !n.read);
      for (const notif of unreadNotifs) {
        const notifRef = doc(db, 'notifications', notif.id);
        await updateDoc(notifRef, { read: true });
      }
    } catch (error) {
      console.error('[v0] Error marking all as read:', error);
    }
  }, [notifications]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const notifRef = doc(db, 'notifications', notificationId);
      await updateDoc(notifRef, { deleted: true });
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    } catch (error) {
      console.error('[v0] Error deleting notification:', error);
    }
  }, []);

  const clearOldNotifications = useCallback(async () => {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const notificationsRef = collection(db, 'notifications');
      const q = query(notificationsRef, where('userId', '==', userId), where('createdAt', '<', thirtyDaysAgo));
      const snapshot = await getDocs(q);
      
      for (const doc of snapshot.docs) {
        await updateDoc(doc.ref, { deleted: true });
      }
    } catch (error) {
      console.error('[v0] Error clearing old notifications:', error);
    }
  }, [userId]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, addNotification, markAsRead, markAllAsRead, deleteNotification, clearOldNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};
