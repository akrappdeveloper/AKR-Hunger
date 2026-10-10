package com.ssr.hunger.activities;

import android.Manifest;
import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.ObjectAnimator;
import android.animation.ValueAnimator;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.animation.AccelerateDecelerateInterpolator;
import android.view.animation.OvershootInterpolator;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.cardview.widget.CardView;
import androidx.core.app.ActivityCompat;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import com.ssr.hunger.R;
import com.ssr.hunger.services.DriverLocationService;
import com.ssr.hunger.utils.CartManager;
import com.ssr.hunger.utils.Constants;
import com.ssr.hunger.utils.PermissionManager;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * OrderTrackingActivity — Real-time order tracking for CUSTOMERS.
 *
 * Listens to live driver GPS from Firebase driverLocations/{driverId}.
 * If opened in driver mode (EXTRA_IS_DRIVER=true), starts DriverLocationService
 * to publish this device's GPS position to Firebase.
 *
 * Two-phase tracking:
 *   Phase 1: Driver → Restaurant (TO_PICKUP stage)
 *   Phase 2: Driver → Customer (TO_CUSTOMER / out_for_delivery stage)
 */
public class OrderTrackingActivity extends BaseActivity {

    public static final String EXTRA_ORDER_ID = "order_id";
    /** Set to true if this device IS the delivery partner */
    public static final String EXTRA_IS_DRIVER = "is_driver";
    private static final int LOCATION_PERMISSION_CODE = 4001;

    // Firebase
    private FirebaseFirestore db;
    private ListenerRegistration orderListener;
    private ListenerRegistration driverLocationListener;
    private String orderId;
    private String lastStatus = "";
    private String driverUid = null;
    private boolean isDriverMode = false;

    // UI refs
    private TextView tvEta, tvOrderStatus, tvRestaurantName, tvOrderId;
    private TextView tvRestaurantAddress, tvRestaurantPhone;
    private TextView tvDriverName, tvDriverPhone, tvDriverVehicle;
    private TextView tvDeliveryAddress, tvGpsCoords;
    private TextView tvOrderTotal, tvDeliveryChargeInfo;
    private TextView tvTrackingSubtotal, tvTrackingDeliveryCharge, tvTrackingGrandTotal, tvTrackingDeliveryBadge;
    private LinearLayout stepContainer;
    private ProgressBar progressTrack;
    private CardView cardDriverPartner;
    private View btnCallDriver, btnCallRestaurant, btnShareTracking, btnBack, btnHelp;
    private View btnRecenterRider, btnFitRoute;
    private ProgressBar pbMapLoading;
    private TextView tvMapRiderStatus;
    private View gpsLiveBadge;

    // Fullscreen Map & Extended Views
    private boolean isMapFullScreen = false;
    private FrameLayout frameMapContainer;
    private View viewMapFade;
    private View btnFullscreenToggle;
    private ImageView ivFullscreenIcon;
    private View scrollTrackingContent;
    private View layoutFullscreenBottomCard;
    private TextView tvTopTitle;
    private TextView tvFsDriverName, tvFsDriverSub;
    private View btnFsCallDriver, btnFsExit;
    private int defaultMapHeightPx = 0;

    // Cached Leaflet Assets
    private static String cachedLeafletCss = null;
    private static String cachedLeafletJs = null;

    // Live Map
    private android.webkit.WebView wvLiveMap;
    private double mapDriverLat = 0, mapDriverLng = 0;
    private double mapRestLat = 0, mapRestLng = 0;
    private double mapCustLat = 0, mapCustLng = 0;
    private double lastDriverHeading = 0.0;
    private double lastDriverSpeed = 0.0;
    private String restaurantNameStr = "Restaurant";
    private String restaurantPhone = "";
    private String restaurantAddress = "";
    private boolean mapLoaded = false;
    private static final String MAP_STYLE_STREET = "street";
    private static final String MAP_STYLE_DARK = "dark";
    private static final String MAP_STYLE_SAT = "satellite";
    private String currentMapStyle = MAP_STYLE_STREET;

    // Step keys matching Firestore status values
    private static final String[] STEPS      = {"pending","confirmed","preparing","ready","out_for_delivery","delivered"};
    private static final String[] STEP_EMOJIS = {"\uD83D\uDCE6","\u2705","\uD83D\uDC68\u200D\uD83C\uDF73","\uD83C\uDF71","\uD83D\uDEF5","\uD83C\uDF89"};
    private static final String[] STEP_LABELS = {
        "Order Placed", "Confirmed", "Kitchen Preparing", "Food Ready", "Out for Delivery", "Delivered!"
    };
    private static final String[] STEP_SUBTITLES = {
        "Order received and sent to restaurant kitchen queue",
        "Restaurant confirmed order & queued for cooking",
        "Master chefs are cooking meal with hygiene seal",
        "Freshly prepared & packed hot, awaiting pickup",
        "Valet picked up order and riding to your doorstep with live GPS",
        "Delivered! Enjoy your hot meal & share your rating 🎉"
    };
    private static final int[] STEP_COLORS = {
        0xFFFF9800, 0xFF2196F3, 0xFFFF9800, 0xFF9C27B0, 0xFFFF5722, 0xFF10B981
    };

