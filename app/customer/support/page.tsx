'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    MessageCircle,
    Phone,
    Mail,
    FileText,
    HelpCircle,
    Bot,
    Sparkles,
    Send,
    CheckCircle2,
    LifeBuoy
} from 'lucide-react';
import AIChatbot from '@/components/ai/AIChatbot';
import { useAuth } from '@/context/AuthContext';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';

export default function CustomerSupportPage() {
    const { user, customer } = useAuth();
    const [activeTab, setActiveTab] = useState<'ai-chat' | 'faq' | 'ticket'>('ai-chat');

    // Ticket dialog & form state
    const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
    const [ticketSubmitting, setTicketSubmitting] = useState(false);
    const [ticketSubject, setTicketSubject] = useState('');
    const [ticketCategory, setTicketCategory] = useState<'order' | 'refund' | 'payment' | 'delivery' | 'other'>('order');
    const [ticketDescription, setTicketDescription] = useState('');

    const faqs = [
        { q: "Where is my order and how do I track it?", a: "Go to the 'Orders' tab to view live tracking, kitchen preparation progress, and rider GPS location." },
        { q: "How do I cancel an order?", a: "You can cancel free of charge within 5 minutes of placing it from the order details page before preparation starts." },
        { q: "When will I get my refund?", a: "Refunds to AKR Wallet are instant! Refunds to bank cards or UPI take 5-7 business days via Razorpay." },
        { q: "Food quality or missing item issue?", a: "We apologize for the inconvenience! Ask our AI Assistant or submit a support ticket below with order details for immediate resolution." },
        { q: "How do loyalty reward points work?", a: "You earn loyalty reward points on every order placed on AKR Hunger. Points can be redeemed for instant discounts during checkout." },
    ];

    const handleSubmitTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!ticketSubject.trim() || !ticketDescription.trim()) {
            toast.error("Please fill in both subject and description.");
            return;
        }

        try {
            setTicketSubmitting(true);
            await addDoc(collection(db, 'supportTickets'), {
                userId: user?.uid || 'guest',
                userType: 'customer',
                userName: customer?.name || user?.displayName || 'Customer',
                userEmail: customer?.email || user?.email || 'customer@akrhunger.com',
                subject: ticketSubject.trim(),
                category: ticketCategory,
                priority: 'medium',
                description: ticketDescription.trim(),
                status: 'open',
                createdAt: new Date(),
                replies: []
            });

            toast.success("Support ticket submitted! Our team will respond shortly.");
            setTicketSubject('');
            setTicketDescription('');
            setTicketDialogOpen(false);
        } catch (error) {
            console.error("Error creating ticket:", error);
            toast.error("Failed to submit ticket. Please try again.");
        } finally {
            setTicketSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen text-foreground pb-24 md:pb-16 font-sans">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                {/* Header */}
                <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="p-2 bg-primary/10 rounded-xl text-primary">
                                <LifeBuoy className="w-6 h-6" />
                            </span>
                            <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                                Help & Support Center
                            </h1>
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                            Instant answers powered by AI, order assistance, refunds, and 24/7 support.
                        </p>
                    </div>

                    <Button
                        onClick={() => setTicketDialogOpen(true)}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-md self-start sm:self-auto"
                    >
                        <FileText className="w-4 h-4 mr-2" />
                        Create Ticket
                    </Button>
                </div>

                {/* Quick Action Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                    <Card
                        onClick={() => setActiveTab('ai-chat')}
                        className={`p-5 sm:p-6 flex flex-col items-center text-center transition-all cursor-pointer rounded-2xl border ${
                            activeTab === 'ai-chat'
                                ? 'border-primary bg-primary/5 shadow-md'
                                : 'border-border/60 bg-card hover:border-primary/40 hover:shadow-xs'
                        }`}
                    >
                        <div className="w-12 h-12 bg-sky-500/15 text-sky-600 dark:text-sky-400 rounded-2xl flex items-center justify-center mb-3">
                            <Bot className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-base mb-1 text-foreground flex items-center gap-1.5">
                            AI Chat Assistant
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        </h3>
                        <p className="text-xs text-muted-foreground">Instant answers for orders, refunds & tracking</p>
                    </Card>

                    <a
                        href="tel:+18001234567"
                        className="block"
                    >
                        <Card className="p-5 sm:p-6 flex flex-col items-center text-center hover:shadow-md hover:border-primary/40 transition-all cursor-pointer bg-card border border-border/60 text-card-foreground rounded-2xl h-full">
                            <div className="w-12 h-12 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mb-3">
                                <Phone className="w-6 h-6" />
                            </div>
                            <h3 className="font-bold text-base mb-1 text-foreground">Emergency Call</h3>
                            <p className="text-xs text-muted-foreground">+1 (800) 123-4567 (Direct Hotline)</p>
                        </Card>
                    </a>

                    <a
                        href="mailto:support@akrhunger.com"
                        className="block"
                    >
                        <Card className="p-5 sm:p-6 flex flex-col items-center text-center hover:shadow-md hover:border-primary/40 transition-all cursor-pointer bg-card border border-border/60 text-card-foreground rounded-2xl h-full">
                            <div className="w-12 h-12 bg-amber-500/15 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mb-3">
                                <Mail className="w-6 h-6" />
                            </div>
                            <h3 className="font-bold text-base mb-1 text-foreground">Email Support</h3>
                            <p className="text-xs text-muted-foreground">support@akrhunger.com</p>
                        </Card>
                    </a>
                </div>

                {/* Tabs for Support */}
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-6">
                    <TabsList className="bg-muted/80 border border-border p-1.5 rounded-full backdrop-blur-md w-full sm:w-auto grid grid-cols-2 sm:inline-flex gap-1">
                        <TabsTrigger
                            value="ai-chat"
                            className="rounded-full px-5 py-2 font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                        >
                            <Bot className="w-4 h-4 mr-2" /> AI Support Assistant
                        </TabsTrigger>
                        <TabsTrigger
                            value="faq"
                            className="rounded-full px-5 py-2 font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                        >
                            <HelpCircle className="w-4 h-4 mr-2" /> FAQs
                        </TabsTrigger>
                    </TabsList>

                    {/* AI Chatbot Tab */}
                    <TabsContent value="ai-chat" className="focus-visible:outline-none">
                        <div className="space-y-4">
                            <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-between text-xs sm:text-sm">
                                <span className="flex items-center gap-2 font-medium text-foreground">
                                    <Sparkles className="w-4 h-4 text-primary shrink-0" />
                                    Ask anything! Our AI knows details for Customer, Delivery, and Restaurant flows.
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setTicketDialogOpen(true)}
                                    className="hidden sm:inline-flex text-xs font-bold border-primary/40 text-primary hover:bg-primary hover:text-white"
                                >
                                    Raise Ticket
                                </Button>
                            </div>

                            <AIChatbot
                                initialRole="customer"
                                onOpenTicket={() => setTicketDialogOpen(true)}
                            />
                        </div>
                    </TabsContent>

                    {/* FAQ Tab */}
                    <TabsContent value="faq" className="space-y-4 focus-visible:outline-none">
                        <div className="space-y-3.5">
                            {faqs.map((faq, i) => (
                                <Card key={i} className="p-5 border border-border/60 bg-card text-card-foreground hover:shadow-xs rounded-2xl transition-all">
                                    <h3 className="font-bold text-base mb-1 text-foreground flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0 font-black">
                                            Q
                                        </span>
                                        {faq.q}
                                    </h3>
                                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed pl-8">
                                        {faq.a}
                                    </p>
                                </Card>
                            ))}
                        </div>
                    </TabsContent>
                </Tabs>

                {/* Create Ticket Dialog */}
                <Dialog open={ticketDialogOpen} onOpenChange={setTicketDialogOpen}>
                    <DialogContent className="max-w-lg bg-card border-border text-card-foreground">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-bold flex items-center gap-2">
                                <FileText className="w-5 h-5 text-primary" /> Submit a Support Ticket
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground">
                                Our support team will review your inquiry and reply within 30 minutes.
                            </DialogDescription>
                        </DialogHeader>

                        <form onSubmit={handleSubmitTicket} className="space-y-4 mt-2">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-foreground">Category</label>
                                <select
                                    value={ticketCategory}
                                    onChange={(e) => setTicketCategory(e.target.value as any)}
                                    className="w-full h-10 px-3 rounded-xl bg-muted/50 border border-input text-foreground text-xs focus:ring-primary focus:border-primary"
                                >
                                    <option value="order">Order Tracking & Delay</option>
                                    <option value="refund">Cancellation & Refund</option>
                                    <option value="payment">Payment / Wallet Issue</option>
                                    <option value="delivery">Delivery Partner Dispute</option>
                                    <option value="other">Food Quality / General</option>
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-foreground">Subject</label>
                                <Input
                                    value={ticketSubject}
                                    onChange={(e) => setTicketSubject(e.target.value)}
                                    placeholder="Brief summary of your issue..."
                                    className="text-xs bg-muted/50"
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-foreground">Description</label>
                                <Textarea
                                    value={ticketDescription}
                                    onChange={(e) => setTicketDescription(e.target.value)}
                                    placeholder="Provide details like Order ID, items, or screenshots description..."
                                    rows={4}
                                    className="text-xs bg-muted/50 resize-none"
                                    required
                                />
                            </div>

                            <DialogFooter className="gap-2 sm:gap-0 mt-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setTicketDialogOpen(false)}
                                    className="rounded-xl text-xs"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={ticketSubmitting}
                                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-xs"
                                >
                                    {ticketSubmitting ? 'Submitting...' : 'Submit Ticket'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
