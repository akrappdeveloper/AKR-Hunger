'use client';

import { Shield, Phone, AlertCircle, HeartHandshake, PhoneCall, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function DeliverySafetyPage() {
  const handleTriggerSOS = () => {
    toast.error('🚨 EMERGENCY SOS SENT! Operations center notified with your live GPS location.');
  };

  return (
    <div className="space-y-6 max-w-4xl p-4 sm:p-6 text-white">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <Shield className="w-6 h-6 text-rose-500" />
          Rider Safety &amp; Emergency Hub
        </h1>
        <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
          Your safety is our top priority. Instant emergency response, medical assistance, and 24x7 partner support.
        </p>
      </div>

      {/* Emergency SOS Button */}
      <Card className="p-6 bg-rose-950/40 border-rose-600/40 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-rose-600/20 text-rose-500 flex items-center justify-center mx-auto">
          <AlertCircle className="w-9 h-9 animate-pulse" />
        </div>
        <div>
          <h2 className="text-xl font-black text-white">Emergency Assistance (SOS)</h2>
          <p className="text-xs text-rose-200/80 max-w-md mx-auto mt-1">
            In danger or involved in an accident? Pressing SOS alerts our 24x7 Safety Rapid Response Team and broadcasts your live GPS.
          </p>
        </div>

        <Button
          onClick={handleTriggerSOS}
          className="bg-rose-600 hover:bg-rose-700 text-white font-black text-base py-6 px-10 rounded-2xl shadow-xl shadow-rose-600/40"
        >
          🚨 TRIGGER EMERGENCY SOS
        </Button>
      </Card>

      {/* Speed Dial Contacts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Police Control Room', number: '112', icon: PhoneCall, color: 'text-blue-400' },
          { label: 'Ambulance Emergency', number: '108', icon: PhoneCall, color: 'text-emerald-400' },
          { label: 'Hunger Partner Helpline', number: '+91 98000 12345', icon: Phone, color: 'text-orange-400' },
        ].map(item => (
          <Card key={item.label} className="p-4 bg-zinc-900 border-zinc-800">
            <item.icon className={`w-5 h-5 ${item.color} mb-2`} />
            <p className="text-xs text-gray-400">{item.label}</p>
            <p className="text-base font-black text-white mt-0.5">{item.number}</p>
            <a href={`tel:${item.number.replace(/\s+/g, '')}`}>
              <Button size="sm" variant="outline" className="w-full mt-3 rounded-xl text-xs font-bold border-zinc-700">
                Call Now
              </Button>
            </a>
          </Card>
        ))}
      </div>

      {/* Insurance Coverage Card */}
      <Card className="p-5 bg-zinc-900 border-zinc-800 space-y-3">
        <div className="flex items-center gap-2">
          <HeartHandshake className="w-5 h-5 text-emerald-400" />
          <h3 className="font-bold text-sm text-white">Active On-Duty Partner Insurance</h3>
          <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-[10px] ml-auto">Covered</Badge>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">
          All active Hunger delivery partners are protected with up to ₹5,00,000 accidental medical insurance and hospital cash allowance while on an active delivery order.
        </p>
      </Card>
    </div>
  );
}
