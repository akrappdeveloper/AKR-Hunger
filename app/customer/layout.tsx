import React from "react"
import CustomerNavbar from '@/components/customer/CustomerNavbar';
import CustomerMobileNav from '@/components/customer/MobileNav';

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-blue-500/30">
      <CustomerNavbar />
      <main className="pt-0 mb-16 md:mb-0">{children}</main>
      <CustomerMobileNav />
    </div>
  );
}
