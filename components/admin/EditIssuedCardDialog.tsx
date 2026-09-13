'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, updateDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { IssuedCard } from '@/lib/types';
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
  Check,
  AlertTriangle,
  Loader2,
  Ban,
  CheckCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface EditIssuedCardDialogProps {
  card: IssuedCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCardUpdated?: (updatedCard: IssuedCard) => void;
}

export default function EditIssuedCardDialog({
  card,
  open,
  onOpenChange,
  onCardUpdated,
}: EditIssuedCardDialogProps) {
  const [cardNumber, setCardNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('12');
  const [expiryYear, setExpiryYear] = useState('2029');
  const [cvv, setCvv] = useState('');
  const [status, setStatus] = useState<'active' | 'blocked' | 'expired'>('active');
  const [tier, setTier] = useState('VIP');
  const [cardType, setCardType] = useState('Virtual');
  const [isSaving, setIsSaving] = useState(false);

  // Initialize form whenever card changes
  useEffect(() => {
    if (card) {
      // Format 16 digits into 4 groups of 4
      const rawNum = (card.cardNumber || '').replace(/\D/g, '');
      setCardNumber(rawNum.match(/.{1,4}/g)?.join(' ') || rawNum);
      setCustomerName(card.customerName || '');

      let expDate: Date = new Date();
      if (card.expiryDate) {
        if ((card.expiryDate as any).toDate) {
          expDate = (card.expiryDate as any).toDate();
        } else if (card.expiryDate instanceof Date) {
          expDate = card.expiryDate;
        } else {
          expDate = new Date(card.expiryDate);
        }
      } else {
        expDate.setFullYear(expDate.getFullYear() + 5);
      }

      setExpiryMonth(String(expDate.getMonth() + 1).padStart(2, '0'));
      setExpiryYear(String(expDate.getFullYear()));
      setCvv(card.cvv || '123');
      setStatus(card.status || 'active');
      setTier(card.tier || 'VIP');
      setCardType(card.cardType || 'Virtual');
    }
  }, [card]);

  // Clean and format card number with spaces every 4 digits
  const handleCardNumberChange = (value: string) => {
    const raw = value.replace(/\D/g, '').slice(0, 16);
    const formatted = raw.match(/.{1,4}/g)?.join(' ') || raw;
    setCardNumber(formatted);
  };

  // Generate random 16-digit card number
  const handleGenerateCardNumber = () => {
    const random16 = '4' + Math.floor(Math.random() * 1000000000000000).toString().padStart(15, '0');
    setCardNumber(random16.match(/.{1,4}/g)?.join(' ') || random16);
    toast.info('Generated new 16-digit card number');
  };

  // Generate random 3-digit CVV
  const handleGenerateCvv = () => {
    const randomCvv = Math.floor(Math.random() * 900 + 100).toString();
    setCvv(randomCvv);
  };

  // Set +5 years expiry
  const handleSetDefaultExpiry = () => {
    const target = new Date();
    target.setFullYear(target.getFullYear() + 5);
    setExpiryMonth(String(target.getMonth() + 1).padStart(2, '0'));
    setExpiryYear(String(target.getFullYear()));
  };

  const handleSave = async () => {
    if (!card?.id) return;

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
      toast.error('CVV must be at least 3 digits.');
      return;
    }

    const monthNum = parseInt(expiryMonth, 10);
    const yearNum = parseInt(expiryYear, 10);
    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      toast.error('Please enter a valid expiry month (01 - 12).');
      return;
    }
    if (isNaN(yearNum) || yearNum < 2024 || yearNum > 2050) {
      toast.error('Please enter a valid 4-digit expiry year (e.g. 2029).');
      return;
    }

    // Expiry date set to the end of the month
    const parsedExpiryDate = new Date(yearNum, monthNum, 0, 23, 59, 59);

    setIsSaving(true);

    try {
      const updates = {
        cardNumber: rawDigits,
        customerName: customerName.trim(),
        expiryDate: parsedExpiryDate,
        cvv: cvv.trim(),
        status,
        tier,
        cardType,
        updatedAt: serverTimestamp(),
      };

      // 1. Update primary issuedCards collection
      try {
        await updateDoc(doc(db, 'issuedCards', card.id), updates);
      } catch (e) {
        // Fallback for snake_case collection if applicable
        await updateDoc(doc(db, 'issued_cards', card.id), updates);
      }

      // 2. Update customer profile if linked
      if (card.customerId) {
        try {
          await updateDoc(doc(db, 'customers', card.customerId), {
            membershipCardNumber: rawDigits,
            membershipStatus: status === 'active' ? 'approved' : status,
            updatedAt: serverTimestamp(),
          });
        } catch (custErr) {
          console.warn('Customer profile card sync notice:', custErr);
        }

        // 3. Send notification to customer
        try {
          await addDoc(collection(db, 'notifications'), {
            userId: card.customerId,
            userType: 'customer',
            type: 'system',
            subType: 'card-update',
            title: 'Membership Card Updated 💳',
            message: `Your VIP Membership Card details (ending in ${rawDigits.slice(-4)}) have been updated by administration.`,
            read: false,
            isRead: false,
            deleted: false,
            actionUrl: '/customer/wallet',
            createdAt: serverTimestamp(),
            metadata: {
              cardId: card.id,
              last4: rawDigits.slice(-4),
              status,
            },
          });
        } catch (notifErr) {
          console.warn('Notification send notice:', notifErr);
        }
      }

      toast.success(`Card details saved to Firebase successfully!`);

      if (onCardUpdated) {
        onCardUpdated({
          ...card,
          cardNumber: rawDigits,
          customerName: customerName.trim(),
          expiryDate: parsedExpiryDate,
          cvv: cvv.trim(),
          status,
          tier,
          cardType,
        });
      }

      onOpenChange(false);
    } catch (err: any) {
      console.error('Error updating issued card:', err);
      toast.error('Failed to save card: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!card) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-xl max-h-[90vh] overflow-y-auto p-6 rounded-3xl shadow-2xl">
        <DialogHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-white">
              <CreditCard className="w-5 h-5 text-blue-400" />
              Edit Issued Membership Card
            </DialogTitle>
            <Badge
              variant="outline"
              className={`text-xs capitalize font-bold ${
                status === 'active'
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : status === 'blocked'
                  ? 'bg-red-500/15 text-red-400 border-red-500/30'
                  : 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'
              }`}
            >
              {status}
            </Badge>
          </div>
          <DialogDescription className="text-xs text-zinc-400">
            Manually update card number, customer name, expiry date, CVV, and status. Changes are saved directly to Firebase.
          </DialogDescription>
        </DialogHeader>

        {/* Live Virtual Card Preview */}
        <div className="my-2">
          <div className="relative overflow-hidden rounded-2xl p-5 aspect-[1.7/1] flex flex-col justify-between shadow-2xl border border-white/10 bg-gradient-to-br from-neutral-900 via-zinc-900 to-black text-white">
            {/* Ambient Lighting */}
            <div className="absolute top-[-30%] left-[-30%] w-[70%] h-[70%] bg-blue-500/20 blur-[60px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-30%] right-[-30%] w-[70%] h-[70%] bg-purple-500/20 blur-[60px] rounded-full pointer-events-none" />

            <div className="relative z-10 flex justify-between items-start">
              <div>
                <h4 className="font-black text-sm tracking-wider text-white">
                  AKR<span className="text-blue-400">PREMIUM</span>
                </h4>
                <span className="text-[9px] text-zinc-400 uppercase tracking-widest font-semibold">
                  {tier} {cardType} Card
                </span>
              </div>
              <div className="px-2 py-0.5 rounded bg-white/10 border border-white/10 text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-300">
                {status}
              </div>
            </div>

            {/* Card Number display */}
            <div className="relative z-10 my-auto">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-400" />
                <div className="text-lg sm:text-xl font-mono text-white font-bold tracking-widest drop-shadow-sm">
                  {cardNumber || '•••• •••• •••• ••••'}
                </div>
              </div>
              <div className="flex gap-6 text-[10px] text-zinc-400 uppercase tracking-wider font-mono pl-6 mt-1">
                <span>EXP: {expiryMonth}/{expiryYear.slice(-2)}</span>
                <span>CVV: {cvv || '***'}</span>
              </div>
            </div>

            {/* Cardholder Bottom */}
            <div className="relative z-10 flex justify-between items-end border-t border-white/10 pt-2.5">
              <div>
                <div className="text-[9px] text-zinc-400 uppercase tracking-wider">Card Holder</div>
                <div className="font-bold text-xs sm:text-sm text-zinc-100 uppercase truncate max-w-[200px]">
                  {customerName || 'CUSTOMER NAME'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[9px] text-zinc-400 uppercase tracking-wider">Card ID</div>
                <div className="font-mono text-[10px] text-zinc-400">
                  #{card.id.slice(0, 8).toUpperCase()}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <div className="space-y-4 pt-2">
          {/* Card Number Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-blue-400" /> 16-Digit Card Number
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleGenerateCardNumber}
                className="h-6 text-[11px] text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 px-2 gap-1 rounded-lg"
              >
                <Sparkles className="w-3 h-3" /> Auto-Generate
              </Button>
            </div>
            <Input
              value={cardNumber}
              onChange={(e) => handleCardNumberChange(e.target.value)}
              placeholder="4532 8901 2345 6789"
              maxLength={19}
              className="font-mono bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 rounded-xl h-10 tracking-widest text-sm focus:border-blue-500"
            />
            <p className="text-[11px] text-zinc-500">
              Enter 16 digits. Spacing is automatically formatted for clarity.
            </p>
          </div>

          {/* Cardholder Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-400" /> Cardholder Name
            </Label>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. John Doe"
              className="bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 rounded-xl h-10 text-sm focus:border-blue-500"
            />
          </div>

          {/* Expiry & CVV Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Expiry Date */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" /> Expiry (MM / YYYY)
                </Label>
                <button
                  type="button"
                  onClick={handleSetDefaultExpiry}
                  className="text-[10px] text-blue-400 hover:underline"
                >
                  +5 Years
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={expiryMonth}
                  onChange={(e) => setExpiryMonth(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  placeholder="MM"
                  maxLength={2}
                  className="w-16 font-mono text-center bg-zinc-900 border-zinc-800 text-white rounded-xl h-10 text-sm focus:border-blue-500"
                />
                <span className="text-zinc-500 font-bold">/</span>
                <Input
                  value={expiryYear}
                  onChange={(e) => setExpiryYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="YYYY"
                  maxLength={4}
                  className="flex-1 font-mono text-center bg-zinc-900 border-zinc-800 text-white rounded-xl h-10 text-sm focus:border-blue-500"
                />
              </div>
            </div>

            {/* CVV */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-blue-400" /> Security Code (CVV)
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleGenerateCvv}
                  className="h-6 text-[11px] text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 px-2 gap-1 rounded-lg"
                >
                  <RefreshCw className="w-2.5 h-2.5" /> Random
                </Button>
              </div>
              <Input
                value={cvv}
                onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="123"
                maxLength={4}
                className="font-mono bg-zinc-900 border-zinc-800 text-white rounded-xl h-10 text-sm focus:border-blue-500"
              />
            </div>
          </div>

          {/* Status & Tier Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {/* Status */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-zinc-300 flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-blue-400" /> Status
              </Label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl h-10 px-3 text-xs focus:outline-none focus:border-blue-500 font-medium"
              >
                <option value="active">Active (Usable)</option>
                <option value="blocked">Blocked (Suspended)</option>
                <option value="expired">Expired</option>
              </select>
            </div>

            {/* Tier */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-zinc-300 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" /> Tier Level
              </Label>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl h-10 px-3 text-xs focus:outline-none focus:border-blue-500 font-medium"
              >
                <option value="VIP">VIP</option>
                <option value="Gold">Gold</option>
                <option value="Platinum">Platinum</option>
                <option value="Diamond">Diamond</option>
                <option value="Standard">Standard</option>
              </select>
            </div>

            {/* Card Type */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-zinc-300 flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-blue-400" /> Card Type
              </Label>
              <select
                value={cardType}
                onChange={(e) => setCardType(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl h-10 px-3 text-xs focus:outline-none focus:border-blue-500 font-medium"
              >
                <option value="Virtual">Virtual Digital</option>
                <option value="Physical Metal">Physical Metal</option>
                <option value="NFC Smart">NFC Smart Card</option>
              </select>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-4 border-t border-zinc-800">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            className="border-zinc-800 text-zinc-300 hover:bg-zinc-800 rounded-xl text-xs h-10 px-4"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold h-10 px-5 gap-1.5 shadow-lg shadow-blue-600/20 cursor-pointer"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving to Firebase...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Save to Firebase</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
