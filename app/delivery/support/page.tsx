'use client';

import React, { useState } from 'react';
import { useDeliveryAuth } from '@/context/DeliveryAuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Phone, Mail, MessageSquare, Send, HelpCircle, ChevronRight } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { Loader } from '@/components/ui/spinner';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

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

    return (
        <div className="p-4 md:p-8 space-y-8 max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-violet-600 p-4 sm:p-6 rounded-3xl shadow-2xl shadow-purple-900/30 mb-6">
                    <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 via-transparent to-violet-500/20 animate-pulse" />
                    <div className="relative z-10">
                        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight drop-shadow-lg">💬 Help & Support</h1>
                        <p className="text-white/90 mt-1 font-medium">Get assistance with your delivery account or orders.</p>
                    </div>
                </div>
                <Button variant="outline" className="border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800 gap-2">
                    <Phone className="w-4 h-4" /> Call Hotline
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Contact & Form */}
                <div className="space-y-6">
                    <Card className="bg-gray-900 border-gray-800 text-white shadow-xl">
                        <CardHeader>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-blue-600/10 rounded-lg text-blue-500">
                                    <Send className="w-5 h-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg">Submit a Ticket</CardTitle>
                                    <CardDescription className="text-gray-400">Describe your issue and we'll reply via email.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-300">Subject</label>
                                    <Input
                                        value={subject}
                                        onChange={(e) => setSubject(e.target.value)}
                                        placeholder="e.g. Payment Issue"
                                        className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:ring-blue-500/50 focus:border-blue-500"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-300">Message</label>
                                    <Textarea
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        placeholder="Describe your issue in detail..."
                                        className="min-h-[150px] bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:ring-blue-500/50 focus:border-blue-500"
                                    />
                                </div>
                                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11" disabled={sending}>
                                    {sending ? <Loader className="w-4 h-4 mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                                    {sending ? 'Sending...' : 'Send Ticket'}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card className="bg-gray-900/50 border-gray-800 text-white hover:bg-gray-900/80 transition-colors cursor-pointer">
                            <CardContent className="p-6 flex items-center gap-4">
                                <div className="p-3 bg-green-600/10 rounded-full text-green-500">
                                    <Phone className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="font-bold">Emergency</p>
                                    <p className="text-xs text-gray-400">+1 (800) 123-4567</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-gray-900/50 border-gray-800 text-white hover:bg-gray-900/80 transition-colors cursor-pointer">
                            <CardContent className="p-6 flex items-center gap-4">
                                <div className="p-3 bg-purple-600/10 rounded-full text-purple-500">
                                    <Mail className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="font-bold">Email Us</p>
                                    <p className="text-xs text-gray-400">support@akr.com</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* FAQ */}
                <div className="space-y-6">
                    <Card className="bg-gray-900 border-gray-800 text-white shadow-xl h-full">
                        <CardHeader>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-orange-600/10 rounded-lg text-orange-500">
                                    <HelpCircle className="w-5 h-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg">Frequently Asked Questions</CardTitle>
                                    <CardDescription className="text-gray-400">Quick answers to common questions.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Accordion type="single" collapsible className="w-full">
                                <AccordionItem value="item-1" className="border-gray-800">
                                    <AccordionTrigger className="text-gray-200 hover:no-underline hover:text-white">How do I get paid?</AccordionTrigger>
                                    <AccordionContent className="text-gray-400">
                                        Payments are processed weekly on Mondays directly to your bank account. You can track your earnings in the Earnings tab.
                                    </AccordionContent>
                                </AccordionItem>
                                <AccordionItem value="item-2" className="border-gray-800">
                                    <AccordionTrigger className="text-gray-200 hover:no-underline hover:text-white">What if I can't complete a delivery?</AccordionTrigger>
                                    <AccordionContent className="text-gray-400">
                                        If you have an emergency, please contact the emergency hotline immediately. Frequent cancellations may affect your rating.
                                    </AccordionContent>
                                </AccordionItem>
                                <AccordionItem value="item-3" className="border-gray-800">
                                    <AccordionTrigger className="text-gray-200 hover:no-underline hover:text-white">How do I change my vehicle?</AccordionTrigger>
                                    <AccordionContent className="text-gray-400">
                                        Go to Settings {'>'} Vehicle Details to update your information. You may need to upload a new RC image.
                                    </AccordionContent>
                                </AccordionItem>
                                <AccordionItem value="item-4" className="border-gray-800">
                                    <AccordionTrigger className="text-gray-200 hover:no-underline hover:text-white">App is not tracking location?</AccordionTrigger>
                                    <AccordionContent className="text-gray-400">
                                        Ensure you have granted location permissions to the app and your GPS is enabled. Try restarting the app if the issue persists.
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
