import { CombatUtils } from '../services/CombatUtils.mjs';

/**
 * CombatCoordinator — group-level engage / disengage logic.
 *
 * Ensures all combat units behave as a unit: they either all fight together
 * or all fall back to the map center together.
 *
 * Decision rule (evaluated once per tick):
 *   ENGAGE   — at least one enemy combat unit is outside the enemy spawn
 *              exclusion zone (i.e., they have moved into open territory).
 *   DISENGAGE — all enemy combat units have retreated inside the exclusion
 *              zone (or there are no combat-capable enemies at all).
 *
 * The result is stored in GameState and consulted by each combat job during
 * its act() call.  The enemy-escort / payload-priority path in each job is
 * always active regardless of this state so that units never ignore an
 * advancing enemy payload.
 */
export class CombatCoordinator {
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

        // Engage if any combat enemy has left the safety of their spawn exclusion zone
        const anyEnemyOutside = enemyCombatUnits.some(
            e => !CombatUtils.isWithinEnemySpawnRadius(e, enemySpawn)
        );

        gameState.setCombatEngaged(anyEnemyOutside);
    }
}
