'use client';

import React from 'react';
import { useNotifications } from '@/context/NotificationContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Check, Trash2, Calendar, Info, Clock, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

export default function DeliveryNotificationsPage() {
    const { notifications, markAsRead, deleteNotification, markAllAsRead, clearOldNotifications } = useNotifications();

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { x: -20, opacity: 0 },
        visible: { x: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 100 } },
        exit: { x: 20, opacity: 0 }
    };

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto pb-24 md:pb-8"
        >
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
                <motion.div variants={itemVariants} className="relative">
                    <div className="absolute -left-10 -top-10 w-32 h-32 bg-yellow-500/20 rounded-full blur-[50px] -z-10" />
                    <h1 className="text-4xl font-black text-white tracking-tight drop-shadow-xl mb-2">
                        Notifi<span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-500">cations</span>
                    </h1>
                    <p className="text-gray-400 font-medium">Stay updated with your latest alerts.</p>
                </motion.div>

                <motion.div variants={itemVariants} className="flex gap-2 backdrop-blur-lg bg-white/5 p-1 rounded-xl border border-white/10">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={markAllAsRead}
                        className="text-gray-400 hover:text-white hover:bg-white/10 rounded-lg"
                    >
                        <Check className="w-4 h-4 mr-2 text-green-400" /> Mark all read
                    </Button>
                    <div className="w-px bg-white/10 my-1" />
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearOldNotifications}
                        className="text-gray-400 hover:text-white hover:bg-white/10 rounded-lg"
                    >
                        <Trash2 className="w-4 h-4 mr-2 text-red-400" /> Clear old
                    </Button>
                </motion.div>
            </div>

            <div className="space-y-4">
                <AnimatePresence mode='popLayout'>
                    {notifications.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex flex-col items-center justify-center py-24 bg-gradient-to-b from-white/[0.02] to-transparent border border-white/5 border-dashed rounded-3xl"
                        >
                            <div className="relative w-24 h-24 mb-6">
                                <div className="absolute inset-0 bg-yellow-500/20 blur-xl rounded-full animate-pulse" />
                                <div className="relative w-full h-full bg-gradient-to-br from-gray-800 to-black rounded-full flex items-center justify-center border border-white/10 shadow-2xl">
                                    <Bell className="w-10 h-10 text-gray-500" />
                                </div>
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">No notifications</h3>
                            <p className="text-gray-500">You're up to date! Check back later.</p>
                        </motion.div>
                    ) : (
                        notifications.map((notification) => (
                            <motion.div
                                key={notification.id}
                                variants={itemVariants}
                                layout
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                className="group"
                            >
                                <div className={`relative overflow-hidden rounded-2xl border transition-all duration-300 ${!notification.read
                                    ? 'bg-gradient-to-r from-gray-900 via-gray-900 to-blue-900/10 border-blue-500/30 shadow-lg shadow-blue-900/10'
                                    : 'bg-black/40 border-white/5 hover:border-white/10'
                                    }`}>
                                    {/* Glow for unread */}
                                    {!notification.read && <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-400 to-blue-600" />}

                                    <div className="p-5 flex gap-5 relative z-10">
                                        <div className={`mt-1 w-12 h-12 rounded-full flex items-center justify-center shrink-0 border ${!notification.read
                                            ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                                            : 'bg-gray-800/50 border-gray-700/50 text-gray-500'
                                            }`}>
                                            {(notification.type as string) === 'success' ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : <Info className="w-5 h-5" />}
                                        </div>

                                        <div className="flex-1 space-y-1">
                                            <div className="flex justify-between items-start gap-3">
                                                <h4 className={`text-base leading-tight ${!notification.read ? 'font-bold text-white' : 'font-medium text-gray-400'}`}>
                                                    {notification.title}
                                                </h4>
                                                {!notification.read && (
                                                    <Badge className="bg-blue-500 text-white border-none py-0.5 px-2 text-[10px] tracking-wide font-bold shadow-lg shadow-blue-500/20">NEW</Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-400 leading-relaxed font-light">{notification.message}</p>
                                            <div className="flex items-center gap-4 pt-2">
                                                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                                    <Clock className="w-3 h-3" />
                                                    {format(new Date(notification.createdAt), 'h:mm a')}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                                    <Calendar className="w-3 h-3" />
                                                    {format(new Date(notification.createdAt), 'MMM d')}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pl-2 border-l border-white/5">
                                            {!notification.read && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-blue-400 hover:text-white hover:bg-blue-600/20 rounded-lg"
                                                    onClick={() => markAsRead(notification.id)}
                                                    title="Mark as read"
                                                >
                                                    <Check className="w-4 h-4" />
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg"
                                                onClick={() => deleteNotification(notification.id)}
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}
