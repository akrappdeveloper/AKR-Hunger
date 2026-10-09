'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ref, get } from 'firebase/database';
import { realtimeDb } from '@/lib/firebase';
import { ChatConversation } from '@/lib/chat-service';
import ChatBox from '@/components/chat/ChatBox';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function CustomerChatDetailPage() {
  const params = useParams();
  const router = useRouter();
  const chatId = params?.chatId as string;
  const { user, customer, loading: authLoading } = useAuth();

  const [chatData, setChatData] = useState<ChatConversation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!chatId || !realtimeDb) return;

    const fetchChatMeta = async () => {
      try {
        const snap = await get(ref(realtimeDb, `chats/${chatId}`));
        if (snap.exists()) {
          setChatData(snap.val() as ChatConversation);
        }
      } catch (err) {
        console.error('[ChatDetail] Error loading chat:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchChatMeta();
  }, [chatId]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
        <AlertCircle className="w-10 h-10 text-amber-500 mb-2" />
        <h2 className="text-lg font-semibold text-white">Sign In Required</h2>
        <p className="text-xs text-slate-400 mb-4">Please log in to view your order messages.</p>
        <Link href="/customer/login">
          <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl">
            Go to Login
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pt-16 sm:pt-20 pb-8 px-2 sm:px-4 flex flex-col">
      <div className="max-w-4xl w-full mx-auto flex-1 flex flex-col">
        {/* Back navigation */}
        <div className="flex items-center gap-2 mb-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="text-slate-400 hover:text-white hover:bg-slate-900 rounded-xl px-2 h-8 text-xs gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Chats
          </Button>
        </div>

        {/* Chat Component */}
        <div className="flex-1 min-h-[600px] h-[calc(100vh-140px)] rounded-2xl overflow-hidden">
          <ChatBox
            chatId={chatId}
            orderId={chatData?.orderId || ''}
            currentUserId={user.uid}
            currentUserName={customer?.name || user.displayName || 'Customer'}
            currentUserRole="customer"
            currentUserImage={customer?.avatar || customer?.image}
            orderData={{
              orderNumber: chatData?.orderNumber,
              status: chatData?.status,
              restaurantName: chatData?.restaurantName,
              customerName: chatData?.customerName,
              deliveryPersonName: chatData?.deliveryName,
            }}
            className="h-full w-full"
          />
        </div>
      </div>
    </div>
  );
}
