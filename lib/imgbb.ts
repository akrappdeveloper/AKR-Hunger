// ImgBB API Configuration with multiple keys for automatic failover
const envKey = process.env.NEXT_PUBLIC_IMGBB_API_KEY;
const IMGBB_API_KEYS = [
    ...(envKey ? [envKey] : []),
    '3df2767515cb1bd10226fbf228fe3b14', // Primary key
    '60a7cee875f118da8292eed17cc0c0c3', // 2nd key
];

let currentKeyIndex = 0;

/**
 * Upload image to ImgBB
 * Automatically switches to next API key if current one fails
 */
export async function uploadToImgBB(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('image', file);

    let lastError: Error | null = null;
    const maxRetries = IMGBB_API_KEYS.length;

    // Try each API key until one succeeds
    for (let i = 0; i < maxRetries; i++) {
        const apiKey = IMGBB_API_KEYS[currentKeyIndex];

        try {
            const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`ImgBB API error: ${response.status}`);
            }

            const data = await response.json();

            if (data.success && data.data && data.data.url) {
                console.log(`[ImgBB] Image uploaded successfully using API key #${currentKeyIndex + 1}`);
                return data.data.url; // Return the image URL
            } else {
                throw new Error('Invalid response from ImgBB');
            }
        } catch (error) {
            console.error(`[ImgBB] Upload failed with API key #${currentKeyIndex + 1}:`, error);
            lastError = error as Error;

            // Switch to next API key
            currentKeyIndex = (currentKeyIndex + 1) % IMGBB_API_KEYS.length;

            // If we've tried all keys, break
            if (i === maxRetries - 1) {
                break;
            }

            // Wait a bit before trying next key
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    // All keys failed
    throw new Error(`Failed to upload image to ImgBB after trying all API keys. Last error: ${lastError?.message}`);
}

/**
 * Get the current API key index (for debugging)
 */
export function getCurrentKeyIndex(): number {
    return currentKeyIndex;
}

/**
 * Get total number of API keys configured
 */
export function getTotalKeys(): number {
    return IMGBB_API_KEYS.length;
}

/**
 * Add a new API key to the pool
 */
export function addApiKey(apiKey: string): void {
    if (!IMGBB_API_KEYS.includes(apiKey)) {
        IMGBB_API_KEYS.push(apiKey);
        console.log(`[ImgBB] New API key added. Total keys: ${IMGBB_API_KEYS.length}`);
    }
}
