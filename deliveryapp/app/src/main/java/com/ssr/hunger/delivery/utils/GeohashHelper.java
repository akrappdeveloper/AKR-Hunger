package com.ssr.hunger.delivery.utils;

/**
 * Geohash utility for Delivery Partner App.
 * Computes geohash strings and distance metrics for delivery partner tracking.
 */
public class GeohashHelper {

    private static final String BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

    /**
     * Encode latitude/longitude to geohash string.
     *
     * @param latitude  Latitude (-90 to 90)
     * @param longitude Longitude (-180 to 180)
     * @param precision Precision length (1-12)
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
                double mid = (lonRange[0] + lonRange[1]) / 2.0;
                if (longitude >= mid) {
                    ch |= (1 << (4 - bit));
                    lonRange[0] = mid;
                } else {
                    lonRange[1] = mid;
                }
            } else {
                double mid = (latRange[0] + latRange[1]) / 2.0;
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
     * Default 7-character geohash (~153m cell accuracy), ideal for partner assignment.
     */
    public static String encode(double latitude, double longitude) {
        return encode(latitude, longitude, 7);
    }

    /**
     * Haversine straight-line distance in meters.
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
     * Coordinate validation.
     */
    public static boolean isValidCoordinate(double lat, double lon) {
        if (Double.isNaN(lat) || Double.isNaN(lon)) return false;
        if (Double.isInfinite(lat) || Double.isInfinite(lon)) return false;
        if (lat < -90.0 || lat > 90.0) return false;
        if (lon < -180.0 || lon > 180.0) return false;
        // Exclude exact 0,0 (Null Island) unless proven valid
        return !(Math.abs(lat) < 0.0001 && Math.abs(lon) < 0.0001);
    }
}
