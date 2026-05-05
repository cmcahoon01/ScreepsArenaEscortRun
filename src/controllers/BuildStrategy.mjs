import { Jobs } from '../jobs/JobRegistry.mjs';
import { BuildConfig, DEFAULT_TIER } from '../constants.mjs';

export class BuildStrategy {
    constructor(gameState) {
        this.gameState = gameState;
    }

    getNextCreepToBuild(creeps) {
        const creepCounts = {};
        for (const activeCreep of creeps) {
            creepCounts[activeCreep.jobName] = (creepCounts[activeCreep.jobName] || 0) + 1;
        }

        // Phase 1: Initial build order — replace any lost creeps immediately.
        const initialBuild = BuildConfig.INITIAL_BUILD;
        for (let i = 0; i < initialBuild.length; i++) {
            const buildItem = initialBuild[i];
            const jobName = buildItem.job || buildItem;
            const tier = buildItem.tier || DEFAULT_TIER;
            const jobClass = Jobs[jobName];

            if (!jobClass) {
                console.log(`Warning: Unknown job type '${jobName}' in build order`);
                continue;
            }

            // Skip permanently if replace_dead is explicitly false and this job has already died.
            // When replace_dead is omitted (undefined), creeps are replaced by default.
            if (buildItem.replace_dead === false && this.gameState.getJobEverDied(jobName)) {
                continue;
            }

            // Skip this tick if the only_if condition is not satisfied.
            if (typeof buildItem.only_if === 'function' && !buildItem.only_if(this.gameState)) {
                continue;
            }

            let expectedCount = 0;
            for (let j = 0; j <= i; j++) {
                const checkItem = initialBuild[j];
                if ((checkItem.job || checkItem) === jobName) {
                    expectedCount++;
                }
            }

            if ((creepCounts[jobName] || 0) < expectedCount) {
                return {
                    job: jobName,
                    tier: tier,
                    body: jobClass.getTierBody(tier),
                    cost: jobClass.getTierCost(tier),
                };
            }
        }

        // Phase 2: Build according to PHASE2_BUILD weights.
        const phase2Build = BuildConfig.PHASE2_BUILD;
        const totalWeight = phase2Build.reduce((sum, e) => sum + e.weight, 0);
        const phase2Total = phase2Build.reduce((sum, e) => sum + (creepCounts[e.job] || 0), 0);

        for (const entry of phase2Build) {
            const jobClass = Jobs[entry.job];
            if (!jobClass) continue;
            const actualCount = creepCounts[entry.job] || 0;
            const idealCount = Math.floor((phase2Total + 1) * entry.weight / totalWeight);
            if (actualCount < idealCount) {
                return {
                    job: entry.job,
                    tier: DEFAULT_TIER,
                    body: jobClass.getTierBody(DEFAULT_TIER),
                    cost: jobClass.getTierCost(DEFAULT_TIER),
                };
            }
        }

        // Fallback: build the first phase2 entry
        const fallback = phase2Build[0];
        const fallbackClass = Jobs[fallback.job];
        return {
            job: fallback.job,
            tier: DEFAULT_TIER,
            body: fallbackClass.getTierBody(DEFAULT_TIER),
            cost: fallbackClass.getTierCost(DEFAULT_TIER),
        };
    }
}
