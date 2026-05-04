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

        if (!result || result.mode === 'idle') {
            this.idle(creep);
            return;
        }

        if (result.mode === 'payload_priority') {
            if (result.combatEnemiesInRange.length > 0) {
                const target = creep.findClosestByRange(result.combatEnemiesInRange);
                if (target) { this.attackOrMoveTo(creep, target); return; }
            }
            this.attackOrMoveTo(creep, result.enemyPayload);
            return;
        }

        if (!this.gameState.isCombatEngaged()) {
            this.idle(creep);
            return;
        }

        const attackResult = creep.attack(result.attackTarget);
        if (attackResult === ERR_NOT_IN_RANGE) {
            creep.moveTo(result.movementTarget);
        }
    }

    attackOrMoveTo(creep, target) {
        const attackResult = creep.attack(target);
        if (attackResult === ERR_NOT_IN_RANGE) {
            creep.moveTo(target);
        }
    }

    attackFortifiedMiner(creep, fortifiedMiner) {
        const attackCreepResult = creep.attack(fortifiedMiner.creep);
        if (attackCreepResult === ERR_NOT_IN_RANGE) {
            const attackRampartResult = creep.attack(fortifiedMiner.rampart);
            if (attackRampartResult === ERR_NOT_IN_RANGE) {
                creep.moveTo(fortifiedMiner.creep);
            }
        }
    }
}
