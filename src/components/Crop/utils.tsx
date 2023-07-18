import {clamp, identity, maxMagnitude, midpoint, Point, sign, signsMatch} from "./mathExtension";

const MIN_CROP = 10

export enum Transformations {
    TRANSLATE, SCALE, ROTATE
}

/**
 * The current state of the canvas
 */
export interface CanvasState {
    transform: DOMMatrix,
    screen: Dimension,
    image: Dimension  // this should be saved when the image gets loaded in
}

/**
 * Represents a crop. x and y are the center of the crop rectangle in image pixels, angle is in radians, and height and
 * width are the size of the rectangle in image pixels
 */
export interface CropState {
    x: number,  // center
    y: number,
    height: number,
    width: number,
    angle: number  // radians
}

/**
 * A dimension
 */
export interface Dimension {
    height: number,
    width: number
}


/**
 * Used for checking floating point equality for sanity checks
 * <p>
 * This is essentially an arbitrarily small value. Number.EPSILON is 2^-52^, we make it a little bigger for safety with
 * larger numbers. This should not be used for verifying equality, since this will be too small for large numbers (10^6^)
 * and too big for small numbers (close to 0)
 */
const DELTA = Number.EPSILON * 1000


function isWithin(p: Point, d: Dimension): boolean {
    return (p.x > 0 && p.x <= d.width - 1 && p.y > 0 && p.y <= d.height - 1)
}


/**
 * Given a crop state, returns the four corners of the rectangle described by the crop in image coordinates
 *
 * @param crop     The crop state to get the corners of
 *
 * @returns     The 4 corners of the crop a, b, c, and d where a = (c.x, c.y) and b, c, and d are the points of the
 *              rectangle in clockwise order
 */
export function getCorners(crop: CropState): { a: Point, b: Point, c: Point, d: Point } {
    const rot = identity.rotate(crop.angle).translate(crop.x, crop.y)
    const a = rot.transformPoint({x: -crop.width / 2, y: crop.height / 2})
    const b = rot.transformPoint({x: crop.width / 2, y: crop.height / 2})
    const c = rot.transformPoint({x: crop.width / 2, y: -crop.height / 2})
    const d: Point = rot.transformPoint({x: -crop.width / 2, y: -crop.height / 2})
    return {
        a: a,
        b: b,
        c: c,
        d: d
    }
}


/**
 * Gets the coordinate of a point relative to the center of the crop without rotation
 *
 * @param p The point to project
 * @param center The center of the coordinate space
 * @param angle The rotation of the coordinate space, in radians
 */
export function getInverseCorner(p: Point, center: Point, angle: number): Point {
    const t = identity.translate(-center.x, -center.y).rotate(-angle)
    return t.transformPoint(p)
}


/**
 * Finds the nearest point to p that is within the bounds specified by d
 *
 * @param p The point
 * @param d The bounds
 */
function nearestPointInBounds(p: Point, d: Dimension): Point {
    return {x: clamp(p.x, 0, d.width - 1), y: clamp(p.y, 0, d.height - 1)}

}


/**
 * Transforms the canvas so the crop area is centered, level, and appropriately sized
 *
 * @param c The crop to adjust to
 * @param windowSize The window size to fit
 */
export function transformToFit(c: CropState, windowSize: Dimension): DOMMatrix {
    // todo might need to clear the canvas and redraw after transformation is applied??
    // we have to do animations manually
    // drawing has to be done after applying the transformation
    const matrix = new DOMMatrix()
    const scale = Math.min(windowSize.width / c.width, windowSize.height / c.height) * 0.9
    const centerX = windowSize.width / 2
    const centerY = windowSize.height / 2
    matrix
        .translateSelf(-c.x, -c.y)  // translate so that the center of the crop is at the origin
        .rotateSelf(-c.angle) // rotate so crop angle is normalized
        .translateSelf(centerX, centerY)  // move the origin to the center of the screen
        .scaleSelf(scale, scale, 1, c.x, c.y) // scale so that c.width < windowSize.width and c.height < windowSize.height

    return matrix;
}

/**
 * Converts coordinates in a screen reference frame to the image
 *
 * @param p             the point to project
 * @param canvasState   the canvas the point is projected to
 */
export function canvasToImage(p: Point, canvasState: CanvasState): Point {
    return canvasState.transform.transformPoint(p)
}

