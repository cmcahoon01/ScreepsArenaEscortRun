import {findInRange, getObjectById} from 'game/utils';
import { ERR_NOT_IN_RANGE } from 'game/constants';
import { ActiveCreep } from './ActiveCreep.mjs';
import { selectPrimaryTarget, findFlagBlockingEnemy } from '../../services/combat/CombatUtils.mjs';
import {chebyshevDistance} from "../../services/RangeUtils.mjs";
import {PayloadConfig, CombatConfig} from "../../constants.mjs";

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
        const allCreeps = this.gameState.getAllCreeps();
        const damagedCreeps = myCreeps.filter(c => c.id !== creep.id && c.hits < c.hitsMax);
        const enemyFlag = this.gameState.getEnemyFlag();
        const enemiesInMeleeRange = allHostileCreeps.filter(e =>
            Math.max(Math.abs(e.x - creep.x), Math.abs(e.y - creep.y)) <= 1
        );

        this.performHealing(creep, damagedCreeps);

        // FlagKiller override: ignore combat mode, always pursue flag blocker
        if (creep.id === this.gameState.getFlagKillerId()) {
            const flagBlocker = findFlagBlockingEnemy(this.gameState, allHostileCreeps);
            if (flagBlocker) {
                creep.moveTo(flagBlocker);
                if (enemiesInMeleeRange.length > 0) {
                    creep.attack(creep.findClosestByRange(enemiesInMeleeRange));
                }
                return;
            }
        }

        // Need to block override: move onto enemy flag If I am nearby and no one is on it
        if (chebyshevDistance(creep, enemyFlag) < PayloadConfig.ENEMY_NEARBY_RANGE && findInRange(enemyFlag, allCreeps, 0).length === 0) {
            creep.moveTo(enemyFlag);
            if (enemiesInMeleeRange.length > 0) {
                creep.attack(creep.findClosestByRange(enemiesInMeleeRange));
            }
        }

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
            const vanguardLeaderPos = this.gameState.getMyVanguardLeaderPos();
            const inVanguard = !vanguardLeaderPos ||
                chebyshevDistance(creep, vanguardLeaderPos) < CombatConfig.VANGUARD_GROUP_HEIGHT;
            if (!inVanguard) {
                // Non-vanguard units move toward the vanguard to reinforce it
                creep.moveTo(vanguardLeaderPos);
            } else {
                const target = this.gameState.getRetreatTarget();
                if (target) creep.moveTo(target);
            }
        } else if (combatMode === 'idle') {
            const target = this.gameState.getIdleTarget();
            if (target) creep.moveTo(target);
        } else {
            // 'attack' mode — move toward the movement target
            creep.moveTo(result.movementTarget);
        }
    }
}