    // ETA
    private Handler etaHandler;
    private Runnable etaRunnable;
    private long orderPlacedMs = 0;
    private int estimatedMins = 35;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_order_tracking);

        db = FirebaseFirestore.getInstance();
        orderId = getIntent().getStringExtra(EXTRA_ORDER_ID);
        isDriverMode = getIntent().getBooleanExtra(EXTRA_IS_DRIVER, false);

        if (orderId == null) {
            recordException("OrderTracking_null_id", new IllegalArgumentException("null orderId"));
            finish();
            return;
        }

        defaultMapHeightPx = (int) (330 * getResources().getDisplayMetrics().density);
        bindViews();
        setupLiveMap();
        listenToOrder();

        // If this is a delivery partner's device, start GPS service (with location permission)
        if (isDriverMode) {
            requireLocation(
                () -> {
                    String uid = com.google.firebase.auth.FirebaseAuth.getInstance().getCurrentUser() != null
                        ? com.google.firebase.auth.FirebaseAuth.getInstance().getCurrentUser().getUid()
                        : null;
                    if (uid != null) {
                        DriverLocationService.startTracking(this, uid, orderId, true);
                    }
                },
                (isPermanent) -> {
                    if (isPermanent) showSettingsSnackbar();
                }
            );
        }

        logBreadcrumb("OrderTrackingActivity: " + orderId + " driverMode=" + isDriverMode);

        if (btnBack != null) btnBack.setOnClickListener(v -> onBackPressed());
        if (btnHelp != null) btnHelp.setOnClickListener(v ->
            startActivity(new Intent(this, SupportActivity.class)));
    }

    // ─── Bind Views ───────────────────────────────────────────────────────────

    private void bindViews() {
        tvEta              = findViewById(R.id.tv_eta);
        tvOrderStatus      = findViewById(R.id.tv_order_status);
        tvRestaurantName   = findViewById(R.id.tv_restaurant_name);
        tvRestaurantAddress= findViewById(R.id.tv_restaurant_address);
        tvRestaurantPhone  = findViewById(R.id.tv_restaurant_phone);
        tvOrderId          = findViewById(R.id.tv_order_id);
        tvDriverName       = findViewById(R.id.tv_driver_name);
        tvDriverPhone      = findViewById(R.id.tv_driver_phone);
        tvDriverVehicle    = findViewById(R.id.tv_driver_vehicle);
        tvDeliveryAddress  = findViewById(R.id.tv_delivery_address);
        tvGpsCoords        = (TextView) findViewById(R.id.tv_gps_coords);
        stepContainer      = findViewById(R.id.step_container);
        progressTrack      = findViewById(R.id.progress_tier);
        cardDriverPartner  = findViewById(R.id.card_delivery_partner);
        btnCallDriver      = findViewById(R.id.btn_call_driver);
        btnCallRestaurant  = findViewById(R.id.btn_call_restaurant);
        btnShareTracking   = findViewById(R.id.btn_share_tracking);
        btnBack            = findViewById(R.id.btn_back);
        btnHelp            = findViewById(R.id.btn_help);
        btnRecenterRider   = findViewById(R.id.btn_recenter_rider);
        btnFitRoute        = findViewById(R.id.btn_fit_route);
        pbMapLoading       = findViewById(R.id.pb_map_loading);
        tvMapRiderStatus   = findViewById(R.id.tv_map_rider_status);
        gpsLiveBadge       = (View) findViewById(R.id.gps_live_badge);
        tvOrderTotal               = findViewById(R.id.tv_order_total);
        tvDeliveryChargeInfo       = findViewById(R.id.tv_delivery_charge_info);
        tvTrackingSubtotal         = findViewById(R.id.tv_tracking_subtotal);
        tvTrackingDeliveryCharge   = findViewById(R.id.tv_tracking_delivery_charge);
        tvTrackingGrandTotal       = findViewById(R.id.tv_tracking_grand_total);
        tvTrackingDeliveryBadge    = findViewById(R.id.tv_tracking_delivery_badge);
        wvLiveMap          = findViewById(R.id.wv_live_map);

        frameMapContainer          = findViewById(R.id.frame_map_container);
        viewMapFade                = findViewById(R.id.view_map_fade);
        btnFullscreenToggle        = findViewById(R.id.btn_fullscreen_toggle);
        ivFullscreenIcon           = findViewById(R.id.iv_fullscreen_icon);
        scrollTrackingContent      = findViewById(R.id.scroll_tracking_content);
        layoutFullscreenBottomCard = findViewById(R.id.layout_fullscreen_bottom_card);
        tvTopTitle                 = findViewById(R.id.tv_top_title);
        tvFsDriverName             = findViewById(R.id.tv_fs_driver_name);
        tvFsDriverSub              = findViewById(R.id.tv_fs_driver_sub);
        btnFsCallDriver            = findViewById(R.id.btn_fs_call_driver);
        btnFsExit                  = findViewById(R.id.btn_fs_exit);

        if (btnFullscreenToggle != null) btnFullscreenToggle.setOnClickListener(v -> toggleMapFullScreen());
        if (btnFsExit != null) btnFsExit.setOnClickListener(v -> toggleMapFullScreen());
        if (layoutFullscreenBottomCard != null) layoutFullscreenBottomCard.setOnClickListener(v -> toggleMapFullScreen());

        if (btnShareTracking != null) btnShareTracking.setOnClickListener(v -> shareTrackingInfo());
        if (btnRecenterRider != null) btnRecenterRider.setOnClickListener(v -> recenterMapOnDriver());
        if (btnFitRoute != null) btnFitRoute.setOnClickListener(v -> fitMapRoute());
        if (btnCallRestaurant != null) {
            btnCallRestaurant.setOnClickListener(v -> callPhoneNumber(restaurantPhone, tvRestaurantName != null ? tvRestaurantName.getText().toString() : "Restaurant"));
        }

        View btnChatRestaurant = findViewById(R.id.btn_chat_restaurant);
        if (btnChatRestaurant != null) {
            btnChatRestaurant.setOnClickListener(v -> {
                Intent chatIntent = new Intent(this, ChatActivity.class);
                chatIntent.putExtra(ChatActivity.EXTRA_ORDER_ID, orderId);
                chatIntent.putExtra(ChatActivity.EXTRA_COUNTERPART_ROLE, "restaurant");
                chatIntent.putExtra(ChatActivity.EXTRA_COUNTERPART_NAME, restaurantNameStr);
                chatIntent.putExtra(ChatActivity.EXTRA_PHONE, restaurantPhone);
                startActivity(chatIntent);
            });
        }

        View btnChatDriver = findViewById(R.id.btn_chat_driver);
        if (btnChatDriver != null) {
            btnChatDriver.setOnClickListener(v -> {
                Intent chatIntent = new Intent(this, ChatActivity.class);
                chatIntent.putExtra(ChatActivity.EXTRA_ORDER_ID, orderId);
                chatIntent.putExtra(ChatActivity.EXTRA_COUNTERPART_ROLE, "delivery");
                chatIntent.putExtra(ChatActivity.EXTRA_COUNTERPART_NAME, tvDriverName != null && !TextUtils.isEmpty(tvDriverName.getText()) ? tvDriverName.getText().toString() : "Delivery Valet");
                chatIntent.putExtra(ChatActivity.EXTRA_PHONE, tvDriverPhone != null ? tvDriverPhone.getText().toString() : "");
                startActivity(chatIntent);
            });
        }
    }

    // ─── Live Map: Leaflet + OpenStreetMap + Animated Real Driver Navigation ─

    private String loadAssetString(String path) {
        try (InputStream is = getAssets().open(path);
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

    @android.annotation.SuppressLint("SetJavaScriptEnabled")
    private void setupLiveMap() {
        if (wvLiveMap == null) return;

        wvLiveMap.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        wvLiveMap.setBackgroundColor(0xFF0F172A);

        android.webkit.WebSettings ws = wvLiveMap.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setDatabaseEnabled(true);
        ws.setGeolocationEnabled(true);
        ws.setAllowContentAccess(true);
        ws.setAllowFileAccess(true);
        ws.setLoadWithOverviewMode(true);
        ws.setUseWideViewPort(true);
        ws.setCacheMode(android.webkit.WebSettings.LOAD_DEFAULT);
        // Modern Chrome User-Agent prevents any tile server 418/403 blocking
        ws.setUserAgentString("Mozilla/5.0 (Linux; Android " + android.os.Build.VERSION.RELEASE + "; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 HungerApp/1.0");
        ws.setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        wvLiveMap.addJavascriptInterface(new Object() {
            @android.webkit.JavascriptInterface
            public void onMapReady() {
                runOnUiThread(() -> {
                    mapLoaded = true;
                    if (pbMapLoading != null) pbMapLoading.setVisibility(View.GONE);
                    pushPendingCoordinatesToMap();
                });
            }

            @android.webkit.JavascriptInterface
            public void onRiderProgress(double progressPct, double distKm, double speedKmh, int etaMinutes) {
                runOnUiThread(() -> updateRiderProgressFromMap(progressPct, distKm, speedKmh, etaMinutes));
            }
        }, "AndroidMapBridge");

        wvLiveMap.setWebViewClient(new android.webkit.WebViewClient() {
            @Override
            public void onPageFinished(android.webkit.WebView view, String url) {
                super.onPageFinished(view, url);
                mapLoaded = true;
                if (pbMapLoading != null) pbMapLoading.setVisibility(View.GONE);
                view.evaluateJavascript("if (typeof map !== 'undefined' && map) { map.invalidateSize(); }", null);
                pushPendingCoordinatesToMap();
            }

            @Override
            public void onReceivedError(android.webkit.WebView view, int errorCode, String description, String failingUrl) {
                super.onReceivedError(view, errorCode, description, failingUrl);
            }
        });

        wvLiveMap.setWebChromeClient(new android.webkit.WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, android.webkit.GeolocationPermissions.Callback callback) {
                callback.invoke(origin, true, false);
            }
        });

        String html = buildLeafletHtml(28.6139, 77.2090, 14);
        wvLiveMap.loadDataWithBaseURL("https://tile.openstreetmap.org/", html, "text/html", "UTF-8", null);

        // Theme switcher buttons
        View btnStreet = findViewById(R.id.btn_map_theme_street);
        View btnDark   = findViewById(R.id.btn_map_theme_dark);
        View btnSat    = findViewById(R.id.btn_map_theme_sat);
        if (btnStreet != null) btnStreet.setOnClickListener(v -> switchMapStyle(MAP_STYLE_STREET));
        if (btnDark != null)   btnDark.setOnClickListener(v -> switchMapStyle(MAP_STYLE_DARK));
        if (btnSat != null)    btnSat.setOnClickListener(v -> switchMapStyle(MAP_STYLE_SAT));
    }

    private String buildLeafletHtml(double lat, double lng, int zoom) {
        if (cachedLeafletCss == null) cachedLeafletCss = loadAssetString("leaflet/leaflet.css");
        if (cachedLeafletJs == null)  cachedLeafletJs  = loadAssetString("leaflet/leaflet.js");

        StringBuilder sb = new StringBuilder();
        sb.append("<!DOCTYPE html><html><head>");
        sb.append("<meta charset='utf-8'/>");
        sb.append("<meta name='viewport' content='width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no'/>");

        // CSS: inlined if available from local assets, else CDN fallback
        if (cachedLeafletCss != null && !cachedLeafletCss.isEmpty()) {
            sb.append("<style>").append(cachedLeafletCss).append("</style>");
        } else {
            sb.append("<link rel='stylesheet' href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'/>");
        }

        sb.append("<style>");
        sb.append("* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }");
        sb.append("html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #0f172a; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }");
        sb.append(".dark-tiles { filter: invert(100%) hue-rotate(180deg) brightness(85%) contrast(90%) !important; -webkit-filter: invert(100%) hue-rotate(180deg) brightness(85%) contrast(90%) !important; }");
        sb.append("@keyframes radarPulse { 0% { transform: scale(0.6); opacity: 0.9; } 100% { transform: scale(2.6); opacity: 0; } }");
        sb.append("@keyframes riderBob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }");
        sb.append("@keyframes dashFlow { to { stroke-dashoffset: -32; } }");
        sb.append(".route-flow-line { animation: dashFlow 1.4s linear infinite; }");
        sb.append(".rider-container { position: relative; width: 54px; height: 54px; display: flex; align-items: center; justify-content: center; }");
        sb.append(".rider-pulse { position: absolute; width: 46px; height: 46px; border-radius: 50%; background: rgba(255,87,34,0.45); animation: radarPulse 1.8s infinite cubic-bezier(0.2,0.6,0.3,1); pointer-events: none; }");
        sb.append(".rider-pulse.p2 { animation-delay: 0.9s; }");
        sb.append(".rider-icon-box { width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, #FF6F00, #FF3D00); border: 3px solid #FFFFFF; box-shadow: 0 4px 16px rgba(255,87,34,0.6); display: flex; align-items: center; justify-content: center; transition: transform 0.35s ease-out; animation: riderBob 0.8s infinite ease-in-out; }");
        sb.append(".rider-label { position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%); background: #0F172A; color: #FFFFFF; font-size: 9px; font-weight: 800; padding: 2px 7px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.35); box-shadow: 0 2px 6px rgba(0,0,0,0.4); white-space: nowrap; }");
        sb.append(".pin-box { position: relative; width: 46px; height: 46px; display: flex; align-items: center; justify-content: center; }");
        sb.append(".pin-circle { width: 40px; height: 40px; border-radius: 50%; border: 3px solid #FFF; display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 4px 14px rgba(0,0,0,0.4); }");
        sb.append(".pin-rest { background: linear-gradient(135deg, #F59E0B, #D97706); }");
        sb.append(".pin-cust { background: linear-gradient(135deg, #10B981, #059669); }");
        sb.append(".pin-tag { position: absolute; top: -15px; left: 50%; transform: translateX(-50%); background: rgba(15,23,42,0.92); color: #FFF; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 10px; white-space: nowrap; border: 1px solid rgba(255,255,255,0.25); box-shadow: 0 2px 8px rgba(0,0,0,0.3); }");
        sb.append("</style></head><body>");

        sb.append("<div id='map'></div>");

        // JS: inlined if available, else CDN fallback
        if (cachedLeafletJs != null && !cachedLeafletJs.isEmpty()) {
            sb.append("<script>").append(cachedLeafletJs).append("</script>");
        } else {
            sb.append("<script src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'></script>");
        }

        // Map script
        sb.append("<script>");
        sb.append("var map = null;\n");
        sb.append("var streetLayer = null, darkLayer = null, satLayer = null;\n");
        sb.append("var driverMarker = null, restMarker = null, custMarker = null;\n");
        sb.append("var routeGlow = null, routeDashed = null, routeCompleted = null;\n");
        sb.append("var waypoints = [];\n");
        sb.append("var simInterval = null, simIndex = 0, isSimulating = false;\n");
        sb.append("var curLat = ").append(lat).append(", curLng = ").append(lng).append(";\n");
        sb.append("var animFrameId = null;\n");

        sb.append("function initMap() {\n");
        sb.append("  try {\n");
        sb.append("    if (typeof L === 'undefined') return;\n");
        sb.append("    map = L.map('map', { zoomControl: false, attributionControl: false, fadeAnimation: true, zoomAnimation: true }).setView([curLat, curLng], ").append(zoom).append(");\n");
        sb.append("    streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { subdomains: 'abc', maxZoom: 19, attribution: '&copy; OpenStreetMap' });\n");
        sb.append("    streetLayer.on('tileerror', function() {\n");
        sb.append("      if (!streetLayer._fb) { streetLayer._fb = true; streetLayer.setUrl('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png'); }\n");
        sb.append("    });\n");
        sb.append("    darkLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { subdomains: 'abc', maxZoom: 19, className: 'dark-tiles', attribution: '&copy; OpenStreetMap' });\n");
        sb.append("    darkLayer.on('tileerror', function() {\n");
        sb.append("      if (!darkLayer._fb) { darkLayer._fb = true; darkLayer.setUrl('https://tile.openstreetmap.de/{z}/{x}/{y}.png'); }\n");
        sb.append("    });\n");
        sb.append("    satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: '&copy; Esri' });\n");
        sb.append("    streetLayer.addTo(map);\n");
        sb.append("    setTimeout(function() { if(map) map.invalidateSize(); }, 200);\n");
        sb.append("    setTimeout(function() { if(map) map.invalidateSize(); }, 600);\n");
        sb.append("    setTimeout(function() { if(map) map.invalidateSize(); }, 1200);\n");
        sb.append("    if (window.AndroidMapBridge) { window.AndroidMapBridge.onMapReady(); }\n");
        sb.append("  } catch(e) { console.error('Map init error:', e); }\n");
        sb.append("}\n");

        sb.append("function generateRoute(rLat, rLng, cLat, cLng) {\n");
        sb.append("  var pts = []; var steps = 16; var dLat = cLat - rLat; var dLng = cLng - rLng;\n");
        sb.append("  var pLat = -dLng * 0.18; var pLng = dLat * 0.18;\n");
        sb.append("  for (var i = 0; i <= steps; i++) {\n");
        sb.append("    var t = i / steps; var curve = 4 * t * (1 - t);\n");
        sb.append("    pts.push([rLat + dLat * t + curve * pLat, rLng + dLng * t + curve * pLng]);\n");
        sb.append("  }\n");
        sb.append("  return pts;\n");
        sb.append("}\n");

        sb.append("function drawRouteLines(pts) {\n");
        sb.append("  if (!map || !pts || pts.length < 2) return;\n");
        sb.append("  if (routeGlow) map.removeLayer(routeGlow);\n");
        sb.append("  if (routeDashed) map.removeLayer(routeDashed);\n");
        sb.append("  if (routeCompleted) map.removeLayer(routeCompleted);\n");
        sb.append("  routeGlow = L.polyline(pts, { color: '#FF5722', weight: 9, opacity: 0.35, lineCap: 'round', lineJoin: 'round' }).addTo(map);\n");
        sb.append("  routeDashed = L.polyline(pts, { color: '#FF9800', weight: 4, dashArray: '8, 12', className: 'route-flow-line', opacity: 0.95 }).addTo(map);\n");
        sb.append("  routeCompleted = L.polyline([], { color: '#10B981', weight: 5, opacity: 0.95, lineCap: 'round' }).addTo(map);\n");
        sb.append("}\n");

        sb.append("function fetchOSRMRoute(rLat, rLng, cLat, cLng) {\n");
        sb.append("  try {\n");
        sb.append("    var url = 'https://router.project-osrm.org/route/v1/driving/' + rLng + ',' + rLat + ';' + cLng + ',' + cLat + '?overview=full&geometries=geojson';\n");
        sb.append("    fetch(url).then(function(res) { return res.json(); }).then(function(data) {\n");
        sb.append("      if (data && data.routes && data.routes.length > 0 && data.routes[0].geometry) {\n");
        sb.append("        var coords = data.routes[0].geometry.coordinates;\n");
        sb.append("        if (coords && coords.length > 2) {\n");
        sb.append("          waypoints = coords.map(function(c) { return [c[1], c[0]]; });\n");
        sb.append("          drawRouteLines(waypoints);\n");
        sb.append("        }\n");
        sb.append("      }\n");
        sb.append("    }).catch(function() {});\n");
        sb.append("  } catch(e) {}\n");
        sb.append("}\n");

        sb.append("function setOrderRoute(rLat, rLng, rName, cLat, cLng, status) {\n");
        sb.append("  if (!map) return;\n");
        sb.append("  if (restMarker) map.removeLayer(restMarker);\n");
        sb.append("  if (custMarker) map.removeLayer(custMarker);\n");
        sb.append("  var restEl = '<div class=\"pin-box\"><div class=\"pin-tag\">' + (rName || 'Restaurant') + '</div><div class=\"pin-circle pin-rest\">🍔</div></div>';\n");
        sb.append("  restMarker = L.marker([rLat, rLng], { icon: L.divIcon({ html: restEl, className: '', iconSize: [46, 46], iconAnchor: [23, 23] }), zIndexOffset: 500 }).addTo(map);\n");
        sb.append("  var custEl = '<div class=\"pin-box\"><div class=\"pin-tag\">Your Location</div><div class=\"pin-circle pin-cust\">🏠</div></div>';\n");
        sb.append("  custMarker = L.marker([cLat, cLng], { icon: L.divIcon({ html: custEl, className: '', iconSize: [46, 46], iconAnchor: [23, 23] }), zIndexOffset: 500 }).addTo(map);\n");
        sb.append("  waypoints = generateRoute(rLat, rLng, cLat, cLng);\n");
        sb.append("  drawRouteLines(waypoints);\n");
        sb.append("  map.fitBounds(L.latLngBounds([[rLat, rLng], [cLat, cLng]]), { padding: [55, 55], maxZoom: 16 });\n");
        sb.append("  fetchOSRMRoute(rLat, rLng, cLat, cLng);\n");
        sb.append("  if (status === 'out_for_delivery') {\n");
        sb.append("    if (!driverMarker) updateDriver(rLat, rLng, 0, 24);\n");
        sb.append("    startSimulation();\n");
        sb.append("  } else if (status === 'delivered') {\n");
        sb.append("    updateDriver(cLat, cLng, 0, 0);\n");
        sb.append("  } else {\n");
        sb.append("    updateDriver(rLat, rLng, 0, 0);\n");
        sb.append("  }\n");
        sb.append("}\n");

        sb.append("function calcHeading(lat1, lng1, lat2, lng2) {\n");
        sb.append("  var dLng = (lng2 - lng1) * Math.PI / 180;\n");
        sb.append("  var y = Math.sin(dLng) * Math.cos(lat2 * Math.PI / 180);\n");
        sb.append("  var x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) - Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLng);\n");
        sb.append("  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;\n");
        sb.append("}\n");

        sb.append("function calcDistKm(lat1, lon1, lat2, lon2) {\n");
        sb.append("  var R = 6371; var dLat = (lat2 - lat1) * Math.PI / 180; var dLon = (lon2 - lon1) * Math.PI / 180;\n");
        sb.append("  var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);\n");
        sb.append("  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));\n");
        sb.append("}\n");

        sb.append("function makeRiderHtml(heading, speed) {\n");
        sb.append("  var spdText = (speed > 0 ? Math.round(speed) + ' km/h' : 'Valet');\n");
        sb.append("  return '<div class=\"rider-container\">' +\n");
        sb.append("         '<div class=\"rider-pulse\"></div><div class=\"rider-pulse p2\"></div>' +\n");
        sb.append("         '<div class=\"rider-icon-box\" style=\"transform: rotate(' + Math.round(heading) + 'deg);\"><span style=\"font-size:24px;line-height:1;\">🛵</span></div>' +\n");
        sb.append("         '<div class=\"rider-label\">' + spdText + '</div></div>';\n");
        sb.append("}\n");

        sb.append("function smoothMoveMarker(marker, fromPos, toPos, duration, heading, speed) {\n");
        sb.append("  var start = performance.now();\n");
        sb.append("  marker.setIcon(L.divIcon({ html: makeRiderHtml(heading, speed), className: '', iconSize: [54, 54], iconAnchor: [27, 27] }));\n");
        sb.append("  if (animFrameId) cancelAnimationFrame(animFrameId);\n");
        sb.append("  function step(time) {\n");
        sb.append("    var elapsed = time - start; var t = Math.min(elapsed / duration, 1);\n");
        sb.append("    var ease = 1 - Math.pow(1 - t, 3);\n");
        sb.append("    var curLat = fromPos.lat + (toPos.lat - fromPos.lat) * ease;\n");
        sb.append("    var curLng = fromPos.lng + (toPos.lng - fromPos.lng) * ease;\n");
        sb.append("    marker.setLatLng([curLat, curLng]);\n");
        sb.append("    if (t < 1) { animFrameId = requestAnimationFrame(step); }\n");
        sb.append("  }\n");
        sb.append("  animFrameId = requestAnimationFrame(step);\n");
        sb.append("}\n");

        sb.append("function findNearestIdx(pos, pts) {\n");
        sb.append("  var minD = 999999, idx = 0;\n");
        sb.append("  for (var i = 0; i < pts.length; i++) {\n");
        sb.append("    var d = calcDistKm(pos[0], pos[1], pts[i][0], pts[i][1]);\n");
        sb.append("    if (d < minD) { minD = d; idx = i; }\n");
        sb.append("  }\n");
        sb.append("  return idx;\n");
        sb.append("}\n");

        sb.append("function updateDriver(lat, lng, heading, speed) {\n");
        sb.append("  if (!map) return;\n");
        sb.append("  if (isSimulating) { clearInterval(simInterval); isSimulating = false; }\n");
        sb.append("  var h = (typeof heading === 'number' && !isNaN(heading)) ? heading : 0;\n");
        sb.append("  var s = (typeof speed === 'number' && !isNaN(speed) && speed > 0) ? speed : 24;\n");
        sb.append("  if (!driverMarker) {\n");
        sb.append("    driverMarker = L.marker([lat, lng], {\n");
        sb.append("      icon: L.divIcon({ html: makeRiderHtml(h, s), className: '', iconSize: [54, 54], iconAnchor: [27, 27] }),\n");
        sb.append("      zIndexOffset: 1000\n");
        sb.append("    }).addTo(map);\n");
        sb.append("  } else {\n");
        sb.append("    var oldPos = driverMarker.getLatLng();\n");
        sb.append("    smoothMoveMarker(driverMarker, oldPos, { lat: lat, lng: lng }, 1000, h, s);\n");
        sb.append("  }\n");
        sb.append("  if (waypoints && waypoints.length > 0) {\n");
        sb.append("    var nIdx = findNearestIdx([lat, lng], waypoints);\n");
        sb.append("    if (nIdx > 0 && routeCompleted) routeCompleted.setLatLngs(waypoints.slice(0, nIdx + 1));\n");
        sb.append("  }\n");
        sb.append("  if (custMarker) {\n");
        sb.append("    var cPos = custMarker.getLatLng();\n");
        sb.append("    var dist = calcDistKm(lat, lng, cPos.lat, cPos.lng);\n");
        sb.append("    var mins = Math.max(1, Math.round((dist / Math.max(15, s)) * 60));\n");
        sb.append("    var prog = 50;\n");
        sb.append("    if (restMarker) {\n");
        sb.append("      var rPos = restMarker.getLatLng();\n");
        sb.append("      var tDist = calcDistKm(rPos.lat, rPos.lng, cPos.lat, cPos.lng);\n");
        sb.append("      prog = Math.min(96, Math.max(10, Math.round(((tDist - dist) / Math.max(0.1, tDist)) * 100)));\n");
        sb.append("    }\n");
        sb.append("    if (window.AndroidMapBridge) { window.AndroidMapBridge.onRiderProgress(prog, dist, s, mins); }\n");
        sb.append("  }\n");
        sb.append("}\n");

        sb.append("function startSimulation() {\n");
        sb.append("  if (isSimulating || waypoints.length < 2) return;\n");
        sb.append("  isSimulating = true; simIndex = 0; var total = waypoints.length;\n");
        sb.append("  simInterval = setInterval(function() {\n");
        sb.append("    if (!isSimulating) return;\n");
        sb.append("    simIndex++;\n");
        sb.append("    if (simIndex >= total) {\n");
        sb.append("      simIndex = total - 1; clearInterval(simInterval); isSimulating = false;\n");
        sb.append("      if (window.AndroidMapBridge) { window.AndroidMapBridge.onRiderProgress(100, 0, 0, 0); }\n");
        sb.append("      return;\n");
        sb.append("    }\n");
        sb.append("    var cur = waypoints[simIndex]; var prev = waypoints[Math.max(0, simIndex - 1)];\n");
        sb.append("    var h = calcHeading(prev[0], prev[1], cur[0], cur[1]); var speed = 26;\n");
        sb.append("    if (!driverMarker) {\n");
        sb.append("      driverMarker = L.marker(cur, { icon: L.divIcon({ html: makeRiderHtml(h, speed), className: '', iconSize: [54, 54], iconAnchor: [27, 27] }), zIndexOffset: 1000 }).addTo(map);\n");
        sb.append("    } else {\n");
        sb.append("      driverMarker.setLatLng(cur);\n");
        sb.append("      driverMarker.setIcon(L.divIcon({ html: makeRiderHtml(h, speed), className: '', iconSize: [54, 54], iconAnchor: [27, 27] }));\n");
        sb.append("    }\n");
        sb.append("    if (routeCompleted) routeCompleted.setLatLngs(waypoints.slice(0, simIndex + 1));\n");
        sb.append("    var dest = waypoints[total - 1];\n");
        sb.append("    var remDist = calcDistKm(cur[0], cur[1], dest[0], dest[1]);\n");
        sb.append("    var remMins = Math.max(1, Math.round((remDist / 25) * 60));\n");
        sb.append("    var prog = (simIndex / (total - 1)) * 100;\n");
        sb.append("    if (window.AndroidMapBridge) { window.AndroidMapBridge.onRiderProgress(prog, remDist, speed, remMins); }\n");
        sb.append("  }, 900);\n");
        sb.append("}\n");

        sb.append("function recenterOnDriver() {\n");
        sb.append("  if (!map) return;\n");
        sb.append("  if (driverMarker) map.setView(driverMarker.getLatLng(), 16, { animate: true, duration: 0.7 });\n");
        sb.append("  else if (restMarker) map.setView(restMarker.getLatLng(), 15, { animate: true });\n");
        sb.append("}\n");

        sb.append("function fitRoute() {\n");
        sb.append("  if (!map) return;\n");
        sb.append("  var grp = [];\n");
        sb.append("  if (driverMarker) grp.push(driverMarker.getLatLng());\n");
        sb.append("  if (restMarker) grp.push(restMarker.getLatLng());\n");
        sb.append("  if (custMarker) grp.push(custMarker.getLatLng());\n");
        sb.append("  if (grp.length > 0) map.fitBounds(L.latLngBounds(grp), { padding: [55, 55], maxZoom: 16 });\n");
        sb.append("}\n");

        sb.append("function switchStyle(style) {\n");
        sb.append("  if (!map) return;\n");
        sb.append("  map.eachLayer(function(l) { if (l instanceof L.TileLayer) { map.removeLayer(l); } });\n");
        sb.append("  if (style === 'dark') darkLayer.addTo(map);\n");
        sb.append("  else if (style === 'satellite') satLayer.addTo(map);\n");
        sb.append("  else streetLayer.addTo(map);\n");
        sb.append("}\n");

        sb.append("window.addEventListener('load', initMap);\n");
        sb.append("setTimeout(function() { if (!map) initMap(); }, 400);\n");
        sb.append("</script></body></html>");

        return sb.toString();
    }

    private void pushPendingCoordinatesToMap() {
        if (!mapLoaded || wvLiveMap == null) return;
        if (mapRestLat != 0 && mapRestLng != 0 && mapCustLat != 0 && mapCustLng != 0) {
            String safeName = restaurantNameStr != null ? restaurantNameStr.replace("'", "\\'") : "Restaurant";
            wvLiveMap.evaluateJavascript(String.format(Locale.US,
                "setOrderRoute(%f, %f, '%s', %f, %f, '%s');",
                mapRestLat, mapRestLng, safeName, mapCustLat, mapCustLng, lastStatus), null);
        }
        if (mapDriverLat != 0 && mapDriverLng != 0) {
            wvLiveMap.evaluateJavascript(String.format(Locale.US,
                "updateDriver(%f, %f, %f, %f);",
                mapDriverLat, mapDriverLng, lastDriverHeading, lastDriverSpeed), null);
        }
    }

    private void updateRiderProgressFromMap(double progressPct, double distKm, double speedKmh, int etaMinutes) {
        if (tvMapRiderStatus != null) {
            if (distKm <= 0.05 || progressPct >= 98) {
                tvMapRiderStatus.setText("📍 Valet arrived at your doorstep!");
            } else {
                tvMapRiderStatus.setText(String.format(Locale.getDefault(),
                    "🛵 Valet on the way • %.1f km away • ~%d mins", distKm, Math.max(1, etaMinutes)));
            }
        }
        if (tvFsDriverSub != null) {
            if (distKm <= 0.05 || progressPct >= 98) {
                tvFsDriverSub.setText("📍 Valet arrived at your doorstep!");
            } else {
                tvFsDriverSub.setText(String.format(Locale.getDefault(),
                    "🛵 ~%d mins • %.1f km away • %.0f km/h", Math.max(1, etaMinutes), distKm, speedKmh));
            }
        }
        if (progressTrack != null && progressPct > 0) {
            int p = (int) (40 + (progressPct * 0.55));
            progressTrack.setProgress(Math.min(95, Math.max(progressTrack.getProgress(), p)));
        }
    }

    private void updateMapDriverPosition(double lat, double lng, double heading, double speed) {
        mapDriverLat = lat;
        mapDriverLng = lng;
        lastDriverHeading = heading;
        lastDriverSpeed = speed;
        if (!mapLoaded || wvLiveMap == null) return;
        runOnUiThread(() -> wvLiveMap.evaluateJavascript(String.format(Locale.US,
            "updateDriver(%f, %f, %f, %f);", lat, lng, heading, speed), null));
    }

    private void updateMapDriverPosition(double lat, double lng) {
        updateMapDriverPosition(lat, lng, 0, 24);
    }

    private void recenterMapOnDriver() {
        if (!mapLoaded || wvLiveMap == null) return;
        wvLiveMap.evaluateJavascript("if (typeof recenterOnDriver === 'function') { recenterOnDriver(); }", null);
    }

    private void fitMapRoute() {
        if (!mapLoaded || wvLiveMap == null) return;
        wvLiveMap.evaluateJavascript("if (typeof fitRoute === 'function') { fitRoute(); }", null);
    }

    private void switchMapStyle(String style) {
        currentMapStyle = style;
        if (!mapLoaded || wvLiveMap == null) return;
        runOnUiThread(() -> wvLiveMap.evaluateJavascript("if (typeof switchStyle === 'function') { switchStyle('" + style + "'); }", null));
    }

    // ─── Full Screen Map Toggle & Back Handling ───────────────────────────────

    public void toggleMapFullScreen() {
        isMapFullScreen = !isMapFullScreen;
        if (frameMapContainer == null) return;

        if (isMapFullScreen) {
            if (scrollTrackingContent != null) scrollTrackingContent.setVisibility(View.GONE);
            if (viewMapFade != null) viewMapFade.setVisibility(View.GONE);
            if (layoutFullscreenBottomCard != null) layoutFullscreenBottomCard.setVisibility(View.VISIBLE);
            if (ivFullscreenIcon != null) ivFullscreenIcon.setImageResource(R.drawable.ic_fullscreen_exit);
            if (tvTopTitle != null) tvTopTitle.setText("Live Fullscreen Map");

            ViewGroup.LayoutParams lp = frameMapContainer.getLayoutParams();
            lp.height = ViewGroup.LayoutParams.MATCH_PARENT;
            frameMapContainer.setLayoutParams(lp);
        } else {
            if (scrollTrackingContent != null) scrollTrackingContent.setVisibility(View.VISIBLE);
            if (viewMapFade != null) viewMapFade.setVisibility(View.VISIBLE);
            if (layoutFullscreenBottomCard != null) layoutFullscreenBottomCard.setVisibility(View.GONE);
            if (ivFullscreenIcon != null) ivFullscreenIcon.setImageResource(R.drawable.ic_fullscreen);
            if (tvTopTitle != null) tvTopTitle.setText("Live Order Tracking");

            ViewGroup.LayoutParams lp = frameMapContainer.getLayoutParams();
            lp.height = defaultMapHeightPx > 0 ? defaultMapHeightPx : (int) (330 * getResources().getDisplayMetrics().density);
            frameMapContainer.setLayoutParams(lp);
        }

        if (wvLiveMap != null) {
            wvLiveMap.evaluateJavascript("if (typeof map !== 'undefined' && map) { map.invalidateSize(); }", null);
        }
        new Handler(Looper.getMainLooper()).postDelayed(this::fitMapRoute, 300);
    }

    @Override
    public void onBackPressed() {
        if (isMapFullScreen) {
            toggleMapFullScreen();
            return;
        }
        super.onBackPressed();
    }

    // ─── Animated Map Placeholder ─────────────────────────────────────────────

    private void startMapAnimation() {
        // Animate the ETA text to pulse gently
        if (tvEta != null) {
            ObjectAnimator scaleX = ObjectAnimator.ofFloat(tvEta, "scaleX", 1f, 1.05f, 1f);
            ObjectAnimator scaleY = ObjectAnimator.ofFloat(tvEta, "scaleY", 1f, 1.05f, 1f);
            scaleX.setDuration(1800);
            scaleY.setDuration(1800);
            scaleX.setRepeatCount(ValueAnimator.INFINITE);
            scaleY.setRepeatCount(ValueAnimator.INFINITE);
            scaleX.start();
            scaleY.start();
        }

        // Floating bobbing animation on rider avatar
        View riderAvatar = findViewById(R.id.frame_rider_avatar);
        if (riderAvatar != null) {
            ObjectAnimator bobY = ObjectAnimator.ofFloat(riderAvatar, "translationY", 0f, -8f, 0f);
            bobY.setDuration(1500);
            bobY.setRepeatCount(ValueAnimator.INFINITE);
            bobY.setInterpolator(new AccelerateDecelerateInterpolator());
            bobY.start();
        }

        // Radar wave pulse on concentric rings
        animateRadarRing(findViewById(R.id.view_radar_ring_inner), 0);
        animateRadarRing(findViewById(R.id.view_radar_ring_mid), 400);
        animateRadarRing(findViewById(R.id.view_radar_ring_outer), 800);

        // Slide up entry for the main cards
        View cardEta = findViewById(R.id.card_eta);
        if (cardEta != null) {
            cardEta.setAlpha(0f);
            cardEta.setTranslationY(60f);
            cardEta.animate()
                    .alpha(1f)
                    .translationY(0f)
                    .setDuration(450)
                    .setInterpolator(new AccelerateDecelerateInterpolator())
                    .start();
        }
    }

    private void animateRadarRing(View ring, long startDelay) {
        if (ring == null) return;
        ObjectAnimator scaleX = ObjectAnimator.ofFloat(ring, "scaleX", 1.0f, 1.25f, 1.0f);
        ObjectAnimator scaleY = ObjectAnimator.ofFloat(ring, "scaleY", 1.0f, 1.25f, 1.0f);
        ObjectAnimator alpha = ObjectAnimator.ofFloat(ring, "alpha", ring.getAlpha(), ring.getAlpha() * 1.8f, ring.getAlpha());

        scaleX.setDuration(2400);
        scaleY.setDuration(2400);
        alpha.setDuration(2400);

        scaleX.setStartDelay(startDelay);
        scaleY.setStartDelay(startDelay);
        alpha.setStartDelay(startDelay);

        scaleX.setRepeatCount(ValueAnimator.INFINITE);
        scaleY.setRepeatCount(ValueAnimator.INFINITE);
        alpha.setRepeatCount(ValueAnimator.INFINITE);

        scaleX.start();
        scaleY.start();
        alpha.start();
    }

    // ─── Firestore: Listen to Order ────────────────────────────────────────────

    private void listenToOrder() {
        orderListener = db.collection("orders").document(orderId)
            .addSnapshotListener((snap, error) -> {
                if (error != null || snap == null || !snap.exists()) return;

                String status = snap.getString("status");
                String restaurantName = snap.getString("restaurantName");
                if (restaurantName != null) restaurantNameStr = restaurantName;
                String restaurantId = snap.getString("restaurantId");
                String snapRestPhone = snap.getString("restaurantPhone");
                String snapRestAddress = snap.getString("restaurantAddress");
                if (snapRestPhone != null && !snapRestPhone.isEmpty()) restaurantPhone = snapRestPhone;
                if (snapRestAddress != null && !snapRestAddress.isEmpty()) restaurantAddress = snapRestAddress;

                Double snapRestLat = snap.getDouble("restaurantLatitude");
                Double snapRestLng = snap.getDouble("restaurantLongitude");
                if (snapRestLat != null && snapRestLng != null && snapRestLat != 0) {
                    mapRestLat = snapRestLat;
                    mapRestLng = snapRestLng;
                }

                String deliveryPersonId = snap.getString("deliveryPersonId");
                String deliveryPersonName = snap.getString("deliveryPersonName");
                String deliveryPersonPhone = snap.getString("deliveryPersonPhone");
                Double rawTotal = snap.getDouble("total");
                Double rawSubtotal = snap.getDouble("subtotal");
                Double deliveryCharge = snap.getDouble("deliveryCharge");
                if (deliveryCharge == null || deliveryCharge <= 0) {
                    deliveryCharge = snap.getDouble("deliveryFee");
                }

                // Determine total items quantity for delivery charge calculation (₹40 standard, ₹60 multi)
                int totalQty = 0;
                Object itemsObj = snap.get("items");
                if (itemsObj instanceof java.util.List) {
                    for (Object it : (java.util.List<?>) itemsObj) {
                        if (it instanceof Map) {
                            Object q = ((Map<?, ?>) it).get("quantity");
                            if (q instanceof Number) totalQty += ((Number) q).intValue();
                            else totalQty += 1;
                        }
                    }
                }
                if (deliveryCharge == null || deliveryCharge <= 0) {
                    deliveryCharge = totalQty > 1 ? 60.0 : 40.0;
                }

                double total = rawTotal != null ? rawTotal : 0.0;
                double subtotal = rawSubtotal != null ? rawSubtotal : Math.max(0, total - deliveryCharge);
                if (total <= subtotal && deliveryCharge > 0) {
                    total = subtotal + deliveryCharge;
                }

                String vehicleNumber = snap.getString("vehicleNumber");

                // Extract delivery address & coordinates
                Object addrObj = snap.get("deliveryAddress");
                String addrStr = "";
                double custLat = 0, custLng = 0;
                if (addrObj instanceof Map) {
                    Map<?, ?> addr = (Map<?, ?>) addrObj;
                    Object street = addr.get("street");
                    Object city = addr.get("city");
                    Object pincode = addr.get("pincode");
                    addrStr = String.format("%s, %s %s",
                        street != null ? street.toString() : "",
                        city != null ? city.toString() : "",
                        pincode != null ? pincode.toString() : "").trim();
                    Object latObj = addr.get("latitude");
                    Object lngObj = addr.get("longitude");
                    if (latObj instanceof Number) custLat = ((Number) latObj).doubleValue();
                    if (lngObj instanceof Number) custLng = ((Number) lngObj).doubleValue();
                } else if (addrObj instanceof String) {
                    addrStr = (String) addrObj;
                }

                if (custLat == 0 && custLng == 0) {
                    Double sLat = snap.getDouble("deliveryLatitude");
                    Double sLng = snap.getDouble("deliveryLongitude");
                    if (sLat != null && sLng != null && sLat != 0) {
                        custLat = sLat;
                        custLng = sLng;
                    }
                }

                if (custLat == 0 && custLng == 0) {
                    com.ssr.hunger.models.Address savedAddr = CartManager.getInstance(this).getDeliveryAddress();
                    if (savedAddr != null && savedAddr.getLatitude() != 0) {
                        custLat = savedAddr.getLatitude();
                        custLng = savedAddr.getLongitude();
                    }
                }

                if (custLat == 0 && custLng == 0) {
                    custLat = 28.6139; // Default New Delhi
                    custLng = 77.2090;
                }
                mapCustLat = custLat;
                mapCustLng = custLng;

                // Query Firestore for complete restaurant phone, address & coordinates
                if (restaurantId != null && !restaurantId.isEmpty()) {
                    db.collection(Constants.COLLECTION_RESTAURANTS).document(restaurantId).get()
                        .addOnSuccessListener(rSnap -> {
                            if (rSnap == null || !rSnap.exists()) return;
                            String phone = rSnap.getString("phone");
                            String address = rSnap.getString("address");
                            if (address == null || address.isEmpty()) address = rSnap.getString("street");
                            Double rLat = rSnap.getDouble("latitude");
                            Double rLng = rSnap.getDouble("longitude");

                            if (phone != null && !phone.isEmpty()) restaurantPhone = phone;
                            if (address != null && !address.isEmpty()) restaurantAddress = address;
                            if (rLat != null && rLng != null && rLat != 0) {
                                mapRestLat = rLat;
                                mapRestLng = rLng;
                            }

                            runOnUiThread(() -> {
                                if (tvRestaurantAddress != null && !restaurantAddress.isEmpty()) {
                                    tvRestaurantAddress.setText(restaurantAddress);
                                }
                                if (tvRestaurantPhone != null && !restaurantPhone.isEmpty()) {
                                    tvRestaurantPhone.setText("📞 " + restaurantPhone);
                                }
                                pushPendingCoordinatesToMap();
                            });
                        });
                }

                // If restaurant coords not known yet, set realistic offset from customer location
                if (mapRestLat == 0 && mapRestLng == 0) {
                    mapRestLat = mapCustLat - 0.015;
                    mapRestLng = mapCustLng - 0.018;
                }

                pushPendingCoordinatesToMap();

                // Order placed time → ETA
                Object createdAtObj = snap.get("createdAt");
                if (createdAtObj instanceof com.google.firebase.Timestamp) {
                    orderPlacedMs = ((com.google.firebase.Timestamp) createdAtObj).toDate().getTime();
                    Object estObj = snap.get("estimatedDeliveryMinutes");
                    if (estObj instanceof Long) estimatedMins = ((Long) estObj).intValue();
                    startEtaCountdown();
                }

                // Store driver uid for location tracking
                if (deliveryPersonId != null && !deliveryPersonId.equals(driverUid)) {
                    driverUid = deliveryPersonId;
                    listenToDriverLocation(driverUid);
                }

                updateUI(status, restaurantName, restaurantAddress,
                    deliveryPersonName, deliveryPersonPhone, vehicleNumber,
                    addrStr, total, subtotal, deliveryCharge, totalQty);

                if (status != null && !status.equalsIgnoreCase(lastStatus)) {
                    lastStatus = status;
                    if (com.ssr.hunger.utils.SettingsHelper.isVoiceAnnouncementsEnabled(OrderTrackingActivity.this)) {
                        String shortId = orderId != null && orderId.length() >= 6 ? orderId.substring(orderId.length() - 6).toUpperCase() : (orderId != null ? orderId : "");
                        String speech = "Order update: " + status.replace("_", " ");
                        if ("preparing".equalsIgnoreCase(status)) speech = "Kitchen is preparing your order!";
                        else if ("ready".equalsIgnoreCase(status)) speech = "Your food is freshly packed and ready for pickup!";
                        else if ("out_for_delivery".equalsIgnoreCase(status)) speech = "Order #" + shortId + " is out for delivery with your rider!";
                        else if ("delivered".equalsIgnoreCase(status)) speech = "Your order has been delivered! Enjoy your meal.";
                        com.ssr.hunger.utils.VoiceHelper.getInstance(OrderTrackingActivity.this).speakOrderUpdate(speech);
                    }
                }

                // Handle Delivery Verification OTP
                String otp = snap.getString("deliveryOtp");
                if ((otp == null || otp.trim().isEmpty()) && !"delivered".equals(status) && !"cancelled".equals(status)) {
                    int code = Math.abs(orderId.hashCode() % 9000) + 1000;
                    otp = String.valueOf(code);
                    db.collection(Constants.COLLECTION_ORDERS).document(orderId).update("deliveryOtp", otp);
                }

                View cardOtp = findViewById(R.id.card_tracking_otp);
                TextView tvOtp = findViewById(R.id.tv_tracking_otp);
                View btnCopyOtp = findViewById(R.id.btn_copy_tracking_otp);

                if (cardOtp != null) {
                    if ("delivered".equals(status) || "cancelled".equals(status)) {
                        cardOtp.setVisibility(View.GONE);
                    } else {
                        cardOtp.setVisibility(View.VISIBLE);
                        if (tvOtp != null) tvOtp.setText(otp != null ? otp : "----");
                        if (btnCopyOtp != null && otp != null) {
                            final String finalOtp = otp;
                            btnCopyOtp.setOnClickListener(v -> {
                                android.content.ClipboardManager clipboard = (android.content.ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
                                android.content.ClipData clip = android.content.ClipData.newPlainText("Delivery OTP", finalOtp);
                                if (clipboard != null) clipboard.setPrimaryClip(clip);
                                Toast.makeText(OrderTrackingActivity.this, "Delivery OTP copied: " + finalOtp, Toast.LENGTH_SHORT).show();
                            });
                        }
                    }
                }

                // Handle delivery stage sub-status
                Object deliveryObj = snap.get("delivery");
                if (deliveryObj instanceof Map) {
                    String stage = (String)((Map<?,?>)deliveryObj).get("stage");
                    updateDeliveryStageHint(stage);
                }

                // Status-change celebration
                if (status != null && !status.equals(lastStatus)) {
                    animateStatusChange();
                    if ("delivered".equals(status)) showDeliveredCelebration();
                    lastStatus = status;
                }
            });
    }

    // ─── Driver Location: Real-time GPS from Firebase ─────────────────────────

    private void listenToDriverLocation(String driverId) {
        if (driverLocationListener != null) driverLocationListener.remove();
        driverLocationListener = db.collection(Constants.COLLECTION_DRIVER_LOCATIONS)
            .document(driverId)
            .addSnapshotListener((snap, error) -> {
                if (snap == null || !snap.exists()) return;
                Double lat = snap.getDouble("latitude");
                Double lng = snap.getDouble("longitude");
                Double speed = snap.getDouble("speed");
                Double accuracy = snap.getDouble("accuracy");
                Double heading = snap.getDouble("heading");

                if (lat != null && lng != null) {
                    // Update real-time map marker with heading and speed
                    updateMapDriverPosition(lat, lng, heading != null ? heading : 0.0, speed != null ? speed : 24.0);

                    if (tvGpsCoords != null) {
                        runOnUiThread(() -> {
                            String speedStr = speed != null ? String.format(Locale.getDefault(), " | %.0f km/h", speed) : "";
                            String accStr  = accuracy != null ? String.format(Locale.getDefault(), " ±%.0fm", accuracy) : "";
                            tvGpsCoords.setText(String.format(Locale.getDefault(),
                                "📍 %.5f, %.5f%s%s", lat, lng, speedStr, accStr));
                            tvGpsCoords.setVisibility(View.VISIBLE);
                            if (gpsLiveBadge != null) gpsLiveBadge.setVisibility(View.VISIBLE);
                        });
                    }
                }
            });
    }

    // ─── Update UI ─────────────────────────────────────────────────────────────

    private void updateUI(String status, String restaurant, String restaurantAddr,
                          String driverName, String driverPhone, String vehicleNum,
                          String deliveryAddr, Double total, Double subtotal,
                          Double deliveryCharge, int totalQty) {
        runOnUiThread(() -> {
            if (tvRestaurantName != null && restaurant != null) tvRestaurantName.setText(restaurant);
            if (tvRestaurantAddress != null && restaurantAddress != null && !restaurantAddress.isEmpty()) {
                tvRestaurantAddress.setText(restaurantAddress);
            }
            if (tvRestaurantPhone != null && restaurantPhone != null && !restaurantPhone.isEmpty()) {
                tvRestaurantPhone.setText("📞 " + restaurantPhone);
            }
            if (btnCallRestaurant != null) {
                btnCallRestaurant.setOnClickListener(v -> callPhoneNumber(restaurantPhone, tvRestaurantName != null ? tvRestaurantName.getText().toString() : "Restaurant"));
            }

            if (tvOrderId != null) tvOrderId.setText("#" + orderId.substring(Math.max(0, orderId.length() - 8)).toUpperCase());
            if (tvDeliveryAddress != null && !deliveryAddr.isEmpty()) tvDeliveryAddress.setText(deliveryAddr);
            if (tvOrderStatus != null && status != null) tvOrderStatus.setText(getStatusEmoji(status) + " " + getStatusLabel(status));

            if (tvOrderTotal != null && total != null) {
                tvOrderTotal.setVisibility(View.VISIBLE);
                tvOrderTotal.setText(String.format(Locale.getDefault(), "₹%.0f", total));
            }
            if (tvDeliveryChargeInfo != null && deliveryCharge != null) {
                tvDeliveryChargeInfo.setText(String.format(Locale.getDefault(), "Delivery: ₹%.2f", deliveryCharge));
            }
            if (tvTrackingSubtotal != null && subtotal != null) {
                tvTrackingSubtotal.setText(String.format(Locale.getDefault(), "₹%.2f", subtotal));
            }
            if (tvTrackingDeliveryCharge != null && deliveryCharge != null) {
                tvTrackingDeliveryCharge.setText(String.format(Locale.getDefault(), "₹%.2f", deliveryCharge));
            }
            if (tvTrackingGrandTotal != null && total != null) {
                tvTrackingGrandTotal.setText(String.format(Locale.getDefault(), "₹%.2f", total));
            }
            if (tvTrackingDeliveryBadge != null) {
                tvTrackingDeliveryBadge.setText(totalQty > 1 ? "Multi-item ₹60" : "Standard ₹40");
            }

            // Driver card
            boolean hasDriver = driverName != null && !driverName.isEmpty();
            if (cardDriverPartner != null) cardDriverPartner.setVisibility(hasDriver ? View.VISIBLE : View.GONE);
            if (hasDriver) {
                if (tvDriverName != null) tvDriverName.setText(driverName);
                if (tvDriverPhone != null) tvDriverPhone.setText(driverPhone != null ? driverPhone : "");
                if (tvDriverVehicle != null && vehicleNum != null) tvDriverVehicle.setText(vehicleNum);
                final String phone = driverPhone;
                if (btnCallDriver != null) {
                    btnCallDriver.setVisibility(phone != null && !phone.isEmpty() ? View.VISIBLE : View.GONE);
                    btnCallDriver.setOnClickListener(v -> callPhoneNumber(phone, driverName));
                }
            }

            // Sync with Fullscreen Card
            if (tvFsDriverName != null) {
                tvFsDriverName.setText(hasDriver ? driverName : "Delivery Valet");
            }
            if (tvFsDriverSub != null && (tvFsDriverSub.getText() == null || tvFsDriverSub.getText().toString().isEmpty() || tvFsDriverSub.getText().toString().contains("Realtime"))) {
                if (status != null) tvFsDriverSub.setText(getStatusEmoji(status) + " " + getStatusLabel(status));
            }
            if (btnFsCallDriver != null) {
                final String phone = driverPhone;
                btnFsCallDriver.setVisibility(hasDriver && phone != null && !phone.isEmpty() ? View.VISIBLE : View.GONE);
                if (hasDriver && phone != null && !phone.isEmpty()) {
                    btnFsCallDriver.setOnClickListener(v -> callPhoneNumber(phone, driverName));
                }
            }

            // Build step track
            buildStepTracker(status);
        });
    }

    private void callPhoneNumber(String phone, String name) {
        if (phone == null || phone.trim().isEmpty()) {
            Toast.makeText(this, "Contact number not available for " + (name != null ? name : "partner"), Toast.LENGTH_SHORT).show();
            return;
        }
        final String cleanPhone = phone.trim();
        requirePhone(
            () -> startActivity(new Intent(Intent.ACTION_CALL, Uri.parse("tel:" + cleanPhone))),
            (isPermanent) -> startActivity(new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + cleanPhone)))
        );
    }

    private void shareTrackingInfo() {
        String rest = (tvRestaurantName != null && tvRestaurantName.getText() != null) ? tvRestaurantName.getText().toString() : "Restaurant";
        String eta = (tvEta != null && tvEta.getText() != null) ? tvEta.getText().toString() : "soon";
        String shortId = orderId != null && orderId.length() >= 8 ? orderId.substring(orderId.length() - 8).toUpperCase() : (orderId != null ? orderId : "");
        String shareMsg = "🍔 Live Order Tracking from *" + rest + "* on Hunger!\n"
            + "📦 Order #" + shortId + "\n"
            + "⏱️ Estimated Delivery: " + eta + "\n"
            + "🛵 Status: " + getStatusLabel(lastStatus) + "\n"
            + "📍 Track Online: https://shungher.vercel.app\n"
            + "✨ Fresh & Sealed Delivery!";
        Intent sendIntent = new Intent(Intent.ACTION_SEND);
        sendIntent.putExtra(Intent.EXTRA_TEXT, shareMsg);
        sendIntent.setType("text/plain");
        startActivity(Intent.createChooser(sendIntent, "Share Live Tracking"));
    }

    private String getStatusLabel(String status) {
        if (status == null) return "Loading...";
        switch (status) {
            case "pending":          return "Order Placed";
            case "confirmed":        return "Order Confirmed";
            case "preparing":        return "Kitchen Preparing";
            case "ready":            return "Food Ready";
            case "out_for_delivery": return "Out for Delivery";
            case "delivered":        return "Delivered!";
            case "cancelled":        return "Cancelled";
            default:                 return status;
        }
    }

    private String getStatusEmoji(String status) {
        if (status == null) return "📦";
        switch (status) {
            case "pending":          return "📦";
            case "confirmed":        return "✅";
            case "preparing":        return "👨‍🍳";
            case "ready":            return "🍱";
            case "out_for_delivery": return "🛵";
            case "delivered":        return "🎉";
            case "cancelled":        return "❌";
            default:                 return "📦";
        }
    }

    private void updateDeliveryStageHint(String stage) {
        if (stage == null || tvOrderStatus == null) return;
        String hint = null;
        switch (stage) {
            case "TO_PICKUP":       hint = "🏍️ Driver heading to restaurant"; break;
            case "ARRIVED_PICKUP":  hint = "🍱 Driver collecting your food"; break;
            case "TO_CUSTOMER":     hint = "🚀 Driver on the way to you"; break;
            case "ARRIVED_CUSTOMER":hint = "📍 Driver at your door!"; break;
        }
        if (hint != null) {
            final String finalHint = hint;
            runOnUiThread(() -> {
                tvOrderStatus.setText(finalHint);
                if (tvFsDriverSub != null) tvFsDriverSub.setText(finalHint);
            });
        }
    }

    // ─── Vertical Step Tracker ─────────────────────────────────────────────────

    private void buildStepTracker(String currentStatus) {
        if (stepContainer == null) return;
        stepContainer.removeAllViews();

        int currentIdx = indexOfStatus(currentStatus);

        for (int i = 0; i < STEPS.length; i++) {
            boolean done = i < currentIdx;
            boolean active = i == currentIdx;
            boolean upcoming = i > currentIdx;

            View row = LayoutInflater.from(this).inflate(R.layout.item_tracking_step, stepContainer, false);
            if (row == null) {
                // fallback: create programmatically
                row = makeStepRowProgrammatic(i, done, active);
            } else {
                TextView tvEmoji  = row.findViewById(R.id.tv_step_emoji);
                TextView tvLabel  = row.findViewById(R.id.tv_step_label);
                TextView tvDesc   = row.findViewById(R.id.tv_step_desc);
                TextView tvBadge  = row.findViewById(R.id.tv_step_badge);
                View     vLine    = row.findViewById(R.id.v_step_line);
                View     vLineTop = row.findViewById(R.id.v_step_line_top);
                View     vDot     = row.findViewById(R.id.v_step_dot);
                View     cardContent = row.findViewById(R.id.card_step_content);
                View     frameNode = row.findViewById(R.id.frame_step_node);

                if (tvEmoji != null) {
                    tvEmoji.setText(done ? "✓" : STEP_EMOJIS[i]);
                }
                if (tvLabel != null) {
                    tvLabel.setText(STEP_LABELS[i]);
                    if (done) {
                        tvLabel.setTextColor(0xFF10B981);
                    } else if (active) {
                        tvLabel.setTextColor(STEP_COLORS[i]);
                    } else {
                        tvLabel.setTextColor(0xFF94A3B8);
                        tvLabel.setAlpha(0.6f);
                    }
                }
                if (tvDesc != null && i < STEP_SUBTITLES.length) {
                    tvDesc.setText(STEP_SUBTITLES[i]);
                    if (upcoming) tvDesc.setAlpha(0.5f);
                }
                if (tvBadge != null) {
                    if (done) {
                        tvBadge.setText("COMPLETED ✓");
                        tvBadge.setBackgroundResource(R.drawable.bg_pill_emerald_soft);
                        tvBadge.setTextColor(0xFF10B981);
                    } else if (active) {
                        tvBadge.setText("LIVE STAGE ⚡");
                        tvBadge.setBackgroundResource(R.drawable.bg_pill_soft);
                        tvBadge.setTextColor(STEP_COLORS[i]);
                    } else {
                        tvBadge.setText("NEXT");
                        tvBadge.setBackgroundResource(R.drawable.bg_icon_circle_soft);
                        tvBadge.setTextColor(0xFF94A3B8);
                        tvBadge.setAlpha(0.5f);
                    }
                }

                if (vDot != null) {
                    if (done) {
                        vDot.setBackgroundResource(R.drawable.bg_step_node_completed);
                    } else if (active) {
                        vDot.setBackgroundResource(R.drawable.bg_step_node_active);
                        if (frameNode != null) startPulseOnView(frameNode);
                    } else {
                        vDot.setBackgroundResource(R.drawable.bg_step_node_upcoming);
                    }
                }

                if (cardContent != null) {
                    cardContent.setBackgroundResource(active ? R.drawable.bg_step_card_active : R.drawable.bg_step_card_idle);
                    if (upcoming) cardContent.setAlpha(0.7f);
                }

                if (vLineTop != null) {
                    vLineTop.setVisibility(i == 0 ? View.INVISIBLE : View.VISIBLE);
                    vLineTop.setBackgroundColor(done || active ? 0xFF10B981 : 0xFFE2E8F0);
                }
                if (vLine != null) {
                    vLine.setVisibility(i == STEPS.length - 1 ? View.INVISIBLE : View.VISIBLE);
                    vLine.setBackgroundColor(done ? 0xFF10B981 : 0xFFE2E8F0);
                }
            }

            stepContainer.addView(row);

            // Animate each row in with slide+fade
            final View finalRow = row;
            finalRow.setAlpha(0f);
            finalRow.setTranslationX(-35f);
            finalRow.animate()
                .alpha(1f).translationX(0f)
                .setDuration(320)
                .setStartDelay(i * 70L)
                .setInterpolator(new AccelerateDecelerateInterpolator())
                .start();
        }

        // Update progress bar
        if (progressTrack != null) {
            int pct = currentIdx * 100 / Math.max(1, STEPS.length - 1);
            ObjectAnimator.ofInt(progressTrack, "progress", progressTrack.getProgress(), pct)
                .setDuration(800)
                .start();
        }
    }

    private int indexOfStatus(String status) {
        if (status == null) return 0;
        for (int i = 0; i < STEPS.length; i++) {
            if (STEPS[i].equals(status)) return i;
        }
        return 0;
    }

    private View makeStepRowProgrammatic(int idx, boolean done, boolean active) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setPadding(0, 8, 0, 8);

        TextView dot = new TextView(this);
        dot.setText(done ? "✓" : STEP_EMOJIS[idx]);
        dot.setTextSize(16);
        dot.setPadding(8, 4, 16, 4);
        if (active) startPulseOnView(dot);
        row.addView(dot);

        TextView label = new TextView(this);
        label.setText(STEP_LABELS[idx]);
        label.setTextColor(done ? 0xFF4CAF50 : active ? STEP_COLORS[idx] : 0xFF757575);
        label.setTextSize(14);
        label.setAlpha(active || done ? 1f : 0.4f);
        row.addView(label);

        return row;
    }

    // ─── ETA Countdown ────────────────────────────────────────────────────────

    private void startEtaCountdown() {
        if (etaHandler != null && etaRunnable != null) etaHandler.removeCallbacks(etaRunnable);
        etaHandler = new Handler(Looper.getMainLooper());
        etaRunnable = new Runnable() {
            @Override
            public void run() {
                if (tvEta == null) return;
                long etaMs = orderPlacedMs + TimeUnit.MINUTES.toMillis(estimatedMins);
                long remainMs = Math.max(0, etaMs - System.currentTimeMillis());
                long mins = TimeUnit.MILLISECONDS.toMinutes(remainMs);
                long secs = TimeUnit.MILLISECONDS.toSeconds(remainMs) % 60;
                if (remainMs == 0) {
                    tvEta.setText("Arriving now! 🎉");
                } else {
                    tvEta.setText(String.format(Locale.getDefault(), "%dm %02ds", mins, secs));
                }
                etaHandler.postDelayed(this, 1000);
            }
        };
        etaHandler.post(etaRunnable);
    }

    // ─── Status Change Animation ───────────────────────────────────────────────

    private void animateStatusChange() {
        if (tvOrderStatus == null) return;
        ObjectAnimator shakeX = ObjectAnimator.ofFloat(tvOrderStatus, "translationX",
            0f, -12f, 12f, -8f, 8f, -4f, 4f, 0f);
        shakeX.setDuration(500);
        shakeX.start();

        // Scale pop
        ObjectAnimator scaleX = ObjectAnimator.ofFloat(tvOrderStatus, "scaleX", 1f, 1.2f, 1f);
        ObjectAnimator scaleY = ObjectAnimator.ofFloat(tvOrderStatus, "scaleY", 1f, 1.2f, 1f);
        scaleX.setDuration(400).setInterpolator(new OvershootInterpolator());
        scaleY.setDuration(400).setInterpolator(new OvershootInterpolator());
        scaleX.start();
        scaleY.start();

        // Flash background
        ValueAnimator flash = ValueAnimator.ofArgb(0x22FF9800, 0x00FF9800);
        flash.setDuration(600);
        flash.addUpdateListener(anim -> {
            if (tvOrderStatus != null) tvOrderStatus.setBackgroundColor((int) anim.getAnimatedValue());
        });
        flash.start();
    }

    private void showDeliveredCelebration() {
        if (tvEta == null) return;
        tvEta.setText("Delivered! 🎉");
        // Bounce the ETA card
        ObjectAnimator bounce = ObjectAnimator.ofFloat(tvEta, "translationY", 0f, -30f, 0f);
        bounce.setDuration(600);
        bounce.setInterpolator(new OvershootInterpolator(2f));
        bounce.start();
        Toast.makeText(this, "🎉 Your order has been delivered! Enjoy your meal!", Toast.LENGTH_LONG).show();
    }

    private void startPulseOnView(View v) {
        ObjectAnimator scale = ObjectAnimator.ofFloat(v, "scaleX", 1f, 1.25f, 1f);
        scale.setRepeatCount(ObjectAnimator.INFINITE);
        scale.setDuration(900);
        scale.start();
        ObjectAnimator scaleY = ObjectAnimator.ofFloat(v, "scaleY", 1f, 1.25f, 1f);
        scaleY.setRepeatCount(ObjectAnimator.INFINITE);
        scaleY.setDuration(900);
        scaleY.start();
    }

    // ─── Lifecycle ─────────────────────────────────────────────────────────────

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (orderListener != null) orderListener.remove();
        if (driverLocationListener != null) driverLocationListener.remove();
        if (etaHandler != null && etaRunnable != null)
            etaHandler.removeCallbacks(etaRunnable);

        // Stop GPS service if we started it (driver mode)
        if (isDriverMode) {
            DriverLocationService.stopTracking(this);
        }
    }
}
