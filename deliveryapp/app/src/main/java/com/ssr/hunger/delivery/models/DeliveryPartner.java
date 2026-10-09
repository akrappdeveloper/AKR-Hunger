package com.ssr.hunger.delivery.models;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

public class DeliveryPartner implements Serializable {
    private String uid;
    private String name;
    private String email;
    private String phone;
    private String vehicleType;
    private String vehicleNumber;
    private String licenseNumber;
    private String emergencyContact;
    private boolean isAvailable;
    private String status; // "online" or "offline"
    private String kycStatus; // "pending", "approved", "rejected"
    private boolean isVerified;
    private List<String> servicePincodes;
    private boolean pincodeFilterActive;
    private double todayEarnings;
    private double totalEarnings;
    private double walletBalance;
    private double rating;
    private int totalDeliveries;
    private int fairRouteScore;
    private String activeOrderId;
    private String fcmToken;

    public DeliveryPartner() {
        this.servicePincodes = new ArrayList<>();
        this.rating = 5.0;
        this.fairRouteScore = 85;
        this.status = "offline";
        this.kycStatus = "pending";
    }

    // Getters and Setters
    public String getUid() { return uid; }
    public void setUid(String uid) { this.uid = uid; }

    public String getName() { return name != null ? name : "Partner"; }
    public void setName(String name) { this.name = name; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getVehicleType() { return vehicleType != null ? vehicleType : "Motorcycle"; }
    public void setVehicleType(String vehicleType) { this.vehicleType = vehicleType; }

    public String getVehicleNumber() { return vehicleNumber != null ? vehicleNumber : "-"; }
    public void setVehicleNumber(String vehicleNumber) { this.vehicleNumber = vehicleNumber; }

    public String getLicenseNumber() { return licenseNumber != null ? licenseNumber : "-"; }
    public void setLicenseNumber(String licenseNumber) { this.licenseNumber = licenseNumber; }

    public String getEmergencyContact() { return emergencyContact; }
    public void setEmergencyContact(String emergencyContact) { this.emergencyContact = emergencyContact; }

    public boolean isAvailable() { return isAvailable; }
    public void setAvailable(boolean available) { isAvailable = available; }

    public String getStatus() { return status != null ? status : "offline"; }
    public void setStatus(String status) { this.status = status; }

    public String getKycStatus() { return kycStatus != null ? kycStatus : "pending"; }
    public void setKycStatus(String kycStatus) { this.kycStatus = kycStatus; }

    public boolean isVerified() { return isVerified || "approved".equalsIgnoreCase(kycStatus); }
    public void setVerified(boolean verified) { isVerified = verified; }

    public List<String> getServicePincodes() {
        return servicePincodes != null ? servicePincodes : new ArrayList<>();
    }
    public void setServicePincodes(List<String> servicePincodes) { this.servicePincodes = servicePincodes; }

    public boolean isPincodeFilterActive() { return pincodeFilterActive; }
    public void setPincodeFilterActive(boolean pincodeFilterActive) { this.pincodeFilterActive = pincodeFilterActive; }

    public double getTodayEarnings() { return todayEarnings; }
    public void setTodayEarnings(double todayEarnings) { this.todayEarnings = todayEarnings; }

    public double getTotalEarnings() { return totalEarnings; }
    public void setTotalEarnings(double totalEarnings) { this.totalEarnings = totalEarnings; }

    public double getWalletBalance() { return walletBalance; }
    public void setWalletBalance(double walletBalance) { this.walletBalance = walletBalance; }

    public double getRating() { return rating > 0 ? rating : 5.0; }
    public void setRating(double rating) { this.rating = rating; }

    public int getTotalDeliveries() { return totalDeliveries; }
    public void setTotalDeliveries(int totalDeliveries) { this.totalDeliveries = totalDeliveries; }

    public int getFairRouteScore() { return fairRouteScore > 0 ? fairRouteScore : 85; }
    public void setFairRouteScore(int fairRouteScore) { this.fairRouteScore = fairRouteScore; }

    public String getActiveOrderId() { return activeOrderId; }
    public void setActiveOrderId(String activeOrderId) { this.activeOrderId = activeOrderId; }

    public String getFcmToken() { return fcmToken; }
    public void setFcmToken(String fcmToken) { this.fcmToken = fcmToken; }

    public boolean isOnline() {
        return isAvailable || "online".equalsIgnoreCase(status);
    }
}
