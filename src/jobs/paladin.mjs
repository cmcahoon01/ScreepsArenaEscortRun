import { ATTACK, MOVE, HEAL } from 'game/constants';
import { MeleeJob } from './MeleeJob.mjs';
import { isInHealRange } from '../services/RangeUtils.mjs';
import { BodyPartCalculator } from '../services/BodyPartService.mjs';

// Paladin job - melee combat with self-healing
export class PaladinJob extends MeleeJob {
    static get BODY() {
        return [MOVE, ATTACK, MOVE, HEAL];
    }

    static get COST() {
        return BodyPartCalculator.calculateCost(this.BODY);
    }

    static get JOB_NAME() {
        return 'paladin';
    }

    performHealing(creep, damagedCreeps) {
        const selfIsDamaged = creep.hits < creep.hitsMax;

        // Priority 1: Heal self if damaged
        if (selfIsDamaged) {
            creep.heal(creep);
            return;
        }

        // Priority 2: If self is full HP, heal an adjacent ally that is missing HP
        const adjacentDamagedAlly = damagedCreeps.find(c => isInHealRange(creep, c));
        if (adjacentDamagedAlly) {
            creep.heal(adjacentDamagedAlly);
        }
    }
}
