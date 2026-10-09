package com.ssr.hunger.delivery.activities;

import android.animation.ValueAnimator;
import android.content.Intent;
import android.graphics.Color;
import android.location.Location;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.preference.PreferenceManager;
import android.view.View;
import android.view.animation.LinearInterpolator;
import android.widget.ImageButton;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import com.google.android.material.button.MaterialButton;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import com.ssr.hunger.delivery.R;
import com.ssr.hunger.delivery.utils.Constants;
import com.ssr.hunger.delivery.utils.NetworkInfoHelper;
import com.ssr.hunger.delivery.utils.PermissionManager;

import org.osmdroid.config.Configuration;
import org.osmdroid.tileprovider.tilesource.TileSourceFactory;
import org.osmdroid.util.GeoPoint;
import org.osmdroid.views.MapView;
import org.osmdroid.views.overlay.Marker;
import org.osmdroid.views.overlay.Polyline;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Live Tracking Radar Activity with custom open-source OpenStreetMap (OSMDroid).
 * Features:
 * - Real-time animated moving bike marker with direction rotation
 * - Route polyline between rider and delivery target
 * - Live Speedometer, compass heading, distance, ETA, and GPS accuracy
 * - Network IP address & connection type telemetry
 * - Live GPS mode + interactive simulated delivery ride mode
 */
public class LiveTrackingRadarActivity extends AppCompatActivity {

    private MapView mapView;
    private Marker bikeMarker;
    private Marker destMarker;
    private Polyline routePolyline;

    private TextView tvSpeed, tvHeading, tvAccuracy, tvCoords;
    private TextView tvDestLabel, tvDestAddress, tvDistance, tvEta, tvIpAddress, tvModeLabel;
    private View dotRadarStatus;
    private MaterialButton btnToggleSim, btnNavigate;
    private ImageButton btnBack, btnRecenter, btnZoomIn, btnZoomOut;

    private FirebaseAuth auth;
    private FirebaseFirestore db;
    private ListenerRegistration locationListener;

    private FusedLocationProviderClient fusedLocationClient;
    private LocationCallback locationCallback;

    private GeoPoint currentBikeGeoPoint;
    private GeoPoint targetDestGeoPoint;
    private float currentBearing = 0f;
    private double currentSpeedKmh = 0.0;

    private boolean isSimulating = false;
    private Handler simHandler;
    private int simIndex = 0;
    private final List<GeoPoint> simWaypoints = new ArrayList<>();

    // Order info if passed
    private String orderId;
    private String destName;
    private String destAddress;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // OSMDroid configuration
        Configuration.getInstance().load(this, PreferenceManager.getDefaultSharedPreferences(this));
        Configuration.getInstance().setUserAgentValue(getPackageName());

        setContentView(R.layout.activity_live_tracking_radar);

