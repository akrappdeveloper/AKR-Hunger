'use client';

import React from 'react';
import ChatBox from './ChatBox';
import { UserRole } from '@/lib/chat-service';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatId: string;
  orderId: string;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: UserRole;
  currentUserImage?: string;
  orderData?: {
    orderNumber?: string;
    status?: string;
    total?: number;
    items?: Array<{ name: string; quantity: number }>;
    restaurantName?: string;
    customerName?: string;
    deliveryPersonName?: string;
  };
}

export default function ChatModal({
  isOpen,
  onClose,
  chatId,
  orderId,
  currentUserId,
  currentUserName,
  currentUserRole,
  currentUserImage,
  orderData,
}: ChatModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl h-[88vh] max-h-[780px] shadow-2xl rounded-2xl overflow-hidden">
        <ChatBox
          chatId={chatId}
          orderId={orderId}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          currentUserRole={currentUserRole}
          currentUserImage={currentUserImage}
          orderData={orderData}
          onClose={onClose}
          className="h-full w-full"
        />
      </div>
    </div>
  );
}
