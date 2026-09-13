/**
 * OSRM (Open Source Routing Machine) Utilities
 * 
 * Uses the public OSRM demo server for route calculation.
 * For production, consider self-hosting an OSRM instance.
 */

const OSRM_BASE_URL = 'https://router.project-osrm.org';

export interface RouteCoordinate {
  latitude: number;
  longitude: number;
}

export interface RouteResult {
  /** Route distance in meters */
  distance: number;
  /** Route duration in seconds */
  duration: number;
  /** Route geometry as array of [lng, lat] coordinates for MapLibre */
  geometry: [number, number][];
  /** Human-readable distance */
  distanceText: string;
  /** Human-readable ETA */
  etaText: string;
}

/**
 * Decode OSRM's polyline encoding to coordinate array
 * Based on Google's Encoded Polyline Algorithm
 */
function decodePolyline(encoded: string): [number, number][] {
  const coordinates: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    coordinates.push([lng / 1e5, lat / 1e5]); // [lng, lat] for MapLibre
  }

  return coordinates;
}

/**
 * Format duration to human-readable string
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) return 'Less than a minute';
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  if (remainingMins === 0) return `${hours}h`;
  return `${hours}h ${remainingMins}m`;
}

/**
 * Format distance to human-readable string
 */
function formatDistanceText(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Get driving route between two points
 */
export async function getRoute(
  from: RouteCoordinate,
  to: RouteCoordinate
): Promise<RouteResult | null> {
  try {
    const url = `${OSRM_BASE_URL}/route/v1/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=polyline&steps=false`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`OSRM request failed: ${response.status}`);

    const data = await response.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      console.warn('OSRM: No route found', data);
      return null;
    }

    const route = data.routes[0];
    const geometry = decodePolyline(route.geometry);

    return {
      distance: route.distance,
      duration: route.duration,
      geometry,
      distanceText: formatDistanceText(route.distance),
      etaText: formatDuration(route.duration),
    };
  } catch (error) {
    console.error('OSRM route calculation failed:', error);
    return null;
  }
}

/**
 * Get driving route through multiple waypoints (from → waypoint → to)
 */
export async function getMultiStopRoute(
  points: RouteCoordinate[]
): Promise<RouteResult | null> {
  if (points.length < 2) return null;

  try {
    const coords = points
      .map((p) => `${p.longitude},${p.latitude}`)
      .join(';');

    const url = `${OSRM_BASE_URL}/route/v1/driving/${coords}?overview=full&geometries=polyline&steps=false`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`OSRM request failed: ${response.status}`);

    const data = await response.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      return null;
    }

    const route = data.routes[0];
    const geometry = decodePolyline(route.geometry);

    return {
      distance: route.distance,
      duration: route.duration,
      geometry,
      distanceText: formatDistanceText(route.distance),
      etaText: formatDuration(route.duration),
    };
  } catch (error) {
    console.error('OSRM multi-stop route failed:', error);
    return null;
  }
}

/**
 * Get straight-line (as-the-crow-flies) distance between two points in meters
 * Used as fallback when OSRM is unavailable
 */
export function getStraightLineDistance(
  from: RouteCoordinate,
  to: RouteCoordinate
): number {
  const R = 6371000;
  const dLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((from.latitude * Math.PI) / 180) *
      Math.cos((to.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Estimate ETA based on straight-line distance (fallback)
 * Assumes average speed of 25 km/h in urban areas
 */
export function estimateETA(distanceMeters: number, avgSpeedKmh: number = 25): {
  duration: number;
  etaText: string;
  distanceText: string;
} {
  const durationSeconds = (distanceMeters / 1000 / avgSpeedKmh) * 3600;
  return {
    duration: durationSeconds,
    etaText: formatDuration(durationSeconds),
    distanceText: formatDistanceText(distanceMeters),
  };
}
