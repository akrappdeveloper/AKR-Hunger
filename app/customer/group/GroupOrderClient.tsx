'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import GroupOrderView from '@/components/customer/GroupOrderView';

export default function GroupOrderClient() {
  const [user, setUser] = useState<{ uid: string; displayName: string | null } | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      if (u) setUser({ uid: u.uid, displayName: u.displayName });
    });
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">👥</div>
          <p className="text-muted-foreground">Sign in to use Group Orders</p>
        </div>
      </div>
    );
  }

  return (
    <GroupOrderView
      currentUserId={user.uid}
      currentUserName={user.displayName || 'Guest'}
    />
  );
}
