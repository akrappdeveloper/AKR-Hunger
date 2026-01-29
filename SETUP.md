# AKR Hunger Food - Setup Guide

## Prerequisites

- Node.js 18+ 
- A Firebase project (https://firebase.google.com)
- Razorpay account (https://razorpay.com)

## Firebase Setup

### 1. Create a Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project
3. Enable Authentication (Email/Password)
4. Enable Firestore Database (in production mode)

### 2. Get Firebase Credentials
1. In Firebase Console, go to Project Settings
2. Copy the following and add to your environment variables:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`

### 3. Set Up Firestore Security Rules
1. In Firebase Console, go to Firestore Database > Rules
2. Replace the default rules with the contents from `/firestore.rules`
3. Click Publish

### 4. Create Sample Data (Optional)
Create a document in the `restaurants` collection with this structure:
```json
{
  "name": "Sample Restaurant",
  "description": "A delicious restaurant",
  "image": "https://via.placeholder.com/300",
  "rating": 4.5,
  "reviews": 120,
  "cuisines": ["Italian", "Continental"],
  "deliveryTime": 30,
  "deliveryCharge": 50,
  "minimumOrder": 250,
  "isOpen": true,
  "ownerId": "restaurant_uid",
  "coordinates": {
    "latitude": 28.7041,
    "longitude": 77.1025
  }
}
```

Create menu items in the `menuItems` collection:
```json
{
  "restaurantId": "restaurant_id",
  "name": "Margherita Pizza",
  "description": "Classic pizza with fresh mozzarella",
  "price": 350,
  "category": "Pizza",
  "image": "https://via.placeholder.com/200",
  "isVegetarian": true,
  "isSpicy": false,
  "isAvailable": true
}
```

## Razorpay Setup

### 1. Get Razorpay Keys
1. Go to [Razorpay Dashboard](https://dashboard.razorpay.com)
2. Navigate to Settings > API Keys
3. Copy the following and add to your environment variables:
   - `NEXT_PUBLIC_RAZORPAY_KEY_ID` (public key)
   - `RAZORPAY_KEY_SECRET` (secret key - server side only)

## Environment Variables

Add these to your Vercel project (Settings > Environment Variables):

```
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

## Running the Application

1. Install dependencies:
```bash
npm install
```

2. Run development server:
```bash
npm run dev
```

3. Open http://localhost:3000

## Panel Access

- **Customer Panel**: http://localhost:3000/customer
- **Admin Panel**: http://localhost:3000/admin 
- **Restaurant Panel**: http://localhost:3000/restaurant 
- **Delivery Panel**: http://localhost:3000/delivery 

## Project Structure

```
/app
  /customer        - Customer-facing application
  /admin          - Admin dashboard (coming soon)
  /restaurant     - Restaurant management (coming soon)
  /delivery       - Delivery partner system (coming soon)
  /api            - API routes for payments, webhooks
/components
  /customer       - Customer-specific UI components
  /admin          - Admin UI components (coming soon)
  /ui             - Shared shadcn/ui components
/context          - React contexts (Auth, Cart)
/lib              - Utilities (Firebase, Razorpay, Types)
```

## Security Notes

- All environment variables prefixed with `NEXT_PUBLIC_` are visible in the browser
- `RAZORPAY_KEY_SECRET` should NEVER be exposed to the client - keep it server-side only
- Firestore security rules enforce authentication and authorization
- Always use environment variables for sensitive credentials

## Support

For issues or questions, refer to:
- Firebase Documentation: https://firebase.google.com/docs
- Razorpay Documentation: https://razorpay.com/docs
- Next.js Documentation: https://nextjs.org/docs
