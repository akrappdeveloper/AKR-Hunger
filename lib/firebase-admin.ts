import "server-only";
import admin from "firebase-admin";

interface FirebaseAdminConfig {
    projectId: string;
    clientEmail: string;
    privateKey: string;
}

function formatPrivateKey(key: string) {
    return key.replace(/\\n/g, "\n");
}

export function createFirebaseAdminApp(params: FirebaseAdminConfig) {
    const privateKey = formatPrivateKey(params.privateKey);

    if (admin.apps.length > 0) {
        return admin.app();
    }

    const cert = admin.credential.cert({
        projectId: params.projectId,
        clientEmail: params.clientEmail,
        privateKey,
    });

    return admin.initializeApp({
        credential: cert,
        projectId: params.projectId,
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
        app = admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            }),
        });
    }
} else {
    app = admin.app();
}

export const adminApp = app;
export const adminDb = app ? admin.firestore(app) : (admin.apps.length > 0 ? admin.firestore() : null as any);
export const messaging = app ? admin.messaging(app) : null;
export { admin };
