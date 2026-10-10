import { sendEmail, DEFAULT_ADMIN_EMAIL } from './resend';
import {
  templateWelcomeEmail,
  templateOrderConfirmationEmail,
  templateNewOrderRestaurantEmail,
  templateDeliveryAssignedEmail,
  templatePaymentVerifiedEmail,
  templateNewRestaurantAdminNotificationEmail,
} from './templates';

/**
 * High-level email dispatch functions for Hunger food delivery platform.
 */

// 1. WELCOME EMAIL
export async function sendWelcomeEmail(params: {
  email: string;
  name: string;
  role?: 'customer' | 'restaurant' | 'delivery' | string;
  portalUrl?: string;
}) {
  try {
    const { subject, html, text } = templateWelcomeEmail(params);
    return await sendEmail({
      to: params.email,
      subject,
      html,
      text,
    });
  } catch (error: any) {
    console.error('[EmailService] Error in sendWelcomeEmail:', error);
    return { success: false, error: error.message };
  }
}

// 2. ORDER CONFIRMATION TO CUSTOMER
export async function sendOrderConfirmationEmail(params: {
  orderId: string;
  customerEmail: string;
  customerName: string;
  restaurantName: string;
  items: Array<{ name: string; quantity: number; price: number; selectedOption?: string }>;
  total: number;
  subtotal?: number;
  deliveryCharge?: number;
  taxes?: number;
  discountAmount?: number;
  paymentMethod: string;
  deliveryAddress?: any;
  trackingUrl?: string;
}) {
  try {
    const { subject, html, text } = templateOrderConfirmationEmail(params);
    return await sendEmail({
      to: params.customerEmail,
      subject,
      html,
      text,
    });
  } catch (error: any) {
    console.error('[EmailService] Error in sendOrderConfirmationEmail:', error);
    return { success: false, error: error.message };
  }
}

// 3. NEW ORDER NOTIFICATION TO RESTAURANT
export async function sendNewOrderRestaurantEmail(params: {
  orderId: string;
  restaurantEmail: string;
  restaurantName: string;
  items: Array<{ name: string; quantity: number; price: number; selectedOption?: string }>;
  total: number;
  customerName?: string;
  specialInstructions?: string;
  ordersUrl?: string;
}) {
  try {
    const { subject, html, text } = templateNewOrderRestaurantEmail(params);
    return await sendEmail({
      to: params.restaurantEmail,
      subject,
      html,
      text,
    });
  } catch (error: any) {
    console.error('[EmailService] Error in sendNewOrderRestaurantEmail:', error);
    return { success: false, error: error.message };
  }
}

// 4. DELIVERY PARTNER ASSIGNED TO CUSTOMER
export async function sendDeliveryPartnerAssignedEmail(params: {
  orderId: string;
  customerEmail: string;
  customerName: string;
  deliveryPersonName: string;
  deliveryPersonPhone?: string;
  deliveryVehicle?: string;
  restaurantName?: string;
  deliveryOtp?: string;
  trackingUrl?: string;
}) {
  try {
    const { subject, html, text } = templateDeliveryAssignedEmail(params);
    return await sendEmail({
      to: params.customerEmail,
      subject,
      html,
      text,
    });
  } catch (error: any) {
    console.error('[EmailService] Error in sendDeliveryPartnerAssignedEmail:', error);
    return { success: false, error: error.message };
  }
}

// 5. PAYMENT VERIFIED / RECEIPT
export async function sendPaymentVerifiedEmail(params: {
  orderId: string;
  customerEmail: string;
  customerName: string;
  amount: number;
  paymentMethod: string;
  paymentId?: string;
  status?: 'completed' | 'failed' | string;
  date?: string;
  receiptUrl?: string;
}) {
  try {
    const { subject, html, text } = templatePaymentVerifiedEmail(params);
    return await sendEmail({
      to: params.customerEmail,
      subject,
      html,
      text,
    });
  } catch (error: any) {
    console.error('[EmailService] Error in sendPaymentVerifiedEmail:', error);
    return { success: false, error: error.message };
  }
}

// 6. NEW RESTAURANT REGISTRATION NOTIFICATION TO ADMIN
export async function sendNewRestaurantAdminNotificationEmail(params: {
  restaurantName: string;
  ownerName: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
  state?: string;
  cuisines?: string[];
  fssaiNumber?: string;
  fssaiDocument?: string;
  gstNumber?: string;
  adminEmail?: string;
  adminUrl?: string;
}) {
  try {
    const targetAdminEmail = params.adminEmail || DEFAULT_ADMIN_EMAIL;
    const { subject, html, text } = templateNewRestaurantAdminNotificationEmail(params);
    return await sendEmail({
      to: targetAdminEmail,
      subject,
      html,
      text,
    });
  } catch (error: any) {
    console.error('[EmailService] Error in sendNewRestaurantAdminNotificationEmail:', error);
    return { success: false, error: error.message };
  }
}
