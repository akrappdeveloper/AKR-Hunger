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

        const shortId = orderId.slice(-6).toUpperCase();
        const restaurantName = orderData?.restaurantName || 'Restaurant';
        const deliveryOtp = orderData?.deliveryOtp;

        let notifTitle = 'Order Update 🍽️';
        let notifBody = `Your order #${shortId} status has been updated to ${status.replace(/_/g, ' ')}.`;

        switch (status) {
            case 'confirmed':
                notifTitle = 'Order Confirmed! 👨‍🍳';
                notifBody = `${restaurantName} confirmed your order #${shortId}. Cooking will begin shortly!`;
                break;
            case 'preparing':
                notifTitle = 'Kitchen is Preparing Food 🍳';
                notifBody = `Chef at ${restaurantName} is preparing your delicious meal for Order #${shortId}!`;
                break;
            case 'ready':
                notifTitle = 'Order Ready for Pickup 📦';
                notifBody = `Order #${shortId} is freshly packed and awaiting delivery partner pickup.`;
                break;
            case 'out_for_delivery':
                notifTitle = 'Out for Delivery! 🛵';
                notifBody = deliveryOtp
                    ? `Your order #${shortId} is on the way! Give Delivery OTP ${deliveryOtp} to the driver.`
                    : `Your order #${shortId} is on the way with your delivery partner!`;
                break;
            case 'delivered':
                notifTitle = 'Order Delivered! 🍽️';
                notifBody = `Order #${shortId} from ${restaurantName} was delivered. Enjoy your meal!`;
                break;
            case 'cancelled':
                notifTitle = 'Order Cancelled ❌';
                notifBody = `Your order #${shortId} has been cancelled.`;
                break;
        }

        // 2. Always persist notification in Firestore
        await admin.firestore().collection('notifications').add({
            userId: customerId,
            userType: 'customer',
            type: 'order',
            subType: `order-${status}`,
            title: notifTitle,
            message: notifBody,
            orderId: orderId,
            read: false,
            isRead: false,
            deleted: false,
            actionUrl: `/customer/orders/${orderId}`,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            metadata: {
                orderId,
                status,
                restaurantName,
                deliveryOtp,
            }
        });

        // 3. Try to send FCM push notification if token exists
        let fcmSent = false;
        try {
            const customerSnap = await admin.firestore().collection('users').doc(customerId).get();
            let customerData = customerSnap.data();
            const fcmToken = customerData?.fcmToken;

            if (fcmToken && messaging) {
                const message = {
                    notification: {
                        title: notifTitle,
                        body: notifBody,
                    },
                    data: {
                        orderId: orderId,
                        type: 'order_status',
                        status: status,
                        actionUrl: `/customer/orders/${orderId}`
                    },
                    token: fcmToken,
                };
                await messaging.send(message);
                fcmSent = true;
            }
        } catch (fcmError) {
            console.warn('[FCM] Push delivery failed (in-app notification saved successfully):', fcmError);
        }

        return NextResponse.json({ success: true, message: 'Notification created in Firestore', fcmSent });
    } catch (error: any) {
        console.error('Error sending order status notification:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
