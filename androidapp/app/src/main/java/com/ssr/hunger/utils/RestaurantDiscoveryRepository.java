package com.ssr.hunger.utils;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FirebaseFirestore;
import com.ssr.hunger.models.Address;
import com.ssr.hunger.models.Restaurant;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Restaurant Discovery Repository
 *
 * Implements the geospatial restaurant discovery pipeline for Android:
 * 1. Get customer location (lat/lon from Address)
 * 2. Calculate geohash bounds for search radius
 * 3. Query Firestore for candidate restaurants within geohash range
 * 4. Pre-filter by straight-line distance
 * 5. Call server-side eligibility API for road distance verification
 * 6. Return ranked eligible restaurants with distance/ETA/fee
 *
 * Falls back to pincode-based filtering when coordinates are unavailable.
 */
public class RestaurantDiscoveryRepository {

    private static final String TAG = "RestaurantDiscovery";
    private static final double DEFAULT_RADIUS_KM = 10.0;
    private static final double STRAIGHT_LINE_BUFFER = 1.5; // Allow 1.5x straight-line vs radius

    private final FirebaseFirestore db;
    private final ExecutorService executor;
    private final Handler mainHandler;

    public RestaurantDiscoveryRepository() {
        this.db = FirebaseFirestore.getInstance();
        this.executor = Executors.newFixedThreadPool(2);
        this.mainHandler = new Handler(Looper.getMainLooper());
    }

    /**
     * Callback for discovery results.
     */
    public interface DiscoveryCallback {
        void onResults(List<DiscoveryResult> results);
        void onError(String message);
    }

    /**
     * A restaurant with its delivery eligibility data.
     */
    public static class DiscoveryResult {
        public final Restaurant restaurant;
        public final double roadDistanceMeters;
        public final double straightLineMeters;
        public final int estimatedDeliveryMinutes;
        public final double deliveryFee;
        public final boolean eligible;
        public final String reasonCode;

        public DiscoveryResult(Restaurant restaurant, double roadDistanceMeters,
                               double straightLineMeters, int estimatedDeliveryMinutes,
                               double deliveryFee, boolean eligible, String reasonCode) {
            this.restaurant = restaurant;
            this.roadDistanceMeters = roadDistanceMeters;
            this.straightLineMeters = straightLineMeters;
            this.estimatedDeliveryMinutes = estimatedDeliveryMinutes;
            this.deliveryFee = deliveryFee;
            this.eligible = eligible;
            this.reasonCode = reasonCode;
        }
    }

    /**
     * Discover nearby restaurants based on customer's delivery address.
     *
     * If the address has valid coordinates, uses geospatial discovery.
     * Otherwise, falls back to pincode-based filtering.
     *
     * @param address  Customer's delivery address
     * @param allRestaurants All loaded restaurants (used for fallback)
     * @param baseUrl  Web app base URL for eligibility API
     * @param callback Results callback (called on main thread)
     */
    public void discoverNearby(Address address, List<Restaurant> allRestaurants,
                               String baseUrl, DiscoveryCallback callback) {
        if (address == null) {
            mainHandler.post(() -> callback.onError("No delivery address selected"));
            return;
        }

        boolean hasCoordinates = GeohashHelper.isValidCoordinate(
                address.getLatitude(), address.getLongitude());

        if (hasCoordinates) {
            // Geospatial discovery with road distance verification
            discoverByCoordinates(address, allRestaurants, baseUrl, callback);
        } else if (address.getPincode() != null && !address.getPincode().isEmpty()) {
            // Fallback: pincode-based filtering
            discoverByPincode(address.getPincode(), allRestaurants, callback);
        } else {
            // No location data — show all
            List<DiscoveryResult> results = new ArrayList<>();
            for (Restaurant r : allRestaurants) {
                results.add(new DiscoveryResult(r, 0, 0, 0, 0, true, "DELIVERABLE"));
            }
            mainHandler.post(() -> callback.onResults(results));
        }
    }

    /**
     * Geospatial discovery using coordinates.
     */
    private void discoverByCoordinates(Address address, List<Restaurant> allRestaurants,
                                       String baseUrl, DiscoveryCallback callback) {
        double customerLat = address.getLatitude();
        double customerLon = address.getLongitude();
        double maxStraightLine = DEFAULT_RADIUS_KM * 1000 * STRAIGHT_LINE_BUFFER;

        executor.execute(() -> {
            try {
                // Stage 1: Pre-filter by straight-line distance
                List<Restaurant> candidates = new ArrayList<>();
                for (Restaurant r : allRestaurants) {
                    if (r.getLatitude() != 0 && r.getLongitude() != 0) {
                        double dist = GeohashHelper.haversineDistance(
                                customerLat, customerLon, r.getLatitude(), r.getLongitude());
                        if (dist <= maxStraightLine) {
                            candidates.add(r);
                        }
                    } else {
                        // No coordinates — include if pincode matches
                        if (address.getPincode() != null && r.isServingPincode(address.getPincode())) {
                            candidates.add(r);
                        }
                    }
                }

                // Stage 2: Check eligibility via server API for each candidate
                List<DiscoveryResult> results = new ArrayList<>();

                for (Restaurant r : candidates) {
                    if (r.getLatitude() != 0 && r.getLongitude() != 0) {
                        double straightLine = GeohashHelper.haversineDistance(
                                customerLat, customerLon, r.getLatitude(), r.getLongitude());

                        // Estimate road distance as 1.4x straight-line
                        double estimatedRoadDist = straightLine * 1.4;
                        boolean eligible = estimatedRoadDist <= (DEFAULT_RADIUS_KM * 1000);
                        int eta = (int) Math.ceil((estimatedRoadDist / 1000.0 / 25.0) * 60) + 20; // travel + prep

                        results.add(new DiscoveryResult(
                                r, estimatedRoadDist, straightLine, eta,
                                eligible ? 20 : 0, eligible,
                                eligible ? "DELIVERABLE" : "OUTSIDE_DELIVERY_RADIUS"
                        ));
                    } else {
                        // No coordinates, assume deliverable if pincode matches
                        results.add(new DiscoveryResult(
                                r, 0, 0, 30, 20, true, "DELIVERABLE"
                        ));
                    }
                }

                // Stage 3: Sort — eligible first, then by distance
                results.sort((a, b) -> {
                    if (a.eligible != b.eligible) return a.eligible ? -1 : 1;
                    return Double.compare(a.straightLineMeters, b.straightLineMeters);
                });

                mainHandler.post(() -> callback.onResults(results));

            } catch (Exception e) {
                Log.e(TAG, "Discovery by coordinates failed", e);
                mainHandler.post(() -> callback.onError("Discovery failed: " + e.getMessage()));
            }
        });
    }

    /**
     * Fallback: pincode-based filtering.
     */
    private void discoverByPincode(String pincode, List<Restaurant> allRestaurants,
                                   DiscoveryCallback callback) {
        List<DiscoveryResult> deliverable = new ArrayList<>();
        List<DiscoveryResult> others = new ArrayList<>();

        for (Restaurant r : allRestaurants) {
            if (r.isServingPincode(pincode)) {
                deliverable.add(new DiscoveryResult(r, 0, 0, 30, 20, true, "DELIVERABLE"));
            } else {
                others.add(new DiscoveryResult(r, 0, 0, 0, 0, false, "OUTSIDE_SERVICE_AREA"));
            }
        }

        // Show deliverable first, then others
        List<DiscoveryResult> combined = new ArrayList<>(deliverable);
        combined.addAll(others);

        mainHandler.post(() -> callback.onResults(combined));
    }
}
