import { CombatConfig } from '../constants.mjs';
import * as game from "game";
import {getObjectById} from "game/utils";
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

/**
 * Only build the creep when no enemy combat unit is near our base.
 * @param {GameState} gameState
 * @returns {boolean}
 */
export const enemyNearOurBase = (gameState) => {
    const mySpawn = gameState.getMySpawn();
    return gameState.getEnemyCreeps().some(enemy =>
        chebyshevDistance(enemy, mySpawn) <= CombatConfig.IN_OUR_QUADRANT_DISTANCE
    );
};

/**
 * Only go paladins when the enemy is rushing the payload.
 * @param {GameState} gameState
 * @returns {boolean}
 */
export const enemyRushing = (gameState) => {
    const enemyPayload = getObjectById(gameState.getEnemyPayloadId());
    return chebyshevDistance(gameState.getEnemySpawn(), enemyPayload) >= CombatConfig.AWAY_FROM_SPAWN_DISTANCE;
}

/**
 * Compute Chebyshev (chessboard) distance between two positions. Duplicate to avoid circular import
 * @param {Object} a - Position with x, y
 * @param {Object} b - Position with x, y
 * @returns {number} Chebyshev distance
 */
function chebyshevDistance(a, b) {
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}
