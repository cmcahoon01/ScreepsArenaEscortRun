import { getObjectById } from 'game/utils';
import { MOVE } from 'game/constants';
import { ActiveCreep } from '../services/jobs/ActiveCreep.mjs';
import { BodyPartCalculator } from '../services/BodyPartService.mjs';

// Tug job - helps move creeps that don't have MOVE body parts
export class TugJob extends ActiveCreep {
    static get BODY() {
        return [MOVE];
    }

    static get COST() {
        return BodyPartCalculator.calculateCost(this.BODY);
    }

    static get JOB_NAME() {
        return 'tug';
    }

    /**
     * Find a friendly rampart not adjacent to spawn (Chebyshev distance > 1) for
     * idle tugs to shelter on, keeping the area around spawn clear for new spawns.
     * @param {Creep} creep
     * @returns {StructureRampart|null}
     */
    findIdleRampart(creep) {
        const spawn = this.gameState.getMySpawn();
        if (!spawn) {
            return null;
        }

        const idleRamparts = this.gameState.getMyRamparts().filter(r => {
            const chebyshevDist = Math.max(Math.abs(r.x - spawn.x), Math.abs(r.y - spawn.y));
            return chebyshevDist > 1;
        });

        if (idleRamparts.length === 0) {
            return null;
        }

        return creep.findClosestByRange(idleRamparts);
    }

    /**
     * Join or lead the tug chain.
     * If not already in the chain, moves toward the last creep and joins when adjacent.
     * Becomes the chain leader when the chain has a single member, otherwise appends.
     * If already in the chain, waits — movement is driven by the subject via pull().
     * @param {Creep} creep - This creep's game object
     */
    _joinOrLeadChain(creep) {
        const tugChain = this.gameState.getTugChain();

        // Already in the chain — wait; the chain subject drives movement via pull()
        if (tugChain.includes(this.id)) {
            return;
        }

        // Move towards the last creep in the chain and join when adjacent
        const lastCreepId = tugChain[tugChain.length - 1];
        const lastCreep = getObjectById(lastCreepId);

        if (!lastCreep) {
            // Last creep in chain is dead; tugChain will be cleaned up in next refresh
            return;
        }

        const distance = Math.max(
            Math.abs(creep.x - lastCreep.x),
            Math.abs(creep.y - lastCreep.y)
        );

        if (distance <= 1) {
            // Adjacent — join the chain
            if (tugChain.length === 1) {
                // Become the chain leader: [this, subject]
                this.gameState.tugChain = [this.id, tugChain[0]];
            } else {
                this.gameState.addToTugChain(this.id);
            }
        } else {
            creep.moveTo(lastCreep);
        }
    }

    act() {
        const creep = getObjectById(this.id);
        if (!creep) {
            return;
        }

        const tugChain = this.gameState.getTugChain();

        // If tugChain is empty, move to a rampart not adjacent to spawn so we
        // don't block newly spawned tugs from clearing the spawn area.
        if (tugChain.length === 0) {
            const idleRampart = this.findIdleRampart(creep);
            if (idleRampart) {
                creep.moveTo(idleRampart);
            } else {
                const mySpawn = this.gameState.getMySpawn();
                if (mySpawn) {
                    creep.moveTo(mySpawn);
                }
            }
            return;
        }

        this._joinOrLeadChain(creep);
    }
}
