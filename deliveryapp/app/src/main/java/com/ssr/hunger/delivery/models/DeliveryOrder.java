package com.ssr.hunger.delivery.models;

import com.google.firebase.Timestamp;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.IgnoreExtraProperties;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@IgnoreExtraProperties
public class DeliveryOrder implements Serializable {
    private String id;
    private String orderId;
    private String orderNumber;
    private String customerId;
    private String customerName;
    private String customerPhone;
    private String restaurantId;
    private String restaurantName;
    private String restaurantPhone;
    private String restaurantAddress;
    private double restaurantLatitude;
    private double restaurantLongitude;
    private String restaurantPincode;
    private Map<String, Object> restaurantLocation;

    private String deliveryAddressStreet;
    private String deliveryAddressCity;
    private String deliveryAddressPincode;
    private double deliveryLatitude;
    private double deliveryLongitude;
    private String deliveryLocality;
    private String deliveryDistrict;
    private String deliveryLandmark;
    private String customerGeohash;
    private String restaurantGeohash;
    private double roadDistanceKm;
    private int estimatedDeliveryMinutes;
    private String serviceMode;
    private Map<String, Object> deliveryAddress;

    private List<OrderItem> items;
    private String status;
    private String deliveryStage;
    private String deliveryStatus;
    private String deliveryPersonId;
    private String deliveryPersonName;
    private String deliveryPersonPhone;

    private double deliveryCharge;
    private double deliveryFee;
    private double tipAmount;
    private double subtotal;
    private double total;

    private String paymentMethod;
    private boolean broadcastVerified;
    private String paymentStatus;
    private String deliveryOtp;
    private String returnOtp;
    private String returnStatus;
    private Date createdAt;
    private Date acceptedAt;
    private Date pickedUpAt;
    private Date deliveredAt;
    private String specialInstructions;
    private List<String> targetDeliveryIds;

    public DeliveryOrder() {
        this.items = new ArrayList<>();
        this.targetDeliveryIds = new ArrayList<>();
        this.deliveryCharge = 40.0;
        this.deliveryFee = 40.0;
    }

    public String getId() { return id != null ? id : (orderId != null ? orderId : ""); }
    public void setId(String id) { this.id = id; }

    public String getOrderId() { return orderId != null ? orderId : id; }
    public void setOrderId(String orderId) { this.orderId = orderId; if (this.id == null) this.id = orderId; }

    public String getOrderNumber() { return orderNumber != null ? orderNumber : getFormattedOrderId(); }
    public void setOrderNumber(String orderNumber) { this.orderNumber = orderNumber; }

    public String getCustomerId() { return customerId; }
    public void setCustomerId(String customerId) { this.customerId = customerId; }

    public String getCustomerName() { return customerName != null ? customerName : "Customer"; }
    public void setCustomerName(String customerName) { this.customerName = customerName; }

    public String getCustomerPhone() { return customerPhone != null ? customerPhone : ""; }
    public void setCustomerPhone(String customerPhone) { this.customerPhone = customerPhone; }

    public String getRestaurantId() { return restaurantId; }
    public void setRestaurantId(String restaurantId) { this.restaurantId = restaurantId; }

    public String getRestaurantName() { return restaurantName != null ? restaurantName : "Restaurant"; }
    public void setRestaurantName(String restaurantName) { this.restaurantName = restaurantName; }

    public String getRestaurantPhone() { return restaurantPhone != null ? restaurantPhone : ""; }
    public void setRestaurantPhone(String restaurantPhone) { this.restaurantPhone = restaurantPhone; }

    public String getRestaurantAddress() {
        return restaurantAddress != null && !restaurantAddress.isEmpty() ? restaurantAddress : "Restaurant Address";
    }
    public void setRestaurantAddress(String restaurantAddress) { this.restaurantAddress = restaurantAddress; }

    public double getRestaurantLatitude() { return restaurantLatitude; }
    public void setRestaurantLatitude(double restaurantLatitude) { this.restaurantLatitude = restaurantLatitude; }

    public double getRestaurantLongitude() { return restaurantLongitude; }
    public void setRestaurantLongitude(double restaurantLongitude) { this.restaurantLongitude = restaurantLongitude; }

