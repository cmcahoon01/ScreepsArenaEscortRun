import { getObjectById, getObjectsByPrototype, getRange } from 'game/utils';
import { Structure } from 'game/prototypes';
import { ActiveCreep } from './ActiveCreep.mjs';
import {
    getValidAdjacentPositions as kitingGetValidAdjacentPositions,
    findNearestEnemy as kitingFindNearestEnemy,
    findBestRetreatPosition as kitingFindBestRetreatPosition,
} from '../../services/combat/KitingBehavior.mjs';
import { isInRangedAttackRange } from '../../services/RangeUtils.mjs';
import { selectPrimaryTarget } from '../../services/combat/CombatUtils.mjs';
import { RangeConfig } from '../../constants.mjs';

export class RangedJob extends ActiveCreep {
    constructor(id, jobName, tier, controller, gameState) {
        super(id, jobName, tier, controller, gameState);
        if (new.target === RangedJob) {
            throw new TypeError("Cannot construct RangedJob instances directly");
        }
    }

    getValidAdjacentPositions(creep, allCreeps, allStructures) {
        return kitingGetValidAdjacentPositions(creep, allCreeps, allStructures);
    }

    findNearestEnemy(position, enemies) {
        return kitingFindNearestEnemy(position, enemies);
    }

    findBestRetreatPosition(creep, enemies, allCreeps, allStructures, spawnPos = null) {
        return kitingFindBestRetreatPosition(creep, enemies, allCreeps, allStructures, spawnPos);
    }

    shouldHealDuringIdle() {
        return false;
    }

    performHealing(creep, damagedCreeps, allCreeps) {
        // Default: no healing
    }

    /**
     * If this unit has healing capability and there are injured allies nearby,
     * move toward the closest one and return true (movement was overridden).
     * @param {Creep} creep
     * @param {Creep[]} damagedCreeps - All injured friendly creeps
     * @returns {boolean} True if healing movement was applied
     */
    tryHealingMove(creep, damagedCreeps) {
        if (!this.shouldHealDuringIdle()) return false;
        const damagedAllies = damagedCreeps.filter(c => c.id !== creep.id);
        if (damagedAllies.length > 0) {
            const closestDamagedAlly = creep.findClosestByRange(damagedAllies);
            if (closestDamagedAlly && getRange(creep, closestDamagedAlly) > 1) {
                creep.moveTo(closestDamagedAlly);
                return true;
            }
        }
        return false;
    }

    /**
     * Idle behaviour: healing-capable ranged units move toward injured allies;
     * non-healing units defer to the base ActiveCreep.idle() (move to MAP_CENTER).
     * @param {Creep} creep
     */
    idle(creep) {
        if (this.shouldHealDuringIdle()) {
            const myCreeps = this.gameState.getMyCreeps();
            const damagedAllies = myCreeps.filter(c => c.id !== creep.id && c.hits < c.hitsMax);
            if (damagedAllies.length > 0) {
                const closestDamagedAlly = creep.findClosestByRange(damagedAllies);
                if (closestDamagedAlly) {
                    creep.moveTo(closestDamagedAlly);
                    return;
                }
            }
        }
        super.idle(creep);
    }

    act() {
        const creep = getObjectById(this.id);
        if (!creep) return;

        const allCreeps = this.gameState.getAllCreeps();
        const allStructures = getObjectsByPrototype(Structure);
        const allHostileCreeps = this.gameState.getEnemyCreeps();
        const myCreeps = this.gameState.getMyCreeps();
        const mySpawn = this.gameState.getMySpawn();
        const damagedCreeps = myCreeps.filter(c => c.hits < c.hitsMax);
        const enemiesInRange = allHostileCreeps.filter(e => isInRangedAttackRange(creep, e));

        this.performHealing(creep, damagedCreeps, allCreeps);

        const result = selectPrimaryTarget(creep, this.gameState, enemiesInRange);

        if (!result || result.mode === 'idle') {
            this.idle(creep);
            return;
        }

        if (result.mode === 'payload_priority') {
            if (result.combatEnemiesInRange.length > 0) {
                const target = creep.findClosestByRange(result.combatEnemiesInRange);
                if (target) {
                    const rangeToTarget = getRange(creep, target);
                    if (rangeToTarget < RangeConfig.RANGED_ATTACK_RANGE) {
                        const retreatPos = this.findBestRetreatPosition(creep, allHostileCreeps, allCreeps, allStructures, mySpawn);
                        if (retreatPos) creep.moveTo(retreatPos);
                    } else if (rangeToTarget > RangeConfig.RANGED_ATTACK_RANGE) {
                        creep.moveTo(target);
                    }
                    creep.rangedAttack(target);
                }
            } else {
                const rangeToPayload = getRange(creep, result.enemyPayload);
                if (rangeToPayload > RangeConfig.RANGED_ATTACK_RANGE) {
                    creep.moveTo(result.enemyPayload);
                }
                creep.rangedAttack(result.enemyPayload);
            }
            return;
        }

        // Targeting is unchanged — always attack the target
        creep.rangedAttack(result.attackTarget);

        // Movement depends on combat mode
        const combatMode = this.gameState.getCombatMode();

        if (combatMode === 'attack') {
            // Kite if enemies are too close, else advance toward target
            const range = getRange(creep, result.attackTarget);
            if (enemiesInRange.length > 0 && range < RangeConfig.RANGED_ATTACK_RANGE) {
                const retreatPos = this.findBestRetreatPosition(creep, allHostileCreeps, allCreeps, allStructures, mySpawn);
                if (retreatPos) creep.moveTo(retreatPos);
            } else {
                const rangeToTarget = getRange(creep, result.movementTarget);
                if (!this.tryHealingMove(creep, damagedCreeps) && rangeToTarget > RangeConfig.RANGED_ATTACK_RANGE) {
                    creep.moveTo(result.movementTarget);
                }
            }
        } else if (combatMode === 'retreat') {
            // Cleric healing movement may override retreat
            if (!this.tryHealingMove(creep, damagedCreeps)) {
                const target = this.gameState.getRetreatTarget();
                if (target) creep.moveTo(target);
            }
        } else {
            // 'idle' mode — Cleric healing movement may override idle position
            if (!this.tryHealingMove(creep, damagedCreeps)) {
                const target = this.gameState.getIdleTarget();
                if (target) creep.moveTo(target);
            }
        }
    }
}
