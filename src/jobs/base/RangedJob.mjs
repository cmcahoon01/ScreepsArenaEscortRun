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

    findBestRetreatPosition(creep, enemies, allCreeps, allStructures) {
        return kitingFindBestRetreatPosition(creep, enemies, allCreeps, allStructures);
    }

    shouldHealDuringIdle() {
        return false;
    }

    performHealing(creep, damagedCreeps, allCreeps) {
        // Default: no healing
    }

    act() {
        const creep = getObjectById(this.id);
        if (!creep) return;

        const allCreeps = this.gameState.getAllCreeps();
        const allStructures = getObjectsByPrototype(Structure);
        const allHostileCreeps = this.gameState.getEnemyCreeps();
        const myCreeps = this.gameState.getMyCreeps();
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
                        const retreatPos = this.findBestRetreatPosition(creep, allHostileCreeps, allCreeps, allStructures);
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

        if (!this.gameState.isCombatEngaged()) {
            this.idle(creep);
            return;
        }

        const range = getRange(creep, result.attackTarget);

        if (enemiesInRange.length > 0 && range < RangeConfig.RANGED_ATTACK_RANGE) {
            const retreatPos = this.findBestRetreatPosition(creep, allHostileCreeps, allCreeps, allStructures);
            if (retreatPos) creep.moveTo(retreatPos);
        } else {
            const rangeToTarget = getRange(creep, result.movementTarget);
            if (this.shouldHealDuringIdle()) {
                const damagedAllies = damagedCreeps.filter(c => c.id !== creep.id);
                if (damagedAllies.length > 0) {
                    const closestDamagedAlly = creep.findClosestByRange(damagedAllies);
                    if (closestDamagedAlly && getRange(creep, closestDamagedAlly) > 1) {
                        creep.moveTo(closestDamagedAlly);
                    }
                } else if (rangeToTarget > RangeConfig.RANGED_ATTACK_RANGE) {
                    creep.moveTo(result.movementTarget);
                }
            } else if (rangeToTarget > RangeConfig.RANGED_ATTACK_RANGE) {
                creep.moveTo(result.movementTarget);
            }
        }
        creep.rangedAttack(result.attackTarget);
    }
}
