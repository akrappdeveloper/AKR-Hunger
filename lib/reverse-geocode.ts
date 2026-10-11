'use client';

/**
 * Robust Multi-Tier Reverse Geocoding & GPS Location Helper for India
 * Tier 1: OpenStreetMap Nominatim with jsonv2 & addressdetails
 * Tier 2: BigDataCloud Client Reverse Geocode API (CORS-friendly, ultra-fast)
 * Tier 3: India Post Postal Pincode API (https://api.postalpincode.in) for 6-digit PIN validation
 */

export interface GeocodedAddress {
  street: string;
  area: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  ipAddress?: string;
  plusCode?: string;
  confidence: 'high' | 'medium' | 'approximate';
}

export interface PostalDetails {
  verified: boolean;
  district: string;
  state: string;
  postOfficeName?: string;
  message?: string;
}

export interface PublicIpInfo {
  ip: string;
  city?: string;
  region?: string;
  country?: string;
  postal?: string;
}

/**
 * Fetch client's real public IP address and ISP geolocation info
 */
export async function fetchPublicIpInfo(): Promise<PublicIpInfo> {
  // Strategy 1: ipwho.is (fast, detailed, free)
  try {
    const res = await fetch('https://ipwho.is/', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success !== false && data.ip) {
        return {
          ip: data.ip,
          city: data.city || '',
          region: data.region || '',
          country: data.country || 'India',
          postal: data.postal || '',
        };
      }
    }
  } catch (err) {
    console.warn('[ReverseGeocode] ipwho.is lookup notice:', err);
  }

  // Strategy 2: ipify json fallback
  try {
    const res = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data && data.ip) {
        return {
          ip: data.ip,
          country: 'India',
        };
      }
    }
  } catch (err) {
    console.warn('[ReverseGeocode] ipify lookup notice:', err);
  }

  return { ip: '127.0.0.1 (Local)', country: 'India' };
}

/**
 * Search India Post registry by post office / locality name to get authentic 6-digit PIN
 * (e.g. "Chinhat" -> "226028")
 */
export async function lookupPincodeByLocality(localityName: string): Promise<string | null> {
  if (!localityName || localityName.trim().length < 3) return null;
  const clean = localityName.trim().replace(/[^a-zA-Z0-9\s]/g, '').slice(0, 30);
  if (!clean) return null;

  try {
    const res = await fetch(`https://api.postalpincode.in/postoffice/${encodeURIComponent(clean)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data[0] && data[0].Status === 'Success' && Array.isArray(data[0].PostOffice)) {
      const po = data[0].PostOffice[0];
      if (po && po.Pincode && /^[1-9][0-9]{5}$/.test(po.Pincode)) {
        return po.Pincode;
      }
    }
  } catch (err) {
    console.warn('[ReverseGeocode] Locality postal lookup notice:', err);
  }
  return null;
}

/**
 * Verify & look up an Indian 6-digit Pincode with India Post Registry API
 */
export async function lookupPostalPincode(pincode: string): Promise<PostalDetails> {
  const cleanPin = pincode.replace(/\D/g, '').slice(0, 6);
  if (cleanPin.length !== 6 || !/^[1-9][0-9]{5}$/.test(cleanPin)) {
    return {
      verified: false,
      district: '',
      state: '',
      message: 'Please enter a valid 6-digit Indian pincode',
    };
  }

  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${cleanPin}`);
    if (!res.ok) {
      return { verified: false, district: '', state: '', message: 'Postal lookup network error' };
    }

    const data = await res.json();
    if (Array.isArray(data) && data[0] && data[0].Status === 'Success' && Array.isArray(data[0].PostOffice) && data[0].PostOffice.length > 0) {
      const po = data[0].PostOffice[0];
      const district = po.District || po.Division || '';
      const state = po.State || '';
      const postOfficeName = po.Name || '';

      return {
        verified: true,
        district,
        state,
        postOfficeName,
        message: `Verified: ${postOfficeName}, ${district}`,
      };
    }

    return {
      verified: false,
      district: '',
      state: '',
      message: 'Pincode not recognized in postal circle',
    };
  } catch (err) {
    console.warn('[ReverseGeocode] Postal pincode verification notice:', err);
    return {
      verified: false,
      district: '',
      state: '',
      message: 'Could not connect to postal registry',
    };
  }
}

