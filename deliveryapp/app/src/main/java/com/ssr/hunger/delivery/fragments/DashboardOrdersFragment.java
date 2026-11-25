package com.ssr.hunger.delivery.fragments;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.content.pm.PackageManager;
import android.location.Address;
import android.location.Geocoder;
import android.location.Location;
import android.os.Bundle;
import android.view.GestureDetector;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;
import com.ssr.hunger.delivery.utils.ToastUtils;
import com.ssr.hunger.delivery.utils.LocationUtils;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.widget.NestedScrollView;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import org.osmdroid.tileprovider.tilesource.TileSourceFactory;
import org.osmdroid.views.overlay.Marker;
import org.osmdroid.views.overlay.Polyline;
import org.osmdroid.views.overlay.gestures.RotationGestureOverlay;
import com.google.android.material.floatingactionbutton.FloatingActionButton;
import android.animation.ObjectAnimator;
import android.animation.ValueAnimator;
import android.view.animation.DecelerateInterpolator;
import android.view.animation.LinearInterpolator;

import org.osmdroid.api.IMapController;
import org.osmdroid.config.Configuration;
import org.osmdroid.util.GeoPoint;
import org.osmdroid.util.BoundingBox;
import android.graphics.Paint;
import android.graphics.drawable.Drawable;
import org.osmdroid.views.MapView;
import android.preference.PreferenceManager;

