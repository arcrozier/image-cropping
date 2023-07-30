import React, {
    CSSProperties,
    MutableRefObject,
    ReactElement,
    RefObject,
    useCallback,
    useEffect,
    useRef,
    useState
} from 'react'
import {
    CanvasState,
    canvasToImage,
    CROP_BUFFER,
    CropState,
    fitCrop,
    fitPoint,
    getCanvasCorners,
    resetCrop,
    Transformations,
    transformToFit
} from "./utils";
import {clamp, identity, Point} from "./mathExtension";
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
    thirds?: boolean,
    borderRadius?: string
}


enum Corner {
    TL, TR, BL, BR
}

const MIN_CROP = 10;


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
    setPosition: (pos: Point, corner: Corner) => void,
    /**
     * Called when the user finishes moving the point (for mouse movements, this is the mouse up event, for keyboard
     * interactions, key up)
     */
    commitPosition: () => void,
    corner: Corner,
    handleStyle?: CSSProperties,
}

export const HANDLE_SIZE = 48


const Handle = (props: HandleProps) => {

    const ref = useDraggable((delta) => {
        // this branch causes a new onDrag to be created each time the keyboard is updated
        // not great, but also not really a priority
        props.setPosition({x: props.position.x + delta.x, y: props.position.y + delta.y}, props.corner)
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
        backgroundColor: 'green',
        height: `${HANDLE_SIZE}px`,
        width: `${HANDLE_SIZE}px`,
        cursor: cursor,
        zIndex: 2,
        borderRadius: '50%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
    }} ref={ref} role={'slider'} tabIndex={0} aria-label={`Handle for ${corner} corner of crop area`}>
        <div style={{
            borderRadius: '50%', backgroundColor: 'red', width: `25%`, height: `25%`, zIndex: 3,
            ...props.handleStyle}}>

        </div>
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

    const [corners, setCorners] = useState<{a: Point, b: Point, c: Point, d: Point}>()

    const [cropState, setCropState] = useState<CropState>(resetCrop({width: 0, height: 0}, props.aspect))
    const [canvasState, setCanvasState] = useState<CanvasState>({transform: identity, image: {width: 0, height: 0}, canvas: {width: 0, height: 0}})
    const [image, setImage] = useState<HTMLImageElement | null>(null)

    const canvasRef = props.canvasRef ? props.canvasRef : useRef<HTMLCanvasElement | null>(null)

    const wrapperRef = useDraggable((delta) => {
        setCropState((c) => {
            const temp = fitCrop({...c, x: c.x - delta.x, y: c.y - delta.y}, canvasState.image, props.aspect, Transformations.TRANSLATE)
            setCanvasState((c) => {return {...c, transform: transformToFit(temp, canvasState.canvas)}})
            return temp
        })
    })

    useEffect(() => {
        if (canvasRef.current) {
            canvasRef.current.width = canvasState.canvas.width
            canvasRef.current.height = canvasState.canvas.height
            const ctx = canvasRef.current.getContext("2d")
            if (ctx && image) {
                ctx.save()
                ctx.fillStyle = 'black'
                ctx.fillRect(0, 0, canvasState.canvas.width, canvasState.canvas.height)
                ctx.setTransform(canvasState.transform)
                ctx.drawImage(image, 0, 0)
                ctx.restore()
            }
        }
    }, [canvasRef.current, canvasState.transform, canvasState.canvas, image])

    useEffect(() => {
        if (canvasRef.current) {
            const temp = canvasRef.current
            const resizeObserver = new ResizeObserver(() => {
                // Do what you want to do when the size of the element changes
                const canvas = {width: temp.offsetWidth, height: temp.offsetHeight}
                setCanvasState((c) => {
                    return {...c, transform: transformToFit(cropState, canvas), canvas: canvas}
                })
            });
            resizeObserver.observe(canvasRef.current);
            return () => resizeObserver.disconnect(); // clean up
        }
    }, [canvasRef.current])

    useEffect(() => {
        const img = new Image()
        setImage(null)
        img.src = props.src
        img.onload = () => {
            setImage(img)
            setCanvasState((c) => {return {...c, image: {width: img.naturalWidth, height: img.naturalHeight}}})
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

    const cornerClamp = (pos: Point) => {
        return {x: clamp(pos.x, CROP_BUFFER * canvasState.canvas.width, (1 - CROP_BUFFER) * canvasState.canvas.width), y: clamp(pos.y, CROP_BUFFER * canvasState.canvas.height, (1- CROP_BUFFER) * canvasState.canvas.height)}
    }

    useEffect(() => {
        const corners = getCanvasCorners(cropState, canvasState.transform)
        setCorners(corners)
        if (corners.a.x < CROP_BUFFER * canvasState.canvas.width || corners.b.x > (1 - CROP_BUFFER) * canvasState.canvas.width || corners.a.y < CROP_BUFFER * canvasState.canvas.height || corners.d.y > (1 - CROP_BUFFER) * canvasState.canvas.height) {
            // careful this could become an infinite loop very easily
            setCanvasState((c) => {return {...c, transform: transformToFit(cropState, c.canvas)}})
        }
    }, [cropState, canvasState.transform, canvasState.canvas])

    const setPosition = useCallback((pos: Point, corner: Corner) => {
        if (!corners) return
        let opposite: Point
        let diagonal: 1 | -1
        switch (corner) {
            case Corner.BL:
                opposite = corners.b
                diagonal = -1
                break
            case Corner.BR:
                opposite = corners.a
                diagonal = 1
                break
            case Corner.TR:
                opposite = corners.d
                diagonal = -1
                break
            case Corner.TL:
                opposite = corners.c
                diagonal = 1
                break
        }

        let minX = MIN_CROP
        let minY = MIN_CROP

        if (props.aspect) {
            if (props.aspect < 1) {
                // portrait - minX is going to be MIN_CROP
                minY = minX / props.aspect
            } else if (props.aspect > 1) {
                // landscape - minY is going to be MIN_CROP
                minX = minY * props.aspect
            }
        }

        switch (corner) {
            case Corner.BR:
            case Corner.TR:
                // make sure x doesn't get too small (too far left)
                pos.x = Math.max(pos.x, opposite.x + minX)
                break
            case Corner.BL:
            case Corner.TL:
                // make sure x doesn't get too big (too far right)
                pos.x = Math.min(pos.x, opposite.x - minX)
                break
        }

        switch (corner) {
            case Corner.TR:
            case Corner.TL:
                // make sure y doesn't get too big (bigger y means further down the screen)
                pos.y = Math.min(pos.y, opposite.y - minY)
                break
            case Corner.BR:
            case Corner.BL:
                // make sure y doesn't get too small (too far up)
                pos.y = Math.max(pos.y, opposite.y + minY)
                break
        }

        setCropState((c) => fitPoint(canvasToImage(pos, canvasState.transform), canvasToImage(opposite, canvasState.transform), canvasState.image, props.aspect, c.angle, diagonal))
    }, [corners, canvasState.image, canvasState.transform, props.aspect, setCropState])

    const commitPosition = useCallback(() => {
        setCanvasState((c) => {
            return {...c, transform: transformToFit(cropState, c.canvas)}
        })
    }, [cropState])

    // todo on rotate call fit crop with scale
    //      set crop state and update angle

    const handles: ReactElement[] = []
    if (corners) {
        const thirds: ReactElement[] = []
        if (props.thirds) {
            for (let i = 1; i < 3; i++) {
                thirds.push(<div style={{position: 'absolute', top: `${i * 33}%`, left: 0, width: '100%', height: '0.75px', backgroundColor: 'white'}}></div>)
                thirds.push(<div style={{position: 'absolute', left: `${i * 33}%`, top: 0, height: '100%', width: '0.75px', backgroundColor:'white'}}></div>)
            }
        }
        for (let {pos, corner} of [{pos: corners.a, corner: Corner.TL}, {pos: corners.b, corner: Corner.TR}, {pos: corners.c, corner: Corner.BR}, {pos: corners.d, corner: Corner.BL}]) {
            handles.push(<Handle position={cornerClamp(pos)} setPosition={setPosition} commitPosition={commitPosition} corner={corner}/>)
        }
        handles.push(<div style={{position: 'absolute', top: corners.a.y, left: corners.a.x, width: (corners.b.x - corners.a.x), height: (corners.d.y - corners.a.y), borderRadius: props.borderRadius ?? '50%', boxShadow: '0 0 0 999999px rgba(0, 0, 0, 0.7)'}}></div>)
        handles.push(<div style={{position: 'absolute', top: corners.a.y, left: corners.a.x, width: (corners.b.x - corners.a.x), height: (corners.d.y - corners.a.y), boxSizing: 'border-box', borderStyle: 'solid', borderWidth: '1px', borderColor: 'white'}}>
            {thirds}
        </div>)
    }

    return (<div ref={wrapperRef}
                 style={{height: "100%", width: "100%", position: "relative", cursor: 'move', ...props.wrapperStyle, overflow: 'hidden'}}>
        <canvas ref={canvasRef} style={{height: "100%", width: "100%"}}></canvas>
        {handles}

    </div>)
}

export default Crop
