import { getObjectById } from 'game/utils';
import { MOVE, CARRY, RESOURCE_ENERGY, ERR_NOT_IN_RANGE, OK } from 'game/constants';
import { TugJob } from './TugJob.mjs';
import { calculateCost } from '../services/BodyPartService.mjs';
import { MINER_JOB_NAMES } from '../constants.mjs';
import { isMovingToPosition } from '../services/mining/MinerStateMachine.mjs';
import { joinTugChain } from '../services/TugChainService.mjs';
import {chebyshevDistance} from "../services/RangeUtils.mjs";

export class MuleJob extends TugJob {
    static get BODY() {
        return [MOVE, CARRY];
    }

    static get COST() {
        return calculateCost(this.BODY);
    }

    static get JOB_NAME() {
        return 'mule';
    }

    act() {
        const creep = getObjectById(this.id);
        if (!creep) return;

        if (!this.memory.state) {
            this.memory.state = 'collecting';
        }

        if (!this.memory.muleSlot) {
            const mules = this.controller.creeps.filter(c => c.jobName === 'mule');
            const claimedSlots = this.controller.creeps.filter(c => c.id !== this.id &&
                (c.memory.muleSlot === 1 || c.memory.muleSlot === 2))
                .map(c => c.memory.muleSlot);
            this.memory.muleSlot = claimedSlots.includes(1) ? 2 : 1;
        }

        const otherMovingMiner = this.controller.creeps.find(c => MINER_JOB_NAMES.has(c.jobName) && isMovingToPosition(c.memory));
        if (otherMovingMiner) {
            this._actAsTug(creep, otherMovingMiner.id);
            return;
        }

        const usedCapacity = creep.store[RESOURCE_ENERGY] || 0;

        if (usedCapacity > 0) {
            this.memory.state = 'depositing';
        } else if (usedCapacity === 0) {
            this.memory.state = 'collecting';
        }

        this.memory.moved = false;
        this.memory.collected = false;

        if (this.memory.state === 'collecting') {
            this.collect(creep);
        } else if (this.memory.state === 'depositing') {
            this.deposit(creep);
        }

        if (!this.memory.moved) {
            console.log("!!! Mule " + creep.id + " did not move during act() !!!");
        }
    }

    deposit(creep) {
        const depositTarget = this._getDepositTarget(creep);
        if (!this.memory.moved && chebyshevDistance(creep, depositTarget) > 1) {
            creep.moveTo(depositTarget);
            this.memory.moved = true;
        }

        const depositResult = creep.transfer(depositTarget, RESOURCE_ENERGY);
        if (depositResult === OK) {
            this.memory.state = 'collecting';
            return this.collect(creep);
        }
    }

    collect(creep) {
        const { collectTarget, needToWithdraw } = this._getCollectionTarget(creep);
        if (!this.memory.moved && chebyshevDistance(creep, collectTarget) > 1) {
            creep.moveTo(collectTarget);
            this.memory.moved = true;
        }
        if (this.memory.collected) {
            return;
        }
        if(chebyshevDistance(creep, collectTarget) <= 1) {
            if (needToWithdraw) {
                const withdrawResult = creep.withdraw(collectTarget, RESOURCE_ENERGY);
                if (withdrawResult === OK) {
                    this.memory.state = 'depositing';
                    this.memory.collected = true;
                    return this.deposit(creep);
                }
            } else {
                const transferResult = collectTarget.transfer(creep, RESOURCE_ENERGY);
                if (transferResult === OK) {
                    this.memory.state = 'depositing';
                    this.memory.collected = true;
                    return this.deposit(creep);
                }
            }
        }
    }

    _getDepositTarget(creep) {
        let collectTarget;
        if (this.memory.muleSlot === 1) {
            const otherMule = this.controller.creeps
                .find(c => c.jobName === 'mule' && c.id !== this.id );
            const otherMuleObj = otherMule ? getObjectById(otherMule.id) : null;
            return otherMuleObj ? otherMuleObj : this.gameState.getMySpawn();
        } else {
            return this.gameState.getMySpawn();
        }
    }

    _getCollectionTarget(creep) {
        let collectTarget;
        let needToWithdraw = false;
        if (this.memory.muleSlot === 1) {
            const containerId = this.gameState.getMiningContainerId();
            if (containerId) {
                const container = getObjectById(containerId);
                if (container) {
                    collectTarget = container;
                    needToWithdraw = true;
                }
            }
            if (!collectTarget) {
                collectTarget = getObjectById(this.controller.creeps.find(c => MINER_JOB_NAMES.has(c.jobName)).id);
            }
        } else {
            const otherMule = this.controller.creeps
                .find(c => c.jobName === 'mule' && c.id !== this.id );
            collectTarget = otherMule ? getObjectById(otherMule.id) : null;
        }
        return {collectTarget, needToWithdraw};
    }

    _actAsTug(creep, minerId) {
        const tugChain = this.gameState.getTugChain();

        if (tugChain.isLeader(this.id)) {
            return;
        }

        const targetActiveCreep = this.controller.creeps.find(c => c.id === minerId);
        const miner = targetActiveCreep ? getObjectById(targetActiveCreep.id) : null;
        if (!miner) return;

        if (tugChain.hasSingleMember(minerId)) {
            joinTugChain(this.id, creep, this.gameState);
        } else {
            creep.moveTo(miner);
        }
    }
}
