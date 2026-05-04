import { BODY_PART_COSTS } from '../constants.mjs';

/**
 * Utility service for calculating creep body costs.
 */
export class BodyPartCalculator {
    /**
     * Calculate the total energy cost of a body parts array.
     * @param {string[]} bodyParts - Array of body part constants (e.g., [MOVE, ATTACK])
     * @returns {number} Total energy cost
     */
    static calculateCost(bodyParts) {
        if (!bodyParts || bodyParts.length === 0) {
            return 0;
        }
        return bodyParts.reduce((sum, part) => {
            const cost = BODY_PART_COSTS[part];
            if (cost === undefined) {
                console.log(`Warning: Unknown body part type '${part}'`);
                return sum;
            }
            return sum + cost;
        }, 0);
    }
}
