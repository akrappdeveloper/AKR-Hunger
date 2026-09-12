'use client';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useRestaurantAuth } from '@/context/RestaurantAuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  BarChart3,
  Settings,
  LogOut,
  Utensils,
  Bell,
  Star,
  Wallet,
  HelpCircle
} from 'lucide-react';
import NotificationBell from '@/components/notifications/NotificationBell';
import ThemeToggle from '@/components/ThemeToggle';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface RestaurantSidebarProps {
  isMobile?: boolean;
  onClose?: () => void;
}

export default function RestaurantSidebar({ isMobile = false, onClose }: RestaurantSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, restaurant, logout } = useRestaurantAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);

  useEffect(() => {
    if (user) {
      fetchCounts();
    }
  }, [user]);

  const fetchCounts = async () => {
    try {
      // Get pending menu items
      const menuItemsRef = collection(db, 'menuItems');
      const pendingQuery = query(
        menuItemsRef,
        where('restaurantId', '==', user!.uid),
        where('approvalStatus', '==', 'pending')
      );
      const pendingSnapshot = await getDocs(pendingQuery);
      setPendingCount(pendingSnapshot.docs.length);

      // Get active orders
      const ordersRef = collection(db, 'orders');
      const activeQuery = query(
        ordersRef,
        where('restaurantId', '==', user!.uid),
        where('status', 'in', ['confirmed', 'preparing', 'ready', 'out_for_delivery'])
      );
      const activeSnapshot = await getDocs(activeQuery);
      setActiveOrdersCount(activeSnapshot.docs.length);
    } catch (error) {
      console.error('[Sidebar] Error fetching counts:', error);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/restaurant/login');
    if (onClose) onClose();
  };

  if (!user) {
    return null;
  }

  const navItems = [
    {
      href: '/restaurant',
      label: 'Dashboard',
      icon: LayoutDashboard,
      exact: true
    },
    {
      href: '/restaurant/orders',
      label: 'Orders',
      icon: ShoppingCart,
      badge: activeOrdersCount > 0 ? activeOrdersCount : undefined
    },
    {
      href: '/restaurant/menu',
      label: 'Menu Management',
      icon: Package,
      badge: pendingCount > 0 ? pendingCount : undefined,
      badgeVariant: 'secondary' as const
    },
    {
      href: '/restaurant/notifications',
      label: 'Notifications',
      icon: Bell
    },
    {
      href: '/restaurant/reviews',
      label: 'Reviews & Ratings',
      icon: Star
    },
    {
      href: '/restaurant/wallet',
      label: 'Wallet',
      icon: Wallet
    },
    {
      href: '/restaurant/quality',
      label: 'Quality Analytics',
      icon: BarChart3
    },
    {
      href: '/restaurant/campaigns',
      label: 'Ad Campaigns',
      icon: Utensils
    },
    {
      href: '/restaurant/analytics',
      label: 'Analytics',
      icon: BarChart3
    },
    {
      href: '/restaurant/settings',
      label: 'Settings',
      icon: Settings
    },
    {
      href: '/restaurant/support',
      label: 'Support',
      icon: HelpCircle
    },
  ];

  const isActive = (href: string, exact?: boolean) => {
    if (exact) {
      return pathname === href;
    }
    return pathname?.startsWith(href);
  };

  return (
    <aside className={`${isMobile
      ? 'w-full h-full'
      : 'hidden md:flex w-72 border-r'
      } bg-card/95 backdrop-blur-xl border-border flex flex-col transition-colors duration-300 shadow-xl z-20`}>
      {/* Header */}
      <div className="p-5 border-b border-border bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-primary to-orange-600 rounded-xl flex items-center justify-center shadow-md shadow-primary/30 ring-2 ring-primary/20">
              <Utensils className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground">AKR Hunger</h1>
              <p className="text-xs text-muted-foreground font-medium">Partner Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {!isMobile && <NotificationBell />}
            <ThemeToggle />
          </div>
        </div>
        <div className="bg-muted/60 backdrop-blur-sm rounded-xl p-3 border border-border/80 shadow-xs">
          <p className="text-sm font-bold text-foreground truncate">{restaurant?.name || 'Restaurant'}</p>
          <p className="text-xs text-muted-foreground truncate font-medium">{user.email}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href, item.exact);

          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={active ? 'default' : 'ghost'}
                onClick={() => {
                  if (isMobile && onClose) onClose();
                }}
                className={`w-full justify-start gap-3 group relative mb-1 h-11 text-sm font-semibold transition-all ${active
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25 scale-[1.01]'
                  : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground hover:scale-[1.01]'
                  }`}
              >
                <Icon className={`w-5 h-5 ${active ? '' : 'group-hover:scale-110 transition-transform text-muted-foreground group-hover:text-foreground'}`} />
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <Badge
                    variant={active ? 'secondary' : (item.badgeVariant || 'destructive')}
                    className={`ml-auto font-bold ${active ? 'bg-primary-foreground/20 text-primary-foreground' : ''}`}
                  >
                    {item.badge}
                  </Badge>
                )}
              </Button>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border bg-muted/20">
        <Button
          onClick={handleLogout}
          variant="outline"
          className="w-full justify-start gap-3 h-11 border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground font-semibold transition-all"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </Button>
      </div>
    </aside>
  );
}
