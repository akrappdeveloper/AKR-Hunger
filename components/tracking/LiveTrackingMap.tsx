'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getRoute, RouteCoordinate } from '@/lib/osrm';

// Dark map style using free CartoCDN dark matter tiles
const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  name: 'Dark',
  sources: {
    osm: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
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

export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  type: 'driver' | 'restaurant' | 'customer' | 'generic';
  label?: string;
  heading?: number;
  popup?: string;
}

interface LiveTrackingMapProps {
  /** Array of markers to display */
  markers: MapMarker[];
  /** Whether to show route between first restaurant and first customer via driver */
  showRoute?: boolean;
  /** Driver position for route origin */
  driverPosition?: { latitude: number; longitude: number } | null;
  /** Restaurant position */
  restaurantPosition?: { latitude: number; longitude: number } | null;
  /** Customer position */
  customerPosition?: { latitude: number; longitude: number } | null;
  /** Explicit route destination: 'restaurant' = Driver→Restaurant, 'customer' = Driver→Customer, 'auto' = auto-detect */
  routeDestination?: 'restaurant' | 'customer' | 'auto';
  /** Whether to auto-follow the driver marker */
  followDriver?: boolean;
  /** Custom CSS class */
  className?: string;
  /** Map height */
  height?: string;
  /** Route info callback */
  onRouteInfo?: (info: { distance: string; eta: string; distanceMeters: number; durationSeconds: number } | null) => void;
  /** Center coordinates override */
  center?: [number, number];
  /** Zoom level override */
  zoom?: number;
  /** Click on marker callback */
  onMarkerClick?: (markerId: string) => void;
}

// Create marker HTML element
function createMarkerElement(type: MapMarker['type'], heading?: number): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'custom-marker';

  const size = type === 'driver' ? 44 : 36;
  const innerSize = type === 'driver' ? 28 : 22;

  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.borderRadius = '50%';
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.cursor = 'pointer';
  el.style.transition = 'transform 0.3s ease';

  let bgColor: string;
  let borderColor: string;
  let emoji: string;
  let glowColor: string;

  switch (type) {
    case 'driver':
      bgColor = 'rgba(59, 130, 246, 0.2)';
      borderColor = 'rgba(59, 130, 246, 0.8)';
      emoji = '🛵';
      glowColor = 'rgba(59, 130, 246, 0.4)';
      break;
    case 'restaurant':
      bgColor = 'rgba(249, 115, 22, 0.2)';
      borderColor = 'rgba(249, 115, 22, 0.8)';
      emoji = '🍔';
      glowColor = 'rgba(249, 115, 22, 0.3)';
      break;
    case 'customer':
      bgColor = 'rgba(34, 197, 94, 0.2)';
      borderColor = 'rgba(34, 197, 94, 0.8)';
      emoji = '🏠';
      glowColor = 'rgba(34, 197, 94, 0.3)';
      break;
    default:
      bgColor = 'rgba(168, 85, 247, 0.2)';
      borderColor = 'rgba(168, 85, 247, 0.8)';
      emoji = '📍';
      glowColor = 'rgba(168, 85, 247, 0.3)';
  }

  el.style.backgroundColor = bgColor;
  el.style.border = `2px solid ${borderColor}`;
  el.style.boxShadow = `0 0 15px ${glowColor}, 0 0 30px ${glowColor}`;

  if (type === 'driver' && heading !== undefined && heading > 0) {
    el.style.transform = `rotate(${heading}deg)`;
  }

  const inner = document.createElement('span');
  inner.style.fontSize = `${innerSize - 8}px`;
  inner.style.lineHeight = '1';
  inner.textContent = emoji;

  if (type === 'driver') {
    // Add pulse animation for driver
    const pulse = document.createElement('div');
    pulse.style.position = 'absolute';
    pulse.style.inset = '-4px';
    pulse.style.borderRadius = '50%';
    pulse.style.border = `2px solid ${borderColor}`;
    pulse.style.animation = 'marker-pulse 2s ease-out infinite';
    pulse.style.opacity = '0';
    el.style.position = 'relative';
    el.appendChild(pulse);
  }

  el.appendChild(inner);
  return el;
}

