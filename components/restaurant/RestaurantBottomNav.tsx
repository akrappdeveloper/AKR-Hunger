'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, ShoppingBag, UtensilsCrossed, BarChart3, MoreVertical } from 'lucide-react';
import RestaurantSidebar from './RestaurantSidebar';

export default function RestaurantBottomNav() {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);

    const mainLinks = [
        { href: '/restaurant', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/restaurant/orders', label: 'Orders', icon: ShoppingBag },
        { href: '/restaurant/menu', label: 'Menu', icon: UtensilsCrossed },
    ];

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-xl border-t border-gray-800 flex justify-around items-center h-16 z-50 px-2 pb-safe shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
            {mainLinks.map(({ href, label, icon: Icon }) => {
                // Exact match for dashboard, startsWith for others
                const isExactActive = href === '/restaurant' ? pathname === href : pathname.startsWith(href);

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

            {/* Menu Button */}
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
                <SheetContent side="left" className="p-0 w-[85%] max-w-[300px] border-r-gray-800 bg-black text-white">
                    <div className="h-full">
                        <RestaurantSidebar isMobile={true} onClose={() => setOpen(false)} />
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}
