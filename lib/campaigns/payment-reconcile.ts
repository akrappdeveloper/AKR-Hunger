import 'server-only';
import { adminDb } from '@/lib/firebase-admin-db';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdSettingsServer } from './wallet-balance';

export async function finalizeOnlineCampaignPayment(params: {
  paymentId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature?: string;
  verifiedBy: 'CLIENT_CALLBACK' | 'RAZORPAY_WEBHOOK';
}): Promise<{
  success: boolean;
  alreadyPaid?: boolean;
  campaignId: string;
  campaignStatus: 'ACTIVATING' | 'SCHEDULED';
}> {
  const settings = await getAdSettingsServer();
  const activationDelayMs = Math.max(15, settings.activationDelaySeconds || 60) * 1000;

  return adminDb.runTransaction(async (tx) => {
    const payRef = adminDb.collection('campaignPayments').doc(params.paymentId);
    const paySnap = await tx.get(payRef);
    if (!paySnap.exists) {
      throw new Error('Campaign payment record not found');
    }

    const pay = paySnap.data()!;
    const campaignId = pay.campaignId;
    const restaurantId = pay.restaurantId;

    // Idempotency guard
    if (pay.status === 'PAID') {
      const existingCamp = await tx.get(adminDb.collection('adCampaigns').doc(campaignId));
      const cStatus = existingCamp.exists
        ? (existingCamp.data()?.campaignStatus || 'ACTIVATING')
        : 'ACTIVATING';
      return {
        success: true,
        alreadyPaid: true,
        campaignId,
        campaignStatus: cStatus,
      };
    }

    const campRef = adminDb.collection('adCampaigns').doc(campaignId);
    const campSnap = await tx.get(campRef);
    if (!campSnap.exists) {
      throw new Error('Campaign record not found');
    }
    const camp = campSnap.data()!;

    const nowMs = Date.now();
    const startAtMs = camp.startAt?.toDate
      ? camp.startAt.toDate().getTime()
      : new Date(camp.startAt || nowMs).getTime();

    const shouldActivateSoon = startAtMs <= nowMs + activationDelayMs;
    const nextCampaignStatus: 'ACTIVATING' | 'SCHEDULED' = shouldActivateSoon
      ? 'ACTIVATING'
      : 'SCHEDULED';
    const activationDueAt = shouldActivateSoon
      ? new Date(nowMs + activationDelayMs)
      : new Date(startAtMs);

    const nowField = FieldValue.serverTimestamp();

    // Commit any reserved wallet transaction
    if (pay.walletReservationStatus === 'RESERVED' && Number(pay.walletAmount || 0) > 0) {
      const reservedTxSnap = await tx.get(
        adminDb
          .collection('restaurantWalletTransactions')
          .where('paymentId', '==', params.paymentId)
          .where('status', '==', 'RESERVED')
      );
      reservedTxSnap.docs.forEach((d) => {
        tx.update(d.ref, {
          type: 'DEBIT',
          status: 'COMPLETED',
          paymentReference: params.razorpayPaymentId,
          updatedAt: nowField,
        });
      });
    }

    // Commit any reserved points transaction
    if (pay.pointsReservationStatus === 'RESERVED' && Number(pay.pointsUsed || 0) > 0) {
      const ptsRef = adminDb.collection('pointsAccounts').doc(restaurantId);
      const ptsSnap = await tx.get(ptsRef);
      const spentSoFar = ptsSnap.exists ? Number(ptsSnap.data()?.spentPoints || 0) : 0;
      tx.set(
        ptsRef,
        {
          spentPoints: spentSoFar + Number(pay.pointsUsed || 0),
          updatedAt: nowField,
        },
        { merge: true }
      );

      const reservedRewardSnap = await tx.get(
        adminDb
          .collection('restaurantRewardTransactions')
          .where('paymentId', '==', params.paymentId)
          .where('status', '==', 'RESERVED')
      );
      reservedRewardSnap.docs.forEach((d) => {
        tx.update(d.ref, {
          type: 'DEBIT',
          status: 'COMPLETED',
          updatedAt: nowField,
        });
      });
    }

    // Mark payment PAID
    tx.update(payRef, {
      status: 'PAID',
      walletReservationStatus:
        pay.walletReservationStatus === 'RESERVED' ? 'COMMITTED' : pay.walletReservationStatus || 'NONE',
      pointsReservationStatus:
        pay.pointsReservationStatus === 'RESERVED' ? 'COMMITTED' : pay.pointsReservationStatus || 'NONE',
      razorpayOrderId: params.razorpayOrderId,
      razorpayPaymentId: params.razorpayPaymentId,
      razorpaySignature: params.razorpaySignature || '',
      verifiedBy: params.verifiedBy,
      paidAt: nowField,
      updatedAt: nowField,
    });

    // Update campaign to ACTIVATING or SCHEDULED
    tx.update(campRef, {
      paymentStatus: 'PAID',
      campaignStatus: nextCampaignStatus,
      status: nextCampaignStatus.toLowerCase(),
      isActive: false,
      razorpayOrderId: params.razorpayOrderId,
      razorpayPaymentId: params.razorpayPaymentId,
      activationDueAt,
      updatedAt: nowField,
    });

    // Schedule record
    tx.set(
      adminDb.collection('campaignSchedules').doc(campaignId),
      {
        campaignId,
        restaurantId,
        status: nextCampaignStatus,
        startAt: camp.startAt,
        endAt: camp.endAt,
        activationDueAt,
        updatedAt: nowField,
      },
      { merge: true }
    );

    // Campaign transaction ledger entry
    const campTxRef = adminDb.collection('campaignTransactions').doc();
    tx.set(campTxRef, {
      transactionId: campTxRef.id,
      campaignId,
      restaurantId,
      paymentId: params.paymentId,
      paymentMethod: pay.paymentMethod,
      totalAmount: Number(pay.totalAmount || 0),
      pointsUsed: Number(pay.pointsUsed || 0),
      walletAmount: Number(pay.walletAmount || 0),
      onlineAmount: Number(pay.onlineAmount || 0),
      razorpayPaymentId: params.razorpayPaymentId,
      status: 'COMPLETED',
      description: `Online payment verified for ${camp.campaignName || camp.title}`,
      createdAt: nowField,
    });

    // Audit log
    const auditRef = adminDb.collection('auditLogs').doc();
    tx.set(auditRef, {
      action: 'CAMPAIGN_PAYMENT_VERIFIED',
      campaignId,
      paymentId: params.paymentId,
      restaurantId,
      amount: Number(pay.totalAmount || 0),
      verifiedBy: params.verifiedBy,
      timestamp: nowField,
    });

    return {
      success: true,
      alreadyPaid: false,
      campaignId,
      campaignStatus: nextCampaignStatus,
    };
  });
}
