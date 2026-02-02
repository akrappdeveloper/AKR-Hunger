'use client';

import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Trash2,
  MapPin,
  Award,
  Search,
  MoreVertical,
  Truck,
  CheckCircle,
  XCircle,
  Phone,
  User,
  Activity,
  ShieldAlert,
  FileText,
  Eye,
  X
} from 'lucide-react';
import { DeliveryPartner } from '@/lib/types';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function DeliveryPage() {
  const [partners, setPartners] = useState<DeliveryPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPartner, setSelectedPartner] = useState<DeliveryPartner | null>(null);

  // Document Viewer State
  const [viewingDoc, setViewingDoc] = useState<{ url: string; title: string; type: 'image' | 'pdf' } | null>(null);

  useEffect(() => {
    // Listen to 'deliveryPersons' collection
    const q = query(collection(db, 'deliveryPersons'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as DeliveryPartner[];
      setPartners(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching partners:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const approvePartner = async (id: string) => {
    try {
      await updateDoc(doc(db, 'deliveryPersons', id), {
        verificationStatus: 'approved',
        isAvailable: false
      });
      if (selectedPartner?.id === id) setSelectedPartner(null);
    } catch (error) {
      console.error("Error approving partner:", error);
    }
  };

  const rejectPartner = async (id: string) => {
    if (!confirm("Reject and remove this application?")) return;
    try {
      await deleteDoc(doc(db, 'deliveryPersons', id));
      if (selectedPartner?.id === id) setSelectedPartner(null);
    } catch (error) {
      console.error("Error rejecting partner:", error);
    }
  };

  const deletePartner = async (id: string) => {
    if (!confirm('Are you sure you want to delete this delivery partner? This action is irreversible.')) return;
    try {
      await deleteDoc(doc(db, 'deliveryPersons', id));
      if (selectedPartner?.id === id) setSelectedPartner(null);
    } catch (error) {
      console.error('Error deleting delivery partner:', error);
    }
  };

  const togglePartnerStatus = async (id: string, currentStatus: boolean | undefined) => {
    try {
      await updateDoc(doc(db, 'deliveryPersons', id), {
        isAvailable: !currentStatus,
      });
      if (selectedPartner?.id === id) {
        setSelectedPartner(prev => prev ? ({ ...prev, isAvailable: !currentStatus }) : null);
      }
    } catch (error) {
      console.error('Error updating partner status:', error);
    }
  };

  const handleViewDocument = (url: string | undefined, title: string) => {
    if (!url) return;
    // Simple detection: if URL contains .pdf or implicitly if we know it's a doc.
    // Cloudinary URLs usually have extensions, or we can check header. 
    // For now, let's assume image unless we explicitly detect PDF extension.
    const isPdf = url.toLowerCase().includes('.pdf');
    setViewingDoc({ url, title, type: isPdf ? 'pdf' : 'image' });
  };

  const filteredPartners = partners.filter(
    (partner) =>
      partner.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      partner.phone?.includes(searchTerm)
  );

  const pendingPartners = partners.filter(p => p.verificationStatus === 'pending');

  // Stats Calculation
  const totalPartners = partners.length;
  const onlinePartners = partners.filter(p => p.isAvailable).length;
  const pendingCount = pendingPartners.length;

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    if (date?.toDate) return date.toDate().toLocaleDateString();
    if (date instanceof Date) return date.toLocaleDateString();
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Delivery Fleet</h1>
          <p className="text-gray-400">Manage your delivery partners and track fleet performance.</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-orange-900/20 to-black/40 border-orange-500/20 backdrop-blur-md shadow-[0_0_30px_rgba(249,115,22,0.1)] group hover:shadow-[0_0_40px_rgba(249,115,22,0.2)] transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-orange-400 uppercase tracking-widest">Pending Requests</CardTitle>
            <ShieldAlert className="h-5 w-5 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white tracking-tight">{pendingCount}</div>
            <p className="text-xs text-gray-400 font-medium mt-1">Awaiting verification</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-900/20 to-black/40 border-blue-500/20 backdrop-blur-md shadow-[0_0_30px_rgba(59,130,246,0.1)] group hover:shadow-[0_0_40px_rgba(59,130,246,0.2)] transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-blue-400 uppercase tracking-widest">Total Partners</CardTitle>
            <User className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white tracking-tight">{totalPartners}</div>
            <p className="text-xs text-gray-400 font-medium mt-1">Registered fleet members</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-900/20 to-black/40 border-green-500/20 backdrop-blur-md shadow-[0_0_30px_rgba(34,197,94,0.1)] group hover:shadow-[0_0_40px_rgba(34,197,94,0.2)] transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-green-400 uppercase tracking-widest">Online Now</CardTitle>
            <Activity className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white tracking-tight">{onlinePartners}</div>
            <p className="text-xs text-gray-400 font-medium mt-1">Available for orders</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-900/20 to-black/40 border-yellow-500/20 backdrop-blur-md shadow-[0_0_30px_rgba(234,179,8,0.1)] group hover:shadow-[0_0_40px_rgba(234,179,8,0.2)] transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-yellow-400 uppercase tracking-widest">Avg Fleet Rating</CardTitle>
            <Award className="h-5 w-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white tracking-tight">
              {totalPartners > 0
                ? (partners.reduce((acc, curr) => acc + (curr.rating || 0), 0) / totalPartners).toFixed(1)
                : 'N/A'}
            </div>
            <p className="text-xs text-gray-400 font-medium mt-1">Based on customer feedback</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Approvals Section - ENHANCED */}
      {pendingCount > 0 && (
        <Card className="bg-gradient-to-br from-orange-950/30 to-gray-900 border-orange-500/30 shadow-lg glow-orange">
          <CardHeader className="border-b border-orange-500/20 pb-4">
            <CardTitle className="text-orange-400 flex items-center gap-3 text-lg font-bold tracking-wide">
              <ShieldAlert className="w-5 h-5 animate-pulse" /> Pending Approvals
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="rounded-none border-b border-orange-500/20">
              <Table>
                <TableHeader className="bg-orange-950/20">
                  <TableRow className="border-orange-500/20 hover:bg-transparent">
                    <TableHead className="text-orange-200/70 uppercase text-xs font-bold tracking-wider py-4">Candidate</TableHead>
                    <TableHead className="text-orange-200/70 uppercase text-xs font-bold tracking-wider py-4">Vehicle Details</TableHead>
                    <TableHead className="text-orange-200/70 uppercase text-xs font-bold tracking-wider py-4">Documents Verification</TableHead>
                    <TableHead className="text-right text-orange-200/70 uppercase text-xs font-bold tracking-wider py-4">Decision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingPartners.map(p => (
                    <TableRow key={p.id} className="border-orange-500/10 hover:bg-orange-950/10 transition-colors">
                      <TableCell className="py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-white text-base">{p.name}</span>
                          <span className="text-sm text-gray-400 flex items-center gap-1 mt-1">
                            <Phone className="w-3 h-3" /> {p.phone}
                          </span>
                          <span className="text-xs text-gray-500 mt-0.5">{p.email}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className="w-fit bg-gray-800 text-gray-300 border-gray-700 capitalize">
                            <Truck className="w-3 h-3 mr-1" /> {p.vehicle}
                          </Badge>
                          <span className="text-sm font-mono text-gray-300 tracking-wider bg-gray-900/50 px-2 py-0.5 rounded w-fit">
                            {p.vehicleNumber}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex gap-3">
                          {p.vehicleImage ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDocument(p.vehicleImage, `${p.name}'s RC Document`)}
                              className="bg-gray-800 border-gray-700 text-blue-400 hover:text-blue-300 hover:border-blue-500/50"
                            >
                              <Eye className="w-4 h-4 mr-2" /> View RC
                            </Button>
                          ) : <span className="text-gray-600 text-xs italic">No RC</span>}

                          {p.drivingLicense ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDocument(p.drivingLicense, `${p.name}'s License`)}
                              className="bg-gray-800 border-gray-700 text-blue-400 hover:text-blue-300 hover:border-blue-500/50"
                            >
                              <FileText className="w-4 h-4 mr-2" /> View License
                            </Button>
                          ) : <span className="text-gray-600 text-xs italic">No License</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right py-4">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" onClick={() => approvePartner(p.id!)} className="bg-green-600 hover:bg-green-500 text-white font-semibold shadow-lg shadow-green-900/20">
                            <CheckCircle className="w-4 h-4 mr-1.5" /> Approve
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => rejectPartner(p.id!)} className="bg-red-900/80 hover:bg-red-800 text-red-200 border border-red-800">
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SEARCH & FILTER BAR */}
      <Card className="bg-black/80 border-white/5 backdrop-blur-xl sticky top-0 z-10 shadow-lg">
        <CardHeader className="py-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <CardTitle className="text-lg text-white font-bold flex items-center gap-2">
              <Truck className="h-5 w-5 text-blue-400" />
              Active Fleet
              <Badge variant="secondary" className="bg-white/10 text-white text-xs font-normal border border-white/5">{filteredPartners.length} drivers</Badge>
            </CardTitle>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search drivers by name, phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:bg-white/10 focus:border-blue-500/50 h-10 rounded-xl transition-all"
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* All Partners Table */}
      <div className="rounded-xl border border-white/10 overflow-hidden shadow-2xl bg-black/40 backdrop-blur-xl">
        <Table>
          <TableHeader className="bg-white/5 border-b border-white/5">
            <TableRow className="border-white/5 hover:bg-transparent">
              <TableHead className="font-bold text-gray-300 py-4 pl-6 uppercase text-xs tracking-wider">Partner Identity</TableHead>
              <TableHead className="font-bold text-gray-300 py-4 uppercase text-xs tracking-wider">Fleet Details</TableHead>
              <TableHead className="font-bold text-gray-300 py-4 uppercase text-xs tracking-wider">Metrics</TableHead>
              <TableHead className="font-bold text-gray-300 py-4 uppercase text-xs tracking-wider">Current Status</TableHead>
              <TableHead className="text-right font-bold text-gray-300 py-4 pr-6 uppercase text-xs tracking-wider">Management</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-40 text-center text-white">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-gray-400 animate-pulse">Synchronizing fleet data...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredPartners.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-40 text-center text-gray-500 italic">
                  No delivery partners found matching "{searchTerm}"
                </TableCell>
              </TableRow>
            ) : (
              filteredPartners.map((partner) => (
                <TableRow key={partner.id} className="border-gray-800 hover:bg-gray-800/40 transition-all duration-200">
                  <TableCell className="pl-6 py-4">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12 border-2 border-gray-800 shadow-sm">
                        <AvatarImage src={partner.avatar || ''} className="object-cover" />
                        <AvatarFallback className="bg-gray-800 text-gray-400 font-bold">{partner.name?.charAt(0).toUpperCase() || 'D'}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-bold text-white text-base">{partner.name}</span>
                        <span className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <Phone className="h-3 w-3" /> {partner.phone}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="flex flex-col text-sm text-gray-300 gap-1">
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-blue-500" />
                        <span className="capitalize font-medium text-gray-200">{partner.vehicle || 'Unknown'}</span>
                      </div>
                      <span className="text-xs text-gray-400 font-mono bg-gray-950 px-2 py-0.5 rounded-md w-fit border border-gray-800">
                        {partner.vehicleNumber}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center text-yellow-500 font-bold text-sm">
                          {partner.rating ? partner.rating.toFixed(1) : 'New'} <Award className="h-3.5 w-3.5 ml-1" />
                        </div>
                        <span className="text-xs text-gray-500">Rating</span>
                      </div>
                      <span className="text-xs text-gray-300">{partner.completedDeliveries || 0} Successful Deliveries</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full w-fit border text-xs font-semibold ${partner.isAvailable
                      ? 'bg-green-500/10 text-green-400 border-green-500/20'
                      : 'bg-gray-800/50 text-gray-500 border-gray-700'
                      }`}>
                      <div className={`h-2 w-2 rounded-full ${partner.isAvailable ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
                      {partner.isAvailable ? 'ONLINE' : 'OFFLINE'}
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-6 py-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-gray-900 border-gray-800 text-gray-300 w-56 shadow-xl">
                        <DropdownMenuLabel className="text-xs uppercase text-gray-500 tracking-wider px-3 py-2">Fleet Management</DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-gray-800" />
                        <DropdownMenuItem onClick={() => setSelectedPartner(partner)} className="hover:bg-blue-900/20 hover:text-blue-400 cursor-pointer py-2 focus:bg-blue-900/20 focus:text-blue-400">
                          <User className="mr-3 h-4 w-4" /> View Full Profile
                        </DropdownMenuItem>

                        {partner.vehicleImage && (
                          <DropdownMenuItem onClick={() => handleViewDocument(partner.vehicleImage, `${partner.name}'s RC`)} className="hover:bg-gray-800 cursor-pointer py-2">
                            <Eye className="mr-3 h-4 w-4" /> View Vehicle RC
                          </DropdownMenuItem>
                        )}

                        {partner.drivingLicense && (
                          <DropdownMenuItem onClick={() => handleViewDocument(partner.drivingLicense, `${partner.name}'s License`)} className="hover:bg-gray-800 cursor-pointer py-2">
                            <FileText className="mr-3 h-4 w-4" /> View Driving License
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuItem onClick={() => togglePartnerStatus(partner.id!, partner.isAvailable!)} className="hover:bg-gray-800 hover:text-white cursor-pointer py-2">
                          {partner.isAvailable ? (
                            <><XCircle className="mr-3 h-4 w-4 text-orange-500" /> Force Offline</>
                          ) : (
                            <><CheckCircle className="mr-3 h-4 w-4 text-green-500" /> Force Online</>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-gray-800" />
                        <DropdownMenuItem onClick={() => deletePartner(partner.id!)} className="text-red-400 hover:text-red-300 hover:bg-red-950/30 cursor-pointer py-2 focus:bg-red-950/30">
                          <Trash2 className="mr-3 h-4 w-4" /> Remove Partner
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Partner Details Dialog */}
      <Dialog open={!!selectedPartner} onOpenChange={(open) => !open && setSelectedPartner(null)}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-[600px] p-0 overflow-hidden gap-0 shadow-2xl">
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-6 border-b border-gray-800 relative overflow-hidden">
            {/* Background enhancement */}
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Truck size={120} />
            </div>

            <div className="flex items-start justify-between relative z-10">
              <div className="flex items-center gap-5">
                <Avatar className="h-20 w-20 border-4 border-gray-900 shadow-xl">
                  <AvatarImage src={selectedPartner?.avatar} className="object-cover" />
                  <AvatarFallback className="bg-gray-800 text-2xl font-bold">{selectedPartner?.name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <DialogTitle className="text-3xl font-bold text-white mb-1 tracking-tight">{selectedPartner?.name}</DialogTitle>
                  <div className="flex items-center gap-3 text-sm text-gray-400">
                    <span className="flex items-center gap-1.5 bg-gray-800/50 px-2 py-0.5 rounded"><Phone className="h-3.5 w-3.5" /> {selectedPartner?.phone}</span>
                  </div>
                </div>
              </div>
              <Badge
                variant={selectedPartner?.isAvailable ? 'default' : 'secondary'}
                className={`px-3 py-1 text-sm font-medium border-0 ${selectedPartner?.isAvailable ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' : 'bg-gray-700 text-gray-300'}`}
              >
                {selectedPartner?.isAvailable ? 'Active Now' : 'Offline'}
              </Badge>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3 bg-gray-800/30 border border-gray-800 rounded-lg text-center">
                <div className="text-gray-500 text-[10px] uppercase font-bold tracking-widest mb-1">Deliveries</div>
                <div className="text-xl font-bold text-white">{selectedPartner?.completedDeliveries || 0}</div>
              </div>
              <div className="p-3 bg-gray-800/30 border border-gray-800 rounded-lg text-center">
                <div className="text-gray-500 text-[10px] uppercase font-bold tracking-widest mb-1">Rating</div>
                <div className="text-xl font-bold text-yellow-400 flex items-center justify-center gap-1">
                  {selectedPartner?.rating?.toFixed(1) || '-'}
                </div>
              </div>
              <div className="p-3 bg-gray-800/30 border border-gray-800 rounded-lg text-center">
                <div className="text-gray-500 text-[10px] uppercase font-bold tracking-widest mb-1">Vehicle</div>
                <div className="text-lg font-bold text-white capitalize">{selectedPartner?.vehicle || 'N/A'}</div>
              </div>
              <div className="p-3 bg-gray-800/30 border border-gray-800 rounded-lg text-center">
                <div className="text-gray-500 text-[10px] uppercase font-bold tracking-widest mb-1">Plate Info</div>
                <div className="text-sm font-bold text-gray-300 font-mono pt-1">{selectedPartner?.vehicleNumber || 'N/A'}</div>
              </div>
            </div>

            {/* Document Quick Access in Details */}
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                className="w-full bg-gray-900 border-gray-700 text-blue-400 hover:text-white hover:bg-blue-600 hover:border-blue-600 transition-all"
                onClick={() => handleViewDocument(selectedPartner?.vehicleImage, 'Vehicle Registration')}
                disabled={!selectedPartner?.vehicleImage}
              >
                <Eye className="w-4 h-4 mr-2" /> View RC Document
              </Button>
              <Button
                variant="outline"
                className="w-full bg-gray-900 border-gray-700 text-blue-400 hover:text-white hover:bg-blue-600 hover:border-blue-600 transition-all"
                onClick={() => handleViewDocument(selectedPartner?.drivingLicense, 'Driving License')}
                disabled={!selectedPartner?.drivingLicense}
              >
                <FileText className="w-4 h-4 mr-2" /> View License
              </Button>
            </div>

            <div className="space-y-4 pt-2 border-t border-gray-800">
              <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                Account Actions
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  onClick={() => togglePartnerStatus(selectedPartner?.id!, selectedPartner?.isAvailable!)}
                  className={`w-full ${selectedPartner?.isAvailable ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                >
                  {selectedPartner?.isAvailable ? <><XCircle className="w-4 h-4 mr-2" /> Force Offline</> : <><CheckCircle className="w-4 h-4 mr-2" /> Mark Available</>}
                </Button>

                <Button
                  onClick={() => deletePartner(selectedPartner?.id!)}
                  className="w-full bg-red-900/50 hover:bg-red-900 text-red-200 border border-red-900"
                  variant="outline"
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Delete Account
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DOCUMENT VIEWER DIALOG - FULL SCREEN */}
      <Dialog open={!!viewingDoc} onOpenChange={(open) => !open && setViewingDoc(null)}>
        <DialogContent className="bg-black/95 border-gray-800 text-white w-[95vw] h-[95vh] max-w-none p-0 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                {viewingDoc?.type === 'pdf' ? <FileText className="h-5 w-5 text-white" /> : <Eye className="h-5 w-5 text-white" />}
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">{viewingDoc?.title}</DialogTitle>
                <p className="text-xs text-gray-400">Reviewing submitted document</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setViewingDoc(null)} className="hover:bg-gray-800 rounded-full">
              <X className="h-6 w-6" />
            </Button>
          </div>

          <div className="flex-1 bg-neutral-900 relative overflow-hidden flex items-center justify-center">
            {viewingDoc ? (
              viewingDoc.type === 'pdf' ? (
                <div className="w-full h-full flex flex-col">
                  <iframe
                    src={viewingDoc.url}
                    className="w-full h-full flex-1 border-none bg-white"
                    title="PDF Document Viewer"
                  />
                  <div className="bg-gray-900 border-t border-gray-800 p-2 text-center text-xs text-gray-500">
                    If the document doesn't load, <a href={viewingDoc.url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">click here to open it directly</a>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
                  <img
                    src={viewingDoc.url}
                    alt="Document"
                    className="max-w-full max-h-none object-contain shadow-2xl"
                    style={{ minWidth: '50%' }}
                  />
                </div>
              )
            ) : (
              <div className="text-gray-500">No document loaded</div>
            )}
          </div>

          <DialogFooter className="p-4 border-t border-gray-800 bg-gray-900">
            <Button variant="outline" onClick={() => setViewingDoc(null)} className="border-gray-700 hover:bg-gray-800 text-white">
              Close Viewer
            </Button>
            {viewingDoc && (
              <Button onClick={() => window.open(viewingDoc.url, '_blank')} className="bg-blue-600 hover:bg-blue-700">
                Open Original
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
