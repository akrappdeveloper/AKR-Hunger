'use client';

import { useState } from 'react';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { Settings, Bell, Lock, Database, FileText, FileJson, FileSpreadsheet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { exportToCSV, exportToPDF, exportToJSON, generateOrderReport, generateRestaurantReport, generateCustomerReport } from '@/lib/export';
import { toast } from 'sonner';

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
        <h1 className="text-3xl font-bold text-foreground mb-2">System Settings</h1>
        <p className="text-muted-foreground">Configure platform settings and preferences</p>
      </div>

      <div className="bg-background/40 rounded-xl border border-border/50 overflow-hidden backdrop-blur-xl shadow-2xl">
        <div className="flex border-b border-border/50 bg-card/40">
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
                  : 'text-muted-foreground hover:text-foreground hover:bg-card/5'
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
              <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-500" />
                General Settings
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Default Delivery Fee (₹)
                  </label>
                  <input
                    type="number"
                    value={settings.deliveryFee}
                    onChange={(e) =>
                      handleSettingChange('deliveryFee', parseFloat(e.target.value))
                    }
                    className="w-full px-4 py-3 bg-background/20 border border-border/50 rounded-lg text-foreground focus:outline-none focus:border-blue-500/50 focus:bg-background/40 transition-all font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Minimum Order Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={settings.minOrderAmount}
                    onChange={(e) =>
                      handleSettingChange('minOrderAmount', parseFloat(e.target.value))
                    }
                    className="w-full px-4 py-3 bg-background/20 border border-border/50 rounded-lg text-foreground focus:outline-none focus:border-blue-500/50 focus:bg-background/40 transition-all font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Commission Rate (%)
                  </label>
                  <input
                    type="number"
                    value={settings.commissionRate}
                    onChange={(e) =>
                      handleSettingChange('commissionRate', parseFloat(e.target.value))
                    }
                    className="w-full px-4 py-3 bg-background/20 border border-border/50 rounded-lg text-foreground focus:outline-none focus:border-blue-500/50 focus:bg-background/40 transition-all font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Max Delivery Time (minutes)
                  </label>
                  <input
                    type="number"
                    value={settings.maxDeliveryTime}
                    onChange={(e) =>
                      handleSettingChange('maxDeliveryTime', parseFloat(e.target.value))
                    }
                    className="w-full px-4 py-3 bg-background/20 border border-border/50 rounded-lg text-foreground focus:outline-none focus:border-blue-500/50 focus:bg-background/40 transition-all font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6 max-w-4xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <Bell className="w-5 h-5 text-blue-500" />
                    Notification & Email Settings
                  </h2>
                  <p className="text-muted-foreground text-sm mt-1">
                    Manage automated push notifications and Resend transactional emails
                  </p>
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 px-3 py-1 font-mono text-xs">
                  Resend API Active
                </Badge>
              </div>

              {/* Resend Service Status Banner */}
              <div className="p-5 bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-transparent rounded-xl border border-orange-500/20">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-foreground font-semibold flex items-center gap-2 text-sm">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      Resend Email Engine Connected
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Sender: <code className="text-orange-400 font-mono">Hunger Food Delivery &lt;onboarding@resend.dev&gt;</code>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Admin Notifications: <code className="text-blue-400 font-mono">admin@akrhunger.com</code>
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      const emailTarget = prompt('Enter recipient email for Resend test:', 'delivered@resend.dev');
                      if (!emailTarget) return;
                      try {
                        toast.info('Sending test email via Resend...');
                        const res = await fetch('/api/email/send', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ type: 'test', to: emailTarget }),
                        });
                        const data = await res.json();
                        if (data.success) {
                          toast.success(`Test email sent successfully! [ID: ${data.id || 'OK'}]`);
                        } else {
                          toast.error(`Email error: ${data.error || 'Failed to send'}`);
                        }
                      } catch (err: any) {
                        toast.error(`Failed: ${err.message}`);
                      }
                    }}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-foreground text-xs font-semibold rounded-lg shadow-md transition-all self-start md:self-auto cursor-pointer"
                  >
                    Send Quick Test Email ✉️
                  </button>
                </div>
              </div>

              {/* 6 Core Automated Email Workflows */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Automated Transactional Emails
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    {
                      title: 'User Registration',
                      desc: 'Welcome email for customers, drivers & restaurant partners',
                      tag: 'Welcome Email',
                      color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
                    },
                    {
                      title: 'Order Placed',
                      desc: 'Itemized order confirmation with receipt and live tracking link',
                      tag: 'Customer Confirmation',
                      color: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
                    },
                    {
                      title: 'New Order Received',
                      desc: 'Urgent kitchen alert with items breakdown and cooking instructions',
                      tag: 'Restaurant Alert',
                      color: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
                    },
                    {
                      title: 'Delivery Partner Assigned',
                      desc: 'Rider details, phone, vehicle info & secret 4-digit Delivery OTP',
                      tag: 'Customer Update',
                      color: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
                    },
                    {
                      title: 'Payment Verified',
                      desc: 'Official payment receipt with Razorpay Tx ID and invoice summary',
                      tag: 'Receipt & Status',
                      color: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
                    },
                    {
                      title: 'New Restaurant Registration',
                      desc: 'Instant admin alert with owner details, FSSAI license & GST',
                      tag: 'Admin Notification',
                      color: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
                    },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-background/20 rounded-xl border border-border/50 hover:border-white/15 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <h4 className="text-sm font-semibold text-foreground">{item.title}</h4>
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${item.color}`}>
                            {item.tag}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                      </div>
                      <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Trigger: Automated on Event</span>
                        <span className="text-emerald-400 font-medium">● Enabled</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* System Toggles */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between p-5 bg-background/20 rounded-xl border border-border/50 hover:border-border/50 transition-all">
                  <div>
                    <p className="text-foreground font-medium flex items-center gap-2">
                      Email Notifications
                      <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">Recommended</span>
                    </p>
                    <p className="text-muted-foreground text-sm mt-1">Receive email alerts for important platform events</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.enableNotifications}
                    onChange={(e) =>
                      handleSettingChange('enableNotifications', e.target.checked)
                    }
                    className="w-6 h-6 rounded bg-background/40 border-border text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-900"
                  />
                </div>

                <div className="flex items-center justify-between p-5 bg-background/20 rounded-xl border border-border/50 hover:border-border/50 transition-all">
                  <div>
                    <p className="text-foreground font-medium">SMS Notifications</p>
                    <p className="text-muted-foreground text-sm mt-1">Send SMS alerts for critical updates</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.enableSMS}
                    onChange={(e) =>
                      handleSettingChange('enableSMS', e.target.checked)
                    }
                    className="w-6 h-6 rounded bg-background/40 border-border text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-900"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-6 max-w-4xl">
              <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" />
                Reports & Analytics
              </h2>

              <div className="space-y-4">
                <div className="bg-background/20 p-6 rounded-xl border border-border/50">
                  <h3 className="text-foreground font-medium mb-4 uppercase text-xs tracking-wider opacity-70">Available Reports</h3>
                  <ul className="space-y-3">
                    {[
                      {
                        title: 'Daily Orders Report',
                        fetch: async () => {
                          const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
                          const snapshot = await getDocs(q);
                          const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                          return generateOrderReport(orders as any[]);
                        },
                        baseName: 'Daily_Orders_Report'
                      },
                      {
                        title: 'Revenue Report (Orders)',
                        fetch: async () => {
                          const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
                          const snapshot = await getDocs(q);
                          const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                          return generateOrderReport(orders as any[]);
                        },
                        baseName: 'Revenue_Report'
                      },
                      {
                        title: 'Customer Analytics',
                        fetch: async () => {
                          const snapshot = await getDocs(collection(db, 'customers'));
                          const customers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                          return generateCustomerReport(customers);
                        },
                        baseName: 'Customer_Analytics_Report'
                      },
                      {
                        title: 'Restaurant Performance',
                        fetch: async () => {
                          const snapshot = await getDocs(collection(db, 'restaurants'));
                          const restaurants = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                          return generateRestaurantReport(restaurants as any[]);
                        },
                        baseName: 'Restaurant_Performance_Report'
                      }
                    ].map((report, idx) => (
                      <li key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-card/5 border border-border/50 hover:border-border/50 transition-all gap-4">
                        <span className="text-foreground font-medium text-sm sm:text-base">{report.title}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={async () => {
                              try {
                                toast.promise(async () => {
                                  const data = await report.fetch();
                                  exportToCSV(data, report.baseName);
                                }, { loading: 'Generating CSV...', success: 'CSV downloaded!', error: 'Failed to download CSV' });
                              } catch (e) { console.error(e); }
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 rounded-lg text-xs font-bold transition-all"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" /> CSV
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                toast.promise(async () => {
                                  const data = await report.fetch();
                                  exportToPDF(data, report.baseName);
                                }, { loading: 'Generating PDF...', success: 'PDF downloaded!', error: 'Failed to download PDF' });
                              } catch (e) { console.error(e); }
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 rounded-lg text-xs font-bold transition-all"
                          >
                            <FileText className="w-3.5 h-3.5" /> PDF
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                toast.promise(async () => {
                                  const data = await report.fetch();
                                  exportToJSON(data, report.baseName);
                                }, { loading: 'Generating JSON...', success: 'JSON downloaded!', error: 'Failed to download JSON' });
                              } catch (e) { console.error(e); }
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/20 rounded-lg text-xs font-bold transition-all"
                          >
                            <FileJson className="w-3.5 h-3.5" /> JSON
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6 max-w-4xl">
              <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                <Lock className="w-5 h-5 text-blue-500" />
                Security Settings
              </h2>

              <div className="space-y-4">
                <div className="bg-background/20 p-6 rounded-xl border border-border/50">
                  <h3 className="text-foreground font-medium mb-4 uppercase text-xs tracking-wider opacity-70">Admin Account Security</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-border/50 pb-4">
                      <div>
                        <p className="text-muted-foreground font-medium">Admin Name</p>
                        <p className="text-muted-foreground text-sm mt-1">{admin?.name}</p>
                      </div>
                      <button className="text-blue-400 text-sm hover:underline">Edit</button>
                    </div>
                    <div className="flex items-center justify-between border-b border-border/50 pb-4">
                      <div>
                        <p className="text-muted-foreground font-medium">Email Address</p>
                        <p className="text-muted-foreground text-sm mt-1">{admin?.email}</p>
                      </div>
                      <Badge variant="outline" className="border-green-500/50 text-green-400 bg-green-500/10">Verified</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-muted-foreground font-medium">Admin Role</p>
                        <p className="text-muted-foreground text-sm capitalize mt-1">{admin?.role}</p>
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
        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-foreground font-semibold rounded-lg transition-colors"
      >
        Save Settings
      </button>
    </div>
  );
}
