import { getRange } from 'game/utils';

/**
 * Constants and utility functions for range checking in combat and healing.
 */

// Range constants
export const RANGED_ATTACK_RANGE = 3;
export const HEAL_RANGE = 1;
export const RANGED_HEAL_RANGE = 3;
export const ADJACENT_RANGE = 1;

/**
 * Check if target is within ranged attack range.
 * @param {Object} from - Source object with position
 * @param {Object} to - Target object with position
 * @returns {boolean} True if within ranged attack range (3 tiles)
 */
export function isInRangedAttackRange(from, to) {
    return getRange(from, to) <= RANGED_ATTACK_RANGE;
}

/**
 * Check if target is adjacent (within 1 tile).
 * @param {Object} from - Source object with position
 * @param {Object} to - Target object with position
 * @returns {boolean} True if adjacent (1 tile)
 */
export function isAdjacent(from, to) {
    return getRange(from, to) <= ADJACENT_RANGE;
}

/**
 * Check if target is within heal range.
 * @param {Object} from - Source object with position
 * @param {Object} to - Target object with position
 * @returns {boolean} True if within heal range (1 tile)
 */
export function isInHealRange(from, to) {
    return getRange(from, to) <= HEAL_RANGE;
}

/**
 * Check if target is within ranged heal range.
 * @param {Object} from - Source object with position
 * @param {Object} to - Target object with position
 * @returns {boolean} True if within ranged heal range (3 tiles)
 */
export function isInRangedHealRange(from, to) {
    return getRange(from, to) <= RANGED_HEAL_RANGE;
}