/**
 * Converts coordinates from the image's coordinate system to the screen
 *
 * @param p             the point to project
 * @param canvasState   the canvas the point is projected from
 */
export function imageToCanvas(p: Point, canvasState: CanvasState): Point {
    return canvasState.transform.inverse().transformPoint(p)
}


/**
 * The displacement of the point required to fit in the image
 *
 * @param p The point to fit
 * @param image The image to fit within
 */
export function shiftRequired(p: Point, image: Dimension): { dx: number, dy: number } {
    return {
        // if the x-coordinate is too far right (past the width of the image), we shift right (dx < 0);
        // otherwise, if the x-coordinate is too far left (negative), we shift right (dx > 0);
        // otherwise, don't shift (dx = 0)
        dx: p.x >= image.width ? image.width - p.x - 1 : (p.x < 0 ? -p.x : 0),
        // if the y-coordinate is too far up (past the height of the image), we shift down (dy < 0);
        // otherwise, if the y-coordinate is too far down (negative), we shift up (dy > 0);
        // otherwise, don't shift (dy = 0)
        dy: p.y >= image.height ? image.height - p.y - 1 : (p.y < 0 ? -p.y : 0)
    }
}


/**
 * Given 2 points on opposite corners, moves 0, 1, or 2 of them to ensure that p fits in the image while maintaining
 * aspect ratio
 *
 * @param p The point to fit
 * @param o The opposite corner of p. May also be moved
 * @param oldCenter The previous center of the crop
 * @param image The image to fit the point(s) within
 * @param aspect The aspect ratio. May be undefined for free aspect ratio
 * @param angle The angle of the crop rectangle in radians
 */
export function fitPoint(p: Point, o: Point, oldCenter: Point, image: Dimension, aspect: number | undefined, angle: number): CropState {
    // todo: prevent crop from becoming 0 or 1 dimensional (or negative)
    //      If aspect is unconstrained, we just need to ensure that each dimension maintains MIN_CROP size, where pPrime is on the same side of o as oldCenter
    //      Else, we need to compute the sign of t for oldCenter, then constrain t for pPrime to have the same sign and be greater in magnitude than MIN_CROP
    //      In either case, if the constraint would put that point outside the image, o must be shifted in addition
    // handles case where both points are off the same side of the image
    // this should never actually happen, but we want to avoid a situation where the crop rectangle becomes 1 or 0 dimensional
    const pShift = shiftRequired(p, image)
    const oShift = shiftRequired(o, image)
    if (sign(pShift.dx) === sign(oShift.dx)){
        // both need to move on the x-axis
        p = {x: p.x + maxMagnitude(pShift.dx, oShift.dx), y: p.y}
        o = {x: o.x + maxMagnitude(pShift.dx, oShift.dx), y: o.y}
    }
    if (sign(pShift.dy) === sign(oShift.dy)) {
        // both need to move on the y-axis
        p = {x: p.x, y: p.y + maxMagnitude(pShift.dy, oShift.dy)}
        o = {x: o.x, y: o.y + maxMagnitude(pShift.dy, oShift.dy)}
    }

    let pPrime // new position for point
    if (aspect === undefined) {
        pPrime = nearestPointInBounds(p, image)
    } else {
        // we will define a line that intersects o with the same slope as the aspect ratio after rotating
        // we define a vector that represents the aspect ratio and then rotate it by the angle
        const slopeMagnitude = Math.sqrt(aspect * aspect + 1)
        // slope is a unit vector
        const slope = identity.rotate(angle).transformPoint({x: aspect / slopeMagnitude, y: 1 / slopeMagnitude})

        // lower and upper are the domain of valid inputs to the parametric equation that defines where this point can be
        const lower = Math.max(-o.x / slope.x, -o.y / slope.y)
        const upper = Math.min((image.width - 1 - o.x) / slope.x, (image.height - 1 - o.y) / slope.y)

        // find the value of t for the point closest to p on the line
        const t = (slope.y * (p.y - o.y) + slope.x * (p.x - o.x)) / (Math.pow(slope.y, 2) + Math.pow(slope.x, 2))

        const tFit = clamp(t, lower, upper)

        pPrime = {x: o.x + tFit * slope.x, y: o.y + tFit * slope.y}
    }

    return setCorner(pPrime, o, angle)
}


/**
 * Gets the crop state where the position of the provided point has been set
 *
 * @param pPrime    The corner to set
 * @param o         The opposite corner, should not change position
 * @param angle     The rotation of the crop in radians
 */
