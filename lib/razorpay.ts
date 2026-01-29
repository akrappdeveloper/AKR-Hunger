// Load Razorpay script (client-side safe)
export const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

// Create order interface
export interface RazorpayOrderOptions {
  amount: number; // in paise (e.g., 50000 for ₹500)
  currency: string;
  receipt: string;
  description: string;
  customer_notify?: number;
  notes?: Record<string, any>;
}

// Payment verification interface
export interface PaymentVerification {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}
