import { TerrainAnalyzer } from '../combat/TerrainAnalyzer.mjs';
import { MapTopology } from '../constants.mjs';

/**
 * Handles source selection logic for miners.
 * Assigns sources based on team position and miner index.
 */
export class SourceAssignmentStrategy {
    /**
     * Find all sources sorted by position (top to bottom).
     * @param {GameState} gameState - The game state service for cached game objects
     * @returns {Array} Sorted array of sources
     */
    static findSortedSources(gameState) {
        const sources = gameState.getSources();
        // Sort by y coordinate (top to bottom)
        return sources.sort((a, b) => a.y - b.y);
    }

    /**
     * Determine which team side we're on based on spawn position.
     * @param {GameState} gameState - The game state service for cached game objects
     * @returns {string} 'left' or 'right'
     */
    static getTeamSide(gameState) {
        const spawn = gameState.getMySpawn();
        if (!spawn) return 'left';
        
        // Assuming the map is 100x100, if spawn.x < 50, we're on the left
        return spawn.x < 50 ? 'left' : 'right';
    }

    /**
     * Assign the closest source (nearest to our spawn) to all miners.
     * All miners go to the same source; each will claim a different adjacent cell
     * via the excludePositions mechanism in findMiningPosition.
     * @param {number} minerIndex - Index of the miner (0-based, unused for source selection)
     * @param {GameState} gameState - The game state service for cached game objects
     * @returns {Object|null} Assigned source or null if not available
     */
    static assignSourceToMiner(minerIndex, gameState) {
        const sources = this.findSortedSources(gameState);
        const mySpawn = gameState.getMySpawn();

        if (sources.length === 0) {
            return null;
        }

        if (!mySpawn) {
            // Fallback: all miners share the first source
            return sources[0];
        }

        // All miners target the single source closest to our spawn.
        const sourcesByDistance = sources.slice().sort((a, b) => {
            const distA = Math.abs(a.x - mySpawn.x) + Math.abs(a.y - mySpawn.y);
            const distB = Math.abs(b.x - mySpawn.x) + Math.abs(b.y - mySpawn.y);
            return distA - distB;
        });

        return sourcesByDistance[0];
    }

    /**
     * Find the mining position on the diagonal between the source and our spawn.
     * Standing on the diagonal gives the miner more room compared to a cardinal position.
     * Positions listed in excludePositions are skipped so multiple miners targeting the
     * same source claim different adjacent cells.
     * @param {Object} source - The source to find mining position for
     * @param {GameState} gameState - The game state service for cached game objects
     * @param {Array<{x: number, y: number}>} [excludePositions=[]] - Positions already claimed by other miners
     * @returns {Object|null} Mining position or null if not found
     */
    static findMiningPosition(source, gameState, excludePositions = []) {
        const mySpawn = gameState.getMySpawn();

        const allDirections = [
            { dx: 0, dy: -1 }, // TOP
            { dx: 1, dy: 0 },  // RIGHT
            { dx: 0, dy: 1 },  // BOTTOM
            { dx: -1, dy: 0 }, // LEFT
            { dx: 1, dy: 1 },  // BOTTOM_RIGHT
            { dx: 1, dy: -1 }, // TOP_RIGHT
            { dx: -1, dy: 1 }, // BOTTOM_LEFT
            { dx: -1, dy: -1 } // TOP_LEFT
        ];

        // Helper: returns true when pos is already claimed by another miner
        const isExcluded = (pos) => excludePositions.some(ep => ep.x === pos.x && ep.y === pos.y);

        // Preferred directions: diagonal from source toward spawn so the miner
        // stands between the source and the spawn with extra room on either side.
        let preferredDirections = [];
        if (mySpawn) {
            const dx = Math.sign(mySpawn.x - source.x);
            const dy = Math.sign(mySpawn.y - source.y);

            if (dx !== 0 && dy !== 0) {
                // True diagonal – use it first, then fall back to the two cardinal components
                preferredDirections.push({ dx, dy });
                preferredDirections.push({ dx, dy: 0 });
                preferredDirections.push({ dx: 0, dy });
            } else if (dx !== 0) {
                preferredDirections.push({ dx, dy: 0 });
            } else if (dy !== 0) {
                preferredDirections.push({ dx: 0, dy });
            }
        } else {
            // No spawn available – fall back to position based on source y
            if (source.y < MapTopology.ARENA_CENTER) {
                preferredDirections = [{ dx: 1, dy: 1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }];
            } else {
                preferredDirections = [{ dx: 1, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: -1 }];
            }
        }

        // Try preferred directions first, skipping excluded positions
        for (const dir of preferredDirections) {
            const pos = { x: source.x + dir.dx, y: source.y + dir.dy };
            if (TerrainAnalyzer.isValidPosition(pos) && !isExcluded(pos)) {
                return pos;
            }
        }

        // Fallback to any valid, non-excluded adjacent position
        for (const dir of allDirections) {
            const pos = { x: source.x + dir.dx, y: source.y + dir.dy };
            if (TerrainAnalyzer.isValidPosition(pos) && !isExcluded(pos)) {
                return pos;
            }
        }

        return null;
    }
}
