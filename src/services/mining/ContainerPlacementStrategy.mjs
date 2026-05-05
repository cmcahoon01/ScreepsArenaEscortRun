import { getTerrainAt } from 'game/utils';
import { TERRAIN_WALL } from 'game/constants';
import { isValidPosition } from '../combat/TerrainAnalyzer.mjs';
import { MapTopology } from '../../constants.mjs';

export function findContainerPosition(tier2Creep, tier1Pos, source) {
    if (tier1Pos && source) {
        // Place the container diagonally between miner1 and the source.
        // When the source is in the top half of the map, miner1 sits below-left
        // of the source, so stepping right+down (dy = 1) moves toward the source.
        // When the source is in the bottom half, miner1 sits above-left, so
        // stepping right+up (dy = -1) moves toward the source.
        const dy = source.y < MapTopology.ARENA_CENTER ? 1 : -1;
        const pos = { x: tier1Pos.x + 1, y: tier1Pos.y + dy };
        if (
            isValidPosition(pos) &&
            getTerrainAt(pos) !== TERRAIN_WALL &&
            !(pos.x === source.x && pos.y === source.y)
        ) {
            return pos;
        }
    }

    const cardinalOffsets = [
        { dx: 0, dy: -1 },
        { dx: 1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 },
    ];
    for (const offset of cardinalOffsets) {
        const pos = { x: tier2Creep.x + offset.dx, y: tier2Creep.y + offset.dy };
        if (!isValidPosition(pos)) continue;
        if (getTerrainAt(pos) === TERRAIN_WALL) continue;
        if (source && pos.x === source.x && pos.y === source.y) continue;
        return pos;
    }

    return null;
}

// Backward-compatible namespace
export const ContainerPlacementStrategy = {
    findContainerPosition,
};
