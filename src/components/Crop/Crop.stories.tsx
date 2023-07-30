import React, {createRef, useRef} from "react";
import { StoryFn, Meta } from "@storybook/react";
import Crop from "./Crop";

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
    title: "ReactComponentLibrary/Crop",
    component: Crop,
} as Meta<typeof Crop>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: StoryFn<typeof Crop> = (args) => <div style={{height: "500px", width: "900"}}><Crop {...args} /></div>;

export const LandscapeFreeAspect = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args

const placeholderRef = {current: undefined}
LandscapeFreeAspect.args = {
    src: "https://res.cloudinary.com/practicaldev/image/fetch/s--Wzfozk3_--/c_imagga_scale,f_auto,fl_progressive,h_420,q_auto,w_1000/https://dev-to-uploads.s3.amazonaws.com/uploads/articles/dxyw74lpvryk4vslvwzc.png",
    renderer: placeholderRef,
    thirds: true
};

export const LandscapePortraitAspect = Template.bind({});
LandscapePortraitAspect.args = {
    src: "https://res.cloudinary.com/practicaldev/image/fetch/s--Wzfozk3_--/c_imagga_scale,f_auto,fl_progressive,h_420,q_auto,w_1000/https://dev-to-uploads.s3.amazonaws.com/uploads/articles/dxyw74lpvryk4vslvwzc.png",
    renderer: placeholderRef,
    aspect: 1 / 2
};

export const LandscapeLandscapeAspect = Template.bind({});
LandscapeLandscapeAspect.args = {
    src: "https://res.cloudinary.com/practicaldev/image/fetch/s--Wzfozk3_--/c_imagga_scale,f_auto,fl_progressive,h_420,q_auto,w_1000/https://dev-to-uploads.s3.amazonaws.com/uploads/articles/dxyw74lpvryk4vslvwzc.png",
    renderer: placeholderRef,
    aspect: 2
};

export const LandscapeSquareAspect = Template.bind({});
LandscapeSquareAspect.args = {
    src: "https://res.cloudinary.com/practicaldev/image/fetch/s--Wzfozk3_--/c_imagga_scale,f_auto,fl_progressive,h_420,q_auto,w_1000/https://dev-to-uploads.s3.amazonaws.com/uploads/articles/dxyw74lpvryk4vslvwzc.png",
    renderer: placeholderRef,
    aspect: 1
};
