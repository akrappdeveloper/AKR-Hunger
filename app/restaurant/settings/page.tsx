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
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { uploadToImgBB } from '@/lib/imgbb';
import {
  Settings as SettingsIcon,
  Store,
  Clock,
  DollarSign,
  Bell,
  CheckCircle,
  Loader2,
  Landmark,
  MapPin,
  Phone,
  Mail,
  Truck,
  TrendingUp,
  Image as ImageIcon,
  Save,
  Globe,
  UploadCloud,
  Map,
  Plus,
  Trash2,
  Navigation
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';

// Reusable Components for Consistency
const SectionHeader = ({ icon: Icon, title, description, colorClass }: { icon: any, title: string, description: string, colorClass: string }) => (
  <div className="flex items-start md:items-center gap-4 mb-8">
    <div className={`w-12 h-12 ${colorClass} rounded-2xl flex items-center justify-center shadow-lg shrink-0`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
    <div>
      <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
      <p className="text-sm text-slate-400 font-medium">{description}</p>
    </div>
  </div>
);

const StyledInput = ({ icon: Icon, ...props }: any) => (
  <div className="relative group">
    {Icon && (
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-orange-500 transition-colors">
        <Icon className="w-5 h-5" />
      </div>
    )}
    <Input
      {...props}
      className={`bg-slate-950/50 border-slate-800 text-white placeholder:text-slate-600 focus:border-orange-500/50 focus:ring-orange-500/20 h-12 transition-all ${Icon ? 'pl-10' : ''}`}
    />
  </div>
);

export default function RestaurantSettingsPage() {
  const router = useRouter();
  const { user, restaurant, loading: authLoading } = useRestaurantAuth();

  const [loading, setLoading] = useState(false);
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Restaurant Settings State
  const [settings, setSettings] = useState({
    restaurantName: '',
    description: '',
    phone: '',
    email: '',
    street: '',
    city: '',
    state: '',
    pincode: '',
    latitude: null as number | null,
    longitude: null as number | null,
    minimumOrder: '',
    deliveryCharge: '',
    deliveryTime: '',
    isOpen: true,
    acceptingOrders: true,
    image: '',
    servicePincodes: [] as string[],
  });

  const [newServicePincode, setNewServicePincode] = useState('');

  // Bank Account State
  const [bankDetails, setBankDetails] = useState({
    bankName: '',
    accountHolderName: '',
    accountNumber: '',
    ifscCode: '',
  });
  const [savingBank, setSavingBank] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/restaurant/login');
      return;
    }
    loadSettings();
  }, [user, authLoading, router, restaurant]);

  const loadSettings = () => {
    if (restaurant) {
      setSettings({
        restaurantName: restaurant.name || '',
        description: restaurant.description || '',
        phone: restaurant.phone || '',
        email: restaurant.email || '',
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
        image: restaurant.image || '',
        servicePincodes: restaurant.servicePincodes || [],
      });
    }
    if (restaurant?.bankDetails) {
      setBankDetails({
        bankName: restaurant.bankDetails.bankName || '',
        accountHolderName: restaurant.bankDetails.accountHolderName || '',
        accountNumber: restaurant.bankDetails.accountNumber || '',
        ifscCode: restaurant.bankDetails.ifscCode || '',
      });
    }
  };

  const fetchCityStateFromPincode = async (pincode: string) => {
    if (pincode.length !== 6 || !/^\d{6}$/.test(pincode)) return;

    try {
      setPincodeLoading(true);
      const postResponse = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      const postData = await postResponse.json();

      let city = '';
      let state = '';

      if (postData[0].Status === 'Success' && postData[0].PostOffice?.length > 0) {
        city = postData[0].PostOffice[0].District;
        state = postData[0].PostOffice[0].State;
      }

      const geoResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?postalcode=${pincode}&country=India&format=json&limit=1`,
        { headers: { 'User-Agent': 'AKR-Hunger-Platform' } }
      );
      const geoData = await geoResponse.json();

      let latitude: number | null = null;
      let longitude: number | null = null;

      if (geoData?.length > 0) {
        latitude = parseFloat(geoData[0].lat);
        longitude = parseFloat(geoData[0].lon);
      }

      setSettings(prev => ({ ...prev, city, state, latitude, longitude }));
      toast.success('Location details auto-filled!');
    } catch (error) {
      console.error('[Settings] Error fetching location data:', error);
      toast.error('Failed to fetch location data');
    } finally {
      setPincodeLoading(false);
    }
  };

  const handleAddPincode = () => {
    if (!newServicePincode) return;
    if (newServicePincode.length !== 6 || !/^\d{6}$/.test(newServicePincode)) {
      toast.error("Please enter a valid 6-digit pincode");
      return;
    }
    if (settings.servicePincodes.includes(newServicePincode)) {
      toast.error("Pincode already added");
      return;
    }

    setSettings(prev => ({
      ...prev,
      servicePincodes: [...prev.servicePincodes, newServicePincode]
    }));
    setNewServicePincode('');
    toast.success("Service area added");
  };

  const handleRemovePincode = (code: string) => {
    setSettings(prev => ({
      ...prev,
      servicePincodes: prev.servicePincodes.filter(p => p !== code)
    }));
  };

  const saveBankDetails = async () => {
    try {
      setSavingBank(true);
      await updateDoc(doc(db, 'restaurants', user!.uid), {
        bankDetails: { ...bankDetails, updatedAt: new Date() },
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
      const fullAddress = `${settings.street}, ${settings.city}, ${settings.state} - ${settings.pincode}`;

      await updateDoc(doc(db, 'restaurants', user!.uid), {
        name: settings.restaurantName,
        description: settings.description,
        phone: settings.phone,
        email: settings.email,
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
        image: settings.image,
        servicePincodes: settings.servicePincodes,
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

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <Spinner className="w-8 h-8 text-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-20 selection:bg-orange-500/30">
      {/* Hero Header */}
      <div className="relative bg-slate-900/40 border-b border-slate-800 pt-8 pb-12 px-4 md:px-8 mb-8 backdrop-blur-md">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-orange-500/20 ring-1 ring-white/10">
                <SettingsIcon className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Settings</h1>
                <p className="text-slate-400 mt-1 text-lg">Manage your restaurant profile and preferences</p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-slate-950/80 p-2 rounded-xl border border-slate-800 self-start md:self-auto backdrop-blur-md">
              <div className={`px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 ${settings.isOpen ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                <div className={`w-2 h-2 rounded-full ${settings.isOpen ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                {settings.isOpen ? 'OPEN' : 'CLOSED'}
              </div>
              <div className="h-6 w-px bg-slate-800" />
              <div className={`px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 ${settings.acceptingOrders ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-800 text-slate-400'}`}>
                <Truck className="w-4 h-4" />
                {settings.acceptingOrders ? 'ONLINE' : 'PAUSED'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <Tabs defaultValue="service" className="space-y-8">
          <TabsList className="bg-slate-900/60 border border-slate-800 p-1.5 rounded-xl h-auto flex-wrap lg:flex-nowrap justify-start w-full backdrop-blur-md gap-1">
            <TabsTrigger value="general" className="flex-1 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-600 data-[state=active]:to-red-600 data-[state=active]:text-white text-slate-400 leading-none">
              <Store className="w-4 h-4 mr-2" /> General
            </TabsTrigger>
            <TabsTrigger value="operations" className="flex-1 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white text-slate-400 leading-none">
              <Truck className="w-4 h-4 mr-2" /> Operations
            </TabsTrigger>
            <TabsTrigger value="service" className="flex-1 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-pink-600 data-[state=active]:text-white text-slate-400 leading-none">
              <Map className="w-4 h-4 mr-2" /> Service Area
            </TabsTrigger>
            <TabsTrigger value="bank" className="flex-1 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-teal-600 data-[state=active]:text-white text-slate-400 leading-none">
              <Landmark className="w-4 h-4 mr-2" /> Bank Details
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex-1 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-slate-700 data-[state=active]:to-slate-600 data-[state=active]:text-white text-slate-400 leading-none">
              <Bell className="w-4 h-4 mr-2" /> Notifications
            </TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Logo & Basic Info */}
              <div className="lg:col-span-1 space-y-6">
                <Card className="p-6 bg-slate-900/40 border-slate-800 backdrop-blur-md">
                  <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-orange-500" /> Restaurant Logo
                  </h3>
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-40 h-40 rounded-full bg-slate-950 border-2 border-slate-800 overflow-hidden relative group shadow-xl">
                      {settings.image ? (
                        <img src={settings.image} alt="Logo" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                      ) : (
                        <div className="flex items-center justify-center w-full h-full text-slate-600">
                          <Store className="w-12 h-12" />
                        </div>
                      )}
                      {uploadingImage && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                        </div>
                      )}
                      <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer text-white text-xs font-bold uppercase tracking-wider">
                        <UploadCloud className="w-6 h-6 mb-1" />
                        Change Logo
                        <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setUploadingImage(true);
                          try {
                            const url = await uploadToImgBB(file);
                            setSettings(prev => ({ ...prev, image: url }));
                            toast.success("Logo uploaded!");
                          } catch (e) { toast.error("Upload failed"); }
                          finally { setUploadingImage(false); }
                        }} />
                      </label>
                    </div>
                    <p className="text-xs text-slate-500 text-center px-4">
                      Square image (PNG/JPG). Displays on customer app.
                    </p>
                  </div>
                </Card>
              </div>

              {/* Middle & Right Column: Details form */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="p-6 md:p-8 bg-slate-900/40 border-slate-800 backdrop-blur-md">
                  <SectionHeader
                    icon={Store}
                    title="Basic Information"
                    description="Your public restaurant profile details"
                    colorClass="bg-orange-600"
                  />
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-slate-300">Restaurant Name *</Label>
                        <StyledInput
                          placeholder="e.g. Spice Garden"
                          value={settings.restaurantName}
                          onChange={(e: any) => setSettings({ ...settings, restaurantName: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-300">Contact Phone *</Label>
                        <StyledInput
                          icon={Phone}
                          placeholder="+91 99999 99999"
                          value={settings.phone}
                          onChange={(e: any) => setSettings({ ...settings, phone: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-300">Email Address *</Label>
                      <StyledInput
                        icon={Mail}
                        placeholder="contact@restaurant.com"
                        value={settings.email}
                        onChange={(e: any) => setSettings({ ...settings, email: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-300">Description</Label>
                      <Textarea
                        className="bg-slate-950/50 border-slate-800 text-white min-h-[100px] focus:border-orange-500/50 placeholder:text-slate-600"
                        placeholder="Tell customers about your cuisine and specialties..."
                        value={settings.description}
                        onChange={(e) => setSettings({ ...settings, description: e.target.value })}
                      />
                    </div>
                  </div>
                </Card>

                <Card className="p-6 md:p-8 bg-slate-900/40 border-slate-800 backdrop-blur-md">
                  <SectionHeader
                    icon={MapPin}
                    title="Location & Address"
                    description="Accurate location ensures timely deliveries"
                    colorClass="bg-purple-600"
                  />
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label className="text-slate-300">Street Address *</Label>
                      <StyledInput
                        placeholder="Shop No, Building, Street"
                        value={settings.street}
                        onChange={(e: any) => setSettings({ ...settings, street: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2 relative">
                        <Label className="text-slate-300">Pincode *</Label>
                        <div className="relative">
                          <StyledInput
                            placeholder="400001"
                            maxLength={6}
                            value={settings.pincode}
                            onChange={(e: any) => setSettings({ ...settings, pincode: e.target.value })}
                            onBlur={(e: any) => fetchCityStateFromPincode(e.target.value)}
                          />
                          {pincodeLoading && <Loader2 className="absolute right-3 top-3.5 w-5 h-5 text-orange-500 animate-spin" />}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-300">City</Label>
                        <StyledInput
                          readOnly
                          className="bg-slate-900 opacity-60 cursor-not-allowed text-slate-400 border-slate-800"
                          value={settings.city}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-300">State</Label>
                        <StyledInput
                          readOnly
                          className="bg-slate-900 opacity-60 cursor-not-allowed text-slate-400 border-slate-800"
                          value={settings.state}
                        />
                      </div>
                    </div>

                    {settings.latitude && (
                      <div className="flex items-center gap-2 text-xs text-green-400 bg-green-900/20 p-3 rounded-lg border border-green-500/20">
                        <Globe className="w-4 h-4" />
                        Location Coordinates detected: {settings.latitude.toFixed(6)}, {settings.longitude?.toFixed(6)}
                      </div>
                    )}
                  </div>
                </Card>

                <div className="flex justify-end pt-4">
                  <Button
                    onClick={handleSaveSettings}
                    disabled={loading}
                    className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white shadow-lg h-12 px-8 rounded-xl font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Save Changes
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Operations Tab */}
          <TabsContent value="operations" className="space-y-6">
            <Card className="p-6 md:p-8 bg-slate-900/40 border-slate-800 backdrop-blur-md">
              <SectionHeader
                icon={Truck}
                title="Operations & Delivery"
                description="Configure your store timings and delivery parameters"
                colorClass="bg-blue-600"
              />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label className="text-slate-300">Minimum Order Value</Label>
                  <StyledInput
                    icon={DollarSign}
                    type="number"
                    placeholder="0"
                    value={settings.minimumOrder}
                    onChange={(e: any) => setSettings({ ...settings, minimumOrder: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Delivery Charge</Label>
                  <StyledInput
                    icon={TrendingUp}
                    type="number"
                    placeholder="0"
                    value={settings.deliveryCharge}
                    onChange={(e: any) => setSettings({ ...settings, deliveryCharge: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Avg. Delivery Time (mins)</Label>
                  <StyledInput
                    icon={Clock}
                    type="number"
                    placeholder="30"
                    value={settings.deliveryTime}
                    onChange={(e: any) => setSettings({ ...settings, deliveryTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 bg-slate-950/50 border border-slate-800 rounded-2xl hover:border-slate-700 transition-colors cursor-pointer group" onClick={() => setSettings({ ...settings, isOpen: !settings.isOpen })}>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${settings.isOpen ? 'bg-green-500/20 text-green-500' : 'bg-slate-800 text-slate-500'}`}>
                        <Store className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-white group-hover:text-green-400 transition-colors">Restaurant Open</h4>
                        <p className="text-sm text-slate-500">Visible on customer app</p>
                      </div>
                    </div>
                    <div className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${settings.isOpen ? 'bg-green-600' : 'bg-slate-700'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 ${settings.isOpen ? 'left-7' : 'left-1'}`} />
                    </div>
                  </div>
                </div>

                <div className="p-5 bg-slate-950/50 border border-slate-800 rounded-2xl hover:border-slate-700 transition-colors cursor-pointer group" onClick={() => setSettings({ ...settings, acceptingOrders: !settings.acceptingOrders })}>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${settings.acceptingOrders ? 'bg-orange-500/20 text-orange-500' : 'bg-slate-800 text-slate-500'}`}>
                        <Truck className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-white group-hover:text-orange-400 transition-colors">Accepting Orders</h4>
                        <p className="text-sm text-slate-500">Enable new incoming orders</p>
                      </div>
                    </div>
                    <div className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${settings.acceptingOrders ? 'bg-orange-600' : 'bg-slate-700'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 ${settings.acceptingOrders ? 'left-7' : 'left-1'}`} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-8">
                <Button
                  onClick={handleSaveSettings}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8"
                >
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Update Operations
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* Service Area Tab */}
          <TabsContent value="service" className="space-y-6">
            <Card className="p-6 md:p-8 bg-slate-900/40 border-slate-800 backdrop-blur-md">
              <SectionHeader
                icon={Map}
                title="Service Area Configuration"
                description="Define the specific pincodes where you offer delivery services"
                colorClass="bg-pink-600"
              />

              <div className="max-w-3xl">
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                  <div className="flex-1">
                    <Label className="text-slate-300 mb-2 block">Add Service Pincode</Label>
                    <div className="flex gap-2">
                      <StyledInput
                        placeholder="Enter 6-digit Pincode"
                        value={newServicePincode}
                        onChange={(e: any) => setNewServicePincode(e.target.value)}
                        maxLength={6}
                        icon={Navigation}
                      />
                      <Button
                        onClick={handleAddPincode}
                        className="bg-pink-600 hover:bg-pink-700 text-white h-12 px-6 font-semibold"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add
                      </Button>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">Only customers with these pincodes will be able to place orders.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <Label className="text-slate-300 block">Active Service Areas ({settings.servicePincodes.length})</Label>

                  {settings.servicePincodes.length === 0 ? (
                    <div className="text-center p-8 bg-slate-950/50 border border-slate-800 border-dashed rounded-xl">
                      <Map className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                      <p className="text-slate-400 font-medium">No service areas defined</p>
                      <p className="text-sm text-slate-600 mt-1">Add pincodes to start restricting delivery areas. Orderable by everyone if empty.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {settings.servicePincodes.map((code) => (
                        <div key={code} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 flex items-center justify-between group hover:border-pink-500/50 hover:bg-slate-800 transition-colors">
                          <div className="flex items-center gap-2">
                            <Navigation className="w-3 h-3 text-pink-500" />
                            <span className="text-white font-mono font-medium">{code}</span>
                          </div>
                          <button
                            onClick={() => handleRemovePincode(code)}
                            className="text-slate-500 hover:text-red-400 transition-colors p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-start pt-8">
                  <Button
                    onClick={handleSaveSettings}
                    disabled={loading}
                    className="bg-pink-600 hover:bg-pink-700 text-white px-8 font-semibold"
                  >
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <Save className="w-4 h-4 mr-2" />
                    Save Service Areas
                  </Button>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Bank Tab */}
          <TabsContent value="bank" className="space-y-6">
            <Card className="p-6 md:p-8 bg-slate-900/40 border-slate-800 backdrop-blur-md">
              <SectionHeader
                icon={Landmark}
                title="Banking Configuration"
                description="Manage payout accounts and settlement details"
                colorClass="bg-emerald-600"
              />

              <div className="max-w-3xl space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Bank Name *</Label>
                    <StyledInput
                      placeholder="e.g. HDFC Bank"
                      value={bankDetails.bankName}
                      onChange={(e: any) => setBankDetails({ ...bankDetails, bankName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Account Holder Name *</Label>
                    <StyledInput
                      placeholder="As per passbook"
                      value={bankDetails.accountHolderName}
                      onChange={(e: any) => setBankDetails({ ...bankDetails, accountHolderName: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Account Number *</Label>
                    <StyledInput
                      type="password"
                      placeholder="XXXXXXXXXXXX"
                      value={bankDetails.accountNumber}
                      onChange={(e: any) => setBankDetails({ ...bankDetails, accountNumber: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">IFSC Code *</Label>
                    <StyledInput
                      placeholder="HDFC0001234"
                      value={bankDetails.ifscCode}
                      onChange={(e: any) => setBankDetails({ ...bankDetails, ifscCode: e.target.value.toUpperCase() })}
                    />
                  </div>
                </div>

                {bankDetails.bankName && bankDetails.accountNumber && (
                  <div className="bg-emerald-900/20 border border-emerald-500/20 rounded-xl p-4 flex items-start gap-4">
                    <CheckCircle className="w-5 h-5 text-emerald-500 mt-1" />
                    <div>
                      <h4 className="text-emerald-400 font-medium">Account Linked</h4>
                      <p className="text-sm text-emerald-500/70 mt-1">
                        Settlements will be processed to {bankDetails.bankName} (Ending in {bankDetails.accountNumber.slice(-4)})
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex justify-start pt-4">
                  <Button
                    onClick={saveBankDetails}
                    disabled={savingBank}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 font-semibold"
                  >
                    {savingBank && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <Save className="w-4 h-4 mr-2" />
                    Save Bank Details
                  </Button>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <Card className="p-6 md:p-8 bg-slate-900/40 border-slate-800 backdrop-blur-md">
              <SectionHeader
                icon={Bell}
                title="Notification Preferences"
                description="Customize how and when you want to be alerted"
                colorClass="bg-indigo-600"
              />

              <div className="bg-slate-950/50 rounded-2xl border border-slate-800 divide-y divide-slate-800">
                {[
                  { title: 'New Order Alerts', desc: 'Get notified immediately when a customer places an order' },
                  { title: 'Menu Updates', desc: 'Notifications when your menu changes are approved/rejected' },
                  { title: 'Customer Reviews', desc: 'Alerts for new ratings and reviews from customers' },
                  { title: 'System Announcements', desc: 'Important platform updates and maintenance notices' },
                ].map((item, i) => (
                  <div key={i} className="p-5 flex items-center justify-between hover:bg-slate-900/40 transition-colors">
                    <div>
                      <h4 className="text-white font-medium">{item.title}</h4>
                      <p className="text-sm text-slate-500">{item.desc}</p>
                    </div>
                    <div className="relative inline-flex items-center cursor-pointer group">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
