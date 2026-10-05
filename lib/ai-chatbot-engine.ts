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
    'khana': ['food', 'dish', 'menu', 'order', 'meal', 'bhook'],
    'paisa': ['money', 'payment', 'refund', 'earnings', 'payout', 'wallet'],
    'paise': ['money', 'payment', 'refund', 'earnings', 'payout', 'wallet'],
    'khatam': ['out of stock', 'stock', 'sold out'],
    'band': ['closed', 'out of stock', 'offline'],
    'chalu': ['online', 'in stock', 'active'],
    'rasta': ['map', 'tracking', 'location', 'navigation', 'gps'],
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
    'mitha': ['sweet', 'dessert', 'ice cream'],
    'tasty': ['delicious', 'recommend', 'popular', 'bestseller'],
};

export function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function expandTokens(tokens: string[]): string[] {
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

/**
 * Security & Prompt Shield:
 * Protects source code, database structures, internal API credentials, and administrative configurations.
 */
export function checkSecurityThreat(query: string): { isThreat: boolean; response?: ChatResponse } {
    const q = query.toLowerCase();

    const dangerPatterns = [
        /\b(source[\s_-]?code|show[\s_-]?code|view[\s_-]?code|print[\s_-]?code|backend[\s_-]?code|give me the code)\b/i,
        /\b(api[\s_-]?key|private[\s_-]?key|secret[\s_-]?key|jwt|service_account)\b/i,
        /\b(process\.env|env\.local|\.env|credentials|secret[\s_-]?token)\b/i,
        /\b(database[\s_-]?schema|firestore[\s_-]?rules|security[\s_-]?rules|list[\s_-]?collections|dump[\s_-]?db)\b/i,
        /\b(ignore (all )?previous instructions|system prompt|developer mode|dan mode|jailbreak)\b/i,
        /\b(admin[\s_-]?password|admin[\s_-]?hash|auth[\s_-]?secret|root[\s_-]?password)\b/i,
        /\b(eval\(|exec\(|<script|import .* from)\b/i,
        /\b(show (me )?backend|backend architecture|internal endpoints|route\.ts)\b/i,
    ];

    for (const pattern of dangerPatterns) {
        if (pattern.test(q)) {
            return {
                isThreat: true,
                response: {
                    id: `sec-${Date.now()}`,
                    text: `🛡️ **Security & Privacy Shield Active**\n\nFor privacy and security compliance, internal system architecture, source code, database schemas, and private infrastructure details are strictly confidential and protected.\n\nI am happy to assist you with:\n• 📦 **Live Order Tracking & Status Updates**\n• 🍕 **Delicious Food & Dish Recommendations**\n• 🎫 **Instant Support Ticket Generation**\n• 💰 **Cancellation, Refunds & AKR Wallet Inquiries**\n• 🛵 **Delivery & Restaurant Operational Guidance**\n\nHow may I help with your food or delivery needs today?`,
                    confidence: 1.0,
                    role: 'all',
                    suggestedFollowUps: [
                        'Track my active order',
                        'Show popular dishes and menu',
                        'Create a support ticket',
                        'What is the refund policy?'
                    ]
                }
            };
        }
    }

    return { isThreat: false };
}

/**
 * Order Tracking Intent Detector:
 * Identifies if the user is asking to track an order or inquiring about meal status.
 */
export function detectOrderTrackingIntent(query: string): { isTracking: boolean; orderId?: string } {
    const q = query.toLowerCase();

    // Order ID patterns: e.g., #123456, ORD-12345, or explicit "order 1234"
    const orderIdMatch = q.match(/#?([a-zA-Z0-9_-]{6,})/);
    let extractedOrderId = orderIdMatch ? orderIdMatch[1] : undefined;

    const trackKeywords = [
        'track', 'tracking', 'order status', 'where is my', 'kahan hai', 'kab aayega',
        'kaha pahucha', 'my order', 'active order', 'live order', 'order update',
        'order kab', 'order track', 'food status', 'meal status', 'order status'
    ];

    const isExplicitTracking = trackKeywords.some(kw => q.includes(kw));

    if (isExplicitTracking) {
        return { isTracking: true, orderId: extractedOrderId };
    }

    return { isTracking: false };
}

/**
 * Food & Product Recommendation Intent Detector:
 * Identifies cravings, menu queries, and dish discovery requests.
 */
export function detectFoodRecommendationIntent(query: string): {
    isFoodQuery: boolean;
    searchTerm?: string;
    category?: string;
    isVegOnly?: boolean;
} {
    const q = query.toLowerCase();

    const cravings = [
        'pizza', 'biryani', 'burger', 'pasta', 'paneer', 'chicken', 'roll', 'rolls',
        'thali', 'chinese', 'momos', 'noodles', 'dessert', 'sweet', 'mithai', 'ice cream',
        'dosa', 'south indian', 'sandwich', 'shakes', 'beverage', 'coffee', 'chai',
        'paratha', 'dal makhani', 'fried rice', 'soup', 'salad'
    ];

    const generalFoodQueries = [
        'recommend', 'kya khaye', 'kuch accha', 'bhook', 'hungry', 'popular food',
        'best dishes', 'menu dikhao', 'special food', 'top dishes', 'bestseller',
        'what to eat', 'food suggest', 'suggest dish', 'show menu', 'dishes'
    ];

    const isVegOnly = q.includes('veg only') || q.includes('pure veg') || q.includes('shakahari') || q.includes('vegetarian');

    // Check specific craving match
    for (const dish of cravings) {
        if (q.includes(dish)) {
            return {
                isFoodQuery: true,
                searchTerm: dish,
                category: dish,
                isVegOnly
            };
        }
    }

    // Check general food suggestion
    const isGeneral = generalFoodQueries.some(g => q.includes(g));
    if (isGeneral) {
        return {
            isFoodQuery: true,
            searchTerm: undefined,
            isVegOnly
        };
    }

    return { isFoodQuery: false };
}

/**
 * Support Ticket Creation Intent Detector:
 * Identifies if user wants to report an issue, file a complaint, or raise a ticket.
 */
export function detectTicketCreationIntent(query: string): {
    isTicketQuery: boolean;
    category: 'order' | 'refund' | 'payment' | 'delivery' | 'food_quality' | 'account' | 'other';
    subject: string;
    description: string;
} {
    const q = query.toLowerCase();

    const ticketTriggerWords = [
        'ticket', 'complain', 'complaint', 'shikayat', 'issue', 'problem',
        'kharab', 'missing', 'stale', 'spoiled', 'bad food', 'cold food',
        'refund nahi', 'paisa kata', 'rider ne', 'late delivery', 'report issue',
        'helpdesk', 'create ticket', 'raise ticket', 'bana do ticket', 'ticket banao'
    ];

    const isTicket = ticketTriggerWords.some(w => q.includes(w));

    if (!isTicket) {
        return {
            isTicketQuery: false,
            category: 'order',
            subject: '',
            description: ''
        };
    }

    // Deduce category
    let category: 'order' | 'refund' | 'payment' | 'delivery' | 'food_quality' | 'account' | 'other' = 'order';
    if (q.includes('refund') || q.includes('paisa') || q.includes('money') || q.includes('cancel')) {
        category = 'refund';
    } else if (q.includes('kharab') || q.includes('stale') || q.includes('cold') || q.includes('quality') || q.includes('taste') || q.includes('missing')) {
        category = 'food_quality';
    } else if (q.includes('late') || q.includes('delay') || q.includes('rider') || q.includes('driver') || q.includes('delivery')) {
        category = 'delivery';
    } else if (q.includes('payment') || q.includes('wallet') || q.includes('debit') || q.includes('upi')) {
        category = 'payment';
    }

    // Formulate a crisp subject
    let subject = 'Customer Support Request';
    if (category === 'refund') subject = 'Refund & Payment Inquiry';
    else if (category === 'food_quality') subject = 'Food Quality / Missing Item Issue';
    else if (category === 'delivery') subject = 'Delivery Delay / Partner Issue';
    else if (category === 'payment') subject = 'Wallet / Transaction Concern';

    return {
        isTicketQuery: true,
        category,
        subject,
        description: query.trim()
    };
}

export function queryChatbot(
    userQuery: string,
    currentRole: PanelRole = 'all'
): ChatResponse {
    const raw = userQuery.trim();

    // 0. Security Guardrail Check
    const securityCheck = checkSecurityThreat(raw);
    if (securityCheck.isThreat && securityCheck.response) {
        return securityCheck.response;
    }

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
