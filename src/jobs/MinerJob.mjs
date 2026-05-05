import { getObjectById, createConstructionSite } from 'game/utils';
import { WORK, CARRY, ERR_NOT_IN_RANGE, OK, RESOURCE_ENERGY } from 'game/constants';
import { StructureContainer } from 'game/prototypes';
import { ActiveCreep } from './base/ActiveCreep.mjs';
import { assignSourceToMiner, findMiningPosition } from '../services/mining/SourceAssignmentStrategy.mjs';
import { MinerState, initialize, isAtTargetPosition, setTargetPosition, transitionToMining, isMovingToPosition, isMining, getTargetPosition } from '../services/mining/MinerStateMachine.mjs';
import { findContainerPosition } from '../services/mining/ContainerPlacementStrategy.mjs';
import { calculateCost } from '../services/BodyPartService.mjs';
import { MINER_JOB_NAMES } from '../constants.mjs';
import { chebyshevDistance } from '../services/RangeUtils.mjs';

export class MinerJob extends ActiveCreep {
    static get BODY() {
        return [WORK, WORK, CARRY];
    }

    static get COST() {
        return calculateCost(this.BODY);
    }

    static get JOB_NAME() {
        return 'miner';
    }

    static getTierBody(tier) {
        switch (tier) {
            case 1: return this.BODY;
            case 2: return [WORK, WORK, WORK, WORK, CARRY];
            default: throw new Error(`Tier ${tier} not defined for MinerJob`);
        }
    }

    /**
     * Whether this miner should place the mining container on arrival.
     * Overridden to true by Miner2Job.
     * @returns {boolean}
     */
    shouldPlaceContainer() {
        return false;
    }

    constructor(id, jobName, tier, controller, gameState) {
        super(id, jobName, tier, controller, gameState);
        const body = this.getBody();
        this.totalCapacity = 50 * body.filter(part => part === CARRY).length;
        this.workParts = body.filter(part => part === WORK).length;
        this.miningProduction = 2 * this.workParts;
    }

    findAdjacentMule(creep) {
        const muleCreeps = this.gameState.getMyCreeps().filter(
            c => this.gameState.getCreepJobName(c.id) === 'mule'
        );
        for (const mule of muleCreeps) {
            if (chebyshevDistance(creep, mule) <= 1) return mule;
        }
        return null;
    }

    act() {
        const creep = getObjectById(this.id);
        if (!creep) return;

        if (!this.memory.initialized) {
            const minerIndex = this.controller.creeps.filter(c =>
                MINER_JOB_NAMES.has(c.jobName) && c.id !== this.id
            ).length;
            const assignedSource = assignSourceToMiner(minerIndex, this.gameState);
            if (assignedSource) {
                initialize(this.memory, minerIndex, assignedSource);
            } else {
                console.log(`Miner ${this.id} could not be assigned a source (index: ${minerIndex})`);
                this.memory.initialized = true;
                return;
            }
        }

        const source = getObjectById(this.memory.sourceId);
        if (!source) {
            console.log(`Miner ${this.id} has no valid source`);
            return;
        }

        if (isMovingToPosition(this.memory)) {
            this.moveToMiningPosition(creep, source);
        }

        if (isMining(this.memory)) {
            this.mine(creep, source);
        }
    }

    moveToMiningPosition(creep, source) {
        let targetPos = getTargetPosition(this.memory);
        if (!targetPos) {
            const occupiedPositions = this.controller.creeps
                .filter(c => MINER_JOB_NAMES.has(c.jobName) && c.id !== this.id &&
                    c.memory.targetX != null && c.memory.targetY != null)
                .map(c => ({ x: c.memory.targetX, y: c.memory.targetY }));
            const miningPos = findMiningPosition(source, this.gameState, occupiedPositions);
            if (miningPos) {
                setTargetPosition(this.memory, miningPos);
                targetPos = miningPos;
            } else {
                console.log(`Miner ${this.id} couldn't find mining position`);
                return;
            }
        }

        if (!isAtTargetPosition(creep, this.memory)) {
            const tugChain = this.gameState.getTugChain();
            if (tugChain.length === 0) {
                tugChain.claim(this.id);
                tugChain.tick(targetPos, this.gameState);
            } else if (tugChain.getChainPosition(this.id) === 1) {
                // This miner is the subject (index 1) of the active chain
                tugChain.tick(targetPos, this.gameState);
            }
            // Else another miner is using the chain — wait this tick
            return;
        }

        transitionToMining(this.memory);
        console.log(`Miner ${this.id} arrived at mining position`);

        if (this.shouldPlaceContainer() && !this.gameState.getMiningContainerPos()) {
            // Find the companion miner (the one that does not place the container)
            const companionMiner = this.controller.creeps.find(c =>
                MINER_JOB_NAMES.has(c.jobName) && c.id !== this.id &&
                typeof c.shouldPlaceContainer === 'function' && !c.shouldPlaceContainer()
            );
            const tier1Pos = (companionMiner && companionMiner.memory.targetX != null)
                ? { x: companionMiner.memory.targetX, y: companionMiner.memory.targetY }
                : null;
            const containerPos = findContainerPosition(creep, tier1Pos, source);
            if (containerPos) {
                const result = createConstructionSite(containerPos, StructureContainer);
                if (result.object) {
                    this.gameState.setMiningContainerPos(containerPos.x, containerPos.y);
                    console.log(`Miner ${this.id} placed container site at (${containerPos.x}, ${containerPos.y})`);
                } else {
                    console.log(`Miner ${this.id} failed to place container site: error ${result.error}`);
                }
            } else {
                console.log(`Miner ${this.id} could not find a valid container position`);
            }
        }
    }

    mine(creep, source) {

        const harvestResult = creep.harvest(source);
        if (harvestResult === ERR_NOT_IN_RANGE) {
            console.log(`Miner ${this.id} not in range of source`);
        }
        const containerId = this.gameState.getMiningContainerId();
        const containerPos = this.gameState.getMiningContainerPos();

        if (containerId) {
            const container = getObjectById(containerId);
            if (container) {
                const transferResult = creep.transfer(container, RESOURCE_ENERGY);
                if (transferResult === ERR_NOT_IN_RANGE) {
                    console.log(`Miner ${this.id} not in range of container`);
                }
            }
        } else if (containerPos) {
            const site = this.gameState.getMyConstructionSites().find(s =>
                s.x === containerPos.x && s.y === containerPos.y
            );
            if (site) {
                const buildResult = creep.build(site);
                if (buildResult === ERR_NOT_IN_RANGE) {
                    console.log(`Miner ${this.id} not in range of container site`);
                }
            }
        } else {
            const adjacentMule = this.findAdjacentMule(creep);
            if (adjacentMule) {
                creep.transfer(adjacentMule, RESOURCE_ENERGY);
            }
            // Otherwise skip — wait for a mule to arrive
        }
    }
}
