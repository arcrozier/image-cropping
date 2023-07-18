import {RefObject, useCallback, useEffect, useRef, useState } from "react";
import { throttle } from "./throttle";

// By https://stackoverflow.com/users/1872046/polkovnikov-ph
// from https://stackoverflow.com/a/39192992/7484693
// licensed under CC BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/legalcode
// modified

/**
 * How fast a keyboard-based drag should be
 */
const dragSpeed = 40 // pixels per second

/**
 * Make an element draggable by passing the returned ref to the ref of the element
 *
 * @param onDrag    Called when the user drags the element
 * @param onPressChange Called when the state of pressed changes
 * @param relativeTo    If provided, positions provided to onDrag will be absolute positions relative to the provided
 *                      element. Otherwise, positions provided to onDrag will be deltas
 *
 * @return  [ref, pressed]: ref should be passed to the element you want draggable. pressed is whether the user is currently dragging the element
 */
const useDraggable = (onDrag: (newPos: {x: number, y: number}, delta: boolean) => void, onPressChange?: (pressed: boolean) => void, relativeTo?: RefObject<HTMLElement | null>): [(elem: HTMLElement | null) => void, boolean] => {
    // this state doesn't change often, so it's fine
    const [pressed, _setPressed] = useState(false);
    const mouseOffset = useRef({x: 0, y: 0})
    const setPressed = (pressed: boolean | ((prevState: boolean) => boolean)) => {
        if (typeof pressed === 'function') {
            _setPressed((prevState => {
                const nextState = pressed(prevState)
                if (onPressChange) {
                    onPressChange(nextState)
                }
                return nextState
            }))
        }
        else {
            _setPressed(pressed)
            if (onPressChange) {
                onPressChange(pressed)
            }
        }

    }
    const keys = useRef({left: false, right: false, up: false, down: false})

    const keyMoveLoop = (() => {
        let token: number | null = null
        // todo when the user stops moving with keyboard, this doesn't get reset causing a large jump when they start moving again
        let last = -1
        const invoke = () => {
            if (!(keys.current.up || keys.current.down || keys.current.left || keys.current.right)) {
                return
            }

            if (last !== -1) {
                const delta = (performance.now() - last) / 1000  // time delta
                let dirX
                let dirY
                if (keys.current.left && !keys.current.right) {
                    dirX = -dragSpeed
                } else if (keys.current.right && !keys.current.left) {
                    dirX = dragSpeed
                } else {
                    dirX = 0
                }

                if (keys.current.up && !keys.current.down) {
                    dirY = -dragSpeed
                } else if (keys.current.down && !keys.current.up) {
                    dirY = dragSpeed
                } else {
                    dirY = 0
                }
                onDrag({x: delta * dirX, y: delta * dirY}, true)
            }

            last = performance.now()

            token = requestAnimationFrame(invoke)
        }
        invoke.cancel = () => {token && cancelAnimationFrame(token)
        last = -1
        }

        return invoke
    })()

    // do not store position in useState! even if you useEffect on
    // it and update `transform` CSS property, React still rerenders
    // on every state change, and it LAGS
    const position = useRef({ x: 0, y: 0 });
    const ref = useRef<HTMLElement | null>(null);

    // a reference to a function to clean up listeners
    const unsubscribe = useRef<() => void>();

    // passed as a ref to the object that should be draggable
    const legacyRef = useCallback((elem: HTMLElement | null) => {

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

            mouseOffset.current = {x: e.offsetX, y: e.offsetY}
            setPressed(true);
        };

        const handleKeyPress = (e: KeyboardEvent) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') {
                return
            }
            switch (e.key) {
                case 'ArrowLeft':
                    keys.current.left = true
                    break
                case 'ArrowRight':
                    keys.current.right = true
                    break
                case 'ArrowUp':
                    keys.current.up = true
                    break
                case 'ArrowDown':
                    keys.current.down = true
                    break
            }
            setPressed((prevState) => {
                if (!prevState) {
                    keyMoveLoop()
                }
                return true
            })
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
        const handleMouseMove = (event: MouseEvent) => {

            // todo this needs to be a delta because:
            //      if we try to do an absolute position, we get the offset relative to the handel (and we need to adjust by the offset when the user does a mouse down)
                        // we can fix this by getting the client x and y, and then subtracting the position of the canvas
            //                  but then we need a ref to the canvas
            //      other problem is, this will remove and re-add the listener every single time the mouse moves because the position changes which means onDrag changes
            // does passing in a "relative to" prop make sense?
            let newPos: {x: number, y: number}
            if (relativeTo) {
                const rect = relativeTo.current?.getBoundingClientRect() ?? {x: 0, y: 0}
                newPos = {
                    x: event.clientX - rect.x - mouseOffset.current.x,
                    y: event.clientY - rect.y - mouseOffset.current.y
                }
            } else {
                newPos = {
                    x: event.movementX,
                    y: event.movementY
                }
            }
            // todo instead of this awful "delta" parameter, we could cache movements and commit them on animation frames
            onDrag(newPos, !Boolean(relativeTo));
        };
        const handleMouseUp = (e: MouseEvent) => {
            if (e.target && e.target instanceof HTMLElement) {
                e.target.style.userSelect = "auto";
            }
            console.log("mouse up")
            setPressed(false);
        };

        const mouseMoveListener = relativeTo ? throttle(handleMouseMove) : handleMouseMove

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') {
                return
            }
            console.log("key up")
            switch (e.key) {
                case 'ArrowLeft':
                    keys.current.left = false
                    break
                case 'ArrowRight':
                    keys.current.right = false
                    break
                case 'ArrowUp':
                    keys.current.up = false
                    break
                case 'ArrowDown':
                    keys.current.down = false
                    break
            }
            if (!(keys.current.up || keys.current.down || keys.current.left || keys.current.right)) {
                setPressed(false)
                keyMoveLoop.cancel()
            }
        }
        // subscribe to mousemove and mouseup on document, otherwise you
        // can escape bounds of element while dragging and get stuck
        // dragging it forever
        document.addEventListener("mousemove", mouseMoveListener);
        document.addEventListener("mouseup", handleMouseUp);
        document.addEventListener('keyup', handleKeyUp)
        return () => {
            //handleMouseMove.cancel();
            console.log("cleaning up")
            keyMoveLoop.cancel()
            document.removeEventListener("mousemove", mouseMoveListener);
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

export default useDraggable