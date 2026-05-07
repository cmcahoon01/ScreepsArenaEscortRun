import { getObjectById } from 'game/utils';
import { ATTACK, MOVE, ERR_NOT_IN_RANGE } from 'game/constants';
import { FighterJob } from './FighterJob.mjs';
import { calculateCost } from '../services/BodyPartService.mjs';

const TUNNEL_X_START = 43;
const TUNNEL_X_END = 61;
const TOP_TUNNEL_Y = 9;
const BOTTOM_TUNNEL_Y = 90;

export class TunnelerJob extends FighterJob {
    static get BODY() {
        return [ATTACK, ATTACK, ATTACK, MOVE];
    }

    static get COST() {
        return calculateCost(this.BODY);
    }

    static get JOB_NAME() {
        return 'tunneler';
    }

    act() {
        if (this.gameState.getTunnelBreached()) {
            super.act();
            return;
        }

        const creep = getObjectById(this.id);
        if (!creep) return;

        const nextWall = this._getNextTunnelWall();
        if (!nextWall) {
            this.gameState.setTunnelBreached(true);
            super.act();
            return;
        }

        const attackResult = creep.attack(nextWall);
        if (attackResult === ERR_NOT_IN_RANGE) {
            creep.moveTo(nextWall);
        }
    }

    _getNextTunnelWall() {
        const tunnelY = this.gameState.getWeAreTop() ? TOP_TUNNEL_Y : BOTTOM_TUNNEL_Y;
        const tunnelWalls = this.gameState.getWalls().filter(w =>
            w.y === tunnelY &&
            w.x >= TUNNEL_X_START &&
            w.x <= TUNNEL_X_END
        );
        if (tunnelWalls.length === 0) return null;

        return tunnelWalls.reduce((leftMostWall, wall) =>
            wall.x < leftMostWall.x ? wall : leftMostWall
        );
    }
}
