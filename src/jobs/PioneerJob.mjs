import { createConstructionSite, getObjectById, getObjectsByPrototype } from 'game/utils';
import { CARRY, WORK, MOVE, RESOURCE_ENERGY } from 'game/constants';
import { StructureContainer, StructureTower } from 'game/prototypes';
import { ActiveCreep } from './base/ActiveCreep.mjs';
import { calculateCost } from '../services/BodyPartService.mjs';
import { chebyshevDistance } from '../services/RangeUtils.mjs';

export class PioneerJob extends ActiveCreep {
    static get BODY() {
        return [CARRY, WORK, MOVE];
    }

    static get COST() {
        return calculateCost(this.BODY);
    }

    static get JOB_NAME() {
        return 'pioneer';
    }

    act() {
        const creep = getObjectById(this.id);
        if (!creep) return;

        const targetPos = this.gameState.getWeAreTop() ? { x: 91, y: 49 } : { x: 91, y: 50 };
        if (creep.x !== targetPos.x || creep.y !== targetPos.y) {
            creep.moveTo(targetPos);
            return;
        }

        const towerPos = { x: creep.x - 1, y: creep.y };
        let towerSite = this.gameState.getMyConstructionSites().find(site =>
            site.x === towerPos.x && site.y === towerPos.y
        );

        const towerExists = getObjectsByPrototype(StructureTower).some(t =>
            t.my && t.x === towerPos.x && t.y === towerPos.y
        );
        if (!towerSite && !towerExists) {
            const createResult = createConstructionSite(towerPos, StructureTower);
            if (createResult.object) {
                towerSite = createResult.object;
            }
        }

        const containers = getObjectsByPrototype(StructureContainer)
            .filter(container => chebyshevDistance(creep, container) <= 1);
        if (containers.length > 0) {
            const richestContainer = containers.reduce((richest, container) =>
                (container.store[RESOURCE_ENERGY] || 0) > (richest.store[RESOURCE_ENERGY] || 0) ? container : richest
            );
            creep.withdraw(richestContainer, RESOURCE_ENERGY);
        }

        if (towerSite) {
            creep.build(towerSite);
        }
    }
}
