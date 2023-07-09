import React from 'react'

export interface SliderProps {
    src: string
}

const Slider = (props: SliderProps) => {
    return (<div>{props.src}</div>)
}

export default Slider