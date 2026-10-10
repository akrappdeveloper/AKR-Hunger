/**
 * Premium, responsive HTML email templates for Hunger Food Delivery.
 * Styled with inline CSS to ensure flawless rendering across Gmail, Outlook, Apple Mail, and mobile clients.
 */

const BASE_STYLES = `
  body, table, td, p, a, li, blockquote {
    -webkit-text-size-adjust: 100%;
    -ms-text-size-adjust: 100%;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  }
  body {
    margin: 0;
    padding: 0;
    width: 100% !important;
    height: 100% !important;
    background-color: #0f1117;
    color: #e2e8f0;
  }
  table {
    border-collapse: collapse !important;
  }
`;

function wrapEmailBody(content: string, previewText: string = ''): string {
  const currentYear = new Date().getFullYear();
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Hunger Food Delivery</title>
  <style type="text/css">
    ${BASE_STYLES}
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #0f1117; color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
  ${previewText ? `<div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all;">${previewText}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : ''}
  
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0f1117; min-height: 100vh;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background: #161a23; border: 1px solid #272d3b; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 40px -15px rgba(0,0,0,0.7);">
          
          <!-- BRAND HEADER -->
          <tr>
            <td style="background: linear-gradient(135deg, #ea580c 0%, #f97316 50%, #fb923c 100%); padding: 32px 32px 28px 32px; text-align: center;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; background: #ffffff; color: #ea580c; font-weight: 900; font-size: 22px; padding: 10px 22px; border-radius: 999px; letter-spacing: 0.5px; box-shadow: 0 4px 14px rgba(0,0,0,0.25);">
                      🍔 HUNGER
                    </div>
                    <div style="margin-top: 10px; color: #ffedd5; font-size: 13px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;">
                      Fast • Fresh • Delivered Hot
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- MAIN CONTENT -->
          <tr>
            <td style="padding: 36px 32px 28px 32px; background-color: #161a23;">
              ${content}
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color: #10131a; padding: 28px 32px; border-top: 1px solid #232936; text-align: center; color: #94a3b8; font-size: 12px; line-height: 1.6;">
              <p style="margin: 0 0 10px 0; color: #cbd5e1; font-weight: 600;">Hunger Food Delivery Platform</p>
              <p style="margin: 0 0 12px 0;">Craving something delicious? We connect hungry foodies with the best kitchens across the city.</p>
              <div style="padding-top: 8px; border-top: 1px solid #1e2430; font-size: 11px; color: #64748b;">
                © ${currentYear} Hunger. All rights reserved. • This is an automated transactional message.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * 1. USER REGISTRATION - WELCOME EMAIL
 */
export function templateWelcomeEmail(params: {
  name: string;
  email: string;
  role?: 'customer' | 'restaurant' | 'delivery' | string;
  portalUrl?: string;
}): { html: string; text: string; subject: string } {
  const roleName = params.role === 'restaurant'
    ? 'Restaurant Partner'
    : params.role === 'delivery'
    ? 'Delivery Partner'
    : 'Foodie';

  const actionText = params.role === 'restaurant'
    ? 'Open Restaurant Portal'
    : params.role === 'delivery'
    ? 'Go to Delivery Dashboard'
    : 'Start Ordering Food';

  const defaultUrl = params.portalUrl || (
    params.role === 'restaurant'
      ? 'https://akrhunger.com/restaurant'
      : params.role === 'delivery'
      ? 'https://akrhunger.com/delivery'
      : 'https://akrhunger.com/customer'
  );

  const subject = `Welcome to Hunger, ${params.name || 'Friend'}! 🎉 Your Journey Starts Here`;

  const content = `
    <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 800; color: #ffffff; line-height: 1.3;">
      Welcome to the Family, ${params.name || 'Food Lover'}! 👋
    </h1>
    <p style="margin: 0 0 24px 0; font-size: 15px; color: #cbd5e1; line-height: 1.6;">
      Thank you for signing up as a <strong style="color: #f97316;">${roleName}</strong> on Hunger! We're thrilled to have you onboard. Your registered email is <span style="color: #ffffff; font-weight: 600;">${params.email}</span>.
    </p>

    <div style="background-color: #1e2433; border: 1px solid #2e3748; border-radius: 16px; padding: 22px; margin-bottom: 28px;">
      <h3 style="margin: 0 0 12px 0; font-size: 15px; font-weight: 700; color: #fb923c; text-transform: uppercase; letter-spacing: 0.5px;">
        ✨ What you can do next:
      </h3>
      <ul style="margin: 0; padding-left: 20px; color: #e2e8f0; font-size: 14px; line-height: 1.8;">
        ${params.role === 'restaurant' ? `
          <li>Set up your digital menu with mouth-watering photos & special prices</li>
          <li>Set kitchen operating hours and delivery service pincodes</li>
          <li>Receive incoming real-time orders and scale your culinary business</li>
        ` : params.role === 'delivery' ? `
          <li>Complete your vehicle & license KYC in your profile</li>
          <li>Toggle your status Online to start getting nearby order dispatches</li>
          <li>Earn fast daily payouts, bonuses, and 100% of customer tips</li>
        ` : `
          <li>Browse hundreds of top-rated local cafes and popular restaurants</li>
          <li>Enjoy fast 30-minute hot delivery with live GPS order tracking</li>
          <li>Use your Hunger Wallet and earn reward points on every order</li>
        `}
      </ul>
    </div>

    <div style="text-align: center; margin: 32px 0 24px 0;">
      <a href="${defaultUrl}" style="display: inline-block; background: linear-gradient(135deg, #ea580c 0%, #f97316 100%); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 15px; padding: 14px 34px; border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(234, 88, 12, 0.5); letter-spacing: 0.3px;">
        ${actionText} →
      </a>
    </div>

    <p style="margin: 24px 0 0 0; font-size: 13px; color: #94a3b8; text-align: center; line-height: 1.5;">
      Need any assistance? Our friendly support team is here 24/7 to help you.
    </p>
  `;

  const text = `Welcome to Hunger, ${params.name || 'Friend'}!\n\nThank you for signing up as a ${roleName}. Your registered email is ${params.email}.\n\nAccess your account: ${defaultUrl}`;

  return {
    subject,
    html: wrapEmailBody(content, `Welcome to Hunger! Your journey starts here.`),
    text,
  };
}

/**
 * 2. ORDER PLACED - CUSTOMER CONFIRMATION
 */
export function templateOrderConfirmationEmail(params: {
  orderId: string;
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
}): { html: string; text: string; subject: string } {
  const shortId = params.orderId.slice(-6).toUpperCase();
  const subject = `Order Confirmed! #${shortId} from ${params.restaurantName} 🛍️`;

  const addressStr = typeof params.deliveryAddress === 'string'
    ? params.deliveryAddress
    : params.deliveryAddress
    ? `${params.deliveryAddress.street || params.deliveryAddress.address || ''}, ${params.deliveryAddress.city || ''} ${params.deliveryAddress.pincode || ''}`
    : 'Customer Delivery Address';

  const trackingLink = params.trackingUrl || `https://akrhunger.com/customer/orders/tracking/${params.orderId}`;

  const itemsHtml = (params.items || [])
    .map(
      (item) => `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #252b38; color: #f8fafc; font-size: 14px;">
          <div style="font-weight: 600;">${item.name}</div>
          ${item.selectedOption ? `<div style="font-size: 12px; color: #94a3b8;">${item.selectedOption}</div>` : ''}
        </td>
        <td align="center" style="padding: 12px 10px; border-bottom: 1px solid #252b38; color: #cbd5e1; font-size: 14px;">
          x${item.quantity}
        </td>
        <td align="right" style="padding: 12px 0; border-bottom: 1px solid #252b38; color: #f8fafc; font-weight: 600; font-size: 14px;">
          ₹${(item.price * item.quantity).toFixed(2)}
        </td>
      </tr>
    `
    )
    .join('');

  const paymentMethodLabel =
    params.paymentMethod === 'cod'
      ? 'Cash on Delivery (Pending at Doorstep)'
      : params.paymentMethod === 'wallet'
      ? 'Paid via Hunger Wallet'
      : 'Paid Online via Razorpay';

  const content = `
    <div style="text-align: center; margin-bottom: 24px;">
      <span style="display: inline-block; background-color: #064e3b; color: #34d399; font-size: 12px; font-weight: 700; padding: 6px 14px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.5px;">
        ✓ ORDER CONFIRMED
      </span>
      <h1 style="margin: 12px 0 6px 0; font-size: 24px; font-weight: 800; color: #ffffff;">
        We've got your order, ${params.customerName || 'Foodie'}!
      </h1>
      <p style="margin: 0; color: #94a3b8; font-size: 14px;">
        Order ID: <strong style="color: #fb923c;">#${params.orderId}</strong>
      </p>
    </div>

    <!-- RESTAURANT & DELIVERY CARD -->
    <div style="background-color: #1e2433; border: 1px solid #2e3748; border-radius: 16px; padding: 20px; margin-bottom: 24px;">
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
        <tr>
          <td style="padding-bottom: 12px;">
            <div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 0.5px;">Restaurant</div>
            <div style="font-size: 16px; font-weight: 700; color: #ffffff; margin-top: 2px;">${params.restaurantName}</div>
          </td>
        </tr>
        <tr>
          <td style="border-top: 1px solid #2b3345; padding-top: 12px;">
            <div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 0.5px;">Delivering To</div>
            <div style="font-size: 13px; color: #e2e8f0; margin-top: 2px; line-height: 1.4;">${addressStr}</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- ITEMS TABLE -->
    <div style="margin-bottom: 24px;">
      <h3 style="margin: 0 0 12px 0; font-size: 15px; font-weight: 700; color: #ffffff;">Order Summary</h3>
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
        <thead>
          <tr style="border-bottom: 2px solid #2d3545; color: #94a3b8; font-size: 12px; text-transform: uppercase;">
            <th align="left" style="padding-bottom: 8px;">Item</th>
            <th align="center" style="padding-bottom: 8px;">Qty</th>
            <th align="right" style="padding-bottom: 8px;">Price</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
    </div>

    <!-- BILLING SUMMARY -->
    <div style="background-color: #1a1f2c; border: 1px solid #272f40; border-radius: 14px; padding: 18px; margin-bottom: 28px;">
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 14px;">
        ${params.subtotal ? `
          <tr>
            <td style="padding: 4px 0; color: #94a3b8;">Item Subtotal</td>
            <td align="right" style="padding: 4px 0; color: #e2e8f0;">₹${params.subtotal.toFixed(2)}</td>
          </tr>
        ` : ''}
        ${params.deliveryCharge !== undefined ? `
          <tr>
            <td style="padding: 4px 0; color: #94a3b8;">Delivery Fee</td>
            <td align="right" style="padding: 4px 0; color: #e2e8f0;">₹${params.deliveryCharge.toFixed(2)}</td>
          </tr>
        ` : ''}
        ${params.taxes ? `
          <tr>
            <td style="padding: 4px 0; color: #94a3b8;">Taxes & Charges</td>
            <td align="right" style="padding: 4px 0; color: #e2e8f0;">₹${params.taxes.toFixed(2)}</td>
          </tr>
        ` : ''}
        ${params.discountAmount ? `
          <tr>
            <td style="padding: 4px 0; color: #34d399; font-weight: 600;">Promo Discount</td>
            <td align="right" style="padding: 4px 0; color: #34d399; font-weight: 600;">-₹${params.discountAmount.toFixed(2)}</td>
          </tr>
        ` : ''}
        <tr>
          <td style="padding: 12px 0 4px 0; border-top: 1px solid #2e3748; font-size: 16px; font-weight: 800; color: #ffffff;">Total Amount</td>
          <td align="right" style="padding: 12px 0 4px 0; border-top: 1px solid #2e3748; font-size: 18px; font-weight: 800; color: #f97316;">₹${params.total.toFixed(2)}</td>
        </tr>
      </table>
      <div style="margin-top: 12px; padding-top: 10px; border-top: 1px dashed #2b3447; font-size: 12px; color: #94a3b8;">
        Payment: <strong style="color: #cbd5e1;">${paymentMethodLabel}</strong>
      </div>
    </div>

    <!-- TRACK ORDER CTA -->
    <div style="text-align: center; margin: 32px 0 16px 0;">
      <a href="${trackingLink}" style="display: inline-block; background: linear-gradient(135deg, #ea580c 0%, #f97316 100%); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 15px; padding: 14px 34px; border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(234, 88, 12, 0.5);">
        Track Live Order Status →
      </a>
    </div>
  `;

  const text = `Order Confirmed! #${shortId} from ${params.restaurantName}\nTotal: ₹${params.total.toFixed(2)}\nPayment: ${paymentMethodLabel}\nTrack order: ${trackingLink}`;

  return {
    subject,
    html: wrapEmailBody(content, `Order Confirmed: #${shortId} from ${params.restaurantName}`),
    text,
  };
}

/**
 * 3. NEW ORDER - RESTAURANT NOTIFICATION
 */
export function templateNewOrderRestaurantEmail(params: {
  orderId: string;
  restaurantName: string;
  items: Array<{ name: string; quantity: number; price: number; selectedOption?: string }>;
  total: number;
  customerName?: string;
  specialInstructions?: string;
  ordersUrl?: string;
}): { html: string; text: string; subject: string } {
  const shortId = params.orderId.slice(-6).toUpperCase();
  const subject = `🚨 NEW ORDER RECEIVED: #${shortId} (₹${params.total.toFixed(2)})`;
  const portalLink = params.ordersUrl || `https://akrhunger.com/restaurant/orders`;

  const itemsHtml = (params.items || [])
    .map(
      (item) => `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #282f40; color: #ffffff; font-weight: 600; font-size: 15px;">
          ${item.name}
          ${item.selectedOption ? `<div style="font-size: 12px; color: #94a3b8; font-weight: 400;">${item.selectedOption}</div>` : ''}
        </td>
        <td align="right" style="padding: 10px 0; border-bottom: 1px solid #282f40; color: #fb923c; font-weight: 800; font-size: 16px;">
          x${item.quantity}
        </td>
      </tr>
    `
    )
    .join('');

  const content = `
    <div style="background-color: #451a03; border: 1px solid #78350f; border-radius: 14px; padding: 16px; margin-bottom: 22px; text-align: center;">
      <span style="color: #fb923c; font-weight: 800; font-size: 15px; letter-spacing: 0.5px; text-transform: uppercase;">
        🔔 NEW KITCHEN ORDER ALERT
      </span>
      <h2 style="margin: 8px 0 0 0; color: #ffffff; font-size: 22px; font-weight: 800;">
        Order #${params.orderId}
      </h2>
    </div>

    <p style="margin: 0 0 20px 0; font-size: 15px; color: #cbd5e1; line-height: 1.5;">
      Hello <strong style="color: #ffffff;">${params.restaurantName}</strong> Kitchen Team! A customer has just placed a new order. Please review the items below and start preparing.
    </p>

    <!-- CUSTOMER & ORDER INFO -->
    <div style="background-color: #1e2433; border: 1px solid #2e3748; border-radius: 14px; padding: 16px; margin-bottom: 20px;">
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 13px;">
        <tr>
          <td style="color: #94a3b8; padding-bottom: 6px;">Customer:</td>
          <td align="right" style="color: #ffffff; font-weight: 600; padding-bottom: 6px;">${params.customerName || 'Hunger Customer'}</td>
        </tr>
        <tr>
          <td style="color: #94a3b8;">Order Value:</td>
          <td align="right" style="color: #34d399; font-weight: 700; font-size: 15px;">₹${params.total.toFixed(2)}</td>
        </tr>
      </table>
      ${params.specialInstructions ? `
        <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid #2c3548;">
          <div style="font-size: 11px; text-transform: uppercase; color: #f59e0b; font-weight: 700;">Special Cooking Instructions:</div>
          <div style="color: #fef3c7; font-size: 13px; font-style: italic; margin-top: 2px;">"${params.specialInstructions}"</div>
        </div>
      ` : ''}
    </div>

    <!-- PREP ITEMS -->
    <div style="margin-bottom: 26px;">
      <h3 style="margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8;">
        Items to Prepare:
      </h3>
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
    </div>

    <!-- ACTION BUTTON -->
    <div style="text-align: center; margin: 30px 0 16px 0;">
      <a href="${portalLink}" style="display: inline-block; background: linear-gradient(135deg, #ea580c 0%, #f97316 100%); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 15px; padding: 14px 34px; border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(234, 88, 12, 0.5);">
        Open Kitchen Dashboard →
      </a>
    </div>
  `;

  const text = `New order alert for ${params.restaurantName}! #${shortId} placed for ₹${params.total.toFixed(2)}. Open dashboard: ${portalLink}`;

  return {
    subject,
    html: wrapEmailBody(content, `New order received: #${shortId}`),
    text,
  };
}

/**
 * 4. DELIVERY PARTNER ASSIGNED - CUSTOMER UPDATE
 */
export function templateDeliveryAssignedEmail(params: {
  orderId: string;
  customerName: string;
  deliveryPersonName: string;
  deliveryPersonPhone?: string;
  deliveryVehicle?: string;
  restaurantName?: string;
  deliveryOtp?: string;
  trackingUrl?: string;
}): { html: string; text: string; subject: string } {
  const shortId = params.orderId.slice(-6).toUpperCase();
  const subject = `Rider Assigned! ${params.deliveryPersonName} is on the way for Order #${shortId} 🛵`;
  const trackingLink = params.trackingUrl || `https://akrhunger.com/customer/orders/tracking/${params.orderId}`;

  const content = `
    <div style="text-align: center; margin-bottom: 24px;">
      <span style="display: inline-block; background-color: #1e3a8a; color: #60a5fa; font-size: 12px; font-weight: 700; padding: 6px 14px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.5px;">
        🛵 DELIVERY PARTNER EN ROUTE
      </span>
      <h1 style="margin: 12px 0 6px 0; font-size: 24px; font-weight: 800; color: #ffffff;">
        Your Driver is on the Move!
      </h1>
      <p style="margin: 0; color: #94a3b8; font-size: 14px;">
        Order #${params.orderId} from <strong style="color: #ffffff;">${params.restaurantName || 'Restaurant'}</strong>
      </p>
    </div>

    <!-- RIDER DETAILS CARD -->
    <div style="background-color: #1e2433; border: 1px solid #2e3748; border-radius: 16px; padding: 22px; margin-bottom: 24px;">
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
        <tr>
          <td>
            <div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 700;">Delivery Champion</div>
            <div style="font-size: 18px; font-weight: 800; color: #ffffff; margin-top: 2px;">
              ${params.deliveryPersonName}
            </div>
            ${params.deliveryVehicle ? `
              <div style="font-size: 13px; color: #cbd5e1; margin-top: 4px;">
                Vehicle: <strong>${params.deliveryVehicle}</strong>
              </div>
            ` : ''}
            ${params.deliveryPersonPhone ? `
              <div style="font-size: 13px; color: #fb923c; margin-top: 4px;">
                📞 Contact: <a href="tel:${params.deliveryPersonPhone}" style="color: #fb923c; text-decoration: none; font-weight: 600;">${params.deliveryPersonPhone}</a>
              </div>
            ` : ''}
          </td>
        </tr>
      </table>
    </div>

    ${params.deliveryOtp ? `
      <!-- DELIVERY OTP CARD -->
      <div style="background: linear-gradient(135deg, #7c2d12 0%, #9a3412 100%); border: 1px solid #ea580c; border-radius: 16px; padding: 20px; text-align: center; margin-bottom: 26px;">
        <div style="font-size: 12px; text-transform: uppercase; font-weight: 800; color: #fed7aa; letter-spacing: 1px;">
          🔒 SECRET DELIVERY OTP
        </div>
        <div style="font-size: 36px; font-weight: 900; color: #ffffff; letter-spacing: 8px; margin: 8px 0;">
          ${params.deliveryOtp}
        </div>
        <div style="font-size: 12px; color: #ffedd5;">
          Share this 4-digit code with the rider when they arrive at your door to verify delivery.
        </div>
      </div>
    ` : ''}

    <!-- LIVE TRACKING CTA -->
    <div style="text-align: center; margin: 30px 0 16px 0;">
      <a href="${trackingLink}" style="display: inline-block; background: linear-gradient(135deg, #ea580c 0%, #f97316 100%); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 15px; padding: 14px 34px; border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(234, 88, 12, 0.5);">
        Track Driver on Live Map →
      </a>
    </div>
  `;

  const text = `Rider Assigned! ${params.deliveryPersonName} is delivering Order #${shortId}.\nDelivery OTP: ${params.deliveryOtp || 'N/A'}\nTrack driver: ${trackingLink}`;

  return {
    subject,
    html: wrapEmailBody(content, `Rider Assigned: ${params.deliveryPersonName} is delivering Order #${shortId}`),
    text,
  };
}

/**
 * 5. PAYMENT VERIFIED - RECEIPT OR STATUS
 */
export function templatePaymentVerifiedEmail(params: {
  orderId: string;
  customerName: string;
  amount: number;
  paymentMethod: string;
  paymentId?: string;
  status?: 'completed' | 'failed' | string;
  date?: string;
  receiptUrl?: string;
}): { html: string; text: string; subject: string } {
  const isCompleted = params.status !== 'failed';
  const shortId = params.orderId.slice(-6).toUpperCase();
  const subject = isCompleted
    ? `Payment Receipt: ₹${params.amount.toFixed(2)} for Order #${shortId} ✅`
    : `Payment Status Update: Order #${shortId} ⚠️`;

  const formattedDate = params.date || new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const viewOrderLink = params.receiptUrl || `https://akrhunger.com/customer/orders/tracking/${params.orderId}`;

  const content = `
    <div style="text-align: center; margin-bottom: 24px;">
      <span style="display: inline-block; background-color: ${isCompleted ? '#064e3b' : '#7f1d1d'}; color: ${isCompleted ? '#34d399' : '#f87171'}; font-size: 12px; font-weight: 700; padding: 6px 14px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.5px;">
        ${isCompleted ? '✓ PAYMENT VERIFIED' : '⚠ PAYMENT NOTICE'}
      </span>
      <h1 style="margin: 12px 0 6px 0; font-size: 26px; font-weight: 800; color: #ffffff;">
        ₹${params.amount.toFixed(2)}
      </h1>
      <p style="margin: 0; color: #94a3b8; font-size: 14px;">
        ${isCompleted ? 'Payment received successfully. Thank you!' : 'Payment was not verified or failed.'}
      </p>
    </div>

    <!-- TRANSACTION RECEIPT TABLE -->
    <div style="background-color: #1e2433; border: 1px solid #2e3748; border-radius: 16px; padding: 20px; margin-bottom: 26px;">
      <h3 style="margin: 0 0 14px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #fb923c;">
        Transaction Details
      </h3>
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 13px;">
        <tr>
          <td style="color: #94a3b8; padding: 6px 0;">Order Reference:</td>
          <td align="right" style="color: #ffffff; font-weight: 700; padding: 6px 0;">#${params.orderId}</td>
        </tr>
        ${params.paymentId ? `
          <tr>
            <td style="color: #94a3b8; padding: 6px 0;">Transaction / Payment ID:</td>
            <td align="right" style="color: #cbd5e1; font-family: monospace; font-size: 12px; padding: 6px 0;">${params.paymentId}</td>
          </tr>
        ` : ''}
        <tr>
          <td style="color: #94a3b8; padding: 6px 0;">Payment Method:</td>
          <td align="right" style="color: #ffffff; font-weight: 600; padding: 6px 0;">${params.paymentMethod.toUpperCase()}</td>
        </tr>
        <tr>
          <td style="color: #94a3b8; padding: 6px 0;">Date & Time:</td>
          <td align="right" style="color: #cbd5e1; padding: 6px 0;">${formattedDate}</td>
        </tr>
        <tr>
          <td style="color: #94a3b8; padding: 10px 0 0 0; border-top: 1px solid #2d3545; font-weight: 600;">Status:</td>
          <td align="right" style="color: ${isCompleted ? '#34d399' : '#f87171'}; font-weight: 800; padding: 10px 0 0 0; border-top: 1px solid #2d3545;">
            ${isCompleted ? 'SUCCESS / VERIFIED' : 'FAILED'}
          </td>
        </tr>
      </table>
    </div>

    <!-- ACTION BUTTON -->
    <div style="text-align: center; margin: 30px 0 16px 0;">
      <a href="${viewOrderLink}" style="display: inline-block; background: linear-gradient(135deg, #ea580c 0%, #f97316 100%); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 15px; padding: 14px 34px; border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(234, 88, 12, 0.5);">
        View Order & Receipt →
      </a>
    </div>
  `;

  const text = `Payment ${isCompleted ? 'Verified' : 'Update'}: ₹${params.amount.toFixed(2)} for Order #${shortId}.\nTx ID: ${params.paymentId || 'N/A'}\nView details: ${viewOrderLink}`;

  return {
    subject,
    html: wrapEmailBody(content, `Payment Receipt: ₹${params.amount.toFixed(2)} for Order #${shortId}`),
    text,
  };
}

/**
 * 6. NEW RESTAURANT REGISTRATION - ADMIN NOTIFICATION
 */
export function templateNewRestaurantAdminNotificationEmail(params: {
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
  adminUrl?: string;
}): { html: string; text: string; subject: string } {
  const subject = `🏛️ New Restaurant Partner Application: ${params.restaurantName}`;
  const adminLink = params.adminUrl || `https://akrhunger.com/admin/restaurants`;

  const cuisineList = (params.cuisines || []).join(', ') || 'Multi-Cuisine';
  const locationStr = [params.address, params.city, params.state].filter(Boolean).join(', ') || 'Not specified';

  const content = `
    <div style="background-color: #172554; border: 1px solid #1e40af; border-radius: 14px; padding: 16px; margin-bottom: 22px; text-align: center;">
      <span style="color: #60a5fa; font-weight: 800; font-size: 14px; letter-spacing: 0.5px; text-transform: uppercase;">
        🏛️ ADMIN ALERT: NEW PARTNER ONBOARDING
      </span>
      <h2 style="margin: 8px 0 0 0; color: #ffffff; font-size: 22px; font-weight: 800;">
        ${params.restaurantName}
      </h2>
    </div>

    <p style="margin: 0 0 20px 0; font-size: 15px; color: #cbd5e1; line-height: 1.5;">
      A new restaurant partner has just registered on the platform and is awaiting administrative verification.
    </p>

    <!-- RESTAURANT DETAILS CARD -->
    <div style="background-color: #1e2433; border: 1px solid #2e3748; border-radius: 16px; padding: 20px; margin-bottom: 22px;">
      <h3 style="margin: 0 0 14px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #fb923c;">
        Restaurant Information
      </h3>
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 13px;">
        <tr>
          <td style="color: #94a3b8; padding: 5px 0;">Owner Name:</td>
          <td align="right" style="color: #ffffff; font-weight: 600; padding: 5px 0;">${params.ownerName}</td>
        </tr>
        <tr>
          <td style="color: #94a3b8; padding: 5px 0;">Email:</td>
          <td align="right" style="color: #ffffff; font-weight: 600; padding: 5px 0;">${params.email}</td>
        </tr>
        <tr>
          <td style="color: #94a3b8; padding: 5px 0;">Phone:</td>
          <td align="right" style="color: #ffffff; font-weight: 600; padding: 5px 0;">${params.phone}</td>
        </tr>
        <tr>
          <td style="color: #94a3b8; padding: 5px 0;">Location:</td>
          <td align="right" style="color: #cbd5e1; padding: 5px 0;">${locationStr}</td>
        </tr>
        <tr>
          <td style="color: #94a3b8; padding: 5px 0;">Cuisines:</td>
          <td align="right" style="color: #cbd5e1; padding: 5px 0;">${cuisineList}</td>
        </tr>
      </table>
    </div>

    <!-- COMPLIANCE & LEGAL CARD -->
    <div style="background-color: #1a1f2c; border: 1px solid #283042; border-radius: 16px; padding: 20px; margin-bottom: 26px;">
      <h3 style="margin: 0 0 14px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #34d399;">
        Compliance & Verification
      </h3>
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 13px;">
        <tr>
          <td style="color: #94a3b8; padding: 5px 0;">FSSAI License:</td>
          <td align="right" style="color: #ffffff; font-family: monospace; font-weight: 700; padding: 5px 0;">
            ${params.fssaiNumber || 'Pending'}
          </td>
        </tr>
        ${params.gstNumber ? `
          <tr>
            <td style="color: #94a3b8; padding: 5px 0;">GST Number:</td>
            <td align="right" style="color: #ffffff; font-family: monospace; padding: 5px 0;">${params.gstNumber}</td>
          </tr>
        ` : ''}
        ${params.fssaiDocument ? `
          <tr>
            <td style="color: #94a3b8; padding: 5px 0;">FSSAI Document:</td>
            <td align="right" style="padding: 5px 0;">
              <a href="${params.fssaiDocument}" target="_blank" style="color: #60a5fa; text-decoration: underline; font-weight: 600;">View Certificate ↗</a>
            </td>
          </tr>
        ` : ''}
      </table>
    </div>

    <!-- ADMIN CONSOLE CTA -->
    <div style="text-align: center; margin: 30px 0 16px 0;">
      <a href="${adminLink}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 15px; padding: 14px 34px; border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.5);">
        Review in Admin Panel →
      </a>
    </div>
  `;

  const text = `New restaurant registered: ${params.restaurantName}\nOwner: ${params.ownerName} (${params.email}, ${params.phone})\nFSSAI: ${params.fssaiNumber || 'None'}\nReview: ${adminLink}`;

  return {
    subject,
    html: wrapEmailBody(content, `New restaurant application: ${params.restaurantName}`),
    text,
  };
}
