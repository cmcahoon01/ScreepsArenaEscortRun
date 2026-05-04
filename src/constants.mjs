/**
 * Game Constants and Configuration
 * 
 * This file centralizes all hard-coded values and magic numbers used throughout
 * the codebase. Organizing these values here makes them easier to tune and
 * understand their impact on bot behavior.
 */

// ============================================================================
// Body Part Costs
// ============================================================================

import {LEFT, RIGHT, TOP, BOTTOM, BOTTOM_LEFT, BOTTOM_RIGHT, TOP_LEFT, TOP_RIGHT} from "game/constants";

/**
 * Cost of each body part type in energy.
 * These values are defined by the Screeps Arena API.
 */
export const BODY_PART_COSTS = {
    move: 50,
    attack: 80,
    ranged_attack: 150,
    heal: 250,
    work: 100,
    carry: 50,
    tough: 10,
};

/**
 * Utility class for calculating creep body costs.
 */
export class BodyPartCalculator {
    /**
     * Calculate the total energy cost of a body parts array.
     * @param {string[]} bodyParts - Array of body part constants (e.g., [MOVE, ATTACK])
     * @returns {number} Total energy cost
     */
    static calculateCost(bodyParts) {
        if (!bodyParts || bodyParts.length === 0) {
            return 0;
        }
        return bodyParts.reduce((sum, part) => {
            const cost = BODY_PART_COSTS[part];
            if (cost === undefined) {
                console.log(`Warning: Unknown body part type '${part}'`);
                return sum;
            }
            return sum + cost;
        }, 0);
    }
}

// ============================================================================
// Build Configuration
// ============================================================================

/**
 * Default tier for creeps when not specified.
 */
export const DEFAULT_TIER = 1;

/**
 * Configuration for build order and strategy decisions.
 */
export const BuildConfig = {
    /**
     * Strength threshold ratio for strategy switching.
     * When myStrength/enemyStrength >= 0.8, switch to logistics focus.
     * 
     * Rationale: At 80% or higher of enemy strength, we're competitive enough
     * to invest in economy without being overwhelmed. Below 80% means we need
     * more military units to survive.
     */
    STRENGTH_THRESHOLD: 0.8,
    
    /**
     * Military unit composition ratio.
     * For every 1 cleric (healer), build 3 archers (ranged attackers).
     * 
     * Rationale: Clerics provide healing support while archers deal damage.
     * The 3:1 ratio balances offensive power with sustainability. Too many
     * healers would reduce damage output, while too few would make the army
     * fragile.
     */
    MILITARY_RATIO: {
        ARCHERS_PER_CLERIC: 3
    },
    
    /**
     * Initial build order that always executes first.
     * Builds in sequence: miner → blocker → mule → cleric → tug → miner → mule → miner → mule.
     * All are replaced if they die. After all are present, fighters and clerics are built
     * continuously at a FIGHTER_TO_CLERIC_RATIO ratio.
     */
    INITIAL_BUILD: [
        {job: 'miner', tier: 1},
        'blocker',
        'mule',
        {job: 'miner', tier: 2},
        'mule',
        'cleric'
    ],

    /**
     * Ratio of fighters to clerics built after the initial build order completes.
     * For every 1 cleric, this many fighters are built.
     */
    FIGHTER_TO_CLERIC_RATIO: 2,
};

// ============================================================================
// Map Topology Constants
// ============================================================================

/**
 * Constants related to map layout and positioning.
 * Screeps Arena maps are typically 100x100 with sources in corners and center.
 */
export const MapTopology = {
    /**
     * Y-coordinate threshold for top corner sources.
     * Sources with y < 30 are considered "top corner" sources.
     */
    CORNER_TOP_THRESHOLD: 30,
    
    /**
     * Y-coordinate threshold for bottom corner sources.
     * Sources with y > 70 are considered "bottom corner" sources.
     */
    CORNER_BOTTOM_THRESHOLD: 70,
    
    /**
     * Number of extensions each miner should build around their source.
     * 
     * Rationale: 5 extensions per miner provides good energy storage capacity
     * without overcrowding the source area (which has limited space).
     */
    EXTENSIONS_PER_MINER: 0,
    
    /**
     * Arena map size (width and height).
     * Standard Screeps Arena maps are 100x100.
     */
    ARENA_SIZE: 100,
    
    /**
     * Center coordinate of the arena map.
     * Used to determine which side of the map a spawn is on.
     */
    ARENA_CENTER: 50,

    /**
     * Preferred spawn directions when spawning creeps.
     *
     */
    LEFT_FIRST_SPAWNING: [LEFT, TOP_LEFT, TOP, TOP_RIGHT, RIGHT, BOTTOM_RIGHT, BOTTOM, BOTTOM_LEFT],
    RIGHT_FIRST_SPAWNING: [RIGHT, BOTTOM_RIGHT, BOTTOM, BOTTOM_LEFT, LEFT, TOP_LEFT, TOP, TOP_RIGHT],
};

