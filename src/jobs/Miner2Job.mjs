import {WORK, CARRY, ERR_NOT_IN_RANGE, RESOURCE_ENERGY} from 'game/constants';
import { MinerJob } from './MinerJob.mjs';
import { calculateCost } from '../services/BodyPartService.mjs';
import {getObjectById} from "game/utils";

export class Miner2Job extends MinerJob {
    static get BODY() {
        return [WORK, WORK, WORK, CARRY];
    }

    static get COST() {
        return calculateCost(this.BODY);
    }

    static get JOB_NAME() {
        return 'miner2';
    }

    static getTierBody(_tier) {
        return this.BODY;
    }

    /** Tier-2 miners are responsible for placing the mining container. */
    shouldPlaceContainer() {
        return true;
    }

    deposit(creep) {
        const tier1_miner = this.gameState.getMyCreeps().find(c => this.gameState.getCreepJobName(c.id) === 'miner1');
        if (!tier1_miner) {
            console.error(`Miner2 ${this.id} cannot find tier-1 miner to deposit to`);
            return;
        }
        const transferResult = creep.transfer(tier1_miner, RESOURCE_ENERGY);
        if (transferResult === ERR_NOT_IN_RANGE) {
            console.log(`Miner ${this.id} not in range of tier-1 miner.`);
        }
    }
}
