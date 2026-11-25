'use client';

import React, { useState } from 'react';
import {
  ShieldAlert,
  AlertOctagon,
  ShieldCheck,
  UserX,
  Lock,
  Smartphone,
  MapPin,
  CreditCard,
  Search,
  Filter,
  CheckCircle2,
  RefreshCw,
  Eye,
  FileWarning
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface FraudIncident {
  id: string;
  type: 'GPS_SPOOF' | 'COUPON_FARM' | 'REFUND_ABUSE' | 'MULTI_ACCOUNT';
  title: string;
  targetUser: string;
  userRole: 'rider' | 'customer' | 'restaurant';
  riskScore: number; // 0 to 100
  details: string;
  detectedAt: string;
  status: 'PENDING' | 'FROZEN' | 'RESOLVED' | 'DISMISSED';
}

const INITIAL_INCIDENTS: FraudIncident[] = [
  {
    id: 'FRD-9041',
    type: 'GPS_SPOOF',
    title: 'Impossible Speed / Simulated Mock GPS',
    targetUser: 'Rider #DRV-4028 (Vikram S.)',
    userRole: 'rider',
    riskScore: 94,
    details: 'Traveled 8.4 km in 42 seconds (speed >720 km/h). Fake GPS mock provider active on device.',
    detectedAt: '3 mins ago',
    status: 'PENDING',
  },
  {
    id: 'FRD-9040',
    type: 'COUPON_FARM',
    title: 'Sybil Coupon Farming (Same Device Hardware UUID)',
    targetUser: 'Customer #CUS-8194 (14 alias accounts)',
    userRole: 'customer',
    riskScore: 88,
    details: '14 new accounts created using identical IMEI & IP 192.168.1.104 to redeem ₹150 first-order voucher.',
    detectedAt: '12 mins ago',
    status: 'PENDING',
  },
  {
    id: 'FRD-9039',
    type: 'REFUND_ABUSE',
    title: 'Repetitive False "Food Missing" Claims',
    targetUser: 'Customer #CUS-5512 (Anjali K.)',
    userRole: 'customer',
    riskScore: 76,
    details: 'Claimed 6 consecutive full refunds in 4 days citing spilled food despite delivery photo confirmation.',
    detectedAt: '35 mins ago',
    status: 'PENDING',
  },
  {
    id: 'FRD-9038',
    type: 'MULTI_ACCOUNT',
    title: 'Duplicate Restaurant Listing & Order Sniping',
    targetUser: 'Restaurant #RST-109 (Cloud Biryani Co)',
    userRole: 'restaurant',
    riskScore: 81,
    details: 'Same kitchen address operating 4 duplicate listings accepting and instantly canceling partner orders.',
    detectedAt: '1 hour ago',
    status: 'PENDING',
  },
];

export default function FraudDetectionPage() {
  const [incidents, setIncidents] = useState<FraudIncident[]>(INITIAL_INCIDENTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  const handleAction = (id: string, newStatus: 'FROZEN' | 'RESOLVED' | 'DISMISSED') => {
    setIncidents(prev =>
      prev.map(item => (item.id === id ? { ...item, status: newStatus } : item))
    );
    if (newStatus === 'FROZEN') {
      toast.error(`Account frozen & payouts suspended for incident ${id}`);
    } else if (newStatus === 'RESOLVED') {
      toast.success(`Biometric KYC requested & incident marked resolved`);
    } else {
      toast.info(`Incident ${id} dismissed as benign false positive`);
    }
  };

  const filteredIncidents = incidents.filter(i => {
    const matchSearch =
      i.targetUser.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchType = filterType === 'all' || i.type === filterType;
    return matchSearch && matchType;
  });

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 text-xs font-bold gap-1">
              <ShieldAlert className="w-3.5 h-3.5" /> Risk Intelligence
            </Badge>
            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1" />
              Heuristic Engine Active
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
            Fraud, Anomaly &amp; Sybil Shield
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Real-time telemetry monitoring for mock GPS spoofing, voucher farming rings, and automated account abuse.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => toast.success('Telemetry streams synchronized!')}
            variant="outline"
            className="rounded-xl font-bold gap-2 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Scan Telemetry
          </Button>
          <Button
            onClick={() => toast.info('System rule: High risk (>85) triggers auto-wallet lock.')}
            className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold gap-2 text-xs shadow-md"
          >
            <Lock className="w-4 h-4" /> Global Guard Rules
          </Button>
        </div>
      </div>

      {/* Metric Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-border/80 bg-card">
          <CardContent className="p-4 sm:p-5 space-y-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">Loss Prevented Today</span>
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-foreground">₹42,850</p>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">From fake GPS &amp; voucher rings</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/80 bg-card">
          <CardContent className="p-4 sm:p-5 space-y-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">Pending Critical Flags</span>
              <AlertOctagon className="w-4 h-4 text-red-500" />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-red-500">4 Active</p>
            <p className="text-[11px] text-muted-foreground">Action required immediately</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/80 bg-card">
          <CardContent className="p-4 sm:p-5 space-y-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">Flagged Devices</span>
              <Smartphone className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-foreground">18 UUIDs</p>
            <p className="text-[11px] text-amber-500 font-medium">Blacklisted hardware fingerprints</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/80 bg-card">
          <CardContent className="p-4 sm:p-5 space-y-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">Auto-Frozen Wallets</span>
              <Lock className="w-4 h-4 text-primary" />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-foreground">7 Wallets</p>
            <p className="text-[11px] text-muted-foreground">Pending selfie biometric verification</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border/80">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search incident, user, or hardware ID..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs rounded-xl"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          {['all', 'GPS_SPOOF', 'COUPON_FARM', 'REFUND_ABUSE', 'MULTI_ACCOUNT'].map(type => (
            <Button
              key={type}
              size="sm"
              variant={filterType === type ? 'default' : 'ghost'}
              onClick={() => setFilterType(type)}
              className="text-xs rounded-xl h-8 shrink-0 capitalize"
            >
              {type.replace('_', ' ').toLowerCase()}
            </Button>
          ))}
        </div>
      </div>

      {/* Incidents Table */}
      <Card className="rounded-2xl border-border/80 bg-card overflow-hidden shadow-sm">
        <CardHeader className="bg-muted/20 border-b border-border/60 pb-4">
          <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
            <FileWarning className="w-4 h-4 text-red-500" />
            Real-time Flagged Incidents Queue ({filteredIncidents.length})
          </CardTitle>
          <CardDescription className="text-xs">
            Review anomalies detected by behavioral AI heuristics and execute containment actions.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/60">
            {filteredIncidents.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-xs">
                No incidents match the selected filter.
              </div>
            ) : (
              filteredIncidents.map(inc => {
                const isCritical = inc.riskScore >= 85;
                const isPending = inc.status === 'PENDING';

                return (
                  <div key={inc.id} className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/20 transition-colors">
                    <div className="space-y-1.5 max-w-2xl">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-muted-foreground">{inc.id}</span>
                        <Badge
                          className={`text-[10px] font-black ${
                            isCritical
                              ? 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30'
                              : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                          }`}
                        >
                          Risk Score: {inc.riskScore}/100
                        </Badge>
                        <Badge variant="outline" className="text-[10px] uppercase font-bold">
                          {inc.type.replace('_', ' ')}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">• {inc.detectedAt}</span>
                      </div>

                      <h4 className="font-bold text-sm text-foreground">{inc.title}</h4>
                      <p className="text-xs text-muted-foreground">{inc.details}</p>

                      <div className="flex items-center gap-2 pt-1 text-xs font-semibold text-foreground">
                        <span className="text-muted-foreground">Entity:</span>
                        <span>{inc.targetUser}</span>
                        <Badge variant="secondary" className="text-[10px] capitalize">
                          {inc.userRole}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                      {isPending ? (
                        <>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleAction(inc.id, 'FROZEN')}
                            className="rounded-xl text-xs font-bold h-8"
                          >
                            <UserX className="w-3.5 h-3.5 mr-1" /> Freeze Account
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAction(inc.id, 'RESOLVED')}
                            className="rounded-xl text-xs font-bold h-8"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Require KYC
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleAction(inc.id, 'DISMISSED')}
                            className="rounded-xl text-xs text-muted-foreground h-8"
                          >
                            Dismiss
                          </Button>
                        </>
                      ) : (
                        <Badge
                          className={`text-xs font-bold ${
                            inc.status === 'FROZEN'
                              ? 'bg-red-500/15 text-red-500 border-red-500/20'
                              : 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20'
                          }`}
                        >
                          Status: {inc.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
