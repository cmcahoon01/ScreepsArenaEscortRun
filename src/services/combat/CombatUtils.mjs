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

export function selectFlagKiller(gameState, flagBlocker) {
    const myCreeps = gameState.getMyCreeps();
    const fighters = myCreeps.filter(c => gameState.getCreepJobName(c.id) === 'fighter');
    const combatCreeps = myCreeps.filter(c => COMBAT_JOBS.has(gameState.getCreepJobName(c.id)));

    const candidates = fighters.length > 0 ? fighters : combatCreeps;
    if (candidates.length === 0) return null;

    const closest = flagBlocker.findClosestByRange(candidates);
    return closest ? closest.id : null;
}

export function getEnemyPayloadIfActive(gameState, ramparts, enemySpawn) {
    const enemyEscortCreepId = gameState.getEnemyPayloadId();
    if (!enemyEscortCreepId) return null;
    const enemyPayload = getObjectById(enemyEscortCreepId);
    if (!enemyPayload) return null;
    if (isOnEnemyRampart(enemyPayload, ramparts)) return null;
    if (isWithinEnemySpawnRadius(enemyPayload, enemySpawn)) return null;
    return enemyPayload;
}

export function getValidTargets(allHostileCreeps, ramparts, enemySpawn) {
    const { enemiesNotOnRamparts } = filterEnemiesByRampartStatus(allHostileCreeps, ramparts);
    return enemySpawn
        ? enemiesNotOnRamparts.filter(e => !isWithinEnemySpawnRadius(e, enemySpawn))
        : enemiesNotOnRamparts;
}

export function getFlagBlocker(gameState, enemies) {
    return findFlagBlockingEnemy(gameState, enemies);
}

export function selectPrimaryTarget(creep, gameState, enemiesInAttackRange) {
    const allHostileCreeps = gameState.getEnemyCreeps();
    if (allHostileCreeps.length === 0) return null;

    const ramparts = gameState.getRamparts();
    const enemySpawn = gameState.getEnemySpawn();
    const validTargets = getValidTargets(allHostileCreeps, ramparts, enemySpawn);

    const enemyPayload = getEnemyPayloadIfActive(gameState, ramparts, enemySpawn);
    if (enemyPayload) {
        const combatEnemiesInRange = enemiesInAttackRange.filter(
            e => e.id !== gameState.getEnemyPayloadId() && hasAttackCapability(e)
        );
        let attackTarget = enemyPayload;
        if (enemiesInAttackRange.length > 0 && !enemiesInAttackRange.some(e => e.id === enemyPayload.id)) {
            attackTarget = enemiesInAttackRange[0]
        }
        return { mode: 'payload_priority', attackTarget, enemyPayload, combatEnemiesInRange, validTargets };
    }

    if (validTargets.length === 0) {
        return { mode: 'idle', validTargets };
    }

    const closestEnemy = creep.findClosestByRange(validTargets);
    let attackTarget = closestEnemy;
    let movementTarget = closestEnemy;

    if (enemiesInAttackRange.length === 0) {
        const flagBlocker = findFlagBlockingEnemy(gameState, allHostileCreeps);
        if (flagBlocker && creep.id === gameState.getFlagKillerId()) {
            attackTarget = flagBlocker;
            movementTarget = flagBlocker;
        } else if (gameState.isPayloadMoving()) {
            const payloadId = gameState.getPayloadId();
            const payload = payloadId ? getObjectById(payloadId) : null;
            if (payload && validTargets.length > 0) {
                const enemyClosestToPayload = payload.findClosestByRange(validTargets);
                if (enemyClosestToPayload) movementTarget = enemyClosestToPayload;
            }
        }
    }

    return { mode: 'standard', attackTarget, movementTarget, validTargets };
}

export function findFlagBlockingEnemy(gameState, enemies) {
    const flag = gameState.getFlag();
    if (!flag) return null;

    const payloadId = gameState.getPayloadId();
    if (!payloadId) return null;

    const payload = getObjectById(payloadId);
    if (!payload) return null;

    if (getRange(payload, flag) > CombatConfig.FLAG_BLOCKER_RANGE) return null;

    return enemies.find(e => e.x === flag.x && e.y === flag.y) || null;
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
    selectFlagKiller,
    selectPrimaryTarget,
    findFlagBlockingEnemy,
    getEnemyPayloadIfActive,
    getValidTargets,
    getFlagBlocker,
};
