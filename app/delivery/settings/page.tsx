'use client';

import React, { useState, useEffect } from 'react';
import { useDeliveryAuth } from '@/context/DeliveryAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { Loader } from '@/components/ui/spinner';
import { User, Car, Mail, Save, FileText, Smartphone, Wallet, Plus, CheckCircle, Info, Settings, ShieldCheck, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { motion } from 'framer-motion';

export default function DeliverySettingsPage() {
  const { user, deliveryPartner, loading } = useDeliveryAuth();
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    vehicle: '',
    vehicleNumber: ''
  });
  const [saving, setSaving] = useState(false);

  // Bank Details State
  const [openBankDialog, setOpenBankDialog] = useState(false);
  const [bankSaving, setBankSaving] = useState(false);
  const [showAccountNumber, setShowAccountNumber] = useState(false);
  const [bankData, setBankData] = useState({
    bankName: '',
    holderName: '',
    accountNumber: '',
    ifscCode: ''
  });

  useEffect(() => {
    if (deliveryPartner) {
      setFormData({
        name: deliveryPartner.name || '',
        phone: deliveryPartner.phone || '',
        vehicle: deliveryPartner.vehicle || '',
        vehicleNumber: deliveryPartner.vehicleNumber || ''
      });
      if (deliveryPartner.bankDetails) {
        setBankData(deliveryPartner.bankDetails);
      }
    }
  }, [deliveryPartner]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'deliveryPersons', user.uid), {
        name: formData.name,
        phone: formData.phone,
        vehicle: formData.vehicle,
        vehicleNumber: formData.vehicleNumber
      });
      toast.success("Profile updated successfully");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleBankSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBankSaving(true);
    try {
      await updateDoc(doc(db, 'deliveryPersons', user.uid), {
        bankDetails: bankData
      });
      toast.success("Bank details saved successfully");
      setOpenBankDialog(false);
    } catch (error) {
      console.error("Error saving bank details:", error);
      toast.error("Failed to save bank details");
    } finally {
      setBankSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-screen bg-transparent text-white"><Loader /></div>;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="p-4 md:p-8 space-y-8 max-w-5xl mx-auto pb-24 md:pb-8"
    >
      <motion.div variants={itemVariants} className="flex flex-col gap-2">
        <h1 className="text-4xl font-black text-white tracking-tight drop-shadow-xl flex items-center gap-3">
          <Settings className="w-8 h-8 text-gray-400" />
          Settings
        </h1>
        <p className="text-gray-400 font-medium ml-1">Manage your profile, vehicle, and payout details.</p>
      </motion.div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Personal Info */}
        <motion.div variants={itemVariants}>
          <Card className="bg-black/40 border-white/5 backdrop-blur-xl shadow-xl overflow-hidden group hover:border-blue-500/20 transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-[50px] group-hover:bg-blue-500/10 transition-all duration-500" />
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-400 border border-blue-500/20 shadow-inner">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <CardTitle className="text-xl text-white">Personal Information</CardTitle>
                  <CardDescription className="text-gray-500">Your Identity</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 relative z-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-gray-400 ml-1">Full Name</Label>
                  <div className="relative group/input">
                    <User className="absolute left-4 top-3.5 h-5 w-5 text-gray-600 group-focus-within/input:text-blue-500 transition-colors" />
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="bg-white/5 border-white/10 text-white pl-12 h-12 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-gray-400 ml-1">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-3.5 h-5 w-5 text-gray-600" />
                    <Input
                      id="email"
                      value={user?.email || ''}
                      disabled
                      className="bg-white/5 border-white/10 text-gray-500 pl-12 h-12 rounded-xl cursor-not-allowed opacity-70"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-gray-400 ml-1">Phone Number</Label>
                  <div className="relative group/input">
                    <Smartphone className="absolute left-4 top-3.5 h-5 w-5 text-gray-600 group-focus-within/input:text-blue-500 transition-colors" />
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="bg-white/5 border-white/10 text-white pl-12 h-12 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Vehicle Info */}
        <motion.div variants={itemVariants}>
          <Card className="bg-black/40 border-white/5 backdrop-blur-xl shadow-xl overflow-hidden group hover:border-green-500/20 transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full blur-[50px] group-hover:bg-green-500/10 transition-all duration-500" />
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-500/10 rounded-2xl text-green-400 border border-green-500/20 shadow-inner">
                  <Car className="w-6 h-6" />
                </div>
                <div>
                  <CardTitle className="text-xl text-white">Vehicle Details</CardTitle>
                  <CardDescription className="text-gray-500">Ride Information</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 relative z-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="vehicle" className="text-gray-400 ml-1">Vehicle Type</Label>
                  <Input
                    id="vehicle"
                    placeholder="e.g. Bike, Scooter"
                    value={formData.vehicle}
                    onChange={(e) => setFormData({ ...formData, vehicle: e.target.value })}
                    className="bg-white/5 border-white/10 text-white h-12 rounded-xl focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all px-4"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vehicleNumber" className="text-gray-400 ml-1">Registration Number</Label>
                  <Input
                    id="vehicleNumber"
                    placeholder="MH01 AB 1234"
                    value={formData.vehicleNumber}
                    onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value })}
                    className="bg-white/5 border-white/10 text-white h-12 rounded-xl focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all px-4 font-mono uppercase"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Bank Details */}
        <motion.div variants={itemVariants}>
          <Card className="bg-black/40 border-white/5 backdrop-blur-xl shadow-xl overflow-hidden group hover:border-yellow-500/20 transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-[50px] group-hover:bg-yellow-500/10 transition-all duration-500" />
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-500/10 rounded-2xl text-yellow-500 border border-yellow-500/20 shadow-inner">
                  <Wallet className="w-6 h-6" />
                </div>
                <div>
                  <CardTitle className="text-xl text-white">Bank Account</CardTitle>
                  <CardDescription className="text-gray-500">Payout Information</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 relative z-10">
              {deliveryPartner?.bankDetails ? (
                <div className="bg-white/5 p-6 rounded-2xl border border-white/5 space-y-4 group-hover:bg-white/[0.07] transition-colors">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Bank Name</p>
                      <p className="text-white font-medium text-lg">{deliveryPartner.bankDetails.bankName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Account Holder</p>
                      <p className="text-white font-medium text-lg">{deliveryPartner.bankDetails.holderName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Account Number</p>
                      <p className="text-white font-medium text-lg font-mono tracking-wide">•••• {deliveryPartner.bankDetails.accountNumber.slice(-4)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">IFSC Code</p>
                      <p className="text-white font-medium text-lg font-mono">{deliveryPartner.bankDetails.ifscCode}</p>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="bg-transparent border-white/10 text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10 hover:border-yellow-500/30"
                      onClick={() => setOpenBankDialog(true)}
                    >
                      Edit Bank Details
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 bg-white/5 rounded-2xl border border-dashed border-white/10">
                  <p className="text-gray-400 mb-4 font-medium">No bank account linked yet.</p>
                  <Button
                    type="button"
                    onClick={() => setOpenBankDialog(true)}
                    className="bg-yellow-600 hover:bg-yellow-700 text-black font-bold h-10 px-6 rounded-xl"
                  >
                    <Plus className="w-4 h-4 mr-2" /> Link Bank Account
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Documents Management */}
        <motion.div variants={itemVariants}>
          <Card className="bg-black/40 border-white/5 backdrop-blur-xl shadow-xl overflow-hidden group hover:border-purple-500/20 transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-[50px] group-hover:bg-purple-500/10 transition-all duration-500" />
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-500/10 rounded-2xl text-purple-400 border border-purple-500/20 shadow-inner">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <CardTitle className="text-xl text-white">Documents</CardTitle>
                  <CardDescription className="text-gray-500">Verified Credentials</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 relative z-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { title: 'Driving License', file: deliveryPartner?.drivingLicense, icon: FileText },
                  { title: 'Vehicle RC / Image', file: deliveryPartner?.vehicleImage, icon: Car }
                ].map((doc, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/[0.07] transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 bg-gray-800 rounded-xl text-gray-400">
                        <doc.icon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-white text-sm">{doc.title}</p>
                        <p className="text-[10px] text-green-400 flex items-center gap-1 font-bold tracking-wide mt-0.5">
                          <CheckCircle className="w-3 h-3" /> VERIFIED
                        </p>
                      </div>
                    </div>
                    {doc.file && (
                      <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white" onClick={() => window.open(doc.file, '_blank')}>
                        <ChevronRight className="w-5 h-5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex gap-3 text-sm text-blue-300">
                <Info className="w-5 h-5 shrink-0 text-blue-400" />
                <p className="leading-relaxed">To update your verified documents, please raise a ticket in "Help & Support" or contact admin for re-verification.</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants} className="flex justify-end pt-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 80px)' }}>
          <Button
            type="submit"
            disabled={saving}
            className="bg-white text-black hover:bg-gray-200 font-bold h-12 px-8 min-w-[180px] rounded-xl shadow-lg shadow-white/5"
          >
            {saving ? <Loader className="w-5 h-5 mr-2" /> : <Save className="w-5 h-5 mr-2" />}
            {saving ? 'Saving Changes...' : 'Save Changes'}
          </Button>
        </motion.div>

      </form>

      <Dialog open={openBankDialog} onOpenChange={setOpenBankDialog}>
        <DialogContent className="bg-black/90 border-white/10 text-white backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Add Bank Details</DialogTitle>
            <DialogDescription className="text-gray-400">
              Enter your bank account details for payouts. Correctness is critical.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleBankSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="bankName" className="text-gray-300">Bank Name</Label>
              <Input
                id="bankName"
                required
                value={bankData.bankName}
                onChange={(e) => setBankData({ ...bankData, bankName: e.target.value })}
                className="bg-white/5 border-white/10 text-white focus:border-yellow-500"
                placeholder="e.g. HDFC Bank"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="holderName" className="text-gray-300">Account Holder Name</Label>
              <Input
                id="holderName"
                required
                value={bankData.holderName}
                onChange={(e) => setBankData({ ...bankData, holderName: e.target.value })}
                className="bg-white/5 border-white/10 text-white focus:border-yellow-500"
                placeholder="As per bank records"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accountNumber" className="text-gray-300">Account Number</Label>
              <div className="relative">
                <Input
                  id="accountNumber"
                  required
                  type={showAccountNumber ? "text" : "password"}
                  value={bankData.accountNumber}
                  onChange={(e) => setBankData({ ...bankData, accountNumber: e.target.value })}
                  className="bg-white/5 border-white/10 text-white focus:border-yellow-500 pr-10"
                  placeholder="Enter account number"
                />
                <button
                  type="button"
                  onClick={() => setShowAccountNumber(!showAccountNumber)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  {showAccountNumber ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ifscCode" className="text-gray-300">IFSC Code</Label>
              <Input
                id="ifscCode"
                required
                value={bankData.ifscCode}
                onChange={(e) => setBankData({ ...bankData, ifscCode: e.target.value.toUpperCase() })}
                className="bg-white/5 border-white/10 text-white focus:border-yellow-500"
                placeholder="e.g. HDFC0001234"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="ghost" onClick={() => setOpenBankDialog(false)} className="text-gray-400 hover:text-white">Cancel</Button>
              <Button type="submit" disabled={bankSaving} className="bg-yellow-600 hover:bg-yellow-700 text-black font-bold rounded-lg">
                {bankSaving ? 'Saving...' : 'Save Bank Details'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
