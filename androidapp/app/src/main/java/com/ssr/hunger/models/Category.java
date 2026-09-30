package com.ssr.hunger.models;

public class Category {
    private String id;
    private String name;
    private String icon;
    private int colorRes;

    public Category(String id, String name, String icon, int colorRes) {
        this.id = id;
        this.name = name;
        this.icon = icon;
        this.colorRes = colorRes;
    }

    public String getId() { return id; }
    public String getName() { return name; }
    public String getIcon() { return icon; }
    public int getColorRes() { return colorRes; }
}
