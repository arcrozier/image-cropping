// By https://stackoverflow.com/users/1872046/polkovnikov-ph
// from https://stackoverflow.com/a/39192992/7484693
// licensed under CC BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/legalcode
// modified

/**
 * Slows repeated calls to a function to the rate set by the browser's preferred animation frequency
 *
 * @param f The function to throttle
 *
 * @return A function with the same arguments as f that will only call f once per animation frame, regardless of how
 * frequently the function is called
 */
export const throttle = <T extends any[]>(f: (...args: T) => void): {(...args: T): void, cancel: () => void} => {
    let token: number | null = null,
        lastArgs: T | null = null;
    const invoke = () => {
        f(...lastArgs as T);
        token = null;
    };
    const result = (...args: T) => {
        lastArgs = args;
        if (!token) {
            token = requestAnimationFrame(invoke);
        }
    };
    result.cancel = () => token && cancelAnimationFrame(token);
    return result;
};
