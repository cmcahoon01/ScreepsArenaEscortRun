import { Jobs } from '../jobs/JobRegistry.mjs';
import { BuildConfig, DEFAULT_TIER } from '../constants.mjs';

/**
 * Determines what to build based on game state.
 *
 * Default build order (enemy escort is currently on a rampart — it's protected, so use economy):
 *   cleric → miner → tugs forever.
 * Aggressive build order (enemy escort has moved off its rampart — it's exposed, so hunt it):
 *   cleric → fighters forever (no miner or tugs).
 *
 * The build order is re-evaluated every tick. Once the enemy escort leaves its rampart,
 * the strategy switches to aggressive and stays there (fighters keep being built).
 * The cleric is replaced immediately if it dies in both modes.
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
            mule: 0,
            cleric: 0,
            tug: 0,
        };

        for (const activeCreep of creeps) {
            if (creepCounts[activeCreep.jobName] !== undefined) {
                creepCounts[activeCreep.jobName]++;
            }
        }

        // Check the enemy escort creep's current position each tick.
        // While it's on a rampart it's protected, so use the economy build.
        // Once it moves off the rampart it's exposed, so switch to aggressive (fighters).
        const enemyEscortOnRampart = this.gameState.isEnemyEscortCreepOnRampart();
        const initialBuild = enemyEscortOnRampart
            ? BuildConfig.INITIAL_BUILD
            : BuildConfig.AGGRESSIVE_INITIAL_BUILD;

        // Phase 1: Initial build order. Replace any lost creeps immediately.
        for (let i = 0; i < initialBuild.length; i++) {
            const buildItem = initialBuild[i];
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
                const checkItem = initialBuild[j];
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

        if (!enemyEscortOnRampart) {
            // Phase 2 (aggressive): Build fighters forever
            const fighterClass = Jobs['fighter'];
            return {
                job: 'fighter',
                tier: DEFAULT_TIER,
                body: fighterClass.getTierBody(DEFAULT_TIER),
                cost: fighterClass.getTierCost(DEFAULT_TIER)
            };
        }

        // Phase 2 (default): Build tugs forever
        const tugClass = Jobs['tug'];
        return {
            job: 'tug',
            tier: DEFAULT_TIER,
            body: tugClass.getTierBody(DEFAULT_TIER),
            cost: tugClass.getTierCost(DEFAULT_TIER)
        };
    }
}
