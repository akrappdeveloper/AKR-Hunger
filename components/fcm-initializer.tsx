'use client';

import useFcmToken from '@/hooks/use-fcm-token';

export default function FCMInitializer() {
    const { fcmToken, permission } = useFcmToken();

    // You can use this component to render nothing, or a button to enable notifications if permission is 'default'
    // For now, it just initializes the hook.

    return null;
}
