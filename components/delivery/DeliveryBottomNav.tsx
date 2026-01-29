'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'; // Shadcn Sheet for generic drawer
import { Button } from '@/components/ui/button';
import { Package, MapPin, TrendingUp, MoreVertical } from 'lucide-react';
import DeliverySidebar from './DeliverySidebar';

// If Sheet is not found in codebase, I might need to implement a simple drawer or check if they have it.
// Assuming they have generic UI components. If not, I'll build a simple fixed overlay.

export default function DeliveryBottomNav() {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);

    // Hide on login/register pages
    if (pathname.includes('/login') || pathname.includes('/register')) return null;

    const mainLinks = [
        { href: '/delivery', label: 'Active', icon: Package },
        { href: '/delivery/available', label: 'Available', icon: MapPin },
        { href: '/delivery/earnings', label: 'Earnings', icon: TrendingUp },
    ];

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-xl border-t border-gray-800 flex justify-around items-center h-16 z-50 px-2 pb-safe shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
            {mainLinks.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href || pathname.startsWith(href) && href !== '/delivery';
                // Enhanced check: 'startsWith' for sub-routes, but exact for dashboard to avoid matching everything
                const isExactActive = href === '/delivery' ? pathname === href : pathname.startsWith(href);

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

            {/* More / Menu Button */}
            <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                    <Button
                        variant="ghost"
                        className="flex-1 h-full flex flex-col items-center justify-center gap-1 rounded-none hover:bg-transparent text-gray-500 hover:text-gray-300"
                    >
                        <MoreVertical className="w-5 h-5" />
                        <span className="text-[10px] font-medium">Menu</span>
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-[85%] max-w-[300px] border-r-gray-800 bg-black text-white">
                    <div className="h-full">
                        <DeliverySidebar isMobile={true} onClose={() => setOpen(false)} />
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}
