import { ATTACK, MOVE } from 'game/constants';
import { MeleeJob } from './MeleeJob.mjs';
import { BodyPartCalculator } from '../services/BodyPartService.mjs';

// Fighter job - melee combat
export class FighterJob extends MeleeJob {
    static get BODY() {
        return [ATTACK, MOVE];
    }

    static get COST() {
        return BodyPartCalculator.calculateCost(this.BODY);
    }

    static get JOB_NAME() {
        return 'fighter';
    }
}
