'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Dices, Sparkles, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import HungerRoulette from '@/components/customer/HungerRoulette';
import FullscreenToggle from '@/components/customer/FullscreenToggle';

export default function RoulettePage() {
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
                <Dices className="w-6 h-6 text-primary" />
                Hunger Food Roulette
              </h1>
              <p className="text-xs text-muted-foreground">
                Spin for mystery deals, real cashback &amp; food choices
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
        <HungerRoulette />
      </div>
    </div>
  );
}
