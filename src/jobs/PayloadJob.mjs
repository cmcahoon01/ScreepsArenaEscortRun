import { getObjectById, getTicks } from 'game/utils';
import { ActiveCreep } from './base/ActiveCreep.mjs';
import { compareTeamStrengths } from '../services/combat/StrengthEstimatorService.mjs';
import { PayloadConfig } from '../constants.mjs';
import { chebyshevDistance } from '../services/RangeUtils.mjs';

export class PayloadJob extends ActiveCreep {
    static get BODY() {
        return [];
    }

    static get COST() {
        return 0;
    }

    static get JOB_NAME() {
        return 'payload';
    }

    constructor(id, jobName, tier, controller, gameState, flag) {
        super(id, jobName, tier, controller, gameState);
        this.flag = flag;
        this.memory.state = PayloadConfig.STATE_WAITING;
        this.gameState.setPayloadId(this.id);
    }

    hasMilitaryAdvantage() {
        const comparison = compareTeamStrengths(this.gameState);
        return comparison.ratio >= PayloadConfig.MILITARY_ADVANTAGE_THRESHOLD &&
            comparison.myTeam.strength > comparison.enemyTeam.strength + 300;
    }

    shouldTransitionToMoving() {
        return this.hasMilitaryAdvantage() || getTicks() >= PayloadConfig.GAME_TIME_THRESHOLD;
    }

    findWaitingRampart(creep) {
        const spawn = this.gameState.getMySpawn();
        if (!spawn) return null;

        const nearRamparts = this.gameState.getMyRamparts().filter(r =>
            chebyshevDistance(r, spawn) === PayloadConfig.WAITING_RAMPART_DISTANCE
        );

        if (nearRamparts.length === 0) return null;
        return creep.findClosestByRange(nearRamparts);
    }

    act() {
        const creep = getObjectById(this.id);
        if (!creep) return;

        this.gameState.setPayloadMoving(this.memory.state === PayloadConfig.STATE_MOVING);

        if (this.memory.state === PayloadConfig.STATE_WAITING) {
            if (this.shouldTransitionToMoving()) {
                this.memory.state = PayloadConfig.STATE_MOVING;
                this.gameState.setTugChain([this.id]);
                console.log("Payload beginning pilgrimage");
            } else {
                const targetRampart = this.findWaitingRampart(creep);
                if (targetRampart) creep.moveTo(targetRampart);
                return;
            }
        }

        if (this.memory.state === PayloadConfig.STATE_MOVING) {
            const tugChain = this.gameState.getTugChain();
            if (tugChain.length === 0) {
                this.gameState.setTugChain([this.id]);
            }

            if (this.flag) {
                this.gameState.getTugChain().tick(this.flag, this.gameState);
            }
        }
    }
}
