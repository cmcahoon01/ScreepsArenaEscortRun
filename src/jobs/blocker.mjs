import { getObjectById } from 'game/utils';
import { MOVE } from 'game/constants';
import { ActiveCreep } from './ActiveCreep.mjs';
import { BodyPartCalculator } from '../constants.mjs';

// Blocker job - rushes to the enemy flag and stands on it to prevent the enemy from winning
export class BlockerJob extends ActiveCreep {
    static get BODY() {
        return [MOVE];
    }

    static get COST() {
        return BodyPartCalculator.calculateCost(this.BODY);
    }

    static get JOB_NAME() {
        return 'blocker';
    }

    act() {
        const creep = getObjectById(this.id);
        if (!creep) {
            return;
        }

        const enemyFlag = this.gameState.getEnemyFlag();
        if (!enemyFlag) {
            return;
        }

        // Move to the enemy flag and stand on it
        creep.moveTo(enemyFlag);
    }
}
