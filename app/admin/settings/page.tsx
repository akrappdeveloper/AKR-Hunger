'use client';

import { useState } from 'react';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { Settings, Bell, Lock, Database, FileText } from 'lucide-react';

export default function SettingsPage() {
  const { admin } = useAdminAuth();
  const [activeTab, setActiveTab] = useState<'general' | 'notifications' | 'reports' | 'security'>('general');
  const [settings, setSettings] = useState({
    deliveryFee: 50,
    minOrderAmount: 100,
    commissionRate: 20,
    maxDeliveryTime: 60,
    enableNotifications: true,
    enableSMS: true,
  });

  const handleSettingChange = (key: string, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSaveSettings = () => {
    console.log('Saving settings:', settings);
    alert('Settings saved successfully!');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">System Settings</h1>
        <p className="text-gray-400">Configure platform settings and preferences</p>
      </div>

      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <div className="flex border-b border-gray-700">
          {[
            { id: 'general', label: 'General', icon: Settings },
            { id: 'notifications', label: 'Notifications', icon: Bell },
            { id: 'reports', label: 'Reports', icon: FileText },
            { id: 'security', label: 'Security', icon: Lock },
          ].map((tab: any) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-gray-700 text-white border-b-2 border-blue-600'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-white mb-6">General Settings</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Default Delivery Fee (₹)
                  </label>
                  <input
                    type="number"
                    value={settings.deliveryFee}
                    onChange={(e) =>
                      handleSettingChange('deliveryFee', parseFloat(e.target.value))
                    }
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Minimum Order Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={settings.minOrderAmount}
                    onChange={(e) =>
                      handleSettingChange('minOrderAmount', parseFloat(e.target.value))
                    }
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Commission Rate (%)
                  </label>
                  <input
                    type="number"
                    value={settings.commissionRate}
                    onChange={(e) =>
                      handleSettingChange('commissionRate', parseFloat(e.target.value))
                    }
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Max Delivery Time (minutes)
                  </label>
                  <input
                    type="number"
                    value={settings.maxDeliveryTime}
                    onChange={(e) =>
                      handleSettingChange('maxDeliveryTime', parseFloat(e.target.value))
                    }
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-white mb-6">Notification Settings</h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
                  <div>
                    <p className="text-white font-medium">Email Notifications</p>
                    <p className="text-gray-400 text-sm">Receive email alerts for important events</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.enableNotifications}
                    onChange={(e) =>
                      handleSettingChange('enableNotifications', e.target.checked)
                    }
                    className="w-6 h-6 rounded"
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
                  <div>
                    <p className="text-white font-medium">SMS Notifications</p>
                    <p className="text-gray-400 text-sm">Send SMS alerts for critical updates</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.enableSMS}
                    onChange={(e) =>
                      handleSettingChange('enableSMS', e.target.checked)
                    }
                    className="w-6 h-6 rounded"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-white mb-6">Reports & Analytics</h2>

              <div className="space-y-4">
                <div className="bg-gray-700/30 p-4 rounded-lg">
                  <h3 className="text-white font-medium mb-2">Available Reports</h3>
                  <ul className="space-y-2">
                    <li className="flex items-center justify-between">
                      <span className="text-gray-300">Daily Orders Report</span>
                      <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium">
                        Download
                      </button>
                    </li>
                    <li className="flex items-center justify-between">
                      <span className="text-gray-300">Revenue Report</span>
                      <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium">
                        Download
                      </button>
                    </li>
                    <li className="flex items-center justify-between">
                      <span className="text-gray-300">Customer Analytics</span>
                      <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium">
                        Download
                      </button>
                    </li>
                    <li className="flex items-center justify-between">
                      <span className="text-gray-300">Restaurant Performance</span>
                      <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium">
                        Download
                      </button>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-white mb-6">Security Settings</h2>

              <div className="space-y-4">
                <div className="bg-gray-700/30 p-4 rounded-lg">
                  <h3 className="text-white font-medium mb-4">Admin Account Security</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-300 font-medium">Admin Name</p>
                        <p className="text-gray-500 text-sm">{admin?.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-300 font-medium">Email Address</p>
                        <p className="text-gray-500 text-sm">{admin?.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-300 font-medium">Admin Role</p>
                        <p className="text-gray-500 text-sm capitalize">{admin?.role}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
                  <p className="text-yellow-400 text-sm">
                    To change your password, please contact your system administrator.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={handleSaveSettings}
        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
      >
        Save Settings
      </button>
    </div>
  );
}
