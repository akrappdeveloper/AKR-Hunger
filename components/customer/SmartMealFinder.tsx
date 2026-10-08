'use client';

/**
 * Hunger Smart Meal AI Component
 * ================================
 * Natural language food finder powered by local AI (Ollama) with
 * rule-based fallback. Works completely offline.
 *
 * Usage:
 *   <SmartMealFinder onResults={handleResults} />
 */

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Mic, MicOff, Search, X, ChevronRight, Brain, Zap, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MealIntent } from '@/lib/hunger-types-client';

interface SmartMealFinderProps {
  onResults: (intent: MealIntent, query: string) => void;
  className?: string;
}

const EXAMPLE_QUERIES = [
  '₹200 ke andar spicy veg food chahiye',
  'High protein meal under ₹350',
  'Dinner for 3 people under ₹500',
  'Something light and healthy tonight',
  'Biryani aur cold drink ₹300 me',
];

export default function SmartMealFinder({ onResults, className }: SmartMealFinderProps) {
  const [query, setQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiMode, setAiMode] = useState<'ai' | 'rule' | 'normal' | null>(null);
  const [parsedIntent, setParsedIntent] = useState<MealIntent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const parseIntent = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setIsProcessing(true);
    setError(null);
    setParsedIntent(null);

    try {
      const res = await fetch('/api/ai/smart-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text }),
      });

      if (!res.ok) throw new Error('Failed to parse');

      const data = await res.json();
      setAiMode(data.mode);
      setParsedIntent(data.intent);
      onResults(data.intent, text);
    } catch {
      setError('Could not understand your request. Try again or use search.');
    } finally {
      setIsProcessing(false);
    }
  }, [onResults]);

  const startVoiceInput = useCallback(() => {
    if (typeof window === 'undefined') return;
    const win = window as any;
    if (!win.webkitSpeechRecognition && !win.SpeechRecognition) {
      setError('Voice input not supported in this browser.');
      return;
    }

    const SpeechRecognitionAPI = win.SpeechRecognition || win.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionAPI();
    recognitionRef.current = recognition;

    recognition.lang = 'hi-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsRecording(true);
    recognition.onend = () => setIsRecording(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setQuery(transcript);
      parseIntent(transcript);
    };
    recognition.onerror = () => {
      setIsRecording(false);
      setError('Voice input failed. Try typing instead.');
    };

    recognition.start();
  }, [parseIntent]);

  const stopVoice = useCallback(() => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  }, []);

  const clear = useCallback(() => {
    setQuery('');
    setParsedIntent(null);
    setAiMode(null);
    setError(null);
    inputRef.current?.focus();
  }, []);

  return (
    <div className={`w-full ${className || ''}`}>
      {/* Main Search Bar */}
      <div className="relative">
        <div className="flex items-center gap-2 bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-red-500/10 border border-orange-500/30 rounded-2xl p-1 shadow-lg shadow-orange-500/10 backdrop-blur-sm">
          {/* AI Icon */}
          <div className="flex-shrink-0 pl-3">
            <motion.div
              animate={isProcessing ? { rotate: 360 } : { rotate: 0 }}
              transition={{ duration: 1, repeat: isProcessing ? Infinity : 0 }}
            >
              <Sparkles className="w-5 h-5 text-orange-500" />
            </motion.div>
          </div>

          {/* Input */}
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && parseIntent(query)}
            placeholder="What are you hungry for? ₹200 ke andar spicy veg..."
            className="flex-1 bg-transparent text-sm py-3 pr-2 outline-none placeholder:text-muted-foreground/60 text-foreground"
          />

          {/* Clear */}
          {query && (
            <button onClick={clear} className="flex-shrink-0 p-1.5 rounded-full hover:bg-white/10 transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}

          {/* Voice */}
          <button
            onClick={isRecording ? stopVoice : startVoiceInput}
            className={`flex-shrink-0 p-2.5 rounded-xl transition-all ${
              isRecording
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                : 'bg-orange-500/20 text-orange-500 hover:bg-orange-500/30'
            }`}
          >
            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Search Button */}
          <button
            onClick={() => parseIntent(query)}
            disabled={isProcessing || !query.trim()}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-medium text-sm shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 transition-all disabled:opacity-50"
          >
            {isProcessing ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity }}>
                <Sparkles className="w-4 h-4" />
              </motion.div>
            ) : (
              <Search className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Find</span>
          </button>
        </div>

        {/* Recording indicator */}
        <AnimatePresence>
          {isRecording && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="absolute top-full mt-2 left-0 right-0 flex items-center justify-center gap-2 text-sm text-red-400"
            >
              <motion.div
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                className="w-2 h-2 rounded-full bg-red-500"
              />
              Listening... speak now (Hindi/English/Hinglish)
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Example Queries */}
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="text-xs text-muted-foreground self-center">Try:</span>
        {EXAMPLE_QUERIES.slice(0, 3).map((ex, i) => (
          <button
            key={i}
            onClick={() => { setQuery(ex); parseIntent(ex); }}
            className="text-xs px-3 py-1.5 rounded-full border border-orange-500/20 bg-orange-500/5 text-orange-600 dark:text-orange-400 hover:border-orange-500/40 hover:bg-orange-500/10 transition-all"
          >
            {ex}
          </button>
        ))}
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 flex items-center gap-2 text-sm text-red-400 bg-red-500/10 rounded-xl px-4 py-3"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Parsed Intent Display */}
      <AnimatePresence>
        {parsedIntent && !error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {aiMode === 'ai' ? (
                  <><Brain className="w-4 h-4 text-emerald-400" /><span className="text-xs font-medium text-emerald-400">AI Parsed</span></>
                ) : (
                  <><Zap className="w-4 h-4 text-amber-400" /><span className="text-xs font-medium text-amber-400">Smart Match</span></>
                )}
              </div>
              <span className="text-xs text-muted-foreground">Searching with these filters</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {parsedIntent.budget && (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                  💰 Under ₹{parsedIntent.budget}
                </Badge>
              )}
              {parsedIntent.people && parsedIntent.people > 1 && (
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                  👥 {parsedIntent.people} people
                </Badge>
              )}
              {parsedIntent.vegetarian === true && (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">🌱 Veg</Badge>
              )}
              {parsedIntent.vegetarian === false && (
                <Badge className="bg-red-500/20 text-red-400 border-red-500/30">🍗 Non-Veg</Badge>
              )}
              {parsedIntent.spice && (
                <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                  🌶️ {parsedIntent.spice.charAt(0).toUpperCase() + parsedIntent.spice.slice(1)} Spice
                </Badge>
              )}
              {parsedIntent.meal && (
                <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                  🍽️ {parsedIntent.meal.charAt(0).toUpperCase() + parsedIntent.meal.slice(1)}
                </Badge>
              )}
              {parsedIntent.cuisine && (
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                  🍴 {parsedIntent.cuisine}
                </Badge>
              )}
              {parsedIntent.dietary?.map(d => (
                <Badge key={d} className="bg-teal-500/20 text-teal-400 border-teal-500/30">
                  {d}
                </Badge>
              ))}
            </div>

            {parsedIntent.query && (
              <p className="mt-2 text-xs text-muted-foreground">
                Searching: &ldquo;<span className="text-foreground">{parsedIntent.query}</span>&rdquo;
              </p>
            )}

            <button
              className="mt-3 text-xs text-emerald-400 flex items-center gap-1 hover:text-emerald-300 transition-colors"
              onClick={() => { setQuery(''); setParsedIntent(null); setAiMode(null); }}
            >
              Clear filters <ChevronRight className="w-3 h-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