    public Map<String, Object> getRestaurantLocation() { return restaurantLocation; }
    public void setRestaurantLocation(Map<String, Object> restaurantLocation) {
        this.restaurantLocation = restaurantLocation;
        if (restaurantLocation != null) {
            Object latObj = restaurantLocation.get("lat");
            if (latObj == null) latObj = restaurantLocation.get("latitude");
            if (latObj instanceof Number) {
                this.restaurantLatitude = ((Number) latObj).doubleValue();
            } else if (latObj != null) {
                try { this.restaurantLatitude = Double.parseDouble(latObj.toString().trim()); } catch (Exception ignored) {}
            }

            Object lngObj = restaurantLocation.get("lng");
            if (lngObj == null) lngObj = restaurantLocation.get("longitude");
            if (lngObj == null) lngObj = restaurantLocation.get("lon");
            if (lngObj instanceof Number) {
                this.restaurantLongitude = ((Number) lngObj).doubleValue();
            } else if (lngObj != null) {
                try { this.restaurantLongitude = Double.parseDouble(lngObj.toString().trim()); } catch (Exception ignored) {}
            }
        }
    }

    public String getRestaurantPincode() { return restaurantPincode != null ? restaurantPincode : ""; }
    public void setRestaurantPincode(String restaurantPincode) { this.restaurantPincode = restaurantPincode; }

    public String getDeliveryAddressStreet() {
        return deliveryAddressStreet != null ? deliveryAddressStreet : "Customer Address";
    }
    public void setDeliveryAddressStreet(String deliveryAddressStreet) { this.deliveryAddressStreet = deliveryAddressStreet; }

    public String getDeliveryAddressCity() { return deliveryAddressCity != null ? deliveryAddressCity : ""; }
    public void setDeliveryAddressCity(String deliveryAddressCity) { this.deliveryAddressCity = deliveryAddressCity; }

    public String getDeliveryAddressPincode() { return deliveryAddressPincode != null ? deliveryAddressPincode : ""; }
    public void setDeliveryAddressPincode(String deliveryAddressPincode) { this.deliveryAddressPincode = deliveryAddressPincode; }

    public Map<String, Object> getDeliveryAddress() { return deliveryAddress; }
    @SuppressWarnings("unchecked")
    public void setDeliveryAddress(Object address) {
        if (address instanceof Map) {
            this.deliveryAddress = (Map<String, Object>) address;
            Map<String, Object> map = (Map<String, Object>) address;
            if (map.get("street") != null) this.deliveryAddressStreet = map.get("street").toString();
            if (map.get("addressLine1") != null && this.deliveryAddressStreet == null) this.deliveryAddressStreet = map.get("addressLine1").toString();
            if (map.get("city") != null) this.deliveryAddressCity = map.get("city").toString();
            if (map.get("pincode") != null) this.deliveryAddressPincode = map.get("pincode").toString();
            if (map.get("locality") != null) this.deliveryLocality = map.get("locality").toString();
            if (map.get("district") != null) this.deliveryDistrict = map.get("district").toString();
            if (map.get("landmark") != null) this.deliveryLandmark = map.get("landmark").toString();
            if (map.get("geohash") != null) this.customerGeohash = map.get("geohash").toString();
            if (map.get("latitude") instanceof Number) this.deliveryLatitude = ((Number) map.get("latitude")).doubleValue();
            if (map.get("longitude") instanceof Number) this.deliveryLongitude = ((Number) map.get("longitude")).doubleValue();
        } else if (address instanceof String) {
            String str = (String) address;
            this.deliveryAddressStreet = str;
            Map<String, Object> map = new HashMap<>();
            map.put("street", str);
            this.deliveryAddress = map;
        }
    }

    public void setCustomerLat(double lat) {
        if (this.deliveryLatitude == 0.0) this.deliveryLatitude = lat;
    }
    public void setCustomerLon(double lon) {
        if (this.deliveryLongitude == 0.0) this.deliveryLongitude = lon;
    }

    public String getDeliveryLocality() { return deliveryLocality != null ? deliveryLocality : ""; }
    public void setDeliveryLocality(String deliveryLocality) { this.deliveryLocality = deliveryLocality; }

    public String getDeliveryDistrict() { return deliveryDistrict != null ? deliveryDistrict : ""; }
    public void setDeliveryDistrict(String deliveryDistrict) { this.deliveryDistrict = deliveryDistrict; }

    public String getDeliveryLandmark() { return deliveryLandmark != null ? deliveryLandmark : ""; }
    public void setDeliveryLandmark(String deliveryLandmark) { this.deliveryLandmark = deliveryLandmark; }

