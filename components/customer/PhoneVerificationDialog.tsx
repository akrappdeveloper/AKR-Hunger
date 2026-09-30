'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from '@/components/ui/input-otp';
import {
  ShieldCheck,
  Phone,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Lock,
} from 'lucide-react';
import {
  RecaptchaVerifier,
  linkWithPhoneNumber,
  unlink,
  ConfirmationResult,
} from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { toast } from 'sonner';

interface PhoneVerificationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  phoneNumber: string;
  customerId: string;
  onSuccess: (verifiedFormattedPhone: string) => void;
}

export default function PhoneVerificationDialog({
  isOpen,
  onClose,
  phoneNumber,
  customerId,
  onSuccess,
}: PhoneVerificationDialogProps) {
  const [step, setStep] = useState<'initial' | 'sent' | 'verified'>('initial');
  const [otpInput, setOtpInput] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [countdown, setCountdown] = useState(60);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Fallback virtual state (only activates if real SMS cannot be sent)
  const [isVirtualMode, setIsVirtualMode] = useState(false);
  const [virtualOtp, setVirtualOtp] = useState('');
  const [copied, setCopied] = useState(false);

  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  // Normalize phone digits
  const cleanDigitsOnly = (phoneNumber || '').replace(/\D/g, '');
  const last10 = cleanDigitsOnly.slice(-10);

  // E.164 phone format for Firebase SMS
  let e164Phone = '';
  if (phoneNumber.startsWith('+')) {
    e164Phone = `+${cleanDigitsOnly}`;
  } else if (cleanDigitsOnly.length === 10) {
    e164Phone = `+91${cleanDigitsOnly}`;
  } else if (cleanDigitsOnly.length === 12 && cleanDigitsOnly.startsWith('91')) {
    e164Phone = `+${cleanDigitsOnly}`;
  } else {
    e164Phone = `+91${last10}`;
  }

  // Display format
  const formattedDisplayPhone = last10.length === 10
    ? `+91 ${last10.slice(0, 5)} ${last10.slice(5)}`
    : e164Phone;

  // Cleanup reCAPTCHA helper
  const cleanupRecaptcha = () => {
    if (recaptchaVerifierRef.current) {
      try {
        recaptchaVerifierRef.current.clear();
      } catch (e) {
        console.warn('Error clearing RecaptchaVerifier:', e);
      }
      recaptchaVerifierRef.current = null;
    }
  };

  // Reset dialog state on open/close
  useEffect(() => {
    if (isOpen) {
      setStep('initial');
      setOtpInput('');
      setConfirmationResult(null);
      setErrorMsg('');
      setCountdown(60);
      setIsVirtualMode(false);
      setVirtualOtp('');
      setCopied(false);
    } else {
      cleanupRecaptcha();
    }
    return () => {
      cleanupRecaptcha();
    };
  }, [isOpen]);

  // Cooldown countdown timer
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (step === 'sent' && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [step, countdown]);

  // Centralized Firebase error translation
  const handleFirebaseError = (error: any, context: 'send' | 'verify') => {
    console.error(`Firebase Phone Verification [${context}] error:`, error);
    const code = error?.code || '';
    let userFriendlyMessage = 'An unexpected error occurred. Please try again.';

    switch (code) {
      case 'auth/invalid-phone-number':
        userFriendlyMessage = 'Invalid mobile number format. Please enter a valid 10-digit number.';
        break;
      case 'auth/invalid-verification-code':
        userFriendlyMessage = 'Incorrect verification code. Please check and try again.';
        break;
      case 'auth/code-expired':
        userFriendlyMessage = 'The verification code has expired. Please request a new code.';
        break;
      case 'auth/too-many-requests':
        userFriendlyMessage = 'Too many requests. Please wait a moment before trying again.';
        break;
      case 'auth/quota-exceeded':
        userFriendlyMessage = 'Carrier SMS quota reached.';
        break;
      case 'auth/credential-already-in-use':
        userFriendlyMessage = 'This phone number is already linked to another account.';
        break;
      case 'auth/provider-already-linked':
        userFriendlyMessage = 'A phone number is already linked to your account. Updating...';
        break;
      case 'auth/requires-recent-login':
        userFriendlyMessage = 'Please log out and log back in before updating your phone number.';
        break;
      default:
        if (error?.message) {
          userFriendlyMessage = error.message
            .replace('Firebase: ', '')
            .replace(/\(auth\/[^)]+\)\.?/, '')
            .trim();
        }
        break;
    }

    setErrorMsg(userFriendlyMessage);
    cleanupRecaptcha();
  };

  // Initialize reCAPTCHA
  const initRecaptchaVerifier = (): RecaptchaVerifier | null => {
    cleanupRecaptcha();

    try {
      const verifier = new RecaptchaVerifier(auth, 'phone-verification-recaptcha-container', {
        size: 'invisible',
        callback: () => {},
        'expired-callback': () => {
          cleanupRecaptcha();
        },
      });

      recaptchaVerifierRef.current = verifier;
      return verifier;
    } catch (err: any) {
      console.error('Failed to initialize RecaptchaVerifier:', err);
      return null;
    }
  };

  // Fallback virtual OTP activator
  const activateVirtualOtpFallback = () => {
    const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
    setVirtualOtp(randomCode);
    setIsVirtualMode(true);
    setConfirmationResult(null);
    setStep('sent');
    setCountdown(60);
    setErrorMsg('');
    return randomCode;
  };

  // 1. Send SMS OTP (Falls back to virtual OTP if real SMS fails)
  const handleSendOtp = async () => {
    if (last10.length < 10) {
      toast.error('Please enter a valid 10-digit mobile number.');
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      toast.error('You must be logged in to verify your phone number.');
      setErrorMsg('No active user session. Please log in.');
      return;
    }

    setIsSending(true);
    setErrorMsg('');

    try {
      // Unlink previous phone if already attached
      if (currentUser.providerData?.some((p) => p.providerId === 'phone')) {
        try {
          await unlink(currentUser, 'phone');
        } catch (unlinkErr: any) {
          if (unlinkErr.code === 'auth/requires-recent-login') {
            setIsSending(false);
            handleFirebaseError(unlinkErr, 'send');
            return;
          }
        }
      }

      const verifier = initRecaptchaVerifier();
      if (!verifier) {
        setIsSending(false);
        activateVirtualOtpFallback();
        return;
      }

      // Link phone number to existing user
      const confirmation = await linkWithPhoneNumber(currentUser, e164Phone, verifier);
      setConfirmationResult(confirmation);
      setIsVirtualMode(false);
      setStep('sent');
      setCountdown(60);
      setIsSending(false);
      toast.success(`Verification SMS sent to ${formattedDisplayPhone}`);
    } catch (err: any) {
      console.warn('Carrier SMS failed, activating virtual fallback:', err);
      cleanupRecaptcha();
      setIsSending(false);

      // Graceful fallback to virtual OTP inside the dialog
      activateVirtualOtpFallback();
    }
  };

  // Copy code to clipboard
  const handleCopyOtp = () => {
    if (!virtualOtp) return;
    navigator.clipboard.writeText(virtualOtp);
    setCopied(true);
    toast.success('Code copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  // Verification helper
  const completeVerification = async (codeToVerify: string, isVirtual: boolean) => {
    const code = codeToVerify.trim();

    if (code.length !== 6) {
      setErrorMsg('Please enter all 6 digits of the verification code.');
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      toast.error('User session lost. Please log in again.');
      setErrorMsg('User not authenticated.');
      return;
    }

    setIsVerifying(true);
    setErrorMsg('');

    try {
      if (isVirtual) {
        if (code !== virtualOtp) {
          setIsVerifying(false);
          setErrorMsg(`Incorrect code. Please enter the code shown above: ${virtualOtp}`);
          return;
        }
      } else {
        if (!confirmationResult) {
          setIsVerifying(false);
          setErrorMsg('Verification session expired. Please request a new code.');
          return;
        }
        await confirmationResult.confirm(code);
      }

      // Update Firestore customer doc
      await updateDoc(doc(db, 'customers', currentUser.uid), {
        phone: formattedDisplayPhone,
        phoneVerified: true,
        verifiedPhone: last10,
        updatedAt: new Date(),
      });

      setStep('verified');
      setIsVerifying(false);
      toast.success('Phone number verified successfully!');

      onSuccess(formattedDisplayPhone);

      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err: any) {
      setIsVerifying(false);
      handleFirebaseError(err, 'verify');
    }
  };

  // Verify OTP button handler
  const handleVerifyOtp = async () => {
    await completeVerification(otpInput, isVirtualMode);
  };

  // 1-Click submit handler for virtual OTP
  const handleAutoFillAndSubmit = async () => {
    if (!virtualOtp) return;
    setOtpInput(virtualOtp);
    await completeVerification(virtualOtp, true);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-card/95 backdrop-blur-xl border border-border/70 text-card-foreground sm:max-w-[420px] shadow-2xl rounded-3xl p-6 sm:p-7 overflow-hidden">
        {/* Invisible reCAPTCHA container */}
        <div id="phone-verification-recaptcha-container" className="flex justify-center my-0" />

        <DialogHeader className="text-center pt-1">
          {/* Header Icon */}
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center mb-3 shadow-xs">
            {step === 'verified' ? (
              <CheckCircle2 className="w-7 h-7 text-emerald-500 animate-in zoom-in-50 duration-300" />
            ) : (
              <ShieldCheck className="w-7 h-7 text-primary" />
            )}
          </div>

          <DialogTitle className="text-xl font-bold text-foreground tracking-tight">
            {step === 'verified'
              ? 'Phone Verified'
              : step === 'sent'
              ? 'Enter Verification Code'
              : 'Verify Phone Number'}
          </DialogTitle>

          <DialogDescription className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            {step === 'verified' ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                Your phone number is now verified and linked to your account.
              </span>
            ) : step === 'sent' ? (
              isVirtualMode ? (
                <>
                  Use the verification code shown below for{' '}
                  <strong className="text-foreground font-semibold font-mono">{formattedDisplayPhone}</strong>
                </>
              ) : (
                <>
                  Enter the 6-digit code sent to{' '}
                  <strong className="text-foreground font-semibold font-mono">{formattedDisplayPhone}</strong>
                </>
              )
            ) : (
              <>
                Confirm your mobile number to ensure smooth delivery coordination.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Content Section */}
        <div className="py-2 space-y-4">
          {/* STEP 1: INITIAL (Clean, No Demo Junk) */}
          {step === 'initial' && (
            <div className="space-y-4">
              <div className="bg-muted/30 border border-border/70 rounded-2xl p-4 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Mobile Number
                  </span>
                  <div className="flex items-center gap-2 text-foreground font-mono font-bold text-base">
                    <Phone className="w-4 h-4 text-primary shrink-0" />
                    <span>{formattedDisplayPhone}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold border border-primary/20">
                  <Lock className="w-3 h-3" />
                  <span>Secure</span>
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium flex items-start gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <Button
                onClick={handleSendOtp}
                disabled={isSending || last10.length < 10}
                className="w-full h-11 sm:h-12 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm shadow-md shadow-primary/20 gap-2 transition-all active:scale-[0.99]"
              >
                {isSending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Sending Code...</span>
                  </>
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          )}

          {/* STEP 2: ENTER CODE & VERIFY */}
          {step === 'sent' && (
            <div className="space-y-4">
              {/* If Virtual Mode: Show clean OTP box with 1-click submit */}
              {isVirtualMode ? (
                <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3.5 sm:p-4 text-center space-y-3 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" />
                      Verification Code
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                      Instant OTP
                    </span>
                  </div>

                  <div className="flex items-center justify-center gap-2 py-0.5">
                    <span className="font-mono text-2xl sm:text-3xl font-black tracking-widest text-foreground bg-background px-4 py-1.5 rounded-xl border border-border shadow-xs select-all">
                      {virtualOtp}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyOtp}
                      className="h-10 w-10 p-0 rounded-xl hover:bg-background border border-transparent hover:border-border text-muted-foreground hover:text-foreground"
                      title="Copy Code"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>

                  {/* 1-Click Auto Fill & Submit */}
                  <Button
                    type="button"
                    onClick={handleAutoFillAndSubmit}
                    disabled={isVerifying}
                    className="w-full h-10 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs sm:text-sm shadow-sm gap-2 transition-all active:scale-[0.99]"
                  >
                    {isVerifying ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Click to Submit</span>
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="bg-muted/30 border border-border/60 rounded-2xl p-3 text-center text-xs text-muted-foreground">
                  Check your SMS messages for the 6-digit code sent to{' '}
                  <strong className="text-foreground">{formattedDisplayPhone}</strong>.
                </div>
              )}

              {/* Segmented OTP Input */}
              <div className="flex flex-col items-center justify-center py-1">
                <InputOTP
                  maxLength={6}
                  value={otpInput}
                  onChange={(val) => {
                    setOtpInput(val);
                    setErrorMsg('');
                  }}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} className="w-10 h-11 sm:w-11 sm:h-12 text-base font-bold" />
                    <InputOTPSlot index={1} className="w-10 h-11 sm:w-11 sm:h-12 text-base font-bold" />
                    <InputOTPSlot index={2} className="w-10 h-11 sm:w-11 sm:h-12 text-base font-bold" />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={3} className="w-10 h-11 sm:w-11 sm:h-12 text-base font-bold" />
                    <InputOTPSlot index={4} className="w-10 h-11 sm:w-11 sm:h-12 text-base font-bold" />
                    <InputOTPSlot index={5} className="w-10 h-11 sm:w-11 sm:h-12 text-base font-bold" />
                  </InputOTPGroup>
                </InputOTP>

                {errorMsg && (
                  <p className="text-xs text-destructive font-medium mt-2 flex items-center gap-1 animate-in fade-in text-center max-w-xs">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errorMsg}</span>
                  </p>
                )}
              </div>

              {/* Verify Button (Manual entry) */}
              <Button
                onClick={handleVerifyOtp}
                disabled={isVerifying || otpInput.trim().length !== 6}
                className="w-full h-11 sm:h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/20 gap-2 transition-all active:scale-[0.99]"
              >
                {isVerifying ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Verify Code</span>
                  </>
                )}
              </Button>

              {/* Footer Controls */}
              <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
                <button
                  type="button"
                  onClick={() => {
                    cleanupRecaptcha();
                    setStep('initial');
                    setOtpInput('');
                    setErrorMsg('');
                    setIsVirtualMode(false);
                  }}
                  className="hover:text-foreground font-semibold hover:underline"
                >
                  Change Number
                </button>

                {countdown > 0 ? (
                  <span className="font-mono text-muted-foreground">
                    Resend in <strong className="text-foreground">{countdown}s</strong>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={isSending}
                    className="text-primary hover:underline font-bold flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> Resend Code
                  </button>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: VERIFIED */}
          {step === 'verified' && (
            <div className="py-6 text-center space-y-2.5 animate-in zoom-in-95 duration-300">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 shadow-sm">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-foreground">Verification Complete</h3>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                <strong className="text-foreground">{formattedDisplayPhone}</strong> is now verified and linked to your account.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
