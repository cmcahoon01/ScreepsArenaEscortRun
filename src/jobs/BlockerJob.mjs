import { getObjectById } from 'game/utils';
import { MOVE, HEAL } from 'game/constants';
import { ActiveCreep } from './base/ActiveCreep.mjs';
import { calculateCost } from '../services/BodyPartService.mjs';
import { isMovingToPosition } from '../services/mining/MinerStateMachine.mjs';
import { joinTugChain } from '../services/TugChainService.mjs';
import { MINER_JOB_NAMES } from '../constants.mjs';

export class BlockerJob extends ActiveCreep {
    static get BODY() {
        return [MOVE, MOVE, MOVE, MOVE, HEAL, HEAL];
    }

    static get COST() {
        return calculateCost(this.BODY);
    }

    static get JOB_NAME() {
        return 'blocker';
    }

    act() {
        const creep = getObjectById(this.id);
        if (!creep) return;

        if (this.constructor.BODY.includes(HEAL) && creep.hits < creep.hitsMax){
            creep.heal(creep);
        }

        if (!this.memory.minerTugged) {
            const movingMiner = this.controller.creeps.find(c =>
                MINER_JOB_NAMES.has(c.jobName) && isMovingToPosition(c.memory)
            );

            if (movingMiner) {
                this._actAsTug(creep, movingMiner);
                return;
            }

            this.memory.minerTugged = true;
        }

        const enemyFlag = this.gameState.getEnemyFlag();
        if (!enemyFlag) return;

        creep.moveTo(enemyFlag);
    }

    _actAsTug(creep, movingMiner) {
        const tugChain = this.gameState.getTugChain();

        if (tugChain.length === 0) {
            const minerCreep = getObjectById(movingMiner.id);
            if (minerCreep) creep.moveTo(minerCreep);
            return;
        }

        joinTugChain(this.id, creep, this.gameState);
    }
}
