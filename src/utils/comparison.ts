/**
 * Optimized comparison utilities
 * Replaces JSON.stringify for state comparison with more efficient alternatives
 */

/**
 * Shallow compare two arrays of objects by reference
 * Much faster than JSON.stringify for detecting if arrays have same content
 */
export function shallowArrayEqual<T>(a: T[], b: T[]): boolean {
    if (a === b) return true;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

/**
 * Shallow compare two objects by their immediate properties
 */
export function shallowObjectEqual<T extends Record<string, unknown>>(a: T, b: T): boolean {
    if (a === b) return true;

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
        if (a[key] !== b[key]) return false;
    }

    return true;
}

/**
 * Compare arrays of objects with a specific key for identity
 * Useful for comparing Point arrays by id and position
 */
export function comparePointArrays<T extends { id: string | number; x: number; y: number }>(
    a: T[],
    b: T[]
): boolean {
    if (a === b) return true;
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; i++) {
        const itemA = a[i];
        const itemB = b[i];

        if (itemA.id !== itemB.id || itemA.x !== itemB.x || itemA.y !== itemB.y) {
            return false;
        }
    }

    return true;
}

/**
 * Deep comparison using JSON.stringify as fallback
 * Use only when shallow comparison is not sufficient
 */
export function deepEqual<T>(a: T, b: T): boolean {
    if (a === b) return true;
    return JSON.stringify(a) === JSON.stringify(b);
}
