import { KNOWLEDGE_BASE, KnowledgeItem, PanelRole, ROLE_QUICK_PROMPTS } from './ai-knowledge-base';

export interface ChatResponse {
    id: string;
    text: string;
    matchedItem?: KnowledgeItem;
    confidence: number;
    actionLink?: {
        label: string;
        url: string;
    };
    suggestedFollowUps: string[];
    role: PanelRole;
}

// Synonyms and Hinglish colloquial vocabulary mapping
const VOCAB_EXPANSIONS: Record<string, string[]> = {
    'khana': ['food', 'dish', 'menu', 'order', 'meal'],
    'paisa': ['money', 'payment', 'refund', 'earnings', 'payout', 'wallet'],
    'paise': ['money', 'payment', 'refund', 'earnings', 'payout', 'wallet'],
    'khatam': ['out of stock', 'stock', 'sold out'],
    'band': ['closed', 'out of stock', 'offline'],
    'chalu': ['online', 'in stock', 'active'],
    'rasta': ['map', 'tracking', 'location', 'navigation'],
    'gaadi': ['vehicle', 'bike', 'scooter', 'rc'],
    'gadi': ['vehicle', 'bike', 'scooter', 'rc'],
    'shikayat': ['ticket', 'support', 'complaint', 'issue'],
    'wapas': ['refund', 'cancel', 'return'],
    'rider': ['delivery', 'driver', 'partner'],
    'driver': ['delivery', 'partner'],
    'hotel': ['restaurant', 'kitchen'],
    'dukaan': ['restaurant', 'store'],
    'cancle': ['cancel', 'cancellation'],
    'complain': ['complaint', 'ticket', 'support'],
    'ad': ['campaign', 'advertisement', 'promote', 'points'],
    'ads': ['campaign', 'advertisement', 'promote', 'points'],
};

function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function expandTokens(tokens: string[]): string[] {
    const set = new Set<string>(tokens);
    for (const token of tokens) {
        if (VOCAB_EXPANSIONS[token]) {
            for (const synonym of VOCAB_EXPANSIONS[token]) {
                set.add(synonym);
            }
        }
    }
    return Array.from(set);
}

