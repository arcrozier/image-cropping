import React, {CSSProperties, MutableRefObject, ReactElement, RefObject, useEffect, useRef, useState} from 'react'
import {CanvasState, CropState, Dimension, getCorners, imageToCanvas, resetCrop, transformToFit} from "./utils";
import {identity, Point} from "./mathExtension";
import useDraggable from '../useDraggable';

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
    setPosition: React.Dispatch<React.SetStateAction<Point>>,
    /**
     * Called when the user finishes moving the point (for mouse movements, this is the mouse up event, for keyboard
     * interactions, key up)
     */
    commitPosition: () => void,
    corner: Corner,
    handleStyle?: CSSProperties,
}

export const HANDLE_SIZE = 24


const Handle = (props: HandleProps) => {

    const ref = useDraggable((delta) => {
        // this branch causes a new onDrag to be created each time the keyboard is updated
        // not great, but also not really a priority
        props.setPosition((p) => {
            return {x: p.x + delta.x, y: p.y + delta.y}
        })
    }, (pressed) => {
        if (!pressed) {
            props.commitPosition()
        }
    })

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
        top: props.position.y - HANDLE_SIZE / 2,
        left: props.position.x - HANDLE_SIZE / 2,
        backgroundColor: 'red',
        height: `${HANDLE_SIZE}px`,
        width: `${HANDLE_SIZE}px`,
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

    // need to set canvas height/width to computed height and width of parent
    // then, positions relative to the canvas are the same as positions relative to the screen

    const corners = useRef<{a: Point, b: Point, c: Point, d: Point}>()

    const [cropState, setCropState] = useState<CropState>(resetCrop({width: 0, height: 0}, props.aspect))
    const [canvasState, setCanvasState] = useState<CanvasState>({transform: identity, image: {width: 0, height: 0}, canvas: {width: 0, height: 0}})
    const [image, setImage] = useState<HTMLImageElement | null>(null)

    const canvasRef = props.canvasRef ? props.canvasRef : useRef<HTMLCanvasElement | null>(null)

    useEffect(() => {
        setCanvasState((c) => {
            return {...c, transform: transformToFit(cropState, c.canvas)}
        })
        console.log("recomputing transformation")
    }, [cropState, canvasState.canvas])


    useEffect(() => {
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext("2d")
            if (ctx && image) {
                console.log(canvasState.transform)
                ctx.save()
                ctx.clearRect(0, 0, canvasState.canvas.width, canvasState.canvas.height)
                ctx.setTransform(canvasState.transform)
                ctx.drawImage(image, 0, 0)
                ctx.restore()
            }
        }
    }, [canvasRef.current, canvasState.transform, image])

    useEffect(() => {
        if (canvasRef.current) {
            const temp = canvasRef.current
            // todo we need to listen for window size changes see https://stackoverflow.com/questions/68175873/detect-element-reference-height-change
            setCanvasState((c) => {
                return {...c, canvas: {width: temp.offsetWidth, height: temp.offsetHeight}}
            })
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

    useEffect(() => {
        corners.current = getCorners(cropState)
    }, [cropState])

    const [testPos, setTestPos] = useState({x: 0, y: 0})

    const handles: ReactElement[] = []
    if (corners.current) {
        for (let {pos, corner} of [{pos: corners.current.a, corner: Corner.TL}, {pos: corners.current.b, corner: Corner.TR}, {pos: corners.current.c, corner: Corner.BR}, {pos: corners.current.d, corner: Corner.BL}]) {
            handles.push(<Handle position={imageToCanvas(pos, canvasState)} setPosition={setTestPos} commitPosition={() => 'cool'} corner={corner}/>)
        }

    }

    const wrapperRef = useRef<HTMLDivElement | null>(null)
    return (<div ref={wrapperRef}
                 style={{height: "100%", width: "100%", position: "relative", cursor: 'move', ...props.wrapperStyle}}>
        <canvas ref={canvasRef} style={{height: "100%", width: "100%"}} height={canvasState.canvas.height}
                width={canvasState.canvas.width}></canvas>
        {handles}

    </div>)
}

export default Crop
