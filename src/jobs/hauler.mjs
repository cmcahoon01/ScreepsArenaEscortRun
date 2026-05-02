import {getObjectById} from 'game/utils';
import {WORK, CARRY, MOVE, ERR_NOT_IN_RANGE, RESOURCE_ENERGY, OK} from 'game/constants';
import {ActiveCreep} from './ActiveCreep.mjs';
import {BodyPartCalculator, MapTopology} from '../constants.mjs';
import {CombatUtils} from '../services/CombatUtils.mjs';
import {performInitialWinObjectiveTransfer} from '../services/StructureUtils.mjs';

// Hauler job - resource gathering and construction
export class HaulerJob extends ActiveCreep {
    static get BODY() {
        return [WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
    }

    static get COST() {
        return BodyPartCalculator.calculateCost(this.BODY);
    }

    static get JOB_NAME() {
        return 'hauler';
    }

    // Helper function to deliver resources to spawn
    deliverToSpawn(creep) {
        const spawn = this.gameState.getMySpawn();
        if (spawn) {
            const transferResult = creep.transfer(spawn, RESOURCE_ENERGY);
            if (transferResult === ERR_NOT_IN_RANGE) {
                creep.moveTo(spawn);
            }
        }
    }

    act() {
        const creep = getObjectById(this.id);
        if (!creep) {
            return;
        }

        // === DEFENSIVE POSTURING CHECK ===
        const inDefensiveMode = CombatUtils.handleDefensiveRetreat(creep, this.gameState);

        if (inDefensiveMode) {
            // Haulers don't attack, just stay on ramparts
            return;
        }

        // === INITIAL WIN OBJECTIVE TRANSFER ===
        // If the win objective hasn't been initialized yet,
        // withdraw from spawn and build the win objective once
        if (performInitialWinObjectiveTransfer(creep, this.gameState, this.winObjective)) {
            return;
        }

        // Initialize state if not set
        if (!this.memory.state) {
            this.memory.state = 'mining';
        }

        // Get current carry capacity and amount
        const usedCapacity = creep.store[RESOURCE_ENERGY] || 0;
        const totalCapacity = creep.store.getCapacity(RESOURCE_ENERGY);

        // State machine logic
        if (this.memory.state === 'mining') {
            // Check if we're at capacity
            if (usedCapacity >= totalCapacity) {
                this.memory.state = 'hauling';
                return;
            }

            // Find the closest source, excluding corner sources (y < CORNER_TOP or y > CORNER_BOTTOM)
            // This forces haulers to use the central sources near the middle of the map
            const allSources = this.gameState.getSources();
            const centralSources = allSources.filter(source =>
                source.y >= MapTopology.CORNER_TOP_THRESHOLD &&
                source.y <= MapTopology.CORNER_BOTTOM_THRESHOLD
            );
            // Fallback to all sources if no central sources exist
            const sourcesToUse = centralSources.length > 0 ? centralSources : allSources;
            const closestSource = creep.findClosestByRange(sourcesToUse);

            if (closestSource) {
                // Try to harvest
                const harvestResult = creep.harvest(closestSource);

                // If not in range, move towards the source
                if (harvestResult === ERR_NOT_IN_RANGE) {
                    creep.moveTo(closestSource);
                }
            }
        } else if (this.memory.state === 'hauling') {
            // Check if we're empty
            if (usedCapacity === 0) {
                this.memory.state = 'mining';
                return;
            }
            if (this.gameState.getHasBuiltMiner()) {
                // Determine the target (either winObjective or spawn)
                let target = this.winObjective;
                if (!target) {
                    target = this.gameState.getMySpawn();
                }

                if (target) {
                    // Now move towards the target
                    // If target is winObjective, also try to build it
                    if (this.winObjective && target === this.winObjective) {
                        const buildResult = creep.build(this.winObjective);
                        if (buildResult === ERR_NOT_IN_RANGE) {
                            creep.moveTo(this.winObjective);
                        }
                    } else {
                        // Moving to spawn
                        const transferResult = creep.transfer(target, RESOURCE_ENERGY);
                        if (transferResult === ERR_NOT_IN_RANGE) {
                            creep.moveTo(target);
                        }
                    }
                }
            } else {
                // No miners, deliver to spawn
                this.deliverToSpawn(creep);
            }
        }
    }
}
