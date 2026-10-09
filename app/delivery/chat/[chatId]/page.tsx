'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDeliveryAuth } from '@/context/DeliveryAuthContext';
import { ref, get } from 'firebase/database';
import { realtimeDb } from '@/lib/firebase';
import { ChatConversation } from '@/lib/chat-service';
import ChatBox from '@/components/chat/ChatBox';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function DeliveryChatDetailPage() {
  const params = useParams();
  const router = useRouter();
  const chatId = params?.chatId as string;
  const { user, deliveryPartner, loading: authLoading } = useDeliveryAuth();

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
        console.error('[DeliveryChatDetail] Error loading chat:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchChatMeta();
  }, [chatId]);

  if (authLoading || loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 text-center">
        <AlertCircle className="w-10 h-10 text-blue-500 mb-2" />
        <h2 className="text-lg font-bold text-foreground">Delivery Partner Login Required</h2>
        <p className="text-xs text-muted-foreground mb-4">Please log in to your rider account.</p>
        <Link href="/delivery/login">
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold">
            Go to Rider Login
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 max-w-5xl mx-auto flex flex-col h-[calc(100vh-80px)]">
      {/* Back button */}
      <div className="flex items-center gap-2 mb-3 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="rounded-xl px-2.5 h-9 text-xs gap-1.5 font-bold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Rider Messages
        </Button>
      </div>

      {/* Chat Window */}
      <div className="flex-1 rounded-2xl overflow-hidden shadow-xl border border-border">
        <ChatBox
          chatId={chatId}
          orderId={chatData?.orderId || ''}
          currentUserId={user.uid}
          currentUserName={deliveryPartner?.name || 'Delivery Partner'}
          currentUserRole="delivery"
          currentUserImage={(deliveryPartner as any)?.profileImage || (deliveryPartner as any)?.image}
          orderData={{
            orderNumber: chatData?.orderNumber,
            status: chatData?.status,
            restaurantName: chatData?.restaurantName,
            customerName: chatData?.customerName,
            deliveryPersonName: deliveryPartner?.name,
          }}
          className="h-full w-full"
        />
      </div>
    </div>
  );
}