        auth = FirebaseAuth.getInstance();
        db = FirebaseFirestore.getInstance();
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);

        readIntentData();
        initViews();
        setupMap();
        setupSimulationWaypoints();
        updateNetworkAndIpTelemetry();

        startLiveGpsTracking();
    }

    private void readIntentData() {
        Intent intent = getIntent();
        if (intent != null) {
            orderId = intent.getStringExtra(Constants.EXTRA_ORDER_ID);
            double dLat = intent.getDoubleExtra(Constants.EXTRA_DEST_LAT, 0.0);
            double dLng = intent.getDoubleExtra(Constants.EXTRA_DEST_LNG, 0.0);
            destName = intent.getStringExtra(Constants.EXTRA_DEST_NAME);
            destAddress = intent.getStringExtra(Constants.EXTRA_DEST_ADDRESS);

            if (dLat != 0.0 && dLng != 0.0) {
                targetDestGeoPoint = new GeoPoint(dLat, dLng);
            }
        }

        // Default Pune location if no target provided
        if (targetDestGeoPoint == null) {
            targetDestGeoPoint = new GeoPoint(18.5284, 73.8743);
            destName = "Customer Drop Location";
            destAddress = "Flat 402, Green Avenue, Kothrud, Pune";
        }
    }

    private void initViews() {
        mapView = findViewById(R.id.map_view);
        btnBack = findViewById(R.id.btn_radar_back);
        tvModeLabel = findViewById(R.id.tv_radar_mode_label);
        dotRadarStatus = findViewById(R.id.dot_radar_status);
        btnToggleSim = findViewById(R.id.btn_toggle_sim);

        tvSpeed = findViewById(R.id.tv_radar_speed);
        tvHeading = findViewById(R.id.tv_radar_heading);
        tvAccuracy = findViewById(R.id.tv_radar_accuracy);

        tvDestLabel = findViewById(R.id.tv_radar_dest_label);
        tvDestAddress = findViewById(R.id.tv_radar_dest_address);
        tvDistance = findViewById(R.id.tv_radar_distance);
        tvEta = findViewById(R.id.tv_radar_eta);
        tvIpAddress = findViewById(R.id.tv_radar_ip_address);
        tvCoords = findViewById(R.id.tv_radar_coords);

        btnRecenter = findViewById(R.id.btn_map_recenter);
        btnZoomIn = findViewById(R.id.btn_map_zoom_in);
        btnZoomOut = findViewById(R.id.btn_map_zoom_out);
        btnNavigate = findViewById(R.id.btn_radar_navigate);

        if (destName != null) tvDestLabel.setText(destName);
        if (destAddress != null) tvDestAddress.setText(destAddress);

        btnBack.setOnClickListener(v -> finish());

        btnRecenter.setOnClickListener(v -> {
            if (currentBikeGeoPoint != null) {
                mapView.getController().animateTo(currentBikeGeoPoint);
            }
        });

        btnZoomIn.setOnClickListener(v -> mapView.getController().zoomIn());
        btnZoomOut.setOnClickListener(v -> mapView.getController().zoomOut());

        btnToggleSim.setOnClickListener(v -> toggleSimulationMode());

        btnNavigate.setOnClickListener(v -> {
            if (targetDestGeoPoint != null) {
                Uri uri = Uri.parse("google.navigation:q=" + targetDestGeoPoint.getLatitude() + "," + targetDestGeoPoint.getLongitude());
                Intent mapIntent = new Intent(Intent.ACTION_VIEW, uri);
                mapIntent.setPackage("com.google.android.apps.maps");
                if (mapIntent.resolveActivity(getPackageManager()) != null) {
                    startActivity(mapIntent);
                } else {
                    startActivity(new Intent(Intent.ACTION_VIEW,
                            Uri.parse("https://maps.google.com/?q=" + targetDestGeoPoint.getLatitude() + "," + targetDestGeoPoint.getLongitude())));
                }
            } else {
                Toast.makeText(this, "Destination not set", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void setupMap() {
        mapView.setTileSource(TileSourceFactory.MAPNIK);
        mapView.setMultiTouchControls(true);
        mapView.getController().setZoom(16.5);

        // Initial rider position (near target)
        currentBikeGeoPoint = new GeoPoint(targetDestGeoPoint.getLatitude() - 0.015, targetDestGeoPoint.getLongitude() - 0.012);
        mapView.getController().setCenter(currentBikeGeoPoint);

        // Bike Marker
        bikeMarker = new Marker(mapView);
        bikeMarker.setIcon(ContextCompat.getDrawable(this, R.drawable.ic_delivery_bike_pin));
        bikeMarker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER);
        bikeMarker.setTitle("Delivery Partner Bike (You)");
        bikeMarker.setPosition(currentBikeGeoPoint);
        mapView.getOverlays().add(bikeMarker);

        // Target Marker
        destMarker = new Marker(mapView);
        destMarker.setIcon(ContextCompat.getDrawable(this, R.drawable.ic_drop_pin));
        destMarker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM);
        destMarker.setTitle(destName != null ? destName : "Destination");
        destMarker.setSnippet(destAddress);
        destMarker.setPosition(targetDestGeoPoint);
        mapView.getOverlays().add(destMarker);

        // Route Polyline
        routePolyline = new Polyline();
        routePolyline.setColor(Color.parseColor("#FF6B00"));
        routePolyline.setWidth(10f);
        updateRoutePolyline();
        mapView.getOverlays().add(routePolyline);

        mapView.invalidate();
    }

    private void updateRoutePolyline() {
        if (currentBikeGeoPoint == null || targetDestGeoPoint == null) return;
        List<GeoPoint> points = new ArrayList<>();
        points.add(currentBikeGeoPoint);

        // Midpoints to simulate road curves
        double midLat = (currentBikeGeoPoint.getLatitude() + targetDestGeoPoint.getLatitude()) / 2.0;
        double midLng = (currentBikeGeoPoint.getLongitude() + targetDestGeoPoint.getLongitude()) / 2.0;
        points.add(new GeoPoint(midLat + 0.001, currentBikeGeoPoint.getLongitude() + 0.0015));
        points.add(new GeoPoint(midLat + 0.002, midLng + 0.001));
        points.add(targetDestGeoPoint);

        routePolyline.setPoints(points);
        mapView.invalidate();
    }

    private void updateNetworkAndIpTelemetry() {
        String ip = NetworkInfoHelper.getIpAddress();
        String netType = NetworkInfoHelper.getNetworkType(this);
        tvIpAddress.setText("🌐 IP: " + ip + " • " + netType);
    }

    /**
     * Smoothly animates moving bike marker to new coordinates with bearing rotation
     */
    public void animateBikeTo(GeoPoint newPoint, float newBearing, double speedKmh) {
        if (currentBikeGeoPoint == null) {
            currentBikeGeoPoint = newPoint;
            bikeMarker.setPosition(newPoint);
            bikeMarker.setRotation(newBearing);
            mapView.invalidate();
            return;
        }

        final GeoPoint startPoint = new GeoPoint(currentBikeGeoPoint.getLatitude(), currentBikeGeoPoint.getLongitude());
        final float startBearing = currentBearing;

        ValueAnimator animator = ValueAnimator.ofFloat(0f, 1f);
        animator.setDuration(950);
        animator.setInterpolator(new LinearInterpolator());
        animator.addUpdateListener(animation -> {
            float v = animation.getAnimatedFraction();
            double lat = startPoint.getLatitude() + (newPoint.getLatitude() - startPoint.getLatitude()) * v;
            double lng = startPoint.getLongitude() + (newPoint.getLongitude() - startPoint.getLongitude()) * v;
            GeoPoint currentPoint = new GeoPoint(lat, lng);

            float bearing = startBearing + (newBearing - startBearing) * v;

            bikeMarker.setPosition(currentPoint);
            bikeMarker.setRotation(bearing);

            // Update polyline start to follow bike
            List<GeoPoint> polyPoints = routePolyline.getActualPoints();
            if (polyPoints != null && !polyPoints.isEmpty()) {
                polyPoints.set(0, currentPoint);
                routePolyline.setPoints(polyPoints);
            }

            mapView.invalidate();
        });
        animator.start();

        currentBikeGeoPoint = newPoint;
        currentBearing = newBearing;
        currentSpeedKmh = speedKmh;

        // Animate camera to follow bike
        mapView.getController().animateTo(newPoint);

        // Update Telemetry Displays
        updateTelemetryDisplays(newPoint, newBearing, speedKmh);
    }

    private void updateTelemetryDisplays(GeoPoint point, float bearing, double speedKmh) {
        tvSpeed.setText(String.valueOf(Math.max(0, Math.round(speedKmh))));
        tvHeading.setText(getDirectionFromHeading(bearing) + " " + Math.round(bearing) + "°");
        tvCoords.setText(String.format(Locale.getDefault(), "GPS: %.4f° N, %.4f° E", point.getLatitude(), point.getLongitude()));

        // Calculate distance remaining to target
        float[] results = new float[1];
        Location.distanceBetween(
                point.getLatitude(), point.getLongitude(),
                targetDestGeoPoint.getLatitude(), targetDestGeoPoint.getLongitude(),
                results
        );
        float distanceMeters = results[0];

        if (distanceMeters < 1000) {
            tvDistance.setText(String.format(Locale.getDefault(), "%.0f m", distanceMeters));
        } else {
            tvDistance.setText(String.format(Locale.getDefault(), "%.1f km", distanceMeters / 1000f));
        }

        // Calculate ETA
        double speedMps = Math.max(speedKmh * (1000.0 / 3600.0), 5.5); // Min ~20 km/h avg in traffic
        int etaMinutes = (int) Math.ceil((distanceMeters / speedMps) / 60.0);
        tvEta.setText("~" + etaMinutes + " mins ETA");
    }

    private String getDirectionFromHeading(double heading) {
        if (heading >= 337.5 || heading < 22.5) return "N";
        if (heading >= 22.5 && heading < 67.5) return "NE";
        if (heading >= 67.5 && heading < 112.5) return "E";
        if (heading >= 112.5 && heading < 157.5) return "SE";
        if (heading >= 157.5 && heading < 202.5) return "S";
        if (heading >= 202.5 && heading < 247.5) return "SW";
        if (heading >= 247.5 && heading < 292.5) return "W";
        return "NW";
    }

    /**
     * Start live GPS reception via FusedLocationProviderClient and Firestore driver locations
     */
    private void startLiveGpsTracking() {
        if (!PermissionManager.hasLocationPermission(this)) return;

        try {
            LocationRequest request = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 2000)
                    .setMinUpdateIntervalMillis(1000)
                    .setMinUpdateDistanceMeters(1f)
                    .build();

            locationCallback = new LocationCallback() {
                @Override
                public void onLocationResult(LocationResult result) {
                    if (result == null || isSimulating) return;
                    Location loc = result.getLastLocation();
                    if (loc != null) {
                        tvAccuracy.setText(String.format(Locale.getDefault(), "±%.0fm", loc.getAccuracy()));
                        double speedKmh = loc.hasSpeed() ? loc.getSpeed() * 3.6 : currentSpeedKmh;
                        float bearing = loc.hasBearing() ? loc.getBearing() : currentBearing;
                        animateBikeTo(new GeoPoint(loc.getLatitude(), loc.getLongitude()), bearing, speedKmh);
                    }
                }
            };

            fusedLocationClient.requestLocationUpdates(request, locationCallback, Looper.getMainLooper());

            // Also listen to Firestore live driver location updates
            if (auth.getCurrentUser() != null) {
                locationListener = db.collection(Constants.COLLECTION_DRIVER_LOCATIONS)
                        .document(auth.getCurrentUser().getUid())
                        .addSnapshotListener((snap, e) -> {
                            if (e != null || snap == null || !snap.exists() || isSimulating) return;
                            Double lat = snap.getDouble("latitude");
                            Double lng = snap.getDouble("longitude");
                            Double speed = snap.getDouble("speed");
                            Double heading = snap.getDouble("heading");
                            Double accuracy = snap.getDouble("accuracy");

                            if (accuracy != null) {
                                tvAccuracy.setText(String.format(Locale.getDefault(), "±%.0fm", accuracy));
                            }
                            if (lat != null && lng != null) {
                                float bearing = heading != null ? heading.floatValue() : currentBearing;
                                double spd = speed != null ? speed : currentSpeedKmh;
                                animateBikeTo(new GeoPoint(lat, lng), bearing, spd);
                            }
                        });
            }
        } catch (SecurityException ignored) {
        }
    }

    /**
     * Simulation Route Waypoints for realistic running delivery bike animation
     */
    private void setupSimulationWaypoints() {
        simWaypoints.clear();
        double startLat = targetDestGeoPoint.getLatitude() - 0.015;
        double startLng = targetDestGeoPoint.getLongitude() - 0.012;

        // Path of coordinates winding through city streets towards destination
        simWaypoints.add(new GeoPoint(startLat, startLng));
        simWaypoints.add(new GeoPoint(startLat + 0.002, startLng + 0.001));
        simWaypoints.add(new GeoPoint(startLat + 0.004, startLng + 0.0025));
        simWaypoints.add(new GeoPoint(startLat + 0.007, startLng + 0.004));
        simWaypoints.add(new GeoPoint(startLat + 0.009, startLng + 0.0065));
        simWaypoints.add(new GeoPoint(startLat + 0.011, startLng + 0.0085));
        simWaypoints.add(new GeoPoint(startLat + 0.013, startLng + 0.010));
        simWaypoints.add(targetDestGeoPoint);
    }

    private void toggleSimulationMode() {
        if (!isSimulating) {
            isSimulating = true;
            tvModeLabel.setText("SIMULATION RUNNING");
            dotRadarStatus.setBackgroundTintList(ContextCompat.getColorStateList(this, R.color.primary));
            btnToggleSim.setText("Stop Sim");
            Toast.makeText(this, "Simulating live delivery bike movement", Toast.LENGTH_SHORT).show();

            simIndex = 0;
            simHandler = new Handler(Looper.getMainLooper());
            runSimulationStep();
        } else {
            isSimulating = false;
            tvModeLabel.setText("LIVE GPS");
            dotRadarStatus.setBackgroundTintList(ContextCompat.getColorStateList(this, R.color.veg_green));
            btnToggleSim.setText("Test Sim");
            if (simHandler != null) simHandler.removeCallbacksAndMessages(null);
            Toast.makeText(this, "Resumed Live GPS Radar", Toast.LENGTH_SHORT).show();
        }
    }

    private void runSimulationStep() {
        if (!isSimulating || simWaypoints.isEmpty()) return;

        if (simIndex >= simWaypoints.size()) {
            simIndex = 0; // Loop simulation
        }

        GeoPoint targetPoint = simWaypoints.get(simIndex);
        float bearing = (float) calculateBearing(currentBikeGeoPoint, targetPoint);
        double speed = 26.0 + (Math.random() * 12.0); // 26 - 38 km/h dynamic speed

        animateBikeTo(targetPoint, bearing, speed);

        simIndex++;
        simHandler.postDelayed(this::runSimulationStep, 1500);
    }

    private double calculateBearing(GeoPoint from, GeoPoint to) {
        if (from == null || to == null) return 0.0;
        double lat1 = Math.toRadians(from.getLatitude());
        double lon1 = Math.toRadians(from.getLongitude());
        double lat2 = Math.toRadians(to.getLatitude());
        double lon2 = Math.toRadians(to.getLongitude());

        double dLon = lon2 - lon1;
        double y = Math.sin(dLon) * Math.cos(lat2);
        double x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
        double radians = Math.atan2(y, x);
        return (Math.toDegrees(radians) + 360) % 360;
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (mapView != null) mapView.onResume();
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (mapView != null) mapView.onPause();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (locationListener != null) locationListener.remove();
        if (locationCallback != null && fusedLocationClient != null) {
            fusedLocationClient.removeLocationUpdates(locationCallback);
        }
        if (simHandler != null) {
            simHandler.removeCallbacksAndMessages(null);
        }
        if (mapView != null) {
            mapView.onDetach();
        }
    }
}
