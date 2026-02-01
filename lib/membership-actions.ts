'use server';

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
import { MembershipRequest, Customer } from '@/lib/types';

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

        // 2. Create Request
        const requestRef = await addDoc(collection(db, 'membershipRequests'), {
            customerId,
            customerName,
            customerEmail,
            contactNumber,
            status: 'pending',
            createdAt: serverTimestamp(),
            // We could ideally snapshot address here if needed, but for now we fetch live on admin side
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
            // Format: AKR-ABCDE-1234 (AKR - First 5 chars of Name/UID - timestamp suffix)
            const namePart = requestData.customerName.replace(/[^a-zA-Z]/g, '').slice(0, 5).toUpperCase() || 'USERX';
            const uniqueSuffix = Date.now().toString().slice(-4);
            const newMembershipId = `AKR-${namePart}-${uniqueSuffix}`;

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

            // Optional: Add notification for customer
            const notifRef = doc(collection(db, 'notifications'));
            transaction.set(notifRef, {
                userId: requestData.customerId,
                userType: 'customer',
                type: 'system',
                title: 'Membership Approved!',
                message: `Congratulations! Your membership request has been approved. Your Member ID is ${newMembershipId}.`,
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
