package com.ssr.hunger.models;

import java.util.List;

public class Restaurant {
    private String id;
    private String name;
    private String description;
    private String image;
    private double rating;
    private int reviews;
    private int deliveryTime;
    private double deliveryCharge;
    private double minimumOrder;
    private List<String> cuisineType;
    private boolean isOpen;
    private boolean isActive;
    private String address;
    private String street;
    private String city;
    private String state;
    private String pincode;
    private double latitude;
    private double longitude;
    private String phone;
    private String email;
    private double averageRating;
    private int totalReviews;
    private List<String> servicePincodes;

    public Restaurant() {}

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getImage() { return image; }
    public void setImage(String image) { this.image = image; }

    public double getRating() { return rating; }
    public void setRating(double rating) { this.rating = rating; }

    public int getReviews() { return reviews; }
    public void setReviews(int reviews) { this.reviews = reviews; }

    public int getDeliveryTime() { return deliveryTime; }
    public void setDeliveryTime(int deliveryTime) { this.deliveryTime = deliveryTime; }

    public double getDeliveryCharge() { return deliveryCharge; }
    public void setDeliveryCharge(double deliveryCharge) { this.deliveryCharge = deliveryCharge; }

    public double getMinimumOrder() { return minimumOrder; }
    public void setMinimumOrder(double minimumOrder) { this.minimumOrder = minimumOrder; }

    public List<String> getCuisineType() { return cuisineType; }
    public void setCuisineType(List<String> cuisineType) { this.cuisineType = cuisineType; }

    public boolean isOpen() { return isOpen; }
    public void setOpen(boolean open) { isOpen = open; }

    public boolean isActive() { return isActive; }
    public void setActive(boolean active) { isActive = active; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public String getStreet() { return street; }
    public void setStreet(String street) { this.street = street; }

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }

    public String getState() { return state; }
    public void setState(String state) { this.state = state; }

    public String getPincode() { return pincode; }
    public void setPincode(String pincode) { this.pincode = pincode; }

    public double getLatitude() { return latitude; }
    public void setLatitude(double latitude) { this.latitude = latitude; }

    public double getLongitude() { return longitude; }
    public void setLongitude(double longitude) { this.longitude = longitude; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public double getAverageRating() { return averageRating; }
    public void setAverageRating(double averageRating) { this.averageRating = averageRating; }

    public int getTotalReviews() { return totalReviews; }
    public void setTotalReviews(int totalReviews) { this.totalReviews = totalReviews; }

    public List<String> getServicePincodes() { return servicePincodes; }
    public void setServicePincodes(List<String> servicePincodes) { this.servicePincodes = servicePincodes; }

    public String getCuisineString() {
        if (cuisineType == null || cuisineType.isEmpty()) return "Multi-cuisine";
        return String.join(", ", cuisineType);
    }

    public String getDisplayRating() {
        if (averageRating > 0) return String.format("%.1f", averageRating);
        if (rating > 0) return String.format("%.1f", rating);
        return "4.5";
    }
}
