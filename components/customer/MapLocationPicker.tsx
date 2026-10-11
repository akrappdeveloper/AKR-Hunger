'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MapPin, Navigation, Loader2, CheckCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

// MapLibre GL is loaded dynamically on the client side only

interface MapLocationPickerProps {
  initialLat?: number;
  initialLon?: number;
  onLocationConfirmed: (location: {
    latitude: number;
    longitude: number;
    street: string;
    locality: string;
    city: string;
    state: string;
    pincode: string;
    formattedAddress: string;
  }) => void;
  onClose?: () => void;
  height?: string;
}

/**
 * Interactive MapLibre GL map picker with drag pin, reverse geocode,
 * and confirm flow. Uses OpenStreetMap tiles (no API key required).
 */
export default function MapLocationPicker({
  initialLat = 28.6139,
  initialLon = 77.2090,
  onLocationConfirmed,
  onClose,
  height = '400px',
}: MapLocationPickerProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [center, setCenter] = useState({ lat: initialLat, lon: initialLon });
  const [address, setAddress] = useState({
    street: '',
    locality: '',
    city: '',
    state: '',
    pincode: '',
    formattedAddress: 'Drag pin to select location',
  });
  const [geocoding, setGeocoding] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || typeof window === 'undefined') return;

    const initMap = async () => {
      // Ensure MapLibre stylesheet is dynamically loaded
      if (typeof document !== 'undefined' && !document.getElementById('maplibre-gl-css')) {
        const link = document.createElement('link');
        link.id = 'maplibre-gl-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/maplibre-gl@latest/dist/maplibre-gl.css';
        document.head.appendChild(link);
      }

      const ml: any = await import('maplibre-gl');
      const MapConstructor = ml.Map || ml.default?.Map || ml.default;
      const NavigationControl = ml.NavigationControl || ml.default?.NavigationControl;
      const AttributionControl = ml.AttributionControl || ml.default?.AttributionControl;

      if (mapRef.current || !MapConstructor) return;

      const map = new MapConstructor({
        container: mapContainer.current!,
        style: {
          version: 8,
          sources: {
            osm: {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '&copy; OpenStreetMap contributors',
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
        },
        center: [initialLon, initialLat],
        zoom: 15,
        attributionControl: false,
      });

      if (NavigationControl) map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
      if (AttributionControl) map.addControl(new AttributionControl({ compact: true }), 'bottom-left');

      map.on('load', () => {
        setMapReady(true);
        reverseGeocode(initialLat, initialLon);
      });

      map.on('moveend', () => {
        const c = map.getCenter();
        setCenter({ lat: c.lat, lon: c.lng });

        // Debounced reverse geocode
        if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
        geocodeTimer.current = setTimeout(() => {
          reverseGeocode(c.lat, c.lng);
        }, 400);
      });

      mapRef.current = map;
    };

    initMap();

    return () => {
      if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reverse geocode using Nominatim
  const reverseGeocode = useCallback(async (lat: number, lon: number) => {
    setGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
        {
          headers: { 'User-Agent': 'HungerApp/1.0' },
        }
      );

      if (!res.ok) throw new Error('Geocoding failed');

      const data = await res.json();
      const addr = data.address || {};

      const street = addr.road || addr.pedestrian || addr.suburb || '';
      const locality = addr.suburb || addr.neighbourhood || addr.village || '';
      const city = addr.city || addr.town || addr.village || addr.state_district || '';
      const state = addr.state || '';
      const pincode = addr.postcode || '';
      const formatted = data.display_name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;

      setAddress({ street, locality, city, state, pincode, formattedAddress: formatted });
    } catch (err) {
      console.error('[MapPicker] Reverse geocode failed:', err);
      setAddress(prev => ({
        ...prev,
        formattedAddress: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
      }));
    } finally {
      setGeocoding(false);
    }
  }, []);

  // Detect GPS location
  const detectGPS = useCallback(() => {
    if (!navigator.geolocation) return;
    setDetecting(true);

    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        setCenter({ lat: latitude, lon: longitude });
        if (mapRef.current) {
          mapRef.current.flyTo({ center: [longitude, latitude], zoom: 17, duration: 1000 });
        }
        setDetecting(false);
      },
      err => {
        console.error('[MapPicker] GPS error:', err);
        setDetecting(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Confirm location
  const handleConfirm = useCallback(() => {
    onLocationConfirmed({
      latitude: center.lat,
      longitude: center.lon,
      ...address,
    });
  }, [center, address, onLocationConfirmed]);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-border/60 bg-card shadow-xl">
      {/* Map Container */}
      <div ref={mapContainer} style={{ width: '100%', height }} className="relative" />

      {/* Center Pin Overlay */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center" style={{ height }}>
        <div className="flex flex-col items-center -mt-10">
          <MapPin className="w-10 h-10 text-primary drop-shadow-lg fill-primary/20 animate-bounce" style={{ animationDuration: '2s' }} />
          <div className="w-3 h-1 bg-black/20 rounded-full mt-0.5 blur-[1px]" />
        </div>
      </div>

      {/* GPS Button */}
      <button
        onClick={detectGPS}
        disabled={detecting}
        className="absolute top-3 left-3 z-10 bg-white dark:bg-zinc-800 rounded-xl p-2.5 shadow-lg border border-border/50 hover:bg-primary/10 transition-all disabled:opacity-50"
        title="Use my GPS location"
      >
        {detecting ? (
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
        ) : (
          <Navigation className="w-5 h-5 text-primary" />
        )}
      </button>

      {/* Close Button */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-3 right-14 z-10 bg-white dark:bg-zinc-800 rounded-xl p-2.5 shadow-lg border border-border/50 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
      )}

      {/* Address Bar + Confirm */}
      <div className="p-4 space-y-3 bg-card border-t border-border/50">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            {geocoding ? (
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            ) : (
              <MapPin className="w-5 h-5 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-foreground truncate">
              {address.city || address.locality || 'Select Location'}
              {address.state ? `, ${address.state}` : ''}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {address.formattedAddress}
            </p>
            {address.pincode && (
              <span className="inline-flex items-center mt-1 text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                PIN: {address.pincode}
              </span>
            )}
          </div>
        </div>

        <Button
          onClick={handleConfirm}
          disabled={geocoding || !address.city}
          className="w-full h-11 font-bold text-sm rounded-xl bg-gradient-to-r from-primary to-orange-500 hover:from-primary/90 hover:to-orange-500/90 text-white shadow-lg shadow-primary/25 transition-all"
        >
          <CheckCircle2 className="w-4 h-4 mr-2" />
          Confirm This Location
        </Button>

        <p className="text-[10px] text-muted-foreground text-center">
          GPS: {center.lat.toFixed(5)}, {center.lon.toFixed(5)}
        </p>
      </div>
    </div>
  );
}
