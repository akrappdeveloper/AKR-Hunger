'use client';

import React, { useState, useEffect } from 'react';
import { useDeliveryAuth } from '@/context/DeliveryAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  LifeBuoy, Send, MessageSquare, Clock, CheckCircle2, AlertCircle,
  Wallet, Truck, FileText, Star, HelpCircle, Phone, Mail, ChevronRight,
  Plus, RefreshCw, Bot, Sparkles, ShieldAlert, Package, X
} from 'lucide-react';
import { db, realtimeDb } from '@/lib/firebase';
import { collection, addDoc, onSnapshot, query, where, orderBy, serverTimestamp, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import { ref as rtdbRef, set as rtdbSet, push as rtdbPush } from 'firebase/database';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const CATEGORIES = [
  { value: 'order', label: 'Order Issue', icon: Package, color: 'text-blue-400' },
  { value: 'payment', label: 'Payment / Wallet', icon: Wallet, color: 'text-emerald-400' },
  { value: 'delivery', label: 'Delivery Problem', icon: Truck, color: 'text-violet-400' },
  { value: 'kyc', label: 'KYC / Verification', icon: ShieldAlert, color: 'text-amber-400' },
  { value: 'rating', label: 'Rating / Review', icon: Star, color: 'text-yellow-400' },
  { value: 'account', label: 'Account Issue', icon: FileText, color: 'text-cyan-400' },
  { value: 'technical', label: 'App / Technical', icon: HelpCircle, color: 'text-rose-400' },
  { value: 'other', label: 'Other', icon: MessageSquare, color: 'text-gray-400' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  { value: 'medium', label: 'Medium', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  { value: 'high', label: 'High', color: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  open: { label: 'Open', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Clock },
  in_progress: { label: 'In Progress', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: RefreshCw },
  resolved: { label: 'Resolved', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 },
  closed: { label: 'Closed', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: X },
};

const FAQS = [
  { q: 'How do I go online and start receiving orders?', a: 'Go to Dashboard and toggle the "Go Online" switch at the top. Make sure your KYC is approved before going online.' },
  { q: 'Why am I not receiving orders?', a: 'Ensure: (1) KYC is approved, (2) You are marked as Online, (3) Wallet balance is not negative, (4) You are within a service zone.' },
  { q: 'How do I withdraw my earnings?', a: 'Go to Wallet → Withdraw. Minimum withdrawal is ₹100. Make sure your bank details are saved in Settings.' },
  { q: 'What happens if I reject too many orders?', a: 'Your acceptance rate drops which may affect your score and eligibility for bonuses. Try to maintain above 80%.' },
  { q: 'How is my rating calculated?', a: 'Your rating is the average of all customer ratings received. Deliver on time and be courteous to maintain a high rating.' },
  { q: 'How do I complete my KYC?', a: 'Go to Profile → KYC Docs tab. Upload all required documents (Aadhaar front/back, Driving License, Vehicle RC), then tap "Submit KYC for Verification".' },
  { q: 'My payment is pending, what should I do?', a: 'Payments are processed every 24-48 hours. If still pending after 72 hours, raise a support ticket with the order ID.' },
];

export default function DeliverySupportPage() {
  const { user, deliveryPartner } = useDeliveryAuth();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('order');
  const [priority, setPriority] = useState('medium');
  const [sending, setSending] = useState(false);
  const [myTickets, setMyTickets] = useState<any[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);

  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [sendingReplyId, setSendingReplyId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'supportTickets'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      setMyTickets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTicketsLoading(false);
    }, () => setTicketsLoading(false));
    return () => unsub();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!subject.trim() || !message.trim()) { toast.error('Please fill in all fields'); return; }
    setSending(true);
    try {
      const ticketDoc = await addDoc(collection(db, 'supportTickets'), {
        userId: user.uid,
        userType: 'delivery',
        userName: deliveryPartner?.name || user.displayName || 'Delivery Partner',
        userEmail: user.email || '',
        userPhone: deliveryPartner?.phone || '',
        subject: subject.trim(),
        description: message.trim(),
        category,
        priority,
        status: 'open',
        replies: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Dual-Sync to Firebase Realtime Database
      try {
        if (realtimeDb) {
          const ticketId = ticketDoc.id;
          const rtdbTicketRef = rtdbRef(realtimeDb, `deliverySupportTickets/${ticketId}`);
          await rtdbSet(rtdbTicketRef, {
            id: ticketId,
            userId: user.uid,
            userType: 'delivery',
            userName: deliveryPartner?.name || user.displayName || 'Delivery Partner',
            userEmail: user.email || '',
            userPhone: deliveryPartner?.phone || '',
            subject: subject.trim(),
            description: message.trim(),
            category,
            priority,
            status: 'open',
            createdAt: Date.now(),
            timestamp: new Date().toISOString(),
          });

          // Sync initial message into supportChats
          const chatMsgRef = rtdbRef(realtimeDb, `supportChats/${ticketId}/messages`);
          await rtdbPush(chatMsgRef, {
            id: `msg-${Date.now()}`,
            ticketId,
            userId: user.uid,
            userName: deliveryPartner?.name || user.displayName || 'Delivery Partner',
            userType: 'delivery',
            sender: 'user',
            text: message.trim(),
            message: message.trim(),
            createdAt: Date.now(),
            timestamp: new Date().toISOString(),
          });
        }
      } catch (rtdbErr) {
        console.warn('Realtime Database dual-sync note:', rtdbErr);
      }

      toast.success('Ticket raised successfully & synced in real-time!');
      setSubject(''); setMessage(''); setCategory('order'); setPriority('medium');
    } catch { toast.error('Failed to submit ticket. Please try again.'); }
    finally { setSending(false); }
  };

  const handleSendReply = async (ticketId: string) => {
    const text = (replyTextMap[ticketId] || '').trim();
    if (!text || !user) return;
    setSendingReplyId(ticketId);

    const newReply = {
      id: `reply-${Date.now()}`,
      ticketId,
      userId: user.uid,
      userName: deliveryPartner?.name || user.displayName || 'Delivery Partner',
      userType: 'delivery',
      sender: 'user',
      senderName: deliveryPartner?.name || user.displayName || 'Delivery Partner',
      text,
      message: text,
      createdAt: new Date(),
      timestamp: new Date().toISOString(),
    };

    try {
      // 1. Update in Firestore
      await updateDoc(doc(db, 'supportTickets', ticketId), {
        replies: arrayUnion(newReply),
        updatedAt: serverTimestamp(),
        status: 'open',
      });

      // 2. Dual-Sync to Realtime Database
      try {
        if (realtimeDb) {
          const chatMsgRef = rtdbRef(realtimeDb, `supportChats/${ticketId}/messages`);
          await rtdbPush(chatMsgRef, newReply);
        }
      } catch (_) { }

      setReplyTextMap(prev => ({ ...prev, [ticketId]: '' }));
      toast.success('Reply sent!');
    } catch (err: any) {
      toast.error('Failed to send reply: ' + err.message);
    } finally {
      setSendingReplyId(null);
    }
  };

  const catConfig = (cat: string) => CATEGORIES.find(c => c.value === cat) || CATEGORIES[7];

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto pb-28 md:pb-6 space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center">
              <LifeBuoy className="w-5 h-5 text-white" />
            </div>
            Help & Support
          </h1>
          <p className="text-gray-400 mt-1 text-sm">We're here to help. Raise a ticket or browse FAQs.</p>
        </div>
        <div className="flex gap-3">
          <a href="tel:+911234567890">
            <Button variant="outline" size="sm" className="border-white/10 text-gray-300 hover:text-white hover:bg-white/10 gap-2">
              <Phone className="w-4 h-4 text-emerald-400" /> Call Support
            </Button>
          </a>
          <a href="mailto:support@akrhunger.com">
            <Button variant="outline" size="sm" className="border-white/10 text-gray-300 hover:text-white hover:bg-white/10 gap-2">
              <Mail className="w-4 h-4 text-blue-400" /> Email Us
            </Button>
          </a>
        </div>
      </motion.div>

      <Tabs defaultValue="raise" className="w-full">
        <TabsList className="grid grid-cols-3 bg-white/5 border border-white/10 rounded-2xl p-1 h-auto">
          <TabsTrigger value="raise" className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-gray-900 text-gray-400 gap-2 py-2.5">
            <Plus className="w-4 h-4" /> Raise Ticket
          </TabsTrigger>
          <TabsTrigger value="tickets" className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-gray-900 text-gray-400 gap-2 py-2.5">
            <MessageSquare className="w-4 h-4" /> My Tickets
            {myTickets.filter(t => t.status === 'open').length > 0 && (
              <span className="bg-rose-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {myTickets.filter(t => t.status === 'open').length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="faq" className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-gray-900 text-gray-400 gap-2 py-2.5">
            <HelpCircle className="w-4 h-4" /> FAQ
          </TabsTrigger>
        </TabsList>

        {/* Raise Ticket Tab */}
        <TabsContent value="raise" className="mt-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            {/* Category Grid */}
            <div className="mb-5">
              <p className="text-gray-400 text-sm mb-3 font-medium">Select Issue Category</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {CATEGORIES.map(cat => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.value}
                      onClick={() => setCategory(cat.value)}
                      className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all text-sm font-medium ${category === cat.value ? 'bg-white/15 border-white/30 text-white shadow-lg' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'}`}
                    >
                      <Icon className={`w-4 h-4 flex-shrink-0 ${category === cat.value ? cat.color : 'text-gray-500'}`} />
                      <span className="truncate text-xs">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-gray-400 text-xs font-medium">Subject *</label>
                  <Input
                    placeholder="Brief description of your issue..."
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 rounded-xl"
                    maxLength={120}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-gray-400 text-xs font-medium">Priority</label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-white/10 text-white">
                      {PRIORITIES.map(p => (
                        <SelectItem key={p.value} value={p.value}>
                          <span className="flex items-center gap-2">{p.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-gray-400 text-xs font-medium">Describe your issue * <span className="text-gray-600">({message.length}/1000)</span></label>
                <Textarea
                  placeholder="Provide full details: order ID, date/time, what happened, what you expected..."
                  value={message}
                  onChange={e => setMessage(e.target.value.slice(0, 1000))}
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 resize-none rounded-xl min-h-32"
                  rows={5}
                />
              </div>
              <Button
                type="submit"
                disabled={sending || !subject.trim() || !message.trim()}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white gap-2 shadow-lg shadow-rose-500/20 disabled:opacity-50"
              >
                {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? 'Submitting...' : 'Submit Support Ticket'}
              </Button>
            </form>
          </motion.div>
        </TabsContent>

        {/* My Tickets Tab */}
        <TabsContent value="tickets" className="mt-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            {ticketsLoading ? (
              <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin text-gray-500" /></div>
            ) : myTickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 border border-dashed border-white/10 rounded-2xl bg-white/[0.02]">
                <MessageSquare className="w-12 h-12 text-gray-600 mb-3" />
                <p className="text-gray-400 font-medium">No tickets yet</p>
                <p className="text-gray-600 text-sm mt-1">Raise a ticket above if you need help</p>
              </div>
            ) : (
              myTickets.map(ticket => {
                const statusCfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
                const catCfg = catConfig(ticket.category);
                const CatIcon = catCfg.icon;
                const StatusIcon = statusCfg.icon;
                const isExpanded = expandedTicket === ticket.id;

                return (
                  <Card key={ticket.id} className="bg-white/5 border-white/10 rounded-2xl overflow-hidden">
                    <button className="w-full text-left" onClick={() => setExpandedTicket(isExpanded ? null : ticket.id)}>
                      <div className="flex items-center gap-3 p-4">
                        <div className={`w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0`}>
                          <CatIcon className={`w-5 h-5 ${catCfg.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold text-sm truncate">{ticket.subject}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={`text-[10px] border px-2 py-0 ${statusCfg.color}`}>
                              <StatusIcon className="w-2.5 h-2.5 mr-1" />{statusCfg.label}
                            </Badge>
                            <span className="text-gray-600 text-xs">
                              {ticket.createdAt?.toDate ? ticket.createdAt.toDate().toLocaleDateString() : 'N/A'}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className={`w-4 h-4 text-gray-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      </div>
                    </button>
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 pt-3 space-y-4 border-t border-white/5">
                            {/* Original issue description */}
                            <div className="bg-white/5 rounded-2xl p-3.5 border border-white/5">
                              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Issue Description</p>
                              <p className="text-gray-200 text-sm whitespace-pre-wrap">{ticket.description}</p>
                            </div>

                            {/* Replies Conversation Thread */}
                            <div className="space-y-2.5">
                              <p className="text-gray-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                                <MessageSquare className="w-3.5 h-3.5 text-blue-400" /> Live Chat Thread
                              </p>

                              {(!ticket.replies || ticket.replies.length === 0) ? (
                                <p className="text-gray-500 text-xs italic bg-white/[0.02] p-3 rounded-xl border border-white/5">
                                  Our support desk has received your ticket and will respond here shortly.
                                </p>
                              ) : (
                                ticket.replies.map((r: any, i: number) => {
                                  const isAdmin = r.userType === 'admin' || r.sender === 'support';
                                  return (
                                    <div
                                      key={i}
                                      className={`p-3 rounded-2xl border text-sm max-w-[88%] ${isAdmin
                                        ? 'bg-blue-600/15 border-blue-500/30 text-blue-100 mr-auto rounded-tl-sm'
                                        : 'bg-white/10 border-white/10 text-white ml-auto rounded-tr-sm'
                                        }`}
                                    >
                                      <div className="flex items-center justify-between gap-3 mb-1">
                                        <span className={`text-xs font-bold ${isAdmin ? 'text-blue-300' : 'text-gray-300'}`}>
                                          {isAdmin ? (r.userName || r.adminName || '🎧 Support Agent') : '🛵 You'}
                                        </span>
                                        <span className="text-[10px] text-gray-400">
                                          {r.createdAt?.toDate ? r.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                        </span>
                                      </div>
                                      <p className="text-sm leading-relaxed">{r.text || r.message}</p>
                                    </div>
                                  );
                                })
                              )}
                            </div>

                            {/* Reply Input Form */}
                            <div className="pt-2 flex items-center gap-2">
                              <Input
                                placeholder="Type a message to support desk..."
                                value={replyTextMap[ticket.id] || ''}
                                onChange={e => setReplyTextMap(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendReply(ticket.id);
                                  }
                                }}
                                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 rounded-xl h-10 text-sm focus:border-blue-500/50"
                              />
                              <Button
                                size="sm"
                                disabled={sendingReplyId === ticket.id || !(replyTextMap[ticket.id] || '').trim()}
                                onClick={() => handleSendReply(ticket.id)}
                                className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs gap-1.5 shadow-md shadow-blue-600/20 shrink-0"
                              >
                                {sendingReplyId === ticket.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                Send
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                );
              })
            )}
          </motion.div>
        </TabsContent>

        {/* FAQ Tab */}
        <TabsContent value="faq" className="mt-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="bg-white/5 border-white/10 rounded-2xl">
              <CardContent className="p-0">
                <Accordion type="single" collapsible className="w-full">
                  {FAQS.map((faq, i) => (
                    <AccordionItem key={i} value={`faq-${i}`} className="border-white/10 last:border-0">
                      <AccordionTrigger className="px-5 py-4 text-white text-sm font-medium hover:no-underline hover:text-white text-left">
                        {faq.q}
                      </AccordionTrigger>
                      <AccordionContent className="px-5 pb-4 text-gray-400 text-sm leading-relaxed">
                        {faq.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>

            {/* Quick Contact */}
            <Card className="mt-4 bg-gradient-to-r from-rose-900/30 to-red-900/30 border-rose-500/20 rounded-2xl">
              <CardContent className="p-5">
                <h3 className="text-white font-bold mb-1 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-rose-400" /> Still need help?
                </h3>
                <p className="text-gray-400 text-sm mb-4">Our support team is available 9 AM – 9 PM, Mon–Sat.</p>
                <div className="grid grid-cols-2 gap-3">
                  <a href="tel:+911234567890">
                    <Button variant="outline" className="w-full border-white/10 text-gray-300 hover:text-white hover:bg-white/10 gap-2 text-sm">
                      <Phone className="w-4 h-4 text-emerald-400" /> Call Now
                    </Button>
                  </a>
                  <a href="mailto:rider-support@akrhunger.com">
                    <Button variant="outline" className="w-full border-white/10 text-gray-300 hover:text-white hover:bg-white/10 gap-2 text-sm">
                      <Mail className="w-4 h-4 text-blue-400" /> Email
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
