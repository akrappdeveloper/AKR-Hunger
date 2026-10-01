package com.ssr.hunger.dialogs;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Dialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.location.Address;
import android.location.Geocoder;
import android.location.Location;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.DisplayMetrics;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.animation.OvershootInterpolator;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationServices;
import com.google.android.material.bottomsheet.BottomSheetBehavior;
import com.google.android.material.bottomsheet.BottomSheetDialog;
import com.google.android.material.bottomsheet.BottomSheetDialogFragment;
import com.google.android.material.button.MaterialButton;
import com.ssr.hunger.R;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.List;
import java.util.Locale;

/**
 * Interactive OpenStreetMap (Leaflet) Location Picker Dialog.
 * Beautiful, full-height professional bottom sheet with smooth gestures,
 * interactive pin animations, live reverse geocoding, and clear action controls.
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
    private double pendingLat = Double.NaN;
    private double pendingLon = Double.NaN;
    private String resolvedStreet = "";
    private String resolvedCity = "";
    private String resolvedState = "";
    private String resolvedPincode = "";
    private FusedLocationProviderClient fusedLocationClient;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private boolean isGeocoding = false;

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

        btnConfirm.setOnClickListener(v -> {
            if (listener != null) {
                com.ssr.hunger.models.Address addr = new com.ssr.hunger.models.Address();
                addr.setType("other");
                addr.setLatitude(currentLat);
                addr.setLongitude(currentLon);
                addr.setStreet(resolvedStreet.isEmpty() ? String.format(Locale.getDefault(), "Lat: %.4f, Lon: %.4f", currentLat, currentLon) : resolvedStreet);
                addr.setCity(resolvedCity.isEmpty() ? "Selected Location" : resolvedCity);
                addr.setState(resolvedState);
                addr.setPincode(resolvedPincode);
                listener.onLocationPicked(addr);
            }
            dismiss();
        });

        // Disallow BottomSheet touch interception when interacting with the Map WebView
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

    /**
     * Expands the bottom sheet to a professional height (93% of display height in portrait,
     * or full height in landscape/compact screens), ensuring the map, controls, and confirmation
     * details are completely visible and spacious without clipping.
     */
    private void configureBottomSheetSize(@NonNull View bottomSheet) {
        if (getContext() == null) return;

        DisplayMetrics dm = getResources().getDisplayMetrics();
        int screenHeight = dm.heightPixels;
        int screenWidth = dm.widthPixels;
        boolean isLandscape = getResources().getConfiguration().orientation == Configuration.ORIENTATION_LANDSCAPE;

        // Set professional expansive height: 93% on standard phones, or 100% on landscape/short screens
        int targetHeight = (isLandscape || screenHeight < 1200) ? screenHeight : (int) (screenHeight * 0.93f);

        ViewGroup.LayoutParams lp = bottomSheet.getLayoutParams();
        if (lp != null) {
            lp.height = targetHeight;
            // Tablet / foldable optimization: keep centered with max width 600dp
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
        behavior.setDraggable(true);
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void onLocationMoved(double lat, double lon) {
                mainHandler.post(() -> {
                    currentLat = lat;
                    currentLon = lon;
                    animatePinFloating(true);
                    reverseGeocode(lat, lon);
                });
            }
        }, "AndroidBridge");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                progressBar.setVisibility(View.GONE);
                // Ensure leaflet accurately maps the container dimensions
                view.evaluateJavascript("if (typeof map !== 'undefined') { map.invalidateSize(); }", null);
            }
        });

        loadOpenStreetMapHtml();
    }

    private void animatePinFloating(boolean moving) {
        if (ivCenterPin != null) {
            if (moving) {
                ivCenterPin.animate().translationY(-14f).setDuration(150).start();
                if (viewPinShadow != null) {
                    viewPinShadow.animate().scaleX(0.7f).scaleY(0.7f).alpha(0.35f).setDuration(150).start();
                }
            } else {
                ivCenterPin.animate().translationY(0f).setInterpolator(new OvershootInterpolator(1.4f)).setDuration(250).start();
                if (viewPinShadow != null) {
                    viewPinShadow.animate().scaleX(1.0f).scaleY(1.0f).alpha(1.0f).setDuration(200).start();
                }
            }
        }
    }

    private void loadOpenStreetMapHtml() {
        String html = "<!DOCTYPE html>\n" +
                "<html>\n" +
                "<head>\n" +
                "    <meta name='viewport' content='width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no' />\n" +
                "    <link rel='stylesheet' href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css' />\n" +
                "    <script src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'></script>\n" +
                "    <style>\n" +
                "        body, html, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #F8F9FA; }\n" +
                "        .leaflet-control-attribution { font-size: 9px !important; opacity: 0.7; }\n" +
                "        .leaflet-bar { border: none !important; box-shadow: 0 2px 8px rgba(0,0,0,0.18) !important; border-radius: 10px !important; overflow: hidden; }\n" +
                "        .leaflet-bar a { background: #FFFFFF !important; color: #1E293B !important; width: 34px !important; height: 34px !important; line-height: 34px !important; border-bottom: 1px solid #E2E8F0 !important; font-weight: bold; }\n" +
                "        .leaflet-bar a:hover { background: #F1F5F9 !important; }\n" +
                "    </style>\n" +
                "</head>\n" +
                "<body>\n" +
                "    <div id='map'></div>\n" +
                "    <script>\n" +
                "        var map = L.map('map', { zoomControl: false }).setView([" + currentLat + ", " + currentLon + "], 16);\n" +
                "        L.control.zoom({ position: 'topright' }).addTo(map);\n" +
                "        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {\n" +
                "            maxZoom: 19,\n" +
                "            attribution: '&copy; OpenStreetMap'\n" +
                "        }).addTo(map);\n" +
                "\n" +
                "        map.on('moveend', function() {\n" +
                "            var c = map.getCenter();\n" +
                "            if (window.AndroidBridge) {\n" +
                "                window.AndroidBridge.onLocationMoved(c.lat, c.lng);\n" +
                "            }\n" +
                "        });\n" +
                "\n" +
                "        function setMapCenter(lat, lon) {\n" +
                "            map.setView([lat, lon], 17);\n" +
                "        }\n" +
                "\n" +
                "        window.addEventListener('resize', function() {\n" +
                "            setTimeout(function() { map.invalidateSize(); }, 100);\n" +
                "        });\n" +
                "        setTimeout(function() { map.invalidateSize(); }, 250);\n" +
                "\n" +
                "        if (window.AndroidBridge) {\n" +
                "            window.AndroidBridge.onLocationMoved(" + currentLat + ", " + currentLon + ");\n" +
                "        }\n" +
                "    </script>\n" +
                "</body>\n" +
                "</html>";

        webView.loadDataWithBaseURL("https://openstreetmap.org", html, "text/html", "UTF-8", null);
    }

    private void detectCurrentLocationAndCenter() {
        if (ActivityCompat.checkSelfPermission(requireContext(), Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION}, 201);
            return;
        }

        progressBar.setVisibility(View.VISIBLE);
        fusedLocationClient.getLastLocation().addOnSuccessListener(location -> {
            progressBar.setVisibility(View.GONE);
            if (location != null) {
                currentLat = location.getLatitude();
                currentLon = location.getLongitude();
                webView.evaluateJavascript("setMapCenter(" + currentLat + ", " + currentLon + ");", null);
                reverseGeocode(currentLat, currentLon);
            } else {
                Toast.makeText(getContext(), "Could not fetch current GPS location", Toast.LENGTH_SHORT).show();
            }
        }).addOnFailureListener(e -> {
            progressBar.setVisibility(View.GONE);
            Toast.makeText(getContext(), "GPS error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        });
    }

    private synchronized void reverseGeocode(double lat, double lon) {
        if (isGeocoding) {
            pendingLat = lat;
            pendingLon = lon;
            return;
        }
        isGeocoding = true;

        if (pbGeocoding != null) pbGeocoding.setVisibility(View.VISIBLE);
        tvAddressDesc.setText("Pinpointing address...");

        new Thread(() -> {
            String street = "";
            String city = "";
            String state = "";
            String pincode = "";

            // 1. Try native Android Geocoder first
            try {
                if (Geocoder.isPresent()) {
                    Geocoder geocoder = new Geocoder(requireContext(), Locale.getDefault());
                    List<Address> addresses = geocoder.getFromLocation(lat, lon, 1);
                    if (addresses != null && !addresses.isEmpty()) {
                        Address addr = addresses.get(0);
                        street = addr.getThoroughfare() != null ? addr.getThoroughfare() : "";
                        if (addr.getSubLocality() != null) {
                            street = street.isEmpty() ? addr.getSubLocality() : addr.getSubLocality() + ", " + street;
                        }
                        if (street.isEmpty() && addr.getFeatureName() != null) {
                            street = addr.getFeatureName();
                        }
                        city = addr.getLocality() != null ? addr.getLocality() : (addr.getSubAdminArea() != null ? addr.getSubAdminArea() : "");
                        state = addr.getAdminArea() != null ? addr.getAdminArea() : "";
                        pincode = addr.getPostalCode() != null ? addr.getPostalCode() : "";
                    }
                }
            } catch (Exception ignored) {}

            // 2. Fallback to OpenStreetMap Nominatim Reverse Geocoding
            if (city.isEmpty()) {
                try {
                    URL url = new URL(String.format(Locale.US,
                            "https://nominatim.openstreetmap.org/reverse?format=json&lat=%.6f&lon=%.6f&zoom=18&addressdetails=1",
                            lat, lon));
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestProperty("User-Agent", "HungerApp/1.0 (Android Food Delivery)");
                    conn.setConnectTimeout(5000);
                    conn.setReadTimeout(5000);

                    if (conn.getResponseCode() == 200) {
                        BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                        StringBuilder sb = new StringBuilder();
                        String line;
                        while ((line = reader.readLine()) != null) sb.append(line);
                        reader.close();

                        JSONObject json = new JSONObject(sb.toString());
                        JSONObject addressObj = json.optJSONObject("address");
                        if (addressObj != null) {
                            street = addressObj.optString("road", addressObj.optString("suburb", ""));
                            city = addressObj.optString("city", addressObj.optString("town", addressObj.optString("village", addressObj.optString("state_district", ""))));
                            state = addressObj.optString("state", "");
                            pincode = addressObj.optString("postcode", "");
                        }
                    }
                    conn.disconnect();
                } catch (Exception ignored) {}
            }

            final String fStreet = street;
            final String fCity = city.isEmpty() ? "Selected Location" : city;
            final String fState = state;
            final String fPincode = pincode;

            mainHandler.post(() -> {
                isGeocoding = false;
                if (pbGeocoding != null) pbGeocoding.setVisibility(View.GONE);
                animatePinFloating(false);

                resolvedStreet = fStreet;
                resolvedCity = fCity;
                resolvedState = fState;
                resolvedPincode = fPincode;

                tvAddressTitle.setText("📍 " + fCity + (fState.isEmpty() ? "" : ", " + fState));
                String fullDesc = (fStreet.isEmpty() ? "" : fStreet + "\n") +
                        String.format(Locale.getDefault(), "Coords: %.4f, %.4f", lat, lon) +
                        (fPincode.isEmpty() ? "" : " • PIN: " + fPincode);
                tvAddressDesc.setText(fullDesc);

                // Process pending geocoding request if user moved while processing
                if (!Double.isNaN(pendingLat)) {
                    double nextLat = pendingLat;
                    double nextLon = pendingLon;
                    pendingLat = Double.NaN;
                    pendingLon = Double.NaN;
                    reverseGeocode(nextLat, nextLon);
                }
            });
        }).start();
    }

    private void openInExternalMapApp() {
        try {
            // geo:lat,lon URI scheme triggers Google Maps or installed map apps
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
}
