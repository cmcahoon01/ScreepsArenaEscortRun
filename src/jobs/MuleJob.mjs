import { getObjectById } from 'game/utils';
import { MOVE, CARRY, RESOURCE_ENERGY, ERR_NOT_IN_RANGE } from 'game/constants';
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

        if (this.memory.pairedMinerId) {
            const pairedStillAlive = this.controller.creeps.some(c => c.id === this.memory.pairedMinerId);
            if (!pairedStillAlive) {
                this.memory.pairedMinerId = null;
            }
        }

        if (!this.memory.pairedMinerId) {
            const miners = this.controller.creeps.filter(c => MINER_JOB_NAMES.has(c.jobName));
            const claimedMinerIds = this.controller.creeps
                .filter(c => c.jobName === 'mule' && c.id !== this.id && c.memory.pairedMinerId)
                .map(c => c.memory.pairedMinerId);
            const unpairedMiner = miners.find(m => !claimedMinerIds.includes(m.id));
            if (unpairedMiner) {
                this.memory.pairedMinerId = unpairedMiner.id;
            }
        }

        if (this.memory.pairedMinerId) {
            const pairedActiveCreep = this.controller.creeps.find(c => c.id === this.memory.pairedMinerId);
            if (pairedActiveCreep && isMovingToPosition(pairedActiveCreep.memory)) {
                this._actAsTug(creep);
                return;
            }
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
        const spawn = this.gameState.getMySpawn();
        if (spawn) {
            const transferResult = creep.transfer(spawn, RESOURCE_ENERGY);
            if (transferResult === ERR_NOT_IN_RANGE) {
                creep.moveTo(spawn);
            } else if (transferResult === 0) {
                this.memory.state = 'collecting';
                return this.collect(creep);
            }
        }
    }

    collect(creep) {
        const containerId = this.gameState.getMiningContainerId();
        if (containerId) {
            const container = getObjectById(containerId);
            if (container) {
                const containerEnergy = container.store[RESOURCE_ENERGY] || 0;
                if (containerEnergy > 0) {
                    let withdrawResult = creep.withdraw(container, RESOURCE_ENERGY);
                    if (withdrawResult === ERR_NOT_IN_RANGE) {
                        creep.moveTo(container);
                        withdrawResult = creep.withdraw(container, RESOURCE_ENERGY);
                    }
                    if (withdrawResult === 0) {
                        this.memory.state = 'depositing';
                        return this.deposit(creep);
                    }
                }
                return;
            }
        }

        const pairedActiveCreep = this.memory.pairedMinerId
            ? this.controller.creeps.find(c => c.id === this.memory.pairedMinerId)
            : null;
        const miner = pairedActiveCreep ? getObjectById(pairedActiveCreep.id) : null;

        const usedCapacity = creep.store[RESOURCE_ENERGY] || 0;
        if (!miner) {
            if (usedCapacity > 0) {
                this.memory.state = 'depositing';
                return this.deposit(creep);
            }
        } else {
            const minerEnergy = miner.store[RESOURCE_ENERGY] || 0;
            if (minerEnergy === 0 && usedCapacity > 0) {
                this.memory.state = 'depositing';
                return this.deposit(creep);
            } else {
                creep.moveTo(miner);
            }
        }
    }

    _actAsTug(creep) {
        const tugChain = this.gameState.getTugChain();

        if (tugChain.isLeader(this.id)) {
            return;
        }

        const pairedActiveCreep = this.controller.creeps.find(c => c.id === this.memory.pairedMinerId);
        const miner = pairedActiveCreep ? getObjectById(pairedActiveCreep.id) : null;
        if (!miner) return;

        if (tugChain.hasSingleMember(this.memory.pairedMinerId)) {
            joinTugChain(this.id, creep, this.gameState);
        } else {
            creep.moveTo(miner);
        }
    }
}
