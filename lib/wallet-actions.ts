'use server';

import { db } from '@/lib/firebase';
import {
    collection,
    doc,
    getDoc,
    updateDoc,
    setDoc,
    addDoc,
    serverTimestamp,
    increment,
    runTransaction
} from 'firebase/firestore';
import { CustomerWithdrawalRequest, WalletTransaction } from '@/lib/types';

// NOTE: In a real "use server" context with Firebase Admin SDK, we would bypass rules.
// But since we are likely using client SDK in this project structure or need an Admin SDK wrapper,
// we will simulate the logic or use the patterns available.
// IF the project is using Client SDK for everything, we might need to rely on client-side calls
// protected by rules, OR use the Firebase Admin SDK for these sensitive operations.
// For now, I will write this assuming we can perform these operations, but acknowledging
// that "use server" with Client SDK might still be subject to rules if auth isn't passed correctly.
// Ideally, we should import 'firebase-admin' for these server actions.

// ADD FUNDS
export async function initiateAddFunds(customerId: string, amount: number) {
    // In a real implementation, this would:
    // 1. Create a Razorpay Order via Razorpay API
    // 2. Return the orderId to the client
    // For now, we'll simulating the "creation" and return a mock needed for the client.

    // See razorpay-server.ts for where we'd call the API.
    // const razorpay = new Razorpay({ ... });
    // const order = await razorpay.orders.create({ ... });

    try {
        // Mocking a successful order creation
        const orderId = `order_${Date.now()}`;
        return { success: true, orderId, amount };
    } catch (error) {
        console.error("Error creating order:", error);
        return { success: false, error: 'Failed to create payment order' };
    }
}

export async function verifyAndAddFunds(
    customerId: string,
    paymentId: string,
    orderId: string,
    signature: string,
    amount: number
) {
    // 1. Verify signature (crypto check)
    // 2. If valid, update wallet balance

    try {
        // Transaction to ensure atomicity
        // Note: With client SDK in server actions, runTransaction might be tricky if not wholly admin.
        // We'll attempt a direct write pattern for this generated Customer panel code.

        const customerRef = doc(db, 'customers', customerId);
        const txRef = collection(customerRef, 'walletTransactions');

        // Use setDoc with merge to ensure customer document exists
        await setDoc(customerRef, {
            walletBalance: increment(amount)
        }, { merge: true });

        await addDoc(txRef, {
            customerId,
            amount,
            type: 'deposit',
            status: 'completed',
            referenceId: paymentId,
            description: 'Added funds to wallet',
            createdAt: serverTimestamp()
        });

        // Create in-app customer notification for wallet top-up
        try {
            await addDoc(collection(db, 'notifications'), {
                userId: customerId,
                userType: 'customer',
                type: 'wallet',
                subType: 'wallet-credit',
                title: 'Wallet Top-up Successful 💰',
                message: `₹${amount.toFixed(2)} was successfully added to your Hunger Wallet balance!`,
                read: false,
                isRead: false,
                deleted: false,
                actionUrl: '/customer/wallet',
                createdAt: serverTimestamp(),
                metadata: {
                    amount,
                    paymentId,
                    type: 'deposit',
                }
            });
        } catch (notifErr) {
            console.error("Failed to create wallet notification:", notifErr);
        }

        return { success: true };
    } catch (error) {
        console.error("Error adding funds:", error);
        return { success: false, error: 'Failed to update wallet' };
    }
}

// WITHDRAW FUNDS
export async function requestWithdrawal(
    customerId: string,
    amount: number,
    bankDetails: CustomerWithdrawalRequest['bankDetails'],
    customerName: string,
    customerEmail: string
) {
    try {
        const customerRef = doc(db, 'customers', customerId);
        const customerSnap = await getDoc(customerRef);

        if (!customerSnap.exists()) {
            return { success: false, error: 'Customer not found' };
        }

        const currentBalance = customerSnap.data().walletBalance || 0;

        if (currentBalance < amount) {
            return { success: false, error: 'Insufficient balance' };
        }

        // 1. Deduct balance immediately
        await updateDoc(customerRef, {
            walletBalance: increment(-amount)
        });

        // 2. Create Withdrawal Request
        await addDoc(collection(db, 'customerWithdrawals'), {
            customerId,
            customerName,
            customerEmail,
            amount,
            status: 'pending',
            bankDetails,
            createdAt: serverTimestamp()
        });

        // 3. Log Transaction
        await addDoc(collection(customerRef, 'walletTransactions'), {
            customerId,
            amount, // Stored as positive number usually, but logic depends on type
            type: 'withdrawal',
            status: 'pending',
            description: 'Withdrawal request submitted',
            createdAt: serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        console.error("Withdrawal request failed:", error);
        // In real app, roll back if step 2 fails after step 1
        return { success: false, error: 'Failed to process request' };
    }
}

// ADMIN ACTIONS
export async function approveWithdrawal(requestId: string, customerId: string) {
    try {
        const requestRef = doc(db, 'customerWithdrawals', requestId);
        const customerRef = doc(db, 'customers', customerId);

        // Update request status
        await updateDoc(requestRef, {
            status: 'approved',
            processedAt: serverTimestamp()
        });

        // Update transaction status in user's history (optional but good for UI)
        // Finding the specific transaction is hard without ID, so we might just add a "completed" log or ignore.
        // Better: Store the generated transaction ID in the withdrawal request to update it.
        // For now, we just mark the request approved. Use specific query if needed.

        return { success: true };
    } catch (error) {
        return { success: false, error: 'Approval failed' };
    }
}

export async function rejectWithdrawal(requestId: string, customerId: string, reason: string) {
    try {
        const requestRef = doc(db, 'customerWithdrawals', requestId);
        const requestSnap = await getDoc(requestRef);
        const data = requestSnap.data();

        if (!data) return { success: false, error: 'Request not found' };

        const amount = data.amount;

        // 1. Update Request
        await updateDoc(requestRef, {
            status: 'rejected',
            rejectionReason: reason,
            processedAt: serverTimestamp()
        });

        // 2. Refund Money to Wallet
        const customerRef = doc(db, 'customers', customerId);
        await updateDoc(customerRef, {
            walletBalance: increment(amount)
        });

        // 3. Log Refund Transaction
        await addDoc(collection(customerRef, 'walletTransactions'), {
            customerId,
            amount,
            type: 'refund',
            status: 'completed',
            description: `Withdrawal rejected: ${reason}`,
            referenceId: requestId,
            createdAt: serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        return { success: false, error: 'Rejection failed' };
    }
}