    public String getCustomerGeohash() { return customerGeohash != null ? customerGeohash : ""; }
    public void setCustomerGeohash(String customerGeohash) { this.customerGeohash = customerGeohash; }

    public String getRestaurantGeohash() { return restaurantGeohash != null ? restaurantGeohash : ""; }
    public void setRestaurantGeohash(String restaurantGeohash) { this.restaurantGeohash = restaurantGeohash; }

    public double getRoadDistanceKm() { return roadDistanceKm; }
    public void setRoadDistanceKm(double roadDistanceKm) { this.roadDistanceKm = roadDistanceKm; }

    public int getEstimatedDeliveryMinutes() { return estimatedDeliveryMinutes; }
    public void setEstimatedDeliveryMinutes(int estimatedDeliveryMinutes) { this.estimatedDeliveryMinutes = estimatedDeliveryMinutes; }

    public String getServiceMode() { return serviceMode != null ? serviceMode : "standard"; }
    public void setServiceMode(String serviceMode) { this.serviceMode = serviceMode; }

    public String getFullDeliveryAddress() {
        StringBuilder sb = new StringBuilder();
        if (deliveryAddressStreet != null && !deliveryAddressStreet.isEmpty()) sb.append(deliveryAddressStreet);
        if (deliveryLocality != null && !deliveryLocality.isEmpty()) {
            if (sb.length() > 0) sb.append(", ");
            sb.append(deliveryLocality);
        }
        if (deliveryAddressCity != null && !deliveryAddressCity.isEmpty()) {
            if (sb.length() > 0) sb.append(", ");
            sb.append(deliveryAddressCity);
        }
        if (deliveryAddressPincode != null && !deliveryAddressPincode.isEmpty()) {
            if (sb.length() > 0) sb.append(" - ");
            sb.append(deliveryAddressPincode);
        }
        return sb.length() > 0 ? sb.toString() : "Customer Address";
    }

    public double getDeliveryLatitude() { return deliveryLatitude; }
    public void setDeliveryLatitude(double deliveryLatitude) { this.deliveryLatitude = deliveryLatitude; }

    public double getDeliveryLongitude() { return deliveryLongitude; }
    public void setDeliveryLongitude(double deliveryLongitude) { this.deliveryLongitude = deliveryLongitude; }

    public List<OrderItem> getItems() { return items != null ? items : new ArrayList<>(); }
    public void setItems(List<OrderItem> items) { this.items = items; }

    public String getStatus() { return status != null ? status : "confirmed"; }
    public void setStatus(String status) { this.status = status; }

    public String getDeliveryStage() {
        return deliveryStage != null ? deliveryStage : "to_restaurant";
    }
    public void setDeliveryStage(String deliveryStage) { this.deliveryStage = deliveryStage; }

    public String getDeliveryStatus() { return deliveryStatus != null ? deliveryStatus : deliveryStage; }
    public void setDeliveryStatus(String deliveryStatus) { this.deliveryStatus = deliveryStatus; }

    public String getDeliveryPersonId() { return deliveryPersonId; }
    public void setDeliveryPersonId(String deliveryPersonId) { this.deliveryPersonId = deliveryPersonId; }

    public String getDeliveryPersonName() { return deliveryPersonName; }
    public void setDeliveryPersonName(String deliveryPersonName) { this.deliveryPersonName = deliveryPersonName; }

    public String getDeliveryPersonPhone() { return deliveryPersonPhone; }
    public void setDeliveryPersonPhone(String deliveryPersonPhone) { this.deliveryPersonPhone = deliveryPersonPhone; }

    public boolean isBroadcastVerified() { return broadcastVerified; }
    public void setBroadcastVerified(boolean broadcastVerified) { this.broadcastVerified = broadcastVerified; }

    public double getDeliveryCharge() {
        if (deliveryCharge > 0) return deliveryCharge;
        if (deliveryFee > 0) return deliveryFee;
        return 40.0;
    }
    public void setDeliveryCharge(double deliveryCharge) { this.deliveryCharge = deliveryCharge; }

    public double getDeliveryFee() { return getDeliveryCharge(); }
    public void setDeliveryFee(double deliveryFee) { this.deliveryFee = deliveryFee; this.deliveryCharge = deliveryFee; }

    public double getTipAmount() { return tipAmount; }
    public void setTipAmount(double tipAmount) { this.tipAmount = tipAmount; }

    public double getEstimatedEarning() {
        return getDeliveryCharge() + getTipAmount();
    }

    public double getSubtotal() { return subtotal; }
    public void setSubtotal(double subtotal) { this.subtotal = subtotal; }

