package com.ssr.hunger.models;

/**
 * Address model matching the web app's Address type.
 * Used for delivery location management.
 * Extended with geohash, locality, district, and addressLabel for geospatial delivery eligibility.
 */
public class Address {
    private String id;
    private String street;
    private String city;
    private String state;
    private String pincode;
    private String plusCode;
    private String landmark;
    private String locality;
    private String district;
    private String addressLabel;
    private String type; // home, work, other
    private boolean isDefault;
    private double latitude;
    private double longitude;
    private String geohash;

    public Address() {}

    public Address(String type, String street, String city, String state, String pincode) {
        this.id = "addr_" + System.currentTimeMillis();
        this.type = type;
        this.street = street;
        this.city = city;
        this.state = state;
        this.pincode = pincode;
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getStreet() { return street; }
    public void setStreet(String street) { this.street = street; }

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }

    public String getState() { return state; }
    public void setState(String state) { this.state = state; }

    public String getPincode() { return pincode; }
    public void setPincode(String pincode) { this.pincode = pincode; }

    public String getPlusCode() { return plusCode; }
    public void setPlusCode(String plusCode) { this.plusCode = plusCode; }

    public String getLandmark() { return landmark; }
    public void setLandmark(String landmark) { this.landmark = landmark; }

    public String getLocality() { return locality; }
    public void setLocality(String locality) { this.locality = locality; }

    public String getDistrict() { return district; }
    public void setDistrict(String district) { this.district = district; }

    public String getAddressLabel() { return addressLabel; }
    public void setAddressLabel(String addressLabel) { this.addressLabel = addressLabel; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public boolean isDefault() { return isDefault; }
    public void setDefault(boolean aDefault) { isDefault = aDefault; }

    public double getLatitude() { return latitude; }
    public void setLatitude(double latitude) { this.latitude = latitude; }

    public double getLongitude() { return longitude; }
    public void setLongitude(double longitude) { this.longitude = longitude; }

    public String getGeohash() { return geohash; }
    public void setGeohash(String geohash) { this.geohash = geohash; }

    public String getDisplayText() {
        StringBuilder sb = new StringBuilder();
        if (street != null && !street.isEmpty()) sb.append(street);
        if (locality != null && !locality.isEmpty()) {
            if (sb.length() > 0) sb.append(", ");
            sb.append(locality);
        }
        if (city != null && !city.isEmpty()) {
            if (sb.length() > 0) sb.append(", ");
            sb.append(city);
        }
        if (pincode != null && !pincode.isEmpty()) {
            sb.append(" - ").append(pincode);
        }
        return sb.length() > 0 ? sb.toString() : "No address set";
    }

    public String getTypeIcon() {
        if ("home".equals(type)) return "\uD83C\uDFE0";
        if ("work".equals(type)) return "\uD83D\uDCBC";
        return "\uD83D\uDCCD";
    }
}
