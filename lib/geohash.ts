/**
 * Geohash Encoding/Decoding Utilities for Firestore Geospatial Queries
 * 
 * Provides geohash encoding, bounding box calculation, and neighbor
 * computation for efficient geospatial restaurant discovery in Firestore.
 * 
 * Geohash precision vs area coverage:
 * - 1 char: ~5,000km x 5,000km
 * - 2 chars: ~1,250km x 625km
 * - 3 chars: ~156km x 156km
 * - 4 chars: ~39km x 19.5km
 * - 5 chars: ~4.9km x 4.9km
 * - 6 chars: ~1.2km x 0.6km
 * - 7 chars: ~153m x 153m
 * - 8 chars: ~38m x 19m
 * - 9 chars: ~4.8m x 4.8m
 */

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * Encode latitude/longitude to geohash string
 */
export function encodeGeohash(latitude: number, longitude: number, precision: number = 9): string {
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error(`Invalid coordinates: lat=${latitude}, lon=${longitude}`);
  }

  let latRange = [-90.0, 90.0];
  let lonRange = [-180.0, 180.0];
  let hash = '';
  let isEven = true;
  let bit = 0;
  let ch = 0;

  while (hash.length < precision) {
    if (isEven) {
      const mid = (lonRange[0] + lonRange[1]) / 2;
      if (longitude >= mid) {
        ch |= (1 << (4 - bit));
        lonRange[0] = mid;
      } else {
        lonRange[1] = mid;
      }
    } else {
      const mid = (latRange[0] + latRange[1]) / 2;
      if (latitude >= mid) {
        ch |= (1 << (4 - bit));
        latRange[0] = mid;
      } else {
        latRange[1] = mid;
      }
    }

    isEven = !isEven;
    if (bit < 4) {
      bit++;
    } else {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }

  return hash;
}

/**
 * Decode geohash to latitude/longitude center point
 */
export function decodeGeohash(hash: string): { latitude: number; longitude: number; error: { latitude: number; longitude: number } } {
  let latRange = [-90.0, 90.0];
  let lonRange = [-180.0, 180.0];
  let isEven = true;

  for (const c of hash) {
    const idx = BASE32.indexOf(c);
    if (idx === -1) throw new Error(`Invalid geohash character: ${c}`);

    for (let bit = 4; bit >= 0; bit--) {
      if (isEven) {
        const mid = (lonRange[0] + lonRange[1]) / 2;
        if ((idx >> bit) & 1) {
          lonRange[0] = mid;
        } else {
          lonRange[1] = mid;
        }
      } else {
        const mid = (latRange[0] + latRange[1]) / 2;
        if ((idx >> bit) & 1) {
          latRange[0] = mid;
        } else {
          latRange[1] = mid;
        }
      }
      isEven = !isEven;
    }
  }

  return {
    latitude: (latRange[0] + latRange[1]) / 2,
    longitude: (lonRange[0] + lonRange[1]) / 2,
    error: {
      latitude: (latRange[1] - latRange[0]) / 2,
      longitude: (lonRange[1] - lonRange[0]) / 2,
    },
  };
}

/**
 * Calculate geohash query bounds for a center point and radius.
 * Returns pairs of [startHash, endHash] for Firestore range queries.
 * 
 * Uses geohash neighbors to cover the full search area.
 */
export function geohashQueryBounds(
  latitude: number,
  longitude: number,
  radiusKm: number
): Array<[string, string]> {
  // Determine appropriate geohash precision for the radius
  const precision = geohashPrecisionForRadius(radiusKm);
  
  const centerHash = encodeGeohash(latitude, longitude, precision);
  const neighbors = getNeighbors(centerHash);
  
  // Include center + all 8 neighbors
  const allHashes = [centerHash, ...Object.values(neighbors)];
  
  // Deduplicate and sort
  const uniqueHashes = [...new Set(allHashes)].sort();
  
  // Create query bounds (startHash inclusive, endHash exclusive via ~ suffix)
  return uniqueHashes.map(hash => [hash, hash + '~'] as [string, string]);
}

