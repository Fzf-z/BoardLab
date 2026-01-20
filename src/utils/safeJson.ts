/**
 * Safe JSON parsing utilities to prevent runtime crashes from malformed data
 */

import { createLogger } from './logger';

const log = createLogger('JSON');

/**
 * Safely parse JSON with a fallback value
 * @param jsonString - The JSON string to parse
 * @param fallback - Value to return if parsing fails
 * @returns Parsed object or fallback value
 */
export function safeJsonParse<T>(jsonString: string | null | undefined, fallback: T): T {
    if (!jsonString) return fallback;
    try {
        return JSON.parse(jsonString) as T;
    } catch (error) {
        log.warn('Failed to parse JSON', error);
        return fallback;
    }
}

/**
 * Safely stringify an object, returns empty string on failure
 * @param obj - Object to stringify
 * @returns JSON string or empty string on error
 */
export function safeJsonStringify(obj: unknown): string {
    try {
        return JSON.stringify(obj);
    } catch (error) {
        log.warn('Failed to stringify object', error);
        return '';
    }
}

/**
 * Deep clone an object using JSON parse/stringify with fallback
 * @param obj - Object to clone
 * @param fallback - Fallback if cloning fails
 * @returns Cloned object or fallback
 */
export function safeDeepClone<T>(obj: T, fallback: T): T {
    try {
        return JSON.parse(JSON.stringify(obj)) as T;
    } catch (error) {
        log.warn('Failed to deep clone object', error);
        return fallback;
    }
}

/**
 * Parse project attributes that may be stored as JSON string or already as object
 * Handles the common pattern where attributes come from DB as string but need to be object
 * @param attributes - Attributes as string (JSON) or object
 * @returns Parsed record of string key-value pairs
 */
export function parseProjectAttributes(
    attributes: string | Record<string, string> | null | undefined
): Record<string, string> {
    if (!attributes) return {};

    if (typeof attributes === 'object') {
        return attributes;
    }

    return safeJsonParse<Record<string, string>>(attributes, {});
}
