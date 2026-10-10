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
  CreditCard,
  TrendingUp,
  Megaphone,
  Shield,
  MapPin,
  Navigation,
  Award,
  Star,
  FileText,
  ChevronDown,
  ChevronRight,
  Tag,
  Activity,
  Map,
  IdCard,
  BookOpen,
  Image as ImageIcon,
  RotateCcw,
  Gift,
  Percent,
  ShieldCheck,
  Headset,
  MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import NotificationBell from '@/components/notifications/NotificationBell';

interface AdminSidebarProps {
  isMobile?: boolean;
  onClose?: () => void;
}

interface SidebarSection {
  title: string;
  items: {
    href: string;
    label: string;
    icon: any;
    allowedRoles?: string[];
  }[];
}

const AdminSidebar = ({ isMobile = false, onClose }: AdminSidebarProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const { admin, logout } = useAdminAuth();
  const [collapsedSections, setCollapsedSections] = useState<string[]>([]);

  const handleLogout = async () => {
    await logout();
    router.push('/admin/login');
    if (onClose) onClose();
  };

  const toggleSection = (title: string) => {
    setCollapsedSections(prev =>
      prev.includes(title) ? prev.filter(s => s !== title) : [...prev, title]
    );
  };

  const sections: SidebarSection[] = [
    {
      title: 'Main',
      items: [
        { href: '/admin', label: 'Dashboard', icon: BarChart3 },
      ],
    },
    {
      title: 'Management',
      items: [
        { href: '/admin/customers', label: 'Customers', icon: Users, allowedRoles: ['super_admin', 'operations_admin', 'support_admin'] },
        { href: '/admin/restaurants', label: 'Restaurants', icon: Store, allowedRoles: ['super_admin', 'operations_admin'] },
        { href: '/admin/delivery', label: 'Delivery Partners', icon: Truck, allowedRoles: ['super_admin', 'operations_admin'] },
        { href: '/admin/drivers', label: 'Driver Fleet', icon: Activity, allowedRoles: ['super_admin', 'operations_admin'] },
        { href: '/admin/kyc', label: 'KYC Verification', icon: ShieldCheck, allowedRoles: ['super_admin', 'operations_admin'] },
        { href: '/admin/orders', label: 'Orders', icon: ShoppingBag, allowedRoles: ['super_admin', 'operations_admin', 'support_admin'] },
      ],
    },
    {
      title: 'Financial',
      items: [
        { href: '/admin/payments', label: 'Restaurant Payments', icon: Wallet, allowedRoles: ['super_admin', 'finance_admin'] },
        { href: '/admin/delivery-payments', label: 'Delivery Payments', icon: DollarSign, allowedRoles: ['super_admin', 'finance_admin'] },
        { href: '/admin/customer-wallet', label: 'Customer Wallet', icon: Wallet, allowedRoles: ['super_admin', 'finance_admin', 'support_admin'] },
        { href: '/admin/refunds', label: 'Refund Dashboard', icon: RotateCcw, allowedRoles: ['super_admin', 'finance_admin'] },
        { href: '/admin/points', label: 'Points / Wallet', icon: Wallet, allowedRoles: ['super_admin', 'finance_admin', 'operations_admin'] },
      ],
    },
    {
      title: 'Content',
      items: [
        { href: '/admin/banners', label: 'Banners & Carousels', icon: ImageIcon, allowedRoles: ['super_admin', 'content_manager'] },
        { href: '/admin/menus', label: 'Menu Management', icon: BookOpen, allowedRoles: ['super_admin', 'content_manager', 'operations_admin'] },
        { href: '/admin/menu-approvals', label: 'Menu Approvals', icon: UtensilsCrossed, allowedRoles: ['super_admin', 'content_manager', 'operations_admin'] },
        { href: '/admin/campaigns', label: 'Campaigns', icon: Megaphone, allowedRoles: ['super_admin', 'content_manager'] },
        { href: '/admin/deals', label: 'Deals & Offers', icon: Tag, allowedRoles: ['super_admin', 'content_manager'] },
        { href: '/admin/redeem-codes', label: 'Redeem Codes', icon: Gift, allowedRoles: ['super_admin', 'content_manager', 'finance_admin'] },
        { href: '/admin/promotions', label: 'Promotions', icon: Percent, allowedRoles: ['super_admin', 'content_manager'] },
      ],
    },
    {
      title: 'Monitoring',
      items: [
        { href: '/admin/analytics', label: 'Analytics', icon: TrendingUp, allowedRoles: ['super_admin', 'operations_admin', 'finance_admin'] },
        { href: '/admin/quality', label: 'Quality Control', icon: Shield, allowedRoles: ['super_admin', 'operations_admin'] },
        { href: '/admin/tracking', label: 'Live Tracking', icon: Navigation, allowedRoles: ['super_admin', 'operations_admin', 'support_admin'] },
        { href: '/admin/zones', label: 'Delivery Zones', icon: Map, allowedRoles: ['super_admin', 'operations_admin'] },
      ],
    },
    {
      title: 'Members',
      items: [
        { href: '/admin/memberships', label: 'Memberships', icon: IdCard, allowedRoles: ['super_admin', 'operations_admin'] },
        { href: '/admin/card-requests', label: 'Card Requests', icon: CreditCard, allowedRoles: ['super_admin', 'operations_admin', 'finance_admin'] },
      ],
    },
    {
      title: 'System',
      items: [
        { href: '/admin/messages', label: 'Admin Messaging Center', icon: MessageSquare, allowedRoles: ['super_admin', 'support_admin'] },
        { href: '/admin/reviews', label: 'Reviews', icon: Star, allowedRoles: ['super_admin', 'support_admin', 'operations_admin'] },
        { href: '/admin/notifications', label: 'Notifications', icon: Bell, allowedRoles: ['super_admin', 'operations_admin'] },
        { href: '/admin/reports', label: 'Reports', icon: FileText, allowedRoles: ['super_admin', 'finance_admin', 'operations_admin'] },
        { href: '/admin/support', label: 'Support Desk', icon: LifeBuoy, allowedRoles: ['super_admin', 'support_admin'] },
        { href: '/admin/support/delivery', label: 'Delivery Support', icon: Headset, allowedRoles: ['super_admin', 'support_admin', 'operations_admin'] },
        { href: '/admin/settings', label: 'Settings', icon: Settings, allowedRoles: ['super_admin'] },
      ],
    },
  ];

  return (
    <aside className={`${isMobile ? 'w-full h-full border-none bg-transparent' : 'hidden lg:flex w-72 border-r fixed inset-y-0 z-50'} flex-col bg-card/90 backdrop-blur-xl border-border/50 text-foreground transition-all duration-300 shadow-2xl`}>
      <div className="p-6 border-b border-border/50 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <span className="font-bold text-lg text-foreground">H</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight leading-none">Hunger</h1>
            <p className="text-[10px] text-blue-500 font-bold uppercase tracking-widest mt-1">Admin Portal</p>
          </div>
        </div>
        {!isMobile && <NotificationBell />}
      </div>

      <div className="flex-1 px-3 py-4 overflow-y-auto custom-scrollbar">
        {sections.map((section) => {
          const isCollapsed = collapsedSections.includes(section.title);
          
          const filteredItems = section.items.filter((item) => {
            if (!item.allowedRoles) return true;
            if (admin?.role === 'super_admin') return true;
            return item.allowedRoles.includes(admin?.role || '');
          });

          if (filteredItems.length === 0) return null;

          const hasActiveItem = filteredItems.some(item =>
            item.href === '/admin' ? pathname === item.href : pathname.startsWith(item.href)
          );

          return (
            <div key={section.title} className="mb-1">
              {section.title !== 'Main' && (
                <button
                  onClick={() => toggleSection(section.title)}
                  className="w-full flex items-center justify-between px-4 py-2 mt-2 mb-0.5 group"
                >
                  <span className={`text-[10px] font-bold uppercase tracking-[0.15em] transition-colors ${hasActiveItem ? 'text-blue-500' : 'text-muted-foreground group-hover:text-foreground'}`}>
                    {section.title}
                  </span>
                  <ChevronDown
                    size={12}
                    className={`text-muted-foreground transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
                  />
                </button>
              )}

              {!isCollapsed && (
                <div className="space-y-0.5">
                  {filteredItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.href === '/admin'
                      ? pathname === item.href
                      : pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => {
                          if (isMobile && onClose) onClose();
                        }}
                        className={`group flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border border-transparent ${isActive
                          ? 'bg-blue-600/10 text-blue-600 dark:text-blue-400 border-blue-500/20 shadow-[0_0_20px_rgba(37,99,235,0.1)]'
                          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                          }`}
                      >
                        <Icon size={18} className={`transition-colors duration-200 ${isActive ? 'text-blue-500 dark:text-blue-400' : 'text-muted-foreground group-hover:text-foreground'}`} />
                        <span className="truncate">{item.label}</span>
                        {isActive && (
                          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.8)]" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-4 border-t border-border/50 space-y-4 bg-secondary/20">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/40 border border-border/50">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-gray-300 to-gray-200 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center border border-border/50">
            <span className="text-sm font-bold text-foreground">{admin?.name?.charAt(0) || 'A'}</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium text-foreground truncate">{admin?.name || 'Admin User'}</p>
            <p className="text-xs text-muted-foreground truncate">{admin?.email}</p>
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
