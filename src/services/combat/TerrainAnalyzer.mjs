import { getTerrainAt } from 'game/utils';
import { TERRAIN_WALL, TERRAIN_SWAMP } from 'game/constants';
import { MapTopology } from '../../constants.mjs';

export function isValidPosition(pos) {
    return pos.x >= 0 && pos.x < MapTopology.ARENA_SIZE &&
           pos.y >= 0 && pos.y < MapTopology.ARENA_SIZE;
}

export function isWall(pos) {
    return getTerrainAt(pos) === TERRAIN_WALL;
}

export function isSwamp(pos) {
    return getTerrainAt(pos) === TERRAIN_SWAMP;
}

export function hasCreep(pos, allCreeps) {
    return allCreeps.some(c => c.x === pos.x && c.y === pos.y);
}

export function buildCreepPositionMap(allCreeps) {
    return new Set(allCreeps.map(c => `${c.x},${c.y}`));
}

export function hasCreepInMap(pos, creepPositionMap) {
    return creepPositionMap.has(`${pos.x},${pos.y}`);
}

export function hasObstacle(pos, allStructures) {
    return allStructures.some(s =>
        s.x === pos.x && s.y === pos.y &&
        (s.constructor.name === 'StructureWall' ||
         (s.constructor.name === 'StructureRampart' && !s.my))
    );
}
