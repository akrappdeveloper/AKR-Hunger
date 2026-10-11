'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  serverTimestamp,
  arrayUnion,
  deleteDoc,
  collection,
  addDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  PhoneCall,
  X,
  CameraOff,
  ShieldCheck,
  Maximize2,
  Minimize2,
  Wifi,
  Sparkles,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

interface KycVideoCallProps {
  isOpen: boolean;
  onClose: () => void;
  role: 'admin' | 'rider';
  deliveryPersonId: string;
  deliveryPersonName: string;
  adminName?: string;
  onKycApproved?: () => void;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
  ],
};

export default function KycVideoCall({
  isOpen,
  onClose,
  role,
  deliveryPersonId,
  deliveryPersonName,
  adminName = 'KYC Admin Desk',
  onKycApproved,
}: KycVideoCallProps) {
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'connected' | 'ended'>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isCompletingVkyc, setIsCompletingVkyc] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const unsubscribeCallRef = useRef<(() => void) | null>(null);
  const candidateQueueRef = useRef<RTCIceCandidateInit[]>([]);

  // Format seconds to mm:ss
  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60).toString().padStart(2, '0');
    const secs = (sec % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  useEffect(() => {
    if (isOpen && deliveryPersonId) {
      initCall();
    } else {
      cleanupCall();
    }

    return () => {
      cleanupCall();
    };
  }, [isOpen, deliveryPersonId]);

  const cleanupCall = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (unsubscribeCallRef.current) {
      unsubscribeCallRef.current();
      unsubscribeCallRef.current = null;
    }

    setDuration(0);
    setCallStatus('idle');
  };

  const getMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err: any) {
      console.error('Camera/Mic permission error:', err);
      toast.error('Unable to access camera or microphone: ' + (err.message || 'Permission denied'));
      throw err;
    }
  };

  const initCall = async () => {
    try {
      setCallStatus('calling');
      const stream = await getMedia();
      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionRef.current = pc;

      // Add local stream tracks to WebRTC
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Handle incoming remote tracks
      pc.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
          setCallStatus('connected');
          if (!timerRef.current) {
            timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
          }
        }
      };

      // WebRTC Connection State Logging
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setCallStatus('connected');
          if (!timerRef.current) {
            timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
          }
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          toast.warning('WebRTC connection interrupted');
        }
      };

      const callDocRef = doc(db, 'kycVideoCalls', deliveryPersonId);

      // Handle ICE Candidates generated locally
      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          const candidateData = event.candidate.toJSON();
          const targetField = role === 'admin' ? 'adminCandidates' : 'riderCandidates';
          try {
            await updateDoc(callDocRef, {
              [targetField]: arrayUnion(candidateData),
              updatedAt: serverTimestamp(),
            });
          } catch (_) {}
        }
      };

      if (role === 'admin') {
        // ADMIN initiates the call: create SDP offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        await setDoc(
          callDocRef,
          {
            callId: deliveryPersonId,
            deliveryPersonId,
            deliveryPersonName,
            adminName,
            caller: 'admin',
            status: 'calling',
            offer: { type: offer.type, sdp: offer.sdp },
            adminCandidates: [],
            riderCandidates: [],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        // Listen for Rider's Answer and ICE Candidates
        const unsub = onSnapshot(callDocRef, async (snap) => {
          if (!snap.exists()) return;
          const data = snap.data();

          if (data.status === 'ended') {
            toast.info('Call ended by participant');
            endCallLocally();
            return;
          }

          // Apply Rider's SDP Answer
          if (data.answer && !pc.currentRemoteDescription) {
            const rtcDesc = new RTCSessionDescription(data.answer);
            await pc.setRemoteDescription(rtcDesc);

            // Process queued candidates
            while (candidateQueueRef.current.length > 0) {
              const cand = candidateQueueRef.current.shift();
              if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand));
            }
          }

          // Apply Rider's ICE Candidates
          if (data.riderCandidates && Array.isArray(data.riderCandidates)) {
            for (const cand of data.riderCandidates) {
              if (pc.remoteDescription) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(cand));
                } catch (_) {}
              } else {
                candidateQueueRef.current.push(cand);
              }
            }
          }
        });

        unsubscribeCallRef.current = unsub;
      } else {
        // RIDER answers the call: read offer, create answer
        const unsub = onSnapshot(callDocRef, async (snap) => {
          if (!snap.exists()) return;
          const data = snap.data();

          if (data.status === 'ended') {
            toast.info('Call ended by admin');
            endCallLocally();
            return;
          }

          if (data.offer && !pc.currentRemoteDescription) {
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            await updateDoc(callDocRef, {
              answer: { type: answer.type, sdp: answer.sdp },
              status: 'connected',
              updatedAt: serverTimestamp(),
            });
          }

          // Apply Admin's ICE Candidates
          if (data.adminCandidates && Array.isArray(data.adminCandidates)) {
            for (const cand of data.adminCandidates) {
              if (pc.remoteDescription) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(cand));
                } catch (_) {}
              } else {
                candidateQueueRef.current.push(cand);
              }
            }
          }
        });

        unsubscribeCallRef.current = unsub;
      }
    } catch (err: any) {
      console.error('Call initialization failed:', err);
      toast.error('Could not initialize video call');
      onClose();
    }
  };

  const endCallLocally = () => {
    setCallStatus('ended');
    setTimeout(() => {
      cleanupCall();
      onClose();
    }, 1200);
  };

  const handleEndCall = async () => {
    try {
      const callDocRef = doc(db, 'kycVideoCalls', deliveryPersonId);
      await updateDoc(callDocRef, {
        status: 'ended',
        endedAt: serverTimestamp(),
        duration,
      });
    } catch (_) {}
    endCallLocally();
  };

  const handleConfirmCompleteVkyc = async () => {
    if (isCompletingVkyc) return;
    setIsCompletingVkyc(true);

    try {
      // 1. Update deliveryPersons collection in Firestore
      await updateDoc(doc(db, 'deliveryPersons', deliveryPersonId), {
        verificationStatus: 'approved',
        kycStatus: 'approved',
        vkycStatus: 'verified',
        isVerified: true,
        kycApprovedAt: serverTimestamp(),
      });

      // 2. Mark kycVideoCalls as completed
      await updateDoc(doc(db, 'kycVideoCalls', deliveryPersonId), {
        status: 'completed',
        vkycCompleted: true,
        endedAt: serverTimestamp(),
        duration,
      });

      // 3. Mark vkyc_requests as approved/completed if exists
      try {
        await updateDoc(doc(db, 'vkyc_requests', deliveryPersonId), {
          status: 'approved',
          verifiedAt: serverTimestamp(),
        });
      } catch (_) {}

      // 4. Create in-app notification for the delivery partner
      try {
        await addDoc(collection(db, 'notifications'), {
          userId: deliveryPersonId,
          userType: 'delivery',
          type: 'vkyc_completed',
          title: '🎉 V-KYC Approved & Completed!',
          message: 'Congratulations! Your Live Video KYC has been verified by the Admin Desk. You are now authorized to accept delivery orders.',
          isRead: false,
          createdAt: serverTimestamp(),
        });
      } catch (_) {}

      // 5. Send FCM push notification to rider's device
      try {
        fetch('/api/notifications/send-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: deliveryPersonId,
            role: 'delivery',
            title: '🎉 V-KYC Approved & Verified!',
            body: 'Congratulations! Your live video KYC is complete. You can now start taking deliveries!',
            data: {
              type: 'vkyc_completed',
              status: 'approved',
              action: 'close_call',
            },
          }),
        }).catch((e) => console.warn('Push dispatch warning:', e));
      } catch (_) {}

      toast.success('Live V-KYC Successfully Verified & Approved!');
      
      // 6. End call locally and notify parent
      endCallLocally();
      if (onKycApproved) {
        onKycApproved();
      }
    } catch (err: any) {
      console.error('Error completing V-KYC:', err);
      toast.error('Failed to complete V-KYC: ' + (err.message || 'Unknown error'));
      setIsCompletingVkyc(false);
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleCam = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = isCamOff;
      });
      setIsCamOff(!isCamOff);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleEndCall()}>
      <DialogContent className="bg-gray-950 border border-white/10 text-white max-w-3xl p-0 overflow-hidden rounded-3xl shadow-2xl">
        <div className="relative bg-gradient-to-br from-gray-900 via-gray-950 to-black min-h-[500px] flex flex-col justify-between">
          {/* Top Bar */}
          <div className="z-20 p-4 sm:p-5 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                  {role === 'admin' ? deliveryPersonName : adminName}
                  <Badge variant="outline" className="text-[10px] font-mono border-violet-500/30 text-violet-300 bg-violet-500/10">
                    Live KYC WebRTC
                  </Badge>
                </p>
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      callStatus === 'connected'
                        ? 'bg-emerald-400 animate-pulse'
                        : callStatus === 'calling'
                        ? 'bg-amber-400 animate-ping'
                        : 'bg-rose-500'
                    }`}
                  />
                  <span className={callStatus === 'connected' ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>
                    {callStatus === 'connected'
                      ? `Secure Peer Connection • ${formatDuration(duration)}`
                      : callStatus === 'calling'
                      ? 'Establishing WebRTC Connection...'
                      : 'Call Concluded'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {role === 'admin' && (
                <Button
                  onClick={handleConfirmCompleteVkyc}
                  disabled={isCompletingVkyc}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm px-3.5 sm:px-4 h-9 sm:h-10 rounded-xl shadow-lg shadow-emerald-600/30 gap-2 cursor-pointer transition-all active:scale-95"
                >
                  {isCompletingVkyc ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-100" />
                  )}
                  <span>Confirm Complete V-KYC</span>
                </Button>
              )}

              <Button
                size="icon"
                variant="ghost"
                onClick={handleEndCall}
                className="text-white/60 hover:text-white hover:bg-white/10 rounded-full"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Main Remote Video Area */}
          <div className="relative flex-1 w-full h-[380px] sm:h-[440px] bg-gray-900 flex items-center justify-center overflow-hidden">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />

            {/* Waiting / Connecting Overlay */}
            {callStatus !== 'connected' && (
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-black/80 flex flex-col items-center justify-center p-6 text-center z-10">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-600 to-purple-800 flex items-center justify-center text-3xl font-black text-white shadow-2xl shadow-violet-600/30 mb-4 animate-bounce">
                  {role === 'admin' ? deliveryPersonName?.charAt(0)?.toUpperCase() || 'R' : 'AK'}
                </div>
                <h3 className="text-xl font-bold text-white">
                  {role === 'admin' ? `Calling ${deliveryPersonName}...` : 'Connecting to KYC Admin Desk...'}
                </h3>
                <p className="text-gray-400 text-sm mt-1 max-w-sm">
                  {role === 'admin'
                    ? 'Waiting for delivery partner to connect camera feed over peer-to-peer WebRTC.'
                    : 'Please keep your camera centered and your identity document ready.'}
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs font-mono text-violet-400 bg-violet-500/10 px-3 py-1.5 rounded-full border border-violet-500/20">
                  <Wifi className="w-3.5 h-3.5 animate-spin" />
                  STUN P2P Encryption Active
                </div>
              </div>
            )}

            {/* PiP Local Video (Picture in Picture) */}
            <div className="absolute bottom-4 right-4 w-32 h-44 sm:w-40 sm:h-52 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl z-20 bg-gray-950">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transform -scale-x-100 ${isCamOff ? 'opacity-0' : 'opacity-100'}`}
              />
              {isCamOff && (
                <div className="absolute inset-0 bg-gray-900 flex flex-col items-center justify-center text-center p-2">
                  <CameraOff className="w-6 h-6 text-gray-500 mb-1" />
                  <span className="text-[10px] text-gray-400">Camera Off</span>
                </div>
              )}
              <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-md text-[10px] font-semibold text-white">
                You
              </div>
            </div>
          </div>

          {/* Bottom Controls Bar */}
          <div className="z-20 p-4 sm:p-6 bg-gradient-to-t from-black via-black/90 to-transparent flex items-center justify-center gap-4 sm:gap-6">
            {/* Mute Button */}
            <button
              onClick={toggleMute}
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center transition-all ${
                isMuted
                  ? 'bg-rose-600/80 text-white shadow-lg shadow-rose-600/30'
                  : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6" />}
            </button>

            {/* End Call Button */}
            <button
              onClick={handleEndCall}
              className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white flex items-center justify-center shadow-2xl shadow-rose-600/50 hover:scale-105 active:scale-95 transition-all"
              title="End Verification Call"
            >
              <PhoneOff className="w-7 h-7 sm:w-8 sm:h-8" />
            </button>

            {/* Camera Toggle Button */}
            <button
              onClick={toggleCam}
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center transition-all ${
                isCamOff
                  ? 'bg-rose-600/80 text-white shadow-lg shadow-rose-600/30'
                  : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
              }`}
              title={isCamOff ? 'Turn Camera On' : 'Turn Camera Off'}
            >
              {isCamOff ? <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Video className="w-5 h-5 sm:w-6 sm:h-6" />}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
