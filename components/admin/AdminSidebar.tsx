'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAdminAuth } from '@/context/AdminAuthContext';
import {
  BarChart3,
  Users,
  Store,
  Truck,
  ShoppingCart,
  Settings,
  LogOut,
  Utensils,
  UtensilsCrossed,
  Menu as MenuIcon,
  X,
  LifeBuoy,
  Wallet,
  ShoppingBag,
  DollarSign,
  Bell,
  CreditCard // Added CreditCard icon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import NotificationBell from '@/components/notifications/NotificationBell';

interface AdminSidebarProps {
  isMobile?: boolean;
  onClose?: () => void;
}

const AdminSidebar = ({ isMobile = false, onClose }: AdminSidebarProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const { admin, logout } = useAdminAuth();

  const handleLogout = async () => {
    await logout();
    router.push('/admin/login');
    if (onClose) onClose();
  };

  const menuItems = [
    { href: '/admin', label: 'Dashboard', icon: BarChart3 },
    { href: '/admin/customers', label: 'Customers', icon: Users },
    { href: '/admin/restaurants', label: 'Restaurants', icon: Store },
    { href: '/admin/customer-wallet', label: 'Customer Wallet', icon: Wallet },
    { href: '/admin/card-requests', label: 'Card Requests', icon: CreditCard }, // Added link
    { href: '/admin/menu-approvals', label: 'Menu Approvals', icon: UtensilsCrossed },
    { href: '/admin/delivery', label: 'Delivery Partners', icon: Truck },
    { href: '/admin/orders', label: 'Orders', icon: ShoppingBag },
    { href: '/admin/payments', label: 'Restaurant Payments', icon: Wallet },
    { href: '/admin/delivery-payments', label: 'Delivery Payments', icon: DollarSign },
    { href: '/admin/points', label: 'Points / Wallet', icon: Wallet },
    { href: '/admin/notifications', label: 'Notifications', icon: Bell },
    { href: '/admin/settings', label: 'Settings', icon: Settings },
    { href: '/admin/support', label: 'Support', icon: LifeBuoy },
  ];

  return (
    <aside className={`${isMobile ? 'w-full h-full border-none' : 'hidden lg:flex w-64 border-r fixed inset-y-0 z-50'} flex-col bg-gray-900 border-gray-800 text-white transition-all duration-300`}>
      <div className="p-6 border-b border-gray-800 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">AKR Hunger</h1>
          <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest">Admin Panel</p>
        </div>
        {!isMobile && <NotificationBell />}
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => {
                if (isMobile && onClose) onClose();
              }}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
            >
              <Icon size={20} className={isActive ? 'text-white' : 'text-gray-400'} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-gray-800 p-4 space-y-4">
        <div className="text-sm px-2">
          <p className="text-gray-500 text-xs">Logged in as</p>
          <p className="text-white font-medium truncate">{admin?.name}</p>
          <p className="text-gray-500 text-xs truncate">{admin?.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-start gap-3 px-4 py-2 hover:bg-red-900/20 text-gray-400 hover:text-red-400 rounded-lg text-sm font-medium transition-colors"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
