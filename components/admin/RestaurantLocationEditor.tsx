'use client';

import React, { useState, useCallback, lazy, Suspense } from 'react';
import { MapPin, Save, Loader2, Navigation, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const MapLocationPicker = lazy(() => import('@/components/customer/MapLocationPicker'));

interface RestaurantLocationEditorProps {
  restaurantId: string;
  initialData?: {
    latitude?: number;
    longitude?: number;
    geohash?: string;
    street?: string;
    locality?: string;
    city?: string;
    state?: string;
    pincode?: string;
    formattedAddress?: string;
  };
  onSaved?: () => void;
}

/**
 * Admin component for editing a restaurant's location.
 * Includes an interactive map picker, geocoded address fields,
 * and server-side geohash generation.
 */
export default function RestaurantLocationEditor({
  restaurantId,
  initialData = {},
  onSaved,
}: RestaurantLocationEditorProps) {
  const [latitude, setLatitude] = useState(initialData.latitude || 0);
  const [longitude, setLongitude] = useState(initialData.longitude || 0);
  const [geohash, setGeohash] = useState(initialData.geohash || '');
  const [street, setStreet] = useState(initialData.street || '');
  const [locality, setLocality] = useState(initialData.locality || '');
  const [city, setCity] = useState(initialData.city || '');
  const [state, setState] = useState(initialData.state || '');
  const [pincode, setPincode] = useState(initialData.pincode || '');
  const [formattedAddress, setFormattedAddress] = useState(initialData.formattedAddress || '');
  const [saving, setSaving] = useState(false);
  const [showMap, setShowMap] = useState(false);

  const handleSave = useCallback(async () => {
    if (!latitude || !longitude || (latitude === 0 && longitude === 0)) {
      toast.error('Please set valid coordinates using the map picker');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/restaurants/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId,
          latitude,
          longitude,
          street,
          locality,
          city,
          state,
          pincode,
          formattedAddress,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setGeohash(data.geohash);
        toast.success(`Location updated! Geohash: ${data.geohash}`);
        onSaved?.();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to update location');
      }
    } catch (e) {
      toast.error('Network error while saving');
    } finally {
      setSaving(false);
    }
  }, [restaurantId, latitude, longitude, street, locality, city, state, pincode, formattedAddress, onSaved]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-500 flex items-center justify-center">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm">Restaurant Location</h3>
            <p className="text-[11px] text-muted-foreground">Set coordinates and address for delivery eligibility</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMap(!showMap)}
            className="text-xs font-bold rounded-lg gap-1"
          >
            <Navigation className="w-3.5 h-3.5" />
            {showMap ? 'Hide Map' : 'Open Map'}
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="text-xs font-bold rounded-lg gap-1"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Location
          </Button>
        </div>
      </div>

      {/* Current Coordinates + Geohash */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-[11px] font-bold text-foreground block mb-1">Latitude</label>
          <Input
            type="number"
            step="0.00001"
            value={latitude || ''}
            onChange={e => setLatitude(parseFloat(e.target.value) || 0)}
            className="h-9 text-xs rounded-lg font-mono"
          />
        </div>
        <div>
          <label className="text-[11px] font-bold text-foreground block mb-1">Longitude</label>
          <Input
            type="number"
            step="0.00001"
            value={longitude || ''}
            onChange={e => setLongitude(parseFloat(e.target.value) || 0)}
            className="h-9 text-xs rounded-lg font-mono"
          />
        </div>
        <div>
          <label className="text-[11px] font-bold text-foreground block mb-1">Geohash</label>
          <div className="h-9 flex items-center px-3 rounded-lg border border-border bg-muted/50 text-xs font-mono text-muted-foreground">
            {geohash || 'Auto-generated on save'}
          </div>
        </div>
      </div>

      {/* Map Picker */}
      {showMap && (
        <Suspense fallback={
          <div className="flex items-center justify-center h-[300px] bg-muted/40 rounded-2xl border border-border">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        }>
          <MapLocationPicker
            initialLat={latitude || 28.6139}
            initialLon={longitude || 77.2090}
            height="350px"
            onClose={() => setShowMap(false)}
            onLocationConfirmed={(loc) => {
              setLatitude(loc.latitude);
              setLongitude(loc.longitude);
              setStreet(loc.street);
              setLocality(loc.locality);
              setCity(loc.city);
              setState(loc.state);
              setPincode(loc.pincode);
              setFormattedAddress(loc.formattedAddress);
              setShowMap(false);
              toast.success('Location picked from map — click Save to apply');
            }}
          />
        </Suspense>
      )}

      {/* Address Fields */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] font-bold text-foreground block mb-1">Street</label>
          <Input value={street} onChange={e => setStreet(e.target.value)} className="h-9 text-xs rounded-lg" />
        </div>
        <div>
          <label className="text-[11px] font-bold text-foreground block mb-1">Locality</label>
          <Input value={locality} onChange={e => setLocality(e.target.value)} className="h-9 text-xs rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-[11px] font-bold text-foreground block mb-1">City</label>
          <Input value={city} onChange={e => setCity(e.target.value)} className="h-9 text-xs rounded-lg" />
        </div>
        <div>
          <label className="text-[11px] font-bold text-foreground block mb-1">State</label>
          <Input value={state} onChange={e => setState(e.target.value)} className="h-9 text-xs rounded-lg" />
        </div>
        <div>
          <label className="text-[11px] font-bold text-foreground block mb-1">Pincode</label>
          <Input value={pincode} onChange={e => setPincode(e.target.value)} maxLength={6} className="h-9 text-xs rounded-lg font-mono" />
        </div>
      </div>

      {/* Formatted Address Preview */}
      {formattedAddress && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/50 border border-border">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground line-clamp-2">{formattedAddress}</p>
        </div>
      )}
    </div>
  );
}
