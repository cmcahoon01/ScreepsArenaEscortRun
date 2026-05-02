import { compareTeamStrengths } from '../combat/strengthEstimator.mjs';
import { CombatConfig, MapTopology } from '../constants.mjs';

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
        
        // Determine which axis the spawns are separated on
        // If enemy spawn is in left third (x < 33.33), enemy third is x < 33.33
        // If enemy spawn is in right third (x > 66.67), enemy third is x > 66.67
        
        if (enemySpawn.x < thirdSize) {
            // Enemy is in left third
            return pos.x < thirdSize;
        } else if (enemySpawn.x > mapSize - thirdSize) {
            // Enemy is in right third
            return pos.x > mapSize - thirdSize;
        }
        
        return false;
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
}
