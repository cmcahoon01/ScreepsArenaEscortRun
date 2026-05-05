import { ATTACK, MOVE, HEAL } from 'game/constants';
import { MeleeJob } from './base/MeleeJob.mjs';
import { isInHealRange } from '../services/RangeUtils.mjs';
import { calculateCost } from '../services/BodyPartService.mjs';

export class PaladinJob extends MeleeJob {
    static get BODY() {
        return [MOVE, ATTACK, MOVE, HEAL];
    }

    static get COST() {
        return calculateCost(this.BODY);
    }

    static get JOB_NAME() {
        return 'paladin';
    }

    performHealing(creep, damagedCreeps) {
        const selfIsDamaged = creep.hits < creep.hitsMax;

        if (selfIsDamaged) {
            creep.heal(creep);
            return;
        }

        const adjacentDamagedAlly = damagedCreeps.find(c => isInHealRange(creep, c));
        if (adjacentDamagedAlly) {
            creep.heal(adjacentDamagedAlly);
        }
    }
}
