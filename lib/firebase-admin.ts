import "server-only";
import admin from "firebase-admin";

interface FirebaseAdminConfig {
    projectId: string;
    clientEmail: string;
    privateKey: string;
}

function formatPrivateKey(key?: string) {
    if (!key) return "";
    let cleaned = key.trim();
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
        cleaned = cleaned.slice(1, -1);
    }
    return cleaned.replace(/\\n/g, "\n");
}

export function createFirebaseAdminApp(params: FirebaseAdminConfig) {
    const privateKey = formatPrivateKey(params.privateKey);

    if (admin.apps.length > 0) {
        return admin.app();
    }

    const cert = admin.credential.cert({
        projectId: params.projectId || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'akr-hunger',
        clientEmail: params.clientEmail || process.env.FIREBASE_CLIENT_EMAIL || 'firebase-adminsdk-fbsvc@akr-hunger.iam.gserviceaccount.com',
        privateKey,
    });

    return admin.initializeApp({
        credential: cert,
        projectId: params.projectId || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'akr-hunger',
        databaseURL: process.env.FIREBASE_DATABASE_URL || process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || 'https://akr-hunger-default-rtdb.firebaseio.com',
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
}

export async function initAdmin() {
    const params = {
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID as string,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL as string,
        privateKey: process.env.FIREBASE_PRIVATE_KEY as string,
    };

    return createFirebaseAdminApp(params);
}

// Ensure we have a singleton or re-use existing app
let app: admin.app.App | undefined = undefined;

if (!admin.apps.length) {
    // We check for values to avoid errors during build time if env vars are missing
    if (process.env.FIREBASE_PRIVATE_KEY) {
        try {
            app = admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'akr-hunger',
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || 'firebase-adminsdk-fbsvc@akr-hunger.iam.gserviceaccount.com',
                    privateKey: formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY),
                }),
                databaseURL: process.env.FIREBASE_DATABASE_URL || process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || 'https://akr-hunger-default-rtdb.firebaseio.com',
            });
        } catch (initErr) {
            console.error('[Firebase Admin Init Error]:', initErr);
        }
    }
} else {
    app = admin.app();
}

export const adminApp = app;
export const adminDb = app ? admin.firestore(app) : (admin.apps.length > 0 ? admin.firestore() : null as any);
export const adminAuth = app ? admin.auth(app) : (admin.apps.length > 0 ? admin.auth() : null as any);
export const adminRealtimeDb = app ? admin.database(app) : (admin.apps.length > 0 ? admin.database() : null as any);
export const messaging = app ? admin.messaging(app) : null;
export { admin };
