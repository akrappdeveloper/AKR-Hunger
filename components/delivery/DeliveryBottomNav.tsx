'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Package, MapPin, TrendingUp, MoreVertical, LayoutGrid, DollarSign, Flame, ShieldAlert } from 'lucide-react';
import DeliverySidebar from './DeliverySidebar';
import { motion, AnimatePresence } from 'framer-motion';

export default function DeliveryBottomNav() {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);

    if (pathname.includes('/login') || pathname.includes('/register')) return null;

    const mainLinks = [
        { href: '/delivery', label: 'Active', icon: Package },
        { href: '/delivery/available', label: 'Market', icon: MapPin },
        { href: '/delivery/hotspots', label: 'Surge', icon: Flame },
        { href: '/delivery/earnings', label: 'Earn', icon: DollarSign },
        { href: '/delivery/safety', label: 'SOS', icon: ShieldAlert },
    ];

    return (
        <div className="md:hidden fixed bottom-6 left-4 right-4 z-50">
            {/* Soft Glow Behind */}
            <div className="absolute inset-0 bg-black/40 blur-xl rounded-full -z-10 transform translate-y-2 opacity-50" />

            <motion.nav
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-full h-16 px-2 flex items-center justify-between shadow-2xl relative overflow-hidden"
            >
                {/* Floating Gradient Background */}
                <div className="absolute inset-0 bg-gradient-to-r from-blue-900/10 via-purple-900/10 to-blue-900/10 pointer-events-none" />

                {mainLinks.map(({ href, label, icon: Icon }) => {
                    const isActive = href === '/delivery' ? pathname === href : pathname.startsWith(href);

                    return (
                        <Link key={href} href={href} className="flex-1 h-full relative group">
                            <div className="relative w-full h-full flex flex-col items-center justify-center gap-0.5">
                                {isActive && (
                                    <motion.div
                                        layoutId="bottomNavIndicator"
                                        className="absolute inset-2 bg-gradient-to-b from-blue-500/20 to-blue-600/10 rounded-2xl -z-10"
                                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    />
                                )}

                                <div className={`p-2 rounded-full transition-all duration-300 relative ${isActive ? '' : ''}`}>
                                    {isActive && (
                                        <motion.div
                                            initial={{ scale: 0 }} animate={{ scale: 1 }}
                                            className="absolute inset-0 bg-blue-500 blur-lg opacity-40"
                                        />
                                    )}
                                    <Icon className={`w-5 h-5 relative z-10 transition-all duration-300 ${isActive ? 'text-blue-400 stroke-[2.5px] -translate-y-1' : 'text-gray-400 group-hover:text-gray-200'}`} />
                                </div>
                                <span className={`text-[10px] font-medium transition-all duration-300 ${isActive ? 'text-white scale-105' : 'text-gray-500'}`}>
                                    {label}
                                </span>

                                {isActive && (
                                    <motion.div
                                        layoutId="activeDot"
                                        className="absolute bottom-2 w-1 h-1 bg-blue-400 rounded-full shadow-[0_0_5px_currentColor]"
                                    />
                                )}
                            </div>
                        </Link>
                    )
                })}

                {/* More / Menu Button */}
                <Sheet open={open} onOpenChange={setOpen}>
                    <SheetTrigger asChild>
                        <div className="flex-1 h-full cursor-pointer relative group flex flex-col items-center justify-center gap-0.5">
                            <div className={`p-2 rounded-full transition-all duration-300 ${open ? 'bg-white/10' : ''}`}>
                                <LayoutGrid className={`w-5 h-5 transition-colors ${open ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`} />
                            </div>
                            <span className={`text-[10px] font-medium transition-colors ${open ? 'text-white' : 'text-gray-500'}`}>Menu</span>
                        </div>
                    </SheetTrigger>
                    <SheetContent side="left" className="p-0 w-[85%] max-w-[320px] bg-black border-r border-white/10 text-white z-[60]">
                        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                        <div className="h-full bg-gradient-to-br from-black via-gray-900 to-black">
                            <DeliverySidebar isMobile={true} onClose={() => setOpen(false)} />
                        </div>
                    </SheetContent>
                </Sheet>
            </motion.nav>
        </div>
    );
}
