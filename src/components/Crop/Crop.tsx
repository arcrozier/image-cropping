import React from 'react'

export interface CropProps {
    src: string
}

const Crop = (props: CropProps) => {
    return (<div>{props.src}</div>)
}

export default Crop
