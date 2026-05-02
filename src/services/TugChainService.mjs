import { getObjectById } from 'game/utils';

/**
 * TugChainService - Utility for coordinating movement of tug chains.
 * 
 * A tug chain consists of a creep that needs help (at index 0) followed by 
 * tug creeps. The service coordinates their movement using pull() mechanics.
 */
export class TugChainService {
    /**
     * Move a tug chain towards a target position.
     * 
     * @param {string[]} tugChain - Array of creep IDs, with helped creep at index 0
     * @param {Object} target - Target position or object to move towards
     * @param {GameState} gameState - The current game state
     * @returns {boolean} True if chain movement was executed, false if chain is invalid
     */
    static moveChain(tugChain, target, gameState) {
        if (!tugChain || tugChain.length === 0) {
            return false;
        }

        // Get all creeps in the chain
        const creeps = tugChain.map(id => getObjectById(id));
        
        // Validate all creeps exist
        if (creeps.some(creep => !creep || !creep.exists)) {
            return false;
        }

        let reachedTarget = false;

        // Execute the chain movement
        for (let idx = 0; idx < creeps.length; idx++) {
            if (idx === 0) {
                if (creeps[idx].x === target.x && creeps[idx].y === target.y) {
                    // Already at target, move up one to get the miner into position
                    reachedTarget = true;
                    const upOnePos = { x: target.x, y: target.y - 1 };
                    creeps[idx].moveTo(upOnePos);
                }else {
                    creeps[idx].moveTo(target);
                }
            } else {
                // Subsequent creeps pull and follow
                creeps[idx - 1].pull(creeps[idx]);
                creeps[idx].moveTo(creeps[idx - 1]);
            }
        }

        if (reachedTarget) {
            gameState.clearTugChain();
        }

        return true;
    }
}
