'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useNotifications } from '@/context/NotificationContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search, Bell, ShoppingCart, User, Menu, X, LogOut,
  Heart, Package, MapPin, LifeBuoy, Settings, ChevronDown, ChevronRight, Home, Briefcase, Wallet
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Address } from '@/lib/types';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import ThemeToggle from '@/components/customer/ThemeToggle';
import DeliveryLocationDialog from './DeliveryLocationDialog';

export default function CustomerNavbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, customer, logout } = useAuth();
  const { items, deliveryAddress, setDeliveryAddress } = useCart();
  const { unreadCount } = useNotifications();
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const [isScrolled, setIsScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddressDialogOpen, setIsAddressDialogOpen] = useState(false);

  // Auto-select default address
  useEffect(() => {
    if (!deliveryAddress && customer?.addresses && customer.addresses.length > 0) {
      const defaultAddr = customer.addresses.find(a => a.isDefault) || customer.addresses[0];
      setDeliveryAddress(defaultAddr);
    }
  }, [customer, deliveryAddress, setDeliveryAddress]);

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/customer/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/customer/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleSelectAddress = async (address: Address) => {
    setDeliveryAddress(address);
    setIsAddressDialogOpen(false);
    toast.success(`Location set to ${address.type}`);
  };

  // Don't show on auth pages
  if (pathname.includes('/login') || pathname.includes('/signup')) return null;

  // Render Premium Header
  return (
    <>
      <header
        className={`sticky top-0 z-50 w-full transition-all duration-300 border-b border-border/60 ${isScrolled
          ? 'bg-background/85 backdrop-blur-xl shadow-md shadow-black/5'
          : 'bg-background/95 backdrop-blur-md'
          }`}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 h-16 md:h-20 flex items-center justify-between gap-2 sm:gap-4">

          {/* Logo & Location */}
          <div className="flex items-center gap-3 sm:gap-6 flex-shrink-0">
            <Link href="/customer" className="flex items-center gap-2 flex-shrink-0">
              <img src="/hunger.png" alt="Hunger" className="w-9 h-9 sm:w-10 sm:h-10 object-contain rounded-xl shadow-sm" />
              <span className="text-lg sm:text-xl font-black text-primary hidden sm:block tracking-tight">
                Hunger
              </span>
            </Link>

            {/* Location Selector Trigger */}
            <button
              onClick={() => setIsAddressDialogOpen(true)}
              className="flex flex-col items-start text-left cursor-pointer hover:bg-muted/60 p-1 sm:p-2 rounded-xl transition-colors group max-w-[120px] sm:max-w-[170px] md:max-w-[220px]"
            >
              <span className="hidden md:flex text-[10px] text-primary font-bold uppercase tracking-wider items-center gap-1 group-hover:opacity-80">
                <MapPin className="w-3 h-3" /> Delivery Location
              </span>
              <span className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1 group-hover:text-primary transition-colors truncate w-full">
                <MapPin className="w-3 h-3 md:hidden text-primary flex-shrink-0" />
                <span className="truncate">{deliveryAddress ? `${deliveryAddress.street}, ${deliveryAddress.city}` : 'Select Location'}</span>
                <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              </span>
            </button>

            {/* Reusable Luxury Delivery Location Dialog */}
            <DeliveryLocationDialog
              open={isAddressDialogOpen}
              onOpenChange={setIsAddressDialogOpen}
            />
          </div>

          {/* Search Bar - Desktop & Tablet */}
          <div className="hidden md:flex flex-1 max-w-md lg:max-w-xl mx-2 lg:mx-8">
            <form onSubmit={handleSearch} className="relative w-full group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 group-focus-within:text-primary transition-colors" />
              <Input
                placeholder="Search for 'Biryani', 'Pizza', 'Burger'..."
                className="pl-11 h-11 md:h-12 rounded-2xl bg-muted/50 border-border/80 text-foreground placeholder:text-muted-foreground focus:bg-background focus:border-primary/40 focus:ring-2 focus:ring-primary/20 transition-all font-medium text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </form>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* Search - Mobile Button */}
            <Button variant="ghost" size="icon" className="md:hidden text-foreground/80 hover:text-foreground hover:bg-muted/60 rounded-full" onClick={() => router.push('/customer/search')}>
              <Search className="w-5 h-5" />
            </Button>

            {/* Theme Toggle Button */}
            <ThemeToggle />

            {/* Notification Bell - Logged in customer */}
            {user && (
              <Link href="/customer/notifications">
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative text-foreground/80 hover:text-foreground hover:bg-muted/60 rounded-full w-10 h-10 border border-border/40"
                  aria-label="Notifications"
                >
                  <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                  {unreadCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 flex items-center justify-center p-0 bg-red-500 text-white text-[10px] font-black border-2 border-background rounded-full shadow-md animate-bounce-subtle">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Badge>
                  )}
                </Button>
              </Link>
            )}

            {/* Cart - Only visible when user is logged in */}
            {user && (
              <Link href="/customer/cart">
                <Button variant="ghost" size="icon" className="relative text-foreground/80 hover:text-foreground hover:bg-muted/60 rounded-full w-10 h-10 border border-border/40">
                  <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
                  {itemCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 flex items-center justify-center p-0 bg-primary text-primary-foreground text-[10px] font-black border-2 border-background rounded-full shadow-md animate-bounce-subtle">
                      {itemCount}
                    </Badge>
                  )}
                </Button>
              </Link>
            )}

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2 pl-1.5 pr-3 rounded-full border border-border/60 hidden md:flex hover:bg-muted/60 text-foreground">
                    <div className="w-8 h-8 bg-gradient-to-tr from-primary/80 to-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-xs ring-2 ring-background">
                      {user.email?.[0].toUpperCase()}
                    </div>
                    <div className="text-left hidden lg:block">
                      <p className="text-xs font-bold text-foreground leading-none">{user.displayName || 'My Account'}</p>
                    </div>
                    <ChevronDown className="w-3 h-3 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-card border-border text-card-foreground p-1.5 shadow-2xl rounded-2xl">
                  <DropdownMenuLabel className="font-normal border-b border-border/60 pb-2 mb-1">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-bold leading-none text-foreground">{user.displayName || 'User'}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => router.push('/customer/profile')} className="cursor-pointer rounded-xl my-0.5">
                    <User className="w-4 h-4 mr-2 text-muted-foreground" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/customer/wallet')} className="cursor-pointer rounded-xl my-0.5">
                    <Wallet className="w-4 h-4 mr-2 text-muted-foreground" />
                    Wallet
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/customer/notifications')} className="cursor-pointer rounded-xl my-0.5 justify-between">
                    <div className="flex items-center">
                      <Bell className="w-4 h-4 mr-2 text-muted-foreground" />
                      Notifications
                    </div>
                    {unreadCount > 0 && (
                      <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </Badge>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/customer/favorites')} className="cursor-pointer rounded-xl my-0.5">
                    <Heart className="w-4 h-4 mr-2 text-muted-foreground" />
                    Favorites
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/customer/orders')} className="cursor-pointer rounded-xl my-0.5">
                    <Package className="w-4 h-4 mr-2 text-muted-foreground" />
                    Orders
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-border/60" />
                  <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer rounded-xl my-0.5" onClick={handleLogout}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/customer/login" className="hidden md:block">
                  <Button variant="ghost" className="text-foreground/80 hover:text-foreground hover:bg-muted/60 rounded-full">Login</Button>
                </Link>
                <Link href="/customer/login">
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full font-bold px-4 sm:px-6 shadow-md shadow-primary/20">
                    Sign Up
                  </Button>
                </Link>
              </div>
            )}

            {/* Mobile Menu */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden text-foreground hover:bg-muted/60 rounded-full">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] border-l border-border bg-card text-card-foreground p-0 shadow-2xl">
                <div className="flex flex-col h-full bg-card">
                  <div className="sr-only">
                    <SheetTitle>Mobile Menu</SheetTitle>
                  </div>

                  <div className="p-6 border-b border-border bg-muted/30">
                    {user ? (
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center text-primary-foreground text-lg font-bold shadow-md overflow-hidden bg-primary border-2 border-background">
                          {customer?.avatar ? (
                            <img src={customer.avatar} alt="Profile" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-primary">
                              {user.displayName?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="overflow-hidden">
                          <h3 className="font-bold text-base text-foreground truncate">{customer?.name || user.displayName || 'User'}</h3>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        </div>
                      </div>
                    ) : (
                      <h2 className="text-lg font-bold text-foreground">Welcome to Hunger!</h2>
                    )}
                  </div>

                  {/* Theme Switcher in Mobile Sheet */}
                  <div className="p-4 border-b border-border">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Theme Mode</p>
                    <ThemeToggle variant="compact" className="w-full justify-around" />
                  </div>

                  <div className="flex-1 p-4 space-y-1">
                    <Link href="/customer" className="flex items-center gap-3 p-3 rounded-2xl hover:bg-muted/60 text-foreground transition-colors">
                      <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center"><Home className="w-4 h-4" /></div>
                      <span className="font-semibold text-sm">Home</span>
                    </Link>
                    <Link href="/customer/orders" className="flex items-center gap-3 p-3 rounded-2xl hover:bg-muted/60 text-foreground transition-colors">
                      <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center"><Package className="w-4 h-4" /></div>
                      <span className="font-semibold text-sm">My Orders</span>
                    </Link>
                    <Link href="/customer/wallet" className="flex items-center gap-3 p-3 rounded-2xl hover:bg-muted/60 text-foreground transition-colors">
                      <div className="w-8 h-8 rounded-xl bg-green-500/10 text-green-500 flex items-center justify-center"><Wallet className="w-4 h-4" /></div>
                      <span className="font-semibold text-sm">Wallet</span>
                    </Link>
                    <Link href="/customer/favorites" className="flex items-center gap-3 p-3 rounded-2xl hover:bg-muted/60 text-foreground transition-colors">
                      <div className="w-8 h-8 rounded-xl bg-pink-500/10 text-pink-500 flex items-center justify-center"><Heart className="w-4 h-4" /></div>
                      <span className="font-semibold text-sm">Favorites</span>
                    </Link>
                    <Link href="/customer/profile" className="flex items-center gap-3 p-3 rounded-2xl hover:bg-muted/60 text-foreground transition-colors">
                      <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center"><User className="w-4 h-4" /></div>
                      <span className="font-semibold text-sm">Profile</span>
                    </Link>
                    <Link href="/customer/notifications" className="flex items-center justify-between p-3 rounded-2xl hover:bg-muted/60 text-foreground transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center"><Bell className="w-4 h-4" /></div>
                        <span className="font-semibold text-sm">Notifications</span>
                      </div>
                      {unreadCount > 0 && (
                        <Badge className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                          {unreadCount} New
                        </Badge>
                      )}
                    </Link>
                  </div>

                  <div className="p-4 border-t border-border">
                    {user ? (
                      <Button onClick={handleLogout} variant="destructive" className="w-full rounded-xl gap-2 font-bold">
                        <LogOut className="w-4 h-4" /> Logout
                      </Button>
                    ) : (
                      <Link href="/customer/login">
                        <Button className="w-full rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90">Login / Signup</Button>
                      </Link>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
    </>
  );
}
