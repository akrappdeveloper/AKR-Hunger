'use client';

import { useState } from 'react';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { Settings, Bell, Lock, Database, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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

      <div className="bg-black/40 rounded-xl border border-white/10 overflow-hidden backdrop-blur-xl shadow-2xl">
        <div className="flex border-b border-white/5 bg-gray-900/40">
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
                className={`flex items-center gap-2 px-6 py-4 font-medium transition-all ${activeTab === tab.id
                  ? 'bg-blue-600/10 text-blue-400 border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-8">
          {activeTab === 'general' && (
            <div className="space-y-6 max-w-4xl">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-500" />
                General Settings
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500/50 focus:bg-black/40 transition-all font-mono"
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
                    className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500/50 focus:bg-black/40 transition-all font-mono"
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
                    className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500/50 focus:bg-black/40 transition-all font-mono"
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
                    className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500/50 focus:bg-black/40 transition-all font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6 max-w-4xl">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Bell className="w-5 h-5 text-blue-500" />
                Notification Settings
              </h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-5 bg-black/20 rounded-xl border border-white/5 hover:border-white/10 transition-all">
                  <div>
                    <p className="text-white font-medium flex items-center gap-2">
                      Email Notifications
                      <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">Recommended</span>
                    </p>
                    <p className="text-gray-400 text-sm mt-1">Receive email alerts for important events</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.enableNotifications}
                    onChange={(e) =>
                      handleSettingChange('enableNotifications', e.target.checked)
                    }
                    className="w-6 h-6 rounded bg-black/40 border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-900"
                  />
                </div>

                <div className="flex items-center justify-between p-5 bg-black/20 rounded-xl border border-white/5 hover:border-white/10 transition-all">
                  <div>
                    <p className="text-white font-medium">SMS Notifications</p>
                    <p className="text-gray-400 text-sm mt-1">Send SMS alerts for critical updates</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.enableSMS}
                    onChange={(e) =>
                      handleSettingChange('enableSMS', e.target.checked)
                    }
                    className="w-6 h-6 rounded bg-black/40 border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-900"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-6 max-w-4xl">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" />
                Reports & Analytics
              </h2>

              <div className="space-y-4">
                <div className="bg-black/20 p-6 rounded-xl border border-white/5">
                  <h3 className="text-white font-medium mb-4 uppercase text-xs tracking-wider opacity-70">Available Reports</h3>
                  <ul className="space-y-3">
                    <li className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors">
                      <span className="text-gray-300 font-medium">Daily Orders Report</span>
                      <button className="px-4 py-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600 hover:text-white rounded-lg text-sm font-medium transition-all">
                        Download CSV
                      </button>
                    </li>
                    <li className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors">
                      <span className="text-gray-300 font-medium">Revenue Report</span>
                      <button className="px-4 py-2 bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600 hover:text-white rounded-lg text-sm font-medium transition-all">
                        Download PDF
                      </button>
                    </li>
                    <li className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors">
                      <span className="text-gray-300 font-medium">Customer Analytics</span>
                      <button className="px-4 py-2 bg-purple-600/20 text-purple-400 border border-purple-500/30 hover:bg-purple-600 hover:text-white rounded-lg text-sm font-medium transition-all">
                        Download CSV
                      </button>
                    </li>
                    <li className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors">
                      <span className="text-gray-300 font-medium">Restaurant Performance</span>
                      <button className="px-4 py-2 bg-orange-600/20 text-orange-400 border border-orange-500/30 hover:bg-orange-600 hover:text-white rounded-lg text-sm font-medium transition-all">
                        Download PDF
                      </button>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6 max-w-4xl">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Lock className="w-5 h-5 text-blue-500" />
                Security Settings
              </h2>

              <div className="space-y-4">
                <div className="bg-black/20 p-6 rounded-xl border border-white/5">
                  <h3 className="text-white font-medium mb-4 uppercase text-xs tracking-wider opacity-70">Admin Account Security</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-white/5 pb-4">
                      <div>
                        <p className="text-gray-300 font-medium">Admin Name</p>
                        <p className="text-gray-500 text-sm mt-1">{admin?.name}</p>
                      </div>
                      <button className="text-blue-400 text-sm hover:underline">Edit</button>
                    </div>
                    <div className="flex items-center justify-between border-b border-white/5 pb-4">
                      <div>
                        <p className="text-gray-300 font-medium">Email Address</p>
                        <p className="text-gray-500 text-sm mt-1">{admin?.email}</p>
                      </div>
                      <Badge variant="outline" className="border-green-500/50 text-green-400 bg-green-500/10">Verified</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-300 font-medium">Admin Role</p>
                        <p className="text-gray-500 text-sm capitalize mt-1">{admin?.role}</p>
                      </div>
                      <Badge variant="secondary" className="bg-purple-500/20 text-purple-300 border-0">Super Admin</Badge>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-900/10 border border-yellow-500/20 rounded-xl p-4 flex items-start gap-4">
                  <Lock className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-yellow-400 font-bold text-sm">Password Management</h4>
                    <p className="text-yellow-200/70 text-sm mt-1">
                      To change your password or enable Two-Factor Authentication (2FA), please contact your system administrator or use the Firebase Console.
                    </p>
                  </div>
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
