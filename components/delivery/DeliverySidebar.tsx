'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useDeliveryAuth } from '@/context/DeliveryAuthContext';
import { Button } from '@/components/ui/button';
import {
  Package,
  TrendingUp,
  Settings,
  LogOut,
  MapPin,
  Clock,
  Phone,
  ShoppingBag,
  LayoutDashboard,
  Bell,
  Star,
  ChevronRight
} from 'lucide-react';
import NotificationBell from '@/components/notifications/NotificationBell';
import { motion, AnimatePresence, Variants } from 'framer-motion';

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

  const menuItems = [
    { href: '/delivery', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/delivery/available', label: 'Marketplace', icon: ShoppingBag },
    { href: '/delivery/history', label: 'History', icon: Clock },
    { href: '/delivery/earnings', label: 'Earnings', icon: TrendingUp },
    { href: '/delivery/settings', label: 'Settings', icon: Settings },
    { href: '/delivery/notifications', label: 'Notifications', icon: Bell },
    { href: '/delivery/reviews', label: 'Reviews', icon: Star },
    { href: '/delivery/support', label: 'Support', icon: Phone },
  ];

  const sidebarVariants: Variants = {
    hidden: { x: -300, opacity: 0 },
    visible: {
      x: 0,
      opacity: 1,
      transition: {
        type: "spring" as const,
        stiffness: 100,
        damping: 20,
        staggerChildren: 0.05,
        delayChildren: 0.1
      }
    },
    exit: { x: -300, opacity: 0 }
  };

  const itemVariants = {
    hidden: { x: -20, opacity: 0 },
    visible: { x: 0, opacity: 1 }
  };

  return (
    <motion.aside
      initial={isMobile ? "visible" : "hidden"}
      animate="visible"
      exit="exit"
      variants={sidebarVariants}
      className={`${isMobile ? 'w-full h-full border-none' : 'w-80 border-r hidden md:flex'} relative overflow-hidden bg-black/95 backdrop-blur-2xl border-white/10 flex-col text-white shadow-2xl z-50`}
    >
      {/* Animated Background Elements */}
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-blue-900/20 to-transparent pointer-events-none" />
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-full h-64 bg-gradient-to-t from-purple-900/20 to-transparent pointer-events-none" />

      <div className="p-6 pb-2 relative z-10">
        <div className="flex items-center justify-between gap-2 mb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", delay: 0.2 }}
            className="flex items-center gap-3"
          >
            <div className="relative group">
              <div className="absolute inset-0 bg-blue-500 blur-md opacity-50 group-hover:opacity-100 transition-opacity duration-500 rounded-xl" />
              <div className="relative w-11 h-11 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-inner border border-white/10">
                <Package className="text-white w-6 h-6 drop-shadow-md" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight leading-non">AKR<span className="text-blue-500">Hunger</span></h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-blue-200/60 font-bold ml-0.5">Delivery</p>
            </div>
          </motion.div>
          {!isMobile && <NotificationBell />}
        </div>

        <div className="px-2 mb-2 flex items-center gap-2">
          <div className="h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent flex-1" />
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Main Menu</p>
          <div className="h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent flex-1" />
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-2 overflow-y-auto custom-scrollbar relative z-10 pb-4">
        {menuItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (pathname.startsWith(href) && href !== '/delivery');
          return (
            <motion.div key={href} variants={itemVariants} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link href={href} onClick={onClose}>
                <div
                  className={`relative group flex items-center justify-between w-full h-12 px-4 rounded-xl transition-all duration-300 overflow-hidden ${isActive
                    ? 'bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 text-white shadow-lg shadow-blue-900/20'
                    : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/5'
                    }`}
                >
                  {/* Active Indicator Line */}
                  {isActive && (
                    <motion.div
                      layoutId="activeIndicator"
                      className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 to-purple-500"
                    />
                  )}

                  <div className="flex items-center gap-3 relative z-10">
                    <Icon className={`w-5 h-5 transition-colors duration-300 ${isActive ? 'text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]' : 'group-hover:text-gray-200'}`} />
                    <span className={`text-sm font-medium tracking-wide ${isActive ? 'text-white font-semibold' : ''}`}>{label}</span>
                  </div>

                  {/* Hover Chevron */}
                  <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform duration-300 ${isActive ? 'opacity-100 translate-x-0 text-blue-400' : 'opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'}`} />

                  {/* Active Background Glow */}
                  {isActive && <div className="absolute inset-0 bg-blue-500/10 blur-xl" />}
                </div>
              </Link>
            </motion.div>
          )
        })}
      </nav>

      {/* User Profile Section */}
      <div className="p-4 relative z-10 mt-auto">
        <div className="p-4 rounded-2xl bg-gradient-to-b from-gray-900 to-black border border-gray-800/50 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          {user && (
            <div className="flex items-center gap-3 mb-4 relative z-10">
              <div className="w-10 h-10 rounded-full p-[2px] bg-gradient-to-br from-blue-500 to-purple-500 shadow-lg">
                <div className="w-full h-full rounded-full bg-black flex items-center justify-center overflow-hidden">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-white tracking-wider">{user.email?.charAt(0).toUpperCase()}</span>
                  )}
                </div>
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-white truncate group-hover:text-blue-200 transition-colors">My Profile</p>
                <p className="text-[10px] text-gray-500 truncate font-mono">{user.email}</p>
              </div>
            </div>
          )}

          <Button
            variant="outline"
            className="w-full justify-center gap-2 bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/40 transition-all font-medium h-10 rounded-lg relative z-10 group-hover:shadow-[0_0_15px_rgba(239,68,68,0.2)]"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </motion.aside>
  );
}
