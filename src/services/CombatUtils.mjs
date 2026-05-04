import { getRange, getObjectById } from 'game/utils';
import { ATTACK, RANGED_ATTACK } from 'game/constants';
import { compareTeamStrengths } from '../combat/strengthEstimator.mjs';
import { CombatConfig, MapTopology } from '../constants.mjs';

// Job names that count as combat units eligible to be assigned as the flag killer
const COMBAT_JOBS = new Set(['fighter', 'paladin', 'archer', 'cleric']);

/**
 * Utility functions for combat logic shared across multiple combat jobs.
 */
export class CombatUtils {
    /**
     * Check if we should adopt defensive posture based on team strength.
     * @param {GameState} gameState - The game state service
     * @returns {boolean} True if we should retreat to defensive positions
     */
    static shouldAdoptDefensivePosture(gameState) {
        // If payload is moving, never adopt defensive posture
        if (gameState.isPayloadMoving()) {
            return false;
        }

        const comparison = compareTeamStrengths(gameState);
        
        // Adopt defensive posture if our strength ratio is below threshold
        // (i.e., we have appreciable disadvantage)
        return comparison.ratio < CombatConfig.DEFENSIVE_THRESHOLD;
    }
    
    /**
     * Check if there are any valid enemy targets (not on ramparts or no enemies).
     * @param {Creep[]} enemies - Array of enemy creeps
     * @param {StructureRampart[]} ramparts - Array of rampart structures
     * @returns {boolean} True if there are targetable enemies
     */
    static hasValidEnemyTargets(enemies, ramparts) {
        if (enemies.length === 0) {
            return false;
        }
        
        // Check if any enemy is NOT on a rampart
        const enemiesNotOnRamparts = CombatUtils.filterMeleeTargetableEnemies(enemies, ramparts);
        return enemiesNotOnRamparts.length > 0;
    }
    
    /**
     * Check if a position is in the enemy's third of the map.
     * Enemy's third is closest to their spawn.
     * Handles both X-axis separated maps (old layout) and Y-axis separated maps
     * (new layout where both teams spawn on the same side, e.g., both on the left).
     * @param {Object} pos - Position with x and y coordinates
     * @param {StructureSpawn} enemySpawn - Enemy spawn structure
     * @returns {boolean} True if position is in enemy's third
     */
    static isInEnemyThird(pos, enemySpawn) {
        if (!enemySpawn) {
            return false;
        }
        
        const mapSize = MapTopology.ARENA_SIZE;
        const thirdSize = mapSize / 3;
        
        if (enemySpawn.x < thirdSize) {
            // Enemy on the left side. Check if also in a top/bottom corner (new map layout
            // where both teams spawn on the left with different y positions).
            if (enemySpawn.y < thirdSize) {
                // Enemy top-left corner: avoid the top Y-third
                return pos.y < thirdSize;
            } else if (enemySpawn.y > mapSize - thirdSize) {
                // Enemy bottom-left corner: avoid the bottom Y-third
                return pos.y > mapSize - thirdSize;
            }
            // Enemy on left but not in a y-extreme (old map): avoid left X-third
            return pos.x < thirdSize;
        } else if (enemySpawn.x > mapSize - thirdSize) {
            // Enemy on right: avoid right X-third
            return pos.x > mapSize - thirdSize;
        }
        
        // Spawn is in the middle X zone – fall back to Y-axis check
        if (enemySpawn.y < thirdSize) {
            return pos.y < thirdSize;
        } else if (enemySpawn.y > mapSize - thirdSize) {
            return pos.y > mapSize - thirdSize;
        }
        
        return false;
    }
    
    /**
     * Check if a position is within the enemy spawn exclusion radius.
     * Combat units should never move within this Euclidean distance of the enemy spawn.
     * @param {Object} pos - Position with x and y coordinates
     * @param {StructureSpawn} enemySpawn - Enemy spawn structure
     * @returns {boolean} True if position is within the exclusion radius
     */
    static isWithinEnemySpawnRadius(pos, enemySpawn) {
        if (!enemySpawn) {
            return false;
        }
        const dx = pos.x - enemySpawn.x;
        const dy = pos.y - enemySpawn.y;
        return Math.sqrt(dx * dx + dy * dy) <= CombatConfig.ENEMY_SPAWN_EXCLUSION_RADIUS;
    }

    /**
     * Find a safe rampart position to retreat to.
     * Returns the closest friendly rampart to the creep.
     * @param {Creep} creep - The creep looking for safety
     * @param {GameState} gameState - The game state service
     * @returns {StructureRampart|null} The rampart to retreat to, or null if none available
     */
    static findDefensiveRampartPosition(creep, gameState) {
        const myRamparts = gameState.getMyRamparts();
        
        if (myRamparts.length === 0) {
            return null;
        }

        const myCreeps = gameState.myCreeps;

        const occupied = new Set(myCreeps.map(c => `${c.x},${c.y}`));
        const freeRamparts = myRamparts.filter(r => !occupied.has(`${r.x},${r.y}`));
        if (freeRamparts.length === 0) {
            return null;
        }

        // Find the closest friendly rampart to the creep
        const closestRampart = creep.findClosestByRange(freeRamparts);
        return closestRampart;
    }
    
