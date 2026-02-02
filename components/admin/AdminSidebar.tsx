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
    <aside className={`${isMobile ? 'w-full h-full border-none bg-transparent' : 'hidden lg:flex w-72 border-r fixed inset-y-0 z-50'} flex-col bg-black/20 backdrop-blur-xl border-white/5 text-white transition-all duration-300 shadow-2xl`}>
      <div className="p-6 border-b border-white/5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <span className="font-bold text-lg text-white">AK</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight leading-none">AKR Hunger</h1>
            <p className="text-[10px] text-blue-400 font-medium uppercase tracking-widest mt-1">Admin Portal</p>
          </div>
        </div>
        {!isMobile && <NotificationBell />}
      </div>

      <div className="flex-1 px-3 py-6 overflow-y-auto custom-scrollbar">
        <div className="space-y-1">
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
                className={`group flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 border border-transparent ${isActive
                  ? 'bg-blue-600/10 text-white border-blue-500/20 shadow-[0_0_20px_rgba(37,99,235,0.1)]'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                <Icon size={20} className={`transition-colors duration-200 ${isActive ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-300'}`} />
                {item.label}
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.8)]" />
                )}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="p-4 border-t border-white/5 space-y-4 bg-black/20">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-gray-700 to-gray-600 flex items-center justify-center border border-white/10">
            <span className="text-sm font-bold text-white">{admin?.name?.charAt(0) || 'A'}</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium text-white truncate">{admin?.name || 'Admin User'}</p>
            <p className="text-xs text-gray-500 truncate">{admin?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 hover:text-red-300 rounded-lg text-sm font-medium transition-all duration-200 group"
        >
          <LogOut size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          Sign Out
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
