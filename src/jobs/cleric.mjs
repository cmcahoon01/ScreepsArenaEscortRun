import { getObjectById, getRange } from 'game/utils';
import { RANGED_ATTACK, HEAL, MOVE } from 'game/constants';
import { RangedJob } from './RangedJob.mjs';
import { isInHealRange, isInRangedHealRange } from '../services/RangeUtils.mjs';
import { BodyPartCalculator } from '../constants.mjs';

// Cleric job - ranged combat with healing abilities
export class ClericJob extends RangedJob {
    static get BODY() {
        return [MOVE, MOVE, RANGED_ATTACK, HEAL];
    }

    static get COST() {
        return BodyPartCalculator.calculateCost(this.BODY);
    }

    static get JOB_NAME() {
        return 'cleric';
    }

    shouldHealDuringIdle() {
        return true;
    }

    performHealing(creep, damagedCreeps, allCreeps) {
        // Check if cleric itself is damaged - highest priority for healing
        const selfIsDamaged = creep.hits < creep.hitsMax;
        
        // Priority 1: Heal self if damaged
        if (selfIsDamaged) {
            creep.heal(creep);
        }
        // Priority 2: Heal other damaged allies in range
        else if (damagedCreeps.length > 0) {
            const closestDamagedAlly = creep.findClosestByRange(damagedCreeps);
            if (closestDamagedAlly && closestDamagedAlly.id !== creep.id) {
                const range = getRange(creep, closestDamagedAlly);
                
                // Healing is more effective at close range
                if (isInHealRange(creep, closestDamagedAlly)) {
                    creep.heal(closestDamagedAlly);
                } else if (isInRangedHealRange(creep, closestDamagedAlly)) {
                    creep.rangedHeal(closestDamagedAlly);
                }
            }
        }
    }
}
