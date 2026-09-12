export type PanelRole = 'customer' | 'delivery' | 'restaurant' | 'cross_panel' | 'all';

export interface KnowledgeItem {
    id: string;
    role: 'customer' | 'delivery' | 'restaurant' | 'cross_panel';
    category: string;
    title: string;
    keywords: string[];
    questionExamples: string[];
    summary: string;
    answer: string;
    actionLink?: {
        label: string;
        url: string;
    };
    relatedQuestions?: string[];
}

export interface RoleQuickPrompt {
    role: PanelRole;
    label: string;
    query: string;
    icon?: string;
}

export const ROLE_QUICK_PROMPTS: RoleQuickPrompt[] = [
    // Customer Prompts
    { role: 'customer', label: '📦 Track My Order', query: 'How do I track my active order?' },
    { role: 'customer', label: '❌ Cancel & Refund', query: 'What is the order cancellation and refund policy?' },
    { role: 'customer', label: '💰 Wallet & Points', query: 'How do AKR Wallet and loyalty points work?' },
    { role: 'customer', label: '💳 Payment Methods', query: 'What payment options are available?' },
    { role: 'customer', label: '⭐ Rate Food / Rider', query: 'How do I review a restaurant or delivery partner?' },

    // Delivery Prompts
    { role: 'delivery', label: '🛒 Marketplace Orders', query: 'When will orders appear in Available Marketplace?' },
    { role: 'delivery', label: '🔄 Delivery Steps', query: 'What are the steps from pickup to delivery?' },
    { role: 'delivery', label: '💵 Weekly Payouts', query: 'When and how do I receive my delivery earnings?' },
    { role: 'delivery', label: '🏍️ Update Vehicle RC', query: 'How can I update my vehicle and documents?' },
    { role: 'delivery', label: '🚨 Emergency Hotline', query: 'What should I do in an accident or emergency?' },

    // Restaurant Prompts
    { role: 'restaurant', label: '🍽️ Menu Out-of-Stock', query: 'How do I mark a menu item out of stock?' },
    { role: 'restaurant', label: '📊 Quality Score Formula', query: 'How is the restaurant quality score calculated?' },
    { role: 'restaurant', label: '📢 Ad Campaigns & Points', query: 'How do Ad Campaigns and Points work?' },
    { role: 'restaurant', label: '⚡ Order Pipeline Flow', query: 'How do I manage incoming orders and notify drivers?' },
    { role: 'restaurant', label: '💬 Reply to Reviews', query: 'Can I reply to customer reviews?' },

    // Cross-Panel Prompts
    { role: 'cross_panel', label: '🌐 Full Order Lifecycle', query: 'Explain the complete order journey from customer to restaurant to delivery.' },
    { role: 'cross_panel', label: '⏱️ Order Status Meanings', query: 'What does each order status mean (pending, confirmed, preparing, ready, out_for_delivery, delivered)?' },
];

