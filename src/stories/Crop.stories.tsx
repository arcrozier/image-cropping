import React, {useState} from "react";
import { StoryFn, Meta } from "@storybook/react";
import Crop from "../components/Crop/Crop";
// @ts-ignore
import landscape from "./assets/landscape.jpg"
// @ts-ignore
import portrait from "./assets/portrait.jpg"
// @ts-ignore
import square from "./assets/square.jpg"
import {RangeControl} from "@storybook/blocks";

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
    title: "ReactComponentLibrary/Crop",
    component: Crop,
} as Meta<typeof Crop>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: StoryFn<typeof Crop> = (args) => {
    const [angle, setAngle] = useState(0)
    return (
        <div style={{height: "500px", width: "900"}}><Crop {...args} rotation={angle} /><input type={"range"} name={"angle"} onChange={(e) => setAngle(e.target.valueAsNumber)}></input></div>
)
}

export const LandscapeFreeAspect = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args

const placeholderRef = {current: undefined}
LandscapeFreeAspect.args = {
    src: landscape,
    renderer: placeholderRef,
    thirds: true
};

export const LandscapePortraitAspect = Template.bind({});
LandscapePortraitAspect.args = {
    src: landscape,
    renderer: placeholderRef,
    aspect: 1 / 2
};

export const LandscapeLandscapeAspect = Template.bind({});
LandscapeLandscapeAspect.args = {
    src: landscape,
    renderer: placeholderRef,
    aspect: 2
};

export const LandscapeSquareAspect = Template.bind({});
LandscapeSquareAspect.args = {
    src: landscape,
    renderer: placeholderRef,
    aspect: 1
};

export const PortraitFreeAspect = Template.bind({})
PortraitFreeAspect.args = {
    src: portrait,
    renderer: placeholderRef,
    thirds: true
};

export const PortraitPortraitAspect = Template.bind({});
PortraitPortraitAspect.args = {
    src: portrait,
    renderer: placeholderRef,
    aspect: 1 / 2
};

export const PortraitLandscapeAspect = Template.bind({});
PortraitLandscapeAspect.args = {
    src: portrait,
    renderer: placeholderRef,
    aspect: 2
};

export const PortraitSquareAspect = Template.bind({});
PortraitSquareAspect.args = {
    src: portrait,
    renderer: placeholderRef,
    aspect: 1
};

export const SquareFreeAspect = Template.bind({})
SquareFreeAspect.args = {
    src: square,
    renderer: placeholderRef,
    thirds: true
};

export const SquarePortraitAspect = Template.bind({});
SquarePortraitAspect.args = {
    src: square,
    renderer: placeholderRef,
    aspect: 1 / 2
};

export const SquareLandscapeAspect = Template.bind({});
SquareLandscapeAspect.args = {
    src: square,
    renderer: placeholderRef,
    aspect: 2
};

export const SquareSquareAspect = Template.bind({});
SquareSquareAspect.args = {
    src: square,
    renderer: placeholderRef,
    aspect: 1
};
