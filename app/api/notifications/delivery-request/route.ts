import { NextResponse } from 'next/server';
import { admin, messaging } from '@/lib/firebase-admin';

export async function POST(request: Request) {
    try {
        const { orderId, partnerIds } = await request.json();

        let targetPartnerIds = partnerIds;
        if (!targetPartnerIds || !Array.isArray(targetPartnerIds) || targetPartnerIds.length === 0) {
            // Broadcast to all delivery persons if no specific partners specified
            const allDriversSnap = await admin.firestore().collection('deliveryPersons').get();
            targetPartnerIds = allDriversSnap.docs.map(d => d.id);
        }

        if (!orderId) {
            return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
        }

        if (!admin || !messaging) {
            return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 });
        }

        const tokens: string[] = [];

        // Fetch tokens for all target partners
        for (const partnerId of targetPartnerIds) {
            const docSnap = await admin.firestore().collection('deliveryPersons').doc(partnerId).get();
            let token = docSnap.data()?.fcmToken;
            if (token) {
                tokens.push(token);
            } else {
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
                title: notifTitle,
                body: notifBody,
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
