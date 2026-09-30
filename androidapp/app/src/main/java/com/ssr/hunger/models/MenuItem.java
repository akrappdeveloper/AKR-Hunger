package com.ssr.hunger.models;

import java.util.List;
import java.util.Map;

public class MenuItem {
    private String id;
    private String restaurantId;
    private String name;
    private String description;
    private String image;
    private List<String> images;
    private double price;
    private String category;
    private boolean vegetarian;
    private boolean spicy;
    private boolean available;
    private int preparationTime;
    private boolean isBestSeller;
    private boolean isNew;
    private double averageRating;
    private int totalReviews;
    private String approvalStatus;
    private boolean isLive;
    private List<String> tags;
    private List<String> allergens;
    private String restaurantName; // Joined field

    public MenuItem() {}

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getRestaurantId() { return restaurantId; }
    public void setRestaurantId(String restaurantId) { this.restaurantId = restaurantId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getImage() { return image; }
    public void setImage(String image) { this.image = image; }

    public List<String> getImages() { return images; }
    public void setImages(List<String> images) { this.images = images; }

    public double getPrice() { return price; }
    public void setPrice(double price) { this.price = price; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public boolean isVegetarian() { return vegetarian; }
    public void setVegetarian(boolean vegetarian) { this.vegetarian = vegetarian; }

    public boolean isSpicy() { return spicy; }
    public void setSpicy(boolean spicy) { this.spicy = spicy; }

    public boolean isAvailable() { return available; }
    public void setAvailable(boolean available) { this.available = available; }

    public int getPreparationTime() { return preparationTime; }
    public void setPreparationTime(int preparationTime) { this.preparationTime = preparationTime; }

    public boolean isBestSeller() { return isBestSeller; }
    public void setBestSeller(boolean bestSeller) { isBestSeller = bestSeller; }

    public boolean isNew() { return isNew; }
    public void setNew(boolean aNew) { isNew = aNew; }

    public double getAverageRating() { return averageRating; }
    public void setAverageRating(double averageRating) { this.averageRating = averageRating; }

    public int getTotalReviews() { return totalReviews; }
    public void setTotalReviews(int totalReviews) { this.totalReviews = totalReviews; }

    public String getApprovalStatus() { return approvalStatus; }
    public void setApprovalStatus(String approvalStatus) { this.approvalStatus = approvalStatus; }

    public boolean isLive() { return isLive; }
    public void setLive(boolean live) { isLive = live; }

    public List<String> getTags() { return tags; }
    public void setTags(List<String> tags) { this.tags = tags; }

    public List<String> getAllergens() { return allergens; }
    public void setAllergens(List<String> allergens) { this.allergens = allergens; }

    public String getRestaurantName() { return restaurantName; }
    public void setRestaurantName(String restaurantName) { this.restaurantName = restaurantName; }

    /** Check if this item should be shown to customers */
    public boolean isVisibleToCustomers() {
        return "approved".equals(approvalStatus) && isLive;
    }
}
