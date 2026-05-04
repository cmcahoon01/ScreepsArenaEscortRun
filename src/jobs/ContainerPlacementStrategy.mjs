import { getTerrainAt } from 'game/utils';
import { TERRAIN_WALL } from 'game/constants';
import { TerrainAnalyzer } from '../combat/TerrainAnalyzer.mjs';

/**
 * Handles finding the correct tile for a mining container.
 * The container is placed on a tile that is orthogonally (cardinally) adjacent
 * to the tier 2 miner and also within Chebyshev distance 1 of the tier 1 miner,
 * so both miners can reach it without moving.
 *
 * If the tier 1 miner's position is unknown (null), the fallback behaviour picks
 * any valid orthogonal tile adjacent to the tier 2 miner that is not a wall and
 * not the source tile itself.
 */
export class ContainerPlacementStrategy {
    /**
     * Find the tile for the mining container.
     * The tile must be:
     *   1. Orthogonally (cardinally) adjacent to the tier 2 miner.
     *   2. Within Chebyshev distance 1 of the tier 1 miner's position (so it is
     *      adjacent to the tier 1 miner as well).
     *   3. Not a wall, not out of bounds, and not occupied by the source.
     *
     * @param {Object} tier2Creep - The tier 2 miner creep game object
     * @param {Object|null} tier1Pos - The tier 1 miner's target position {x, y}, or null if unknown
     * @param {Object} source - The energy source to avoid placing on
     * @returns {Object|null} Position {x, y} for the container, or null if none found
     */
    static findContainerPosition(tier2Creep, tier1Pos, source) {
        const cardinalOffsets = [
            { dx: 0, dy: -1 }, // TOP
            { dx: 1, dy: 0 },  // RIGHT
            { dx: 0, dy: 1 },  // BOTTOM
            { dx: -1, dy: 0 }, // LEFT
        ];

        // First pass: prefer a tile that is also adjacent to the tier 1 miner
        if (tier1Pos) {
            for (const offset of cardinalOffsets) {
                const pos = { x: tier2Creep.x + offset.dx, y: tier2Creep.y + offset.dy };
                if (!TerrainAnalyzer.isValidPosition(pos)) continue;
                if (getTerrainAt(pos) === TERRAIN_WALL) continue;
                if (source && pos.x === source.x && pos.y === source.y) continue;

                // Check Chebyshev distance to tier 1 miner
                const chebyshev = Math.max(
                    Math.abs(pos.x - tier1Pos.x),
                    Math.abs(pos.y - tier1Pos.y)
                );
                if (chebyshev <= 1) {
                    return pos;
                }
            }
        }

        // Fallback: any valid orthogonal tile that is not the source
        for (const offset of cardinalOffsets) {
            const pos = { x: tier2Creep.x + offset.dx, y: tier2Creep.y + offset.dy };
            if (!TerrainAnalyzer.isValidPosition(pos)) continue;
            if (getTerrainAt(pos) === TERRAIN_WALL) continue;
            if (source && pos.x === source.x && pos.y === source.y) continue;
            return pos;
        }

        return null;
    }
}
