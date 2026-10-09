'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, ShoppingCart, User, Package, Wallet, Sparkles } from 'lucide-react';
import { useCart } from '@/context/CartContext';

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
        { href: '/customer/more', icon: Sparkles, label: 'More' },
        { href: '/customer/profile', icon: User, label: 'Me' },
    ];

    return (
        <nav
            className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
            {/* Glassmorphic background with top separator */}
            <div className="bg-background/95 backdrop-blur-2xl border-t border-border/60 shadow-[0_-8px_32px_rgba(0,0,0,0.12)]">
                <div className="flex items-stretch h-16 px-1">
                    {links.map(({ href, icon: Icon, label, badge }) => {
                        const isActive = pathname === href || (href !== '/customer' && pathname.startsWith(href));

                        return (
                            <Link
                                key={href}
                                href={href}
                                className="flex-1 relative flex flex-col items-center justify-center gap-[3px] py-1 group"
                                aria-label={label}
                                aria-current={isActive ? 'page' : undefined}
                            >
                                {/* Active indicator line on top */}
                                {isActive && (
                                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-primary" />
                                )}

                                {/* Icon wrapper */}
                                <div className={`relative flex items-center justify-center w-10 h-7 rounded-2xl transition-all duration-300 ${
                                    isActive
                                        ? 'bg-primary/12'
                                        : 'group-hover:bg-muted/60'
                                }`}>
                                    <Icon className={`w-5 h-5 transition-all duration-300 ${
                                        isActive
                                            ? 'text-primary scale-110'
                                            : 'text-muted-foreground group-hover:text-foreground scale-100'
                                    }`} />

                                    {/* Cart badge */}
                                    {badge && badge > 0 && (
                                        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center bg-primary text-primary-foreground text-[9px] font-black rounded-full border border-background leading-none z-10 shadow-sm">
                                            {badge > 99 ? '99+' : badge}
                                        </span>
                                    )}
                                </div>

                                {/* Label */}
                                <span className={`text-[10px] font-semibold tracking-tight transition-all duration-300 leading-none ${
                                    isActive ? 'text-primary font-bold' : 'text-muted-foreground group-hover:text-foreground'
                                }`}>
                                    {label}
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </nav>
    );
}
