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
     * Assign a source to a miner based on miner count.
     * First miner gets top corner source, second gets bottom corner source.
     * @param {number} minerIndex - Index of the miner (0-based)
     * @param {GameState} gameState - The game state service for cached game objects
     * @returns {Object|null} Assigned source or null if not available
     */
    static assignSourceToMiner(minerIndex, gameState) {
        const sources = this.findSortedSources(gameState);
        const teamSide = this.getTeamSide(gameState);
        
        if (sources.length < 2) {
            return null; // Not enough sources
        }
        
        // First miner gets top source (corner source based on team side)
        if (minerIndex === 0) {
            // Filter to corner sources (top)
            const topSources = sources.filter(s => s.y < MapTopology.CORNER_TOP_THRESHOLD);
            if (teamSide === 'left') {
                // Get the leftmost top source
                return topSources.sort((a, b) => a.x - b.x)[0];
            } else {
                // Get the rightmost top source
                return topSources.sort((a, b) => b.x - a.x)[0];
            }
        }
        
        // Second miner gets bottom source
        if (minerIndex === 1) {
            const bottomSources = sources.filter(s => s.y > MapTopology.CORNER_BOTTOM_THRESHOLD);
            if (teamSide === 'left') {
                // Get the leftmost bottom source
                return bottomSources.sort((a, b) => a.x - b.x)[0];
            } else {
                // Get the rightmost bottom source
                return bottomSources.sort((a, b) => b.x - a.x)[0];
            }
        }
        
        return null;
    }

    /**
     * Find the mining position directly adjacent to the source.
     * The source is in a wall, so we look for the one non-wall position directly adjacent.
     * @param {Object} source - The source to find mining position for
     * @param {GameState} gameState - The game state service for cached game objects
     * @returns {Object|null} Mining position or null if not found
     */
    static findMiningPosition(source, gameState) {
        const teamSide = this.getTeamSide(gameState);
        
        // The mining position should be the one facing towards the center/spawn
        // For corner sources, this is typically towards the center of the map
        const directions = [
            { dx: 0, dy: -1 }, // TOP
            { dx: 1, dy: 0 },  // RIGHT
            { dx: 0, dy: 1 },  // BOTTOM
            { dx: -1, dy: 0 }  // LEFT
        ];
        
        // Determine the best direction based on source position
        let preferredDirections = [];
        if (source.y < 50) {
            // Top half
            if (teamSide === 'left') {
                preferredDirections = [{ dx: 1, dy: 0 }, { dx: 0, dy: 1 }]; // RIGHT, BOTTOM
            } else {
                preferredDirections = [{ dx: -1, dy: 0 }, { dx: 0, dy: 1 }]; // LEFT, BOTTOM
            }
        } else {
            // Bottom half
            if (teamSide === 'left') {
                preferredDirections = [{ dx: 1, dy: 0 }, { dx: 0, dy: -1 }]; // RIGHT, TOP
            } else {
                preferredDirections = [{ dx: -1, dy: 0 }, { dx: 0, dy: -1 }]; // LEFT, TOP
            }
        }
        
        // Try preferred directions first
        for (const dir of preferredDirections) {
            const pos = { x: source.x + dir.dx, y: source.y + dir.dy };
            if (TerrainAnalyzer.isValidPosition(pos)) {
                return pos;
            }
        }
        
        // Fallback to any cardinal direction
        for (const dir of directions) {
            const pos = { x: source.x + dir.dx, y: source.y + dir.dy };
            if (TerrainAnalyzer.isValidPosition(pos)) {
                return pos;
            }
        }
        
        return null;
    }
}
