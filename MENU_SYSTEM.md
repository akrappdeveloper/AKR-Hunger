# Menu Management System - Complete Guide

## 🎉 Overview

Your food delivery platform now has a complete **Menu Management System** with **Image Upload** and **Admin Approval Workflow**!

---

## ✨ Features Implemented

### 1. **Restaurant Menu Management** (`/restaurant/menu`)

#### ✅ Dialog-Based Form
- Click "Add New Item" button to open a beautiful dialog
- Clean, organized form layout
- Easy to use interface

#### ✅ Image Upload
- Upload food images directly from your device
- **Image preview** before submission
- Supports PNG, JPG formats (up to 5MB)
- Images stored in **Firebase Storage**
- Auto-generates unique URLs for each image

#### ✅ Comprehensive Item Details
- **Item Name** (required)
- **Category** (e.g., Pizzas, Starters, Desserts)
- **Description** (detailed dish description)
- **Price** (₹) (required)
- **Attributes**: 
  - 🥬 Vegetarian
  - 🌶️ Spicy
  - ✅ Available

#### ✅ Status Tracking
- **Pending Approval** 🕐 - Item submitted, waiting for admin
- **Live** ✅ - Item approved and visible to customers
- **Rejected** ❌ - Item rejected with reason

#### ✅ Visual Menu Display
- Items grouped by **category**
- Expandable/collapsible categories
- Shows item images
- Displays all item details
- Quick delete option

---

### 2. **Admin Approval System** (`/admin/menu-approvals`)

#### ✅ Three-Tab Interface
1. **Pending** - New items awaiting review
2. **Approved** - Items that are live or can be made live
3. **Rejected** - Items that were rejected

#### ✅ Approval Actions
- **Approve & Make Live** - Instantly publish item to website
- **Reject** - Reject with detailed reason
- **Toggle Live Status** - Turn approved items on/off

#### ✅ Visual Review
- Large preview of item image
- All item details displayed
- Restaurant information included
- Submission timestamp

#### ✅ Rejection Reasons
- Admin can provide detailed feedback
- Restaurant owners see why item was rejected
- Helps improve future submissions

---

### 3. **Customer Experience**

#### ✅ Only Approved Items Shown
- Customers see **ONLY** approved and live items
- Pending items are hidden
- Rejected items are hidden
- Safe, curated menu experience

#### ✅ Restaurant Page
- Beautiful menu display
- Items organized by category
- High-quality food images
- Complete item details

---

## 🔄 Complete Workflow

### Restaurant Owner Flow:

1. **Login** to restaurant portal (`/restaurant/login`)
2. Navigate to **Menu Management** (`/restaurant/menu`)
3. Click **"Add New Item"**
4. Fill in details:
   - Upload food image
   - Enter name, category, price
   - Add description
   - Set attributes (veg/spicy/available)
5. Click **"Submit for Approval"**
6. Item shows as **"Pending Approval"**
7. Wait for admin review

### Admin Flow:

1. **Login** to admin panel (`/admin/login`)
2. Click **"Menu Approvals"** in sidebar
3. Review **Pending** items
4. For each item:
   - **Approve**: Item goes live immediately
   - **Reject**: Provide reason, restaurant sees feedback
5. Manage **approved items** (toggle live/offline)

### Customer Flow:

1. Browse restaurants on homepage
2. Click on a restaurant
3. See **only approved & live** menu items
4. Add items to cart and order

---

## 🗂️ Files Created/Modified

### New Files:
- ✅ `app/restaurant/menu/page.tsx` - Enhanced restaurant menu page
- ✅ `app/admin/menu-approvals/page.tsx` - Admin approval dashboard
- ✅ `MENU_SYSTEM.md` - This documentation

### Modified Files:
- ✅ `lib/types.ts` - Added approval workflow fields
- ✅ `firestore.rules` - Updated security rules
- ✅ `app/api/restaurants/[id]/route.ts` - Filter approved items only
- ✅ `components/admin/AdminSidebar.tsx` - Added menu approvals link

---

## 📊 Database Schema

### MenuItem Fields:
```typescript
{
  id: string;
  restaurantId: string;
  name: string;
  description: string;
  image: string;              // Firebase Storage URL
  price: number;
  category: string;
  vegetarian: boolean;
  spicy: boolean;
  available: boolean;
  
  // Approval Workflow
  approvalStatus: 'pending' | 'approved' | 'rejected';
  isLive: boolean;            // Controls customer visibility
  submittedAt: Date;
  approvedAt?: Date;
  rejectionReason?: string;
  
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 🔐 Security Rules

### Firestore Rules:
- ✅ Restaurants can **create** items (auto-pending)
- ✅ Restaurants can **update/delete** their own items
- ✅ Admins can **update/delete** any items
- ✅ Public can **read** all items (API filters approved ones)

---

## 🎨 UI/UX Features

### Restaurant Menu Page:
- Modern dialog interface
- Drag-and-drop image upload
- Real-time image preview
- Status badges (Pending/Live/Rejected)
- Organized by categories
- Responsive design

### Admin Approval Page:
- Tabbed interface for easy navigation
- Large image previews
- Color-coded status badges
- Quick approve/reject buttons
- Rejection reason input
- Live toggle for approved items

---

## 📱 Testing Guide

### Test Restaurant Submission:
1. Create restaurant account
2. Add a menu item with all details
3. Upload an image
4. Submit and verify "Pending" status

### Test Admin Approval:
1. Login as admin
2. Go to Menu Approvals
3. See pending item
4. Approve it
5. Verify it appears on customer side

### Test Customer View:
1. Browse as customer
2. Open restaurant page
3. Verify only approved items show
4. Pending items should not appear

---

## 🚀 Benefits

1. **Quality Control** - Admin reviews all items before going live
2. **Professional Images** - All items have photos
3. **Clear Communication** - Rejection reasons help restaurants improve
4. **Safe for Customers** - Only curated, approved content shown
5. **Easy Management** - Simple interface for all parties
6. **Scalable** - Handles unlimited items and restaurants

---

## 📝 Admin Credentials

To access admin panel:
- URL: `/admin/login`
- Create admin user in Firestore `admins` collection

---

## 🎯 Next Steps

### Suggested Enhancements:
- [ ] Email notifications when items are approved/rejected
- [ ] Bulk approve/reject
- [ ] Item editing after submission
- [ ] Category suggestions
- [ ] Multi-image upload per item
- [ ] Item variants (sizes, toppings)
- [ ] Analytics dashboard for popular items

---

## 💡 Tips for Restaurant Owners

1. **High-Quality Images** - Use clear, well-lit food photos
2. **Detailed Descriptions** - Help customers understand your dishes
3. **Accurate Pricing** - Double-check before submitting
4. **Proper Categories** - Makes browsing easier
5. **Check Status** - Monitor approval status regularly

---

## 🛠️ Troubleshooting

### Item not appearing?
- Check approval status (must be "Approved")
- Verify `isLive` is `true`
- Refresh the page

### Image not uploading?
- Check file size (max 5MB)
- Use JPG or PNG format
- Try a different image

### Can't approve as admin?
- Verify admin credentials
- Check you're logged in to admin panel
- Ensure Firestore rules allow admin access

---

## 🎊 Summary

You now have a **complete, production-ready menu management system** with:
- ✅ Image upload capability
- ✅ Dialog-based forms
- ✅ Admin approval workflow
- ✅ Status tracking
- ✅ Rejection feedback
- ✅ Customer safety (only approved items shown)
- ✅ Beautiful UI/UX

**Everything is ready to use!** 🎉
