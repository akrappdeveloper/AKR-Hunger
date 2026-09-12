'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bot,
    Send,
    User,
    Sparkles,
    RefreshCw,
    ExternalLink,
    ChevronRight,
    HelpCircle,
    ShoppingBag,
    Bike,
    Store,
    Layers,
    MessageSquare,
    Info,
    FileText,
    ArrowUpRight,
    CheckCircle2,
    Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import {
    queryChatbot,
    ChatResponse
} from '@/lib/ai-chatbot-engine';
import {
    PanelRole,
    ROLE_QUICK_PROMPTS,
    RoleQuickPrompt
} from '@/lib/ai-knowledge-base';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { toast } from 'sonner';

export interface AIChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    responseDetails?: ChatResponse;
}

interface AIChatbotProps {
    initialRole?: PanelRole;
    compact?: boolean;
    onOpenTicket?: () => void;
    className?: string;
}

export default function AIChatbot({
    initialRole = 'all',
    compact = false,
    onOpenTicket,
    className = '',
}: AIChatbotProps) {
    const pathname = usePathname();
    const router = useRouter();

    const [activeRole, setActiveRole] = useState<PanelRole>(initialRole);
    const [messages, setMessages] = useState<AIChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const scrollEndRef = useRef<HTMLDivElement>(null);

    // Ticket Modal State
    const [ticketModalOpen, setTicketModalOpen] = useState(false);
    const [ticketSubmitting, setTicketSubmitting] = useState(false);
    const [ticketSubject, setTicketSubject] = useState('');
    const [ticketCategory, setTicketCategory] = useState<string>('order');
    const [ticketDescription, setTicketDescription] = useState('');

    // Determine current effective panel role
    const getEffectiveRole = (): 'customer' | 'delivery' | 'restaurant' => {
        if (activeRole === 'customer') return 'customer';
        if (activeRole === 'delivery') return 'delivery';
        if (activeRole === 'restaurant') return 'restaurant';
        if (pathname?.includes('/delivery')) return 'delivery';
        if (pathname?.includes('/restaurant')) return 'restaurant';
        return 'customer';
    };
    const effectiveRole = getEffectiveRole();
    const supportPageUrl = `/${effectiveRole}/support`;

    // Initialize welcome message based on role
    useEffect(() => {
        const welcome = queryChatbot('hi', activeRole);
        setMessages([
            {
                id: 'welcome-msg',
                role: 'assistant',
                content: welcome.text,
                timestamp: new Date(),
                responseDetails: welcome,
            },
        ]);
    }, [activeRole]);

    // Auto scroll
    useEffect(() => {
        scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    const handleSend = (textToSend?: string) => {
        const query = (textToSend || inputValue).trim();
        if (!query) return;

        const userMsg: AIChatMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: query,
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMsg]);
        if (!textToSend) setInputValue('');
        setIsTyping(true);

        // Realistic typing simulation
        setTimeout(() => {
            const botReply = queryChatbot(query, activeRole);
            const botMsg: AIChatMessage = {
                id: `bot-${Date.now()}`,
                role: 'assistant',
                content: botReply.text,
                timestamp: new Date(),
                responseDetails: botReply,
            };
            setMessages((prev) => [...prev, botMsg]);
            setIsTyping(false);
        }, 600);
    };

    const handleClearChat = () => {
        const welcome = queryChatbot('hi', activeRole);
        setMessages([
            {
                id: `welcome-${Date.now()}`,
                role: 'assistant',
                content: welcome.text,
                timestamp: new Date(),
                responseDetails: welcome,
            },
        ]);
    };

    const handleRaiseTicketClick = () => {
        if (onOpenTicket) {
            onOpenTicket();
        } else {
            setTicketModalOpen(true);
        }
    };

    const handleSubmitTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!ticketSubject.trim() || !ticketDescription.trim()) {
            toast.error("Please fill in both subject and description.");
            return;
        }

        try {
            setTicketSubmitting(true);
            const currentUser = auth.currentUser;

            const roleLabel =
                effectiveRole === 'customer'
                    ? 'Customer'
                    : effectiveRole === 'delivery'
                    ? 'Delivery Partner'
                    : 'Restaurant Partner';

            const newTicketData = {
                userId: currentUser?.uid || 'guest-user',
                userType: effectiveRole,
                userName: currentUser?.displayName || currentUser?.email?.split('@')[0] || roleLabel,
                userEmail: currentUser?.email || `${effectiveRole}@akrhunger.com`,
                subject: ticketSubject.trim(),
                category: ticketCategory,
                priority: 'medium',
                description: ticketDescription.trim(),
                status: 'open',
                createdAt: new Date(),
                replies: []
            };

            await addDoc(collection(db, 'supportTickets'), newTicketData);

            toast.success("Support ticket created! Ticket saved in Firebase.");

            // Add confirmation message in chat
            const confirmMsg: AIChatMessage = {
                id: `ticket-confirm-${Date.now()}`,
                role: 'assistant',
                content: `✅ **Support Ticket Created Successfully!**\n\n- **Subject:** ${ticketSubject.trim()}\n- **Category:** ${ticketCategory}\n- **Panel:** ${roleLabel}\n- **Status:** open\n\nOur human support team will review your inquiry within 30 minutes. You can also view all your tickets on your [Support Page](${supportPageUrl}).`,
                timestamp: new Date(),
                responseDetails: {
                    id: Date.now().toString(),
                    text: '',
                    confidence: 1.0,
                    role: activeRole,
                    suggestedFollowUps: [],
                    actionLink: { label: `View on ${roleLabel} Support Page`, url: supportPageUrl }
                }
            };
            setMessages(prev => [...prev, confirmMsg]);

            setTicketSubject('');
            setTicketDescription('');
            setTicketModalOpen(false);
        } catch (error) {
            console.error("Error creating ticket:", error);
            toast.error("Failed to submit ticket. Please try again.");
        } finally {
            setTicketSubmitting(false);
        }
    };

    const activePrompts = ROLE_QUICK_PROMPTS.filter(
        (p) => activeRole === 'all' || p.role === activeRole || p.role === 'cross_panel'
    ).slice(0, 6);

    // Markdown & status badge formatter
    const formatMessageContent = (content: string) => {
        const lines = content.split('\n');

        return lines.map((line, idx) => {
            if (line.startsWith('```') || line.endsWith('```')) {
                return null;
            }

            if (line.startsWith('### ')) {
                return (
                    <h4 key={idx} className="font-bold text-sm sm:text-base mt-2 mb-1 text-primary">
                        {line.replace('### ', '')}
                    </h4>
                );
            }

            const isBullet = line.trim().startsWith('- ') || line.trim().startsWith('• ');
            const cleanLine = isBullet ? line.trim().substring(2) : line;

            const parts = cleanLine.split(/(\*\*.*?\*\*|`.*?`)/g);

            const renderedLine = parts.map((part, pIdx) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return (
                        <strong key={pIdx} className="font-semibold text-foreground">
                            {part.slice(2, -2)}
                        </strong>
                    );
                }
                if (part.startsWith('`') && part.endsWith('`')) {
                    const codeText = part.slice(1, -1);
                    const statusColors: Record<string, string> = {
                        pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
                        confirmed: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
                        preparing: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
                        ready: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
                        out_for_delivery: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
                        delivered: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
                        cancelled: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
                    };
                    const colorClass = statusColors[codeText] || 'bg-muted text-muted-foreground border-border';

                    return (
                        <span
                            key={pIdx}
                            className={`inline-block px-1.5 py-0.5 mx-0.5 rounded-md text-[11px] font-mono border ${colorClass}`}
                        >
                            {codeText}
                        </span>
                    );
                }
                return part;
            });

            if (isBullet) {
                return (
                    <div key={idx} className="flex items-start gap-2 my-1 text-xs sm:text-sm">
                        <span className="text-primary mt-1">•</span>
                        <span className="flex-1">{renderedLine}</span>
                    </div>
                );
            }

            if (!line.trim()) {
                return <div key={idx} className="h-1.5" />;
            }

            return (
                <p key={idx} className="text-xs sm:text-sm leading-relaxed my-1">
                    {renderedLine}
                </p>
            );
        });
    };

    return (
        <div
            className={`flex flex-col bg-card border border-border rounded-2xl shadow-xl overflow-hidden transition-all duration-300 ${
                compact ? 'h-[500px]' : 'h-[640px]'
            } ${className}`}
        >
            {/* Header */}
            <div className="p-3.5 sm:p-4 bg-muted/60 backdrop-blur-md border-b border-border flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2.5">
                    <div className="relative">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-orange-500 flex items-center justify-center text-primary-foreground shadow-md shadow-primary/25">
                            <Bot className="w-5 h-5" />
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-card rounded-full animate-pulse" />
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <h3 className="font-bold text-sm sm:text-base text-foreground">
                                AKR Support AI
                            </h3>
                            <Badge
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20"
                            >
                                Multi-Panel
                            </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-amber-500" />
                            Knows Customer, Delivery & Restaurant Details
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleClearChat}
                        title="Reset Conversation"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Role Filter Tabs */}
            <div className="px-3 py-2 bg-muted/30 border-b border-border flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
                <span className="text-[11px] font-semibold text-muted-foreground mr-1 shrink-0 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5" /> Scope:
                </span>
                <button
                    onClick={() => setActiveRole('all')}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 transition-all flex items-center gap-1 ${
                        activeRole === 'all'
                            ? 'bg-primary text-primary-foreground shadow-xs'
                            : 'bg-card text-muted-foreground hover:text-foreground border border-border/70'
                    }`}
                >
                    🌐 All Panels
                </button>
                <button
                    onClick={() => setActiveRole('customer')}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 transition-all flex items-center gap-1 ${
                        activeRole === 'customer'
                            ? 'bg-sky-600 text-white shadow-xs'
                            : 'bg-card text-muted-foreground hover:text-foreground border border-border/70'
                    }`}
                >
                    <ShoppingBag className="w-3 h-3" /> Customer
                </button>
                <button
                    onClick={() => setActiveRole('delivery')}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 transition-all flex items-center gap-1 ${
                        activeRole === 'delivery'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-card text-muted-foreground hover:text-foreground border border-border/70'
                    }`}
                >
                    <Bike className="w-3 h-3" /> Delivery Partner
                </button>
                <button
                    onClick={() => setActiveRole('restaurant')}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 transition-all flex items-center gap-1 ${
                        activeRole === 'restaurant'
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-card text-muted-foreground hover:text-foreground border border-border/70'
                    }`}
                >
                    <Store className="w-3 h-3" /> Restaurant
                </button>
            </div>

            {/* Quick Suggested Prompts Carousel */}
            <div className="px-3 py-1.5 bg-card/60 border-b border-border/60 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
                <span className="text-[10px] text-muted-foreground uppercase font-bold shrink-0">
                    Quick Ask:
                </span>
                {activePrompts.map((prompt, idx) => (
                    <button
                        key={idx}
                        onClick={() => handleSend(prompt.query)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-muted/60 hover:bg-primary/15 text-foreground hover:text-primary border border-border/80 shrink-0 transition-colors flex items-center gap-1.5"
                    >
                        {prompt.label}
                    </button>
                ))}
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
                <AnimatePresence initial={false}>
                    {messages.map((msg) => (
                        <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 8, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.2 }}
                            className={`flex gap-2.5 ${
                                msg.role === 'user' ? 'justify-end' : 'justify-start'
                            }`}
                        >
                            {msg.role === 'assistant' && (
                                <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center text-primary shrink-0 mt-0.5">
                                    <Bot className="w-4 h-4" />
                                </div>
                            )}

                            <div
                                className={`max-w-[85%] sm:max-w-[80%] rounded-2xl p-3 sm:p-4 shadow-xs ${
                                    msg.role === 'user'
                                        ? 'bg-primary text-primary-foreground rounded-tr-none'
                                        : 'bg-muted/80 text-foreground border border-border/80 rounded-tl-none'
                                }`}
                            >
                                <div className="space-y-1">
                                    {formatMessageContent(msg.content)}
                                </div>

                                {/* Direct Action Link if provided */}
                                {msg.responseDetails?.actionLink && (
                                    <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between">
                                        <Link
                                            href={msg.responseDetails.actionLink.url}
                                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors"
                                        >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                            {msg.responseDetails.actionLink.label}
                                        </Link>
                                    </div>
                                )}

                                {/* Suggested Follow-ups */}
                                {msg.responseDetails?.suggestedFollowUps &&
                                    msg.responseDetails.suggestedFollowUps.length > 0 && (
                                        <div className="mt-3 pt-2 border-t border-border/40 space-y-1.5">
                                            <p className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                                                <ChevronRight className="w-3 h-3 text-primary" /> Suggested
                                                Questions:
                                            </p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {msg.responseDetails.suggestedFollowUps.map((q, qIdx) => (
                                                    <button
                                                        key={qIdx}
                                                        onClick={() => handleSend(q)}
                                                        className="text-[11px] text-left px-2 py-1 rounded-md bg-card/80 hover:bg-card border border-border text-foreground hover:text-primary transition-all flex items-center gap-1"
                                                    >
                                                        <span>{q}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                <p className="text-[9px] opacity-60 mt-1.5 text-right">
                                    {msg.timestamp.toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                </p>
                            </div>

                            {msg.role === 'user' && (
                                <div className="w-7 h-7 rounded-lg bg-foreground/10 flex items-center justify-center text-foreground shrink-0 mt-0.5">
                                    <User className="w-4 h-4" />
                                </div>
                            )}
                        </motion.div>
                    ))}
                </AnimatePresence>

                {isTyping && (
                    <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2.5"
                    >
                        <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center text-primary shrink-0">
                            <Bot className="w-4 h-4" />
                        </div>
                        <div className="bg-muted px-3.5 py-2.5 rounded-2xl rounded-tl-none border border-border/80 flex items-center gap-1.5 shadow-xs">
                            <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce delay-0" />
                            <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce delay-150" />
                            <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce delay-300" />
                            <span className="text-xs text-muted-foreground ml-1.5 font-medium">
                                Consulting panel details...
                            </span>
                        </div>
                    </motion.div>
                )}

                <div ref={scrollEndRef} />
            </div>

            {/* Support Ticket Escalation Banner */}
            <div className="px-3 py-2 bg-muted/50 border-t border-border/70 flex items-center justify-between text-xs text-muted-foreground shrink-0 gap-2">
                <span className="flex items-center gap-1 truncate text-[11px]">
                    <Info className="w-3.5 h-3.5 text-primary shrink-0" /> Need human agent assistance?
                </span>
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={handleRaiseTicketClick}
                        className="text-[11px] text-primary font-bold hover:underline flex items-center gap-0.5 px-2 py-1 bg-primary/10 hover:bg-primary/20 rounded-md transition-colors"
                    >
                        Raise Ticket <ChevronRight className="w-3 h-3" />
                    </button>
                    <Link
                        href={supportPageUrl}
                        className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 px-2 py-1 rounded-md border border-border/80 hover:bg-card transition-colors"
                        title="Open full support page"
                    >
                        Support Page <ArrowUpRight className="w-3 h-3" />
                    </Link>
                </div>
            </div>

            {/* Input Form */}
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                }}
                className="p-3 bg-card border-t border-border flex items-center gap-2 shrink-0"
            >
                <Input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={
                        activeRole === 'customer'
                            ? 'Ask about order tracking, cancel, refund, wallet...'
                            : activeRole === 'delivery'
                            ? 'Ask about Marketplace orders, payouts, status flow...'
                            : activeRole === 'restaurant'
                            ? 'Ask about menu out-of-stock, quality score, ads...'
                            : 'Ask any question about Customer, Delivery, or Restaurant panels...'
                    }
                    className="flex-1 bg-muted/50 border-input text-foreground text-xs sm:text-sm placeholder:text-muted-foreground/70 h-10 sm:h-11 rounded-xl focus-visible:ring-primary"
                />
                <Button
                    type="submit"
                    disabled={!inputValue.trim() || isTyping}
                    className="h-10 sm:h-11 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-md transition-all shrink-0"
                >
                    <Send className="w-4 h-4" />
                </Button>
            </form>

            {/* Quick Raise Ticket Dialog */}
            <Dialog open={ticketModalOpen} onOpenChange={setTicketModalOpen}>
                <DialogContent className="max-w-md w-[92vw] bg-card border-border text-card-foreground p-5 rounded-2xl shadow-2xl">
                    <DialogHeader>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="p-2 rounded-xl bg-primary/10 text-primary">
                                <FileText className="w-5 h-5" />
                            </div>
                            <DialogTitle className="text-base sm:text-lg font-black text-foreground">
                                Raise a Support Ticket
                            </DialogTitle>
                        </div>
                        <DialogDescription className="text-xs text-muted-foreground">
                            This ticket will be saved directly to Firebase and answered by our team within 30 minutes.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmitTicket} className="space-y-3.5 mt-2">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-foreground">Category</label>
                            <select
                                value={ticketCategory}
                                onChange={(e) => setTicketCategory(e.target.value)}
                                className="w-full h-9 px-3 rounded-xl bg-muted/60 border border-input text-foreground text-xs focus:ring-primary focus:border-primary"
                            >
                                {effectiveRole === 'customer' && (
                                    <>
                                        <option value="order">Order Tracking & Delay</option>
                                        <option value="refund">Cancellation & Refund</option>
                                        <option value="payment">Payment / Wallet Issue</option>
                                        <option value="quality">Food Quality or Missing Items</option>
                                        <option value="other">General Inquiry</option>
                                    </>
                                )}
                                {effectiveRole === 'delivery' && (
                                    <>
                                        <option value="order">Marketplace / Order Acceptance</option>
                                        <option value="billing">Earnings & Monday Payouts</option>
                                        <option value="account">Vehicle RC & Documents</option>
                                        <option value="technical">App GPS / Tracking Glitch</option>
                                        <option value="other">General Support</option>
                                    </>
                                )}
                                {effectiveRole === 'restaurant' && (
                                    <>
                                        <option value="order">Live Orders & Kitchen Pipeline</option>
                                        <option value="menu">Menu & Out-of-Stock Items</option>
                                        <option value="billing">Wallet & Weekly Payouts</option>
                                        <option value="marketing">Ad Campaigns & Points</option>
                                        <option value="other">General Restaurant Support</option>
                                    </>
                                )}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-foreground">Subject</label>
                            <Input
                                value={ticketSubject}
                                onChange={(e) => setTicketSubject(e.target.value)}
                                placeholder="Brief summary of your issue..."
                                className="h-9 text-xs bg-muted/60"
                                required
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-foreground">Description</label>
                            <Textarea
                                value={ticketDescription}
                                onChange={(e) => setTicketDescription(e.target.value)}
                                placeholder="Provide order ID, amounts, or any other relevant details..."
                                rows={3}
                                className="text-xs bg-muted/60 resize-none"
                                required
                            />
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0 pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setTicketModalOpen(false)}
                                className="rounded-xl text-xs h-9"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={ticketSubmitting}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-xs h-9"
                            >
                                {ticketSubmitting ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving...
                                    </>
                                ) : (
                                    'Submit to Firebase'
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
