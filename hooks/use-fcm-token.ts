'use client';

import { useEffect, useState } from 'react';
import { messaging, db, auth } from '@/lib/firebase';
import { getToken } from 'firebase/messaging';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

const useFcmToken = () => {
    const [token, setToken] = useState<string | null>(null);
    const [permission, setPermission] = useState<NotificationPermission>('default');

    useEffect(() => {
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            if (Notification.permission === 'granted') {
                setPermission('granted');
                retrieveToken();
            } else if (Notification.permission !== 'denied') {
                requestPermission();
            }
        }
    }, []);

    const requestPermission = async () => {
        try {
            const permission = await Notification.requestPermission();
            setPermission(permission);
            if (permission === 'granted') {
                retrieveToken();
            }
        } catch (error) {
            console.error('An error occurred while requesting permission. ', error);
        }
    };

    const retrieveToken = async () => {
        try {
            const msg = await messaging;
            if (msg) {
                const currentToken = await getToken(msg, {
                    vapidKey: VAPID_KEY,
                });
                if (currentToken) {
                    setToken(currentToken);
                    console.log('FCM Token:', currentToken);
                    saveTokenToFirestore(currentToken);
                } else {
                    console.log('No registration token available. Request permission to generate one.');
                }
            }
        } catch (error) {
            console.error('An error occurred while retrieving token. ', error);
        }
    };

    const saveTokenToFirestore = async (currentToken: string) => {
        // Wait for auth to be ready
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    // Try to update in users collection first
                    const userRef = doc(db, 'users', user.uid);
                    // We use setDoc with merge: true to avoid errors if doc doesn't exist, though it should for a logged in user
                    // However, updateDoc is safer if we strictly expect the doc to exist.
                    // Given the app structure, let's try to determine if it's a restaurant or user.
                    // A simple way is to check if 'users' doc exists.

                    const userSnap = await getDoc(userRef);

                    if (userSnap.exists()) {
                        await updateDoc(userRef, { fcmToken: currentToken });
                    } else {
                        // Check restaurants
                        const restRef = doc(db, 'restaurants', user.uid);
                        const restSnap = await getDoc(restRef);
                        if (restSnap.exists()) {
                            await updateDoc(restRef, { fcmToken: currentToken });
                        }
                    }
                } catch (error) {
                    console.error("Error saving FCM token to Firestore:", error);
                }
            }
        });
    };

    return { fcmToken: token, permission, requestPermission };
};

export default useFcmToken;
