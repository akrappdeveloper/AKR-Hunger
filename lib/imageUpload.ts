import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { uploadToImgBB } from '@/lib/imgbb';

/**
 * Compresses an image in browser memory using HTML5 Canvas to a lightweight base64 Data URL.
 * Produces high-quality, lightweight images (usually 25KB - 60KB), ensuring it never fails
 * even if cloud storage services (Firebase Storage / ImgBB) are unreachable or rate-limited.
 */
export async function compressImageToDataUrl(file: File, maxWidth = 800, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(event.target?.result as string);
            return;
          }

          // White background for PNG transparency if converted to JPEG
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        } catch (e) {
          resolve(event.target?.result as string);
        }
      };
      img.onerror = () => resolve(event.target?.result as string);
      img.src = event.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads an image with multi-tier failover:
 * Tier 1: Firebase Storage (native, secure, unlimited)
 * Tier 2: ImgBB Cloud API
 * Tier 3: In-browser Canvas compression to Data URL (instant, 100% fail-safe)
 */
export async function uploadImage(file: File, folder = 'menu-items', ownerId = 'restaurant'): Promise<string> {
  // If the file is already a string URL or data URL
  if (typeof file === 'string') {
    return file;
  }

  // Tier 1: Try Firebase Storage
  try {
    if (storage) {
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `${folder}/${ownerId}/${Date.now()}_${safeName}`;
      const storageRef = ref(storage, storagePath);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(snapshot.ref);
      if (downloadUrl && downloadUrl.startsWith('http')) {
        console.log('[ImageUpload] Uploaded via Firebase Storage:', downloadUrl);
        return downloadUrl;
      }
    }
  } catch (storageErr: any) {
    console.warn('[ImageUpload] Firebase Storage upload error, falling back to ImgBB:', storageErr?.message);
  }

  // Tier 2: Try ImgBB
  try {
    const imgbbUrl = await uploadToImgBB(file);
    if (imgbbUrl && imgbbUrl.startsWith('http')) {
      console.log('[ImageUpload] Uploaded via ImgBB:', imgbbUrl);
      return imgbbUrl;
    }
  } catch (imgbbErr: any) {
    console.warn('[ImageUpload] ImgBB upload error, falling back to Canvas Data URL:', imgbbErr?.message);
  }

  // Tier 3: Local Canvas Compression (Fail-safe)
  try {
    const dataUrl = await compressImageToDataUrl(file);
    console.log('[ImageUpload] Compressed image to Data URL fallback');
    return dataUrl;
  } catch (compressionErr: any) {
    console.error('[ImageUpload] All upload strategies failed:', compressionErr);
    throw new Error('Could not process image file. Please try another image.');
  }
}
