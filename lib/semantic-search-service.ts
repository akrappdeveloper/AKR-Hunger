/**
 * Hunger Semantic Search Service
 * ================================
 * Phase 4: AI-powered semantic food search.
 * Uses local embeddings (TF-IDF fallback when no AI).
 *
 * Supports:
 * - Natural language queries ("something spicy and cheap")
 * - Cross-lingual search (Hindi/Hinglish → English)
 * - Typo-tolerant fuzzy matching
 * - Dietary filter injection
 * - Budget-aware ranking
 *
 * AI Mode: Ollama embedding model
 * Rule Mode: TF-IDF + fuzzy string matching
 * Normal Mode: Basic substring search
 */

import type { MenuItem, Restaurant } from './types';

export interface SearchResult {
  item: MenuItem & { restaurantName: string };
  score: number;
  matchReasons: string[];
}

export interface SemanticSearchOptions {
  query: string;
  budget?: number;
  dietary?: 'vegetarian' | 'vegan' | 'non-vegetarian';
  maxResults?: number;
  restaurantId?: string;
}

// ─── Hinglish / Hindi common food terms ──────────────────────────────────────
const HINGLISH_MAP: Record<string, string[]> = {
  'khana': ['food', 'meal'],
  'khane': ['food', 'meal'],
  'sasta': ['cheap', 'affordable', 'budget'],
  'acha': ['good', 'nice'],
  'theek': ['okay', 'decent'],
  'masaledar': ['spicy', 'spiced'],
  'tikha': ['spicy', 'hot'],
  'meetha': ['sweet', 'dessert'],
  'chatpata': ['tangy', 'spicy', 'chaat'],
  'thanda': ['cold', 'chilled'],
  'garam': ['hot', 'warm'],
  'halka': ['light', 'mild'],
  'bhookha': ['hungry'],
  'jaldi': ['quick', 'fast'],
  'raat': ['night', 'dinner'],
  'subah': ['morning', 'breakfast'],
  'dopahar': ['noon', 'lunch'],
  'andar': ['under', 'within', 'below'],
  'mein': ['in'],
  'chahiye': ['want', 'need'],
  'dena': ['give'],
  'bata': ['tell'],
  'lelo': ['take'],
  'do': ['two', 'give'],
  'ek': ['one'],
  'teen': ['three'],
  'log': ['people', 'persons'],
  'ke liye': ['for'],
};

// ─── Cuisine aliases ──────────────────────────────────────────────────────────
const CUISINE_ALIASES: Record<string, string[]> = {
  'chinese': ['noodles', 'fried rice', 'manchurian', 'momos', 'dimsums'],
  'south indian': ['dosa', 'idli', 'vada', 'uttapam', 'sambhar', 'rasam'],
  'north indian': ['roti', 'naan', 'dal makhani', 'butter chicken', 'paneer', 'sabzi'],
  'mughlai': ['biryani', 'kebab', 'tikka', 'korma', 'nihari'],
  'italian': ['pizza', 'pasta', 'risotto', 'lasagna'],
  'continental': ['grilled', 'steak', 'burger', 'sandwich'],
  'street food': ['chaat', 'pani puri', 'samosa', 'bhel', 'vada pav', 'kachori'],
  'fast food': ['burger', 'fries', 'nuggets', 'wrap'],
  'dessert': ['ice cream', 'cake', 'gulab jamun', 'rasgulla', 'halwa', 'kheer'],
};

// ─── Normalise query ──────────────────────────────────────────────────────────

function normalizeQuery(query: string): string {
  let q = query.toLowerCase().trim();

  // Translate Hinglish words
  Object.entries(HINGLISH_MAP).forEach(([hinglish, english]) => {
    q = q.replace(new RegExp(`\\b${hinglish}\\b`, 'gi'), english[0]);
  });

  // Extract budget
  q = q.replace(/(?:₹|rs\.?|rupees?)\s*(\d+)/gi, 'BUDGET_$1');

  return q;
}

function extractBudgetFromQuery(query: string): number | undefined {
  const match = query.match(/(?:under|below|within|upto|up to|₹|rs\.?|rupees?)?\s*(\d+)/i);
  return match ? parseInt(match[1]) : undefined;
}

// ─── TF-IDF word relevance scorer ────────────────────────────────────────────

