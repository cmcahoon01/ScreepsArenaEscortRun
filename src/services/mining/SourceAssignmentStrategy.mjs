import { isValidPosition } from '../combat/TerrainAnalyzer.mjs';
import { MapTopology } from '../../constants.mjs';

export function findSortedSources(gameState) {
    const sources = gameState.getSources();
    return sources.sort((a, b) => a.y - b.y);
}

export function getTeamSide(gameState) {
    const spawn = gameState.getMySpawn();
    if (!spawn) return 'left';
    return spawn.x < 50 ? 'left' : 'right';
}

export function assignSourceToMiner(minerIndex, gameState) {
    const sources = findSortedSources(gameState);
    const mySpawn = gameState.getMySpawn();

    if (sources.length === 0) return null;

    if (!mySpawn) return sources[0];

    const sourcesByDistance = sources.slice().sort((a, b) => {
        const distA = Math.abs(a.x - mySpawn.x) + Math.abs(a.y - mySpawn.y);
        const distB = Math.abs(b.x - mySpawn.x) + Math.abs(b.y - mySpawn.y);
        return distA - distB;
    });

    return sourcesByDistance[0];
}

export function findMiningPosition(source, gameState, excludePositions = []) {
    const mySpawn = gameState.getMySpawn();

    const allDirections = [
        { dx: 0, dy: -1 },
        { dx: 1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 },
        { dx: 1, dy: 1 },
        { dx: 1, dy: -1 },
        { dx: -1, dy: 1 },
        { dx: -1, dy: -1 }
    ];

    const isExcluded = (pos) => excludePositions.some(ep => ep.x === pos.x && ep.y === pos.y);

    let preferredDirections = [];
    if (mySpawn) {
        const dx = Math.sign(mySpawn.x - source.x);
        const dy = Math.sign(mySpawn.y - source.y);

        if (dx !== 0 && dy !== 0) {
            preferredDirections.push({ dx, dy });
            preferredDirections.push({ dx, dy: 0 });
            preferredDirections.push({ dx: 0, dy });
        } else if (dx !== 0) {
            preferredDirections.push({ dx, dy: 0 });
        } else if (dy !== 0) {
            preferredDirections.push({ dx: 0, dy });
        }
    } else {
        if (source.y < MapTopology.ARENA_CENTER) {
            preferredDirections = [{ dx: 1, dy: 1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }];
        } else {
            preferredDirections = [{ dx: 1, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: -1 }];
        }
    }

    for (const dir of preferredDirections) {
        const pos = { x: source.x + dir.dx, y: source.y + dir.dy };
        if (isValidPosition(pos) && !isExcluded(pos)) return pos;
    }

    for (const dir of allDirections) {
        const pos = { x: source.x + dir.dx, y: source.y + dir.dy };
        if (isValidPosition(pos) && !isExcluded(pos)) return pos;
    }

    return null;
}

// Backward-compatible namespace
export const SourceAssignmentStrategy = {
    findSortedSources,
    getTeamSide,
    assignSourceToMiner,
    findMiningPosition,
};
