'use client';

import * as React from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface FullscreenToggleProps {
  className?: string;
  showText?: boolean;
}

export default function FullscreenToggle({ className = '', showText = false }: FullscreenToggleProps) {
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [isSupported, setIsSupported] = React.useState(true);

  React.useEffect(() => {
    if (typeof document === 'undefined') return;

    const checkSupport = Boolean(
      document.fullscreenEnabled ||
      (document as any).webkitFullscreenEnabled ||
      (document as any).mozFullScreenEnabled ||
      (document as any).msFullscreenEnabled
    );
    setIsSupported(checkSupport);

    const updateState = () => {
      const active = Boolean(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(active);
    };

    updateState();

    document.addEventListener('fullscreenchange', updateState);
    document.addEventListener('webkitfullscreenchange', updateState);
    document.addEventListener('mozfullscreenchange', updateState);
    document.addEventListener('MSFullscreenChange', updateState);

    return () => {
      document.removeEventListener('fullscreenchange', updateState);
      document.removeEventListener('webkitfullscreenchange', updateState);
      document.removeEventListener('mozfullscreenchange', updateState);
      document.removeEventListener('MSFullscreenChange', updateState);
    };
  }, []);

  const toggleFullscreen = async () => {
    if (typeof document === 'undefined') return;

    try {
      const isAlreadyFs = Boolean(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );

      if (!isAlreadyFs) {
        const elem: any = document.documentElement;
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) {
          await elem.webkitRequestFullscreen();
        } else if (elem.mozRequestFullScreen) {
          await elem.mozRequestFullScreen();
        } else if (elem.msRequestFullscreen) {
          await elem.msRequestFullscreen();
        }
        setIsFullscreen(true);
        toast.success('Fullscreen mode enabled', {
          description: 'Press Esc or click again to exit fullscreen',
        });
      } else {
        const doc: any = document;
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        }
        setIsFullscreen(false);
        toast.info('Fullscreen mode exited');
      }
    } catch (err: any) {
      console.warn('Fullscreen toggle failed or was blocked by browser:', err);
      toast.info('Fullscreen shortcut: Press F11 on your keyboard');
    }
  };

  if (!isSupported) return null;

  return (
    <Button
      variant="ghost"
      size={showText ? 'sm' : 'icon'}
      onClick={toggleFullscreen}
      className={`relative text-foreground/80 hover:text-foreground hover:bg-muted/60 transition-all rounded-full border border-border/40 hover:scale-105 ${className}`}
      title={isFullscreen ? 'Exit Full Screen (Esc)' : 'Enter Full Screen (F11)'}
      aria-label="Toggle Fullscreen"
    >
      {isFullscreen ? (
        <Minimize2 className="w-4 h-4 text-primary animate-in zoom-in-75" />
      ) : (
        <Maximize2 className="w-4 h-4 transition-transform hover:scale-110" />
      )}
      {showText && (
        <span className="ml-1.5 text-xs font-semibold hidden sm:inline">
          {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        </span>
      )}
    </Button>
  );
}
