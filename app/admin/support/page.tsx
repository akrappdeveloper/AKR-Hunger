'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, updateDoc, doc, deleteDoc, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { SupportTicket } from '@/lib/types';
import { useAdminAuth } from '@/context/AdminAuthContext';
import {
    Search,
    MessageSquare,
    CheckCircle,
    Clock,
    AlertTriangle,
    MoreVertical,
    Trash2,
    Send,
    User,
    Store,
    Truck,
    XCircle,
    Inbox,
    Filter
} from 'lucide-react';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Tabs,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function SupportPage() {
    const { admin } = useAdminAuth();
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
    const [replyText, setReplyText] = useState('');

    // Main Tab (Department)
    const [activeTab, setActiveTab] = useState('customer');
    // Sub Tab (Status)
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => {
        // Real-time listener for support tickets
        const q = query(collection(db, 'supportTickets'), orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as SupportTicket[];
            setTickets(data);

            // Update selected ticket in real-time if it's open
            if (selectedTicket) {
                const updated = data.find(t => t.id === selectedTicket.id);
                if (updated) setSelectedTicket(updated);
            }

            setLoading(false);
        }, (error) => {
            console.error("Error fetching tickets:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []); // Removed selectedTicket from dependency to prevent loop, handled inside

    const updateTicketStatus = async (ticketId: string, newStatus: string) => {
        try {
            await updateDoc(doc(db, 'supportTickets', ticketId), {
                status: newStatus,
                updatedAt: new Date(),
                ...(newStatus === 'resolved' ? { resolvedAt: new Date() } : {})
            });
        } catch (error) {
            console.error(`Error updating ticket to ${newStatus}:`, error);
        }
    };

    const handleReply = async () => {
        if (!selectedTicket?.id || !replyText.trim()) return;

        try {
            const newReply = {
                id: Date.now().toString(),
                ticketId: selectedTicket.id,
                userId: admin?.uid || 'admin',
                userName: admin?.name || 'Admin',
                userType: 'admin' as const,
                message: replyText,
                createdAt: new Date()
            };

            await updateDoc(doc(db, 'supportTickets', selectedTicket.id), {
                replies: arrayUnion(newReply),
                status: 'in_progress',
                updatedAt: new Date(),
                adminResponse: replyText // Keep for backward compatibility/preview
            });
            setReplyText('');
        } catch (error) {
            console.error("Error sending reply:", error);
        }
    };

    const handleDeleteTicket = async (ticketId: string) => {
        if (!confirm("Are you sure you want to delete this ticket?")) return;
        try {
            await deleteDoc(doc(db, 'supportTickets', ticketId));
            if (selectedTicket?.id === ticketId) setSelectedTicket(null);
        } catch (error) {
            console.error("Error deleting ticket:", error);
        }
    };

    // Improved Filtering Logic
    const filteredTickets = tickets.filter(ticket => {
        const ticketUserType = ticket.userType?.toLowerCase() || '';
        const ticketStatus = ticket.status?.toLowerCase() || '';
        const filterStatus = statusFilter.toLowerCase();

        const matchesUserType = ticketUserType === activeTab.toLowerCase();
        const matchesStatus =
            filterStatus === 'all' ||
            ticketStatus === filterStatus ||
            (filterStatus === 'rejected' && (ticketStatus === 'closed' || ticketStatus === 'rejected'));

        const matchesSearch =
            ticket.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ticket.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ticket.id?.includes(searchTerm);

        return matchesUserType && matchesStatus && matchesSearch;
    });

    const formatDate = (date: any) => {
        if (!date) return '';
        if (date.seconds) return new Date(date.seconds * 1000).toLocaleString();
        if (date instanceof Date) return date.toLocaleString();
        return new Date(date).toLocaleString(); // Fallback string handling
    };

    // Stats
    const currentTabTickets = tickets.filter(t => t.userType === activeTab);
    const openCount = currentTabTickets.filter(t => t.status === 'open').length;
    const urgentCount = currentTabTickets.filter(t => t.priority === 'urgent' && t.status !== 'resolved').length;
    const resolvedCount = currentTabTickets.filter(t => t.status === 'resolved').length;

    return (
        <div className="space-y-6 h-[calc(100vh-100px)] flex flex-col p-4 md:p-6 bg-gray-950/50 backdrop-blur-sm rounded-xl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                        Designated Support
                        <Badge variant="outline" className="text-xs font-mono text-blue-400 border-blue-500/30">ADMIN ACCESS</Badge>
                    </h1>
                    <p className="text-gray-400 font-medium text-sm mt-1">Manage, track, and resolve user inquiries efficiently.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" className="border-white/10 text-gray-400 hover:text-white hover:bg-white/5 text-xs">
                        <Filter className="w-3.5 h-3.5 mr-2" />
                        Export Data
                    </Button>
                </div>
            </div>

            {/* Enhanced Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
                <Card className="bg-black/40 border-white/5 hover:border-blue-500/30 transition-all duration-300 group">
                    <CardContent className="p-5">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-widest">Total Tickets</p>
                                <h3 className="text-2xl font-bold text-white mt-2">{tickets.length}</h3>
                            </div>
                            <div className="p-2 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                                <Inbox className="w-5 h-5 text-blue-500" />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center text-xs text-gray-400">
                            <span className="text-blue-400 font-medium flex items-center mr-2">
                                +{tickets.filter(t => new Date(t.createdAt).getDate() === new Date().getDate()).length} new
                            </span>
                            today
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-black/40 border-white/5 hover:border-yellow-500/30 transition-all duration-300 group">
                    <CardContent className="p-5">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-widest">Pending</p>
                                <h3 className="text-2xl font-bold text-white mt-2">{openCount}</h3>
                            </div>
                            <div className="p-2 bg-yellow-500/10 rounded-lg group-hover:bg-yellow-500/20 transition-colors">
                                <Clock className="w-5 h-5 text-yellow-500" />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center text-xs text-gray-400">
                            <span className="text-yellow-400 font-medium flex items-center mr-2">
                                Needs Attention
                            </span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-black/40 border-white/5 hover:border-red-500/30 transition-all duration-300 group">
                    <CardContent className="p-5">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-widest">Urgent</p>
                                <h3 className="text-2xl font-bold text-white mt-2">{urgentCount}</h3>
                            </div>
                            <div className="p-2 bg-red-500/10 rounded-lg group-hover:bg-red-500/20 transition-colors">
                                <AlertTriangle className="w-5 h-5 text-red-500" />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center text-xs text-gray-400">
                            <span className="text-red-400 font-medium flex items-center mr-2">
                                High Priority
                            </span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-black/40 border-white/5 hover:border-green-500/30 transition-all duration-300 group">
                    <CardContent className="p-5">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-widest">Resolved</p>
                                <h3 className="text-2xl font-bold text-white mt-2">{resolvedCount}</h3>
                            </div>
                            <div className="p-2 bg-green-500/10 rounded-lg group-hover:bg-green-500/20 transition-colors">
                                <CheckCircle className="w-5 h-5 text-green-500" />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center text-xs text-gray-400">
                            <span className="text-green-400 font-medium flex items-center mr-2">
                                Completed
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex-1 min-h-0 bg-black/40 border border-white/5 rounded-xl overflow-hidden flex flex-col md:flex-row shadow-2xl ring-1 ring-white/5">
                {/* Left Sidebar - Ticket List */}
                <div className="w-full md:w-1/3 min-w-[350px] flex flex-col border-r border-white/5 bg-gray-900/20 h-full">
                    <div className="p-4 border-b border-white/5 space-y-4 shrink-0 bg-gray-900/40">
                        <Tabs defaultValue="customer" value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="bg-black/40 border border-white/5 p-1 w-full grid grid-cols-3">
                                <TabsTrigger value="customer" className="text-xs font-medium text-gray-400 data-[state=active]:bg-gray-800 data-[state=active]:text-white transition-all">Customer</TabsTrigger>
                                <TabsTrigger value="restaurant" className="text-xs font-medium text-gray-400 data-[state=active]:bg-gray-800 data-[state=active]:text-white transition-all">Restaurant</TabsTrigger>
                                <TabsTrigger value="delivery" className="text-xs font-medium text-gray-400 data-[state=active]:bg-gray-800 data-[state=active]:text-white transition-all">Delivery</TabsTrigger>
                            </TabsList>
                        </Tabs>

                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                                <Input
                                    placeholder="Search tickets..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9 h-9 bg-black/40 border-white/10 text-white placeholder:text-gray-600 focus:border-blue-500/50 text-xs"
                                />
                            </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-9 w-9 p-0 border-white/10 bg-black/40 text-gray-400 hover:text-white">
                                        <Filter className="w-4 h-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-gray-900 border-gray-800">
                                    <DropdownMenuItem onClick={() => setStatusFilter('all')}>All Status</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setStatusFilter('open')}>Open Only</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setStatusFilter('resolved')}>Resolved Only</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setStatusFilter('urgent')}>Urgent Priority</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        <ScrollArea className="w-full whitespace-nowrap pb-2">
                            <div className="flex gap-2">
                                {['all', 'open', 'resolved', 'urgent'].map((status) => (
                                    <button
                                        key={status}
                                        onClick={() => setStatusFilter(status)}
                                        className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all border shrink-0 ${statusFilter === status
                                            ? 'bg-blue-500/20 text-blue-400 border-blue-500/50'
                                            : 'bg-white/5 text-gray-400 border-transparent hover:bg-white/10'
                                            }`}
                                    >
                                        {status}
                                    </button>
                                ))}
                            </div>
                            <ScrollBar orientation="horizontal" />
                        </ScrollArea>
                    </div>

                    <ScrollArea className="flex-1 h-full w-full">
                        <div className="flex flex-col p-2 gap-2">
                            {loading ? (
                                <div className="p-8 text-center text-white flex flex-col items-center gap-2">
                                    <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                    <span className="text-xs text-gray-400">Loading...</span>
                                </div>
                            ) : filteredTickets.length === 0 ? (
                                <div className="p-12 text-center text-white flex flex-col items-center gap-2">
                                    <Inbox className="h-8 w-8 text-gray-800" />
                                    <span className="font-medium text-sm text-gray-500">No tickets found</span>
                                </div>
                            ) : (
                                filteredTickets.map((ticket) => (
                                    <div
                                        key={ticket.id}
                                        onClick={() => setSelectedTicket(ticket)}
                                        className={`p-4 border rounded-xl cursor-pointer transition-all hover:bg-white/5 group relative ${selectedTicket?.id === ticket.id
                                            ? 'bg-blue-600/10 border-blue-500/40 shadow-lg shadow-blue-900/10'
                                            : 'border-transparent bg-transparent border-white/5'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                {ticket.priority === 'urgent' && <AlertTriangle className="w-3 h-3 text-red-500" />}
                                                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${ticket.priority === 'urgent' ? 'text-red-400 border-red-500/30 bg-red-500/10' :
                                                    ticket.priority === 'high' ? 'text-orange-400 border-orange-500/30 bg-orange-500/10' :
                                                        'text-gray-400 border-gray-700 bg-gray-800'
                                                    }`}>#{ticket.id?.slice(-4)}</span>
                                            </div>
                                            <span className="text-[10px] text-gray-500">
                                                {formatDate(ticket.createdAt).split(',')[0]}
                                            </span>
                                        </div>
                                        <h4 className={`font-semibold text-sm mb-1 leading-snug ${selectedTicket?.id === ticket.id ? 'text-white' : 'text-gray-300 group-hover:text-white'} line-clamp-1`}>
                                            {ticket.subject}
                                        </h4>
                                        <p className="text-xs text-gray-500 line-clamp-1 mb-3">{ticket.description}</p>

                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                <Avatar className="h-4 w-4">
                                                    <AvatarFallback className="bg-gray-800 text-[8px] text-gray-400">
                                                        {ticket.userName?.charAt(0)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <span className="text-[10px] text-gray-400 truncate max-w-[80px]">{ticket.userName}</span>
                                            </div>
                                            <Badge variant="outline" className={`text-[9px] px-1.5 py-0 border-0 ${ticket.status === 'resolved' ? 'bg-green-500/10 text-green-500' :
                                                ticket.status === 'open' ? 'bg-blue-500/10 text-blue-500' :
                                                    'bg-gray-800 text-gray-400'
                                                }`}>
                                                {ticket.status}
                                            </Badge>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </ScrollArea>
                </div>

                {/* Right Content - Modern Chat Interface */}
                <div className="flex-1 flex flex-col h-full bg-black/40 overflow-hidden relative">
                    {selectedTicket ? (
                        <div className="flex flex-col h-full">
                            {/* Header */}
                            <div className="px-6 py-4 border-b border-white/5 bg-gray-900/20 backdrop-blur-sm shrink-0 flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                                        {selectedTicket.userName?.charAt(0)}
                                    </div>
                                    <div>
                                        <h2 className="text-base font-bold text-white leading-tight">{selectedTicket.subject}</h2>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-xs text-gray-400 flex items-center gap-1">
                                                <User className="w-3 h-3" /> {selectedTicket.userName}
                                            </span>
                                            <span className="text-gray-600">•</span>
                                            <span className="text-xs text-gray-400">{selectedTicket.userEmail}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white rounded-full hover:bg-white/10">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="bg-gray-900 border-gray-800 text-gray-300 w-56">
                                            <DropdownMenuItem onClick={() => updateTicketStatus(selectedTicket.id!, 'resolved')} className="text-green-500 focus:text-green-400 focus:bg-green-900/20">
                                                <CheckCircle className="mr-2 h-4 w-4" /> Mark as Resolved
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => updateTicketStatus(selectedTicket.id!, 'open')}>
                                                <Inbox className="mr-2 h-4 w-4" /> Re-open Ticket
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => updateTicketStatus(selectedTicket.id!, 'rejected')} className="text-red-500 focus:text-red-400 focus:bg-red-900/20">
                                                <XCircle className="mr-2 h-4 w-4" /> Reject Ticket
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleDeleteTicket(selectedTicket.id!)} className="text-gray-500 focus:text-red-400 focus:bg-red-950/20 border-t border-gray-800 mt-1">
                                                <Trash2 className="mr-2 h-4 w-4" /> Delete Permanently
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>

                            {/* Chat Area */}
                            <ScrollArea className="flex-1 bg-gradient-to-b from-gray-900/0 to-black/20">
                                <div className="p-6 space-y-6 max-w-3xl mx-auto">
                                    {/* Initial Ticket */}
                                    <div className="flex gap-4">
                                        <Avatar className="h-8 w-8 mt-1 border border-white/10">
                                            <AvatarFallback className="bg-gray-800 text-gray-400 text-xs">{selectedTicket.userName?.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div className="space-y-1 max-w-[80%]">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-gray-300">{selectedTicket.userName}</span>
                                                <span className="text-[10px] text-gray-500">{formatDate(selectedTicket.createdAt)}</span>
                                            </div>
                                            <div className="p-4 rounded-2xl rounded-tl-none bg-gray-800/60 border border-white/5 text-sm text-gray-200 leading-relaxed shadow-sm">
                                                {selectedTicket.description}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Replies */}
                                    {selectedTicket.replies?.map((reply: any) => (
                                        <div key={reply.id} className={`flex gap-4 ${reply.userType === 'admin' ? 'flex-row-reverse' : ''}`}>
                                            <Avatar className={`h-8 w-8 mt-1 border ${reply.userType === 'admin' ? 'border-blue-500/30 ring-2 ring-blue-500/10' : 'border-white/10'}`}>
                                                <AvatarFallback className={reply.userType === 'admin' ? 'bg-blue-600 text-white text-xs' : 'bg-gray-800 text-gray-400 text-xs'}>
                                                    {reply.userType === 'admin' ? 'A' : reply.userName?.charAt(0)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className={`space-y-1 max-w-[80%] flex flex-col ${reply.userType === 'admin' ? 'items-end' : 'items-start'}`}>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-gray-300">{reply.userName}</span>
                                                    <span className="text-[10px] text-gray-500">{formatDate(reply.createdAt)}</span>
                                                </div>
                                                <div className={`p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${reply.userType === 'admin'
                                                    ? 'bg-blue-600 text-white rounded-tr-none shadow-blue-900/20'
                                                    : 'bg-gray-800/60 border border-white/5 text-gray-200 rounded-tl-none'
                                                    }`}>
                                                    {reply.message}
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Legacy Support: If only adminResponse exists but no replies */}
                                    {selectedTicket.adminResponse && (!selectedTicket.replies || selectedTicket.replies.length === 0) && (
                                        <div className="flex gap-4 flex-row-reverse">
                                            <Avatar className="h-8 w-8 mt-1 border border-blue-500/30 ring-2 ring-blue-500/10">
                                                <AvatarFallback className="bg-blue-600 text-white text-xs">A</AvatarFallback>
                                            </Avatar>
                                            <div className="space-y-1 max-w-[80%] flex flex-col items-end">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-gray-300">Admin Response</span>
                                                    <span className="text-[10px] text-gray-500">Legacy</span>
                                                </div>
                                                <div className="p-4 rounded-2xl text-sm leading-relaxed shadow-sm bg-blue-600 text-white rounded-tr-none shadow-blue-900/20">
                                                    {selectedTicket.adminResponse}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>

                            {/* Reply Input */}
                            <div className="p-4 bg-gray-900/40 border-t border-white/5 backdrop-blur-md shrink-0">
                                <div className="max-w-3xl mx-auto space-y-3">
                                    <div className="relative">
                                        <Textarea
                                            placeholder={selectedTicket.status === 'resolved' ? "Ticket is resolved. Re-open to reply." : "Type your reply..."}
                                            className="bg-black/40 border-white/10 text-white resize-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 min-h-[80px] rounded-xl p-3 pr-12 text-sm"
                                            value={replyText}
                                            onChange={(e) => setReplyText(e.target.value)}
                                            disabled={selectedTicket.status === 'resolved' || selectedTicket.status === 'rejected'}
                                        />
                                        <div className="absolute right-3 bottom-3">
                                            <Button
                                                size="icon"
                                                className={`h-8 w-8 rounded-lg transition-all ${!replyText.trim() ? 'bg-gray-800 text-gray-500' : 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20'}`}
                                                onClick={handleReply}
                                                disabled={!replyText.trim()}
                                            >
                                                <Send className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    {selectedTicket.status === 'resolved' && (
                                        <div className="flex items-center justify-center gap-2 p-2 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-xs overflow-hidden">
                                            <CheckCircle className="w-3.5 h-3.5" />
                                            This ticket has been marked as resolved.
                                            <button onClick={() => updateTicketStatus(selectedTicket.id!, 'open')} className="underline hover:text-green-300 ml-1 font-medium">Re-open</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8 text-center bg-gray-900/20">
                            <div className="h-24 w-24 bg-gray-900/80 rounded-full flex items-center justify-center mb-6 shadow-2xl border border-white/5 ring-1 ring-white/5">
                                <MessageSquare className="h-10 w-10 opacity-40 text-blue-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Support Dashboard</h3>
                            <p className="text-sm text-gray-500 max-w-[300px] leading-relaxed">
                                Select a ticket from the list to view the conversation history and send replies.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
