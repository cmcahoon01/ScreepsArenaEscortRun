import { getObjectById } from 'game/utils';
import { Jobs } from '../jobs/JobRegistry.mjs';
import { DEFAULT_TIER } from '../constants.mjs';

export class CreepController {
    constructor() {
        this.creeps = [];
    }

    addCreep(id, jobName, tier, gameState) {
        if (!Jobs[jobName]) {
            console.log(`Warning: Unknown job type '${jobName}'`);
            return;
        }
        const JobClass = Jobs[jobName];
        const activeCreep = new JobClass(id, jobName, tier || DEFAULT_TIER, this, gameState);
        this.creeps.push(activeCreep);
    }

    updateCreeps(gameState) {
        this.syncTurrets(gameState);

        this.creeps = this.creeps.filter(activeCreep => {
            const creep = getObjectById(activeCreep.id);
            if (!creep || !creep.exists) {
                return false;
            }
            if (!creep.spawning) {
                activeCreep.act();
            }
            return true;
        });

        // Publish the updated roster so GameState can use it without a back-reference
        gameState.updateCreepRoster(
            new Map(this.creeps.map(c => [c.id, c.jobName]))
        );
    }

    syncTurrets(gameState) {
        for (const turret of gameState.getMyTowers()) {
            const turretAlreadyRegistered = this.creeps.some(activeCreep => activeCreep.id === turret.id);
            if (!turretAlreadyRegistered) {
                this.addCreep(turret.id, 'turret', DEFAULT_TIER, gameState);
            }
        }
    }

    hasCreepOfRole(jobName) {
        return this.creeps.some(c => c.jobName === jobName);
    }
}
