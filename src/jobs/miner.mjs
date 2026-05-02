import { getObjectById } from 'game/utils';
import { WORK, CARRY, MOVE, ERR_NOT_IN_RANGE, RESOURCE_ENERGY } from 'game/constants';
import { ActiveCreep } from './ActiveCreep.mjs';
import { SourceAssignmentStrategy } from './SourceAssignmentStrategy.mjs';
import { ExtensionBuilder } from './ExtensionBuilder.mjs';
import { MinerStateMachine } from './MinerStateMachine.mjs';
import { BodyPartCalculator } from '../constants.mjs';
import { CombatUtils } from '../services/CombatUtils.mjs';
import { TugChainService } from '../services/TugChainService.mjs';
import { performInitialWinObjectiveTransfer } from '../services/StructureUtils.mjs';

// Miner job - dedicated resource extraction and extension building
export class MinerJob extends ActiveCreep {
    static get BODY() {
        return [WORK, WORK, CARRY];
    }

    static get COST() {
        return BodyPartCalculator.calculateCost(this.BODY);
    }

    static get JOB_NAME() {
        return 'miner';
    }

    /**
     * Get body configuration for a specific tier.
     * @param {number} tier - The tier level (1 or 2)
     * @returns {string[]} Array of body part constants
     */
    static getTierBody(tier) {
        switch(tier) {
            case 1:
                return this.BODY; // Tier 1: Basic miner (reuse static BODY)
            case 2:
                return [WORK, WORK, WORK, WORK, CARRY]; // Tier 2: Advanced miner with more work parts
            default:
                throw new Error(`Tier ${tier} not defined for MinerJob`);
        }
    }

    constructor(id, jobName, tier, controller, winObjective, gameState) {
        super(id, jobName, tier, controller, winObjective, gameState);
        
        // Calculate properties based on this creep's tier
        const body = this.getBody();
        this.totalCapacity = 50 * body.filter(part => part === CARRY).length;
        this.workParts = body.filter(part => part === WORK).length;
        this.miningProduction = 2 * this.workParts;
        this.buildingProduction = 5 * this.workParts;
    }

    act() {
        const creep = getObjectById(this.id);
        if (!creep) {
            return;
        }
        
        // === INITIAL WIN OBJECTIVE TRANSFER ===
        // Miners spawn before haulers and need to perform the initial transfer
        // Since miners can't move on their own, they must be spawned adjacent to both
        // spawn and win objective. The spawn direction logic handles this positioning.
        if (performInitialWinObjectiveTransfer(creep, this.gameState, this.winObjective)) {
            return;
        }
        
        // Initialize memory if not set
        if (!this.memory.initialized) {
            // Count how many miners exist before this one (this is the 0-based index)
            const minerIndex = this.controller.creeps.filter(c => 
                c.jobName === 'miner' && c.id !== this.id
            ).length;
            
            // Assign source based on miner index
            const assignedSource = SourceAssignmentStrategy.assignSourceToMiner(minerIndex, this.gameState);
            if (assignedSource) {
                MinerStateMachine.initialize(this.memory, minerIndex, assignedSource);
            } else {
                // No source available - mark as initialized to avoid repeated attempts
                console.log(`Miner ${this.id} could not be assigned a source (index: ${minerIndex})`);
                this.memory.initialized = true;
                return; // Exit early - this miner cannot function
            }
        }
        
        // Get the assigned source
        const source = getObjectById(this.memory.sourceId);
        if (!source) {
            console.log(`Miner ${this.id} has no valid source`);
            return;
        }
        
        // State: Moving to mining position
        if (MinerStateMachine.isMovingToPosition(this.memory)) {
            // // === DEFENSIVE POSTURING CHECK (only for miners not yet arrived) ===
            // const inDefensiveMode = CombatUtils.handleDefensiveRetreat(creep, this.gameState);
            //
            // if (inDefensiveMode) {
            //     return; // Don't continue with normal mining movement
            // }
            
            // Calculate target position if not already set
            let targetPos = MinerStateMachine.getTargetPosition(this.memory);
            if (!targetPos) {
                const miningPos = SourceAssignmentStrategy.findMiningPosition(source, this.gameState);
                if (miningPos) {
                    MinerStateMachine.setTargetPosition(this.memory, miningPos);
                    targetPos = miningPos;
                } else {
                    console.log(`Miner ${this.id} couldn't find mining position`);
                    return;
                }
            }
            
            // Check if we've arrived
            if (!MinerStateMachine.isAtTargetPosition(creep, this.memory)) {
                // Use tug chain to move to the target position
                const tugChain = this.gameState.getTugChain();
                
                // Only set up the tug chain if it's empty or already assigned to this miner
                if (tugChain.length === 0) {
                    // Chain is free, claim it for this miner
                    const newChain = [this.id];
                    this.gameState.setTugChain(newChain);
                    TugChainService.moveChain(newChain, targetPos, this.gameState);
                } else if (tugChain[1] === this.id) {
                    // This miner is already using the chain, continue moving
                    TugChainService.moveChain(tugChain, targetPos, this.gameState);
                } else {
                    // Another miner is using the chain, wait for it to finish
                    // Don't move this tick
                }
                return;
            } else {
                // Arrived at target position
                MinerStateMachine.transitionToMining(this.memory);
                console.log(`Miner ${this.id} arrived at mining position`);
            }
        }
        
        // State: Mining and working
        if (MinerStateMachine.isMining(this.memory)) {
            const usedCapacity = creep.store[RESOURCE_ENERGY] || 0;
            if (MinerStateMachine.isStage1(this.memory)) {
                // Alternate between mining and using resources
                if (usedCapacity < this.buildingProduction) {
                    // Mine from source
                    const harvestResult = creep.harvest(source);
                    if (harvestResult === ERR_NOT_IN_RANGE) {
                        console.log(`Miner ${this.id} not in range of source`);
                    }
                } else {
                    // Create construction sites if not already done
                    if (!MinerStateMachine.extensionsCreated(this.memory)) {
                        ExtensionBuilder.createExtensionSites(creep, source);
                        MinerStateMachine.markExtensionsCreated(this.memory);
                    }

                    // Try to build nearby construction sites
                    const isBuilding = ExtensionBuilder.buildNearbyConstructionSites(creep, this.gameState);

                    if (!isBuilding) {
                        // Check if all extensions nearby are built (construction is complete)
                        if (ExtensionBuilder.areExtensionsComplete(creep, this.gameState)) {
                            // All extensions are built, move to stage 2
                            MinerStateMachine.transitionToStage2(this.memory);
                            console.log(`Miner ${this.id} moving to stage 2`);
                        }
                    }
                }
            } else if (MinerStateMachine.isStage2(this.memory)) {
                // Alternate between mining and using resources
                if (usedCapacity < Math.min(100, this.totalCapacity - this.miningProduction)) {
                    // Mine from source
                    const harvestResult = creep.harvest(source);
                    if (harvestResult === ERR_NOT_IN_RANGE) {
                        console.log(`Miner ${this.id} not in range of source`);
                    }
                } else {
                    // Stage 2: Deposit to least full extension
                    ExtensionBuilder.fillExtensions(creep, RESOURCE_ENERGY, this.gameState);
                }
            }
        }
    }
}
