import { getObjectById } from 'game/utils';
import { MOVE, CARRY, RESOURCE_ENERGY } from 'game/constants';
import { ActiveCreep } from './ActiveCreep.mjs';
import { BodyPartCalculator } from '../constants.mjs';

// Mule job - transports resources from a miner to the spawn
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

        const usedCapacity = creep.store[RESOURCE_ENERGY] || 0;
        const totalCapacity = creep.store.getCapacity(RESOURCE_ENERGY);

        if (this.memory.state === 'collecting') {
            // Switch to depositing when full
            if (usedCapacity >= totalCapacity) {
                this.memory.state = 'depositing';
            } else {
                // Find the closest miner creep
                const minerActiveCreeps = this.controller.creeps.filter(c => c.jobName === 'miner');
                const minerCreeps = minerActiveCreeps
                    .map(c => getObjectById(c.id))
                    .filter(m => m !== null);
                const miner = minerCreeps.length > 0 ? creep.findClosestByRange(minerCreeps) : null;

                if (!miner) {
                    // No miner available; if we have resources go deposit them
                    if (usedCapacity > 0) {
                        this.memory.state = 'depositing';
                    } else {
                        return;
                    }
                } else {
                    const minerEnergy = miner.store ? (miner.store[RESOURCE_ENERGY] || 0) : 0;

                    if (minerEnergy === 0 && usedCapacity > 0) {
                        // Miner is empty but we still have energy - go deposit
                        this.memory.state = 'depositing';
                    } else {
                        // Move towards the miner; the miner will transfer when we are adjacent
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
