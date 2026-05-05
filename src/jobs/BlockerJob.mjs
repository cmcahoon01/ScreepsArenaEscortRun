import { getObjectById } from 'game/utils';
import { MOVE } from 'game/constants';
import { ActiveCreep } from './base/ActiveCreep.mjs';
import { calculateCost } from '../services/BodyPartService.mjs';
import { isMovingToPosition } from '../services/mining/MinerStateMachine.mjs';
import { joinTugChain } from '../services/TugChainService.mjs';
import { MINER_JOB_NAMES } from '../constants.mjs';
import { isValidPosition, isWall } from '../services/combat/TerrainAnalyzer.mjs';
import { chebyshevDistance } from '../services/RangeUtils.mjs';

export class BlockerJob extends ActiveCreep {
    static get BODY() {
        return [MOVE];
    }

    static get COST() {
        return calculateCost(this.BODY);
    }

    static get JOB_NAME() {
        return 'blocker';
    }

    act() {
        const creep = getObjectById(this.id);
        if (!creep) return;

        if (!this.memory.minerTugged) {
            const movingMiner = this.controller.creeps.find(c =>
                MINER_JOB_NAMES.has(c.jobName) && isMovingToPosition(c.memory)
            );

            if (movingMiner) {
                this._actAsTug(creep, movingMiner);
                return;
            }

            this.memory.minerTugged = true;
        }

        const enemyFlag = this.gameState.getEnemyFlag();
        if (!enemyFlag) return;

        // If on the flag and a blocker2 is adjacent, move out of the way to let it take over
        if (creep.x === enemyFlag.x && creep.y === enemyFlag.y) {
            const adjacentBlocker2 = this.controller.creeps.find(c => {
                if (c.jobName !== 'blocker2') return false;
                const blocker2Creep = getObjectById(c.id);
                if (!blocker2Creep) return false;
                return chebyshevDistance(blocker2Creep, enemyFlag) === 1;
            });

            if (adjacentBlocker2) {
                const occupied = new Set(
                    this.gameState.getAllCreeps()
                        .filter(c => c.id !== this.id)
                        .map(c => `${c.x},${c.y}`)
                );
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        if (dx === 0 && dy === 0) continue;
                        const pos = { x: enemyFlag.x + dx, y: enemyFlag.y + dy };
                        if (!isValidPosition(pos) || isWall(pos)) continue;
                        if (!occupied.has(`${pos.x},${pos.y}`)) {
                            creep.moveTo(pos);
                            return;
                        }
                    }
                }
                return;
            }
        }

        creep.moveTo(enemyFlag);
    }

    _actAsTug(creep, movingMiner) {
        const tugChain = this.gameState.getTugChain();

        if (tugChain.length === 0) {
            const minerCreep = getObjectById(movingMiner.id);
            if (minerCreep) creep.moveTo(minerCreep);
            return;
        }

        joinTugChain(this.id, creep, this.gameState);
    }
}
