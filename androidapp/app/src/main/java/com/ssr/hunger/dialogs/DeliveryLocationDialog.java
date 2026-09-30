package com.ssr.hunger.dialogs;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Geocoder;
import android.location.Location;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.TextView;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import com.google.android.material.bottomsheet.BottomSheetDialogFragment;
import com.google.android.material.button.MaterialButton;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.FieldValue;
import com.google.firebase.firestore.FirebaseFirestore;
import com.ssr.hunger.R;
import com.ssr.hunger.models.Address;
import com.ssr.hunger.utils.Constants;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Delivery Location Dialog - mirrors the web app's DeliveryLocationDialog.tsx
 * Supports:
 * 1. High-Accuracy GPS location detection with native Geocoder + OpenStreetMap Nominatim reverse geocoding
 * 2. IP Address Geolocation detection (works without GPS permission)
 * 3. Open Maps interactive picker (OpenStreetMap) and external Maps app opening
 * 4. Pincode auto-lookup (api.postalpincode.in) and saved addresses management
 */
public class DeliveryLocationDialog extends BottomSheetDialogFragment {

    private static final int PERMISSION_REQ_GPS = 100;

    public interface OnAddressSelectedListener {
        void onAddressSelected(Address address);
    }

    private OnAddressSelectedListener listener;
    private List<Address> savedAddresses = new ArrayList<>();
    private boolean isAddingNew = false;
    private FusedLocationProviderClient fusedLocationClient;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    // Views
    private EditText etStreet, etPincode, etCity, etState, etLandmark;
    private RadioGroup rgAddressType;
    private LinearLayout addressList, addNewForm;
    private MaterialButton btnUseGps, btnUseIp, btnOpenMaps, btnAddNew, btnSaveAddress;
    private ProgressBar locationDetectProgress;

    // Cache last detected coordinates for map picker
    private double lastKnownLat = 28.6139;
    private double lastKnownLon = 77.2090;

    public void setOnAddressSelectedListener(OnAddressSelectedListener listener) {
        this.listener = listener;
    }

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        View view = inflater.inflate(R.layout.dialog_delivery_location, container, false);

        fusedLocationClient = LocationServices.getFusedLocationProviderClient(requireContext());

        initViews(view);
        loadSavedAddresses();
        setupListeners();

