'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
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
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Address } from '@/lib/types';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';

export default function CustomerNavbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, customer, logout } = useAuth();
  const { items } = useCart();
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const [isScrolled, setIsScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddressDialogOpen, setIsAddressDialogOpen] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);

  // Set initial address from profile
  useEffect(() => {
    if (customer?.addresses && customer.addresses.length > 0) {
      // Try to find default or pick first
      const defaultAddr = customer.addresses.find(a => a.isDefault) || customer.addresses[0];
      setSelectedAddress(defaultAddr);
    }
  }, [customer]);

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
    setSelectedAddress(address);
    setIsAddressDialogOpen(false);
    // Optionally update backend if we want to persist "current session address" logic
    // For now, local state is fine for UI, but context might be better for Cart.
    toast.success(`Location set to ${address.type}`);
  };

  // Don't show on auth pages
  if (pathname.includes('/login') || pathname.includes('/signup')) return null;

  // Render Premium Header
  return (
    <>
      <header
        className={`sticky top-0 z-50 w-full transition-all duration-300 border-b border-gray-800 ${isScrolled
          ? 'bg-black/80 backdrop-blur-xl shadow-lg shadow-black/20'
          : 'bg-black'
          }`}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 md:h-20 flex items-center justify-between gap-4">

          {/* Logo & Location */}
          <div className="flex items-center gap-6">
            <Link href="/customer" className="flex items-center gap-2 flex-shrink-0">
              <img src="/akrhunger.png" alt="AKR Hunger" className="w-10 h-10 object-contain" />
              <span className="text-xl font-bold text-white hidden md:block tracking-tight">
                AKR<span className="text-orange-500">Hunger</span>
              </span>
            </Link>

            {/* Location Selector Dialog */}
            <Dialog open={isAddressDialogOpen} onOpenChange={setIsAddressDialogOpen}>
              <DialogTrigger asChild>
                <button className="hidden md:flex flex-col items-start text-left cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-colors group">
                  <span className="text-[10px] text-orange-500 font-bold uppercase tracking-wider flex items-center gap-1 group-hover:text-orange-400">
                    <MapPin className="w-3 h-3" /> Delivery Location
                  </span>
                  <span className="text-sm font-bold text-gray-200 flex items-center gap-1 group-hover:text-white truncate max-w-[200px]">
                    {selectedAddress ? `${selectedAddress.street}, ${selectedAddress.city}` : 'Select Location'} <ChevronDown className="w-3 h-3 text-gray-500" />
                  </span>
                </button>
              </DialogTrigger>
              <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Select Delivery Location</DialogTitle>
                  <DialogDescription className="text-gray-400">
                    Choose from your saved addresses or add a new one.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-4">
                  {customer?.addresses && customer.addresses.length > 0 ? (
                    customer.addresses.map((addr) => (
                      <div
                        key={addr.id}
                        onClick={() => handleSelectAddress(addr)}
                        className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center gap-3 ${selectedAddress?.id === addr.id ? 'bg-orange-900/20 border-orange-500/50' : 'bg-gray-800/50 border-gray-700 hover:bg-gray-800'}`}
                      >
                        <div className={`p-2 rounded-full ${addr.type === 'Home' ? 'bg-blue-500/20 text-blue-400' : addr.type === 'Work' ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-700 text-gray-400'}`}>
                          {addr.type === 'Home' && <Home className="w-4 h-4" />}
                          {addr.type === 'Work' && <Briefcase className="w-4 h-4" />}
                          {addr.type === 'Other' && <MapPin className="w-4 h-4" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm">{addr.type}</span>
                            {addr.isDefault && <span className="text-[10px] bg-green-900/30 text-green-400 px-1.5 rounded uppercase font-bold">Default</span>}
                          </div>
                          <p className="text-xs text-gray-400 line-clamp-1">{addr.street}, {addr.city}</p>
                        </div>
                        {selectedAddress?.id === addr.id && <div className="w-3 h-3 bg-orange-500 rounded-full" />}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-gray-500">
                      <p>No saved addresses found.</p>
                      <Button variant="link" onClick={() => router.push('/customer/profile')} className="text-orange-500">
                        Add New Address
                      </Button>
                    </div>
                  )}
                  <Button
                    className="w-full mt-2 bg-gray-800 hover:bg-gray-700 text-white border border-gray-700"
                    onClick={() => { setIsAddressDialogOpen(false); router.push('/customer/profile'); }}
                  >
                    Manage Addresses
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

          </div>

          {/* Search Bar - Desktop */}
          <div className="hidden lg:flex flex-1 max-w-xl mx-8">
            <form onSubmit={handleSearch} className="relative w-full group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4 group-focus-within:text-orange-500 transition-colors" />
              <Input
                placeholder="Search for 'Biryani', 'Pizza'..."
                className="pl-11 h-12 rounded-2xl bg-gray-900/50 border-gray-800 text-gray-200 placeholder:text-gray-600 focus:bg-gray-900 focus:border-orange-500/30 focus:ring-1 focus:ring-orange-500/30 transition-all font-medium"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </form>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            {/* Search - Mobile */}
            <Button variant="ghost" size="icon" className="md:hidden text-gray-400 hover:text-white" onClick={() => router.push('/customer/search')}>
              <Search className="w-5 h-5" />
            </Button>

            {/* Cart */}
            <Link href="/customer/cart">
              <Button variant="ghost" size="icon" className="relative text-gray-400 hover:text-white hover:bg-white/10 rounded-full w-10 h-10">
                <ShoppingCart className="w-5 h-5" />
                {itemCount > 0 && (
                  <Badge className="absolute top-0 right-0 h-5 w-5 flex items-center justify-center p-0 bg-blue-600 text-[10px] border-2 border-black rounded-full animate-bounce-subtle">
                    {itemCount}
                  </Badge>
                )}
              </Button>
            </Link>

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2 pl-2 pr-4 rounded-full border border-gray-800 hidden md:flex hover:bg-white/5 data-[state=open]:bg-white/10">
                    <div className="w-8 h-8 bg-gradient-to-tr from-gray-700 to-gray-800 rounded-full flex items-center justify-center text-white font-bold text-xs ring-2 ring-black">
                      {user.email?.[0].toUpperCase()}
                    </div>
                    <div className="text-left hidden lg:block">
                      <p className="text-xs font-bold text-white leading-none">{user.displayName || 'My Account'}</p>
                    </div>
                    <ChevronDown className="w-3 h-3 text-gray-500" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-gray-900 border-gray-800 text-white p-2 shadow-2xl shadow-black/50">
                  <DropdownMenuLabel className="font-normal border-b border-gray-800 pb-2 mb-1">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-bold leading-none text-white">{user.displayName || 'User'}</p>
                      <p className="text-xs leading-none text-gray-500">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => router.push('/customer/profile')} className="cursor-pointer focus:bg-white/10 focus:text-white rounded-lg my-0.5">
                    <User className="w-4 h-4 mr-2 text-gray-400" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/customer/wallet')} className="cursor-pointer focus:bg-white/10 focus:text-white rounded-lg my-0.5">
                    <Wallet className="w-4 h-4 mr-2 text-gray-400" />
                    Wallet
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/customer/notifications')} className="cursor-pointer focus:bg-white/10 focus:text-white rounded-lg my-0.5">
                    <Bell className="w-4 h-4 mr-2 text-gray-400" />
                    Notifications
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/customer/favorites')} className="cursor-pointer focus:bg-white/10 focus:text-white rounded-lg my-0.5">
                    <Heart className="w-4 h-4 mr-2 text-gray-400" />
                    Favorites
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/customer/orders')} className="cursor-pointer focus:bg-white/10 focus:text-white rounded-lg my-0.5">
                    <Package className="w-4 h-4 mr-2 text-gray-400" />
                    Orders
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-red-400 focus:text-red-300 focus:bg-red-500/10 cursor-pointer rounded-lg my-0.5 mt-2" onClick={handleLogout}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/customer/login" className="hidden md:block">
                  <Button variant="ghost" className="text-gray-300 hover:text-white hover:bg-white/10 rounded-full">Login</Button>
                </Link>
                <Link href="/customer/login">
                  <Button className="bg-white text-black hover:bg-gray-200 rounded-full font-bold px-6">
                    Sign Up
                  </Button>
                </Link>
              </div>
            )}

            {/* Mobile Menu */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden text-white">
                  <Menu className="w-6 h-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] border-l-gray-800 bg-black text-white p-0">
                {/* Checking Auth State in Sidebar */}
                <div className="flex flex-col h-full bg-black">
                  <div className="p-6 border-b border-gray-800 bg-gray-900/50">
                    {user ? (
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-lg shadow-blue-900/20">
                          {user.email?.[0].toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">{user.displayName || 'User'}</h3>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    ) : (
                      <h2 className="text-xl font-bold">Welcome Guest!</h2>
                    )}
                  </div>

                  <div className="flex-1 p-4 space-y-1">
                    <Link href="/customer" className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-gray-300 hover:text-white transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center"><Package className="w-4 h-4 text-orange-500" /></div>
                      <span className="font-medium">Home</span>
                    </Link>
                    <Link href="/customer/orders" className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-gray-300 hover:text-white transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center"><Package className="w-4 h-4 text-blue-500" /></div>
                      <span className="font-medium">My Orders</span>
                    </Link>
                    <Link href="/customer/profile" className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-gray-300 hover:text-white transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center"><User className="w-4 h-4 text-purple-500" /></div>
                      <span className="font-medium">Profile</span>
                    </Link>
                    <Link href="/customer/notifications" className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-gray-300 hover:text-white transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center"><Bell className="w-4 h-4 text-red-500" /></div>
                      <span className="font-medium">Notifications</span>
                    </Link>
                  </div>

                  <div className="p-6 border-t border-gray-800">
                    {user ? (
                      <Button onClick={handleLogout} variant="destructive" className="w-full rounded-xl gap-2 font-bold">
                        <LogOut className="w-4 h-4" /> Logout
                      </Button>
                    ) : (
                      <Link href="/customer/login">
                        <Button className="w-full rounded-xl font-bold bg-white text-black hover:bg-gray-200">Login / Signup</Button>
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
