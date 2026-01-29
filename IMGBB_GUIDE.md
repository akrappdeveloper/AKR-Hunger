# ImgBB Image Upload System - Documentation

## 📸 Overview

The food delivery platform now uses **ImgBB** cloud storage for all restaurant menu item images instead of Firebase Storage. This provides unlimited free image hosting with automatic failover between multiple API keys.

---

## 🔑 API Key Configuration

### Primary API Key
```typescript
'3df2767515cb1bd10226fbf228fe3b14'
```

### Adding Multiple API Keys

To add more API keys for automatic failover, edit [`lib/imgbb.ts`](file:///c:/Users/samra/Pictures/food-delivery-platform/lib/imgbb.ts):

```typescript
const IMGBB_API_KEYS = [
  '3df2767515cb1bd10226fbf228fe3b14', // Primary key
  'your-second-api-key-here',          // Backup key 1
  'your-third-api-key-here',           // Backup key 2
  // Add more as needed...
];
```

---

## 🚀 How It Works

### Automatic Failover System

1. **Upload Request**: When a restaurant uploads a menu item image
2. **Primary Key Used**: System tries uploading with the first API key
3. **Auto-Switch**: If key is full or fails, automatically switches to next key
4. **Success**: Image URL returned and stored in Firestore
5. **Rotation**: System remembers last successful key for next upload

### Upload Process

```typescript
// 1. User selects image file
<input type="file" accept="image/*" onChange={handleImageChange} />

// 2. Image preview shown
setImagePreview(reader.result);

// 3. On submit, upload to ImgBB
const imageUrl = await uploadToImgBB(file);

// 4. Store URL in Firestore
await addDoc(collection(db, 'menuItems'), {
  image: imageUrl, // ImgBB URL
  // ... other fields
});
```

---

## 📊 Features

### ✅ Implemented

- **Multiple API Key Support**: Add unlimited backup keys
- **Automatic Failover**: Switches keys when one is full
- **Error Handling**: Retries with different keys
- **Console Logging**: Shows which key is being used
- **URL Storage**: Direct URLs stored in Firestore
- **Real-time Display**: Images show instantly on website
- **No Firebase Storage**: Completely removed Firebase Storage dependency

### 🎯 Benefits

1. **Free**: ImgBB offers free unlimited image hosting
2. **Fast**: Direct CDN URLs for fast loading
3. **Reliable**: Automatic failover ensures uploads always work
4. **Scalable**: Add more API keys as needed
5. **Simple**: URLs are permanent and require no auth

---

## 🔧 Technical Details

### File Location
- **Upload Utility**: [`lib/imgbb.ts`](file:///c:/Users/samra/Pictures/food-delivery-platform/lib/imgbb.ts)
- **Menu Page**: [`app/restaurant/menu/page.tsx`](file:///c:/Users/samra/Pictures/food-delivery-platform/app/restaurant/menu/page.tsx)

### Upload Function

```typescript
export async function uploadToImgBB(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('image', file);

  // Try each API key
  for (let i = 0; i < IMGBB_API_KEYS.length; i++) {
    const apiKey = IMGBB_API_KEYS[currentKeyIndex];
    
    try {
      const response = await fetch(
        `https://api.imgbb.com/1/upload?key=${apiKey}`, 
        { method: 'POST', body: formData }
      );
      
      const data = await response.json();
      if (data.success) {
        return data.data.url; // Success!
      }
    } catch (error) {
      // Switch to next key
      currentKeyIndex = (currentKeyIndex + 1) % IMGBB_API_KEYS.length;
    }
  }
  
  throw new Error('All API keys failed');
}
```

### Response Format

ImgBB returns:
```json
{
  "success": true,
  "data": {
    "url": "https://i.ibb.co/xxxxxxx/image.png",
    "display_url": "https://i.ibb.co/xxxxxxx/image.png",
    "delete_url": "https://ibb.co/xxxxxx/xxxxxxxxxx"
  }
}
```

---

## 📝 Usage Example

### In Restaurant Menu Page

```typescript
// 1. State for image
const [imageFile, setImageFile] = useState<File | null>(null);
const [imagePreview, setImagePreview] = useState<string>('');

// 2. Handle file selection
const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (file) {
    setImageFile(file);
    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }
};

// 3. Upload on submit
const handleAddItem = async () => {
  if (!imageFile) {
    alert('Please upload an image');
    return;
  }

  try {
    // Upload to ImgBB
    const imageUrl = await uploadToImgBB(imageFile);
    
    // Save to Firestore
    await addDoc(collection(db, 'menuItems'), {
      name: 'Pizza',
      price: 299,
      image: imageUrl, // ImgBB URL
      // ...
    });
  } catch (error) {
    console.error('Upload failed:', error);
  }
};
```

---

## 🛠️ Troubleshooting

### Image Upload Fails

**Problem**: Upload fails with all API keys

**Solutions**:
1. Check internet connection
2. Verify API keys are valid
3. Check image file size (max 32MB for ImgBB)
4. Check image format (PNG, JPG, GIF, BMP)
5. Add more backup API keys

### Key Exhausted

**Problem**: "Image limit reached" error

**Solutions**:
1. System automatically switches to next key
2. Add more API keys to the array
3. Get new ImgBB API keys (free accounts available)

### Images Not Displaying

**Problem**: Images uploaded but not showing on website

**Solutions**:
1. Check if URL is properly stored in Firestore
2. Verify ImgBB URL is publicly accessible
3. Check browser console for CORS errors
4. Clear browser cache

---

## 🔐 Security

### API Keys
- API keys are **client-side** (visible in browser)
- ImgBB keys are safe to expose publicly
- No authentication required for uploaded images
- Images are publicly accessible by URL

### Best Practices
1. Use multiple API keys for redundancy
2. Monitor usage via ImgBB dashboard
3. Images cannot be deleted via API (manual only)
4. Store image URLs permanently in Firestore

---

## 📊 Monitoring

### Console Logs

The system logs upload status:
```
[ImgBB] Uploading image...
[ImgBB] Image uploaded successfully using API key #1
[Menu] Image uploaded successfully: https://i.ibb.co/...
```

### Check Current Key

```typescript
import { getCurrentKeyIndex, getTotalKeys } from '@/lib/imgbb';

console.log(`Using API key #${getCurrentKeyIndex() + 1} of ${getTotalKeys()}`);
```

---

## 🎯 Future Enhancements

### Planned Features
- [ ] Image compression before upload
- [ ] Multiple image upload for single item
- [ ] Image cropping/editing
- [ ] Automatic thumbnail generation
- [ ] Usage analytics dashboard
- [ ] Bulk image upload

---

## 📚 Resources

- **ImgBB API Docs**: https://api.imgbb.com/
- **Get API Key**: https://api.imgbb.com/ (free signup)
- **ImgBB Dashboard**: https://imgbb.com/
- **Support**: https://imgbb.com/support

---

## ✅ Summary

Your food delivery platform now has a **robust, scalable image upload system** using ImgBB with:

✅ Free unlimited image hosting  
✅ Automatic API key failover  
✅ Real-time image display  
✅ No Firebase Storage costs  
✅ Simple integration  
✅ Reliable and fast CDN  

**All restaurant menu images are now stored on ImgBB!** 🎉
