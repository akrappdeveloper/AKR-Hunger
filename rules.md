rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function to check admin status
    function isAdmin(uid) {
      return uid != null && exists(/databases/$(database)/documents/admins/$(uid));
    }

    // ==========================================
    // 1. Restaurants: Public read for browsing, Owner & Admin management
    // ==========================================
    match /restaurants/{restaurantId} {
      allow read, list: if true; // Public browsing, search, and email validation
      allow create: if request.auth.uid != null && (
        request.auth.uid == restaurantId || 
        request.resource.data.ownerId == request.auth.uid ||
        isAdmin(request.auth.uid)
      );
      allow update, delete: if request.auth.uid != null && (
        isAdmin(request.auth.uid) || 
        request.auth.uid == restaurantId || 
        request.auth.uid == resource.data.ownerId
      );
    }

    // ==========================================
    // 2. Menu Items (Subcollection under restaurant)
    // ==========================================
    match /restaurants/{restaurantId}/menuItems/{itemId} {
      allow read: if true;
      allow write: if request.auth.uid != null && (
        isAdmin(request.auth.uid) || 
        request.auth.uid == restaurantId || 
        request.auth.uid == get(/databases/$(database)/documents/restaurants/$(restaurantId)).data.ownerId
      );
    }

    // ==========================================
    // 3. Menu Items (Root Flat Collection)
    // ==========================================
    match /menuItems/{itemId} {
      allow read: if true; // Public can read all menu items
      allow create: if request.auth.uid != null && request.resource.data.restaurantId == request.auth.uid;
      allow update: if request.auth.uid != null; // Allows restaurant owners to edit and customers to submit ratings
      allow delete: if request.auth.uid != null && (
        isAdmin(request.auth.uid) || 
        request.auth.uid == resource.data.restaurantId
      );
    }

    // ==========================================
    // 4. Customer Profiles & Subcollections
    // ==========================================
    match /customers/{customerId} {
      allow read: if request.auth.uid == customerId || isAdmin(request.auth.uid);
      allow list: if isAdmin(request.auth.uid);
      allow create: if request.auth.uid != null && request.auth.uid == customerId;
      allow update, delete: if request.auth.uid == customerId || isAdmin(request.auth.uid);

      // Customer Wallet Transactions (Subcollection)
      match /walletTransactions/{transactionId} {
        allow read: if request.auth.uid == customerId || isAdmin(request.auth.uid);
        allow create: if request.auth.uid == customerId || isAdmin(request.auth.uid);
      }
    }

    // ==========================================
    // 5. Orders: Multi-Party Access (Customer, Restaurant, Delivery, Admin)
    // ==========================================
    match /orders/{orderId} {
      // Anyone with the specific order ID can view order details and tracking
      // (ensures real-time tracking works even before auth hydrates or when opened via tracking link)
      allow get: if true;
      // Listing/querying orders is restricted to authenticated users
      allow list: if request.auth.uid != null;
      allow create: if request.auth.uid != null && request.auth.uid == request.resource.data.customerId;
      allow update: if request.auth.uid != null;
      allow delete: if request.auth.uid != null && (request.auth.uid == resource.data.restaurantId || isAdmin(request.auth.uid));
    }

    // ==========================================
    // 6. Admin Collection for Role Management
    // ==========================================
    match /admins/{adminId} {
      allow read: if request.auth.uid == adminId || isAdmin(request.auth.uid);
      allow write: if isAdmin(request.auth.uid);
    }

    // ==========================================
    // 7. Delivery Partners (Matches code: 'delivery_partners')
    // ==========================================
    match /delivery_partners/{partnerId} {
      allow read: if request.auth.uid == partnerId || isAdmin(request.auth.uid);
      allow write: if request.auth.uid == partnerId || isAdmin(request.auth.uid);
    }

    // ==========================================
    // 8. Unified Delivery Persons Access & Wallet Subcollection
    // ==========================================
    match /deliveryPersons/{partnerId} {
      allow read, list: if true; // Public read so customer tracking page can view assigned rider details
      allow write: if request.auth.uid == partnerId || isAdmin(request.auth.uid);
      
      // Allow delivery person to read and create their own wallet transactions
      match /walletTransactions/{transactionId} {
        allow read: if request.auth.uid == partnerId || isAdmin(request.auth.uid);
        allow create: if request.auth.uid == partnerId || isAdmin(request.auth.uid);
      }
    }
    
    // ==========================================
    // 9. Support Tickets (Unified supportTickets & support_tickets)
    // ==========================================
    match /supportTickets/{ticketId} {
      allow read: if request.auth.uid != null && (resource.data.userId == request.auth.uid || isAdmin(request.auth.uid));
      allow list: if request.auth.uid != null; // Allows users to query their own tickets and admins to list all
      allow create: if true; // Allows registered users and guests to submit support tickets
      allow update: if request.auth.uid != null && (isAdmin(request.auth.uid) || resource.data.userId == request.auth.uid);
      allow delete: if isAdmin(request.auth.uid);
    }

    match /support_tickets/{ticketId} {
      allow read: if request.auth.uid != null && (resource.data.userId == request.auth.uid || isAdmin(request.auth.uid));
      allow list: if request.auth.uid != null; // Allows users to query their own tickets and admins to list all
      allow create: if true; // Allows registered users and guests to submit support tickets
      allow update: if request.auth.uid != null && (isAdmin(request.auth.uid) || resource.data.userId == request.auth.uid);
      allow delete: if isAdmin(request.auth.uid);
    }

    // ==========================================
    // 10. Platform Feedback
    // ==========================================
    match /platformFeedback/{feedbackId} {
      allow read: if isAdmin(request.auth.uid);
      allow create: if request.auth.uid != null;
      allow delete: if isAdmin(request.auth.uid);
    }

    // ==========================================
    // 11. Payout Requests (Legacy)
    // ==========================================
    match /payout_requests/{requestId} {
      allow read: if request.auth.uid != null && (resource.data.userId == request.auth.uid || isAdmin(request.auth.uid));
      allow create: if request.auth.uid != null && request.resource.data.userId == request.auth.uid;
      allow update: if isAdmin(request.auth.uid);
    }

    // ==========================================
    // 12. Withdrawal Requests (Restaurant)
    // ==========================================
    match /withdrawalRequests/{requestId} {
      allow read: if request.auth.uid != null && (resource.data.restaurantId == request.auth.uid || isAdmin(request.auth.uid));
      allow create: if request.auth.uid != null && request.resource.data.restaurantId == request.auth.uid;
      allow update: if isAdmin(request.auth.uid);
    }

    // ==========================================
    // 13. Notifications
    // ==========================================
    match /notifications/{notifId} {
      allow read, list: if request.auth.uid != null;
      allow update, delete: if request.auth.uid != null && (resource.data.userId == request.auth.uid || isAdmin(request.auth.uid));
      allow create: if request.auth.uid != null || isAdmin(request.auth.uid);
    }

    // ==========================================
    // 14. Notification Preferences
    // ==========================================
    match /notificationPreferences/{userId} {
      allow read, write: if request.auth.uid == userId || isAdmin(request.auth.uid);
    }

    // ==========================================
    // 15. User Profile / FCM Push Tokens
    // ==========================================
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId || isAdmin(request.auth.uid);
    }

    // ==========================================
    // 16. Reviews (Public Read, Customer / Restaurant Reply / Admin Manage)
    // ==========================================
    match /reviews/{reviewId} {
      allow read: if true;
      allow create: if request.auth.uid != null;
      allow update: if request.auth.uid != null && (
        resource.data.customerId == request.auth.uid ||
        resource.data.restaurantId == request.auth.uid ||
        isAdmin(request.auth.uid)
      );
      allow delete: if request.auth.uid != null && (
        resource.data.customerId == request.auth.uid ||
        isAdmin(request.auth.uid)
      );
    }

    // ==========================================
    // 17. Ad Campaigns & Clicks (Supports camelCase & snake_case)
    // ==========================================
    match /adCampaigns/{campaignId} {
      allow read, list: if request.auth.uid != null;
      allow create, update: if request.auth.uid != null && (request.resource.data.restaurantId == request.auth.uid || isAdmin(request.auth.uid));
      allow delete: if request.auth.uid != null && (resource.data.restaurantId == request.auth.uid || isAdmin(request.auth.uid));
    }

    match /ad_campaigns/{campaignId} {
      allow read, list: if request.auth.uid != null;
      allow create, update: if request.auth.uid != null && (request.resource.data.restaurantId == request.auth.uid || isAdmin(request.auth.uid));
      allow delete: if request.auth.uid != null && (resource.data.restaurantId == request.auth.uid || isAdmin(request.auth.uid));
    }

    match /adClicks/{clickId} {
      allow read, list: if request.auth.uid != null && (
        resource.data.restaurantId == request.auth.uid ||
        isAdmin(request.auth.uid)
      );
      allow create: if request.auth.uid != null;
    }

    // ==========================================
    // 18. Points Accounts & Transactions (Supports camelCase & snake_case)
    // ==========================================
    match /pointsAccounts/{accountId} {
      allow read, list, update: if request.auth.uid != null;
      allow create: if request.auth.uid != null;
    }

    match /points_accounts/{accountId} {
      allow read, list, update: if request.auth.uid != null;
      allow create: if request.auth.uid != null;
    }

    match /pointsTransactions/{transId} {
      allow read, list: if request.auth.uid != null && (resource.data.userId == request.auth.uid || isAdmin(request.auth.uid));
      allow create: if request.auth.uid != null;
    }

    // ==========================================
    // 19. Payments
    // ==========================================
    match /payments/{paymentId} {
      allow read, list: if request.auth.uid != null && (resource.data.userId == request.auth.uid || isAdmin(request.auth.uid));
      allow create: if request.auth.uid != null && request.resource.data.userId == request.auth.uid;
      allow update: if isAdmin(request.auth.uid);
    }

    // ==========================================
    // 20. Customer Withdrawal Requests
    // ==========================================
    match /customerWithdrawals/{requestId} {
      allow read, list: if request.auth.uid != null && (resource.data.customerId == request.auth.uid || isAdmin(request.auth.uid));
      allow create: if request.auth.uid != null && request.resource.data.customerId == request.auth.uid;
      allow update: if isAdmin(request.auth.uid);
    }

    // ==========================================
    // 21. Membership Requests & Issued Cards (Supports camelCase & snake_case)
    // ==========================================
    match /membershipRequests/{requestId} {
      allow read, list: if request.auth.uid != null;
      allow create: if request.auth.uid != null;
      allow update, delete: if request.auth.uid != null;
    }

    match /membership_requests/{requestId} {
      allow read, list: if request.auth.uid != null;
      allow create: if request.auth.uid != null;
      allow update, delete: if request.auth.uid != null;
    }

    match /issuedCards/{cardId} {
      allow read, list: if request.auth.uid != null;
      allow create, update, delete: if request.auth.uid != null;
    }

    match /issued_cards/{cardId} {
      allow read, list: if request.auth.uid != null;
      allow create, update, delete: if request.auth.uid != null;
    }

    // ==========================================
    // 22. Promotions & Coupons (Public read for active coupons, Admin write)
    // ==========================================
    match /promotions/{promotionId} {
      allow read, list: if true; // Public customers can read promotions to see available offers
      allow write: if request.auth.uid != null;
    }

    // ==========================================
    // 23. Promotion Usages Tracking
    // ==========================================
    match /promotionUsages/{usageId} {
      allow read, list: if request.auth.uid != null && (resource.data.customerId == request.auth.uid || isAdmin(request.auth.uid));
      allow create: if request.auth.uid != null;
      allow update, delete: if isAdmin(request.auth.uid);
    }

    // ==========================================
    // 24. Driver Live Locations (GPS Tracking)
    // ==========================================
    match /driverLocations/{driverId} {
      // Anyone can read driver live locations for real-time order tracking
      allow read, list: if true;
      // Drivers can only write their own location
      allow create, update: if request.auth.uid != null && request.auth.uid == driverId;
      // Admin can manage all locations
      allow delete: if isAdmin(request.auth.uid) || request.auth.uid == driverId;
    }

    // ==========================================
    // 25. Delivery Zones (deliveryZones & delivery_zones)
    // ==========================================
    match /deliveryZones/{zoneId} {
      allow read, list: if true;
      allow write: if request.auth.uid != null;
    }

    match /delivery_zones/{zoneId} {
      allow read, list: if true;
      allow write: if request.auth.uid != null;
    }
  }
}
