package com.ssr.hunger.dialogs;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Dialog;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Color;
import android.location.Address;
import android.location.Geocoder;
import android.location.Location;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.DisplayMetrics;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.animation.AccelerateDecelerateInterpolator;
import android.view.animation.OvershootInterpolator;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ImageView;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import com.google.android.material.bottomsheet.BottomSheetBehavior;
import com.google.android.material.bottomsheet.BottomSheetDialog;
import com.google.android.material.bottomsheet.BottomSheetDialogFragment;
import com.google.android.material.button.MaterialButton;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.FirebaseFirestore;
import com.ssr.hunger.R;
import com.ssr.hunger.utils.CartManager;
import com.ssr.hunger.utils.Constants;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * High-Performance Interactive Map Location Picker Dialog.
 * Fixes lag, hang, and blinking with:
 * - 350ms debounced reverse geocoding
 * - Hardware layer accelerated WebView with non-flickering background
 * - Background ExecutorService thread pooling
 * - Complete location capture: Street, Area, Landmark, City, State, Pincode, Coords
 * - Auto-persistence to CartManager & Firestore customer profile
 */
public class MapPickerDialog extends BottomSheetDialogFragment {

    public interface OnLocationPickedListener {
        void onLocationPicked(com.ssr.hunger.models.Address address);
    }

    private OnLocationPickedListener listener;
    private WebView webView;
    private TextView tvAddressTitle;
    private TextView tvAddressDesc;
    private ProgressBar progressBar;
    private ProgressBar pbGeocoding;
    private ImageView ivCenterPin;
    private View viewPinShadow;
    private MaterialButton btnConfirm;
    private MaterialButton btnOpenExternal;
    private MaterialButton btnHeaderGps;

    private double currentLat = 28.6139; // Default New Delhi
    private double currentLon = 77.2090;

    // Full Address Fields
    private String resolvedStreet = "";
    private String resolvedArea = "";
    private String resolvedLandmark = "";
    private String resolvedCity = "";
    private String resolvedState = "";
    private String resolvedPincode = "";
    private String resolvedFormattedAddress = "";

    private FusedLocationProviderClient fusedLocationClient;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final ExecutorService geocodeExecutor = Executors.newSingleThreadExecutor();
    private boolean isPinElevated = false;

    private static class CachedAddress {
        final double lat;
        final double lon;
        final String street;
        final String area;
        final String landmark;
        final String city;
        final String state;
        final String pincode;
        final String formatted;

        CachedAddress(double lat, double lon, String street, String area, String landmark, String city, String state, String pincode, String formatted) {
            this.lat = lat;
            this.lon = lon;
            this.street = street;
            this.area = area;
            this.landmark = landmark;
            this.city = city;
            this.state = state;
            this.pincode = pincode;
            this.formatted = formatted;
        }
    }

    private static String cachedLeafletJs = null;
    private static String cachedLeafletCss = null;

    private final Map<String, CachedAddress> addressCache = new HashMap<>();
    private double lastResolvedLat = 0;
    private double lastResolvedLon = 0;
    private boolean hasResolvedBefore = false;

