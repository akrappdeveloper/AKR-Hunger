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
import AIChatbot from '@/components/ai/AIChatbot';

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
            open: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
            in_progress: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
            resolved: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
            closed: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20'
        };
        return (
            <Badge variant="outline" className={`${styles[status as keyof typeof styles] || styles.open} uppercase text-[10px] tracking-wider font-semibold`}>
                {status.replace('_', ' ')}
            </Badge>
        );
    };

    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <Spinner className="w-8 h-8 text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground p-4 md:p-8 space-y-8 transition-colors duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 bg-clip-text text-transparent flex items-center gap-3 animate-in slide-in-from-left duration-500 drop-shadow-sm">
                        <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-rose-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20 text-white shrink-0">
                            <LifeBuoy className="w-7 h-7" />
                        </div>
                        Support Center
                    </h1>
                    <p className="text-muted-foreground mt-2 text-base sm:text-lg">We're here to help you succeed</p>
                </div>

                {activeTab === 'tickets' && (
                    <Button
                        onClick={() => setTicketDialogOpen(true)}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md font-semibold h-12 px-6 sm:px-8 rounded-full transition-all hover:scale-105"
                    >
                        <Bot className="w-5 h-5 mr-2" />
                        New Support Ticket
                    </Button>
                )}
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
                <TabsList className="bg-muted/80 border border-border p-1.5 h-auto rounded-full backdrop-blur-md w-full md:w-fit grid grid-cols-2 md:grid-cols-4 gap-2">
                    <TabsTrigger value="tickets" className="text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold rounded-full py-2.5 transition-all duration-300 hover:text-foreground">
                        <MessageSquare className="w-4 h-4 mr-2" /> Your Tickets
                    </TabsTrigger>
                    <TabsTrigger value="ai-chat" className="text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold rounded-full py-2.5 transition-all duration-300 hover:text-foreground">
                        <Sparkles className="w-4 h-4 mr-2" /> AI Assistant
                    </TabsTrigger>
                    <TabsTrigger value="faq" className="text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold rounded-full py-2.5 transition-all duration-300 hover:text-foreground">
                        <FileQuestion className="w-4 h-4 mr-2" /> FAQs
                    </TabsTrigger>
                    <TabsTrigger value="feedback" className="text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold rounded-full py-2.5 transition-all duration-300 hover:text-foreground">
                        <ThumbsUp className="w-4 h-4 mr-2" /> Feedback
                    </TabsTrigger>
                </TabsList>

                {/* --- TICKETS TAB --- */}
                <TabsContent value="tickets" className="space-y-6 focus-visible:outline-none">
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                        <div className="relative flex-1">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search all tickets..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 bg-card border-input text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary h-12 rounded-xl"
                            />
                        </div>
                        <div className="relative w-full md:w-48">
                            <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="w-full pl-10 pr-4 h-12 bg-card border border-input text-foreground rounded-xl appearance-none cursor-pointer focus:border-primary focus:outline-none"
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
                                <div className="py-20 text-center"><Spinner className="w-8 h-8 text-primary mx-auto" /></div>
                            ) : filteredTickets.length === 0 ? (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20 bg-card border border-border rounded-2xl border-dashed">
                                    <MessageSquare className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
                                    <h3 className="text-xl font-bold text-foreground">No tickets found</h3>
                                    <p className="text-muted-foreground mt-2">Create a new ticket to get started</p>
                                </motion.div>
                            ) : (
                                filteredTickets.map((ticket) => (
                                    <motion.div
                                        key={ticket.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        layout
                                    >
                                        <Card className="bg-card border-border text-card-foreground hover:bg-muted/40 transition-all group overflow-hidden shadow-sm">
                                            <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-orange-500 to-rose-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <CardContent className="p-6">
                                                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                                    <div className="flex-1 space-y-3">
                                                        <div className="flex flex-wrap items-center gap-3">
                                                            <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">{ticket.subject}</h3>
                                                            {getStatusBadge(ticket.status)}
                                                            {ticket.priority === 'urgent' && <Badge variant="destructive" className="animate-pulse">URGENT</Badge>}
                                                        </div>
                                                        <p className="text-muted-foreground line-clamp-2 text-sm">{ticket.description}</p>
                                                        <div className="flex flex-wrap items-center gap-4 text-muted-foreground text-xs mt-2">
                                                            <div className="flex items-center gap-1 bg-muted px-2.5 py-1 rounded-full text-foreground border border-border font-medium">
                                                                <Tag className="w-3 h-3 text-muted-foreground" /> {ticket.category}
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <Clock className="w-3.5 h-3.5" /> {new Date(ticket.createdAt).toLocaleDateString()}
                                                            </div>
                                                            <div className="flex items-center gap-1 text-primary font-semibold">
                                                                <MessageCircle className="w-3.5 h-3.5" /> {ticket.replies?.length || 0} Replies
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2 shrink-0">
                                                        <Button variant="outline" size="sm" onClick={() => { setSelectedTicket(ticket); setViewRepliesDialog(true); }} className="border-border hover:bg-muted text-foreground font-semibold">
                                                            View
                                                        </Button>
                                                        <Button size="sm" onClick={() => { setSelectedTicket(ticket); setAddReplyDialog(true); }} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm">
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
                <TabsContent value="ai-chat" className="focus-visible:outline-none">
                    <div className="space-y-4">
                        <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-between text-xs sm:text-sm">
                            <span className="flex items-center gap-2 font-medium text-foreground">
                                <Sparkles className="w-4 h-4 text-primary shrink-0" />
                                Instant answers for menu out-of-stock, quality scores, ad campaigns, live orders, and payouts!
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setActiveTab('tickets');
                                    setTicketDialogOpen(true);
                                }}
                                className="hidden sm:inline-flex text-xs font-bold border-primary/40 text-primary hover:bg-primary hover:text-white"
                            >
                                New Ticket
                            </Button>
                        </div>
                        <AIChatbot
                            initialRole="restaurant"
                            onOpenTicket={() => {
                                setActiveTab('tickets');
                                setTicketDialogOpen(true);
                            }}
                        />
                    </div>
                </TabsContent>

                {/* --- FAQ TAB --- */}
                <TabsContent value="faq" className="space-y-6 focus-visible:outline-none">
                    <Card className="bg-card border-border text-card-foreground p-6 shadow-sm">
                        <CardHeader className="px-0 pt-0">
                            <CardTitle className="text-2xl text-foreground font-bold">Frequently Asked Questions</CardTitle>
                            <CardDescription className="text-muted-foreground">Common questions about managing your restaurant.</CardDescription>
                        </CardHeader>
                        <Accordion type="single" collapsible className="w-full">
                            {[
                                { q: "How do I update my menu?", a: "Go to the 'Menu Management' tab. Click 'Add Item' to create new dishes or click the edit icon on existing items to change prices, descriptions, or images." },
                                { q: "When will I receive my payouts?", a: "Payouts are processed every Wednesday for the previous week's earnings. Ensure your bank details are correct in the Settings > Bank Account section." },
                                { q: "How can I temporarily close my restaurant?", a: "Use the toggle switch in the top right corner of your Dashboard or Settings page to switch your status to 'Offline'. Customers won't be able to place orders while you are offline." },
                                { q: "What should I do if an order is delayed?", a: "If preparation is taking longer than expected, use the 'Delay Order' button on the order card to notify the customer and delivery partner. Consistent delays may affect your rating." },
                                { q: "How do I respond to customer reviews?", a: "Navigate to the 'Reviews' section. You can reply to any review to thank customers or address concerns. Professional responses help build trust." }
                            ].map((faq, i) => (
                                <AccordionItem key={i} value={`item-${i}`} className="border-border">
                                    <AccordionTrigger className="text-foreground hover:text-primary text-left hover:no-underline font-semibold">{faq.q}</AccordionTrigger>
                                    <AccordionContent className="text-muted-foreground leading-relaxed">
                                        {faq.a}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </Card>
                </TabsContent>

                {/* --- FEEDBACK TAB --- */}
                <TabsContent value="feedback" className="max-w-2xl mx-auto focus-visible:outline-none">
                    <Card className="bg-card border-border text-card-foreground p-8 text-center relative overflow-hidden shadow-sm">
                        <div className="absolute inset-0 bg-gradient-to-b from-purple-500/5 to-transparent pointer-events-none" />
                        <h2 className="text-2xl font-bold text-foreground mb-2">Help Us Improve</h2>
                        <p className="text-muted-foreground mb-8">We value your input! Tell us how we can make the platform better for you.</p>

                        <div className="flex justify-center gap-6 mb-8">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    onClick={() => setRating(star)}
                                    className={`text-4xl transition-all duration-300 hover:scale-125 ${rating && rating >= star ? 'grayscale-0 scale-110' : 'grayscale opacity-30 hover:opacity-100'}`}
                                >
                                    {star === 1 ? '😠' : star === 2 ? '😟' : star === 3 ? '😐' : star === 4 ? '🙂' : '😍'}
                                </button>
                            ))}
                        </div>

                        <Textarea
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            placeholder="Share your thoughts, bugs, or feature requests..."
                            className="bg-card border-input text-foreground placeholder:text-muted-foreground min-h-[150px] mb-6 focus:border-primary"
                        />

                        <Button
                            onClick={submitFeedback}
                            disabled={submittingFeedback || !rating}
                            className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground text-lg font-semibold shadow-md"
                        >
                            {submittingFeedback ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Submit Feedback'}
                        </Button>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* --- DIALOGS --- */}

            <Dialog open={ticketDialogOpen} onOpenChange={setTicketDialogOpen}>
                <DialogContent className="max-w-xl bg-card border-border text-card-foreground backdrop-blur-xl shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold text-foreground">Create Support Ticket</DialogTitle>
                        <DialogDescription className="text-muted-foreground">Describe your issue clearly for faster resolution.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-2">
                        <div className="space-y-2">
                            <Label className="text-foreground font-medium">Subject</Label>
                            <Input
                                value={newTicket.subject}
                                onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                                className="bg-card border-input text-foreground placeholder:text-muted-foreground focus:border-primary"
                                placeholder="e.g., Payment issue for Order #123"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-foreground font-medium">Category</Label>
                                <select
                                    className="w-full h-10 rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
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
                                <Label className="text-foreground font-medium">Priority</Label>
                                <select
                                    className="w-full h-10 rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
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
                            <Label className="text-foreground font-medium">Description</Label>
                            <Textarea
                                value={newTicket.description}
                                onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                                className="bg-card border-input min-h-[120px] text-foreground placeholder:text-muted-foreground focus:border-primary"
                                placeholder="Provide as much detail as possible..."
                            />
                        </div>
                    </div>
                    <DialogFooter className="mt-4 gap-2">
                        <Button variant="outline" onClick={() => setTicketDialogOpen(false)} className="border-border text-foreground hover:bg-muted font-medium">Cancel</Button>
                        <Button onClick={handleSubmitTicket} disabled={submittingTicket} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md border-0">
                            {submittingTicket && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Submit Ticket
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={ticketSuccessDialog} onOpenChange={setTicketSuccessDialog}>
                <DialogContent className="max-w-sm bg-card border-border text-card-foreground text-center pt-10 backdrop-blur-xl shadow-xl">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/30"
                    >
                        <CheckCircle className="w-8 h-8 text-emerald-500" />
                    </motion.div>
                    <DialogTitle className="text-xl text-foreground font-bold">Ticket Submitted!</DialogTitle>
                    <DialogDescription className="text-muted-foreground mt-2">
                        We've received your request and will get back to you shortly.
                    </DialogDescription>
                    <Button onClick={() => setTicketSuccessDialog(false)} className="mt-6 w-full bg-muted hover:bg-muted/80 text-foreground border border-border font-semibold">
                        Close
                    </Button>
                </DialogContent>
            </Dialog>

            {/* View/Reply Dialogs */}
            <Dialog open={viewRepliesDialog} onOpenChange={setViewRepliesDialog}>
                <DialogContent className="max-w-2xl bg-card border-border text-card-foreground h-[80vh] flex flex-col backdrop-blur-xl shadow-2xl">
                    <DialogHeader className="border-b border-border pb-4">
                        <DialogTitle className="text-foreground flex items-center gap-3 text-xl font-bold">
                            <MessageSquare className="w-5 h-5 text-muted-foreground" />
                            {selectedTicket?.subject}
                            {selectedTicket && getStatusBadge(selectedTicket.status)}
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Ticket ID: <span className="font-mono text-foreground font-medium">{selectedTicket?.id}</span>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto space-y-6 p-6 bg-muted/30 rounded-lg custom-scrollbar my-4">
                        <div className="bg-card p-5 rounded-xl border border-border">
                            <p className="text-xs text-primary font-bold mb-2 uppercase tracking-wider flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                                Original Request
                            </p>
                            <p className="text-foreground leading-relaxed text-sm">{selectedTicket?.description}</p>
                        </div>

                        {selectedTicket?.replies?.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground">No replies yet.</div>
                        )}

                        {selectedTicket?.replies?.map((reply, i) => (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                                key={i}
                                className={`p-5 rounded-2xl max-w-[85%] shadow-sm ${reply.userType === 'admin'
                                    ? 'bg-blue-500/10 border border-blue-500/30 text-card-foreground ml-auto'
                                    : 'bg-card border border-border text-card-foreground'
                                    }`}
                            >
                                <div className="flex justify-between items-center mb-2">
                                    <span className={`text-xs font-bold uppercase tracking-wider ${reply.userType === 'admin' ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'}`}>
                                        {reply.userName || (reply.userType === 'admin' ? 'Support Team' : 'You')}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">{new Date(reply.createdAt).toLocaleString()}</span>
                                </div>
                                <p className="text-foreground text-sm whitespace-pre-wrap leading-relaxed">{reply.message}</p>
                            </motion.div>
                        ))}
                    </div>
                    <DialogFooter className="gap-3 pt-2 border-t border-border">
                        <Button variant="outline" className="flex-1 border-border text-foreground hover:bg-muted font-medium" onClick={() => setViewRepliesDialog(false)}>
                            Close
                        </Button>
                        <Button onClick={() => { setViewRepliesDialog(false); setAddReplyDialog(true); }} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md font-semibold">
                            <Reply className="w-4 h-4 mr-2" />
                            Add Reply
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={addReplyDialog} onOpenChange={setAddReplyDialog}>
                <DialogContent className="bg-card border-border text-card-foreground backdrop-blur-xl shadow-xl">
                    <DialogHeader>
                        <DialogTitle className="text-foreground text-xl font-bold">Add Reply</DialogTitle>
                    </DialogHeader>
                    <Textarea
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        placeholder="Type your response..."
                        className="bg-card border-input min-h-[150px] text-foreground placeholder:text-muted-foreground focus:border-primary mt-4"
                    />
                    <DialogFooter className="mt-4 gap-2">
                        <Button variant="ghost" onClick={() => setAddReplyDialog(false)} className="text-muted-foreground hover:text-foreground font-medium">Cancel</Button>
                        <Button onClick={submitReply} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6">
                            <Send className="w-4 h-4 mr-2" />
                            Send Reply
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
