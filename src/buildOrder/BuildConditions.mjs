import {CombatConfig, PayloadConfig} from '../constants.mjs';
import * as game from "game";
import {getObjectById} from "game/utils";
import {chebyshevDistance} from "../services/RangeUtils.mjs";
import {
    compareTeamStrengths,
    getEnemyTeamStrength,
    getMyTeamStrength
} from "../services/combat/StrengthEstimatorService.mjs";
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
 * Only go tugs if we have a big military advantage
 * @param {GameState} gameState
 * @returns {boolean}
 */
export const weAreDominating = (gameState) => {
    const comparison = compareTeamStrengths(gameState);
    return comparison.ratio >= PayloadConfig.MILITARY_ADVANTAGE_THRESHOLD &&
        comparison.myTeam.strength > comparison.enemyTeam.strength + 300;
}