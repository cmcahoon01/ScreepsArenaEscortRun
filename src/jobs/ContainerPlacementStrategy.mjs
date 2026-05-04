import { getTerrainAt } from 'game/utils';
import { TERRAIN_WALL } from 'game/constants';
import { TerrainAnalyzer } from '../combat/TerrainAnalyzer.mjs';

/**
 * Handles finding the correct tile for a mining container.
 * The container is always placed on the tile immediately to the right of the
 * tier 1 miner (i.e. { x: tier1Pos.x + 1, y: tier1Pos.y }).
 *
 * If the tier 1 miner's position is unknown (null), the fallback behaviour picks
 * any valid orthogonal tile adjacent to the tier 2 miner that is not a wall and
 * not the source tile itself.
 */
export class ContainerPlacementStrategy {
    /**
     * Find the tile for the mining container.
     * The tile is always the tile to the right of the tier 1 miner when that
     * position is known.  If it is not known, falls back to the first valid
     * orthogonal tile adjacent to the tier 2 miner.
     *
     * @param {Object} tier2Creep - The tier 2 miner creep game object
     * @param {Object|null} tier1Pos - The tier 1 miner's target position {x, y}, or null if unknown
     * @param {Object} source - The energy source to avoid placing on
     * @returns {Object|null} Position {x, y} for the container, or null if none found
     */
    static findContainerPosition(tier2Creep, tier1Pos, source) {
        // Primary: tile to the right of the tier 1 miner
        if (tier1Pos) {
            const pos = { x: tier1Pos.x + 1, y: tier1Pos.y };
            if (
                TerrainAnalyzer.isValidPosition(pos) &&
                getTerrainAt(pos) !== TERRAIN_WALL &&
                !(source && pos.x === source.x && pos.y === source.y)
            ) {
                return pos;
            }
        }

        // Fallback: any valid orthogonal tile adjacent to the tier 2 miner
        const cardinalOffsets = [
            { dx: 0, dy: -1 }, // TOP
            { dx: 1, dy: 0 },  // RIGHT
            { dx: 0, dy: 1 },  // BOTTOM
            { dx: -1, dy: 0 }, // LEFT
        ];
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
