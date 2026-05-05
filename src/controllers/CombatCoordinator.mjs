import {CombatUtils, findFlagBlockingEnemy} from '../services/combat/CombatUtils.mjs';
import {CombatConfig} from '../constants.mjs';
import {ATTACK, RANGED_ATTACK} from "game/constants";

/**
 * CombatCoordinator — group-level engage / disengage logic.
 *
 * Ensures all combat units behave as a unit: they either all fight together
 * or all fall back to the map center together.
 *
 * Hysteresis is used to prevent rapid toggling when enemies hover near the
 * territory boundary.  Two separate Euclidean radii (measured from the enemy
 * spawn) define a neutral gap:
 *
 *   ENGAGE   — triggered when any enemy combat unit crosses outside
 *              CombatConfig.COMBAT_ENGAGE_RADIUS (the outer / larger radius).
 *   NEUTRAL  — enemy is between the two radii; current state is held.
 *   DISENGAGE — triggered when ALL enemy combat units retreat inside
 *              CombatConfig.ENEMY_SPAWN_EXCLUSION_RADIUS (the inner radius).
 *
 * The result is stored in GameState and consulted by each combat job during
 * its act() call.  The enemy-escort / payload-priority path in each job is
 * always active regardless of this state so that units never ignore an
 * advancing enemy payload.
 */
export class CombatCoordinator {
    /**
     * Compute the Euclidean distance from a position to the enemy spawn.
     * @param {Object} pos - Position with x and y coordinates
     * @param {{x: number, y: number}|null} enemySpawn - Enemy spawn structure
     * @returns {number} Euclidean distance, or Infinity if spawn is unknown
     */
    static distanceToEnemySpawn(pos, enemySpawn) {
        if (!enemySpawn) {
            return Infinity;
        }
        const dx = pos.x - enemySpawn.x;
        const dy = pos.y - enemySpawn.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Update the combat engagement state for the current tick.
     * Must be called once per tick, after gameState.refresh().
     *
     * @param {GameState} gameState - The game state service
     */
    static tick(gameState) {
        const enemyCreeps = gameState.getEnemyCreeps();
        const enemySpawn = gameState.getEnemySpawn();

        if (enemyCreeps.length === 0) {
            gameState.setCombatEngaged(false);
            return;
        }

        // Only count enemies that can actually threaten our units
        const enemyCombatUnits = enemyCreeps.filter(e => CombatUtils.hasAttackCapability(e));

        if (enemyCombatUnits.length === 0) {
            // Non-combat enemies only (miners, tugs, etc.) - stay disengaged
            gameState.setCombatEngaged(false);
            return;
        }

        const currentlyEngaged = gameState.isCombatEngaged();

        if (currentlyEngaged) {
            // === ALREADY ENGAGED ===
            // Disengage only when ALL combat enemies have fully retreated inside the
            // inner exclusion radius.  Enemies lingering in the neutral gap keep the
            // engagement active, avoiding oscillation.
            const anyEnemyOutsideInnerRadius = enemyCombatUnits.some(
                e => CombatCoordinator.distanceToEnemySpawn(e, enemySpawn) >
                    CombatConfig.ENEMY_SPAWN_EXCLUSION_RADIUS
            );
            if (!anyEnemyOutsideInnerRadius) {
                gameState.setCombatEngaged(false);
            }
            // Otherwise stay engaged (neutral gap or still outside)
        } else {
            // === CURRENTLY DISENGAGED ===
            // Engage only when at least one combat enemy has crossed the outer radius.
            // Enemies still within the neutral gap do not trigger engagement.
            const anyEnemyOutsideEngageRadius = enemyCombatUnits.some(
                e => CombatCoordinator.distanceToEnemySpawn(e, enemySpawn) >
                    CombatConfig.COMBAT_ENGAGE_RADIUS
            );
            if (anyEnemyOutsideEngageRadius) {
                gameState.setCombatEngaged(true);
            }
            // Otherwise stay disengaged (neutral gap)
        }

        const flagBlocker = findFlagBlockingEnemy(gameState, enemyCreeps);
        if (flagBlocker && gameState.getFlagKillerId() === null) {
            // pick a unit to assign to kill it, preferring melee units
            const ourMeleeCombatUnits = gameState.getMyCreeps().filter(c => c.body.some(part => part.type === ATTACK));
            const ourRangedCombatUnits = gameState.getMyCreeps().filter(c => c.body.some(part => part.type === RANGED_ATTACK));
            const candidates = ourMeleeCombatUnits.length > 0 ? ourMeleeCombatUnits : ourRangedCombatUnits;
            if (candidates.length > 0) {
                const flagKiller = candidates.reduce((closest, c) => {
                    const dist = CombatUtils.euclideanDistance(c, flagBlocker);
                    if (dist < closest.dist) {
                        return {creep: c, dist};
                    } else {
                        return closest;
                    }
                }, {creep: null, dist: Infinity}).creep;

                if (flagKiller) {
                    gameState.setFlagKillerId(flagKiller.id);
                }
            }
        } else if (!flagBlocker) {
            // flag is not blocked, clear the assignment
            gameState.setFlagKillerId(null);
        }
    }
}
