package com.ssr.hunger.models;

public class CartItem {
    private String id;
    private String menuItemId;
    private String restaurantId;
    private String name;
    private double price;
    private int quantity;
    private String image;
    private String restaurantName;
    private String category;
    private String specialInstructions;

    public CartItem() {}

    public CartItem(String menuItemId, String restaurantId, String name,
                    double price, int quantity, String image, String restaurantName) {
        this.id = menuItemId + "_" + System.currentTimeMillis();
        this.menuItemId = menuItemId;
        this.restaurantId = restaurantId;
        this.name = name;
        this.price = price;
        this.quantity = quantity;
        this.image = image;
        this.restaurantName = restaurantName;
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getMenuItemId() { return menuItemId; }
    public void setMenuItemId(String menuItemId) { this.menuItemId = menuItemId; }

    public String getRestaurantId() { return restaurantId; }
    public void setRestaurantId(String restaurantId) { this.restaurantId = restaurantId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public double getPrice() { return price; }
    public void setPrice(double price) { this.price = price; }

    public int getQuantity() { return quantity; }
    public void setQuantity(int quantity) { this.quantity = quantity; }

    public String getImage() { return image; }
    public void setImage(String image) { this.image = image; }

    public String getRestaurantName() { return restaurantName; }
    public void setRestaurantName(String restaurantName) { this.restaurantName = restaurantName; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getSpecialInstructions() { return specialInstructions; }
    public void setSpecialInstructions(String specialInstructions) { this.specialInstructions = specialInstructions; }

    public double getTotalPrice() {
        return price * quantity;
    }
}
