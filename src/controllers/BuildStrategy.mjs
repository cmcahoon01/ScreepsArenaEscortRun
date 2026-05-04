import { Jobs } from '../services/jobs/JobRegistry.mjs';
import { BuildConfig, DEFAULT_TIER } from '../constants.mjs';

/**
 * Determines what to build based on game state.
 *
 * Build order:
 *   Phase 1 (initial): miner → blocker → mule → cleric → miner → tug → mule → miner → mule.
 *     All initial-build creeps are replaced immediately if they die.
 *   Phase 2 (continuous): fighters and clerics at a BuildConfig.FIGHTER_TO_CLERIC_RATIO ratio.
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
            fighter: 0,
        };

        for (const activeCreep of creeps) {
            if (creepCounts[activeCreep.jobName] !== undefined) {
                creepCounts[activeCreep.jobName]++;
            }
        }

        // Pre-compute blocker eligibility once, before iterating the build order.
        // A blocker is skipped if any enemy has combat body parts, or if one has already died.
        const blockerForbidden = this.gameState.getEnemyHasCombatUnit() || this.gameState.getBlockerEverDied();

        // Phase 1: Initial build order. Replace any lost creeps immediately.
        const initialBuild = BuildConfig.INITIAL_BUILD;
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

        // Phase 2: Build fighters and clerics at FIGHTER_TO_CLERIC_RATIO ratio.
        const ratio = BuildConfig.FIGHTER_TO_CLERIC_RATIO;
        const fighterClass = Jobs['fighter'];
        const clericClass = Jobs['cleric'];
        if (creepCounts.fighter < creepCounts.cleric * ratio) {
            return {
                job: 'fighter',
                tier: DEFAULT_TIER,
                body: fighterClass.getTierBody(DEFAULT_TIER),
                cost: fighterClass.getTierCost(DEFAULT_TIER)
            };
        }
        return {
            job: 'cleric',
            tier: DEFAULT_TIER,
            body: clericClass.getTierBody(DEFAULT_TIER),
            cost: clericClass.getTierCost(DEFAULT_TIER)
        };
    }
}
