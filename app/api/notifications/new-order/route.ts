import { NextResponse } from 'next/server';
import { admin, messaging } from '@/lib/firebase-admin';
import { sendNewOrderRestaurantEmail } from '@/lib/email/service';

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

        // 2. Always persist notification in Firestore for the restaurant
        const shortCode = orderId.slice(-6).toUpperCase();
        const totalAmount = orderData?.total || 0;
        const notifTitle = 'New Order Received! 🔔';
        const notifBody = `Order #${shortCode} placed for ₹${totalAmount}. Tap to view items & start preparing.`;

        await admin.firestore().collection('notifications').add({
            userId: restaurantId,
            restaurantId: restaurantId,
            userType: 'restaurant',
            type: 'order',
            subType: 'new_order',
            title: notifTitle,
            message: notifBody,
            orderId: orderId,
            isRead: false,
            read: false,
            actionLink: `/restaurant/orders/${orderId}`,
            createdAt: new Date().toISOString(),
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        // 3. Fetch the Restaurant to get FCM Token & Email
        let fcmSent = false;
        let emailSent = false;
        try {
            const restaurantSnap = await admin.firestore().collection('restaurants').doc(restaurantId).get();
            const restaurantData = restaurantSnap.data();
            const fcmToken = restaurantData?.fcmToken;
            const restaurantEmail = restaurantData?.email;

            // Send FCM Push Notification with Web Push configuration (Chrome, Safari, Edge, etc.)
            if (fcmToken && messaging) {
                const actionUrl = `/restaurant/orders/${orderId}`;
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
                            vibrate: [200, 100, 200, 100, 200],
                            requireInteraction: true,
                            tag: `order-${orderId}`,
                            actions: [
                                { action: 'open', title: 'Open Kitchen' }
                            ]
                        },
                        fcmOptions: {
                            link: actionUrl,
                        }
                    },
                    data: {
                        orderId: orderId,
                        type: 'new_order',
                        actionUrl: actionUrl,
                        click_action: actionUrl,
                    },
                    token: fcmToken,
                };
                await messaging.send(message);
                fcmSent = true;
            }

            // Send Restaurant Order Notification Email via Resend
            if (restaurantEmail) {
                const emailResult = await sendNewOrderRestaurantEmail({
                    orderId,
                    restaurantEmail,
                    restaurantName: restaurantData?.name || orderData?.restaurantName || 'Restaurant Kitchen',
                    items: orderData?.items || [],
                    total: totalAmount,
                    customerName: orderData?.customerName,
                    specialInstructions: orderData?.specialInstructions,
                });
                emailSent = emailResult.success;
            }
        } catch (fcmErr) {
            console.warn('Notification delivery notice for restaurant:', fcmErr);
        }

        return NextResponse.json({
            success: true,
            message: 'Notification created in Firestore',
            fcmSent,
            emailSent
        });
    } catch (error: any) {
        console.error('Error creating new order notification:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
