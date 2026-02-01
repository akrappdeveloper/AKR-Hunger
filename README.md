# 🍔 AKR Hunger - Premium Food Delivery Platform

Welcome to **AKR Hunger**, a state-of-the-art food delivery platform built with a focus on premium aesthetics, seamless user experience, and powerful management tools.

![Project Status](https://img.shields.io/badge/Status-Production%20Ready-success)
![Next.js](https://img.shields.io/badge/Next.js-16.0-black)
![React](https://img.shields.io/badge/React-19.0-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38bdf8)
![Firebase](https://img.shields.io/badge/Firebase-12.8-orange)

## 🌟 Introduction

AKR Hunger is a dual-portal application designed to revolutionize the food delivery experience. It features a stunning **Glassmorphic UI** that provides a modern, high-end feel for both customers and restaurant partners.

- **For Customers**: A visually immersive menu browsing and ordering experience with real-time tracking.
- **For Restaurants**: A comprehensive dashboard to manage orders, analyze quality, run ad campaigns, and engage with customers.

---

## 🚀 Key Features

### 🍽️ Customer Portal
*   **Immersive Menu Browsing**: Grid layout with high-quality images, search, and category filters.
*   **Smart Product Details**: Dynamic pages with image carousels, nutritional info, allergens, and "Recommended for You" sections.
*   **Advanced Cart & Checkout**: Real-time cart updates, coupon application, and secure checkout flow.
*   **Order Tracking**: Live status updates for active orders.
*   **Responsive Design**: Fully optimized for mobile, tablet, and desktop devices.

### 🏪 Restaurant Partner Portal
*   **Dashboard & Analytics**: Real-time insights into sales, orders, and performance.
*   **Menu Management**: Easy-to-use tools for adding/editing dishes with professional forms.
*   **Ad Campaigns**: Built-in advertising platform to boost visibility (Pay-per-click model).
*   **Quality Score System**: AI-driven quality grading (0-100) based on success rate, ratings, and consistency.
*   **Reviews & Support**: Manage customer feedback and raise support tickets directly from the panel.
*   **Notifications Center**: Real-time alerts for new orders and system updates.

### 🛡️ Admin & Delivery (Coming Soon)
*   **Admin Dashboard**: Platform-wide oversight and management.
*   **Delivery Partner App**: Dedicated interface for delivery riders.

---

## 🛠️ Technology Stack

This project is built using the latest cutting-edge web technologies:

*   **Framework**: [Next.js 16 (App Router)](https://nextjs.org/)
*   **Library**: [React 19](https://react.dev/)
*   **Language**: [TypeScript](https://www.typescriptlang.org/)
*   **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) & Vanilla CSS variables
*   **UI Components**: [Radix UI](https://www.radix-ui.com/), [Lucide React](https://lucide.dev/), [Shadcn UI](https://ui.shadcn.com/)
*   **Animations**: [Framer Motion](https://www.framer.com/motion/)
*   **Backend & Database**: [Firebase](https://firebase.google.com/) (Firestore, Auth, Storage)
*   **Payments**: [Razorpay](https://razorpay.com/)
*   **State Management**: React Context API

---

## 📂 Project Structure

```bash
/app
  /customer        # Customer-facing application (Menu, Cart, Profile)
  /restaurant      # Restaurant dashboard (Analytics, Menu, Settings)
  /admin           # Admin panel
  /delivery        # Delivery partner interface
  /api             # Backend API routes (Payment webhooks, etc.)
/components
  /customer        # Customer-specific UI components
  /restaurant      # Restaurant-specific UI components
  /ui              # Shared reusable components (Button, Dialog, Input)
/context           # Global state providers (Cart, Auth)
/lib               # Utility functions (Firebase, Razorpay, Validators)
/public            # Static assets (Images, Icons)
```

---

## ⚡ Getting Started

Follow these instructions to set up the project locally.

### Prerequisites
*   **Node.js 18+** installed.
*   A **Firebase Project** (Firestore & Auth enabled).
*   A **Razorpay Account** (Test mode credentials).

### 1. Installation

Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd my-v0-project
npm install
# or
pnpm install
```

### 2. Environment Setup

Create a `.env.local` file in the root directory and add your credentials:

```bash
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Razorpay Configuration
NEXT_PUBLIC_RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

### 3. Database Rules

Go to your Firebase Console -> Firestore Database -> Rules and publish the rules found in `firestore.rules` to ensure proper security and access control.

### 4. Running the Application

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔗 Quick Links

Once the server is running, access the different portals:

| Portal | URL | Description |
| :--- | :--- | :--- |
| **Landing Page** | [http://localhost:3000](http://localhost:3000) | Main entry point |
| **Customer App** | [http://localhost:3000/customer](http://localhost:3000/customer) | Order food & browse menu |
| **Restaurant Panel** | [http://localhost:3000/restaurant](http://localhost:3000/restaurant) | Manage restaurant operations |
| **Admin Panel** | [http://localhost:3000/admin](http://localhost:3000/admin) | Platform administration |

---

## 📄 Documentation

For more detailed information, please refer to the following documents:

*   [**Setup Guide**](./SETUP.md): Detailed setup and configuration instructions.
*   [**Advanced Features**](./ADVANCED_FEATURES.md): In-depth look at complex features like Quality Score and Ads.
*   [**Project Summary**](./PROJECT_COMPLETE.md): Overview of all implemented features and completion status.

---

Made with ❤️ by the AKR Hunger Team
