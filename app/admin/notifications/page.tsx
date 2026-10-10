'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader } from '@/components/ui/spinner';
import {
    Bell,
    Search,
    CheckCircle,
    Clock,
    User,
    Store,
    Truck,
    AlertCircle,
    Inbox,
    Filter,
    CheckCheck
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

export default function AdminNotificationsPage() {
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        // Fetch all notifications - Assuming a central 'notifications' collection
        // In a real app, you might only fetch specific types, but User asked for ALL
        const q = query(
            collection(db, 'notifications'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q,
            (snapshot) => {
                const data = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    // Ensure createdAt is a Date object or timestamp
                    createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date(doc.data().createdAt)
                }));
                setNotifications(data);
                setLoading(false);
            },
            (error) => {
                console.error("Error fetching notifications:", error);
                toast.error("Failed to load notifications");
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    const handleMarkAllRead = async () => {
        try {
            const batch = writeBatch(db);
            notifications.forEach(notif => {
                if (!notif.isRead) {
                    const ref = doc(db, 'notifications', notif.id);
                    batch.update(ref, { isRead: true });
                }
            });
            await batch.commit();
            toast.success("All notifications marked as read");
        } catch (error) {
            console.error("Error marking read:", error);
            toast.error("Failed to mark notifications as read");
        }
    };

    // Filter Logic
    const filteredNotifications = notifications.filter(notif => {
        // 1. Tab Filter
        let typeMatch = true;
        if (activeTab === 'customer') typeMatch = notif.userType === 'customer' || notif.role === 'customer';
        else if (activeTab === 'restaurant') typeMatch = notif.userType === 'restaurant' || notif.role === 'restaurant';
        else if (activeTab === 'delivery') typeMatch = notif.userType === 'delivery' || notif.role === 'driver';

        // 2. Search Filter
        const searchMatch =
            notif.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            notif.message?.toLowerCase().includes(searchQuery.toLowerCase());

        return typeMatch && searchMatch;
    });

    const getIconForType = (type: string) => {
        switch (type) {
            case 'restaurant': return <Store className="w-5 h-5 text-orange-400" />;
            case 'delivery': return <Truck className="w-5 h-5 text-blue-400" />;
            case 'customer': return <User className="w-5 h-5 text-green-400" />;
            default: return <Bell className="w-5 h-5 text-muted-foreground" />;
        }
    };

    const getBadgeColor = (type: string) => {
        switch (type) {
            case 'restaurant': return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
            case 'delivery': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
            case 'customer': return 'bg-green-500/20 text-green-300 border-green-500/30';
            default: return 'bg-gray-500/20 text-muted-foreground border-border/30';
        }
    };

    if (loading) return (
        <div className="flex justify-center items-center h-screen bg-background text-foreground">
            <Loader />
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2 flex items-center gap-2">
                        <Inbox className="w-8 h-8 text-blue-500" />
                        Notifications Center
                    </h1>
                    <p className="text-foreground font-medium">Monitor alerts from all platform users.</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <Button
                        onClick={handleMarkAllRead}
                        variant="outline"
                        className="border-border bg-secondary/50 text-foreground hover:bg-secondary hover:text-foreground hover:border-border font-semibold w-full md:w-auto"
                    >
                        <CheckCheck className="h-4 w-4 mr-2" />
                        Mark All Read
                    </Button>
                </div>
            </div>

            {/* Main Content */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                    <TabsList className="bg-background/40 border border-border/50 h-11 p-1 w-full md:w-auto overflow-x-auto justify-start backdrop-blur-md">
                        <TabsTrigger value="all" className="data-[state=active]:bg-secondary data-[state=active]:text-foreground text-muted-foreground px-6 font-medium">
                            All
                        </TabsTrigger>
                        <TabsTrigger value="customer" className="data-[state=active]:bg-green-600 data-[state=active]:text-foreground text-muted-foreground px-6 font-medium">
                            <User className="w-4 h-4 mr-2" /> Customers
                        </TabsTrigger>
                        <TabsTrigger value="restaurant" className="data-[state=active]:bg-orange-600 data-[state=active]:text-foreground text-muted-foreground px-6 font-medium">
                            <Store className="w-4 h-4 mr-2" /> Restaurants
                        </TabsTrigger>
                        <TabsTrigger value="delivery" className="data-[state=active]:bg-blue-600 data-[state=active]:text-foreground text-muted-foreground px-6 font-medium">
                            <Truck className="w-4 h-4 mr-2" /> Delivery
                        </TabsTrigger>
                    </TabsList>

                    <div className="relative w-full md:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search notifications..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-background/20 border-border/50 pl-10 text-foreground focus:bg-background/40 focus:border-blue-500/50 transition-all rounded-lg"
                        />
                    </div>
                </div>

                <Card className="bg-background/40 border-border/50 backdrop-blur-xl shadow-2xl min-h-[600px]">
                    <CardContent className="p-0">
                        <ScrollArea className="h-[700px] p-4">
                            {filteredNotifications.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                                    <Inbox className="w-16 h-16 mb-4 opacity-20" />
                                    <p className="text-xl font-medium">No notifications found</p>
                                    <p className="text-sm opacity-60 mt-1">Try adjusting your filters</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {filteredNotifications.map((notif) => (
                                        <div
                                            key={notif.id}
                                            className={`
                        relative group flex flex-col md:flex-row gap-4 p-4 rounded-xl border transition-all duration-300
                        ${notif.isRead
                                                    ? 'bg-card/40 border-border/50/50 hover:bg-card/60'
                                                    : 'bg-gradient-to-r from-gray-900 to-gray-800/50 border-blue-500/30 hover:border-blue-500/50 shadow-lg shadow-blue-500/5'}
                      `}
                                        >
                                            {/* Icon Container */}
                                            <div className={`
                        flex items-center justify-center w-12 h-12 rounded-full shrink-0 shadow-lg
                        ${notif.type === 'alert' ? 'bg-red-500/20 shadow-red-500/10' : 'bg-background/40 shadow-black/20'}
                      `}>
                                                {getIconForType(notif.userType)}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                                    <h3 className={`text-base font-semibold truncate ${notif.isRead ? 'text-muted-foreground' : 'text-foreground'}`}>
                                                        {notif.title}
                                                    </h3>
                                                    <Badge variant="outline" className={`capitalize ml-auto md:ml-2 text-xs py-0.5 px-2 ${getBadgeColor(notif.userType)}`}>
                                                        {notif.userType || 'System'}
                                                    </Badge>
                                                    {!notif.isRead && (
                                                        <span className="flex h-2 w-2 rounded-full bg-blue-500 ml-2 animate-pulse shadow-[0_0_10px_#3b82f6]" />
                                                    )}
                                                </div>

                                                <p className="text-muted-foreground text-sm leading-relaxed mb-2 line-clamp-2">
                                                    {notif.message}
                                                </p>

                                                <div className="flex items-center gap-4 text-xs text-muted-foreground font-medium">
                                                    <span className="flex items-center gap-1.5 bg-background/20 px-2 py-1 rounded-md border border-border/50">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        {notif.createdAt ? formatDistanceToNow(notif.createdAt, { addSuffix: true }) : 'Just now'}
                                                    </span>
                                                    {notif.orderId && (
                                                        <span className="flex items-center gap-1.5 hover:text-blue-400 cursor-pointer transition-colors bg-blue-500/10 px-2 py-1 rounded-md border border-blue-500/20">
                                                            <AlertCircle className="w-3.5 h-3.5" />
                                                            Order #{notif.orderId.substring(0, 6)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </CardContent>
                </Card>
            </Tabs>
        </div>
    );
}
