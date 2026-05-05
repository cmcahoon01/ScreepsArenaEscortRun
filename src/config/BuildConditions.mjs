/**
 * Build Conditions
 *
 * This file contains `only_if` functions for use in the INITIAL_BUILD order.
 * Each function receives the current GameState and returns a boolean.
 * When a condition returns false the corresponding build step is skipped
 * for that tick but will be re-evaluated every subsequent tick.
 *
 * Usage example (in constants.mjs):
 *   { job: 'blocker', replace_dead: false, only_if: BuildConditions.noEnemyCombatUnit }
 */

/**
 * Only build the creep when no enemy combat unit is on the field.
 * @param {GameState} gameState
 * @returns {boolean}
 */
export const noEnemyCombatUnit = (gameState) => !gameState.getEnemyHasCombatUnit();