    /**
     * Handle defensive retreat to ramparts when at disadvantage.
     * This is the common defensive behavior for all creeps.
     * Returns true if the creep should continue with defensive posture, false otherwise.
     * 
     * @param {Creep} creep - The creep to check and move
     * @param {GameState} gameState - The game state service
     * @returns {boolean} True if in defensive mode and should return early, false otherwise
     */
    static handleDefensiveRetreat(creep, gameState) {
        const shouldRetreat = CombatUtils.shouldAdoptDefensivePosture(gameState);
        
        if (!shouldRetreat) {
            return false; // Not in defensive mode
        }
        
        // Move to ramparts for defense
        const defensiveRampart = CombatUtils.findDefensiveRampartPosition(creep, gameState);
        if (defensiveRampart) {
            // Check if we're already on a rampart
            const onRampart = defensiveRampart.x === creep.x && defensiveRampart.y === creep.y;
            
            if (!onRampart) {
                // Move to the defensive rampart
                creep.moveTo(defensiveRampart);
            }
        }
        
        return true; // In defensive mode
    }
    
    /**
     * Filter enemies by rampart status.
     * Separates enemies into those on ramparts and those not on ramparts.
     * 
     * @param {Creep[]} enemies - Array of enemy creeps
     * @param {StructureRampart[]} ramparts - Array of rampart structures
     * @returns {Object} Object with enemiesNotOnRamparts and enemiesOnRamparts arrays
     */
    static filterEnemiesByRampartStatus(enemies, ramparts) {
        // Create a set of rampart positions for efficient lookup
        const rampartPositions = new Set(ramparts.map(r => `${r.x},${r.y}`));
        
        const enemiesNotOnRamparts = [];
        const enemiesOnRamparts = [];
        
        enemies.forEach(enemy => {
            const onRampart = rampartPositions.has(`${enemy.x},${enemy.y}`);
            if (onRampart) {
                enemiesOnRamparts.push(enemy);
            } else {
                enemiesNotOnRamparts.push(enemy);
            }
        });
        
        return {
            enemiesNotOnRamparts,
            enemiesOnRamparts
        };
    }
    
    /**
     * Filter out enemies that are standing on ramparts.
     * Returns only enemies that can be targeted by melee attacks.
     * 
     * @param {Creep[]} enemies - Array of enemy creeps
     * @param {StructureRampart[]} ramparts - Array of rampart structures
     * @returns {Creep[]} Array of enemies not on ramparts
     */
    static filterMeleeTargetableEnemies(enemies, ramparts) {
        return enemies.filter(enemy => {
            // Check if any rampart is at the same position as this enemy
            const onRampart = ramparts.some(rampart => 
                rampart.x === enemy.x && rampart.y === enemy.y
            );
            return !onRampart;
        });
    }

    /**
     * Check if a game object or position is on an enemy-owned rampart.
     * @param {Object} target - Game object or position with x and y coordinates
     * @param {StructureRampart[]} ramparts - Array of all rampart structures
     * @returns {boolean} True if the target is on an enemy-owned rampart
     */
    static isOnEnemyRampart(target, ramparts) {
        return ramparts.some(r => !r.my && r.x === target.x && r.y === target.y);
    }

    /**
     * Check if a creep has any offensive attack body parts (attack or ranged_attack).
     * Used to distinguish true combat units from non-combat creeps (e.g., miners, tugs).
     *
     * @param {Creep} creep - The creep to inspect
     * @returns {boolean} True if the creep has at least one attack or ranged_attack body part
     */
    static hasAttackCapability(creep) {
        if (!creep || !creep.body) {
            return false;
        }
        return creep.body.some(part => part.type === ATTACK || part.type === RANGED_ATTACK);
    }

    /**
     * Select the best combat unit to be the designated flag killer.
     * Priority: fighters first, then the closest combat unit (archer/cleric) to the blocker.
     *
     * @param {GameState} gameState - The game state service
     * @param {Creep} flagBlocker - The enemy standing on the flag
     * @returns {string|null} ID of the selected flag killer creep, or null if none available
     */
    static selectFlagKiller(gameState, flagBlocker) {
        const myCreeps = gameState.getMyCreeps();
        const controllerCreeps = gameState.screepController.creeps;

        const jobNameById = new Map(controllerCreeps.map(c => [c.id, c.jobName]));

        const fighters = myCreeps.filter(c => jobNameById.get(c.id) === 'fighter');
        const combatCreeps = myCreeps.filter(c => COMBAT_JOBS.has(jobNameById.get(c.id)));

        // Prefer fighters; fall back to all combat units
        const candidates = fighters.length > 0 ? fighters : combatCreeps;

        if (candidates.length === 0) {
            return null;
        }

        const closest = flagBlocker.findClosestByRange(candidates);
        return closest ? closest.id : null;
    }

