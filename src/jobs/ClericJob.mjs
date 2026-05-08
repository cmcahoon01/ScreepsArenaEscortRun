import { getObjectById, getRange } from 'game/utils';
import { RANGED_ATTACK, HEAL, MOVE } from 'game/constants';
import { RangedJob } from './base/RangedJob.mjs';
import { isInHealRange, isInRangedHealRange } from '../services/RangeUtils.mjs';
import { calculateCost } from '../services/BodyPartService.mjs';

export class ClericJob extends RangedJob {
    static get BODY() {
        return [MOVE, MOVE, RANGED_ATTACK, HEAL];
    }

    static get COST() {
        return calculateCost(this.BODY);
    }

    static get JOB_NAME() {
        return 'cleric';
    }

    shouldHealDuringIdle() {
        return true;
    }

    performHealing(creep, damagedCreeps, allCreeps) {
        const selfIsDamaged = creep.hits < creep.hitsMax;

        if (selfIsDamaged) {
            creep.heal(creep);
        } if (damagedCreeps.length > 0) {
            const closestDamagedAlly = creep.findClosestByRange(damagedCreeps);
            if (closestDamagedAlly && closestDamagedAlly.id !== creep.id) {
                if (isInHealRange(creep, closestDamagedAlly)) {
                    creep.heal(closestDamagedAlly);
                } else if (isInRangedHealRange(creep, closestDamagedAlly)) {
                    creep.rangedHeal(closestDamagedAlly);
                }
            }
        }
    }
}