    private String loadAssetString(String filename) {
        if (getContext() == null) return null;
        try (InputStream is = requireContext().getAssets().open(filename);
             BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line).append('\n');
            }
            return sb.toString();
        } catch (Exception e) {
            return null;
        }
    }

    // 350ms debounce runnable to eliminate UI freeze/hang while panning
    private final Runnable geocodeDebounceRunnable = new Runnable() {
        @Override
        public void run() {
            executeReverseGeocode(currentLat, currentLon);
        }
    };

    public static MapPickerDialog newInstance(double lat, double lon) {
        MapPickerDialog fragment = new MapPickerDialog();
        Bundle args = new Bundle();
        args.putDouble("lat", lat);
        args.putDouble("lon", lon);
        fragment.setArguments(args);
        return fragment;
    }

    public void setOnLocationPickedListener(OnLocationPickedListener listener) {
        this.listener = listener;
    }

    @Override
    public void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setStyle(STYLE_NORMAL, R.style.ThemeOverlay_AKR_BottomSheetDialog);
        if (getArguments() != null) {
            double argLat = getArguments().getDouble("lat", 0);
            double argLon = getArguments().getDouble("lon", 0);
            if (argLat != 0 && argLon != 0) {
                currentLat = argLat;
                currentLon = argLon;
            }
        }
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(requireContext());
    }

    @NonNull
    @Override
    public Dialog onCreateDialog(@Nullable Bundle savedInstanceState) {
        BottomSheetDialog dialog = (BottomSheetDialog) super.onCreateDialog(savedInstanceState);
        dialog.setOnShowListener(d -> {
            BottomSheetDialog bsd = (BottomSheetDialog) d;
            View bottomSheet = bsd.findViewById(com.google.android.material.R.id.design_bottom_sheet);
            if (bottomSheet != null) {
                configureBottomSheetSize(bottomSheet);
            }
        });
        return dialog;
    }

    @SuppressLint("ClickableViewAccessibility")
    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        View view = inflater.inflate(R.layout.dialog_map_picker, container, false);

        webView = view.findViewById(R.id.web_view_map);
        tvAddressTitle = view.findViewById(R.id.tv_picked_address_title);
        tvAddressDesc = view.findViewById(R.id.tv_picked_address_desc);
        progressBar = view.findViewById(R.id.map_progress);
        pbGeocoding = view.findViewById(R.id.pb_geocoding);
        ivCenterPin = view.findViewById(R.id.iv_center_pin);
        viewPinShadow = view.findViewById(R.id.view_pin_shadow);
        btnConfirm = view.findViewById(R.id.btn_confirm_location);
        btnOpenExternal = view.findViewById(R.id.btn_open_external_map);
        btnHeaderGps = view.findViewById(R.id.btn_header_gps);

        view.findViewById(R.id.btn_close_map).setOnClickListener(v -> dismiss());

        view.findViewById(R.id.fab_my_location).setOnClickListener(v -> detectCurrentLocationAndCenter());
        if (btnHeaderGps != null) {
            btnHeaderGps.setOnClickListener(v -> detectCurrentLocationAndCenter());
        }

        btnOpenExternal.setOnClickListener(v -> openInExternalMapApp());

        btnConfirm.setOnClickListener(v -> confirmAndSaveAddress());

        // Prevent BottomSheet touch interception when interacting with the map
        webView.setOnTouchListener((v, event) -> {
            switch (event.getAction()) {
                case MotionEvent.ACTION_DOWN:
                case MotionEvent.ACTION_MOVE:
                    v.getParent().requestDisallowInterceptTouchEvent(true);
                    break;
                case MotionEvent.ACTION_UP:
                case MotionEvent.ACTION_CANCEL:
                    v.getParent().requestDisallowInterceptTouchEvent(false);
                    break;
            }
            return false;
        });

        setupWebView();
        return view;
    }

    @Override
    public void onStart() {
        super.onStart();
        if (getDialog() instanceof BottomSheetDialog) {
            BottomSheetDialog dialog = (BottomSheetDialog) getDialog();
            View bottomSheet = dialog.findViewById(com.google.android.material.R.id.design_bottom_sheet);
            if (bottomSheet != null) {
                configureBottomSheetSize(bottomSheet);
            }
        }
    }

    private static final int PERMISSION_REQ_GPS = 201;

    private void configureBottomSheetSize(@NonNull View bottomSheet) {
        if (getContext() == null) return;

        DisplayMetrics dm = getResources().getDisplayMetrics();
        int screenHeight = dm.heightPixels;
        int screenWidth = dm.widthPixels;
        boolean isLandscape = getResources().getConfiguration().orientation == Configuration.ORIENTATION_LANDSCAPE;

        int targetHeight = (isLandscape || screenHeight < 1200) ? screenHeight : (int) (screenHeight * 0.93f);

        ViewGroup.LayoutParams lp = bottomSheet.getLayoutParams();
        if (lp != null) {
            lp.height = targetHeight;
            int maxWidth = (int) (600 * dm.density);
            if (screenWidth > maxWidth) {
                lp.width = maxWidth;
            }
            bottomSheet.setLayoutParams(lp);
        }

        bottomSheet.setBackground(null);

        BottomSheetBehavior<View> behavior = BottomSheetBehavior.from(bottomSheet);
        behavior.setMaxHeight(targetHeight);
        behavior.setPeekHeight(targetHeight);
        behavior.setState(BottomSheetBehavior.STATE_EXPANDED);
        behavior.setSkipCollapsed(true);
        behavior.setFitToContents(false);
        behavior.setExpandedOffset(0);
        // CRITICAL FIX: Lock dragging so the bottom sheet NEVER jerks, lags, or moves up/down while user drags map!
        behavior.setDraggable(false);
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        // Pure solid background prevents white screen flickering
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        webView.setBackgroundColor(Color.parseColor("#F8F9FA"));

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setUserAgentString("Mozilla/5.0 (Linux; Android " + android.os.Build.VERSION.RELEASE + "; " + android.os.Build.MODEL + ") AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 Hunger/1.0");
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void onDragStarted() {
                mainHandler.post(() -> {
                    if (!isPinElevated) {
                        animatePinFloating(true);
                    }
                });
            }

            @JavascriptInterface
            public void onMovementSettled(double lat, double lon) {
                mainHandler.post(() -> {
                    currentLat = lat;
                    currentLon = lon;

                    // Pin drops down cleanly ONCE on movement settle!
                    if (isPinElevated) {
                        animatePinFloating(false);
                    }

                    // Debounce reverse geocoding to prevent lag and hang
                    mainHandler.removeCallbacks(geocodeDebounceRunnable);
                    mainHandler.postDelayed(geocodeDebounceRunnable, 350);
                });
            }
        }, "AndroidBridge");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (progressBar != null) progressBar.setVisibility(View.GONE);
                view.evaluateJavascript("if (typeof map !== 'undefined') { map.invalidateSize(); }", null);

                // Auto-detect real GPS location if permission already granted and default coords used
                if (getContext() != null) {
                    boolean hasFine = ActivityCompat.checkSelfPermission(requireContext(), Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
                    boolean hasCoarse = ActivityCompat.checkSelfPermission(requireContext(), Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
                    boolean isDefaultCoords = (Math.abs(currentLat - 28.6139) < 0.001 && Math.abs(currentLon - 77.2090) < 0.001)
                            || (currentLat == 0 && currentLon == 0);

                    if ((hasFine || hasCoarse) && isDefaultCoords) {
                        detectCurrentLocationAndCenter();
                    } else {
                        executeReverseGeocode(currentLat, currentLon);
                    }
                }
            }
        });

        loadOpenStreetMapHtml();
    }

    private void animatePinFloating(boolean moving) {
        isPinElevated = moving;
        if (ivCenterPin != null) {
            if (moving) {
                ivCenterPin.animate()
                        .translationY(-18f)
                        .setInterpolator(new AccelerateDecelerateInterpolator())
                        .setDuration(150)
                        .start();
                if (viewPinShadow != null) {
                    viewPinShadow.animate()
                            .scaleX(0.55f)
                            .scaleY(0.55f)
                            .alpha(0.3f)
                            .setDuration(150)
                            .start();
                }
            } else {
                ivCenterPin.animate()
                        .translationY(0f)
                        .setInterpolator(new OvershootInterpolator(1.4f))
                        .setDuration(240)
                        .start();
                if (viewPinShadow != null) {
                    viewPinShadow.animate()
                            .scaleX(1.0f)
                            .scaleY(1.0f)
                            .alpha(1.0f)
                            .setDuration(200)
                            .start();
                }
            }
        }
    }

    private void loadOpenStreetMapHtml() {
        if (cachedLeafletCss == null) cachedLeafletCss = loadAssetString("leaflet/leaflet.css");
        if (cachedLeafletJs == null)  cachedLeafletJs  = loadAssetString("leaflet/leaflet.js");

        StringBuilder sb = new StringBuilder();
        sb.append("<!DOCTYPE html><html><head>");
        sb.append("<meta charset='utf-8' />");
        sb.append("<meta name='viewport' content='width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no' />");

        if (cachedLeafletCss != null && !cachedLeafletCss.isEmpty()) {
            sb.append("<style>").append(cachedLeafletCss).append("</style>");
        } else {
            sb.append("<link rel='stylesheet' href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css' />");
        }

        sb.append("<style>");
        sb.append("* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }");
        sb.append("body, html, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #F8F9FA; overflow: hidden; }");
        sb.append(".leaflet-control-attribution { font-size: 8px !important; opacity: 0.55; background: rgba(255,255,255,0.7) !important; }");
        sb.append(".leaflet-bar { border: none !important; box-shadow: 0 2px 10px rgba(0,0,0,0.18) !important; border-radius: 12px !important; overflow: hidden; }");
        sb.append(".leaflet-bar a { background: #FFFFFF !important; color: #0F172A !important; width: 38px !important; height: 38px !important; line-height: 38px !important; border-bottom: 1px solid #E2E8F0 !important; font-weight: bold; font-size: 16px !important; }");
        sb.append(".leaflet-bar a:hover { background: #F8FAFC !important; }");
        sb.append("</style></head><body>");

        sb.append("<div id='map'></div>");

        if (cachedLeafletJs != null && !cachedLeafletJs.isEmpty()) {
            sb.append("<script>").append(cachedLeafletJs).append("</script>");
        } else {
            sb.append("<script src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'></script>");
        }

        sb.append("<script>");
        sb.append("var map = L.map('map', { zoomControl: false, preferCanvas: true, fadeAnimation: true, zoomAnimation: true, inertia: true }).setView([")
                .append(currentLat).append(", ").append(currentLon).append("], 16);\n");
        sb.append("L.control.zoom({ position: 'topright' }).addTo(map);\n");

        sb.append("var voyagerLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { subdomains: 'abc', maxZoom: 19, attribution: '&copy; OpenStreetMap' });\n");
        sb.append("var fallbackLayer = L.tileLayer('https://tile.openstreetmap.de/{z}/{x}/{y}.png', { subdomains: 'abc', maxZoom: 18, attribution: '&copy; OpenStreetMap' });\n");
        sb.append("voyagerLayer.addTo(map);\n");
        sb.append("voyagerLayer.on('tileerror', function() { if (!map.hasLayer(fallbackLayer)) { map.removeLayer(voyagerLayer); fallbackLayer.addTo(map); } });\n");

        sb.append("map.on('movestart dragstart', function() {\n");
        sb.append("    if (window.AndroidBridge && window.AndroidBridge.onDragStarted) {\n");
        sb.append("        window.AndroidBridge.onDragStarted();\n");
        sb.append("    }\n");
        sb.append("});\n");

        sb.append("map.on('moveend', function() {\n");
        sb.append("    var c = map.getCenter();\n");
        sb.append("    if (window.AndroidBridge && window.AndroidBridge.onMovementSettled) {\n");
        sb.append("        window.AndroidBridge.onMovementSettled(c.lat, c.lng);\n");
        sb.append("    }\n");
        sb.append("});\n");

        sb.append("function setMapCenter(lat, lon) {\n");
        sb.append("    map.setView([lat, lon], 17, { animate: true, duration: 0.5 });\n");
        sb.append("}\n");

        sb.append("window.addEventListener('resize', function() {\n");
        sb.append("    setTimeout(function() { map.invalidateSize(); }, 60);\n");
        sb.append("});\n");
        sb.append("</script></body></html>");

        webView.loadDataWithBaseURL("https://tile.openstreetmap.org/", sb.toString(), "text/html", "UTF-8", null);
    }

    private void detectCurrentLocationAndCenter() {
        if (getContext() == null) return;

        if (ActivityCompat.checkSelfPermission(requireContext(), Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED
                && ActivityCompat.checkSelfPermission(requireContext(), Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
            }, PERMISSION_REQ_GPS);
            return;
        }

        // Verify device GPS / Location service is turned on
        LocationManager lm = (LocationManager) requireContext().getSystemService(Context.LOCATION_SERVICE);
        boolean isGpsEnabled = false;
        boolean isNetworkEnabled = false;
        if (lm != null) {
            try {
                isGpsEnabled = lm.isProviderEnabled(LocationManager.GPS_PROVIDER);
                isNetworkEnabled = lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
            } catch (Exception ignored) {}
        }

        if (!isGpsEnabled && !isNetworkEnabled) {
            Toast.makeText(getContext(), "Please turn on device GPS / Location in settings", Toast.LENGTH_LONG).show();
            try {
                startActivity(new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS));
            } catch (Exception ignored) {}
            return;
        }

        if (progressBar != null) progressBar.setVisibility(View.VISIBLE);
        if (tvAddressDesc != null) tvAddressDesc.setText("Detecting high-precision GPS coordinates...");

        // 1. High precision GPS via Google Play Services Fused Location
        fusedLocationClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)
                .addOnSuccessListener(location -> {
                    if (location != null) {
                        applyGpsLocation(location.getLatitude(), location.getLongitude());
                    } else {
                        // Fallback 1: Last known location from Fused client
                        fusedLocationClient.getLastLocation().addOnSuccessListener(lastLoc -> {
                            if (lastLoc != null) {
                                applyGpsLocation(lastLoc.getLatitude(), lastLoc.getLongitude());
                            } else {
                                // Fallback 2: Native Android LocationManager
                                tryNativeLocationManager(lm);
                            }
                        }).addOnFailureListener(e -> tryNativeLocationManager(lm));
                    }
                })
                .addOnFailureListener(e -> tryNativeLocationManager(lm));
    }

    private void tryNativeLocationManager(LocationManager lm) {
        if (getContext() == null) return;
        try {
            if (lm != null) {
                Location loc = null;
                if (ActivityCompat.checkSelfPermission(requireContext(), Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                    if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                        loc = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER);
                    }
                }
                if (loc == null && (ActivityCompat.checkSelfPermission(requireContext(), Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
                        || ActivityCompat.checkSelfPermission(requireContext(), Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED)) {
                    if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                        loc = lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
                    }
                }
                if (loc != null) {
                    applyGpsLocation(loc.getLatitude(), loc.getLongitude());
                    return;
                }
            }
        } catch (Exception ignored) {}

        if (progressBar != null) progressBar.setVisibility(View.GONE);
        if (tvAddressDesc != null) tvAddressDesc.setText("Drag pin to pinpoint delivery spot");
        Toast.makeText(getContext(), "GPS signal unavailable. Drag pin on map to select spot.", Toast.LENGTH_SHORT).show();
    }

    private void applyGpsLocation(double lat, double lon) {
        if (getContext() == null) return;
        if (progressBar != null) progressBar.setVisibility(View.GONE);
        currentLat = lat;
        currentLon = lon;
        if (webView != null) {
            webView.evaluateJavascript("if (typeof setMapCenter === 'function') { setMapCenter(" + currentLat + ", " + currentLon + "); }", null);
        }
        executeReverseGeocode(currentLat, currentLon);
        Toast.makeText(getContext(), "🎯 Centered on your GPS location", Toast.LENGTH_SHORT).show();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQ_GPS) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                detectCurrentLocationAndCenter();
            } else {
                Toast.makeText(getContext(), "Location permission denied. Please drag the pin on map.", Toast.LENGTH_SHORT).show();
            }
        }
    }

    /**
     * Non-blocking, pooled thread reverse geocoding extracting complete location data:
     * Street, Area/Sublocality, Landmark, City, State, Pincode, Latitude & Longitude.
     * Prevents text blinking/clearing and caches results.
     */
    private void executeReverseGeocode(double lat, double lon) {
        // Distance check: ignore sub-15-meter micro-movements if already resolved
        if (hasResolvedBefore) {
            float[] dist = new float[1];
            Location.distanceBetween(lat, lon, lastResolvedLat, lastResolvedLon, dist);
            if (dist[0] < 15.0f) {
                return;
            }
        }

        // Fast cache check to eliminate network latency and screen flicker
        String cacheKey = String.format(Locale.US, "%.4f,%.4f", lat, lon);
        CachedAddress cached = addressCache.get(cacheKey);
        if (cached != null) {
            applyResolvedAddress(cached);
            return;
        }

        // Subtle non-intrusive spinner - DO NOT WIPE OR CLEAR tvAddressDesc!
        if (pbGeocoding != null) pbGeocoding.setVisibility(View.VISIBLE);

        geocodeExecutor.execute(() -> {
            String street = "";
            String area = "";
            String landmark = "";
            String city = "";
            String state = "";
            String pincode = "";
            String formatted = "";

            // 1. Native Android Geocoder
            try {
                if (Geocoder.isPresent() && getContext() != null) {
                    Geocoder geocoder = new Geocoder(requireContext(), Locale.getDefault());
                    List<Address> addresses = geocoder.getFromLocation(lat, lon, 1);
                    if (addresses != null && !addresses.isEmpty()) {
                        Address addr = addresses.get(0);

                        String thoro = addr.getThoroughfare();
                        String subThoro = addr.getSubThoroughfare();
                        String subLoc = addr.getSubLocality();
                        String feature = addr.getFeatureName();
                        String premises = addr.getPremises();

                        // Detailed Street / House / Road
                        if (thoro != null && !thoro.isEmpty()) {
                            street = (subThoro != null && !subThoro.isEmpty()) ? subThoro + ", " + thoro : thoro;
                        }

                        // Detailed Area / Colony / Sector
                        if (subLoc != null && !subLoc.isEmpty()) {
                            area = subLoc;
                            if (street.isEmpty()) street = subLoc;
                            else if (!street.contains(subLoc)) street = street + ", " + subLoc;
                        }

                        // Landmark / Feature Name
                        if (feature != null && !feature.isEmpty() && !feature.equals(thoro) && !feature.equals(subLoc)) {
                            landmark = feature;
                        } else if (premises != null && !premises.isEmpty()) {
                            landmark = premises;
                        }

                        city = addr.getLocality() != null ? addr.getLocality() : (addr.getSubAdminArea() != null ? addr.getSubAdminArea() : "");
                        state = addr.getAdminArea() != null ? addr.getAdminArea() : "";
                        pincode = addr.getPostalCode() != null ? addr.getPostalCode() : "";

                        if (addr.getMaxAddressLineIndex() >= 0) {
                            formatted = addr.getAddressLine(0);
                        }
                    }
                }
            } catch (Exception ignored) {}

            // 2. OpenStreetMap Nominatim Fallback
            if (city.isEmpty()) {
                try {
                    URL url = new URL(String.format(Locale.US,
                            "https://nominatim.openstreetmap.org/reverse?format=json&lat=%.6f&lon=%.6f&zoom=18&addressdetails=1",
                            lat, lon));
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestProperty("User-Agent", "HungerApp/1.0 (Android Food Delivery Platform)");
                    conn.setConnectTimeout(4000);
                    conn.setReadTimeout(4000);

                    if (conn.getResponseCode() == 200) {
                        BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                        StringBuilder sb = new StringBuilder();
                        String line;
                        while ((line = reader.readLine()) != null) sb.append(line);
                        reader.close();

                        JSONObject json = new JSONObject(sb.toString());
                        formatted = json.optString("display_name", "");
                        JSONObject addressObj = json.optJSONObject("address");
                        if (addressObj != null) {
                            String road = addressObj.optString("road", "");
                            String house = addressObj.optString("house_number", "");
                            street = (!house.isEmpty() ? house + ", " : "") + road;

                            area = addressObj.optString("suburb", addressObj.optString("neighbourhood", addressObj.optString("residential", "")));
                            if (!area.isEmpty()) {
                                street = street.isEmpty() ? area : street + ", " + area;
                            }

                            landmark = addressObj.optString("amenity", addressObj.optString("building", addressObj.optString("commercial", "")));

                            city = addressObj.optString("city", addressObj.optString("town", addressObj.optString("village", addressObj.optString("state_district", ""))));
                            state = addressObj.optString("state", "");
                            pincode = addressObj.optString("postcode", "");
                        }
                    }
                    conn.disconnect();
                } catch (Exception ignored) {}
            }

            final String fStreet = street.isEmpty() ? String.format(Locale.getDefault(), "Coords: %.4f, %.4f", lat, lon) : street;
            final String fArea = area;
            final String fLandmark = landmark;
            final String fCity = city.isEmpty() ? "Selected Location" : city;
            final String fState = state;
            final String fPincode = pincode;
            final String fFormatted = formatted;

            final CachedAddress result = new CachedAddress(lat, lon, fStreet, fArea, fLandmark, fCity, fState, fPincode, fFormatted);

            mainHandler.post(() -> {
                if (pbGeocoding != null) pbGeocoding.setVisibility(View.GONE);
                addressCache.put(cacheKey, result);
                applyResolvedAddress(result);
            });
        });
    }

    private void applyResolvedAddress(CachedAddress item) {
        resolvedStreet = item.street;
        resolvedArea = item.area;
        resolvedLandmark = item.landmark;
        resolvedCity = item.city;
        resolvedState = item.state;
        resolvedPincode = item.pincode;
        resolvedFormattedAddress = item.formatted;
        lastResolvedLat = item.lat;
        lastResolvedLon = item.lon;
        hasResolvedBefore = true;

        if (tvAddressTitle != null) {
            tvAddressTitle.setText("📍 " + resolvedCity + (resolvedState.isEmpty() ? "" : ", " + resolvedState));
        }

        if (tvAddressDesc != null) {
            StringBuilder descBuilder = new StringBuilder();
            if (!resolvedStreet.isEmpty()) descBuilder.append(resolvedStreet).append("\n");
            if (!resolvedLandmark.isEmpty()) descBuilder.append("Near ").append(resolvedLandmark).append(" • ");
            if (!resolvedPincode.isEmpty()) descBuilder.append("PIN: ").append(resolvedPincode).append(" • ");
            descBuilder.append(String.format(Locale.getDefault(), "GPS: %.4f, %.4f", item.lat, item.lon));
            tvAddressDesc.setText(descBuilder.toString());
        }
    }

    /**
     * Confirms the selected location, creates the rich Address object,
     * updates CartManager, and saves the address to Firestore customer profile.
     */
    private void confirmAndSaveAddress() {
        com.ssr.hunger.models.Address addr = new com.ssr.hunger.models.Address();
        addr.setId("addr_" + System.currentTimeMillis());
        addr.setType("other");
        addr.setLatitude(currentLat);
        addr.setLongitude(currentLon);
        addr.setStreet(resolvedStreet.isEmpty() ? String.format(Locale.getDefault(), "GPS: %.4f, %.4f", currentLat, currentLon) : resolvedStreet);
        addr.setLandmark(resolvedLandmark);
        addr.setLocality(resolvedArea);
        addr.setCity(resolvedCity.isEmpty() ? "Selected Location" : resolvedCity);
        addr.setState(resolvedState);
        addr.setPincode(resolvedPincode);
        addr.setDefault(true);

        // Compute geohash from confirmed coordinates
        if (com.ssr.hunger.utils.GeohashHelper.isValidCoordinate(currentLat, currentLon)) {
            addr.setGeohash(com.ssr.hunger.utils.GeohashHelper.encode(currentLat, currentLon));
        }

        // 1. Update CartManager Delivery Address immediately
        if (getContext() != null) {
            CartManager.getInstance(requireContext()).setDeliveryAddress(addr);
        }

        // 2. Persist to Firestore Customer Profile if logged in
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user != null) {
            Map<String, Object> addrDoc = new HashMap<>();
            addrDoc.put("id", addr.getId());
            addrDoc.put("street", addr.getStreet());
            addrDoc.put("landmark", addr.getLandmark());
            addrDoc.put("locality", addr.getLocality());
            addrDoc.put("city", addr.getCity());
            addrDoc.put("state", addr.getState());
            addrDoc.put("pincode", addr.getPincode());
            addrDoc.put("type", addr.getType());
            addrDoc.put("latitude", addr.getLatitude());
            addrDoc.put("longitude", addr.getLongitude());
            addrDoc.put("geohash", addr.getGeohash());
            addrDoc.put("isDefault", true);
            addrDoc.put("createdAt", com.google.firebase.Timestamp.now());

            FirebaseFirestore db = FirebaseFirestore.getInstance();
            // Save in user addresses subcollection
            db.collection(Constants.COLLECTION_CUSTOMERS)
                    .document(user.getUid())
                    .collection("addresses")
                    .document(addr.getId())
                    .set(addrDoc);

            // Also update current delivery location in customer root document
            Map<String, Object> profileUpdate = new HashMap<>();
            profileUpdate.put("currentAddress", addrDoc);
            profileUpdate.put("defaultAddressId", addr.getId());
            db.collection(Constants.COLLECTION_CUSTOMERS)
                    .document(user.getUid())
                    .update(profileUpdate);
        }

        // 3. Callback to listener
        if (listener != null) {
            listener.onLocationPicked(addr);
        }

        Toast.makeText(getContext(), "📍 Location set: " + addr.getCity(), Toast.LENGTH_SHORT).show();
        dismiss();
    }

    private void openInExternalMapApp() {
        try {
            Uri uri = Uri.parse("geo:" + currentLat + "," + currentLon + "?q=" + currentLat + "," + currentLon + "(Delivery+Location)");
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            intent.setPackage("com.google.android.apps.maps");
            if (intent.resolveActivity(requireContext().getPackageManager()) != null) {
                startActivity(intent);
            } else {
                Intent generic = new Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com/maps/search/?api=1&query=" + currentLat + "," + currentLon));
                startActivity(generic);
            }
        } catch (Exception e) {
            Toast.makeText(getContext(), "Could not open map app: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        mainHandler.removeCallbacksAndMessages(null);
        geocodeExecutor.shutdown();
    }
}