        return view;
    }

    private void initViews(View view) {
        addressList = view.findViewById(R.id.address_list);
        addNewForm = view.findViewById(R.id.add_new_form);
        btnUseGps = view.findViewById(R.id.btn_use_gps);
        btnUseIp = view.findViewById(R.id.btn_use_ip);
        btnOpenMaps = view.findViewById(R.id.btn_open_maps);
        btnAddNew = view.findViewById(R.id.btn_add_new);
        btnSaveAddress = view.findViewById(R.id.btn_save_address);
        locationDetectProgress = view.findViewById(R.id.location_detect_progress);

        etStreet = view.findViewById(R.id.et_street);
        etPincode = view.findViewById(R.id.et_pincode);
        etCity = view.findViewById(R.id.et_city);
        etState = view.findViewById(R.id.et_state);
        etLandmark = view.findViewById(R.id.et_landmark);
        rgAddressType = view.findViewById(R.id.rg_address_type);
    }

    private void setupListeners() {
        // 1. GPS Location Button
        btnUseGps.setOnClickListener(v -> requestGpsLocation());

        // 2. IP Address Geolocation Button
        btnUseIp.setOnClickListener(v -> detectLocationByIp());

        // 3. Open Maps Picker Button
        btnOpenMaps.setOnClickListener(v -> openMapPicker());

        // Add new address toggle
        btnAddNew.setOnClickListener(v -> {
            isAddingNew = !isAddingNew;
            addNewForm.setVisibility(isAddingNew ? View.VISIBLE : View.GONE);
            btnAddNew.setText(isAddingNew ? "Cancel" : "＋ Add New Address");
        });

        // Save new address
        btnSaveAddress.setOnClickListener(v -> saveNewAddress());

        // Pincode auto-lookup (api.postalpincode.in)
        etPincode.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override public void onTextChanged(CharSequence s, int start, int before, int count) {}
            @Override
            public void afterTextChanged(Editable s) {
                String pin = s.toString().trim();
                if (pin.length() == 6 && pin.matches("\\d+")) {
                    lookupPincode(pin);
                }
            }
        });
    }

    private void loadSavedAddresses() {
        String uid = FirebaseAuth.getInstance().getCurrentUser() != null ?
                FirebaseAuth.getInstance().getCurrentUser().getUid() : null;
        if (uid == null) return;

        FirebaseFirestore.getInstance()
                .collection(Constants.COLLECTION_CUSTOMERS).document(uid)
                .get()
                .addOnSuccessListener(doc -> {
                    if (!doc.exists()) return;

                    List<Map<String, Object>> addresses = (List<Map<String, Object>>) doc.get("addresses");
                    addressList.removeAllViews();
                    savedAddresses.clear();

                    if (addresses != null) {
                        for (Map<String, Object> addrMap : addresses) {
                            Address addr = new Address();
                            addr.setId((String) addrMap.get("id"));
                            addr.setStreet((String) addrMap.get("street"));
                            addr.setCity((String) addrMap.get("city"));
                            addr.setState((String) addrMap.get("state"));
                            addr.setPincode((String) addrMap.get("pincode"));
                            addr.setType((String) addrMap.get("type"));
                            addr.setLandmark((String) addrMap.get("landmark"));
                            if (addrMap.get("latitude") instanceof Number) {
                                addr.setLatitude(((Number) addrMap.get("latitude")).doubleValue());
                            }
                            if (addrMap.get("longitude") instanceof Number) {
                                addr.setLongitude(((Number) addrMap.get("longitude")).doubleValue());
                            }
                            if (addrMap.get("isDefault") != null) {
                                addr.setDefault((Boolean) addrMap.get("isDefault"));
                            }
                            savedAddresses.add(addr);
                            addAddressCard(addr);
                        }
                    }
                });
    }

    private void addAddressCard(Address addr) {
        View card = LayoutInflater.from(getContext()).inflate(R.layout.item_address_card, addressList, false);

        TextView tvType = card.findViewById(R.id.tv_address_type);
        TextView tvAddress = card.findViewById(R.id.tv_address_text);
        View defaultBadge = card.findViewById(R.id.badge_default);
        ImageButton btnMap = card.findViewById(R.id.btn_card_map);

        tvType.setText(addr.getTypeIcon() + " " + (addr.getType() != null ? addr.getType().toUpperCase() : "OTHER"));
        tvAddress.setText(addr.getDisplayText());
        defaultBadge.setVisibility(addr.isDefault() ? View.VISIBLE : View.GONE);

        // Select address on card click
        card.setOnClickListener(v -> {
            if (listener != null) listener.onAddressSelected(addr);
            dismiss();
        });

        // Open in external maps or map picker on map button click
        if (btnMap != null) {
            btnMap.setOnClickListener(v -> {
                if (addr.getLatitude() != 0 && addr.getLongitude() != 0) {
                    openInMapsApp(addr.getLatitude(), addr.getLongitude(), addr.getDisplayText());
                } else {
                    openInMapsAppByName(addr.getDisplayText());
                }
            });
        }

        addressList.addView(card);
    }

    // =========================================================================
    // 1. GPS LOCATION DETECTION
    // =========================================================================
    private void requestGpsLocation() {
        if (ActivityCompat.checkSelfPermission(requireContext(), Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
            }, PERMISSION_REQ_GPS);
            return;
        }

        setDetectingState(true, "Detecting GPS...");

        // Request high accuracy location
        fusedLocationClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)
                .addOnSuccessListener(location -> {
                    if (location != null) {
                        onGpsLocationReceived(location);
                    } else {
                        // Fallback to last location
                        fusedLocationClient.getLastLocation().addOnSuccessListener(lastLoc -> {
                            if (lastLoc != null) {
                                onGpsLocationReceived(lastLoc);
                            } else {
                                setDetectingState(false, null);
                                Toast.makeText(getContext(), "GPS signal unavailable. Trying IP address...", Toast.LENGTH_SHORT).show();
                                detectLocationByIp();
                            }
                        }).addOnFailureListener(e -> {
                            setDetectingState(false, null);
                            Toast.makeText(getContext(), "GPS failed. Trying IP address...", Toast.LENGTH_SHORT).show();
                            detectLocationByIp();
                        });
                    }
                })
                .addOnFailureListener(e -> {
                    setDetectingState(false, null);
                    Toast.makeText(getContext(), "GPS error: " + e.getMessage() + ". Trying IP address...", Toast.LENGTH_SHORT).show();
                    detectLocationByIp();
                });
    }

    private void onGpsLocationReceived(Location location) {
        lastKnownLat = location.getLatitude();
        lastKnownLon = location.getLongitude();

        // Reverse-geocode in background
        new Thread(() -> {
            String street = "";
            String city = "";
            String state = "";
            String pincode = "";

            // A) Try Android Native Geocoder
            try {
                if (Geocoder.isPresent()) {
                    Geocoder geocoder = new Geocoder(requireContext(), Locale.getDefault());
                    List<android.location.Address> list = geocoder.getFromLocation(location.getLatitude(), location.getLongitude(), 1);
                    if (list != null && !list.isEmpty()) {
                        android.location.Address gAddr = list.get(0);
                        street = gAddr.getThoroughfare() != null ? gAddr.getThoroughfare() : "";
                        if (gAddr.getSubLocality() != null) {
                            street = street.isEmpty() ? gAddr.getSubLocality() : gAddr.getSubLocality() + ", " + street;
                        }
                        if (street.isEmpty() && gAddr.getFeatureName() != null) {
                            street = gAddr.getFeatureName();
                        }
                        city = gAddr.getLocality() != null ? gAddr.getLocality() : (gAddr.getSubAdminArea() != null ? gAddr.getSubAdminArea() : "");
                        state = gAddr.getAdminArea() != null ? gAddr.getAdminArea() : "";
                        pincode = gAddr.getPostalCode() != null ? gAddr.getPostalCode() : "";
                    }
                }
            } catch (Exception ignored) {}

            // B) Fallback to OpenStreetMap Nominatim
            if (city.isEmpty()) {
                try {
                    URL url = new URL(String.format(Locale.US,
                            "https://nominatim.openstreetmap.org/reverse?format=json&lat=%.6f&lon=%.6f&zoom=18&addressdetails=1",
                            location.getLatitude(), location.getLongitude()));
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestProperty("User-Agent", "AKRHungerApp/1.0");
                    conn.setConnectTimeout(5000);
                    conn.setReadTimeout(5000);

                    if (conn.getResponseCode() == 200) {
                        BufferedReader r = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                        StringBuilder sb = new StringBuilder();
                        String line;
                        while ((line = r.readLine()) != null) sb.append(line);
                        r.close();

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

            final String fStreet = street.isEmpty() ? String.format(Locale.getDefault(), "Lat: %.4f, Lon: %.4f", location.getLatitude(), location.getLongitude()) : street;
            final String fCity = city.isEmpty() ? "Current Location" : city;
            final String fState = state;
            final String fPincode = pincode;

            mainHandler.post(() -> {
                setDetectingState(false, null);

                if (isAddingNew) {
                    etStreet.setText(fStreet);
                    etCity.setText(fCity);
                    etState.setText(fState);
                    etPincode.setText(fPincode);
                    Toast.makeText(getContext(), "📍 GPS location filled in form: " + fCity, Toast.LENGTH_SHORT).show();
                } else {
                    Address gpsAddr = new Address();
                    gpsAddr.setType("other");
                    gpsAddr.setLatitude(location.getLatitude());
                    gpsAddr.setLongitude(location.getLongitude());
                    gpsAddr.setStreet(fStreet);
                    gpsAddr.setCity(fCity);
                    gpsAddr.setState(fState);
                    gpsAddr.setPincode(fPincode);

                    Toast.makeText(getContext(), "📍 Current Location: " + fCity + (fPincode.isEmpty() ? "" : " (" + fPincode + ")"), Toast.LENGTH_SHORT).show();
                    if (listener != null) listener.onAddressSelected(gpsAddr);
                    dismiss();
                }
            });
        }).start();
    }

    // =========================================================================
    // 2. IP ADDRESS GEOLOCATION DETECTION
    // =========================================================================
    private void detectLocationByIp() {
        setDetectingState(true, "Detecting IP Location...");

        new Thread(() -> {
            String city = "";
            String state = "";
            String pincode = "";
            double lat = 0;
            double lon = 0;
            String ip = "";

            // 1. Try ipwho.is (HTTPS, fast, reliable, no key needed)
            try {
                URL url = new URL("https://ipwho.is/");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setConnectTimeout(6000);
                conn.setReadTimeout(6000);

                if (conn.getResponseCode() == 200) {
                    BufferedReader r = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = r.readLine()) != null) sb.append(line);
                    r.close();

                    JSONObject json = new JSONObject(sb.toString());
                    if (json.optBoolean("success", true)) {
                        city = json.optString("city", "");
                        state = json.optString("region", "");
                        pincode = json.optString("postal", "");
                        lat = json.optDouble("latitude", 0);
                        lon = json.optDouble("longitude", 0);
                        ip = json.optString("ip", "");
                    }
                }
                conn.disconnect();
            } catch (Exception ignored) {}

            // 2. Fallback to ip-api.com
            if (city.isEmpty()) {
                try {
                    URL url = new URL("http://ip-api.com/json");
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setConnectTimeout(6000);
                    conn.setReadTimeout(6000);

                    if (conn.getResponseCode() == 200) {
                        BufferedReader r = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                        StringBuilder sb = new StringBuilder();
                        String line;
                        while ((line = r.readLine()) != null) sb.append(line);
                        r.close();

                        JSONObject json = new JSONObject(sb.toString());
                        if ("success".equals(json.optString("status", ""))) {
                            city = json.optString("city", "");
                            state = json.optString("regionName", "");
                            pincode = json.optString("zip", "");
                            lat = json.optDouble("lat", 0);
                            lon = json.optDouble("lon", 0);
                            ip = json.optString("query", "");
                        }
                    }
                    conn.disconnect();
                } catch (Exception ignored) {}
            }

            final String fCity = city;
            final String fState = state;
            final String fPincode = pincode;
            final double fLat = lat;
            final double fLon = lon;
            final String fIp = ip;

            mainHandler.post(() -> {
                setDetectingState(false, null);

                if (fCity.isEmpty()) {
                    Toast.makeText(getContext(), "Could not detect location from IP. Please check internet connection.", Toast.LENGTH_SHORT).show();
                    return;
                }

                lastKnownLat = fLat != 0 ? fLat : lastKnownLat;
                lastKnownLon = fLon != 0 ? fLon : lastKnownLon;

                if (isAddingNew) {
                    etCity.setText(fCity);
                    etState.setText(fState);
                    etPincode.setText(fPincode);
                    if (etStreet.getText().toString().isEmpty()) {
                        etStreet.setText("Area in " + fCity);
                    }
                    Toast.makeText(getContext(), "🌐 Detected via IP (" + fIp + "): " + fCity + ", " + fState, Toast.LENGTH_SHORT).show();
                } else {
                    Address ipAddr = new Address();
                    ipAddr.setType("other");
                    ipAddr.setLatitude(fLat);
                    ipAddr.setLongitude(fLon);
                    ipAddr.setCity(fCity);
                    ipAddr.setState(fState);
                    ipAddr.setPincode(fPincode);
                    ipAddr.setStreet(fCity + (fState.isEmpty() ? "" : ", " + fState) + " (IP Location)");

                    Toast.makeText(getContext(), "🌐 Delivery location set via IP: " + fCity + " " + fPincode, Toast.LENGTH_SHORT).show();
                    if (listener != null) listener.onAddressSelected(ipAddr);
                    dismiss();
                }
            });
        }).start();
    }

    // =========================================================================
    // 3. OPEN MAPS (OpenStreetMap Picker & External Maps)
    // =========================================================================
    private void openMapPicker() {
        MapPickerDialog mapPicker = MapPickerDialog.newInstance(lastKnownLat, lastKnownLon);
        mapPicker.setOnLocationPickedListener(pickedAddr -> {
            lastKnownLat = pickedAddr.getLatitude();
            lastKnownLon = pickedAddr.getLongitude();

            if (isAddingNew) {
                etStreet.setText(pickedAddr.getStreet());
                etCity.setText(pickedAddr.getCity());
                etState.setText(pickedAddr.getState());
                etPincode.setText(pickedAddr.getPincode());
                Toast.makeText(getContext(), "🗺️ Address picked from OpenStreetMap: " + pickedAddr.getCity(), Toast.LENGTH_SHORT).show();
            } else {
                if (listener != null) listener.onAddressSelected(pickedAddr);
                dismiss();
            }
        });
        mapPicker.show(getParentFragmentManager(), "open_maps_picker");
    }

    private void openInMapsApp(double lat, double lon, String label) {
        try {
            Uri uri = Uri.parse("geo:" + lat + "," + lon + "?q=" + lat + "," + lon + "(" + Uri.encode(label) + ")");
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            startActivity(intent);
        } catch (Exception e) {
            Intent web = new Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com/maps/search/?api=1&query=" + lat + "," + lon));
            startActivity(web);
        }
    }

    private void openInMapsAppByName(String addressText) {
        try {
            Uri uri = Uri.parse("geo:0,0?q=" + Uri.encode(addressText));
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            startActivity(intent);
        } catch (Exception e) {
            Intent web = new Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com/maps/search/?api=1&query=" + Uri.encode(addressText)));
            startActivity(web);
        }
    }

    private void setDetectingState(boolean detecting, @Nullable String message) {
        if (locationDetectProgress != null) {
            locationDetectProgress.setVisibility(detecting ? View.VISIBLE : View.GONE);
        }
        btnUseGps.setEnabled(!detecting);
        btnUseIp.setEnabled(!detecting);
        btnOpenMaps.setEnabled(!detecting);
        if (detecting && message != null) {
            btnUseGps.setText(message);
        } else {
            btnUseGps.setText("📍 Use GPS Location");
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQ_GPS) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                requestGpsLocation();
            } else {
                Toast.makeText(getContext(), "GPS permission denied. Detecting location via IP address...", Toast.LENGTH_SHORT).show();
                detectLocationByIp();
            }
        }
    }

    /**
     * Pincode auto-lookup (api.postalpincode.in)
     */
    private void lookupPincode(String pincode) {
        new Thread(() -> {
            try {
                URL url = new URL("https://api.postalpincode.in/pincode/" + pincode);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");

                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder response = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    response.append(line);
                }
                reader.close();

                JSONArray jsonArray = new JSONArray(response.toString());
                JSONObject result = jsonArray.getJSONObject(0);

                if ("Success".equals(result.getString("Status"))) {
                    JSONObject po = result.getJSONArray("PostOffice").getJSONObject(0);
                    String city = po.optString("District", po.optString("Division", ""));
                    String state = po.optString("State", "");

                    requireActivity().runOnUiThread(() -> {
                        etCity.setText(city);
                        etState.setText(state);
                        Toast.makeText(getContext(), "📍 " + city + ", " + state, Toast.LENGTH_SHORT).show();
                    });
                }

                conn.disconnect();
            } catch (Exception e) {
                e.printStackTrace();
            }
        }).start();
    }

    private void saveNewAddress() {
        String street = etStreet.getText().toString().trim();
        String pincode = etPincode.getText().toString().trim();
        String city = etCity.getText().toString().trim();
        String state = etState.getText().toString().trim();

        if (street.isEmpty() || pincode.isEmpty() || city.isEmpty()) {
            Toast.makeText(getContext(), "Please fill street, pincode and city", Toast.LENGTH_SHORT).show();
            return;
        }

        String type = "home";
        int checkedId = rgAddressType.getCheckedRadioButtonId();
        if (checkedId == R.id.rb_work) type = "work";
        else if (checkedId == R.id.rb_other) type = "other";

        Address newAddr = new Address(type, street, city, state, pincode);
        newAddr.setLandmark(etLandmark.getText().toString().trim());
        newAddr.setDefault(savedAddresses.isEmpty());
        newAddr.setLatitude(lastKnownLat);
        newAddr.setLongitude(lastKnownLon);

        String uid = FirebaseAuth.getInstance().getCurrentUser() != null ?
                FirebaseAuth.getInstance().getCurrentUser().getUid() : null;
        if (uid == null) {
            if (listener != null) listener.onAddressSelected(newAddr);
            dismiss();
            return;
        }

        Map<String, Object> addrMap = new HashMap<>();
        addrMap.put("id", newAddr.getId());
        addrMap.put("street", newAddr.getStreet());
        addrMap.put("city", newAddr.getCity());
        addrMap.put("state", newAddr.getState());
        addrMap.put("pincode", newAddr.getPincode());
        addrMap.put("landmark", newAddr.getLandmark());
        addrMap.put("type", newAddr.getType());
        addrMap.put("isDefault", newAddr.isDefault());
        addrMap.put("latitude", newAddr.getLatitude());
        addrMap.put("longitude", newAddr.getLongitude());

        btnSaveAddress.setEnabled(false);
        FirebaseFirestore.getInstance()
                .collection(Constants.COLLECTION_CUSTOMERS).document(uid)
                .update("addresses", FieldValue.arrayUnion(addrMap))
                .addOnSuccessListener(aVoid -> {
                    Toast.makeText(getContext(), "Address saved! 🎉", Toast.LENGTH_SHORT).show();
                    if (listener != null) listener.onAddressSelected(newAddr);
                    dismiss();
                })
                .addOnFailureListener(e -> {
                    btnSaveAddress.setEnabled(true);
                    Toast.makeText(getContext(), "Failed: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                });
    }
}
