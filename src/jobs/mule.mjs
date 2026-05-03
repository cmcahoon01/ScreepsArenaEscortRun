import { getObjectById } from 'game/utils';
import { MOVE, CARRY, RESOURCE_ENERGY } from 'game/constants';
import { ActiveCreep } from './ActiveCreep.mjs';
import { BodyPartCalculator } from '../constants.mjs';

// Mule job - transports resources from a paired miner to the spawn
export class MuleJob extends ActiveCreep {
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

        const usedCapacity = creep.store[RESOURCE_ENERGY] || 0;
        const totalCapacity = creep.store.getCapacity(RESOURCE_ENERGY);

        if (this.memory.state === 'collecting') {
            // Switch to depositing when full
            if (usedCapacity >= totalCapacity) {
                this.memory.state = 'depositing';
            } else {
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
                // Move and transfer in the same turn
                creep.moveTo(spawn);
                creep.transfer(spawn, RESOURCE_ENERGY);
            }
        }
    }
}
