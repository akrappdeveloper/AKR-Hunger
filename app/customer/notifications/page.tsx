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
        <div className="min-h-screen bg-black text-white pb-24 font-sans selection:bg-orange-500/30">
            {/* Background Decoration */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-orange-600/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px]" />
            </div>

            <div className="max-w-3xl mx-auto px-4 py-8 relative z-10">

                {/* Header */}
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <h1 className="text-3xl font-black mb-1 flex items-center gap-3">
                            Notifications
                            <Badge className="bg-orange-500 text-white border-none text-sm px-2 py-0.5 rounded-full">
                                {notifications.filter(n => !n.read).length} New
                            </Badge>
                        </h1>
                        <p className="text-gray-400">Stay updated with your orders and offers</p>
                    </div>

                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={markAllRead} className="border-gray-800 bg-black/50 hover:bg-gray-800 text-gray-300 hover:text-white rounded-xl">
                            <Check className="w-4 h-4 mr-2" /> Mark all read
                        </Button>
                        <Button variant="ghost" size="icon" onClick={clearAll} className="text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl">
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {/* Notifications List */}
                <div className="space-y-4">
                    {notifications.length > 0 ? (
                        notifications.map((n) => (
                            <div
                                key={n.id}
                                className={`group p-5 rounded-3xl border transition-all duration-300 relative overflow-hidden backdrop-blur-md ${!n.read ? 'bg-gradient-to-r from-gray-900 to-black border-orange-500/30 shadow-lg shadow-orange-900/10' : 'bg-black/40 border-white/5 hover:bg-gray-900/60 hover:border-white/10'}`}
                            >
                                <div className="flex gap-5 relative z-10">
                                    {/* Icon */}
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 border shadow-inner ${n.type === 'order' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                                            n.type === 'promo' ? 'bg-orange-500/10 border-orange-500/20 text-orange-400' :
                                                'bg-purple-500/10 border-purple-500/20 text-purple-400'
                                        }`}>
                                        {n.type === 'order' && <Package className="w-6 h-6" />}
                                        {n.type === 'promo' && <Tag className="w-6 h-6" />}
                                        {n.type === 'system' && <Info className="w-6 h-6" />}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start mb-1.5">
                                            <h3 className={`text-lg transition-colors ${!n.read ? 'font-bold text-white' : 'font-medium text-gray-300'}`}>
                                                {n.title}
                                            </h3>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-medium text-gray-500 flex items-center gap-1 bg-black/30 px-2 py-1 rounded-full border border-white/5">
                                                    <Clock className="w-3 h-3" /> {n.time}
                                                </span>
                                                {!n.read && <div className="w-2.5 h-2.5 bg-orange-500 rounded-full shadow-[0_0_10px_rgba(249,115,22,0.8)] animate-pulse" />}
                                            </div>
                                        </div>
                                        <p className="text-sm text-gray-400 leading-relaxed max-w-[90%] group-hover:text-gray-300 transition-colors">
                                            {n.message}
                                        </p>
                                    </div>
                                </div>

                                {/* Background Hover Glow */}
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-20 bg-gray-900/30 rounded-3xl border border-dashed border-gray-800">
                            <div className="w-20 h-20 bg-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/5">
                                <Bell className="w-10 h-10 text-gray-600" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-300 mb-2">No notifications yet</h3>
                            <p className="text-gray-500 max-w-sm mx-auto">You're all caught up! Check back later for updates on your orders and offers.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
