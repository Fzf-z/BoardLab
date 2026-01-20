/**
 * Buffer conversion utilities for handling image data from Electron IPC
 * Replaces scattered `new Blob([...] as any)` patterns with type-safe functions
 */

import { createLogger } from './logger';

const log = createLogger('BufferUtils');

/**
 * Converts a buffer (Uint8Array or number array) to an ObjectURL for image display
 * @param buffer - Image data as Uint8Array or number array
 * @param mimeType - MIME type for the blob (default: 'image/png')
 * @returns ObjectURL string or null if buffer is invalid
 */
export function bufferToObjectURL(
    buffer: Uint8Array | number[] | undefined | null,
    mimeType: string = 'image/png'
): string | null {
    if (!buffer || (Array.isArray(buffer) && buffer.length === 0)) {
        return null;
    }

    try {
        const uint8Array = buffer instanceof Uint8Array
            ? buffer
            : new Uint8Array(buffer);

        const blob = new Blob([uint8Array], { type: mimeType });
        return URL.createObjectURL(blob);
    } catch (error) {
        log.error('Failed to convert buffer to ObjectURL', error);
        return null;
    }
}

/**
 * Safely revokes an ObjectURL to free memory
 * @param url - ObjectURL to revoke (null/undefined are safely ignored)
 */
export function cleanupObjectURL(url: string | null | undefined): void {
    if (url && url.startsWith('blob:')) {
        try {
            URL.revokeObjectURL(url);
        } catch (error) {
            log.warn('Failed to revoke ObjectURL', error);
        }
    }
}

/**
 * Converts project image data to ObjectURLs for both primary and secondary images
 * @param imageData - Primary image buffer
 * @param imageDataB - Secondary image buffer (optional)
 * @returns Object with imageUrl and imageUrlB (both may be null)
 */
export function projectImagesToURLs(
    imageData: Uint8Array | number[] | undefined | null,
    imageDataB?: Uint8Array | number[] | undefined | null
): { imageUrl: string | null; imageUrlB: string | null } {
    return {
        imageUrl: bufferToObjectURL(imageData),
        imageUrlB: imageDataB ? bufferToObjectURL(imageDataB) : null
    };
}
