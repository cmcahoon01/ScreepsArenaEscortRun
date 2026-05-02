import { getObjectById, getObjectsByPrototype, getRange } from 'game/utils';
import { Creep, StructureSpawn, StructureRampart, Structure } from 'game/prototypes';
import { ActiveCreep } from './ActiveCreep.mjs';
import { KitingBehavior } from '../combat/KitingBehavior.mjs';
import { isInRangedAttackRange, RANGED_ATTACK_RANGE } from '../services/RangeUtils.mjs';
import { CombatUtils } from '../services/CombatUtils.mjs';
import { MapTopology } from '../constants.mjs';

// Kiting behavior constants
const DESIRED_RANGE = 3;

// Base class for ranged combat units (archer and cleric)
export class RangedJob extends ActiveCreep {
    constructor(id, jobName, tier, controller, winObjective, gameState) {
        super(id, jobName, tier, controller, winObjective, gameState);
        if (new.target === RangedJob) {
            throw new TypeError("Cannot construct RangedJob instances directly");
        }
    }

    // Get all valid adjacent positions that the creep can move to
    getValidAdjacentPositions(creep, allCreeps, allStructures) {
        return KitingBehavior.getValidAdjacentPositions(creep, allCreeps, allStructures);
    }

    // Find the nearest enemy to a position
    findNearestEnemy(position, enemies) {
        return KitingBehavior.findNearestEnemy(position, enemies);
    }

    // Find the best retreat position from enemies
    findBestRetreatPosition(creep, enemies, allCreeps, allStructures) {
        return KitingBehavior.findBestRetreatPosition(creep, enemies, allCreeps, allStructures);
    }

    // Idle behavior - move towards center or stay defensive
    idle(creep, damagedCreeps) {
        // Subclasses can optionally check for injured allies first
        if (this.shouldHealDuringIdle() && damagedCreeps) {
            const damagedAllies = damagedCreeps.filter(c => c.id !== creep.id);
            if (damagedAllies.length > 0) {
                const closestDamagedAlly = creep.findClosestByRange(damagedAllies);
                if (closestDamagedAlly) {
                    creep.moveTo(closestDamagedAlly);
                }
                return;
            }
        }
        
        const enemySpawn = this.gameState.getEnemySpawn();
        if (enemySpawn) {
            // Check if we're in enemy's third of the map - if so, move out
            if (CombatUtils.isInEnemyThird(creep, enemySpawn)) {
                // Move towards our spawn (away from enemy third)
                const mySpawn = this.gameState.getMySpawn();
                if (mySpawn) {
                    creep.moveTo(mySpawn);
                }
            } else {
                // Move towards enemy spawn to stay active
                creep.moveTo(enemySpawn);
            }
        }
    }

    // Hook method for subclasses to indicate if they should heal during idle
    shouldHealDuringIdle() {
        return false;
    }

    // Hook method for subclasses to implement healing logic
    performHealing(creep, damagedCreeps, allCreeps) {
        // Default: no healing
    }

    act() {
        const creep = getObjectById(this.id);
        if (!creep) {
            return;
        }

        // Cache expensive operations once per tick
        const allCreeps = this.gameState.getAllCreeps();
        const allStructures = getObjectsByPrototype(Structure);
        
        // Find all enemy creeps
        const allHostileCreeps = this.gameState.getEnemyCreeps();
        const myCreeps = this.gameState.getMyCreeps();
        
        // Find damaged friendly creeps (including self)
        const damagedCreeps = myCreeps.filter(c => c.hits < c.hitsMax);
        
        // Determine if there are enemies in range
        const enemiesInRange = allHostileCreeps.filter(e => isInRangedAttackRange(creep, e));
        
        // === HEALING LOGIC (if applicable) ===
        this.performHealing(creep, damagedCreeps, allCreeps);
        
        // === DEFENSIVE POSTURING CHECK ===
        const inDefensiveMode = CombatUtils.handleDefensiveRetreat(creep, this.gameState);
        
        if (inDefensiveMode) {
            // Still attack enemies if they're in range (even while on ramparts)
            if (allHostileCreeps.length > 0) {
                const closestEnemy = creep.findClosestByRange(allHostileCreeps);
                if (closestEnemy && isInRangedAttackRange(creep, closestEnemy)) {
                    creep.rangedAttack(closestEnemy);
                }
            }
            return;
        }
        
        // === ATTACK LOGIC (when not in defensive mode) ===
        if (allHostileCreeps.length > 0) {
            // Get all ramparts for targeting logic
            const ramparts = this.gameState.getRamparts();
            
            // Separate enemies into those on ramparts and those not on ramparts
            const { enemiesNotOnRamparts, enemiesOnRamparts } = CombatUtils.filterEnemiesByRampartStatus(
                allHostileCreeps, 
                ramparts
            );
            
            // Only target enemies if there are valid targets (not all on ramparts)
            if (enemiesNotOnRamparts.length > 0) {
                const closestEnemy = creep.findClosestByRange(enemiesNotOnRamparts);
                
                if (closestEnemy) {
                    const range = getRange(creep, closestEnemy);
                    
                    // === MOVEMENT LOGIC WHEN ENEMIES EXIST ===
                    // If there are enemies in range, movement should be dedicated to kiting
                    if (enemiesInRange.length > 0 && range < DESIRED_RANGE) {
                        // Kite: move away from enemies
                        const retreatPos = this.findBestRetreatPosition(creep, allHostileCreeps, allCreeps, allStructures);
                        if (retreatPos) {
                            creep.moveTo(retreatPos);
                        }
                    }
                    // No enemies in range - move towards target based on priority
                    else {
                        // If there are injured allies (excluding self, not in range), move to them first
                        if (this.shouldHealDuringIdle()) {
                            const damagedAllies = damagedCreeps.filter(c => c.id !== creep.id);
                            if (damagedAllies.length > 0) {
                                const closestDamagedAlly = creep.findClosestByRange(damagedAllies);
                                if (closestDamagedAlly && getRange(creep, closestDamagedAlly) > 1) {
                                    creep.moveTo(closestDamagedAlly);
                                }
                            }
                            // Otherwise move towards enemies to attack
                            else if (range > DESIRED_RANGE) {
                                creep.moveTo(closestEnemy);
                            }
                        } else {
                            // Non-healing units just move towards enemies
                            if (range > DESIRED_RANGE) {
                                creep.moveTo(closestEnemy);
                            }
                        }
                    }
                    creep.rangedAttack(closestEnemy);
                }
            } else {
                // All enemies are on ramparts or no valid targets - idle
                this.idle(creep, damagedCreeps);
            }
        } else {
            // No enemies at all - idle behavior
            this.idle(creep, damagedCreeps);
        }
    }
}