export const KNOWLEDGE_BASE: KnowledgeItem[] = [
    // ==========================================
    // 1. CUSTOMER PANEL DETAILS
    // ==========================================
    {
        id: 'cust_order_tracking',
        role: 'customer',
        category: 'Ordering & Tracking',
        title: 'How to Track Your Food Order in Real-Time',
        keywords: [
            'track', 'tracking', 'order status', 'where is my food', 'eta', 'live map',
            'delivery time', 'kab aayega', 'kahan hai', 'order location', 'rider map'
        ],
        questionExamples: [
            'Where is my food order?',
            'How do I track my active order?',
            'When will my order arrive?',
            'Can I see the delivery partner on map?'
        ],
        summary: 'Track live status, kitchen prep, and rider GPS location on the Orders page.',
        answer: `You can track your order in real-time through the **Customer Orders Dashboard**:

1. Open the **Orders** tab or go to [Your Orders](/customer/orders).
2. Click on your active order to view the **Live Tracking Screen**.
3. You will see the current live status stage:
   - **Pending:** Waiting for the restaurant to accept your order.
   - **Confirmed:** The restaurant has accepted and entered the order.
   - **Preparing:** The kitchen is currently cooking your food.
   - **Ready:** Food is packaged and awaiting pickup by the delivery partner.
   - **Out for Delivery:** The rider has collected your meal and is navigating to your address.
   - **Delivered:** Order has been handed over to you!
4. Once marked **Out for Delivery**, you can see the rider's approximate ETA and contact options.`,
        actionLink: { label: 'View Active Orders', url: '/customer/orders' },
        relatedQuestions: ['What is the order cancellation and refund policy?', 'How do I call the delivery partner?']
    },
    {
        id: 'cust_cancellation_refund',
        role: 'customer',
        category: 'Cancellations & Refunds',
        title: 'Order Cancellation Rules and Refund Timeline',
        keywords: [
            'cancel', 'cancellation', 'refund', 'money back', 'paisa wapas', 'cancel order',
            '5 minutes', 'wrong order', 'refund time', 'deducted', 'payment refund'
        ],
        questionExamples: [
            'How do I cancel my order?',
            'What is the cancellation time limit?',
            'I cancelled my order, when will I get my refund?',
            'Can I cancel after food is prepared?'
        ],
        summary: 'Free cancellation within 5 minutes of placing. Instant refund to AKR Wallet or 5-7 days to bank.',
        answer: `Here is our complete **Cancellation & Refund Policy**:

- **5-Minute Cancellation Window:** You can cancel your order directly from the order details page within **5 minutes** of placing it at no charge.
- **After 5 Minutes:** Once the restaurant begins cooking (**Preparing** status), automated cancellations are locked to prevent food wastage. If you have an emergency, please contact customer support immediately.
- **Refund Timelines:**
  - **AKR Wallet Refunds:** Credited **instantly** to your AKR Wallet balance.
  - **Online Payments (UPI, Cards, Netbanking via Razorpay):** Refunded to the original bank account within **5 to 7 business days**.
  - **Cash on Delivery (COD):** If not yet paid, no refund needed. If an issue occurred after payment, refund is credited to your AKR Wallet upon review.`,
        actionLink: { label: 'Go to Orders', url: '/customer/orders' },
        relatedQuestions: ['How do AKR Wallet and loyalty points work?', 'I have a payment issue']
    },
    {
        id: 'cust_payment_methods',
        role: 'customer',
        category: 'Payments & Checkout',
        title: 'Supported Payment Options and Promos',
        keywords: [
            'payment', 'pay', 'razorpay', 'upi', 'gpay', 'phonepe', 'credit card',
            'debit card', 'netbanking', 'cod', 'cash on delivery', 'coupon', 'promo code'
        ],
        questionExamples: [
            'What payment methods can I use?',
            'Can I pay via Cash on Delivery?',
            'How do I apply a discount coupon?',
            'Is UPI supported?'
        ],
        summary: 'Pay securely using UPI, Cards, Netbanking via Razorpay, AKR Wallet, or COD.',
        answer: `We offer multiple fast and secure checkout options:

1. **Razorpay Gateway:**
   - **UPI:** Google Pay, PhonePe, Paytm, BHIM, Cred, and any UPI ID.
   - **Credit / Debit Cards:** Visa, MasterCard, RuPay, Maestro, Diners.
   - **Netbanking:** All major Indian banks.
2. **AKR Wallet:**
   - 1-click instantaneous checkout with zero gateway delays.
   - You can top up your wallet anytime from the [Customer Wallet](/customer/wallet).
3. **Cash on Delivery (COD):**
   - Pay physical cash to the delivery partner when your order arrives.
4. **Promo Codes & Coupons:**
   - On the **Cart page**, browse available discount coupons or type a valid promo code to enjoy instant savings.`,
        actionLink: { label: 'Manage Wallet', url: '/customer/wallet' },
        relatedQuestions: ['What is the order cancellation and refund policy?', 'How do AKR Wallet and loyalty points work?']
    },
    {
        id: 'cust_wallet_rewards',
        role: 'customer',
        category: 'Wallet & Rewards',
        title: 'AKR Wallet, Cashbacks, and Loyalty Points',
        keywords: [
            'wallet', 'points', 'loyalty', 'cashback', 'rewards', 'balance',
            'recharge', 'topup', 'membership', 'add money', 'coins'
        ],
        questionExamples: [
            'How does the AKR Wallet work?',
            'How do I earn loyalty reward points?',
            'Can I use my wallet balance to pay for food?',
            'How do I add money to my wallet?'
        ],
        summary: 'Earn points on orders, enjoy 1-click payments, and get instant cancellation refunds.',
        answer: `The **AKR Wallet** provides speed, loyalty benefits, and convenience:

- **1-Click Checkout:** Skip bank OTPs and complete orders in a single second.
- **Loyalty Reward Points:**
  - Earn reward points with every eligible order placed on the platform.
  - Redeem points directly at checkout for discounts on your favorite meals.
- **Instant Refunds:** Any cancelled or refunded orders are credited immediately to your wallet balance.
- **How to Top Up:**
  1. Navigate to the [Customer Wallet](/customer/wallet) page.
  2. Enter the recharge amount (e.g., ₹200, ₹500, ₹1000).
  3. Complete payment securely via Razorpay to instantly update your balance.`,
        actionLink: { label: 'Open Customer Wallet', url: '/customer/wallet' },
        relatedQuestions: ['Supported Payment Options and Promos', 'Order Cancellation Rules and Refund Timeline']
    },
    {
        id: 'cust_ratings_reviews',
        role: 'customer',
        category: 'Reviews & Feedback',
        title: 'How to Rate and Review Food and Delivery',
        keywords: [
            'review', 'rating', 'star', 'feedback', 'rate food', 'rate rider',
            'complaint', 'bad food', 'good food', 'photo review', 'restaurant review'
        ],
        questionExamples: [
            'How do I give a review to the restaurant?',
            'Can I rate the delivery person?',
            'Where can I submit feedback for bad food quality?',
            'Can I upload photos of the meal?'
        ],
        summary: 'Rate orders 1-5 stars with comments and photos from your past order details.',
        answer: `We value your voice! Once your order is marked **Delivered**:

1. Go to [Your Orders](/customer/orders).
2. Select the delivered order and click **Write a Review**.
3. Rate the **Food Quality** from 1 to 5 stars.
4. Leave specific comments about taste, packaging, and portion size (photo uploads supported).
5. Rate your **Delivery Partner** for punctuality and courtesy.
6. Restaurants can reply to your reviews directly to resolve any concerns or express appreciation.`,
        actionLink: { label: 'Check Delivered Orders', url: '/customer/orders' },
        relatedQuestions: ['Food quality was not good', 'Where is my food order?']
    },
    {
        id: 'cust_addresses_profile',
        role: 'customer',
        category: 'Account & Addresses',
        title: 'Managing Saved Delivery Addresses and Profile',
        keywords: [
            'address', 'location', 'change address', 'home', 'work', 'profile',
            'phone number', 'name', 'landmark', 'gps address', 'pin code'
        ],
        questionExamples: [
            'How do I add a new delivery address?',
            'Can I save Home and Work addresses?',
            'How do I update my mobile number?',
            'Can I change delivery address after placing an order?'
        ],
        summary: 'Save Home, Work, and Other addresses with GPS coordinates in your Profile.',
        answer: `Manage your contact and location details easily:

- **Saving Multiple Addresses:**
  - Head to [Profile & Settings](/customer/profile).
  - Add addresses with category tags: **Home**, **Work**, or **Other**.
  - Pinpoint your GPS location or provide detailed landmarks for fast delivery.
- **Default Address:** Set your primary address so it is preselected at checkout.
- **Address Change during Delivery:** If you need to modify the delivery address after an order is out for delivery, contact customer support or call your rider directly. Additional distance fees may apply if the new location is far.`,
        actionLink: { label: 'Go to Profile', url: '/customer/profile' },
        relatedQuestions: ['How to Track Your Food Order in Real-Time', 'Supported Payment Options and Promos']
    },

    // ==========================================
    // 2. DELIVERY PARTNER PANEL DETAILS
    // ==========================================
    {
        id: 'deliv_marketplace_rules',
        role: 'delivery',
        category: 'Marketplace & Orders',
        title: 'When and How Orders Appear in Available Marketplace',
        keywords: [
            'marketplace', 'available', 'available orders', 'accept order', 'order kab aayega',
            'order nahi aa raha', 'marketplace me order', 'unassigned', 'delivery person id',
            'how to get orders', 'driver orders'
        ],
        questionExamples: [
            'When does an order appear in the Marketplace?',
            'Why is Marketplace empty?',
            'How do I accept a delivery order?',
            'What conditions must be met for orders to show up?'
        ],
        summary: 'Orders appear in Marketplace when status is confirmed/preparing/ready AND deliveryPersonId is null.',
        answer: `An order appears in the **Available Orders Marketplace** ([/delivery/available](/delivery/available)) ONLY when the following three conditions are met:

1. **Order Status:** The order has been accepted by the restaurant and is in status \`confirmed\`, \`preparing\`, or \`ready\`.
2. **Unassigned:** The order has **NOT** been accepted by any other delivery partner yet (\`deliveryPersonId == null\`).
3. **Duty Status:** Ensure you have switched your duty to **Online** on your Dashboard.

### How to Accept:
- Open [Available Marketplace](/delivery/available).
- Review restaurant name, pickup distance, customer drop-off area, and expected earnings.
- Click **Accept Order**.
- Your Partner ID is immediately assigned to the order, it disappears from the Marketplace pool, and moves directly to your **Active Dashboard**!`,
        actionLink: { label: 'Open Available Marketplace', url: '/delivery/available' },
        relatedQuestions: ['Step-by-Step Delivery Partner Order Flow', 'When and How Delivery Partners Get Paid']
    },
    {
        id: 'deliv_order_lifecycle_flow',
        role: 'delivery',
        category: 'Delivery Flow',
        title: 'Step-by-Step Delivery Partner Order Flow',
        keywords: [
            'pickup', 'picked up', 'out for delivery', 'mark delivered', 'order flow',
            'steps', 'how to deliver', 'status change', 'dashboard', 'reach restaurant'
        ],
        questionExamples: [
            'What are the steps to complete a delivery?',
            'When should I mark Out for Delivery?',
            'How do I mark an order Delivered?',
            'Where do I find customer navigation?'
        ],
        summary: 'Accept -> Reach Restaurant -> Pick up (Out for Delivery) -> Reach Customer -> Mark Delivered.',
        answer: `Follow this standard **5-step delivery procedure**:

1. **Accept Order:** Accept an unassigned order from [Available Marketplace](/delivery/available).
2. **Navigate to Restaurant:** Use the in-app map/GPS to drive to the restaurant.
3. **Verify & Pick Up Food:**
   - Cross-check the Order ID and item checklist with the restaurant staff.
   - Once food is securely placed in your delivery thermal bag, click **Pick Up Order**.
   - The status updates to \`out_for_delivery\`, sending a live notification to the customer!
4. **Drive to Customer:** Follow GPS routing to the customer's delivery address. Call the customer if gate codes or directions are needed.
5. **Complete Handover:**
   - Hand over the food package. If the order is COD, collect the exact cash amount.
   - Click **Mark as Delivered**.
   - The status becomes \`delivered\`. The order moves to your [History](/delivery/history), and your earnings are credited immediately!`,
        actionLink: { label: 'Go to Delivery Dashboard', url: '/delivery' },
        relatedQuestions: ['When and How Orders Appear in Available Marketplace', 'When and How Delivery Partners Get Paid']
    },
    {
        id: 'deliv_payouts_earnings',
        role: 'delivery',
        category: 'Earnings & Payouts',
        title: 'When and How Delivery Partners Get Paid',
        keywords: [
            'earnings', 'payout', 'payouts', 'monday', 'weekly payment', 'bank account',
            'delivery fee', 'tips', 'surge', 'wallet', 'withdraw', 'paisa kab aayega'
        ],
        questionExamples: [
            'When will I get my delivery earnings?',
            'How is delivery pay calculated?',
            'Can I withdraw my delivery wallet balance?',
            'How do weekly Monday payouts work?'
        ],
        summary: 'Earnings include base fee + distance pay + 100% tips. Payouts sent weekly every Monday.',
        answer: `Here is everything you need to know about your **Earnings & Payouts**:

- **How Earnings Are Calculated:**
  - **Base Delivery Pay:** Fixed payout per completed delivery.
  - **Distance Pay:** Additional rate per kilometer traveled.
  - **Customer Tips:** 100% of tips given by the customer go directly to you.
  - **Surge / Peak Hour Incentives:** Extra bonuses during lunch/dinner rushes and rainy weather.
- **Weekly Monday Payout Schedule:**
  - All accumulated earnings from Monday to Sunday are audited and transferred automatically to your linked bank account every **Monday**.
- **Delivery Wallet:**
  - Track real-time daily earnings, weekly totals, and past payout statements in [Earnings](/delivery/earnings) and [Wallet](/delivery/wallet).
  - Ensure your bank IFSC code and account number are verified in settings.`,
        actionLink: { label: 'View My Earnings', url: '/delivery/earnings' },
        relatedQuestions: ['Step-by-Step Delivery Partner Order Flow', 'Updating Vehicle Details, Driving License & RC']
    },
    {
        id: 'deliv_vehicle_settings',
        role: 'delivery',
        category: 'Vehicle & Documents',
        title: 'Updating Vehicle Details, Driving License & RC',
        keywords: [
            'vehicle', 'bike', 'scooter', 'ev', 'rc', 'registration', 'driving license',
            'document', 'upload rc', 'change bike', 'settings', 'verification'
        ],
        questionExamples: [
            'How do I change my vehicle details?',
            'Where do I upload my RC document?',
            'Can I deliver on an electric scooter or bicycle?',
            'How long does document verification take?'
        ],
        summary: 'Update vehicle type and upload RC/License photos under Settings > Vehicle Details.',
        answer: `Keep your profile legal and compliant to receive orders:

1. Open [Delivery Settings](/delivery/settings).
2. Go to **Vehicle Details**:
   - Select vehicle category: **Motorcycle / Bike**, **Scooter**, **Electric Vehicle (EV)**, or **Bicycle**.
   - Input your Vehicle Registration Number.
3. **Upload Documents:**
   - Upload clear photos of your **RC (Registration Certificate)** and valid **Driving License**.
   - Click Save. Verification typically takes 12 to 24 hours.
4. During verification, you can continue delivering on your existing approved vehicle.`,
        actionLink: { label: 'Vehicle Settings', url: '/delivery/settings' },
        relatedQuestions: ['When and How Delivery Partners Get Paid', 'Emergency Protocol and Support Hotline']
    },
    {
        id: 'deliv_emergency_support',
        role: 'delivery',
        category: 'Emergency & Safety',
        title: 'Emergency Protocol and Support Hotline',
        keywords: [
            'emergency', 'accident', 'breakdown', 'police', 'hospital', 'hotline',
            'safety', 'puncture', 'cannot deliver', 'help hotline', 'urgent help'
        ],
        questionExamples: [
            'What should I do if I get into an accident?',
            'My vehicle broke down during delivery, what to do?',
            'What is the emergency helpline number?',
            'Customer is not answering the door, how to proceed?'
        ],
        summary: 'Call 24/7 Hotline +1 (800) 123-4567 for accidents. Contact support if vehicle breaks down.',
        answer: `Your safety is our top priority!

- **Emergency Assistance Hotline:**
  - Call **+1 (800) 123-4567** immediately if you face a road emergency, accident, or threat.
- **Vehicle Breakdown during Delivery:**
  1. Safely pull over and stop.
  2. Call the emergency line or message support through [Delivery Support](/delivery/support).
  3. Our dispatch team will unassign the order and dispatch a nearby partner to pick up the meal, protecting your rating.
- **Customer Unreachable / Wrong Address:**
  - Ring the doorbell and attempt calling the customer at least twice.
  - Wait 10 minutes at the drop-off location. If still unresponsive, contact support to mark the delivery appropriately.`,
        actionLink: { label: 'Open Delivery Support', url: '/delivery/support' },
        relatedQuestions: ['Step-by-Step Delivery Partner Order Flow', 'When and How Orders Appear in Available Marketplace']
    },

    // ==========================================
    // 3. RESTAURANT PARTNER PANEL DETAILS
    // ==========================================
    {
        id: 'rest_live_orders_pipeline',
        role: 'restaurant',
        category: 'Live Orders Management',
        title: 'Managing Incoming Orders and Driver Dispatch',
        keywords: [
            'orders', 'live orders', 'accept order', 'reject order', 'kitchen', 'pipeline',
            'preparing', 'ready', 'cooking', 'dispatch', 'sound alert', 'incoming order'
        ],
        questionExamples: [
            'How do I accept a new order?',
            'What happens after I accept an order?',
            'When should I mark an order Ready?',
            'How do I cancel an order I cannot fulfill?'
        ],
        summary: 'Incoming (pending) -> Accept (confirmed & visible to drivers) -> Cooking (preparing) -> Packed (ready).',
        answer: `Efficient order management ensures 5-star ratings and fast delivery:

1. **Incoming Alert:** A sound and visual alert announces a new order in **Pending** status.
2. **Accept Order:** Click **Accept** to move status to \`confirmed\`.
   - **Crucial:** Marking \`confirmed\` instantly broadcasts the order to the [Delivery Marketplace](/delivery/available) so nearby riders can accept and head your way!
3. **Start Cooking:** Click **Start Preparing** when the kitchen begins cooking (status: \`preparing\`).
4. **Mark Ready:** Once packaged with cutlery and receipt, click **Mark Ready** (status: \`ready\`).
   - The assigned delivery partner receives a notification that food is ready for immediate pickup.
5. **Handover:** Hand over the order to the rider who verifies the order ID and marks it \`out_for_delivery\`.`,
        actionLink: { label: 'Live Orders Dashboard', url: '/restaurant/orders' },
        relatedQuestions: ['How to Mark Menu Items Out of Stock', 'Automatic Restaurant Quality Score Formula']
    },
    {
        id: 'rest_menu_out_of_stock',
        role: 'restaurant',
        category: 'Menu Management',
        title: 'How to Mark Menu Items Out of Stock and Edit Dishes',
        keywords: [
            'menu', 'out of stock', 'in stock', 'dish', 'add item', 'food item',
            'price', 'edit dish', 'veg', 'non veg', 'category', 'khatam ho gaya'
        ],
        questionExamples: [
            'How do I mark an ingredient or dish out of stock?',
            'How do I add a new dish to my menu?',
            'How do I change item prices?',
            'Can I mark vegetarian and non-vegetarian badges?'
        ],
        summary: 'Toggle the instant In-Stock switch in Menu Management to prevent unfulfillable orders.',
        answer: `Manage your menu in real-time to avoid customer cancellations:

- **Instant Out-of-Stock Switch:**
  1. Open [Menu Management](/restaurant/menu).
  2. Locate the dish and toggle the **In Stock / Out of Stock** switch.
  3. The item immediately turns grey and displays "Sold Out" in the customer app, preventing orders you cannot fulfill!
- **Adding New Dishes:**
  - Click **Add Menu Item**.
  - Enter item name, category (Appetizers, Mains, Beverages, Desserts), price, and description.
  - Set food type: **Vegetarian (Green Dot)**, **Non-Vegetarian (Red Dot)**, **Egg**, or **Vegan**.
  - Upload dish image and save.
- **Price & Detail Updates:**
  - Click **Edit** on any dish card to revise pricing or description.`,
        actionLink: { label: 'Manage Menu Now', url: '/restaurant/menu' },
        relatedQuestions: ['Managing Incoming Orders and Driver Dispatch', 'Automatic Restaurant Quality Score Formula']
    },
    {
        id: 'rest_quality_score_formula',
        role: 'restaurant',
        category: 'Quality Analytics',
        title: 'Automatic Restaurant Quality Score Formula and Criteria',
        keywords: [
            'quality', 'score', 'formula', 'quality score', 'analytics', 'success rate',
            'satisfaction', 'consistency', 'ranking', 'rating score', 'improve score'
        ],
        questionExamples: [
            'How is the restaurant quality score calculated?',
            'What is the formula for quality score?',
            'Why did my quality score drop?',
            'How can I improve my restaurant ranking?'
        ],
        summary: 'Score (0-100) = (Order Success Rate × 40%) + (Customer Satisfaction × 40%) + (Consistency Score × 20%).',
        answer: `Our platform evaluates kitchen performance using an automated **Quality Score (0 to 100)**:

### 📐 The Mathematical Formula:
\`\`\`text
Quality Score (0-100) = 
  (Order Success Rate × 40%) + 
  (Customer Satisfaction × 40%) + 
  (Consistency Score × 20%)
\`\`\`

### 🔍 Breakdown of Metrics:
1. **Order Success Rate (40% Weight):** Percentage of accepted and completed orders vs. restaurant-initiated cancellations.
2. **Customer Satisfaction (40% Weight):** Your average star rating across customer reviews (normalized to 100 points).
3. **Consistency Score (20% Weight):** Measures variance in preparation times and absence of repeated item-missing complaints.

### 🏆 Rating Thresholds:
- **80 – 100 (Green / Excellent):** Top placement on customer homepage & search results.
- **60 – 79 (Yellow / Good):** Healthy performance with room for minor prep time optimization.
- **Below 60 (Orange / Needs Attention):** High cancellations or sub-4 star averages. Review recommended tips on the Quality page!`,
        actionLink: { label: 'View Quality Analytics', url: '/restaurant/quality' },
        relatedQuestions: ['Ad Campaigns and Points System', 'Replying to Customer Reviews']
    },
    {
        id: 'rest_ad_campaigns_points',
        role: 'restaurant',
        category: 'Ad Campaigns & Points',
        title: 'Ad Campaigns and Points System for Restaurant Growth',
        keywords: [
            'campaign', 'campaigns', 'ad', 'advertisement', 'promote', 'points',
            'points system', 'cost per click', 'cpc', 'boost sales', 'razorpay points'
        ],
        questionExamples: [
            'How do advertisement campaigns work for restaurants?',
            'How much do ad points cost?',
            'What is the cost per click (CPC)?',
            'How do I create an ad campaign for a dish?'
        ],
        summary: '₹100 = 20 Points. Each customer click costs 1 Point (₹0.50). Buy points via Razorpay and promote dishes.',
        answer: `Boost your restaurant's visibility and sales through targeted **Ad Campaigns**:

- **Points System Economics:**
  - **Conversion Rate:** **₹100 = 20 Points**.
  - **Click Cost:** **1 Point per Click** = **₹0.50 per customer click**.
  - Points are purchased instantly via Razorpay in the [Campaigns](/restaurant/campaigns) portal.
- **How to Launch a Campaign:**
  1. Go to [Ad Campaigns](/restaurant/campaigns).
  2. Click **Create Campaign**.
  3. Select the signature dish or combo you want to promote.
  4. Choose budget type: **Daily** or **Monthly** budget limit.
  5. Define point allocation.
  6. Click Launch! Your dish gets a **Sponsored** badge and top-tier search visibility.
- **Real-Time Analytics:** Track total impressions, customer clicks, points spent, and ROI in real-time. Pause or resume campaigns anytime!`,
        actionLink: { label: 'Open Ad Campaigns', url: '/restaurant/campaigns' },
        relatedQuestions: ['Automatic Restaurant Quality Score Formula', 'Restaurant Wallet and Weekly Payout Settlements']
    },
    {
        id: 'rest_reviews_replies',
        role: 'restaurant',
        category: 'Reviews & Reputation',
        title: 'Replying to Customer Reviews and Managing Feedback',
        keywords: [
            'review', 'reviews', 'reply', 'respond', 'customer feedback', 'stars',
            'bad review', 'complaint', 'ratings', 'thank customer'
        ],
        questionExamples: [
            'How can I reply to a customer review?',
            'Can I respond to negative feedback?',
            'Where do I view all ratings for my restaurant?',
            'Does responding to reviews improve ranking?'
        ],
        summary: 'View 1-5 star ratings and post direct public replies to customer feedback under Reviews.',
        answer: `Build brand loyalty by actively engaging with your diners:

1. Open [Restaurant Reviews](/restaurant/reviews).
2. Browse feedback filtered by star ratings (1⭐ to 5⭐).
3. Verified purchase badges confirm authentic orders.
4. Click **Reply** on any review to send a personalized public response:
   - For 5-star reviews: Thank the customer for ordering!
   - For critical reviews: Acknowledge the issue (e.g., seasoning or packaging) and assure quality improvements.
5. Thoughtful responses improve customer retention and positively influence your restaurant reputation!`,
        actionLink: { label: 'Manage Reviews', url: '/restaurant/reviews' },
        relatedQuestions: ['Automatic Restaurant Quality Score Formula', 'Managing Incoming Orders and Driver Dispatch']
    },
    {
        id: 'rest_wallet_payouts',
        role: 'restaurant',
        category: 'Wallet & Payouts',
        title: 'Restaurant Wallet and Weekly Payout Settlements',
        keywords: [
            'wallet', 'payout', 'payouts', 'settlement', 'weekly payment', 'bank account',
            'restaurant money', 'commission', 'net earnings', 'invoice'
        ],
        questionExamples: [
            'When are restaurant earnings transferred?',
            'How do I view my restaurant wallet balance?',
            'What is the commission deduction?',
            'Where do I add my restaurant bank details?'
        ],
        summary: 'Weekly earnings settled directly to registered bank account. View statements in Restaurant Wallet.',
        answer: `Manage all financial transactions cleanly and transparently:

- **Weekly Settlement Cycle:**
  - Net sales (Gross sales minus platform commission and taxes) are settled weekly directly to your registered bank account.
- **Restaurant Wallet:**
  - Access [Restaurant Wallet](/restaurant/wallet) to monitor daily order earnings, commission breakdowns, and historical statements.
- **Bank Account Setup:**
  - Update your Beneficiary Name, Account Number, and IFSC code in [Settings](/restaurant/settings).
  - All transfers are executed via NEFT/IMPS with downloadable tax invoices.`,
        actionLink: { label: 'Go to Restaurant Wallet', url: '/restaurant/wallet' },
        relatedQuestions: ['Ad Campaigns and Points System for Restaurant Growth', 'Managing Incoming Orders and Driver Dispatch']
    },

    // ==========================================
    // 4. CROSS-PANEL INTERCONNECTION & LIFECYCLE
    // ==========================================
    {
        id: 'cross_order_lifecycle',
        role: 'cross_panel',
        category: 'End-to-End Workflow',
        title: 'The Complete Order Journey: Customer -> Restaurant -> Delivery Partner',
        keywords: [
            'lifecycle', 'flow', 'journey', 'how it works', 'cross panel', 'steps',
            'process', 'full order flow', 'all panels', 'connection', 'order status flow'
        ],
        questionExamples: [
            'Explain the complete order flow from customer to delivery.',
            'How do Customer, Restaurant, and Delivery panels connect?',
            'What happens when a customer places an order?',
            'Who sees the order at each stage?'
        ],
        summary: 'Customer places (pending) -> Restaurant confirms (confirmed) -> Delivery accepts -> Cooking (preparing/ready) -> Pickup (out_for_delivery) -> Handover (delivered).',
        answer: `Here is the seamless journey that synchronizes all three panels:

\`\`\`text
[Customer Panel] Places Order (Status: pending)
        │
        ▼
[Restaurant Panel] Receives Alert -> Clicks Accept (Status: confirmed)
        │
        ▼
[Delivery Panel] Order appears in Marketplace (/delivery/available)
        │
        ├─ Delivery Partner accepts order (deliveryPersonId assigned)
        │  Order moves to Partner's Active Dashboard
        │
        ├─ [Restaurant Panel] Cooks food -> (Status: preparing -> ready)
        │
        ├─ [Delivery Partner] Picks up food at Restaurant -> (Status: out_for_delivery)
        │  Customer sees live rider tracking and ETA
        │
        └─ [Delivery Partner] Delivers to Customer -> (Status: delivered)
                │
                ├─ [Customer] Rates food & rider, earns loyalty points
                ├─ [Restaurant] Earnings credited to Restaurant Wallet
                └─ [Delivery Partner] Base pay + tip credited to Delivery Wallet
\`\`\`

All status updates sync in real-time across Web and Mobile!`,
        actionLink: { label: 'View Marketplace Flow', url: '/delivery/available' },
        relatedQuestions: [
            'When and How Orders Appear in Available Marketplace',
            'How to Track Your Food Order in Real-Time',
            'Managing Incoming Orders and Driver Dispatch'
        ]
    },
    {
        id: 'cross_status_dictionary',
        role: 'cross_panel',
        category: 'Status Definitions',
        title: 'Dictionary of Order Statuses Across All Panels',
        keywords: [
            'status', 'statuses', 'pending', 'confirmed', 'preparing', 'ready',
            'out_for_delivery', 'delivered', 'cancelled', 'meaning', 'what does status mean'
        ],
        questionExamples: [
            'What does each order status mean?',
            'What is the difference between confirmed and preparing?',
            'When does an order become ready?',
            'What are all the valid order status names?'
        ],
        summary: 'pending -> confirmed -> preparing -> ready -> out_for_delivery -> delivered (or cancelled).',
        answer: `Complete definition of each status value in the database:

| Status Name | Description | Who Triggers It |
| :--- | :--- | :--- |
| \`pending\` | Customer placed order; awaiting restaurant review. | Customer Checkout |
| \`confirmed\` | Restaurant accepted order; **appears in Delivery Marketplace**. | Restaurant Dashboard |
| \`preparing\` | Kitchen is actively cooking the food. | Restaurant Dashboard |
| \`ready\` | Food is packaged and awaiting pickup. | Restaurant Dashboard |
| \`out_for_delivery\` | Delivery partner picked up food and is en route. | Delivery Dashboard |
| \`delivered\` | Customer received food; transaction complete. | Delivery Dashboard |
| \`cancelled\` | Order cancelled within 5 mins or by restaurant/admin. | Customer / Restaurant / Admin |`,
        actionLink: { label: 'Explore Active Orders', url: '/customer/orders' },
        relatedQuestions: ['The Complete Order Journey: Customer -> Restaurant -> Delivery Partner']
    }
];
