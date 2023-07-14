import React, {createRef, useRef} from "react";
import { StoryFn, Meta } from "@storybook/react";
import Crop from "./Crop";

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
    title: "ReactComponentLibrary/Crop",
    component: Crop,
} as Meta<typeof Crop>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: StoryFn<typeof Crop> = (args) => <Crop {...args} />;

export const HelloWorld = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args

const helloWorldRef = useRef<() => Promise<string>>()
const clickMeRef = useRef<() => Promise<string>>()
HelloWorld.args = {
    src: "Hello world!",
    renderer: helloWorldRef
};

export const ClickMe = Template.bind({});
ClickMe.args = {
    src: "Click me!",
    renderer: clickMeRef
};
