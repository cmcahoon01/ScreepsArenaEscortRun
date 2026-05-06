import { getObjectById, getRange } from 'game/utils';
import { RANGED_ATTACK, HEAL, MOVE } from 'game/constants';
import { RangedJob } from './base/RangedJob.mjs';
import { isInHealRange, isInRangedHealRange } from '../services/RangeUtils.mjs';
import { calculateCost } from '../services/BodyPartService.mjs';
import {PayloadConfig} from "../constants.mjs";

export class ClericJob extends RangedJob {
    static get BODY() {
        return [MOVE, MOVE, RANGED_ATTACK, HEAL];
    }

    static get COST() {
        return calculateCost(this.BODY);
    }

    static get JOB_NAME() {
        return 'cleric';
    }

    shouldHealDuringIdle() {
        return true;
    }

    performHealing(creep, damagedCreeps, allCreeps) {
        const selfIsDamaged = creep.hits < creep.hitsMax;
        const payload = getObjectById(this.gameState.getPayloadId());

        if (selfIsDamaged) {
            creep.heal(creep);
        } else if (payload.hits < PayloadConfig.CRITICAL_HP) {
            if (isInHealRange(creep, payload)) {
                creep.heal(payload);
            } else if (isInRangedHealRange(creep, payload)) {
                creep.rangedHeal(payload);
            } else {
                creep.moveTo(payload);
                const closestDamagedAlly = creep.findClosestByRange(damagedCreeps);
                creep.rangedHeal(closestDamagedAlly);
            }
        } else if (damagedCreeps.length > 0) {
            const closestDamagedAlly = creep.findClosestByRange(damagedCreeps);
            if (closestDamagedAlly && closestDamagedAlly.id !== creep.id) {
                if (isInHealRange(creep, closestDamagedAlly)) {
                    creep.heal(closestDamagedAlly);
                } else if (isInRangedHealRange(creep, closestDamagedAlly)) {
                    creep.rangedHeal(closestDamagedAlly);
                }
            }
        }
    }
}
