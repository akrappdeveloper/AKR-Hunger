'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  MapPin,
  Search,
  LocateFixed,
  CheckCircle2,
  Loader2,
  Navigation,
  Compass,
  X,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

export interface PickedLocation {
  address: string;
  formattedAddress: string;
  street?: string;
  area?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
}

interface MapPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLocationSelect: (location: PickedLocation) => void;
  initialLat?: number;
  initialLng?: number;
  initialAddress?: string;
  title?: string;
}

// 100% Free OpenStreetMap tiles — zero API key, no watermarks
const TILE_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  name: 'OpenStreetMap',
  sources: {
    osm: {
      type: 'raster',
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'osm-tiles',
      type: 'raster',
      source: 'osm',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

export default function MapPickerDialog({
  open,
  onOpenChange,
  onLocationSelect,
  initialLat,
  initialLng,
  initialAddress = '',
  title = 'Pick Restaurant Location on Map',
}: MapPickerDialogProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  // Default to New Delhi (28.6139, 77.2090) if no coords
  const defaultLat = initialLat && !isNaN(initialLat) ? initialLat : 28.6139;
  const defaultLng = initialLng && !isNaN(initialLng) ? initialLng : 77.2090;

  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number }>({
    lat: defaultLat,
    lng: defaultLng,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [locatingGps, setLocatingGps] = useState(false);
  const [isPinBouncing, setIsPinBouncing] = useState(false);

  // Address components
  const [formattedAddress, setFormattedAddress] = useState(initialAddress || '');
  const [street, setStreet] = useState('');
  const [area, setArea] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [pincodeStatus, setPincodeStatus] = useState<{ verified: boolean; message: string }>({
    verified: false,
    message: '',
  });

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Helper: Verify Indian 6-digit Pincode with India Post API
  const verifyPostalPincode = useCallback(async (code: string) => {
    const cleanPin = code.replace(/\D/g, '').slice(0, 6);
    if (cleanPin.length !== 6) {
      setPincodeStatus({ verified: false, message: 'Enter a valid 6-digit pincode' });
      return;
    }

    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${cleanPin}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.[0]?.Status === 'Success' && data[0].PostOffice?.length > 0) {
          const po = data[0].PostOffice[0];
          setPincodeStatus({
            verified: true,
            message: `Verified: ${po.District || po.Name}, ${po.State}`,
          });
          // Only auto-fill city/state if currently empty
          setCity((prev) => prev || po.District || po.Block || '');
          setState((prev) => prev || po.State || '');
          return;
        }
      }
      setPincodeStatus({ verified: false, message: 'Unverified postal circle' });
    } catch {
      setPincodeStatus({ verified: false, message: 'Could not verify with postal registry' });
    }
  }, []);

  // 1. Multi-Tier High-Accuracy Reverse Geocoding
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    setGeocoding(true);
    try {
      let resolvedStreet = '';
      let resolvedArea = '';
      let resolvedCity = '';
      let resolvedState = '';
      let resolvedPincode = '';
      let resolvedFull = '';

      // Tier 1: OpenStreetMap Nominatim
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'AKR-Hunger-Restaurant-Location-Picker/2.0' },
        });
        if (res.ok) {
          const data = await res.json();
          const addr = data.address || {};

          resolvedStreet = addr.road || addr.street || addr.building || addr.suburb || '';
          resolvedArea = addr.suburb || addr.neighbourhood || addr.residential || addr.quarter || '';
          resolvedCity = addr.city || addr.town || addr.village || addr.county || addr.state_district || '';
          resolvedState = addr.state || '';

          // Look for 6-digit PIN in postcode field
          if (addr.postcode && /^[1-9][0-9]{5}$/.test(addr.postcode.trim())) {
            resolvedPincode = addr.postcode.trim();
          } else if (data.display_name) {
            // Fallback: extract 6-digit PIN from full display name
            const match = data.display_name.match(/\b([1-9][0-9]{5})\b/);
            if (match) {
              resolvedPincode = match[1];
            }
          }
          resolvedFull = data.display_name || '';
        }
      } catch (nominatimErr) {
        console.warn('Nominatim reverse geocode notice:', nominatimErr);
      }

      // Tier 2: BigDataCloud Reverse Geocoding for India (if pincode or city missing)
      if (!resolvedPincode || !resolvedCity) {
        try {
          const bdcRes = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
          );
          if (bdcRes.ok) {
            const bdcData = await bdcRes.json();
            if (!resolvedPincode && bdcData.postcode && /^[1-9][0-9]{5}$/.test(bdcData.postcode)) {
              resolvedPincode = bdcData.postcode;
            }
            if (!resolvedCity && (bdcData.city || bdcData.locality)) {
              resolvedCity = bdcData.city || bdcData.locality;
            }
            if (!resolvedState && bdcData.principalSubdivision) {
              resolvedState = bdcData.principalSubdivision;
            }
          }
        } catch (bdcErr) {
          console.warn('BigDataCloud geocode notice:', bdcErr);
        }
      }

      setStreet(resolvedStreet);
      setArea(resolvedArea);
      setCity(resolvedCity);
      setState(resolvedState);
      setPincode(resolvedPincode);

      const generatedAddress = [resolvedStreet, resolvedArea, resolvedCity, resolvedState, resolvedPincode]
        .filter(Boolean)
        .join(', ');
      setFormattedAddress(resolvedFull || generatedAddress || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);

      if (resolvedPincode) {
        verifyPostalPincode(resolvedPincode);
      } else {
        setPincodeStatus({ verified: false, message: 'Please enter your 6-digit pincode' });
      }
    } catch (err) {
      console.warn('Reverse geocoding error:', err);
    } finally {
      setGeocoding(false);
    }
  }, [verifyPostalPincode]);

  // 2. Initialize Map when Dialog opens
  useEffect(() => {
    if (!open) {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      return;
    }

    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return;

      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: TILE_STYLE,
        center: [defaultLng, defaultLat],
        zoom: 15,
        attributionControl: false,
      });

      map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');

      map.on('movestart', () => {
        setIsPinBouncing(true);
      });

      map.on('move', () => {
        const center = map.getCenter();
        setCurrentCoords({ lat: center.lat, lng: center.lng });
      });

      map.on('moveend', () => {
        setIsPinBouncing(false);
        const center = map.getCenter();
        const newLat = center.lat;
        const newLng = center.lng;
        setCurrentCoords({ lat: newLat, lng: newLng });

        // Debounce reverse geocoding
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
          reverseGeocode(newLat, newLng);
        }, 400);
      });

      mapRef.current = map;

      // Initial reverse geocode
      reverseGeocode(defaultLat, defaultLng);
    }, 200);

    return () => {
      clearTimeout(timer);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [open, defaultLat, defaultLng, reverseGeocode]);

  // 3. User GPS Locator (High Accuracy)
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocatingGps(false);
        const { latitude, longitude } = pos.coords;
        setCurrentCoords({ lat: latitude, lng: longitude });

        if (mapRef.current) {
          mapRef.current.flyTo({
            center: [longitude, latitude],
            zoom: 17,
            speed: 1.5,
          });
        }
        reverseGeocode(latitude, longitude);
        toast.success('📍 Centered to your exact GPS location!');
      },
      (err) => {
        setLocatingGps(false);
        toast.error('Could not get GPS location: ' + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // 4. Search Address via Nominatim
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        searchQuery.trim()
      )}&countrycodes=in&limit=5`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'AKR-Hunger-Restaurant-Location-Picker/2.0' },
      });
      if (res.ok) {
        const results = await res.json();
        setSearchResults(results);
        if (results.length === 0) {
          toast.info('No places found. Try entering nearby landmark or pincode.');
        }
      }
    } catch {
      toast.error('Search failed. Check your internet connection.');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectSearchResult = (result: any) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setCurrentCoords({ lat, lng });
    setSearchResults([]);
    setSearchQuery('');

    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [lng, lat],
        zoom: 17,
        speed: 1.5,
      });
    }
    reverseGeocode(lat, lng);
  };

  // 5. Confirm Location Callback
  const handleConfirm = () => {
    if (!street && !formattedAddress && !city) {
      toast.error('Please select or specify your restaurant address');
      return;
    }

    const cleanPin = pincode.replace(/\D/g, '').slice(0, 6);

    const fullStreetAddress = street || formattedAddress.split(',')[0] || 'Restaurant Location';
    const finalFormatted = `${fullStreetAddress}, ${city || ''}${state ? `, ${state}` : ''}${cleanPin ? ` - ${cleanPin}` : ''
      }`.trim();

    const payload: PickedLocation = {
      address: fullStreetAddress,
      formattedAddress: finalFormatted,
      street: fullStreetAddress,
      area: area || '',
      city: city || 'City',
      state: state || 'State',
      pincode: cleanPin,
      latitude: parseFloat(currentCoords.lat.toFixed(6)),
      longitude: parseFloat(currentCoords.lng.toFixed(6)),
    };

    onLocationSelect(payload);
    toast.success(`📍 Confirmed: ${fullStreetAddress} (PIN: ${cleanPin || 'Set'})`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] p-0 overflow-hidden bg-gray-950 border border-white/10 text-white rounded-3xl shadow-2xl flex flex-col max-h-[90vh]">
        <DialogHeader className="p-4 sm:p-5 border-b border-white/10 bg-gray-900/60 flex flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black text-white">{title}</DialogTitle>
              <DialogDescription className="text-xs text-gray-400">
                Move map to place pin at your shop entrance. Real coordinates & postal code auto-resolve.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Search Bar & GPS Controls */}
        <div className="p-3 bg-gray-900/40 border-b border-white/5 flex gap-2 relative z-20 shrink-0">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search area, landmark, street, or pincode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 bg-black/60 border-white/10 text-white text-xs placeholder:text-gray-500 rounded-xl"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <Button
              type="submit"
              disabled={searching}
              className="h-10 px-4 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl shrink-0"
            >
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
            </Button>
          </form>

          <Button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={locatingGps}
            variant="outline"
            className="h-10 border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-xs font-bold rounded-xl gap-1.5 shrink-0"
            title="Locate my GPS position"
          >
            {locatingGps ? <Loader2 className="w-4 h-4 animate-spin text-orange-400" /> : <LocateFixed className="w-4 h-4 text-orange-400" />}
            <span className="hidden sm:inline">My Live GPS</span>
          </Button>
        </div>

        {/* Search Autocomplete Dropdown */}
        {searchResults.length > 0 && (
          <div className="absolute top-[125px] left-3 right-3 z-30 bg-gray-900/95 backdrop-blur-xl border border-white/15 rounded-2xl p-2 shadow-2xl max-h-56 overflow-y-auto">
            {searchResults.map((item, idx) => (
              <div
                key={idx}
                onClick={() => handleSelectSearchResult(item)}
                className="p-2.5 hover:bg-white/10 rounded-xl cursor-pointer text-xs flex items-start gap-2.5 transition-colors border-b border-white/5 last:border-0"
              >
                <MapPin className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                <span className="text-gray-200 line-clamp-2">{item.display_name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Map Container Area */}
        <div className="relative w-full h-[280px] sm:h-[340px] bg-gray-950 overflow-hidden shrink-0">
          <div ref={mapContainerRef} className="w-full h-full" />

          {/* Center Stationary Interactive Marker Pin */}
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-10">
            <div
              className={`transform transition-transform duration-200 flex flex-col items-center ${isPinBouncing ? '-translate-y-4 scale-110' : '-translate-y-2 scale-100'
                }`}
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-red-600 to-orange-500 border-2 border-white flex items-center justify-center text-white shadow-2xl shadow-red-600/60 ring-4 ring-orange-500/20">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <div className="w-1 h-3 bg-red-600 rounded-b-full shadow-md" />
            </div>

            <div
              className={`w-4 h-1.5 bg-black/60 rounded-full blur-[1px] transition-all duration-200 ${isPinBouncing ? 'scale-75 opacity-40' : 'scale-100 opacity-80'
                }`}
            />
          </div>

          {/* Coordinates Overlay pill */}
          <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-[11px] font-mono text-gray-200 pointer-events-none shadow-lg flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>GPS: {currentCoords.lat.toFixed(6)}, {currentCoords.lng.toFixed(6)}</span>
          </div>

          {/* Geocoding indicator */}
          {geocoding && (
            <div className="absolute top-3 right-14 bg-black/85 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-xs text-orange-400 font-semibold shadow-lg flex items-center gap-1.5 animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Resolving real address...
            </div>
          )}
        </div>

        {/* Real Address & Real Pincode Form Section */}
        <div className="p-4 sm:p-5 bg-gray-900/95 border-t border-white/10 space-y-3.5 overflow-y-auto">
          {/* Address Line 1 */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-7">
              <label className="text-[11px] font-bold text-gray-300 block mb-1 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-orange-400" />
                Street Address / Landmark
              </label>
              <Input
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="e.g. Shop 4, MG Road, Near Metro Station"
                className="h-9 text-xs bg-black/60 border-white/10 text-white rounded-xl focus:border-orange-500"
              />
            </div>

            {/* REAL PINCODE INPUT FIELD WITH VALIDATION */}
            <div className="sm:col-span-5">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-orange-300 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-orange-400" />
                  Real Pincode (6 Digits) *
                </label>
                {pincodeStatus.verified && (
                  <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Postal Match
                  </span>
                )}
              </div>
              <div className="relative">
                <Input
                  value={pincode}
                  maxLength={6}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setPincode(val);
                    if (val.length === 6) {
                      verifyPostalPincode(val);
                    } else {
                      setPincodeStatus({ verified: false, message: 'Enter 6 digits' });
                    }
                  }}
                  placeholder="e.g. 110001"
                  className="h-9 text-xs font-mono font-bold bg-black/60 border-orange-500/40 text-orange-200 rounded-xl focus:border-orange-500 pr-16"
                />
                <button
                  type="button"
                  onClick={() => verifyPostalPincode(pincode)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-orange-400 hover:text-orange-300 bg-orange-500/10 hover:bg-orange-500/20 px-2 py-0.5 rounded-lg border border-orange-500/20"
                >
                  Verify
                </button>
              </div>
              {pincodeStatus.message && (
                <p className={`text-[10px] mt-1 ${pincodeStatus.verified ? 'text-emerald-400' : 'text-gray-400'}`}>
                  {pincodeStatus.message}
                </p>
              )}
            </div>
          </div>

          {/* City & State */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-gray-300 block mb-1">City / District</label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
                className="h-9 text-xs bg-black/60 border-white/10 text-white rounded-xl"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-300 block mb-1">State</label>
              <Input
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="State"
                className="h-9 text-xs bg-black/60 border-white/10 text-white rounded-xl"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-white/5">
            <div className="text-[11px] text-gray-400 flex items-center gap-1.5 self-start sm:self-center">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Riders will navigate directly to coordinates: <strong>{currentCoords.lat.toFixed(4)}°, {currentCoords.lng.toFixed(4)}°</strong></span>
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                type="button"
                onClick={() => onOpenChange(false)}
                className="flex-1 sm:flex-initial h-10 border-white/10 text-gray-300 hover:text-white hover:bg-white/5 rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleConfirm}
                disabled={geocoding}
                className="flex-1 sm:flex-initial h-10 px-5 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-orange-600/30 gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                Confirm Location & Pincode
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
