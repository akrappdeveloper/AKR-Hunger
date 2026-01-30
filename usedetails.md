# Firestore Indexes & Order Flow Details

## 1. `firestore.indexes.json` Kya Hai Aur Iska Kya Karna Hai?

Yeh file **Firestore Database Indexes** define karti hai. Jab hum complex queries run karte hain (jisme multiple fields `where` aur `orderBy` clauses ke saath use hote hain), toh Firestore ko **Composite Indexes** ki zaroorat hoti hai taaki query efficient ho.

### Isko Firebase Me Kaise Add Karein?

**🚀 Direct Terminal Command (One Click / Recommended)**
Agar aap chahte hain ki ek baar me file se indexes upload ho jayein, toh bas neeche diya gaya code copy karein aur apne terminal me paste karke enter dabayein:

```bash
firebase deploy --only firestore:indexes
```

Yeh command automatically aapki `firestore.indexes.json` file padhegi aur Cloud Firestore par rules update kar degi.

---

#### Alternative: Manual (Firebase Console)
Agar command line kaam na kare, toh:
1. App run karein (`npm run dev`).
2. Delivery Panel me "Marketplace" ya "History" page par jayein.
3. Agar index missing hai, toh Browser Console (F12) me red link aayega.
4. Us link par click karke index create karein.

## 2. Order Status Names (Full List)

Food Delivery Platform me Order ke ye sabhi status ho sakte hain:

| Status Status | Description |
| :--- | :--- |
| `pending` | Customer ne order place kiya, restaurant acceptance ka wait hai. |
| `confirmed` | Restaurant ne order accept kar liya. **(TRIGGER: Yahan order Delivery Panel me show hota hai)** |
| `preparing` | Restaurant khana bana raha hai. |
| `ready` | Khana ban gaya hai aur pickup ke liye taiyar hai. |
| `out_for_delivery` | Delivery Partner ne order pick kar liya hai aur raste me hai. |
| `delivered` | Customer ko order mil gaya hai (Completed). |
| `cancelled` | Order cancel ho gaya. |

---

## 3. Delivery Panel Order Flow (Kab Order Receive Hoga?)

Delivery Panel me order tabhi dikhega jab woh **specific conditions** meet karega.

### A. Marketplace (Available Orders) me Order Kab Aayega?
**File:** `app/delivery/available/page.tsx`

Order "Marketplace" me tab show hoga jab ye teeno conditions true hon:
1. **Status:** `confirmed`, `preparing`, ya `ready` ho.
2. **Assignment:** Order abhi tak kisi delivery boy ko assign **NAHI** hua ho (`deliveryPersonId == null`).
3. **Reason:** Matlab Restaurant ne order accept kar liya hai, lekin koi driver abhi tak nahi mila. Aap yahan se "Accept" kar sakte hain.

> **Note:** Jaise hi aap "Accept" karenge, aapki ID `deliveryPersonId` me save ho jayegi aur order Marketplace se gayab hokar aapke **Dashboard** par aa jayega.

### B. Dashboard (Active Orders) me Order Kab Aayega?
**File:** `app/delivery/page.tsx`

Order aapke main Dashboard par tab dikhega jab:
1. **Assignment:** Order **AAPKO** assign ho chuka hai (`deliveryPersonId == Your UID`).
2. **Status:** Order abhi complete nahi hua hai (`pending`, `confirmed`, `preparing`, `ready`, `out_for_delivery`).
3. **Status Flow:**
   - **Pickup:** Jab aap restaurant pahunchein, Dashboard se status `out_for_delivery` mark karein.
   - **Deliver:** Jab customer ko de dein, Dashboard se status `delivered` mark karein.

### C. History Page me Order Kab Jayega?
**File:** `app/delivery/history/page.tsx`

Order History me tab milega jab:
1. **Assignment:** Order aapne deliver kiya tha.
2. **Status:** `delivered` ho chuka hai.

---

## Summary (Steps by Step)

1. **Customer:** Order karta hai -> Status: `pending`.
2. **Restaurant:** Order accept karta hai -> Status: `confirmed`.
3. **Delivery Panel (Marketplace):** Order yahan `confirmed` status me dikhne lagta hai.
4. **Delivery Partner (You):** "Accept" button dabate hain -> Order ab **Dashboard** par aa jata hai.
5. **Restaurant:** Cooking start karta hai -> Status: `preparing` -> `ready`.
6. **Delivery Partner:** Restaurant pahunch kar khana leta hai -> Status change to `out_for_delivery`.
7. **Delivery Partner:** Customer ke ghar pahunch kar deliver karta hai -> Status change to `delivered`.
8. **Final:** Order abh **History** page par show hoga aur Earning add ho jayegi.
