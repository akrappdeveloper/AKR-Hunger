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
  Wallet
} from 'lucide-react';
import NotificationBell from '@/components/notifications/NotificationBell';
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
      } bg-gradient-to-b from-gray-900/95 via-gray-900/90 to-gray-950/95 backdrop-blur-xl border-gray-800 flex flex-col transition-all duration-300 shadow-2xl`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-800 bg-gradient-to-r from-orange-900/20 to-red-900/20">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30 ring-2 ring-orange-500/20">
              <Utensils className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white">AKR Hunger</h1>
              <p className="text-xs text-gray-400 font-medium">Food Platform</p>
            </div>
          </div>
          {!isMobile && <NotificationBell />}
        </div>
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-3 border border-gray-700 shadow-lg">
          <p className="text-sm font-bold text-white truncate">{restaurant?.name || 'Restaurant'}</p>
          <p className="text-xs text-gray-400 truncate font-medium">{user.email}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
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
                  ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/30 scale-[1.02]'
                  : 'text-gray-300 hover:bg-gray-800/50 hover:text-white hover:scale-[1.01]'
                  }`}
              >
                <Icon className={`w-5 h-5 ${active ? '' : 'group-hover:scale-110 transition-transform'}`} />
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <Badge
                    variant={active ? 'secondary' : (item.badgeVariant || 'destructive')}
                    className={`ml-auto font-bold ${active ? 'bg-white/20 text-white' : ''}`}
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
      <div className="p-4 border-t border-gray-800 bg-gray-950/50">
        <Button
          onClick={handleLogout}
          variant="outline"
          className="w-full justify-start gap-3 h-11 border-red-900/50 bg-red-950/20 text-red-400 hover:bg-red-500 hover:text-white hover:border-red-500 font-semibold transition-all"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </Button>
      </div>
    </aside>
  );
}
