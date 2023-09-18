/**
 * Represents a point
 */
export interface Point {
    x: number,
    y: number
}


/**
 * Converts an angle in degrees to radians
 *
 * @param degrees   The angle in degrees
 */
export function degreesToRadians(degrees: number): number {
    return degrees * Math.PI / 180;
}

export function radiansToDegrees(radians: number): number {
    return radians * 180 / Math.PI
}


/**
 * Clamps a between min and max. All parameters must be finite, real numbers
 *
 * @param a The value to clamp
 * @param min The minimum value allowed (must be less than or equal to max)
 * @param max The maximum value allowed (must be greater than or equal to min)
 */
export function clamp(a: number, min: number, max: number) {
    console.assert(max >= min)
    return Math.min(Math.max(a, min), max)
}


/**
 * Computes the midpoint of 2 points
 *
 * @param a One point
 * @param b The other point
 */
export function midpoint(a: Point, b: Point): Point {
    return {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2}
}


/**
 * Determines whether the sign of a and b loosely match (0 matches with positive or negative). Behavior is undefined if
 * a or b is NaN
 *
 * @param a First number
 * @param b Second number
 */
export function signsMatch(a: number, b: number): boolean {
    if (a === 0 || b === 0) return true
    return a < 0 === b < 0
}


/**
 * Returns the sign of the number. -1 if the number is negative, 0 if it is 0, and 1 if the number is positive
 *
 * @param a The number to get the sign of. Behavior is undefined if NaN
 */
export function sign(a: number): -1 | 0 | 1 {
    if (a === 0) return 0
    if (a < 0) return -1
    return 1
}

/**
 * Returns the parameter with the greatest magnitude
 *
 * @param values The values to get the greatest magnitude of
 */
export function maxMagnitude(...values: number[]): number {
    return values.reduce((a, b) => {
        if (Math.abs(a) > Math.abs(b)) return a;
        return b;
    })
}

export function approxEqual(a: number, b: number): boolean {
    return Math.abs(a - b) < maxMagnitude(a, b) * Number.EPSILON
}

export function zeroIfNaN(a: number): number {
    return isFinite(a) ? a : 0
}
