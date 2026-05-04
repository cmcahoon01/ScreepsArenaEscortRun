import { getObjectById, getObjectsByPrototype, getRange } from 'game/utils';
import { Structure } from 'game/prototypes';
import { ActiveCreep } from './ActiveCreep.mjs';
import { KitingBehavior } from '../combat/KitingBehavior.mjs';
import { isInRangedAttackRange } from '../services/RangeUtils.mjs';
import { CombatUtils } from '../services/CombatUtils.mjs';
import { MapTopology, RangeConfig } from '../constants.mjs';

// Base class for ranged combat units (archer and cleric)
export class RangedJob extends ActiveCreep {
    constructor(id, jobName, tier, controller, gameState) {
        super(id, jobName, tier, controller, gameState);
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

    // Idle behavior - move towards center or stay away from enemy spawn
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
        const mapSize = MapTopology.ARENA_SIZE;
        const centerPos = {
            x: mapSize / 2,
            y: mapSize / 2
        };

        creep.moveTo(centerPos);
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
        
        // Enemies within ranged attack range - drives kiting and "fight back" logic
        const enemiesInRange = allHostileCreeps.filter(e => isInRangedAttackRange(creep, e));
        
        // === HEALING LOGIC (if applicable) ===
        this.performHealing(creep, damagedCreeps, allCreeps);
        
        // === DEFENSIVE POSTURING CHECK ===
        // const inDefensiveMode = CombatUtils.handleDefensiveRetreat(creep, this.gameState);
        const inDefensiveMode = false;
        
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

        // === ATTACK / MOVEMENT LOGIC ===
        const result = CombatUtils.selectPrimaryTarget(creep, this.gameState, enemiesInRange);

        if (!result || result.mode === 'idle') {
            this.idle(creep, damagedCreeps);
            return;
        }

        if (result.mode === 'payload_priority') {
            if (result.combatEnemiesInRange.length > 0) {
                // Fight back against the nearest combat unit already in attack range
                const target = creep.findClosestByRange(result.combatEnemiesInRange);
                if (target) {
                    const rangeToTarget = getRange(creep, target);
                    if (rangeToTarget < RangeConfig.RANGED_ATTACK_RANGE) {
                        const retreatPos = this.findBestRetreatPosition(creep, allHostileCreeps, allCreeps, allStructures);
                        if (retreatPos) {
                            creep.moveTo(retreatPos);
                        }
                    } else if (rangeToTarget > RangeConfig.RANGED_ATTACK_RANGE) {
                        creep.moveTo(target);
                    }
                    creep.rangedAttack(target);
                }
            } else {
                // No combat enemies in attack range — pursue and attack the enemy payload
                const rangeToPayload = getRange(creep, result.enemyPayload);
                if (rangeToPayload > RangeConfig.RANGED_ATTACK_RANGE) {
                    creep.moveTo(result.enemyPayload);
                }
                creep.rangedAttack(result.enemyPayload);
            }
            return;
        }

        // Standard mode: disengage if the coordinator says enemies have retreated
        if (!this.gameState.isCombatEngaged()) {
            this.idle(creep, damagedCreeps);
            return;
        }

        const range = getRange(creep, result.attackTarget);

        if (enemiesInRange.length > 0 && range < RangeConfig.RANGED_ATTACK_RANGE) {
            // Kite: move away from enemies
            const retreatPos = this.findBestRetreatPosition(creep, allHostileCreeps, allCreeps, allStructures);
            if (retreatPos) {
                creep.moveTo(retreatPos);
            }
        } else {
            const rangeToTarget = getRange(creep, result.movementTarget);

            // If there are injured allies (excluding self), move to them first
            if (this.shouldHealDuringIdle()) {
                const damagedAllies = damagedCreeps.filter(c => c.id !== creep.id);
                if (damagedAllies.length > 0) {
                    const closestDamagedAlly = creep.findClosestByRange(damagedAllies);
                    if (closestDamagedAlly && getRange(creep, closestDamagedAlly) > 1) {
                        creep.moveTo(closestDamagedAlly);
                    }
                }
                // Otherwise move towards movement target
                else if (rangeToTarget > RangeConfig.RANGED_ATTACK_RANGE) {
                    creep.moveTo(result.movementTarget);
                }
            } else {
                // Non-healing units just move towards movement target
                if (rangeToTarget > RangeConfig.RANGED_ATTACK_RANGE) {
                    creep.moveTo(result.movementTarget);
                }
            }
        }
        creep.rangedAttack(result.attackTarget);
    }
}
