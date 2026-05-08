import { getRange, getObjectById } from 'game/utils';
import { ATTACK, RANGED_ATTACK } from 'game/constants';
import { CombatConfig, MapTopology } from '../../constants.mjs';
import { chebyshevDistance } from '../RangeUtils.mjs';

const COMBAT_JOBS = new Set(CombatConfig.COMBAT_JOBS);

export function hasValidEnemyTargets(enemies, ramparts) {
    if (enemies.length === 0) return false;
    return filterMeleeTargetableEnemies(enemies, ramparts).length > 0;
}

export function isInEnemyThird(pos, enemySpawn) {
    if (!enemySpawn) return false;

    const mapSize = MapTopology.ARENA_SIZE;
    const thirdSize = mapSize / 3;

    if (enemySpawn.x < thirdSize) {
        if (enemySpawn.y < thirdSize) return pos.y < thirdSize;
        else if (enemySpawn.y > mapSize - thirdSize) return pos.y > mapSize - thirdSize;
        return pos.x < thirdSize;
    } else if (enemySpawn.x > mapSize - thirdSize) {
        return pos.x > mapSize - thirdSize;
    }

    if (enemySpawn.y < thirdSize) return pos.y < thirdSize;
    else if (enemySpawn.y > mapSize - thirdSize) return pos.y > mapSize - thirdSize;

    return false;
}

export function isWithinEnemySpawnRadius(pos, enemySpawn) {
    if (!enemySpawn) return false;
    return chebyshevDistance(pos, enemySpawn) <= CombatConfig.SPAWN_EXCLUSION_RADIUS;
}

export function filterEnemiesByRampartStatus(enemies, ramparts) {
    const rampartPositions = new Set(ramparts.map(r => `${r.x},${r.y}`));
    const enemiesNotOnRamparts = [];
    const enemiesOnRamparts = [];

    enemies.forEach(enemy => {
        if (rampartPositions.has(`${enemy.x},${enemy.y}`)) {
            enemiesOnRamparts.push(enemy);
        } else {
            enemiesNotOnRamparts.push(enemy);
        }
    });

    return { enemiesNotOnRamparts, enemiesOnRamparts };
}

export function filterMeleeTargetableEnemies(enemies, ramparts) {
    return enemies.filter(enemy =>
        !ramparts.some(rampart => rampart.x === enemy.x && rampart.y === enemy.y)
    );
}

export function isOnEnemyRampart(target, ramparts) {
    return ramparts.some(r => !r.my && r.x === target.x && r.y === target.y);
}

export function hasAttackCapability(creep) {
    if (!creep || !creep.body) return false;
    return creep.body.some(part => part.type === ATTACK || part.type === RANGED_ATTACK);
}

export function getValidTargets(allHostileCreeps, ramparts, enemySpawn) {
    const { enemiesNotOnRamparts } = filterEnemiesByRampartStatus(allHostileCreeps, ramparts);
    return enemySpawn
        ? enemiesNotOnRamparts.filter(e => !isWithinEnemySpawnRadius(e, enemySpawn))
        : enemiesNotOnRamparts;
}


export function selectPrimaryTarget(creep, gameState, enemiesInAttackRange) {
    const allHostileCreeps = gameState.getEnemyCreeps();
    if (allHostileCreeps.length === 0) return null;

    const ramparts = gameState.getRamparts();
    const enemySpawn = gameState.getEnemySpawn();
    const validTargets = getValidTargets(allHostileCreeps, ramparts, enemySpawn);

    if (validTargets.length === 0) {
        return { mode: 'idle', validTargets };
    }

    const closestEnemy = creep.findClosestByRange(validTargets);
    let attackTarget = closestEnemy;
    let movementTarget = closestEnemy;

    return { mode: 'standard', attackTarget, movementTarget, validTargets };
}

// Backward-compatible namespace for callers using CombatUtils.method()
export const CombatUtils = {
    hasValidEnemyTargets,
    isInEnemyThird,
    isWithinEnemySpawnRadius,
    filterEnemiesByRampartStatus,
    filterMeleeTargetableEnemies,
    isOnEnemyRampart,
    hasAttackCapability,
    selectPrimaryTarget,
    getValidTargets,
};
