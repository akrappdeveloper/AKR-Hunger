package com.ssr.hunger.models;

import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.IgnoreExtraProperties;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@IgnoreExtraProperties
public class MenuItem {
    public static class CustomizationOption {
        private String id;
        private String name;
        private double price;
        private String desc;

        public CustomizationOption() {}

        public CustomizationOption(String id, String name, double price, String desc) {
            this.id = id;
            this.name = name;
            this.price = price;
            this.desc = desc;
        }

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }

        public double getPrice() { return price; }
        public void setPrice(double price) { this.price = price; }

        public String getDesc() { return desc; }
        public void setDesc(String desc) { this.desc = desc; }
    }
    private String id;
    private String restaurantId;
    private String name;
    private String description;
    private String image;
    private List<String> images;
    private double price;
    private double originalPrice;
    private int calories;
    private String category;
    private boolean vegetarian;
    private boolean spicy;
    private boolean available = true;
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
    // Nutrition & Customization (new fields)
    private int servings;
    private List<String> ingredients;
    private String portionSize;
    private String spiceLevel;
    private boolean isGlutenFree;
    private boolean isJain;
    private boolean isHalal;
    private List<CustomizationOption> addOns;
    private List<CustomizationOption> sizes;

    public MenuItem() {}

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getRestaurantId() { return restaurantId; }
    public void setRestaurantId(String restaurantId) { this.restaurantId = restaurantId; }

    public String getName() { return name != null ? name : "Delicious Item"; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getImage() { return image; }
    public void setImage(String image) { this.image = image; }

    public List<String> getImages() { return images; }
    public void setImages(List<String> images) { this.images = images; }

    public double getPrice() { return price; }
    public void setPrice(double price) { this.price = price; }

    public double getOriginalPrice() { return originalPrice; }
    public void setOriginalPrice(double originalPrice) { this.originalPrice = originalPrice; }

    public int getCalories() { return calories; }
    public void setCalories(int calories) { this.calories = calories; }

    public String getCategory() { return category != null ? category : "General"; }
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

    public int getServings() { return servings > 0 ? servings : 1; }
    public void setServings(int servings) { this.servings = servings; }

    public List<String> getIngredients() { return ingredients; }
    public void setIngredients(List<String> ingredients) { this.ingredients = ingredients; }

    public String getPortionSize() { return portionSize; }
    public void setPortionSize(String portionSize) { this.portionSize = portionSize; }

    public String getSpiceLevel() { return spiceLevel; }
    public void setSpiceLevel(String spiceLevel) { this.spiceLevel = spiceLevel; }

    public boolean isGlutenFree() { return isGlutenFree; }
    public void setGlutenFree(boolean glutenFree) { isGlutenFree = glutenFree; }

    public boolean isJain() { return isJain; }
    public void setJain(boolean jain) { isJain = jain; }

    public boolean isHalal() { return isHalal; }
    public void setHalal(boolean halal) { isHalal = halal; }

    public List<CustomizationOption> getAddOns() { return addOns; }
    public void setAddOns(List<CustomizationOption> addOns) { this.addOns = addOns; }

    public List<CustomizationOption> getSizes() { return sizes; }
    public void setSizes(List<CustomizationOption> sizes) { this.sizes = sizes; }

    /**
     * Check if this item should be shown to customers.
     * Items explicitly marked 'rejected' or unapproved 'pending' items are hidden.
     * Approved items, live items, and standard catalog items are cleanly visible.
     */
    public boolean isVisibleToCustomers() {
        if ("rejected".equalsIgnoreCase(approvalStatus)) {
            return false;
        }
        if ("pending".equalsIgnoreCase(approvalStatus) && !isLive) {
            return false;
        }
        return true;
    }

    /**
     * Safe factory to deserialize a Firestore DocumentSnapshot into a MenuItem,
     * protecting against type mismatches (e.g. Long vs Double, String vs Number).
     */
    public static MenuItem fromSnapshot(DocumentSnapshot doc) {
        if (doc == null || !doc.exists()) return null;

        MenuItem item = null;
        try {
            item = doc.toObject(MenuItem.class);
        } catch (Exception ignored) {}

        if (item == null) {
            item = new MenuItem();
        }
        item.setId(doc.getId());

        // Fill or repair fields
        if (item.name == null || item.name.isEmpty()) {
            item.setName(doc.getString("name"));
        }
        if (item.description == null) {
            item.setDescription(doc.getString("description"));
        }
        if (item.restaurantId == null || item.restaurantId.isEmpty()) {
            String rId = doc.getString("restaurantId");
            if (rId == null) rId = doc.getString("restaurant_id");
            item.setRestaurantId(rId);
        }
        if (item.restaurantName == null || item.restaurantName.isEmpty()) {
            item.setRestaurantName(doc.getString("restaurantName"));
        }
        if (item.category == null || item.category.isEmpty()) {
            item.setCategory(doc.getString("category"));
        }
        if (item.image == null || item.image.isEmpty()) {
            String img = doc.getString("image");
            if (img == null) img = doc.getString("imageUrl");
            item.setImage(img);
        }

        // Safe price conversion
        Object priceObj = doc.get("price");
        if (priceObj instanceof Number) {
            item.setPrice(((Number) priceObj).doubleValue());
        } else if (priceObj instanceof String) {
            try {
                item.setPrice(Double.parseDouble((String) priceObj));
            } catch (Exception ignored) {}
        }

        // Safe original price conversion
        Object origPriceObj = doc.get("originalPrice");
        if (origPriceObj instanceof Number) {
            item.setOriginalPrice(((Number) origPriceObj).doubleValue());
        }

        // Calories
        Object calObj = doc.get("calories");
        if (calObj instanceof Number) {
            item.setCalories(((Number) calObj).intValue());
        }

        // Available
        Boolean avail = doc.getBoolean("available");
        if (avail == null) avail = doc.getBoolean("isAvailable");
        if (avail != null) {
            item.setAvailable(avail);
        }

        // Live
        Boolean live = doc.getBoolean("isLive");
        if (live == null) live = doc.getBoolean("live");
        if (live != null) {
            item.setLive(live);
        }

        // Approval status
        String status = doc.getString("approvalStatus");
        if (status != null) {
            item.setApprovalStatus(status);
        }

        // Veg / Non-Veg
        Boolean veg = doc.getBoolean("vegetarian");
        if (veg == null) veg = doc.getBoolean("isVegetarian");
        if (veg != null) {
            item.setVegetarian(veg);
        }

        // Spicy
        Boolean spicy = doc.getBoolean("spicy");
        if (spicy == null) spicy = doc.getBoolean("isSpicy");
        if (spicy != null) {
            item.setSpicy(spicy);
        }

        // Rating
        Object ratingObj = doc.get("averageRating");
        if (ratingObj == null) ratingObj = doc.get("rating");
        if (ratingObj instanceof Number) {
            item.setAverageRating(((Number) ratingObj).doubleValue());
        }

        // Reviews count
        Object revObj = doc.get("totalReviews");
        if (revObj == null) revObj = doc.get("numReviews");
        if (revObj instanceof Number) {
            item.setTotalReviews(((Number) revObj).intValue());
        }

        // Prep time
        Object prepObj = doc.get("preparationTime");
        if (prepObj == null) prepObj = doc.get("pickupPrepTime");
        if (prepObj instanceof Number) {
            item.setPreparationTime(((Number) prepObj).intValue());
        }

        // Servings
        Object servingsObj = doc.get("servings");
        if (servingsObj instanceof Number) {
            item.setServings(((Number) servingsObj).intValue());
        }

        // Portion size
        String portionSize = doc.getString("portionSize");
        if (portionSize == null) portionSize = doc.getString("servingSize");
        if (portionSize != null) item.setPortionSize(portionSize);

        // Spice level
        String spiceLevel = doc.getString("spiceLevel");
        if (spiceLevel != null) item.setSpiceLevel(spiceLevel);

        // Dietary flags
        Boolean glutenFree = doc.getBoolean("isGlutenFree");
        if (glutenFree != null) item.setGlutenFree(glutenFree);

        Boolean jain = doc.getBoolean("isJain");
        if (jain != null) item.setJain(jain);

        Boolean halal = doc.getBoolean("isHalal");
        if (halal != null) item.setHalal(halal);

        List<CustomizationOption> parsedSizes = parseOptionsList(doc.get("sizes"));
        if (!parsedSizes.isEmpty()) item.setSizes(parsedSizes);

        Object addOnsObj = doc.get("addOns");
        if (addOnsObj == null) addOnsObj = doc.get("addons");
        List<CustomizationOption> parsedAddOns = parseOptionsList(addOnsObj);
        if (!parsedAddOns.isEmpty()) item.setAddOns(parsedAddOns);

        return item;
    }

    private static List<CustomizationOption> parseOptionsList(Object raw) {
        List<CustomizationOption> result = new ArrayList<>();
        if (!(raw instanceof List<?>)) return result;
        int idx = 0;
        for (Object obj : (List<?>) raw) {
            if (obj instanceof Map<?, ?>) {
                Map<?, ?> m = (Map<?, ?>) obj;
                Object nameObj = m.get("name");
                if (nameObj == null) continue;
                String name = String.valueOf(nameObj);
                String id = m.get("id") != null ? String.valueOf(m.get("id")) : "opt_" + idx;
                String desc = m.get("desc") != null ? String.valueOf(m.get("desc")) :
                        (m.get("description") != null ? String.valueOf(m.get("description")) : "");
                double price = 0.0;
                Object pObj = m.get("price");
                if (pObj instanceof Number) {
                    price = ((Number) pObj).doubleValue();
                } else if (pObj instanceof String) {
                    try { price = Double.parseDouble((String) pObj); } catch (Exception ignored) {}
                }
                result.add(new CustomizationOption(id, name, price, desc));
            }
            idx++;
        }
        return result;
    }
}
