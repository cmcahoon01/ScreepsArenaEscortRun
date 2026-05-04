import { getObjectById } from 'game/utils';
import { TerrainAnalyzer } from '../combat/TerrainAnalyzer.mjs';

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
                    // Tug is on the dragged unit's target tile — step aside to make room.
                    // Prefer a tile adjacent to the dragged unit that is not the target.
                    reachedTarget = true;
                    let evadePos;
                    if (creeps.length > 1) {
                        const dragged = creeps[1];
                        const tug = creeps[idx];
                        // Build a set of occupied positions, excluding the tug itself
                        // (it is vacating its current tile, so it shouldn't block candidates)
                        const occupied = new Set(
                            gameState.getAllCreeps()
                                .filter(c => c !== tug)
                                .map(c => `${c.x},${c.y}`)
                        );
                        const candidates = [];
                        for (let dx = -1; dx <= 1; dx++) {
                            for (let dy = -1; dy <= 1; dy++) {
                                if (dx === 0 && dy === 0) continue;
                                const pos = { x: dragged.x + dx, y: dragged.y + dy };
                                if (pos.x === target.x && pos.y === target.y) continue;
                                if (!TerrainAnalyzer.isValidPosition(pos)) continue;
                                if (TerrainAnalyzer.isWall(pos)) continue;
                                // Skip positions already occupied by another creep
                                if (occupied.has(`${pos.x},${pos.y}`)) continue;
                                candidates.push(pos);
                            }
                        }
                        // Prefer the candidate closest to the tug's current position
                        const tugX = tug.x;
                        const tugY = tug.y;
                        evadePos = candidates.length > 0
                            ? candidates.reduce((best, pos) =>
                                Math.max(Math.abs(pos.x - tugX), Math.abs(pos.y - tugY)) <
                                Math.max(Math.abs(best.x - tugX), Math.abs(best.y - tugY))
                                    ? pos : best
                            )
                            : { x: target.x, y: target.y - 1 };
                    } else {
                        evadePos = { x: target.x, y: target.y - 1 };
                    }
                    creeps[idx].moveTo(evadePos);
                } else {
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