    public double getTotal() { return total; }
    public void setTotal(double total) { this.total = total; }
    public double getTotalAmount() { return total > 0 ? total : subtotal; }

    public Date getDeliveredAt() { return deliveredAt != null ? deliveredAt : createdAt; }
    public void setDeliveredAt(Date deliveredAt) { this.deliveredAt = deliveredAt; }

    public Date getAcceptedAt() { return acceptedAt != null ? acceptedAt : createdAt; }
    public void setAcceptedAt(Date acceptedAt) { this.acceptedAt = acceptedAt; }

    public Date getPickedUpAt() { return pickedUpAt; }
    public void setPickedUpAt(Date pickedUpAt) { this.pickedUpAt = pickedUpAt; }

    public String getItemsSummary() {
        if (items == null || items.isEmpty()) return "Food Package";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < items.size(); i++) {
            OrderItem item = items.get(i);
            if (i > 0) sb.append(", ");
            sb.append(item.getQuantity()).append("x ").append(item.getName());
        }
        return sb.toString();
    }

    public String getPaymentMethod() { return paymentMethod != null ? paymentMethod : "online"; }
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }

    public String getPaymentStatus() { return paymentStatus != null ? paymentStatus : "completed"; }
    public void setPaymentStatus(String paymentStatus) { this.paymentStatus = paymentStatus; }

    public String getDeliveryOtp() { return deliveryOtp != null ? deliveryOtp : ""; }
    public void setDeliveryOtp(String deliveryOtp) { this.deliveryOtp = deliveryOtp; }

    public String getReturnOtp() { return returnOtp != null ? returnOtp : ""; }
    public void setReturnOtp(String returnOtp) { this.returnOtp = returnOtp; }

    public String getReturnStatus() { return returnStatus; }
    public void setReturnStatus(String returnStatus) { this.returnStatus = returnStatus; }

    public Date getCreatedAt() { return createdAt; }
    public void setCreatedAt(Date createdAt) { this.createdAt = createdAt; }

    public String getSpecialInstructions() { return specialInstructions; }
    public void setSpecialInstructions(String specialInstructions) { this.specialInstructions = specialInstructions; }

    public List<String> getTargetDeliveryIds() { return targetDeliveryIds; }
    public void setTargetDeliveryIds(List<String> targetDeliveryIds) { this.targetDeliveryIds = targetDeliveryIds; }

    public String getFormattedOrderId() {
        if (orderNumber != null && !orderNumber.isEmpty()) return orderNumber;
        String oid = orderId != null && !orderId.isEmpty() ? orderId : id;
        if (oid == null || oid.isEmpty()) return "#ORD";
        if (oid.length() > 6) return "#" + oid.substring(oid.length() - 6).toUpperCase();
        return "#" + oid.toUpperCase();
    }

    /**
     * Highly resilient parser that converts any Firestore DocumentSnapshot into a DeliveryOrder
     * handling any type variations (Map vs String address, Timestamp vs Date, Number formats).
     */
    @SuppressWarnings("unchecked")
    public static DeliveryOrder parseSnapshot(DocumentSnapshot doc) {
        if (doc == null || !doc.exists()) return null;
        DeliveryOrder o = null;
        try {
            o = doc.toObject(DeliveryOrder.class);
        } catch (Exception ignored) {
            // POJO reflection mismatch handled below
        }
        if (o == null) {
            o = new DeliveryOrder();
        }
        o.setId(doc.getId());

        String sOrderId = doc.getString("orderId");
        if (sOrderId != null) o.setOrderId(sOrderId);
        String sOrderNum = doc.getString("orderNumber");
        if (sOrderNum != null) o.setOrderNumber(sOrderNum);

        String cName = doc.getString("customerName");
        if (cName != null && !cName.isEmpty()) o.setCustomerName(cName);
        String cPhone = doc.getString("customerPhone");
        if (cPhone != null) o.setCustomerPhone(cPhone);

        String rName = doc.getString("restaurantName");
        if (rName != null && !rName.isEmpty()) o.setRestaurantName(rName);
        String rPhone = doc.getString("restaurantPhone");
        if (rPhone != null) o.setRestaurantPhone(rPhone);
        String rAddr = doc.getString("restaurantAddress");
        if (rAddr != null) o.setRestaurantAddress(rAddr);
        String rPin = doc.getString("restaurantPincode");
        if (rPin != null) o.setRestaurantPincode(rPin);

        // Coordinates resolution
        if (o.getRestaurantLatitude() == 0.0) {
            Double lat = doc.getDouble("restaurantLatitude");
            if (lat == null) lat = doc.getDouble("restaurantLat");
            if (lat == null) lat = doc.getDouble("pickupLatitude");
            if (lat == null) {
                Object rLocObj = doc.get("restaurantLocation");
                if (rLocObj == null) rLocObj = doc.get("pickupLocation");
                if (rLocObj instanceof Map) {
                    Map<?, ?> rm = (Map<?, ?>) rLocObj;
                    Object val = rm.get("lat");
                    if (val == null) val = rm.get("latitude");
                    if (val instanceof Number) lat = ((Number) val).doubleValue();
                    else if (val != null) {
                        try { lat = Double.parseDouble(val.toString().trim()); } catch (Exception ignored) {}
                    }
                }
            }
            if (lat != null) o.setRestaurantLatitude(lat);
        }
        if (o.getRestaurantLongitude() == 0.0) {
            Double lng = doc.getDouble("restaurantLongitude");
            if (lng == null) lng = doc.getDouble("restaurantLng");
            if (lng == null) lng = doc.getDouble("restaurantLon");
            if (lng == null) lng = doc.getDouble("pickupLongitude");
            if (lng == null) {
                Object rLocObj = doc.get("restaurantLocation");
                if (rLocObj == null) rLocObj = doc.get("pickupLocation");
                if (rLocObj instanceof Map) {
                    Map<?, ?> rm = (Map<?, ?>) rLocObj;
                    Object val = rm.get("lng");
                    if (val == null) val = rm.get("longitude");
                    if (val == null) val = rm.get("lon");
                    if (val instanceof Number) lng = ((Number) val).doubleValue();
                    else if (val != null) {
                        try { lng = Double.parseDouble(val.toString().trim()); } catch (Exception ignored) {}
                    }
                }
            }
            if (lng != null) o.setRestaurantLongitude(lng);
        }

        if (o.getDeliveryLatitude() == 0.0) {
            Double lat = doc.getDouble("deliveryLatitude");
            if (lat == null) lat = doc.getDouble("customerLat");
            if (lat == null) lat = doc.getDouble("customerLatitude");
            if (lat == null) lat = doc.getDouble("dropLatitude");
            if (lat == null) {
                Object addrObj = doc.get("deliveryAddress");
                if (addrObj == null) addrObj = doc.get("customerLocation");
                if (addrObj instanceof Map) {
                    Map<?, ?> am = (Map<?, ?>) addrObj;
                    Object val = am.get("latitude");
                    if (val == null) val = am.get("lat");
                    if (val instanceof Number) lat = ((Number) val).doubleValue();
                    else if (val != null) {
                        try { lat = Double.parseDouble(val.toString().trim()); } catch (Exception ignored) {}
                    }
                }
            }
            if (lat != null) o.setDeliveryLatitude(lat);
        }
        if (o.getDeliveryLongitude() == 0.0) {
            Double lng = doc.getDouble("deliveryLongitude");
            if (lng == null) lng = doc.getDouble("customerLon");
            if (lng == null) lng = doc.getDouble("customerLng");
            if (lng == null) lng = doc.getDouble("customerLongitude");
            if (lng == null) lng = doc.getDouble("dropLongitude");
            if (lng == null) {
                Object addrObj = doc.get("deliveryAddress");
                if (addrObj == null) addrObj = doc.get("customerLocation");
                if (addrObj instanceof Map) {
                    Map<?, ?> am = (Map<?, ?>) addrObj;
                    Object val = am.get("longitude");
                    if (val == null) val = am.get("lng");
                    if (val == null) val = am.get("lon");
                    if (val instanceof Number) lng = ((Number) val).doubleValue();
                    else if (val != null) {
                        try { lng = Double.parseDouble(val.toString().trim()); } catch (Exception ignored) {}
                    }
                }
            }
            if (lng != null) o.setDeliveryLongitude(lng);
        }

        // Address resolution
        Object addrObj = doc.get("deliveryAddress");
        if (addrObj != null) {
            o.setDeliveryAddress(addrObj);
        }
        String street = doc.getString("deliveryAddressStreet");
        if (street != null && !street.isEmpty()) o.setDeliveryAddressStreet(street);
        String city = doc.getString("deliveryAddressCity");
        if (city != null) o.setDeliveryAddressCity(city);
        String pincode = doc.getString("deliveryAddressPincode");
        if (pincode != null) o.setDeliveryAddressPincode(pincode);
        String locality = doc.getString("deliveryLocality");
        if (locality != null) o.setDeliveryLocality(locality);

        String st = doc.getString("status");
        if (st == null) st = doc.getString("orderStatus");
        if (st == null) st = doc.getString("order_status");
        if (st == null) st = doc.getString("currentStatus");
        if (st == null) st = doc.getString("deliveryStatus");
        if (st != null) o.setStatus(st);

        String stage = doc.getString("deliveryStage");
        if (stage != null) o.setDeliveryStage(stage);
        String dStatus = doc.getString("deliveryStatus");
        if (dStatus != null) o.setDeliveryStatus(dStatus);

        String dId = doc.getString("deliveryPersonId");
        if (dId == null) dId = doc.getString("deliveryPartnerId");
        if (dId == null) dId = doc.getString("driverId");
        if (dId != null) o.setDeliveryPersonId(dId);
        String dName = doc.getString("deliveryPersonName");
        if (dName != null) o.setDeliveryPersonName(dName);
        String dPhone = doc.getString("deliveryPersonPhone");
        if (dPhone != null) o.setDeliveryPersonPhone(dPhone);

        // Earnings and charges
        Double dCharge = doc.getDouble("deliveryCharge");
        if (dCharge == null) dCharge = doc.getDouble("deliveryFee");
        if (dCharge != null && dCharge > 0) {
            o.setDeliveryCharge(dCharge);
            o.setDeliveryFee(dCharge);
        }
        Double dTotal = doc.getDouble("total");
        if (dTotal != null) o.setTotal(dTotal);
        Double dTip = doc.getDouble("tipAmount");
        if (dTip != null) o.setTipAmount(dTip);

        String otp = doc.getString("deliveryOtp");
        if (otp != null) o.setDeliveryOtp(otp);
        String payMethod = doc.getString("paymentMethod");
        if (payMethod != null) o.setPaymentMethod(payMethod);
        String payStatus = doc.getString("paymentStatus");
        if (payStatus != null) o.setPaymentStatus(payStatus);
        String instructions = doc.getString("specialInstructions");
        if (instructions != null) o.setSpecialInstructions(instructions);

        // Dates resolution
        if (o.getCreatedAt() == null) {
            Timestamp ts = doc.getTimestamp("createdAt");
            if (ts != null) o.setCreatedAt(ts.toDate());
        }
        if (o.getAcceptedAt() == null) {
            Timestamp ts = doc.getTimestamp("acceptedAt");
            if (ts != null) o.setAcceptedAt(ts.toDate());
        }
        if (o.getPickedUpAt() == null) {
            Timestamp ts = doc.getTimestamp("pickedUpAt");
            if (ts != null) o.setPickedUpAt(ts.toDate());
        }
        if (o.getDeliveredAt() == null) {
            Timestamp ts = doc.getTimestamp("deliveredAt");
            if (ts != null) o.setDeliveredAt(ts.toDate());
        }

        // Items parsing fallback if items list was empty
        Object itemsObj = doc.get("items");
        if (itemsObj instanceof List && o.getItems().isEmpty()) {
            List<?> rawList = (List<?>) itemsObj;
            List<OrderItem> parsedItems = new ArrayList<>();
            for (Object obj : rawList) {
                if (obj instanceof Map) {
                    Map<?, ?> map = (Map<?, ?>) obj;
                    OrderItem item = new OrderItem();
                    if (map.get("name") != null) item.setName(map.get("name").toString());
                    if (map.get("quantity") instanceof Number) {
                        item.setQuantity(((Number) map.get("quantity")).intValue());
                    }
                    if (map.get("price") instanceof Number) {
                        item.setPrice(((Number) map.get("price")).doubleValue());
                    }
                    if (map.get("isVeg") instanceof Boolean) {
                        item.setVeg((Boolean) map.get("isVeg"));
                    }
                    parsedItems.add(item);
                }
            }
            if (!parsedItems.isEmpty()) {
                o.setItems(parsedItems);
            }
        }

        // Target delivery IDs
        Object targets = doc.get("targetDeliveryIds");
        if (targets instanceof List) {
            o.setTargetDeliveryIds((List<String>) targets);
        }

        Boolean bVerified = doc.getBoolean("broadcastVerified");
        if (bVerified != null) o.setBroadcastVerified(bVerified);

        return o;
    }
}
