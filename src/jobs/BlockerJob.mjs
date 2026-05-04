import { getObjectById } from 'game/utils';
import { MOVE } from 'game/constants';
import { ActiveCreep } from '../services/jobs/ActiveCreep.mjs';
import { BodyPartCalculator } from '../services/BodyPartService.mjs';
import { MinerStateMachine } from '../services/mining/MinerStateMachine.mjs';

// Blocker job - rushes to the enemy flag and stands on it to prevent the enemy from winning
export class BlockerJob extends ActiveCreep {
    static get BODY() {
        return [MOVE];
    }

    static get COST() {
        return BodyPartCalculator.calculateCost(this.BODY);
    }

    static get JOB_NAME() {
        return 'blocker';
    }

    act() {
        const creep = getObjectById(this.id);
        if (!creep) {
            return;
        }

        // Before permanently switching to blocking, act as a tug if a miner still needs help
        if (!this.memory.minerTugged) {
            const movingMiner = this.controller.creeps.find(c =>
                c.jobName === 'miner' && MinerStateMachine.isMovingToPosition(c.memory)
            );

            if (movingMiner) {
                // A miner still needs to reach its mining position — act as a tug
                this._actAsTug(creep, movingMiner);
                return;
            }

            // No miner needs a tug; permanently commit to blocking
            this.memory.minerTugged = true;
        }

        const enemyFlag = this.gameState.getEnemyFlag();
        if (!enemyFlag) {
            return;
        }

        // Move to the enemy flag and stand on it
        creep.moveTo(enemyFlag);
    }

    /**
     * Act as a tug to help pull the miner to its mining position.
     * Mirrors the TugJob chain-joining logic.
     * @param {Creep} creep - The blocker creep object
     * @param {ActiveCreep} movingMiner - The miner that still needs to reach its position
     */
    _actAsTug(creep, movingMiner) {
        const tugChain = this.gameState.getTugChain();

        if (tugChain.length === 0) {
            // Tug chain not yet claimed by the miner — move towards it to be ready
            const minerCreep = getObjectById(movingMiner.id);
            if (minerCreep) {
                creep.moveTo(minerCreep);
            }
            return;
        }

        const isInChain = tugChain.includes(this.id);

        if (!isInChain) {
            // Move towards the last creep in the chain; join when adjacent
            const lastCreepId = tugChain[tugChain.length - 1];
            const lastCreep = getObjectById(lastCreepId);

            if (!lastCreep) {
                return;
            }

            const distance = Math.max(
                Math.abs(creep.x - lastCreep.x),
                Math.abs(creep.y - lastCreep.y)
            );

            if (distance <= 1) {
                // Adjacent — join the tug chain. When the chain holds only the miner,
                // insert this blocker at the front (index 0) as the lead puller,
                // matching the pattern used by TugJob.
                if (tugChain.length === 1) {
                    this.gameState.setTugChain([this.id, tugChain[0]]);
                } else {
                    this.gameState.addToTugChain(this.id);
                }
            } else {
                creep.moveTo(lastCreep);
            }
        }
        // Already in the chain — TugChainService coordinates movement each tick
    }
}
