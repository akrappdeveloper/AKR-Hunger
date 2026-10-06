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

// Free CartoCDN tiles (smooth, fast, high-res)
const TILE_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  name: 'CartoVoyager',
  sources: {
    carto: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'carto-tiles',
      type: 'raster',
      source: 'carto',
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

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Reverse Geocoding with OpenStreetMap Nominatim
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    setGeocoding(true);
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'AKR-Hunger-Restaurant-Location-Picker/1.0' },
      });
      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};

        const resStreet = addr.road || addr.street || addr.suburb || '';
        const resArea = addr.neighbourhood || addr.suburb || addr.residential || '';
        const resCity = addr.city || addr.town || addr.village || addr.county || addr.state_district || '';
        const resState = addr.state || '';
        const resPincode = addr.postcode || '';

        setStreet(resStreet);
        setArea(resArea);
        setCity(resCity);
        setState(resState);
        setPincode(resPincode);

        const displayName = data.display_name || `${resStreet}, ${resCity}, ${resState} ${resPincode}`.trim();
        setFormattedAddress(displayName);
      }
    } catch (err) {
      console.warn('Reverse geocoding notice:', err);
    } finally {
      setGeocoding(false);
    }
  }, []);

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
        }, 350);
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
        toast.success('Centered to your GPS location!');
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
        headers: { 'User-Agent': 'AKR-Hunger-Restaurant-Location-Picker/1.0' },
      });
      if (res.ok) {
        const results = await res.json();
        setSearchResults(results);
        if (results.length === 0) {
          toast.info('No places found. Try another search term.');
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
    if (!formattedAddress && !street && !city) {
      toast.error('Please wait for address to resolve or select a location');
      return;
    }

    const payload: PickedLocation = {
      address: formattedAddress || `${street}, ${city}`,
      formattedAddress: formattedAddress || `${street}, ${city}, ${state} ${pincode}`.trim(),
      street,
      area,
      city: city || 'City',
      state: state || 'State',
      pincode: pincode || '',
      latitude: parseFloat(currentCoords.lat.toFixed(6)),
      longitude: parseFloat(currentCoords.lng.toFixed(6)),
    };

    onLocationSelect(payload);
    toast.success('Location updated successfully!');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] p-0 overflow-hidden bg-gray-950 border border-white/10 text-white rounded-3xl shadow-2xl">
        <DialogHeader className="p-4 sm:p-5 border-b border-white/10 bg-gray-900/60 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black text-white">{title}</DialogTitle>
              <DialogDescription className="text-xs text-gray-400">
                Drag map to place the pin precisely on your restaurant's entrance
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Search Bar & GPS Controls */}
        <div className="p-3 bg-gray-900/40 border-b border-white/5 flex gap-2 relative z-20">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search area, landmark, or street..."
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
            className="h-10 border-white/10 bg-black/40 hover:bg-white/10 text-white text-xs font-semibold rounded-xl gap-1.5 shrink-0"
            title="Locate my GPS position"
          >
            {locatingGps ? <Loader2 className="w-4 h-4 animate-spin text-orange-400" /> : <LocateFixed className="w-4 h-4 text-orange-400" />}
            <span className="hidden sm:inline">My GPS</span>
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
        <div className="relative w-full h-[360px] sm:h-[420px] bg-gray-950 overflow-hidden">
          <div ref={mapContainerRef} className="w-full h-full" />

          {/* Center Stationary Interactive Marker Pin (Exactly like MapPickerDialog.java) */}
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-10">
            {/* The Pin Image with bounce transition */}
            <div
              className={`transform transition-transform duration-200 flex flex-col items-center ${isPinBouncing ? '-translate-y-4 scale-110' : '-translate-y-2 scale-100'
                }`}
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-red-600 to-orange-500 border-2 border-white flex items-center justify-center text-white shadow-2xl shadow-red-600/60 ring-4 ring-orange-500/20">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <div className="w-1 h-3 bg-red-600 rounded-b-full shadow-md" />
            </div>

            {/* Dropped shadow below pin tip */}
            <div
              className={`w-4 h-1.5 bg-black/60 rounded-full blur-[1px] transition-all duration-200 ${isPinBouncing ? 'scale-75 opacity-40' : 'scale-100 opacity-80'
                }`}
            />
          </div>

          {/* Coordinates Overlay pill */}
          <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-[11px] font-mono text-gray-300 pointer-events-none shadow-lg flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{currentCoords.lat.toFixed(6)}, {currentCoords.lng.toFixed(6)}</span>
          </div>

          {/* Geocoding indicator */}
          {geocoding && (
            <div className="absolute top-3 right-14 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-xs text-orange-400 font-semibold shadow-lg flex items-center gap-1.5 animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Resolving address...
            </div>
          )}
        </div>

        {/* Resolved Address Details & Confirmation */}
        <div className="p-4 sm:p-5 bg-gray-900/80 border-t border-white/10 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <Compass className="w-4 h-4 text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm line-clamp-2">
                {formattedAddress || (geocoding ? 'Detecting address details...' : 'Drag map to choose location')}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-gray-400">
                {city && <Badge variant="outline" className="text-[10px] border-white/10 bg-white/5">{city}</Badge>}
                {state && <Badge variant="outline" className="text-[10px] border-white/10 bg-white/5">{state}</Badge>}
                {pincode && <Badge variant="outline" className="text-[10px] border-orange-500/30 text-orange-300 bg-orange-500/10 font-mono">PIN: {pincode}</Badge>}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <p className="text-[11px] text-gray-500 hidden sm:block">
              Deliveries & riders will navigate directly to these coordinates.
            </p>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1 sm:flex-initial h-11 border-white/10 text-gray-300 hover:text-white hover:bg-white/5 rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={geocoding}
                className="flex-1 sm:flex-initial h-11 px-6 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-orange-600/30 gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                Confirm Location
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
