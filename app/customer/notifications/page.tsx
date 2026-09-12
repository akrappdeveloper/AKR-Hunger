'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Bell, Package, Tag, Info, Check, Trash2, Clock, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState([
        { id: 1, type: 'order', title: 'Order Delivered', message: 'Your order from Burger King has been delivered successfully. Enjoy your meal!', time: '2 mins ago', read: false },
        { id: 2, type: 'promo', title: '50% Off Today', message: 'Get flat 50% off on all pizzas today! Use Code: PIZZA50 at checkout.', time: '1 hour ago', read: false },
        { id: 3, type: 'system', title: 'Welcome to AKR', message: 'Thanks for joining AKR Hunger Food team! We are excited to serve you.', time: '1 day ago', read: true },
        { id: 4, type: 'order', title: 'Order Confirmed', message: 'Your order #12345 from Dominos has been confirmed and is being prepared.', time: '2 days ago', read: true },
    ]);

    const markAllRead = () => {
        setNotifications(notifications.map(n => ({ ...n, read: true })));
    };

    const clearAll = () => {
        setNotifications([]);
    };

    return (
        <div className="min-h-screen text-foreground pb-24 md:pb-16 font-sans selection:bg-primary/30">
            {/* Background Decoration */}
            <div className="fixed inset-0 pointer-events-none -z-10">
                <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[140px]" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[140px]" />
            </div>

            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 relative z-10">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 sm:mb-8">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black mb-1 flex items-center gap-3 text-foreground tracking-tight">
                            Notifications
                            <Badge className="bg-primary text-primary-foreground border-none text-xs px-2.5 py-0.5 rounded-full font-bold">
                                {notifications.filter(n => !n.read).length} New
                            </Badge>
                        </h1>
                        <p className="text-xs sm:text-sm text-muted-foreground">Stay updated with your delicious orders and exclusive offers</p>
                    </div>

                    <div className="flex gap-2 self-start sm:self-auto">
                        <Button variant="outline" size="sm" onClick={markAllRead} className="border-border hover:bg-accent text-foreground rounded-xl text-xs font-semibold">
                            <Check className="w-3.5 h-3.5 mr-1.5" /> Mark all read
                        </Button>
                        <Button variant="ghost" size="icon" onClick={clearAll} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl" aria-label="Clear all notifications">
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {/* Notifications List */}
                <div className="space-y-3.5 sm:space-y-4">
                    {notifications.length > 0 ? (
                        notifications.map((n) => (
                            <div
                                key={n.id}
                                className={`group p-4 sm:p-5 rounded-2xl sm:rounded-3xl border transition-all duration-300 relative overflow-hidden backdrop-blur-md shadow-xs ${!n.read ? 'bg-card border-primary/40 shadow-sm' : 'bg-card/70 border-border/60 hover:bg-card hover:border-border'}`}
                            >
                                <div className="flex gap-3.5 sm:gap-4 relative z-10">
                                    {/* Icon */}
                                    <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 border shadow-xs ${n.type === 'order' ? 'bg-sky-500/15 border-sky-500/20 text-sky-600 dark:text-sky-400' :
                                        n.type === 'promo' ? 'bg-amber-500/15 border-amber-500/20 text-amber-600 dark:text-amber-400' :
                                            'bg-purple-500/15 border-purple-500/20 text-purple-600 dark:text-purple-400'
                                        }`}>
                                        {n.type === 'order' && <Package className="w-5 h-5 sm:w-6 sm:h-6" />}
                                        {n.type === 'promo' && <Tag className="w-5 h-5 sm:w-6 sm:h-6" />}
                                        {n.type === 'system' && <Info className="w-5 h-5 sm:w-6 sm:h-6" />}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start gap-2 mb-1">
                                            <h3 className={`text-sm sm:text-base truncate transition-colors ${!n.read ? 'font-bold text-foreground' : 'font-medium text-foreground/80'}`}>
                                                {n.title}
                                            </h3>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1 bg-muted/60 px-2 py-0.5 rounded-full border border-border/40">
                                                    <Clock className="w-3 h-3 text-primary" /> {n.time}
                                                </span>
                                                {!n.read && <div className="w-2.5 h-2.5 bg-primary rounded-full shadow-xs animate-pulse" />}
                                            </div>
                                        </div>
                                        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                                            {n.message}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-20 bg-card border border-dashed border-border rounded-3xl">
                            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6 border border-border">
                                <Bell className="w-10 h-10 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg sm:text-xl font-bold text-foreground mb-1.5">No notifications yet</h3>
                            <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto">You're all caught up! We'll alert you about exciting updates and order statuses.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
