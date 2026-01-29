'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRestaurantAuth } from '@/context/RestaurantAuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { collection, query, where, getDocs, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { SupportTicket } from '@/lib/types';
import {
  Settings as SettingsIcon,
  Store,
  Clock,
  DollarSign,
  Bell,
  HelpCircle,
  Send,
  CheckCircle,
  AlertCircle,
  Loader2,
  Tag,
  Landmark,
  MapPin,
  Phone,
  Mail,
  Home,
  Truck,
  TrendingUp,
  MessageSquare,
  Reply,
  RefreshCw,
  X
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';

export default function RestaurantSettingsPage() {
  const router = useRouter();
  const { user, restaurant, loading: authLoading } = useRestaurantAuth();

  const [loading, setLoading] = useState(false);
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
  const [ticketSuccessDialog, setTicketSuccessDialog] = useState(false);
  const [submittingTicket, setSubmittingTicket] = useState(false);

  // Enhanced support ticket states
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [viewRepliesDialog, setViewRepliesDialog] = useState(false);
  const [addReplyDialog, setAddReplyDialog] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');

  // Restaurant Settings with structured address
  const [settings, setSettings] = useState({
    restaurantName: '',
    description: '',
    phone: '',
    email: '',
    // Structured address
    street: '',
    city: '',
    state: '',
    pincode: '',
    latitude: null as number | null,
    longitude: null as number | null,
    // Operations
    minimumOrder: '',
    deliveryCharge: '',
    deliveryTime: '',
    isOpen: true,
    acceptingOrders: true,
  });

  // Bank Account Details
  const [bankDetails, setBankDetails] = useState({
    bankName: '',
    accountHolderName: '',
    accountNumber: '',
    ifscCode: '',
  });
  const [savingBank, setSavingBank] = useState(false);

  // Support Ticket Form
  const [newTicket, setNewTicket] = useState({
    subject: '',
    category: 'other' as 'technical' | 'billing' | 'order' | 'account' | 'feature' | 'other',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    description: '',
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/restaurant/login');
      return;
    }
    loadSettings();
    loadSupportTickets();
  }, [user, authLoading, router, restaurant]);

  const loadSettings = () => {
    if (restaurant) {
      setSettings({
        restaurantName: restaurant.name || '',
        description: restaurant.description || '',
        phone: restaurant.phone || '',
        email: restaurant.email || '',
        // Load structured address or fallback to old address field
        street: restaurant.street || restaurant.address || '',
        city: restaurant.city || '',
        state: restaurant.state || '',
        pincode: restaurant.pincode || '',
        latitude: restaurant.latitude || null,
        longitude: restaurant.longitude || null,
        minimumOrder: restaurant.minimumOrder?.toString() || '',
        deliveryCharge: restaurant.deliveryCharge?.toString() || '',
        deliveryTime: restaurant.deliveryTime?.toString() || '',
        isOpen: restaurant.isOpen ?? true,
        acceptingOrders: restaurant.isActive ?? true,
      });
    }
    // Load bank details
    if (restaurant?.bankDetails) {
      setBankDetails({
        bankName: restaurant.bankDetails.bankName || '',
        accountHolderName: restaurant.bankDetails.accountHolderName || '',
        accountNumber: restaurant.bankDetails.accountNumber || '',
        ifscCode: restaurant.bankDetails.ifscCode || '',
      });
    }
  };

  const loadSupportTickets = async () => {
    try {
      const ticketsRef = collection(db, 'supportTickets');
      const q = query(ticketsRef, where('userId', '==', user!.uid));
      const snapshot = await getDocs(q);

      const tickets = snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
      })) as SupportTicket[];

      setSupportTickets(tickets.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ));
    } catch (error) {
      console.error('[Settings] Error loading tickets:', error);
    }
  };

  // Pincode Auto-Fill Functionality with Lat/Long
  const fetchCityStateFromPincode = async (pincode: string) => {
    if (pincode.length !== 6 || !/^\d{6}$/.test(pincode)) {
      return;
    }

    try {
      setPincodeLoading(true);

      // Fetch city/state from India POST API
      const postResponse = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      const postData = await postResponse.json();

      let city = '';
      let state = '';

      if (postData[0].Status === 'Success' && postData[0].PostOffice && postData[0].PostOffice.length > 0) {
        const postOffice = postData[0].PostOffice[0];
        city = postOffice.District;
        state = postOffice.State;
      }

      // Fetch lat/long from Nominatim (OpenStreetMap)
      const geoResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?postalcode=${pincode}&country=India&format=json&limit=1`,
        { headers: { 'User-Agent': 'AKR-Hunger-Platform' } }
      );
      const geoData = await geoResponse.json();

      let latitude: number | null = null;
      let longitude: number | null = null;

      if (geoData && geoData.length > 0) {
        latitude = parseFloat(geoData[0].lat);
        longitude = parseFloat(geoData[0].lon);
      }

      setSettings(prev => ({
        ...prev,
        city,
        state,
        latitude,
        longitude
      }));

      toast.success('Location details auto-filled!');
    } catch (error) {
      console.error('[Settings] Error fetching location data:', error);
      toast.error('Failed to fetch location data');
    } finally {
      setPincodeLoading(false);
    }
  };

  const saveBankDetails = async () => {
    try {
      setSavingBank(true);
      const restaurantRef = doc(db, 'restaurants', user!.uid);
      await updateDoc(restaurantRef, {
        bankDetails: {
          ...bankDetails,
          updatedAt: new Date(),
        },
      });
      toast.success('Bank details saved successfully!');
    } catch (error) {
      console.error('[Settings] Error saving bank details:', error);
      toast.error('Failed to save bank details');
    } finally {
      setSavingBank(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setLoading(true);

      // Create full address string for backward compatibility
      const fullAddress = `${settings.street}, ${settings.city}, ${settings.state} - ${settings.pincode}`;

      await updateDoc(doc(db, 'restaurants', user!.uid), {
        name: settings.restaurantName,
        description: settings.description,
        phone: settings.phone,
        email: settings.email,
        // Save both structured and full address
        address: fullAddress,
        street: settings.street,
        city: settings.city,
        state: settings.state,
        pincode: settings.pincode,
        latitude: settings.latitude,
        longitude: settings.longitude,
        minimumOrder: parseFloat(settings.minimumOrder) || 0,
        deliveryCharge: parseFloat(settings.deliveryCharge) || 0,
        deliveryTime: parseInt(settings.deliveryTime) || 30,
        isOpen: settings.isOpen,
        isActive: settings.acceptingOrders,
        updatedAt: new Date(),
      });

      toast.success('Settings saved successfully!');
    } catch (error) {
      console.error('[Settings] Error saving:', error);
      toast.error('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

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
      });

      setNewTicket({
        subject: '',
        category: 'other',
        priority: 'medium',
        description: '',
      });

      setTicketDialogOpen(false);
      await loadSupportTickets();
      setTicketSuccessDialog(true);
    } catch (error) {
      console.error('[Settings] Error submitting ticket:', error);
      toast.error('Failed to submit ticket');
    } finally {
      setSubmittingTicket(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/50';
      case 'in_progress':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50';
      case 'resolved':
        return 'bg-green-500/20 text-green-300 border-green-500/50';
      case 'closed':
        return 'bg-gray-500/20 text-gray-300 border-gray-500/50';
      default:
        return 'bg-gray-500/20 text-gray-300';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Support Ticket Actions
  const viewReplies = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setViewRepliesDialog(true);
  };

  const openReplyDialog = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setAddReplyDialog(true);
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
      const currentReplies = selectedTicket.replies || [];

      await updateDoc(ticketRef, {
        replies: [...currentReplies, reply],
        status: 'in_progress',
        updatedAt: new Date()
      });

      setReplyMessage('');
      setAddReplyDialog(false);
      await loadSupportTickets();
      toast.success('Reply added!');
    } catch (error) {
      console.error('[Settings] Error adding reply:', error);
      toast.error('Failed to add reply');
    }
  };

  const reopenTicket = async (ticketId: string) => {
    try {
      await updateDoc(doc(db, 'supportTickets', ticketId), {
        status: 'open',
        updatedAt: new Date()
      });
      await loadSupportTickets();
      toast.success('Ticket reopened');
    } catch (error) {
      console.error('[Settings] Error reopening ticket:', error);
      toast.error('Failed to reopen ticket');
    }
  };

  const closeTicket = async (ticketId: string) => {
    try {
      await updateDoc(doc(db, 'supportTickets', ticketId), {
        status: 'closed',
        closedAt: new Date(),
        updatedAt: new Date()
      });
      await loadSupportTickets();
      toast.success('Ticket closed');
    } catch (error) {
      console.error('[Settings] Error closing ticket:', error);
      toast.error('Failed to close ticket');
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <Spinner className="w-8 h-8 text-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-4 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold text-white flex items-center gap-3">
            <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/30">
              <SettingsIcon className="w-8 h-8 text-white" />
            </div>
            Settings
          </h1>
          <p className="text-gray-400 mt-2 text-lg font-medium">Manage your restaurant settings and preferences</p>
        </div>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 gap-2 bg-gray-900/50 p-2 rounded-xl border border-gray-800">
          <TabsTrigger
            value="general"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-600 data-[state=active]:to-orange-700 data-[state=active]:text-white data-[state=active]:shadow-lg text-gray-400 font-semibold"
          >
            <Store className="w-4 h-4 mr-2" />
            General
          </TabsTrigger>
          <TabsTrigger
            value="operations"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-600 data-[state=active]:to-orange-700 data-[state=active]:text-white data-[state=active]:shadow-lg text-gray-400 font-semibold"
          >
            <Truck className="w-4 h-4 mr-2" />
            Operations
          </TabsTrigger>
          <TabsTrigger
            value="bank"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-600 data-[state=active]:to-orange-700 data-[state=active]:text-white data-[state=active]:shadow-lg text-gray-400 font-semibold"
          >
            <Landmark className="w-4 h-4 mr-2" />
            Bank
          </TabsTrigger>
          <TabsTrigger
            value="notifications"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-600 data-[state=active]:to-orange-700 data-[state=active]:text-white data-[state=active]:shadow-lg text-gray-400 font-semibold"
          >
            <Bell className="w-4 h-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger
            value="support"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-600 data-[state=active]:to-orange-700 data-[state=active]:text-white data-[state=active]:shadow-lg text-gray-400 font-semibold"
          >
            <HelpCircle className="w-4 h-4 mr-2" />
            Support
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-6">
          <Card className="p-6 bg-gray-900/50 border-gray-800 backdrop-blur-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                <Store className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Restaurant Information</h2>
                <p className="text-sm text-gray-400 font-medium">Your business details and contact information</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="restaurantName" className="text-white font-semibold">Restaurant Name *</Label>
                <Input
                  id="restaurantName"
                  value={settings.restaurantName}
                  onChange={(e) => setSettings({ ...settings, restaurantName: e.target.value })}
                  placeholder="Your Restaurant Name"
                  className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-white font-semibold">Description</Label>
                <Textarea
                  id="description"
                  value={settings.description}
                  onChange={(e) => setSettings({ ...settings, description: e.target.value })}
                  placeholder="Brief description about your restaurant..."
                  rows={3}
                  className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-white font-semibold flex items-center gap-2">
                    <Phone className="w-4 h-4 text-orange-500" />
                    Phone Number *
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={settings.phone}
                    onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                    placeholder="+91 XXXXX XXXXX"
                    className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 h-12"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white font-semibold flex items-center gap-2">
                    <Mail className="w-4 h-4 text-orange-500" />
                    Email *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={settings.email}
                    onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                    placeholder="restaurant@example.com"
                    className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 h-12"
                  />
                </div>
              </div>

              {/* Structured Address Section */}
              <div className="pt-4 border-t border-gray-800">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-5 h-5 text-orange-500" />
                  <h3 className="text-lg font-bold text-white">Restaurant Address</h3>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="street" className="text-white font-semibold">Street Address *</Label>
                    <Input
                      id="street"
                      value={settings.street}
                      onChange={(e) => setSettings({ ...settings, street: e.target.value })}
                      placeholder="Building No., Street Name, Area"
                      className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 h-12"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="pincode" className="text-white font-semibold flex items-center gap-2">
                        Pincode *
                        {pincodeLoading && <Loader2 className="w-4 h-4 text-orange-500 animate-spin" />}
                      </Label>
                      <Input
                        id="pincode"
                        value={settings.pincode}
                        onChange={(e) => setSettings({ ...settings, pincode: e.target.value })}
                        onBlur={(e) => fetchCityStateFromPincode(e.target.value)}
                        placeholder="400001"
                        maxLength={6}
                        className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 h-12"
                      />
                      <p className="text-xs text-gray-500">City & State will auto-fill</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="city" className="text-white font-semibold">City *</Label>
                      <Input
                        id="city"
                        value={settings.city}
                        onChange={(e) => setSettings({ ...settings, city: e.target.value })}
                        placeholder="City"
                        className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 h-12"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="state" className="text-white font-semibold">State *</Label>
                    <Input
                      id="state"
                      value={settings.state}
                      onChange={(e) => setSettings({ ...settings, state: e.target.value })}
                      placeholder="State"
                      className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 h-12"
                    />
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <div className="flex justify-end">
            <Button
              onClick={handleSaveSettings}
              disabled={loading}
              className="bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white font-bold shadow-lg shadow-orange-500/30 h-12 px-8"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </TabsContent>

        {/* Operations Settings */}
        <TabsContent value="operations" className="space-y-6">
          <Card className="p-6 bg-gray-900/50 border-gray-800 backdrop-blur-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <Truck className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Delivery Settings</h2>
                <p className="text-sm text-gray-400 font-medium">Configure delivery parameters</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minimumOrder" className="text-white font-semibold flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-500" />
                  Minimum Order (₹)
                </Label>
                <Input
                  id="minimumOrder"
                  type="number"
                  value={settings.minimumOrder}
                  onChange={(e) => setSettings({ ...settings, minimumOrder: e.target.value })}
                  placeholder="0"
                  className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="deliveryCharge" className="text-white font-semibold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-orange-500" />
                  Delivery Charge (₹)
                </Label>
                <Input
                  id="deliveryCharge"
                  type="number"
                  value={settings.deliveryCharge}
                  onChange={(e) => setSettings({ ...settings, deliveryCharge: e.target.value })}
                  placeholder="0"
                  className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="deliveryTime" className="text-white font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-500" />
                  Delivery Time (min)
                </Label>
                <Input
                  id="deliveryTime"
                  type="number"
                  value={settings.deliveryTime}
                  onChange={(e) => setSettings({ ...settings, deliveryTime: e.target.value })}
                  placeholder="30"
                  className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 h-12"
                />
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gray-900/50 border-gray-800 backdrop-blur-sm shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4">Restaurant Status</h2>
            <div className="space-y-3">
              <label className="flex items-center justify-between p-4 bg-gray-800/50 border border-gray-700 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${settings.isOpen ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
                  <div>
                    <p className="font-semibold text-white">Restaurant Open</p>
                    <p className="text-sm text-gray-400">Visible to customers for ordering</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.isOpen}
                  onChange={(e) => setSettings({ ...settings, isOpen: e.target.checked })}
                  className="w-5 h-5 accent-orange-600"
                />
              </label>

              <label className="flex items-center justify-between p-4 bg-gray-800/50 border border-gray-700 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors">
                <div className="flex items-center gap-3">
                  <CheckCircle className={`w-6 h-6 ${settings.acceptingOrders ? 'text-green-500' : 'text-gray-500'}`} />
                  <div>
                    <p className="font-semibold text-white">Accepting Orders</p>
                    <p className="text-sm text-gray-400">Enable or disable new order acceptance</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.acceptingOrders}
                  onChange={(e) => setSettings({ ...settings, acceptingOrders: e.target.checked })}
                  className="w-5 h-5 accent-orange-600"
                />
              </label>
            </div>
          </Card>

          <div className="flex justify-end">
            <Button
              onClick={handleSaveSettings}
              disabled={loading}
              className="bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white font-bold shadow-lg shadow-orange-500/30 h-12 px-8"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </TabsContent>

        {/* Bank Account Settings */}
        <TabsContent value="bank" className="space-y-6">
          <Card className="p-6 bg-gray-900/50 border-gray-800 backdrop-blur-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg">
                <Landmark className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Bank Account Details</h2>
                <p className="text-sm text-gray-400 font-medium">Add your bank details for payment settlements</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bankName" className="text-white font-semibold">Bank Name *</Label>
                <Input
                  id="bankName"
                  value={bankDetails.bankName}
                  onChange={(e) => setBankDetails({ ...bankDetails, bankName: e.target.value })}
                  placeholder="e.g., State Bank of India"
                  className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="accountHolderName" className="text-white font-semibold">Account Holder Name *</Label>
                <Input
                  id="accountHolderName"
                  value={bankDetails.accountHolderName}
                  onChange={(e) => setBankDetails({ ...bankDetails, accountHolderName: e.target.value })}
                  placeholder="As per bank records"
                  className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 h-12"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="accountNumber" className="text-white font-semibold">Account Number *</Label>
                  <Input
                    id="accountNumber"
                    value={bankDetails.accountNumber}
                    onChange={(e) => setBankDetails({ ...bankDetails, accountNumber: e.target.value })}
                    placeholder="XXXXXXXXXXXX"
                    type="text"
                    className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 h-12"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ifscCode" className="text-white font-semibold">IFSC Code *</Label>
                  <Input
                    id="ifscCode"
                    value={bankDetails.ifscCode}
                    onChange={(e) => setBankDetails({ ...bankDetails, ifscCode: e.target.value.toUpperCase() })}
                    placeholder="e.g., SBIN0001234"
                    className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 h-12"
                  />
                </div>
              </div>

              {bankDetails.bankName && bankDetails.accountNumber && (
                <div className="mt-6 p-4 bg-green-900/20 border border-green-700/30 rounded-xl">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                    <div>
                      <p className="text-white font-semibold">Bank Details Configured</p>
                      <p className="text-sm text-gray-300 mt-1">
                        {bankDetails.accountHolderName} • {bankDetails.bankName}
                      </p>
                      <p className="text-sm text-gray-400 font-mono">
                        {bankDetails.accountNumber.replace(/./g, (c, i) => i < bankDetails.accountNumber.length - 4 ? '•' : c)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6">
              <Button
                onClick={saveBankDetails}
                disabled={savingBank || !bankDetails.bankName || !bankDetails.accountNumber || !bankDetails.ifscCode}
                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold shadow-lg h-12 px-8"
              >
                {savingBank && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Bank Details
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* Notifications Settings */}
        <TabsContent value="notifications" className="space-y-6">
          <Card className="p-6 bg-gray-900/50 border-gray-800 backdrop-blur-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Bell className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Notification Preferences</h2>
                <p className="text-sm text-gray-400 font-medium">Manage your notification settings</p>
              </div>
            </div>

            <div className="space-y-3">
              {[
                { label: 'New Orders', desc: 'Get notified for new orders', defaultChecked: true },
                { label: 'Menu Approvals', desc: 'Approved/rejected menu items', defaultChecked: true },
                { label: 'Customer Reviews', desc: 'New reviews from customers', defaultChecked: true },
                { label: 'Platform Updates', desc: 'New features and announcements', defaultChecked: true },
              ].map((item, idx) => (
                <label key={idx} className="flex items-center justify-between p-4 bg-gray-800/50 border border-gray-700 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors">
                  <div>
                    <p className="font-semibold text-white">{item.label}</p>
                    <p className="text-sm text-gray-400">{item.desc}</p>
                  </div>
                  <input type="checkbox" defaultChecked={item.defaultChecked} className="w-5 h-5 accent-orange-600" />
                </label>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Support Tab */}
        <TabsContent value="support" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-white">Support Tickets</h2>
              <p className="text-sm text-gray-400">Need help? Create a support ticket</p>
            </div>
            <Dialog open={ticketDialogOpen} onOpenChange={setTicketDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white font-semibold shadow-lg">
                  <HelpCircle className="w-4 h-4 mr-2" />
                  New Ticket
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl bg-gray-900 border-gray-800">
                <DialogHeader>
                  <DialogTitle className="text-white">Create Support Ticket</DialogTitle>
                  <DialogDescription className="text-gray-400">
                    Describe your issue and our support team will get back to you
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="subject" className="text-white">Subject *</Label>
                    <Input
                      id="subject"
                      placeholder="Brief description of the issue"
                      value={newTicket.subject}
                      onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                      className="bg-gray-800/50 border-gray-700 text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="category" className="text-white">Category</Label>
                      <select
                        id="category"
                        value={newTicket.category}
                        onChange={(e) => setNewTicket({ ...newTicket, category: e.target.value as any })}
                        className="w-full p-2 bg-gray-800/50 border-gray-700 rounded-md text-white h-10 border"
                      >
                        <option value="technical">Technical Issue</option>
                        <option value="billing">Billing</option>
                        <option value="order">Order Related</option>
                        <option value="account">Account</option>
                        <option value="feature">Feature Request</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="priority" className="text-white">Priority</Label>
                      <select
                        id="priority"
                        value={newTicket.priority}
                        onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value as any })}
                        className="w-full p-2 bg-gray-800/50 border-gray-700 rounded-md text-white h-10 border"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-white">Description *</Label>
                    <Textarea
                      id="description"
                      placeholder="Provide detailed information about your issue..."
                      value={newTicket.description}
                      onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                      rows={5}
                      className="bg-gray-800/50 border-gray-700 text-white"
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setTicketDialogOpen(false)} className="border-gray-700 text-white">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmitTicket}
                    disabled={submittingTicket}
                    className="bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white"
                  >
                    {submittingTicket && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Send className="w-4 h-4 mr-2" />
                    Submit Ticket
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-3">
            {supportTickets.length === 0 ? (
              <Card className="p-12 text-center bg-gray-900/50 border-gray-800">
                <HelpCircle className="w-16 h-16 mx-auto text-gray-600 mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">No support tickets yet</h3>
                <p className="text-gray-400 mb-4">Create a ticket if you need help</p>
              </Card>
            ) : (
              supportTickets.map((ticket) => (
                <Card key={ticket.id} className="p-4 bg-gray-900/50 border-gray-800 hover:bg-gray-900/80 transition">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-white">{ticket.subject}</h3>
                        <Badge className={getStatusColor(ticket.status) + ' border'}>
                          {ticket.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-400 line-clamp-2">{ticket.description}</p>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${getPriorityColor(ticket.priority)} ml-4 shrink-0`} />
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-500 mt-3">
                    <span className="flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      {ticket.category}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {ticket.replies?.length || 0} replies
                    </span>
                  </div>

                  {ticket.adminResponse && (
                    <div className="mt-3 p-3 bg-blue-900/20 border-l-4 border-blue-500 rounded">
                      <p className="text-sm font-medium text-blue-300 mb-1">Admin Response:</p>
                      <p className="text-sm text-blue-200">{ticket.adminResponse}</p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2 mt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => viewReplies(ticket)}
                      className="border-gray-700 text-white hover:bg-gray-800"
                    >
                      <MessageSquare className="w-4 h-4 mr-1" />
                      View Replies ({ticket.replies?.length || 0})
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => openReplyDialog(ticket)}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Reply className="w-4 h-4 mr-1" />
                      Add Reply
                    </Button>

                    {ticket.status === 'closed' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => reopenTicket(ticket.id!)}
                        className="border-gray-700 text-white hover:bg-gray-800"
                      >
                        <RefreshCw className="w-4 h-4 mr-1" />
                        Reopen
                      </Button>
                    )}

                    {ticket.status !== 'closed' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => closeTicket(ticket.id!)}
                        className="border-red-700 text-red-400 hover:bg-red-900/20"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Close
                      </Button>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Ticket Success Dialog */}
      <Dialog open={ticketSuccessDialog} onOpenChange={setTicketSuccessDialog}>
        <DialogContent className="max-w-md bg-gray-900 border-gray-800">
          <div className="flex flex-col items-center text-center py-6">
            <div className="w-16 h-16 bg-green-900/20 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-10 h-10 text-green-400" />
            </div>
            <DialogTitle className="text-2xl font-bold text-white mb-2">Ticket Submitted!</DialogTitle>
            <DialogDescription className="text-base text-gray-400">
              Your support ticket has been submitted successfully. Our team will review it and get back to you soon.
            </DialogDescription>
            <Button
              onClick={() => setTicketSuccessDialog(false)}
              className="mt-6 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white"
            >
              Got it!
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Replies Dialog */}
      <Dialog open={viewRepliesDialog} onOpenChange={setViewRepliesDialog}>
        <DialogContent className="max-w-3xl bg-gray-900 border-gray-800 max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-white text-xl">
              {selectedTicket?.subject} - Replies
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              View all replies for this ticket
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {selectedTicket && selectedTicket.replies && selectedTicket.replies.length > 0 ? (
              selectedTicket.replies.map((reply) => (
                <div
                  key={reply.id}
                  className={`p-4 rounded-lg ${reply.userType === 'admin'
                      ? 'bg-blue-900/20 border-l-4 border-blue-500'
                      : 'bg-gray-800/50 border-l-4 border-orange-500'
                    }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{reply.userName}</span>
                      {reply.userType === 'admin' && (
                        <Badge className="bg-blue-600 text-white">Admin</Badge>
                      )}
                      {reply.userType === 'restaurant' && (
                        <Badge className="bg-orange-600 text-white">You</Badge>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(reply.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-gray-300 whitespace-pre-wrap">{reply.message}</p>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No replies yet</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setViewRepliesDialog(false)}
              className="border-gray-700 text-white"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Reply Dialog */}
      <Dialog open={addReplyDialog} onOpenChange={setAddReplyDialog}>
        <DialogContent className="max-w-2xl bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">Add Reply to Ticket</DialogTitle>
            <DialogDescription className="text-gray-400">
              {selectedTicket?.subject}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Textarea
              value={replyMessage}
              onChange={(e) => setReplyMessage(e.target.value)}
              placeholder="Type your reply here..."
              rows={6}
              className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddReplyDialog(false);
                setReplyMessage('');
              }}
              className="border-gray-700 text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={submitReply}
              disabled={!replyMessage.trim()}
              className="bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white"
            >
              <Send className="w-4 h-4 mr-2" />
              Send Reply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
