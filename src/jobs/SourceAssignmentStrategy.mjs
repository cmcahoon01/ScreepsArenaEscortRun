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
     * Assign a source to a miner based on proximity to our spawn.
     * Miner 0 gets the closest source to our spawn, miner 1 gets the second closest, etc.
     * @param {number} minerIndex - Index of the miner (0-based)
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
            // Fallback: assign by index without distance sorting
            return minerIndex < sources.length ? sources[minerIndex] : null;
        }

        // Sort sources by Manhattan distance from our spawn so each miner
        // targets the source nearest to their own spawn first.
        const sourcesByDistance = sources.slice().sort((a, b) => {
            const distA = Math.abs(a.x - mySpawn.x) + Math.abs(a.y - mySpawn.y);
            const distB = Math.abs(b.x - mySpawn.x) + Math.abs(b.y - mySpawn.y);
            return distA - distB;
        });

        if (minerIndex < sourcesByDistance.length) {
            return sourcesByDistance[minerIndex];
        }

        return null;
    }

    /**
     * Find the mining position on the diagonal between the source and our spawn.
     * Standing on the diagonal gives the miner more room compared to a cardinal position.
     * @param {Object} source - The source to find mining position for
     * @param {GameState} gameState - The game state service for cached game objects
     * @returns {Object|null} Mining position or null if not found
     */
    static findMiningPosition(source, gameState) {
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

        // Try preferred directions first
        for (const dir of preferredDirections) {
            const pos = { x: source.x + dir.dx, y: source.y + dir.dy };
            if (TerrainAnalyzer.isValidPosition(pos)) {
                return pos;
            }
        }

        // Fallback to any valid adjacent position
        for (const dir of allDirections) {
            const pos = { x: source.x + dir.dx, y: source.y + dir.dy };
            if (TerrainAnalyzer.isValidPosition(pos)) {
                return pos;
            }
        }

        return null;
    }
}
