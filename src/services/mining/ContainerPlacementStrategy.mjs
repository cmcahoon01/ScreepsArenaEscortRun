import { getTerrainAt } from 'game/utils';
import { TERRAIN_WALL } from 'game/constants';
import { isValidPosition } from '../combat/TerrainAnalyzer.mjs';

export function findContainerPosition(tier2Creep, tier1Pos, source) {
    if (tier1Pos) {
        const pos = { x: tier1Pos.x + 1, y: tier1Pos.y };
        if (
            isValidPosition(pos) &&
            getTerrainAt(pos) !== TERRAIN_WALL &&
            !(source && pos.x === source.x && pos.y === source.y)
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
