'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getRoute, RouteCoordinate } from '@/lib/osrm';

export type MapTheme = 'dark' | 'streets' | 'satellite';

// 100% Free, Reliable OpenStreetMap & ESRI Tile Styles (Zero API Key Needed, No Watermarks)
const OSM_TILES = [
  'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
  'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
  'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
];

const SATELLITE_TILES = [
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
];

function buildMapStyle(theme: MapTheme): maplibregl.StyleSpecification {
  if (theme === 'satellite') {
    return {
      version: 8,
      name: 'Satellite',
      sources: {
        satellite: {
          type: 'raster',
          tiles: SATELLITE_TILES,
          tileSize: 256,
          attribution: '&copy; Esri, Maxar, Earthstar Geographics',
          maxzoom: 19,
        },
      },
      layers: [
        {
          id: 'satellite-tiles',
          type: 'raster',
          source: 'satellite',
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    };
  }

  return {
    version: 8,
    name: 'OpenStreetMap',
    sources: {
      osm: {
        type: 'raster',
        tiles: OSM_TILES,
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
}

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
  markers: MapMarker[];
  showRoute?: boolean;
  driverPosition?: { latitude: number; longitude: number } | null;
  restaurantPosition?: { latitude: number; longitude: number } | null;
  customerPosition?: { latitude: number; longitude: number } | null;
  routeDestination?: 'restaurant' | 'customer' | 'auto';
  followDriver?: boolean;
  className?: string;
  height?: string;
  onRouteInfo?: (info: { distance: string; eta: string; distanceMeters: number; durationSeconds: number } | null) => void;
  center?: [number, number];
  zoom?: number;
  onMarkerClick?: (markerId: string) => void;
}

// Create custom animated marker element
function createMarkerElement(type: MapMarker['type'], heading?: number): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'custom-marker';

  const size = type === 'driver' ? 44 : 38;
  const innerSize = type === 'driver' ? 28 : 24;

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
      bgColor = 'rgba(59, 130, 246, 0.25)';
      borderColor = '#3b82f6';
      emoji = '🛵';
      glowColor = 'rgba(59, 130, 246, 0.6)';
      break;
    case 'restaurant':
      bgColor = 'rgba(249, 115, 22, 0.25)';
      borderColor = '#f97316';
      emoji = '🍔';
      glowColor = 'rgba(249, 115, 22, 0.5)';
      break;
    case 'customer':
      bgColor = 'rgba(34, 197, 94, 0.25)';
      borderColor = '#22c55e';
      emoji = '🏠';
      glowColor = 'rgba(34, 197, 94, 0.5)';
      break;
    default:
      bgColor = 'rgba(168, 85, 247, 0.25)';
      borderColor = '#a855f7';
      emoji = '📍';
      glowColor = 'rgba(168, 85, 247, 0.5)';
  }

  el.style.backgroundColor = bgColor;
  el.style.border = `2.5px solid ${borderColor}`;
  el.style.boxShadow = `0 0 14px ${glowColor}, 0 2px 6px rgba(0,0,0,0.3)`;

  if (type === 'driver' && heading !== undefined && heading > 0) {
    el.style.transform = `rotate(${heading}deg)`;
  }

  const inner = document.createElement('span');
  inner.style.fontSize = `${innerSize - 8}px`;
  inner.style.lineHeight = '1';
  inner.textContent = emoji;

  if (type === 'driver') {
    const pulse = document.createElement('div');
    pulse.style.position = 'absolute';
    pulse.style.inset = '-6px';
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
  const [currentTheme, setCurrentTheme] = useState<MapTheme>('dark');
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Setup layers on map load or style change
  const setupLayers = useCallback((map: maplibregl.Map) => {
    if (map.getSource('route')) return;

    map.addSource('route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: [] },
      },
    });

    map.addLayer({
      id: 'route-glow',
      type: 'line',
      source: 'route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#3b82f6',
        'line-width': 8,
        'line-opacity': 0.35,
        'line-blur': 3,
      },
    });

    map.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#3b82f6',
        'line-width': 4,
        'line-opacity': 0.95,
        'line-dasharray': [2, 1],
      },
    });

    routeSourceAdded.current = true;
  }, []);

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const initialCenter = center || (() => {
      const firstMarker = markers[0];
      if (firstMarker) return [firstMarker.longitude, firstMarker.latitude] as [number, number];
      if (driverPosition) return [driverPosition.longitude, driverPosition.latitude] as [number, number];
      return [80.9462, 26.8467] as [number, number]; // Default
    })();

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: buildMapStyle(currentTheme),
      center: initialCenter,
      zoom: zoom,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    map.on('load', () => {
      setMapLoaded(true);
      setupLayers(map);
      // Auto-resize immediately and with staggered delays for full container coverage
      map.resize();
      setTimeout(() => map.resize(), 80);
      setTimeout(() => map.resize(), 300);
      setTimeout(() => map.resize(), 700);
    });

    mapRef.current = map;

    // Attach ResizeObserver to keep canvas sized accurately at all times
    if (typeof ResizeObserver !== 'undefined' && mapContainer.current) {
      resizeObserverRef.current = new ResizeObserver(() => {
        if (mapRef.current) {
          mapRef.current.resize();
        }
      });
      resizeObserverRef.current.observe(mapContainer.current);
    }

    const handleWindowResize = () => {
      mapRef.current?.resize();
    };
    window.addEventListener('resize', handleWindowResize);

    return () => {
      window.removeEventListener('resize', handleWindowResize);
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
      routeSourceAdded.current = false;
      setMapLoaded(false);
    };
  }, []);

  // Switch Theme
  const changeTheme = useCallback((newTheme: MapTheme) => {
    setCurrentTheme(newTheme);
    if (!mapRef.current) return;

    mapRef.current.setStyle(buildMapStyle(newTheme));
    mapRef.current.once('style.load', () => {
      if (mapRef.current) {
        setupLayers(mapRef.current);
        mapRef.current.resize();
      }
    });
  }, [setupLayers]);

  // Update markers
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    const currentMarkerIds = new Set(markers.map((m) => m.id));

    markersRef.current.forEach((marker, id) => {
      if (!currentMarkerIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    markers.forEach((m) => {
      const existing = markersRef.current.get(m.id);
      if (existing) {
        existing.setLngLat([m.longitude, m.latitude]);
        if (m.type === 'driver' && m.heading !== undefined && m.heading > 0) {
          const el = existing.getElement();
          el.style.transform = `rotate(${m.heading}deg)`;
        }
      } else {
        const el = createMarkerElement(m.type, m.heading);
        if (onMarkerClick) {
          el.addEventListener('click', () => onMarkerClick(m.id));
        }

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([m.longitude, m.latitude]);

        if (m.popup) {
          marker.setPopup(
            new maplibregl.Popup({ offset: 25, className: 'dark-popup' })
              .setHTML(`<div style="background:#111827;color:#f9fafb;padding:8px 12px;border-radius:10px;font-size:12.5px;font-family:system-ui;border:1px solid #374151;">${m.popup}</div>`)
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

  // Update Route
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !showRoute) return;

    const calculateRoute = async () => {
      let from: RouteCoordinate | null = null;
      let to: RouteCoordinate | null = null;
      let routeColor = '#3b82f6';

      if (routeDestination === 'restaurant') {
        if (driverPosition && restaurantPosition) {
          from = { latitude: driverPosition.latitude, longitude: driverPosition.longitude };
          to = { latitude: restaurantPosition.latitude, longitude: restaurantPosition.longitude };
          routeColor = '#f97316';
        }
      } else if (routeDestination === 'customer') {
        if (driverPosition && customerPosition) {
          from = { latitude: driverPosition.latitude, longitude: driverPosition.longitude };
          to = { latitude: customerPosition.latitude, longitude: customerPosition.longitude };
          routeColor = '#3b82f6';
        }
      } else {
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

      try {
        if (mapRef.current?.getLayer('route-glow')) {
          mapRef.current.setPaintProperty('route-glow', 'line-color', routeColor);
        }
        if (mapRef.current?.getLayer('route-line')) {
          mapRef.current.setPaintProperty('route-line', 'line-color', routeColor);
        }
      } catch (_) { }

      const route = await getRoute(from, to);
      if (!route || !mapRef.current) return;

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

  // Fit bounds dynamically with safe padding check
  const fitBounds = useCallback(() => {
    if (!mapRef.current || markers.length === 0) return;

    mapRef.current.resize();

    const bounds = new maplibregl.LngLatBounds();
    markers.forEach((m) => bounds.extend([m.longitude, m.latitude]));

    const containerHeight = mapContainer.current?.clientHeight || 400;
    const containerWidth = mapContainer.current?.clientWidth || 400;
    const padTop = Math.min(50, Math.floor(containerHeight * 0.12));
    const padSide = Math.min(50, Math.floor(containerWidth * 0.12));

    if (markers.length === 1) {
      mapRef.current.flyTo({
        center: [markers[0].longitude, markers[0].latitude],
        zoom: 15,
        duration: 900,
      });
    } else {
      mapRef.current.fitBounds(bounds, {
        padding: { top: padTop, bottom: padTop, left: padSide, right: padSide },
        maxZoom: 16,
        duration: 900,
      });
    }
  }, [markers]);

  useEffect(() => {
    if (mapLoaded && markers.length > 0) {
      const timer = setTimeout(fitBounds, 400);
      return () => clearTimeout(timer);
    }
  }, [mapLoaded, markers.length > 0]);

  return (
    <div
      className={`relative w-full h-full min-h-[380px] overflow-hidden rounded-2xl ${className} ${currentTheme === 'dark' ? 'dark-canvas-filter' : ''}`}
      style={{ height }}
    >
      <div
        ref={mapContainer}
        className="w-full h-full min-h-[380px] absolute inset-0 rounded-2xl overflow-hidden"
      />

      {/* Map Control Bar: Recenter + Style Switcher */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={fitBounds}
          className="bg-black/75 hover:bg-black/90 backdrop-blur-md border border-white/15 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
          title="Fit all markers in view"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
          </svg>
          Recenter
        </button>

        {/* Theme Pills */}
        <div className="bg-black/75 backdrop-blur-md border border-white/15 rounded-xl p-0.5 flex items-center gap-0.5 shadow-md">
          <button
            type="button"
            onClick={() => changeTheme('dark')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${currentTheme === 'dark'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-gray-300 hover:text-white'
              }`}
          >
            🌙 Dark
          </button>
          <button
            type="button"
            onClick={() => changeTheme('streets')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${currentTheme === 'streets'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-gray-300 hover:text-white'
              }`}
          >
            🗺️ Street
          </button>
          <button
            type="button"
            onClick={() => changeTheme('satellite')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${currentTheme === 'satellite'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-gray-300 hover:text-white'
              }`}
          >
            🛰️ Sat
          </button>
        </div>
      </div>

      {/* Global Map Styles & High-Contrast Dark Filter */}
      <style jsx global>{`
        @keyframes marker-pulse {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(2.6); opacity: 0; }
        }
        .dark-canvas-filter .maplibregl-canvas {
          filter: invert(90%) hue-rotate(180deg) brightness(95%) contrast(90%);
        }
        .maplibregl-canvas {
          width: 100% !important;
          height: 100% !important;
          outline: none;
        }
        .maplibregl-popup-content {
          background: transparent !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .maplibregl-popup-tip {
          border-top-color: #111827 !important;
        }
        .maplibregl-ctrl-group {
          background: rgba(17, 24, 39, 0.85) !important;
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          backdrop-filter: blur(10px);
          border-radius: 12px !important;
          overflow: hidden;
        }
        .maplibregl-ctrl-group button {
          filter: invert(1);
          width: 32px !important;
          height: 32px !important;
        }
        .maplibregl-ctrl-attrib {
          background: rgba(0, 0, 0, 0.5) !important;
          color: rgba(255, 255, 255, 0.5) !important;
          font-size: 10px !important;
          border-radius: 6px;
        }
      `}</style>
    </div>
  );
}
