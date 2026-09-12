'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon, Flame, Sparkles, Laptop, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export const THEMES = [
  {
    id: 'light',
    name: 'Light Mode',
    shortName: 'Light',
    icon: Sun,
    description: 'Clean, crisp & bright aesthetic',
    previewBg: 'bg-white text-zinc-900 border-zinc-200',
    accentColor: 'bg-orange-500',
  },
  {
    id: 'dark',
    name: 'Dark Mode',
    shortName: 'Dark',
    icon: Moon,
    description: 'Deep AMOLED black & sleek contrast',
    previewBg: 'bg-zinc-950 text-white border-zinc-800',
    accentColor: 'bg-orange-500',
  },
  {
    id: 'sunset',
    name: 'Sunset Warmth',
    shortName: 'Sunset',
    icon: Flame,
    description: 'Cozy foodie amber & rich espresso',
    previewBg: 'bg-[#221612] text-amber-100 border-[#3d251d]',
    accentColor: 'bg-amber-500',
  },
  {
    id: 'midnight',
    name: 'Midnight Blue',
    shortName: 'Midnight',
    icon: Sparkles,
    description: 'Nocturnal deep navy & indigo glow',
    previewBg: 'bg-[#0b0f19] text-blue-100 border-[#1a233d]',
    accentColor: 'bg-blue-500',
  },
  {
    id: 'system',
    name: 'System Default',
    shortName: 'System',
    icon: Laptop,
    description: 'Auto-syncs with your device theme',
    previewBg: 'bg-gradient-to-r from-zinc-200 to-zinc-900 text-foreground border-zinc-400',
    accentColor: 'bg-zinc-500',
  },
];

interface ThemeToggleProps {
  className?: string;
  variant?: 'button' | 'tiles' | 'compact';
}

export default function ThemeToggle({ className = '', variant = 'button' }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={`w-9 h-9 rounded-full bg-muted/50 animate-pulse ${className}`} />
    );
  }

  const currentThemeObj = THEMES.find((t) => t.id === theme) || THEMES[0];
  const CurrentIcon = currentThemeObj.icon;

  // Variant: Interactive Tiles (Used in Profile page)
  if (variant === 'tiles') {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {THEMES.map((t) => {
          const Icon = t.icon;
          const isSelected = theme === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
              className={`group relative flex flex-col items-start p-3.5 rounded-2xl border transition-all duration-300 text-left ${
                isSelected
                  ? 'border-primary ring-2 ring-primary/30 shadow-lg shadow-primary/10 scale-[1.02]'
                  : 'border-border/60 hover:border-border hover:bg-muted/40'
              } ${t.previewBg}`}
            >
              <div className="flex items-center justify-between w-full mb-3">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${
                    isSelected ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted/30'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                {isSelected && (
                  <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                )}
              </div>
              <span className="font-bold text-sm tracking-tight">{t.name}</span>
              <span className="text-[11px] opacity-70 line-clamp-2 mt-1 leading-snug">
                {t.description}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  // Variant: Compact pill (e.g., inside mobile drawer or quick bar)
  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-1.5 p-1 bg-muted/60 backdrop-blur-md rounded-2xl border border-border/50 ${className}`}>
        {THEMES.map((t) => {
          const Icon = t.icon;
          const isSelected = theme === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
              title={t.name}
              className={`relative flex items-center justify-center w-8 h-8 rounded-xl transition-all ${
                isSelected
                  ? 'bg-card text-foreground shadow-sm scale-105 font-bold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-card/40'
              }`}
            >
              <Icon className="w-4 h-4" />
            </button>
          );
        })}
      </div>
    );
  }

  // Default: Dropdown Button for Navbar / Header
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`relative rounded-full text-foreground/80 hover:text-foreground hover:bg-muted/60 transition-all border border-border/40 ${className}`}
          title={`Current Theme: ${currentThemeObj.name}`}
          aria-label="Toggle theme"
        >
          <CurrentIcon className="w-4 h-4 transition-transform hover:rotate-12" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 p-1.5 rounded-2xl border-border bg-card/95 backdrop-blur-xl shadow-2xl text-card-foreground animate-in fade-in-50 zoom-in-95"
      >
        <DropdownMenuLabel className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-2 py-1.5">
          Theme & Display
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border/60 my-1" />
        {THEMES.map((t) => {
          const Icon = t.icon;
          const isSelected = theme === t.id;
          return (
            <DropdownMenuItem
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`flex items-center justify-between px-2.5 py-2 rounded-xl cursor-pointer transition-colors ${
                isSelected
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'hover:bg-muted/60 text-card-foreground'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    isSelected ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <div className="flex flex-col">
                  <span className="text-sm leading-tight">{t.name}</span>
                  <span className="text-[10px] text-muted-foreground line-clamp-1">{t.shortName}</span>
                </div>
              </div>
              {isSelected && <Check className="w-4 h-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
