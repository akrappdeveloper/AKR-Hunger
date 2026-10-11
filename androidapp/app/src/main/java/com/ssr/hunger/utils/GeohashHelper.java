package com.ssr.hunger.utils;

/**
 * Geohash encoding utility for Android.
 * Computes geohash strings for coordinates to enable
 * Firestore geospatial queries for restaurant discovery.
 *
 * Precision reference:
 * - 5 chars: ~4.9km cell
 * - 6 chars: ~1.2km cell
 * - 7 chars: ~153m cell
 * - 9 chars: ~4.8m cell (default)
 */
public class GeohashHelper {

    private static final String BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

    /**
     * Encode latitude/longitude to geohash string.
     *
     * @param latitude  Latitude in degrees (-90 to 90)
     * @param longitude Longitude in degrees (-180 to 180)
     * @param precision Number of characters (1-12, default 9)
     * @return Geohash string
     */
    public static String encode(double latitude, double longitude, int precision) {
        if (precision < 1) precision = 1;
        if (precision > 12) precision = 12;

        double[] latRange = {-90.0, 90.0};
        double[] lonRange = {-180.0, 180.0};
        StringBuilder hash = new StringBuilder();
        boolean isEven = true;
        int bit = 0;
        int ch = 0;

        while (hash.length() < precision) {
            if (isEven) {
                double mid = (lonRange[0] + lonRange[1]) / 2;
                if (longitude >= mid) {
                    ch |= (1 << (4 - bit));
                    lonRange[0] = mid;
                } else {
                    lonRange[1] = mid;
                }
            } else {
                double mid = (latRange[0] + latRange[1]) / 2;
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
                hash.append(BASE32.charAt(ch));
                bit = 0;
                ch = 0;
            }
        }

        return hash.toString();
    }

    /**
     * Encode with default precision of 9 characters (~4.8m accuracy).
     */
    public static String encode(double latitude, double longitude) {
        return encode(latitude, longitude, 9);
    }

    /**
     * Calculate Haversine straight-line distance between two points in meters.
     *
     * @param lat1 First point latitude
     * @param lon1 First point longitude
     * @param lat2 Second point latitude
     * @param lon2 Second point longitude
     * @return Distance in meters
     */
    public static double haversineDistance(double lat1, double lon1, double lat2, double lon2) {
        final double R = 6371000; // Earth radius in meters
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1))
                * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Check if a coordinate pair is valid.
     */
    public static boolean isValidCoordinate(double lat, double lon) {
        return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 && (lat != 0 || lon != 0);
    }

    /**
     * Format distance for display.
     *
     * @param meters Distance in meters
     * @return Human-readable distance string
     */
    public static String formatDistance(double meters) {
        if (meters < 1000) {
            return String.format("%.0f m", meters);
        }
        return String.format("%.1f km", meters / 1000);
    }
}
