import { TOWER_RANGE } from 'game/constants';
import { DEFAULT_TIER } from '../constants.mjs';

export class TurretJob {
    constructor(id, jobName, tier, controller, gameState) {
        this.id = id;
        this.jobName = jobName;
        this.tier = tier || DEFAULT_TIER;
        this.controller = controller;
        this.gameState = gameState;
        this.memory = {};
    }

    static getTierBody() {
        return [];
    }

    static getTierCost() {
        return 0;
    }

    act() {
        const turret = this.gameState.getMyTowers().find(t => t.id === this.id);
        if (!turret) return;

        const target = turret.findClosestByRange(this.gameState.getEnemyCreeps());
        if (target && turret.getRangeTo(target) <= TOWER_RANGE) {
            turret.attack(target);
        }
    }
}
