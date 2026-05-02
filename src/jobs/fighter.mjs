import { getObjectById, getRange } from 'game/utils';
import { ATTACK, MOVE, ERR_NOT_IN_RANGE} from 'game/constants';
import { Creep, StructureSpawn, StructureRampart } from 'game/prototypes';
import { ActiveCreep } from './ActiveCreep.mjs';
import { CombatUtils } from '../services/CombatUtils.mjs';
import { BodyPartCalculator, MapTopology } from '../constants.mjs';

// Fighter job - melee combat
export class FighterJob extends ActiveCreep {
    static get BODY() {
        return [MOVE, ATTACK];
    }

    static get COST() {
        return BodyPartCalculator.calculateCost(this.BODY);
    }

    static get JOB_NAME() {
        return 'fighter';
    }

    act() {
        const creep = getObjectById(this.id);
        if (!creep) {
            return;
        }

        // === DEFENSIVE POSTURING CHECK ===
        const inDefensiveMode = CombatUtils.handleDefensiveRetreat(creep, this.gameState);
        
        if (inDefensiveMode) {
            // Still attack enemies if they're in range (even while on ramparts)
            const allHostileCreeps = this.gameState.getEnemyCreeps();
            if (allHostileCreeps.length > 0) {
                const closestEnemy = creep.findClosestByRange(allHostileCreeps);
                if (closestEnemy) {
                    creep.attack(closestEnemy);
                }
            }
            return;
        }

        // Find all enemy creeps
        const allHostileCreeps = this.gameState.getEnemyCreeps();
        
        // Get all ramparts
        const ramparts = this.gameState.getRamparts();
        
        // Filter out enemies that are standing on ramparts
        const hostileCreeps = CombatUtils.filterMeleeTargetableEnemies(allHostileCreeps, ramparts);
        
        // Check if there are any enemies within range 5
        // Range 5 is chosen as the engagement threshold - close enough to respond to threats
        // but allows checking for fortified miners if no immediate danger exists
        const enemiesInRange5 = hostileCreeps.filter(enemy => getRange(creep, enemy) <= 5);
        
        // If there are no targetable enemies within range 5, check for fortified miner
        if (enemiesInRange5.length === 0) {
            const fortifiedMiner = this.gameState.getFortifiedMiner();
            if (fortifiedMiner) {
                this.attackFortifiedMiner(creep, fortifiedMiner);
                return;
            }
            
            // No fortified miner either, idle
            this.idle(creep);
            return;
        }

        // Find the closest enemy creep that is not on a rampart and is within range 5
        const target = creep.findClosestByRange(enemiesInRange5);
        
        if (target) {
            // Try to attack the target
            const attackResult = creep.attack(target);
            
            // If the target is not in range, move towards it
            if (attackResult === ERR_NOT_IN_RANGE) {
                creep.moveTo(target);
            }
        } else {
            this.idle(creep);
        }
    }
    
    /**
     * Attack a fortified miner by moving towards it and breaking ramparts in the way.
     * @param {Creep} creep - The fighter creep
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
        const enemySpawn = this.gameState.getEnemySpawn();
        if (!enemySpawn) {
            return;
        }
        
        // Check if we're in enemy's third of the map - if so, move out
        if (CombatUtils.isInEnemyThird(creep, enemySpawn)) {
            // Move towards our spawn (away from enemy third)
            const mySpawn = this.gameState.getMySpawn();
            if (mySpawn) {
                creep.moveTo(mySpawn);
            }
        } else {
            // Idle in the center 2/3rds of the map
            // Stay roughly where we are or move towards center line
            const mapSize = MapTopology.ARENA_SIZE;
            const centerPos = {
                x: mapSize / 2,
                y: mapSize / 2
            };
            
            // Only move if we're far from center (to avoid constant movement)
            const distToCenter = Math.abs(creep.x - centerPos.x) + Math.abs(creep.y - centerPos.y);
            if (distToCenter > mapSize / 4) {
                creep.moveTo(centerPos);
            }
        }
    }
}
