'use client';

import React from 'react';
import { useNotifications } from '@/context/NotificationContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Check, Trash2, Calendar, Info } from 'lucide-react';
import { format } from 'date-fns';

export default function DeliveryNotificationsPage() {
    const { notifications, markAsRead, deleteNotification, markAllAsRead, clearOldNotifications } = useNotifications();

    return (
        <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Notifications</h1>
                    <p className="text-gray-400 mt-1">Stay updated with your latest alerts and messages.</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={markAllAsRead}
                        className="border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800"
                    >
                        <Check className="w-4 h-4 mr-2" /> Mark all read
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearOldNotifications}
                        className="text-gray-500 hover:text-red-400 hover:bg-red-900/10"
                    >
                        Clear old
                    </Button>
                </div>
            </div>

            <div className="space-y-4">
                {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-gray-900/30 border border-gray-800 border-dashed rounded-xl">
                        <div className="w-16 h-16 bg-gray-800/50 rounded-full flex items-center justify-center mb-4">
                            <Bell className="w-8 h-8 text-gray-600" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-300">No notifications</h3>
                        <p className="text-gray-500 text-sm">You're all caught up!</p>
                    </div>
                ) : (
                    notifications.map((notification) => (
                        <Card
                            key={notification.id}
                            className={`border-gray-800 transition-all duration-200 ${!notification.read ? 'bg-gray-900 border-l-4 border-l-blue-500' : 'bg-gray-900/50 opacity-75 hover:opacity-100'
                                }`}
                        >
                            <CardContent className="p-4 flex gap-4">
                                <div className={`mt-1 p-2 rounded-full shrink-0 ${!notification.read ? 'bg-blue-900/20 text-blue-400' : 'bg-gray-800 text-gray-500'
                                    }`}>
                                    <Info className="w-5 h-5" />
                                </div>

                                <div className="flex-1 space-y-1">
                                    <div className="flex justify-between items-start">
                                        <h4 className={`text-base ${!notification.read ? 'font-bold text-white' : 'font-medium text-gray-300'}`}>
                                            {notification.title}
                                        </h4>
                                        {!notification.read && (
                                            <Badge variant="default" className="bg-blue-600 hover:bg-blue-700 text-[10px] h-5">NEW</Badge>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-400 leading-relaxed">{notification.message}</p>
                                    <div className="flex items-center gap-3 pt-2 text-xs text-gray-500">
                                        <span className="flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {format(new Date(notification.createdAt), 'MMM d, h:mm a')}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity md:opacity-100">
                                    {!notification.read && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-gray-400 hover:text-blue-400 hover:bg-blue-900/20"
                                            onClick={() => markAsRead(notification.id)}
                                            title="Mark as read"
                                        >
                                            <Check className="w-4 h-4" />
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-gray-500 hover:text-red-400 hover:bg-red-900/20"
                                        onClick={() => deleteNotification(notification.id)}
                                        title="Delete"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
