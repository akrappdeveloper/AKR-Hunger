'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, ShoppingBag, TrendingUp, Truck, MoreVertical } from 'lucide-react';
import AdminSidebar from './AdminSidebar';

export default function AdminBottomNav() {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);

    const mainLinks = [
        { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/admin/orders', label: 'Orders', icon: ShoppingBag },
        { href: '/admin/analytics', label: 'Analytics', icon: TrendingUp },
        { href: '/admin/delivery', label: 'Delivery', icon: Truck },
    ];

    return (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-2xl border-t border-white/10 flex justify-around items-center h-20 z-50 px-4 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
            {mainLinks.map(({ href, label, icon: Icon }) => {
                const isExactActive = href === '/admin' ? pathname === href : pathname.startsWith(href);

                return (
                    <Link key={href} href={href} className="flex-1">
                        <Button
                            variant="ghost"
                            className={`w-full h-full flex flex-col items-center justify-center gap-1 rounded-xl hover:bg-transparent transition-all duration-300 ${isExactActive
                                ? 'text-blue-400'
                                : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            <div className={`p-1.5 rounded-full transition-all duration-300 ${isExactActive
                                ? 'bg-blue-600/20 shadow-[0_0_15px_rgba(37,99,235,0.3)] transform -translate-y-1'
                                : ''
                                }`}>
                                <Icon className={`w-5 h-5 ${isExactActive ? 'fill-blue-500/20' : ''}`} />
                            </div>
                            <span className={`text-[10px] font-medium transition-all ${isExactActive ? 'font-bold transform -translate-y-0.5' : ''}`}>{label}</span>
                        </Button>
                    </Link>
                )
            })}

            {/* Menu Button -> Opens Admin Sidebar Drawer */}
            <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                    <Button
                        variant="ghost"
                        className="flex-1 h-full flex flex-col items-center justify-center gap-1 rounded-xl hover:bg-transparent text-gray-500 hover:text-gray-300"
                    >
                        <div className="p-1.5 rounded-full">
                            <MoreVertical className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-medium">Menu</span>
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-[85%] max-w-[300px] border-r-gray-800 bg-gray-900 text-white">
                    <div className="h-full overflow-y-auto">
                        <AdminSidebar isMobile={true} onClose={() => setOpen(false)} />
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}
