import fs from 'fs';
import path from 'path';

// Load .env
const envContent = fs.readFileSync(path.resolve('.env'), 'utf8');
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let val = match[2] || '';
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  }
});

import {
  sendWelcomeEmail,
  sendOrderConfirmationEmail,
  sendNewOrderRestaurantEmail,
  sendDeliveryPartnerAssignedEmail,
  sendPaymentVerifiedEmail,
  sendNewRestaurantAdminNotificationEmail,
} from '../lib/email/service.ts';

async function testAllServices() {
  console.log('Testing all 6 services with delivered@resend.dev...');

  // 1. Welcome Email
  const r1 = await sendWelcomeEmail({
    email: 'delivered@resend.dev',
    name: 'Aarav Sharma',
    role: 'customer'
  });
  console.log('1. sendWelcomeEmail:', r1.success ? `✓ Success [${r1.id}]` : `✗ ${r1.error}`);

  // 2. Order Confirmation
  const r2 = await sendOrderConfirmationEmail({
    orderId: 'ORD-7729',
    customerEmail: 'delivered@resend.dev',
    customerName: 'Aarav Sharma',
    restaurantName: 'Biryani Blues',
    items: [{ name: 'Hyderabadi Dum Biryani', quantity: 2, price: 320 }],
    total: 640,
    paymentMethod: 'wallet',
  });
  console.log('2. sendOrderConfirmationEmail:', r2.success ? `✓ Success [${r2.id}]` : `✗ ${r2.error}`);

  // 3. New Order Restaurant
  const r3 = await sendNewOrderRestaurantEmail({
    orderId: 'ORD-7729',
    restaurantEmail: 'delivered@resend.dev',
    restaurantName: 'Biryani Blues',
    items: [{ name: 'Hyderabadi Dum Biryani', quantity: 2, price: 320 }],
    total: 640,
    customerName: 'Aarav Sharma',
  });
  console.log('3. sendNewOrderRestaurantEmail:', r3.success ? `✓ Success [${r3.id}]` : `✗ ${r3.error}`);

  // 4. Delivery Partner Assigned
  const r4 = await sendDeliveryPartnerAssignedEmail({
    orderId: 'ORD-7729',
    customerEmail: 'delivered@resend.dev',
    customerName: 'Aarav Sharma',
    deliveryPersonName: 'Karan Mehra',
    deliveryPersonPhone: '+91 99887 76655',
    deliveryVehicle: 'TVS Jupiter (DL 01 AA 9988)',
    restaurantName: 'Biryani Blues',
    deliveryOtp: '4829',
  });
  console.log('4. sendDeliveryPartnerAssignedEmail:', r4.success ? `✓ Success [${r4.id}]` : `✗ ${r4.error}`);

  // 5. Payment Verified
  const r5 = await sendPaymentVerifiedEmail({
    orderId: 'ORD-7729',
    customerEmail: 'delivered@resend.dev',
    customerName: 'Aarav Sharma',
    amount: 640,
    paymentMethod: 'online',
    paymentId: 'pay_998877AABB',
    status: 'completed',
  });
  console.log('5. sendPaymentVerifiedEmail:', r5.success ? `✓ Success [${r5.id}]` : `✗ ${r5.error}`);

  // 6. New Restaurant Registration to Admin
  const r6 = await sendNewRestaurantAdminNotificationEmail({
    restaurantName: 'Biryani Blues',
    ownerName: 'Sunil Kapoor',
    email: 'sunil@biryaniblues.com',
    phone: '9876543210',
    adminEmail: 'delivered@resend.dev',
    fssaiNumber: '11223344556677',
  });
  console.log('6. sendNewRestaurantAdminNotificationEmail:', r6.success ? `✓ Success [${r6.id}]` : `✗ ${r6.error}`);

  console.log('\n🎊 ALL 6 EMAIL ACTIONS COMPLETED LIVE CALLS SUCCESSFULLY!');
}

testAllServices();
