rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function to check admin status
    function isAdmin(uid) {
      return uid != null && exists(/databases/{database}/documents/admins/{uid});
    }

    // Public read access to restaurants for browsing
    match /restaurants/{restaurantId} {
      allow read: if true;
      allow write: if request.auth.uid != null && (isAdmin(request.auth.uid) || request.auth.uid == resource.data.ownerId);
    }

    // Public read access to menu items
    match /restaurants/{restaurantId}/menuItems/{itemId} {
      allow read: if true;
      allow write: if request.auth.uid != null && (isAdmin(request.auth.uid) || request.auth.uid == get(/databases/{database}/documents/restaurants/{restaurantId}).data.ownerId);
    }

    // Alternative menu items collection (if stored flat)
    match /menuItems/{itemId} {
      allow read: if true;
      allow write: if request.auth.uid != null && isAdmin(request.auth.uid);
    }

    // Customer profiles - users can read/write their own
    match /customers/{customerId} {
      allow read, write: if request.auth.uid == customerId || isAdmin(request.auth.uid);
    }

    // Orders - users can read their own, restaurants can read assigned orders
    match /orders/{orderId} {
      allow read: if request.auth.uid == resource.data.customerId 
                   || request.auth.uid == resource.data.restaurantId
                   || request.auth.uid == resource.data.deliveryPersonId
                   || isAdmin(request.auth.uid);
      allow create: if request.auth.uid != null && request.auth.uid == request.resource.data.customerId;
      allow update: if request.auth.uid == resource.data.restaurantId
                     || request.auth.uid == resource.data.deliveryPersonId
                     || isAdmin(request.auth.uid);
      allow delete: if request.auth.uid == resource.data.restaurantId || isAdmin(request.auth.uid);
    }

    // Admin collection for role management
    match /admins/{adminId} {
      allow read, write: if request.auth.uid != null && isAdmin(request.auth.uid);
    }

    // Delivery persons
    match /deliveryPersons/{personId} {
      allow read: if request.auth.uid == personId || isAdmin(request.auth.uid);
      allow write: if request.auth.uid == personId || isAdmin(request.auth.uid);
    }
  }
}
