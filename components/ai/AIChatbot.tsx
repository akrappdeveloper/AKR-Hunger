'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bot,
    Send,
    User,
    Sparkles,
    RefreshCw,
    ExternalLink,
    ChevronRight,
    ShoppingBag,
    Bike,
    Store,
    Layers,
    MessageSquare,
    Info,
    FileText,
    ArrowUpRight,
    CheckCircle2,
    Loader2,
    ShieldAlert,
    Clock,
    MapPin,
    Phone,
    Utensils,
    Check,
    Package,
    Star,
    AlertCircle,
    ArrowRight,
    Search
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
    checkSecurityThreat,
    detectOrderTrackingIntent,
    detectFoodRecommendationIntent,
    detectTicketCreationIntent,
    ChatResponse
} from '@/lib/ai-chatbot-engine';
import {
    PanelRole,
    ROLE_QUICK_PROMPTS,
    RoleQuickPrompt
} from '@/lib/ai-knowledge-base';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { auth, db, realtimeDb } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import {
    collection,
    query,
    where,
    getDocs,
    limit,
    addDoc,
    serverTimestamp,
} from 'firebase/firestore';
import { ref as rtdbRef, set as rtdbSet } from 'firebase/database';
import { toast } from 'sonner';

export interface OrderTrackingInfo {
    id: string;
    orderNumber?: string;
    restaurantName: string;
    status: string;
    itemsSummary: string;
    itemsCount: number;
    total: number;
    createdAt?: any;
    deliveryAddress?: string;
    deliveryPersonName?: string;
    deliveryPersonPhone?: string;
    etaMinutes?: number;
}

export interface FoodRecommendationItem {
    id: string;
    name: string;
    description?: string;
    price: number;
    image: string;
    vegetarian?: boolean;
    rating?: number;
    restaurantName?: string;
    restaurantId?: string;
    category?: string;
    prepTime?: number;
}

export interface TicketDraftData {
    category: 'order' | 'refund' | 'payment' | 'delivery' | 'food_quality' | 'account' | 'other';
    subject: string;
    description: string;
    orderId?: string;
    isCreated?: boolean;
    ticketId?: string;
    submitting?: boolean;
}

