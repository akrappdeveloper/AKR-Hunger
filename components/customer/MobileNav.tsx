'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, ShoppingCart, User, Package } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { Badge } from '@/components/ui/badge';

export default function MobileNav() {
    const pathname = usePathname();
    const { items } = useCart();
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    // Don't show on auth pages or non-customer pages
    if (pathname.includes('/login') || pathname.includes('/signup') || pathname.includes('/restaurant')) return null;

    const links = [
        { href: '/customer', icon: Home, label: 'Home' },
        { href: '/customer/search', icon: Search, label: 'Search' },
        { href: '/customer/cart', icon: ShoppingCart, label: 'Cart', badge: itemCount },
        { href: '/customer/orders', icon: Package, label: 'Orders' },
        { href: '/customer/profile', icon: User, label: 'Profile' },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-xl border-t border-gray-800 pb-safe md:hidden shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
            <div className="flex justify-around items-center h-16 px-2">
                {links.map(({ href, icon: Icon, label, badge }) => {
                    const isActive = pathname === href || (href !== '/customer' && pathname.startsWith(href));

                    return (
                        <Link
                            key={href}
                            href={href}
                            className="flex-1 h-full"
                        >
                            <div
                                className={`flex flex-col items-center justify-center w-full h-full gap-1 rounded-xl transition-all duration-300 ${isActive
                                    ? 'text-orange-500'
                                    : 'text-gray-500 hover:text-gray-300'
                                    }`}
                            >
                                <div className={`p-1.5 rounded-full transition-all duration-300 relative ${isActive
                                        ? 'bg-orange-600/20 shadow-[0_0_15px_rgba(234,88,12,0.3)] transform -translate-y-1'
                                        : ''
                                    }`}>
                                    <Icon className={`w-5 h-5 ${isActive ? 'fill-orange-500/20 stroke-2' : ''}`} />
                                    {badge ? (
                                        <Badge className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 flex items-center justify-center p-0 bg-red-600 text-[9px] border border-black text-white z-10">
                                            {badge}
                                        </Badge>
                                    ) : null}
                                </div>
                                <span className={`text-[10px] font-medium transition-all ${isActive ? 'font-bold transform -translate-y-0.5' : ''}`}>{label}</span>
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
