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

        // Targeting is unchanged — always attack if a target is available
        creep.attack(result.attackTarget);

        // Payload priority overrides combat mode movement
        if (result.mode === 'payload_priority') {
            creep.moveTo(result.enemyPayload);
            return;
        }

        // Movement is determined by the current combat mode
        const combatMode = this.gameState.getCombatMode();
        if (combatMode === 'retreat') {
            const target = this.gameState.getRetreatTarget();
            if (target) creep.moveTo(target);
        } else if (combatMode === 'idle') {
            const target = this.gameState.getIdleTarget();
            if (target) creep.moveTo(target);
        } else {
            // 'attack' mode — move toward the movement target
            creep.moveTo(result.movementTarget);
        }
    }
}