/**
 * High-accuracy GPS coordinates acquisition
 * Uses enableHighAccuracy: true with fallback to coarse if hardware GPS times out.
 */
export async function getGpsCoordinates(): Promise<{
  latitude: number;
  longitude: number;
  accuracy: number;
}> {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    throw new Error('Geolocation is not supported by your browser');
  }

  // Attempt 1: High Accuracy GPS (Wi-Fi triangulation + GPS hardware)
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        console.warn('[ReverseGeocode] High accuracy GPS failed, falling back to coarse:', err);
        // Attempt 2: Standard/Coarse Geolocation fallback
        navigator.geolocation.getCurrentPosition(
          (fallbackPos) => {
            resolve({
              latitude: fallbackPos.coords.latitude,
              longitude: fallbackPos.coords.longitude,
              accuracy: fallbackPos.coords.accuracy,
            });
          },
          (fallbackErr) => {
            let msg = 'Unable to fetch current location. Please check browser GPS permissions.';
            if (fallbackErr.code === fallbackErr.PERMISSION_DENIED) {
              msg = 'Location access was denied. Please allow location access in your browser settings.';
            } else if (fallbackErr.code === fallbackErr.TIMEOUT) {
              msg = 'GPS request timed out. Please try again or search by pincode.';
            }
            reject(new Error(msg));
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  });
}

/**
 * Multi-tier Reverse Geocoding with precise 6-digit PIN & locality extraction
 */