export default function LiveTrackingMap({
  markers,
  showRoute = false,
  driverPosition,
  restaurantPosition,
  customerPosition,
  routeDestination = 'auto',
  followDriver = false,
  className = '',
  height = '100%',
  onRouteInfo,
  center,
  zoom = 14,
  onMarkerClick,
}: LiveTrackingMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const routeSourceAdded = useRef(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    // Determine initial center
    const initialCenter = center || (() => {
      const firstMarker = markers[0];
      if (firstMarker) return [firstMarker.longitude, firstMarker.latitude] as [number, number];
      if (driverPosition) return [driverPosition.longitude, driverPosition.latitude] as [number, number];
      return [80.9462, 26.8467] as [number, number]; // Default: Lucknow
    })();

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLE,
      center: initialCenter,
      zoom: zoom,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    map.on('load', () => {
      setMapLoaded(true);

      // Add route source
      map.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: [] },
        },
      });

      // Route glow layer
      map.addLayer({
        id: 'route-glow',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#3b82f6',
          'line-width': 8,
          'line-opacity': 0.3,
          'line-blur': 3,
        },
      });

      // Route line layer
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#3b82f6',
          'line-width': 4,
          'line-opacity': 0.9,
          'line-dasharray': [2, 1],
        },
      });

      routeSourceAdded.current = true;
    });

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
      routeSourceAdded.current = false;
      setMapLoaded(false);
    };
  }, []); // Only initialize once

  // Update markers when they change
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    const currentMarkerIds = new Set(markers.map((m) => m.id));

    // Remove markers no longer in the list
    markersRef.current.forEach((marker, id) => {
      if (!currentMarkerIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    // Add or update markers
    markers.forEach((m) => {
      const existing = markersRef.current.get(m.id);
      if (existing) {
        // Update position with smooth transition
        existing.setLngLat([m.longitude, m.latitude]);

        // Update rotation for driver
        if (m.type === 'driver' && m.heading !== undefined && m.heading > 0) {
          const el = existing.getElement();
          el.style.transform = `rotate(${m.heading}deg)`;
        }
      } else {
        // Create new marker
        const el = createMarkerElement(m.type, m.heading);

        if (onMarkerClick) {
          el.addEventListener('click', () => onMarkerClick(m.id));
        }

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([m.longitude, m.latitude]);

        if (m.popup) {
          marker.setPopup(
            new maplibregl.Popup({ offset: 25, className: 'dark-popup' })
              .setHTML(`<div style="background:#1a1a2e;color:white;padding:8px 12px;border-radius:8px;font-size:13px;font-family:system-ui;">${m.popup}</div>`)
          );
        }

        marker.addTo(mapRef.current!);
        markersRef.current.set(m.id, marker);
      }
    });
  }, [markers, mapLoaded, onMarkerClick]);

  // Follow driver
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !followDriver || !driverPosition) return;

    mapRef.current.easeTo({
      center: [driverPosition.longitude, driverPosition.latitude],
      duration: 1000,
    });
  }, [driverPosition?.latitude, driverPosition?.longitude, followDriver, mapLoaded]);

  // Update route — stage-aware routing
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !routeSourceAdded.current || !showRoute) return;

    const calculateRoute = async () => {
      let from: RouteCoordinate | null = null;
      let to: RouteCoordinate | null = null;
      let routeColor = '#3b82f6'; // default blue

      // Stage-aware route destination
      if (routeDestination === 'restaurant') {
        // Driver → Restaurant (pickup phase)
        if (driverPosition && restaurantPosition) {
          from = { latitude: driverPosition.latitude, longitude: driverPosition.longitude };
          to = { latitude: restaurantPosition.latitude, longitude: restaurantPosition.longitude };
          routeColor = '#f97316'; // orange for pickup
        }
      } else if (routeDestination === 'customer') {
        // Driver → Customer (delivery phase)
        if (driverPosition && customerPosition) {
          from = { latitude: driverPosition.latitude, longitude: driverPosition.longitude };
          to = { latitude: customerPosition.latitude, longitude: customerPosition.longitude };
          routeColor = '#3b82f6'; // blue for delivery
        }
      } else {
        // Auto-detect (backward compat)
        if (driverPosition && restaurantPosition && !customerPosition) {
          from = { latitude: driverPosition.latitude, longitude: driverPosition.longitude };
          to = { latitude: restaurantPosition.latitude, longitude: restaurantPosition.longitude };
          routeColor = '#f97316';
        } else if (driverPosition && customerPosition) {
          from = { latitude: driverPosition.latitude, longitude: driverPosition.longitude };
          to = { latitude: customerPosition.latitude, longitude: customerPosition.longitude };
          routeColor = '#3b82f6';
        } else if (restaurantPosition && customerPosition) {
          from = { latitude: restaurantPosition.latitude, longitude: restaurantPosition.longitude };
          to = { latitude: customerPosition.latitude, longitude: customerPosition.longitude };
        }
      }

      if (!from || !to) {
        if (onRouteInfo) onRouteInfo(null);
        return;
      }

      // Update route line color based on phase
      try {
        if (mapRef.current?.getLayer('route-glow')) {
          mapRef.current.setPaintProperty('route-glow', 'line-color', routeColor);
        }
        if (mapRef.current?.getLayer('route-line')) {
          mapRef.current.setPaintProperty('route-line', 'line-color', routeColor);
        }
      } catch (_) { /* layer may not exist yet */ }

      const route = await getRoute(from, to);
      if (!route || !mapRef.current) return;

      // Update route on map
      const source = mapRef.current.getSource('route') as maplibregl.GeoJSONSource;
      if (source) {
        source.setData({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: route.geometry,
          },
        });
      }

      if (onRouteInfo) {
        onRouteInfo({
          distance: route.distanceText,
          eta: route.etaText,
          distanceMeters: route.distance,
          durationSeconds: route.duration,
        });
      }
    };

    calculateRoute();
  }, [
    driverPosition?.latitude, driverPosition?.longitude,
    restaurantPosition?.latitude, restaurantPosition?.longitude,
    customerPosition?.latitude, customerPosition?.longitude,
    showRoute, mapLoaded, onRouteInfo, routeDestination,
  ]);

  // Fit bounds to show all markers
  const fitBounds = useCallback(() => {
    if (!mapRef.current || markers.length === 0) return;

    const bounds = new maplibregl.LngLatBounds();
    markers.forEach((m) => bounds.extend([m.longitude, m.latitude]));

    if (markers.length === 1) {
      mapRef.current.flyTo({
        center: [markers[0].longitude, markers[0].latitude],
        zoom: 15,
        duration: 1000,
      });
    } else {
      mapRef.current.fitBounds(bounds, {
        padding: { top: 80, bottom: 80, left: 60, right: 60 },
        maxZoom: 16,
        duration: 1000,
      });
    }
  }, [markers]);

  // Fit bounds when markers first load
  useEffect(() => {
    if (mapLoaded && markers.length > 0) {
      const timer = setTimeout(fitBounds, 500);
      return () => clearTimeout(timer);
    }
  }, [mapLoaded, markers.length > 0]);

  return (
    <div className={`relative ${className}`} style={{ height }}>
      <div ref={mapContainer} className="absolute inset-0 rounded-2xl overflow-hidden" />

      {/* Pulse animation style */}
      <style jsx global>{`
        @keyframes marker-pulse {
          0% { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        .maplibregl-popup-content {
          background: transparent !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .maplibregl-popup-tip {
          border-top-color: #1a1a2e !important;
        }
        .maplibregl-ctrl-group {
          background: rgba(0, 0, 0, 0.7) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          backdrop-filter: blur(10px);
        }
        .maplibregl-ctrl-group button {
          filter: invert(1);
        }
        .maplibregl-ctrl-attrib {
          background: rgba(0, 0, 0, 0.5) !important;
          color: rgba(255, 255, 255, 0.5) !important;
          font-size: 10px !important;
        }
        .maplibregl-ctrl-attrib a {
          color: rgba(255, 255, 255, 0.6) !important;
        }
      `}</style>

      {/* Recenter button */}
      <button
        onClick={fitBounds}
        className="absolute top-3 left-3 z-10 bg-black/60 backdrop-blur-md border border-white/10 text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-black/80 transition-all flex items-center gap-2"
        title="Fit all markers"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
        </svg>
        Recenter
      </button>
    </div>
  );
}
