import { getRange } from 'game/utils';
import { isValidPosition, isWall, isSwamp, buildCreepPositionMap, hasCreepInMap, hasObstacle } from './TerrainAnalyzer.mjs';

export function getValidAdjacentPositions(unit, allCreeps, allStructures) {
    const adjacentOffsets = [
        { x: 0, y: -1 },
        { x: 1, y: -1 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
        { x: -1, y: 1 },
        { x: -1, y: 0 },
        { x: -1, y: -1 }
    ];

    const creepPositionMap = buildCreepPositionMap(allCreeps);
    const validPositions = [];

    for (const offset of adjacentOffsets) {
        const pos = { x: unit.x + offset.x, y: unit.y + offset.y };
        if (!isValidPosition(pos)) continue;
        if (isWall(pos)) continue;
        if (hasCreepInMap(pos, creepPositionMap)) continue;
        if (hasObstacle(pos, allStructures)) continue;
        validPositions.push(pos);
    }

    return validPositions;
}

export function findNearestEnemy(position, enemies) {
    if (enemies.length === 0) return null;

    let nearestEnemy = enemies[0];
    let minRange = getRange(position, nearestEnemy);

    for (let i = 1; i < enemies.length; i++) {
        const range = getRange(position, enemies[i]);
        if (range < minRange) {
            minRange = range;
            nearestEnemy = enemies[i];
        }
    }

    return nearestEnemy;
}

export function findBestRetreatPosition(unit, enemies, allCreeps, allStructures) {
    if (enemies.length === 0) {
        console.log("No enemies to retreat from!");
        return null;
    }

    const validPositions = getValidAdjacentPositions(unit, allCreeps, allStructures);

    if (validPositions.length === 0) {
        return null;
    }

    const positionsWithDistances = validPositions.map(pos => {
        const minEnemyDistance = Math.min(...enemies.map(enemy => getRange(pos, enemy)));
        return { pos, minEnemyDistance };
    });

    const maxDistance = Math.max(...positionsWithDistances.map(p => p.minEnemyDistance));

    let bestPositions = positionsWithDistances
        .filter(p => p.minEnemyDistance === maxDistance)
        .map(p => p.pos);

    if (bestPositions.length === 1) return bestPositions[0];

    const nonSwampPositions = bestPositions.filter(pos => !isSwamp(pos));
    if (nonSwampPositions.length > 0) {
        bestPositions = nonSwampPositions;
    }

    if (bestPositions.length === 1) return bestPositions[0];

    let furthestPosition = bestPositions[0];
    let closestEnemy = findNearestEnemy(furthestPosition, enemies);
    let maxSquaredDistance = (furthestPosition.x - closestEnemy.x) ** 2 +
                             (furthestPosition.y - closestEnemy.y) ** 2;

    for (let i = 1; i < bestPositions.length; i++) {
        const pos = bestPositions[i];
        const nearestEnemy = findNearestEnemy(pos, enemies);
        const squaredDistance = (pos.x - nearestEnemy.x) ** 2 +
                                (pos.y - nearestEnemy.y) ** 2;

        if (squaredDistance > maxSquaredDistance) {
            maxSquaredDistance = squaredDistance;
            furthestPosition = pos;
        }
    }

    return furthestPosition;
}
