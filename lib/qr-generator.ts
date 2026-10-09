/**
 * Enterprise QR Code Generator for Hunger Invoices
 * Generates high-contrast, zero-latency Data URLs or SVG for printable invoices and web previews.
 */
import QRCode from 'qrcode';

export interface QRCodeOptions {
    width?: number;
    margin?: number;
    darkColor?: string;
    lightColor?: string;
}

/**
 * Generate a PNG Data URL for embedding directly in <img> tags or PDF contexts.
 */
export async function generateInvoiceQRDataURL(
    verificationUrl: string,
    options?: QRCodeOptions
): Promise<string> {
    try {
        const dataUrl = await QRCode.toDataURL(verificationUrl, {
            width: options?.width || 120,
            margin: options?.margin ?? 1,
            color: {
                dark: options?.darkColor || '#09090b',
                light: options?.lightColor || '#ffffff',
            },
            errorCorrectionLevel: 'M',
        });
        return dataUrl;
    } catch (error) {
        console.error('Error generating invoice QR data URL:', error);
        // Fallback placeholder transparent pixel if QR fails
        return '';
    }
}

/**
 * Generate SVG string for direct vector rendering
 */
export async function generateInvoiceQRSVG(
    verificationUrl: string,
    options?: QRCodeOptions
): Promise<string> {
    try {
        const svgString = await QRCode.toString(verificationUrl, {
            type: 'svg',
            width: options?.width || 120,
            margin: options?.margin ?? 1,
            color: {
                dark: options?.darkColor || '#09090b',
                light: options?.lightColor || '#ffffff',
            },
            errorCorrectionLevel: 'M',
        });
        return svgString;
    } catch (error) {
        console.error('Error generating invoice QR SVG:', error);
        return '';
    }
}
