import {useCallback, useEffect, useRef, useState } from "react";
import { throttle } from "./throttle";

// By https://stackoverflow.com/users/1872046/polkovnikov-ph
// from https://stackoverflow.com/a/39192992/7484693
// licensed under CC BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/legalcode
// modified

/**
 * How fast a keyboard-based drag should be
 */
const dragSpeed = 10 // pixels per second

/**
 * Make an element draggable by passing the returned ref to the ref of the element
 *
 * @param pos       The current position of the element
 * @param onDrag    Called when the user drags the element
 *
 * @return  [ref, pressed]: ref should be passed to the element you want draggable. pressed is whether the user is currently dragging the element
 */
export const useDraggable = (pos: {x: number, y: number}, onDrag: (newPos: {x: number, y: number}) => void) => {
    // this state doesn't change often, so it's fine
    const [pressed, setPressed] = useState(false);
    const keys = {left: false, right: false, up: false, down: false}

    const keyMoveLoop = (() => {
        let token: number | null = null
        let last = -1
        const invoke = () => {
            if (!(keys.up || keys.down || keys.left || keys.right)) {
                return
            }

            if (last !== -1) {
                const delta = (performance.now() - last) / 1000  // time delta
                let dirX
                let dirY
                if (keys.left && !keys.right) {
                    dirX = -dragSpeed
                } else if (keys.right && !keys.left) {
                    dirX = dragSpeed
                } else {
                    dirX = 0
                }

                if (keys.up && !keys.down) {
                    dirY = -dragSpeed
                } else if (keys.down && !keys.up) {
                    dirY = dragSpeed
                } else {
                    dirY = 0
                }
                onDrag({x: pos.x + delta * dirX, y: pos.y + delta * dirY})
            }

            last = performance.now()

            token = requestAnimationFrame(invoke)
        }
        invoke.cancel = () => token && cancelAnimationFrame(token)

        return invoke
    })()

    // do not store position in useState! even if you useEffect on
    // it and update `transform` CSS property, React still rerenders
    // on every state change, and it LAGS
    const position = useRef({ x: 0, y: 0 });
    const ref = useRef<HTMLElement>();

    // a reference to a function to clean up listeners
    const unsubscribe = useRef<() => void>();

    // passed as a ref to the object that should be draggable
    const legacyRef = useCallback((elem: HTMLElement) => {

        ref.current = elem;
        if (unsubscribe.current) {
            unsubscribe.current();
        }
        if (!elem) {
            return;
        }

        const handleMouseDown = (e: MouseEvent) => {
            // don't forget to disable text selection during drag and drop
            // operations
            if (e.target && e.target instanceof HTMLElement) {
                e.target.style.userSelect = "none";
            }
            setPressed(true);
        };

        const handleKeyPress = (e: KeyboardEvent) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') {
                return
            }
            switch (e.key) {
                case 'ArrowLeft':
                    keys.left = true
                    break
                case 'ArrowRight':
                    keys.right = true
                    break
                case 'ArrowUp':
                    keys.up = true
                    break
                case 'ArrowDown':
                    keys.down = true
                    break
            }
            setPressed(true)
            keyMoveLoop()
        }
        elem.addEventListener("mousedown", handleMouseDown);
        elem.addEventListener("keydown", handleKeyPress)
        unsubscribe.current = () => {
            elem.removeEventListener("mousedown", handleMouseDown);
        };
    }, []);

    useEffect(() => {
        // why subscribe in a `useEffect`? because we want to subscribe
        // to mousemove only when pressed, otherwise it will lag even
        // when you're not dragging
        if (!pressed) {
            return;
        }

        // updating the page without any throttling is a bad idea
        // requestAnimationFrame-based throttle would probably be fine,
        // but be aware that naive implementation might make element
        // lag 1 frame behind cursor, and it will appear to be lagging
        // even at 60 FPS
        const handleMouseMove = throttle((event: MouseEvent) => {
            // it's important to save it into variable here,
            // otherwise we might capture reference to an element
            // that was long gone. not really sure what's correct
            // behavior for a case when you've been scrolling, and
            // the target element was replaced. probably some formulae
            // needed to handle that case. TODO
            onDrag({
                x: event.offsetX,
                y: event.offsetY
            });
        });
        const handleMouseUp = (e: MouseEvent) => {
            if (e.target && e.target instanceof HTMLElement) {
                e.target.style.userSelect = "auto";
            }
            setPressed(false);
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') {
                return
            }
            switch (e.key) {
                case 'ArrowLeft':
                    keys.left = false
                    break
                case 'ArrowRight':
                    keys.right = false
                    break
                case 'ArrowUp':
                    keys.up = false
                    break
                case 'ArrowDown':
                    keys.down = false
                    break
            }
            if (!(keys.up || keys.down || keys.left || keys.right)) {
                setPressed(false)
                keyMoveLoop.cancel()
            }
        }
        // subscribe to mousemove and mouseup on document, otherwise you
        // can escape bounds of element while dragging and get stuck
        // dragging it forever
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
        document.addEventListener('keyup', handleKeyUp)
        return () => {
            handleMouseMove.cancel();
            keyMoveLoop.cancel()
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
            document.removeEventListener('keyup', handleKeyUp)
        };
        // if `onDrag` wasn't defined with `useCallback`, we'd have to
        // resubscribe to 2 DOM events here, not to say it would mess
        // with `throttle` and reset its internal timer
    }, [pressed, onDrag]);

    // actually it makes sense to return an array only when
    // you expect that on the caller side all of the fields
    // will be usually renamed
    return [legacyRef, pressed];

};