export async function reverseGeocodeCoordinates(
  latitude: number,
  longitude: number
): Promise<GeocodedAddress> {
  let resolvedStreet = '';
  let resolvedArea = '';
  let resolvedCity = '';
  let resolvedState = '';
  let resolvedCountry = 'India';
  let resolvedPincode = '';
  let resolvedFull = '';
  let confidence: 'high' | 'medium' | 'approximate' = 'approximate';

  // --- TIER 1: OpenStreetMap Nominatim jsonv2 ---
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Hunger-Food-Delivery-Platform/2.0 (contact@hunger.app)',
      },
    });

    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};

      // Street & Road components
      const roadPart = addr.road || addr.street || addr.building || addr.amenity || '';
      const areaPart = addr.suburb || addr.neighbourhood || addr.residential || addr.quarter || addr.subdistrict || '';
      resolvedStreet = roadPart;
      resolvedArea = areaPart;

      // City / District components
      resolvedCity =
        addr.city ||
        addr.town ||
        addr.village ||
        addr.municipality ||
        addr.city_district ||
        addr.county ||
        addr.state_district ||
        '';

      // State & Country
      resolvedState = addr.state || '';
      if (addr.country) resolvedCountry = addr.country;

      // Postcode: Check 6-digit Indian PIN
      if (addr.postcode) {
        const cleanPin = String(addr.postcode).replace(/\D/g, '').slice(0, 6);
        if (/^[1-9][0-9]{5}$/.test(cleanPin)) {
          resolvedPincode = cleanPin;
          confidence = 'high';
        }
      }

      // Regex fallback from full display name (e.g. "... Jaipur, Rajasthan, 302001, India")
      if (!resolvedPincode && data.display_name) {
        const pinMatch = String(data.display_name).match(/\b([1-9][0-9]{5})\b/);
        if (pinMatch) {
          resolvedPincode = pinMatch[1];
          confidence = 'medium';
        }
      }

      resolvedFull = data.display_name || '';
    }
  } catch (err) {
    console.warn('[ReverseGeocode] Nominatim Tier 1 notice:', err);
  }

  // --- TIER 2: BigDataCloud Client Reverse Geocode API ---
  if (!resolvedPincode || !resolvedCity || !resolvedStreet) {
    try {
      const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`;
      const bdcRes = await fetch(bdcUrl);

      if (bdcRes.ok) {
        const bdc = await bdcRes.json();

        // Pincode fallback
        if (!resolvedPincode && bdc.postcode) {
          const cleanPin = String(bdc.postcode).replace(/\D/g, '').slice(0, 6);
          if (/^[1-9][0-9]{5}$/.test(cleanPin)) {
            resolvedPincode = cleanPin;
            confidence = 'high';
          }
        }

        // City fallback
        if (!resolvedCity && (bdc.city || bdc.locality)) {
          resolvedCity = bdc.city || bdc.locality || '';
        }

        // Locality / Area fallback
        if (!resolvedArea && bdc.locality) {
          resolvedArea = bdc.locality;
        }

        // State fallback
        if (!resolvedState && bdc.principalSubdivision) {
          resolvedState = bdc.principalSubdivision;
        }

        if (bdc.countryName) {
          resolvedCountry = bdc.countryName;
        }
      }
    } catch (bdcErr) {
      console.warn('[ReverseGeocode] BigDataCloud Tier 2 notice:', bdcErr);
    }
  }

  // --- TIER 3: Locality-based Postal Search Fallback if PIN is still missing or suspicious ---
  if (!resolvedPincode || resolvedPincode.startsWith('255001') || resolvedPincode === '000000') {
    if (resolvedArea) {
      const areaPin = await lookupPincodeByLocality(resolvedArea);
      if (areaPin) {
        resolvedPincode = areaPin;
        confidence = 'high';
      }
    }
    if (!resolvedPincode && resolvedCity) {
      const cityPin = await lookupPincodeByLocality(resolvedCity);
      if (cityPin) {
        resolvedPincode = cityPin;
        confidence = 'medium';
      }
    }
  }

  // --- TIER 4: India Post Pincode Verification & Enhancement ---
  if (resolvedPincode && /^[1-9][0-9]{5}$/.test(resolvedPincode)) {
    try {
      const postalInfo = await lookupPostalPincode(resolvedPincode);
      if (postalInfo.verified) {
        // If city is missing or too generic, use verified District
        if (!resolvedCity && postalInfo.district) {
          resolvedCity = postalInfo.district;
        }
        if (!resolvedState && postalInfo.state) {
          resolvedState = postalInfo.state;
        }
        if (postalInfo.postOfficeName && !resolvedArea) {
          resolvedArea = postalInfo.postOfficeName;
        }
        confidence = 'high';
      }
    } catch (postalErr) {
      console.warn('[ReverseGeocode] Tier 4 postal verification notice:', postalErr);
    }
  }

  // Build clean, human-readable street string (without raw coordinates!)
  let cleanStreet = [resolvedStreet, resolvedArea].filter(Boolean).join(', ');
  if (!cleanStreet) {
    if (resolvedCity) {
      cleanStreet = `Near ${resolvedCity}`;
    } else {
      cleanStreet = 'Current Doorstep Location';
    }
  }

  // Fallbacks if city or state still missing
  const finalCity = resolvedCity || 'Current Location';
  const finalState = resolvedState || '';
  const finalPincode = resolvedPincode || '';

  // Generate clean formatted address string
  const formattedAddress = [cleanStreet, finalCity, finalState, finalPincode]
    .filter(Boolean)
    .join(', ');

  const plusCode = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;

  return {
    street: cleanStreet,
    area: resolvedArea,
    city: finalCity,
    state: finalState,
    country: resolvedCountry || 'India',
    pincode: finalPincode,
    formattedAddress: resolvedFull || formattedAddress,
    latitude,
    longitude,
    plusCode,
    confidence,
  };
}

/**
 * All-In-One: Request GPS with high accuracy, reverse geocode to a validated address,
 * and fetch public IP address.
 */
export async function getAccurateCurrentLocation(): Promise<GeocodedAddress> {
  const [coords, ipInfo] = await Promise.all([
    getGpsCoordinates(),
    fetchPublicIpInfo().catch((): PublicIpInfo => ({ ip: 'Unknown', country: 'India' })),
  ]);

  const address = await reverseGeocodeCoordinates(coords.latitude, coords.longitude);

  // If pincode was still not found by GPS reverse geocode, fallback to IP postal if valid 6-digit
  let finalPin = address.pincode;
  if (!finalPin && ipInfo.postal && /^[1-9][0-9]{5}$/.test(ipInfo.postal)) {
    finalPin = ipInfo.postal;
  }

  return {
    ...address,
    pincode: finalPin,
    accuracy: coords.accuracy,
    ipAddress: ipInfo.ip,
    country: address.country || ipInfo.country || 'India',
  };
}

