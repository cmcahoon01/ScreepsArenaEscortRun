import { getObjectById } from 'game/utils';
import { MOVE, CARRY, RESOURCE_ENERGY, ERR_NOT_IN_RANGE, OK } from 'game/constants';
import { TugJob } from './TugJob.mjs';
import { calculateCost } from '../services/BodyPartService.mjs';
import { MINER_JOB_NAMES } from '../constants.mjs';
import { isMovingToPosition } from '../services/mining/MinerStateMachine.mjs';
import { joinTugChain } from '../services/TugChainService.mjs';

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
            const claimedSlots = this.controller.creeps
                .filter(c => c.jobName === 'mule' && c.id !== this.id && (c.memory.muleSlot === 1 || c.memory.muleSlot === 2))
                .map(c => c.memory.muleSlot);
            this.memory.muleSlot = claimedSlots.includes(1) ? 2 : 1;
        }

        const otherMovingMiner = this.controller.creeps.find(c => MINER_JOB_NAMES.has(c.jobName) && isMovingToPosition(c.memory));
        if (otherMovingMiner) {
            this._actAsTug(creep, otherMovingMiner.id);
            return;
        }

        const usedCapacity = creep.store[RESOURCE_ENERGY] || 0;
        const totalCapacity = creep.store.getCapacity(RESOURCE_ENERGY);

        if (usedCapacity >= totalCapacity) {
            this.memory.state = 'depositing';
        } else if (usedCapacity === 0) {
            this.memory.state = 'collecting';
        }

        if (this.memory.state === 'collecting') {
            this.collect(creep);
        } else if (this.memory.state === 'depositing') {
            this.deposit(creep);
        }
    }

    deposit(creep) {
        if (this.memory.muleSlot === 1) {
            const otherMule = this.controller.creeps
                .find(c => c.jobName === 'mule' && c.id !== this.id && c.memory.muleSlot === 2);
            const otherMuleObj = otherMule ? getObjectById(otherMule.id) : null;
            if (otherMuleObj) {
                const transferResult = creep.transfer(otherMuleObj, RESOURCE_ENERGY);
                if (transferResult === ERR_NOT_IN_RANGE) {
                    creep.moveTo(otherMuleObj);
                    return;
                }
                if (transferResult === OK && (creep.store[RESOURCE_ENERGY] || 0) === 0) {
                    this.memory.state = 'collecting';
                    return this.collect(creep);
                }
                return;
            }
        }

        const spawn = this.gameState.getMySpawn();
        if (spawn) {
            const transferResult = creep.transfer(spawn, RESOURCE_ENERGY);
            if (transferResult === ERR_NOT_IN_RANGE) {
                creep.moveTo(spawn);
            } else if (transferResult === OK && creep.store[RESOURCE_ENERGY] === 0) {
                this.memory.state = 'collecting';
                return this.collect(creep);
            }
        }
    }

    collect(creep) {
        const containerId = this.gameState.getMiningContainerId();
        const container = containerId ? getObjectById(containerId) : null;

        if (this.memory.muleSlot === 2) {
            if ((creep.store[RESOURCE_ENERGY] || 0) > 0) {
                this.memory.state = 'depositing';
                return this.deposit(creep);
            }

            if (container) {
                creep.moveTo(container);
            }
        }

        if (container) {
            const containerEnergy = container.store[RESOURCE_ENERGY] || 0;
            if (containerEnergy > 0) {
                const withdrawResult = creep.withdraw(container, RESOURCE_ENERGY);
                if (withdrawResult === ERR_NOT_IN_RANGE) {
                    creep.moveTo(container);
                } else if (withdrawResult === OK) {
                    this.memory.state = 'depositing';
                    return this.deposit(creep);
                }
            }
            return;
        }
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
