import { getObjectById } from 'game/utils';
import { MOVE, CARRY, RESOURCE_ENERGY, ERR_NOT_IN_RANGE } from 'game/constants';
import { TugJob } from './tug.mjs';
import { BodyPartCalculator } from '../constants.mjs';

// Mule job - transports resources from a paired miner to the spawn
export class MuleJob extends TugJob {
    static get BODY() {
        return [MOVE, CARRY];
    }

    static get COST() {
        return BodyPartCalculator.calculateCost(this.BODY);
    }

    static get JOB_NAME() {
        return 'mule';
    }

    act() {
        const creep = getObjectById(this.id);
        if (!creep) {
            return;
        }

        // Initialize state if not set
        if (!this.memory.state) {
            this.memory.state = 'collecting';
        }

        // If the paired miner has died or left, clear the pair so we can re-pair.
        // This ensures mules and miners can be built in any order and always form pairs.
        if (this.memory.pairedMinerId) {
            const pairedStillAlive = this.controller.creeps.some(c => c.id === this.memory.pairedMinerId);
            if (!pairedStillAlive) {
                this.memory.pairedMinerId = null;
            }
        }

        // Pair this mule with its corresponding miner by matching indices.
        // Find the first miner not already claimed by another mule, so pairing
        // remains correct even if a mule dies and is replaced.
        if (!this.memory.pairedMinerId) {
            const miners = this.controller.creeps.filter(c => c.jobName === 'miner');
            const claimedMinerIds = this.controller.creeps
                .filter(c => c.jobName === 'mule' && c.id !== this.id && c.memory.pairedMinerId)
                .map(c => c.memory.pairedMinerId);
            const unpairedMiner = miners.find(m => !claimedMinerIds.includes(m.id));
            if (unpairedMiner) {
                this.memory.pairedMinerId = unpairedMiner.id;
            }
        }

        // If the paired miner is still travelling to its mining position, act as a tug
        // to pull it there before resuming normal collecting behaviour.
        if (this.memory.pairedMinerId) {
            const pairedActiveCreep = this.controller.creeps.find(c => c.id === this.memory.pairedMinerId);
            if (pairedActiveCreep && pairedActiveCreep.memory.state === 'moving_to_position') {
                this._actAsTug(creep);
                return;
            }
        }

        const usedCapacity = creep.store[RESOURCE_ENERGY] || 0;
        const totalCapacity = creep.store.getCapacity(RESOURCE_ENERGY);

        if (this.memory.state === 'collecting') {
            // Switch to depositing when full
            if (usedCapacity >= totalCapacity) {
                this.memory.state = 'depositing';
            } else {
                // If the mining container is built, withdraw from it instead of waiting on the miner
                const containerId = this.gameState.getMiningContainerId();
                if (containerId) {
                    const container = getObjectById(containerId);
                    if (container) {
                        const containerEnergy = container.store[RESOURCE_ENERGY] || 0;
                        if (containerEnergy > 0) {
                            // Try to withdraw first; move only if out of range
                            const withdrawResult = creep.withdraw(container, RESOURCE_ENERGY);
                            if (withdrawResult === ERR_NOT_IN_RANGE) {
                                creep.moveTo(container);
                                withdrawResult = creep.withdraw(container, RESOURCE_ENERGY);
                            }
                            if (withdrawResult !== ERR_NOT_IN_RANGE){
                                this.memory.state = 'depositing';
                            }
                            
                        }
                        // Container is empty this tick – nothing to do
                        return;
                    }
                }

                // Find the paired miner creep
                const pairedActiveCreep = this.memory.pairedMinerId
                    ? this.controller.creeps.find(c => c.id === this.memory.pairedMinerId)
                    : null;
                const miner = pairedActiveCreep ? getObjectById(pairedActiveCreep.id) : null;

                if (!miner) {
                    // Paired miner is gone; deposit any energy we're carrying
                    if (usedCapacity > 0) {
                        this.memory.state = 'depositing';
                    } else {
                        return;
                    }
                } else {
                    const minerEnergy = miner.store[RESOURCE_ENERGY] || 0;

                    if (minerEnergy === 0 && usedCapacity > 0) {
                        // Miner is empty but we still have energy - go deposit
                        this.memory.state = 'depositing';
                    } else {
                        // Move towards the paired miner; the miner will transfer when adjacent
                        creep.moveTo(miner);
                        return;
                    }
                }
            }
        }

        if (this.memory.state === 'depositing') {
            // Switch back to collecting once empty
            if (usedCapacity === 0) {
                this.memory.state = 'collecting';
                return;
            }

            const spawn = this.gameState.getMySpawn();
            if (spawn) {
                // Try to transfer first; move only if out of range
                const transferResult = creep.transfer(spawn, RESOURCE_ENERGY);
                if (transferResult === ERR_NOT_IN_RANGE) {
                    creep.moveTo(spawn);
                    transferResult = creep.transfer(spawn, RESOURCE_ENERGY);
                }
                if (transferResult !== ERR_NOT_IN_RANGE){
                    this.memory.state = 'collecting';
                }
            }
        }
    }

    /**
     * Act as a tug for the paired miner while it travels to its mining position.
     * Moves toward the miner and, once adjacent, joins the tug chain as the leader
     * so the miner can be pulled to its source without needing a dedicated tug creep.
     * @param {Creep} creep - The mule creep object
     */
    _actAsTug(creep) {
        const tugChain = this.gameState.getTugChain();

        // If this mule is already leading the chain, nothing more to do here;
        // the miner's act() drives the chain movement each tick.
        if (tugChain.length >= 1 && tugChain[0] === this.id) {
            return;
        }

        // Resolve the paired miner game object.
        const pairedActiveCreep = this.controller.creeps.find(c => c.id === this.memory.pairedMinerId);
        const miner = pairedActiveCreep ? getObjectById(pairedActiveCreep.id) : null;
        if (!miner) {
            return;
        }

        // If the chain contains only the miner, use the shared joining logic to
        // become the chain leader. Otherwise, stay close to the miner so we can
        // take over if the dedicated tug dies.
        if (tugChain.length === 1 && tugChain[0] === this.memory.pairedMinerId) {
            this._joinOrLeadChain(creep);
        } else {
            creep.moveTo(miner);
        }
    }
}