    /**
     * Select the primary combat target considering all game priorities.
     *
     * Returns one of:
     *   - null: no enemies at all; caller should idle
     *   - { mode: 'idle', validTargets }:
     *       no targetable enemies (all on ramparts / in spawn zone); caller should idle
     *   - { mode: 'payload_priority', enemyPayload, combatEnemiesInRange, validTargets }:
     *       enemy escort is active: fight back against combatEnemiesInRange if any,
     *       otherwise pursue enemyPayload
     *   - { mode: 'standard', attackTarget, movementTarget, validTargets }:
     *       normal combat: attack attackTarget; move towards movementTarget
     *       (movementTarget may differ from attackTarget when flag-blocker or
     *       payload-relative priority applies and no enemies are in attack range)
     *
     * @param {Creep} creep - The acting creep
     * @param {GameState} gameState - The game state service
     * @param {Creep[]} enemiesInAttackRange - Enemies within this creep's attack range
     * @returns {Object|null}
     */
    static selectPrimaryTarget(creep, gameState, enemiesInAttackRange) {
        const allHostileCreeps = gameState.getEnemyCreeps();
        if (allHostileCreeps.length === 0) {
            return null;
        }

        const ramparts = gameState.getRamparts();
        const { enemiesNotOnRamparts } = CombatUtils.filterEnemiesByRampartStatus(allHostileCreeps, ramparts);

        const enemySpawn = gameState.getEnemySpawn();
        const validTargets = enemySpawn
            ? enemiesNotOnRamparts.filter(e => !CombatUtils.isWithinEnemySpawnRadius(e, enemySpawn))
            : enemiesNotOnRamparts;

        // === ENEMY PAYLOAD PRIORITY ===
        // If the enemy escort is outside its spawn zone and not sheltered on a rampart,
        // prioritise killing it.  Exception: fight back when combat enemies are already
        // within attack range.
        const enemyEscortCreepId = gameState.getEnemyEscortCreepId();
        if (enemyEscortCreepId) {
            const enemyPayload = getObjectById(enemyEscortCreepId);
            if (enemyPayload) {
                const isOnRampart = CombatUtils.isOnEnemyRampart(enemyPayload, ramparts);
                if (!isOnRampart && !CombatUtils.isWithinEnemySpawnRadius(enemyPayload, enemySpawn)) {
                    const combatEnemiesInRange = enemiesInAttackRange.filter(
                        e => e.id !== enemyEscortCreepId && CombatUtils.hasAttackCapability(e)
                    );
                    return {
                        mode: 'payload_priority',
                        enemyPayload,
                        combatEnemiesInRange,
                        validTargets,
                    };
                }
            }
        }

        if (validTargets.length === 0) {
            return { mode: 'idle', validTargets };
        }

        const closestEnemy = creep.findClosestByRange(validTargets);
        let attackTarget = closestEnemy;
        let movementTarget = closestEnemy;

        // When no enemies are within attack range, consider higher-priority movement targets.
        if (enemiesInAttackRange.length === 0) {
            const flagBlocker = CombatUtils.findFlagBlockingEnemy(gameState, allHostileCreeps);
            if (flagBlocker && creep.id === gameState.getFlagKillerId()) {
                attackTarget = flagBlocker;
                movementTarget = flagBlocker;
            } else if (gameState.isPayloadMoving()) {
                const payloadId = gameState.getPayloadId();
                const payload = payloadId ? getObjectById(payloadId) : null;
                if (payload && validTargets.length > 0) {
                    const enemyClosestToPayload = payload.findClosestByRange(validTargets);
                    if (enemyClosestToPayload) {
                        movementTarget = enemyClosestToPayload;
                    }
                }
            }
        }

        return { mode: 'standard', attackTarget, movementTarget, validTargets };
    }

    /**
     * Find an enemy standing on our flag when the payload is close enough to
     * make it a priority target.
     *
     * Returns the enemy creep occupying the flag's tile, or null if:
     *  - There is no flag stored in gameState, or
     *  - The payload is not within FLAG_BLOCKER_RANGE of the flag, or
     *  - No enemy is standing on the flag tile.
     *
     * @param {GameState} gameState - The game state service
     * @param {Creep[]} enemies - Array of candidate enemy creeps to check
     * @returns {Creep|null} The flag-blocking enemy creep, or null
     */
    static findFlagBlockingEnemy(gameState, enemies) {
        const flag = gameState.getFlag();
        if (!flag) {
            return null;
        }

        const payloadId = gameState.getPayloadId();
        if (!payloadId) {
            return null;
        }

        const payload = getObjectById(payloadId);
        if (!payload) {
            return null;
        }

        if (getRange(payload, flag) > CombatConfig.FLAG_BLOCKER_RANGE) {
            return null;
        }

        // Find an enemy standing on the flag tile
        return enemies.find(e => e.x === flag.x && e.y === flag.y) || null;
    }
}
