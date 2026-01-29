'use client';

import React, { useState, useEffect } from 'react';
import { collection, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { NotificationPreference } from '@/lib/notifications';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';

export default function NotificationPreferences() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreference | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchPreferences = async () => {
      try {
        const prefRef = doc(db, 'notificationPreferences', user.uid);
        const prefSnap = await getDoc(prefRef);

        if (prefSnap.exists()) {
          setPreferences(prefSnap.data() as NotificationPreference);
        } else {
          const defaultPref: NotificationPreference = {
            userId: user.uid,
            userType: 'customer',
            emailNotifications: true,
            smsNotifications: false,
            pushNotifications: true,
            orderUpdates: true,
            promotions: false,
            systemAlerts: true,
          };
          setPreferences(defaultPref);
        }
      } catch (error) {
        console.error('[v0] Error fetching notification preferences:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPreferences();
  }, [user]);

  const handleSave = async () => {
    if (!user || !preferences) return;

    try {
      setSaving(true);
      const prefRef = doc(db, 'notificationPreferences', user.uid);
      await setDoc(prefRef, preferences);
      console.log('[v0] Notification preferences saved');
    } catch (error) {
      console.error('[v0] Error saving notification preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  const togglePreference = (key: keyof Omit<NotificationPreference, 'userId' | 'userType'>) => {
    if (!preferences) return;
    setPreferences({
      ...preferences,
      [key]: !preferences[key],
    });
  };

  if (loading) {
    return <div className="text-center text-muted-foreground">Loading preferences...</div>;
  }

  if (!preferences) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Notification Preferences</h2>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 border border-border rounded-lg">
          <div>
            <p className="font-medium text-foreground">Push Notifications</p>
            <p className="text-sm text-muted-foreground">Receive notifications in your browser</p>
          </div>
          <button
            onClick={() => togglePreference('pushNotifications')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              preferences.pushNotifications
                ? 'bg-green-500 text-white'
                : 'bg-muted text-foreground'
            }`}
          >
            {preferences.pushNotifications ? 'On' : 'Off'}
          </button>
        </div>

        <div className="flex items-center justify-between p-4 border border-border rounded-lg">
          <div>
            <p className="font-medium text-foreground">Email Notifications</p>
            <p className="text-sm text-muted-foreground">Receive notifications via email</p>
          </div>
          <button
            onClick={() => togglePreference('emailNotifications')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              preferences.emailNotifications
                ? 'bg-green-500 text-white'
                : 'bg-muted text-foreground'
            }`}
          >
            {preferences.emailNotifications ? 'On' : 'Off'}
          </button>
        </div>

        <div className="flex items-center justify-between p-4 border border-border rounded-lg">
          <div>
            <p className="font-medium text-foreground">SMS Notifications</p>
            <p className="text-sm text-muted-foreground">Receive notifications via SMS (premium)</p>
          </div>
          <button
            onClick={() => togglePreference('smsNotifications')}
            disabled
            className="px-4 py-2 rounded-lg font-medium bg-muted text-muted-foreground cursor-not-allowed opacity-50"
          >
            Coming Soon
          </button>
        </div>

        <div className="border-t border-border pt-4 mt-6">
          <h3 className="font-medium text-foreground mb-4">Notification Types</h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="orderUpdates" className="font-medium text-foreground">
                Order Updates
              </label>
              <input
                id="orderUpdates"
                type="checkbox"
                checked={preferences.orderUpdates}
                onChange={() => togglePreference('orderUpdates')}
                className="w-4 h-4"
              />
            </div>

            <div className="flex items-center justify-between">
              <label htmlFor="promotions" className="font-medium text-foreground">
                Promotions & Offers
              </label>
              <input
                id="promotions"
                type="checkbox"
                checked={preferences.promotions}
                onChange={() => togglePreference('promotions')}
                className="w-4 h-4"
              />
            </div>

            <div className="flex items-center justify-between">
              <label htmlFor="systemAlerts" className="font-medium text-foreground">
                System Alerts
              </label>
              <input
                id="systemAlerts"
                type="checkbox"
                checked={preferences.systemAlerts}
                onChange={() => togglePreference('systemAlerts')}
                className="w-4 h-4"
              />
            </div>
          </div>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? 'Saving...' : 'Save Preferences'}
      </Button>
    </div>
  );
}
