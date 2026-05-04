import { BODY_PART_COSTS } from '../constants.mjs';

export function calculateCost(bodyParts) {
    if (!bodyParts || bodyParts.length === 0) return 0;
    return bodyParts.reduce((sum, part) => {
        const cost = BODY_PART_COSTS[part];
        if (cost === undefined) {
            console.log(`Warning: Unknown body part type '${part}'`);
            return sum;
        }
        return sum + cost;
    }, 0);
}

// Backward-compatible class wrapper
export const BodyPartCalculator = {
    calculateCost,
};