import com.google.android.material.materialswitch.MaterialSwitch;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FieldValue;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import com.google.firebase.firestore.SetOptions;
import com.ssr.hunger.delivery.R;
import com.ssr.hunger.delivery.activities.LiveTrackingRadarActivity;
import com.ssr.hunger.delivery.activities.NotificationsActivity;
import com.ssr.hunger.delivery.activities.OrderActiveDetailActivity;
import com.ssr.hunger.delivery.activities.VkycVideoCallActivity;
import com.ssr.hunger.delivery.adapters.ActiveOrdersAdapter;
import com.ssr.hunger.delivery.adapters.AvailableOrdersAdapter;
import com.ssr.hunger.delivery.dialogs.EmergencySosDialog;
import com.ssr.hunger.delivery.dialogs.PincodeManagerDialog;
import com.ssr.hunger.delivery.models.DeliveryOrder;
import com.ssr.hunger.delivery.models.DeliveryPartner;
import com.ssr.hunger.delivery.services.DriverLocationService;
import com.ssr.hunger.delivery.utils.AnalyticsHelper;
import com.ssr.hunger.delivery.utils.Constants;
import com.ssr.hunger.delivery.utils.SoundHelper;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public class DashboardOrdersFragment extends Fragment {

    private FirebaseAuth auth;
    private FirebaseFirestore db;

    private View statusIndicator;
    private TextView tvStatusTitle, tvStatusHint, tvGpsStatus, tvCurrentLocation;
    private TextView btnManagePincodes;
    private MaterialSwitch switchOnline;

    private View cardMapSection, cardStatusHero;
    private MaterialSwitch switchMapOffline;
    private View cardMapOfflineControl;
    private TextView tvMapStatusLabel;
    private View cardMapGpsStatus;
    private View btnMapPincodes;
    
    private NestedScrollView nestedScrollView;
    private View btnMapZoomIn, btnMapZoomOut;
    private View btnMapCompass;
    private ImageView ivMapCompass;
    private View btnMapFitRoute;
    private View btnMapCallAction;
    private TextView tvMapCallLabel;
    private MapView mMap;
    private FusedLocationProviderClient fusedLocationClient;
    private FloatingActionButton btnCurrentLocation;
    private Marker driverMarker;
    private Marker restaurantMarker;
    private Marker customerMarker;
    private Polyline activeOrderRoutePolyline;
    private DeliveryOrder currentActiveOrder;
    private Polyline breadcrumbRoute;
    private final List<GeoPoint> breadcrumbPoints = new ArrayList<>();
    private ValueAnimator activeRouteAnimator;
    private ObjectAnimator scanDotAnimator;

    // Swipe action panel views
    private View layoutSwipeActionPanel;
    private View layoutSwipePickup;
    private View layoutSwipeDeliver;
    private View viewPickupThumb;
    private View viewDeliverThumb;
    private View layoutScanAnimation;
    private TextView tvScanLabel;
    private View viewScanDot;

    private interface OnRouteReadyListener {
        void onRouteReady(List<GeoPoint> points);
    }

    private LocationCallback locationCallback;

    private ImageButton btnSos, btnNotifications;
    private View cardKycWarning;
    private View btnBookVkyc;

    private View layoutActiveSection;
    private TextView tvActiveCount;
    private RecyclerView rvActiveOrders;
    private ActiveOrdersAdapter activeOrdersAdapter;

    private TextView tvAvailableCount;
    private View layoutEmptyAvailable;
    private TextView tvEmptyAvailableMessage;
    private RecyclerView rvAvailableOrders;
    private AvailableOrdersAdapter availableOrdersAdapter;

    private SwipeRefreshLayout swipeRefresh;

    private DeliveryPartner partner;
    private boolean isOnline = false;
    private final Set<String> declinedOrderIds = new HashSet<>();
    private String lastTopOrderId = null;
    private android.app.AlertDialog activeAcceptDialog;

    private ListenerRegistration partnerListener;
    private ListenerRegistration activeOrdersListener;
    private ListenerRegistration activeDriverIdListener;
    private ListenerRegistration activePartnerIdListener;
    private final Map<String, DeliveryOrder> rawActiveOrdersMap = new java.util.concurrent.ConcurrentHashMap<>();
    private final Map<String, DeliveryOrder> activeOrdersByPersonMap = new java.util.concurrent.ConcurrentHashMap<>();
    private final Map<String, DeliveryOrder> activeOrdersByDriverMap = new java.util.concurrent.ConcurrentHashMap<>();
    private final Map<String, DeliveryOrder> activeOrdersByPartnerMap = new java.util.concurrent.ConcurrentHashMap<>();
    private final Map<String, DeliveryOrder> optimisticActiveOrdersMap = new java.util.concurrent.ConcurrentHashMap<>();
    private ListenerRegistration availableOrdersListener;
    private ListenerRegistration broadcastOrdersListener;
    private ListenerRegistration fallbackOrdersListener;
    private final Map<String, DeliveryOrder> rawAvailableOrdersMap = new java.util.concurrent.ConcurrentHashMap<>();
    private Location lastKnownLocation;
    private android.content.BroadcastReceiver newOrderReceiver;
    private ListenerRegistration vkycCallListener;
    private androidx.appcompat.app.AlertDialog incomingCallDialog;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_dashboard_orders, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        auth = FirebaseAuth.getInstance();
        db = FirebaseFirestore.getInstance();

        initViews(view);
        setupAdapters();
        listenActiveDeliveries();
        listenAvailableOrders();
        loadPartnerData();

        // Handle incoming order passed from notification intent
        if (getArguments() != null && getArguments().containsKey(Constants.EXTRA_ORDER_ID)) {
            String incomingId = getArguments().getString(Constants.EXTRA_ORDER_ID);
            highlightOrAcceptIncomingOrder(incomingId);
        }

        // Register local broadcast receiver for real-time new order broadcasts from DeliveryFCMService
        newOrderReceiver = new android.content.BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (intent != null && intent.hasExtra(Constants.EXTRA_ORDER_ID)) {
                    String id = intent.getStringExtra(Constants.EXTRA_ORDER_ID);
                    highlightOrAcceptIncomingOrder(id);
                } else {
                    listenAvailableOrders();
                }
            }
        };
        try {
            android.content.IntentFilter filter = new android.content.IntentFilter("com.ssr.hunger.delivery.ACTION_NEW_AVAILABLE_ORDER");
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                requireContext().registerReceiver(newOrderReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
            } else {
                requireContext().registerReceiver(newOrderReceiver, filter);
            }
        } catch (Exception ignored) {}
    }

    private void initViews(View view) {
        statusIndicator = view.findViewById(R.id.view_status_indicator);
        tvStatusTitle = view.findViewById(R.id.tv_status_title);
        tvStatusHint = view.findViewById(R.id.tv_status_hint);
        tvGpsStatus = view.findViewById(R.id.tv_gps_status);
        tvCurrentLocation = view.findViewById(R.id.tv_current_location);
        btnManagePincodes = view.findViewById(R.id.btn_manage_pincodes);
        switchOnline = view.findViewById(R.id.switch_online);

        cardMapSection = view.findViewById(R.id.card_map_section);
        cardStatusHero = view.findViewById(R.id.card_status_hero);
        switchMapOffline = view.findViewById(R.id.switch_map_offline);
        cardMapOfflineControl = view.findViewById(R.id.card_map_offline_control);
        tvMapStatusLabel = view.findViewById(R.id.tv_map_status_label);
        cardMapGpsStatus = view.findViewById(R.id.card_map_gps_status);
        btnMapPincodes = view.findViewById(R.id.btn_map_pincodes);
        
        nestedScrollView = view.findViewById(R.id.nested_scroll_view);
        btnMapCompass = view.findViewById(R.id.btn_map_compass);
        ivMapCompass = view.findViewById(R.id.iv_map_compass);
        btnMapZoomIn = view.findViewById(R.id.btn_map_zoom_in);
        btnMapZoomOut = view.findViewById(R.id.btn_map_zoom_out);

        if (btnMapCompass != null) {
            btnMapCompass.setOnClickListener(v -> {
                if (mMap != null) {
                    mMap.setMapOrientation(0.0f);
                    if (ivMapCompass != null) ivMapCompass.setRotation(0.0f);
                }
            });
        }
        if (btnMapZoomIn != null) {
            btnMapZoomIn.setOnClickListener(v -> {
                if (mMap != null) mMap.getController().zoomIn();
            });
        }
        if (btnMapZoomOut != null) {
            btnMapZoomOut.setOnClickListener(v -> {
                if (mMap != null) mMap.getController().zoomOut();
            });
        }

        btnMapFitRoute = view.findViewById(R.id.btn_map_fit_route);
        if (btnMapFitRoute != null) {
            btnMapFitRoute.setOnClickListener(v -> fitCompleteRouteOnMap());
        }

        btnMapCallAction = view.findViewById(R.id.btn_map_call_action);
        tvMapCallLabel = view.findViewById(R.id.tv_map_call_label);

        // Scan animation + swipe panel
        layoutScanAnimation = view.findViewById(R.id.layout_scan_animation);
        tvScanLabel = view.findViewById(R.id.tv_scan_label);
        viewScanDot = view.findViewById(R.id.view_scan_dot);
        layoutSwipeActionPanel = view.findViewById(R.id.layout_swipe_action_panel);
        layoutSwipePickup = view.findViewById(R.id.layout_swipe_pickup);
        layoutSwipeDeliver = view.findViewById(R.id.layout_swipe_deliver);
        viewPickupThumb = view.findViewById(R.id.view_pickup_thumb);
        viewDeliverThumb = view.findViewById(R.id.view_deliver_thumb);

        if (btnMapCallAction != null) {
            btnMapCallAction.setOnClickListener(v -> {
                if (currentActiveOrder != null) {
                    callOrderContact(currentActiveOrder);
                }
            });
        }

        fusedLocationClient = LocationServices.getFusedLocationProviderClient(requireActivity());
        
        Context ctx = requireContext();
        Configuration.getInstance().load(ctx, PreferenceManager.getDefaultSharedPreferences(ctx));
        mMap = view.findViewById(R.id.map_fragment);
        
        // Double-tap detector for smooth zooming in on tap location
        GestureDetector doubleTapDetector = new GestureDetector(getContext(), new GestureDetector.SimpleOnGestureListener() {
            @Override
            public boolean onDoubleTap(MotionEvent e) {
                if (mMap != null) {
                    mMap.getController().zoomInFixing((int) e.getX(), (int) e.getY());
                    return true;
                }
                return false;
            }
        });

        // Multi-touch pinch-to-zoom and pan with natural vertical scrolling support
        mMap.setOnTouchListener(new View.OnTouchListener() {
            private float startX = 0f;
            private float startY = 0f;
            private boolean isMapPanning = false;

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                doubleTapDetector.onTouchEvent(event);
                int action = event.getActionMasked();
                switch (action) {
                    case MotionEvent.ACTION_DOWN:
                        startX = event.getX();
                        startY = event.getY();
                        isMapPanning = false;
                        if (v.getParent() != null) v.getParent().requestDisallowInterceptTouchEvent(true);
                        break;
                    case MotionEvent.ACTION_POINTER_DOWN:
                        isMapPanning = true;
                        if (nestedScrollView != null) nestedScrollView.requestDisallowInterceptTouchEvent(true);
                        if (swipeRefresh != null) swipeRefresh.setEnabled(false);
                        if (v.getParent() != null) v.getParent().requestDisallowInterceptTouchEvent(true);
                        break;
                    case MotionEvent.ACTION_MOVE:
                        float dx = Math.abs(event.getX() - startX);
                        float dy = Math.abs(event.getY() - startY);
                        if (event.getPointerCount() > 1) {
                            isMapPanning = true;
                        } else if (!isMapPanning && (dx > 25 || dy > 25)) {
                            isMapPanning = dx >= dy;
                        }
                        boolean lockMap = isMapPanning || (event.getPointerCount() > 1);
                        if (nestedScrollView != null) nestedScrollView.requestDisallowInterceptTouchEvent(lockMap);
                        if (swipeRefresh != null) swipeRefresh.setEnabled(!lockMap);
                        if (v.getParent() != null) v.getParent().requestDisallowInterceptTouchEvent(lockMap);
                        break;
                    case MotionEvent.ACTION_UP:
                    case MotionEvent.ACTION_CANCEL:
                        isMapPanning = false;
                        if (nestedScrollView != null) nestedScrollView.requestDisallowInterceptTouchEvent(false);
                        if (swipeRefresh != null) {
                            swipeRefresh.setEnabled(true);
                            swipeRefresh.requestDisallowInterceptTouchEvent(false);
                        }
                        if (v.getParent() != null) v.getParent().requestDisallowInterceptTouchEvent(false);
                        break;
                }
                return false;
            }
        });

        btnCurrentLocation = view.findViewById(R.id.btn_current_location);
        btnCurrentLocation.setOnClickListener(v -> centerMapOnCurrentLocation());
        setupMap();

        btnSos = view.findViewById(R.id.btn_header_sos);
        btnNotifications = view.findViewById(R.id.btn_header_notifications);
        cardKycWarning = view.findViewById(R.id.card_kyc_warning);
        btnBookVkyc = view.findViewById(R.id.btn_book_vkyc);

        layoutActiveSection = view.findViewById(R.id.layout_active_section);
        tvActiveCount = view.findViewById(R.id.tv_active_count);
        rvActiveOrders = view.findViewById(R.id.rv_active_orders);

        tvAvailableCount = view.findViewById(R.id.tv_available_count);
        layoutEmptyAvailable = view.findViewById(R.id.layout_empty_available);
        tvEmptyAvailableMessage = view.findViewById(R.id.tv_empty_available_message);
        rvAvailableOrders = view.findViewById(R.id.rv_available_orders);

        swipeRefresh = view.findViewById(R.id.swipe_refresh);

        switchOnline.setOnClickListener(v -> toggleOnlineStatus());
        if (switchMapOffline != null) {
            switchMapOffline.setOnClickListener(v -> toggleOnlineStatus());
        }
        if (cardMapOfflineControl != null) {
            cardMapOfflineControl.setOnClickListener(v -> toggleOnlineStatus());
        }
        if (cardMapGpsStatus != null) {
            cardMapGpsStatus.setOnClickListener(v -> startActivity(new Intent(getContext(), LiveTrackingRadarActivity.class)));
        }
        if (btnMapPincodes != null) {
            btnMapPincodes.setOnClickListener(v -> openPincodeManager());
        }
        btnManagePincodes.setOnClickListener(v -> openPincodeManager());
        tvGpsStatus.setOnClickListener(v -> startActivity(new Intent(getContext(), LiveTrackingRadarActivity.class)));

        btnBookVkyc.setOnClickListener(v -> {
            if (getContext() != null) {
                new com.ssr.hunger.delivery.dialogs.VkycSlotDialog(getContext()).show();
            }
        });

        btnSos.setOnClickListener(v -> {
            if (getContext() != null) new EmergencySosDialog(getContext()).show();
        });

        btnNotifications.setOnClickListener(v -> {
            startActivity(new Intent(getContext(), NotificationsActivity.class));
        });

        swipeRefresh.setOnRefreshListener(() -> {
            loadPartnerData();
            listenActiveDeliveries();
            listenAvailableOrders();
            setupMap();
            swipeRefresh.setRefreshing(false);
        });
    }

    private void setupMap() {
        if (mMap == null || getContext() == null) return;
        
        mMap.setTileSource(TileSourceFactory.MAPNIK);
        mMap.setMultiTouchControls(true);
        mMap.setTilesScaledToDpi(true);
        mMap.setFlingEnabled(true);
        mMap.setBuiltInZoomControls(false);
        mMap.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        
        // Add 2-finger rotation gestures like Google Maps
        RotationGestureOverlay rotationOverlay = new RotationGestureOverlay(mMap);
        rotationOverlay.setEnabled(true);
        mMap.getOverlays().add(rotationOverlay);

        // Real-time compass needle updater when user rotates the map
        mMap.addMapListener(new org.osmdroid.events.MapListener() {
            @Override
            public boolean onScroll(org.osmdroid.events.ScrollEvent event) {
                if (ivMapCompass != null && mMap != null) {
                    ivMapCompass.setRotation(-mMap.getMapOrientation());
                }
                return false;
            }

            @Override
            public boolean onZoom(org.osmdroid.events.ZoomEvent event) {
                return false;
            }
        });

        IMapController mapController = mMap.getController();
        mapController.setZoom(18.0);
        
        if (ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            return;
        }

        if (driverMarker == null) {
            driverMarker = new Marker(mMap);
            driverMarker.setIcon(ContextCompat.getDrawable(requireContext(), R.drawable.ic_delivery_bike_real));
            driverMarker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER);
            driverMarker.setFlat(true);
            driverMarker.setTitle("Hunger Delivery Rider");
            driverMarker.setSnippet("Tracking active");
            mMap.getOverlays().add(driverMarker);
        }

        if (breadcrumbRoute == null) {
            breadcrumbRoute = new Polyline(mMap);
            breadcrumbRoute.getOutlinePaint().setColor(getResources().getColor(R.color.primary));
            breadcrumbRoute.getOutlinePaint().setStrokeWidth(10f);
            breadcrumbRoute.setPoints(new ArrayList<>());
            mMap.getOverlays().add(breadcrumbRoute);
        }
        
        centerMapOnCurrentLocation();
        startLocationUpdates();
    }

    private void centerMapOnCurrentLocation() {
        if (ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) return;
        fusedLocationClient.getLastLocation().addOnSuccessListener(location -> {
            if (location != null) {
                GeoPoint point = new GeoPoint(location.getLatitude(), location.getLongitude());
                if (mMap != null) {
                    mMap.getController().setZoom(18.0);
                    mMap.getController().animateTo(point);
                }
                updateMapLocation(location);
            }
        });
    }

    private void startLocationUpdates() {
        if (ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) return;
        
        LocationRequest locationRequest = LocationRequest.create();
        locationRequest.setInterval(5000);
        locationRequest.setFastestInterval(2000);
        locationRequest.setPriority(LocationRequest.PRIORITY_HIGH_ACCURACY);

        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult locationResult) {
                if (locationResult == null) return;
                for (Location location : locationResult.getLocations()) {
                    updateMapLocation(location);
                }
            }
        };

        fusedLocationClient.requestLocationUpdates(locationRequest, locationCallback, android.os.Looper.getMainLooper());
    }

    private void updateMapLocation(Location location) {
        this.lastKnownLocation = location;
        GeoPoint point = new GeoPoint(location.getLatitude(), location.getLongitude());
        if (driverMarker != null) {
            GeoPoint startPoint = (GeoPoint) driverMarker.getPosition();
            if (startPoint != null && (startPoint.getLatitude() != 0.0 || startPoint.getLongitude() != 0.0)) {
                animateMarker(driverMarker, startPoint, point, location.getBearing());
            } else {
                driverMarker.setPosition(point);
                driverMarker.setRotation(location.getBearing());
                mMap.invalidate();
            }
        }
        
        if (breadcrumbRoute != null) {
            try {
                breadcrumbPoints.add(point);
                if (breadcrumbPoints.size() > 150) {
                    breadcrumbPoints.remove(0);
                }
                breadcrumbRoute.setPoints(new ArrayList<>(breadcrumbPoints));
            } catch (Exception ignored) {
            }
        }

        // Real-time active order tracking: update route & broadcast live driver location
        if (currentActiveOrder != null) {
            if (activeOrderRoutePolyline != null) {
                List<GeoPoint> currentPoints = activeOrderRoutePolyline.getActualPoints();
                if (currentPoints != null && !currentPoints.isEmpty()) {
                    List<GeoPoint> updatedRoute = new ArrayList<>(currentPoints);
                    updatedRoute.set(0, point);
                    activeOrderRoutePolyline.setPoints(updatedRoute);
                    mMap.invalidate();
                }
            }

            // Sync driver real-time location to Firestore active order doc
            if (db != null && currentActiveOrder.getId() != null) {
                Map<String, Object> liveDriverLoc = new HashMap<>();
                liveDriverLoc.put("driverLatitude", location.getLatitude());
                liveDriverLoc.put("driverLongitude", location.getLongitude());
                liveDriverLoc.put("driverBearing", (double) location.getBearing());
                liveDriverLoc.put("driverUpdatedAt", FieldValue.serverTimestamp());

                db.collection(Constants.COLLECTION_ORDERS)
                        .document(currentActiveOrder.getId())
                        .update(liveDriverLoc);
            }

            // Compute distance to destination
            boolean isToCustomer = Constants.STAGE_PICKED_UP.equalsIgnoreCase(currentActiveOrder.getDeliveryStage())
                    || Constants.STAGE_TO_CUSTOMER.equalsIgnoreCase(currentActiveOrder.getDeliveryStage())
                    || Constants.STAGE_ARRIVED.equalsIgnoreCase(currentActiveOrder.getDeliveryStage());
            double targetLat = isToCustomer ? currentActiveOrder.getDeliveryLatitude() : currentActiveOrder.getRestaurantLatitude();
            double targetLng = isToCustomer ? currentActiveOrder.getDeliveryLongitude() : currentActiveOrder.getRestaurantLongitude();
            String targetName = isToCustomer ? currentActiveOrder.getCustomerName() : currentActiveOrder.getRestaurantName();

            float[] distResults = new float[1];
            Location.distanceBetween(location.getLatitude(), location.getLongitude(), targetLat, targetLng, distResults);
            float distKm = distResults[0] / 1000f;

            if (tvCurrentLocation != null) {
                tvCurrentLocation.setText(String.format(Locale.getDefault(), "🎯 To %s • %.1f km away", targetName, distKm));
            }
        } else {
            try {
                Geocoder geocoder = new Geocoder(getContext(), Locale.getDefault());
                List<Address> addresses = geocoder.getFromLocation(location.getLatitude(), location.getLongitude(), 1);
                if (addresses != null && !addresses.isEmpty()) {
                    String address = addresses.get(0).getAddressLine(0);
                    if (tvCurrentLocation != null) {
                        tvCurrentLocation.setText(address);
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }
    
    private void animateMarker(Marker marker, GeoPoint start, GeoPoint end, float targetBearing) {
        ValueAnimator animator = ValueAnimator.ofFloat(0, 1);
        animator.setDuration(1200);
        animator.setInterpolator(new LinearInterpolator());
        
        float startRotation = marker.getRotation();
        
        // Calculate shortest angular distance to prevent 360-degree spins
        float rawDiff = (targetBearing - startRotation) % 360;
        if (rawDiff > 180) rawDiff -= 360;
        if (rawDiff < -180) rawDiff += 360;
        final float diff = rawDiff;
        
        animator.addUpdateListener(animation -> {
            float v = animation.getAnimatedFraction();
            double lat = start.getLatitude() + (end.getLatitude() - start.getLatitude()) * v;
            double lng = start.getLongitude() + (end.getLongitude() - start.getLongitude()) * v;
            marker.setPosition(new GeoPoint(lat, lng));
            
            float rotation = (startRotation + diff * v + 360) % 360;
            marker.setRotation(rotation);
            
            mMap.invalidate();
        });
        animator.start();
    }

    private void setupAdapters() {
        rvActiveOrders.setLayoutManager(new LinearLayoutManager(getContext()));
        activeOrdersAdapter = new ActiveOrdersAdapter(new ActiveOrdersAdapter.OnActiveOrderClickListener() {
            @Override
            public void onManageOrder(DeliveryOrder order) {
                Intent intent = new Intent(getContext(), OrderActiveDetailActivity.class);
                intent.putExtra(Constants.EXTRA_ORDER_ID, order.getId());
                startActivity(intent);
            }

            @Override
            public void onFocusMapRoute(DeliveryOrder order) {
                focusAndDisplayOrderOnMap(order);
            }

            @Override
            public void onCallOrder(DeliveryOrder order) {
                callOrderContact(order);
            }
        });
        rvActiveOrders.setAdapter(activeOrdersAdapter);

        rvAvailableOrders.setLayoutManager(new LinearLayoutManager(getContext()));
        availableOrdersAdapter = new AvailableOrdersAdapter(new AvailableOrdersAdapter.OnOrderActionListener() {
            @Override
            public void onAccept(DeliveryOrder order) {
                acceptOrder(order);
            }

            @Override
            public void onDecline(DeliveryOrder order) {
                declinedOrderIds.add(order.getId());
                if (getContext() != null) {
                    AnalyticsHelper.getInstance(getContext()).logOrderDeclined(order.getId());
                }
                restartAvailableOrdersListener();
            }
        });
        rvAvailableOrders.setAdapter(availableOrdersAdapter);
    }

    private boolean listenersStarted = false;

    private void loadPartnerData() {
        if (auth.getCurrentUser() == null) return;
        String uid = auth.getCurrentUser().getUid();

        if (partnerListener != null) partnerListener.remove();

        partnerListener = db.collection(Constants.COLLECTION_DELIVERY_PERSONS)
                .document(uid)
                .addSnapshotListener((snapshot, error) -> {
                    if (error != null) {
                        android.util.Log.e("DashboardOrders", "Error loading partner doc: " + error.getMessage(), error);
                    }

                    if (snapshot != null && snapshot.exists()) {
                        partner = snapshot.toObject(DeliveryPartner.class);
                    }
                    if (partner == null) {
                        partner = new DeliveryPartner();
                        partner.setUid(uid);
                        if (auth.getCurrentUser() != null) {
                            if (auth.getCurrentUser().getDisplayName() != null) partner.setName(auth.getCurrentUser().getDisplayName());
                            if (auth.getCurrentUser().getEmail() != null) partner.setEmail(auth.getCurrentUser().getEmail());
                            if (auth.getCurrentUser().getPhoneNumber() != null) partner.setPhone(auth.getCurrentUser().getPhoneNumber());
                        }
                        partner.setAvailable(true);
                        partner.setStatus("online");
                        partner.setKycStatus("approved");
                        partner.setVerificationStatus("approved");
                        partner.setVerified(true);
                    }

                    isOnline = partner.isOnline();
                    updateStatusUI(isOnline);

                    if (!partner.isApproved()) {
                        cardKycWarning.setVisibility(View.VISIBLE);
                    } else {
                        cardKycWarning.setVisibility(View.GONE);
                        if (incomingCallDialog != null && incomingCallDialog.isShowing()) {
                            incomingCallDialog.dismiss();
                        }
                    }

                    listenForIncomingVkycCall(uid);

                    // Only start listeners once on first partner load; subsequent partner updates
                    // (e.g. online/offline toggle) must NOT restart listeners to avoid stream interruption
                    if (!listenersStarted) {
                        listenersStarted = true;
                        listenActiveDeliveries();
                        listenAvailableOrders();
                    } else {
                        // Always re-render after partner data update (pincodes may have changed)
                        rebuildAndRenderAvailableOrders();
                    }
                });
    }

    private void listenForIncomingVkycCall(String uid) {
        if (vkycCallListener != null) vkycCallListener.remove();

        vkycCallListener = db.collection("kycVideoCalls").document(uid)
                .addSnapshotListener((snapshot, error) -> {
                    if (error != null || snapshot == null || !snapshot.exists()) return;

                    String status = snapshot.getString("status");
                    Boolean vkycCompleted = snapshot.getBoolean("vkycCompleted");

                    if ("calling".equalsIgnoreCase(status)) {
                        String adminName = snapshot.getString("adminName");
                        if (adminName == null || adminName.isEmpty()) adminName = "Hunger Admin Desk";
                        showIncomingVkycDialog(uid, adminName);
                    } else if ("completed".equalsIgnoreCase(status) || Boolean.TRUE.equals(vkycCompleted)) {
                        if (incomingCallDialog != null && incomingCallDialog.isShowing()) {
                            incomingCallDialog.dismiss();
                        }
                    } else if ("ended".equalsIgnoreCase(status)) {
                        if (incomingCallDialog != null && incomingCallDialog.isShowing()) {
                            incomingCallDialog.dismiss();
                        }
                    }
                });
    }

    private void showIncomingVkycDialog(String callId, String adminName) {
        if (getContext() == null || getActivity() == null || getActivity().isFinishing()) return;
        if (incomingCallDialog != null && incomingCallDialog.isShowing()) return;

        try {
            androidx.appcompat.app.AlertDialog.Builder builder = new androidx.appcompat.app.AlertDialog.Builder(getContext(), R.style.RoundedDialog);
            View dialogView = LayoutInflater.from(getContext()).inflate(R.layout.dialog_incoming_vkyc_call, null);

            TextView tvCallerName = dialogView.findViewById(R.id.tv_vkyc_caller_name);
            if (tvCallerName != null) tvCallerName.setText(adminName);

            View btnAccept = dialogView.findViewById(R.id.btn_accept_vkyc);
            View btnDecline = dialogView.findViewById(R.id.btn_decline_vkyc);

            builder.setView(dialogView);
            builder.setCancelable(false);
            incomingCallDialog = builder.create();

            if (btnAccept != null) {
                btnAccept.setOnClickListener(v -> {
                    if (incomingCallDialog != null) incomingCallDialog.dismiss();
                    Intent intent = new Intent(getContext(), VkycVideoCallActivity.class);
                    intent.putExtra("callId", callId);
                    intent.putExtra("adminName", adminName);
                    startActivity(intent);
                });
            }

            if (btnDecline != null) {
                btnDecline.setOnClickListener(v -> {
                    if (incomingCallDialog != null) incomingCallDialog.dismiss();
                    db.collection("kycVideoCalls").document(callId).update("status", "declined");
                });
            }

            incomingCallDialog.show();
        } catch (Exception e) {
            // Fallback: direct intent if dialog fails to inflate
            Intent intent = new Intent(getContext(), VkycVideoCallActivity.class);
            intent.putExtra("callId", callId);
            intent.putExtra("adminName", adminName);
            startActivity(intent);
        }
    }

    private void updateStatusUI(boolean online) {
        if (switchOnline != null) switchOnline.setChecked(online);
        if (switchMapOffline != null) switchMapOffline.setChecked(online);

        if (online) {
            // Hide Hero Card, Show Map Section Card
            if (cardStatusHero != null) cardStatusHero.setVisibility(View.GONE);
            if (cardMapSection != null) {
                cardMapSection.setVisibility(View.VISIBLE);
                if (mMap != null) {
                    mMap.onResume();
                    centerMapOnCurrentLocation();
                }
            }

            if (statusIndicator != null) {
                statusIndicator.setBackgroundTintList(android.content.res.ColorStateList.valueOf(getResources().getColor(R.color.veg_green)));
            }
            if (tvStatusTitle != null) {
                tvStatusTitle.setText("ONLINE");
                tvStatusTitle.setTextColor(getResources().getColor(R.color.veg_green));
            }
            if (tvStatusHint != null) {
                tvStatusHint.setText("You are online and actively receiving order broadcast requests.");
            }
            if (tvGpsStatus != null) tvGpsStatus.setText("🛰️ GPS Broadcasting");
            if (tvMapStatusLabel != null) tvMapStatusLabel.setText("ONLINE");
            if (tvEmptyAvailableMessage != null) {
                tvEmptyAvailableMessage.setText("Standing by. New available orders will pop up automatically!");
            }
        } else {
            // Show Hero Card, Hide Map Section Card
            if (cardStatusHero != null) cardStatusHero.setVisibility(View.VISIBLE);
            if (cardMapSection != null) cardMapSection.setVisibility(View.GONE);

            if (statusIndicator != null) {
                statusIndicator.setBackgroundTintList(android.content.res.ColorStateList.valueOf(getResources().getColor(R.color.error)));
            }
            if (tvStatusTitle != null) {
                tvStatusTitle.setText("OFFLINE");
                tvStatusTitle.setTextColor(getResources().getColor(android.R.color.white));
            }
            if (tvStatusHint != null) {
                tvStatusHint.setText("Turn toggle ON to start receiving delivery requests near you.");
            }
            if (tvGpsStatus != null) tvGpsStatus.setText("🛰️ GPS Standby");
            if (tvMapStatusLabel != null) tvMapStatusLabel.setText("OFFLINE");
            if (tvEmptyAvailableMessage != null) {
                tvEmptyAvailableMessage.setText("You are currently offline. Turn switch ON to broadcast your live GPS.");
            }
        }
    }

    private void toggleOnlineStatus() {
        if (auth.getCurrentUser() == null) return;
        String uid = auth.getCurrentUser().getUid();

        if (partner == null) {
            partner = new DeliveryPartner();
            partner.setUid(uid);
            if (auth.getCurrentUser().getDisplayName() != null) partner.setName(auth.getCurrentUser().getDisplayName());
            if (auth.getCurrentUser().getPhoneNumber() != null) partner.setPhone(auth.getCurrentUser().getPhoneNumber());
        }

        boolean targetOnline = !isOnline;

        // V-KYC is only for optional identity verification - never blocks going online or receiving orders
        Map<String, Object> updates = new HashMap<>();
        updates.put("isAvailable", targetOnline);
        updates.put("status", targetOnline ? "online" : "offline");
        updates.put("updatedAt", FieldValue.serverTimestamp());

        // Sync active primary pincode and all service pincodes
        List<String> activePincodes = new ArrayList<>();
        if (partner.getPincode() != null && partner.getPincode().trim().matches("\\d{6}")) {
            activePincodes.add(partner.getPincode().trim());
        }
        if (partner.getServicePincodes() != null) {
            for (String p : partner.getServicePincodes()) {
                if (p != null) {
                    String cp = p.trim();
                    if (cp.matches("\\d{6}") && !activePincodes.contains(cp)) {
                        activePincodes.add(cp);
                    }
                }
            }
        }
        if (!activePincodes.isEmpty()) {
            updates.put("servicePincodes", activePincodes);
            if (partner.getPincode() != null && !partner.getPincode().trim().isEmpty()) {
                updates.put("pincode", partner.getPincode().trim());
            }
        }

        isOnline = targetOnline;
        partner.setAvailable(targetOnline);
        partner.setStatus(targetOnline ? "online" : "offline");
        updateStatusUI(targetOnline);

        db.collection(Constants.COLLECTION_DELIVERY_PERSONS)
                .document(uid)
                .set(updates, SetOptions.merge())
                .addOnSuccessListener(v -> {
                    Context ctx = getContext();
                    if (ctx != null) {
                        AnalyticsHelper.getInstance(ctx).logDriverStatus(targetOnline);
                    }
                    if (targetOnline) {
                        if (ctx != null) DriverLocationService.startTracking(ctx, uid, null, false);
                        String pinMsg = !activePincodes.isEmpty() ? " | Pincodes: " + String.join(", ", activePincodes) : "";
                        showToast("🟢 You are now ONLINE" + pinMsg);
                    } else {
                        if (ctx != null) DriverLocationService.stopTracking(ctx);
                        showToast("🔴 You are now OFFLINE");
                    }
                    restartAvailableOrdersListener();
                })
                .addOnFailureListener(e -> {
                    showToast("Failed to update status");
                    if (switchOnline != null) switchOnline.setChecked(isOnline);
                    if (switchMapOffline != null) switchMapOffline.setChecked(isOnline);
                });
    }

    private synchronized void mergeAndRenderActiveOrders() {
        rawActiveOrdersMap.clear();
        rawActiveOrdersMap.putAll(optimisticActiveOrdersMap);
        rawActiveOrdersMap.putAll(activeOrdersByPersonMap);
        rawActiveOrdersMap.putAll(activeOrdersByDriverMap);
        rawActiveOrdersMap.putAll(activeOrdersByPartnerMap);
        rebuildAndRenderActiveOrders();
    }

    private synchronized void rebuildAndRenderActiveOrders() {
        if (getContext() == null || getActivity() == null) return;

        List<DeliveryOrder> activeList = new ArrayList<>(rawActiveOrdersMap.values());

        // Sort newest first
        Collections.sort(activeList, (a, b) -> {
            long tA = a.getAcceptedAt() != null ? a.getAcceptedAt().getTime()
                    : (a.getCreatedAt() != null ? a.getCreatedAt().getTime() : 0);
            long tB = b.getAcceptedAt() != null ? b.getAcceptedAt().getTime()
                    : (b.getCreatedAt() != null ? b.getCreatedAt().getTime() : 0);
            return Long.compare(tB, tA);
        });

        if (getActivity() != null) {
            getActivity().runOnUiThread(() -> {
                if (activeList.isEmpty()) {
                    if (layoutActiveSection != null) layoutActiveSection.setVisibility(View.GONE);
                    clearActiveOrderFromMap();
                } else {
                    if (layoutActiveSection != null) layoutActiveSection.setVisibility(View.VISIBLE);
                    if (tvActiveCount != null) tvActiveCount.setText(activeList.size() + " active");
                    if (activeOrdersAdapter != null) activeOrdersAdapter.setOrders(activeList);

                    DeliveryOrder topActive = activeList.get(0);
                    displayActiveOrderOnMap(topActive);
                    Context ctx = getContext();
                    if (ctx != null) {
                        DriverLocationService.updateActiveOrder(ctx, topActive.getId(), true);
                    }
                }
            });
        }
    }

    private void listenActiveDeliveries() {
        if (auth.getCurrentUser() == null) return;
        String uid = auth.getCurrentUser().getUid();

        if (activeOrdersListener != null) activeOrdersListener.remove();
        if (activeDriverIdListener != null) activeDriverIdListener.remove();
        if (activePartnerIdListener != null) activePartnerIdListener.remove();

        // 1. Primary query: deliveryPersonId == uid
        activeOrdersListener = db.collection(Constants.COLLECTION_ORDERS)
                .whereEqualTo("deliveryPersonId", uid)
                .addSnapshotListener((snapshot, error) -> {
                    if (error != null) {
                        android.util.Log.e("DashboardOrders", "Error activeOrdersListener: " + error.getMessage(), error);
                        return;
                    }
                    if (snapshot == null) return;
                    activeOrdersByPersonMap.clear();
                    for (com.google.firebase.firestore.DocumentSnapshot doc : snapshot.getDocuments()) {
                        DeliveryOrder o = DeliveryOrder.parseSnapshot(doc);
                        if (o != null) {
                            String st = o.getStatus() != null ? o.getStatus().trim().toLowerCase() : "";
                            if (!"delivered".equals(st) && !"cancelled".equals(st) && !"completed".equals(st) && !"refunded".equals(st)) {
                                activeOrdersByPersonMap.put(o.getId(), o);
                                optimisticActiveOrdersMap.remove(o.getId()); // Confirmed from Firestore
                            }
                        }
                    }
                    mergeAndRenderActiveOrders();
                });

        // 2. Cross-platform compatibility: driverId == uid
        activeDriverIdListener = db.collection(Constants.COLLECTION_ORDERS)
                .whereEqualTo("driverId", uid)
                .addSnapshotListener((snapshot, error) -> {
                    if (error != null || snapshot == null) return;
                    activeOrdersByDriverMap.clear();
                    for (com.google.firebase.firestore.DocumentSnapshot doc : snapshot.getDocuments()) {
                        DeliveryOrder o = DeliveryOrder.parseSnapshot(doc);
                        if (o != null) {
                            String st = o.getStatus() != null ? o.getStatus().trim().toLowerCase() : "";
                            if (!"delivered".equals(st) && !"cancelled".equals(st) && !"completed".equals(st) && !"refunded".equals(st)) {
                                activeOrdersByDriverMap.put(o.getId(), o);
                                optimisticActiveOrdersMap.remove(o.getId());
                            }
                        }
                    }
                    mergeAndRenderActiveOrders();
                });

        // 3. Cross-platform compatibility: deliveryPartnerId == uid
        activePartnerIdListener = db.collection(Constants.COLLECTION_ORDERS)
                .whereEqualTo("deliveryPartnerId", uid)
                .addSnapshotListener((snapshot, error) -> {
                    if (error != null || snapshot == null) return;
                    activeOrdersByPartnerMap.clear();
                    for (com.google.firebase.firestore.DocumentSnapshot doc : snapshot.getDocuments()) {
                        DeliveryOrder o = DeliveryOrder.parseSnapshot(doc);
                        if (o != null) {
                            String st = o.getStatus() != null ? o.getStatus().trim().toLowerCase() : "";
                            if (!"delivered".equals(st) && !"cancelled".equals(st) && !"completed".equals(st) && !"refunded".equals(st)) {
                                activeOrdersByPartnerMap.put(o.getId(), o);
                                optimisticActiveOrdersMap.remove(o.getId());
                            }
                        }
                    }
                    mergeAndRenderActiveOrders();
                });
    }

    private boolean isOrderAvailable(DeliveryOrder o) {
        if (o == null) return false;
        String status = o.getStatus() != null ? o.getStatus().trim().toLowerCase() : "";

        // Terminal statuses or in-transit
        if ("delivered".equals(status) || "cancelled".equals(status) || "completed".equals(status)
                || "refunded".equals(status) || "returned_to_restaurant".equals(status)
                || "out_for_delivery".equals(status)) {
            return false;
        }

        // Must not be claimed by another delivery partner
        String riderId = o.getDeliveryPersonId();
        if (riderId != null) {
            String tr = riderId.trim();
            if (!tr.isEmpty()
                    && !"null".equalsIgnoreCase(tr)
                    && !"undefined".equalsIgnoreCase(tr)
                    && !"unassigned".equalsIgnoreCase(tr)
                    && !"none".equalsIgnoreCase(tr)
                    && !"pending".equalsIgnoreCase(tr)) {
                return false; // Already claimed by another partner
            }
        }

        // Skip orders declined locally in this session
        if (declinedOrderIds.contains(o.getId())) {
            return false;
        }

        return true;
    }

    private void listenAvailableOrders() {
        if (availableOrdersListener != null) availableOrdersListener.remove();
        if (broadcastOrdersListener != null) broadcastOrdersListener.remove();
        if (fallbackOrdersListener != null) fallbackOrdersListener.remove();

        // 1. Primary Live Query: waiting orders by status (Single-field whereIn index, instant and no composite index needed)
        try {
            availableOrdersListener = db.collection(Constants.COLLECTION_ORDERS)
                    .whereIn("status", Arrays.asList("pending", "placed", "confirmed", "preparing", "food_ready", "ready"))
                    .limit(50)
                    .addSnapshotListener((snapshot, error) -> {
                        if (error != null) {
                            android.util.Log.e("DashboardOrders", "Primary status listener error: " + error.getMessage(), error);
                            return;
                        }
                        if (snapshot == null) return;
                        for (com.google.firebase.firestore.DocumentChange dc : snapshot.getDocumentChanges()) {
                            String docId = dc.getDocument().getId();
                            if (dc.getType() == com.google.firebase.firestore.DocumentChange.Type.REMOVED) {
                                rawAvailableOrdersMap.remove(docId);
                            } else {
                                DeliveryOrder o = DeliveryOrder.parseSnapshot(dc.getDocument());
                                if (o != null) {
                                    if (isOrderAvailable(o)) {
                                        rawAvailableOrdersMap.put(o.getId(), o);
                                    } else {
                                        rawAvailableOrdersMap.remove(o.getId());
                                    }
                                }
                            }
                        }
                        rebuildAndRenderAvailableOrders();
                    });
        } catch (Exception e) {
            android.util.Log.e("DashboardOrders", "Error initiating primary available listener: " + e.getMessage(), e);
        }

        // 2. Broadcast Verified Query: restaurant-pushed broadcast orders
        try {
            broadcastOrdersListener = db.collection(Constants.COLLECTION_ORDERS)
                    .whereEqualTo("broadcastVerified", true)
                    .limit(50)
                    .addSnapshotListener((snapshot, error) -> {
                        if (error != null || snapshot == null) return;
                        for (com.google.firebase.firestore.DocumentChange dc : snapshot.getDocumentChanges()) {
                            String docId = dc.getDocument().getId();
                            if (dc.getType() == com.google.firebase.firestore.DocumentChange.Type.REMOVED) {
                                rawAvailableOrdersMap.remove(docId);
                            } else {
                                DeliveryOrder o = DeliveryOrder.parseSnapshot(dc.getDocument());
                                if (o != null) {
                                    if (isOrderAvailable(o)) {
                                        rawAvailableOrdersMap.put(o.getId(), o);
                                    } else {
                                        rawAvailableOrdersMap.remove(o.getId());
                                    }
                                }
                            }
                        }
                        rebuildAndRenderAvailableOrders();
                    });
        } catch (Exception e) {
            android.util.Log.e("DashboardOrders", "Error initiating broadcastVerified listener: " + e.getMessage(), e);
        }

        // 3. Fallback Query: recent orders sorted by createdAt descending
        try {
            fallbackOrdersListener = db.collection(Constants.COLLECTION_ORDERS)
                    .orderBy("createdAt", com.google.firebase.firestore.Query.Direction.DESCENDING)
                    .limit(30)
                    .addSnapshotListener((snapshot, error) -> {
                        if (error != null || snapshot == null) return;
                        for (com.google.firebase.firestore.DocumentChange dc : snapshot.getDocumentChanges()) {
                            String docId = dc.getDocument().getId();
                            if (dc.getType() == com.google.firebase.firestore.DocumentChange.Type.REMOVED) {
                                rawAvailableOrdersMap.remove(docId);
                            } else {
                                DeliveryOrder o = DeliveryOrder.parseSnapshot(dc.getDocument());
                                if (o != null) {
                                    if (isOrderAvailable(o)) {
                                        rawAvailableOrdersMap.put(o.getId(), o);
                                    } else {
                                        rawAvailableOrdersMap.remove(o.getId());
                                    }
                                }
                            }
                        }
                        rebuildAndRenderAvailableOrders();
                    });
        } catch (Exception e) {
            android.util.Log.e("DashboardOrders", "Error initiating fallback listener: " + e.getMessage(), e);
        }
    }

    private void rebuildAndRenderAvailableOrders() {
        if (getActivity() == null) return;
        getActivity().runOnUiThread(this::rebuildAndRenderAvailableOrdersOnUiThread);
    }

    private synchronized void rebuildAndRenderAvailableOrdersOnUiThread() {
        if (getContext() == null || getActivity() == null) return;
        String myUid = auth.getCurrentUser() != null ? auth.getCurrentUser().getUid() : "";

        List<DeliveryOrder> availableList = new ArrayList<>();
        for (DeliveryOrder o : rawAvailableOrdersMap.values()) {
            if (!isOrderAvailable(o)) continue;

            // Target Delivery filtering:
            // If targetDeliveryIds is specified, allow if empty (broadcast to all) OR if contains myUid
            if (o.getTargetDeliveryIds() != null && !o.getTargetDeliveryIds().isEmpty() && !myUid.isEmpty()) {
                if (!o.getTargetDeliveryIds().contains(myUid) && !o.isBroadcastVerified()) {
                    continue;
                }
            }

            // Pincode matching: ONLY filter if partner has explicitly configured custom service pincodes
            // (Do NOT use partner's home registration pincode to block city orders!)
            if (partner != null && partner.getServicePincodes() != null && !partner.getServicePincodes().isEmpty() && !o.isBroadcastVerified()) {
                Set<String> driverPincodes = new HashSet<>();
                for (String p : partner.getServicePincodes()) {
                    if (p != null) {
                        String cp = p.trim();
                        if (cp.matches("\\d{6}")) {
                            driverPincodes.add(cp);
                        }
                    }
                }

                if (!driverPincodes.isEmpty()) {
                    String custPin = o.getDeliveryAddressPincode() != null ? o.getDeliveryAddressPincode().trim() : "";
                    String restPin = o.getRestaurantPincode() != null ? o.getRestaurantPincode().trim() : "";

                    Set<String> orderPins = new HashSet<>();
                    if (custPin.matches("\\d{6}")) orderPins.add(custPin);
                    if (restPin.matches("\\d{6}")) orderPins.add(restPin);
                    extractPincodesFromText(o.getFullDeliveryAddress(), orderPins);
                    extractPincodesFromText(o.getRestaurantAddress(), orderPins);

                    if (!orderPins.isEmpty()) {
                        boolean matches = false;
                        for (String dp : driverPincodes) {
                            if (orderPins.contains(dp)) {
                                matches = true;
                                break;
                            }
                        }
                        if (!matches) {
                            // If order restaurant is within 25 km of driver current GPS location, still allow it
                            boolean withinGpsDistance = false;
                            Location loc = lastKnownLocation;
                            if (loc != null && o.getRestaurantLatitude() != 0 && o.getRestaurantLongitude() != 0) {
                                double km = LocationUtils.calculateDistanceKm(
                                        loc.getLatitude(), loc.getLongitude(),
                                        o.getRestaurantLatitude(), o.getRestaurantLongitude());
                                if (km <= 25.0) withinGpsDistance = true;
                            }
                            if (!withinGpsDistance) continue;
                        }
                    }
                }
            }

            availableList.add(o);
        }

        // Sort orders newest first
        Collections.sort(availableList, (a, b) -> {
            long tA = a.getCreatedAt() != null ? a.getCreatedAt().getTime() : 0;
            long tB = b.getCreatedAt() != null ? b.getCreatedAt().getTime() : 0;
            return Long.compare(tB, tA);
        });

        if (availableList.isEmpty()) {
            layoutEmptyAvailable.setVisibility(View.VISIBLE);
            rvAvailableOrders.setVisibility(View.GONE);
            tvAvailableCount.setText("0 waiting");
            if (tvEmptyAvailableMessage != null) {
                if (isOnline) {
                    tvEmptyAvailableMessage.setText("Standing by. New available orders will pop up automatically!");
                } else {
                    tvEmptyAvailableMessage.setText("No orders waiting right now. Turn switch ON to broadcast your live GPS.");
                }
            }
        } else {
            layoutEmptyAvailable.setVisibility(View.GONE);
            rvAvailableOrders.setVisibility(View.VISIBLE);
            tvAvailableCount.setText(availableList.size() + " waiting");
            availableOrdersAdapter.setOrders(availableList);

            DeliveryOrder top = availableList.get(0);
            if (!top.getId().equals(lastTopOrderId)) {
                lastTopOrderId = top.getId();
                if (getContext() != null) SoundHelper.playNewOrderAlert(getContext());
                if (isOnline && (activeAcceptDialog == null || !activeAcceptDialog.isShowing()) && !declinedOrderIds.contains(top.getId())) {
                    showAcceptOrderDialog(top);
                }
            }
        }
    }

    public void highlightOrAcceptIncomingOrder(String orderId) {
        if (orderId == null || orderId.trim().isEmpty() || db == null) return;
        String cleanId = orderId.trim();

        // Check if already in active deliveries:
        if (currentActiveOrder != null && cleanId.equals(currentActiveOrder.getId())) {
            focusAndDisplayOrderOnMap(currentActiveOrder);
            return;
        }

        // Fetch fresh document directly from Firestore
        db.collection(Constants.COLLECTION_ORDERS).document(cleanId).get().addOnSuccessListener(doc -> {
            if (doc != null && doc.exists()) {
                DeliveryOrder o = DeliveryOrder.parseSnapshot(doc);
                if (o != null) {
                    String riderId = o.getDeliveryPersonId();
                    String myUid = auth.getCurrentUser() != null ? auth.getCurrentUser().getUid() : "";

                    // If already accepted by me, focus on active
                    if (myUid.equals(riderId)) {
                        optimisticActiveOrdersMap.put(o.getId(), o);
                        mergeAndRenderActiveOrders();
                        displayActiveOrderOnMap(o);
                        return;
                    }

                    // Put in available orders and re-render
                    rawAvailableOrdersMap.put(o.getId(), o);
                    rebuildAndRenderAvailableOrders();

                    // Scroll down to available orders section
                    if (nestedScrollView != null && rvAvailableOrders != null) {
                        nestedScrollView.smoothScrollTo(0, rvAvailableOrders.getTop());
                    }

                    // Play alert sound
                    if (getContext() != null) {
                        SoundHelper.playNewOrderAlert(getContext());
                    }

                    // Show accept dialog directly
                    showAcceptOrderDialog(o);
                }
            }
        }).addOnFailureListener(e -> android.util.Log.e("DashboardOrders", "Error fetching direct order: " + e.getMessage(), e));
    }

    private void showAcceptOrderDialog(DeliveryOrder order) {
        if (getContext() == null || getActivity() == null || getActivity().isFinishing() || order == null) return;
        if (activeAcceptDialog != null && activeAcceptDialog.isShowing()) {
            return; // Prevent duplicate dialogs
        }
        try {
            android.app.AlertDialog.Builder builder = new android.app.AlertDialog.Builder(getContext());
            View dialogView = LayoutInflater.from(getContext()).inflate(R.layout.dialog_new_order_request, null);
            builder.setView(dialogView);
            builder.setCancelable(true);
            android.app.AlertDialog dialog = builder.create();
            if (dialog.getWindow() != null) {
                dialog.getWindow().setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(android.graphics.Color.TRANSPARENT));
                dialog.getWindow().setLayout(
                        (int) (getResources().getDisplayMetrics().widthPixels * 0.92),
                        android.view.ViewGroup.LayoutParams.WRAP_CONTENT
                );
            }

            // Bind order ID
            TextView tvOrderId = dialogView.findViewById(R.id.tv_new_order_id);
            if (tvOrderId != null) tvOrderId.setText(order.getFormattedOrderId());

            // Bind earning
            TextView tvEarning = dialogView.findViewById(R.id.tv_new_order_earning);
            if (tvEarning != null) tvEarning.setText(com.ssr.hunger.delivery.utils.LocationUtils.formatCurrency(order.getEstimatedEarning()));

            // Bind restaurant
            TextView tvRestaurant = dialogView.findViewById(R.id.tv_new_order_restaurant);
            if (tvRestaurant != null) tvRestaurant.setText(order.getRestaurantName());
            TextView tvRestaurantAddr = dialogView.findViewById(R.id.tv_new_order_restaurant_addr);
            if (tvRestaurantAddr != null) {
                String rAddr = order.getRestaurantAddress();
                tvRestaurantAddr.setText(rAddr != null && !rAddr.isEmpty() ? rAddr : order.getRestaurantName());
            }

            // Bind customer drop
            TextView tvCustomer = dialogView.findViewById(R.id.tv_new_order_customer);
            if (tvCustomer != null) tvCustomer.setText(order.getCustomerName());
            TextView tvDropAddr = dialogView.findViewById(R.id.tv_new_order_drop_addr);
            if (tvDropAddr != null) {
                String drop = order.getDeliveryLocality() != null && !order.getDeliveryLocality().isEmpty()
                        ? order.getDeliveryLocality() : order.getFullDeliveryAddress();
                tvDropAddr.setText(drop);
            }

            // Bind ordered items
            TextView tvItems = dialogView.findViewById(R.id.tv_new_order_items);
            if (tvItems != null) {
                tvItems.setText(order.getItemsSummary());
            }

            // Bind distance
            TextView tvDistance = dialogView.findViewById(R.id.tv_new_order_distance);
            if (tvDistance != null) {
                if (order.getRestaurantLatitude() != 0 && order.getDeliveryLatitude() != 0) {
                    double distKm = com.ssr.hunger.delivery.utils.LocationUtils.calculateDistanceKm(
                            order.getRestaurantLatitude(), order.getRestaurantLongitude(),
                            order.getDeliveryLatitude(), order.getDeliveryLongitude());
                    tvDistance.setText(com.ssr.hunger.delivery.utils.LocationUtils.formatDistance(distKm));
                } else {
                    tvDistance.setText("N/A");
                }
            }

            // Bind payment
            TextView tvPayment = dialogView.findViewById(R.id.tv_new_order_payment);
            if (tvPayment != null) {
                boolean isCod = "cod".equalsIgnoreCase(order.getPaymentMethod());
                tvPayment.setText(isCod ? "COD" : "Online");
            }

            // Bind total
            TextView tvTotal = dialogView.findViewById(R.id.tv_new_order_total);
            if (tvTotal != null) {
                double t = order.getTotal() > 0 ? order.getTotal() : order.getSubtotal();
                tvTotal.setText(com.ssr.hunger.delivery.utils.LocationUtils.formatCurrency(t));
            }

            // Ignore button
            View btnIgnore = dialogView.findViewById(R.id.btn_new_order_ignore);
            if (btnIgnore != null) {
                btnIgnore.setOnClickListener(v -> dialog.dismiss());
            }

            // Accept Now button
            View btnAccept = dialogView.findViewById(R.id.btn_new_order_accept);
            if (btnAccept != null) {
                btnAccept.setOnClickListener(v -> {
                    dialog.dismiss();
                    acceptOrder(order);
                });
            }

            dialog.setOnDismissListener(d -> {
                if (activeAcceptDialog == dialog) {
                    activeAcceptDialog = null;
                }
            });
            activeAcceptDialog = dialog;
            dialog.show();
        } catch (Exception e) {
            // Fallback to plain dialog
            Context ctx = getContext();
            if (ctx != null && getActivity() != null && !getActivity().isFinishing()) {
                new androidx.appcompat.app.AlertDialog.Builder(ctx)
                        .setTitle("🛵 New Delivery Request!")
                        .setMessage("Restaurant: " + order.getRestaurantName()
                                + "\nEarning: ₹" + String.format(Locale.getDefault(), "%.0f", order.getEstimatedEarning()))
                        .setPositiveButton("Accept Now", (d, w) -> acceptOrder(order))
                        .setNegativeButton("Ignore", null)
                        .show();
            }
        }
    }

    private void extractPincodesFromText(String text, Set<String> set) {
        if (text == null || text.isEmpty()) return;
        java.util.regex.Matcher matcher = java.util.regex.Pattern.compile("\\b[1-9]\\d{5}\\b").matcher(text);
        while (matcher.find()) {
            set.add(matcher.group());
        }
    }

    private void stopAvailableOrdersListener() {
        if (availableOrdersListener != null) {
            availableOrdersListener.remove();
            availableOrdersListener = null;
        }
        if (broadcastOrdersListener != null) {
            broadcastOrdersListener.remove();
            broadcastOrdersListener = null;
        }
        if (fallbackOrdersListener != null) {
            fallbackOrdersListener.remove();
            fallbackOrdersListener = null;
        }
    }

    private void restartAvailableOrdersListener() {
        listenAvailableOrders();
    }

    private void acceptOrder(DeliveryOrder order) {
        if (auth.getCurrentUser() == null) return;
        String uid = auth.getCurrentUser().getUid();

        if (partner == null) {
            partner = new DeliveryPartner();
            partner.setUid(uid);
            if (auth.getCurrentUser().getDisplayName() != null) partner.setName(auth.getCurrentUser().getDisplayName());
            if (auth.getCurrentUser().getPhoneNumber() != null) partner.setPhone(auth.getCurrentUser().getPhoneNumber());
        }

        // Any delivery partner can accept and deliver orders - VKYC is solely for identity verification
        // If rider was offline when accepting, automatically transition to online
        if (!isOnline) {
            isOnline = true;
            partner.setAvailable(true);
            partner.setStatus("online");
            updateStatusUI(true);
            Map<String, Object> onlineUpdate = new HashMap<>();
            onlineUpdate.put("isAvailable", true);
            onlineUpdate.put("status", "online");
            onlineUpdate.put("updatedAt", FieldValue.serverTimestamp());
            db.collection(Constants.COLLECTION_DELIVERY_PERSONS)
                    .document(uid)
                    .set(onlineUpdate, SetOptions.merge());
            if (getContext() != null) {
                DriverLocationService.startTracking(getContext(), uid, order.getId(), true);
            }
        }

        String pName = (partner != null && partner.getName() != null && !partner.getName().trim().isEmpty())
                ? partner.getName().trim() : (auth.getCurrentUser().getDisplayName() != null ? auth.getCurrentUser().getDisplayName() : "Delivery Partner");
        String pPhone = (partner != null && partner.getPhone() != null && !partner.getPhone().trim().isEmpty())
                ? partner.getPhone().trim() : (auth.getCurrentUser().getPhoneNumber() != null ? auth.getCurrentUser().getPhoneNumber() : "");

        com.google.firebase.firestore.DocumentReference orderRef = db.collection(Constants.COLLECTION_ORDERS).document(order.getId());

        db.runTransaction(transaction -> {
            com.google.firebase.firestore.DocumentSnapshot snapshot = transaction.get(orderRef);
            if (!snapshot.exists()) {
                throw new com.google.firebase.firestore.FirebaseFirestoreException(
                        "Order no longer exists",
                        com.google.firebase.firestore.FirebaseFirestoreException.Code.NOT_FOUND
                );
            }

            String currentDeliveryPersonId = snapshot.getString("deliveryPersonId");
            if (currentDeliveryPersonId == null) currentDeliveryPersonId = snapshot.getString("driverId");
            if (currentDeliveryPersonId == null) currentDeliveryPersonId = snapshot.getString("deliveryPartnerId");

            boolean isClaimed = currentDeliveryPersonId != null
                    && !currentDeliveryPersonId.trim().isEmpty()
                    && !"null".equalsIgnoreCase(currentDeliveryPersonId.trim())
                    && !"undefined".equalsIgnoreCase(currentDeliveryPersonId.trim())
                    && !"unassigned".equalsIgnoreCase(currentDeliveryPersonId.trim())
                    && !"none".equalsIgnoreCase(currentDeliveryPersonId.trim())
                    && !"pending".equalsIgnoreCase(currentDeliveryPersonId.trim());

            if (isClaimed && !currentDeliveryPersonId.trim().equals(uid)) {
                throw new com.google.firebase.firestore.FirebaseFirestoreException(
                        "Order already accepted by another partner",
                        com.google.firebase.firestore.FirebaseFirestoreException.Code.ABORTED
                );
            }

            String currentStatus = snapshot.getString("status");
            if (currentStatus != null) {
                String s = currentStatus.trim().toLowerCase();
                if ("delivered".equals(s) || "cancelled".equals(s) || "completed".equals(s) || "refunded".equals(s)) {
                    throw new com.google.firebase.firestore.FirebaseFirestoreException(
                            "Order is no longer available",
                            com.google.firebase.firestore.FirebaseFirestoreException.Code.ABORTED
                    );
                }
            }

            Map<String, Object> updates = new HashMap<>();
            updates.put("deliveryPersonId", uid);
            updates.put("driverId", uid);
            updates.put("deliveryPartnerId", uid);
            updates.put("deliveryPersonName", pName);
            updates.put("driverName", pName);
            updates.put("deliveryPersonPhone", pPhone);
            updates.put("driverPhone", pPhone);
            updates.put("status", Constants.STATUS_OUT_FOR_DELIVERY);
            updates.put("deliveryStage", Constants.STAGE_TO_RESTAURANT);
            updates.put("deliveryStatus", "going_to_restaurant");
            updates.put("acceptedAt", FieldValue.serverTimestamp());
            updates.put("updatedAt", FieldValue.serverTimestamp());
            transaction.update(orderRef, updates);
            return null;
        }).addOnSuccessListener(v -> {
            Context ctx = getContext();
            if (ctx != null) {
                AnalyticsHelper.getInstance(ctx).logOrderAccepted(order.getId(), order.getRestaurantName(), order.getEstimatedEarning());
                DriverLocationService.startTracking(ctx, uid, order.getId(), true);
            }

            // Immediately remove from available list so card vanishes instantly
            rawAvailableOrdersMap.remove(order.getId());
            rebuildAndRenderAvailableOrders();

            // Immediately show accepted order in the Active Deliveries section
            order.setStatus(Constants.STATUS_OUT_FOR_DELIVERY);
            order.setDeliveryStage(Constants.STAGE_TO_RESTAURANT);
            order.setDeliveryStatus("going_to_restaurant");
            order.setDeliveryPersonId(uid);
            order.setDeliveryPersonName(pName);
            order.setDeliveryPersonPhone(pPhone);
            optimisticActiveOrdersMap.put(order.getId(), order);
            mergeAndRenderActiveOrders();

            displayActiveOrderOnMap(order);

            // Scroll to top so the active order hero card is immediately at the top of the viewport
            if (nestedScrollView != null) {
                nestedScrollView.post(() -> nestedScrollView.smoothScrollTo(0, 0));
            }

            showToast("🎉 Order Accepted! Head to " + order.getRestaurantName() + " for pickup.", Toast.LENGTH_LONG);
        }).addOnFailureListener(e -> {
            String msg = (e.getMessage() != null && e.getMessage().contains("already accepted"))
                    ? "Order has already been accepted by another partner."
                    : "Failed to accept order: " + e.getMessage();
            showToast(msg, Toast.LENGTH_LONG);
            restartAvailableOrdersListener();
        });
    }

    public void displayActiveOrderOnMap(DeliveryOrder order) {
        if (order == null || mMap == null || getContext() == null) return;
        this.currentActiveOrder = order;

        // Ensure Map is visible and active
        if (cardMapSection != null) cardMapSection.setVisibility(View.VISIBLE);
        if (cardStatusHero != null) cardStatusHero.setVisibility(View.GONE);
        mMap.onResume();

        // 1. If order is already in customer drop-off stage, show customer route
        boolean isHeadingToCustomer = Constants.STAGE_PICKED_UP.equalsIgnoreCase(order.getDeliveryStage())
                || Constants.STAGE_TO_CUSTOMER.equalsIgnoreCase(order.getDeliveryStage())
                || Constants.STAGE_ARRIVED.equalsIgnoreCase(order.getDeliveryStage());
        if (isHeadingToCustomer) {
            showCustomerRoute(order);
            showSwipePanel(order);
            return;
        }

        // 2. Determine Origin: Delivery Partner's Current Location
        GeoPoint driverPoint = null;
        if (driverMarker != null && driverMarker.getPosition() != null) {
            GeoPoint dPos = (GeoPoint) driverMarker.getPosition();
            if (dPos.getLatitude() != 0.0 || dPos.getLongitude() != 0.0) {
                driverPoint = dPos;
            }
        }
        if (driverPoint == null && fusedLocationClient != null) {
            try {
                if (ActivityCompat.checkSelfPermission(requireContext(), Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                    fusedLocationClient.getLastLocation().addOnSuccessListener(loc -> {
                        if (loc != null) {
                            updateMapLocation(loc);
                        }
                    });
                }
            } catch (Exception ignored) {
            }
        }

        // 3. ALWAYS display the swipe button, HUD info and call action immediately
        showSwipePanel(order);
        showScanAnimation("📡 Locating Restaurant...");

        if (tvCurrentLocation != null) {
            tvCurrentLocation.setText("🚴 En route to " + (order.getRestaurantName() != null ? order.getRestaurantName() : "Restaurant"));
        }
        if (btnMapCallAction != null) {
            btnMapCallAction.setVisibility(View.VISIBLE);
            btnMapCallAction.setOnClickListener(v -> callOrderContact(order));
        }
        if (tvMapCallLabel != null) {
            tvMapCallLabel.setText("Call Restaurant");
        }

        // 4. Destination: Restaurant Location
        GeoPoint restPoint = null;
        if (order.getRestaurantLatitude() != 0.0 && order.getRestaurantLongitude() != 0.0) {
            restPoint = new GeoPoint(order.getRestaurantLatitude(), order.getRestaurantLongitude());
        }

        // If restaurant coordinates are not yet embedded in order, resolve them from Firestore restaurants collection
        if (restPoint == null) {
            if (order.getRestaurantId() != null && !order.getRestaurantId().trim().isEmpty()) {
                db.collection(Constants.COLLECTION_RESTAURANTS)
                        .document(order.getRestaurantId().trim())
                        .get()
                        .addOnSuccessListener(resDoc -> {
                            if (resDoc != null && resDoc.exists()) {
                                Double rLat = resDoc.getDouble("latitude");
                                Double rLng = resDoc.getDouble("longitude");
                                if (rLat == null || rLng == null) {
                                    Object locObj = resDoc.get("location");
                                    if (locObj instanceof Map) {
                                        Map<?, ?> lm = (Map<?, ?>) locObj;
                                        Object latVal = lm.get("lat") != null ? lm.get("lat") : lm.get("latitude");
                                        Object lngVal = lm.get("lng") != null ? lm.get("lng") : (lm.get("longitude") != null ? lm.get("longitude") : lm.get("lon"));
                                        if (latVal instanceof Number) rLat = ((Number) latVal).doubleValue();
                                        else if (latVal != null) {
                                            try { rLat = Double.parseDouble(latVal.toString().trim()); } catch (Exception ignored) {}
                                        }
                                        if (lngVal instanceof Number) rLng = ((Number) lngVal).doubleValue();
                                        else if (lngVal != null) {
                                            try { rLng = Double.parseDouble(lngVal.toString().trim()); } catch (Exception ignored) {}
                                        }
                                    }
                                }
                                if (rLat != null && rLng != null && rLat != 0.0 && rLng != 0.0) {
                                    order.setRestaurantLatitude(rLat);
                                    order.setRestaurantLongitude(rLng);
                                    if (getActivity() != null) {
                                        getActivity().runOnUiThread(() -> displayActiveOrderOnMap(order));
                                    }
                                }
                            }
                        })
                        .addOnFailureListener(e -> android.util.Log.w("DashboardOrders", "Restaurant coord resolve: " + e.getMessage()));
            }

            // Center on rider position or customer drop point while restaurant pin loads
            if (driverPoint != null) {
                mMap.getController().animateTo(driverPoint);
                mMap.getController().setZoom(17.0);
            } else if (order.getDeliveryLatitude() != 0.0 && order.getDeliveryLongitude() != 0.0) {
                mMap.getController().animateTo(new GeoPoint(order.getDeliveryLatitude(), order.getDeliveryLongitude()));
                mMap.getController().setZoom(16.5);
            }
            mMap.invalidate();
            return;
        }

        if (driverPoint == null) {
            driverPoint = new GeoPoint(restPoint.getLatitude() - 0.008, restPoint.getLongitude() - 0.008);
        }

        // 5. Driver Marker
        if (driverMarker == null) {
            driverMarker = new Marker(mMap);
            driverMarker.setIcon(ContextCompat.getDrawable(requireContext(), R.drawable.ic_delivery_bike_real));
            driverMarker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER);
            driverMarker.setFlat(true);
            driverMarker.setTitle("Hunger Delivery Partner");
            driverMarker.setSnippet("Tracking active");
            mMap.getOverlays().add(driverMarker);
        }
        driverMarker.setPosition(driverPoint);
        driverMarker.setVisible(true);

        // 6. Restaurant Pickup Marker
        if (restaurantMarker == null) {
            restaurantMarker = new Marker(mMap);
            restaurantMarker.setTitle("🏪 " + (order.getRestaurantName() != null ? order.getRestaurantName() : "Restaurant Pickup"));
            restaurantMarker.setSnippet(order.getRestaurantAddress() != null ? order.getRestaurantAddress() : "Pickup Point");
            Drawable restIcon = ContextCompat.getDrawable(requireContext(), R.drawable.ic_restaurant_pin);
            if (restIcon != null) restaurantMarker.setIcon(restIcon);
            restaurantMarker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM);
            mMap.getOverlays().add(restaurantMarker);
        }
        restaurantMarker.setPosition(restPoint);
        restaurantMarker.setVisible(true);

        // 7. Customer Marker (Drop point for context)
        if (order.getDeliveryLatitude() != 0.0 && order.getDeliveryLongitude() != 0.0) {
            GeoPoint dropPoint = new GeoPoint(order.getDeliveryLatitude(), order.getDeliveryLongitude());
            if (customerMarker == null) {
                customerMarker = new Marker(mMap);
                customerMarker.setTitle("🏠 " + (order.getCustomerName() != null ? order.getCustomerName() : "Customer Drop"));
                customerMarker.setSnippet(order.getFullDeliveryAddress() != null ? order.getFullDeliveryAddress() : "Delivery Address");
                Drawable dropIcon = ContextCompat.getDrawable(requireContext(), R.drawable.ic_drop_pin);
                if (dropIcon != null) customerMarker.setIcon(dropIcon);
                customerMarker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM);
                mMap.getOverlays().add(customerMarker);
            }
            customerMarker.setPosition(dropPoint);
            customerMarker.setVisible(true);
        }

        // 8. Fetch Route from Delivery Partner Current Location -> Restaurant Location with Animation
        final GeoPoint finalDriverPoint = driverPoint;
        final GeoPoint finalRestPoint = restPoint;
        fetchRouteAsync(driverPoint, restPoint, routePts -> {
            if (getContext() == null || mMap == null || routePts == null || routePts.isEmpty()) return;

            if (activeRouteAnimator != null) {
                activeRouteAnimator.cancel();
            }

            if (activeOrderRoutePolyline == null) {
                activeOrderRoutePolyline = new Polyline(mMap);
                activeOrderRoutePolyline.getOutlinePaint().setColor(0xFF00E676); // High-vis Neon Green
                activeOrderRoutePolyline.getOutlinePaint().setStrokeWidth(14.0f);
                activeOrderRoutePolyline.getOutlinePaint().setStrokeCap(Paint.Cap.ROUND);
                activeOrderRoutePolyline.getOutlinePaint().setStrokeJoin(Paint.Join.ROUND);
                mMap.getOverlays().add(activeOrderRoutePolyline);
            }

            activeOrderRoutePolyline.setPoints(new ArrayList<>());
            activeOrderRoutePolyline.setVisible(true);

            // Progressive Polyline Route Drawing Animation (Rider to Restaurant)
            activeRouteAnimator = ValueAnimator.ofInt(1, routePts.size());
            activeRouteAnimator.setDuration(1400);
            activeRouteAnimator.setInterpolator(new DecelerateInterpolator());
            activeRouteAnimator.addUpdateListener(anim -> {
                int count = (int) anim.getAnimatedValue();
                if (activeOrderRoutePolyline != null && count <= routePts.size()) {
                    activeOrderRoutePolyline.setPoints(new ArrayList<>(routePts.subList(0, count)));
                    mMap.invalidate();
                }
            });
            activeRouteAnimator.start();

            // Smooth Camera Framing of Route
            try {
                BoundingBox box = BoundingBox.fromGeoPoints(routePts);
                mMap.zoomToBoundingBox(box, true, 160);
            } catch (Exception e) {
                mMap.getController().animateTo(finalDriverPoint);
                mMap.getController().setZoom(16.5);
            }

            // Animate Rider Marker Rotation towards first road waypoint
            if (routePts.size() >= 2 && driverMarker != null) {
                float bearing = computeBearing(finalDriverPoint, routePts.get(Math.min(2, routePts.size() - 1)));
                driverMarker.setRotation(bearing);
            }

            mMap.invalidate();
        });

        // 9. Update distance info
        float[] distResults = new float[1];
        Location.distanceBetween(driverPoint.getLatitude(), driverPoint.getLongitude(), restPoint.getLatitude(), restPoint.getLongitude(), distResults);
        float distKm = distResults[0] / 1000f;

        if (tvCurrentLocation != null) {
            tvCurrentLocation.setText(String.format(Locale.getDefault(), "🚴 En route to %s • %.1f km", order.getRestaurantName(), distKm));
        }

        mMap.invalidate();
    }

    /**
     * Shows/hides the scan animation in top-center of map with pulsing dot
     */
    private void showScanAnimation(String label) {
        if (layoutScanAnimation == null) return;
        if (tvScanLabel != null) tvScanLabel.setText(label);
        layoutScanAnimation.setVisibility(View.VISIBLE);

        if (scanDotAnimator != null) scanDotAnimator.cancel();
        if (viewScanDot != null) {
            scanDotAnimator = ObjectAnimator.ofFloat(viewScanDot, "alpha", 0.2f, 1.0f);
            scanDotAnimator.setDuration(600);
            scanDotAnimator.setRepeatMode(ValueAnimator.REVERSE);
            scanDotAnimator.setRepeatCount(ValueAnimator.INFINITE);
            scanDotAnimator.start();
        }

        // Auto-hide after 3 seconds
        if (layoutScanAnimation != null) {
            layoutScanAnimation.postDelayed(() -> {
                if (layoutScanAnimation != null) {
                    layoutScanAnimation.animate().alpha(0f).setDuration(500).withEndAction(() -> {
                        if (layoutScanAnimation != null) layoutScanAnimation.setVisibility(View.GONE);
                        if (layoutScanAnimation != null) layoutScanAnimation.setAlpha(1f);
                    }).start();
                }
            }, 3000);
        }
    }

    /**
     * Shows the pickup or deliver swipe button depending on current delivery stage
     */
    private void showSwipePanel(DeliveryOrder order) {
        if (order == null || layoutSwipeActionPanel == null) return;

        String stage = order.getDeliveryStage() != null ? order.getDeliveryStage().trim().toLowerCase() : "";

        layoutSwipeActionPanel.setVisibility(View.VISIBLE);

        // Decide which panel to show
        boolean isPickedUp = "picked_up".equals(stage) || "to_customer".equals(stage)
                || "arrived_at_customer".equals(stage) || "arrived".equals(stage);

        if (isPickedUp) {
            // Show deliver swipe button
            if (layoutSwipePickup != null) layoutSwipePickup.setVisibility(View.GONE);
            if (layoutSwipeDeliver != null) {
                layoutSwipeDeliver.setVisibility(View.VISIBLE);
                setupSwipeGesture(layoutSwipeDeliver, viewDeliverThumb, false, order);
            }
        } else {
            // Show pickup swipe button
            if (layoutSwipeDeliver != null) layoutSwipeDeliver.setVisibility(View.GONE);
            if (layoutSwipePickup != null) {
                layoutSwipePickup.setVisibility(View.VISIBLE);
                setupSwipeGesture(layoutSwipePickup, viewPickupThumb, true, order);
            }
        }
    }

    /**
     * Sets up left-to-right swipe gesture on a swipe panel.
     * isPickup=true => on complete: mark as picked_up and show customer route.
     * isPickup=false => on complete: show OTP verification dialog.
     */
    @android.annotation.SuppressLint("ClickableViewAccessibility")
    private void setupSwipeGesture(View trackView, View thumbView, boolean isPickup, DeliveryOrder order) {
        if (trackView == null || thumbView == null) return;

        final float[] startX = {0f};
        final float[] thumbStartX = {0f};
        final int[] trackWidth = {0};
        final boolean[] completed = {false};

        trackView.setOnTouchListener((v, event) -> {
            if (trackWidth[0] == 0) trackWidth[0] = trackView.getWidth();
            int maxSlide = trackWidth[0] - 80; // leave room for thumb
            if (maxSlide < 50) maxSlide = 200;

            switch (event.getActionMasked()) {
                case android.view.MotionEvent.ACTION_DOWN:
                    startX[0] = event.getRawX();
                    thumbStartX[0] = thumbView.getTranslationX();
                    completed[0] = false;
                    return true;
                case android.view.MotionEvent.ACTION_MOVE:
                    float dx = event.getRawX() - startX[0];
                    float newX = thumbStartX[0] + dx;
                    if (newX < 0) newX = 0;
                    if (newX > maxSlide) newX = maxSlide;
                    thumbView.setTranslationX(newX);
                    // Progress feedback: alpha on track label
                    float progress = newX / maxSlide;
                    if (progress > 0.85f && !completed[0]) {
                        completed[0] = true;
                        thumbView.setTranslationX(0);
                        if (isPickup) {
                            onPickupConfirmed(order);
                        } else {
                            showDeliveryOtpDialog(order);
                        }
                    }
                    return true;
                case android.view.MotionEvent.ACTION_UP:
                case android.view.MotionEvent.ACTION_CANCEL:
                    if (!completed[0]) {
                        thumbView.animate().translationX(0).setDuration(250).start();
                    }
                    return true;
            }
            return false;
        });
    }

    /**
     * Called when rider swipes right on Pickup button.
     * Updates Firestore stage to 'picked_up', shows customer location route,
     * and switches scan animation to 'Heading to Customer'.
     */
    private void onPickupConfirmed(DeliveryOrder order) {
        if (auth.getCurrentUser() == null || order == null) return;
        String uid = auth.getCurrentUser().getUid();

        // Validate assignment
        if (order.getDeliveryPersonId() != null && !order.getDeliveryPersonId().trim().isEmpty() && !uid.equals(order.getDeliveryPersonId().trim())) {
            showToast("Unauthorized: You are not the assigned partner for this order.");
            return;
        }

        Map<String, Object> updates = new HashMap<>();
        updates.put("deliveryStage", Constants.STAGE_PICKED_UP);
        updates.put("deliveryStatus", "on_the_way");
        updates.put("pickedUpAt", FieldValue.serverTimestamp());
        updates.put("updatedAt", FieldValue.serverTimestamp());

        db.collection(Constants.COLLECTION_ORDERS).document(order.getId())
                .update(updates)
                .addOnSuccessListener(v -> {
                    showToast("✅ Pickup Confirmed! Heading to Customer.");

                    // Update currentActiveOrder stage and timestamp locally
                    order.setDeliveryStage(Constants.STAGE_PICKED_UP);
                    order.setDeliveryStatus("on_the_way");
                    order.setPickedUpAt(new java.util.Date());
                    currentActiveOrder = order;

                    // Immediately re-render active list so the card turns into Customer Delivery card
                    optimisticActiveOrdersMap.put(order.getId(), order);
                    mergeAndRenderActiveOrders();

                    // Show customer route on map
                    showCustomerRoute(order);

                    // Show scan animation + deliver panel
                    showScanAnimation("📡 Navigating to Customer...");
                    if (layoutSwipePickup != null) layoutSwipePickup.setVisibility(View.GONE);
                    if (layoutSwipeDeliver != null) {
                        layoutSwipeDeliver.setVisibility(View.VISIBLE);
                        if (viewDeliverThumb != null) viewDeliverThumb.setTranslationX(0);
                        setupSwipeGesture(layoutSwipeDeliver, viewDeliverThumb, false, order);
                    }
                })
                .addOnFailureListener(e ->
                        showToast("Failed to confirm pickup: " + e.getMessage()));
    }

    /**
     * Updates map to show route from current position to customer drop location.
     */
    private void showCustomerRoute(DeliveryOrder order) {
        if (order == null || mMap == null || getContext() == null) return;

        GeoPoint dropPoint = null;
        if (order.getDeliveryLatitude() != 0.0 && order.getDeliveryLongitude() != 0.0) {
            dropPoint = new GeoPoint(order.getDeliveryLatitude(), order.getDeliveryLongitude());
        }
        if (dropPoint == null) return;

        // Update restaurant marker to hidden, focus on customer
        if (restaurantMarker != null) restaurantMarker.setVisible(false);
        if (customerMarker != null) {
            customerMarker.setVisible(true);
        }

        // Update call button
        if (btnMapCallAction != null) btnMapCallAction.setVisibility(View.VISIBLE);
        if (tvMapCallLabel != null) tvMapCallLabel.setText("Call Customer");
        if (btnMapCallAction != null) btnMapCallAction.setOnClickListener(v -> callOrderContact(order));

        GeoPoint driverPoint = null;
        if (driverMarker != null && driverMarker.getPosition() != null) {
            GeoPoint dp = (GeoPoint) driverMarker.getPosition();
            if (dp.getLatitude() != 0.0 || dp.getLongitude() != 0.0) driverPoint = dp;
        }
        if (driverPoint == null) driverPoint = dropPoint;

        if (tvCurrentLocation != null) {
            tvCurrentLocation.setText("🏠 Heading to " + (order.getCustomerName() != null ? order.getCustomerName() : "Customer") + "...");
        }

        final GeoPoint finalDriverPoint = driverPoint;
        final GeoPoint finalDropPoint = dropPoint;
        fetchRouteAsync(driverPoint, dropPoint, routePts -> {
            if (getContext() == null || mMap == null || routePts == null || routePts.isEmpty()) return;
            if (activeRouteAnimator != null) activeRouteAnimator.cancel();

            if (activeOrderRoutePolyline == null) {
                activeOrderRoutePolyline = new Polyline(mMap);
                activeOrderRoutePolyline.getOutlinePaint().setColor(0xFF00C853); // Neon Green
                activeOrderRoutePolyline.getOutlinePaint().setStrokeWidth(14.0f);
                activeOrderRoutePolyline.getOutlinePaint().setStrokeCap(android.graphics.Paint.Cap.ROUND);
                mMap.getOverlays().add(activeOrderRoutePolyline);
            }
            activeOrderRoutePolyline.setPoints(new ArrayList<>());
            activeOrderRoutePolyline.setVisible(true);

            activeRouteAnimator = ValueAnimator.ofInt(1, routePts.size());
            activeRouteAnimator.setDuration(1200);
            activeRouteAnimator.setInterpolator(new DecelerateInterpolator());
            activeRouteAnimator.addUpdateListener(anim -> {
                int count = (int) anim.getAnimatedValue();
                if (activeOrderRoutePolyline != null && count <= routePts.size()) {
                    activeOrderRoutePolyline.setPoints(new ArrayList<>(routePts.subList(0, count)));
                    mMap.invalidate();
                }
            });
            activeRouteAnimator.start();

            try {
                BoundingBox box = BoundingBox.fromGeoPoints(routePts);
                mMap.zoomToBoundingBox(box, true, 160);
            } catch (Exception e) {
                mMap.getController().animateTo(finalDropPoint);
                mMap.getController().setZoom(16.5);
            }
            mMap.invalidate();
        });
    }

    /**
     * Shows OTP verification dialog for delivery completion.
     * Rider enters OTP, system verifies against Firestore order.
     */
    private void showDeliveryOtpDialog(DeliveryOrder order) {
        if (getContext() == null || getActivity() == null || order == null) return;

        android.app.AlertDialog.Builder builder = new android.app.AlertDialog.Builder(getContext());
        View dialogView = LayoutInflater.from(getContext()).inflate(R.layout.dialog_otp_verification, null);
        builder.setView(dialogView);
        builder.setCancelable(false);
        android.app.AlertDialog otpDialog = builder.create();
        if (otpDialog.getWindow() != null) {
            otpDialog.getWindow().setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(android.graphics.Color.TRANSPARENT));
        }

        // Get OTP input and verify button from dialog layout
        android.widget.EditText etOtp = dialogView.findViewById(R.id.et_otp_input);
        View btnVerify = dialogView.findViewById(R.id.btn_confirm_otp);
        View btnCancel = dialogView.findViewById(R.id.btn_cancel_otp);
        TextView tvOtpTitle = dialogView.findViewById(R.id.tv_otp_title);

        if (tvOtpTitle != null) tvOtpTitle.setText("Enter Delivery OTP");

        if (btnCancel != null) {
            btnCancel.setOnClickListener(v -> {
                otpDialog.dismiss();
                if (viewDeliverThumb != null) viewDeliverThumb.setTranslationX(0);
            });
        }

        final int[] failedOtpAttempts = {0};
        if (btnVerify != null) {
            btnVerify.setOnClickListener(v -> {
                if (failedOtpAttempts[0] >= 5) {
                    showToast("❌ Too many failed attempts. Contact support.");
                    otpDialog.dismiss();
                    return;
                }

                String enteredOtp = etOtp != null ? etOtp.getText().toString().trim() : "";
                if (enteredOtp.length() < 4 || enteredOtp.length() > 6) {
                    showToast("Please enter a valid OTP");
                    return;
                }

                // Verify OTP against Firestore
                db.collection(Constants.COLLECTION_ORDERS).document(order.getId())
                        .get()
                        .addOnSuccessListener(doc -> {
                            if (doc == null || !doc.exists()) return;

                            String status = doc.getString("status");
                            if ("delivered".equalsIgnoreCase(status)) {
                                showToast("Order has already been delivered.");
                                otpDialog.dismiss();
                                clearActiveOrderFromMap();
                                return;
                            }

                            String actualOtp = doc.getString("deliveryOtp");
                            if (actualOtp == null) actualOtp = doc.getString("otp");
                            if (actualOtp == null) actualOtp = doc.getString("verificationCode");

                            if (actualOtp != null && actualOtp.trim().equals(enteredOtp)) {
                                otpDialog.dismiss();
                                completeDelivery(order);
                            } else {
                                failedOtpAttempts[0]++;
                                int rem = 5 - failedOtpAttempts[0];
                                showToast("❌ Wrong OTP. " + rem + " attempts remaining.");
                            }
                        })
                        .addOnFailureListener(e ->
                                showToast("Failed to verify: " + e.getMessage()));
            });
        }

        otpDialog.show();
    }

    /**
     * Completes delivery: updates Firestore order status, credits earnings to driver wallet,
     * records wallet transaction, and resets map UI.
     */
    private void completeDelivery(DeliveryOrder order) {
        if (auth.getCurrentUser() == null || order == null) return;
        String uid = auth.getCurrentUser().getUid();

        Map<String, Object> updates = new HashMap<>();
        updates.put("status", "delivered");
        updates.put("deliveryStage", Constants.STAGE_DELIVERED_DONE);
        updates.put("deliveredAt", FieldValue.serverTimestamp());
        updates.put("updatedAt", FieldValue.serverTimestamp());

        db.collection(Constants.COLLECTION_ORDERS).document(order.getId())
                .update(updates)
                .addOnSuccessListener(v -> {
                    showToast("🎉 Delivery Completed! Earning credited.", Toast.LENGTH_LONG);

                    // Credit earnings to driver profile
                    double earned = order.getEstimatedEarning();
                    Map<String, Object> driverUpdates = new HashMap<>();
                    driverUpdates.put("todayEarnings", FieldValue.increment(earned));
                    driverUpdates.put("totalEarnings", FieldValue.increment(earned));
                    driverUpdates.put("walletBalance", FieldValue.increment(earned));
                    driverUpdates.put("availableEarnings", FieldValue.increment(earned));
                    driverUpdates.put("totalDeliveries", FieldValue.increment(1));

                    // Record COD cash in hand
                    if ("cod".equalsIgnoreCase(order.getPaymentMethod())) {
                        driverUpdates.put("codCashInHand", FieldValue.increment(order.getTotal()));
                    }

                    db.collection(Constants.COLLECTION_DELIVERY_PERSONS)
                            .document(uid)
                            .update(driverUpdates)
                            .addOnFailureListener(e ->
                                    android.util.Log.e("DashboardFrag", "Driver earnings update failed: " + e.getMessage()));

                    // Record wallet transaction for earning history
                    Map<String, Object> tx = new HashMap<>();
                    tx.put("driverId", uid);
                    tx.put("deliveryPersonId", uid);
                    tx.put("orderId", order.getId());
                    tx.put("orderNumber", order.getFormattedOrderId());
                    tx.put("restaurantName", order.getRestaurantName());
                    tx.put("amount", earned);
                    tx.put("type", "earning");
                    tx.put("note", "Delivery completed");
                    tx.put("paymentMethod", order.getPaymentMethod());
                    tx.put("createdAt", FieldValue.serverTimestamp());
                    db.collection(Constants.COLLECTION_WALLET_TRANSACTIONS).add(tx)
                            .addOnFailureListener(e ->
                                    android.util.Log.e("DashboardFrag", "Wallet tx record failed: " + e.getMessage()));

                    // Hide swipe panel and scan animation
                    if (layoutSwipeActionPanel != null) layoutSwipeActionPanel.setVisibility(View.GONE);
                    if (layoutScanAnimation != null) layoutScanAnimation.setVisibility(View.GONE);
                    if (scanDotAnimator != null) { scanDotAnimator.cancel(); scanDotAnimator = null; }

                    // Immediately remove completed order from active dashboard
                    optimisticActiveOrdersMap.remove(order.getId());
                    activeOrdersByPersonMap.remove(order.getId());
                    activeOrdersByDriverMap.remove(order.getId());
                    activeOrdersByPartnerMap.remove(order.getId());
                    mergeAndRenderActiveOrders();

                    if (getContext() != null) {
                        DriverLocationService.updateActiveOrder(getContext(), null, false);
                    }

                    // Reset map
                    clearActiveOrderFromMap();
                    centerMapOnCurrentLocation();
                })
                .addOnFailureListener(e ->
                        showToast("Failed to complete delivery: " + e.getMessage()));
    }

    public void clearActiveOrderFromMap() {
        this.currentActiveOrder = null;
        if (restaurantMarker != null) {
            restaurantMarker.setVisible(false);
            if (mMap != null) mMap.getOverlays().remove(restaurantMarker);
            restaurantMarker = null;
        }
        if (customerMarker != null) {
            customerMarker.setVisible(false);
            if (mMap != null) mMap.getOverlays().remove(customerMarker);
            customerMarker = null;
        }
        if (activeOrderRoutePolyline != null) {
            activeOrderRoutePolyline.setVisible(false);
            if (mMap != null) mMap.getOverlays().remove(activeOrderRoutePolyline);
            activeOrderRoutePolyline = null;
        }
        if (btnMapCallAction != null) {
            btnMapCallAction.setVisibility(View.GONE);
        }
        // Hide swipe action panel + scan animation
        if (layoutSwipeActionPanel != null) layoutSwipeActionPanel.setVisibility(View.GONE);
        if (layoutScanAnimation != null) layoutScanAnimation.setVisibility(View.GONE);
        if (scanDotAnimator != null) { scanDotAnimator.cancel(); scanDotAnimator = null; }
        if (mMap != null) mMap.invalidate();
    }


    public void focusAndDisplayOrderOnMap(DeliveryOrder order) {
        if (order == null) return;
        if (cardStatusHero != null) cardStatusHero.setVisibility(View.GONE);
        if (cardMapSection != null) cardMapSection.setVisibility(View.VISIBLE);
        if (nestedScrollView != null) {
            nestedScrollView.smoothScrollTo(0, 0);
        }
        displayActiveOrderOnMap(order);
        fitCompleteRouteOnMap();
        showToast("🎯 Focused active route on map");
    }

    public void fitCompleteRouteOnMap() {
        if (mMap == null) return;
        if (currentActiveOrder == null) {
            centerMapOnCurrentLocation();
            return;
        }

        List<GeoPoint> routePts = new ArrayList<>();
        if (driverMarker != null && driverMarker.getPosition() != null) {
            GeoPoint dPos = (GeoPoint) driverMarker.getPosition();
            if (dPos.getLatitude() != 0.0 || dPos.getLongitude() != 0.0) {
                routePts.add(dPos);
            }
        }
        if (currentActiveOrder.getRestaurantLatitude() != 0.0 && currentActiveOrder.getRestaurantLongitude() != 0.0) {
            routePts.add(new GeoPoint(currentActiveOrder.getRestaurantLatitude(), currentActiveOrder.getRestaurantLongitude()));
        }
        if (currentActiveOrder.getDeliveryLatitude() != 0.0 && currentActiveOrder.getDeliveryLongitude() != 0.0) {
            routePts.add(new GeoPoint(currentActiveOrder.getDeliveryLatitude(), currentActiveOrder.getDeliveryLongitude()));
        }

        if (routePts.size() >= 2) {
            try {
                BoundingBox box = BoundingBox.fromGeoPoints(routePts);
                mMap.zoomToBoundingBox(box, true, 130);
            } catch (Exception e) {
                mMap.getController().animateTo(routePts.get(0));
            }
        } else if (!routePts.isEmpty()) {
            mMap.getController().animateTo(routePts.get(0));
            mMap.getController().setZoom(17.5);
        } else {
            centerMapOnCurrentLocation();
        }
    }

    public void callOrderContact(DeliveryOrder order) {
        if (order == null || getContext() == null) return;
        boolean isHeadingToCustomer = Constants.STAGE_PICKED_UP.equalsIgnoreCase(order.getDeliveryStage())
                || Constants.STAGE_TO_CUSTOMER.equalsIgnoreCase(order.getDeliveryStage())
                || Constants.STAGE_ARRIVED.equalsIgnoreCase(order.getDeliveryStage());

        String phone = isHeadingToCustomer ? order.getCustomerPhone() : order.getRestaurantPhone();
        String targetName = isHeadingToCustomer ? order.getCustomerName() : order.getRestaurantName();

        if (phone != null && !phone.trim().isEmpty()) {
            Intent callIntent = new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + phone.trim()));
            startActivity(callIntent);
        } else {
            showToast("Phone number not available for " + targetName);
        }
    }

    private void fetchRouteAsync(GeoPoint start, GeoPoint end, OnRouteReadyListener listener) {
        new Thread(() -> {
            List<GeoPoint> result = new ArrayList<>();
            try {
                String urlStr = String.format(Locale.US,
                        "https://router.project-osrm.org/route/v1/driving/%.6f,%.6f;%.6f,%.6f?overview=full&geometries=geojson",
                        start.getLongitude(), start.getLatitude(), end.getLongitude(), end.getLatitude());
                java.net.URL url = new java.net.URL(urlStr);
                java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setConnectTimeout(3500);
                conn.setReadTimeout(3500);
                conn.setRequestProperty("User-Agent", "HungerDelivery/1.0");

                if (conn.getResponseCode() == 200) {
                    java.io.BufferedReader reader = new java.io.BufferedReader(new java.io.InputStreamReader(conn.getInputStream()));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) sb.append(line);
                    reader.close();

                    org.json.JSONObject json = new org.json.JSONObject(sb.toString());
                    org.json.JSONArray routes = json.optJSONArray("routes");
                    if (routes != null && routes.length() > 0) {
                        org.json.JSONObject geom = routes.getJSONObject(0).optJSONObject("geometry");
                        if (geom != null) {
                            org.json.JSONArray coords = geom.optJSONArray("coordinates");
                            if (coords != null && coords.length() > 0) {
                                for (int i = 0; i < coords.length(); i++) {
                                    org.json.JSONArray pt = coords.getJSONArray(i);
                                    double lng = pt.getDouble(0);
                                    double lat = pt.getDouble(1);
                                    result.add(new GeoPoint(lat, lng));
                                }
                            }
                        }
                    }
                }
                conn.disconnect();
            } catch (Exception ignored) {
            }

            if (result.size() < 2) {
                result = generateInterpolatedRoute(start, end, 30);
            }

            final List<GeoPoint> finalRoute = result;
            if (getActivity() != null) {
                getActivity().runOnUiThread(() -> listener.onRouteReady(finalRoute));
            }
        }).start();
    }

    private List<GeoPoint> generateInterpolatedRoute(GeoPoint start, GeoPoint end, int segments) {
        List<GeoPoint> points = new ArrayList<>();
        if (start == null || end == null) return points;
        double latDiff = end.getLatitude() - start.getLatitude();
        double lngDiff = end.getLongitude() - start.getLongitude();
        double perpLat = -lngDiff * 0.08;
        double perpLng = latDiff * 0.08;

        for (int i = 0; i <= segments; i++) {
            double t = (double) i / segments;
            double bow = Math.sin(t * Math.PI);
            double lat = start.getLatitude() + latDiff * t + perpLat * bow;
            double lng = start.getLongitude() + lngDiff * t + perpLng * bow;
            points.add(new GeoPoint(lat, lng));
        }
        return points;
    }

    private float computeBearing(GeoPoint start, GeoPoint end) {
        if (start == null || end == null) return 0f;
        double lat1 = Math.toRadians(start.getLatitude());
        double lon1 = Math.toRadians(start.getLongitude());
        double lat2 = Math.toRadians(end.getLatitude());
        double lon2 = Math.toRadians(end.getLongitude());
        double dLon = lon2 - lon1;
        double y = Math.sin(dLon) * Math.cos(lat2);
        double x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
        double bearing = Math.toDegrees(Math.atan2(y, x));
        return (float) ((bearing + 360) % 360);
    }

    private void openPincodeManager() {
        if (partner == null || getContext() == null) return;
        PincodeManagerDialog dialog = new PincodeManagerDialog(getContext());
        dialog.setOnDismissListener(dialogInterface -> restartAvailableOrdersListener());
        dialog.show();
    }

    private void showToast(String message) {
        ToastUtils.showToast(getContext(), message, Toast.LENGTH_SHORT);
    }

    private void showToast(String message, int length) {
        ToastUtils.showToast(getContext(), message, length);
    }

    @Override
    public void onResume() {
        super.onResume();
        if (mMap != null && isOnline) {
            mMap.onResume();
        }
        // Only restart listeners if they were previously stopped (e.g. after onDestroyView)
        if (!listenersStarted) {
            listenActiveDeliveries();
            listenAvailableOrders();
            listenersStarted = true;
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        if (mMap != null) {
            mMap.onPause();
        }
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        listenersStarted = false;
        if (mMap != null) {
            mMap.onDetach();
        }
        if (fusedLocationClient != null && locationCallback != null) {
            fusedLocationClient.removeLocationUpdates(locationCallback);
        }
        if (partnerListener != null) partnerListener.remove();
        if (vkycCallListener != null) {
            vkycCallListener.remove();
            vkycCallListener = null;
        }
        if (incomingCallDialog != null && incomingCallDialog.isShowing()) {
            incomingCallDialog.dismiss();
            incomingCallDialog = null;
        }
        if (activeRouteAnimator != null) {
            activeRouteAnimator.cancel();
            activeRouteAnimator = null;
        }
        if (activeOrdersListener != null) activeOrdersListener.remove();
        if (activeDriverIdListener != null) activeDriverIdListener.remove();
        if (activePartnerIdListener != null) activePartnerIdListener.remove();
        if (availableOrdersListener != null) availableOrdersListener.remove();
        if (broadcastOrdersListener != null) broadcastOrdersListener.remove();
        if (fallbackOrdersListener != null) fallbackOrdersListener.remove();
        if (newOrderReceiver != null && getContext() != null) {
            try {
                requireContext().unregisterReceiver(newOrderReceiver);
            } catch (Exception ignored) {}
            newOrderReceiver = null;
        }
    }
}
