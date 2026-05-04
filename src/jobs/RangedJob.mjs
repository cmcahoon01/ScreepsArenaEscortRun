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
        
        // Determine if there are enemies in range
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

        // === ATTACK LOGIC (when not in defensive mode) ===
        if (allHostileCreeps.length > 0) {
            // Get all ramparts for targeting logic
            const ramparts = this.gameState.getRamparts();
            
            // Separate enemies into those on ramparts and those not on ramparts
            const { enemiesNotOnRamparts, enemiesOnRamparts } = CombatUtils.filterEnemiesByRampartStatus(
                allHostileCreeps, 
                ramparts
            );

            // Further filter: don't pursue enemies within the spawn exclusion zone
            const enemySpawn = this.gameState.getEnemySpawn();
            const validTargets = enemySpawn
                ? enemiesNotOnRamparts.filter(e => !CombatUtils.isWithinEnemySpawnRadius(e, enemySpawn))
                : enemiesNotOnRamparts;

            // === ENEMY PAYLOAD PRIORITY ===
            // If the enemy payload is outside the spawn exclusion zone, prioritize killing it.
            // Exception: fight back against enemy combat units currently within ranged attack range (3).
            const enemyEscortCreepId = this.gameState.getEnemyEscortCreepId();
            if (enemyEscortCreepId) {
                const enemyPayload = getObjectById(enemyEscortCreepId);
                if (enemyPayload) {
                    const isOnRampart = CombatUtils.isOnEnemyRampart(enemyPayload, ramparts);
                    if (!isOnRampart && !CombatUtils.isWithinEnemySpawnRadius(enemyPayload, enemySpawn)) {
                        // Only fight back if non-payload enemies with attack body parts are within ranged attack range (3)
                        const combatEnemiesInRange = enemiesInRange.filter(
                            e => e.id !== enemyEscortCreepId && CombatUtils.hasAttackCapability(e)
                        );

                        if (combatEnemiesInRange.length > 0) {
                            // Fight back against nearest combat unit in attack range
                            const target = creep.findClosestByRange(combatEnemiesInRange);
                            if (target) {
                                const rangeToTarget = getRange(creep, target);
                                if (rangeToTarget < DESIRED_RANGE) {
                                    const retreatPos = this.findBestRetreatPosition(creep, allHostileCreeps, allCreeps, allStructures);
                                    if (retreatPos) {
                                        creep.moveTo(retreatPos);
                                    }
                                } else if (rangeToTarget > DESIRED_RANGE) {
                                    creep.moveTo(target);
                                }
                                creep.rangedAttack(target);
                            }
                        } else {
                            // No combat enemies in attack range - pursue and attack the enemy payload
                            const rangeToPayload = getRange(creep, enemyPayload);
                            if (rangeToPayload > DESIRED_RANGE) {
                                creep.moveTo(enemyPayload);
                            }
                            creep.rangedAttack(enemyPayload);
                        }
                        return;
                    }
                }
            }

            // Only target enemies if there are valid targets (not all on ramparts or in spawn zone)
            if (validTargets.length > 0) {
                const closestEnemy = creep.findClosestByRange(validTargets);
                
                if (closestEnemy) {
                    const range = getRange(creep, closestEnemy);
                    
                    // Default attack target is the closest enemy; may be overridden below.
                    let attackTarget = closestEnemy;

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
                        // When no enemies are currently in attack range (not just out of kiting
                        // distance) and the payload is moving, prioritize the enemy closest to
                        // the payload as the movement target.  The else block also fires when
                        // enemies ARE in range but range >= DESIRED_RANGE, so the explicit
                        // check is necessary.
                        let movementTarget = closestEnemy;
                        if (enemiesInRange.length === 0) {
                            // Not in combat - check for an enemy blocking the flag.
                            // Only the single designated flag killer pursues it; other units behave normally.
                            const flagBlocker = CombatUtils.findFlagBlockingEnemy(this.gameState, allHostileCreeps);
                            if (flagBlocker && this.id === this.gameState.getFlagKillerId()) {
                                movementTarget = flagBlocker;
                                attackTarget = flagBlocker;
                            } else if (this.gameState.isPayloadMoving()) {
                                const payloadId = this.gameState.getPayloadId();
                                const payload = payloadId ? getObjectById(payloadId) : null;
                                if (payload && validTargets.length > 0) {
                                    const enemyClosestToPayload = payload.findClosestByRange(validTargets);
                                    if (enemyClosestToPayload) {
                                        movementTarget = enemyClosestToPayload;
                                    }
                                }
                            }
                        }

                        const rangeToTarget = getRange(creep, movementTarget);

                        // If there are injured allies (excluding self, not in range), move to them first
                        if (this.shouldHealDuringIdle()) {
                            const damagedAllies = damagedCreeps.filter(c => c.id !== creep.id);
                            if (damagedAllies.length > 0) {
                                const closestDamagedAlly = creep.findClosestByRange(damagedAllies);
                                if (closestDamagedAlly && getRange(creep, closestDamagedAlly) > 1) {
                                    creep.moveTo(closestDamagedAlly);
                                }
                            }
                            // Otherwise move towards movement target
                            else if (rangeToTarget > DESIRED_RANGE) {
                                creep.moveTo(movementTarget);
                            }
                        } else {
                            // Non-healing units just move towards movement target
                            if (rangeToTarget > DESIRED_RANGE) {
                                creep.moveTo(movementTarget);
                            }
                        }
                    }
                    creep.rangedAttack(attackTarget);
                }
            } else {
                // All enemies are on ramparts, in spawn zone, or no valid targets - idle
                this.idle(creep, damagedCreeps);
            }
        } else {
            // No enemies at all - idle behavior
            this.idle(creep, damagedCreeps);
        }
    }
}
