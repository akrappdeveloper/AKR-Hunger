'use client';

import React, { useState } from 'react';
import { useDeliveryAuth } from '@/context/DeliveryAuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Phone,
    Mail,
    MessageSquare,
    Send,
    HelpCircle,
    ChevronRight,
    LifeBuoy,
    Bot,
    Sparkles,
    ShieldAlert,
    Clock,
    FileText
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { Loader } from '@/components/ui/spinner';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { motion } from 'framer-motion';
import AIChatbot from '@/components/ai/AIChatbot';

export default function DeliverySupportPage() {
    const { user } = useDeliveryAuth();
    const [activeTab, setActiveTab] = useState<'ai-chat' | 'ticket' | 'faq'>('ai-chat');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        if (!subject.trim() || !message.trim()) {
            toast.error("Please fill in all fields.");
            return;
        }

        setSending(true);
        try {
            await addDoc(collection(db, 'supportTickets'), {
                userId: user.uid,
                userType: 'delivery',
                userName: user.displayName || 'Delivery Partner',
                userEmail: user.email || 'delivery@akrhunger.com',
                subject: subject.trim(),
                description: message.trim(),
                category: 'order',
                priority: 'medium',
                status: 'open',
                createdAt: new Date(),
                replies: []
            });
            toast.success("Support ticket created! Admin team will respond shortly.");
            setSubject('');
            setMessage('');
        } catch (error) {
            console.error("Error creating ticket:", error);
            toast.error("Failed to submit ticket.");
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="p-4 md:p-8 space-y-8 max-w-6xl mx-auto pb-24 md:pb-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight drop-shadow-xl flex items-center gap-3">
                        <LifeBuoy className="w-8 h-8 text-red-500" />
                        Rider Support & AI Center
                    </h1>
                    <p className="text-gray-400 font-medium ml-1 text-sm sm:text-base">
                        24/7 AI Assistant, Marketplace questions, Monday payouts, and emergency dispatch.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <a href="tel:+916393752013">
                        <Button
                            variant="outline"
                            className="border-red-500/30 text-red-400 hover:text-white hover:bg-red-600 hover:border-red-600 gap-2 rounded-xl backdrop-blur-md bg-red-500/5 group transition-all duration-300 font-bold"
                        >
                            <Phone className="w-4 h-4 group-hover:animate-bounce" /> Emergency Hotline (+91 6393752013)
                        </Button>
                    </a>
                </div>
            </div>

            {/* Tabs for Support Features */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-6">
                <TabsList className="bg-white/5 border border-white/10 p-1.5 rounded-full backdrop-blur-md w-full sm:w-auto grid grid-cols-3 sm:inline-flex gap-1">
                    <TabsTrigger
                        value="ai-chat"
                        className="rounded-full px-5 py-2.5 font-bold text-xs sm:text-sm data-[state=active]:bg-red-600 data-[state=active]:text-white text-gray-300"
                    >
                        <Bot className="w-4 h-4 mr-2" /> AI Assistant
                    </TabsTrigger>
                    <TabsTrigger
                        value="ticket"
                        className="rounded-full px-5 py-2.5 font-bold text-xs sm:text-sm data-[state=active]:bg-red-600 data-[state=active]:text-white text-gray-300"
                    >
                        <FileText className="w-4 h-4 mr-2" /> Submit Ticket
                    </TabsTrigger>
                    <TabsTrigger
                        value="faq"
                        className="rounded-full px-5 py-2.5 font-bold text-xs sm:text-sm data-[state=active]:bg-red-600 data-[state=active]:text-white text-gray-300"
                    >
                        <HelpCircle className="w-4 h-4 mr-2" /> FAQs & Help
                    </TabsTrigger>
                </TabsList>

                {/* AI Chat Assistant Tab */}
                <TabsContent value="ai-chat" className="focus-visible:outline-none space-y-4">
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-between text-xs sm:text-sm text-gray-200">
                        <span className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-red-400 shrink-0" />
                            Ask anything about Marketplace orders, status progression, vehicle updates, and earnings!
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setActiveTab('ticket')}
                            className="hidden sm:inline-flex text-xs font-bold border-red-500/40 text-red-400 hover:bg-red-600 hover:text-white"
                        >
                            Open Ticket
                        </Button>
                    </div>

                    <AIChatbot
                        initialRole="delivery"
                        onOpenTicket={() => setActiveTab('ticket')}
                        className="bg-black/60 border-white/10 text-white shadow-2xl backdrop-blur-xl"
                    />
                </TabsContent>

                {/* Submit Ticket Tab */}
                <TabsContent value="ticket" className="focus-visible:outline-none">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <Card className="bg-black/40 border-white/10 backdrop-blur-xl shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-[80px]" />
                            <CardHeader>
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500 border border-blue-500/20 shadow-inner">
                                        <Send className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-xl text-white">Submit a Support Ticket</CardTitle>
                                        <CardDescription className="text-gray-400">Describe your issue and we'll reply via email and dashboard.</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="relative z-10">
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-300 ml-1">Subject</label>
                                        <Input
                                            value={subject}
                                            onChange={(e) => setSubject(e.target.value)}
                                            placeholder="e.g. Payment Issue or Missing Distance Pay"
                                            className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:ring-blue-500 focus:border-blue-500 rounded-xl h-11"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-300 ml-1">Message</label>
                                        <Textarea
                                            value={message}
                                            onChange={(e) => setMessage(e.target.value)}
                                            placeholder="Describe your issue with Order ID, dates, or payment details..."
                                            className="min-h-[160px] bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:ring-blue-500 focus:border-blue-500 rounded-xl resize-none"
                                        />
                                    </div>
                                    <div className="pt-2">
                                        <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 rounded-xl shadow-lg shadow-blue-900/40" disabled={sending}>
                                            {sending ? <Loader className="w-5 h-5 mr-2" /> : <Send className="w-5 h-5 mr-2" />}
                                            {sending ? 'Sending Ticket...' : 'Send Ticket'}
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>

                        <div className="space-y-4">
                            <motion.div whileHover={{ y: -4 }}>
                                <Card className="bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/20 hover:border-green-500/40 transition-all backdrop-blur-sm group">
                                    <CardContent className="p-6 flex items-center gap-4">
                                        <div className="p-3 bg-green-500/20 rounded-full text-green-400 group-hover:scale-110 transition-transform">
                                            <Phone className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-white text-lg">24/7 Rider Helpline</p>
                                            <p className="text-xs text-gray-400 font-mono">+1 (800) 123-4567</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>

                            <motion.div whileHover={{ y: -4 }}>
                                <Card className="bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/20 hover:border-purple-500/40 transition-all backdrop-blur-sm group">
                                    <CardContent className="p-6 flex items-center gap-4">
                                        <div className="p-3 bg-purple-500/20 rounded-full text-purple-400 group-hover:scale-110 transition-transform">
                                            <Mail className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-white text-lg">Partner Operations Email</p>
                                            <p className="text-xs text-gray-400 font-mono">hunger@gmail.com</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>

                            <Card className="bg-white/5 border-white/10 p-5 rounded-2xl text-xs text-gray-300 space-y-2">
                                <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                                    <Clock className="w-4 h-4 text-red-400" /> Response Time Guarantee
                                </h4>
                                <p className="text-gray-400 leading-relaxed">
                                    Support tickets are processed by our dedicated rider logistics team within 30 minutes. Emergency accident or safety calls on the hotline are attended instantly.
                                </p>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {/* FAQ Tab */}
                <TabsContent value="faq" className="focus-visible:outline-none">
                    <Card className="bg-black/40 border-white/10 backdrop-blur-xl shadow-2xl relative overflow-hidden">
                        <div className="absolute bottom-0 right-0 w-64 h-64 bg-orange-600/10 rounded-full blur-[80px]" />
                        <CardHeader>
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-orange-500/10 rounded-2xl text-orange-500 border border-orange-500/20 shadow-inner">
                                    <HelpCircle className="w-6 h-6" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl text-white">Frequently Asked Questions</CardTitle>
                                    <CardDescription className="text-gray-400">Everything you need to know about deliveries, pay, and rules.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4 relative z-10">
                            <Accordion type="single" collapsible className="w-full space-y-2">
                                {[
                                    { q: "When do orders show up in the Available Marketplace?", a: "Orders appear in Marketplace (/delivery/available) when the restaurant has confirmed the order (status: confirmed, preparing, or ready) AND no other delivery partner has accepted it yet (deliveryPersonId is null)." },
                                    { q: "How and when do I get paid?", a: "Earnings include base fee per order + distance pay + 100% customer tips + surge incentives. Payouts are transferred automatically to your verified bank account every Monday." },
                                    { q: "What is the exact delivery status progression?", a: "Accept from Marketplace -> Reach Restaurant -> Pick Up Food (status becomes out_for_delivery) -> Reach Customer -> Mark as Delivered (status becomes delivered)." },
                                    { q: "What should I do if I get into an accident or vehicle breakdown?", a: "Pull over safely and dial our 24/7 Hotline +1 (800) 123-4567 immediately. We will unassign the order to a nearby driver so your rating is unaffected." },
                                    { q: "How do I update my vehicle or upload a new RC?", a: "Go to Settings > Vehicle Details. Select your vehicle type (Bike, Scooter, EV, Bicycle), input your registration number, and upload clear photos of your RC and Driving License." },
                                    { q: "Customer is unreachable at the delivery address?", a: "Attempt calling the customer twice and wait for at least 10 minutes. If there is still no response, notify support through the app to record the delivery appropriately." }
                                ].map((item, i) => (
                                    <AccordionItem key={i} value={`item-${i}`} className="border border-white/5 bg-white/5 rounded-xl px-4">
                                        <AccordionTrigger className="text-gray-200 hover:no-underline hover:text-white font-medium py-4 text-left">
                                            {item.q}
                                        </AccordionTrigger>
                                        <AccordionContent className="text-gray-400 pb-4 leading-relaxed border-t border-white/5 pt-2 mt-2">
                                            {item.a}
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
