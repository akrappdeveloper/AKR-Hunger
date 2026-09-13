'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, addDoc, getDocs, writeBatch } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import { Notification, NotificationType } from '@/lib/notifications';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  clearAllNotifications: () => Promise<void>;
  clearOldNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [userId, setUserId] = useState<string>('');
  const [userType, setUserType] = useState<'customer' | 'restaurant' | 'delivery' | 'admin'>('customer');

  // Listen for current user (only set userId for Firestore queries if actively authenticated)
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId('');
        setNotifications([]);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Setup real-time listener for notifications (strictly require authenticated user)
  useEffect(() => {
    if (!userId || !auth.currentUser) {
      setNotifications([]);
      return;
    }

    const notificationsRef = collection(db, 'notifications');
    const q = query(notificationsRef, where('userId', '==', userId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notifs = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data();
            let parsedDate = new Date();
            if (data.createdAt?.toDate) {
              parsedDate = data.createdAt.toDate();
            } else if (data.createdAt) {
              parsedDate = new Date(data.createdAt);
            }

            const isItemRead = Boolean(data.read ?? data.isRead ?? false);

            return {
              ...data,
              id: docSnap.id,
              read: isItemRead,
              isRead: isItemRead,
              createdAt: parsedDate,
            } as Notification;
          })
          .filter((n) => !n.deleted); // Exclude soft-deleted items

        // Sort by newest first
        notifs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        setNotifications(notifs);
      },
      (error) => {
        if (error.code !== 'permission-denied') {
          console.error('[NotificationContext] Real-time listener notice:', error);
        }
      }
    );

    return () => unsubscribe();
  }, [userId]);

  const addNotification = useCallback(async (notification: Omit<Notification, 'id' | 'createdAt'>) => {
    try {
      const notificationsRef = collection(db, 'notifications');
      await addDoc(notificationsRef, {
        ...notification,
        read: false,
        isRead: false,
        deleted: false,
        createdAt: new Date(),
      });
    } catch (error) {
      console.error('[NotificationContext] Error adding notification:', error);
    }
  }, []);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const notifRef = doc(db, 'notifications', notificationId);
      await updateDoc(notifRef, { read: true, isRead: true });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true, isRead: true } : n))
      );
    } catch (error) {
      console.error('[NotificationContext] Error marking notification as read:', error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const unreadNotifs = notifications.filter((n) => !n.read && !n.isRead);
      if (unreadNotifs.length === 0) return;

      const batch = writeBatch(db);
      for (const notif of unreadNotifs) {
        const notifRef = doc(db, 'notifications', notif.id);
        batch.update(notifRef, { read: true, isRead: true });
      }
      await batch.commit();

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true, isRead: true })));
    } catch (error) {
      console.error('[NotificationContext] Error marking all as read:', error);
    }
  }, [notifications]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const notifRef = doc(db, 'notifications', notificationId);
      await updateDoc(notifRef, { deleted: true });
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    } catch (error) {
      console.error('[NotificationContext] Error deleting notification:', error);
    }
  }, []);

  const clearAllNotifications = useCallback(async () => {
    try {
      if (notifications.length === 0) return;
      const batch = writeBatch(db);
      for (const notif of notifications) {
        const notifRef = doc(db, 'notifications', notif.id);
        batch.update(notifRef, { deleted: true });
      }
      await batch.commit();
      setNotifications([]);
    } catch (error) {
      console.error('[NotificationContext] Error clearing all notifications:', error);
    }
  }, [notifications]);

  const clearOldNotifications = useCallback(async () => {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const notificationsRef = collection(db, 'notifications');
      const q = query(notificationsRef, where('userId', '==', userId), where('createdAt', '<', thirtyDaysAgo));
      const snapshot = await getDocs(q);

      const batch = writeBatch(db);
      for (const docSnap of snapshot.docs) {
        batch.update(docSnap.ref, { deleted: true });
      }
      await batch.commit();
    } catch (error) {
      console.error('[NotificationContext] Error clearing old notifications:', error);
    }
  }, [userId]);

  const unreadCount = notifications.filter((n) => !n.read && !n.isRead).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAllNotifications,
        clearOldNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    return {
      notifications: [],
      unreadCount: 0,
      addNotification: async () => {},
      markAsRead: async () => {},
      markAllAsRead: async () => {},
      deleteNotification: async () => {},
      clearAllNotifications: async () => {},
      clearOldNotifications: async () => {},
    };
  }
  return context;
};