function setCorner(pPrime: Point, o: Point, angle: number): CropState {
    const center = midpoint(pPrime, o)
    const pTemp = getInverseCorner(pPrime, center, angle)
    return {...center, angle: angle, height: pTemp.y * 2, width: pTemp.x * 2}
}


/**
 * Fits the provided crop to the image while maintaining aspect ratio and making the minimum transformation necessary
 *
 * @param c The crop state to fit
 * @param image The image dimensions to fit the crop to
 * @param aspect The aspect ratio to maintain (or undefined if free-form)
 * @param transform The transformation to prefer. If it is not possible to achieve with the specified transformation, the other will be used (possibly in addition)
 */
export function fitCrop(c: CropState, image: Dimension, aspect: number | undefined, transform: Transformations.SCALE | Transformations.TRANSLATE): CropState {
    let points = getCorners(c)
    let cPrime: CropState = c
    switch (transform) {
        case Transformations.SCALE:
            // the user has tried to pull one or more control points outside the image bounds
            // move anchor coordinate and/or dimension to fit
            if (!isWithin(points.a, image)) {
                cPrime = fitPoint(points.a, points.c, cPrime, image, aspect, c.angle)
                points = getCorners(cPrime)
            }
            if (!isWithin(points.b, image)) {
                cPrime = fitPoint(points.b, points.d, cPrime, image, aspect, c.angle)
                points = getCorners(cPrime)
            }
            if (!isWithin(points.c, image)) {
                cPrime = fitPoint(points.c, points.a, cPrime, image, aspect, c.angle)
                points = getCorners(cPrime)
            }
            if (!isWithin(points.d, image)) {
                cPrime = fitPoint(points.d, points.b, cPrime, image, aspect, c.angle)
            }
            break
        case Transformations.TRANSLATE:
            const delta = {dx: 0, dy: 0}
            let tempPoints = [points.a, points.b, points.c, points.d]

            const distances = tempPoints.map((p) => shiftRequired(p, image))

            for (const distance of distances) {
                if (delta.dx === 0) delta.dx = distance.dx
                else if (!signsMatch(delta.dx, distance.dx)) {
                    // one point needs to shift left, the other right, not possible
                    // the crop is currently larger than the image, no translation can improve the situation
                    return fitCrop(c, image, aspect, Transformations.SCALE)
                } else delta.dx = maxMagnitude(delta.dx, distance.dx)


                if (delta.dy === 0) delta.dy = distance.dy
                else if (!signsMatch(delta.dy, distance.dy)) return fitCrop(c, image, aspect, Transformations.SCALE)  // one point needs to shift up, the other down, not possible
                else delta.dy = maxMagnitude(delta.dy, distance.dy)
            }

            // move the crop
            cPrime = {...c, x: c.x + delta.dx, y: c.y + delta.dy}

            for (const point of tempPoints) {
                if (point.x + delta.dx < 0 || point.x + delta.dx >= image.width || point.y + delta.dy < 0 || point.y + delta.dy >= image.height) {
                    // the movement required to fit one point in causes another point to move out of the image, so this is not possible
                    // shrink it
                    return fitCrop(cPrime, image, aspect, Transformations.SCALE)
                }
            }
    }

    return cPrime
}

/**
 * Returns a crop state with no rotation and the maximum size allowed by the aspect while fitting in the image. The
 * resulting crop state will be centered in the image
 *
 * @param image     Dimensions of the image to fit the crop within
 * @param aspect    The desired aspect ratio of the crop. This may be undefined for no aspect ratio, but otherwise must
 *                  lie in the interval (0, inf). Extreme values in this range will still likely cause problems
 */
export function resetCrop(image: Dimension, aspect: number | undefined): CropState {
    console.assert(aspect === undefined || (aspect > 0 && isFinite(aspect)))
    if (aspect == undefined) {
        // set the crop state to the full image
        return {x: image.width / 2, y: image.height / 2, angle: 0, width: image.width, height: image.height}
    } else {
        let width: number
        let height: number
        const imgAspect = image.width / image.height
        if (imgAspect > aspect) {
            // the image is wider than the desired aspect; limited by height
            height = image.height
            width = image.height * aspect
        } else {
            // image is taller than the desired aspect; limited by width
            width = image.width
            height = image.width / aspect
        }

        // center the crop
        return {x: image.width / 2, y: image.height / 2, width: width, height: height, angle: 0}
    }
}

