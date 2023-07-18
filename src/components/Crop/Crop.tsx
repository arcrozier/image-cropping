import React, {CSSProperties, MutableRefObject, RefObject, useCallback, useEffect, useRef, useState} from 'react'
import {CropState, Dimension, resetCrop, transformToFit} from "./utils";
import {Point} from "./mathExtension";
import useDraggable, {throttle} from '../useDraggable';

export interface CropProps {
    src: string,
    renderer: MutableRefObject<(() => Promise<string>) | undefined>,
    aspect?: number,  // width / height
    wrapperStyle?: CSSProperties,
    frameStyle?: CSSProperties,
    rotation?: number,
    translation?: { x: number, y: number },
    onTranslation?: (x: number, y: number) => void,
    scale?: number,
    onScale?: (s: number) => void,
    cropState?: CropState,
    onCropChange?: (c: CropState) => void,
    canvasRef?: RefObject<HTMLCanvasElement>,
    thirds?: boolean
}


enum Corner {
    TL, TR, BL, BR
}


/**
 * Props for corner of crop area
 */
interface HandleProps {
    /**
     * The position of the handle in canvas coordinates
     */
    position: Point,
    /**
     * Called each time the position changes
     *
     * @param p The new point, in canvas coordinates
     */
    setPosition:  React.Dispatch<React.SetStateAction<Point>>,
    /**
     * Called when the user finishes moving the point (for mouse movements, this is the mouse up event, for keyboard
     * interactions, key up)
     */
    commitPosition: () => void,
    corner: Corner,
    handleStyle?: CSSProperties,
    relativeTo: RefObject<HTMLElement>
}

export const HANDLE_SIZE = '24px'


const Handle = (props: HandleProps) => {

    const [ref, pressed] = useDraggable((newPos, delta) => {
        if (delta) {
            // todo this branch causes a new onDrag to be created each time the keyboard is updated
            props.setPosition((p) => {
                return {x: p.x + newPos.x, y: p.y + newPos.y}
            })
        } else {

            props.setPosition(newPos)
        }
    }, (pressed) => {
        if (!pressed) {
            props.commitPosition()
        }
    }, props.relativeTo)

    let cursor
    let corner
    switch (props.corner) {
        case Corner.BL:
            cursor = 'sw-resize'
            corner = 'bottom left'
            break
        case Corner.BR:
            cursor = 'se-resize'
            corner = 'bottom right'
            break
        case Corner.TL:
            cursor = 'nw-resize'
            corner = 'top left'
            break
        case Corner.TR:
            cursor = 'ne-resize'
            corner = 'top right'
    }
    return (<div style={{
        position: 'absolute',
        top: props.position.y,
        left: props.position.x,
        backgroundColor: 'white',
        height: HANDLE_SIZE,
        width: HANDLE_SIZE,
        borderRadius: '50%',
        cursor: cursor,
        zIndex: 2, ...props.handleStyle
    }} ref={ref} role={'slider'} tabIndex={0} aria-label={`Handle for ${corner} corner of crop area`}>

    </div>)
}


const Crop = ({renderer, ...props}: CropProps) => {
    // we will have a crop type that tracks the crop in pixels on the canvas
    // the crop state will be of this type
    // to display, we transform the canvas (scale, rotation, translation) then display the control points relative to
    // the parent
    // translation is always to place the crop rectangle in the center of the screen
    // when the user drags, we actually move the crop rectangle in the opposite direction and then translate like normal

    // when the user shrinks the crop area, nothing should happen until mouse up, then we should apply the transformation
    // when the user increases the crop area, we should immediately recompute and scale the canvas if necessary (and
    // compute fit)

    // todo are canvas pixels equal to screen pixels? - yes, as long as no CSS styles are applied
    // need to set canvas height/width to computed height and width of parent
    // then, positions relative to the canvas are the same as positions relative to the screen

    const [cropState, setCropState] = useState<CropState>(resetCrop({width: 0, height: 0}, props.aspect))
    const [canvasSize, setCanvasSize] = useState<Dimension>({width: 0, height: 0})
    const [image, setImage] = useState<HTMLImageElement | null>(null)

    const canvasRef = props.canvasRef ? props.canvasRef : useRef<HTMLCanvasElement | null>(null)

    useEffect(() => {
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext("2d")
            if (ctx && image) {
                ctx.save()
                ctx.setTransform(transformToFit(cropState, canvasSize))
                ctx.drawImage(image, 0, 0)
                ctx.restore()
            }
        }
    }, [canvasRef.current, canvasSize, cropState, image])

    useEffect(() => {
        if (canvasRef.current) {
            // todo we need to listen for window size changes see https://stackoverflow.com/questions/68175873/detect-element-reference-height-change
            setCanvasSize({width: canvasRef.current.offsetWidth, height: canvasRef.current.offsetHeight})
        }
    }, [canvasRef.current, canvasRef.current?.offsetWidth, canvasRef.current?.offsetHeight])

    useEffect(() => {
        const img = new Image()
        setImage(null)
        img.src = props.src
        img.onload = () => {
            setImage(img)
            setCropState(resetCrop({width: img.naturalWidth, height: img.naturalHeight}, props.aspect))
        }
        // we don't want to reset the crop when the aspect changes
        // @ts-ignore
    }, [props.src])

    useEffect(() => {
        renderer.current = async () => {
            // todo in here, create a canvas the same size as the crop. Transform the canvas. Draw the image to the
            //  canvas in full size. Save the canvas
            return ""
        }
    }, [renderer])

    const [testPos, setTestPos] = useState({x: 0, y: 0})

    const wrapperRef = useRef<HTMLDivElement | null>(null)
    return (<div ref={wrapperRef} style={{height: "100%", width: "100%", position: "relative", cursor: 'move', ...props.wrapperStyle}}>
        <canvas ref={canvasRef} style={{height: "100%", width: "100%"}} height={canvasSize.height}
                width={canvasSize.width}></canvas>
        <Handle position={testPos} setPosition={setTestPos} commitPosition={() => 'cool'} corner={Corner.TR} relativeTo={canvasRef}/>
    </div>)
}

export default Crop
