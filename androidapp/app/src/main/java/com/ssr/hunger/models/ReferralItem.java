package com.ssr.hunger.models;

import com.google.firebase.Timestamp;
import com.google.firebase.firestore.DocumentSnapshot;
import java.util.Date;

/**
 * Model representing a referral tracking entry.
 */
public class ReferralItem {
    private String id;
    private String referrerId;
    private String referredUserId;
    private String referredUserName;
    private String referredUserEmail;
    private String referredUserPhone;
    private String referralCode;
    private double rewardAmount;
    private String status;
    private Date createdAt;
    private String channel;

    public ReferralItem() {}

    public static ReferralItem fromSnapshot(DocumentSnapshot doc) {
        if (doc == null || !doc.exists()) return null;
        ReferralItem item = new ReferralItem();
        item.setId(doc.getId());
        item.setReferrerId(doc.getString("referrerId"));
        item.setReferredUserId(doc.getString("referredUserId"));

        String name = doc.getString("referredUserName");
        if (name == null || name.trim().isEmpty()) {
            String email = doc.getString("referredUserEmail");
            if (email != null && email.contains("@")) {
                name = email.split("@")[0];
            } else {
                String phone = doc.getString("referredUserPhone");
                if (phone != null && phone.length() >= 4) {
                    name = "User *" + phone.substring(phone.length() - 4);
                } else {
                    name = "AKR Friend";
                }
            }
        }
        item.setReferredUserName(name);
        item.setReferredUserEmail(doc.getString("referredUserEmail"));
        item.setReferredUserPhone(doc.getString("referredUserPhone"));
        item.setReferralCode(doc.getString("referralCode"));

        Double amt = doc.getDouble("rewardAmount");
        item.setRewardAmount(amt != null ? amt : 50.0);

        String st = doc.getString("status");
        item.setStatus(st != null ? st : "completed");

        Timestamp ts = doc.getTimestamp("createdAt");
        item.setCreatedAt(ts != null ? ts.toDate() : new Date());
        item.setChannel(doc.getString("channel"));
        return item;
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getReferrerId() { return referrerId; }
    public void setReferrerId(String referrerId) { this.referrerId = referrerId; }

    public String getReferredUserId() { return referredUserId; }
    public void setReferredUserId(String referredUserId) { this.referredUserId = referredUserId; }

    public String getReferredUserName() { return referredUserName != null ? referredUserName : "Friend"; }
    public void setReferredUserName(String referredUserName) { this.referredUserName = referredUserName; }

    public String getReferredUserEmail() { return referredUserEmail; }
    public void setReferredUserEmail(String referredUserEmail) { this.referredUserEmail = referredUserEmail; }

    public String getReferredUserPhone() { return referredUserPhone; }
    public void setReferredUserPhone(String referredUserPhone) { this.referredUserPhone = referredUserPhone; }

    public String getReferralCode() { return referralCode; }
    public void setReferralCode(String referralCode) { this.referralCode = referralCode; }

    public double getRewardAmount() { return rewardAmount > 0 ? rewardAmount : 50.0; }
    public void setRewardAmount(double rewardAmount) { this.rewardAmount = rewardAmount; }

    public String getStatus() { return status != null ? status : "completed"; }
    public void setStatus(String status) { this.status = status; }

    public Date getCreatedAt() { return createdAt != null ? createdAt : new Date(); }
    public void setCreatedAt(Date createdAt) { this.createdAt = createdAt; }

    public String getChannel() { return channel != null ? channel : "link"; }
    public void setChannel(String channel) { this.channel = channel; }
}
