import { getRange } from 'game/utils';
import { RangeConfig } from '../constants.mjs';

/**
 * Utility functions for range checking in combat and healing.
 */

// Re-export range constants for convenience
export const RANGED_ATTACK_RANGE = RangeConfig.RANGED_ATTACK_RANGE;
export const HEAL_RANGE = RangeConfig.HEAL_RANGE;
export const RANGED_HEAL_RANGE = RangeConfig.RANGED_HEAL_RANGE;
export const ADJACENT_RANGE = RangeConfig.ADJACENT_RANGE;

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
