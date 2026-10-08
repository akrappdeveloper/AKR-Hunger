/**
 * Hunger Voice Ordering Service
 * ================================
 * Phase 5: Voice ordering using local Whisper model.
 * 
 * Flow:
 * 1. User taps mic button → browser MediaRecorder captures audio
 * 2. Audio blob sent to /api/ai/voice-order
 * 3. Backend sends to Whisper (local) for transcription
 * 4. Transcript sent to SmartMeal AI for intent parsing
 * 5. Results shown to user for confirmation
 *
 * Whisper runs locally via:
 * - whisper.cpp (https://github.com/ggerganov/whisper.cpp)
 * - OR faster-whisper (Python)
 * - OR Ollama with whisper support
 *
 * Fallback: browser SpeechRecognition API (no server needed)
 */

export interface VoiceOrderResult {
  transcript: string;
  confidence: number;
  intent: {
    query: string;
    cuisine?: string;
    dietary?: string;
    budget?: number;
    meal_type?: string;
    time_context?: string;
  };
  mode: 'whisper' | 'browser_sr' | 'manual';
  processingMs: number;
}

export interface WhisperConfig {
  baseUrl: string;       // e.g., http://localhost:8080 (whisper.cpp server)
  model: string;         // e.g., "base", "small", "medium"
  language: string;      // e.g., "auto", "en", "hi"
  timeoutMs: number;
}

export const DEFAULT_WHISPER_CONFIG: WhisperConfig = {
  baseUrl: process.env.WHISPER_BASE_URL || 'http://localhost:8080',
  model: process.env.WHISPER_MODEL || 'small',
  language: 'auto',
  timeoutMs: 15000,
};

/**
 * Transcribe audio blob via local Whisper server.
 * Falls back to null on failure.
 */
export async function transcribeWithWhisper(
  audioBlob: Blob,
  config: WhisperConfig = DEFAULT_WHISPER_CONFIG
): Promise<{ transcript: string; confidence: number } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');
    formData.append('model', config.model);
    formData.append('language', config.language);
    formData.append('response_format', 'json');

    // whisper.cpp server endpoint
    const res = await fetch(`${config.baseUrl}/inference`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) return null;

    const data = await res.json();
    return {
      transcript: (data.text || '').trim(),
      confidence: data.confidence || 0.9,
    };
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/**
 * Parse voice transcript into meal intent using rule-based NLP.
 * No AI needed for basic parsing.
 */
export function parseVoiceIntent(transcript: string): VoiceOrderResult['intent'] {
  const text = transcript.toLowerCase().trim();

  // Extract budget
  const budgetMatch = text.match(/(?:under|below|within|for|budget\s+of?)?\s*(?:₹|rs\.?|rupees?)?\s*(\d+)/);
  const budget = budgetMatch ? parseInt(budgetMatch[1]) : undefined;

  // Extract cuisine type
  const cuisines = ['biryani', 'pizza', 'burger', 'chinese', 'south indian', 'north indian',
    'mughlai', 'pasta', 'sushi', 'thai', 'mexican', 'continental', 'indian'];
  const cuisine = cuisines.find(c => text.includes(c));

  // Extract dietary preference
  const dietary = text.includes('veg') && !text.includes('non-veg') ? 'vegetarian'
    : text.includes('non-veg') || text.includes('chicken') || text.includes('mutton') || text.includes('fish') ? 'non-vegetarian'
    : text.includes('vegan') ? 'vegan'
    : undefined;

  // Extract meal type
  const mealType = text.includes('breakfast') ? 'breakfast'
    : text.includes('lunch') ? 'lunch'
    : text.includes('dinner') ? 'dinner'
    : text.includes('snack') ? 'snack'
    : text.includes('dessert') || text.includes('sweet') ? 'dessert'
    : undefined;

  // Extract time context
  const timeContext = text.includes('late night') || text.includes('midnight') ? 'late_night'
    : text.includes('quick') || text.includes('fast') || text.includes('asap') ? 'quick'
    : undefined;

  // Build clean query for search
  const stopWords = ['i want', 'i need', 'order me', 'get me', 'can i have', 'please', 'something', 'food'];
  let query = text;
  stopWords.forEach(sw => { query = query.replace(sw, '').trim(); });
  query = query.slice(0, 100);

  return { query, cuisine, dietary, budget, meal_type: mealType, time_context: timeContext };
}

/**
 * Format voice result for display.
 */
export function formatVoiceResult(result: VoiceOrderResult): {
  headline: string;
  detail: string;
  tags: string[];
} {
  const tags: string[] = [];
  if (result.intent.cuisine) tags.push(`🍽️ ${result.intent.cuisine}`);
  if (result.intent.dietary === 'vegetarian') tags.push('🌱 Veg');
  if (result.intent.dietary === 'non-vegetarian') tags.push('🍗 Non-veg');
  if (result.intent.budget) tags.push(`💰 Under ₹${result.intent.budget}`);
  if (result.intent.meal_type) tags.push(`⏰ ${result.intent.meal_type}`);
  if (result.intent.time_context === 'late_night') tags.push('🌙 Late night');
  if (result.intent.time_context === 'quick') tags.push('⚡ Quick delivery');

  return {
    headline: `"${result.transcript}"`,
    detail: `Searching for: ${result.intent.query}`,
    tags,
  };
}

/**
 * Check if local Whisper server is available.
 */
export async function isWhisperAvailable(config: WhisperConfig = DEFAULT_WHISPER_CONFIG): Promise<boolean> {
  try {
    const res = await fetch(`${config.baseUrl}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
