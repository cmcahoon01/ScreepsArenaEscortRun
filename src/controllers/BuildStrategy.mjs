import { Jobs } from '../jobs/JobRegistry.mjs';
import { BuildConfig, DEFAULT_TIER } from '../constants.mjs';

/**
 * Determines what to build based on game state.
 *
 * Default build order (enemy escort has not yet advanced toward our flag — it's far away,
 * so use economy):
 *   miner → blocker → mule → cleric → tugs forever.
 * Aggressive build order (enemy escort has moved within BuildConfig.AGGRESSIVE_TRIGGER_DISTANCE
 * Chebyshev of our flag — it's advancing toward the goal, so hunt it):
 *   miner → blocker → mule → fighters forever (no cleric or tugs).
 *
 * The build order is re-evaluated every tick. The aggressive mode only activates after both the
 * miner and blocker have been built. Once the enemy escort comes within the trigger distance at
 * that point, the strategy switches to aggressive and stays there (fighters keep being built).
 * Lost miner and blocker creeps are replaced immediately in both modes.
 *
 * Blocker exceptions:
 *   - A blocker is never built if any enemy unit has an attack or ranged_attack body part.
 *   - Once the first blocker dies, no further blockers are ever built.
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
            blocker: 0,
            mule: 0,
            cleric: 0,
            tug: 0,
        };

        for (const activeCreep of creeps) {
            if (creepCounts[activeCreep.jobName] !== undefined) {
                creepCounts[activeCreep.jobName]++;
            }
        }

        // Check the enemy escort creep's current distance to our flag each tick.
        // While it's far away (Chebyshev distance >= AGGRESSIVE_TRIGGER_DISTANCE),
        // use the economy build. Once it comes within that distance — meaning the
        // enemy is advancing toward the goal — switch to aggressive (fighters).
        // The aggressive switch only activates after miner and blocker are already built.
        const enemyApproaching = this.gameState.isEnemyEscortCreepApproachingGoal();
        const initialBuild = enemyApproaching
            ? BuildConfig.AGGRESSIVE_INITIAL_BUILD
            : BuildConfig.INITIAL_BUILD;

        // Pre-compute blocker eligibility once, before iterating the build order.
        // A blocker is skipped if any enemy has combat body parts, or if one has already died.
        const blockerForbidden = this.gameState.getEnemyHasCombatUnit() || this.gameState.getBlockerEverDied();

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

            // Never build a blocker if the enemy has any unit with combat body parts,
            // and never rebuild one once the first blocker has died.
            if (jobName === 'blocker' && blockerForbidden) {
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

        if (enemyApproaching) {
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
