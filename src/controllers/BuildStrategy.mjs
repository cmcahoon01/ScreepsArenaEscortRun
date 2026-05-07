import { Jobs } from '../jobs/index.mjs';
import { DEFAULT_TIER } from '../constants.mjs';
import { BuildOrder } from '../buildOrder/BuildOrder.mjs';

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
        const initialBuild = BuildOrder.INITIAL_BUILD;
        for (let buildStep = 0; buildStep < initialBuild.length; buildStep++) {
            const buildItem = initialBuild[buildStep];
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
            //
            if ((typeof buildItem.only_if === 'function') &&
                (this.gameState.getHighestBuildStep() > buildStep || !buildItem.only_if(this.gameState))) {
                continue;
            }

            let expectedCount = 0;
            for (let j = 0; j <= buildStep; j++) {
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
                    buildStep: buildStep,
                };
            }
        }

        // Phase 2: Select the first option whose only_if condition is met (or the last as default).
        const phase2Options = BuildOrder.PHASE2_OPTIONS;
        let phase2Build = phase2Options[phase2Options.length - 1].build;
        for (const option of phase2Options) {
            if (typeof option.only_if !== 'function' || option.only_if(this.gameState)) {
                phase2Build = option.build;
                break;
            }
        }

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
                    buildStep: initialBuild.length,
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
            buildStep: initialBuild.length,
        };
    }
}
