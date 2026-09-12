import { NextResponse } from 'next/server';
import { admin, messaging } from '@/lib/firebase-admin';

export async function POST(request: Request) {
    try {
        const { orderId } = await request.json();

        if (!orderId) {
            return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
        }

        if (!admin || !messaging) {
            return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 });
        }

        // 1. Fetch the Order
        const orderSnap = await admin.firestore().collection('orders').doc(orderId).get();
        if (!orderSnap.exists) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }
        const orderData = orderSnap.data();
        const restaurantId = orderData?.restaurantId;

        if (!restaurantId) {
            return NextResponse.json({ error: 'Restaurant ID not found on order' }, { status: 404 });
        }

        // 2. Fetch the Restaurant to get FCM Token
        const restaurantSnap = await admin.firestore().collection('restaurants').doc(restaurantId).get();
        const restaurantData = restaurantSnap.data();
        const fcmToken = restaurantData?.fcmToken;

        if (!fcmToken) {
            console.log(`No FCM token found for restaurant ${restaurantId}`);
            return NextResponse.json({ message: 'No FCM token for restaurant', success: false });
        }

        // 3. Send Notification
        const message = {
            notification: {
                title: 'New Order Received! 🔔',
                body: `Order #${orderId.slice(0, 6).toUpperCase()} for ₹${orderData?.total}`,
            },
            data: {
                orderId: orderId,
                type: 'new_order'
            },
            token: fcmToken,
        };

        await messaging.send(message);

        return NextResponse.json({ success: true, message: 'Notification sent' });
    } catch (error: any) {
        console.error('Error sending new order notification:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
