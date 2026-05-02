import { getObjectById } from 'game/utils';
import { MOVE } from 'game/constants';
import { ActiveCreep } from './ActiveCreep.mjs';
import { BodyPartCalculator } from '../constants.mjs';

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

    act() {
        const creep = getObjectById(this.id);
        if (!creep) {
            return;
        }

        const tugChain = this.gameState.getTugChain();
        
        // If tugChain is empty, move to our spawn
        if (tugChain.length === 0) {
            const mySpawn = this.gameState.getMySpawn();
            if (mySpawn) {
                creep.moveTo(mySpawn);
            }
            return;
        }

        // Check if this tug is already in the chain
        const isInChain = tugChain.includes(this.id);
        
        if (!isInChain) {
            // This tug needs to join the chain
            // Move towards the last creep in the chain
            const lastCreepId = tugChain[tugChain.length - 1];
            const lastCreep = getObjectById(lastCreepId);
            
            if (!lastCreep) {
                // Last creep in chain is dead, tugChain will be cleaned up in next refresh
                return;
            }
            
            // Check if we're adjacent to the last creep
            const distance = Math.max(
                Math.abs(creep.x - lastCreep.x),
                Math.abs(creep.y - lastCreep.y)
            );
            
            if (distance <= 1) {
                // We're adjacent, add ourselves to the chain
                if (this.gameState.tugChain.length === 1) {
                    this.gameState.tugChain = [this.id, tugChain[0]];
                }else {
                    this.gameState.addToTugChain(this.id)
                }
            } else {
                // Move towards the last creep in the chain
                creep.moveTo(lastCreep);
            }
        } else {
            // We're already in the chain, just wait
            // The creep being helped will coordinate the movement using pull() commands
            // We don't need to do anything here
        }
    }
}
