

import { db } from '@/lib/firebase';
import {
    collection,
    doc,
    getDoc,
    updateDoc,
    addDoc,
    serverTimestamp,
    increment,
    runTransaction
} from 'firebase/firestore';
import { MembershipRequest, Customer, IssuedCard } from '@/lib/types';

// Request Membership
export async function requestMembership(
    customerId: string,
    customerName: string,
    customerEmail: string,
    contactNumber: string
) {
    try {
        // 1. Check if already has a pending request or is already a member
        const customerRef = doc(db, 'customers', customerId);
        const customerSnap = await getDoc(customerRef);

        if (!customerSnap.exists()) {
            return { success: false, error: 'Customer not found' };
        }

        const customerData = customerSnap.data() as Customer;

        if (customerData.membershipStatus === 'pending') {
            return { success: false, error: 'You already have a pending request.' };
        }

        if (customerData.membershipStatus === 'approved' || customerData.membershipId) {
            return { success: false, error: 'You are already a member.' };
        }

        // Check for bank details
        if (!customerData.bankDetails || !customerData.bankDetails.accountNumber) {
            return { success: false, error: 'Please add your bank details in the wallet section first.' };
        }

        // 2. Create Request
        const requestRef = await addDoc(collection(db, 'membershipRequests'), {
            customerId,
            customerName,
            customerEmail,
            contactNumber,
            status: 'pending',
            createdAt: serverTimestamp(),
            bankDetails: customerData.bankDetails || null, // Snapshot bank details
        });

        // 3. Update Customer Status
        await updateDoc(customerRef, {
            membershipStatus: 'pending',
            updatedAt: serverTimestamp()
        });

        return { success: true, requestId: requestRef.id };
    } catch (error) {
        console.error('Error requesting membership:', error);
        return { success: false, error: 'Failed to submit request' };
    }
}

// Approve Membership
export async function approveMembership(requestId: string, adminName: string = 'Admin') {
    try {
        await runTransaction(db, async (transaction) => {
            const requestRef = doc(db, 'membershipRequests', requestId);
            const requestSnap = await transaction.get(requestRef);

            if (!requestSnap.exists()) {
                throw "Request does not exist!";
            }

            const requestData = requestSnap.data() as MembershipRequest;

            if (requestData.status !== 'pending') {
                throw "Request is not pending";
            }

            const customerRef = doc(db, 'customers', requestData.customerId);

            // Generate Membership ID
            // Format: HNG-ABCDE-1234 (HNG - First 5 chars of Name/UID - timestamp suffix)
            const namePart = requestData.customerName.replace(/[^a-zA-Z]/g, '').slice(0, 5).toUpperCase() || 'USERX';
            const uniqueSuffix = Date.now().toString().slice(-4);
            const newMembershipId = `HNG-${namePart}-${uniqueSuffix}`;

            // Update Request
            transaction.update(requestRef, {
                status: 'approved',
                approvedAt: serverTimestamp(),
                approvedBy: adminName
            });

            // Update Customer
            transaction.update(customerRef, {
                membershipId: newMembershipId,
                membershipStatus: 'approved',
                updatedAt: serverTimestamp()
            });

            // Generate Card Details
            const cardNumber = '4' + Math.floor(Math.random() * 1000000000000000).toString().padStart(15, '0'); // Simple 16 digit generation starting with 4
            const cvv = Math.floor(Math.random() * 900 + 100).toString(); // 3 digit CVV
            const expiryDate = new Date();
            expiryDate.setFullYear(expiryDate.getFullYear() + 5); // 5 years expiry

            // Create Issued Card Document
            const cardRef = doc(collection(db, 'issuedCards')); // Generate ID automatically
            const newCard: IssuedCard = {
                id: cardRef.id,
                customerId: requestData.customerId,
                customerName: requestData.customerName,
                cardNumber: cardNumber,
                expiryDate: expiryDate,
                cvv: cvv,
                status: 'active',
                issuedAt: new Date(), // using client date for transaction object, Firestore will convert or we can use generic object if strictly needed for specific fields avoiding serverTimestamp inside object if not top level
                issuedBy: adminName
            };

            // We need to use set() for custom ID or doc() with collection
            transaction.set(cardRef, {
                ...newCard,
                issuedAt: serverTimestamp(),
                expiryDate: expiryDate // Keep Date object, Firestore handles it
            });

            // Optional: Add notification for customer
            const notifRef = doc(collection(db, 'notifications'));
            transaction.set(notifRef, {
                userId: requestData.customerId,
                userType: 'customer',
                type: 'system',
                title: 'Membership Approved!',
                message: `Congratulations! Your membership request has been approved. Your Member ID is ${newMembershipId}. Your Virtual Card is now active in your wallet.`,
                isRead: false,
                createdAt: serverTimestamp()
            });
        });

        return { success: true };
    } catch (error) {
        console.error('Error approving membership:', error);
        return { success: false, error: 'Failed to approve request' };
    }
}

// Reject Membership
export async function rejectMembership(requestId: string, reason: string) {
    try {
        await runTransaction(db, async (transaction) => {
            const requestRef = doc(db, 'membershipRequests', requestId);
            const requestSnap = await transaction.get(requestRef);

            if (!requestSnap.exists()) {
                throw "Request does not exist!";
            }

            const requestData = requestSnap.data() as MembershipRequest;

            const customerRef = doc(db, 'customers', requestData.customerId);

            // Update Request
            transaction.update(requestRef, {
                status: 'rejected',
                rejectedAt: serverTimestamp(),
                rejectionReason: reason
            });

            // Update Customer Status back to none (or rejected if we want to show that)
            transaction.update(customerRef, {
                membershipStatus: 'rejected', // Allow them to apply again? Maybe distinct status
                updatedAt: serverTimestamp()
            });

            // Optional: Add notification for customer
            const notifRef = doc(collection(db, 'notifications'));
            transaction.set(notifRef, {
                userId: requestData.customerId,
                userType: 'customer',
                type: 'system',
                title: 'Membership Request Rejected',
                message: `Your membership request was rejected. Reason: ${reason}`,
                isRead: false,
                createdAt: serverTimestamp()
            });
        });

        return { success: true };
    } catch (error) {
        console.error('Error rejecting membership:', error);
        return { success: false, error: 'Failed to reject request' };
    }
}
