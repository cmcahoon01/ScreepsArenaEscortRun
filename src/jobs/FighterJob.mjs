import { ATTACK, MOVE } from 'game/constants';
import { MeleeJob } from './base/MeleeJob.mjs';
import { calculateCost } from '../services/BodyPartService.mjs';

export class FighterJob extends MeleeJob {
    static get BODY() {
        return [ATTACK, MOVE];
    }

    static get COST() {
        return calculateCost(this.BODY);
    }

    static get JOB_NAME() {
        return 'fighter';
    }
}
