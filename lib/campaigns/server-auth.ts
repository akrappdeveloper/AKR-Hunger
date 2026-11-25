import 'server-only';
import { NextRequest } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { adminApp } from '@/lib/firebase-admin';
import { adminDb } from '@/lib/firebase-admin-db';

export interface VerifiedActor {
  uid: string;
  email?: string;
  claims: Record<string, any>;
}

export async function verifyBearerAuth(request: NextRequest): Promise<VerifiedActor | null> {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return null;

  try {
    const authInstance = adminApp ? getAuth(adminApp) : getAuth();
    const decoded = await authInstance.verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: decoded.email,
      claims: decoded as Record<string, any>,
    };
  } catch (err) {
    console.warn('[ServerAuth] Token verification failed:', (err as any)?.message);
    return null;
  }
}

export async function resolveAuthorizedRestaurant(
  actor: VerifiedActor,
  requestedRestaurantId?: string
): Promise<{
  authorized: boolean;
  restaurantId: string;
  restaurantData: Record<string, any> | null;
  reason?: string;
}> {
  if (!adminDb) {
    return { authorized: false, restaurantId: '', restaurantData: null, reason: 'Server DB unavailable' };
  }

  // Determine candidate restaurantId (direct owner uid, staff linkage, or explicit param)
  let resolvedRestaurantId = actor.uid;

  const userSnap = await adminDb.collection('users').doc(actor.uid).get();
  const userData = userSnap.exists ? userSnap.data() : null;

  const isStaff =
    userData?.isStaff === true ||
    userData?.role === 'staff' ||
    actor.claims?.isStaff === true ||
    actor.claims?.role === 'staff';

  if (isStaff) {
    const linkedId = userData?.restaurantId || actor.claims?.restaurantId;
    if (!linkedId) {
      return { authorized: false, restaurantId: '', restaurantData: null, reason: 'Staff account not linked to restaurant' };
    }
    const role = userData?.staffRole || actor.claims?.staffRole || 'helper';
    const perms: string[] = Array.isArray(userData?.permissions) ? userData.permissions : [];
    const allowed = role === 'manager' || perms.includes('campaigns');
    if (!allowed) {
      return { authorized: false, restaurantId: '', restaurantData: null, reason: 'Staff lacks campaigns permission' };
    }
    resolvedRestaurantId = linkedId;
  } else if (userData?.restaurantId) {
    resolvedRestaurantId = userData.restaurantId;
  }

  if (requestedRestaurantId && requestedRestaurantId !== resolvedRestaurantId) {
    // Allow if the restaurant doc has ownerId === actor.uid
    const reqRestSnap = await adminDb.collection('restaurants').doc(requestedRestaurantId).get();
    if (reqRestSnap.exists && reqRestSnap.data()?.ownerId === actor.uid) {
      resolvedRestaurantId = requestedRestaurantId;
    } else {
      return { authorized: false, restaurantId: '', restaurantData: null, reason: 'Forbidden restaurant access' };
    }
  }

  const restSnap = await adminDb.collection('restaurants').doc(resolvedRestaurantId).get();
  if (!restSnap.exists) {
    return { authorized: false, restaurantId: resolvedRestaurantId, restaurantData: null, reason: 'Restaurant account not found' };
  }

  return {
    authorized: true,
    restaurantId: resolvedRestaurantId,
    restaurantData: { id: restSnap.id, ...restSnap.data() },
  };
}

export async function verifyAdminActor(
  actor: VerifiedActor,
  allowedRoles: string[] = ['super_admin', 'operations_admin', 'content_manager', 'finance_admin']
): Promise<{
  isAdmin: boolean;
  role?: string;
  adminData?: Record<string, any>;
}> {
  if (!adminDb) return { isAdmin: false };
  const adminSnap = await adminDb.collection('admins').doc(actor.uid).get();
  if (!adminSnap.exists) return { isAdmin: false };
  const data = adminSnap.data() || {};
  const role = String(data.role || '');
  if (role === 'super_admin' || allowedRoles.includes(role)) {
    return { isAdmin: true, role, adminData: data };
  }
  return { isAdmin: false };
}
