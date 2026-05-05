import { getObjectById } from 'game/utils';
import { ERR_NOT_IN_RANGE } from 'game/constants';
import { ActiveCreep } from './ActiveCreep.mjs';
import { selectPrimaryTarget } from '../../services/combat/CombatUtils.mjs';

export class MeleeJob extends ActiveCreep {
    constructor(id, jobName, tier, controller, gameState) {
        super(id, jobName, tier, controller, gameState);
        if (new.target === MeleeJob) {
            throw new TypeError("Cannot construct MeleeJob instances directly");
        }
    }

    performHealing(creep, damagedCreeps) {
        // Default: no healing
    }

    act() {
        const creep = getObjectById(this.id);
        if (!creep) return;

        const allHostileCreeps = this.gameState.getEnemyCreeps();
        const myCreeps = this.gameState.getMyCreeps();
        const damagedCreeps = myCreeps.filter(c => c.id !== creep.id && c.hits < c.hitsMax);

        this.performHealing(creep, damagedCreeps);

        const enemiesInMeleeRange = allHostileCreeps.filter(e =>
            Math.max(Math.abs(e.x - creep.x), Math.abs(e.y - creep.y)) <= 1
        );

        const result = selectPrimaryTarget(creep, this.gameState, enemiesInMeleeRange);

        if (!result || result.mode === 'idle' || !this.gameState.isCombatEngaged()) {
            this.idle(creep);
            return;
        }

        const attackResult = creep.attack(result.attackTarget);
        if (result.mode === 'payload_priority') {
            creep.moveTo(result.enemyPayload);
        } else {
            creep.moveTo(result.movementTarget);
        }

    }
}