export interface AIChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    responseDetails?: ChatResponse;
    orderData?: OrderTrackingInfo[];
    foodData?: FoodRecommendationItem[];
    ticketDraft?: TicketDraftData;
    isSecurityWarning?: boolean;
    loginRequired?: boolean;
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
    const { user, customer } = useAuth();

    const [activeRole, setActiveRole] = useState<PanelRole>(initialRole);
    const [messages, setMessages] = useState<AIChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const scrollEndRef = useRef<HTMLDivElement>(null);

    // Modal State for manual Ticket
    const [ticketModalOpen, setTicketModalOpen] = useState(false);
    const [ticketSubmitting, setTicketSubmitting] = useState(false);
    const [ticketSubject, setTicketSubject] = useState('');
    const [ticketCategory, setTicketCategory] = useState<string>('order');
    const [ticketDescription, setTicketDescription] = useState('');

    // Cached menu items for fast recommendations
    const [menuItemsCache, setMenuItemsCache] = useState<FoodRecommendationItem[]>([]);

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

    // Fetch popular dishes on mount to provide instant food recommendations
    useEffect(() => {
        const fetchInitialDishes = async () => {
            try {
                const q = query(collection(db, 'menuItems'), limit(30));
                const snap = await getDocs(q);
                const items: FoodRecommendationItem[] = snap.docs.map(docSnap => {
                    const data = docSnap.data();
                    return {
                        id: docSnap.id,
                        name: data.name || 'Delicious Dish',
                        description: data.description || '',
                        price: Number(data.price) || 199,
                        image: data.image || data.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500',
                        vegetarian: Boolean(data.vegetarian ?? true),
                        rating: Number(data.averageRating) || 4.8,
                        restaurantName: data.restaurantName || 'Partner Kitchen',
                        restaurantId: data.restaurantId || '',
                        category: data.category || 'Special',
                        prepTime: Number(data.preparationTime) || 25
                    };
                });
                setMenuItemsCache(items);
            } catch (err) {
                console.warn('AI Menu cache notice:', err);
            }
        };

        fetchInitialDishes();
    }, []);

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

    // Fetch user orders in real-time for order tracking
    const fetchUserOrdersForTracking = async (searchOrderId?: string): Promise<OrderTrackingInfo[]> => {
        if (!user) return [];

        try {
            let q = query(
                collection(db, 'orders'),
                where(
                    effectiveRole === 'delivery'
                        ? 'deliveryPersonId'
                        : effectiveRole === 'restaurant'
                        ? 'restaurantId'
                        : 'customerId',
                    '==',
                    user.uid
                )
            );

            const snap = await getDocs(q);
            if (snap.empty) return [];

            const list = snap.docs.map(docSnap => {
                const data = docSnap.data();
                const itemsList = Array.isArray(data.items)
                    ? data.items.map((it: any) => `${it.quantity || 1}x ${it.name || 'Item'}`).join(', ')
                    : '1x Meal Order';

                // Calculate estimated ETA in minutes
                let etaMinutes = 25;
                if (data.status === 'out_for_delivery') etaMinutes = 10;
                else if (data.status === 'preparing') etaMinutes = 20;
                else if (data.status === 'ready') etaMinutes = 15;
                else if (data.status === 'delivered') etaMinutes = 0;

                const address = typeof data.deliveryAddress === 'string'
                    ? data.deliveryAddress
                    : data.deliveryAddress?.street || data.deliveryAddress?.city || 'Customer Address';

                return {
                    id: docSnap.id,
                    orderNumber: data.orderNumber || docSnap.id.slice(-6).toUpperCase(),
                    restaurantName: data.restaurantName || 'AKR Kitchen',
                    status: (data.status || 'pending').toLowerCase(),
                    itemsSummary: itemsList,
                    itemsCount: Array.isArray(data.items) ? data.items.length : 1,
                    total: Number(data.total) || 0,
                    createdAt: data.createdAt,
                    deliveryAddress: address,
                    deliveryPersonName: data.deliveryPersonName || data.driverName,
                    deliveryPersonPhone: data.deliveryPersonPhone,
                    etaMinutes
                };
            });

            // Sort in memory by createdAt descending
            list.sort((a, b) => {
                const tA = a.createdAt?.seconds || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
                const tB = b.createdAt?.seconds || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
                return tB - tA;
            });

            // If user mentioned specific order ID/number, prioritize that
            if (searchOrderId) {
                const cleanedSearch = searchOrderId.toLowerCase().replace('#', '');
                const matched = list.filter(o =>
                    o.id.toLowerCase().includes(cleanedSearch) ||
                    (o.orderNumber && o.orderNumber.toLowerCase().includes(cleanedSearch))
                );
                if (matched.length > 0) return matched;
            }

            // Return active in-flight orders, or the latest order
            const activeOrders = list.filter(o =>
                ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(o.status)
            );

            return activeOrders.length > 0 ? activeOrders.slice(0, 2) : list.slice(0, 1);
        } catch (err) {
            console.warn('AI order tracking query notice:', err);
            return [];
        }
    };

    // Filter or fetch dishes for food recommendations
    const findDishesForRecommendation = (searchTerm?: string, isVegOnly?: boolean): FoodRecommendationItem[] => {
        let pool = [...menuItemsCache];

        if (isVegOnly) {
            pool = pool.filter(p => p.vegetarian === true);
        }

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            const filtered = pool.filter(p =>
                p.name.toLowerCase().includes(term) ||
                (p.category && p.category.toLowerCase().includes(term)) ||
                (p.description && p.description.toLowerCase().includes(term))
            );
            if (filtered.length > 0) return filtered.slice(0, 4);
        }

        // Return top rated items
        pool.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        return pool.slice(0, 4);
    };

    // Main AI Engine Query Dispatcher
    const handleSend = async (textToSend?: string) => {
        const queryText = (textToSend || inputValue).trim();
        if (!queryText) return;

        const userMsg: AIChatMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: queryText,
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMsg]);
        if (!textToSend) setInputValue('');
        setIsTyping(true);

        try {
            // 1. SECURITY & PROMPT SHIELD
            const securityResult = checkSecurityThreat(queryText);
            if (securityResult.isThreat && securityResult.response) {
                setTimeout(() => {
                    setMessages((prev) => [
                        ...prev,
                        {
                            id: `sec-${Date.now()}`,
                            role: 'assistant',
                            content: securityResult.response!.text,
                            timestamp: new Date(),
                            isSecurityWarning: true,
                            responseDetails: securityResult.response,
                        },
                    ]);
                    setIsTyping(false);
                }, 400);
                return;
            }

            // 2. CHECK FOR IN-CHAT SUPPORT TICKET CREATION INTENT
            const ticketIntent = detectTicketCreationIntent(queryText);
            if (ticketIntent.isTicketQuery) {
                if (!user) {
                    setTimeout(() => {
                        setMessages((prev) => [
                            ...prev,
                            {
                                id: `bot-login-${Date.now()}`,
                                role: 'assistant',
                                content: `I'd love to create a support ticket for you right away! 🎫\n\nPlease **sign in** with your account so our care desk can link the ticket directly to your profile and resolve it immediately.`,
                                timestamp: new Date(),
                                loginRequired: true,
                            },
                        ]);
                        setIsTyping(false);
                    }, 400);
                    return;
                }

                // Check if user has an active order to link automatically
                const activeOrders = await fetchUserOrdersForTracking();
                const linkedOrderId = activeOrders.length > 0 ? activeOrders[0].id : undefined;

                setTimeout(() => {
                    const ticketDraft: TicketDraftData = {
                        category: ticketIntent.category,
                        subject: ticketIntent.subject,
                        description: ticketIntent.description,
                        orderId: linkedOrderId,
                    };

                    setMessages((prev) => [
                        ...prev,
                        {
                            id: `bot-ticket-${Date.now()}`,
                            role: 'assistant',
                            content: `I've prepared a **Support Ticket Draft** for you based on your message! 📝\n\nReview the details below and tap **"Confirm & Create Ticket"** to register it directly in Firebase.`,
                            timestamp: new Date(),
                            ticketDraft,
                        },
                    ]);
                    setIsTyping(false);
                }, 400);
                return;
            }

            // 3. CHECK FOR ORDER TRACKING INTENT
            const orderIntent = detectOrderTrackingIntent(queryText);
            if (orderIntent.isTracking) {
                if (!user) {
                    setTimeout(() => {
                        setMessages((prev) => [
                            ...prev,
                            {
                                id: `bot-orders-unauth-${Date.now()}`,
                                role: 'assistant',
                                content: `To check your live order tracking and kitchen updates, please **log in** with your Hunger customer account.`,
                                timestamp: new Date(),
                                loginRequired: true,
                            },
                        ]);
                        setIsTyping(false);
                    }, 400);
                    return;
                }

                const userOrders = await fetchUserOrdersForTracking(orderIntent.orderId);

                setTimeout(() => {
                    if (userOrders.length > 0) {
                        const primaryOrder = userOrders[0];
                        const isLive = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(primaryOrder.status);

                        const responseText = isLive
                            ? `Here is your active order from **${primaryOrder.restaurantName}**! Live kitchen & rider status is updated below:`
                            : `Here is your recent order details for **Order #${primaryOrder.orderNumber}**. Status is currently marked as **${primaryOrder.status.toUpperCase()}**.`;

                        setMessages((prev) => [
                            ...prev,
                            {
                                id: `bot-order-${Date.now()}`,
                                role: 'assistant',
                                content: responseText,
                                timestamp: new Date(),
                                orderData: userOrders,
                            },
                        ]);
                    } else {
                        setMessages((prev) => [
                            ...prev,
                            {
                                id: `bot-no-orders-${Date.now()}`,
                                role: 'assistant',
                                content: `You don't have any active orders right now! 🍽️\n\nWould you like me to recommend some popular dishes or trending restaurants for your cravings?`,
                                timestamp: new Date(),
                                responseDetails: {
                                    id: Date.now().toString(),
                                    text: '',
                                    confidence: 1.0,
                                    role: activeRole,
                                    suggestedFollowUps: [
                                        'Show me best pizza & burgers',
                                        'Recommend Biryani dishes',
                                        'What are today\'s offers?',
                                        'Show pure vegetarian food'
                                    ]
                                }
                            },
                        ]);
                    }
                    setIsTyping(false);
                }, 500);
                return;
            }

            // 4. CHECK FOR FOOD / PRODUCT RECOMMENDATION INTENT
            const foodIntent = detectFoodRecommendationIntent(queryText);
            if (foodIntent.isFoodQuery) {
                const recommendedDishes = findDishesForRecommendation(foodIntent.searchTerm, foodIntent.isVegOnly);

                setTimeout(() => {
                    const dishTitle = foodIntent.searchTerm
                        ? `Top **${foodIntent.searchTerm.toUpperCase()}** Options`
                        : `Today's Chef Recommendations`;

                    setMessages((prev) => [
                        ...prev,
                        {
                            id: `bot-food-${Date.now()}`,
                            role: 'assistant',
                            content: `Here are ${dishTitle} curated fresh from our partner kitchens! Tap **"Order Now"** on any item to view or add to your feast:`,
                            timestamp: new Date(),
                            foodData: recommendedDishes,
                            responseDetails: {
                                id: Date.now().toString(),
                                text: '',
                                confidence: 1.0,
                                role: activeRole,
                                suggestedFollowUps: [
                                    'Show vegetarian options only',
                                    'Dishes under ₹200',
                                    'Recommend sweet desserts',
                                    'Where is my order?'
                                ]
                            }
                        },
                    ]);
                    setIsTyping(false);
                }, 450);
                return;
            }

            // 5. GENERAL KNOWLEDGE BASE QUERY MATCHING
            setTimeout(() => {
                const botReply = queryChatbot(queryText, activeRole);
                const botMsg: AIChatMessage = {
                    id: `bot-${Date.now()}`,
                    role: 'assistant',
                    content: botReply.text,
                    timestamp: new Date(),
                    responseDetails: botReply,
                };
                setMessages((prev) => [...prev, botMsg]);
                setIsTyping(false);
            }, 450);
        } catch (err) {
            console.error('AI chat handling error:', err);
            setIsTyping(false);
        }
    };

    // 1-Click Ticket Creation from Chat Draft
    const handleConfirmCreateTicket = async (messageId: string, draft: TicketDraftData) => {
        if (!user) {
            toast.error("Please log in to submit a support ticket.");
            return;
        }

        try {
            // Set draft loading state
            setMessages(prev => prev.map(m => {
                if (m.id === messageId && m.ticketDraft) {
                    return { ...m, ticketDraft: { ...m.ticketDraft, submitting: true } };
                }
                return m;
            }));

            const roleLabel =
                effectiveRole === 'customer'
                    ? 'Customer'
                    : effectiveRole === 'delivery'
                    ? 'Delivery Partner'
                    : 'Restaurant Partner';

            const newTicketData = {
                userId: user.uid,
                customerId: user.uid,
                userType: effectiveRole,
                userName: customer?.name || user.displayName || roleLabel,
                userEmail: customer?.email || user.email || `${effectiveRole}@akrhunger.com`,
                userPhone: customer?.phone || '',
                subject: draft.subject.trim(),
                category: draft.category,
                priority: 'medium',
                orderId: draft.orderId || null,
                description: draft.description.trim(),
                status: 'open',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                replies: [
                    {
                        id: `reply-${Date.now()}`,
                        sender: 'customer',
                        senderName: customer?.name || user.displayName || roleLabel,
                        text: draft.description.trim(),
                        timestamp: new Date().toISOString(),
                    },
                ],
            };

            const docRef = await addDoc(collection(db, 'supportTickets'), newTicketData);

            // RTDB Sync for instant agent notification
            try {
                if (realtimeDb) {
                    const chatRef = rtdbRef(realtimeDb, `supportChats/${docRef.id}`);
                    await rtdbSet(chatRef, {
                        ticketId: docRef.id,
                        status: 'open',
                        subject: draft.subject.trim(),
                        createdAt: Date.now(),
                    });
                }
            } catch (_) {}

            toast.success("🎉 Support Ticket Created Successfully!");

            // Update message with created ticket state
            setMessages(prev => prev.map(m => {
                if (m.id === messageId && m.ticketDraft) {
                    return {
                        ...m,
                        ticketDraft: {
                            ...m.ticketDraft,
                            submitting: false,
                            isCreated: true,
                            ticketId: docRef.id
                        }
                    };
                }
                return m;
            }));
        } catch (err) {
            console.error("Error creating ticket from AI:", err);
            toast.error("Failed to create ticket. Please try again.");
            setMessages(prev => prev.map(m => {
                if (m.id === messageId && m.ticketDraft) {
                    return { ...m, ticketDraft: { ...m.ticketDraft, submitting: false } };
                }
                return m;
            }));
        }
    };

    // Pre-fill and trigger Ticket creation for a specific order
    const handleRaiseTicketForOrder = (order: OrderTrackingInfo) => {
        handleSend(`I have an issue with Order #${order.orderNumber} from ${order.restaurantName}. Please create a support ticket.`);
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

    // Manual Modal Ticket Submission
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
                customerId: currentUser?.uid || 'guest-user',
                userType: effectiveRole,
                userName: currentUser?.displayName || currentUser?.email?.split('@')[0] || roleLabel,
                userEmail: currentUser?.email || `${effectiveRole}@akrhunger.com`,
                subject: ticketSubject.trim(),
                category: ticketCategory,
                priority: 'medium',
                description: ticketDescription.trim(),
                status: 'open',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                replies: [
                    {
                        id: `reply-${Date.now()}`,
                        sender: 'customer',
                        senderName: currentUser?.displayName || roleLabel,
                        text: ticketDescription.trim(),
                        timestamp: new Date().toISOString(),
                    }
                ]
            };

            const docRef = await addDoc(collection(db, 'supportTickets'), newTicketData);
            toast.success("Support ticket created in Firebase!");

            const confirmMsg: AIChatMessage = {
                id: `ticket-confirm-${Date.now()}`,
                role: 'assistant',
                content: `✅ **Support Ticket Created: #${docRef.id.slice(-6).toUpperCase()}**\n\n- **Subject:** ${ticketSubject.trim()}\n- **Category:** ${ticketCategory}\n- **Status:** open\n\nOur human resolution desk will respond in under 30 minutes!`,
                timestamp: new Date(),
                responseDetails: {
                    id: Date.now().toString(),
                    text: '',
                    confidence: 1.0,
                    role: activeRole,
                    suggestedFollowUps: ['Track my orders', 'Help with refund policy'],
                    actionLink: { label: `View on ${roleLabel} Support Desk`, url: supportPageUrl }
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
            className={`flex flex-col bg-card border border-border rounded-3xl shadow-2xl overflow-hidden transition-all duration-300 ${
                compact ? 'h-[520px]' : 'h-[660px]'
            } ${className}`}
        >
            {/* Header */}
            <div className="p-3.5 sm:p-4 bg-muted/70 backdrop-blur-md border-b border-border flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2.5">
                    <div className="relative">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-primary to-orange-500 flex items-center justify-center text-primary-foreground shadow-md shadow-primary/25">
                            <Bot className="w-5 h-5" />
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-card rounded-full animate-pulse" />
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <h3 className="font-bold text-sm sm:text-base text-foreground">
                                AKR Order & Support AI
                            </h3>
                            <Badge
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20"
                            >
                                Live 24/7
                            </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-amber-500" />
                            Live Order Tracking • Dish Discovery • Instant Ticket Desk
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleClearChat}
                        title="Reset Conversation"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-xl"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Role Filter Tabs */}
            <div className="px-3 py-2 bg-muted/40 border-b border-border flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
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
                                className={`max-w-[90%] sm:max-w-[85%] rounded-3xl p-3 sm:p-4 shadow-sm ${
                                    msg.role === 'user'
                                        ? 'bg-primary text-primary-foreground rounded-tr-none'
                                        : msg.isSecurityWarning
                                        ? 'bg-red-500/10 border border-red-500/30 text-foreground rounded-tl-none'
                                        : 'bg-muted/80 text-foreground border border-border/80 rounded-tl-none'
                                }`}
                            >
                                {msg.isSecurityWarning && (
                                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-red-500/20 text-red-600 dark:text-red-400 font-bold text-xs">
                                        <ShieldAlert className="w-4 h-4 shrink-0" />
                                        <span>Security & Privacy Protocol Engaged</span>
                                    </div>
                                )}

                                <div className="space-y-1">
                                    {formatMessageContent(msg.content)}
                                </div>

                                {/* 1. INTERACTIVE LIVE ORDER CARD */}
                                {msg.orderData && msg.orderData.length > 0 && (
                                    <div className="mt-3 space-y-3 pt-2">
                                        {msg.orderData.map((order) => {
                                            const status = order.status;
                                            const stepIndex =
                                                status === 'pending'
                                                    ? 0
                                                    : status === 'confirmed'
                                                    ? 1
                                                    : status === 'preparing'
                                                    ? 2
                                                    : status === 'ready' || status === 'out_for_delivery'
                                                    ? 3
                                                    : status === 'delivered'
                                                    ? 4
                                                    : -1;

                                            return (
                                                <div
                                                    key={order.id}
                                                    className="p-3.5 rounded-2xl bg-card border border-border/80 shadow-md text-foreground space-y-3"
                                                >
                                                    {/* Header */}
                                                    <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                                                                <Package className="w-4 h-4" />
                                                            </div>
                                                            <div>
                                                                <h5 className="font-black text-xs sm:text-sm text-foreground">
                                                                    {order.restaurantName}
                                                                </h5>
                                                                <span className="text-[10px] text-muted-foreground font-mono">
                                                                    #{order.orderNumber}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <Badge
                                                            className={`text-[10px] uppercase font-bold px-2 py-0.5 ${
                                                                status === 'delivered'
                                                                    ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                                                                    : status === 'cancelled'
                                                                    ? 'bg-red-500/15 text-red-600 border-red-500/30'
                                                                    : 'bg-primary/15 text-primary border-primary/30 animate-pulse'
                                                            }`}
                                                        >
                                                            {status.replace('_', ' ')}
                                                        </Badge>
                                                    </div>

                                                    {/* Stepper Progress */}
                                                    {status !== 'cancelled' && (
                                                        <div className="py-1">
                                                            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1 font-semibold">
                                                                <span className={stepIndex >= 0 ? 'text-primary font-bold' : ''}>Placed</span>
                                                                <span className={stepIndex >= 1 ? 'text-primary font-bold' : ''}>Cooking</span>
                                                                <span className={stepIndex >= 3 ? 'text-primary font-bold' : ''}>On the Way</span>
                                                                <span className={stepIndex >= 4 ? 'text-emerald-500 font-bold' : ''}>Delivered</span>
                                                            </div>
                                                            <div className="w-full bg-muted h-2 rounded-full overflow-hidden flex">
                                                                <div
                                                                    className="bg-primary h-full transition-all duration-500 rounded-full"
                                                                    style={{
                                                                        width: `${
                                                                            stepIndex === 0
                                                                                ? 25
                                                                                : stepIndex === 1
                                                                                ? 45
                                                                                : stepIndex === 2
                                                                                ? 65
                                                                                : stepIndex === 3
                                                                                ? 85
                                                                                : stepIndex >= 4
                                                                                ? 100
                                                                                : 10
                                                                        }%`,
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Items & Address */}
                                                    <div className="text-xs text-muted-foreground space-y-1 bg-muted/40 p-2.5 rounded-xl border border-border/50">
                                                        <p className="line-clamp-2 text-foreground font-medium">
                                                            <Utensils className="w-3.5 h-3.5 inline mr-1 text-primary" />
                                                            {order.itemsSummary}
                                                        </p>
                                                        <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px]">
                                                            <span className="font-bold text-foreground">
                                                                Total: ₹{order.total}
                                                            </span>
                                                            {order.status !== 'delivered' && order.etaMinutes && (
                                                                <span className="text-primary font-semibold flex items-center gap-1">
                                                                    <Clock className="w-3 h-3" /> ETA ~{order.etaMinutes} mins
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Action Buttons */}
                                                    <div className="flex items-center gap-2 pt-1">
                                                        <Link
                                                            href={`/customer/orders`}
                                                            className="flex-1 text-center py-2 px-3 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-all flex items-center justify-center gap-1"
                                                        >
                                                            <MapPin className="w-3.5 h-3.5" /> Live Map Tracking
                                                        </Link>
                                                        <button
                                                            onClick={() => handleRaiseTicketForOrder(order)}
                                                            className="py-2 px-3 rounded-xl border border-border/80 text-foreground hover:bg-card text-xs font-semibold transition-colors flex items-center gap-1"
                                                        >
                                                            <FileText className="w-3.5 h-3.5 text-primary" /> Report Issue
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* 2. INTERACTIVE FOOD DISH RECOMMENDATION CAROUSEL */}
                                {msg.foodData && msg.foodData.length > 0 && (
                                    <div className="mt-3 pt-2">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                            {msg.foodData.map((dish) => (
                                                <div
                                                    key={dish.id}
                                                    className="rounded-2xl border border-border/80 bg-card p-2.5 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow group"
                                                >
                                                    <div className="flex gap-2.5 items-start">
                                                        <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-muted border border-border/60">
                                                            <img
                                                                src={dish.image}
                                                                alt={dish.name}
                                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                                onError={(e) => {
                                                                    (e.target as HTMLImageElement).src =
                                                                        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500';
                                                                }}
                                                            />
                                                            <span
                                                                className={`absolute top-1 left-1 w-2.5 h-2.5 rounded-full border border-card ${
                                                                    dish.vegetarian ? 'bg-emerald-500' : 'bg-rose-500'
                                                                }`}
                                                            />
                                                        </div>

                                                        <div className="min-w-0 flex-1">
                                                            <h5 className="font-bold text-xs text-foreground truncate group-hover:text-primary transition-colors">
                                                                {dish.name}
                                                            </h5>
                                                            <p className="text-[10px] text-muted-foreground truncate">
                                                                {dish.restaurantName}
                                                            </p>
                                                            <div className="flex items-center gap-1.5 mt-1">
                                                                <span className="font-black text-xs text-primary">
                                                                    ₹{dish.price}
                                                                </span>
                                                                <span className="text-[10px] font-bold text-amber-500 flex items-center">
                                                                    <Star className="w-2.5 h-2.5 fill-amber-500 mr-0.5" />
                                                                    {dish.rating}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <Link
                                                        href={`/customer/product/${dish.id}`}
                                                        className="mt-2.5 w-full py-1.5 rounded-xl bg-muted/80 hover:bg-primary text-foreground hover:text-primary-foreground font-bold text-[11px] text-center transition-colors flex items-center justify-center gap-1"
                                                    >
                                                        <ShoppingBag className="w-3 h-3" /> Order Now
                                                    </Link>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* 3. IN-CHAT 1-CLICK TICKET CREATION DRAFT */}
                                {msg.ticketDraft && (
                                    <div className="mt-3 p-3.5 rounded-2xl bg-card border border-border/80 text-foreground space-y-3 shadow-md">
                                        <div className="flex items-center justify-between border-b border-border/60 pb-2">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                                                    <FileText className="w-3.5 h-3.5" />
                                                </div>
                                                <h5 className="font-bold text-xs text-foreground">
                                                    Support Ticket Draft
                                                </h5>
                                            </div>
                                            <Badge variant="outline" className="text-[10px] font-bold uppercase">
                                                {msg.ticketDraft.category}
                                            </Badge>
                                        </div>

                                        {msg.ticketDraft.isCreated ? (
                                            /* Created State */
                                            <div className="space-y-2 py-1 text-center">
                                                <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                                                    <CheckCircle2 className="w-6 h-6" />
                                                </div>
                                                <p className="font-black text-xs text-emerald-600 dark:text-emerald-400">
                                                    Ticket #{msg.ticketDraft.ticketId?.slice(-6).toUpperCase()} Registered!
                                                </p>
                                                <p className="text-[11px] text-muted-foreground">
                                                    Our 24/7 care team has been notified. You can track agent replies anytime in the support portal.
                                                </p>
                                                <Link
                                                    href={supportPageUrl}
                                                    className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline pt-1"
                                                >
                                                    Open Support Desk <ArrowRight className="w-3 h-3" />
                                                </Link>
                                            </div>
                                        ) : (
                                            /* Pre-submission Draft State */
                                            <div className="space-y-2.5">
                                                <div className="text-xs space-y-1">
                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase">
                                                        Subject:
                                                    </span>
                                                    <p className="font-semibold text-foreground bg-muted/50 p-2 rounded-lg text-xs">
                                                        {msg.ticketDraft.subject}
                                                    </p>
                                                </div>

                                                <div className="text-xs space-y-1">
                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase">
                                                        Description:
                                                    </span>
                                                    <p className="text-muted-foreground bg-muted/50 p-2 rounded-lg text-xs line-clamp-3">
                                                        {msg.ticketDraft.description}
                                                    </p>
                                                </div>

                                                {msg.ticketDraft.orderId && (
                                                    <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                                                        <Package className="w-3 h-3 text-primary" />
                                                        <span>Linked Order: <b>#{msg.ticketDraft.orderId.slice(-6).toUpperCase()}</b></span>
                                                    </div>
                                                )}

                                                <Button
                                                    onClick={() => handleConfirmCreateTicket(msg.id, msg.ticketDraft!)}
                                                    disabled={msg.ticketDraft.submitting}
                                                    className="w-full rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 text-xs py-2 shadow-sm"
                                                >
                                                    {msg.ticketDraft.submitting ? (
                                                        <>
                                                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving Ticket...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Check className="w-3.5 h-3.5 mr-1.5" /> Confirm & Create Ticket in Firebase
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Login Required Prompt */}
                                {msg.loginRequired && (
                                    <div className="mt-3 pt-2">
                                        <Link href="/auth/login">
                                            <Button className="w-full rounded-xl font-bold bg-primary text-primary-foreground text-xs">
                                                Log In to AKR Hunger
                                            </Button>
                                        </Link>
                                    </div>
                                )}

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
                                                        className="text-[11px] text-left px-2.5 py-1 rounded-lg bg-card/80 hover:bg-card border border-border text-foreground hover:text-primary transition-all flex items-center gap-1"
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
                                Consulting live order & culinary desk...
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
                        className="text-[11px] text-primary font-bold hover:underline flex items-center gap-0.5 px-2.5 py-1 bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
                    >
                        Raise Ticket <ChevronRight className="w-3 h-3" />
                    </button>
                    <Link
                        href={supportPageUrl}
                        className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 px-2.5 py-1 rounded-lg border border-border/80 hover:bg-card transition-colors"
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
                            ? 'Ask about order tracking, cravings, dishes, refund, or "create ticket"...'
                            : activeRole === 'delivery'
                            ? 'Ask about Marketplace orders, payouts, status flow, emergency...'
                            : activeRole === 'restaurant'
                            ? 'Ask about live orders, menu out-of-stock, quality score, ads...'
                            : 'Ask about live orders, dishes, refunds, tickets, or platform help...'
                    }
                    className="flex-1 bg-muted/50 border-input text-foreground text-xs sm:text-sm placeholder:text-muted-foreground/70 h-10 sm:h-11 rounded-2xl focus-visible:ring-primary"
                />
                <Button
                    type="submit"
                    disabled={!inputValue.trim() || isTyping}
                    className="h-10 sm:h-11 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-2xl shadow-md transition-all shrink-0"
                >
                    <Send className="w-4 h-4" />
                </Button>
            </form>

            {/* Quick Raise Ticket Dialog */}
            <Dialog open={ticketModalOpen} onOpenChange={setTicketModalOpen}>
                <DialogContent className="max-w-md w-[92vw] bg-card border-border text-card-foreground p-5 rounded-3xl shadow-2xl">
                    <DialogHeader>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="p-2 rounded-2xl bg-primary/10 text-primary">
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
                                className="w-full h-10 px-3 rounded-xl bg-muted/60 border border-input text-foreground text-xs focus:ring-primary focus:border-primary font-medium"
                            >
                                {effectiveRole === 'customer' && (
                                    <>
                                        <option value="order">Order Tracking & Delay</option>
                                        <option value="refund">Cancellation & Refund</option>
                                        <option value="payment">Payment / Wallet Issue</option>
                                        <option value="food_quality">Food Quality or Missing Items</option>
                                        <option value="delivery">Delivery Partner Concern</option>
                                        <option value="other">General Inquiry</option>
                                    </>
                                )}
                                {effectiveRole === 'delivery' && (
                                    <>
                                        <option value="order">Marketplace / Order Acceptance</option>
                                        <option value="payment">Earnings & Monday Payouts</option>
                                        <option value="account">Vehicle RC & Documents</option>
                                        <option value="delivery">App GPS / Tracking Glitch</option>
                                        <option value="other">General Support</option>
                                    </>
                                )}
                                {effectiveRole === 'restaurant' && (
                                    <>
                                        <option value="order">Live Orders & Kitchen Pipeline</option>
                                        <option value="other">Menu & Out-of-Stock Items</option>
                                        <option value="payment">Wallet & Weekly Payouts</option>
                                        <option value="other">Ad Campaigns & Points</option>
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
                                className="h-10 text-xs bg-muted/60 rounded-xl"
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
                                className="text-xs bg-muted/60 resize-none rounded-xl"
                                required
                            />
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0 pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setTicketModalOpen(false)}
                                className="rounded-xl text-xs h-10 font-semibold"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={ticketSubmitting}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-xs h-10 shadow-md"
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
