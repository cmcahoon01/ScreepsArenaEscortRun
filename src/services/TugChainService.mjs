import { getObjectById } from 'game/utils';
import { isValidPosition, isWall } from './combat/TerrainAnalyzer.mjs';
import { chebyshevDistance } from './RangeUtils.mjs';

export function moveChain(tugChain, target, gameState) {
    if (!tugChain || tugChain.length === 0) return false;

    const creeps = tugChain.map(id => getObjectById(id));

    if (creeps.some(creep => !creep || !creep.exists)) return false;

    let reachedTarget = false;

    for (let idx = 0; idx < creeps.length; idx++) {
        if (idx === 0) {
            if (creeps[idx].x === target.x && creeps[idx].y === target.y) {
                reachedTarget = true;
                let evadePos;
                if (creeps.length > 1) {
                    const dragged = creeps[1];
                    const tug = creeps[idx];
                    const occupied = new Set(
                        gameState.getAllCreeps()
                            .filter(c => c !== tug)
                            .map(c => `${c.x},${c.y}`)
                    );
                    const candidates = [];
                    for (let dx = -1; dx <= 1; dx++) {
                        for (let dy = -1; dy <= 1; dy++) {
                            if (dx === 0 && dy === 0) continue;
                            const pos = { x: dragged.x + dx, y: dragged.y + dy };
                            if (pos.x === target.x && pos.y === target.y) continue;
                            if (!isValidPosition(pos)) continue;
                            if (isWall(pos)) continue;
                            if (occupied.has(`${pos.x},${pos.y}`)) continue;
                            candidates.push(pos);
                        }
                    }
                    const tugX = tug.x;
                    const tugY = tug.y;
                    evadePos = candidates.length > 0
                        ? candidates.reduce((best, pos) =>
                            Math.max(Math.abs(pos.x - tugX), Math.abs(pos.y - tugY)) <
                            Math.max(Math.abs(best.x - tugX), Math.abs(best.y - tugY))
                                ? pos : best
                        )
                        : { x: target.x, y: target.y - 1 };
                } else {
                    evadePos = { x: target.x, y: target.y - 1 };
                }
                creeps[idx].moveTo(evadePos);
            } else {
                creeps[idx].moveTo(target);
            }
        } else {
            creeps[idx - 1].pull(creeps[idx]);
            creeps[idx].moveTo(creeps[idx - 1]);
        }
    }

    if (reachedTarget) {
        gameState.clearTugChain();
    }

    return true;
}

export function joinTugChain(creepId, creep, gameState) {
    const tugChain = gameState.getTugChain();

    if (tugChain.includes(creepId)) return;

    const lastCreep = getObjectById(tugChain.last);

    if (!lastCreep) return;

    if (chebyshevDistance(creep, lastCreep) <= 1) {
        if (tugChain.length === 1) {
            tugChain.setLeader(creepId);
        } else {
            tugChain.extend(creepId);
        }
    } else {
        creep.moveTo(lastCreep);
    }
}

// Backward-compatible class wrapper
export const TugChainService = {
    moveChain,
};