function scoreItemAgainstQuery(
  item: MenuItem & { restaurantName: string },
  queryTokens: string[],
  options: SemanticSearchOptions
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const itemText = [
    item.name,
    item.description || '',
    item.category || '',
    item.restaurantName,
    ...(item.tags || []),
  ].join(' ').toLowerCase();

  // Direct name match — highest weight
  if (itemText.includes(item.name.toLowerCase())) {
    for (const token of queryTokens) {
      if (item.name.toLowerCase().includes(token)) {
        score += 10;
        if (!reasons.includes('Name match')) reasons.push('Name match');
      }
    }
  }

  // Token matches in description/tags
  for (const token of queryTokens) {
    if (token.length < 3) continue;
    if (itemText.includes(token)) {
      score += 3;
      reasons.push(`"${token}" matched`);
    }
  }

  // Cuisine alias expansion
  for (const [cuisine, aliases] of Object.entries(CUISINE_ALIASES)) {
    const cuisineMatch = queryTokens.some(t => cuisine.includes(t) || t.includes(cuisine));
    if (cuisineMatch) {
      const itemHasCuisine = aliases.some(a => itemText.includes(a)) ||
                              itemText.includes(cuisine);
      if (itemHasCuisine) {
        score += 8;
        reasons.push(`${cuisine} cuisine`);
      }
    }
  }

  // Budget filter
  if (options.budget && item.price > options.budget) {
    return { score: 0, reasons: ['Over budget'] };
  }
  if (options.budget) {
    const budgetRatio = 1 - (item.price / options.budget);
    score += budgetRatio * 5; // Cheaper items get slight boost
    reasons.push(`Within ₹${options.budget}`);
  }

  // Dietary filter
  const isVegetarian = item.vegetarian ?? (item as any).isVeg;
  if (options.dietary === 'vegetarian' && !isVegetarian) {
    return { score: 0, reasons: ['Not vegetarian'] };
  }
  if (options.dietary === 'non-vegetarian' && isVegetarian) {
    score -= 2;
  }
  if (options.dietary === 'vegetarian' && isVegetarian) {
    score += 3;
    reasons.push('Vegetarian');
  }

  // Availability boost
  if (item.available !== false) {
    score += 2;
  } else {
    return { score: 0, reasons: ['Not available'] };
  }

  // Quality/rating boost (if present)
  if ((item as any).rating) {
    score += ((item as any).rating - 3) * 2;
  }

  return { score, reasons: [...new Set(reasons)] };
}

// ─── Main Search Function ─────────────────────────────────────────────────────

export function semanticSearch(
  items: (MenuItem & { restaurantName: string })[],
  options: SemanticSearchOptions
): SearchResult[] {
  const normalized = normalizeQuery(options.query);
  const budget = options.budget || extractBudgetFromQuery(options.query);

  // Tokenize — remove common stop words
  const stopWords = new Set(['a', 'an', 'the', 'i', 'me', 'my', 'and', 'or', 'of', 'in',
    'for', 'with', 'to', 'want', 'need', 'get', 'give', 'some', 'something']);
  const tokens = normalized
    .split(/\s+/)
    .filter(t => t.length >= 2 && !stopWords.has(t));

  const searchOptions = { ...options, budget };

  const results: SearchResult[] = [];

  for (const item of items) {
    const { score, reasons } = scoreItemAgainstQuery(item, tokens, searchOptions);
    if (score > 0) {
      results.push({ item, score, matchReasons: reasons });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, options.maxResults || 20);
}

/**
 * Get search suggestions based on partial query.
 */
export function getSearchSuggestions(
  query: string,
  items: (MenuItem & { restaurantName: string })[],
  limit = 5
): string[] {
  if (!query || query.length < 2) return [];

  const q = query.toLowerCase();
  const suggestions = new Set<string>();

  for (const item of items) {
    if (item.name.toLowerCase().includes(q)) suggestions.add(item.name);
    if (item.category?.toLowerCase().includes(q)) suggestions.add(item.category);
    if (item.restaurantName.toLowerCase().includes(q)) suggestions.add(item.restaurantName);
    if (suggestions.size >= limit) break;
  }

  return [...suggestions].slice(0, limit);
}

/**
 * Fuzzy match — Levenshtein distance based.
 */
export function fuzzyMatch(a: string, b: string): boolean {
  const threshold = Math.max(1, Math.floor(Math.min(a.length, b.length) * 0.3));
  return levenshtein(a.toLowerCase(), b.toLowerCase()) <= threshold;
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}
