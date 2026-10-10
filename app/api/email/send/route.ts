import { NextRequest, NextResponse } from 'next/server';
import {
  sendWelcomeEmail,
  sendOrderConfirmationEmail,
  sendNewOrderRestaurantEmail,
  sendDeliveryPartnerAssignedEmail,
  sendPaymentVerifiedEmail,
  sendNewRestaurantAdminNotificationEmail,
} from '@/lib/email/service';
import { sendEmail, DEFAULT_FROM_EMAIL, DEFAULT_ADMIN_EMAIL } from '@/lib/email/resend';

export async function GET() {
  const hasKey = Boolean(process.env.RESEND_API_KEY);
  return NextResponse.json({
    status: 'ok',
    resendConfigured: hasKey,
    fromEmail: DEFAULT_FROM_EMAIL,
    adminEmail: DEFAULT_ADMIN_EMAIL,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, ...payload } = body;

    if (!type) {
      return NextResponse.json({ error: 'Missing "type" parameter in request body' }, { status: 400 });
    }

    let result;

    switch (type) {
      case 'welcome':
        result = await sendWelcomeEmail({
          email: payload.email,
          name: payload.name,
          role: payload.role || 'customer',
          portalUrl: payload.portalUrl,
        });
        break;

      case 'order_placed':
        result = await sendOrderConfirmationEmail({
          orderId: payload.orderId,
          customerEmail: payload.customerEmail,
          customerName: payload.customerName,
          restaurantName: payload.restaurantName,
          items: payload.items || [],
          total: Number(payload.total || 0),
          subtotal: payload.subtotal !== undefined ? Number(payload.subtotal) : undefined,
          deliveryCharge: payload.deliveryCharge !== undefined ? Number(payload.deliveryCharge) : undefined,
          taxes: payload.taxes !== undefined ? Number(payload.taxes) : undefined,
          discountAmount: payload.discountAmount !== undefined ? Number(payload.discountAmount) : undefined,
          paymentMethod: payload.paymentMethod || 'cod',
          deliveryAddress: payload.deliveryAddress,
          trackingUrl: payload.trackingUrl,
        });
        break;

      case 'new_order_restaurant':
        result = await sendNewOrderRestaurantEmail({
          orderId: payload.orderId,
          restaurantEmail: payload.restaurantEmail,
          restaurantName: payload.restaurantName,
          items: payload.items || [],
          total: Number(payload.total || 0),
          customerName: payload.customerName,
          specialInstructions: payload.specialInstructions,
          ordersUrl: payload.ordersUrl,
        });
        break;

      case 'delivery_assigned':
        result = await sendDeliveryPartnerAssignedEmail({
          orderId: payload.orderId,
          customerEmail: payload.customerEmail,
          customerName: payload.customerName,
          deliveryPersonName: payload.deliveryPersonName,
          deliveryPersonPhone: payload.deliveryPersonPhone,
          deliveryVehicle: payload.deliveryVehicle,
          restaurantName: payload.restaurantName,
          deliveryOtp: payload.deliveryOtp,
          trackingUrl: payload.trackingUrl,
        });
        break;

      case 'payment_verified':
        result = await sendPaymentVerifiedEmail({
          orderId: payload.orderId,
          customerEmail: payload.customerEmail,
          customerName: payload.customerName,
          amount: Number(payload.amount || 0),
          paymentMethod: payload.paymentMethod || 'online',
          paymentId: payload.paymentId,
          status: payload.status || 'completed',
          date: payload.date,
          receiptUrl: payload.receiptUrl,
        });
        break;

      case 'restaurant_registration_admin':
        result = await sendNewRestaurantAdminNotificationEmail({
          restaurantName: payload.restaurantName,
          ownerName: payload.ownerName,
          email: payload.email,
          phone: payload.phone,
          address: payload.address,
          city: payload.city,
          state: payload.state,
          cuisines: payload.cuisines,
          fssaiNumber: payload.fssaiNumber,
          fssaiDocument: payload.fssaiDocument,
          gstNumber: payload.gstNumber,
          adminEmail: payload.adminEmail,
          adminUrl: payload.adminUrl,
        });
        break;

      case 'test':
        result = await sendEmail({
          to: payload.to || 'delivered@resend.dev',
          subject: '🧪 Resend Email API Integration Test - Hunger Food Delivery',
          html: `<div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
            <h2 style="color: #ea580c;">Resend Email API Connected! 🚀</h2>
            <p>This is a test notification confirming that the Resend API integration is operational for the Hunger platform.</p>
            <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          </div>`,
          text: 'Resend API integration is fully operational for Hunger platform.',
        });
        break;

      default:
        return NextResponse.json({ error: `Unknown email type: "${type}"` }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[API /api/email/send] Unhandled error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
