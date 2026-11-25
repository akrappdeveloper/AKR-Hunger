'use client';

import { useState } from 'react';
import { ProtectedRoute } from '@/components/admin/ProtectedRoute';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ShieldCheck, Search, Filter, Clock, User, ShieldAlert, ArrowRight } from 'lucide-react';

interface AuditItem {
  id: string;
  adminName: string;
  action: string;
  category: 'driver_kyc' | 'restaurant_status' | 'refund_approved' | 'surge_override' | 'settings_changed';
  details: string;
  timestamp: string;
  ipAddress: string;
}

const SAMPLE_LOGS: AuditItem[] = [
  { id: '1', adminName: 'Super Admin (samra)', action: 'Approved Driver KYC', category: 'driver_kyc', details: 'Verified driving license & vehicle RC for Rajesh K. (ID: drv_8912)', timestamp: '10 mins ago', ipAddress: '103.21.14.92' },
  { id: '2', adminName: 'Operations Lead (priya)', action: 'Activated Rain Surge', category: 'surge_override', details: 'Surge multiplier set to 1.25x for Central Zone due to heavy showers', timestamp: '45 mins ago', ipAddress: '103.21.14.95' },
  { id: '3', adminName: 'Finance Admin (arun)', action: 'Processed Refund', category: 'refund_approved', details: '₹420 credited to Customer Wallet for cancelled order #ORD-8491', timestamp: '2 hours ago', ipAddress: '157.34.120.11' },
  { id: '4', adminName: 'Super Admin (samra)', action: 'Approved New Restaurant', category: 'restaurant_status', details: 'FSSAI verified and onboarding approved for Spice Garden Kitchen', timestamp: '4 hours ago', ipAddress: '103.21.14.92' },
  { id: '5', adminName: 'Security Bot', action: 'Flagged Suspicious Order', category: 'settings_changed', details: 'Multiple failed OTP delivery attempts detected for rider ID: drv_2910', timestamp: '6 hours ago', ipAddress: '127.0.0.1' },
];

export default function AdminAuditLogsPage() {
  const [search, setSearch] = useState('');

  const filtered = SAMPLE_LOGS.filter(l =>
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    l.adminName.toLowerCase().includes(search.toLowerCase()) ||
    l.details.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ProtectedRoute allowedRoles={['super_admin']}>
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-primary" />
              Security Audit Logs
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Immutable audit trail recording administrative decisions, KYC approvals, and sensitive changes
            </p>
          </div>
          <Badge variant="outline" className="text-xs font-bold font-mono">
            Immutable Storage
          </Badge>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search audit trail by admin, action, or order ID..."
            className="pl-10"
          />
        </div>

        {/* Logs Timeline */}
        <div className="space-y-3">
          {filtered.map(log => (
            <Card key={log.id} className="p-4 border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-foreground">{log.action}</span>
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                    {log.category.replace('_', ' ')}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{log.details}</p>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground/80 pt-1">
                  <span className="flex items-center gap-1"><User className="w-3 h-3" /> {log.adminName}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {log.timestamp}</span>
                  <span>•</span>
                  <span>IP: {log.ipAddress}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </ProtectedRoute>
  );
}
