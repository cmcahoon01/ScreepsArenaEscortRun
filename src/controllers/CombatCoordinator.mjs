import {CombatUtils} from '../services/combat/CombatUtils.mjs';
import {ATTACK, RANGED_ATTACK} from "game/constants";
import { getRange } from 'game/utils';
import { calculateTeamStrength } from '../services/combat/StrengthEstimatorService.mjs';
import { CombatConfig } from '../constants.mjs';
import { chebyshevDistance } from '../services/RangeUtils.mjs';
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
 * The vanguard is the set of combat units whose chebyshevDistance from the leader is within
 * CombatConfig.VANGUARD_GROUP_HEIGHT, where the leader is the unit closest to the enemy spawn.
 */
export class CombatCoordinator {
    /**
     * Find a team's vanguard: the combat unit closest (by chebyshevDistance) to the given
     * target position, plus all teammates within VANGUARD_GROUP_HEIGHT chebyshev distance of that leader.
     *
     * @param {Creep[]} combatUnits - Array of combat-capable creeps
     * @param {{x: number, y: number}} targetPos - The enemy spawn's position
     * @returns {Creep[]} The vanguard group (may be empty)
     */
    static findVanguard(combatUnits, targetPos) {
        if (combatUnits.length === 0) return [];

        const leader = combatUnits.reduce((best, unit) =>
            chebyshevDistance(unit, targetPos) < chebyshevDistance(best, targetPos) ? unit : best
        );

        return combatUnits.filter(u => chebyshevDistance(u, leader) < CombatConfig.VANGUARD_GROUP_HEIGHT);
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
            // Find the enemy vanguard leader: the enemy combat unit closest to our spawn
            const enemyVanguardLeader = enemyCombatUnits.reduce((best, unit) =>
                chebyshevDistance(unit, mySpawn) < chebyshevDistance(best, mySpawn) ? unit : best
            );

            // The vanguard is the leader plus all units within VANGUARD_GROUP_HEIGHT chebyshev distance of it
            const enemyVanguard = enemyCombatUnits.filter(
                u => chebyshevDistance(u, enemyVanguardLeader) < CombatConfig.VANGUARD_GROUP_HEIGHT
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
                const myVanguard = CombatCoordinator.findVanguard(myCombatUnits, enemySpawn);

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
                            chebyshevDistance(unit, enemySpawn) < chebyshevDistance(best, enemySpawn) ? unit : best
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
    }
}
