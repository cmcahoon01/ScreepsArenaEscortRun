import { Jobs } from '../jobs/JobRegistry.mjs';
import { compareTeamStrengths } from '../combat/strengthEstimator.mjs';
import { BuildConfig, DEFAULT_TIER } from '../constants.mjs';

/**
 * Determines what to build based on game state.
 * Implements the build strategy logic including initial build order
 * and adaptive strategy based on team strength comparison.
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
            fighter: 0,
            archer: 0,
            hauler: 0,
            miner: 0,
            cleric: 0,
            tug: 0,
        };

        for (const activeCreep of creeps) {
            if (creepCounts[activeCreep.jobName] !== undefined) {
                creepCounts[activeCreep.jobName]++;
            }
        }

        // Phase 1: Initial build order (cleric)
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
        
        // Phase 1.5: Check for fortified miner - prioritize building a fighter if detected
        const fortifiedMiner = this.gameState.getFortifiedMiner();
        if (fortifiedMiner && creepCounts.fighter === 0) {
            const fighterClass = Jobs['fighter'];
            return {
                job: 'fighter',
                tier: DEFAULT_TIER,
                body: fighterClass.getTierBody(DEFAULT_TIER),
                cost: fighterClass.getTierCost(DEFAULT_TIER)
            };
        }

        // Phase 2: Adaptive build order based on team strength
        const comparison = compareTeamStrengths(this.gameState);
        
        // Determine if we're stronger or roughly equal
        const isStrongerOrEqual = comparison.ratio >= BuildConfig.STRENGTH_THRESHOLD;

        if (isStrongerOrEqual) {
            // Logistics path: Build economy units based on ECONOMY_BUILD order, then haulers infinitely
            for (let i = 0; i < BuildConfig.ECONOMY_BUILD.length; i++) {
                const buildItem = BuildConfig.ECONOMY_BUILD[i];
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
                    const checkItem = BuildConfig.ECONOMY_BUILD[j];
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
            
            // After, build haulers infinitely
            const haulerClass = Jobs['hauler'];
            return {
                job: 'hauler',
                tier: DEFAULT_TIER,
                body: haulerClass.getTierBody(DEFAULT_TIER),
                cost: haulerClass.getTierCost(DEFAULT_TIER)
            };
        } else {
            // Military path: Build archers and clerics at 3:1 ratio
            // Count military units (exclude initial cleric)
            const militaryClerics = Math.max(0, creepCounts.cleric);
            const militaryArchers = creepCounts.archer;
            
            // Build archers if we need more to maintain the ratio
            // We want BuildConfig.MILITARY_RATIO.ARCHERS_PER_CLERIC archers for every 1 cleric (after the initial one)
            // When militaryClerics is 0, we should build that many archers before the next cleric
            const desiredArchers = (militaryClerics + 1) * BuildConfig.MILITARY_RATIO.ARCHERS_PER_CLERIC;
            
            if (militaryArchers < desiredArchers) {
                const archerClass = Jobs['archer'];
                return {
                    job: 'archer',
                    tier: DEFAULT_TIER,
                    body: archerClass.getTierBody(DEFAULT_TIER),
                    cost: archerClass.getTierCost(DEFAULT_TIER)
                };
            } else {
                // Build a cleric to maintain the ratio
                const clericClass = Jobs['cleric'];
                return {
                    job: 'cleric',
                    tier: DEFAULT_TIER,
                    body: clericClass.getTierBody(DEFAULT_TIER),
                    cost: clericClass.getTierCost(DEFAULT_TIER)
                };
            }
        }
    }
}
