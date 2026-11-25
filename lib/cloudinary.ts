/**
 * Uploads an image or video file to Cloudinary with real-time percentage progress tracking.
 * Requires NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET to be set in .env
 */
export const uploadToCloudinary = async (
    file: File,
    onProgress?: (percent: number) => void,
    resourceType: 'image' | 'video' | 'auto' = 'image'
): Promise<string> => {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
        throw new Error('Cloudinary not configured. Please set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET.');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);

    const endpointType = resourceType === 'video' ? 'video' : resourceType === 'auto' ? 'auto' : 'image';

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/${endpointType}/upload`);

        if (onProgress && xhr.upload) {
            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percent = Math.min(99, Math.round((event.loaded / event.total) * 100));
                    onProgress(percent);
                }
            };
        }

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    if (onProgress) onProgress(100);
                    resolve(data.secure_url);
                } catch {
                    reject(new Error('Invalid Cloudinary response JSON'));
                }
            } else {
                try {
                    const errorData = JSON.parse(xhr.responseText);
                    reject(new Error(errorData.error?.message || 'Cloudinary upload failed'));
                } catch {
                    reject(new Error(`Cloudinary upload failed with status ${xhr.status}`));
                }
            }
        };

        xhr.onerror = () => reject(new Error('Network error during Cloudinary upload'));
        xhr.ontimeout = () => reject(new Error('Cloudinary upload timed out'));

        xhr.send(formData);
    });
};
