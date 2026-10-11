import { NextResponse } from 'next/server';
import { messaging } from '@/lib/firebase-admin';

export async function POST(request: Request) {
    try {
        const { token, title, body, data } = await request.json();

        if (!token) {
            return NextResponse.json({ error: 'FCM token is required' }, { status: 400 });
        }

        if (!messaging) {
            return NextResponse.json({ error: 'Firebase Cloud Messaging is not initialized. Check server logs for config errors.' }, { status: 500 });
        }

        const actionUrl = data?.actionUrl || data?.url || '/';
        const notifTitle = title || 'Test Notification 🔔';
        const notifBody = body || 'This is a test notification from the server';

        const message = {
            notification: {
                title: notifTitle,
                body: notifBody,
            },
            webpush: {
                headers: {
                    Urgency: 'high',
                    TTL: '86400',
                },
                notification: {
                    title: notifTitle,
                    body: notifBody,
                    icon: '/hunger.png',
                    badge: '/icon-light-32x32.png',
                    vibrate: [200, 100, 200],
                    requireInteraction: true,
                    actions: [
                        { action: 'open', title: 'Open Hunger' }
                    ]
                },
                fcmOptions: {
                    link: actionUrl,
                }
            },
            data: {
                ...(data || {}),
                actionUrl,
                click_action: actionUrl,
            },
            token: token,
        };

        const response = await messaging.send(message);

        return NextResponse.json({ success: true, messageId: response });
    } catch (error: any) {
        console.error('Error sending notification:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
