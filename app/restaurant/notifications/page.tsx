'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRestaurantAuth } from '@/context/RestaurantAuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Notification as NotificationType } from '@/lib/types';
import {
    Bell, CheckCircle, ShoppingCart, Star, DollarSign,
    AlertCircle, Menu, MessageSquare, TrendingUp, Check, Trash2
} from 'lucide-react';

export default function NotificationsPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useRestaurantAuth();

    const [notifications, setNotifications] = useState<NotificationType[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
    const [typeFilter, setTypeFilter] = useState<string>('all');

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.push('/restaurant/login');
            return;
        }
        loadNotifications();
    }, [user, authLoading, router]);

    const loadNotifications = async () => {
        try {
            setLoading(true);
            const notifRef = collection(db, 'notifications');
            const q = query(
                notifRef,
                where('userId', '==', user!.uid),
                where('userType', '==', 'restaurant')
            );
            const snapshot = await getDocs(q);

            const notifs = snapshot.docs.map((doc) => ({
                ...doc.data(),
                id: doc.id,
            })) as NotificationType[];

            // Sort by date, newest first
            notifs.sort((a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );

            setNotifications(notifs);
        } catch (error) {
            console.error('[Notifications] Error loading:', error);
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async (notificationId: string) => {
        try {
            await updateDoc(doc(db, 'notifications', notificationId), {
                isRead: true,
            });
            setNotifications(notifications.map(n =>
                n.id === notificationId ? { ...n, isRead: true } : n
            ));
        } catch (error) {
            console.error('[Notifications] Error marking as read:', error);
        }
    };

    const markAllAsRead = async () => {
        try {
            const unreadNotifs = notifications.filter(n => !n.isRead);
            await Promise.all(
                unreadNotifs.map(n =>
                    updateDoc(doc(db, 'notifications', n.id!), { isRead: true })
                )
            );
            setNotifications(notifications.map(n => ({ ...n, isRead: true })));
        } catch (error) {
            console.error('[Notifications] Error marking all as read:', error);
        }
    };

    const deleteNotification = async (notificationId: string) => {
        try {
            // In production, you might want to soft delete instead
            setNotifications(notifications.filter(n => n.id !== notificationId));
        } catch (error) {
            console.error('[Notifications] Error deleting:', error);
        }
    };

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'order':
                return <ShoppingCart className="w-5 h-5 text-blue-500" />;
            case 'menu':
                return <Menu className="w-5 h-5 text-orange-500" />;
            case 'review':
                return <Star className="w-5 h-5 text-yellow-500" />;
            case 'payment':
                return <DollarSign className="w-5 h-5 text-green-500" />;
            case 'campaign':
                return <TrendingUp className="w-5 h-5 text-purple-500" />;
            default:
                return <Bell className="w-5 h-5 text-gray-500" />;
        }
    };

    const filteredNotifications = notifications.filter(n => {
        if (filter === 'unread' && n.isRead) return false;
        if (filter === 'read' && !n.isRead) return false;
        if (typeFilter !== 'all' && n.type !== typeFilter) return false;
        return true;
    });

    const unreadCount = notifications.filter(n => !n.isRead).length;

    if (authLoading || loading) {
        return (
            <div className="p-8">
                <div className="animate-pulse space-y-4">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-24 bg-muted rounded-lg" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-400 via-indigo-400 to-blue-300 bg-clip-text text-transparent flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center relative shadow-lg shadow-blue-500/30">
                            <Bell className="w-7 h-7 text-white" />
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold shadow-lg">
                                    {unreadCount}
                                </span>
                            )}
                        </div>
                        Notifications
                    </h1>
                    <p className="text-gray-200 mt-2 text-lg font-medium">
                        {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
                    </p>
                </div>

                {unreadCount > 0 && (
                    <Button onClick={markAllAsRead} variant="outline" className="gap-2 bg-gray-800/50 border-gray-700 text-white hover:bg-gray-700 font-semibold">
                        <CheckCircle className="w-4 h-4" />
                        Mark All as Read
                    </Button>
                )}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
                <Tabs value={filter} onValueChange={(v: any) => setFilter(v)} className="w-full">
                    <TabsList>
                        <TabsTrigger value="all">All</TabsTrigger>
                        <TabsTrigger value="unread">
                            Unread {unreadCount > 0 && <Badge className="ml-2">{unreadCount}</Badge>}
                        </TabsTrigger>
                        <TabsTrigger value="read">Read</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            <div className="flex flex-wrap gap-2">
                {['all', 'order', 'menu', 'review', 'payment', 'campaign', 'system'].map((type) => (
                    <Button
                        key={type}
                        variant={typeFilter === type ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTypeFilter(type)}
                    >
                        {type === 'all' ? 'All Types' : type.charAt(0).toUpperCase() + type.slice(1)}
                    </Button>
                ))}
            </div>

            {/* Notifications List */}
            <div className="space-y-3">
                {filteredNotifications.length === 0 ? (
                    <Card className="p-12 text-center">
                        <Bell className="w-16 h-16 mx-auto text-gray-400 mb-4 opacity-50" />
                        <h3 className="text-lg font-semibold text-white mb-2">No notifications</h3>
                        <p className="text-gray-300">
                            {filter === 'unread' ? 'All caught up! No unread notifications.' :
                                filter === 'read' ? 'No read notifications yet.' :
                                    'You have no notifications yet.'}
                        </p>
                    </Card>
                ) : (
                    filteredNotifications.map((notification) => (
                        <Card
                            key={notification.id}
                            className={`p-5 transition-all cursor-pointer hover:shadow-xl bg-gray-800/50 border-gray-700 ${!notification.isRead ? 'border-l-4 border-l-blue-500 bg-blue-900/20' : ''
                                }`}
                            onClick={() => {
                                if (!notification.isRead) {
                                    markAsRead(notification.id!);
                                }
                                if (notification.actionLink) {
                                    router.push(notification.actionLink);
                                }
                            }}
                        >
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-secondary rounded-lg">
                                    {getNotificationIcon(notification.type)}
                                </div>

                                <div className="flex-1">
                                    <div className="flex items-start justify-between mb-1">
                                        <h3 className="font-semibold text-foreground">{notification.title}</h3>
                                        <div className="flex items-center gap-2">
                                            {!notification.isRead && (
                                                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteNotification(notification.id!);
                                                }}
                                            >
                                                <Trash2 className="w-4 h-4 text-muted-foreground" />
                                            </Button>
                                        </div>
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-2">{notification.message}</p>
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                        <span>{new Date(notification.createdAt).toLocaleString()}</span>
                                        <Badge variant="outline" className="capitalize">{notification.type}</Badge>
                                        {notification.actionLink && (
                                            <span className="text-blue-500">→ View Details</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
