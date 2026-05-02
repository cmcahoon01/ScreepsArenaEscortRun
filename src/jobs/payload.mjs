import { getObjectById } from 'game/utils';
import { ActiveCreep } from './ActiveCreep.mjs';
import { TugChainService } from '../services/TugChainService.mjs';
import { compareTeamStrengths } from '../combat/strengthEstimator.mjs';

const PAYLOAD_STATE_WAITING = 'waiting';
const PAYLOAD_STATE_MOVING = 'moving';

/**
 * Minimum number of tugs required to trigger the transition from waiting to moving.
 */
const TUG_COUNT_THRESHOLD = 10;

/**
 * Strength ratio threshold for "significant military advantage".
 * When myStrength / enemyStrength >= this value, we consider ourselves to have
 * sufficient advantage to advance the payload.
 */
const MILITARY_ADVANTAGE_THRESHOLD = 1.5;

/**
 * Chebyshev distance from our spawn at which the payload waits on a rampart.
 */
const WAITING_RAMPART_DISTANCE = 2;

/**
 * PayloadJob - manages the EscortCreep (payload) unit in two states.
 *
 * State 1 (waiting): The payload moves onto a friendly rampart at Chebyshev
 *   distance 2 from our spawn and holds position there.
 *
 * State 2 (moving): The payload initialises the tug chain (placing itself as
 *   the anchor) and the chain is driven toward our flag each tick via
 *   TugChainService.  Tugs in the ScreepController automatically join the
 *   chain once it is non-empty.
 *
 * Transition from waiting → moving fires when EITHER:
 *   - We have more than TUG_COUNT_THRESHOLD tugs alive, OR
 *   - Our combat-strength ratio is >= MILITARY_ADVANTAGE_THRESHOLD
 */
export class PayloadJob extends ActiveCreep {
    static get BODY() {
        // EscortCreep is pre-spawned by the arena, not built via the build order.
        return [];
    }

    static get COST() {
        return 0;
    }

    static get JOB_NAME() {
        return 'payload';
    }

    /**
     * @param {string} id - EscortCreep object ID
     * @param {string} jobName
     * @param {number} tier
     * @param {ScreepController} controller
     * @param {ConstructionSite} winObjective
     * @param {GameState} gameState
     * @param {Flag} flag - Our flag (move target in state 2)
     */
    constructor(id, jobName, tier, controller, winObjective, gameState, flag) {
        super(id, jobName, tier, controller, winObjective, gameState);
        this.flag = flag;
        this.memory.state = PAYLOAD_STATE_WAITING;
    }

    /**
     * Count the number of tug creeps currently alive in the controller.
     * @returns {number}
     */
    getTugCount() {
        return this.controller.creeps.filter(c => c.jobName === 'tug').length;
    }

    /**
     * Check whether we have a significant military advantage over the enemy.
     * @returns {boolean}
     */
    hasMilitaryAdvantage() {
        const comparison = compareTeamStrengths(this.gameState);
        return comparison.ratio >= MILITARY_ADVANTAGE_THRESHOLD;
    }

    /**
     * Return true when the waiting → moving transition should fire.
     * @returns {boolean}
     */
    shouldTransitionToMoving() {
        return this.getTugCount() > TUG_COUNT_THRESHOLD || this.hasMilitaryAdvantage();
    }

    /**
     * Find a friendly rampart at exactly WAITING_RAMPART_DISTANCE (Chebyshev)
     * from our spawn for the payload to shelter on while waiting.
     * @param {Creep} creep
     * @returns {StructureRampart|null}
     */
    findWaitingRampart(creep) {
        const spawn = this.gameState.getMySpawn();
        if (!spawn) {
            return null;
        }

        const nearRamparts = this.gameState.getMyRamparts().filter(r => {
            const dist = Math.max(Math.abs(r.x - spawn.x), Math.abs(r.y - spawn.y));
            return dist === WAITING_RAMPART_DISTANCE;
        });

        if (nearRamparts.length === 0) {
            return null;
        }

        return creep.findClosestByRange(nearRamparts);
    }

    act() {
        const creep = getObjectById(this.id);
        if (!creep) {
            return;
        }

        // ── State 1: waiting on a rampart near spawn ──────────────────────────
        if (this.memory.state === PAYLOAD_STATE_WAITING) {
            if (this.shouldTransitionToMoving()) {
                this.memory.state = PAYLOAD_STATE_MOVING;
                // Seed the tug chain with this payload as the sole entry.
                // When the first tug arrives adjacent to the payload it will
                // prepend itself: tugChain becomes [tugId, payloadId], so the
                // payload moves to index 1 and is pulled by the tug at index 0.
                this.gameState.setTugChain([this.id]);
            } else {
                const targetRampart = this.findWaitingRampart(creep);
                if (targetRampart) {
                    creep.moveTo(targetRampart);
                }
                return;
            }
        }

        // ── State 2: moving toward the flag with tug assistance ───────────────
        if (this.memory.state === PAYLOAD_STATE_MOVING) {
            // Re-claim the tug chain if it was cleared (e.g. after a delivery).
            const tugChain = this.gameState.getTugChain();
            if (tugChain.length === 0) {
                this.gameState.setTugChain([this.id]);
            }

            if (this.flag) {
                TugChainService.moveChain(this.gameState.getTugChain(), this.flag, this.gameState);
            }
        }
    }
}
