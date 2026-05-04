export const BT_SUCCESS = 'success';
export const BT_FAILURE = 'failure';
export const BT_RUNNING = 'running';

// Selector: returns SUCCESS on first SUCCESS child, FAILURE if all fail
export function selector(children) {
    return (ctx) => {
        for (const child of children) {
            const result = child(ctx);
            if (result !== BT_FAILURE) return result;
        }
        return BT_FAILURE;
    };
}

// Sequence: returns FAILURE on first FAILURE child, SUCCESS if all succeed
export function sequence(children) {
    return (ctx) => {
        for (const child of children) {
            const result = child(ctx);
            if (result !== BT_SUCCESS) return result;
        }
        return BT_SUCCESS;
    };
}

// Condition: returns SUCCESS if predicate is true, FAILURE otherwise
export function condition(predicate) {
    return (ctx) => predicate(ctx) ? BT_SUCCESS : BT_FAILURE;
}

// Action: always returns SUCCESS (actions don't fail)
export function action(fn) {
    return (ctx) => { fn(ctx); return BT_SUCCESS; };
}
