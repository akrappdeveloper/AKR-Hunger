package com.ssr.hunger.delivery.models;

import java.io.Serializable;

public class PartnerStats implements Serializable {
    private double baseEarnings;
    private double bonusEarnings;
    private double pendingSettlement;
    private int totalOrders;
    private double totalDistanceKm;
    private double averageRating;
    private int fairRouteScore;
    private int totalTimeMinutes;
    private int waitingTimeMinutes;

    public PartnerStats() {
        this.averageRating = 4.9;
        this.fairRouteScore = 88;
    }

    public double getBaseEarnings() { return baseEarnings; }
    public void setBaseEarnings(double baseEarnings) { this.baseEarnings = baseEarnings; }

    public double getBonusEarnings() { return bonusEarnings; }
    public void setBonusEarnings(double bonusEarnings) { this.bonusEarnings = bonusEarnings; }

    public double getTotalEarnings() { return baseEarnings + bonusEarnings; }

    public double getPendingSettlement() { return pendingSettlement; }
    public void setPendingSettlement(double pendingSettlement) { this.pendingSettlement = pendingSettlement; }

    public int getTotalOrders() { return totalOrders; }
    public void setTotalOrders(int totalOrders) { this.totalOrders = totalOrders; }

    public double getTotalDistanceKm() { return totalDistanceKm; }
    public void setTotalDistanceKm(double totalDistanceKm) { this.totalDistanceKm = totalDistanceKm; }

    public double getAverageRating() { return averageRating > 0 ? averageRating : 5.0; }
    public void setAverageRating(double averageRating) { this.averageRating = averageRating; }

    public int getFairRouteScore() { return fairRouteScore > 0 ? fairRouteScore : 85; }
    public void setFairRouteScore(int fairRouteScore) { this.fairRouteScore = fairRouteScore; }

    public int getTotalTimeMinutes() { return totalTimeMinutes; }
    public void setTotalTimeMinutes(int totalTimeMinutes) { this.totalTimeMinutes = totalTimeMinutes; }

    public int getWaitingTimeMinutes() { return waitingTimeMinutes; }
    public void setWaitingTimeMinutes(int waitingTimeMinutes) { this.waitingTimeMinutes = waitingTimeMinutes; }
}
