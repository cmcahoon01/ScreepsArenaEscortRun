/**
 * Game Constants and Configuration
 * 
 * This file centralizes all hard-coded values and magic numbers used throughout
 * the codebase. Organizing these values here makes them easier to tune and
 * understand their impact on bot behavior.
 */

import { LEFT, RIGHT, TOP, BOTTOM, BOTTOM_LEFT, BOTTOM_RIGHT, TOP_LEFT, TOP_RIGHT } from "game/constants";

// ============================================================================
// Body Part Costs
// ============================================================================

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
     * Initial build order that always executes first.
     * Builds in sequence: miner1 → blocker → mule → miner2 → mule.
     * All are replaced if they die. After all are present, creeps are built
     * according to PHASE2_BUILD weights.
     */
    INITIAL_BUILD: [
        'miner1',
        'blocker',
        'mule',
        'miner2',
        'mule',
    ],

    /**
     * Phase 2 build weights. After the initial build order completes, creeps
     * are built to maintain proportions defined here.
     */
    PHASE2_BUILD: [
        // { job: 'fighter', weight: 5 },
        { job: 'cleric', weight: 1 },
    ],

    /**
     * Distance (Chebyshev) threshold at which enemy escort creep approaching
     * the goal triggers aggressive behavior.
     */
    AGGRESSIVE_TRIGGER_DISTANCE: 82,

    /**
     * Jobs that should spawn facing the closest resource source.
     * All other jobs spawn in the opposite direction (away from the source).
     */
    SOURCE_FACING_JOBS: ['miner1', 'miner2', 'mule', 'blocker'],
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
     * Spawn coordinates for top and bottom spawns.
     */
    TOP_SPAWN_COORDINATES: {x:9, y:9},
    BOTTOM_SPAWN_COORDINATES: {x:9, y:90},
    
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
     * Center position of the arena map (x, y).
     * Used as an idle position for combat creeps when no enemies are targetable.
     */
    MAP_CENTER: { x: 50, y: 50 },

    /**
     * All 8 spawn directions starting with RIGHT (clockwise).
     * Used when spawning toward the right side of the map.
     */
    RIGHT_FIRST_SPAWNING: [RIGHT, BOTTOM_RIGHT, BOTTOM, BOTTOM_LEFT, LEFT, TOP_LEFT, TOP, TOP_RIGHT],

    /**
     * All 8 spawn directions starting with LEFT (clockwise).
     * Used when spawning toward the left side of the map.
     */
    LEFT_FIRST_SPAWNING: [LEFT, BOTTOM_LEFT, BOTTOM, BOTTOM_RIGHT, RIGHT, TOP_RIGHT, TOP, TOP_LEFT],
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
    COMBAT_ENGAGE_RADIUS: 45,

    /**
     * Job names that count as combat units eligible to be assigned as the flag killer
     * or filtered as combat-capable creeps.
     */
    COMBAT_JOBS: ['fighter', 'paladin', 'archer', 'cleric'],

    /**
     * Y-distance window used to define a vanguard group.
     * The vanguard leader is the combat unit closest (in y) to the enemy spawn,
     * and all units within this many y-units of the leader are included in
     * the vanguard for strength estimation.
     */
    VANGUARD_GROUP_HEIGHT: 4,
};

// ============================================================================
// Range Configuration
// ============================================================================

/**
 * Range constants for combat and healing interactions.
 * These values are defined by the Screeps Arena API.
 */
export const RangeConfig = {
    /**
     * Maximum range for ranged attacks (ranged_attack body part).
     */
    RANGED_ATTACK_RANGE: 3,

    /**
     * Range for melee healing (heal body part, adjacent).
     */
    HEAL_RANGE: 1,

    /**
     * Maximum range for ranged healing (heal body part).
     */
    RANGED_HEAL_RANGE: 3,

    /**
     * Range for adjacent (melee) interactions.
     */
    ADJACENT_RANGE: 1,
};

// ============================================================================
// Payload Configuration
// ============================================================================

/**
 * Configuration for the payload (EscortCreep) state machine and movement.
 */
export const PayloadConfig = {
    /**
     * State string for the payload waiting on a rampart near spawn.
     */
    STATE_WAITING: 'waiting',

    /**
     * State string for the payload actively moving toward the flag.
     */
    STATE_MOVING: 'moving',

    /**
     * Strength ratio threshold for "significant military advantage".
     * When myStrength / enemyStrength >= this value, the payload advances.
     */
    MILITARY_ADVANTAGE_THRESHOLD: 1.5,

    /**
     * Game tick threshold after which the payload advances regardless of military strength.
     */
    GAME_TIME_THRESHOLD: 1500,

    /**
     * Chebyshev distance from our spawn at which the payload waits on a rampart.
     */
    WAITING_RAMPART_DISTANCE: 2,

    /**
     * X offset from spawn for the forward waiting position (toward the goal).
     */
    WAITING_FORWARD_OFFSET_X: 3,

    /**
     * Y offset magnitude from spawn for the forward waiting position.
     * Applied as negative (upward) when spawn is on top, positive (downward) when on bottom.
     */
    WAITING_FORWARD_OFFSET_Y: 3,

    /**
     * Chebyshev distance threshold for detecting nearby enemies while waiting.
     * If any enemy is within this range, the payload seeks cover on a rampart.
     */
    ENEMY_NEARBY_RANGE: 8,
};

// ============================================================================
// Miner Job Configuration
// ============================================================================

/**
 * Set of job names that count as miner-type creeps.
 * Used to replace `c.jobName === "miner"` checks throughout the codebase.
 */
export const MINER_JOB_NAMES = new Set(["miner1", "miner2"]);

