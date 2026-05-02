// Base class for active creeps that combines CreepInfo data with Job behavior
import { BodyPartCalculator, DEFAULT_TIER } from '../constants.mjs';

export class ActiveCreep {
    constructor(id, jobName, tier, controller, winObjective, gameState) {
        if (new.target === ActiveCreep) {
            throw new TypeError("Cannot construct ActiveCreep instances directly");
        }
        this.id = id;
        this.jobName = jobName;
        this.tier = tier || DEFAULT_TIER; // Default to tier 1 if not specified
        this.controller = controller;
        this.winObjective = winObjective;
        this.gameState = gameState;
        this.memory = {}; // Dictionary to store creep-specific state/memory
    }

    // Abstract method that must be implemented by subclasses
    act() {
        throw new Error("Method 'act()' must be implemented by subclass");
    }

    // Static properties that subclasses should override
    static get BODY() {
        throw new Error("Static property 'BODY' must be defined by subclass");
    }

    static get COST() {
        throw new Error("Static property 'COST' must be defined by subclass");
    }

    static get JOB_NAME() {
        throw new Error("Static property 'JOB_NAME' must be defined by subclass");
    }

    // Methods for tier support
    /**
     * Get the body configuration for a specific tier.
     * Subclasses should override this to provide tier-specific bodies.
     * @param {number} tier - The tier level (1, 2, 3, etc.)
     * @returns {string[]} Array of body part constants
     */
    static getTierBody(tier) {
        // Default implementation returns the base BODY for tier 1
        if (tier === 1) {
            return this.BODY;
        }
        throw new Error(`Tier ${tier} not defined for ${this.name}. Override getTierBody() to support multiple tiers.`);
    }

    /**
     * Get the cost for a specific tier.
     * Default implementation calculates from getTierBody().
     * @param {number} tier - The tier level
     * @returns {number} Energy cost
     */
    static getTierCost(tier) {
        return BodyPartCalculator.calculateCost(this.getTierBody(tier));
    }

    /**
     * Get the body for this creep's tier.
     * @returns {string[]} Array of body part constants
     */
    getBody() {
        return this.constructor.getTierBody(this.tier);
    }
}
