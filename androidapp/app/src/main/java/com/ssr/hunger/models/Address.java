package com.ssr.hunger.models;

/**
 * Address model matching the web app's Address type.
 * Used for delivery location management.
 */
public class Address {
    private String id;
    private String street;
    private String city;
    private String state;
    private String pincode;
    private String plusCode;
    private String landmark;
    private String type; // home, work, other
    private boolean isDefault;
    private double latitude;
    private double longitude;

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

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public boolean isDefault() { return isDefault; }
    public void setDefault(boolean aDefault) { isDefault = aDefault; }

    public double getLatitude() { return latitude; }
    public void setLatitude(double latitude) { this.latitude = latitude; }

    public double getLongitude() { return longitude; }
    public void setLongitude(double longitude) { this.longitude = longitude; }

    public String getDisplayText() {
        StringBuilder sb = new StringBuilder();
        if (street != null && !street.isEmpty()) sb.append(street);
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
        if ("home".equals(type)) return "🏠";
        if ("work".equals(type)) return "💼";
        return "📍";
    }
}
