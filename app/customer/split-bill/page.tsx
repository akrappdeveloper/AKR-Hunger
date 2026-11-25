'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Users, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SplitBillCalculator from '@/components/customer/SplitBillCalculator';
import FullscreenToggle from '@/components/customer/FullscreenToggle';

export default function SplitBillPage() {
  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* Full-width Sticky Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/70 px-4 sm:px-6 lg:px-8 py-3.5 shadow-xs">
        <div className="w-full max-w-[1700px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/customer">
              <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-black flex items-center gap-2 tracking-tight">
                <Users className="w-6 h-6 text-primary" />
                Party &amp; Hostel Bill Splitter
              </h1>
              <p className="text-xs text-muted-foreground">
                Divide group orders, compute delivery tips &amp; share UPI payment links
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <FullscreenToggle className="border border-border/80 rounded-xl" showText={false} />
          </div>
        </div>
      </div>

      {/* Main Full-Width Responsive Container */}
      <div className="w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6">
        <SplitBillCalculator />
      </div>
    </div>
  );
}
