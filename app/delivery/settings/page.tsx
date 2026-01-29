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
import { User, Car, Phone, Mail, Save, FileText, Smartphone, Wallet, Plus, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';

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
    // ... existing submit logic
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

  if (loading) return <div className="flex justify-center items-center h-screen bg-black text-white"><Loader /></div>;

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Settings</h1>
        <p className="text-gray-400 mt-1">Manage your profile and vehicle information.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Personal Info */}
        <Card className="bg-gray-900 border-gray-800 text-white shadow-xl">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-600/10 rounded-lg text-blue-500">
                <User className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Personal Information</CardTitle>
                <CardDescription className="text-gray-400">Your basic contact details visible to admins.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-gray-300">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="bg-gray-800 border-gray-700 text-white pl-10 focus:ring-blue-500/50 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-300">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                  <Input
                    id="email"
                    value={user?.email || ''}
                    disabled
                    className="bg-gray-800/50 border-gray-700 text-gray-400 pl-10 opacity-70"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-gray-300">Phone Number</Label>
                <div className="relative">
                  <Smartphone className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="bg-gray-800 border-gray-700 text-white pl-10 focus:ring-blue-500/50 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vehicle Info */}
        <Card className="bg-gray-900 border-gray-800 text-white shadow-xl">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-600/10 rounded-lg text-green-500">
                <Car className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Vehicle Details</CardTitle>
                <CardDescription className="text-gray-400">Manage your vehicle type and registration.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vehicle" className="text-gray-300">Vehicle Type</Label>
                <Input
                  id="vehicle"
                  placeholder="e.g. Bike, Scooter, Car"
                  value={formData.vehicle}
                  onChange={(e) => setFormData({ ...formData, vehicle: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white focus:ring-green-500/50 focus:border-green-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicleNumber" className="text-gray-300">Registration Number</Label>
                <Input
                  id="vehicleNumber"
                  placeholder="e.g. MH12 AB 1234"
                  value={formData.vehicleNumber}
                  onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white focus:ring-green-500/50 focus:border-green-500"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bank Details */}
        <Card className="bg-gray-900 border-gray-800 text-white shadow-xl">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-yellow-600/10 rounded-lg text-yellow-500">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Bank Details</CardTitle>
                <CardDescription className="text-gray-400">Manage your bank account for payouts.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {deliveryPartner?.bankDetails ? (
              <div className="bg-gray-800/50 p-4 rounded-lg space-y-2 border border-gray-700">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Bank Name</span>
                  <span className="font-medium text-white">{deliveryPartner.bankDetails.bankName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Account Holder</span>
                  <span className="font-medium text-white">{deliveryPartner.bankDetails.holderName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Account Number</span>
                  <span className="font-medium text-white">•••• {deliveryPartner.bankDetails.accountNumber.slice(-4)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">IFSC Code</span>
                  <span className="font-medium text-white">{deliveryPartner.bankDetails.ifscCode}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-2 text-blue-400 hover:text-white hover:bg-blue-600/10"
                  onClick={() => setOpenBankDialog(true)}
                >
                  Edit Bank Details
                </Button>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-gray-400 mb-4">No bank account linked yet.</p>
                <Button
                  type="button"
                  onClick={() => setOpenBankDialog(true)}
                  className="bg-yellow-600 hover:bg-yellow-700 text-black font-bold"
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Bank Account
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Docs (Read Only for now) */}
        <Card className="bg-gray-900 border-gray-800 text-white shadow-xl opacity-80">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-600/10 rounded-lg text-purple-500">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Documents</CardTitle>
                <CardDescription className="text-gray-400">Documents submitted during registration.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              {deliveryPartner?.drivingLicense && (
                <a href={deliveryPartner.drivingLicense} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Driving License
                </a>
              )}
              {deliveryPartner?.vehicleImage && (
                <a href={deliveryPartner.vehicleImage} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-2">
                  <Car className="w-4 h-4" /> RC / Vehicle Image
                </a>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">To update documents, please contact support.</p>
          </CardContent>
        </Card>

        <div className="flex justify-end pt-4">
          <Button
            type="submit"
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 px-8 min-w-[150px]"
          >
            {saving ? <Loader className="w-5 h-5 mr-2" /> : <Save className="w-5 h-5 mr-2" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>

      </form>

      <Dialog open={openBankDialog} onOpenChange={setOpenBankDialog}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle>Add Bank Details</DialogTitle>
            <DialogDescription className="text-gray-400">
              Enter your bank account details for payouts. Ensure all information is correct.
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
                className="bg-gray-800 border-gray-700 text-white"
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
                className="bg-gray-800 border-gray-700 text-white"
                placeholder="As per bank records"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accountNumber" className="text-gray-300">Account Number</Label>
              <Input
                id="accountNumber"
                required
                type="password"
                value={bankData.accountNumber}
                onChange={(e) => setBankData({ ...bankData, accountNumber: e.target.value })}
                className="bg-gray-800 border-gray-700 text-white"
                placeholder="Enter account number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ifscCode" className="text-gray-300">IFSC Code</Label>
              <Input
                id="ifscCode"
                required
                value={bankData.ifscCode}
                onChange={(e) => setBankData({ ...bankData, ifscCode: e.target.value.toUpperCase() })}
                className="bg-gray-800 border-gray-700 text-white"
                placeholder="e.g. HDFC0001234"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="ghost" onClick={() => setOpenBankDialog(false)} className="text-gray-400 hover:text-white">Cancel</Button>
              <Button type="submit" disabled={bankSaving} className="bg-yellow-600 hover:bg-yellow-700 text-black font-bold">
                {bankSaving ? 'Saving...' : 'Save Bank Details'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
