import { createConstructionSite, getObjectById, getObjectsByPrototype } from 'game/utils';
import { CARRY, WORK, MOVE, RESOURCE_ENERGY, OK } from 'game/constants';
import { StructureTower } from 'game/prototypes';
import { ActiveCreep } from './base/ActiveCreep.mjs';
import { calculateCost } from '../services/BodyPartService.mjs';
import { chebyshevDistance } from '../services/RangeUtils.mjs';
import { MapTopology } from '../constants.mjs';

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

        const sources = this.gameState.getSources();
        if (!sources || sources.length === 0) return;

        const flag = this.gameState.getFlag();
        const targetSource = flag
            ? (
                sources.find(source =>
                    (source.x < MapTopology.ARENA_CENTER) === (flag.x < MapTopology.ARENA_CENTER) &&
                    (source.y < MapTopology.ARENA_CENTER) === (flag.y < MapTopology.ARENA_CENTER)
                ) || sources[0]
            )
            : sources[0];

        if (chebyshevDistance(creep, targetSource) > 1) {
            creep.moveTo(targetSource);
            return;
        }

        const towerPos = { x: creep.x - 1, y: creep.y };
        let towerSite = this.gameState.getMyConstructionSites().find(site =>
            site.x === towerPos.x && site.y === towerPos.y
        );

        const tower = getObjectsByPrototype(StructureTower).find(t =>
            t.my && t.x === towerPos.x && t.y === towerPos.y
        );
        if (!towerSite && !tower) {
            const createResult = createConstructionSite(towerPos, StructureTower);
            if (createResult.object) {
                towerSite = createResult.object;
            }
        }

        if (tower) {
            const carriedEnergy = creep.store[RESOURCE_ENERGY] || 0;
            if (carriedEnergy > 0) {
                const transferResult = creep.transfer(tower, RESOURCE_ENERGY);
                if (transferResult !== OK) {
                    return;
                }
            } else {
                creep.harvest(targetSource);
            }
            return;
        }

        if ((creep.store[RESOURCE_ENERGY] || 0) === 0) {
            creep.harvest(targetSource);
        }

        if (towerSite) {
            creep.build(towerSite);
        }
    }
}
