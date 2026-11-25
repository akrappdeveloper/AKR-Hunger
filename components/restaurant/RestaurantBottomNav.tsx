'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, ShoppingBag, UtensilsCrossed, MoreVertical, MonitorPlay, Film } from 'lucide-react';
import RestaurantSidebar from './RestaurantSidebar';

import { useRestaurantAuth } from '@/context/RestaurantAuthContext';

export default function RestaurantBottomNav() {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const { isStaff, hasPermission } = useRestaurantAuth();

    if (
        pathname === '/restaurant/login' ||
        pathname.startsWith('/restaurant/login') ||
        pathname.includes('/staff/login') ||
        pathname.includes('/staff/dashboard/login')
    ) {
        return null;
    }

    const allLinks = [
        { href: isStaff ? '/restaurant/staff/dashboard' : '/restaurant', label: isStaff ? 'Staff' : 'Home', icon: LayoutDashboard, perm: null },
        { href: '/restaurant/orders', label: 'Orders', icon: ShoppingBag, perm: 'orders' },
        { href: '/restaurant/kds', label: 'KDS', icon: MonitorPlay, perm: 'orders' },
        { href: '/restaurant/menu', label: 'Menu', icon: UtensilsCrossed, perm: 'menu' },
        { href: '/restaurant/videos', label: 'Videos', icon: Film, perm: 'menu' },
    ];

    const mainLinks = allLinks.filter((link) => {
        if (!isStaff) return true;
        if (!link.perm) return true;
        return hasPermission(link.perm);
    });

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-xl border-t border-border flex justify-around items-center h-16 z-50 px-2 pb-safe shadow-lg transition-colors duration-300">
            {mainLinks.map(({ href, label, icon: Icon }) => {
                const isExactActive = href === '/restaurant' ? pathname === href : pathname.startsWith(href);

                return (
                    <Link key={href} href={href} className="flex-1">
                        <Button
                            variant="ghost"
                            className={`w-full h-full flex flex-col items-center justify-center gap-1 rounded-xl hover:bg-transparent transition-all duration-300 ${isExactActive
                                ? 'text-primary'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <div className={`p-1.5 rounded-full transition-all duration-300 ${isExactActive
                                    ? 'bg-primary/15 shadow-sm transform -translate-y-1 text-primary'
                                    : ''
                                }`}>
                                <Icon className={`w-5 h-5 ${isExactActive ? 'fill-primary/20' : ''}`} />
                            </div>
                            <span className={`text-[10px] font-medium transition-all ${isExactActive ? 'font-bold transform -translate-y-0.5' : ''}`}>{label}</span>
                        </Button>
                    </Link>
                );
            })}

            {/* Menu Drawer */}
            <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                    <Button
                        variant="ghost"
                        className="flex-1 h-full flex flex-col items-center justify-center gap-1 rounded-xl hover:bg-transparent text-muted-foreground hover:text-foreground"
                    >
                        <div className="p-1.5 rounded-full">
                            <MoreVertical className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-medium">Menu</span>
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-[85%] max-w-[300px] border-r-border bg-card text-card-foreground">
                    <div className="h-full">
                        <RestaurantSidebar isMobile={true} onClose={() => setOpen(false)} />
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}
