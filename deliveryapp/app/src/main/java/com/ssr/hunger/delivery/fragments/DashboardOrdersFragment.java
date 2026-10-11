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
import android.animation.ValueAnimator;
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

    private ListenerRegistration partnerListener;
    private ListenerRegistration activeOrdersListener;
    private ListenerRegistration availableOrdersListener;
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
        loadPartnerData();
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

        // Unrestricted multi-touch, pinch-to-zoom and pan in all directions
        mMap.setOnTouchListener(new View.OnTouchListener() {
            @Override
            public boolean onTouch(View v, MotionEvent event) {
                doubleTapDetector.onTouchEvent(event);
                int action = event.getActionMasked();
                switch (action) {
                    case MotionEvent.ACTION_DOWN:
                    case MotionEvent.ACTION_POINTER_DOWN:
                    case MotionEvent.ACTION_MOVE:
                        if (nestedScrollView != null) nestedScrollView.requestDisallowInterceptTouchEvent(true);
                        if (swipeRefresh != null) {
                            swipeRefresh.setEnabled(false);
                            swipeRefresh.requestDisallowInterceptTouchEvent(true);
                        }
                        v.getParent().requestDisallowInterceptTouchEvent(true);
                        break;
                    case MotionEvent.ACTION_UP:
                    case MotionEvent.ACTION_CANCEL:
                        if (nestedScrollView != null) nestedScrollView.requestDisallowInterceptTouchEvent(false);
                        if (swipeRefresh != null) {
                            swipeRefresh.setEnabled(true);
                            swipeRefresh.requestDisallowInterceptTouchEvent(false);
                        }
                        v.getParent().requestDisallowInterceptTouchEvent(false);
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
            breadcrumbRoute.addPoint(point);
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

    private void loadPartnerData() {
        if (auth.getCurrentUser() == null) return;
        String uid = auth.getCurrentUser().getUid();

        if (partnerListener != null) partnerListener.remove();

        partnerListener = db.collection(Constants.COLLECTION_DELIVERY_PERSONS)
                .document(uid)
                .addSnapshotListener((snapshot, error) -> {
                    if (error != null || snapshot == null || !snapshot.exists()) return;

                    partner = snapshot.toObject(DeliveryPartner.class);
                    if (partner == null) {
                        partner = new DeliveryPartner();
                        partner.setUid(uid);
                    }

                    isOnline = partner.isOnline();
                    updateStatusUI(isOnline);
                    
                    if (!"approved".equalsIgnoreCase(partner.getKycStatus())) {
                        cardKycWarning.setVisibility(View.VISIBLE);
                    } else {
                        cardKycWarning.setVisibility(View.GONE);
                        if (incomingCallDialog != null && incomingCallDialog.isShowing()) {
                            incomingCallDialog.dismiss();
                        }
                    }

                    listenForIncomingVkycCall(uid);
                    listenActiveDeliveries();
                    if (isOnline) {
                        listenAvailableOrders();
                    } else {
                        stopAvailableOrdersListener();
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
                tvEmptyAvailableMessage.setText("You are offline. Turn switch ON to start receiving order broadcasts.");
            }
        }
    }

    private void toggleOnlineStatus() {
        if (auth.getCurrentUser() == null || partner == null) return;

        boolean targetOnline = !isOnline;

        // Check KYC verification
        if (targetOnline && !"approved".equalsIgnoreCase(partner.getKycStatus())) {
            Toast.makeText(getContext(), "KYC Verification required before you can go online!", Toast.LENGTH_LONG).show();
            if (switchOnline != null) switchOnline.setChecked(false);
            if (switchMapOffline != null) switchMapOffline.setChecked(false);
            return;
        }

        String uid = auth.getCurrentUser().getUid();
        Map<String, Object> updates = new HashMap<>();
        updates.put("isAvailable", targetOnline);
        updates.put("status", targetOnline ? "online" : "offline");
        updates.put("updatedAt", FieldValue.serverTimestamp());

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
                        Toast.makeText(getContext(), "🟢 You are now ONLINE", Toast.LENGTH_SHORT).show();
                    } else {
                        if (ctx != null) DriverLocationService.stopTracking(ctx);
                        Toast.makeText(getContext(), "🔴 You are now OFFLINE", Toast.LENGTH_SHORT).show();
                    }
                })
                .addOnFailureListener(e -> {
                    Toast.makeText(getContext(), "Failed to update status", Toast.LENGTH_SHORT).show();
                    if (switchOnline != null) switchOnline.setChecked(isOnline);
                    if (switchMapOffline != null) switchMapOffline.setChecked(isOnline);
                });
    }

    private void listenActiveDeliveries() {
        if (auth.getCurrentUser() == null) return;
        String uid = auth.getCurrentUser().getUid();

        if (activeOrdersListener != null) activeOrdersListener.remove();

        activeOrdersListener = db.collection(Constants.COLLECTION_ORDERS)
                .whereEqualTo("deliveryPersonId", uid)
                .whereIn("status", Arrays.asList(Constants.STATUS_OUT_FOR_DELIVERY, Constants.STATUS_READY, Constants.STATUS_CONFIRMED, Constants.STATUS_PREPARING))
                .addSnapshotListener((snapshot, error) -> {
                    if (error != null || snapshot == null) return;

                    List<DeliveryOrder> activeList = new ArrayList<>();
                    for (DocumentSnapshot doc : snapshot.getDocuments()) {
                        DeliveryOrder o = doc.toObject(DeliveryOrder.class);
                        if (o != null) {
                            o.setId(doc.getId());
                            activeList.add(o);
                        }
                    }

                    if (activeList.isEmpty()) {
                        layoutActiveSection.setVisibility(View.GONE);
                        clearActiveOrderFromMap();
                    } else {
                        layoutActiveSection.setVisibility(View.VISIBLE);
                        tvActiveCount.setText(activeList.size() + " active");
                        activeOrdersAdapter.setOrders(activeList);

                        DeliveryOrder topActive = activeList.get(0);
                        displayActiveOrderOnMap(topActive);
                        Context ctx = getContext();
                        if (ctx != null) {
                            DriverLocationService.updateActiveOrder(ctx, topActive.getId(), true);
                        }
                    }
                });
    }

    private void listenAvailableOrders() {
        if (availableOrdersListener != null) availableOrdersListener.remove();

        availableOrdersListener = db.collection(Constants.COLLECTION_ORDERS)
                .whereIn("status", Arrays.asList(Constants.STATUS_CONFIRMED, Constants.STATUS_PREPARING, Constants.STATUS_READY))
                .addSnapshotListener((snapshot, error) -> {
                    if (error != null || snapshot == null) return;

                    List<DeliveryOrder> availableList = new ArrayList<>();
                    for (DocumentSnapshot doc : snapshot.getDocuments()) {
                        DeliveryOrder o = doc.toObject(DeliveryOrder.class);
                        if (o != null) {
                            o.setId(doc.getId());

                            if (o.getDeliveryPersonId() != null && !o.getDeliveryPersonId().isEmpty()) continue;
                            if (declinedOrderIds.contains(o.getId())) continue;

                            if (o.getTargetDeliveryIds() != null && !o.getTargetDeliveryIds().isEmpty()) {
                                if (!o.getTargetDeliveryIds().contains(auth.getUid())) continue;
                            }

                            if (partner != null && partner.isPincodeFilterActive() && !partner.getServicePincodes().isEmpty()) {
                                boolean matches = false;
                                String custPin = o.getDeliveryAddressPincode();
                                String restPin = o.getRestaurantPincode();
                                for (String p : partner.getServicePincodes()) {
                                    if (p.equalsIgnoreCase(custPin) || p.equalsIgnoreCase(restPin)) {
                                        matches = true;
                                        break;
                                    }
                                }
                                if (!matches) continue;
                            }

                            availableList.add(o);
                        }
                    }

                    if (availableList.isEmpty()) {
                        layoutEmptyAvailable.setVisibility(View.VISIBLE);
                        rvAvailableOrders.setVisibility(View.GONE);
                        tvAvailableCount.setText("0 waiting");
                    } else {
                        layoutEmptyAvailable.setVisibility(View.GONE);
                        rvAvailableOrders.setVisibility(View.VISIBLE);
                        tvAvailableCount.setText(availableList.size() + " waiting");
                        availableOrdersAdapter.setOrders(availableList);

                        DeliveryOrder top = availableList.get(0);
                        if (!top.getId().equals(lastTopOrderId)) {
                            lastTopOrderId = top.getId();
                            if (getContext() != null) SoundHelper.playNewOrderAlert(getContext());
                        }
                    }
                });
    }

    private void stopAvailableOrdersListener() {
        if (availableOrdersListener != null) {
            availableOrdersListener.remove();
            availableOrdersListener = null;
        }
        rvAvailableOrders.setVisibility(View.GONE);
        layoutEmptyAvailable.setVisibility(View.VISIBLE);
        tvAvailableCount.setText("0 waiting");
    }

    private void restartAvailableOrdersListener() {
        if (isOnline) listenAvailableOrders();
    }

    private void acceptOrder(DeliveryOrder order) {
        if (auth.getCurrentUser() == null || partner == null) return;
        String uid = auth.getCurrentUser().getUid();
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
            if (currentDeliveryPersonId != null && !currentDeliveryPersonId.isEmpty() && !currentDeliveryPersonId.equals(uid)) {
                throw new com.google.firebase.firestore.FirebaseFirestoreException(
                        "Order already accepted by another partner",
                        com.google.firebase.firestore.FirebaseFirestoreException.Code.ABORTED
                );
            }

            Map<String, Object> updates = new HashMap<>();
            updates.put("deliveryPersonId", uid);
            updates.put("deliveryPersonName", partner.getName());
            updates.put("deliveryPersonPhone", partner.getPhone());
            updates.put("status", Constants.STATUS_OUT_FOR_DELIVERY);
            updates.put("deliveryStage", Constants.STAGE_TO_RESTAURANT);
            updates.put("acceptedAt", FieldValue.serverTimestamp());
            transaction.update(orderRef, updates);
            return null;
        }).addOnSuccessListener(v -> {
            Context ctx = getContext();
            if (ctx != null) {
                AnalyticsHelper.getInstance(ctx).logOrderAccepted(order.getId(), order.getRestaurantName(), order.getEstimatedEarning());
                DriverLocationService.startTracking(ctx, uid, order.getId(), true);
            }
            displayActiveOrderOnMap(order);
            if (nestedScrollView != null) {
                nestedScrollView.smoothScrollTo(0, 0);
            }
            Toast.makeText(getContext(), "🎉 Order Accepted! Live navigation & tracking activated", Toast.LENGTH_SHORT).show();
            Intent intent = new Intent(getContext(), OrderActiveDetailActivity.class);
            intent.putExtra(Constants.EXTRA_ORDER_ID, order.getId());
            startActivity(intent);
        }).addOnFailureListener(e -> {
            String msg = (e.getMessage() != null && e.getMessage().contains("already accepted"))
                    ? "Order has already been accepted by another partner."
                    : "Failed to accept order: " + e.getMessage();
            Toast.makeText(getContext(), msg, Toast.LENGTH_LONG).show();
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

        List<GeoPoint> routePts = new ArrayList<>();

        // Add driver's current position if known
        if (driverMarker != null && driverMarker.getPosition() != null) {
            GeoPoint dPos = (GeoPoint) driverMarker.getPosition();
            if (dPos.getLatitude() != 0.0 || dPos.getLongitude() != 0.0) {
                routePts.add(dPos);
            }
        }

        // Restaurant pickup marker
        if (order.getRestaurantLatitude() != 0.0 && order.getRestaurantLongitude() != 0.0) {
            GeoPoint restPoint = new GeoPoint(order.getRestaurantLatitude(), order.getRestaurantLongitude());
            if (restaurantMarker == null) {
                restaurantMarker = new Marker(mMap);
                restaurantMarker.setTitle("🏪 " + (order.getRestaurantName() != null ? order.getRestaurantName() : "Restaurant"));
                restaurantMarker.setSnippet(order.getRestaurantAddress() != null ? order.getRestaurantAddress() : "Pickup Point");
                Drawable restIcon = ContextCompat.getDrawable(requireContext(), R.drawable.ic_restaurant_pin);
                if (restIcon != null) restaurantMarker.setIcon(restIcon);
                restaurantMarker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM);
                mMap.getOverlays().add(restaurantMarker);
            }
            restaurantMarker.setPosition(restPoint);
            restaurantMarker.setVisible(true);
            routePts.add(restPoint);
        }

        // Customer drop marker
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
            routePts.add(dropPoint);
        }

        // Draw glowing neon green route connecting driver -> restaurant -> customer
        if (routePts.size() >= 2) {
            if (activeOrderRoutePolyline == null) {
                activeOrderRoutePolyline = new Polyline(mMap);
                activeOrderRoutePolyline.getOutlinePaint().setColor(0xFF00E676);
                activeOrderRoutePolyline.getOutlinePaint().setStrokeWidth(12.0f);
                activeOrderRoutePolyline.getOutlinePaint().setStrokeCap(Paint.Cap.ROUND);
                activeOrderRoutePolyline.getOutlinePaint().setStrokeJoin(Paint.Join.ROUND);
                mMap.getOverlays().add(activeOrderRoutePolyline);
            }
            activeOrderRoutePolyline.setPoints(routePts);
            activeOrderRoutePolyline.setVisible(true);

            try {
                BoundingBox box = BoundingBox.fromGeoPoints(routePts);
                mMap.zoomToBoundingBox(box, true, 130);
            } catch (Exception ignored) {
            }
        } else if (!routePts.isEmpty()) {
            mMap.getController().animateTo(routePts.get(0));
            mMap.getController().setZoom(17.5);
        }

        // Show quick Call button on map address bar
        boolean isHeadingToCustomer = Constants.STAGE_PICKED_UP.equalsIgnoreCase(order.getDeliveryStage())
                || Constants.STAGE_TO_CUSTOMER.equalsIgnoreCase(order.getDeliveryStage())
                || Constants.STAGE_ARRIVED.equalsIgnoreCase(order.getDeliveryStage());

        if (btnMapCallAction != null) {
            btnMapCallAction.setVisibility(View.VISIBLE);
        }
        if (tvMapCallLabel != null) {
            tvMapCallLabel.setText(isHeadingToCustomer ? "Call Customer" : "Call Restaurant");
        }

        mMap.invalidate();
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
        Toast.makeText(getContext(), "🎯 Focused active route on map", Toast.LENGTH_SHORT).show();
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
            Toast.makeText(getContext(), "Phone number not available for " + targetName, Toast.LENGTH_SHORT).show();
        }
    }

    private void openPincodeManager() {
        if (partner == null || getContext() == null) return;
        PincodeManagerDialog dialog = new PincodeManagerDialog(getContext());
        dialog.setOnDismissListener(dialogInterface -> restartAvailableOrdersListener());
        dialog.show();
    }

    @Override
    public void onResume() {
        super.onResume();
        if (mMap != null && isOnline) {
            mMap.onResume();
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
        if (activeOrdersListener != null) activeOrdersListener.remove();
        if (availableOrdersListener != null) availableOrdersListener.remove();
    }
}
