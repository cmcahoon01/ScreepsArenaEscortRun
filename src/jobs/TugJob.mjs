import { getObjectById } from 'game/utils';
import { MOVE } from 'game/constants';
import { ActiveCreep } from './base/ActiveCreep.mjs';
import { calculateCost } from '../services/BodyPartService.mjs';
import { joinTugChain } from '../services/TugChainService.mjs';

export class TugJob extends ActiveCreep {
    static get BODY() {
        return [MOVE];
    }

    static get COST() {
        return calculateCost(this.BODY);
    }

    static get JOB_NAME() {
        return 'tug';
    }

    findIdleRampart(creep) {
        const spawn = this.gameState.getMySpawn();
        if (!spawn) return null;

        const idleRamparts = this.gameState.getMyRamparts().filter(r => {
            const chebyshevDist = Math.max(Math.abs(r.x - spawn.x), Math.abs(r.y - spawn.y));
            return chebyshevDist > 1;
        });

        if (idleRamparts.length === 0) return null;
        return creep.findClosestByRange(idleRamparts);
    }

    _joinOrLeadChain(creep) {
        joinTugChain(this.id, creep, this.gameState);
    }

    act() {
        const creep = getObjectById(this.id);
        if (!creep) return;

        const tugChain = this.gameState.getTugChain();

        if (tugChain.length === 0) {
            const idleRampart = this.findIdleRampart(creep);
            if (idleRampart) {
                creep.moveTo(idleRampart);
            } else {
                const mySpawn = this.gameState.getMySpawn();
                if (mySpawn) creep.moveTo(mySpawn);
            }
            return;
        }

        this._joinOrLeadChain(creep);
    }
}
