'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ref,
  onValue,
  query,
  limitToLast,
} from 'firebase/database';
import { realtimeDb } from '@/lib/firebase';
import {
  ChatMessage,
  ChatParticipant,
  ChatType,
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
  getChatTypeLabel,
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
  ChevronDown,
  ChevronUp,
  Sparkles,
  Loader2,
  Search,
  Bike,
  ChefHat,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

interface ChatBoxProps {
  chatId: string;
  orderId: string;
  currentUserId: string;
  authUserId?: string;
  currentUserName: string;
  currentUserRole: UserRole;
  currentUserImage?: string;
  chatType?: ChatType;
  participants?: Record<string, ChatParticipant>;
  orderData?: {
    orderNumber?: string;
    status?: string;
    total?: number;
    items?: Array<{ name: string; quantity: number }>;
    restaurantName?: string;
    customerName?: string;
    customerPhone?: string;
    deliveryPersonName?: string;
    deliveryPersonPhone?: string;
  };
  fullScreen?: boolean;
  hideOrderSummaryToggle?: boolean;
  headerLeftSlot?: React.ReactNode;
  headerRightSlot?: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

export default function ChatBox({
  chatId,
  orderId,
  currentUserId,
  authUserId,
  currentUserName,
  currentUserRole,
  currentUserImage,
  chatType,
  participants: initialParticipants,
  orderData,
  fullScreen = false,
  hideOrderSummaryToggle = false,
  headerLeftSlot,
  headerRightSlot,
  onClose,
  className = '',
}: ChatBoxProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [participants, setParticipants] = useState<Record<string, ChatParticipant>>(
    initialParticipants || {}
  );
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, { userName: string }>>({});
  const [presenceMap, setPresenceMap] = useState<Record<string, { online: boolean; lastSeen?: number }>>({});
  const [showOrderSummary, setShowOrderSummary] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [messageSearch, setMessageSearch] = useState('');
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('Inappropriate conduct');
  const [reportingMessage, setReportingMessage] = useState<ChatMessage | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAtBottomRef = useRef(true);

  const effectivePresenceUid = authUserId || currentUserId;

  useEffect(() => {
    if (initialParticipants) {
      setParticipants(initialParticipants);
    }
  }, [initialParticipants]);

  // 1. Setup Presence
  useEffect(() => {
    if (!effectivePresenceUid) return;
    const cleanup = registerUserPresence(effectivePresenceUid, currentUserName, currentUserRole);
    return () => {
      cleanup();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (chatId) {
        setTypingStatus(chatId, effectivePresenceUid, currentUserName, false);
      }
    };
  }, [effectivePresenceUid, currentUserName, currentUserRole, chatId]);

  // 2. Listen to chat participants in RTDB
  useEffect(() => {
    if (!realtimeDb || !chatId) return;
    const participantsRef = ref(realtimeDb, `chats/${chatId}/participants`);
    const unsubscribe = onValue(participantsRef, (snapshot) => {
      if (snapshot.exists()) {
        setParticipants(snapshot.val() as Record<string, ChatParticipant>);
      }
    });
    return () => unsubscribe();
  }, [chatId]);

  // 3. Listen to presence for counterparty participants
  useEffect(() => {
    if (!realtimeDb) return;
    const otherUids = Object.keys(participants).filter(
      (uid) => uid !== currentUserId && uid !== effectivePresenceUid
    );
    if (otherUids.length === 0) return;

    const unsubs = otherUids.map((uid) => {
      const pRef = ref(realtimeDb, `chatPresence/${uid}`);
      return onValue(pRef, (snap) => {
        if (snap.exists()) {
          const val = snap.val();
          setPresenceMap((prev) => ({
            ...prev,
            [uid]: { online: Boolean(val?.online), lastSeen: val?.lastSeen },
          }));
        }
      });
    });

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [participants, currentUserId, effectivePresenceUid]);

  // 4. Real-time Messages Listener
  useEffect(() => {
    if (!realtimeDb || !chatId) return;

    setLoading(true);
    const messagesRef = query(ref(realtimeDb, `chats/${chatId}/messages`), limitToLast(150));

    const unsubscribe = onValue(
      messagesRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const val = snapshot.val();
          const list: ChatMessage[] = Object.values(val);
          list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
          setMessages(list);

          if (currentUserId) {
            markChatAsRead(chatId, currentUserId);
          }
        } else {
          setMessages([]);
        }
        setLoading(false);
      },
      (err) => {
        console.error('[ChatBox] Messages listener error:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [chatId, currentUserId]);

  // 5. Typing Indicators Listener
  useEffect(() => {
    if (!realtimeDb || !chatId) return;

    const typingRef = ref(realtimeDb, `chatTyping/${chatId}`);
    const unsubscribe = onValue(typingRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const others: Record<string, { userName: string }> = {};
        Object.entries(data).forEach(([uid, val]: [string, any]) => {
          if (uid !== currentUserId && uid !== effectivePresenceUid && val?.isTyping) {
            others[uid] = { userName: val.userName || 'Someone' };
          }
        });
        setTypingUsers(others);
      } else {
        setTypingUsers({});
      }
    });

    return () => unsubscribe();
  }, [chatId, currentUserId, effectivePresenceUid]);

  // 6. Scroll handling
  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom < 110;
    isAtBottomRef.current = nearBottom;
    setShowScrollBottom(!nearBottom);
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    if (isAtBottomRef.current && !messageSearch) {
      scrollToBottom('smooth');
    }
  }, [messages, typingUsers, messageSearch]);

  // 7. Handle typing trigger
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    if (val.trim()) {
      setTypingStatus(chatId, effectivePresenceUid, currentUserName, true);
      typingTimeoutRef.current = setTimeout(() => {
        setTypingStatus(chatId, effectivePresenceUid, currentUserName, false);
      }, 2500);
    } else {
      setTypingStatus(chatId, effectivePresenceUid, currentUserName, false);
    }
  };

  // 8. Send Text Message
  const handleSend = async (textToSend?: string) => {
    const raw = textToSend ?? inputText;
    const text = raw.trim();
    if (!text || sending) return;

    const isQuickReply = Boolean(textToSend);
    setSending(true);
    if (!isQuickReply) setInputText('');
    setTypingStatus(chatId, effectivePresenceUid, currentUserName, false);

    try {
      await sendChatMessage({
        chatId,
        orderId,
        senderId: currentUserId,
        senderRole: currentUserRole,
        senderName: currentUserName,
        senderImage: currentUserImage,
        text,
        type: isQuickReply ? 'QUICK_REPLY' : 'TEXT',
        replyToMessageId: replyTo?.messageId,
        replyToText: replyTo?.text,
        replyToSenderName: replyTo?.senderName,
      });

      setReplyTo(null);
      isAtBottomRef.current = true;
      setTimeout(() => scrollToBottom('smooth'), 40);
    } catch (err: any) {
      console.error('[ChatBox] Send error:', err);
      if (!isQuickReply) setInputText(raw);
      toast.error('Failed to send message. Please retry.');
    } finally {
      setSending(false);
    }
  };

  // 9. Send Image Attachment
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
      isAtBottomRef.current = true;
    } catch (err: any) {
      toast.dismiss(toastId);
      console.error('[ChatBox] Image send error:', err);
      toast.error('Failed to upload attachment.');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 10. Submit Report
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

  const quickReplies =
    currentUserRole === 'customer'
      ? CUSTOMER_QUICK_REPLIES
      : currentUserRole === 'restaurant'
      ? RESTAURANT_QUICK_REPLIES
      : currentUserRole === 'delivery'
      ? DELIVERY_QUICK_REPLIES
      : ADMIN_QUICK_REPLIES;

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

  // Derive header display based on role + chatType
  const headerInfo = useMemo(() => {
    const customerName = orderData?.customerName || 'Customer';
    const restaurantName = orderData?.restaurantName || 'Restaurant';
    const riderName = orderData?.deliveryPersonName || 'Delivery Partner';

    if (chatType === 'customer_delivery') {
      if (currentUserRole === 'customer') {
        return { title: riderName, phone: orderData?.deliveryPersonPhone, badge: 'Delivery Partner' };
      }
      if (currentUserRole === 'delivery') {
        return { title: customerName, phone: orderData?.customerPhone, badge: 'Customer' };
      }
      return {
        title: `${customerName} ↔ ${riderName}`,
        phone: orderData?.deliveryPersonPhone || orderData?.customerPhone,
        badge: 'Customer & Rider',
      };
    }

    if (chatType === 'restaurant_delivery') {
      if (currentUserRole === 'restaurant') {
        return { title: riderName, phone: orderData?.deliveryPersonPhone, badge: 'Delivery Rider' };
      }
      if (currentUserRole === 'delivery') {
        return { title: restaurantName, phone: undefined, badge: 'Restaurant' };
      }
    }

    if (chatType === 'customer_restaurant') {
      if (currentUserRole === 'restaurant') {
        return { title: customerName, phone: orderData?.customerPhone, badge: 'Customer' };
      }
      if (currentUserRole === 'customer') {
        return { title: restaurantName, phone: undefined, badge: 'Restaurant' };
      }
    }

    // Fallback when chatType isn't provided
    if (currentUserRole === 'customer') {
      return { title: restaurantName || 'Restaurant & Rider', phone: undefined, badge: undefined };
    }
    if (currentUserRole === 'restaurant') {
      return { title: customerName, phone: orderData?.customerPhone, badge: undefined };
    }
    if (currentUserRole === 'delivery') {
      return { title: customerName, phone: orderData?.customerPhone, badge: undefined };
    }
    return { title: 'Platform Conversation', phone: undefined, badge: undefined };
  }, [chatType, currentUserRole, orderData]);

  const anyOtherOnline = Object.values(presenceMap).some((p) => p.online);
  const latestLastSeen = Object.values(presenceMap)
    .map((p) => p.lastSeen || 0)
    .sort((a, b) => b - a)[0];

  const typingText = Object.values(typingUsers)
    .map((u) => u.userName)
    .join(', ');

  const visibleMessages = useMemo(() => {
    const q = messageSearch.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter(
      (m) =>
        m.text?.toLowerCase().includes(q) ||
        m.senderName?.toLowerCase().includes(q)
    );
  }, [messages, messageSearch]);

  const shortOrderDisplay =
    orderData?.orderNumber ||
    (orderId ? `#${orderId.slice(-6).toUpperCase()}` : '');

  return (
    <div
      className={`flex flex-col h-full bg-background text-foreground overflow-hidden transition-colors duration-300 ${
        fullScreen
          ? ''
          : 'rounded-2xl border border-border shadow-2xl'
      } ${className}`}
    >
      {/* Header */}
      <header className="bg-card/90 backdrop-blur-xl px-3 sm:px-5 py-3 border-b border-border flex items-center justify-between gap-2 z-10 shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          {headerLeftSlot}

          <div className="relative shrink-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-primary to-primary/75 flex items-center justify-center font-bold text-primary-foreground shadow-md shadow-primary/20 ring-1 ring-primary/20">
              {chatType === 'restaurant_delivery' ? (
                <Bike className="w-5 h-5" />
              ) : chatType === 'customer_delivery' && currentUserRole === 'restaurant' ? (
                <Bike className="w-5 h-5" />
              ) : currentUserRole === 'customer' ? (
                <ChefHat className="w-5 h-5" />
              ) : (
                <span className="text-sm font-black">
                  {(headerInfo.title?.[0] || 'C').toUpperCase()}
                </span>
              )}
            </div>
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-card ${
                anyOtherOnline ? 'bg-emerald-500' : 'bg-muted-foreground/50'
              }`}
              title={anyOtherOnline ? 'Online' : 'Offline'}
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <h3 className="font-bold text-sm sm:text-base text-foreground truncate max-w-[160px] sm:max-w-xs">
                {headerInfo.title}
              </h3>
              {shortOrderDisplay && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 border-primary/30 text-primary bg-primary/10 font-mono shrink-0"
                >
                  {shortOrderDisplay}
                </Badge>
              )}
              {headerInfo.badge && (
                <Badge
                  variant="secondary"
                  className="hidden sm:inline-flex text-[10px] px-1.5 py-0 font-semibold shrink-0"
                >
                  {headerInfo.badge}
                </Badge>
              )}
            </div>
            <p className="text-[11px] sm:text-xs text-muted-foreground flex items-center gap-1.5 truncate">
              {typingText ? (
                <span className="text-primary font-semibold animate-pulse">
                  {typingText} is typing...
                </span>
              ) : anyOtherOnline ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse shrink-0" />
                  <span>Online • Real-time</span>
                </>
              ) : latestLastSeen ? (
                <span>Last seen {formatTime(latestLastSeen)}</span>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/70 inline-block shrink-0" />
                  <span>{chatType ? getChatTypeLabel(chatType) : 'Realtime Order Chat'}</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <Button
            type="button"
            variant={searchOpen ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => {
              setSearchOpen((prev) => !prev);
              if (searchOpen) setMessageSearch('');
            }}
            title="Search messages"
            className="text-muted-foreground hover:text-foreground h-8 w-8 sm:h-9 sm:w-9 rounded-xl"
          >
            <Search className="w-4 h-4" />
          </Button>

          {headerInfo.phone && (
            <Button
              asChild
              variant="ghost"
              size="icon"
              title={`Call ${headerInfo.title}`}
              className="text-muted-foreground hover:text-primary h-8 w-8 sm:h-9 sm:w-9 rounded-xl"
            >
              <a href={`tel:${headerInfo.phone}`}>
                <Phone className="w-4 h-4" />
              </a>
            </Button>
          )}

          {orderData && !hideOrderSummaryToggle && (
            <Button
              type="button"
              variant={showOrderSummary ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setShowOrderSummary((prev) => !prev)}
              className="text-xs text-muted-foreground hover:text-foreground px-2.5 h-8 sm:h-9 rounded-xl hidden sm:inline-flex"
            >
              Order Details
              {showOrderSummary ? (
                <ChevronUp className="w-3.5 h-3.5 ml-1" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 ml-1" />
              )}
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              setReportingMessage(null);
              setReportModalOpen(true);
            }}
            title="Report Issue"
            className="text-muted-foreground hover:text-destructive h-8 w-8 sm:h-9 sm:w-9 rounded-xl"
          >
            <AlertTriangle className="w-4 h-4" />
          </Button>

          {headerRightSlot}

          {onClose && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground h-8 w-8 sm:h-9 sm:w-9 rounded-xl"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </header>

      {/* Optional In-Chat Search Bar */}
      {searchOpen && (
        <div className="px-3 sm:px-5 py-2 bg-card/70 border-b border-border flex items-center gap-2 shrink-0 animate-in slide-in-from-top-1 duration-150">
          <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <Input
            value={messageSearch}
            onChange={(e) => setMessageSearch(e.target.value)}
            placeholder="Search messages in this conversation..."
            autoFocus
            className="h-8 text-xs bg-background border-border rounded-lg flex-1"
          />
          {messageSearch && (
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">
              {visibleMessages.length} found
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              setMessageSearch('');
              setSearchOpen(false);
            }}
            className="h-7 w-7 rounded-lg"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* Collapsible Order Summary Bar */}
      {showOrderSummary && orderData && !hideOrderSummaryToggle && (
        <div className="bg-muted/50 border-b border-border px-4 py-3 text-xs text-muted-foreground space-y-1.5 animate-in slide-in-from-top-2 duration-150 shrink-0">
          <div className="flex justify-between items-center font-medium text-foreground">
            <span>
              Status:{' '}
              <strong className="text-primary uppercase">
                {orderData.status?.replace(/_/g, ' ') || 'Active'}
              </strong>
            </span>
            {orderData.total !== undefined && (
              <span>
                Total: <strong className="font-mono">₹{orderData.total}</strong>
              </span>
            )}
          </div>
          {orderData.items && orderData.items.length > 0 && (
            <p className="text-muted-foreground truncate">
              Items: {orderData.items.map((it) => `${it.quantity}x ${it.name}`).join(', ')}
            </p>
          )}
        </div>
      )}

      {/* Message List */}
      <div className="relative flex-1 min-h-0 flex flex-col">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-3 bg-gradient-to-b from-background via-muted/20 to-background"
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
              <span className="text-xs font-medium">Connecting to live chat...</span>
            </div>
          ) : visibleMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12 text-muted-foreground">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-3 shadow-sm">
                <Sparkles className="w-7 h-7" />
              </div>
              <h4 className="text-sm sm:text-base font-bold text-foreground">
                {messageSearch ? 'No matching messages' : 'Start the conversation'}
              </h4>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mt-1 leading-relaxed">
                {messageSearch
                  ? 'Try another keyword or clear your search filter.'
                  : 'Clarify order details, preparation status, or pickup instructions in real time.'}
              </p>
            </div>
          ) : (
            visibleMessages.map((msg, index) => {
              const isMe = msg.senderId === currentUserId;
              const isSystem = msg.type === 'SYSTEM' || msg.type === 'ORDER_UPDATE';
              const showDateHeader =
                index === 0 ||
                formatDateHeader(msg.createdAt) !==
                  formatDateHeader(visibleMessages[index - 1].createdAt);
              const isActive = activeMessageId === msg.messageId;

              return (
                <React.Fragment key={msg.messageId || index}>
                  {showDateHeader && (
                    <div className="flex justify-center my-3">
                      <span className="text-[10px] uppercase tracking-wider font-bold bg-card/90 text-muted-foreground px-3 py-1 rounded-full border border-border shadow-xs">
                        {formatDateHeader(msg.createdAt)}
                      </span>
                    </div>
                  )}

                  {isSystem ? (
                    <div className="flex justify-center my-2">
                      <div className="bg-accent/70 border border-primary/20 rounded-2xl px-4 py-2 max-w-lg text-center shadow-xs">
                        <p className="text-xs text-accent-foreground font-semibold">{msg.text}</p>
                        <span className="text-[10px] text-muted-foreground mt-0.5 block">
                          {formatTime(msg.createdAt)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group`}>
                      {!isMe && (
                        <span className="text-[11px] text-muted-foreground font-semibold ml-1 mb-1 flex items-center gap-1.5">
                          <span>{msg.senderName}</span>
                          {msg.senderRole === 'admin' && (
                            <span className="bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/25 text-[9px] px-1.5 py-0.5 rounded-md font-bold">
                              Admin
                            </span>
                          )}
                          {msg.senderRole === 'restaurant' && (
                            <span className="bg-primary/15 text-primary border border-primary/25 text-[9px] px-1.5 py-0.5 rounded-md font-bold">
                              Kitchen
                            </span>
                          )}
                          {msg.senderRole === 'delivery' && (
                            <span className="bg-blue-500/15 text-blue-600 dark:text-blue-300 border border-blue-500/25 text-[9px] px-1.5 py-0.5 rounded-md font-bold">
                              Rider
                            </span>
                          )}
                          {msg.senderRole === 'customer' && (
                            <span className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/25 text-[9px] px-1.5 py-0.5 rounded-md font-bold">
                              Customer
                            </span>
                          )}
                        </span>
                      )}

                      <div
                        onClick={() =>
                          setActiveMessageId((prev) =>
                            prev === msg.messageId ? null : msg.messageId
                          )
                        }
                        className={`relative max-w-[85%] sm:max-w-lg rounded-2xl px-4 py-2.5 shadow-sm break-words transition-all ${
                          isMe
                            ? 'bg-primary text-primary-foreground rounded-br-sm shadow-primary/15'
                            : msg.senderRole === 'admin'
                            ? 'bg-purple-500/10 border border-purple-500/30 text-foreground rounded-bl-sm'
                            : 'bg-card border border-border text-card-foreground rounded-bl-sm'
                        }`}
                      >
                        {/* Reply preview if quoted */}
                        {msg.replyToText && (
                          <div
                            className={`mb-2 pl-2.5 py-1 border-l-2 rounded text-[11px] ${
                              isMe
                                ? 'border-primary-foreground/50 bg-black/15 text-primary-foreground/90'
                                : 'border-primary bg-muted/70 text-muted-foreground'
                            }`}
                          >
                            <p className="font-bold text-[10px] opacity-90">
                              {msg.replyToSenderName || 'Original message'}
                            </p>
                            <p className="truncate">{msg.replyToText}</p>
                          </div>
                        )}

                        {/* Image Message */}
                        {msg.type === 'IMAGE' && msg.mediaPath && (
                          <div
                            className="mb-1.5 rounded-xl overflow-hidden cursor-pointer border border-border/40"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLightboxImage(msg.mediaPath || '');
                            }}
                          >
                            <img
                              src={msg.mediaPath}
                              alt="Attachment"
                              className="max-h-64 w-auto rounded-lg object-cover hover:opacity-95 transition"
                              loading="lazy"
                            />
                          </div>
                        )}

                        {/* Text */}
                        <p className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
                          {msg.text}
                        </p>

                        {/* Time and Delivery status footer */}
                        <div
                          className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                            isMe ? 'text-primary-foreground/75' : 'text-muted-foreground'
                          }`}
                        >
                          <span>{formatTime(msg.createdAt)}</span>
                          {isMe && (
                            <span>
                              {msg.status === 'READ' ? (
                                <CheckCheck className="w-3.5 h-3.5 text-emerald-300 dark:text-emerald-300" />
                              ) : msg.status === 'DELIVERED' ? (
                                <CheckCheck className="w-3.5 h-3.5 opacity-85" />
                              ) : msg.status === 'SENT' ? (
                                <Check className="w-3.5 h-3.5 opacity-80" />
                              ) : (
                                <Clock className="w-3 h-3 opacity-60" />
                              )}
                            </span>
                          )}
                        </div>

                        {/* Message actions (desktop hover + mobile tap) */}
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className={`absolute -top-3 ${
                            isMe ? 'right-2' : 'left-2'
                          } ${
                            isActive ? 'flex' : 'hidden group-hover:flex'
                          } items-center gap-0.5 bg-popover text-popover-foreground border border-border rounded-xl p-0.5 shadow-lg z-10`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setReplyTo(msg);
                              setActiveMessageId(null);
                            }}
                            title="Reply"
                            className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition"
                          >
                            <Reply className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(msg.text);
                              toast.success('Copied text');
                              setActiveMessageId(null);
                            }}
                            title="Copy text"
                            className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          {!isMe && (
                            <button
                              type="button"
                              onClick={() => {
                                setReportingMessage(msg);
                                setReportModalOpen(true);
                                setActiveMessageId(null);
                              }}
                              title="Report message"
                              className="p-1.5 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive transition"
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />
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
            <div className="flex items-center gap-2 text-xs text-muted-foreground pl-1">
              <span className="flex gap-1.5 items-center bg-card px-3 py-1.5 rounded-full border border-border shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce delay-100" />
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce delay-200" />
                <span className="text-[11px] ml-0.5 font-medium">{typingText} typing...</span>
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Scroll to bottom floating pill */}
        {showScrollBottom && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              isAtBottomRef.current = true;
              scrollToBottom('smooth');
            }}
            className="absolute bottom-3 right-4 z-20 rounded-full shadow-lg border border-border h-9 px-3 gap-1.5 text-xs font-semibold bg-card/95 backdrop-blur-md hover:bg-card"
          >
            <ArrowDown className="w-3.5 h-3.5 text-primary" />
            Latest
          </Button>
        )}
      </div>

      {/* Quick Replies Pill Carousel */}
      {showQuickReplies && (
        <div className="px-3 sm:px-5 py-2 bg-card/80 border-t border-border flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          <button
            type="button"
            onClick={() => setShowQuickReplies(false)}
            title="Hide quick replies"
            className="flex items-center gap-1 text-[10px] uppercase font-bold text-primary whitespace-nowrap px-2 py-1 rounded-full bg-primary/10 border border-primary/20 shrink-0"
          >
            <Zap className="w-3 h-3" />
            Quick
          </button>
          {quickReplies.map((qr, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSend(qr)}
              disabled={sending}
              className="text-xs whitespace-nowrap px-3 py-1.5 rounded-full bg-muted/70 hover:bg-primary/15 hover:border-primary/40 border border-border text-foreground/85 hover:text-primary transition shrink-0 font-medium"
            >
              {qr}
            </button>
          ))}
        </div>
      )}

      {/* Reply Quote Banner */}
      {replyTo && (
        <div className="px-4 py-2 bg-muted/60 border-t border-border flex items-center justify-between text-xs text-foreground shrink-0">
          <div className="flex items-center gap-2 border-l-2 border-primary pl-2.5 truncate">
            <Reply className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="truncate">
              Replying to <strong className="font-bold">{replyTo.senderName}:</strong>{' '}
              <span className="text-muted-foreground">{replyTo.text}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setReplyTo(null)}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Input Bar */}
      <div className="p-2.5 sm:p-3.5 bg-card border-t border-border flex items-center gap-2 shrink-0 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={handleImageSelect}
        />

        {!showQuickReplies && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShowQuickReplies(true)}
            title="Show quick replies"
            className="text-muted-foreground hover:text-primary hover:bg-muted rounded-xl h-10 w-10 shrink-0"
          >
            <Zap className="w-4 h-4" />
          </Button>
        )}

        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={uploadingImage || sending}
          onClick={() => fileInputRef.current?.click()}
          title="Attach image"
          className="text-muted-foreground hover:text-primary hover:bg-muted rounded-xl h-10 w-10 shrink-0"
        >
          {uploadingImage ? (
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          ) : (
            <ImageIcon className="w-5 h-5" />
          )}
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
          className="flex-1 bg-background border-border text-foreground placeholder:text-muted-foreground text-xs sm:text-sm h-11 rounded-xl focus-visible:ring-primary"
        />

        <Button
          type="button"
          disabled={!inputText.trim() || sending}
          onClick={() => handleSend()}
          className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-11 px-4 sm:px-5 shrink-0 shadow-md shadow-primary/20 transition font-semibold gap-1.5"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          <span className="hidden sm:inline text-xs">Send</span>
        </Button>
      </div>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightboxImage}
              alt="Enlarged attachment"
              className="max-h-[85vh] w-auto rounded-2xl object-contain shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute top-3 right-3 bg-card/90 text-foreground p-2 rounded-full hover:bg-card border border-border shadow-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {reportModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setReportModalOpen(false)}
        >
          <div
            className="bg-card text-card-foreground border border-border rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-destructive" />
                Report Conversation
              </h3>
              <button
                type="button"
                onClick={() => setReportModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Please choose a reason for reporting this chat. Hunger trust & safety staff will review the messages promptly.
            </p>

            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full bg-background border border-border rounded-xl p-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="Inappropriate conduct">Inappropriate / abusive language</option>
              <option value="Demanding off-platform payment">Demanding off-platform money</option>
              <option value="Spam or fraudulent behavior">Spam or fraudulent activity</option>
              <option value="Incorrect delivery address or harassment">Harassment / safety concern</option>
              <option value="Other">Other issue</option>
            </select>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setReportModalOpen(false)}
                className="text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleReport}
                className="text-xs rounded-xl font-bold"
              >
                Submit Report
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
