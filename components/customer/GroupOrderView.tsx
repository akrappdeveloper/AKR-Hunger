'use client';

/**
 * Hunger Group Order Page
 * ========================
 * Create or join group orders with real-time sync,
 * invite links, QR codes, and split payment.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Link2, QrCode, Plus, Minus, ShoppingBag, Crown,
  Check, Clock, Share2, Copy, Trash2, ChevronRight, ArrowLeft,
  Wallet, UserPlus, Lock as LockIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { GroupOrder, GroupMember } from '@/lib/hunger-types-client';
import { copyToClipboard } from '@/lib/utils';
import SafeImage from '@/components/ui/safe-image';
import { useToast } from '@/components/ui/use-toast';

interface GroupOrderPageProps {
  groupId?: string;
  currentUserId: string;
  currentUserName: string;
}

export default function GroupOrderView({
  groupId: initialGroupId,
  currentUserId,
  currentUserName,
}: GroupOrderPageProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [view, setView] = useState<'home' | 'create' | 'join' | 'active'>('home');
  const [groupOrder, setGroupOrder] = useState<GroupOrder | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);
  const [splitAmounts, setSplitAmounts] = useState<Record<string, number>>({});

  const currentMember = groupOrder?.members.find(m => m.userId === currentUserId);
  const isHost = currentMember?.isHost;
  const allPaid = groupOrder?.members.every(m => m.paymentStatus === 'paid');

  const copyInviteLink = useCallback(async () => {
    if (groupOrder?.inviteLink) {
      await copyToClipboard(groupOrder.inviteLink);
      toast({ title: 'Link copied!', description: 'Share with friends to join your group order.' });
    }
  }, [groupOrder, toast]);

  const shareInvite = useCallback(async () => {
    if (!groupOrder) return;
    if (navigator.share) {
      await navigator.share({
        title: `Join ${groupOrder.hostName}'s group order on Hunger!`,
        text: `Use code: ${groupOrder.inviteCode}`,
        url: groupOrder.inviteLink,
      });
    } else {
      copyInviteLink();
    }
  }, [groupOrder, copyInviteLink]);

  const createGroup = useCallback(async (restaurantId: string, restaurantName: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/group-order/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostId: currentUserId,
          hostName: currentUserName,
          restaurantId,
          restaurantName,
          deadlineMinutes: 20,
        }),
      });
      const data = await res.json();
      setGroupOrder(data.groupOrder);
      setView('active');
    } catch {
      toast({ title: 'Error', description: 'Failed to create group order.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId, currentUserName, toast]);

  const joinGroup = useCallback(async () => {
    if (!inviteCode.trim()) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/group-order/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteCode: inviteCode.trim().toUpperCase(),
          userId: currentUserId,
          userName: currentUserName,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setGroupOrder(data.groupOrder);
        setView('active');
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to join group.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [inviteCode, currentUserId, currentUserName, toast]);

  const lockOrder = useCallback(async () => {
    if (!groupOrder) return;
    setIsLoading(true);
    try {
      await fetch('/api/group-order/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: groupOrder.id, hostId: currentUserId }),
      });
      setGroupOrder(prev => prev ? { ...prev, status: 'locked' } : null);
      toast({ title: 'Group order locked!', description: 'No more changes allowed. Proceed to payment.' });
    } catch {
      toast({ title: 'Error', description: 'Could not lock order.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [groupOrder, currentUserId, toast]);

  // Home screen
  if (view === 'home') {
    return (
      <div className="min-h-screen bg-background">
        {/* Hero */}
        <div className="relative overflow-hidden bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 px-6 pt-16 pb-12">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.1),transparent_70%)]" />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative text-center text-white"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm mb-4">
              <Users className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Hunger Group</h1>
            <p className="text-white/80 text-sm">Order together, pay separately</p>
          </motion.div>
        </div>

        <div className="px-4 py-6 space-y-4">
          {/* Create */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => setView('create')}
            className="w-full p-5 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/10 border border-violet-500/30 text-left"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-violet-500/20">
                <Plus className="w-6 h-6 text-violet-400" />
              </div>
              <div>
                <div className="font-semibold">Create Group Order</div>
                <div className="text-sm text-muted-foreground">Invite friends, order together</div>
              </div>
              <ChevronRight className="ml-auto text-muted-foreground" />
            </div>
          </motion.button>

          {/* Join */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => setView('join')}
            className="w-full p-5 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/10 border border-blue-500/30 text-left"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-500/20">
                <UserPlus className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <div className="font-semibold">Join a Group</div>
                <div className="text-sm text-muted-foreground">Enter invite code or scan QR</div>
              </div>
              <ChevronRight className="ml-auto text-muted-foreground" />
            </div>
          </motion.button>

          {/* How it works */}
          <div className="mt-6">
            <h2 className="text-base font-semibold mb-4">How it works</h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: '🍕', step: '1', label: 'Create group & share link' },
                { icon: '👥', step: '2', label: 'Everyone adds their items' },
                { icon: '💳', step: '3', label: 'Each pays their share' },
              ].map(item => (
                <div key={item.step} className="text-center p-4 rounded-xl bg-muted/30 border border-border/50">
                  <div className="text-2xl mb-2">{item.icon}</div>
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Join screen
  if (view === 'join') {
    return (
      <div className="min-h-screen bg-background px-4 pt-8">
        <button onClick={() => setView('home')} className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h2 className="text-xl font-bold mb-6">Join a Group Order</h2>

        <div className="space-y-4">
          <Input
            value={inviteCode}
            onChange={e => setInviteCode(e.target.value.toUpperCase())}
            placeholder="Enter 6-character code (e.g. ABC123)"
            className="text-center text-xl font-mono tracking-widest h-14"
            maxLength={6}
          />
          <Button
            onClick={joinGroup}
            disabled={inviteCode.length !== 6 || isLoading}
            className="w-full h-12 bg-gradient-to-r from-violet-500 to-purple-600 text-white"
          >
            {isLoading ? 'Joining...' : 'Join Group Order'}
          </Button>
        </div>
      </div>
    );
  }

  // Active group order view
  if (view === 'active' && groupOrder) {
    const groupTotal = groupOrder.members.reduce((s, m) => s + (m.subtotal || 0), 0);

    return (
      <div className="min-h-screen bg-background pb-24">
        {/* Header */}
        <div className="bg-gradient-to-br from-violet-600 to-purple-700 px-4 pt-12 pb-6 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-white/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-lg">{groupOrder.hostName}&apos;s Group</h1>
              <p className="text-white/70 text-sm">{groupOrder.restaurantName}</p>
            </div>
            <Badge className="ml-auto bg-white/20 text-white border-0">
              {groupOrder.status === 'open' ? 'Open' : groupOrder.status === 'locked' ? '🔒 Locked' : groupOrder.status}
            </Badge>
          </div>

          {/* Invite */}
          {groupOrder.status === 'open' && (
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2">
                <Link2 className="w-4 h-4 opacity-70" />
                <span className="font-mono text-sm font-bold tracking-widest">{groupOrder.inviteCode}</span>
              </div>
              <button
                onClick={copyInviteLink}
                className="p-2.5 rounded-xl bg-white/20 hover:bg-white/30 transition-colors"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={shareInvite}
                className="p-2.5 rounded-xl bg-white/20 hover:bg-white/30 transition-colors"
              >
                <Share2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setQrVisible(v => !v)}
                className="p-2.5 rounded-xl bg-white/20 hover:bg-white/30 transition-colors"
              >
                <QrCode className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* QR Code */}
          <AnimatePresence>
            {qrVisible && groupOrder.qrCodeData && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-3 flex justify-center"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={groupOrder.qrCodeData} alt="Group QR Code" className="w-40 h-40 rounded-xl" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Members */}
        <div className="px-4 py-4">
          <h2 className="text-base font-semibold mb-3">
            Members ({groupOrder.members.length})
          </h2>

          <div className="space-y-3">
            {groupOrder.members.map(member => (
              <motion.div
                key={member.userId}
                layout
                className="p-4 rounded-2xl border border-border bg-card"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white font-bold">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      {member.isHost && (
                        <Crown className="absolute -top-1.5 -right-1.5 w-4 h-4 text-amber-400" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{member.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {member.items.length} item{member.items.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sm">₹{(member.subtotal || 0).toFixed(0)}</div>
                    <Badge
                      className={`text-xs ${
                        member.paymentStatus === 'paid'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      }`}
                    >
                      {member.paymentStatus === 'paid' ? '✓ PAID' : 'PENDING'}
                    </Badge>
                  </div>
                </div>

                {/* Items */}
                {member.items.length > 0 && (
                  <div className="space-y-1.5 mt-2 pt-2 border-t border-border/50">
                    {member.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{item.name} × {item.quantity}</span>
                        <span>₹{(item.price * item.quantity).toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pay button for current member */}
                {member.userId === currentUserId && member.paymentStatus === 'pending' && groupOrder.status === 'locked' && (
                  <Button
                    size="sm"
                    className="mt-3 w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
                    onClick={() => router.push(`/customer/checkout?groupId=${groupOrder.id}&memberId=${currentUserId}`)}
                  >
                    <Wallet className="w-4 h-4 mr-2" />
                    Pay ₹{(member.subtotal || 0).toFixed(0)}
                  </Button>
                )}
              </motion.div>
            ))}
          </div>

          {/* Group Total */}
          <div className="mt-4 p-4 rounded-2xl bg-muted/30 border border-border">
            <div className="flex justify-between items-center">
              <span className="font-medium">Group Total</span>
              <span className="text-xl font-bold text-violet-400">₹{groupTotal.toFixed(0)}</span>
            </div>
            {groupOrder.deadline && (
              <div className="flex items-center gap-1 mt-2 text-xs text-amber-400">
                <Clock className="w-3.5 h-3.5" />
                Order deadline: {new Date(groupOrder.deadline).toLocaleTimeString()}
              </div>
            )}
          </div>

          {/* Host controls */}
          {isHost && groupOrder.status === 'open' && (
            <Button
              onClick={lockOrder}
              disabled={isLoading}
              className="mt-4 w-full h-12 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold"
            >
              <LockIcon className="w-4 h-4 mr-2" />
              Lock Group & Proceed
            </Button>
          )}

          {!isHost && groupOrder.status === 'open' && (
            <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center text-sm text-amber-400">
              Waiting for {groupOrder.hostName} to lock the order...
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
