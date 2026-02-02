'use client';

import React, { useState } from 'react';
import { useDeliveryAuth } from '@/context/DeliveryAuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Phone, Mail, MessageSquare, Send, HelpCircle, ChevronRight, LifeBuoy } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { Loader } from '@/components/ui/spinner';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { motion } from 'framer-motion';

export default function DeliverySupportPage() {
    const { user } = useDeliveryAuth();
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
            await addDoc(collection(db, 'support_tickets'), {
                userId: user.uid,
                userType: 'delivery_partner',
                subject,
                message,
                status: 'open',
                createdAt: serverTimestamp(),
                userEmail: user.email
            });
            toast.success("Support ticket created!");
            setSubject('');
            setMessage('');
        } catch (error) {
            console.error("Error creating ticket:", error);
            toast.error("Failed to submit ticket.");
        } finally {
            setSending(false);
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: { y: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 100 } }
    };

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="p-4 md:p-8 space-y-8 max-w-6xl mx-auto pb-24 md:pb-8"
        >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <motion.div variants={itemVariants}>
                    <h1 className="text-4xl font-black text-white tracking-tight drop-shadow-xl flex items-center gap-3">
                        <LifeBuoy className="w-8 h-8 text-red-500" />
                        Help & Support
                    </h1>
                    <p className="text-gray-400 font-medium ml-1">We're here to help you around the clock.</p>
                </motion.div>

                <motion.div variants={itemVariants}>
                    <Button variant="outline" className="border-red-500/30 text-red-400 hover:text-white hover:bg-red-600 hover:border-red-600 gap-2 rounded-xl backdrop-blur-md bg-red-500/5 group transition-all duration-300">
                        <Phone className="w-4 h-4 group-hover:animate-bounce" /> Emergency Hotline
                    </Button>
                </motion.div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Contact & Form */}
                <motion.div variants={itemVariants} className="space-y-6">
                    <Card className="bg-black/40 border-white/10 backdrop-blur-xl shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-[80px]" />
                        <CardHeader>
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500 border border-blue-500/20 shadow-inner">
                                    <Send className="w-6 h-6" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl text-white">Submit a Ticket</CardTitle>
                                    <CardDescription className="text-gray-400">Describe your issue and we'll reply via email.</CardDescription>
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
                                        placeholder="e.g. Payment Issue"
                                        className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:ring-blue-500 focus:border-blue-500 rounded-xl h-11"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-300 ml-1">Message</label>
                                    <Textarea
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        placeholder="Describe your issue in detail..."
                                        className="min-h-[160px] bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:ring-blue-500 focus:border-blue-500 rounded-xl resize-none"
                                    />
                                </div>
                                <div className="pt-2">
                                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 rounded-xl shadow-lg shadow-blue-900/40" disabled={sending}>
                                        {sending ? <Loader className="w-5 h-5 mr-2" /> : <Send className="w-5 h-5 mr-2" />}
                                        {sending ? 'Sending...' : 'Send Ticket'}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <motion.div whileHover={{ y: -5 }} className="cursor-pointer">
                            <Card className="bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/20 hover:border-green-500/40 transition-all backdrop-blur-sm group h-full">
                                <CardContent className="p-6 flex items-center gap-4">
                                    <div className="p-3 bg-green-500/20 rounded-full text-green-400 group-hover:scale-110 transition-transform">
                                        <Phone className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-white text-lg">Support</p>
                                        <p className="text-xs text-gray-400 font-mono">+1 (800) 123-4567</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                        <motion.div whileHover={{ y: -5 }} className="cursor-pointer">
                            <Card className="bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/20 hover:border-purple-500/40 transition-all backdrop-blur-sm group h-full">
                                <CardContent className="p-6 flex items-center gap-4">
                                    <div className="p-3 bg-purple-500/20 rounded-full text-purple-400 group-hover:scale-110 transition-transform">
                                        <Mail className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-white text-lg">Email Us</p>
                                        <p className="text-xs text-gray-400 font-mono">support@akr.com</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </div>
                </motion.div>

                {/* FAQ */}
                <motion.div variants={itemVariants} className="h-full">
                    <Card className="bg-black/40 border-white/10 backdrop-blur-xl shadow-2xl h-full flex flex-col relative overflow-hidden">
                        <div className="absolute bottom-0 right-0 w-64 h-64 bg-orange-600/10 rounded-full blur-[80px]" />
                        <CardHeader>
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-orange-500/10 rounded-2xl text-orange-500 border border-orange-500/20 shadow-inner">
                                    <HelpCircle className="w-6 h-6" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl text-white">FAQ</CardTitle>
                                    <CardDescription className="text-gray-400">Common questions answered.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4 flex-1 relative z-10">
                            <Accordion type="single" collapsible className="w-full space-y-2">
                                {[
                                    { q: "How do I get paid?", a: "Payments are processed weekly on Mondays directly to your bank account. You can track your earnings in the Earnings tab." },
                                    { q: "What if I can't complete a delivery?", a: "If you have an emergency, please contact the emergency hotline immediately. Frequent cancellations may affect your rating." },
                                    { q: "How do I change my vehicle?", a: "Go to Settings > Vehicle Details to update your information. You may need to upload a new RC image and wait for verification." },
                                    { q: "App is not tracking location?", a: "Ensure you have granted location permissions to the app and your GPS is enabled. Try restarting the app if the issue persists." },
                                    { q: "How to improve my rating?", a: "Be polite, punctual, and handle food with care. Quick deliveries and good communication with customers lead to more 5-star ratings." }
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
                </motion.div>
            </div>
        </motion.div>
    );
}
