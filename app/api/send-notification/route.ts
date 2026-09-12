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

        const message = {
            notification: {
                title: title || 'Test Notification',
                body: body || 'This is a test notification from the server',
            },
            data: data || {},
            token: token,
        };

        const response = await messaging.send(message);

        return NextResponse.json({ success: true, messageId: response });
    } catch (error: any) {
        console.error('Error sending notification:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
