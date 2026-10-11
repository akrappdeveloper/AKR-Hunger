package com.ssr.hunger.models;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Map;

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
    private boolean isOpen = true;
    private boolean isCurrentlyOpen = true;
    private boolean isActive = true;
    private Map<String, Object> schedule;
    private List<Map<String, Object>> specialDays;
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
    public void setOpen(boolean open) {
        this.isOpen = open;
        this.isCurrentlyOpen = open;
    }

    public boolean isCurrentlyOpen() { return isCurrentlyOpen; }
    public void setCurrentlyOpen(boolean currentlyOpen) {
        this.isCurrentlyOpen = currentlyOpen;
        this.isOpen = currentlyOpen;
    }

    public boolean isActive() { return isActive; }
    public void setActive(boolean active) { isActive = active; }

    public Map<String, Object> getSchedule() { return schedule; }
    public void setSchedule(Map<String, Object> schedule) { this.schedule = schedule; }

    public List<Map<String, Object>> getSpecialDays() { return specialDays; }
    public void setSpecialDays(List<Map<String, Object>> specialDays) { this.specialDays = specialDays; }

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
        if (averageRating > 0) return String.format(Locale.getDefault(), "%.1f", averageRating);
        if (rating > 0) return String.format(Locale.getDefault(), "%.1f", rating);
        return "4.5";
    }

    public boolean isOperatingNow() {
        if (!isActive) return false;
        if (!isOpen || !isCurrentlyOpen) return false;

        Calendar now = Calendar.getInstance();
        int currentMinutes = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault());
        String todayDate = sdf.format(new Date());

        // Check special days first
        if (specialDays != null) {
            for (Map<String, Object> sd : specialDays) {
                if (sd != null && todayDate.equals(sd.get("date"))) {
                    Object isClosedObj = sd.get("isClosed");
                    if (isClosedObj instanceof Boolean && (Boolean) isClosedObj) {
                        return false;
                    }
                    Object openObj = sd.get("openTime") != null ? sd.get("openTime") : sd.get("open");
                    Object closeObj = sd.get("closeTime") != null ? sd.get("closeTime") : sd.get("close");
                    if (openObj instanceof String && closeObj instanceof String) {
                        int sOpen = parseTimeToMinutes((String) openObj);
                        int sClose = parseTimeToMinutes((String) closeObj);
                        if (sOpen != -1 && sClose != -1) {
                            if (sOpen <= sClose) {
                                return currentMinutes >= sOpen && currentMinutes <= sClose;
                            } else {
                                return currentMinutes >= sOpen || currentMinutes <= sClose;
                            }
                        }
                    }
                }
            }
        }

        // Check regular schedule
        if (schedule != null) {
            String[] days = {"Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"};
            int dayOfWeek = now.get(Calendar.DAY_OF_WEEK) - 1; // 0 = Sunday
            if (dayOfWeek >= 0 && dayOfWeek < days.length) {
                String dayCap = days[dayOfWeek];
                String dayLower = dayCap.toLowerCase(Locale.getDefault());
                Object dayConfigObj = schedule.get(dayCap);
                if (dayConfigObj == null) {
                    dayConfigObj = schedule.get(dayLower);
                }
                if (dayConfigObj instanceof Map) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> dayConfig = (Map<String, Object>) dayConfigObj;
                    Object dayOpenObj = dayConfig.get("isOpen");
                    if (dayOpenObj instanceof Boolean && !(Boolean) dayOpenObj) {
                        return false;
                    }
                    Object openObj = dayConfig.get("openTime") != null ? dayConfig.get("openTime") : dayConfig.get("open");
                    Object closeObj = dayConfig.get("closeTime") != null ? dayConfig.get("closeTime") : dayConfig.get("close");
                    if (openObj instanceof String && closeObj instanceof String) {
                        int oMinutes = parseTimeToMinutes((String) openObj);
                        int cMinutes = parseTimeToMinutes((String) closeObj);
                        if (oMinutes != -1 && cMinutes != -1) {
                            boolean withinHours;
                            if (oMinutes <= cMinutes) {
                                withinHours = currentMinutes >= oMinutes && currentMinutes <= cMinutes;
                            } else {
                                withinHours = currentMinutes >= oMinutes || currentMinutes <= cMinutes;
                            }
                            if (!withinHours) return false;
                        }
                    }
                    // Check break
                    Object bStartObj = dayConfig.get("breakStart");
                    Object bEndObj = dayConfig.get("breakEnd");
                    if (bStartObj instanceof String && bEndObj instanceof String) {
                        int bStart = parseTimeToMinutes((String) bStartObj);
                        int bEnd = parseTimeToMinutes((String) bEndObj);
                        if (bStart != -1 && bEnd != -1 && currentMinutes >= bStart && currentMinutes <= bEnd) {
                            return false;
                        }
                    }
                }
            }
        }

        return true;
    }

    private static int parseTimeToMinutes(String timeStr) {
        if (timeStr == null || !timeStr.contains(":")) return -1;
        try {
            String[] parts = timeStr.trim().split(":");
            int h = Integer.parseInt(parts[0].trim());
            int m = Integer.parseInt(parts[1].trim());
            return h * 60 + m;
        } catch (Exception e) {
            return -1;
        }
    }

    public List<String> getServicePincodes() {
        return servicePincodes;
    }

    public void setServicePincodes(List<String> servicePincodes) {
        this.servicePincodes = servicePincodes;
    }

    public boolean isServingPincode(String userPincode) {
        if (userPincode == null || userPincode.trim().isEmpty()) {
            return true;
        }
        String cleanPin = userPincode.trim();
        if (servicePincodes != null && !servicePincodes.isEmpty()) {
            for (String sp : servicePincodes) {
                if (sp != null && sp.trim().equals(cleanPin)) {
                    return true;
                }
            }
            return false;
        }
        if (pincode != null && !pincode.trim().isEmpty()) {
            return pincode.trim().equals(cleanPin);
        }
        return true;
    }
}
