import { getObjectById, getRange } from 'game/utils';
import { ATTACK, MOVE, ERR_NOT_IN_RANGE} from 'game/constants';
import { Creep, StructureSpawn, StructureRampart } from 'game/prototypes';
import { ActiveCreep } from './ActiveCreep.mjs';
import { CombatUtils } from '../services/CombatUtils.mjs';
import { BodyPartCalculator, MapTopology } from '../constants.mjs';

// Fighter job - melee combat
export class FighterJob extends ActiveCreep {
    static get BODY() {
        return [MOVE, ATTACK];
    }

    static get COST() {
        return BodyPartCalculator.calculateCost(this.BODY);
    }

    static get JOB_NAME() {
        return 'fighter';
    }

    act() {
        const creep = getObjectById(this.id);
        if (!creep) {
            return;
        }

        // === DEFENSIVE POSTURING CHECK ===
        const inDefensiveMode = CombatUtils.handleDefensiveRetreat(creep, this.gameState);
        
        if (inDefensiveMode) {
            // Still attack enemies if they're in range (even while on ramparts)
            const allHostileCreeps = this.gameState.getEnemyCreeps();
            if (allHostileCreeps.length > 0) {
                const closestEnemy = creep.findClosestByRange(allHostileCreeps);
                if (closestEnemy) {
                    creep.attack(closestEnemy);
                }
            }
            return;
        }

        // Find all enemy creeps
        const allHostileCreeps = this.gameState.getEnemyCreeps();
        
        // Get all ramparts
        const ramparts = this.gameState.getRamparts();
        
        // Filter out enemies that are standing on ramparts
        const hostileCreeps = CombatUtils.filterMeleeTargetableEnemies(allHostileCreeps, ramparts);

        // Filter out enemies within the spawn exclusion zone - don't pursue them in
        const enemySpawn = this.gameState.getEnemySpawn();
        const movementTargets = enemySpawn
            ? hostileCreeps.filter(e => !CombatUtils.isWithinEnemySpawnRadius(e, enemySpawn))
            : hostileCreeps;
        
        // Check if there are any enemies within range 5 - fight back against nearby threats
        const enemiesInRange5 = movementTargets.filter(enemy => getRange(creep, enemy) <= 5);
        
        if (enemiesInRange5.length > 0) {
            // Enemies are nearby - fight back
            const target = creep.findClosestByRange(enemiesInRange5);
            if (target) {
                this.attackOrMoveTo(creep, target);
            }
            return;
        }

        // Not in combat - check if an enemy is blocking the flag while the payload is close.
        // Only the single designated flag killer pursues it; other units behave normally.
        const flagBlocker = CombatUtils.findFlagBlockingEnemy(this.gameState, allHostileCreeps);
        if (flagBlocker && this.id === this.gameState.getFlagKillerId()) {
            this.attackOrMoveTo(creep, flagBlocker);
            return;
        }

        // No immediate threats - prioritize hunting the enemy escort creep (payload)
        const enemyEscortCreepId = this.gameState.getEnemyEscortCreepId();
        if (enemyEscortCreepId) {
            const enemyPayload = getObjectById(enemyEscortCreepId);
            if (enemyPayload) {
                // Only pursue if the enemy payload is not on an enemy rampart and not in the spawn zone
                const isOnRampart = CombatUtils.isOnEnemyRampart(enemyPayload, ramparts);
                if (!isOnRampart && !CombatUtils.isWithinEnemySpawnRadius(enemyPayload, enemySpawn)) {
                    this.attackOrMoveTo(creep, enemyPayload);
                    return;
                }
            }
        }

        // No enemy payload to hunt - check for fortified miner
        const fortifiedMiner = this.gameState.getFortifiedMiner();
        if (fortifiedMiner) {
            this.attackFortifiedMiner(creep, fortifiedMiner);
            return;
        }

        // If payload is moving, engage the closest enemy to the payload (not on a rampart, not in spawn zone)
        if (this.gameState.isPayloadMoving()) {
            const payloadId = this.gameState.getPayloadId();
            const payload = payloadId ? getObjectById(payloadId) : null;
            if (payload && movementTargets.length > 0) {
                const enemyClosestToPayload = payload.findClosestByRange(movementTargets);
                if (enemyClosestToPayload) {
                    this.attackOrMoveTo(creep, enemyClosestToPayload);
                    return;
                }
            }
        }

        // No fortified miner, no payload priority - idle
        this.idle(creep);
    }

    /**
     * Attempt to attack a target; if out of range, move toward it.
     * @param {Creep} creep - The attacking creep
     * @param {Object} target - The target game object
     */
    attackOrMoveTo(creep, target) {
        const attackResult = creep.attack(target);
        if (attackResult === ERR_NOT_IN_RANGE) {
            creep.moveTo(target);
        }
    }
    
    /**
     * Attack a fortified miner by moving towards it and breaking ramparts in the way.
     * @param {Creep} creep - The fighter creep
     * @param {Object} fortifiedMiner - Object with {creep, rampart, source}
     */
    attackFortifiedMiner(creep, fortifiedMiner) {
        const targetCreep = fortifiedMiner.creep;
        const targetRampart = fortifiedMiner.rampart;
        
        // Try to attack the target creep first (if in range)
        const attackCreepResult = creep.attack(targetCreep);
        
        if (attackCreepResult === ERR_NOT_IN_RANGE) {
            // Not in range of the creep, check if we can attack the rampart
            const attackRampartResult = creep.attack(targetRampart);
            
            if (attackRampartResult === ERR_NOT_IN_RANGE) {
                // Not in range of rampart either, move towards the target
                creep.moveTo(targetCreep);
            }
            // If we successfully attacked the rampart, no need to move
        }
        // If we successfully attacked the creep, no need to move
    }

    idle(creep) {
        const enemySpawn = this.gameState.getEnemySpawn();
        const mapSize = MapTopology.ARENA_SIZE;
        const centerPos = {
            x: mapSize / 2,
            y: mapSize / 2
        };

        // Never move within the spawn exclusion zone - retreat toward center if inside it
        if (enemySpawn && CombatUtils.isWithinEnemySpawnRadius(creep, enemySpawn)) {
            creep.moveTo(centerPos);
            return;
        }

        // Idle near center of the map (Manhattan distance is sufficient for this coarse check)
        const distToCenter = Math.abs(creep.x - centerPos.x) + Math.abs(creep.y - centerPos.y);
        if (distToCenter > mapSize / 4) {
            creep.moveTo(centerPos);
        }
    }
}