export function queryChatbot(
    userQuery: string,
    currentRole: PanelRole = 'all'
): ChatResponse {
    const raw = userQuery.trim();
    const normalized = normalizeText(raw);

    // 1. Handle Greetings & Farewells
    const greetingWords = ['hi', 'hello', 'hey', 'namaste', 'greetings', 'sup', 'yo'];
    const isGreeting = greetingWords.includes(normalized) || (normalized.split(' ').length <= 2 && greetingWords.some(w => normalized.startsWith(w)));

    if (isGreeting) {
        let greetingText = "Hello! 👋 I am your **AKR Platform AI Assistant**.";
        let followUps = [
            "How do I track my active order?",
            "When do orders appear in Delivery Marketplace?",
            "How is the restaurant quality score calculated?",
            "Explain the complete order journey from customer to delivery."
        ];

        if (currentRole === 'customer') {
            greetingText = "Hello! 👋 I am your **Customer Support AI Assistant**. I can help with order tracking, 5-minute cancellations, refunds, payment options, and AKR Wallet!";
            followUps = [
                "Where is my food order?",
                "What is the order cancellation and refund policy?",
                "How do AKR Wallet and loyalty points work?",
                "What payment methods are supported?"
            ];
        } else if (currentRole === 'delivery') {
            greetingText = "Hello Partner! 🏍️ I am your **Delivery Partner AI Assistant**. I can help with Available Marketplace rules, pickup/delivery status flow, Monday payouts, and vehicle documents!";
            followUps = [
                "When will orders appear in Available Marketplace?",
                "What are the steps from pickup to delivery?",
                "When and how do I receive my delivery earnings?",
                "What should I do in an accident or emergency?"
            ];
        } else if (currentRole === 'restaurant') {
            greetingText = "Hello Chef/Manager! 🍽️ I am your **Restaurant Partner AI Assistant**. I can assist with live order management, menu out-of-stock toggles, quality scores, ad campaigns, and weekly payouts!";
            followUps = [
                "How do I mark a menu item out of stock?",
                "How is the restaurant quality score calculated?",
                "How do Ad Campaigns and Points work?",
                "How do I manage incoming orders and notify drivers?"
            ];
        }

        return {
            id: Date.now().toString(),
            text: `${greetingText}\n\nAsk me any question or choose one of the quick topics below!`,
            confidence: 1.0,
            suggestedFollowUps: followUps,
            role: currentRole,
        };
    }

    // 2. Tokenize and calculate match scores
    const tokens = expandTokens(normalized.split(' ').filter(t => t.length > 1));

    let bestItem: KnowledgeItem | null = null;
    let highestScore = 0;
    const scoredItems: { item: KnowledgeItem; score: number }[] = [];

    for (const item of KNOWLEDGE_BASE) {
        let score = 0;
        const itemNormalizedTitle = normalizeText(item.title);
        const itemNormalizedSummary = normalizeText(item.summary);
        const itemNormalizedKeywords = item.keywords.map(k => normalizeText(k));

        // Direct exact phrase in question examples (+60)
        for (const example of item.questionExamples) {
            const normEx = normalizeText(example);
            if (normEx === normalized || normalized.includes(normEx) || normEx.includes(normalized)) {
                score += 60;
                break;
            }
        }

        // Title inclusion (+35)
        if (itemNormalizedTitle.includes(normalized) || normalized.includes(itemNormalizedTitle)) {
            score += 35;
        }

        // Keyword matches (+12 each)
        for (const kw of itemNormalizedKeywords) {
            if (normalized.includes(kw)) {
                score += 18;
            } else {
                for (const t of tokens) {
                    if (kw === t || kw.includes(t)) {
                        score += 8;
                    }
                }
            }
        }

        // Token overlap with title & summary
        for (const t of tokens) {
            if (itemNormalizedTitle.split(' ').includes(t)) score += 6;
            if (itemNormalizedSummary.split(' ').includes(t)) score += 3;
        }

        // Role alignment bonus
        if (currentRole !== 'all') {
            if (item.role === currentRole) {
                score += 15;
            } else if (item.role === 'cross_panel') {
                score += 8;
            }
        }

        if (score > 0) {
            scoredItems.push({ item, score });
            if (score > highestScore) {
                highestScore = score;
                bestItem = item;
            }
        }
    }

    // Sort descending
    scoredItems.sort((a, b) => b.score - a.score);

    // 3. Evaluate Confidence Threshold
    const CONFIDENCE_THRESHOLD = 15;

    if (bestItem && highestScore >= CONFIDENCE_THRESHOLD) {
        const followUps = bestItem.relatedQuestions && bestItem.relatedQuestions.length > 0
            ? bestItem.relatedQuestions
            : scoredItems.slice(1, 4).map(si => si.item.title);

        return {
            id: Date.now().toString(),
            text: bestItem.answer,
            matchedItem: bestItem,
            confidence: Math.min(highestScore / 70, 1.0),
            actionLink: bestItem.actionLink,
            suggestedFollowUps: followUps.slice(0, 3),
            role: bestItem.role,
        };
    }

    // 4. Fallback when no direct match found
    const fallbackSuggestions = scoredItems.length > 0
        ? scoredItems.slice(0, 3).map(s => s.item.title)
        : [
            "How do I track my active order?",
            "When will orders appear in Available Marketplace?",
            "How is the restaurant quality score calculated?",
            "Explain the complete order journey from customer to delivery."
        ];

    return {
        id: Date.now().toString(),
        text: `I couldn't find an exact match for **"${raw}"**.\n\nHere are the most relevant topics you can ask me about, or feel free to rephrase your query:\n\n` +
            `• **Customer:** Orders, live tracking, 5-minute cancellation, refund timeline, AKR Wallet.\n` +
            `• **Delivery:** Marketplace rules, order lifecycle, Monday earnings payouts, vehicle RC.\n` +
            `• **Restaurant:** Menu management (out-of-stock), Quality Score formula, Ad campaigns.\n\n` +
            `If your issue requires direct human intervention, you can also submit a **Support Ticket** below.`,
        confidence: 0.1,
        suggestedFollowUps: fallbackSuggestions,
        role: currentRole,
    };
}
