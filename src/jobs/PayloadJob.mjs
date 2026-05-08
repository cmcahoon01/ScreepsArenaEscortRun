import { getObjectById, getTicks } from 'game/utils';
import { ActiveCreep } from './base/ActiveCreep.mjs';
import { compareTeamStrengths } from '../services/combat/StrengthEstimatorService.mjs';
import { PayloadConfig, MapTopology } from '../constants.mjs';
import { chebyshevDistance } from '../services/RangeUtils.mjs';

export class PayloadJob extends ActiveCreep {
    static get BODY() {
        return [];
    }

    static get COST() {
        return 0;
    }

    static get JOB_NAME() {
        return 'payload';
    }

    constructor(id, jobName, tier, controller, gameState, flag) {
        super(id, jobName, tier, controller, gameState);
        this.flag = flag;
        this.memory.state = PayloadConfig.STATE_WAITING;
        this.gameState.setPayloadId(this.id);
    }

    hasMilitaryAdvantage() {
        const comparison = compareTeamStrengths(this.gameState);
        return comparison.ratio >= PayloadConfig.MILITARY_ADVANTAGE_THRESHOLD &&
            comparison.myTeam.strength > comparison.enemyTeam.strength + 300;
    }

    shouldTransitionToMoving() {
        // return this.hasMilitaryAdvantage() || getTicks() >= PayloadConfig.GAME_TIME_THRESHOLD;
        return this.gameState.getTunnelBreached() || getTicks() >= PayloadConfig.GAME_TIME_THRESHOLD;
    }

    findWaitingRampart(creep) {
        const spawn = this.gameState.getMySpawn();
        if (!spawn) return null;

        const occupiedPositions = new Set(
            this.gameState.getAllCreeps()
                .filter(c => c.id !== creep.id)
                .map(c => `${c.x},${c.y}`)
        );

        const nearRamparts = this.gameState.getMyRamparts().filter(r =>
            chebyshevDistance(r, spawn) === PayloadConfig.WAITING_RAMPART_DISTANCE &&
            !occupiedPositions.has(`${r.x},${r.y}`)
        );

        if (nearRamparts.length === 0) return null;
        return creep.findClosestByRange(nearRamparts);
    }

    hasEnemiesNearby(creep) {
        return this.gameState.getEnemyCreeps().some(e =>
            chebyshevDistance(creep, e) <= PayloadConfig.ENEMY_NEARBY_RANGE
        );
    }

    getForwardWaitPosition(spawn) {
        const yOffset = spawn.y < MapTopology.ARENA_CENTER
            ? PayloadConfig.WAITING_FORWARD_OFFSET_Y - 1
            : -PayloadConfig.WAITING_FORWARD_OFFSET_Y + 1;
        return { x: spawn.x + PayloadConfig.WAITING_FORWARD_OFFSET_X - 1, y: spawn.y + yOffset };
    }

    act() {
        const creep = getObjectById(this.id);
        if (!creep) return;

        this.gameState.setPayloadMoving(this.memory.state === PayloadConfig.STATE_MOVING);

        if (this.memory.state === PayloadConfig.STATE_WAITING) {
            if (this.shouldTransitionToMoving()) {
                this.memory.state = PayloadConfig.STATE_MOVING;
                this.gameState.setTugChain([this.id]);
                console.log("Payload beginning pilgrimage");
            } else {
                const tunneler = this.controller.creeps.find(creep => creep.jobName === 'tunneler');
                if (tunneler && getTicks() > 650) {
                    creep.moveTo(getObjectById(tunneler.id));
                } else {
                    creep.moveTo(this.getForwardWaitPosition(this.gameState.getMySpawn()));
                }
                return;
            }
        }

        if (this.memory.state === PayloadConfig.STATE_MOVING) {
            const tugChain = this.gameState.getTugChain();
            if (tugChain.length === 0) {
                this.gameState.setTugChain([this.id]);
            }

            if (this.flag) {
                this.gameState.getTugChain().tick(this.flag, this.gameState);
            }
        }
    }
}
