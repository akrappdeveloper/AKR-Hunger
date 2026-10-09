'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ref,
  onValue,
  off,
  query,
  limitToLast,
  orderByChild,
} from 'firebase/database';
import { realtimeDb } from '@/lib/firebase';
import {
  ChatMessage,
  ChatConversation,
  UserRole,
  sendChatMessage,
  markChatAsRead,
  setTypingStatus,
  registerUserPresence,
  CUSTOMER_QUICK_REPLIES,
  RESTAURANT_QUICK_REPLIES,
  DELIVERY_QUICK_REPLIES,
  ADMIN_QUICK_REPLIES,
  submitChatReport,
} from '@/lib/chat-service';
import { uploadImage } from '@/lib/imageUpload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Send,
  Image as ImageIcon,
  Check,
  CheckCheck,
  Clock,
  Phone,
  AlertTriangle,
  ArrowDown,
  X,
  Reply,
  Copy,
  Info,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Sparkles,
  Loader2,
  Maximize2,
} from 'lucide-react';
import { toast } from 'sonner';

interface ChatBoxProps {
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
  onClose?: () => void;
  className?: string;
}

export default function ChatBox({
  chatId,
  orderId,
  currentUserId,
  currentUserName,
  currentUserRole,
  currentUserImage,
  orderData,
  onClose,
  className = '',
}: ChatBoxProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, { userName: string }>>({});
  const [presenceMap, setPresenceMap] = useState<Record<string, { online: boolean; lastSeen?: number }>>({});
  const [showOrderSummary, setShowOrderSummary] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('Inappropriate conduct');
  const [reportingMessage, setReportingMessage] = useState<ChatMessage | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Setup Presence
  useEffect(() => {
    if (!currentUserId) return;
    const cleanup = registerUserPresence(currentUserId, currentUserName, currentUserRole);
    return cleanup;
  }, [currentUserId, currentUserName, currentUserRole]);

  // 2. Real-time Messages Listener
  useEffect(() => {
    if (!realtimeDb || !chatId) return;

    setLoading(true);
    const messagesRef = query(ref(realtimeDb, `chats/${chatId}/messages`), limitToLast(100));

    const unsubscribe = onValue(messagesRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        const list: ChatMessage[] = Object.values(val);
        list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        setMessages(list);

        // Mark read
        if (currentUserId) {
          markChatAsRead(chatId, currentUserId);
        }
      } else {
        setMessages([]);
      }
      setLoading(false);
    });

    return () => {
      off(messagesRef);
    };
  }, [chatId, currentUserId]);

  // 3. Typing Indicators Listener
  useEffect(() => {
    if (!realtimeDb || !chatId) return;

    const typingRef = ref(realtimeDb, `chatTyping/${chatId}`);
    const unsubscribe = onValue(typingRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const others: Record<string, { userName: string }> = {};
        Object.entries(data).forEach(([uid, val]: [string, any]) => {
          if (uid !== currentUserId && val?.isTyping) {
            others[uid] = { userName: val.userName || 'Someone' };
          }
        });
        setTypingUsers(others);
      } else {
        setTypingUsers({});
      }
    });

    return () => {
      off(typingRef);
    };
  }, [chatId, currentUserId]);

  // 4. Auto scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  // 5. Handle typing trigger
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    if (val.trim()) {
      setTypingStatus(chatId, currentUserId, currentUserName, true);
      typingTimeoutRef.current = setTimeout(() => {
        setTypingStatus(chatId, currentUserId, currentUserName, false);
      }, 2500);
    } else {
      setTypingStatus(chatId, currentUserId, currentUserName, false);
    }
  };

  // 6. Send Text Message
  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || sending) return;

    setSending(true);
    setInputText('');
    setTypingStatus(chatId, currentUserId, currentUserName, false);

    try {
      await sendChatMessage({
        chatId,
        orderId,
        senderId: currentUserId,
        senderRole: currentUserRole,
        senderName: currentUserName,
        senderImage: currentUserImage,
        text,
        type: textToSend ? 'QUICK_REPLY' : 'TEXT',
        replyToMessageId: replyTo?.messageId,
        replyToText: replyTo?.text,
        replyToSenderName: replyTo?.senderName,
      });

      setReplyTo(null);
    } catch (err: any) {
      console.error('[ChatBox] Send error:', err);
      toast.error('Failed to send message. Please retry.');
    } finally {
      setSending(false);
    }
  };

  // 7. Send Image Attachment
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      toast.error('Image size must be less than 8MB');
      return;
    }

    setUploadingImage(true);
    const toastId = toast.loading('Uploading attachment securely...');

    try {
      const imageUrl = await uploadImage(file, 'chat-media', currentUserId);
      toast.dismiss(toastId);

      await sendChatMessage({
        chatId,
        orderId,
        senderId: currentUserId,
        senderRole: currentUserRole,
        senderName: currentUserName,
        senderImage: currentUserImage,
        text: 'Sent an image attachment',
        type: 'IMAGE',
        mediaPath: imageUrl,
        replyToMessageId: replyTo?.messageId,
        replyToText: replyTo?.text,
        replyToSenderName: replyTo?.senderName,
      });

      toast.success('Image sent successfully');
      setReplyTo(null);
    } catch (err: any) {
      toast.dismiss(toastId);
      console.error('[ChatBox] Image send error:', err);
      toast.error('Failed to upload attachment.');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 8. Submit Report
  const handleReport = async () => {
    try {
      await submitChatReport({
        chatId,
        orderId,
        messageId: reportingMessage?.messageId,
        reportedBy: currentUserId,
        reporterRole: currentUserRole,
        reason: reportReason,
      });
      toast.success('Report submitted. Hunger trust & safety team will review promptly.');
      setReportModalOpen(false);
      setReportingMessage(null);
    } catch (err) {
      toast.error('Failed to submit report.');
    }
  };

  // Quick replies list based on role
  const quickReplies =
    currentUserRole === 'customer'
      ? CUSTOMER_QUICK_REPLIES
      : currentUserRole === 'restaurant'
      ? RESTAURANT_QUICK_REPLIES
      : currentUserRole === 'delivery'
      ? DELIVERY_QUICK_REPLIES
      : ADMIN_QUICK_REPLIES;

  // Format timestamp
  const formatTime = (ts?: number) => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateHeader = (ts: number) => {
    const d = new Date(ts);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Today';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className={`flex flex-col h-full bg-slate-950 text-white rounded-2xl overflow-hidden border border-slate-800 shadow-2xl ${className}`}>
      {/* Header */}
      <div className="bg-slate-900/90 backdrop-blur-md px-4 py-3 border-b border-slate-800 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center font-bold text-white shadow-md">
              {currentUserRole === 'customer'
                ? (orderData?.restaurantName?.[0] || 'R')
                : (orderData?.customerName?.[0] || 'C')}
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-slate-900" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm text-slate-100">
                {currentUserRole === 'customer'
                  ? (orderData?.restaurantName || 'Restaurant & Rider')
                  : currentUserRole === 'restaurant'
                  ? (orderData?.customerName || 'Customer')
                  : currentUserRole === 'delivery'
                  ? (orderData?.customerName || 'Customer')
                  : 'Platform Conversation'}
              </h3>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/30 text-amber-400 bg-amber-500/10">
                Order {orderData?.orderNumber || `#${orderId.slice(-6).toUpperCase()}`}
              </Badge>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
              Active Realtime Chat
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {orderData && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowOrderSummary(!showOrderSummary)}
              className="text-xs text-slate-300 hover:text-white hover:bg-slate-800 px-2 py-1 h-8 rounded-lg"
            >
              Order Details
              {showOrderSummary ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setReportingMessage(null);
              setReportModalOpen(true);
            }}
            title="Report Issue"
            className="text-slate-400 hover:text-amber-400 hover:bg-slate-800 h-8 w-8 rounded-lg"
          >
            <AlertTriangle className="w-4 h-4" />
          </Button>

          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-slate-400 hover:text-white hover:bg-slate-800 h-8 w-8 rounded-lg"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Collapsible Order Summary Bar */}
      {showOrderSummary && orderData && (
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 text-xs text-slate-300 space-y-1.5 animate-in slide-in-from-top-2 duration-150">
          <div className="flex justify-between items-center font-medium text-slate-200">
            <span>Status: <strong className="text-amber-400 uppercase">{orderData.status || 'Active'}</strong></span>
            {orderData.total && <span>Total: <strong>₹{orderData.total}</strong></span>}
          </div>
          {orderData.items && orderData.items.length > 0 && (
            <p className="text-slate-400 truncate">
              Items: {orderData.items.map((it) => `${it.quantity}x ${it.name}`).join(', ')}
            </p>
          )}
        </div>
      )}

      {/* Message List */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-slate-950 via-slate-900/60 to-slate-950"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            <span className="text-xs">Connecting to secure chat...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12 text-slate-500">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3">
              <Sparkles className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-300">Start the conversation</h4>
            <p className="text-xs text-slate-500 max-w-xs mt-1">
              You can clarify order details, delivery instructions or preparation requests directly in real-time.
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.senderId === currentUserId;
            const isSystem = msg.type === 'SYSTEM' || msg.type === 'ORDER_UPDATE';
            const showDateHeader =
              index === 0 ||
              formatDateHeader(msg.createdAt) !== formatDateHeader(messages[index - 1].createdAt);

            return (
              <React.Fragment key={msg.messageId || index}>
                {showDateHeader && (
                  <div className="flex justify-center my-3">
                    <span className="text-[10px] uppercase tracking-wider font-semibold bg-slate-800/80 text-slate-400 px-3 py-1 rounded-full border border-slate-700/50 shadow-sm">
                      {formatDateHeader(msg.createdAt)}
                    </span>
                  </div>
                )}

                {isSystem ? (
                  <div className="flex justify-center my-2">
                    <div className="bg-slate-900/90 border border-amber-500/30 rounded-xl px-3 py-2 max-w-md text-center shadow-md">
                      <p className="text-xs text-amber-300 font-medium">{msg.text}</p>
                      <span className="text-[9px] text-slate-500 mt-0.5 block">{formatTime(msg.createdAt)}</span>
                    </div>
                  </div>
                ) : (
                  <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group`}>
                    {!isMe && (
                      <span className="text-[10px] text-slate-400 font-medium ml-1 mb-0.5 flex items-center gap-1">
                        {msg.senderName}
                        {msg.senderRole === 'admin' && (
                          <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[9px] px-1 rounded">
                            👑 Admin
                          </span>
                        )}
                        {msg.senderRole === 'restaurant' && (
                          <span className="bg-orange-500/20 text-orange-300 border border-orange-500/30 text-[9px] px-1 rounded">
                            Chef
                          </span>
                        )}
                        {msg.senderRole === 'delivery' && (
                          <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[9px] px-1 rounded">
                            🛵 Rider
                          </span>
                        )}
                      </span>
                    )}

                    <div
                      className={`relative max-w-[82%] sm:max-w-md rounded-2xl px-3.5 py-2.5 shadow-md break-words ${
                        isMe
                          ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-br-none'
                          : msg.senderRole === 'admin'
                          ? 'bg-purple-950/80 border border-purple-600/50 text-purple-100 rounded-bl-none'
                          : 'bg-slate-800/95 border border-slate-700/60 text-slate-100 rounded-bl-none'
                      }`}
                    >
                      {/* Reply preview if quoted */}
                      {msg.replyToText && (
                        <div className="mb-2 pl-2.5 py-1 border-l-2 border-white/40 bg-black/20 rounded text-[11px] text-white/80">
                          <p className="font-semibold text-[10px] text-white/90">{msg.replyToSenderName || 'Original message'}</p>
                          <p className="truncate">{msg.replyToText}</p>
                        </div>
                      )}

                      {/* Image Message */}
                      {msg.type === 'IMAGE' && msg.mediaPath && (
                        <div className="mb-1 rounded-xl overflow-hidden cursor-pointer" onClick={() => setLightboxImage(msg.mediaPath || '')}>
                          <img
                            src={msg.mediaPath}
                            alt="Attachment"
                            className="max-h-60 w-auto rounded-lg object-cover hover:opacity-95 transition"
                            loading="lazy"
                          />
                        </div>
                      )}

                      {/* Text */}
                      <p className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>

                      {/* Time and Delivery status footer */}
                      <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-white/70">
                        <span>{formatTime(msg.createdAt)}</span>
                        {isMe && (
                          <span>
                            {msg.status === 'READ' ? (
                              <CheckCheck className="w-3.5 h-3.5 text-emerald-300" />
                            ) : msg.status === 'DELIVERED' ? (
                              <CheckCheck className="w-3.5 h-3.5 text-white/80" />
                            ) : msg.status === 'SENT' ? (
                              <Check className="w-3.5 h-3.5 text-white/70" />
                            ) : (
                              <Clock className="w-3 h-3 text-white/50" />
                            )}
                          </span>
                        )}
                      </div>

                      {/* Quick message hover actions */}
                      <div
                        className={`absolute top-1 ${
                          isMe ? '-left-16' : '-right-16'
                        } hidden group-hover:flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg p-0.5 shadow-lg z-10`}
                      >
                        <button
                          onClick={() => setReplyTo(msg)}
                          title="Reply"
                          className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white"
                        >
                          <Reply className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(msg.text);
                            toast.success('Copied text');
                          }}
                          title="Copy text"
                          className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        {!isMe && (
                          <button
                            onClick={() => {
                              setReportingMessage(msg);
                              setReportModalOpen(true);
                            }}
                            title="Report message"
                            className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-amber-400"
                          >
                            <AlertTriangle className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })
        )}

        {/* Real-time Typing Indicator */}
        {Object.keys(typingUsers).length > 0 && (
          <div className="flex items-center gap-2 text-xs text-slate-400 animate-pulse pl-1">
            <span className="flex gap-1 items-center bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce delay-100" />
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce delay-200" />
              <span className="text-[11px] ml-1">
                {Object.values(typingUsers).map((u) => u.userName).join(', ')} typing...
              </span>
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Replies Pill Carousel */}
      <div className="px-3 py-1.5 bg-slate-900/90 border-t border-slate-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
        <span className="text-[10px] uppercase font-bold text-slate-500 whitespace-nowrap pl-1">Quick:</span>
        {quickReplies.map((qr, i) => (
          <button
            key={i}
            onClick={() => handleSend(qr)}
            disabled={sending}
            className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-800 hover:bg-amber-600/30 hover:border-amber-500/50 border border-slate-700 text-slate-300 hover:text-amber-300 transition shrink-0"
          >
            {qr}
          </button>
        ))}
      </div>

      {/* Reply Quote Banner */}
      {replyTo && (
        <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-300 shrink-0">
          <div className="flex items-center gap-2 border-l-2 border-amber-500 pl-2 truncate">
            <Reply className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">
              Replying to <strong className="text-white">{replyTo.senderName}:</strong> {replyTo.text}
            </span>
          </div>
          <button onClick={() => setReplyTo(null)} className="text-slate-400 hover:text-white p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Input Bar */}
      <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2 shrink-0">
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={handleImageSelect}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={uploadingImage || sending}
          onClick={() => fileInputRef.current?.click()}
          className="text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-xl h-10 w-10 shrink-0"
        >
          {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin text-amber-500" /> : <ImageIcon className="w-5 h-5" />}
        </Button>

        <Input
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Type your message..."
          disabled={sending}
          className="flex-1 bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-500 text-xs sm:text-sm h-10 rounded-xl focus-visible:ring-amber-500"
        />

        <Button
          type="button"
          disabled={!inputText.trim() || sending}
          onClick={() => handleSend()}
          className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl h-10 px-4 shrink-0 shadow-md transition"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh]">
            <img src={lightboxImage} alt="Enlarged" className="max-h-[85vh] w-auto rounded-xl object-contain" />
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-3 right-3 bg-slate-900/80 text-white p-2 rounded-full hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {reportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Report Conversation
              </h3>
              <button onClick={() => setReportModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Please choose a reason for reporting this chat. Hunger staff will review the messages.
            </p>

            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200"
            >
              <option value="Inappropriate conduct">Inappropriate / abusive language</option>
              <option value="Demanding off-platform payment">Demanding off-platform money</option>
              <option value="Spam or fraudulent behavior">Spam or fraudulent activity</option>
              <option value="Incorrect delivery address or harassment">Harassment / safety concern</option>
              <option value="Other">Other issue</option>
            </select>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setReportModalOpen(false)} className="text-xs">
                Cancel
              </Button>
              <Button size="sm" onClick={handleReport} className="bg-amber-600 hover:bg-amber-700 text-white text-xs">
                Submit Report
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
