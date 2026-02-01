'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageCircle, Phone, Mail, ChevronRight, FileText, HelpCircle } from 'lucide-react';

export default function SupportPage() {
    const faqs = [
        { q: "Where is my order?", a: "You can track your order in real-time from the 'Orders' page." },
        { q: "How do I cancel an order?", a: "You can cancel an order within 5 minutes of placing it from the order details page." },
        { q: "I have a payment issue", a: "Please check if the amount was deducted. If yes, it will be refunded within 5-7 business days." },
        { q: "Food quality was not good", a: "We are sorry to hear that. Please submit a ticket below and we will resolve it." },
    ];

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-40 sm:pb-20">
            <div className="max-w-3xl mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold mb-2">Help & Support</h1>
                <p className="text-muted-foreground mb-8">How can we help you today?</p>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <Card className="p-6 flex flex-col items-center text-center hover:shadow-md transition-shadow cursor-pointer bg-white dark:bg-gray-800 border-none">
                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                            <MessageCircle className="w-6 h-6" />
                        </div>
                        <h3 className="font-semibold mb-1">Live Chat</h3>
                        <p className="text-sm text-muted-foreground">Chat with our support team</p>
                    </Card>

                    <Card className="p-6 flex flex-col items-center text-center hover:shadow-md transition-shadow cursor-pointer bg-white dark:bg-gray-800 border-none">
                        <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                            <Phone className="w-6 h-6" />
                        </div>
                        <h3 className="font-semibold mb-1">Call Us</h3>
                        <p className="text-sm text-muted-foreground">Speak to an agent</p>
                    </Card>

                    <Card className="p-6 flex flex-col items-center text-center hover:shadow-md transition-shadow cursor-pointer bg-white dark:bg-gray-800 border-none">
                        <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mb-4">
                            <Mail className="w-6 h-6" />
                        </div>
                        <h3 className="font-semibold mb-1">Email Us</h3>
                        <p className="text-sm text-muted-foreground">Get help via email</p>
                    </Card>
                </div>

                {/* FAQ Section */}
                <div className="mb-8">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <HelpCircle className="w-5 h-5 text-gray-500" />
                        Frequently Asked Questions
                    </h2>
                    <div className="space-y-4">
                        {faqs.map((faq, i) => (
                            <Card key={i} className="p-6 border-none bg-white dark:bg-gray-800 hover:shadow-sm">
                                <h3 className="font-semibold text-lg mb-2">{faq.q}</h3>
                                <p className="text-muted-foreground">{faq.a}</p>
                            </Card>
                        ))}
                    </div>
                </div>

                {/* Create Ticket */}
                <Card className="p-6 bg-gradient-to-r from-gray-900 to-gray-800 text-white border-none">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-xl font-bold mb-1">Still need help?</h3>
                            <p className="text-gray-300">Submit a support ticket and we'll get back to you.</p>
                        </div>
                        <Button className="bg-white text-gray-900 hover:bg-gray-100">
                            <FileText className="w-4 h-4 mr-2" />
                            Create Ticket
                        </Button>
                    </div>
                </Card>

            </div>
        </div>
    );
}
