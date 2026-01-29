'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, updateDoc, doc, deleteDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { SupportTicket } from '@/lib/types';
import {
    Search,
    Filter,
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
    Archive,
    Inbox
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
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function SupportPage() {
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
        // Updated to 'supportTickets' as per user confirmation of existing data
        const q = query(collection(db, 'supportTickets'), orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as SupportTicket[];
            setTickets(data);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching tickets:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const updateTicketStatus = async (ticketId: string, newStatus: string) => {
        try {
            await updateDoc(doc(db, 'supportTickets', ticketId), {
                status: newStatus,
                updatedAt: new Date(),
                ...(newStatus === 'resolved' ? { resolvedAt: new Date() } : {})
            });
            if (selectedTicket?.id === ticketId) {
                setSelectedTicket(prev => prev ? ({ ...prev, status: newStatus as any }) : null);
            }
        } catch (error) {
            console.error(`Error updating ticket to ${newStatus}:`, error);
        }
    };

    const handleReply = async () => {
        if (!selectedTicket?.id || !replyText.trim()) return;

        try {
            await updateDoc(doc(db, 'supportTickets', selectedTicket.id), {
                adminResponse: replyText,
                status: 'in_progress',
                updatedAt: new Date()
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
        // Normalize values for comparison
        const ticketUserType = ticket.userType?.toLowerCase() || '';
        const ticketStatus = ticket.status?.toLowerCase() || '';
        const filterStatus = statusFilter.toLowerCase();

        // 1. Filter by Department (User Type)
        const matchesUserType = ticketUserType === activeTab.toLowerCase();

        // 2. Filter by Status (Sub-tab)
        // Mapping 'reject' filter to specific logic if needed, assumes status can be 'rejected' or 'closed'
        const matchesStatus =
            filterStatus === 'all' ||
            ticketStatus === filterStatus ||
            (filterStatus === 'rejected' && (ticketStatus === 'closed' || ticketStatus === 'rejected'));

        // 3. Search
        const matchesSearch =
            ticket.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ticket.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ticket.id?.includes(searchTerm);

        return matchesUserType && matchesStatus && matchesSearch;
    });

    // Helper to format date safely
    const formatDate = (date: any) => {
        if (!date) return '';
        if (date.toDate) return date.toDate().toLocaleString();
        if (date instanceof Date) return date.toLocaleString();
        return '';
    };

    // Stats for the CURRENT active tab
    const currentTabTickets = tickets.filter(t => t.userType === activeTab);
    const openCount = currentTabTickets.filter(t => t.status === 'open').length;
    const urgentCount = currentTabTickets.filter(t => t.priority === 'urgent' && t.status !== 'resolved').length;
    const resolvedCount = currentTabTickets.filter(t => t.status === 'resolved').length;

    return (
        <div className="space-y-6 h-[calc(100vh-100px)] flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Support Center</h1>
                    <p className="text-gray-300 font-medium">Manage inquiries and support tickets.</p>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
                <Card className="bg-gray-900 border-gray-800 text-white shadow-lg backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-bold text-gray-200 uppercase tracking-widest">Open Tickets</CardTitle>
                        <Inbox className="h-5 w-5 text-blue-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-white tracking-tight">{openCount}</div>
                        <p className="text-xs text-gray-300 mt-1 font-medium">{activeTab} inquiries waiting</p>
                    </CardContent>
                </Card>
                <Card className="bg-gray-900 border-gray-800 text-white shadow-lg backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-bold text-gray-200 uppercase tracking-widest">Urgent</CardTitle>
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-red-500 tracking-tight">{urgentCount}</div>
                        <p className="text-xs text-gray-300 mt-1 font-medium">High priority attention needed</p>
                    </CardContent>
                </Card>
                <Card className="bg-gray-900 border-gray-800 text-white shadow-lg backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-bold text-white uppercase tracking-widest">Resolved</CardTitle>
                        <CheckCircle className="h-5 w-5 text-green-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-green-400 tracking-tight">{resolvedCount}</div>
                        <p className="text-xs text-gray-200 mt-1 font-medium">Successfully closed</p>
                    </CardContent>
                </Card>
            </div>

            <div className="flex-1 min-h-0 bg-gray-900/40 border border-gray-800 rounded-xl overflow-hidden flex flex-col md:flex-row backdrop-blur-md shadow-2xl">
                {/* Left Sidebar - Ticket List */}
                <div className="w-full md:w-1/3 min-w-[320px] flex flex-col border-r border-gray-800 bg-gray-900/60 h-full">
                    {/* Top Controls */}
                    <div className="p-4 border-b border-gray-800 space-y-4 shrink-0">
                        <Tabs defaultValue="customer" value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="bg-gray-950 border border-gray-800 p-1 w-full grid grid-cols-3">
                                <TabsTrigger value="customer" className="text-xs font-medium text-gray-200 data-[state=active]:bg-gray-800 data-[state=active]:text-white transition-all">Customer</TabsTrigger>
                                <TabsTrigger value="restaurant" className="text-xs font-medium text-gray-200 data-[state=active]:bg-gray-800 data-[state=active]:text-white transition-all">Restaurant</TabsTrigger>
                                <TabsTrigger value="delivery" className="text-xs font-medium text-gray-200 data-[state=active]:bg-gray-800 data-[state=active]:text-white transition-all">Delivery</TabsTrigger>
                            </TabsList>
                        </Tabs>

                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Search tickets..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 bg-gray-900 border-gray-700 text-white placeholder:text-gray-400"
                            />
                        </div>

                        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                            {['all', 'open', 'resolved', 'rejected'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all border shrink-0 ${statusFilter === status
                                        ? 'bg-blue-500/20 text-blue-400 border-blue-500/50'
                                        : 'bg-gray-800 text-gray-200 border-transparent hover:bg-gray-700'
                                        }`}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* List */}
                    <ScrollArea className="flex-1 h-full w-full">
                        <div className="flex flex-col p-2 gap-2">
                            {loading ? (
                                <div className="p-8 text-center text-white flex flex-col items-center gap-2">
                                    <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                    <span className="text-xs">Loading...</span>
                                </div>
                            ) : filteredTickets.length === 0 ? (
                                <div className="p-12 text-center text-white flex flex-col items-center gap-2">
                                    <Inbox className="h-8 w-8 opacity-20" />
                                    <span className="font-medium text-sm">No tickets</span>
                                    <span className="text-xs max-w-[150px]">Adjust filters to see results.</span>
                                </div>
                            ) : (
                                filteredTickets.map((ticket) => (
                                    <div
                                        key={ticket.id}
                                        onClick={() => setSelectedTicket(ticket)}
                                        className={`p-4 border rounded-xl cursor-pointer transition-all hover:bg-gray-800/60 group relative overflow-hidden ${selectedTicket?.id === ticket.id
                                            ? 'bg-gray-800/90 border-blue-500/50 shadow-md'
                                            : 'border-transparent bg-gray-900/40 border-gray-800/50 hover:border-gray-700'
                                            }`}
                                    >
                                        {selectedTicket?.id === ticket.id && (
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>
                                        )}
                                        <div className="flex justify-between items-start mb-1.5 pl-2">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border-opacity-50 ${ticket.priority === 'urgent' ? 'text-red-400 border-red-500 bg-red-500/5' :
                                                    ticket.priority === 'high' ? 'text-orange-400 border-orange-500 bg-orange-500/5' :
                                                        'text-blue-400 border-blue-500 bg-blue-500/5'
                                                    }`}>
                                                    {ticket.priority || 'NORMAL'}
                                                </Badge>
                                                <span className="text-[10px] text-gray-300 font-mono">#{ticket.id?.slice(-4)}</span>
                                            </div>
                                            <span className="text-[10px] text-gray-200 whitespace-nowrap ml-2">
                                                {formatDate(ticket.createdAt).split(',')[0]}
                                            </span>
                                        </div>
                                        <h4 className={`font-semibold text-sm mb-1 leading-snug pl-2 ${selectedTicket?.id === ticket.id ? 'text-white' : 'text-gray-200'} line-clamp-2`}>
                                            {ticket.subject}
                                        </h4>
                                        <p className="text-xs text-gray-300 line-clamp-2 pl-2 leading-relaxed">{ticket.description}</p>
                                        <div className="flex items-center gap-2 mt-3 pl-2">
                                            <div className="h-1.5 w-1.5 rounded-full bg-gray-600 shrink-0"></div>
                                            <span className="text-[10px] text-gray-200 truncate max-w-[100px]">{ticket.userName}</span>
                                            <div className={`ml-auto text-[10px] uppercase font-bold px-1.5 rounded ${ticket.status === 'resolved' ? 'text-green-400 bg-green-900/20' :
                                                ticket.status === 'open' ? 'text-blue-400 bg-blue-900/20' :
                                                    ticket.status === 'rejected' ? 'text-red-400 bg-red-900/20' :
                                                        'text-yellow-400 bg-yellow-900/20'
                                                }`}>
                                                {ticket.status === 'in_progress' ? 'Active' : ticket.status}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </ScrollArea>
                </div>

                {/* Right Content - Detail View */}
                <div className="flex-1 flex flex-col h-full bg-gray-950 overflow-hidden relative">
                    {/* Background Pattern */}
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-900/10 via-transparent to-transparent pointer-events-none" />

                    {selectedTicket ? (
                        <div className="flex flex-col h-full z-0">
                            {/* Header */}
                            <div className="p-6 border-b border-gray-800 bg-gray-900/30 backdrop-blur-sm shrink-0 flex justify-between items-start gap-4">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <Badge className={`uppercase px-2 text-[10px] rounded-md ${selectedTicket.status === 'resolved' ? 'bg-green-600' :
                                            selectedTicket.status === 'rejected' ? 'bg-red-600' :
                                                'bg-blue-600'
                                            }`}>
                                            {selectedTicket.status}
                                        </Badge>
                                        <span className="text-xs text-gray-200 font-mono">ID: {selectedTicket.id}</span>
                                    </div>
                                    <h2 className="text-xl font-bold text-white mb-2 leading-tight">{selectedTicket.subject}</h2>
                                    <div className="flex items-center gap-3 text-sm">
                                        <div className="flex items-center gap-2 text-blue-200 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                                            {selectedTicket.userType === 'customer' ? <User className="h-3 w-3" /> :
                                                selectedTicket.userType === 'restaurant' ? <Store className="h-3 w-3" /> :
                                                    <Truck className="h-3 w-3" />}
                                            <span className="font-medium text-xs">{selectedTicket.userName}</span>
                                        </div>
                                        <span className="text-gray-300 text-xs">{selectedTicket.userEmail}</span>
                                    </div>
                                </div>

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white rounded-full hover:bg-gray-800">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="bg-gray-900 border-gray-800 text-gray-300 w-48">
                                        <DropdownMenuItem onClick={() => updateTicketStatus(selectedTicket.id!, 'resolved')} className="hover:text-green-400 cursor-pointer">
                                            <CheckCircle className="mr-2 h-4 w-4" /> Mark Resolved
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => updateTicketStatus(selectedTicket.id!, 'open')} className="hover:text-blue-400 cursor-pointer">
                                            <Inbox className="mr-2 h-4 w-4" /> Re-open Ticket
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => updateTicketStatus(selectedTicket.id!, 'rejected')} className="hover:text-red-400 cursor-pointer text-red-400/80">
                                            <XCircle className="mr-2 h-4 w-4" /> Reject Ticket
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleDeleteTicket(selectedTicket.id!)} className="text-red-500 hover:bg-red-950/20 cursor-pointer border-t border-gray-800 mt-1">
                                            <Trash2 className="mr-2 h-4 w-4" /> Delete Ticket
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            {/* Conversation Scroll Area */}
                            <ScrollArea className="flex-1">
                                <div className="p-6 space-y-8 max-w-4xl mx-auto">
                                    {/* Original Message */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Inquiry</h3>
                                            <span className="text-[10px] text-gray-600 font-mono">
                                                {formatDate(selectedTicket.createdAt)}
                                            </span>
                                        </div>
                                        <div className="bg-gray-800/40 rounded-xl p-5 border border-gray-800/60">
                                            <p className="text-gray-200 leading-relaxed whitespace-pre-wrap text-sm">{selectedTicket.description}</p>
                                        </div>
                                    </div>

                                    {/* Admin Response Thread */}
                                    {selectedTicket.adminResponse && (
                                        <div className="space-y-2 pl-6 border-l-2 border-blue-900/30">
                                            <h3 className="text-[10px] font-bold text-blue-500 uppercase tracking-widest flex items-center gap-2">
                                                <div className="h-px w-3 bg-blue-500"></div> Our Response
                                            </h3>
                                            <div className="bg-blue-900/10 rounded-xl p-5 border border-blue-500/20">
                                                <p className="text-blue-100 leading-relaxed whitespace-pre-wrap text-sm">{selectedTicket.adminResponse}</p>
                                                <div className="flex items-center gap-2 mt-3 justify-end">
                                                    <Avatar className="h-5 w-5 ring-1 ring-blue-500/50">
                                                        <AvatarFallback className="bg-blue-600 text-[9px] text-white">AK</AvatarFallback>
                                                    </Avatar>
                                                    <span className="text-[10px] text-blue-300 font-medium">Admin Team</span>
                                                    <span className="text-[10px] text-blue-400/50 ml-1">
                                                        {formatDate(selectedTicket.updatedAt)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>

                            {/* Reply Input */}
                            <div className="p-4 border-t border-gray-800 bg-gray-900/80 backdrop-blur-md shrink-0">
                                <div className="max-w-4xl mx-auto space-y-3">
                                    <Textarea
                                        placeholder={selectedTicket.status === 'resolved' || selectedTicket.status === 'rejected' ? "Ticket is closed. Re-open to reply." : "Type your response..."}
                                        className="bg-gray-950 border-gray-700 text-gray-100 resize-none focus:border-blue-500 min-h-[100px] rounded-xl p-3 text-sm"
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        disabled={selectedTicket.status === 'resolved' || selectedTicket.status === 'rejected'}
                                    />
                                    <div className="flex justify-between items-center px-1">
                                        <div className="text-xs text-gray-500 flex items-center gap-2">
                                            {selectedTicket.status === 'resolved' ? (
                                                <span className="text-green-500 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Resolved</span>
                                            ) : selectedTicket.status === 'rejected' ? (
                                                <span className="text-red-500 flex items-center gap-1"><XCircle className="h-3 w-3" /> Rejected</span>
                                            ) : (
                                                <span className="text-blue-500 flex items-center gap-1"><Clock className="h-3 w-3" /> Open</span>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            {(selectedTicket.status === 'resolved' || selectedTicket.status === 'rejected') ? (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="border-gray-700 text-gray-300 hover:bg-gray-800"
                                                    onClick={() => updateTicketStatus(selectedTicket.id!, 'open')}
                                                >
                                                    <Inbox className="h-3.5 w-3.5 mr-2" /> Re-open Ticket
                                                </Button>
                                            ) : (
                                                <>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="text-gray-400 hover:text-white"
                                                        onClick={() => updateTicketStatus(selectedTicket.id!, 'rejected')}
                                                    >
                                                        Reject
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="border-green-800 text-green-500 hover:bg-green-900/20"
                                                        onClick={() => updateTicketStatus(selectedTicket.id!, 'resolved')}
                                                    >
                                                        <CheckCircle className="h-3.5 w-3.5 mr-2" /> Resolve
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        className="bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20"
                                                        onClick={handleReply}
                                                        disabled={!replyText.trim()}
                                                    >
                                                        <Send className="h-3.5 w-3.5 mr-2" /> Send Reply
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8 text-center bg-gray-950">
                            <div className="h-16 w-16 bg-gray-900 rounded-full flex items-center justify-center mb-4 shadow-xl border border-gray-800">
                                <MessageSquare className="h-8 w-8 opacity-40 text-blue-400" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-300 mb-1">Select a Ticket</h3>
                            <p className="text-xs text-gray-500 max-w-[240px]">
                                Click on any ticket from the list to view full details and manage the conversation.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
