
// This file is restored to fix a build error referencing it.
// It is recommended to use razorpay-config.ts instead.

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
