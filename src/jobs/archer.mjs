import { RANGED_ATTACK, MOVE } from 'game/constants';
import { RangedJob } from './RangedJob.mjs';
import { BodyPartCalculator } from '../constants.mjs';

// Archer job - ranged combat without healing (behaves like cleric without healing)
export class ArcherJob extends RangedJob {
    static get BODY() {
        return [MOVE, RANGED_ATTACK];
    }

    static get COST() {
        return BodyPartCalculator.calculateCost(this.BODY);
    }

    static get JOB_NAME() {
        return 'archer';
    }

    // Archer does not heal
    shouldHealDuringIdle() {
        return false;
    }
}
