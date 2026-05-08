import { RANGED_ATTACK, MOVE } from 'game/constants';
import { RangedJob } from './base/RangedJob.mjs';
import { calculateCost } from '../services/BodyPartService.mjs';

export class ArcherJob extends RangedJob {
    static get BODY() {
        return [RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK];
    }

    static get COST() {
        return calculateCost(this.BODY);
    }

    static get JOB_NAME() {
        return 'archer';
    }

    shouldHealDuringIdle() {
        return false;
    }
}
