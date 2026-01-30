'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useDeliveryAuth } from '@/context/DeliveryAuthContext';
import { Button } from '@/components/ui/button';
import { Package, TrendingUp, Settings, LogOut, MapPin, Clock, Phone, Home, ShoppingBag, LayoutDashboard, Bell, Star } from 'lucide-react';
import NotificationBell from '@/components/notifications/NotificationBell';

interface DeliverySidebarProps {
  isMobile?: boolean;
  onClose?: () => void;
}

export default function DeliverySidebar({ isMobile = false, onClose }: DeliverySidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useDeliveryAuth();

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/delivery/login');
      if (onClose) onClose();
    } catch (error) {
      console.error('[v0] Logout failed:', error);
    }
  };

  const handleLinkClick = () => {
    if (isMobile && onClose) {
      onClose(); // Close drawer when a link is clicked
    }
  };

  const menuItems = [
    { href: '/delivery', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/delivery/available', label: 'Marketplace', icon: ShoppingBag },
    { href: '/delivery/history', label: 'History', icon: Clock },
    { href: '/delivery/earnings', label: 'Earnings', icon: TrendingUp },
    { href: '/delivery/settings', label: 'Settings', icon: Settings },
    { href: '/delivery/notifications', label: 'Notifications', icon: Bell },
    { href: '/delivery/reviews', label: 'My Reviews', icon: Star },
    { href: '/delivery/support', label: 'Help & Support', icon: Phone },
  ];

  return (
    <aside className={`${isMobile ? 'w-full h-full border-none' : 'w-72 border-r hidden md:flex'} bg-black/95 backdrop-blur-xl border-gray-800 p-6 flex-col text-white shadow-2xl z-50`}>
      <div className="mb-10 flex items-center justify-between gap-2 px-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/40">
            <Package className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-wide">AKR<span className="text-blue-500">Delivery</span></h1>
            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Partner Portal</p>
          </div>
        </div>
        {!isMobile && <NotificationBell />}
      </div>

      <div className="px-2 mb-2">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 ml-2">Menu</p>
      </div>

      <nav className="flex-1 space-y-1.5">
        {menuItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link key={href} href={href} onClick={handleLinkClick}>
              <Button
                variant="ghost"
                className={`w-full justify-start gap-3 h-12 rounded-xl text-sm font-medium transition-all duration-200 ${isActive
                  ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20 shadow-[0_0_15px_rgba(37,99,235,0.1)]'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-blue-500' : 'text-gray-500'}`} />
                {label}
              </Button>
            </Link>
          )
        })}
      </nav>

      <div className="space-y-4 pt-6 mt-6 border-t border-gray-800">
        {user && (
          <div className="flex items-center gap-3 px-3 py-2 bg-gray-900/50 rounded-lg border border-gray-800">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center border border-gray-600">
              <span className="text-xs font-bold text-white">{user.email?.charAt(0).toUpperCase()}</span>
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-medium text-white truncate">My Account</p>
              <p className="text-[10px] text-gray-500 truncate">{user.email}</p>
            </div>
          </div>
        )}
        <Button
          variant="outline"
          className="w-full justify-start gap-3 bg-red-950/10 border-red-900/20 text-red-400 hover:bg-red-900/20 hover:text-red-300 hover:border-red-900/40 transition-all h-11"
          onClick={handleLogout}
        >
          <LogOut className="w-5 h-5" />
          Logout
        </Button>
      </div>
    </aside>
  );
}
