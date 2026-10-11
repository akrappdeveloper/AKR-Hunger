import { NextResponse } from 'next/server';
import { admin, messaging } from '@/lib/firebase-admin';

export async function POST(request: Request) {
    try {
        const { orderId, partnerIds } = await request.json();

        if (!orderId || !partnerIds || !Array.isArray(partnerIds) || partnerIds.length === 0) {
            return NextResponse.json({ error: 'Order ID and partner IDs array are required' }, { status: 400 });
        }

        if (!admin || !messaging) {
            return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 });
        }

        const tokens: string[] = [];

        // Fetch tokens for all partners
        // Optimization: Could use Promise.all but handle failures
        for (const partnerId of partnerIds) {
            const docSnap = await admin.firestore().collection('deliveryPersons').doc(partnerId).get();
            // Fallback to checking users collection if deliveryPersons don't store token directly (depending on auth structure)
            // Usually delivered partners are in 'deliveryPersons' collection? Or 'users'?
            // Let's assume 'deliveryPersons' or 'users'.

            // Detailed check:
            // If delivery persons login via same mechanism, maybe they are in 'users' or 'deliveryPersons'.
            // Assuming they utilize the same useFcmToken hook, it writes to 'users' if user exists, else 'restaurants'.
            // Delivery partners might be in 'users' or a separate 'deliveryPersons' collection.

            let token = docSnap.data()?.fcmToken;
            if (token) {
                tokens.push(token);
            } else {
                // Try 'users' collection if not found in deliveryPersons (if IDs are shared UIDs)
                const userSnap = await admin.firestore().collection('users').doc(partnerId).get();
                token = userSnap.data()?.fcmToken;
                if (token) tokens.push(token);
            }
        }

        if (tokens.length === 0) {
            return NextResponse.json({ message: 'No valid tokens found for partners', success: false });
        }

        // Send Multicast with Web Push configuration (Chrome, Safari, Edge, Android/iOS)
        const actionUrl = '/delivery/available';
        const notifTitle = 'New Delivery Request! 🛵';
        const notifBody = `New order #${orderId.slice(0, 6).toUpperCase()} is ready for pickup! Tap to accept.`;

        const message = {
            notification: {
                title: notifTitle,
                body: notifBody,
            },
            webpush: {
                headers: {
                    Urgency: 'high',
                    TTL: '3600',
                },
                notification: {
                    title: notifTitle,
                    body: notifBody,
                    icon: '/hunger.png',
                    badge: '/icon-light-32x32.png',
                    vibrate: [300, 150, 300, 150, 300],
                    requireInteraction: true,
                    tag: `delivery-${orderId}`,
                    actions: [
                        { action: 'open', title: 'View Request' }
                    ]
                },
                fcmOptions: {
                    link: actionUrl,
                }
            },
            data: {
                orderId: orderId,
                type: 'delivery_request',
                actionUrl: actionUrl,
                click_action: actionUrl,
            },
            tokens: tokens,
        };

        const response = await messaging.sendEachForMulticast(message);

        console.log(`${response.successCount} messages were sent successfully`);

        return NextResponse.json({ success: true, successCount: response.successCount, failureCount: response.failureCount });
    } catch (error: any) {
        console.error('Error sending delivery notifications:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
