import { NextResponse } from 'next/server';
import { admin, messaging } from '@/lib/firebase-admin';

export async function POST(request: Request) {
    try {
        const { orderId, status } = await request.json();

        if (!orderId || !status) {
            return NextResponse.json({ error: 'Order ID and status are required' }, { status: 400 });
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
        const customerId = orderData?.customerId;

        if (!customerId) {
            return NextResponse.json({ error: 'Customer ID not found on order' }, { status: 404 });
        }

        // 2. Fetch the Customer to get FCM Token
        const customerSnap = await admin.firestore().collection('users').doc(customerId).get();
        // Also try 'customers' collection just in case, logic in hooks uses 'users' but let's be safe if profiles differ
        let customerData = customerSnap.data();

        if (!customerData || !customerData.fcmToken) {
            // Fallback or retry logic if needed, but for now just check users
            console.log(`No FCM token found for customer ${customerId}`);
            return NextResponse.json({ message: 'No FCM token for customer', success: false });
        }

        const fcmToken = customerData.fcmToken;

        // 3. Format Status Message
        const statusMessages: Record<string, string> = {
            'confirmed': 'being prepared',
            'preparing': 'being prepared',
            'ready': 'ready for pickup/delivery',
            'out_for_delivery': 'out for delivery',
            'delivered': 'delivered',
            'cancelled': 'cancelled',
        };

        const friendlyStatus = statusMessages[status] || status.replace('_', ' ');

        // 4. Send Notification
        const message = {
            notification: {
                title: 'Order Update 🍽️',
                body: `Your order is ${friendlyStatus}!`,
            },
            data: {
                orderId: orderId,
                type: 'order_status',
                status: status
            },
            token: fcmToken,
        };

        await messaging.send(message);

        return NextResponse.json({ success: true, message: 'Notification sent' });
    } catch (error: any) {
        console.error('Error sending order status notification:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
