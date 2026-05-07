import {CombatUtils, findFlagBlockingEnemy} from '../services/combat/CombatUtils.mjs';
import {ATTACK, RANGED_ATTACK} from "game/constants";
import { getRange } from 'game/utils';
import { calculateTeamStrength } from '../services/combat/StrengthEstimatorService.mjs';
import { CombatConfig } from '../constants.mjs';
import {
    numStepsAwayFromOurSpawn,
    numStepsAwayFromEnemySpawn,
    positionNStepsAwayFromOurSpawn,
    positionNStepsAwayFromEnemySpawn,
} from '../services/PositionTools.js';

/**
 * CombatCoordinator — group-level combat strategy logic.
 *
 * Each tick, identifies the vanguard of each team (the frontmost combat units),
 * compares their strengths, and sets a combat mode:
 *
 *   ATTACK  — our vanguard is stronger; units advance and engage.
 *   RETREAT — our vanguard is weaker; units fall back to halfway position.
 *   IDLE    — enemy vanguard is < 25 steps from their spawn; units wait at
 *             40 steps from the enemy spawn.
 *
 * The vanguard is the set of combat units whose y-coordinate is within
 * CombatConfig.VANGUARD_GROUP_HEIGHT of the unit closest to the enemy spawn y.
 */
export class CombatCoordinator {
    /**
     * Find a team's vanguard: the combat unit closest (in y) to the given
     * target y, plus all teammates within VANGUARD_GROUP_HEIGHT y-units of that leader.
     *
     * @param {Creep[]} combatUnits - Array of combat-capable creeps
     * @param {number} targetY - The enemy spawn's y-coordinate
     * @returns {Creep[]} The vanguard group (may be empty)
     */
    static findVanguard(combatUnits, targetY) {
        if (combatUnits.length === 0) return [];

        const leader = combatUnits.reduce((best, unit) =>
            Math.abs(unit.y - targetY) < Math.abs(best.y - targetY) ? unit : best
        );

        return combatUnits.filter(u => Math.abs(u.y - leader.y) < CombatConfig.VANGUARD_GROUP_HEIGHT);
    }

    /**
     * Set the combat mode on gameState and log whenever it changes.
     * @param {GameState} gameState
     * @param {string} newMode - 'attack' | 'retreat' | 'idle'
     * @param {Object} details - Extra context to include in the log
     */
    static setMode(gameState, newMode, details = {}) {
        const prevMode = gameState.getCombatMode();
        gameState.setCombatMode(newMode);
        // if (prevMode !== newMode) {
        //     const detailStr = Object.entries(details)
        //         .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        //         .join(' ');
        //     console.log(`[CombatCoordinator] mode: ${prevMode} → ${newMode}${detailStr ? ' | ' + detailStr : ''}`);
        // }
    }

    /**
     * Update the combat strategy mode for the current tick.
     * Must be called once per tick, after gameState.refresh().
     *
     * @param {GameState} gameState - The game state service
     */
    static tick(gameState) {
        const enemyCreeps = gameState.getEnemyCreeps();
        const myCreeps = gameState.getMyCreeps();
        const enemySpawn = gameState.getEnemySpawn();
        const mySpawn = gameState.getMySpawn();

        // Reset vanguard leader each tick; set only when in retreat mode
        gameState.setMyVanguardLeaderPos(null);

        const enemyCombatUnits = enemyCreeps.filter(e => CombatUtils.hasAttackCapability(e));

        if (enemyCombatUnits.length === 0 || !enemySpawn || !mySpawn) {
            CombatCoordinator.setMode(gameState, 'attack', { reason: 'no_enemy_combat_units' });
        } else {
            const enemySpawnY = enemySpawn.y;
            const mySpawnY = mySpawn.y;

            // Find the enemy vanguard leader: the enemy combat unit closest to our spawn y
            const enemyVanguardLeader = enemyCombatUnits.reduce((best, unit) =>
                Math.abs(unit.y - mySpawnY) < Math.abs(best.y - mySpawnY) ? unit : best
            );

            // The vanguard is the leader plus all units within VANGUARD_GROUP_HEIGHT y-units of it
            const enemyVanguard = enemyCombatUnits.filter(
                u => Math.abs(u.y - enemyVanguardLeader.y) < CombatConfig.VANGUARD_GROUP_HEIGHT
            );

            const vanguardStepsFromSpawn = numStepsAwayFromEnemySpawn(gameState, enemyVanguardLeader);

            if (vanguardStepsFromSpawn < 25) {
                // Enemy is still near their base — idle forward and wait
                const idleTarget = positionNStepsAwayFromEnemySpawn(gameState, 40);
                gameState.setIdleTarget(idleTarget);
                CombatCoordinator.setMode(gameState, 'idle', {
                    enemyVanguardSize: enemyVanguard.length,
                    enemyVanguardStepsFromSpawn: vanguardStepsFromSpawn,
                    idleTarget,
                });
            } else {
                const myCombatUnits = myCreeps.filter(c => CombatUtils.hasAttackCapability(c));
                const myVanguard = CombatCoordinator.findVanguard(myCombatUnits, enemySpawnY);

                const myVanguardStrength = calculateTeamStrength(myVanguard);
                const enemyVanguardStrength = calculateTeamStrength(enemyVanguard);

                if (myVanguard.length > 0 && myVanguardStrength >= enemyVanguardStrength) {
                    CombatCoordinator.setMode(gameState, 'attack', {
                        myVanguardSize: myVanguard.length,
                        myVanguardStrength,
                        enemyVanguardSize: enemyVanguard.length,
                        enemyVanguardStrength,
                    });
                } else {
                    // Retreat to halfway between our spawn and the enemy vanguard leader
                    const stepsFromOurSpawn = numStepsAwayFromOurSpawn(gameState, enemyVanguardLeader);
                    const retreatTarget = positionNStepsAwayFromOurSpawn(gameState, Math.floor(stepsFromOurSpawn / 2));
                    gameState.setRetreatTarget(retreatTarget);

                    // Store our vanguard leader position so non-vanguard units can move toward it
                    if (myVanguard.length > 0) {
                        const myVanguardLeader = myVanguard.reduce((best, unit) =>
                            Math.abs(unit.y - enemySpawnY) < Math.abs(best.y - enemySpawnY) ? unit : best
                        );
                        gameState.setMyVanguardLeaderPos({ x: myVanguardLeader.x, y: myVanguardLeader.y });
                    }

                    CombatCoordinator.setMode(gameState, 'retreat', {
                        myVanguardSize: myVanguard.length,
                        myVanguardStrength,
                        enemyVanguardSize: enemyVanguard.length,
                        enemyVanguardStrength,
                        retreatTarget,
                    });
                }
            }
        }

        // Flag blocker assignment (unchanged)
        const flagBlocker = findFlagBlockingEnemy(gameState, enemyCreeps);
        if (flagBlocker && gameState.getFlagKillerId() === null) {
            const ourMeleeCombatUnits = gameState.getMyCreeps().filter(c => c.body.some(part => part.type === ATTACK));
            const ourRangedCombatUnits = gameState.getMyCreeps().filter(c => c.body.some(part => part.type === RANGED_ATTACK));
            const candidates = ourMeleeCombatUnits.length > 0 ? ourMeleeCombatUnits : ourRangedCombatUnits;
            if (candidates.length > 0) {
                const flagKiller = candidates.reduce((closest, c) => {
                    const dist = getRange(c, flagBlocker);
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
            gameState.setFlagKillerId(null);
        }
    }
}
