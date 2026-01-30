// Internal server helper - not a Server Action

// This file should only be imported in server components and API routes
// Never import this in client components

const keySecret = process.env.RAZORPAY_KEY_SECRET;
const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

export const getRazorpayKeySecret = () => {
  if (!keySecret) {
    throw new Error('RAZORPAY_KEY_SECRET is not configured');
  }
  return keySecret;
};

export const getRazorpayKeyId = () => {
  if (!keyId) {
    throw new Error('RAZORPAY_KEY_ID is not configured');
  }
  return keyId;
};