// ============================================================================
// Combat Configuration
// ============================================================================

/**
 * Configuration for combat strength estimation and calculations.
 * These multipliers are empirically derived from combat observations.
 */
export const CombatConfig = {
    /**
     * Base damage values for body parts (from Screeps API).
     */
    DAMAGE: {
        ATTACK_POWER: 30,        // Damage per ATTACK part (melee range)
        RANGED_ATTACK_POWER: 10, // Damage per RANGED_ATTACK part (range 1-3)
        HEAL_POWER: 12           // Healing per HEAL part (range 1)
    },
    
    /**
     * Combat multipliers based on empirical observations.
     */
    MULTIPLIERS: {
        /**
         * Ranged advantage multiplier = 3
         * 
         * One ranged unit can beat up to 3 melee units through kiting.
         * This accounts for the ability to maintain distance and deal damage
         * without taking hits.
         */
        RANGED_ADVANTAGE: 3,
        
        /**
         * Ranged healing multiplier = 2.0
         * 
         * Ranged units with healing are approximately 2x as effective as
         * ranged-only units. Healing allows sustained engagement and survival,
         * effectively doubling combat effectiveness.
         */
        RANGED_HEAL: 2.0,
        
        /**
         * Melee healing multiplier = 0.5
         * 
         * Melee healing is less effective due to being easily focused.
         * Two pure melee units beat one melee+heal unit, indicating healing
         * provides less than 50% bonus in melee combat.
         */
        MELEE_HEAL: 0.5,
        
        /**
         * Support healing multiplier = 1
         * 
         * Pure support units (healing only) have minimal combat value.
         * They can't deal damage and can be easily eliminated.
         */
        SUPPORT_HEAL: 1
    },
    
    /**
     * Defensive posture threshold.
     * When myStrength/enemyStrength < 0.7, units should retreat to ramparts.
     * 
     * Rationale: At less than 70% of enemy strength, we have an appreciable
     * disadvantage and should adopt defensive posture to protect units and
     * leverage rampart defenses.
     */
    DEFENSIVE_THRESHOLD: 0.7,

    /**
     * Distance threshold for flag-blocker priority.
     * When the payload is within this range of the flag and an enemy is standing
     * on the flag, all attackers not currently in combat will prioritize killing
     * that enemy.
     */
    FLAG_BLOCKER_RANGE: 40,

    /**
     * Euclidean radius around the enemy spawn that combat units must never enter.
     * If all enemies are within this zone, combat units idle near the map center.
     */
    ENEMY_SPAWN_EXCLUSION_RADIUS: 30,

    /**
     * Euclidean radius around the enemy spawn that an enemy combat unit must cross
     * before our units will engage.  Must be larger than ENEMY_SPAWN_EXCLUSION_RADIUS
     * to create a neutral gap that prevents rapid engage/disengage toggling when
     * enemies hover near the territory boundary.
     */
    COMBAT_ENGAGE_RADIUS: 45
};

// ============================================================================
// Construction Configuration
// ============================================================================

/**
 * Configuration for construction and infrastructure.
 */
export const ConstructionConfig = {
    /**
     * Maximum number of road construction sites to create.
     * 
     * Rationale: Limiting to 6 prevents over-investment in roads.
     * Roads cost energy to build and maintain. Too many roads would
     * divert resources from more important structures (extensions, spawns).
     * 6 roads is enough to improve key paths without excessive overhead.
     * 
     * Note: As of current implementation, road construction is commented out
     * in HaulerJob.mjs, but this constant is preserved for future use.
     */
    MAX_ROAD_CONSTRUCTION: 6
};
