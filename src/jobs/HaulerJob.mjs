import { getObjectById } from 'game/utils';
import { WORK, CARRY, MOVE, ERR_NOT_IN_RANGE, RESOURCE_ENERGY } from 'game/constants';
import { ActiveCreep } from './base/ActiveCreep.mjs';
import { calculateCost } from '../services/BodyPartService.mjs';
import { MapTopology } from '../constants.mjs';

export class HaulerJob extends ActiveCreep {
    static get BODY() {
        return [WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
    }

    static get COST() {
        return calculateCost(this.BODY);
    }

    static get JOB_NAME() {
        return 'hauler';
    }

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
        if (!creep) return;

        if (!this.memory.state) {
            this.memory.state = 'mining';
        }

        const usedCapacity = creep.store[RESOURCE_ENERGY] || 0;
        const totalCapacity = creep.store.getCapacity(RESOURCE_ENERGY);

        if (this.memory.state === 'mining') {
            if (usedCapacity >= totalCapacity) {
                this.memory.state = 'hauling';
                return;
            }

            const allSources = this.gameState.getSources();
            const centralSources = allSources.filter(source =>
                source.y >= MapTopology.CORNER_TOP_THRESHOLD &&
                source.y <= MapTopology.CORNER_BOTTOM_THRESHOLD
            );
            const sourcesToUse = centralSources.length > 0 ? centralSources : allSources;
            const closestSource = creep.findClosestByRange(sourcesToUse);

            if (closestSource) {
                const harvestResult = creep.harvest(closestSource);
                if (harvestResult === ERR_NOT_IN_RANGE) {
                    creep.moveTo(closestSource);
                }
            }
        } else if (this.memory.state === 'hauling') {
            if (usedCapacity === 0) {
                this.memory.state = 'mining';
                return;
            }
            this.deliverToSpawn(creep);
        }
    }
}
