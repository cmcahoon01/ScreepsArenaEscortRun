import { getObjectById } from 'game/utils';
import { ATTACK, MOVE, ERR_NOT_IN_RANGE } from 'game/constants';
import { ActiveCreep } from './ActiveCreep.mjs';
import { CombatUtils } from './CombatUtils.mjs';
import { MapTopology } from '../constants.mjs';

// Base class for melee combat units (fighter and paladin)
export class MeleeJob extends ActiveCreep {
    constructor(id, jobName, tier, controller, gameState) {
        super(id, jobName, tier, controller, gameState);
        if (new.target === MeleeJob) {
            throw new TypeError("Cannot construct MeleeJob instances directly");
        }
    }

    // Hook method for subclasses to implement healing logic
    performHealing(creep, damagedCreeps) {
        // Default: no healing
    }

    act() {
        const creep = getObjectById(this.id);
        if (!creep) {
            return;
        }

        const allHostileCreeps = this.gameState.getEnemyCreeps();
        const myCreeps = this.gameState.getMyCreeps();

        // Find damaged friendly creeps (excluding self; self is passed separately)
        const damagedCreeps = myCreeps.filter(c => c.id !== creep.id && c.hits < c.hitsMax);

        // === HEALING LOGIC (if applicable) ===
        this.performHealing(creep, damagedCreeps);

        // === DEFENSIVE POSTURING CHECK ===
        //const inDefensiveMode = CombatUtils.handleDefensiveRetreat(creep, this.gameState);
        const inDefensiveMode = false;

        if (inDefensiveMode) {
            // Still attack enemies if they're in range (even while on ramparts)
            if (allHostileCreeps.length > 0) {
                const closestEnemy = creep.findClosestByRange(allHostileCreeps);
                if (closestEnemy) {
                    creep.attack(closestEnemy);
                }
            }
            return;
        }

        // Enemies within actual melee attack range (1) - used to determine "fight back" logic
        const enemiesInMeleeRange = allHostileCreeps.filter(e => {
            const dx = e.x - creep.x;
            const dy = e.y - creep.y;
            return Math.max(Math.abs(dx), Math.abs(dy)) <= 1;
        });

        const result = CombatUtils.selectPrimaryTarget(creep, this.gameState, enemiesInMeleeRange);

        if (!result || result.mode === 'idle') {
            this.idle(creep);
            return;
        }

        if (result.mode === 'payload_priority') {
            if (result.combatEnemiesInRange.length > 0) {
                const target = creep.findClosestByRange(result.combatEnemiesInRange);
                if (target) {
                    this.attackOrMoveTo(creep, target);
                    return;
                }
            }
            this.attackOrMoveTo(creep, result.enemyPayload);
            return;
        }

        // Standard mode: disengage if the coordinator says enemies have retreated
        if (!this.gameState.isCombatEngaged()) {
            this.idle(creep);
            return;
        }

        // Attack the closest valid enemy; if out of melee range, move
        // towards the priority movement target (flag blocker / payload-relative / closest).
        const attackResult = creep.attack(result.attackTarget);
        if (attackResult === ERR_NOT_IN_RANGE) {
            creep.moveTo(result.movementTarget);
        }
    }

    /**
     * Attempt to attack a target; if out of range, move toward it.
     * @param {Creep} creep - The attacking creep
     * @param {Object} target - The target game object
     */
    attackOrMoveTo(creep, target) {
        const attackResult = creep.attack(target);
        if (attackResult === ERR_NOT_IN_RANGE) {
            creep.moveTo(target);
        }
    }

    /**
     * Attack a fortified miner by moving towards it and breaking ramparts in the way.
     * @param {Creep} creep - The melee creep
     * @param {Object} fortifiedMiner - Object with {creep, rampart, source}
     */
    attackFortifiedMiner(creep, fortifiedMiner) {
        const targetCreep = fortifiedMiner.creep;
        const targetRampart = fortifiedMiner.rampart;

        // Try to attack the target creep first (if in range)
        const attackCreepResult = creep.attack(targetCreep);

        if (attackCreepResult === ERR_NOT_IN_RANGE) {
            // Not in range of the creep, check if we can attack the rampart
            const attackRampartResult = creep.attack(targetRampart);

            if (attackRampartResult === ERR_NOT_IN_RANGE) {
                // Not in range of rampart either, move towards the target
                creep.moveTo(targetCreep);
            }
            // If we successfully attacked the rampart, no need to move
        }
        // If we successfully attacked the creep, no need to move
    }

    idle(creep) {
        const mapSize = MapTopology.ARENA_SIZE;
        const centerPos = {
            x: mapSize / 2,
            y: mapSize / 2
        };

        creep.moveTo(centerPos);
    }
}
