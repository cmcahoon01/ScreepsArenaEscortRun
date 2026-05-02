import { Jobs } from '../jobs/JobRegistry.mjs';
import { BuildConfig, DEFAULT_TIER } from '../constants.mjs';

/**
 * Determines what to build based on game state.
 * Build order: cleric → miner → tugs forever.
 * Cleric and miner are replaced immediately if they die.
 */
export class BuildStrategy {
    /**
     * @param {GameState} gameState - The game state service for cached game objects
     */
    constructor(gameState) {
        this.gameState = gameState;
    }
    
    /**
     * Get the next creep to build based on the current game state.
     * @param {Array} creeps - Array of active creeps
     * @returns {Object|null} Configuration object with job, tier, body, and cost, or null if nothing to build
     */
    getNextCreepToBuild(creeps) {
        // Count creeps by job type
        const creepCounts = {
            miner: 0,
            cleric: 0,
            tug: 0,
        };

        for (const activeCreep of creeps) {
            if (creepCounts[activeCreep.jobName] !== undefined) {
                creepCounts[activeCreep.jobName]++;
            }
        }

        // Phase 1: Initial build order (cleric, then miner). Replace either if they die.
        for (let i = 0; i < BuildConfig.INITIAL_BUILD.length; i++) {
            const buildItem = BuildConfig.INITIAL_BUILD[i];
            const jobName = buildItem.job || buildItem; // Support both string and {job, tier} format
            const tier = buildItem.tier || DEFAULT_TIER;
            const jobClass = Jobs[jobName];
            
            if (!jobClass) {
                console.log(`Warning: Unknown job type '${jobName}' in build order`);
                continue;
            }
            
            // Count how many of this job should exist up to and including this position
            let expectedCount = 0;
            for (let j = 0; j <= i; j++) {
                const checkItem = BuildConfig.INITIAL_BUILD[j];
                const checkJobName = checkItem.job || checkItem;
                if (checkJobName === jobName) {
                    expectedCount++;
                }
            }

            // If we don't have enough of this job type, build it
            if (creepCounts[jobName] < expectedCount) {
                return { 
                    job: jobName,
                    tier: tier,
                    body: jobClass.getTierBody(tier), 
                    cost: jobClass.getTierCost(tier)
                };
            }
        }

        // Phase 2: Build tugs forever
        const tugClass = Jobs['tug'];
        return {
            job: 'tug',
            tier: DEFAULT_TIER,
            body: tugClass.getTierBody(DEFAULT_TIER),
            cost: tugClass.getTierCost(DEFAULT_TIER)
        };
    }
}
