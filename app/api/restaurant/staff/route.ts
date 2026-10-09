import { NextRequest, NextResponse } from 'next/server';
import { admin, adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

function getAuth() {
  if (adminAuth) return adminAuth;
  if (admin.apps.length > 0) return admin.auth();
  throw new Error('Firebase Admin Auth is not initialized. Please verify FIREBASE_PRIVATE_KEY.');
}

function getDb() {
  if (adminDb) return adminDb;
  if (admin.apps.length > 0) return admin.firestore();
  throw new Error('Firebase Admin Firestore is not initialized. Please verify FIREBASE_PRIVATE_KEY.');
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const restaurantId = searchParams.get('restaurantId');

    if (!restaurantId) {
      return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 });
    }

    const db = getDb();
    const staffMap = new Map<string, any>();

    // 1. Fetch from restaurants/{restaurantId}/staff subcollection
    try {
      const subSnap = await db.collection('restaurants').doc(restaurantId).collection('staff').get();
      subSnap.forEach((doc: any) => {
        const data = doc.data();
        staffMap.set(doc.id, {
          id: doc.id,
          uid: doc.id,
          ...data,
        });
      });
    } catch (err) {
      console.warn('[Staff API GET] Subcollection fetch warning:', err);
    }

    // 2. Fetch from users collection where restaurantId matches
    try {
      const usersSnap = await db
        .collection('users')
        .where('restaurantId', '==', restaurantId)
        .get();

      usersSnap.forEach((doc: any) => {
        const data = doc.data();
        // Check if user is staff or has a staff role
        if (data.isStaff || data.role === 'staff' || data.staffRole) {
          const existing = staffMap.get(doc.id) || {};
          staffMap.set(doc.id, {
            ...existing,
            id: doc.id,
            uid: doc.id,
            ...data,
          });
        }
      });
    } catch (err) {
      console.warn('[Staff API GET] Users query warning:', err);
    }

    // Convert map to array and safely format timestamps
    const staffList = Array.from(staffMap.values()).map((s) => {
      const formatTimestamp = (val: any) => {
        if (!val) return null;
        if (typeof val.toDate === 'function') return val.toDate().toISOString();
        if (typeof val.toMillis === 'function') return new Date(val.toMillis()).toISOString();
        if (val._seconds) return new Date(val._seconds * 1000).toISOString();
        return val;
      };

      return {
        ...s,
        joinedAt: formatTimestamp(s.joinedAt),
        createdAt: formatTimestamp(s.createdAt),
        updatedAt: formatTimestamp(s.updatedAt),
        lastLoginAt: formatTimestamp(s.lastLoginAt),
      };
    });

    // Sort descending by date
    staffList.sort((a, b) => {
      const dateA = new Date(a.joinedAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.joinedAt || b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    return NextResponse.json({ success: true, staff: staffList });
  } catch (error: any) {
    console.error('[Staff API GET Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch staff members' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = getAuth();
    const db = getDb();
    const body = await req.json();
    const { restaurantId, name, email, password, phone, role, permissions, salary, status } = body;

    if (!restaurantId) {
      return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 });
    }
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!email || !email.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const cleanRole = role || 'helper';
    const cleanStatus = status || 'active';
    const cleanSalary = Number(salary) || 0;
    const cleanPermissions = Array.isArray(permissions) ? permissions : [];

    // 1. Create or fetch Firebase Auth user
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(cleanEmail);
      // If user exists, update password and displayName
      await auth.updateUser(userRecord.uid, {
        password: password,
        displayName: cleanName,
      });
    } catch (authErr: any) {
      if (authErr.code === 'auth/user-not-found') {
        userRecord = await auth.createUser({
          email: cleanEmail,
          password: password,
          displayName: cleanName,
        });
      } else {
        throw authErr;
      }
    }

    const uid = userRecord.uid;

    // 2. Set Custom User Claims
    try {
      await auth.setCustomUserClaims(uid, {
        role: 'staff',
        restaurantId,
        staffRole: cleanRole,
      });
    } catch (claimErr) {
      console.warn('[Staff API] Could not set custom claims:', claimErr);
    }

    const staffData = {
      id: uid,
      uid,
      name: cleanName,
      email: cleanEmail,
      phone: (phone || '').trim(),
      role: cleanRole,
      staffRole: cleanRole,
      permissions: cleanPermissions,
      salary: cleanSalary,
      status: cleanStatus,
      isStaff: true,
      restaurantId,
      updatedAt: FieldValue.serverTimestamp(),
    };

    // 3. Save to users collection (for global auth lookup & permissions)
    await db.collection('users').doc(uid).set({
      ...staffData,
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    // 4. Save to restaurant subcollection
    await db.collection('restaurants').doc(restaurantId).collection('staff').doc(uid).set({
      ...staffData,
      joinedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return NextResponse.json({
      success: true,
      staffId: uid,
      email: cleanEmail,
      name: cleanName,
      role: cleanRole,
      permissions: cleanPermissions,
      loginUrl: '/restaurant/staff/dashboard/login',
      fullLoginUrl: 'https://shunger.vercel.app/restaurant/staff/dashboard/login',
    });
  } catch (error: any) {
    console.error('[Staff API POST Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create staff member' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = getAuth();
    const db = getDb();
    const body = await req.json();
    const { restaurantId, staffId, name, phone, role, permissions, salary, status, password } = body;

    if (!restaurantId || !staffId) {
      return NextResponse.json({ error: 'restaurantId and staffId are required' }, { status: 400 });
    }

    // Update password if provided
    if (password && password.length >= 6) {
      try {
        await auth.updateUser(staffId, { password });
      } catch (authErr: any) {
        console.error('[Staff API] Failed to update auth password:', authErr);
      }
    }

    const updateData: any = {
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (name) updateData.name = name.trim();
    if (phone !== undefined) updateData.phone = phone.trim();
    if (role) {
      updateData.role = role;
      updateData.staffRole = role;
    }
    if (permissions) updateData.permissions = permissions;
    if (salary !== undefined) updateData.salary = Number(salary);
    if (status) updateData.status = status;

    // Update restaurant subcollection
    await db.collection('restaurants').doc(restaurantId).collection('staff').doc(staffId).set(updateData, { merge: true });

    // Update users doc
    await db.collection('users').doc(staffId).set(updateData, { merge: true });

    return NextResponse.json({ success: true, staffId });
  } catch (error: any) {
    console.error('[Staff API PUT Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update staff member' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = getAuth();
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const restaurantId = searchParams.get('restaurantId');
    const staffId = searchParams.get('staffId');

    if (!restaurantId || !staffId) {
      return NextResponse.json({ error: 'restaurantId and staffId are required' }, { status: 400 });
    }

    // Remove from restaurant subcollection
    await db.collection('restaurants').doc(restaurantId).collection('staff').doc(staffId).delete();

    // Mark as inactive in users collection (or delete)
    await db.collection('users').doc(staffId).set({
      status: 'inactive',
      isStaff: false,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    // Optionally disable auth account
    try {
      await auth.updateUser(staffId, { disabled: true });
    } catch (authErr) {
      console.warn('[Staff API] Could not disable auth user:', authErr);
    }

    return NextResponse.json({ success: true, staffId });
  } catch (error: any) {
    console.error('[Staff API DELETE Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete staff member' },
      { status: 500 }
    );
  }
}
