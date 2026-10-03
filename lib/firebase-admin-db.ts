// Firebase Admin DB singleton - wraps firebase-admin for Firestore access
// This is used only in server-side code (API routes, Server Actions)
import 'server-only';
import { initAdmin } from '@/lib/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize admin app
initAdmin();

export const adminDb = getFirestore();
