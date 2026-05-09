import * as BuildConditions from './BuildConditions.mjs';
import {enemyRushing, weAreDominating} from "./BuildConditions.mjs";

export class BuildOrder {
    /**
     * Initial build order that always executes first.
     * Builds in sequence: miner1 → blocker → mule → paladin → miner2 → mule.
     * After all are present, creeps are built according to PHASE2_OPTIONS.
     *
     * Each entry is an object with the following fields:
     *   job          {string}               - The job name (required).
     *   tier         {number}               - Body tier (optional, defaults to DEFAULT_TIER).
     *   replace_dead {boolean}              - If false, do not rebuild this creep when it
     *                                        dies (optional, defaults to true).
     *   only_if      {(gameState)=>boolean} - Skip this build step when the function
     *                                        returns false (optional). See
     *                                        src/buildOrder/BuildConditions.mjs for examples.
     */
    static INITIAL_BUILD = [
        { job: 'miner1' },
        { job: 'mule' },
        { job: 'paladin', replace_dead: false, only_if: BuildConditions.needRushPaladin },
        { job: 'blocker', replace_dead: false, only_if: BuildConditions.enemyRushing },
        { job: 'miner2' }, // slightly bigger miner
        { job: 'mule' },
    ];

    /**
     * Phase 2 build options. After the initial build order completes, the strategy
     * iterates through these options in order and uses the first one whose `only_if`
     * condition returns true. The last option has no `only_if` and serves as the
     * default fallback.
     *
     * Each option has the following fields:
     *   only_if {(gameState)=>boolean} - Condition to select this option (omit for default).
     *   build   {Array}               - Array of build entries, each with:
     *     job    {string} - The job name (required).
     *     weight {number} - Relative spawn weight for this job (required).
     */
    static PHASE2_OPTIONS = [
        { // paladins if they are rushing
            only_if: enemyRushing,
            build: [
                { job: 'fighter', weight: 1},
                { job: 'cleric', weight: 3 },
            ]
        },
        { // tugs if we are dominating
            only_if: weAreDominating,
            build: [
                { job: 'tug' },
            ]
        },
        { // Default option.
            build: [
                { job: 'cleric', weight: 1 },
                { job: 'archer', weight: 1 },
            ],
        },
    ];
}
