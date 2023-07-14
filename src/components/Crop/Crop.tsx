import React, {CSSProperties, MutableRefObject, RefObject, useEffect, useRef, useState} from 'react'
import {CropState, Dimension, resetCrop, transformToFit} from "./utils";
import {clamp, Point} from "./mathExtension";

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
    canvasRef?: RefObject<HTMLCanvasElement>
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
    }, [canvasRef.current, canvasSize, cropState])

    useEffect(() => {
        if (canvasRef.current) {
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

    const wrapperRef = useRef<HTMLDivElement | null>(null)
    return (<div ref={wrapperRef} style={{height: "100%", width: "100%", position: "relative", ...props.wrapperStyle}}>
        <canvas ref={canvasRef} style={{height: "100%", width: "100%"}}></canvas>
    </div>)
}

export default Crop
