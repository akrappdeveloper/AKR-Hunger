'use server';

// This file should only be imported in server components and API routes
// Never import this in client components

const keySecret = process.env.RAZORPAY_KEY_SECRET;

export const getRazorpayKeySecret = async () => {
  if (!keySecret) {
    throw new Error('RAZORPAY_KEY_SECRET is not configured');
  }
  return keySecret;
};

export const getRazorpayKeyId = async () => {
  // Only used for documentation - actual public key comes from env
  return 'razorpay-public-key';
};
