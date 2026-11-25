package com.ssr.hunger.delivery.utils;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class LocationUtils {

    /**
     * Calculates distance between two coordinates in kilometers using the Haversine formula.
     */
    public static double calculateDistanceKm(double lat1, double lon1, double lat2, double lon2) {
        if (lat1 == 0 || lon1 == 0 || lat2 == 0 || lon2 == 0) return 0.0;
        final int R = 6371; // Earth radius in km
        double latDistance = Math.toRadians(lat2 - lat1);
        double lonDistance = Math.toRadians(lon2 - lon1);
        double a = Math.sin(latDistance / 2) * Math.sin(latDistance / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(lonDistance / 2) * Math.sin(lonDistance / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Math.round(R * c * 10.0) / 10.0;
    }

    public static boolean isValidCoordinate(double lat, double lon) {
        return GeohashHelper.isValidCoordinate(lat, lon);
    }

    public static String formatDistance(double km) {
        if (km <= 0) return "Nearby";
        return String.format(Locale.getDefault(), "%.1f km", km);
    }

    public static String formatCurrency(double amount) {
        return "₹" + (int) Math.round(amount);
    }

    public static String formatDateTime(Date date) {
        if (date == null) return "Just now";
        SimpleDateFormat sdf = new SimpleDateFormat("dd MMM, hh:mm a", Locale.getDefault());
        return sdf.format(date);
    }

    public static String formatTime(Date date) {
        if (date == null) return "";
        SimpleDateFormat sdf = new SimpleDateFormat("hh:mm a", Locale.getDefault());
        return sdf.format(date);
    }
}
