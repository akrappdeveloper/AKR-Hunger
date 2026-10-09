package com.ssr.hunger.delivery.models;

import java.io.Serializable;

public class OrderItem implements Serializable {
    private String id;
    private String name;
    private int quantity;
    private double price;
    private boolean isVeg;

    public OrderItem() {}

    public OrderItem(String name, int quantity, double price) {
        this.name = name;
        this.quantity = quantity;
        this.price = price;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name != null ? name : "Item"; }
    public void setName(String name) { this.name = name; }

    public int getQuantity() { return quantity > 0 ? quantity : 1; }
    public void setQuantity(int quantity) { this.quantity = quantity; }

    public double getPrice() { return price; }
    public void setPrice(double price) { this.price = price; }

    public boolean isVeg() { return isVeg; }
    public void setVeg(boolean veg) { isVeg = veg; }
}
