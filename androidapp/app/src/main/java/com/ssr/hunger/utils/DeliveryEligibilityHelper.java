package com.ssr.hunger.utils;

import android.os.Handler;
import android.os.Looper;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Delivery Eligibility Helper for Android.
 * Checks delivery eligibility by calling the server-side API.
 *
 * SECURITY: All eligibility decisions are made server-side.
 * This helper only relays the server's response to the UI.
 */
public class DeliveryEligibilityHelper {

    private static final ExecutorService executor = Executors.newSingleThreadExecutor();
    private static final Handler mainHandler = new Handler(Looper.getMainLooper());

    /**
     * Result of a delivery eligibility check.
     */
    public static class EligibilityResult {
        public final boolean eligible;
        public final String reasonCode;
        public final String serviceMode;
        public final double roadDistanceMeters;
        public final int estimatedDeliveryMinutes;
        public final double deliveryFee;
        public final String error;

        public EligibilityResult(boolean eligible, String reasonCode, String serviceMode,
                                 double roadDistanceMeters, int estimatedDeliveryMinutes,
                                 double deliveryFee, String error) {
            this.eligible = eligible;
            this.reasonCode = reasonCode;
            this.serviceMode = serviceMode;
            this.roadDistanceMeters = roadDistanceMeters;
            this.estimatedDeliveryMinutes = estimatedDeliveryMinutes;
            this.deliveryFee = deliveryFee;
            this.error = error;
        }

        public String getFormattedDistance() {
            return GeohashHelper.formatDistance(roadDistanceMeters);
        }

        public String getFormattedEta() {
            if (estimatedDeliveryMinutes < 60) {
                return estimatedDeliveryMinutes + " min";
            }
            int hours = estimatedDeliveryMinutes / 60;
            int mins = estimatedDeliveryMinutes % 60;
            return hours + "h " + mins + "m";
        }

        public String getFormattedFee() {
            if (deliveryFee <= 0) return "FREE";
            return "₹" + (int) deliveryFee;
        }
    }

    /**
     * Callback interface for eligibility check results.
     */
    public interface EligibilityCallback {
        void onResult(EligibilityResult result);
    }

    /**
     * Check delivery eligibility for a restaurant to a customer location.
     * Calls the server-side API asynchronously and returns result on the main thread.
     *
     * @param baseUrl       The base URL of the Next.js web server (e.g., "https://your-app.vercel.app")
     * @param restaurantId  The Firestore restaurant document ID
     * @param customerLat   Customer's latitude
     * @param customerLon   Customer's longitude
     * @param callback      Callback to receive the result on the main thread
     */
    public static void checkEligibility(String baseUrl, String restaurantId,
                                        double customerLat, double customerLon,
                                        EligibilityCallback callback) {
        executor.execute(() -> {
            try {
                URL url = new URL(baseUrl + "/api/delivery/eligibility");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(10000);
                conn.setDoOutput(true);

                // Build request body
                JSONObject body = new JSONObject();
                body.put("restaurantId", restaurantId);
                body.put("customerLat", customerLat);
                body.put("customerLon", customerLon);

                try (OutputStream os = conn.getOutputStream()) {
                    os.write(body.toString().getBytes(StandardCharsets.UTF_8));
                }

                int responseCode = conn.getResponseCode();
                if (responseCode == 200) {
                    BufferedReader reader = new BufferedReader(
                            new InputStreamReader(conn.getInputStream()));
                    StringBuilder response = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        response.append(line);
                    }
                    reader.close();

                    JSONObject data = new JSONObject(response.toString());
                    JSONObject eligibility = data.getJSONObject("eligibility");

                    EligibilityResult result = new EligibilityResult(
                            eligibility.optBoolean("eligible", false),
                            eligibility.optString("reasonCode", "UNKNOWN"),
                            eligibility.optString("serviceMode", "standard"),
                            eligibility.optDouble("roadDistanceMeters", 0),
                            eligibility.optInt("estimatedDeliveryMinutes", 0),
                            eligibility.optDouble("deliveryFee", 0),
                            null
                    );

                    mainHandler.post(() -> callback.onResult(result));
                } else {
                    mainHandler.post(() -> callback.onResult(new EligibilityResult(
                            false, "API_ERROR", "standard", 0, 0, 0,
                            "Server returned HTTP " + responseCode
                    )));
                }
                conn.disconnect();
            } catch (Exception e) {
                mainHandler.post(() -> callback.onResult(new EligibilityResult(
                        false, "NETWORK_ERROR", "standard", 0, 0, 0,
                        e.getMessage()
                )));
            }
        });
    }

    /**
     * Calculate straight-line distance locally (for quick pre-filtering).
     * For accurate road distance, use checkEligibility() which calls the server.
     *
     * @param restaurantLat Restaurant latitude
     * @param restaurantLon Restaurant longitude
     * @param customerLat   Customer latitude
     * @param customerLon   Customer longitude
     * @return Distance in meters
     */
    public static double quickDistanceCheck(double restaurantLat, double restaurantLon,
                                            double customerLat, double customerLon) {
        return GeohashHelper.haversineDistance(restaurantLat, restaurantLon, customerLat, customerLon);
    }
}
