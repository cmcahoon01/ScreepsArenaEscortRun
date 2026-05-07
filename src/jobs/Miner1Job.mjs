import { WORK, CARRY } from 'game/constants';
import { MinerJob } from './MinerJob.mjs';
import { calculateCost } from '../services/BodyPartService.mjs';

export class Miner1Job extends MinerJob {
    static get BODY() {
        return [WORK, WORK, WORK, CARRY];
    }

    static get COST() {
        return calculateCost(this.BODY);
    }

    static get JOB_NAME() {
        return 'miner1';
    }

    static getTierBody(_tier) {
        return this.BODY;
    }

    /** Tier-1 miners are responsible for placing the mining container. */
    shouldPlaceContainer() {
        return true;
    }
}
