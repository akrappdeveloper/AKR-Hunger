'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Mic,
  MicOff,
  Search,
  Sparkles,
  RotateCcw,
  Volume2,
  X,
  AlertCircle,
  Flame,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';

interface VoiceSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTranscript?: (transcript: string) => void;
}

export default function VoiceSearchDialog({
  open,
  onOpenChange,
  onTranscript,
}: VoiceSearchDialogProps) {
  const router = useRouter();
  const [isListening, setIsListening] = React.useState(false);
  const [transcript, setTranscript] = React.useState('');
  const [interimTranscript, setInterimTranscript] = React.useState('');
  const [isSupported, setIsSupported] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const recognitionRef = React.useRef<any>(null);
  const autoSearchTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Initialize Web Speech API
  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setErrorMessage(null);
      };

      recognition.onresult = (event: any) => {
        let currentInterim = '';
        let finalTranscriptAccum = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscriptAccum += result[0].transcript;
          } else {
            currentInterim += result[0].transcript;
          }
        }

        if (finalTranscriptAccum) {
          const fullText = (transcript + ' ' + finalTranscriptAccum).trim();
          setTranscript(fullText);
          setInterimTranscript('');

          // Auto-trigger search after a short pause if speech detected
          if (autoSearchTimerRef.current) clearTimeout(autoSearchTimerRef.current);
          autoSearchTimerRef.current = setTimeout(() => {
            handleConfirmSearch(fullText);
          }, 1400);
        } else {
          setInterimTranscript(currentInterim);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setErrorMessage('Microphone access was denied. Please allow microphone permissions in your browser.');
        } else if (event.error === 'no-speech') {
          // Keep listening or prompt user
        } else {
          setErrorMessage(`Voice input error: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } catch (err) {
      console.error('Error creating SpeechRecognition instance:', err);
      setIsSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }
      if (autoSearchTimerRef.current) clearTimeout(autoSearchTimerRef.current);
    };
  }, []);

  // Auto-start listening when dialog opens
  React.useEffect(() => {
    if (open) {
      setTranscript('');
      setInterimTranscript('');
      setErrorMessage(null);
      startListening();
    } else {
      stopListening();
    }
  }, [open]);

  const startListening = () => {
    if (!recognitionRef.current || !isSupported) return;
    setErrorMessage(null);
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (err) {
      // If already started, ignore error
      setIsListening(true);
    }
  };

  const stopListening = () => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch (_) {}
    setIsListening(false);
    if (autoSearchTimerRef.current) clearTimeout(autoSearchTimerRef.current);
  };

  const handleConfirmSearch = (queryText?: string) => {
    const term = (queryText || transcript || interimTranscript).trim();
    if (!term) return;

    stopListening();
    onOpenChange(false);

    if (onTranscript) {
      onTranscript(term);
    } else {
      router.push(`/customer/search?q=${encodeURIComponent(term)}`);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    stopListening();
    onOpenChange(false);
    if (onTranscript) {
      onTranscript(suggestion);
    } else {
      router.push(`/customer/search?q=${encodeURIComponent(suggestion)}`);
    }
  };

  const displayText = transcript || interimTranscript;

  const sampleSuggestions = [
    'Hyderabadi Chicken Biryani',
    'Woodfired Margherita Pizza',
    'Crispy Chicken Burger',
    'Chocolate Brownie Sundae',
    'Paneer Butter Masala',
    'Cold Brew Coffee',
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-2xl border border-border/80 text-card-foreground p-0 overflow-hidden shadow-2xl rounded-3xl">
        <div className="relative p-6 sm:p-8 flex flex-col items-center text-center">
          {/* Decorative Background Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-primary/20 blur-3xl -z-10 rounded-full pointer-events-none" />

          {/* Close Button */}
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-4 right-4 p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <DialogHeader className="flex flex-col items-center">
            <Badge
              variant="outline"
              className="mb-3 px-3 py-1 rounded-full text-xs font-semibold gap-1.5 border-primary/30 bg-primary/10 text-primary"
            >
              <Sparkles className="w-3.5 h-3.5" /> Hunger Voice Search
            </Badge>
            <DialogTitle className="text-xl sm:text-2xl font-black text-foreground">
              {isListening ? 'Listening to you...' : displayText ? 'Speech Recognized' : 'Voice Search'}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-xs">
              Speak any food item, cuisine, or restaurant name clearly into your microphone
            </DialogDescription>
          </DialogHeader>

          {/* Animated Central Voice Orb */}
          <div className="relative my-8 flex items-center justify-center">
            {/* Pulsing Ripple Rings */}
            {isListening && (
              <>
                <motion.div
                  className="absolute w-28 h-28 rounded-full border border-primary/40 bg-primary/5"
                  animate={{ scale: [1, 1.45, 1.8], opacity: [0.8, 0.4, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                />
                <motion.div
                  className="absolute w-36 h-36 rounded-full border border-primary/30 bg-primary/5"
                  animate={{ scale: [1, 1.35, 1.7], opacity: [0.6, 0.3, 0] }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.5, ease: 'easeOut' }}
                />
                <motion.div
                  className="absolute w-44 h-44 rounded-full border border-primary/20 bg-primary/5"
                  animate={{ scale: [1, 1.25, 1.6], opacity: [0.5, 0.2, 0] }}
                  transition={{ duration: 2, repeat: Infinity, delay: 1, ease: 'easeOut' }}
                />
              </>
            )}

            {/* Glowing Center Microphone Button */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={isListening ? stopListening : startListening}
              className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 ${
                isListening
                  ? 'bg-gradient-to-tr from-primary via-orange-500 to-amber-400 text-white shadow-primary/40 animate-pulse'
                  : 'bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground border border-border'
              }`}
            >
              {isListening ? (
                <Mic className="w-10 h-10 animate-bounce-subtle" />
              ) : (
                <MicOff className="w-10 h-10" />
              )}
            </motion.button>
          </div>

          {/* Sound Wave Bars Animation */}
          {isListening && (
            <div className="flex items-center gap-1.5 h-6 mb-4">
              {[0.4, 0.8, 1.2, 0.6, 1.0, 0.5, 1.3, 0.7].map((heightScale, i) => (
                <motion.span
                  key={i}
                  className="w-1 bg-primary rounded-full"
                  animate={{ height: ['6px', `${24 * heightScale}px`, '6px'] }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    delay: i * 0.1,
                    ease: 'easeInOut',
                  }}
                />
              ))}
            </div>
          )}

          {/* Live Transcript Box */}
          <div className="w-full min-h-[72px] bg-muted/40 rounded-2xl p-4 border border-border/60 flex flex-col items-center justify-center mb-6">
            {displayText ? (
              <p className="text-base sm:text-lg font-bold text-foreground tracking-wide leading-snug break-words">
                &ldquo;{displayText}&rdquo;
              </p>
            ) : (
              <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-primary animate-pulse" />
                <span>Say something like <em>&ldquo;Crispy Chicken Burger&rdquo;</em>...</span>
              </p>
            )}
          </div>

          {/* Error Message if any */}
          {errorMessage && (
            <div className="w-full mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2 text-left">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3 w-full">
            {displayText ? (
              <>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    setTranscript('');
                    setInterimTranscript('');
                    startListening();
                  }}
                  className="flex-1 rounded-2xl gap-2 font-semibold"
                >
                  <RotateCcw className="w-4 h-4" /> Try Again
                </Button>
                <Button
                  size="lg"
                  onClick={() => handleConfirmSearch()}
                  className="flex-1 rounded-2xl gap-2 font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/25"
                >
                  <Search className="w-4 h-4" /> Search Now
                </Button>
              </>
            ) : (
              <Button
                variant={isListening ? 'secondary' : 'default'}
                size="lg"
                onClick={isListening ? stopListening : startListening}
                className="w-full rounded-2xl gap-2 font-bold"
              >
                {isListening ? (
                  <>
                    <MicOff className="w-4 h-4" /> Stop Listening
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" /> Start Listening
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Quick Suggestions Chips */}
          <div className="w-full mt-6 pt-5 border-t border-border/60">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center justify-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-orange-500" /> Popular quick picks
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {sampleSuggestions.map((item) => (
                <button
                  key={item}
                  onClick={() => handleSuggestionClick(item)}
                  className="text-xs px-2.5 py-1 rounded-full bg-muted/60 hover:bg-primary/10 hover:text-primary border border-border/50 transition-colors"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
