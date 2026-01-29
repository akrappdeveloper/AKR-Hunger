import { NextRequest, NextResponse } from 'next/server';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Notification, NotificationType } from '@/lib/notifications';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      userType,
      type,
      title,
      message,
      orderId,
      data,
      actionUrl,
    }: {
      userId: string;
      userType: 'customer' | 'restaurant' | 'delivery' | 'admin';
      type: NotificationType;
      title: string;
      message: string;
      orderId?: string;
      data?: Record<string, any>;
      actionUrl?: string;
    } = body;

    if (!userId || !userType || !type || !title || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const notificationsRef = collection(db, 'notifications');
    const notificationData: Omit<Notification, 'id'> = {
      userId,
      userType,
      type,
      title,
      message,
      read: false,
      createdAt: new Date(),
      orderId,
      data,
      actionUrl,
    };

    const docRef = await addDoc(notificationsRef, notificationData);

    return NextResponse.json(
      { id: docRef.id, notification: notificationData },
      { status: 201 }
    );
  } catch (error) {
    console.error('[v0] Error sending notification:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}
