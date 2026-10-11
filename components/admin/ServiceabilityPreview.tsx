'use client';

import React, { useState, useCallback } from 'react';
import { MapPin, Search, Loader2, CheckCircle2, XCircle, Route, Clock, IndianRupee, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { RestaurantDiscoveryResult } from '@/lib/types';

/**
 * Admin Serviceability Preview Tool
 *
 * Enter a customer PIN code or coordinates to test which restaurants
 * can deliver there. Shows road distance, ETA, fees, and eligibility
 * reason for each restaurant.
 */
export default function ServiceabilityPreview() {
  const [pincode, setPincode] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<RestaurantDiscoveryResult[]>([]);
  const [meta, setMeta] = useState<{ total: number; eligible: number } | null>(null);

  const handleCheck = useCallback(async () => {
    let lat = parseFloat(latitude);
    let lon = parseFloat(longitude);

    // If pincode provided but no coords, try geocoding
    if ((!lat || !lon) && pincode.length === 6) {
      try {
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&postalcode=${pincode}&country=India&limit=1`,
          { headers: { 'User-Agent': 'HungerAdmin/1.0' } }
        );
        const geoData = await geoRes.json();
        if (geoData.length > 0) {
          lat = parseFloat(geoData[0].lat);
          lon = parseFloat(geoData[0].lon);
          setLatitude(lat.toString());
          setLongitude(lon.toString());
        } else {
          toast.error('Could not geocode this PIN code');
          return;
        }
      } catch (e) {
        toast.error('Geocoding service unavailable');
        return;
      }
    }

    if (!lat || !lon) {
      toast.error('Please enter coordinates or a valid 6-digit PIN code');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/delivery/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerLat: lat,
          customerLon: lon,
          radiusKm: 15,
          maxResults: 100,
          sortBy: 'distance',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
        setMeta(data.meta || null);
        toast.success(`Found ${data.meta?.total || 0} restaurants, ${data.meta?.eligible || 0} eligible`);
      } else {
        toast.error('Discovery API failed');
      }
    } catch (e) {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  }, [pincode, latitude, longitude]);

  return (
    <div className="space-y-5">
      {/* Search Inputs */}
      <div className="p-5 rounded-2xl border border-border bg-card space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-500 flex items-center justify-center">
            <Search className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm">Serviceability Preview</h3>
            <p className="text-[11px] text-muted-foreground">Test delivery eligibility for any location in India</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-[11px] font-bold block mb-1">PIN Code</label>
            <Input
              value={pincode}
              onChange={e => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="e.g. 226028"
              maxLength={6}
              className="h-9 text-xs rounded-lg font-mono"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold block mb-1">Latitude</label>
            <Input
              value={latitude}
              onChange={e => setLatitude(e.target.value)}
              placeholder="e.g. 26.8467"
              className="h-9 text-xs rounded-lg font-mono"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold block mb-1">Longitude</label>
            <Input
              value={longitude}
              onChange={e => setLongitude(e.target.value)}
              placeholder="e.g. 80.9462"
              className="h-9 text-xs rounded-lg font-mono"
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={handleCheck}
              disabled={loading}
              className="w-full h-9 text-xs font-bold rounded-lg gap-1"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              Check
            </Button>
          </div>
        </div>
      </div>

      {/* Results Summary */}
      {meta && (
        <div className="flex gap-3">
          <div className="flex-1 p-3 rounded-xl border border-border bg-card text-center">
            <p className="text-2xl font-black text-foreground">{meta.total}</p>
            <p className="text-[11px] text-muted-foreground font-bold">Total Found</p>
          </div>
          <div className="flex-1 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-center">
            <p className="text-2xl font-black text-emerald-600">{meta.eligible}</p>
            <p className="text-[11px] text-emerald-600 font-bold">Eligible</p>
          </div>
          <div className="flex-1 p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-center">
            <p className="text-2xl font-black text-red-600">{meta.total - meta.eligible}</p>
            <p className="text-[11px] text-red-600 font-bold">Ineligible</p>
          </div>
        </div>
      )}

      {/* Results Table */}
      {results.length > 0 && (
        <div className="rounded-2xl border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left p-3 font-bold">Restaurant</th>
                <th className="text-center p-3 font-bold">Status</th>
                <th className="text-center p-3 font-bold">Road Distance</th>
                <th className="text-center p-3 font-bold">ETA</th>
                <th className="text-center p-3 font-bold">Fee</th>
                <th className="text-left p-3 font-bold">Reason</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={r.restaurant.id || i} className={`border-b border-border/50 ${r.eligibility.eligible ? '' : 'opacity-60'}`}>
                  <td className="p-3 font-bold">{r.restaurant.name}</td>
                  <td className="p-3 text-center">
                    {r.eligibility.eligible ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500 mx-auto" />
                    )}
                  </td>
                  <td className="p-3 text-center font-mono">
                    {r.eligibility.roadDistanceMeters > 0
                      ? `${(r.eligibility.roadDistanceMeters / 1000).toFixed(1)} km`
                      : '—'}
                  </td>
                  <td className="p-3 text-center">
                    {r.eligibility.estimatedDeliveryMinutes > 0
                      ? `${r.eligibility.estimatedDeliveryMinutes} min`
                      : '—'}
                  </td>
                  <td className="p-3 text-center font-bold">
                    {r.eligibility.deliveryFee
                      ? `₹${r.eligibility.deliveryFee}`
                      : '—'}
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      r.eligibility.reasonCode === 'DELIVERABLE'
                        ? 'bg-emerald-500/15 text-emerald-600'
                        : 'bg-red-500/15 text-red-600'
                    }`}>
                      {r.eligibility.reasonCode}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
