/**
 * Hunger AI Gateway
 * ==================
 * Zero-cost, local-first AI gateway using Ollama / llama.cpp
 * with intelligent rule-based fallback when AI is unavailable.
 *
 * Architecture:
 *   Hunger App → Backend API → AI Gateway → Ollama/llama.cpp → Local Model
 *
 * Environment variables:
 *   AI_ENABLED=true
 *   AI_PROVIDER=ollama
 *   AI_BASE_URL=http://localhost:11434
 *   AI_MODEL=qwen
 *   AI_TIMEOUT_MS=8000
 *   AI_MAX_TOKENS=512
 *   AI_TEMPERATURE=0.3
 */

export interface AIConfig {
  enabled: boolean;
  provider: 'ollama' | 'llamacpp' | 'disabled';
  baseUrl: string;
  model: string;
  timeoutMs: number;
  maxTokens: number;
  temperature: number;
}

export function getAIConfig(): AIConfig {
  return {
    enabled: process.env.AI_ENABLED !== 'false',
    provider: (process.env.AI_PROVIDER as AIConfig['provider']) || 'ollama',
    baseUrl: process.env.AI_BASE_URL || 'http://localhost:11434',
    model: process.env.AI_MODEL || 'qwen',
    timeoutMs: parseInt(process.env.AI_TIMEOUT_MS || '8000'),
    maxTokens: parseInt(process.env.AI_MAX_TOKENS || '512'),
    temperature: parseFloat(process.env.AI_TEMPERATURE || '0.3'),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Smart Meal Intent Parser
// ─────────────────────────────────────────────────────────────────────────────

export interface MealIntent {
  budget?: number;
  people?: number;
  vegetarian?: boolean;
  spice?: 'low' | 'medium' | 'high';
  meal?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  cuisine?: string;
  query?: string;
  dietary?: string[];
  maxCalories?: number;
}

/** Call Ollama generate endpoint */
async function callOllama(prompt: string, config: AIConfig): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(`${config.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        prompt,
        stream: false,
        options: {
          temperature: config.temperature,
          num_predict: config.maxTokens,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
    const data = await response.json();
    return data.response ?? '';
  } finally {
    clearTimeout(timer);
  }
}

/** Parse meal intent using AI with graceful fallback */
export async function parseMealIntent(userText: string): Promise<{
  intent: MealIntent;
  mode: 'ai' | 'rule' | 'normal';
}> {
  const config = getAIConfig();

  // Try AI mode
  if (config.enabled && config.provider !== 'disabled') {
    try {
      const prompt = `You are a food ordering assistant for Hunger app (India). 
Parse the user's food request into a JSON object. 
ONLY return valid JSON. No explanation text. No markdown.

User request: "${userText}"

Return JSON with these optional fields:
- budget (number in rupees)
- people (number of people)
- vegetarian (boolean)
- spice ("low"|"medium"|"high")
- meal ("breakfast"|"lunch"|"dinner"|"snack")
- cuisine (string)
- query (cleaned search term)
- dietary (array of strings like ["high-protein","low-carb","vegan"])
- maxCalories (number)

Example: {"budget":200,"vegetarian":true,"spice":"high","meal":"dinner","query":"paneer"}`;

      const raw = await callOllama(prompt, config);
      // Extract JSON from response
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        const intent = validateMealIntent(parsed);
        return { intent, mode: 'ai' };
      }
    } catch {
      // AI unavailable — fall through to rule-based
    }
  }

  // Rule-based fallback
  const intent = ruleBasedMealIntent(userText);
  return { intent, mode: config.enabled ? 'rule' : 'normal' };
}

/** Validate and sanitize AI-parsed meal intent */
function validateMealIntent(raw: Record<string, unknown>): MealIntent {
  const intent: MealIntent = {};

  if (typeof raw.budget === 'number' && raw.budget > 0 && raw.budget < 10000) {
    intent.budget = raw.budget;
  }
  if (typeof raw.people === 'number' && raw.people > 0 && raw.people < 50) {
    intent.people = raw.people;
  }
  if (typeof raw.vegetarian === 'boolean') {
    intent.vegetarian = raw.vegetarian;
  }
  if (['low', 'medium', 'high'].includes(raw.spice as string)) {
    intent.spice = raw.spice as MealIntent['spice'];
  }
  if (['breakfast', 'lunch', 'dinner', 'snack'].includes(raw.meal as string)) {
    intent.meal = raw.meal as MealIntent['meal'];
  }
  if (typeof raw.cuisine === 'string' && raw.cuisine.length < 50) {
    intent.cuisine = raw.cuisine;
  }
  if (typeof raw.query === 'string' && raw.query.length < 100) {
    intent.query = raw.query;
  }
  if (Array.isArray(raw.dietary)) {
    intent.dietary = (raw.dietary as unknown[])
      .filter((d) => typeof d === 'string')
      .slice(0, 5) as string[];
  }
  if (typeof raw.maxCalories === 'number' && raw.maxCalories > 0) {
    intent.maxCalories = raw.maxCalories;
  }

  return intent;
}

/** Pure keyword + regex meal intent parser */
function ruleBasedMealIntent(text: string): MealIntent {
  const t = text.toLowerCase();
  const intent: MealIntent = {};

  // Budget extraction
  const budgetMatch = t.match(/₹?\s*(\d{2,5})\s*(rs|rupee|rupees|rupe|ke andar|under|below|max|tak)?/);
  if (budgetMatch) {
    const n = parseInt(budgetMatch[1]);
    if (n >= 20 && n <= 9999) intent.budget = n;
  }

  // People
  const peopleMatch = t.match(/(\d+)\s*(log|people|person|person|members|friends|family)/);
  if (peopleMatch) intent.people = parseInt(peopleMatch[1]);

  // Vegetarian / non-veg
  if (/veg\b|vegetarian|no meat|no chicken|paneer|shahi|pure veg/.test(t)) intent.vegetarian = true;
  if (/non.?veg|chicken|mutton|fish|egg|meat|biryani chicken/.test(t)) intent.vegetarian = false;

  // Spice
  if (/spicy|masaledar|teekha|hot/.test(t)) intent.spice = 'high';
  else if (/mild|light|not spicy/.test(t)) intent.spice = 'low';
  else if (/medium spice/.test(t)) intent.spice = 'medium';

  // Meal type
  if (/breakfast|nashta|morning/.test(t)) intent.meal = 'breakfast';
  else if (/lunch|dopahar/.test(t)) intent.meal = 'lunch';
  else if (/dinner|raat|tonight|evening/.test(t)) intent.meal = 'dinner';
  else if (/snack|evening bite|chai time/.test(t)) intent.meal = 'snack';

  // Dietary
  const dietary: string[] = [];
  if (/protein|high protein|gym|workout/.test(t)) dietary.push('high-protein');
  if (/low carb|keto/.test(t)) dietary.push('low-carb');
  if (/vegan/.test(t)) { dietary.push('vegan'); intent.vegetarian = true; }
  if (/gluten.?free/.test(t)) dietary.push('gluten-free');
  if (dietary.length) intent.dietary = dietary;

  // Query — strip budget/meta words and keep food-related terms
  const stopWords = /₹|\d+|rs|rupees|ke andar|under|below|chahiye|want|need|order|get me|give me|please|for|and|or|the|a|an/gi;
  const cleaned = t.replace(stopWords, ' ').replace(/\s+/g, ' ').trim();
  if (cleaned.length > 2) intent.query = cleaned;

  return intent;
}

// ─────────────────────────────────────────────────────────────────────────────
// Menu Description Generator
// ─────────────────────────────────────────────────────────────────────────────

export interface MenuDescriptionResult {
  title: string;
  description: string;
  ingredients: string[];
  tags: string[];
  keywords: string[];
}

export async function generateMenuDescription(rawInput: string): Promise<{
  result: MenuDescriptionResult;
  mode: 'ai' | 'rule';
}> {
  const config = getAIConfig();

  if (config.enabled && config.provider !== 'disabled') {
    try {
      const prompt = `You are a food menu copywriter for Hunger app (India).
Given a raw menu item description, generate professional content.
ONLY return valid JSON. No markdown.

Raw input: "${rawInput}"

Return JSON:
{
  "title": "Professional item name",
  "description": "Appetizing 1-2 sentence description",
  "ingredients": ["ing1", "ing2"],
  "tags": ["spicy", "vegetarian", etc],
  "keywords": ["search", "terms"]
}`;

      const raw = await callOllama(prompt, config);
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        return {
          result: {
            title: String(parsed.title || rawInput).slice(0, 100),
            description: String(parsed.description || '').slice(0, 300),
            ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients.slice(0, 15) : [],
            tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 10) : [],
            keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 20) : [],
          },
          mode: 'ai',
        };
      }
    } catch {
      // fall through
    }
  }

  // Rule-based fallback
  const words = rawInput.split(/\s+/);
  return {
    result: {
      title: rawInput.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      description: `Freshly prepared ${rawInput}. Made with quality ingredients.`,
      ingredients: words.filter(w => w.length > 3),
      tags: ['fresh', rawInput.toLowerCase().includes('spic') ? 'spicy' : 'mild'],
      keywords: words,
    },
    mode: 'rule',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Observability
// ─────────────────────────────────────────────────────────────────────────────

export interface AIRequestLog {
  feature: string;
  mode: 'ai' | 'rule' | 'normal';
  latencyMs: number;
  success: boolean;
  model?: string;
  timestamp: Date;
}

export function createAILogger() {
  return {
    log: (entry: AIRequestLog) => {
      // In production, write to Firestore ai_requests collection
      if (process.env.NODE_ENV !== 'production') {
        console.log('[AI Gateway]', JSON.stringify(entry));
      }
    },
  };
}
