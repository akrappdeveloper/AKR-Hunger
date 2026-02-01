'use client';

import { useEffect, useState, useRef } from 'react';
import { useRestaurantAuth } from '@/context/RestaurantAuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { SupportTicket } from '@/lib/types';
import {
    HelpCircle,
    Send,
    CheckCircle,
    Clock,
    MessageSquare,
    Reply,
    RefreshCw,
    X,
    Tag,
    Loader2,
    Bot,
    Search,
    Filter,
    ThumbsUp,
    ThumbsDown,
    Sparkles,
    MessageCircle,
    FileQuestion,
    LifeBuoy
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

// --- AI Chat Types & Component ---
type ChatMessage = {
    id: string;
    role: 'user' | 'ai';
    content: string;
    timestamp: Date;
};

export default function RestaurantSupportPage() {
    const { user, restaurant, loading: authLoading } = useRestaurantAuth();

    // Tabs State
    const [activeTab, setActiveTab] = useState('tickets');

    // Ticket Data
    const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');

    // Dialogs
    const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
    const [ticketSuccessDialog, setTicketSuccessDialog] = useState(false);
    const [submittingTicket, setSubmittingTicket] = useState(false);
    const [viewRepliesDialog, setViewRepliesDialog] = useState(false);
    const [addReplyDialog, setAddReplyDialog] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
    const [replyMessage, setReplyMessage] = useState('');

    // New Ticket Form
    const [newTicket, setNewTicket] = useState({
        subject: '',
        category: 'technical' as const,
        priority: 'medium' as const,
        description: '',
    });

    // AI Chat State
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
        { id: '1', role: 'ai', content: 'Hi there! I\'m your AI Support Assistant. How can I help you today? I can answer questions about orders, menu management, payments, and more.', timestamp: new Date() }
    ]);
    const [chatInput, setChatInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Feedback State
    const [feedback, setFeedback] = useState('');
    const [rating, setRating] = useState<number | null>(null);
    const [submittingFeedback, setSubmittingFeedback] = useState(false);

    useEffect(() => {
        if (authLoading) return;
        if (user) {
            loadSupportTickets();
        }
    }, [user, authLoading]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages, isTyping]);

    const loadSupportTickets = async () => {
        try {
            setLoading(true);
            const ticketsRef = collection(db, 'supportTickets');
            const q = query(
                ticketsRef,
                where('userId', '==', user!.uid),
                orderBy('createdAt', 'desc')
            );
            const snapshot = await getDocs(q);

            const tickets = snapshot.docs.map((doc) => ({
                ...doc.data(),
                id: doc.id,
            })) as SupportTicket[];

            setSupportTickets(tickets);
        } catch (error) {
            console.error('[Support] Error loading tickets:', error);
            // toast.error('Failed to load support tickets'); // Suppress initial load error if subtle
        } finally {
            setLoading(false);
        }
    };

    // --- Ticket Operations ---

    const handleSubmitTicket = async () => {
        if (!newTicket.subject || !newTicket.description) {
            toast.error('Please fill in all required fields');
            return;
        }

        try {
            setSubmittingTicket(true);
            await addDoc(collection(db, 'supportTickets'), {
                userId: user!.uid,
                userType: 'restaurant',
                userName: restaurant?.name || 'Restaurant',
                userEmail: user!.email,
                subject: newTicket.subject,
                category: newTicket.category,
                priority: newTicket.priority,
                description: newTicket.description,
                status: 'open',
                createdAt: new Date(),
                replies: []
            });

            setNewTicket({ subject: '', category: 'technical', priority: 'medium', description: '' });
            setTicketDialogOpen(false);
            await loadSupportTickets();
            setTicketSuccessDialog(true);
        } catch (error) {
            console.error(error);
            toast.error('Failed to submit ticket');
        } finally {
            setSubmittingTicket(false);
        }
    };

    const submitReply = async () => {
        if (!replyMessage.trim() || !selectedTicket) return;
        try {
            const reply = {
                id: Date.now().toString(),
                ticketId: selectedTicket.id!,
                userId: user!.uid,
                userName: restaurant?.name || 'Restaurant',
                userType: 'restaurant' as const,
                message: replyMessage,
                createdAt: new Date()
            };
            const ticketRef = doc(db, 'supportTickets', selectedTicket.id!);
            await updateDoc(ticketRef, {
                replies: [...(selectedTicket.replies || []), reply],
                status: 'in_progress',
                updatedAt: new Date()
            });
            setReplyMessage('');
            setAddReplyDialog(false);
            loadSupportTickets();
            toast.success('Reply sent successfully');
        } catch (error) {
            console.error(error);
            toast.error('Failed to send reply');
        }
    };

    // --- AI Chat Logic ---

    const handleChatSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim()) return;

        const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: chatInput, timestamp: new Date() };
        setChatMessages(prev => [...prev, userMsg]);
        setChatInput('');
        setIsTyping(true);

        // Simulated AI Response
        setTimeout(() => {
            let aiResponse = "I'm not sure about that specific query. Would you like to create a support ticket?";
            const lowerInput = userMsg.content.toLowerCase();

            if (lowerInput.includes('menu') || lowerInput.includes('item') || lowerInput.includes('food')) {
                aiResponse = "To manage your menu, go to the 'Menu Management' tab in the sidebar. You can add new items, edit prices, and mark items as out of stock instantly.";
            } else if (lowerInput.includes('payment') || lowerInput.includes('payout') || lowerInput.includes('money')) {
                aiResponse = "Payments are processed weekly. You can view your earnings and transaction history in the 'Wallet' section. If you have a specific billing issue, please raise a ticket under the 'Billing' category.";
            } else if (lowerInput.includes('order') || lowerInput.includes('cancel')) {
                aiResponse = "You can manage active orders in the 'Orders' dashboard. If you need to cancel an order, please do so quickly and provide a reason. Excessive cancellations may affect your restaurant rating.";
            } else if (lowerInput.includes('hello') || lowerInput.includes('hi')) {
                aiResponse = "Hello! How can I assist you with your restaurant today?";
            }

            const aiMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'ai', content: aiResponse, timestamp: new Date() };
            setChatMessages(prev => [...prev, aiMsg]);
            setIsTyping(false);
        }, 1500);
    };

    // --- Feedback Logic ---
    const submitFeedback = async () => {
        if (!rating) {
            toast.error('Please select a rating');
            return;
        }
        try {
            setSubmittingFeedback(true);
            await addDoc(collection(db, 'platformFeedback'), {
                userId: user!.uid,
                userName: restaurant?.name || 'Restaurant',
                rating,
                feedback,
                createdAt: new Date(),
                type: 'restaurant_feedback'
            });
            setFeedback('');
            setRating(null);
            toast.success('Thank you for your feedback!');
        } catch (error) {
            toast.error('Failed to submit feedback');
        } finally {
            setSubmittingFeedback(false);
        }
    };

    // --- Visualization Helpers ---
    const filteredTickets = supportTickets.filter(ticket => {
        const matchesSearch = ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ticket.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'all' || ticket.status === filterStatus;
        return matchesSearch && matchesStatus;
    });

    const getStatusBadge = (status: string) => {
        const styles = {
            open: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
            in_progress: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
            resolved: 'bg-green-500/10 text-green-400 border-green-500/20',
            closed: 'bg-slate-500/10 text-slate-400 border-slate-500/20'
        };
        return (
            <Badge variant="outline" className={`${styles[status as keyof typeof styles] || styles.open} uppercase text-[10px] tracking-wider`}>
                {status.replace('_', ' ')}
            </Badge>
        );
    };

    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-black">
                <Spinner className="w-8 h-8 text-orange-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black p-4 md:p-8 space-y-8 text-white selection:bg-orange-500/30">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-orange-400 via-rose-500 to-purple-600 bg-clip-text text-transparent flex items-center gap-3 animate-in slide-in-from-left duration-500">
                        <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-rose-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20 text-white">
                            <LifeBuoy className="w-7 h-7" />
                        </div>
                        Support Center
                    </h1>
                    <p className="text-slate-400 mt-2 text-lg">We're here to help you succeed</p>
                </div>

                {activeTab === 'tickets' && (
                    <Button
                        onClick={() => setTicketDialogOpen(true)}
                        className="bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 shadow-lg shadow-orange-500/20 text-white font-semibold h-12 px-8 rounded-full transition-all hover:scale-105"
                    >
                        <Bot className="w-5 h-5 mr-2" />
                        New Support Ticket
                    </Button>
                )}
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
                <TabsList className="bg-slate-900/80 border border-slate-800 p-1.5 h-auto rounded-full backdrop-blur-md w-full md:w-fit grid grid-cols-2 md:grid-cols-4 gap-2">
                    <TabsTrigger value="tickets" className="text-slate-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-rose-500 data-[state=active]:text-white font-medium rounded-full py-2.5 transition-all duration-300 hover:text-white">
                        <MessageSquare className="w-4 h-4 mr-2" /> Your Tickets
                    </TabsTrigger>
                    <TabsTrigger value="ai-chat" className="text-slate-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white font-medium rounded-full py-2.5 transition-all duration-300 hover:text-white">
                        <Sparkles className="w-4 h-4 mr-2" /> AI Assistant
                    </TabsTrigger>
                    <TabsTrigger value="faq" className="text-slate-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white font-medium rounded-full py-2.5 transition-all duration-300 hover:text-white">
                        <FileQuestion className="w-4 h-4 mr-2" /> FAQs
                    </TabsTrigger>
                    <TabsTrigger value="feedback" className="text-slate-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-violet-500 data-[state=active]:text-white font-medium rounded-full py-2.5 transition-all duration-300 hover:text-white">
                        <ThumbsUp className="w-4 h-4 mr-2" /> Feedback
                    </TabsTrigger>
                </TabsList>

                {/* --- TICKETS TAB --- */}
                <TabsContent value="tickets" className="space-y-6 focus-visible:outline-none">
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                placeholder="Search all tickets..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-orange-500 focus:ring-orange-500 h-12 rounded-xl"
                            />
                        </div>
                        <div className="relative w-full md:w-48">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="w-full pl-10 h-12 bg-slate-900/50 border-slate-700 text-white rounded-xl appearance-none cursor-pointer focus:border-orange-500"
                            >
                                <option value="all">All Status</option>
                                <option value="open">Open</option>
                                <option value="in_progress">In Progress</option>
                                <option value="resolved">Resolved</option>
                                <option value="closed">Closed</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <AnimatePresence mode="wait">
                            {loading ? (
                                <div className="py-20 text-center"><Spinner className="w-8 h-8 text-orange-500 mx-auto" /></div>
                            ) : filteredTickets.length === 0 ? (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20 bg-slate-900/30 border border-slate-800 rounded-2xl border-dashed">
                                    <MessageSquare className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                                    <h3 className="text-xl font-semibold text-white">No tickets found</h3>
                                    <p className="text-slate-400 mt-2">Create a new ticket to get started</p>
                                </motion.div>
                            ) : (
                                filteredTickets.map((ticket) => (
                                    <motion.div
                                        key={ticket.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        layout
                                    >
                                        <Card className="bg-slate-900/40 border-slate-800 hover:bg-slate-900/60 transition-all group overflow-hidden">
                                            <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-orange-500 to-rose-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <CardContent className="p-6">
                                                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                                    <div className="flex-1 space-y-3">
                                                        <div className="flex items-center gap-3">
                                                            <h3 className="text-lg font-bold text-white group-hover:text-orange-400 transition-colors">{ticket.subject}</h3>
                                                            {getStatusBadge(ticket.status)}
                                                            {ticket.priority === 'urgent' && <Badge variant="destructive" className="animate-pulse">URGENT</Badge>}
                                                        </div>
                                                        <p className="text-slate-300 line-clamp-2">{ticket.description}</p>
                                                        <div className="flex items-center gap-4 text-slate-500 text-xs mt-2">
                                                            <div className="flex items-center gap-1 bg-slate-800/50 px-2 py-1 rounded-full text-slate-300 border border-slate-700">
                                                                <Tag className="w-3 h-3" /> {ticket.category}
                                                            </div>
                                                            <div className="flex items-center gap-1 text-slate-400">
                                                                <Clock className="w-3 h-3" /> {new Date(ticket.createdAt).toLocaleDateString()}
                                                            </div>
                                                            <div className="flex items-center gap-1 text-blue-400 font-medium">
                                                                <MessageCircle className="w-3 h-3" /> {ticket.replies?.length || 0} Replies
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2 shrink-0">
                                                        <Button variant="outline" size="sm" onClick={() => { setSelectedTicket(ticket); setViewRepliesDialog(true); }} className="border-slate-700 hover:bg-slate-800 text-white hover:text-white font-semibold">
                                                            View
                                                        </Button>
                                                        <Button size="sm" onClick={() => { setSelectedTicket(ticket); setAddReplyDialog(true); }} className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 font-semibold">
                                                            Reply
                                                        </Button>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                ))
                            )}
                        </AnimatePresence>
                    </div>
                </TabsContent>

                {/* --- AI ASSISTANT TAB --- */}
                <TabsContent value="ai-chat" className="h-[600px] focus-visible:outline-none">
                    <Card className="h-full bg-slate-900/40 border-slate-800 flex flex-col overflow-hidden shadow-2xl">
                        <div className="p-4 bg-gradient-to-r from-blue-900/20 to-indigo-900/20 border-b border-slate-800 flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-500/20 rounded-full flex items-center justify-center border border-indigo-500/30">
                                <Bot className="w-6 h-6 text-indigo-400" />
                            </div>
                            <div>
                                <h3 className="font-bold text-white">Support Assistant</h3>
                                <p className="text-xs text-indigo-300 flex items-center gap-1">
                                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /> Online
                                </p>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                            {chatMessages.map((msg) => (
                                <motion.div
                                    key={msg.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div className={`max-w-[80%] p-4 rounded-2xl shadow-lg border ${msg.role === 'user'
                                        ? 'bg-blue-600 text-white rounded-tr-none border-blue-500'
                                        : 'bg-slate-800 text-slate-200 rounded-tl-none border-slate-700'
                                        }`}>
                                        <p className="text-sm leading-relaxed">{msg.content}</p>
                                        <p className="text-[10px] opacity-50 mt-2 text-right">{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                </motion.div>
                            ))}
                            {isTyping && (
                                <div className="flex justify-start">
                                    <div className="bg-slate-800 px-4 py-3 rounded-2xl rounded-tl-none border border-slate-700 flex gap-1">
                                        <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-0" />
                                        <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-100" />
                                        <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-200" />
                                    </div>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        <div className="p-4 border-t border-slate-800 bg-slate-900/60 backdrop-blur-md">
                            <form onSubmit={handleChatSubmit} className="flex gap-2">
                                <Input
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    placeholder="Type your question..."
                                    className="bg-slate-800/50 border-slate-700 text-white focus:ring-indigo-500"
                                />
                                <Button type="submit" disabled={!chatInput.trim() || isTyping} className="bg-indigo-600 hover:bg-indigo-700 font-bold">
                                    <Send className="w-4 h-4" />
                                </Button>
                            </form>
                        </div>
                    </Card>
                </TabsContent>

                {/* --- FAQ TAB --- */}
                <TabsContent value="faq" className="space-y-6 focus-visible:outline-none">
                    <Card className="bg-slate-900/40 border-slate-800 p-6">
                        <CardHeader className="px-0 pt-0">
                            <CardTitle className="text-2xl text-white">Frequently Asked Questions</CardTitle>
                            <CardDescription className="text-slate-400">Common questions about managing your restaurant.</CardDescription>
                        </CardHeader>
                        <Accordion type="single" collapsible className="w-full">
                            {[
                                { q: "How do I update my menu?", a: "Go to the 'Menu Management' tab. Click 'Add Item' to create new dishes or click the edit icon on existing items to change prices, descriptions, or images." },
                                { q: "When will I receive my payouts?", a: "Payouts are processed every Wednesday for the previous week's earnings. Ensure your bank details are correct in the Settings > Bank Account section." },
                                { q: "How can I temporarily close my restaurant?", a: "Use the toggle switch in the top right corner of your Dashboard or Settings page to switch your status to 'Offline'. Customers won't be able to place orders while you are offline." },
                                { q: "What should I do if an order is delayed?", a: "If preparation is taking longer than expected, use the 'Delay Order' button on the order card to notify the customer and delivery partner. Consistent delays may affect your rating." },
                                { q: "How do I respond to customer reviews?", a: "Navigate to the 'Reviews' section. You can reply to any review to thank customers or address concerns. Professional responses help build trust." }
                            ].map((faq, i) => (
                                <AccordionItem key={i} value={`item-${i}`} className="border-slate-800">
                                    <AccordionTrigger className="text-slate-200 hover:text-emerald-400 text-left hover:no-underline">{faq.q}</AccordionTrigger>
                                    <AccordionContent className="text-slate-400 leading-relaxed">
                                        {faq.a}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </Card>
                </TabsContent>

                {/* --- FEEDBACK TAB --- */}
                <TabsContent value="feedback" className="max-w-2xl mx-auto focus-visible:outline-none">
                    <Card className="bg-slate-900/40 border-slate-800 p-8 text-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-b from-purple-500/5 to-transparent pointer-events-none" />
                        <h2 className="text-2xl font-bold text-white mb-2">Help Us Improve</h2>
                        <p className="text-slate-400 mb-8">We value your input! Tell us how we can make the platform better for you.</p>

                        <div className="flex justify-center gap-6 mb-8">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    onClick={() => setRating(star)}
                                    className={`text-4xl transition-all duration-300 hover:scale-125 ${rating && rating >= star ? 'grayscale-0 scale-110' : 'grayscale opacity-30 hover:opacity-100'}`}
                                >
                                    {star === 1 ? '😠' : star === 2 ? 'kq' : star === 3 ? '😐' : star === 4 ? '🙂' : '😍'}
                                </button>
                            ))}
                        </div>

                        <Textarea
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            placeholder="Share your thoughts, bugs, or feature requests..."
                            className="bg-slate-800/50 border-slate-700 text-white min-h-[150px] mb-6 focus:ring-purple-500"
                        />

                        <Button
                            onClick={submitFeedback}
                            disabled={submittingFeedback || !rating}
                            className="w-full h-12 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white text-lg font-semibold shadow-lg shadow-purple-900/20"
                        >
                            {submittingFeedback ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Submit Feedback'}
                        </Button>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* --- DIALOGS --- */}

            <Dialog open={ticketDialogOpen} onOpenChange={setTicketDialogOpen}>
                <DialogContent className="max-w-xl bg-slate-950/95 border border-slate-800 text-white backdrop-blur-xl shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold">Create Support Ticket</DialogTitle>
                        <DialogDescription className="text-slate-400">Describe your issue clearly for faster resolution.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-2">
                        <div className="space-y-2">
                            <Label className="text-slate-200">Subject</Label>
                            <Input
                                value={newTicket.subject}
                                onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                                className="bg-slate-900 border-slate-700 text-white focus:border-orange-500"
                                placeholder="e.g., Payment issue for Order #123"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-slate-200">Category</Label>
                                <select
                                    className="w-full h-10 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500 transition-colors"
                                    value={newTicket.category}
                                    onChange={(e) => setNewTicket({ ...newTicket, category: e.target.value as any })}
                                >
                                    <option value="technical">Technical</option>
                                    <option value="billing">Billing</option>
                                    <option value="order">Order Issues</option>
                                    <option value="account">Account</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-slate-200">Priority</Label>
                                <select
                                    className="w-full h-10 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500 transition-colors"
                                    value={newTicket.priority}
                                    onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value as any })}
                                >
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                    <option value="urgent">Urgent</option>
                                </select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-slate-200">Description</Label>
                            <Textarea
                                value={newTicket.description}
                                onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                                className="bg-slate-900 border-slate-700 min-h-[120px] text-white focus:border-orange-500"
                                placeholder="Provide as much detail as possible..."
                            />
                        </div>
                    </div>
                    <DialogFooter className="mt-4 gap-2">
                        <Button variant="outline" onClick={() => setTicketDialogOpen(false)} className="border-slate-700 text-white hover:text-white hover:bg-slate-800 hover:border-slate-600 font-medium">Cancel</Button>
                        <Button onClick={handleSubmitTicket} disabled={submittingTicket} className="bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-600 hover:to-rose-700 text-white font-semibold shadow-lg shadow-orange-500/20 border-0">
                            {submittingTicket && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Submit Ticket
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={ticketSuccessDialog} onOpenChange={setTicketSuccessDialog}>
                <DialogContent className="max-w-sm bg-slate-950/95 border border-slate-800 text-center pt-10 backdrop-blur-xl">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/30"
                    >
                        <CheckCircle className="w-8 h-8 text-green-500" />
                    </motion.div>
                    <DialogTitle className="text-xl text-white font-bold">Ticket Submitted!</DialogTitle>
                    <DialogDescription className="text-slate-400 mt-2">
                        We've received your request and will get back to you shortly.
                    </DialogDescription>
                    <Button onClick={() => setTicketSuccessDialog(false)} className="mt-6 w-full bg-slate-800 hover:bg-slate-700 text-white border border-slate-700">
                        Close
                    </Button>
                </DialogContent>
            </Dialog>

            {/* View/Reply Dialogs reusing simple layout */}
            <Dialog open={viewRepliesDialog} onOpenChange={setViewRepliesDialog}>
                <DialogContent className="max-w-2xl bg-slate-950/95 border border-slate-800 h-[80vh] flex flex-col backdrop-blur-xl shadow-2xl">
                    <DialogHeader className="border-b border-slate-800 pb-4">
                        <DialogTitle className="text-white flex items-center gap-3 text-xl">
                            <MessageSquare className="w-5 h-5 text-slate-400" />
                            {selectedTicket?.subject}
                            {selectedTicket && getStatusBadge(selectedTicket.status)}
                        </DialogTitle>
                        <DialogDescription className="text-slate-400">
                            Ticket ID: <span className="font-mono text-slate-300">{selectedTicket?.id}</span>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto space-y-6 p-6 bg-slate-900/30 rounded-lg custom-scrollbar my-4">
                        <div className="bg-slate-800/40 p-5 rounded-xl border border-slate-700/50">
                            <p className="text-xs text-orange-400 font-bold mb-2 uppercase tracking-wider flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                                Original Request
                            </p>
                            <p className="text-slate-200 leading-relaxed">{selectedTicket?.description}</p>
                        </div>

                        {selectedTicket?.replies?.length === 0 && (
                            <div className="text-center py-8 text-slate-500">No replies yet.</div>
                        )}

                        {selectedTicket?.replies?.map((reply, i) => (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                                key={i}
                                className={`p-5 rounded-2xl max-w-[85%] shadow-sm ${reply.userType === 'admin'
                                    ? 'bg-blue-900/20 border border-blue-500/30 ml-auto'
                                    : 'bg-slate-800 border border-slate-700'
                                    }`}
                            >
                                <div className="flex justify-between items-center mb-2">
                                    <span className={`text-xs font-bold uppercase tracking-wider ${reply.userType === 'admin' ? 'text-blue-400' : 'text-slate-400'}`}>
                                        {reply.userName || (reply.userType === 'admin' ? 'Support Team' : 'You')}
                                    </span>
                                    <span className="text-[10px] text-slate-500">{new Date(reply.createdAt).toLocaleString()}</span>
                                </div>
                                <p className="text-slate-200 text-sm whitespace-pre-wrap leading-relaxed">{reply.message}</p>
                            </motion.div>
                        ))}
                    </div>
                    <DialogFooter className="gap-3 pt-2 border-t border-slate-800">
                        <Button variant="outline" className="flex-1 border-slate-700 text-white hover:text-white hover:bg-slate-800 font-medium" onClick={() => setViewRepliesDialog(false)}>
                            Close
                        </Button>
                        <Button onClick={() => { setViewRepliesDialog(false); setAddReplyDialog(true); }} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20">
                            <Reply className="w-4 h-4 mr-2" />
                            Add Reply
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={addReplyDialog} onOpenChange={setAddReplyDialog}>
                <DialogContent className="bg-slate-950/95 border border-slate-800 backdrop-blur-xl">
                    <DialogHeader>
                        <DialogTitle className="text-white text-xl">Add Reply</DialogTitle>
                    </DialogHeader>
                    <Textarea
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        placeholder="Type your response..."
                        className="bg-slate-900 border-slate-700 min-h-[150px] text-white focus:border-blue-500 mt-4"
                    />
                    <DialogFooter className="mt-4 gap-2">
                        <Button variant="ghost" onClick={() => setAddReplyDialog(false)} className="text-white hover:text-slate-200 font-medium">Cancel</Button>
                        <Button onClick={submitReply} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6">
                            <Send className="w-4 h-4 mr-2" />
                            Send Reply
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
