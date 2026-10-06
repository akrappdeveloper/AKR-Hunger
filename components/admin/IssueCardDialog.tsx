'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, doc, setDoc, updateDoc, getDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { MembershipRequest } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  CreditCard,
  User,
  Calendar,
  Lock,
  Shield,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';

interface IssueCardDialogProps {
  request: MembershipRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCardIssued?: () => void;
}

export default function IssueCardDialog({
  request,
  open,
  onOpenChange,
  onCardIssued,
}: IssueCardDialogProps) {
  const [cardNumber, setCardNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('12');
  const [expiryYear, setExpiryYear] = useState('2031');
  const [cvv, setCvv] = useState('');
  const [tier, setTier] = useState('VIP');
  const [cardType, setCardType] = useState('Virtual');
  const [isIssuing, setIsIssuing] = useState(false);

  // Initialize/reset form whenever open or request changes
  useEffect(() => {
    if (open && request) {
      setCustomerName(request.customerName || 'Customer');
      
      // Auto-generate fresh 16-digit card number starting with 4
      const random16 = '4' + Math.floor(Math.random() * 1000000000000000).toString().padStart(15, '0');
      setCardNumber(random16.match(/.{1,4}/g)?.join(' ') || random16);

      // Auto-generate 3-digit CVV
      const randomCvv = Math.floor(Math.random() * 900 + 100).toString();
      setCvv(randomCvv);

      // Default +5 years expiry
      const target = new Date();
      target.setFullYear(target.getFullYear() + 5);
      setExpiryMonth(String(target.getMonth() + 1).padStart(2, '0'));
      setExpiryYear(String(target.getFullYear()));

      setTier('VIP');
      setCardType('Virtual');
    }
  }, [open, request]);

  const handleCardNumberChange = (value: string) => {
    const raw = value.replace(/\D/g, '').slice(0, 16);
    const formatted = raw.match(/.{1,4}/g)?.join(' ') || raw;
    setCardNumber(formatted);
  };

  const handleGenerateCardNumber = () => {
    const random16 = '4' + Math.floor(Math.random() * 1000000000000000).toString().padStart(15, '0');
    setCardNumber(random16.match(/.{1,4}/g)?.join(' ') || random16);
    toast.info('Generated new 16-digit card number');
  };

  const handleGenerateCvv = () => {
    const randomCvv = Math.floor(Math.random() * 900 + 100).toString();
    setCvv(randomCvv);
  };

  const handleIssueCard = async () => {
    if (!request) return;

    const rawDigits = cardNumber.replace(/\D/g, '');
    if (rawDigits.length !== 16) {
      toast.error('Card number must be exactly 16 digits.');
      return;
    }

    if (!customerName.trim()) {
      toast.error('Cardholder name cannot be empty.');
      return;
    }

    if (!cvv || cvv.length < 3) {
      toast.error('CVV must be 3 digits.');
      return;
    }

    const monthNum = parseInt(expiryMonth, 10);
    const yearNum = parseInt(expiryYear, 10);
    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      toast.error('Please enter a valid expiry month (01 - 12).');
      return;
    }
    if (isNaN(yearNum) || yearNum < 2025 || yearNum > 2050) {
      toast.error('Please enter a valid 4-digit expiry year (e.g. 2031).');
      return;
    }

    const parsedExpiryDate = new Date(yearNum, monthNum, 0, 23, 59, 59);

    setIsIssuing(true);
    try {
      // 1. Create document in issuedCards
      const cardRef = doc(collection(db, 'issuedCards'));
      const cardData = {
        id: cardRef.id,
        customerId: request.customerId,
        customerName: customerName.trim(),
        customerEmail: request.customerEmail || '',
        contactNumber: request.contactNumber || '',
        cardNumber: rawDigits,
        expiryDate: parsedExpiryDate,
        cvv: cvv.trim(),
        status: 'active',
        tier: tier,
        cardType: cardType,
        issuedAt: serverTimestamp(),
        issuedBy: 'Admin',
        requestId: request.id,
      };

      await setDoc(cardRef, cardData);

      // 2. Update membershipRequest status and cardIssued flag
      const requestRef = doc(db, 'membershipRequests', request.id);
      await updateDoc(requestRef, {
        status: 'approved',
        cardIssued: true,
        cardIssuedAt: serverTimestamp(),
        cardId: cardRef.id,
        cardNumber: rawDigits,
        approvedAt: request.approvedAt || serverTimestamp(),
        approvedBy: 'Admin',
      });

      // 3. Ensure customer document is updated with membership status & id
      const customerRef = doc(db, 'customers', request.customerId);
      const custSnap = await getDoc(customerRef);
      const existingCust = custSnap.data();
      const namePart = customerName.replace(/[^a-zA-Z]/g, '').slice(0, 5).toUpperCase() || 'USERX';
      const membershipId = existingCust?.membershipId || `AKR-${namePart}-${Date.now().toString().slice(-4)}`;

      await updateDoc(customerRef, {
        membershipStatus: 'approved',
        membershipId: membershipId,
        updatedAt: serverTimestamp(),
      });

      // 4. Send customer notification
      await addDoc(collection(db, 'notifications'), {
        userId: request.customerId,
        userType: 'customer',
        type: 'system',
        title: '🎉 Premium Membership Card Issued!',
        message: `Congratulations! Your AKR Hunger ${tier} Virtual Card (${rawDigits.slice(0, 4)} **** **** ${rawDigits.slice(-4)}) has been issued successfully. Access it anytime in your Wallet!`,
        isRead: false,
        createdAt: serverTimestamp(),
      });

      toast.success(`Virtual card successfully issued for ${customerName}!`);
      onOpenChange(false);
      onCardIssued?.();
    } catch (err: any) {
      console.error('Error issuing card:', err);
      toast.error(err?.message || 'Failed to issue card');
    } finally {
      setIsIssuing(false);
    }
  };

  if (!request) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0b0f19] border border-blue-500/20 text-white max-w-2xl p-0 overflow-hidden shadow-2xl rounded-2xl">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 bg-gradient-to-r from-blue-950/60 via-indigo-950/40 to-black/60 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                Issue Membership Card
                <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-[10px] uppercase font-bold tracking-wider">
                  Approved User
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-gray-400 text-xs mt-0.5">
                Generate and issue a virtual AKR Hunger card for {request.customerName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Virtual Card Live Preview */}
          <div className="relative overflow-hidden rounded-2xl p-6 aspect-[1.75/1] max-w-md mx-auto flex flex-col justify-between shadow-2xl border border-white/15 bg-gradient-to-br from-neutral-950 via-zinc-900 to-slate-900 text-white">
            <div className="absolute top-[-30%] left-[-30%] w-[70%] h-[70%] bg-blue-500/20 blur-[60px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-30%] right-[-30%] w-[70%] h-[70%] bg-indigo-500/20 blur-[60px] rounded-full pointer-events-none" />

            <div className="relative z-10 flex justify-between items-start">
              <div>
                <h3 className="font-black text-base tracking-wider text-white flex items-center gap-1.5">
                  AKR<span className="text-blue-400 font-extrabold">PREMIUM</span>
                </h3>
                <span className="text-[10px] text-zinc-300 font-semibold uppercase tracking-widest">
                  {tier} Membership Card
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-lg backdrop-blur-md border border-white/10">
                <Sparkles className="w-3 h-3 text-blue-400" />
                <span className="text-[10px] font-bold text-white uppercase tracking-wider">{cardType}</span>
              </div>
            </div>

            <div className="relative z-10 my-1">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-6 rounded bg-gradient-to-tr from-amber-400 to-amber-200 border border-amber-300/40 shadow-xs flex items-center justify-center">
                  <div className="w-4 h-3 border border-amber-800/40 rounded-xs" />
                </div>
                <CreditCard className="w-4 h-4 text-white/50" />
              </div>
              <div className="text-lg sm:text-xl font-mono text-white tracking-widest font-black drop-shadow-md">
                {cardNumber || '4000 0000 0000 0000'}
              </div>
              <div className="flex gap-6 text-[10px] text-zinc-300 uppercase tracking-wider font-mono mt-2">
                <div>
                  <span className="block text-[8px] text-zinc-400">VALID THRU</span>
                  {expiryMonth}/{expiryYear.slice(-2)}
                </div>
                <div>
                  <span className="block text-[8px] text-zinc-400">CVV</span>
                  {cvv || '***'}
                </div>
              </div>
            </div>

            <div className="relative z-10 flex justify-between items-end border-t border-white/10 pt-2.5">
              <div>
                <div className="text-[8px] text-zinc-400 uppercase tracking-wider mb-0.5">Card Holder</div>
                <div className="font-bold tracking-wide uppercase text-xs text-white truncate max-w-[200px]">
                  {customerName || 'Customer'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[8px] text-zinc-400 uppercase tracking-wider mb-0.5">Status</div>
                <span className="text-[10px] font-bold text-emerald-400 uppercase">Active</span>
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            {/* Cardholder Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-400" /> Cardholder Name
              </Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Full Name"
                className="bg-black/40 border-white/10 text-white rounded-xl focus:border-blue-500"
              />
            </div>

            {/* 16-Digit Card Number */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-blue-400" /> 16-Digit Card Number
                </Label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleGenerateCardNumber}
                  className="h-6 text-[11px] text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 px-2 gap-1 rounded-lg"
                >
                  <RefreshCw className="w-3 h-3" /> Auto-Generate
                </Button>
              </div>
              <div className="relative">
                <Input
                  value={cardNumber}
                  onChange={(e) => handleCardNumberChange(e.target.value)}
                  placeholder="4000 0000 0000 0000"
                  className="bg-black/40 border-white/10 text-white font-mono tracking-wider rounded-xl pl-3 pr-10 focus:border-blue-500"
                  maxLength={19}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 font-mono">
                  {cardNumber.replace(/\D/g, '').length}/16
                </span>
              </div>
            </div>

            {/* Expiry & CVV */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-300 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-blue-400" /> Exp Month
                </Label>
                <Input
                  value={expiryMonth}
                  onChange={(e) => setExpiryMonth(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  placeholder="12"
                  className="bg-black/40 border-white/10 text-white font-mono text-center rounded-xl focus:border-blue-500"
                  maxLength={2}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-300">Exp Year</Label>
                <Input
                  value={expiryYear}
                  onChange={(e) => setExpiryYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="2031"
                  className="bg-black/40 border-white/10 text-white font-mono text-center rounded-xl focus:border-blue-500"
                  maxLength={4}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-gray-300 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-blue-400" /> CVV
                  </Label>
                  <button
                    type="button"
                    onClick={handleGenerateCvv}
                    className="text-[10px] text-blue-400 hover:underline"
                    title="Generate new CVV"
                  >
                    Gen
                  </button>
                </div>
                <Input
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 3))}
                  placeholder="123"
                  className="bg-black/40 border-white/10 text-white font-mono text-center rounded-xl focus:border-blue-500"
                  maxLength={3}
                />
              </div>
            </div>

            {/* Tier & Card Type */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-300">Membership Tier</Label>
                <div className="flex gap-1.5">
                  {['VIP', 'Gold', 'Platinum'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTier(t)}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                        tier === t
                          ? 'bg-blue-600/30 border-blue-500 text-blue-300 shadow-sm'
                          : 'bg-black/20 border-white/10 text-gray-400 hover:text-white'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-300">Card Type</Label>
                <div className="flex gap-1.5">
                  {['Virtual', 'Physical'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setCardType(type)}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                        cardType === type
                          ? 'bg-blue-600/30 border-blue-500 text-blue-300 shadow-sm'
                          : 'bg-black/20 border-white/10 text-gray-400 hover:text-white'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Applicant Summary */}
            <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-xs text-gray-400 flex flex-col gap-1">
              <div className="flex justify-between">
                <span>Customer Email:</span>
                <span className="text-gray-200 font-medium">{request.customerEmail}</span>
              </div>
              <div className="flex justify-between">
                <span>Contact Number:</span>
                <span className="text-gray-200 font-medium">{request.contactNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Customer ID:</span>
                <span className="text-gray-200 font-mono text-[11px]">{request.customerId}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 bg-black/60 border-t border-white/10 gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-gray-400 hover:text-white rounded-xl"
            disabled={isIssuing}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleIssueCard}
            disabled={isIssuing}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/25 px-5 gap-2"
          >
            {isIssuing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Issuing Card...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Confirm & Issue Card
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
