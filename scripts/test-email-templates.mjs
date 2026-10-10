import {
  templateWelcomeEmail,
  templateOrderConfirmationEmail,
  templateNewOrderRestaurantEmail,
  templateDeliveryAssignedEmail,
  templatePaymentVerifiedEmail,
  templateNewRestaurantAdminNotificationEmail
} from '../lib/email/templates.ts';

console.log('Testing Email Templates Generation...');

// 1. Welcome Email
const welcome = templateWelcomeEmail({
  name: 'Samrat',
  email: 'samrat@example.com',
  role: 'customer'
});
console.log('✓ Welcome Email Subject:', welcome.subject);
if (!welcome.html.includes('Welcome to the Family') || !welcome.html.includes('Samrat')) {
  throw new Error('Welcome email content verification failed');
}

// 2. Order Confirmation
const orderConf = templateOrderConfirmationEmail({
  orderId: 'SALRAXCT9921',
  customerName: 'Samrat',
  restaurantName: 'Tandoori Delights',
  items: [
    { name: 'Butter Chicken Special', quantity: 2, price: 340 },
    { name: 'Garlic Naan', quantity: 4, price: 45 }
  ],
  total: 860,
  subtotal: 860,
  deliveryCharge: 40,
  taxes: 42,
  paymentMethod: 'wallet',
  deliveryAddress: 'Flat 402, Royal Palms, Connaught Place, New Delhi 110001'
});
console.log('✓ Order Confirmation Subject:', orderConf.subject);
if (!orderConf.html.includes('SALRAXCT9921') || !orderConf.html.includes('Tandoori Delights')) {
  throw new Error('Order confirmation verification failed');
}

// 3. New Order Restaurant Alert
const newOrder = templateNewOrderRestaurantEmail({
  orderId: 'SALRAXCT9921',
  restaurantName: 'Tandoori Delights',
  items: [
    { name: 'Butter Chicken Special', quantity: 2, price: 340 }
  ],
  total: 860,
  customerName: 'Samrat',
  specialInstructions: 'Please make it extra spicy!'
});
console.log('✓ New Order Restaurant Alert Subject:', newOrder.subject);
if (!newOrder.html.includes('extra spicy')) {
  throw new Error('New order restaurant alert verification failed');
}

// 4. Delivery Partner Assigned
const riderAssigned = templateDeliveryAssignedEmail({
  orderId: 'SALRAXCT9921',
  customerName: 'Samrat',
  deliveryPersonName: 'Vikram Singh',
  deliveryPersonPhone: '+91 98765 43210',
  deliveryVehicle: 'Honda Activa (DL 04 AB 1234)',
  restaurantName: 'Tandoori Delights',
  deliveryOtp: '7482'
});
console.log('✓ Rider Assigned Subject:', riderAssigned.subject);
if (!riderAssigned.html.includes('Vikram Singh') || !riderAssigned.html.includes('7482')) {
  throw new Error('Rider assigned verification failed');
}

// 5. Payment Verified Receipt
const payment = templatePaymentVerifiedEmail({
  orderId: 'SALRAXCT9921',
  customerName: 'Samrat',
  amount: 860,
  paymentMethod: 'razorpay_upi',
  paymentId: 'pay_P19x92Kla91m',
  status: 'completed'
});
console.log('✓ Payment Receipt Subject:', payment.subject);
if (!payment.html.includes('pay_P19x92Kla91m') || !payment.html.includes('860.00')) {
  throw new Error('Payment verified verification failed');
}

// 6. New Restaurant Admin Notification
const adminNotif = templateNewRestaurantAdminNotificationEmail({
  restaurantName: 'The Spicy Wok',
  ownerName: 'Chef Rahul Sharma',
  email: 'rahul@spicywok.in',
  phone: '9811223344',
  address: 'Shop 12, Main Market',
  city: 'New Delhi',
  state: 'Delhi',
  cuisines: ['Chinese', 'Pan-Asian', 'Dim Sum'],
  fssaiNumber: '10020011000123',
  fssaiDocument: 'https://cloudinary.com/sample_fssai.pdf',
  gstNumber: '07AAAAA0000A1Z5'
});
console.log('✓ Admin Restaurant Registration Subject:', adminNotif.subject);
if (!adminNotif.html.includes('The Spicy Wok') || !adminNotif.html.includes('10020011000123')) {
  throw new Error('Admin restaurant alert verification failed');
}

console.log('\n🎉 ALL 6 EMAIL TEMPLATES GENERATED & VALIDATED 100% SUCCESSFULLY!');