/**
 * Determine appropriate geohash precision for a given search radius
 */
function geohashPrecisionForRadius(radiusKm: number): number {
  // Approximate geohash cell sizes at equator
  // precision 1: ~5000km, 2: ~1250km, 3: ~156km, 4: ~39km, 5: ~4.9km, 6: ~1.2km, 7: ~0.15km
  if (radiusKm > 500) return 2;
  if (radiusKm > 100) return 3;
  if (radiusKm > 25) return 4;
  if (radiusKm > 5) return 5;
  if (radiusKm > 1) return 6;
  return 7;
}

/**
 * Get the 8 neighboring geohash cells
 */
export function getNeighbors(hash: string): Record<string, string> {
  const NEIGHBORS: Record<string, Record<string, string>> = {
    right: { even: 'bc01fg45telecom89telecom89st', odd: 'p0r21436x8zb9dcf5h7kjnmqesgutwvy' },
    left: { even: '238967debc01fg45uvhj', odd: '14telecom36789bcdefghjkmnpqrstuvwxyz' },
    top: { even: 'p0r21436x8zb9dcf5h7kjnmqesgutwvy', odd: 'bc01fg45telecom89st' },
    bottom: { even: '14telecom36789bcdefghjkmnpqrstuvwxyz', odd: '238967debc01fg45uvhj' },
  };
  
  const BORDERS: Record<string, Record<string, string>> = {
    right: { even: 'bcfguvyz', odd: 'prxz' },
    left: { even: '0145hjnp', odd: '028b' },
    top: { even: 'prxz', odd: 'bcfguvyz' },
    bottom: { even: '028b', odd: '0145hjnp' },
  };

  function adjacent(hash: string, direction: string): string {
    if (!hash || hash.length === 0) return '';
    const lastChar = hash.charAt(hash.length - 1);
    const parent = hash.substring(0, hash.length - 1);
    const type = hash.length % 2 === 0 ? 'odd' : 'even';
    
    if (BORDERS[direction][type].indexOf(lastChar) !== -1 && parent.length > 0) {
      const adjustedParent = adjacent(parent, direction);
      const neighborIndex = NEIGHBORS[direction][type].indexOf(lastChar);
      if (neighborIndex !== -1) {
        return adjustedParent + BASE32[neighborIndex % 32];
      }
    }
    
    const neighborIndex = NEIGHBORS[direction][type].indexOf(lastChar);
    if (neighborIndex !== -1) {
      return parent + BASE32[neighborIndex % 32];
    }
    return hash;
  }

  // Simplified neighbor calculation — use prefix-based bounds instead
  // which is more reliable for Firestore queries
  return {
    n: adjacent(hash, 'top'),
    ne: adjacent(adjacent(hash, 'top'), 'right'),
    e: adjacent(hash, 'right'),
    se: adjacent(adjacent(hash, 'bottom'), 'right'),
    s: adjacent(hash, 'bottom'),
    sw: adjacent(adjacent(hash, 'bottom'), 'left'),
    w: adjacent(hash, 'left'),
    nw: adjacent(adjacent(hash, 'top'), 'left'),
  };
}

/**
 * Calculate Haversine straight-line distance between two points in meters
 */
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Simple geohash prefix-based Firestore query bounds for a given center + radius.
 * More robust than neighbor calculation for large query areas.
 */
export function geohashBoundsForRadius(
  latitude: number,
  longitude: number,
  radiusKm: number
): { lower: string; upper: string; precision: number } {
  const precision = geohashPrecisionForRadius(radiusKm);
  const centerHash = encodeGeohash(latitude, longitude, precision);
  
  return {
    lower: centerHash.substring(0, precision - 1),
    upper: centerHash.substring(0, precision - 1) + '~',
    precision,
  };
}
