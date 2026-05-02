import { ATTACK, RANGED_ATTACK, HEAL } from 'game/constants';
import { CombatConfig } from '../constants.mjs';

/**
 * Combat Strength Estimator
 * 
 * Estimates the combat strength of creeps based on their body parts.
 * 
 * Combat Metrics:
 * - ATTACK: 30 damage per hit (melee range)
 * - RANGED_ATTACK: 10 damage per hit (range 1-3)
 * - HEAL: 12 healing per tick (range 1), 4 healing per tick (range 2-3)
 * 
 * Heuristic Rules (from observations):
 * 1. One RANGED_ATTACK beats up to 3 ATTACK units (ranged advantage = 3x)
 * 2. One RANGED_ATTACK + HEAL ≈ 2 RANGED_ATTACK units (healing multiplier = 2x)
 * 3. Two ATTACK units beat one ATTACK + HEAL (melee with healing less effective)
 * 
 * Combat Value Formula:
 * - Base melee value = ATTACK_parts * 30 (damage output)
 * - Base ranged value = RANGED_ATTACK_parts * 10 * 3 (damage * ranged advantage)
 * - Healing bonus = HEAL_parts * 12 * multiplier
 *   - For ranged units: multiplier = 2.0 (highly effective)
 *   - For melee units: multiplier = 0.5 (less effective in melee combat)
 */

/**
 * Count body parts of a specific type in a creep
 * @param {Creep} creep - The creep to analyze
 * @param {string} bodyPartType - The type of body part to count
 * @returns {number} Count of body parts
 */
function countBodyParts(creep, bodyPartType) {
    if (!creep || !creep.body) {
        return 0;
    }
    return creep.body.filter(part => part.type === bodyPartType).length;
}

/**
 * Calculate the combat strength value of a single creep
 * @param {Creep} creep - The creep to evaluate
 * @returns {number} Combat strength value
 */
export function calculateCreepStrength(creep) {
    if (!creep || !creep.body) {
        return 0;
    }

    const attackParts = countBodyParts(creep, ATTACK);
    const rangedAttackParts = countBodyParts(creep, RANGED_ATTACK);
    const healParts = countBodyParts(creep, HEAL);

    let strength = 0;

    // Calculate base combat value
    if (rangedAttackParts > 0) {
        // Ranged unit - benefits from kiting and range advantage
        strength += rangedAttackParts * CombatConfig.DAMAGE.RANGED_ATTACK_POWER * CombatConfig.MULTIPLIERS.RANGED_ADVANTAGE;
        
        // Healing is highly effective with ranged combat
        if (healParts > 0) {
            strength += healParts * CombatConfig.DAMAGE.HEAL_POWER * CombatConfig.MULTIPLIERS.RANGED_HEAL;
        }
    } else if (attackParts > 0) {
        // Melee unit - straightforward damage
        strength += attackParts * CombatConfig.DAMAGE.ATTACK_POWER;
        
        // Healing is less effective in melee combat (gets focused down)
        if (healParts > 0) {
            strength += healParts * CombatConfig.DAMAGE.HEAL_POWER * CombatConfig.MULTIPLIERS.MELEE_HEAL;
        }
    } else if (healParts > 0) {
        // Support unit with only healing (minimal combat value)
        strength += healParts * CombatConfig.DAMAGE.HEAL_POWER * CombatConfig.MULTIPLIERS.SUPPORT_HEAL;
    }

    return strength;
}

/**
 * Calculate the total combat strength of a team of creeps
 * @param {Creep[]} creeps - Array of creeps to evaluate
 * @returns {number} Total combat strength
 */
export function calculateTeamStrength(creeps) {
    if (!creeps || creeps.length === 0) {
        return 0;
    }

    return creeps.reduce((total, creep) => {
        return total + calculateCreepStrength(creep);
    }, 0);
}

/**
 * Get all friendly creeps and calculate their total strength
 * @param {GameState} gameState - The game state service for cached game objects
 * @returns {Object} Object containing creeps array and total strength
 */
export function getMyTeamStrength(gameState) {
    const myCreeps = gameState.getMyCreeps();
    const strength = calculateTeamStrength(myCreeps);
    
    return {
        creeps: myCreeps,
        count: myCreeps.length,
        strength: strength
    };
}

/**
 * Get all enemy creeps and calculate their total strength
 * @param {GameState} gameState - The game state service for cached game objects
 * @returns {Object} Object containing creeps array and total strength
 */
export function getEnemyTeamStrength(gameState) {
    const enemyCreeps = gameState.getEnemyCreeps();
    const strength = calculateTeamStrength(enemyCreeps);
    
    return {
        creeps: enemyCreeps,
        count: enemyCreeps.length,
        strength: strength
    };
}

/**
 * Compare the relative strength of two teams
 * @param {GameState} gameState - The game state service for cached game objects
 * @returns {Object} Comparison object with both teams' strengths and advantage
 */
export function compareTeamStrengths(gameState) {
    const myTeam = getMyTeamStrength(gameState);
    const enemyTeam = getEnemyTeamStrength(gameState);
    
    const advantage = myTeam.strength - enemyTeam.strength;
    const ratio = enemyTeam.strength > 0 ? myTeam.strength / enemyTeam.strength : Infinity;
    
    return {
        myTeam: myTeam,
        enemyTeam: enemyTeam,
        advantage: advantage,
        ratio: ratio,
        assessment: advantage > 0 ? 'favorable' : advantage < 0 ? 'unfavorable' : 'even'
    };
}

/**
 * Get detailed breakdown of a creep's combat capabilities
 * @param {Creep} creep - The creep to analyze
 * @returns {Object} Detailed breakdown
 */
export function getCreepBreakdown(creep) {
    if (!creep || !creep.body) {
        return null;
    }

    const attackParts = countBodyParts(creep, ATTACK);
    const rangedAttackParts = countBodyParts(creep, RANGED_ATTACK);
    const healParts = countBodyParts(creep, HEAL);
    const strength = calculateCreepStrength(creep);

    return {
        id: creep.id,
        attack: attackParts,
        rangedAttack: rangedAttackParts,
        heal: healParts,
        strength: strength,
        type: rangedAttackParts > 0 ? 'ranged' : attackParts > 0 ? 'melee' : 'support'
    };
}
