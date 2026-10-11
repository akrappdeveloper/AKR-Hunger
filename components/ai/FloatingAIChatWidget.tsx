'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Bot, X, Sparkles } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import AIChatbot from './AIChatbot';
import { PanelRole } from '@/lib/ai-knowledge-base';
import { motion } from 'framer-motion';

interface FloatingAIChatWidgetProps {
    role?: PanelRole;
    buttonText?: string;
    positionClassName?: string;
    onOpenTicket?: () => void;
}

export default function FloatingAIChatWidget({
    role = 'all',
    buttonText = 'Ask AI',
    positionClassName = 'bottom-20 md:bottom-6 right-4 sm:right-6',
    onOpenTicket,
}: FloatingAIChatWidgetProps) {
    const [open, setOpen] = useState(false);
    const pathname = usePathname();

    // Do not show floating button if already on dedicated support pages or auth pages to prevent clutter
    if (pathname?.includes('/support') || pathname?.includes('/login') || pathname?.includes('/signup')) {
        return null;
    }

    return (
        <>
            {/* Floating Action Button */}
            <div className={`fixed ${positionClassName} z-40`}>
                <motion.button
                    whileHover={{ scale: 1.06 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => setOpen(true)}
                    className="relative flex items-center gap-2 bg-gradient-to-r from-primary to-orange-500 hover:from-primary/90 hover:to-orange-600 text-primary-foreground font-bold px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-full shadow-xl shadow-primary/30 border border-white/20 transition-all group"
                    aria-label="Open AI Assistant"
                >
                    <div className="relative">
                        <Bot className="w-5 h-5 text-white" />
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border border-primary animate-pulse" />
                    </div>
                    <span className="text-xs sm:text-sm tracking-wide hidden sm:inline">{buttonText}</span>
                    <Sparkles className="w-3.5 h-3.5 text-amber-200 group-hover:rotate-12 transition-transform hidden sm:inline" />
                </motion.button>
            </div>

            {/* Modal Dialog */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-2xl w-[95vw] p-0 border-0 bg-transparent shadow-none overflow-hidden rounded-2xl">
                    <DialogTitle className="sr-only">Hunger Platform AI Assistant</DialogTitle>
                    <DialogDescription className="sr-only">
                        Ask questions about Customer, Delivery, and Restaurant panel operations, policies, and workflows.
                    </DialogDescription>

                    <div className="relative">
                        <button
                            onClick={() => setOpen(false)}
                            className="absolute top-3 right-3 z-50 p-1.5 rounded-full bg-background/80 hover:bg-background text-foreground border border-border transition-colors shadow-sm"
                            aria-label="Close"
                        >
                            <X className="w-4 h-4" />
                        </button>
                        <AIChatbot
                            initialRole={role}
                            onOpenTicket={onOpenTicket ? () => {
                                setOpen(false);
                                onOpenTicket();
                            } : undefined}
                        />
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
