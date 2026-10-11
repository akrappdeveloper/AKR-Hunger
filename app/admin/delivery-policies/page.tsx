'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Settings2, Save, RotateCcw, Loader2, MapPin, Truck, IndianRupee, Clock, ToggleLeft, ToggleRight, Shield, Zap } from 'lucide-react';

interface DeliverySettings {
  standardMaxRadiusKm: number;
  extendedMaxRadiusKm: number;
  longDistanceMaxKm: number;
  defaultPreparationMinutes: number;
  dispatchBufferMinutes: number;
  pickupHandoffBufferMinutes: number;
  baseFee: number;
  perKmCharge: number;
  minimumDeliveryFee: number;
  peakHourMultiplier: number;
  taxRate: number;
  extendedDeliveryGlobalEnabled: boolean;
  longDistanceGlobalEnabled: boolean;
}

const DEFAULTS: DeliverySettings = {
  standardMaxRadiusKm: 10,
  extendedMaxRadiusKm: 20,
  longDistanceMaxKm: 100,
  defaultPreparationMinutes: 20,
  dispatchBufferMinutes: 5,
  pickupHandoffBufferMinutes: 3,
  baseFee: 20,
  perKmCharge: 5,
  minimumDeliveryFee: 15,
  peakHourMultiplier: 1.0,
  taxRate: 0.05,
  extendedDeliveryGlobalEnabled: false,
  longDistanceGlobalEnabled: false,
};

export default function DeliveryPoliciesPage() {
  const [settings, setSettings] = useState<DeliverySettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/policies');
      if (res.ok) {
        const data = await res.json();
        setSettings({ ...DEFAULTS, ...data.settings });
      }
    } catch (err) {
      console.error('Failed to fetch delivery policies:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/delivery/policies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      if (res.ok) {
        toast.success('Delivery policies updated successfully!');
      } else {
        toast.error('Failed to update policies');
      }
    } catch (err) {
      toast.error('Network error while saving');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(DEFAULTS);
    toast.info('Reset to default values (not saved yet)');
  };

  const updateField = (key: keyof DeliverySettings, value: number | boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/25">
              <Settings2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">Delivery Policies</h1>
              <p className="text-sm text-muted-foreground">Configure platform-wide delivery radius, fees & timing</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="px-4 py-2 rounded-xl text-xs font-bold border border-border hover:bg-muted transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Defaults
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25 flex items-center gap-1.5 disabled:opacity-50 transition-all"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Changes
            </button>
          </div>
        </div>

        {/* Section: Delivery Radius */}
        <section className="p-5 rounded-2xl border border-border bg-card space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-500 flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base">Delivery Radius</h2>
              <p className="text-xs text-muted-foreground">Max road distance limits for delivery eligibility</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SettingInput label="Standard Max (km)" value={settings.standardMaxRadiusKm} onChange={v => updateField('standardMaxRadiusKm', v)} min={1} max={50} />
            <SettingInput label="Extended Max (km)" value={settings.extendedMaxRadiusKm} onChange={v => updateField('extendedMaxRadiusKm', v)} min={5} max={100} />
            <SettingInput label="Long Distance Max (km)" value={settings.longDistanceMaxKm} onChange={v => updateField('longDistanceMaxKm', v)} min={10} max={500} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <ToggleSetting
              label="Extended Delivery"
              description="Allow restaurants to opt-in to extended radius"
              enabled={settings.extendedDeliveryGlobalEnabled}
              onChange={v => updateField('extendedDeliveryGlobalEnabled', v)}
            />
            <ToggleSetting
              label="Long-Distance Delivery"
              description="Allow delivery beyond extended radius"
              enabled={settings.longDistanceGlobalEnabled}
              onChange={v => updateField('longDistanceGlobalEnabled', v)}
            />
          </div>
        </section>

        {/* Section: Pricing */}
        <section className="p-5 rounded-2xl border border-border bg-card space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
              <IndianRupee className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base">Delivery Pricing</h2>
              <p className="text-xs text-muted-foreground">Fee calculation parameters</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SettingInput label="Base Fee (₹)" value={settings.baseFee} onChange={v => updateField('baseFee', v)} min={0} max={200} />
            <SettingInput label="Per Km Charge (₹)" value={settings.perKmCharge} onChange={v => updateField('perKmCharge', v)} min={0} max={50} step={0.5} />
            <SettingInput label="Minimum Fee (₹)" value={settings.minimumDeliveryFee} onChange={v => updateField('minimumDeliveryFee', v)} min={0} max={100} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SettingInput label="Peak Hour Multiplier (×)" value={settings.peakHourMultiplier} onChange={v => updateField('peakHourMultiplier', v)} min={1} max={3} step={0.1} />
            <SettingInput label="Tax Rate (%)" value={settings.taxRate * 100} onChange={v => updateField('taxRate', v / 100)} min={0} max={28} step={0.5} />
          </div>
        </section>

        {/* Section: Timing */}
        <section className="p-5 rounded-2xl border border-border bg-card space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-500/15 text-orange-500 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base">Timing & Buffers</h2>
              <p className="text-xs text-muted-foreground">Default preparation and dispatch timing buffers</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SettingInput label="Default Prep (min)" value={settings.defaultPreparationMinutes} onChange={v => updateField('defaultPreparationMinutes', v)} min={5} max={60} />
            <SettingInput label="Dispatch Buffer (min)" value={settings.dispatchBufferMinutes} onChange={v => updateField('dispatchBufferMinutes', v)} min={0} max={30} />
            <SettingInput label="Pickup Handoff (min)" value={settings.pickupHandoffBufferMinutes} onChange={v => updateField('pickupHandoffBufferMinutes', v)} min={0} max={15} />
          </div>
        </section>

        {/* Security Notice */}
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-sm">
          <Shield className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-bold text-foreground">Server-Side Enforcement</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              All delivery fees, eligibility decisions, and distance calculations are validated server-side.
              Client apps cannot override these settings.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// -- Reusable Setting Components --

function SettingInput({
  label, value, onChange, min = 0, max = 100, step = 1,
}: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number;
}) {
  return (
    <div>
      <label className="text-xs font-bold text-foreground block mb-1.5">{label}</label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-full h-10 px-3 rounded-xl border border-border bg-card text-foreground text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
      />
    </div>
  );
}

function ToggleSetting({
  label, description, enabled, onChange,
}: {
  label: string; description: string; enabled: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left w-full ${
        enabled
          ? 'border-emerald-500/50 bg-emerald-500/10'
          : 'border-border bg-muted/30 hover:bg-muted/50'
      }`}
    >
      {enabled ? (
        <ToggleRight className="w-6 h-6 text-emerald-500 flex-shrink-0" />
      ) : (
        <ToggleLeft className="w-6 h-6 text-muted-foreground flex-shrink-0" />
      )}
      <div>
        <p className="text-sm font-bold text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}
